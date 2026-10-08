/**
 * `sv-scroll-area` — a styled scrollbar over a real one.
 *
 * ★★★ THE SCROLLBAR IS DRAWN OVER A NATIVE SCROLL CONTAINER, NEVER IN PLACE OF
 * ONE.
 *
 * Custom scrollbars built on a `transform: translateY` inside an
 * `overflow: hidden` box are the reason "this app breaks my keyboard" exists.
 * They lose: Page Up / Page Down, Home / End, arrow keys, spacebar, trackpad
 * momentum and rubber-banding, `scrollIntoView` from anchor links, the browser's
 * find-in-page auto-scroll, and every screen reader's virtual-cursor scroll. All
 * of that is free if the element genuinely scrolls; none of it can be
 * reimplemented faithfully. So the element scrolls, `scrollbar-width: none`
 * hides the native chrome, and the drawn thumb is a read-out of `scrollTop`.
 */

/**
 * The smallest thumb a person can reliably grab, in px.
 *
 * ★★★ WITHOUT THIS, A LONG DOCUMENT HAS AN UNGRABBABLE SCROLLBAR. Thumb length
 * is proportional to viewport ÷ content, so a 40 000 px document in a 400 px
 * box gives a 4 px thumb. It is drawn, it is correct, and no pointer can hit it.
 */
export const SV_MIN_THUMB_PX = 24;

export interface SvThumb {
  /** Thumb length along the scroll axis, in px. */
  readonly size: number;
  /** Distance from the start of the track to the start of the thumb, in px. */
  readonly offset: number;
  /** False when the content fits and there is nothing to scroll. */
  readonly visible: boolean;
  /** Scroll progress, 0–1. */
  readonly progress: number;
  /** True when the thumb hit its minimum and the track arithmetic was corrected. */
  readonly clamped: boolean;
}

/**
 * Where to draw the thumb.
 *
 * ★★★ THE MINIMUM-SIZE CORRECTION IS THE WHOLE FUNCTION, AND ALMOST EVERY
 * CUSTOM SCROLLBAR GETS IT WRONG.
 *
 * The naive pair is `size = viewport² ÷ content` and
 * `offset = scrollTop ÷ content × viewport`. Both are right until the size is
 * clamped to a minimum — and then they disagree, because a thumb of length `s`
 * can only travel `viewport − s`, while the offset formula still assumes it can
 * travel `viewport`. The visible symptom is a thumb that runs off the bottom of
 * its track, or stops short of it, by exactly the amount the clamp added. On a
 * long document that is most of the track.
 *
 * So the offset is expressed as a fraction of the travel the thumb ACTUALLY has:
 * `progress × (viewport − size)`.
 */
export function svThumbGeometry(
  viewport: number,
  content: number,
  scrollTop: number,
  minThumb = SV_MIN_THUMB_PX,
): SvThumb {
  const v = Number.isFinite(viewport) && viewport > 0 ? viewport : 0;
  const c = Number.isFinite(content) && content > 0 ? content : 0;

  if (v <= 0 || c <= v) {
    return { size: v, offset: 0, visible: false, progress: 0, clamped: false };
  }

  const ideal = (v * v) / c;
  // The minimum can never exceed the track itself, or the thumb would be longer
  // than the bar it sits in.
  const size = Math.min(v, Math.max(ideal, Math.min(minThumb, v)));
  const clamped = size > ideal + 1e-9;

  // ★★ scrollTop can exceed the scrollable range during an iOS rubber-band, and
  //    can go negative at the top. An unclamped progress paints the thumb
  //    outside its own track, which reads as a rendering bug rather than as the
  //    bounce it is.
  const scrollable = c - v;
  const progress = Math.max(0, Math.min(1, scrollTop / scrollable));

  return { size, offset: progress * (v - size), visible: true, progress, clamped };
}

/**
 * The `scrollTop` a thumb dragged to `offset` should produce.
 *
 * ★★★ THE EXACT INVERSE OF THE ABOVE, INCLUDING THE CLAMP. If the drag handler
 * divides by `viewport` while the renderer divides by `viewport − size`, the
 * thumb runs away from the pointer — slowly at first and by a whole thumb-length
 * at the bottom. That drift is the single most-reported bug in hand-rolled
 * scrollbars, and it is this asymmetry every time.
 */
export function svScrollTopForThumb(
  offset: number,
  viewport: number,
  content: number,
  minThumb = SV_MIN_THUMB_PX,
): number {
  const geo = svThumbGeometry(viewport, content, 0, minThumb);
  if (!geo.visible) return 0;
  const travel = viewport - geo.size;
  if (travel <= 0) return 0;
  const progress = Math.max(0, Math.min(1, offset / travel));
  return progress * (content - viewport);
}

/** How far this element can scroll, in px. */
export function svScrollable(viewport: number, content: number): number {
  return Math.max(0, content - viewport);
}

export type SvScrollEdge = 'start' | 'end' | 'both' | 'none';

/**
 * Which edges have content beyond them.
 *
 * ★★ THE SHADOW IS NOT DECORATION — IT IS THE ONLY AFFORDANCE A HIDDEN
 * SCROLLBAR LEAVES. Once the native chrome is hidden and the thumb is drawn only
 * on hover (which is what every design wants), a list that scrolls looks exactly
 * like a list that does not. A fade at the edge that has more behind it is the
 * cue people actually use.
 */
export function svScrollEdges(viewport: number, content: number, scrollTop: number): SvScrollEdge {
  const scrollable = svScrollable(viewport, content);
  if (scrollable <= 0) return 'none';
  const at = Math.max(0, Math.min(scrollable, scrollTop));
  const atStart = at <= 0.5;
  const atEnd = at >= scrollable - 0.5;
  if (atStart && atEnd) return 'none';
  if (atStart) return 'end';
  if (atEnd) return 'start';
  return 'both';
}

/** `340 of 2,400px · 14% shown` */
export function svScrollLabel(viewport: number, content: number, scrollTop: number): string {
  const geo = svThumbGeometry(viewport, content, scrollTop);
  if (!geo.visible) return 'Everything fits; nothing to scroll.';
  const pct = (geo.progress * 100).toFixed(0);
  const shown = ((viewport / content) * 100).toFixed(0);
  return `Scrolled ${pct}%; ${shown}% of the content is visible.`;
}

// ── RTL horizontal scroll (`LU-06-I3` / `M3`) ────────────────────────────────

/**
 * How an engine reports `scrollLeft` on a right-to-left scroller.
 *
 * ★★★ BROWSERS HISTORICALLY DISAGREED ON THE SIGN, and code that reads
 *     `scrollLeft` raw is right in exactly one of them:
 *
 *   • `'negative'` — the spec, and every current engine: `0` at the inline
 *     start (the right edge), going NEGATIVE towards the left.
 *   • `'reverse'`  — legacy Edge/IE: `0` at the start, going positive.
 *   • `'default'`  — legacy WebKit/Blink (Chrome < 85): `0` at the physical
 *     LEFT, i.e. at the END; the start is `scrollWidth − clientWidth`.
 *
 * Everything the component draws works in LOGICAL terms — distance from the
 * inline start — and converts at the one place it touches the element.
 */
export type SvRtlScrollType = 'negative' | 'reverse' | 'default';

const clampTo = (n: number, max: number): number =>
  Math.max(0, Math.min(Math.max(0, max), Number.isFinite(n) ? n : 0));

/**
 * The logical scroll position — px from the inline START — for a raw
 * `scrollLeft`. In LTR that is `scrollLeft` itself.
 */
export function svLogicalScrollStart(
  scrollLeft: number,
  scrollable: number,
  rtl: boolean,
  type: SvRtlScrollType = 'negative',
): number {
  if (!rtl) return clampTo(scrollLeft, scrollable);
  switch (type) {
    case 'negative':
      return clampTo(-scrollLeft, scrollable);
    case 'reverse':
      return clampTo(scrollLeft, scrollable);
    case 'default':
      return clampTo(scrollable - scrollLeft, scrollable);
  }
}

/** The exact inverse: the `scrollLeft` to write for a logical position. */
export function svPhysicalScrollLeft(
  start: number,
  scrollable: number,
  rtl: boolean,
  type: SvRtlScrollType = 'negative',
): number {
  const s = clampTo(start, scrollable);
  if (!rtl) return s;
  switch (type) {
    case 'negative':
      // `0 - 0` would be `-0`, which compares equal but prints as "-0" in a
      // read-out and fails `Object.is` in a test for no reason.
      return s === 0 ? 0 : -s;
    case 'reverse':
      return s;
    case 'default':
      return Math.max(0, scrollable) - s;
  }
}
