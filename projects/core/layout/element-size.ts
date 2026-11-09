import {
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  type Signal,
} from '@angular/core';

/**
 * ============================================================================
 *  One measurement primitive — `X-12`, and the Layout backlog's `X-4`/`N-8`
 * ============================================================================
 *
 * Every geometry consumer needs the same thing: *how big is this, and tell me
 * when it changes.* Anchor re-measures sections (`NV-02-M4`), Breadcrumb decides
 * how many crumbs fit (`NV-03-M4`), Tabs and Mega Menu decide whether to collapse
 * (`X-11`).
 *
 * ★ This is also the Layout & Utilities `X-4`/`N-8` measurement primitive. It is
 * consumed by Affix, Splitter, Scroll Area, Watermark, Number Ticker, Expand,
 * Toolbar and the navigation families, in place of the hand-rolled
 * `ResizeObserver`s each used to carry with its own answer to throttling,
 * teardown and what "size" means. `N-8` asks for a choice of box, hence the
 * `box` option below.
 *
 * ── ★ The border box, not the content box ──────────────────────────────────
 * The obvious source is `entry.contentRect`, and for an overflow decision it is
 * **wrong**: `contentRect` excludes padding and border, so a strip measured that
 * way under-reports by exactly its own padding. A tab list with `px-4` decides
 * six tabs fit in the space five occupy, renders them, and overflows — and the
 * error scales with the design, so it looks like a spacing bug rather than a
 * measurement one. `borderBoxSize` is what actually occupies space.
 *
 * ── ★ The first value does not wait for the observer ───────────────────────
 * `ResizeObserver` delivers its first entry asynchronously, so a component that
 * waited for it would render one frame with a size of zero — which for an
 * overflow decision means *"nothing fits"*, so the first paint of every
 * responsive strip would be its fully-collapsed form, expanding a frame later.
 *
 * So the element is measured directly, with `getBoundingClientRect`, **in the
 * same pass that starts observing it**. That pass is an `effect`, so it runs on
 * the first change detection rather than at construction — which is still before
 * the first paint, and is the point that matters.
 *
 * ── Throttled, because the observer is not ─────────────────────────────────
 * A drag or an animated panel produces many callbacks per frame. Emissions are
 * coalesced to one per animation frame, which is the finest granularity a layout
 * decision can actually use.
 *
 * ⚠️ **Do not resize the observed element from a reader of this signal.** That is
 * the classic `ResizeObserver loop completed with undelivered notifications`, and
 * no amount of throttling fixes it — a feedback loop measured once per frame is
 * still a feedback loop. Measure a container and size something *else*.
 */

/** A size in CSS pixels — the border box unless `box: 'content-box'` was asked for. */
export interface SvSize {
  readonly width: number;
  readonly height: number;
}

/** Zero, and what every server render reports. */
export const SV_SIZE_ZERO: SvSize = { width: 0, height: 0 };

/** Options for {@link svElementSize}. */
export interface SvElementSizeOptions {
  /**
   * Coalesce emissions to one per this many milliseconds instead of one per
   * animation frame.
   *
   * A frame is the right default — it is the finest granularity a layout
   * decision can use — but a consumer doing real work per measurement (a
   * reflow, a re-render of many nodes) may want less.
   */
  readonly throttleMs?: number;

  /**
   * Construct the observer. The test adapter `X-12` asks for, and the SSR escape
   * hatch: return `null` and nothing is observed.
   *
   * @default the platform `ResizeObserver`, or `null` where there is none
   */
  readonly observe?: (callback: ResizeObserverCallback) => ResizeObserver | null;

  /**
   * Which box to report (`N-8`).
   *
   * - `'border-box'` — content + padding + border: what the element OCCUPIES,
   *   and the right answer for every overflow decision (see above).
   * - `'content-box'` — the area children lay out in: the right answer when
   *   sizing something that goes INSIDE the element (a canvas, a tile grid).
   *
   * @default 'border-box'
   */
  readonly box?: 'border-box' | 'content-box';
}

/** Parse a computed length, treating anything unreadable as zero. */
function px(value: string | undefined): number {
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) ? n : 0;
}

/**
 * Measure `el` now, directly, without waiting for an observer callback.
 *
 * ⚠️ Guarded, because the measuring `effect` also runs during prerender, where
 * the server DOM may hand back an element whose `getBoundingClientRect` is
 * missing or not a function. That element is reported at zero — the same
 * answer as "no observer" — rather than throwing out of change detection.
 */
function measure(el: Element, box: 'border-box' | 'content-box'): SvSize {
  if (typeof el.getBoundingClientRect !== 'function') return SV_SIZE_ZERO;
  const rect = el.getBoundingClientRect();
  const width = rect?.width ?? 0;
  const height = rect?.height ?? 0;
  if (box === 'border-box') return { width, height };

  // content-box = border-box − padding − border, per axis.
  const view = el.ownerDocument?.defaultView;
  if (!view || typeof view.getComputedStyle !== 'function') return { width, height };
  const cs = view.getComputedStyle(el);
  const insetX =
    px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
  const insetY =
    px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
  return { width: Math.max(0, width - insetX), height: Math.max(0, height - insetY) };
}

/** The content-box size out of an entry. `contentRect` IS the content box. */
function contentSizeOf(entry: ResizeObserverEntry): SvSize {
  const box = entry.contentBoxSize?.[0];
  if (box) return { width: box.inlineSize, height: box.blockSize };
  return { width: entry.contentRect.width, height: entry.contentRect.height };
}

/** The border-box size out of an entry, falling back for older engines. */
function sizeOf(entry: ResizeObserverEntry): SvSize {
  const box = entry.borderBoxSize?.[0];
  if (box) return { width: box.inlineSize, height: box.blockSize };
  // ⚠️ `contentRect` is the fallback and NOT the preference — it excludes
  //    padding and border, so an overflow decision made on it under-measures by
  //    exactly the element's own padding. Only reached on an engine with no
  //    `borderBoxSize`, where it is the best available answer.
  return { width: entry.contentRect.width, height: entry.contentRect.height };
}

function defaultObserve(callback: ResizeObserverCallback): ResizeObserver | null {
  if (typeof ResizeObserver === 'undefined') return null;
  return new ResizeObserver(callback);
}

/**
 * The border-box size of an element (or its content box, with `box`), as a
 * signal that updates when it changes.
 *
 * Call it in a field initializer, inside an injection context; the observer is
 * disconnected with the component.
 *
 * ```ts
 * private readonly strip = viewChild<ElementRef<HTMLElement>>('strip');
 * protected readonly stripSize = svElementSize(() => this.strip()?.nativeElement ?? null);
 * protected readonly crowded = computed(() => this.stripSize().width < 480);
 * ```
 *
 * ★ **Returns `{ 0, 0 }` on the server**, and a component must render sensibly
 * at that size. Zero means "nothing fits", so a responsive strip should treat it
 * as *"decide later"* rather than as *"collapse everything"* — otherwise every
 * prerendered page ships its fully-collapsed form and expands on hydration.
 */
export function svElementSize(
  // ⚠️ Not `Signal<Element | null> | (() => Element | null)`. A `Signal` IS
  //    callable, so that union is entirely functions: TypeScript narrows the
  //    non-function branch to `never` and `target()` stops type-checking. One
  //    call signature covers both, because a signal satisfies it.
  target: () => Element | null | undefined,
  options: SvElementSizeOptions = {},
): Signal<SvSize> {
  const { throttleMs, observe = defaultObserve, box = 'border-box' } = options;
  const read = box === 'content-box' ? contentSizeOf : sizeOf;

  const size = signal<SvSize>(SV_SIZE_ZERO);

  let observer: ResizeObserver | null = null;
  let observed: Element | null = null;
  let scheduled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let frame: number | null = null;

  const publish = (next: SvSize): void => {
    // `computed`-like: identical values do not wake anybody. A strip that is
    // re-measured on every scroll of an unrelated container should cost nothing.
    const current = size();
    if (current.width === next.width && current.height === next.height) return;
    size.set(next);
  };

  const flush = (entries: readonly ResizeObserverEntry[]): void => {
    const last = entries[entries.length - 1];
    if (last) publish(read(last));
  };

  /**
   * The most recent entries seen during the current window.
   *
   * ★★ Held outside the callback on purpose. The obvious shape — capture
   * `entries` in the closure the first time and flush that — **publishes the
   * FIRST size of the burst and discards the rest**, so a drag that ends at 400px
   * settles the signal on whatever it measured at the start. That is worse than
   * not coalescing at all: it is not a delayed answer, it is a wrong one that
   * never corrects. Found by the throttling test, which is why it asserts the
   * final width rather than "eventually something".
   */
  let latest: readonly ResizeObserverEntry[] = [];

  const onResize: ResizeObserverCallback = (entries) => {
    latest = entries;
    if (scheduled) return;
    scheduled = true;

    const run = (): void => {
      scheduled = false;
      frame = null;
      timer = null;
      flush(latest);
    };

    if (throttleMs !== undefined) timer = setTimeout(run, throttleMs);
    else if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(run);
    else timer = setTimeout(run);
  };

  const stop = (): void => {
    observer?.disconnect();
    observer = null;
    observed = null;
    if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    if (timer !== null) clearTimeout(timer);
    frame = null;
    timer = null;
    scheduled = false;
  };

  effect(() => {
    const el = target();

    if (!el) {
      stop();
      size.set(SV_SIZE_ZERO);
      return;
    }
    if (el === observed) return;

    stop();
    observed = el;

    // ★ Measured directly, before the observer has said anything — otherwise the
    //   first frame reports zero, which an overflow decision reads as "nothing
    //   fits".
    publish(measure(el, box));

    observer = observe(onResize);
    observer?.observe(el, { box });
  });

  inject(DestroyRef).onDestroy(stop);

  return computed(() => size());
}
