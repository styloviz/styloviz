import { svAnchorLost, svInSafeCorridor, svPositionAnchored, type SvRect } from './anchored-position';

/**
 * ★★★ EVERY CASE HERE IS ONE OF THE FOUR IMPLEMENTATIONS' BLIND SPOTS. They
 *     agreed on the easy 80% — put the panel under the trigger — and diverged
 *     or went silent on RTL, transformed ancestors, disappearing anchors,
 *     cursor positions at the screen edge, and where the arrow points once a
 *     panel has been pulled back from an edge.
 *
 * ★ Pure arithmetic over two rectangles, which is why it can be tested at all:
 *   none of these defects is reproducible through a component in jsdom, where
 *   every rect is 0×0.
 */

const VIEWPORT = { width: 1000, height: 800 };
const rect = (left: number, top: number, width: number, height: number): SvRect =>
  ({ left, top, width, height });

const at = (anchor: SvRect, extra: Record<string, unknown> = {}) =>
  svPositionAnchored({
    anchor,
    panel: { width: 200, height: 100 },
    placement: 'bottom-start',
    viewport: VIEWPORT,
    ...extra,
  });

describe('svPositionAnchored — placement', () => {
  it('puts a bottom-start panel under the anchor, left edges aligned', () => {
    const r = at(rect(100, 100, 80, 20));
    expect(r.top).toBe(128);        // 100 + 20 + 8 offset
    expect(r.left).toBe(100);
    expect(r.placement).toBe('bottom-start');
  });

  it('aligns end to the anchor\'s far edge, and center to its middle', () => {
    expect(at(rect(400, 100, 80, 20), { placement: 'bottom-end' }).left).toBe(280);
    expect(at(rect(400, 100, 80, 20), { placement: 'bottom' }).left).toBe(340);
  });

  it('places the side placements across the anchor, not under it', () => {
    const r = at(rect(400, 300, 80, 20), { placement: 'right' });
    expect(r.left).toBe(488);       // 400 + 80 + 8
    expect(r.top).toBe(260);        // centred on the anchor: 310 - 50
  });

  it('★ mirrors start/end for RTL, and leaves the side alone', () => {
    // `start` means "the edge text starts at" — the RIGHT edge in RTL. All
    // four implementations hard-coded it to the left, so a menu on an Arabic
    // page opened away from its trigger.
    const ltr = at(rect(400, 100, 80, 20), { placement: 'bottom-start' });
    const rtl = at(rect(400, 100, 80, 20), { placement: 'bottom-start', rtl: true });

    expect(ltr.left).toBe(400);
    expect(rtl.left).toBe(280);     // right edges aligned instead
    expect(rtl.placement).toBe('bottom-end');
    expect(rtl.top).toBe(ltr.top);  // the SIDE is unchanged
  });
});

describe('svPositionAnchored — flipping', () => {
  it('flips below → above when there is no room below', () => {
    const r = at(rect(100, 760, 80, 20));   // 20px from the bottom
    expect(r.placement).toBe('top-start');
    expect(r.top).toBe(652);                 // 760 - 8 - 100
  });

  it('★ does not flip into a side that does not fit either', () => {
    // Flipping into a space that is also too small just moves the clamping to
    // the other end and puts the panel over the trigger the user is looking
    // at.
    const r = svPositionAnchored({
      anchor: rect(100, 380, 80, 20),
      panel: { width: 200, height: 700 },    // taller than any gap
      placement: 'bottom-start',
      viewport: VIEWPORT,
    });
    expect(r.placement).toBe('bottom-start');
  });

  it('can be turned off', () => {
    const r = at(rect(100, 760, 80, 20), { flip: false });
    expect(r.placement).toBe('bottom-start');
  });
});

describe('svPositionAnchored — viewport edges', () => {
  it('★ pulls a panel back from the right edge — the cursor-at-the-edge case', () => {
    // `OF-20-I2` / `OF-04-I4`: a right-click 10px from the edge of the screen,
    // modelled as a zero-size anchor at the cursor.
    const r = at(rect(990, 100, 0, 0));
    expect(r.left).toBe(792);       // 1000 - 200 - 8
    expect(r.clamped).toBe(true);
  });

  it('keeps the margin on the near edges too', () => {
    const r = at(rect(2, 2, 0, 0));
    expect(r.left).toBe(8);
    expect(r.clamped).toBe(true);
  });

  it('★ shows the START of a panel taller than the viewport, not its end', () => {
    // Without `Math.max(margin, …)` on the upper bound, the bound falls below
    // the lower one and the panel is pinned to the BOTTOM edge — so the user
    // sees the last item of a long menu and has to scroll up to find the
    // first.
    const r = svPositionAnchored({
      anchor: rect(100, 400, 80, 20),
      panel: { width: 200, height: 2000 },
      placement: 'bottom-start',
      viewport: VIEWPORT,
    });
    expect(r.top).toBe(8);
  });

  it('reports clamped: false when nothing had to move', () => {
    expect(at(rect(400, 300, 80, 20)).clamped).toBe(false);
  });
});

describe('svPositionAnchored — the arrow', () => {
  it('points at the anchor centre', () => {
    const r = at(rect(400, 100, 80, 20));
    expect(r.arrowX).toBe(40);      // anchor centre 440, panel left 400
  });

  it('★ is measured from the CLAMPED panel, so it still points at the trigger', () => {
    // Once a panel has been pulled back from an edge, an arrow placed at the
    // panel's centre points at where the panel WOULD have been — which reads
    // as pointing at nothing.
    const r = at(rect(990, 100, 0, 0));
    expect(r.left).toBe(792);
    expect(r.arrowX).toBe(184);     // 990 - 792, the real trigger position
  });

  it('stays `arrowInset` away from the corners', () => {
    const r = at(rect(0, 100, 4, 20), { arrowInset: 16 });
    expect(r.arrowX).toBe(16);
  });
});

describe('svPositionAnchored — a transformed containing block (OF-12-I5)', () => {
  it('★ subtracts the containing block, so a route animation does not move the menu', () => {
    // ★★ ANY ancestor with a `transform`, `filter`, `perspective` or
    //    `will-change` becomes the containing block for a `position: fixed`
    //    panel, and every viewport coordinate is then off by that element's
    //    offset. A page-transition animation on a wrapper is enough — which
    //    is why the symptom is "the menu is fine until the route animates".
    const plain = at(rect(400, 300, 80, 20));
    const inside = at(rect(400, 300, 80, 20), { container: rect(120, 60, 500, 500) });

    expect(inside.left).toBe(plain.left - 120);
    expect(inside.top).toBe(plain.top - 60);
  });

  it('is a no-op when the containing block is the viewport', () => {
    const plain = at(rect(400, 300, 80, 20));
    const zero = at(rect(400, 300, 80, 20), { container: rect(0, 0, 1000, 800) });
    expect(zero).toEqual(plain);
  });

  it('corrects the position but NOT the arrow, which is panel-relative', () => {
    const inside = at(rect(400, 300, 80, 20), { container: rect(120, 60, 500, 500) });
    expect(inside.arrowX).toBe(40);
  });
});

describe('svAnchorLost — an orphaned panel is worse than a closed one', () => {
  it('reports a detached anchor', () => {
    const el = document.createElement('button');
    expect(svAnchorLost(el)).toBe(true);       // never in the document
  });

  it('reports a missing anchor', () => {
    expect(svAnchorLost(null)).toBe(true);
    expect(svAnchorLost(undefined)).toBe(true);
  });

  it('★ reports a zero-size anchor, which `isConnected` alone misses', () => {
    // An anchor inside a collapsed accordion or a `display: none` sidebar is
    // still in the document and still has a parent. It just has no position —
    // and a rect of 0×0 at 0,0 sent the panel to the top-left of the screen.
    const el = document.createElement('button');
    document.body.appendChild(el);
    try {
      // jsdom reports 0×0 for everything, which is exactly this case.
      expect(svAnchorLost(el)).toBe(true);
    } finally {
      el.remove();
    }
  });

  it('accepts an anchor with a real rect', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    el.getBoundingClientRect = () => ({ width: 80, height: 20, top: 0, left: 0 }) as DOMRect;
    try {
      expect(svAnchorLost(el)).toBe(false);
    } finally {
      el.remove();
    }
  });
});

describe('svInSafeCorridor — the gap between trigger and panel', () => {
  // A panel 200×100 sitting below the departure point.
  const panel = rect(300, 200, 200, 100);
  const from = { x: 350, y: 180 };   // where the pointer left the trigger

  it('★ keeps the popover open while the pointer travels toward the panel', () => {
    // A plain `mouseleave` close fires while the pointer is in mid-air over
    // the `offset` gap — the popover closes as the user reaches for it.
    expect(svInSafeCorridor({ x: 355, y: 190 }, from, panel)).toBe(true);
  });

  it('closes when the pointer goes somewhere else entirely', () => {
    expect(svInSafeCorridor({ x: 900, y: 190 }, from, panel)).toBe(false);
  });

  it('★ a triangle, not a bounding box — the box is far too generous', () => {
    // ★★ THE PROBE POINT HAS TO BE ONE THE BOX WOULD ACCEPT AND THE PANEL
    //    WOULD NOT, or the test passes for the wrong reason — which is what
    //    my first two versions did: one probe was past the panel, the other
    //    was INSIDE it, where the corridor rule is "always safe" and says
    //    nothing about triangles at all.
    //
    //    Panel x 100–300, y 200–300; departure (350, 180). The union of the
    //    two spans x 100–350, y 180–300, so (110, 190) is deep inside the BOX
    //    and outside the panel — and the wedge from the departure point to
    //    the panel's near edge spans only x 225–325 at that height. The
    //    pointer has gone left along the gap, away from where it was
    //    heading. A safe area you cannot leave is not a safe area, it is a
    //    stuck popover.
    const panelLeft = rect(100, 200, 200, 100);
    const departure = { x: 350, y: 180 };

    expect(svInSafeCorridor({ x: 110, y: 190 }, departure, panelLeft)).toBe(false);
    // …while the point actually between them stays safe.
    expect(svInSafeCorridor({ x: 250, y: 195 }, departure, panelLeft)).toBe(true);
    // And well away from both is false under either rule.
    expect(svInSafeCorridor({ x: 900, y: 600 }, departure, panelLeft)).toBe(false);
  });

  /**
   * ★★ The store's "All Categories" mega menu closed as the pointer crossed the
   *    8px gap under its trigger. The departure point came from a
   *    `pointerleave` (fractional, y 150.4) and the next move from a
   *    `mousemove` (whole pixels, y 150) — a hair BEHIND an apex placed exactly
   *    on the departure point, so outside the wedge, so closed.
   */
  it('★ survives the first move after leaving, even rounded a pixel behind the exit', () => {
    const below = rect(44, 152, 882, 453);
    const exit = { x: 112.9, y: 150.4 };
    expect(svInSafeCorridor({ x: 113, y: 150 }, exit, below)).toBe(true);
    // …and a small backwards wobble as the hand sets off.
    expect(svInSafeCorridor({ x: 112, y: 147 }, exit, below)).toBe(true);
    // Heading well away along the bar is still a departure, not an approach.
    expect(svInSafeCorridor({ x: 400, y: 140 }, exit, below)).toBe(false);
  });

  it('inside the panel is always safe', () => {
    expect(svInSafeCorridor({ x: 400, y: 250 }, from, panel)).toBe(true);
  });

  it('works for a panel above, and for one to the side', () => {
    // ★ The corridor runs from the departure point to the panel's NEAR edge,
    //   so for a panel above a pointer that left below it, the safe area is
    //   the wedge between y=300 (the panel's bottom) and y=320 (the pointer).
    //   My first version of this test put the probe point above the panel
    //   entirely and asserted `true` — the engine was right and the test was
    //   wrong, which is the failure mode a geometry helper invites.
    expect(svInSafeCorridor({ x: 350, y: 310 }, { x: 350, y: 320 }, rect(300, 200, 200, 100)))
      .toBe(true);
    expect(svInSafeCorridor({ x: 350, y: 190 }, { x: 350, y: 320 }, rect(300, 200, 200, 100)))
      .toBe(false);   // past the panel, not in front of it

    expect(svInSafeCorridor({ x: 290, y: 250 }, { x: 250, y: 250 }, rect(300, 200, 200, 100)))
      .toBe(true);
  });
});
