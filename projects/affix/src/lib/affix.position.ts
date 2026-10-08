/**
 * `sv-affix` — pin an element while it scrolls, without the jump.
 *
 * ★★★ GOING `position: fixed` REMOVES THE ELEMENT FROM FLOW, AND EVERYTHING
 * BELOW IT JUMPS UP BY ITS HEIGHT.
 *
 * That is the bug in every hand-rolled affix, and it is worse than it sounds:
 * the jump changes the page height, which changes `scrollY`, which can move the
 * element back past its own threshold and unpin it — which puts the height back,
 * which re-pins it. The element flickers and the page shudders, at exactly the
 * scroll position where somebody is trying to read. The fix is not a smaller
 * threshold or a debounce; it is a placeholder of the measured height, holding
 * the space the pinned element used to occupy.
 */

export type AffixMode =
  /** In flow, untouched. */
  | 'static'
  /** Pinned to the viewport. */
  | 'fixed'
  /** Parked at the bottom of its container, because the container ran out. */
  | 'docked';

export interface SvAffixState {
  readonly mode: AffixMode;
  /** `top` for `fixed`, or the offset from the container's top for `docked`. */
  readonly top: number;
  /**
   * Height the placeholder must hold, in px.
   *
   * ★★★ ZERO WHILE STATIC AND THE FULL HEIGHT OTHERWISE. Getting this wrong in
   * either direction produces the shudder described above — a placeholder that
   * is always there adds a gap when the element is in flow, and one that is
   * never there lets the page collapse when it pins.
   */
  readonly placeholder: number;
  /** True when the container boundary is what stopped it, not the scroll. */
  readonly atBoundary: boolean;
}

export interface SvAffixInput {
  /** Current vertical scroll position of the page. */
  readonly scrollY: number;
  /** Distance from the top of the document to the element's resting position. */
  readonly anchorTop: number;
  /** Measured height of the element. */
  readonly height: number;
  /** Gap to leave between the viewport top and the pinned element. */
  readonly offsetTop: number;
  /**
   * Distance from the top of the document to the bottom of the container, when
   * the element should stop there. `null` to pin indefinitely.
   */
  readonly containerBottom: number | null;
}

/**
 * Where the element should be.
 *
 * ★★★ THE CONTAINER BOUNDARY IS NOT A NICETY. A pinned sidebar with no boundary
 * floats over the footer, over the next section, and off the end of the page —
 * and because it is `fixed`, it also overlaps whatever the reader scrolled down
 * to look at. Stopping at the container's bottom is what makes an affix a
 * layout primitive rather than a floating badge.
 *
 * ★★ The three modes are mutually exclusive and computed from measurements
 * only. No state, no hysteresis, no debounce: given the same numbers this always
 * returns the same answer, which is what makes the placeholder sufficient to
 * stop the flicker rather than merely reduce it.
 */
export function svAffixState(input: SvAffixInput): SvAffixState {
  const { scrollY, anchorTop, height, offsetTop, containerBottom } = input;

  const finite = (n: number): number => (Number.isFinite(n) ? n : 0);
  const y = finite(scrollY);
  const anchor = finite(anchorTop);
  const h = Math.max(0, finite(height));
  const gap = finite(offsetTop);

  // Not far enough down the page yet.
  //
  // ★★ INCLUSIVE, AND NOT ARBITRARILY. At exactly the threshold the element is
  //    already sitting `offsetTop` from the viewport top, so pinning moves it
  //    nowhere: it only swaps in the placeholder, adds `position: fixed` and
  //    emits a mode change nobody can see. A scroll that comes to rest on that
  //    pixel would then emit on every trackpad jitter. It pins when it would
  //    otherwise begin to LEAVE, which is one pixel later.
  if (y + gap <= anchor) {
    return { mode: 'static', top: 0, placeholder: 0, atBoundary: false };
  }

  if (containerBottom !== null && Number.isFinite(containerBottom)) {
    const bottom = containerBottom;
    // ★★ The element would extend past the container: park it against the
    //    container's bottom edge instead of continuing to travel.
    if (y + gap + h > bottom) {
      // Docked position is relative to the container's own box, so the host can
      // apply it as `position: absolute; top:` inside a relative container.
      const top = Math.max(0, bottom - h - anchor);
      return { mode: 'docked', top, placeholder: h, atBoundary: true };
    }
  }

  return { mode: 'fixed', top: gap, placeholder: h, atBoundary: false };
}

/**
 * Is the element pinned in any way?
 *
 * ★★ `docked` COUNTS AS PINNED FOR THE PLACEHOLDER'S PURPOSES, because an
 * absolutely-positioned element is out of flow exactly as a fixed one is. A
 * placeholder that disappears when the element docks produces the same jump at
 * the bottom of the container that the whole module exists to prevent — just
 * once instead of continuously, which is harder to notice and no less wrong.
 */
export function svIsAffixed(state: SvAffixState): boolean {
  return state.mode !== 'static';
}

/**
 * The scroll position at which the element pins.
 *
 * ★★ USEFUL BECAUSE IT IS MEASURED FROM THE PLACEHOLDER, NOT FROM THE ELEMENT.
 * Once pinned, the element's own `getBoundingClientRect()` reports the viewport
 * position it was moved to, so re-deriving the threshold from it gives the
 * threshold that keeps it pinned — the classic one-way latch.
 */
export function svAffixThreshold(anchorTop: number, offsetTop: number): number {
  return Math.max(0, (Number.isFinite(anchorTop) ? anchorTop : 0) - (Number.isFinite(offsetTop) ? offsetTop : 0));
}

/** `Pinned 16px from the top` / `Parked at the end of its section` */
export function svAffixLabel(state: SvAffixState): string {
  switch (state.mode) {
    case 'static':
      return 'In flow.';
    case 'docked':
      return 'Parked at the end of its container — it will not float over what comes next.';
    default:
      return `Pinned ${state.top}px from the top of the viewport.`;
  }
}
