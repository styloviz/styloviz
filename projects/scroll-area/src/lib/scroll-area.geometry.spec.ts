import {
  SV_MIN_THUMB_PX,
  svScrollEdges,
  svScrollLabel,
  svScrollTopForThumb,
  svScrollable,
  svThumbGeometry,
} from './scroll-area.geometry';

// ── Thumb geometry ──────────────────────────────────────────────────────────

describe('the thumb', () => {
  it('is proportional to how much of the content is visible', () => {
    // Half the content visible → half the track.
    expect(svThumbGeometry(400, 800, 0).size).toBeCloseTo(200, 6);
    // A quarter visible → a quarter of the track.
    expect(svThumbGeometry(400, 1600, 0).size).toBeCloseTo(100, 6);
  });

  it('is hidden when the content fits', () => {
    expect(svThumbGeometry(400, 400, 0).visible).toBe(false);
    expect(svThumbGeometry(400, 100, 0).visible).toBe(false);
  });

  it('sits at the top at rest and at the bottom at the end', () => {
    const top = svThumbGeometry(400, 800, 0);
    expect(top.offset).toBe(0);

    const bottom = svThumbGeometry(400, 800, 400);
    expect(bottom.offset + bottom.size).toBeCloseTo(400, 6);
  });

  /**
   * ★★★ WITHOUT A MINIMUM, A LONG DOCUMENT HAS AN UNGRABBABLE SCROLLBAR. The
   * proportional size is correct and no pointer can hit it.
   */
  it('never shrinks below a grabbable size', () => {
    const geo = svThumbGeometry(400, 40000, 0);
    expect((400 * 400) / 40000).toBeLessThan(SV_MIN_THUMB_PX);
    expect(geo.size).toBe(SV_MIN_THUMB_PX);
    expect(geo.clamped).toBe(true);
  });

  it('does not claim to have clamped when it did not', () => {
    expect(svThumbGeometry(400, 800, 0).clamped).toBe(false);
  });

  it('never draws a thumb longer than its own track', () => {
    // A minimum larger than the viewport would otherwise overflow the bar.
    const geo = svThumbGeometry(20, 100000, 0, 200);
    expect(geo.size).toBeLessThanOrEqual(20);
  });

  /**
   * ★★★ THE CORRECTION THE WHOLE MODULE EXISTS FOR. A clamped thumb can only
   * travel `viewport − size`; the naive offset formula still assumes it can
   * travel `viewport`, so the thumb runs off the end of its own track by exactly
   * the amount the clamp added.
   */
  it('lands exactly at the end of the track when scrolled to the bottom, even when clamped', () => {
    const viewport = 400;
    const content = 40000;
    const geo = svThumbGeometry(viewport, content, content - viewport);

    expect(geo.clamped).toBe(true);
    expect(geo.offset + geo.size).toBeCloseTo(viewport, 6);
    // The naive formula would put it here, well past the track:
    expect(((content - viewport) / content) * viewport + geo.size).toBeGreaterThan(viewport + 10);
  });

  it('lands exactly at the end of the track when not clamped', () => {
    const geo = svThumbGeometry(400, 1000, 600);
    expect(geo.offset + geo.size).toBeCloseTo(400, 6);
  });

  it('is halfway along the track at half scroll', () => {
    const viewport = 400;
    const content = 40000;
    const geo = svThumbGeometry(viewport, content, (content - viewport) / 2);
    expect(geo.offset).toBeCloseTo((viewport - geo.size) / 2, 6);
  });

  /**
   * ★★ scrollTop OVERSHOOTS DURING AN iOS RUBBER-BAND, and goes negative at the
   * top. An unclamped progress paints the thumb outside its own track, which
   * reads as a rendering bug rather than as the bounce it is.
   */
  it('stays inside the track when the platform bounces past the ends', () => {
    const over = svThumbGeometry(400, 800, 900);
    expect(over.progress).toBe(1);
    expect(over.offset + over.size).toBeCloseTo(400, 6);

    const under = svThumbGeometry(400, 800, -120);
    expect(under.progress).toBe(0);
    expect(under.offset).toBe(0);
  });

  it('survives nonsense dimensions rather than producing NaN', () => {
    for (const geo of [
      svThumbGeometry(0, 800, 10),
      svThumbGeometry(400, 0, 10),
      svThumbGeometry(Number.NaN, 800, 10),
      svThumbGeometry(400, Number.NaN, 10),
      svThumbGeometry(-5, -5, 0),
    ]) {
      expect(Number.isFinite(geo.size)).toBe(true);
      expect(Number.isFinite(geo.offset)).toBe(true);
      expect(geo.visible).toBe(false);
    }
  });
});

// ── Dragging ────────────────────────────────────────────────────────────────

describe('dragging the thumb', () => {
  /**
   * ★★★ THE DRAG AND THE RENDER MUST USE THE SAME DENOMINATOR. If one divides by
   * `viewport` while the other divides by `viewport − size`, the thumb runs away
   * from the pointer — slowly at first, by a whole thumb-length at the bottom.
   * That drift is the single most-reported bug in hand-rolled scrollbars.
   */
  it('round-trips: rendering a scrollTop and dragging back to it agree', () => {
    for (const [viewport, content] of [[400, 800], [400, 40000], [300, 305], [120, 9000]]) {
      const scrollable = content - viewport;
      for (const fraction of [0, 0.13, 0.5, 0.87, 1]) {
        const scrollTop = scrollable * fraction;
        const geo = svThumbGeometry(viewport, content, scrollTop);
        expect(svScrollTopForThumb(geo.offset, viewport, content)).toBeCloseTo(scrollTop, 6);
      }
    }
  });

  it('dragging to the end of the track reaches the end of the content', () => {
    const viewport = 400;
    const content = 40000;
    const geo = svThumbGeometry(viewport, content, 0);
    expect(svScrollTopForThumb(viewport - geo.size, viewport, content))
      .toBeCloseTo(content - viewport, 6);
  });

  it('clamps a drag past either end of the track', () => {
    expect(svScrollTopForThumb(-50, 400, 800)).toBe(0);
    expect(svScrollTopForThumb(9999, 400, 800)).toBeCloseTo(400, 6);
  });

  it('has nowhere to drag when the content fits', () => {
    expect(svScrollTopForThumb(50, 400, 300)).toBe(0);
  });
});

// ── Scrollable amount ───────────────────────────────────────────────────────

describe('how far it can scroll', () => {
  it('is the overflow', () => {
    expect(svScrollable(400, 1000)).toBe(600);
  });

  it('is never negative', () => {
    expect(svScrollable(400, 100)).toBe(0);
  });
});

// ── Edge shadows ────────────────────────────────────────────────────────────

describe('which edges have more behind them', () => {
  /**
   * ★★ ONCE THE NATIVE CHROME IS HIDDEN, A LIST THAT SCROLLS LOOKS EXACTLY LIKE
   * A LIST THAT DOES NOT. The edge fade is the only affordance left.
   */
  it('reports nothing to fade when everything fits', () => {
    expect(svScrollEdges(400, 300, 0)).toBe('none');
  });

  it('fades the far edge at the start', () => {
    expect(svScrollEdges(400, 1000, 0)).toBe('end');
  });

  it('fades the near edge at the end', () => {
    expect(svScrollEdges(400, 1000, 600)).toBe('start');
  });

  it('fades both in the middle', () => {
    expect(svScrollEdges(400, 1000, 300)).toBe('both');
  });

  /**
   * ★ A HALF-PIXEL TOLERANCE, BECAUSE scrollTop IS FRACTIONAL ON A ZOOMED OR
   * FRACTIONALLY-SCALED PAGE. Comparing exactly leaves the near-edge fade on
   * forever at 599.6 of 600, which is a permanent shadow over content nobody can
   * scroll to.
   */
  it('treats a fractional resting position as resting', () => {
    expect(svScrollEdges(400, 1000, 599.7)).toBe('start');
    expect(svScrollEdges(400, 1000, 0.3)).toBe('end');
  });

  it('clamps a bounced scrollTop rather than reporting a fourth state', () => {
    expect(svScrollEdges(400, 1000, 900)).toBe('start');
    expect(svScrollEdges(400, 1000, -50)).toBe('end');
  });
});

// ── Label ───────────────────────────────────────────────────────────────────

describe('the accessible read-out', () => {
  it('says where in the content the reader is and how much they can see', () => {
    expect(svScrollLabel(400, 800, 200)).toBe('Scrolled 50%; 50% of the content is visible.');
  });

  it('says there is nothing to scroll rather than reporting 0%', () => {
    expect(svScrollLabel(400, 300, 0)).toBe('Everything fits; nothing to scroll.');
  });
});
