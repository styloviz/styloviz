import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import { svElementSize, type SvElementSizeOptions } from './element-size';

/**
 * ============================================================================
 *  One owner for the screen's corners — `X-5` / `N-7`
 * ============================================================================
 *
 * Scroll to Top, Speed Dial and affixed blocks each solved *viewport* collision
 * on their own and none of them solved *each other*. A FAB and a scroll-to-top
 * button both default to `bottom-6 right-6`; on the same page they render on top
 * of one another, and the host's chat launcher or cookie banner joins them. No
 * single component can fix that, because "who else is in this corner" is a fact
 * about the page, not about the component.
 *
 * So the page gets one registry. Anything that occupies a corner or an edge —
 * a kit control, or **the host's own** chat widget, cookie banner or bottom nav —
 * registers a region (anchor + size), and each registrant reads back how far it
 * must sit from the edge so that it clears everything ranked before it.
 *
 * ★★★ STACKING RULE, IN ONE SENTENCE. Within one side of the screen, a region is
 *     pushed away from the edge by every region ranked before it that it can
 *     collide with: full-width EDGE regions (`'bottom'`, `'top'`) push every
 *     corner on their side, and CORNER regions push only their own corner.
 *     Rank is `order` (lower sits nearer the edge), then registration order.
 *
 * ★★ WHY FULL-WIDTH EDGES OUTRANK CORNERS. A cookie banner or a mobile bottom
 *    nav spans the whole edge, so there is no corner beside it for a FAB to use —
 *    the FAB has to sit on top of it. The reverse is never true.
 *
 * ★ A zero-height region takes no space and adds no gap. That is also what makes
 *   the manager an SSR no-op: every measurement on the server is zero (see
 *   `svElementSize`), so every offset there is zero and the server-rendered
 *   markup matches a page with no manager at all.
 *
 * ⚠️ Safe-area insets are NOT folded into the numeric offset. `env()` has no
 *   value in script — only in CSS — so the offset is px and the inset is added
 *   in the style string by `svFloatingInset()`. The two cannot drift.
 */

/** A corner a floating control sits in, or a full-width edge a host bar spans. */
export type SvFloatingAnchor =
  | 'bottom-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'top-right'
  | 'top-left'
  | 'top-center'
  | 'bottom'
  | 'top';

/**
 * Where a region ranks within its side. Lower sits nearer the edge.
 *
 * ★ The kit's own defaults are spaced so a host can slot between them: a host
 *   chat launcher at `15` sits above a Speed Dial and below Scroll to Top.
 */
export const SV_FLOATING_ORDER = {
  /** Full-width host bars — bottom navigation, cookie banner. */
  edge: 0,
  /** A Speed Dial / FAB: the primary action keeps the corner. */
  fab: 10,
  /** Scroll to Top: a utility, so it yields the corner to the FAB. */
  scrollToTop: 20,
  /** An affixed block. */
  affix: 30,
} as const;

/**
 * z-index bands for floating page chrome.
 *
 * ★ All deliberately BELOW `SvOverlayStackService`'s interactive base (1000): a
 *   menu, drawer or dialog must always paint over a FAB, and a FAB's own menu is
 *   one of those surfaces. Raising any of these past 999 would bury overlays
 *   under page chrome.
 */
export const SV_FLOATING_Z = {
  /**
   * ★ 30, matching the `z-30` a pinned `<sv-affix>` has always painted with.
   *   Lowering the shipped class to match a new constant could drop a pinned
   *   header under host content a host had already layered at 21–29, so the
   *   constant follows the component rather than the other way round.
   */
  affix: 30,
  control: 50,
  banner: 60,
} as const;

/** The CSS for each safe-area inset, with a zero fallback. */
export const SV_SAFE_AREA = {
  top: 'env(safe-area-inset-top, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
} as const;

/** One side of the viewport. */
export type SvSafeAreaSide = keyof typeof SV_SAFE_AREA;

/** What a registrant tells the manager about itself. */
export interface SvFloatingRegion {
  /** Where it sits. */
  readonly anchor: SvFloatingAnchor;
  /** Its occupied width in CSS px. Informational; stacking uses height. @default 0 */
  readonly width?: number;
  /** Its occupied height in CSS px. `0` takes no space. @default 0 */
  readonly height?: number;
  /** Rank within its side; lower sits nearer the edge. @default SV_FLOATING_ORDER.edge for an edge, 0 for a corner */
  readonly order?: number;
  /** A name for diagnostics — `data-sv-floating` and `regions()`. */
  readonly label?: string;
}

/** A registered region, as `regions()` reports it. */
export interface SvFloatingRegionState extends Required<Omit<SvFloatingRegion, 'label'>> {
  readonly id: number;
  readonly label: string;
}

/** The registration. Update it when the region resizes; release it when it leaves. */
export interface SvFloatingRegionHandle {
  readonly id: number;
  /** How far (px) this region must sit from its edge to clear everything ranked before it. */
  readonly offset: Signal<number>;
  /** Change the anchor, size or order. */
  update(patch: Partial<SvFloatingRegion>): void;
  /** Remove the region. Idempotent. */
  release(): void;
}

/** The side a region stacks along. */
function sideOf(anchor: SvFloatingAnchor): 'top' | 'bottom' {
  return anchor.startsWith('top') ? 'top' : 'bottom';
}

function isEdge(anchor: SvFloatingAnchor): boolean {
  return anchor === 'top' || anchor === 'bottom';
}

/**
 * The floating-layer registry. Root-scoped: one page, one set of corners.
 *
 * ```ts
 * // A host's own chat launcher, so kit controls in that corner clear it:
 * const chat = inject(SvFloatingLayerService).register({
 *   anchor: 'bottom-right', height: 64, order: 15, label: 'chat',
 * });
 * // …later: chat.update({ height: 480 }); chat.release();
 * ```
 */
@Injectable({ providedIn: 'root' })
export class SvFloatingLayerService {
  /** Gap (px) kept between two stacked regions. */
  readonly gap = 12;

  private readonly _regions = signal<readonly SvFloatingRegionState[]>([]);
  private _nextId = 0;

  /** Every registered region, in registration order. Diagnostics and tests. */
  readonly regions: Signal<readonly SvFloatingRegionState[]> = this._regions.asReadonly();

  /** Register an occupied region. Release the handle when it leaves the page. */
  register(region: SvFloatingRegion): SvFloatingRegionHandle {
    const id = this._nextId++;
    this._regions.update((list) => [...list, this._normalise(id, region)]);

    let released = false;
    return {
      id,
      offset: computed(() => this._offsetOf(id)),
      update: (patch) => {
        if (released) return;
        this._regions.update((list) =>
          list.map((r) => (r.id === id ? this._normalise(id, { ...r, ...patch }) : r)),
        );
      },
      release: () => {
        if (released) return;
        released = true;
        this._regions.update((list) => list.filter((r) => r.id !== id));
      },
    };
  }

  /**
   * The offset an UNREGISTERED element at `anchor` would need to clear every
   * region there — for a host that wants to read the layout without joining it.
   */
  offsetAt(anchor: SvFloatingAnchor): number {
    return this._sum(this._regions(), anchor, () => true);
  }

  /**
   * The offset a region at `anchor` with rank `order` WOULD get if it
   * registered now (ties rank it last) — for a block that only registers once
   * it is on screen but must decide where to go before that, e.g. an affix
   * about to pin. Reading it first avoids a one-frame jump on registration.
   */
  offsetFor(anchor: SvFloatingAnchor, order: number): number {
    const self = isEdge(anchor);
    return this._sum(this._regions(), anchor, (other) =>
      (isEdge(other.anchor) && !self) || other.order <= order,
    );
  }

  /** Test seam: forget every region. */
  reset(): void {
    this._regions.set([]);
  }

  private _normalise(id: number, region: SvFloatingRegion): SvFloatingRegionState {
    const finite = (n: number | undefined): number =>
      typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
    return {
      id,
      anchor: region.anchor,
      width: finite(region.width),
      height: finite(region.height),
      order:
        typeof region.order === 'number' && Number.isFinite(region.order)
          ? region.order
          : isEdge(region.anchor) ? SV_FLOATING_ORDER.edge : 0,
      label: region.label ?? '',
    };
  }

  private _offsetOf(id: number): number {
    const list = this._regions();
    const self = list.find((r) => r.id === id);
    if (!self) return 0;
    const selfIndex = list.indexOf(self);
    return this._sum(list, self.anchor, (other) => {
      if (other.id === id) return false;
      // Edge regions push corners regardless of rank (see the class JSDoc).
      if (isEdge(other.anchor) && !isEdge(self.anchor)) return true;
      if (other.order !== self.order) return other.order < self.order;
      return list.indexOf(other) < selfIndex;
    });
  }

  /** Total height (+ gap) of the regions at `anchor`'s side it collides with and `before` admits. */
  private _sum(
    list: readonly SvFloatingRegionState[],
    anchor: SvFloatingAnchor,
    before: (other: SvFloatingRegionState) => boolean,
  ): number {
    const side = sideOf(anchor);
    let total = 0;
    for (const other of list) {
      if (other.height === 0 || sideOf(other.anchor) !== side) continue;
      // A corner only collides with its own corner and with the full-width edge.
      const collides = isEdge(anchor) ? isEdge(other.anchor) : isEdge(other.anchor) || other.anchor === anchor;
      if (collides && before(other)) total += other.height + this.gap;
    }
    return total;
  }
}

/**
 * The CSS length for an inset from `side`: a base, the manager's offset, and the
 * device safe-area inset, in one `calc()`.
 *
 * ```html
 * <div class="fixed right-6" [style.bottom]="inset()"></div>
 * ```
 *
 * ★ `env()` resolves to 0 unless the page sets `viewport-fit=cover`, so on every
 *   ordinary page this equals `base + offset` exactly.
 */
export function svFloatingInset(side: SvSafeAreaSide, basePx: number, offsetPx = 0): string {
  const px = (Number.isFinite(basePx) ? basePx : 0) + (Number.isFinite(offsetPx) ? offsetPx : 0);
  return `calc(${px}px + ${SV_SAFE_AREA[side]})`;
}

/** Options for {@link svFloatingRegion}. */
export interface SvFloatingRegionOptions {
  /** The corner or edge; `null` does not register (contained / demo / off). */
  readonly anchor: () => SvFloatingAnchor | null;
  /** The element whose border box is the occupied region. */
  readonly element: () => Element | null | undefined;
  /** Rank within the side — a number, or a getter (e.g. an input). @default 0 */
  readonly order?: number | (() => number);
  /** Diagnostics label. */
  readonly label?: string;
  /** Passed to `svElementSize` — the measurement test adapter. */
  readonly observe?: SvElementSizeOptions['observe'];
}

/** What {@link svFloatingRegion} gives back. */
export interface SvFloatingRegionRef {
  /** Distance (px) from the edge that clears everything ranked before this. `0` when unregistered. */
  readonly offset: Signal<number>;
  /** Whether the region is currently registered. */
  readonly registered: Signal<boolean>;
}

/**
 * Register an element as an occupied floating region for as long as the
 * calling component lives. Call it in a field initializer (injection context).
 *
 * Measures with `svElementSize` (border box, rAF-throttled, zero on the server),
 * keeps the registration's size current, re-registers when the anchor changes,
 * and releases on destroy.
 */
export function svFloatingRegion(options: SvFloatingRegionOptions): SvFloatingRegionRef {
  const layer = inject(SvFloatingLayerService);
  const size = svElementSize(options.element, { observe: options.observe });

  let handle: SvFloatingRegionHandle | null = null;
  let anchorOf: SvFloatingAnchor | null = null;
  const current = signal<SvFloatingRegionHandle | null>(null);

  const release = (): void => {
    handle?.release();
    handle = null;
    anchorOf = null;
    current.set(null);
  };

  effect(() => {
    const anchor = options.anchor();
    const { width, height } = size();
    const order = typeof options.order === 'function' ? options.order() : options.order;
    // ★ Untracked: registering writes the registry, and the registry is what
    //   every offset reads. Tracking it here would re-run this effect on every
    //   OTHER region's resize.
    untracked(() => {
      if (!anchor) {
        release();
        return;
      }
      if (handle && anchorOf === anchor) {
        handle.update({ width, height, order });
        return;
      }
      release();
      handle = layer.register({ anchor, width, height, order, label: options.label });
      anchorOf = anchor;
      current.set(handle);
    });
  });

  inject(DestroyRef).onDestroy(release);

  return {
    offset: computed(() => current()?.offset() ?? 0),
    registered: computed(() => current() !== null),
  };
}
