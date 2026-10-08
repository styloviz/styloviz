import {
  svScatterCrowding,
  svScatterHygiene,
  svSystematicSample,
} from './scatter-chart.utils';

/**
 * Pure arithmetic — no DOM, no TestBed, hence `.node.spec.ts`.
 *
 * These functions decide how many points the reader is told about, and which ones
 * were quietly undrawable. A wrong answer here is not a layout glitch, it is a
 * chart that states something false, so the tests are about truth rather than
 * appearance.
 *
 * The axis ladder and tick labels are tested with the code, in
 * `projects/core/src/lib/data/nice-scale.node.spec.ts`.
 */

describe('svScatterHygiene', () => {
  type P = { x: number; y: number; size?: number };
  const audit = (points: readonly P[]) =>
    svScatterHygiene(points, { x: p => p.x, y: p => p.y, size: p => p.size });

  /**
   * ★★★ One row with a missing x used to blank the ENTIRE chart: `Math.min` of a
   *     list containing NaN is NaN, so both axis ends were NaN and every `cx` was
   *     NaN. Nothing was reported — the chart simply came out empty.
   */
  it('drops a point that has no position', () => {
    const r = audit([
      { x: 1, y: 1 },
      { x: NaN, y: 5 },
      { x: 5, y: Infinity },
      { x: 2, y: 2 },
    ]);
    expect(r.usable.length).toBe(2);
    expect(r.droppedCoord).toBe(2);
  });

  /**
   * ★★ A circle with `r="NaN"` is not drawn, and nothing anywhere says so — the
   *    plot looks complete and is one point short.
   */
  it('counts a size that could not be drawn, but keeps the point', () => {
    const r = audit([
      { x: 1, y: 1, size: 4 },
      { x: 2, y: 2, size: NaN },
      { x: 3, y: 3, size: -2 },
      { x: 4, y: 4, size: 0 },
      { x: 5, y: 5 },
    ]);
    expect(r.usable.length).toBe(5);
    expect(r.droppedSize).toBe(3);
  });

  it('does not count a missing size as a broken one', () => {
    expect(audit([{ x: 1, y: 1 }, { x: 2, y: 2 }]).droppedSize).toBe(0);
  });

  /**
   * ★★ Coincident points are the defect binning exists for, in miniature: the
   *    fourth point at (3, 3) is the same pixels as the first, so the chart shows
   *    two marks for five rows.
   */
  it('counts points stacked on the same coordinate', () => {
    const r = audit([
      { x: 3, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 3 },
      { x: 8, y: 8 }, { x: 8, y: 8 },
      { x: 9, y: 1 },
    ]);
    expect(r.overlapping).toBe(5);
    expect(r.overlapSites).toBe(2);
  });

  it('reports no overlap when every point is distinct', () => {
    const r = audit([{ x: 1, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 3 }]);
    expect(r.overlapping).toBe(0);
    expect(r.overlapSites).toBe(0);
  });

  it('keeps the usable points in the order supplied', () => {
    const points = [{ x: 3, y: 1 }, { x: NaN, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 3 }];
    expect(audit(points).usable).toEqual([points[0], points[2], points[3]]);
  });

  it('has nothing to say about no points', () => {
    const r = audit([]);
    expect(r).toEqual({
      usable: [], droppedCoord: 0, droppedSize: 0, overlapping: 0, overlapSites: 0,
    });
  });

  it('works without a size accessor at all', () => {
    const r = svScatterHygiene([{ x: 1, y: 1 }], { x: p => p.x, y: p => p.y });
    expect(r.usable.length).toBe(1);
    expect(r.droppedSize).toBe(0);
  });
});

describe('svScatterCrowding', () => {
  /**
   * ★★ Two extreme values stretch the axis to reach them and squash the other
   *    hundred into a corner. The plot is accurate and unreadable, and the reader
   *    has no way to know a filter would fix it.
   */
  it('notices when a couple of outliers hold the axis open', () => {
    const values = [...Array.from({ length: 200 }, (_, i) => i % 10), 5000, 6000];
    const r = svScatterCrowding(values, 0, 6000);
    expect(r.outliers).toBeGreaterThan(0);
    expect(r.coreShare).toBeLessThan(0.1);
  });

  it('reports a full axis for an evenly spread cloud', () => {
    const values = Array.from({ length: 200 }, (_, i) => i);
    const r = svScatterCrowding(values, 0, 200);
    expect(r.coreShare).toBeGreaterThan(0.9);
  });

  it('calls nothing an outlier when there is barely any data', () => {
    expect(svScatterCrowding([1, 900], 0, 900)).toEqual({ outliers: 0, coreShare: 1 });
    expect(svScatterCrowding([], 0, 10)).toEqual({ outliers: 0, coreShare: 1 });
  });

  it('survives a zero-width axis', () => {
    expect(svScatterCrowding([1, 2, 3], 5, 5)).toEqual({ outliers: 0, coreShare: 1 });
  });

  it('ignores values that are not numbers', () => {
    const r = svScatterCrowding([1, 2, 3, NaN, 4, Infinity, 5], 0, 5);
    expect(r.coreShare).toBeGreaterThan(0);
    expect(Number.isFinite(r.coreShare)).toBe(true);
  });

  it('keeps coreShare within 0..1', () => {
    // The core can sit outside a narrower drawn axis; the share is still a share.
    const r = svScatterCrowding([0, 50, 100, 150, 200], 40, 60);
    expect(r.coreShare).toBeLessThanOrEqual(1);
    expect(r.coreShare).toBeGreaterThanOrEqual(0);
  });
});

describe('svSystematicSample', () => {
  const range = (n: number) => Array.from({ length: n }, (_, i) => i);

  it('keeps everything when there is nothing to cut', () => {
    expect(svSystematicSample(range(10), 50)).toEqual({ items: range(10), stride: 1 });
    expect(svSystematicSample(range(10), 10).stride).toBe(1);
  });

  it('treats a limit of zero or less as no limit', () => {
    for (const limit of [0, -5, NaN]) {
      expect(svSystematicSample(range(100), limit).items.length).toBe(100);
    }
  });

  /**
   * ★★★ `slice(0, limit)` draws the first tenth of a sorted feed and calls it the
   *     cloud. A stride keeps the SHAPE: the sample must reach the far end of the
   *     input, not stop a tenth of the way in.
   */
  it('spreads the sample across the whole input', () => {
    const { items, stride } = svSystematicSample(range(1000), 100);
    expect(stride).toBe(10);
    expect(items[0]).toBe(0);
    expect(items[items.length - 1]).toBeGreaterThan(900);
  });

  it('never keeps more than the limit', () => {
    for (const [n, limit] of [[1000, 100], [999, 100], [1001, 100], [7, 3]] as const) {
      expect(svSystematicSample(range(n), limit).items.length).toBeLessThanOrEqual(limit);
    }
  });

  it('is deterministic', () => {
    const a = svSystematicSample(range(500), 40);
    const b = svSystematicSample(range(500), 40);
    expect(a.items).toEqual(b.items);
  });
});
