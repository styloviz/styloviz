import { svBollinger, svEma, svMacd, svRsi, svSma } from './indicators';

/**
 * Pure arithmetic — no DOM, no TestBed, hence `.node.spec.ts`.
 *
 * An indicator a trader cannot reproduce on their own terminal is worse than
 * none: it draws a confident line that disagrees with the one they trust. So
 * each indicator is held to a series whose answer is known independently —
 * a published worked example, or a closed form — not to its own output.
 */

/** `[x0, x0 + step, x0 + 2·step, …]`. */
function linear(length: number, x0: number, step: number): number[] {
  return Array.from({ length }, (_, i) => x0 + step * i);
}

/** Every non-null value close to `expected[i]`, and the nulls exactly where expected. */
function expectSeries(actual: readonly (number | null)[], expected: readonly (number | null)[], tolerance = 1e-9): void {
  expect(actual.length).toBe(expected.length);
  expected.forEach((e, i) => {
    if (e === null) expect(actual[i], `index ${i}`).toBeNull();
    else expect(Math.abs((actual[i] as number) - e), `index ${i}: ${actual[i]} vs ${e}`).toBeLessThanOrEqual(tolerance);
  });
}

describe('svSma — the mean of the last n values', () => {
  it('is blank through the warm-up, then the window mean', () => {
    expectSeries(svSma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  });

  it('restarts the warm-up after a missing value instead of carrying NaN forward', () => {
    expectSeries(svSma([1, 2, null, 4, 5, Number.NaN, 7, 8], 2), [null, 1.5, null, null, 4.5, null, null, 7.5]);
  });

  it('does not drift over a long history — the running sum is re-summed', () => {
    const values = Array.from({ length: 20_000 }, (_, i) => 1e6 + Math.sin(i) * 0.37);
    const sma = svSma(values, 7);
    for (const i of [6, 999, 19_999]) {
      const naive = values.slice(i - 6, i + 1).reduce((a, b) => a + b, 0) / 7;
      expect(Math.abs((sma[i] as number) - naive)).toBeLessThan(1e-7);
    }
  });

  it('refuses a period that is not a whole number of sessions', () => {
    expect(() => svSma([1, 2, 3], 0)).toThrow(RangeError);
    expect(() => svSma([1, 2, 3], 2.5)).toThrow(RangeError);
  });
});

describe('svEma — seeded with the first SMA, α = 2/(n+1)', () => {
  it('lags a straight line by exactly step·(n−1)/2 from the seed on', () => {
    // The SMA seed of a line sits at its middle value, and an EMA of a line
    // seeded on the line's own lag stays on it: EMAₜ = xₜ − step·(n−1)/2.
    const values = linear(30, 10, 2);
    const expected = values.map((x, i) => (i < 4 ? null : x - 4));
    expectSeries(svEma(values, 5), expected);
  });

  it('is the series itself when the series is constant', () => {
    expectSeries(svEma([7, 7, 7, 7, 7], 3), [null, null, 7, 7, 7]);
  });

  it('weights the newest value by 2/(n+1)', () => {
    // seed = mean(1, 2, 3) = 2; next = 2 + 0.5·(10 − 2) = 6.
    expectSeries(svEma([1, 2, 3, 10], 3), [null, null, 2, 6]);
  });
});

describe('svBollinger — SMA ± k population standard deviations', () => {
  it('matches the closed form on 1…20', () => {
    // mean = 10.5; population variance of 1…n is (n² − 1)/12 = 33.25.
    const { middle, upper, lower } = svBollinger(linear(20, 1, 1), 20, 2);
    const sd = Math.sqrt(399 / 12);
    expect(middle[19]).toBeCloseTo(10.5, 12);
    expect(upper[19]).toBeCloseTo(10.5 + 2 * sd, 12);
    expect(lower[19]).toBeCloseTo(10.5 - 2 * sd, 12);
    expect(upper[18]).toBeNull();
  });

  it('collapses onto the average when nothing moves', () => {
    const { middle, upper, lower } = svBollinger([5, 5, 5, 5], 3, 2);
    expectSeries(middle, [null, null, 5, 5]);
    expectSeries(upper, [null, null, 5, 5]);
    expectSeries(lower, [null, null, 5, 5]);
  });

  it('refuses a negative multiplier', () => {
    expect(() => svBollinger([1, 2, 3], 2, -1)).toThrow(RangeError);
  });
});

describe('svRsi — Wilder', () => {
  // The worked example in Wilder's method as StockCharts publishes it (14
  // periods). The published column rounds its averages to two places at every
  // step, so it differs from exact arithmetic by up to 0.07; hence 0.1.
  const CLOSES = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28,
    46.28, 46.0, 46.03, 46.41, 46.22, 45.64, 46.21, 46.25, 45.71, 46.45, 45.78, 45.35, 44.03, 44.18,
    44.22, 44.57, 43.42, 42.66, 43.13,
  ];
  const PUBLISHED = [
    70.53, 66.32, 66.55, 69.41, 66.36, 57.97, 62.93, 63.26, 56.06, 62.38, 54.71, 50.42, 39.99, 41.46,
    41.87, 45.46, 37.3, 33.08, 37.77,
  ];

  it('reproduces the published worked example', () => {
    const rsi = svRsi(CLOSES, 14);
    expectSeries(rsi, [...new Array<null>(14).fill(null), ...PUBLISHED], 0.1);
  });

  it('first speaks on session `period` — it needs period CHANGES', () => {
    const rsi = svRsi(linear(16, 1, 1), 14);
    expect(rsi[13]).toBeNull();
    expect(rsi[14]).not.toBeNull();
  });

  it('reads 100 with no losses, 0 with no gains, 50 when nothing moves', () => {
    expect(svRsi(linear(20, 1, 1), 5).at(-1)).toBe(100);
    expect(svRsi(linear(20, 50, -1), 5).at(-1)).toBe(0);
    expect(svRsi(new Array(20).fill(3), 5).at(-1)).toBe(50);
  });
});

describe('svMacd — EMA(fast) − EMA(slow), signal, histogram', () => {
  it('settles at step·(slow − fast)/2 on a straight line, with a zero histogram', () => {
    // EMA lag on a line is step·(n−1)/2, so the gap between the two lags is
    // step·((26−1) − (12−1))/2 = 7·step — exactly, from the slow seed on.
    const { macd, signal, histogram } = svMacd(linear(60, 100, 2), 12, 26, 9);
    expect(macd[24]).toBeNull();
    expect(macd[25]).toBeCloseTo(14, 9);
    expect(macd[59]).toBeCloseTo(14, 9);
    expect(signal[32]).toBeNull();
    expect(signal[33]).toBeCloseTo(14, 9);
    expect(histogram[33]).toBeCloseTo(0, 9);
    expect(histogram[59]).toBeCloseTo(0, 9);
  });

  it('is flat zero on a constant series', () => {
    const { macd, histogram } = svMacd(new Array(40).fill(9), 3, 6, 4);
    expect(macd[39]).toBe(0);
    expect(histogram[39]).toBe(0);
  });

  it('refuses a fast period that is not shorter than the slow one', () => {
    expect(() => svMacd([1, 2, 3], 26, 12, 9)).toThrow(RangeError);
  });
});
