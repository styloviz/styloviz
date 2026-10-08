/**
 * One positioning engine for every anchored surface.
 *
 * ★★★ FOUR IMPLEMENTATIONS OF ONE ALGORITHM, DIVERGING ON EXACTLY THE PARTS
 *     THAT MATTER. Popover, Dropdown Menu and Popout each carried their own
 *     rect → flip → switch → clamp routine, and Tooltip had a static CSS class
 *     map with no measurement at all. They agreed on the easy 80%: put the
 *     panel under the trigger. They disagreed, or were silent, on every case
 *     that actually breaks — RTL, a transformed ancestor, an anchor that
 *     disappears, a cursor at the edge of the screen, where the arrow points.
 *     `X-7`.
 *
 * ★★ A PURE FUNCTION, DELIBERATELY. Everything here is arithmetic over two
 *    rectangles and a viewport, so it is testable without a browser, a DOM or
 *    a layout — which matters because the defects being fixed are all
 *    arithmetic and none of them can be reproduced in jsdom through a
 *    component. The caller measures; this decides.
 */

/** The part of a `DOMRect` this engine needs. */
export interface SvRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** Twelve placements: four sides, each with start / center / end alignment. */
export type SvPlacementSide = 'top' | 'bottom' | 'left' | 'right';
export type SvPlacementAlign = 'start' | 'center' | 'end';
export type SvPlacement =
  | 'top' | 'top-start' | 'top-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'left' | 'left-start' | 'left-end'
  | 'right' | 'right-start' | 'right-end';

export interface SvPositionRequest {
  /** The trigger's rect, or a zero-size rect at a cursor point. */
  readonly anchor: SvRect;
  /** The panel's measured size. */
  readonly panel: { readonly width: number; readonly height: number };
  readonly placement: SvPlacement;
  /** Gap between anchor and panel, in px. @default 8 */
  readonly offset?: number;
  /** Flip to the opposite side when the preferred one does not fit. @default true */
  readonly flip?: boolean;
  /** Minimum gap to the viewport edge, in px. @default 8 */
  readonly margin?: number;
  /** @default the window's inner size */
  readonly viewport?: { readonly width: number; readonly height: number };
  /**
   * Mirror `start`/`end` for right-to-left text.
   *
   * ★ `start` means "the edge text starts at", which is the RIGHT edge in RTL.
   *   Every one of the four implementations hard-coded it to the left, so a
   *   menu on an Arabic or Hebrew page opened away from its trigger.
   */
  readonly rtl?: boolean;
  /**
   * The containing block the returned coordinates are relative to.
   *
   * ★★★ THIS IS `OF-12-I5`, AND IT IS NOT AN EDGE CASE ON A MODERN PAGE. A
   *     `position: fixed` panel is normally positioned against the viewport,
   *     so viewport-relative rects can be used directly — but ANY ancestor
   *     with a `transform`, `filter`, `perspective`, `backdrop-filter` or
   *     `will-change` becomes the containing block instead, and every
   *     coordinate is then off by that element's offset. A page-transition
   *     animation on a wrapper is enough to do it, which is why the symptom
   *     is "the menu is fine until the route animates".
   *
   *     Pass the containing block's own rect and the result is corrected for
   *     it. Omit it when the panel is a child of `<body>` with no transformed
   *     ancestor, which is the common case.
   */
  readonly container?: SvRect | null;
  /** Distance the arrow is kept from the panel's corners, in px. @default 16 */
  readonly arrowInset?: number;
}

export interface SvPositionResult {
  /** Coordinates for the panel, relative to the containing block. */
  readonly top: number;
  readonly left: number;
  /** The placement actually used, after flipping. */
  readonly placement: SvPlacement;
  /** Whether the panel had to be pulled back from a viewport edge. */
  readonly clamped: boolean;
  /** Arrow offset along the panel's cross axis, relative to the panel. */
  readonly arrowX: number;
  readonly arrowY: number;
}

const DEFAULTS = { offset: 8, margin: 8, arrowInset: 16 } as const;

const sideOf = (placement: SvPlacement): SvPlacementSide =>
  placement.split('-')[0] as SvPlacementSide;

const alignOf = (placement: SvPlacement): SvPlacementAlign => {
  const part = placement.split('-')[1];
  return part === 'start' || part === 'end' ? part : 'center';
};

const compose = (side: SvPlacementSide, align: SvPlacementAlign): SvPlacement =>
  (align === 'center' ? side : `${side}-${align}`) as SvPlacement;

const OPPOSITE: Record<SvPlacementSide, SvPlacementSide> = {
  top: 'bottom', bottom: 'top', left: 'right', right: 'left',
};

/** Flip `start` ⇄ `end`; `center` is unchanged. */
const mirror = (align: SvPlacementAlign): SvPlacementAlign =>
  align === 'start' ? 'end' : align === 'end' ? 'start' : 'center';

/** Does a panel of this size fit on `side` of the anchor? */
function fits(
  side: SvPlacementSide,
  anchor: SvRect,
  panel: { width: number; height: number },
  offset: number,
  margin: number,
  vw: number,
  vh: number,
): boolean {
  switch (side) {
    case 'bottom': return anchor.top + anchor.height + offset + panel.height + margin <= vh;
    case 'top':    return anchor.top - offset - panel.height - margin >= 0;
    case 'right':  return anchor.left + anchor.width + offset + panel.width + margin <= vw;
    case 'left':   return anchor.left - offset - panel.width - margin >= 0;
  }
}

/**
 * Where an anchored panel goes.
 *
 * Returns coordinates, the placement actually used, whether it had to be
 * clamped, and where its arrow should point.
 */
export function svPositionAnchored(request: SvPositionRequest): SvPositionResult {
  const offset = request.offset ?? DEFAULTS.offset;
  const margin = request.margin ?? DEFAULTS.margin;
  const arrowInset = request.arrowInset ?? DEFAULTS.arrowInset;
  const { anchor, panel } = request;
  const vw = request.viewport?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 0);
  const vh = request.viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0);

  let side = sideOf(request.placement);
  // ★ RTL mirrors the ALIGNMENT, not the side. A `bottom-start` menu opens
  //   below its trigger in both directions; what changes is which edge they
  //   line up on.
  const align = request.rtl ? mirror(alignOf(request.placement)) : alignOf(request.placement);

  if ((request.flip ?? true) && !fits(side, anchor, panel, offset, margin, vw, vh)) {
    // ★★ ONLY FLIP IF THE OTHER SIDE IS ACTUALLY BETTER. Flipping into a space
    //    that does not fit either just moves the clamping to the other end and
    //    puts the panel over the trigger the user is looking at.
    if (fits(OPPOSITE[side], anchor, panel, offset, margin, vw, vh)) side = OPPOSITE[side];
  }

  const anchorCenterX = anchor.left + anchor.width / 2;
  const anchorCenterY = anchor.top + anchor.height / 2;

  let top: number;
  let left: number;

  if (side === 'top' || side === 'bottom') {
    top = side === 'bottom' ? anchor.top + anchor.height + offset : anchor.top - offset - panel.height;
    left =
      align === 'start' ? anchor.left
      : align === 'end' ? anchor.left + anchor.width - panel.width
      : anchorCenterX - panel.width / 2;
  } else {
    left = side === 'right' ? anchor.left + anchor.width + offset : anchor.left - offset - panel.width;
    top =
      align === 'start' ? anchor.top
      : align === 'end' ? anchor.top + anchor.height - panel.height
      : anchorCenterY - panel.height / 2;
  }

  // ★ Clamp to the viewport. `Math.max(margin, …)` on the upper bound matters
  //   for a panel TALLER than the viewport: without it the upper bound falls
  //   below the lower one and the panel is pinned to the bottom edge, showing
  //   its end instead of its beginning.
  const maxLeft = Math.max(margin, vw - panel.width - margin);
  const maxTop = Math.max(margin, vh - panel.height - margin);
  const clampedLeft = Math.min(Math.max(left, margin), maxLeft);
  const clampedTop = Math.min(Math.max(top, margin), maxTop);
  const clamped = clampedLeft !== left || clampedTop !== top;

  // ★★ THE ARROW IS MEASURED FROM THE CLAMPED PANEL, NOT THE INTENDED ONE.
  //    That is the whole point of computing it here: once a panel has been
  //    pulled back from an edge, an arrow placed at the panel's centre no
  //    longer points at the trigger — it points at where the panel WOULD have
  //    been, which reads as pointing at nothing.
  const arrowX = Math.min(
    Math.max(anchorCenterX - clampedLeft, arrowInset),
    Math.max(arrowInset, panel.width - arrowInset),
  );
  const arrowY = Math.min(
    Math.max(anchorCenterY - clampedTop, arrowInset),
    Math.max(arrowInset, panel.height - arrowInset),
  );

  // Correct for a containing block that is not the viewport — see `container`.
  const originX = request.container?.left ?? 0;
  const originY = request.container?.top ?? 0;

  return {
    top: clampedTop - originY,
    left: clampedLeft - originX,
    placement: compose(side, align),
    clamped,
    arrowX,
    arrowY,
  };
}

/**
 * Has the anchor stopped being something a panel can point at?
 *
 * ★★★ AN ORPHANED PANEL IS WORSE THAN A CLOSED ONE. `OF-12-I3`, `OF-11-I3`:
 *     the row a menu was opened from is deleted, or the toolbar it hangs off
 *     collapses, and the panel stays exactly where it was — floating over
 *     unrelated content, still listing actions for a thing that is gone. The
 *     caller closes on `true`.
 *
 * ★★ ZERO SIZE COUNTS, AND THAT IS THE HALF A `isConnected` CHECK MISSES. An
 *    anchor inside a collapsed accordion, a `display: none` sidebar or a
 *    closed `<details>` is still in the document and still has a parent — it
 *    just has no position any more, and a rect of 0×0 at 0,0 sends the panel
 *    to the top-left corner of the screen. Which is what it did.
 */
export function svAnchorLost(anchor: Element | null | undefined): boolean {
  if (!anchor || !anchor.isConnected) return true;
  const rect = anchor.getBoundingClientRect();
  return rect.width === 0 && rect.height === 0;
}

/**
 * Is the pointer inside the corridor between a trigger and its panel?
 *
 * ★★★ THE GAP IS THE BUG. A hover popover sits `offset` pixels away from its
 *     trigger, so travelling to it means leaving the trigger — and a plain
 *     `mouseleave` close fires while the pointer is in mid-air over that gap.
 *     Every library that gets this right uses the same trick: treat the
 *     triangle between where the pointer left and the panel's near edge as
 *     still being "on" the trigger. `OF-12-I1`, `OF-12-M2`.
 *
 * ★★ A TRIANGLE, NOT A BOUNDING BOX. The union of trigger and panel is much
 *    easier to compute and much too generous: with a panel below-left of its
 *    trigger it keeps the popover open while the pointer moves down-RIGHT,
 *    away from both. A safe area you cannot leave is not a safe area, it is a
 *    stuck popover.
 *
 * `from` is the pointer position at the moment it left the trigger.
 */
export function svInSafeCorridor(
  point: { x: number; y: number },
  from: { x: number; y: number },
  panel: SvRect,
): boolean {
  // The panel's two corners nearest the departure point, forming the far edge
  // of the corridor.
  const right = panel.left + panel.width;
  const bottom = panel.top + panel.height;
  const corners: [number, number][] =
    from.y <= panel.top ? [[panel.left, panel.top], [right, panel.top]]
    : from.y >= bottom ? [[panel.left, bottom], [right, bottom]]
    : from.x <= panel.left ? [[panel.left, panel.top], [panel.left, bottom]]
    : [[right, panel.top], [right, bottom]];

  // Inside the panel itself is always safe.
  if (point.x >= panel.left && point.x <= right && point.y >= panel.top && point.y <= bottom) {
    return true;
  }

  // ★★ THE APEX SITS A FEW PIXELS BEHIND THE DEPARTURE POINT, NOT ON IT.
  //    `from` comes from a `pointerleave`, whose coordinates are fractional
  //    (150.4), and the moves that follow are often `mousemove`s, whose are
  //    whole pixels (150). With the apex exactly on the departure point, the
  //    very first move after leaving the trigger — straight toward the panel —
  //    rounded to a point fractionally BEHIND the apex, fell outside the wedge,
  //    and closed the panel on the spot: the store's "All Categories" menu
  //    vanished as the pointer crossed the 8px gap below its trigger. A hand
  //    also wobbles a pixel or two backwards when it sets off. Moving the apex
  //    `CORRIDOR_SLOP` px away from the panel absorbs both without widening the
  //    wedge anywhere a pointer heading elsewhere could use it.
  const apex: [number, number] =
    from.y <= panel.top ? [from.x, from.y - CORRIDOR_SLOP]
    : from.y >= bottom ? [from.x, from.y + CORRIDOR_SLOP]
    : from.x <= panel.left ? [from.x - CORRIDOR_SLOP, from.y]
    : [from.x + CORRIDOR_SLOP, from.y];
  return pointInTriangle(point, apex, corners[0], corners[1]);
}

/** How far behind the departure point the corridor's apex sits. See above. */
const CORRIDOR_SLOP = 6;

/** Barycentric sign test — no square roots, no trigonometry, no epsilon. */
function pointInTriangle(
  p: { x: number; y: number },
  a: [number, number],
  b: [number, number],
  c: [number, number],
): boolean {
  const cross = (
    ax: number, ay: number, bx: number, by: number, cx: number, cy: number,
  ) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

  const d1 = cross(a[0], a[1], b[0], b[1], p.x, p.y);
  const d2 = cross(b[0], b[1], c[0], c[1], p.x, p.y);
  const d3 = cross(c[0], c[1], a[0], a[1], p.x, p.y);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}
