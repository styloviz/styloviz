import { computed, signal, type Signal, type WritableSignal } from '@angular/core';

/**
 * Half-open slice of a list that is worth rendering: `[start, end)`.
 *
 * `end` is exclusive, so it feeds `Array.prototype.slice` directly and an empty
 * window is expressed as `start === end` rather than a negative length.
 */
export interface VirtualRange {
  readonly start: number;
  /** Exclusive. */
  readonly end: number;
}

/**
 * Fires when a scroll leaves the viewport within `nearEndThreshold` px of the
 * bottom of the scrollable content — the generic "the user is close to
 * running out of rows" signal that infinite-scroll is built on.
 *
 * ★ Fires unconditionally on every qualifying scroll event, with no notion of
 * "is a page already loading" or "does the server have more" — those are the
 * caller's concerns (`list-view`'s `hasMore` / `loadingMore` / an in-tick
 * guard against a burst of scroll events), same as before this was shared.
 * A primitive that also tried to own pagination state would need to know
 * about `loadMore` events, request lifecycles and per-consumer retry policy —
 * exactly the coupling `createVirtualizer` has otherwise never had.
 */
export interface NearEndOptions {
  /** Called when the scroll position satisfies the threshold below. */
  readonly onNearEnd?: () => void;
  /** Distance from the bottom, in pixels, that counts as "near". @default 100 */
  readonly nearEndThreshold?: Signal<number>;
}

/** Signals a virtualizer reads. All are read lazily, inside `computed`. */
export interface VirtualizerOptions<T> extends NearEndOptions {
  /** The full, already-filtered list. Only a window of it is ever rendered. */
  readonly items: Signal<readonly T[]>;
  /** Row height in pixels. Values ≤ 0 or non-finite fall back to 1. */
  readonly itemHeight: Signal<number>;
  /** Height of the scrolling viewport in pixels. */
  readonly viewportHeight: Signal<number>;
  /** Extra rows rendered above and below the viewport. @default 2 */
  readonly overscan?: Signal<number>;
  /** When false, the whole list is returned unwindowed. @default true */
  readonly enabled?: Signal<boolean>;
}

/** Windowing state derived from a scroll position. Every member is a signal. */
export interface Virtualizer<T> {
  /** The slice of `items` currently worth rendering. */
  readonly range: Signal<VirtualRange>;
  /** `items` narrowed to `range`. */
  readonly items: Signal<readonly T[]>;
  /** Height of the full list — the scrollable extent. */
  readonly totalHeight: Signal<number>;
  /** Height of the spacer that stands in for the rows above `range`. */
  readonly topSpacer: Signal<number>;
  /** Height of the spacer that stands in for the rows below `range`. */
  readonly bottomSpacer: Signal<number>;
  /** Current scroll offset in pixels, clamped to ≥ 0. */
  readonly scrollTop: Signal<number>;

  /** Set the scroll offset directly. */
  setScrollTop(px: number): void;
  /** Bind to `(scroll)` on the viewport element. */
  onScroll(event: Event): void;
  /** Pixel offset of a row — for scroll-to-index. */
  offsetOf(index: number): number;
}

const ALWAYS_ENABLED: Signal<boolean> = computed(() => true);
const DEFAULT_OVERSCAN: Signal<number> = computed(() => 2);
const DEFAULT_NEAR_END_THRESHOLD: Signal<number> = computed(() => 100);

/** Coerce to a finite number ≥ `min`, so a bad input can't poison the maths. */
function atLeast(value: number, min: number): number {
  return Number.isFinite(value) && value > min ? value : min;
}

/**
 * Shape of the DOM properties `onScroll`/near-end read off the event target.
 * A structural type, not `HTMLElement`, so a test can pass a plain object —
 * `list-view.scrolling.spec.ts` already relies on exactly this for jsdom,
 * where every element's geometry defaults to 0.
 */
interface ScrollGeometry {
  readonly scrollTop: number;
  readonly clientHeight?: number;
  readonly scrollHeight?: number;
}

/**
 * The `scrollTop` / `setScrollTop` / `onScroll` triplet, shared by every
 * virtualizer variant so the iOS-bounce clamp, the non-finite guard and the
 * near-end firing are written and tested exactly once.
 */
function createScrollState(near: NearEndOptions): {
  readonly scrollTop: WritableSignal<number>;
  readonly setScrollTop: (px: number) => void;
  readonly onScroll: (event: Event) => void;
} {
  const threshold = near.nearEndThreshold ?? DEFAULT_NEAR_END_THRESHOLD;
  const scrollTop = signal(0);

  const setScrollTop = (px: number): void => {
    scrollTop.set(Number.isFinite(px) ? Math.max(0, px) : 0);
  };

  const maybeFireNearEnd = (target: ScrollGeometry | null): void => {
    if (!near.onNearEnd || !target) return;
    const clientHeight = target.clientHeight ?? 0;
    const scrollHeight = target.scrollHeight ?? 0;
    // ★ Same shape as the inline check this replaced in `list-view`: within
    // `threshold` px of the bottom of the scrollable content. `scrollHeight`
    // of 0 (an untested/mocked element) never satisfies this unless
    // `scrollTop` is also 0, which a real "near the bottom" gesture is not.
    if (target.scrollTop + clientHeight >= scrollHeight - Math.max(0, threshold())) {
      near.onNearEnd();
    }
  };

  return {
    scrollTop,
    setScrollTop,
    onScroll: (event: Event) => {
      // Overscroll bounce reports a negative offset on iOS; clamp it.
      const el = event.target as ScrollGeometry | null;
      scrollTop.set(Math.max(0, el?.scrollTop ?? 0));
      maybeFireNearEnd(el);
    },
  };
}

/**
 * Fixed-height list virtualization, as a set of derived signals.
 *
 * Renders only the rows near the viewport and pads the rest with two spacer
 * elements, so a 50,000-row list costs the same as a 20-row one. Fixed row
 * height is the deliberate trade: it makes every position a multiplication, so
 * there is no measurement pass, no `ResizeObserver`, and no layout thrash.
 *
 * This is a plain factory, not a service or a directive — it needs no injection
 * context and can be called straight from a field initializer:
 *
 * ```ts
 * protected readonly virtual = createVirtualizer({
 *   items: this.rows,
 *   itemHeight: this.rowHeight,
 *   viewportHeight: this.viewportHeight,
 *   overscan: this.overscan,
 *   enabled: this.isVirtualized,
 * });
 * ```
 *
 * ```html
 * <div [style.height.px]="viewportHeight()" (scroll)="virtual.onScroll($event)"
 *      class="overflow-y-auto">
 *   <div [style.height.px]="virtual.totalHeight()">
 *     <div [style.height.px]="virtual.topSpacer()"></div>
 *     @for (row of virtual.items(); track row.id) { … }
 *     <div [style.height.px]="virtual.bottomSpacer()"></div>
 *   </div>
 * </div>
 * ```
 *
 * When `enabled` is false the range spans the whole list, so the same template
 * serves both the windowed and unwindowed cases.
 */
export function createVirtualizer<T>(options: VirtualizerOptions<T>): Virtualizer<T> {
  const overscan = options.overscan ?? DEFAULT_OVERSCAN;
  const enabled = options.enabled ?? ALWAYS_ENABLED;

  const { scrollTop, setScrollTop, onScroll } = createScrollState(options);

  /** Row height, guaranteed positive — a zero would divide by zero below. */
  const rowHeight = computed(() => atLeast(options.itemHeight(), 1));

  const range = computed<VirtualRange>(() => {
    const total = options.items().length;
    if (!enabled()) return { start: 0, end: total };

    const height = rowHeight();
    const viewport = Math.max(0, options.viewportHeight());
    const pad = Math.max(0, Math.floor(overscan()));

    // Clamp to the scrollable extent. If the list shrinks while the user is
    // scrolled near the bottom, the raw offset briefly points past the end —
    // without this the window would be empty until the next scroll event.
    const top = Math.min(scrollTop(), Math.max(0, total * height - viewport));

    // Round the first row down and the last row up: a viewport that does not
    // align to a row boundary shows a partial row at each edge, and both must
    // be rendered or the list has visible gaps when overscan is 0.
    const first = Math.floor(top / height);
    const last = Math.ceil((top + viewport) / height);

    const start = Math.min(Math.max(first - pad, 0), total);
    const end = Math.min(Math.max(last + pad, start), total);

    return { start, end };
  });

  const windowed = computed<readonly T[]>(() => {
    const { start, end } = range();
    const all = options.items();
    return start === 0 && end === all.length ? all : all.slice(start, end);
  });

  return {
    range,
    items: windowed,
    totalHeight: computed(() => options.items().length * rowHeight()),
    topSpacer: computed(() => range().start * rowHeight()),
    bottomSpacer: computed(() => {
      const trailing = Math.max(0, options.items().length - range().end);
      return trailing * rowHeight();
    }),
    scrollTop: scrollTop.asReadonly(),

    setScrollTop,
    onScroll,
    offsetOf: (index: number) => Math.max(0, index) * rowHeight(),
  };
}

// ── Variable-height virtualization ──────────────────────────────────────────

/** Signals a variable-height virtualizer reads. */
export interface VariableVirtualizerOptions<T> extends NearEndOptions {
  /** The full, already-filtered list. Only a window of it is ever rendered. */
  readonly items: Signal<readonly T[]>;
  /**
   * Height of row `index`, in pixels, given the item at that row. Called once
   * per row on every recompute — same cost class as a `@for` template
   * re-rendering its rows, not a per-frame cost. Values ≤ 0 or non-finite
   * fall back to 1, same as the fixed-height guard.
   */
  readonly itemSize: Signal<(index: number, item: T) => number>;
  /** Height of the scrolling viewport in pixels. */
  readonly viewportHeight: Signal<number>;
  /** Extra rows rendered above and below the viewport. @default 2 */
  readonly overscan?: Signal<number>;
  /** When false, the whole list is returned unwindowed. @default true */
  readonly enabled?: Signal<boolean>;
}

/**
 * Smallest index in `[0, sorted.length)` whose value is `>= target` — the
 * standard binary-search "lower bound". `sorted.length` if none qualifies.
 */
function lowerBound(sorted: readonly number[], target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Smallest index in `[0, sorted.length)` whose value is `> target` — the
 * standard binary-search "upper bound". `sorted.length` if none qualifies.
 */
function upperBound(sorted: readonly number[], target: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Variable-height list virtualization — `createVirtualizer`'s sibling for
 * rows that are not all the same height (a data-table's group-header rows
 * among its data rows; a call-history entry with a note under it next to one
 * without). Same returned shape, same template, same scroll/near-end
 * behaviour — swapping `itemHeight` for `itemSize` is the only call-site
 * change, so a consumer is never forced to choose between the two up front.
 *
 * ## The cost this adds, honestly
 *
 * Fixed-height virtualization is one multiplication per lookup; there is
 * nothing to measure. Variable height cannot avoid knowing every row's size,
 * so this builds a prefix-sum array of cumulative offsets on every `items()`
 * or `itemSize()` change — O(n) to build, O(log n) per range lookup via
 * binary search. For the list sizes virtualization exists to help (thousands
 * of rows, not millions) this is unmeasurable; it is not free, and pretending
 * otherwise would be the same shortcut the fixed-height version explicitly
 * refuses to take in the other direction.
 */
export function createVariableVirtualizer<T>(options: VariableVirtualizerOptions<T>): Virtualizer<T> {
  const overscan = options.overscan ?? DEFAULT_OVERSCAN;
  const enabled = options.enabled ?? ALWAYS_ENABLED;

  const { scrollTop, setScrollTop, onScroll } = createScrollState(options);

  /**
   * Cumulative offsets, length `items().length + 1`. `offsets[i]` is the
   * pixel position row `i` starts at; `offsets[n]` is the total height. Row
   * `i` occupies `[offsets[i], offsets[i + 1])`, so both are exactly what the
   * binary searches below need and what `offsetOf`/`topSpacer` return as-is.
   */
  const offsets = computed<readonly number[]>(() => {
    const items = options.items();
    const size = options.itemSize();
    const out = new Array<number>(items.length + 1);
    out[0] = 0;
    for (let i = 0; i < items.length; i++) {
      out[i + 1] = out[i] + atLeast(size(i, items[i]), 1);
    }
    return out;
  });

  const totalHeight = computed(() => offsets().at(-1) ?? 0);

  const range = computed<VirtualRange>(() => {
    const total = options.items().length;
    if (!enabled() || total === 0) return { start: 0, end: total };

    const table = offsets();
    const viewport = Math.max(0, options.viewportHeight());
    const pad = Math.max(0, Math.floor(overscan()));

    // Clamp to the scrollable extent — same reasoning as the fixed-height
    // version: a list that just shrank must not leave the window pointing
    // past the end until the next scroll event arrives.
    const top = Math.min(scrollTop(), Math.max(0, totalHeight() - viewport));

    // The row containing `top`: the last row whose offset is `<= top`.
    const first = upperBound(table, top) - 1;
    // The first row entirely past the viewport's bottom edge.
    const last = lowerBound(table, top + viewport);

    const start = Math.min(Math.max(first - pad, 0), total);
    const end = Math.min(Math.max(last + pad, start), total);

    return { start, end };
  });

  const windowed = computed<readonly T[]>(() => {
    const { start, end } = range();
    const all = options.items();
    return start === 0 && end === all.length ? all : all.slice(start, end);
  });

  const offsetOf = (index: number): number => {
    const table = offsets();
    const clamped = Math.min(Math.max(index, 0), table.length - 1);
    return table[clamped];
  };

  return {
    range,
    items: windowed,
    totalHeight,
    topSpacer: computed(() => offsetOf(range().start)),
    bottomSpacer: computed(() => totalHeight() - offsetOf(range().end)),
    scrollTop: scrollTop.asReadonly(),

    setScrollTop,
    onScroll,
    offsetOf,
  };
}
