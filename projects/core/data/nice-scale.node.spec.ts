import { svNiceScale, svTickLabel } from './nice-scale';

/**
 * Pure arithmetic — no DOM, no TestBed, hence `.node.spec.ts`.
 *
 * These two functions decide what number gets printed on an axis. A wrong answer is
 * not a layout glitch, it is a chart that states something false, so the tests are
 * about truth rather than appearance.
 */

describe('svNiceScale — covering the data', () => {
  it('rounds BOTH ends outward, not just the top', () => {
    // A response-time distribution 180…240 zero-based is a smear at the top of the
    // plot; a zero-based `niceMax()` cannot express this.
    const scale = svNiceScale(180, 240);
    expect(scale.min).toBe(180);
    expect(scale.max).toBe(240);
    expect(scale.step).toBe(20);
    expect(scale.ticks).toEqual([180, 200, 220, 240]);
  });

  /**
   * ★★★ THE SCATTER REGRESSION. The scatter plot's grid was the literal
   *     `[0, 25, 50, 75, 100]` while its scales mapped the data range onto the plot,
   *     so any data outside 0–100 was drawn against tick labels belonging to
   *     someone else's chart.
   */
  it('puts the ticks where the data is, not where 0–100 is', () => {
    const scale = svNiceScale(45_000, 120_000);
    expect(scale.min).toBeLessThanOrEqual(45_000);
    expect(scale.max).toBeGreaterThanOrEqual(120_000);
    expect(scale.ticks[0]).toBe(scale.min);
    expect(scale.ticks[scale.ticks.length - 1]).toBe(scale.max);
    expect(scale.ticks.some(t => t > 100)).toBe(true);
  });

  it('always contains the data it was given', () => {
    const ranges: readonly [number, number][] = [
      [0, 1], [10, 90], [-40, -3], [-1, 1], [0.002, 0.017],
      [1999, 2024], [1, 1_000_000], [-250, 12_500], [180, 240],
    ];
    for (const [lo, hi] of ranges) {
      const s = svNiceScale(lo, hi);
      expect(s.min).toBeLessThanOrEqual(lo);
      expect(s.max).toBeGreaterThanOrEqual(hi);
      expect(s.step).toBeGreaterThan(0);
    }
  });

  it('spans both sides of zero when the data does', () => {
    const s = svNiceScale(-30, 45);
    expect(s.min).toBeLessThan(0);
    expect(s.max).toBeGreaterThan(0);
    expect(s.ticks).toContain(0);
  });

  it('picks a 1 / 2 / 2.5 / 5 / 10 × 10ⁿ step', () => {
    expect(svNiceScale(0, 100).step).toBe(20);
    expect(svNiceScale(0, 1).step).toBe(0.2);
    expect(svNiceScale(0, 4300).step).toBe(1000);
    for (const [lo, hi] of [[0, 37], [0, 4], [12, 913], [0, 0.9]] as const) {
      const { step } = svNiceScale(lo, hi);
      const mantissa = step / Math.pow(10, Math.floor(Math.log10(step)));
      expect([1, 2, 2.5, 5, 10]).toContain(Math.round(mantissa * 10) / 10);
    }
  });

  /**
   * ★ 2.5 is on the ladder because without it a mantissa just past 2 jumps to 5,
   *   which halves the grid: this range wants a step of 2,200 and got 5,000, coming
   *   back with three ticks where six were asked for.
   */
  it('uses the 2.5 rung rather than doubling the step', () => {
    const scale = svNiceScale(0, 11_000);
    expect(scale.step).toBe(2500);
    expect(scale.ticks.length).toBe(6);
  });

  /**
   * ★★ A tick LABEL is where float noise becomes visible to a reader: building the
   *    ticks by repeated addition prints `0.30000000000000004` on the axis.
   */
  it('produces exact decimal ticks rather than accumulating float drift', () => {
    expect(svNiceScale(0, 0.5, 5).ticks).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(svNiceScale(0, 1).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('does not add a spurious step when the quotient is a float hair over an integer', () => {
    // ★ 1.1 / 0.1 === 11.000000000000002, so a bare Math.ceil rounds to 12 and the
    //   axis ends at 1.2 with an empty tick past every data point.
    const scale = svNiceScale(0, 1.1, 11);
    expect(scale.max).toBe(1.1);
    expect(scale.ticks[scale.ticks.length - 1]).toBe(1.1);
  });

  it('honours the requested tick count within a step of the ladder', () => {
    for (const target of [3, 5, 8, 11]) {
      const { ticks } = svNiceScale(0, 100, target);
      // A nice step cannot hit an arbitrary target exactly — 8 across 0–100 wants a
      // step of 12.5, and the nearest rung is 20 — but it must stay the same order
      // of magnitude as what was asked for.
      expect(ticks.length).toBeGreaterThanOrEqual(Math.ceil(target / 2));
      expect(ticks.length).toBeLessThanOrEqual(target * 2 + 1);
    }
  });
});

describe('svNiceScale — inputs that would break the division', () => {
  /**
   * ★★ One point, or a column of points sharing an x, gives `max - min === 0`, and
   *    every scale that consumes this divides by that span.
   */
  it('widens a degenerate range instead of dividing by zero', () => {
    const scale = svNiceScale(5, 5);
    expect(scale.max).toBeGreaterThan(scale.min);
    expect(scale.ticks).toContain(5);
    expect(scale.ticks.every(t => Number.isFinite(t))).toBe(true);
  });

  it('widens a degenerate range at zero too', () => {
    const s = svNiceScale(0, 0);
    expect(s.max).toBeGreaterThan(s.min);
    expect(s.ticks).toContain(0);
  });

  it('puts a degenerate value in the middle of its own axis', () => {
    // A lone point drawn on the rim of the plot reads as a boundary, not a datum.
    const s = svNiceScale(50, 50);
    expect((s.min + s.max) / 2).toBeCloseTo(50, 9);
  });

  it('survives non-finite bounds', () => {
    for (const [lo, hi] of [[NaN, 100], [0, NaN], [-Infinity, Infinity], [NaN, NaN]] as const) {
      const s = svNiceScale(lo, hi);
      expect(Number.isFinite(s.min)).toBe(true);
      expect(Number.isFinite(s.max)).toBe(true);
      expect(s.max).toBeGreaterThan(s.min);
      expect(s.ticks.every(Number.isFinite)).toBe(true);
    }
  });

  it('reads a reversed range as the range, not as degenerate', () => {
    const s = svNiceScale(90, 10);
    expect(s.min).toBeLessThanOrEqual(10);
    expect(s.max).toBeGreaterThanOrEqual(90);
  });

  it('never returns fewer than two ticks', () => {
    for (const target of [-1, 0, 1, 1.9, NaN]) {
      expect(svNiceScale(0, 10, target).ticks.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('svTickLabel', () => {
  /**
   * ★★★ THE REGRESSION. Compacting each value on its own turned 2014, 2016, 2018,
   *     2020 and 2022 all into `2.0k`. An axis whose six ticks read the same string
   *     is exactly as useful as one labelled with numbers from a different chart.
   */
  it('keeps a year a year', () => {
    const { ticks, step } = svNiceScale(2015, 2024);
    const labels = ticks.map(t => svTickLabel(t, step));
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain('2024');
    expect(labels.some(l => l.includes('k'))).toBe(false);
  });

  it('compacts a large step so the label fits the gutter', () => {
    const { ticks, step } = svNiceScale(45_000, 120_000);
    expect(ticks.map(t => svTickLabel(t, step)))
      .toEqual(['40k', '60k', '80k', '100k', '120k']);
  });

  it('goes to millions when the step does', () => {
    expect(svTickLabel(2_500_000, 500_000)).toBe('2.5M');
    expect(svTickLabel(3_000_000, 1_000_000)).toBe('3M');
    // 250,000 reads better as `250k` than as `0.25M`.
    expect(svTickLabel(250_000, 250_000)).toBe('250k');
  });

  it('keeps the decimals the step needs and no more', () => {
    expect(svTickLabel(2.5, 2.5)).toBe('2.5');
    expect(svTickLabel(0.4, 0.2)).toBe('0.4');
    expect(svTickLabel(0.75, 0.25)).toBe('0.75');
    expect(svTickLabel(40_000, 20_000)).toBe('40k');
    expect(svTickLabel(60, 20)).toBe('60');
  });

  /** Two ticks that read the same string are the defect, whatever the range. */
  it('never distinguishes two ticks by nothing', () => {
    const ranges: readonly [number, number][] = [
      [0, 1], [2015, 2024], [45_000, 120_000], [0.002, 0.017],
      [-40, -3], [1, 1_000_000], [-250, 12_500], [0, 4], [180, 240],
    ];
    for (const [lo, hi] of ranges) {
      const { ticks, step } = svNiceScale(lo, hi);
      const labels = ticks.map(t => svTickLabel(t, step));
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('writes zero as zero in every unit', () => {
    expect(svTickLabel(0, 20_000)).toBe('0');
    expect(svTickLabel(0, 0.25)).toBe('0');
  });

  it('has something to print without a usable step', () => {
    expect(svTickLabel(50, 0)).toBe('50');
    expect(svTickLabel(50, Number.NaN)).toBe('50');
    expect(svTickLabel(Number.NaN, 1)).toBe('');
  });

  it('keeps the sign', () => {
    expect(svTickLabel(-40_000, 20_000)).toBe('-40k');
    expect(svTickLabel(-0.4, 0.2)).toBe('-0.4');
  });
});
