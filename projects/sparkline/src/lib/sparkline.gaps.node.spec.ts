import {
  applyMissing,
  areaPathOf,
  barsOf,
  domainOf,
  gapCount,
  linePathOf,
  pointsOf,
  statsOf,
  svSharedDomain,
  toSlots,
  toValues,
} from './sparkline-geometry';

/**
 * Gaps, and the scale a sparkline is drawn against.
 *
 * ★ Both failures here are the same shape: the chart draws something plausible
 * for data it does not have. A dropped sample closes up and becomes a trend; a
 * per-series scale makes a 2% rise and a 900% rise the identical picture.
 */

const GAPPY = [10, null, 30, 40];

describe('toSlots vs toValues', () => {
  it('keeps a gap in its place, where toValues closes it up', () => {
    // ★★ THE DEFECT IN ONE ASSERTION. Dropping the hole shortens the series, so
    // every point after it shifts one slot left and a Tuesday the collector
    // never ran renders as a continuous trend from Monday to Wednesday.
    expect(toValues([10, Number.NaN, 30, 40])).toEqual([10, 30, 40]);
    expect(toSlots([10, Number.NaN, 30, 40])).toEqual([10, null, 30, 40]);
  });

  it('treats a missing object value the same as a missing number', () => {
    expect(toSlots([{ value: 1 }, { value: Number.POSITIVE_INFINITY }, 3])).toEqual([1, null, 3]);
  });
});

describe('applyMissing', () => {
  it('gap leaves the hole alone — the only policy that invents nothing', () => {
    expect(applyMissing(GAPPY, 'gap')).toEqual([10, null, 30, 40]);
  });

  it('skip closes up, which is a silent rewrite of the x axis', () => {
    expect(applyMissing(GAPPY, 'skip')).toEqual([10, 30, 40]);
  });

  it('zero asserts a value nobody measured', () => {
    // For a rate or a price, "0" is a different statement from "not collected"
    // — and it drags the domain down with it, flattening everything else.
    expect(applyMissing(GAPPY, 'zero')).toEqual([10, 0, 30, 40]);
  });

  it('connect draws a straight line across the hole', () => {
    expect(applyMissing([10, null, null, 40], 'connect')).toEqual([10, 20, 30, 40]);
  });

  it('refuses to extrapolate past either end', () => {
    // Leading and trailing gaps have nothing to interpolate *from*; filling
    // them would invent data outside the series entirely.
    expect(applyMissing([null, 10, 20, null], 'connect')).toEqual([null, 10, 20, null]);
  });

  it('counts what is missing', () => {
    expect(gapCount(GAPPY)).toBe(1);
    expect(gapCount([null, null])).toBe(2);
    expect(gapCount([1, 2])).toBe(0);
  });
});

describe('linePathOf across a gap', () => {
  const pts = pointsOf([10, null, 30, 40], 120, 36, 0);

  it('breaks into separate subpaths rather than joining across the hole', () => {
    const d = linePathOf(pts);
    // Two `M` commands: joining them would draw a line through data nobody has,
    // which is the `connect` policy and has to be asked for.
    expect(d.match(/M/g)).toHaveLength(2);
  });

  it('keeps the surviving points at their original x', () => {
    // The gap holds its slot — that is what makes the break land where the
    // missing sample actually was.
    expect(pts.map((p) => p.i)).toEqual([0, 2, 3]);
    expect(pts[1].x).toBeGreaterThan(60);
  });

  it('still paints a run of one, so a day we do have is not hidden', () => {
    const lone = pointsOf([5, null, 9, null, 3], 120, 36, 0);
    const d = linePathOf(lone);
    expect(d.match(/M/g)).toHaveLength(3);
  });

  it('closes each area run on its own', () => {
    const d = areaPathOf(pts, 36, 0);
    // One `Z` across the gap would fill underneath the missing region — a
    // filled area asserting a volume that was never measured.
    expect(d.match(/Z/g)).toHaveLength(1);
    expect(d).not.toContain('M0,');
  });

  it('draws nothing where a bar has no value', () => {
    const bars = barsOf([10, null, 30], 90, 36);
    expect(bars).toHaveLength(2);
    // The empty slot keeps its width, so the bars after it stay where they belong.
    expect(bars[1].x).toBeGreaterThan(60);
  });
});

describe('statsOf with gaps', () => {
  it('counts only what exists', () => {
    const s = statsOf([10, null, 30, 40])!;
    expect(s.count).toBe(3);
    expect(s.first).toBe(10);
    expect(s.last).toBe(40);
  });

  it('indexes the extremes by slot, not by position among the survivors', () => {
    const s = statsOf([10, null, 5, 40])!;
    // ★ The index is used to place a marker dot, so it has to name the column
    // the value is actually drawn in.
    expect(s.minIndex).toBe(2);
    expect(s.maxIndex).toBe(3);
  });

  it('is null when nothing was collected at all', () => {
    expect(statsOf([null, null])).toBeNull();
  });
});

describe('svSharedDomain', () => {
  it('covers every series in the group', () => {
    expect(svSharedDomain([[1, 2], [50, 900], [null, 3]])).toEqual([1, 900]);
  });

  it('falls back to a unit range when the group holds no data', () => {
    expect(svSharedDomain([[null], []])).toEqual([0, 1]);
  });

  it('is what makes two rows comparable at all', () => {
    // ★★★ Row A rising 2% and row B rising 900% draw the IDENTICAL shape when
    // each is scaled to itself. Against one domain they do not.
    const a = [100, 102];
    const b = [100, 900];
    const own = [pointsOf(a, 100, 40, 0), pointsOf(b, 100, 40, 0)];
    expect(own[0][0].y).toBe(own[1][0].y);
    expect(own[0][1].y).toBe(own[1][1].y);

    const [lo, hi] = svSharedDomain([a, b]);
    const shared = [pointsOf(a, 100, 40, 0, lo, hi), pointsOf(b, 100, 40, 0, lo, hi)];
    expect(shared[0][1].y).toBeGreaterThan(shared[1][1].y);
  });
});

describe('pointsOf against a pinned domain', () => {
  it('clamps an out-of-range value to the edge and says it did', () => {
    // ★★ Without the clamp the point projected off-canvas, the viewBox cut the
    // line out of the chart, and nothing said so — the failure a SHARED domain
    // makes common, because one row's spike is outside the range every other
    // row agreed on.
    const pts = pointsOf([50, 500], 100, 40, 0, 0, 100);
    expect(pts[1].y).toBe(0);
    expect(pts[1].clipped).toBe(true);
    expect(pts[0].clipped).toBe(false);
  });

  it('clamps below the floor as well', () => {
    const pts = pointsOf([50, -900], 100, 40, 0, 0, 100);
    expect(pts[1].y).toBe(40);
    expect(pts[1].clipped).toBe(true);
  });

  it('flags nothing when the series fits', () => {
    expect(pointsOf([10, 90], 100, 40, 0, 0, 100).every((p) => !p.clipped)).toBe(true);
  });
});

describe('domainOf', () => {
  it('ignores holes when working out the range', () => {
    expect(domainOf([10, null, 30])).toEqual({ min: 10, max: 30, range: 20 });
  });

  it('survives a series long enough to break an argument spread', () => {
    // `Math.min(...values)` throws on a long enough array; a loop does not.
    const long = Array.from({ length: 200_000 }, (_, i) => i);
    expect(() => domainOf(long)).not.toThrow();
    expect(domainOf(long).max).toBe(199_999);
  });
});
