/**
 * indicators.ts — the technical indicators a price chart overlays, as pure
 * functions over a series of closes (`FL-D4`).
 *
 * Every function returns an array THE SAME LENGTH as its input, with `null`
 * where the indicator has no value yet. Index `i` of the output belongs to
 * session `i` of the input, so a chart can zip them without an offset to get
 * wrong — and a reader of the table sees a blank, not a number invented to fill
 * the warm-up.
 *
 * ★★★ THE WARM-UP IS BLANK, NOT ZERO AND NOT PARTIAL. A 20-session average over
 *     the first 3 sessions is a 3-session average wearing the wrong label, and
 *     a zero is a price. Both draw a line that looks like data. So the first
 *     `period - 1` values are `null` and a chart leaves the gap.
 *
 * ★★ THE CONVENTIONS ARE THE PUBLISHED ONES, so a value can be checked against
 *    any charting terminal: an EMA is seeded with the simple average of its
 *    first `period` values; RSI uses Wilder's smoothing (an EMA with
 *    α = 1/period, seeded the same way); Bollinger bands use the POPULATION
 *    standard deviation; MACD is EMA(fast) − EMA(slow) with an EMA(signal) of
 *    it. A spec in the `node` project holds each one to a known series.
 *
 * ★ A NON-FINITE VALUE BREAKS THE RUN rather than poisoning it. `NaN` would
 *   carry through every later average forever; instead the indicator restarts
 *   its warm-up after the gap, which is what a missing session means.
 */

/** One value per session; `null` while the indicator is warming up. */
export type SvIndicatorSeries = readonly (number | null)[];

/** Bollinger bands: the moving average and the bands `multiplier` deviations either side. */
export interface SvBollingerBands {
  readonly middle: SvIndicatorSeries;
  readonly upper: SvIndicatorSeries;
  readonly lower: SvIndicatorSeries;
}

/** MACD: the line, its signal line, and the difference between them. */
export interface SvMacd {
  readonly macd: SvIndicatorSeries;
  readonly signal: SvIndicatorSeries;
  readonly histogram: SvIndicatorSeries;
}

/** A period must be a whole number of sessions, at least one. */
function checkPeriod(period: number, name: string): number {
  if (!Number.isInteger(period) || period < 1) {
    throw new RangeError(`${name} must be a whole number of sessions, at least 1 — got ${period}`); // sv-i18n-ignore: developer error, thrown to the caller, never rendered
  }
  return period;
}

/**
 * Split a series into runs of consecutive finite values, so a gap restarts the
 * warm-up. Yields `[start, end)` index pairs.
 */
function finiteRuns(values: readonly (number | null)[]): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= values.length; i++) {
    const v = i < values.length ? values[i] : null;
    const ok = typeof v === 'number' && Number.isFinite(v);
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      runs.push([start, i]);
      start = -1;
    }
  }
  return runs;
}

/**
 * Simple moving average: the mean of the last `period` values.
 *
 * Summed incrementally, and re-summed from scratch every `period` steps so the
 * running total's floating-point drift cannot build up over a long history.
 */
export function svSma(values: readonly (number | null)[], period: number): SvIndicatorSeries {
  const n = checkPeriod(period, 'svSma period'); // sv-i18n-ignore: developer error, thrown to the caller, never rendered
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (const [start, end] of finiteRuns(values)) {
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += values[i] as number;
      if (i - start >= n) sum -= values[i - n] as number;
      if (i - start + 1 < n) continue;
      if ((i - start) % n === 0) {
        sum = 0;
        for (let j = i - n + 1; j <= i; j++) sum += values[j] as number;
      }
      out[i] = sum / n;
    }
  }
  return out;
}

/**
 * Exponential moving average with smoothing `alpha`, seeded with the simple
 * average of the first `period` values. Shared by `svEma` (α = 2/(n+1)) and
 * Wilder's smoothing in `svRsi` (α = 1/n).
 */
function smooth(values: readonly (number | null)[], period: number, alpha: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (const [start, end] of finiteRuns(values)) {
    if (end - start < period) continue;
    let seed = 0;
    for (let i = start; i < start + period; i++) seed += values[i] as number;
    let prev = seed / period;
    out[start + period - 1] = prev;
    for (let i = start + period; i < end; i++) {
      prev = prev + alpha * ((values[i] as number) - prev);
      out[i] = prev;
    }
  }
  return out;
}

/** Exponential moving average, α = 2 / (period + 1), seeded with the first SMA. */
export function svEma(values: readonly (number | null)[], period: number): SvIndicatorSeries {
  const n = checkPeriod(period, 'svEma period'); // sv-i18n-ignore: developer error, thrown to the caller, never rendered
  return smooth(values, n, 2 / (n + 1));
}

/**
 * Bollinger bands: an SMA of `period` and the bands `multiplier` POPULATION
 * standard deviations either side — the definition John Bollinger published,
 * and the one every terminal draws.
 */
export function svBollinger(
  values: readonly (number | null)[],
  period = 20,
  multiplier = 2,
): SvBollingerBands {
  const n = checkPeriod(period, 'svBollinger period'); // sv-i18n-ignore: developer error, thrown to the caller, never rendered
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    throw new RangeError(`svBollinger multiplier must be a finite number ≥ 0 — got ${multiplier}`); // sv-i18n-ignore: developer error, thrown to the caller, never rendered
  }
  const middle = svSma(values, n);
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    const mean = middle[i];
    if (mean === null || mean === undefined) continue;
    let sq = 0;
    for (let j = i - n + 1; j <= i; j++) {
      const d = (values[j] as number) - mean;
      sq += d * d;
    }
    const sd = Math.sqrt(sq / n);
    upper[i] = mean + multiplier * sd;
    lower[i] = mean - multiplier * sd;
  }
  return { middle, upper, lower };
}

/**
 * Relative Strength Index, Wilder's method: the average gain and average loss
 * over `period` changes, smoothed with α = 1/period, as `100 − 100 / (1 + RS)`.
 *
 * The first value lands on session `period` — it needs `period` CHANGES, which
 * is `period + 1` closes. A run with no losses reads 100, no gains 0, and a
 * flat run (no movement either way) 50: neither side has any strength.
 */
export function svRsi(values: readonly (number | null)[], period = 14): SvIndicatorSeries {
  const n = checkPeriod(period, 'svRsi period'); // sv-i18n-ignore: developer error, thrown to the caller, never rendered
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (const [start, end] of finiteRuns(values)) {
    if (end - start <= n) continue;
    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = start + 1; i < end; i++) {
      const d = (values[i] as number) - (values[i - 1] as number);
      gains.push(d > 0 ? d : 0);
      losses.push(d < 0 ? -d : 0);
    }
    const avgGain = smooth(gains, n, 1 / n);
    const avgLoss = smooth(losses, n, 1 / n);
    for (let k = n - 1; k < gains.length; k++) {
      const g = avgGain[k] as number;
      const l = avgLoss[k] as number;
      out[start + 1 + k] = g === 0 && l === 0 ? 50 : l === 0 ? 100 : 100 - 100 / (1 + g / l);
    }
  }
  return out;
}

/**
 * MACD: EMA(`fast`) − EMA(`slow`), its EMA(`signal`), and the histogram
 * (MACD − signal). The line starts on session `slow − 1`; the signal and the
 * histogram `signal − 1` sessions after that.
 */
export function svMacd(
  values: readonly (number | null)[],
  fast = 12,
  slow = 26,
  signal = 9,
): SvMacd {
  const f = checkPeriod(fast, 'svMacd fast period'); // sv-i18n-ignore: developer error, thrown to the caller, never rendered
  const s = checkPeriod(slow, 'svMacd slow period'); // sv-i18n-ignore: developer error, thrown to the caller, never rendered
  const g = checkPeriod(signal, 'svMacd signal period'); // sv-i18n-ignore: developer error, thrown to the caller, never rendered
  if (f >= s) throw new RangeError(`svMacd fast period (${f}) must be shorter than the slow one (${s})`); // sv-i18n-ignore: developer error, thrown to the caller, never rendered
  const emaFast = svEma(values, f);
  const emaSlow = svEma(values, s);
  const macd = values.map((_, i) => {
    const a = emaFast[i];
    const b = emaSlow[i];
    return a === null || a === undefined || b === null || b === undefined ? null : a - b;
  });
  const sig = svEma(macd, g);
  const histogram = macd.map((m, i) => {
    const v = sig[i];
    return m === null || v === null || v === undefined ? null : m - v;
  });
  return { macd, signal: sig, histogram };
}
