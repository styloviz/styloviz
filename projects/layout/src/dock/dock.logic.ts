/**
 * The Dock's arithmetic — magnification, the room it makes, and which route is
 * current. Pure: no DOM, no Angular, so every edge case has a spec of its own.
 *
 * ── How the magnification stays transform-only ───────────────────────────────
 *
 * A macOS dock grows the item under the pointer and its neighbours, and the
 * neighbours move apart to make room. Doing that with `width` would re-lay the
 * whole bar on every pointer move, and the item under the pointer would slide
 * out from under it. Here nothing is ever laid out again: each item keeps its
 * resting box, its control is SCALED about the centre of its edge, and the
 * item is TRANSLATED along the dock by exactly the room its neighbours took.
 * The pointer is measured against the resting positions (the list itself is
 * never transformed), so the item under it is always the one it is over.
 *
 * ★ Scale never goes below 1, so a control's hit area only ever grows — a
 *   pointer target can never shrink under the 24 px WCAG 2.5.8 asks for.
 */

/** Tuning for {@link svDockLayout}. */
export interface SvDockLayoutOptions {
  /** The scale of the item right under the pointer (1 = no magnification). */
  readonly peak: number;
  /** How many items either side the swell reaches; beyond it, scale 1. */
  readonly range: number;
  /** The resting size of one item along the dock, in px. */
  readonly size: number;
}

/** What {@link svDockLayout} returns: one scale and one offset per item. */
export interface SvDockLayout {
  /** Scale per item, each ≥ 1. */
  readonly scales: readonly number[];
  /**
   * Offset per item along the dock, in px, in ITEM ORDER (positive = toward
   * the last item). The caller turns it into a physical translate — negated
   * on the x axis under RTL, where item order runs right to left.
   */
  readonly offsets: readonly number[];
  /** The total extra length the magnified items take, in px (≥ 0). */
  readonly extent: number;
}

/** The largest magnification the dock allows; past 2× the swell covers the page. */
export const SV_DOCK_MAX_PEAK = 2;

/** Clamp a peak scale into `[1, SV_DOCK_MAX_PEAK]`; anything not finite means "no magnification". */
export function svDockClampPeak(peak: number): number {
  if (!Number.isFinite(peak)) return 1;
  return Math.min(SV_DOCK_MAX_PEAK, Math.max(1, peak));
}

/**
 * The scale of an item `distance` items away from the swell's centre.
 *
 * A raised cosine: 1 + (peak − 1) at the centre, easing to exactly 1 at
 * `range` and staying there — no kink where it ends, so neighbours settle
 * smoothly as the pointer moves along.
 */
export function svDockScale(distance: number, peak: number, range: number): number {
  const top = svDockClampPeak(peak);
  if (top === 1 || !(range > 0) || !Number.isFinite(distance)) return 1;
  const d = Math.abs(distance);
  if (d >= range) return 1;
  return 1 + (top - 1) * ((Math.cos((Math.PI * d) / range) + 1) / 2);
}

/**
 * Every item's scale and offset for a swell centred at `center` — a
 * continuous item index (2.5 is half-way between the third and fourth item),
 * or `null` when nothing is hovered or focused.
 *
 * The offsets spread the items so no scaled control overlaps the next, and
 * are centred on the dock: the bar grows by `extent` and half of it lands at
 * each end, which is what the backdrop's scale follows.
 */
export function svDockLayout(count: number, center: number | null, options: SvDockLayoutOptions): SvDockLayout {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return { scales: [], offsets: [], extent: 0 };
  const scales =
    center === null || !Number.isFinite(center)
      ? new Array<number>(n).fill(1)
      : Array.from({ length: n }, (_, i) => svDockScale(i - center, options.peak, options.range));
  const size = Math.max(0, options.size);
  const extra = scales.map((s) => (s - 1) * size);
  const extent = extra.reduce((sum, e) => sum + e, 0);
  const offsets: number[] = [];
  let before = 0;
  for (let i = 0; i < n; i++) {
    offsets.push(before + extra[i] / 2 - extent / 2);
    before += extra[i];
  }
  return { scales, offsets, extent };
}

/**
 * Where a pointer is along the dock, as a continuous item index: `0` at the
 * centre of the first item, `1` at the centre of the second.
 *
 * @param offset px from the dock's START edge (the left in LTR, the right
 *   under RTL, the top for a vertical dock) to the pointer
 * @param size the resting size of one item along the dock, in px
 * @param gap the space between two items, in px
 */
export function svDockPointerIndex(offset: number, size: number, gap: number): number {
  const pitch = size + gap;
  if (!(pitch > 0) || !Number.isFinite(offset)) return 0;
  return (offset - size / 2) / pitch;
}

/**
 * Whether `route` is the page at `active`, or a parent of it — on a path
 * SEGMENT boundary, so `/app` matches `/app/inbox` but not `/apps`. A query
 * string or fragment on `active` is ignored; `/` only matches `/` itself, or
 * every page would be inside it.
 */
export function svDockRouteMatches(route: string, active: string): boolean {
  const normalise = (path: string): string => {
    const bare = path.split(/[?#]/)[0].trim();
    return bare.length > 1 ? bare.replace(/\/+$/, '') : bare;
  };
  const r = normalise(route);
  const a = normalise(active);
  if (!r || !a) return false;
  if (r === '/') return a === '/';
  return a === r || a.startsWith(`${r}/`);
}

/**
 * The index of the item that is the current page: the LONGEST route matching
 * `active`, so `/app/inbox` beats `/app` when the reader is in the inbox.
 * `-1` when none matches.
 */
export function svDockCurrentIndex(routes: readonly (string | null)[], active: string): number {
  let best = -1;
  let bestLength = -1;
  routes.forEach((route, i) => {
    if (route === null || !svDockRouteMatches(route, active)) return;
    if (route.length > bestLength) {
      best = i;
      bestLength = route.length;
    }
  });
  return best;
}

// ─── Fitting the container (WCAG 1.4.10 reflow) ──────────────────────────────

/** The smallest an item may shrink to, in px: above the 24 px target (WCAG 2.5.8) with room for a legible 16 px glyph. */
export const SV_DOCK_MIN_ITEM = 32;

/** Measurements for {@link svDockFit}. */
export interface SvDockFitOptions {
  /** The resting item size along the dock, in px. */
  readonly size: number;
  /** The space between two items, in px. */
  readonly gap: number;
  /** The bar's padding at EACH end, in px. */
  readonly padding: number;
  /** The smallest item size allowed, in px. @default SV_DOCK_MIN_ITEM */
  readonly min?: number;
}

/** What {@link svDockFit} decides. */
export interface SvDockFit {
  /** The item size to render, in px. */
  readonly itemSize: number;
  /** Items are smaller than their resting size — magnification is off while it lasts. */
  readonly shrunk: boolean;
  /** Even the smallest items do not fit: the dock scrolls along its axis. */
  readonly scroll: boolean;
}

/**
 * How a dock of `count` items fits `available` px along its axis.
 *
 * It keeps the resting size when the row fits. Otherwise the items shrink
 * evenly — never below `min` — and when even that does not fit, the dock
 * scrolls, so every control stays reachable instead of being cut off.
 * `available` of `null` (not measured yet, or a runtime without layout) means
 * "assume it fits".
 */
export function svDockFit(count: number, available: number | null, options: SvDockFitOptions): SvDockFit {
  const size = Math.max(0, options.size);
  const n = Math.max(0, Math.floor(count));
  const atRest: SvDockFit = { itemSize: size, shrunk: false, scroll: false };
  if (n === 0 || available === null || !Number.isFinite(available) || available <= 0) return atRest;
  const min = Math.min(size, Math.max(24, options.min ?? SV_DOCK_MIN_ITEM));
  const room = available - 2 * Math.max(0, options.padding) - (n - 1) * Math.max(0, options.gap);
  const fits = Math.floor(room / n);
  if (fits >= size) return atRest;
  if (fits >= min) return { itemSize: fits, shrunk: true, scroll: false };
  return { itemSize: min, shrunk: true, scroll: true };
}
