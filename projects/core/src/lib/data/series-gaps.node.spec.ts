/**
 * A missing reading, drawn as missing.
 *
 * ★ The failure these replace was total rather than local: one `NaN` in a series
 *   poisoned `Math.max`, so the axis maximum was `NaN`, every y was `NaN`, and
 *   the whole line disappeared with no error. Measured on four points with one
 *   gap. Every function here exists so the gap costs the gap and nothing else.
 */
import { describe, expect, it } from 'vitest';
import {
  svFiniteExtent,
  svGapNotice,
  svGapRuns,
  svIsGap,
} from './series-gaps';

describe('svIsGap', () => {
  it('treats the deliberate absences as gaps', () => {
    expect(svIsGap(null)).toBe(true);
    expect(svIsGap(undefined)).toBe(true);
  });

  it('treats the accidental ones the same way', () => {
    // A chart cannot tell a sensor fault from a parseFloat('n/a'), and both
    // break the geometry identically.
    expect(svIsGap(Number.NaN)).toBe(true);
    expect(svIsGap(Number.POSITIVE_INFINITY)).toBe(true);
    expect(svIsGap(Number.NEGATIVE_INFINITY)).toBe(true);
  });

  it('does not treat zero or a negative as missing', () => {
    // ★ The distinction the whole file rests on: zero is a reading.
    expect(svIsGap(0)).toBe(false);
    expect(svIsGap(-0)).toBe(false);
    expect(svIsGap(-42)).toBe(false);
  });
});

describe('svFiniteExtent', () => {
  it('ignores gaps instead of returning NaN', () => {
    // ★ REGRESSION — this is the exact computation that blanked the chart.
    expect(svFiniteExtent([10, Number.NaN, 30, 40])).toEqual({
      min: 10, max: 40, gaps: 1, total: 4,
    });
  });

  it('reports no range at all when every reading is missing', () => {
    expect(svFiniteExtent([null, Number.NaN])).toEqual({
      min: null, max: null, gaps: 2, total: 2,
    });
  });

  it('handles an empty series', () => {
    expect(svFiniteExtent([])).toEqual({ min: null, max: null, gaps: 0, total: 0 });
  });

  it('keeps zero and negatives in the range', () => {
    const extent = svFiniteExtent([0, -5, 5]);
    expect(extent.min).toBe(-5);
    expect(extent.max).toBe(5);
    expect(extent.gaps).toBe(0);
  });

  it('handles a single value', () => {
    expect(svFiniteExtent([7])).toEqual({ min: 7, max: 7, gaps: 0, total: 1 });
  });

  it('counts the total including the gaps', () => {
    // The axis and the disclosure have to describe the same series.
    const extent = svFiniteExtent([1, null, null, 4]);
    expect(extent.total).toBe(4);
    expect(extent.gaps).toBe(2);
  });
});

describe('svGapRuns', () => {
  const at = (value: number, index: number) => ({ value, index });

  it('breaks a series into the stretches it can draw', () => {
    expect(svGapRuns([1, 2, null, 4, 5], at)).toEqual([
      [{ value: 1, index: 0 }, { value: 2, index: 1 }],
      [{ value: 4, index: 3 }, { value: 5, index: 4 }],
    ]);
  });

  it('keeps the original index, so x stays where the category is', () => {
    // ★ Re-indexing the survivors would slide every point after a gap to the
    //   left, quietly redating the whole right-hand side of the chart.
    const runs = svGapRuns([null, null, 30], at);
    expect(runs[0]![0]!.index).toBe(2);
  });

  it('returns one run when there is nothing missing', () => {
    expect(svGapRuns([1, 2, 3], at)).toHaveLength(1);
  });

  it('returns nothing when everything is missing', () => {
    expect(svGapRuns([null, Number.NaN, undefined], at)).toEqual([]);
  });

  it('drops leading and trailing gaps without leaving an empty run', () => {
    const runs = svGapRuns([null, 1, 2, null], at);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(2);
  });

  it('splits on consecutive gaps exactly once', () => {
    expect(svGapRuns([1, null, null, null, 5], at)).toHaveLength(2);
  });

  it('makes a run of one for an isolated reading', () => {
    const runs = svGapRuns([null, 5, null, 9, null], at);
    expect(runs.map((r) => r.length)).toEqual([1, 1]);
  });

  it('handles an empty series', () => {
    expect(svGapRuns([], at)).toEqual([]);
  });

  it('never calls the projection with a gap', () => {
    // The NaN guard lives here, once, rather than in every coordinate helper.
    const seen: number[] = [];
    svGapRuns([1, Number.NaN, 3], (v) => {
      seen.push(v);
      return v;
    });
    expect(seen).toEqual([1, 3]);
    expect(seen.every(Number.isFinite)).toBe(true);
  });
});

describe('svGapNotice', () => {
  it('says nothing when nothing is missing', () => {
    expect(svGapNotice(0, 10)).toBeNull();
  });

  it('counts one and many correctly', () => {
    expect(svGapNotice(1, 10)).toContain('1 reading missing');
    expect(svGapNotice(3, 10)).toContain('3 readings missing');
  });

  it('says why the line breaks rather than joining up', () => {
    expect(svGapNotice(1, 10)).toContain('invent a value nobody recorded');
  });

  it('says the harder truth for a stacked chart', () => {
    // A stack cannot honour a gap — every band above it is placed by the
    // running total — so the zero it has to use is disclosed instead of hidden.
    const text = svGapNotice(2, 10, true)!;
    expect(text).toContain('has to count as zero');
    expect(text).toContain('lower than the real ones');
  });

  it('says so plainly when the whole series is missing', () => {
    const text = svGapNotice(4, 4)!;
    expect(text).toContain('No readings in this series can be plotted');
    expect(text).toContain('all 4');
  });

  it('does not claim a total of zero', () => {
    expect(svGapNotice(1, 0)).toContain('1 reading missing');
  });
});
