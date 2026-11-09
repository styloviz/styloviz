/**
 * nice-scale.ts — a numeric axis rounded out to numbers a person would have written.
 *
 * Every chart whose axis is NOT zero-based needs this, and there are several: a box
 * plot of response times between 180 ms and 240 ms zero-based is a flat smear at the
 * top of the plot, and a scatter plot has no category list to fall back on at all —
 * both of its axes are `(v - min) / (max - min)` over whatever the host sent.
 *
 * It lives in core rather than beside either of them because it was written twice
 * with two different rounding ladders, and two charts in the same kit that disagree
 * about where a tick belongs is a bug the reader sees.
 */

/** A rounded axis: the drawn ends, the tick step, and the ticks themselves. */
export interface SvNiceScale {
  /** Lower end of the DRAWN axis, at or below the data minimum. */
  readonly min: number;
  /** Upper end of the DRAWN axis, at or above the data maximum. */
  readonly max: number;
  /** Spacing between ticks. Always above zero. */
  readonly step: number;
  /** Tick values from `min` to `max` inclusive. Never fewer than two. */
  readonly ticks: readonly number[];
}

/**
 * Round a data range out to human tick values.
 *
 * Both ends are rounded outward to a 1 / 2 / 2.5 / 5 / 10 × 10ⁿ step, rather than
 * only the top as a zero-based `niceMax()` does, so the axis fits the data instead
 * of the data being pushed against one edge of it.
 *
 * A degenerate range — every sample identical, or a single point — is widened by a
 * step rather than divided through: a zero span makes every position `NaN`, and an
 * SVG coordinate of `NaN` is dropped in silence, so the whole plot comes out blank
 * with nothing in the console to say why.
 */
export function svNiceScale(min: number, max: number, tickCount = 5): SvNiceScale {
  const a = Number.isFinite(min) ? min : 0;
  const b = Number.isFinite(max) ? max : 1;
  // Sorted rather than trusted: a caller handing over a reversed range means the
  // range, and treating it as degenerate would silently drop half the data
  // off-axis.
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const want = Number.isFinite(tickCount) ? Math.max(2, Math.floor(tickCount)) : 5;

  if (hi <= lo) {
    const step = Math.abs(lo) > 0 ? Math.abs(lo) / 4 : 1;
    return { min: lo - step, max: lo + step, step, ticks: [lo - step, lo, lo + step] };
  }

  const rawStep = (hi - lo) / want;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = niceMultiple(rawStep / magnitude) * magnitude;

  // Snap the quotient before rounding it. `1.1 / 0.1` is 11.000000000000002 in
  // IEEE-754, so a bare `Math.ceil` adds a whole spurious step — an axis that ends
  // one tick above the data for no reason the reader can see.
  const QUOTIENT_EPS = 1e-9;
  const niceMin = round12(Math.floor(lo / step + QUOTIENT_EPS) * step);
  const niceMax = round12(Math.ceil(hi / step - QUOTIENT_EPS) * step);
  const count = Math.max(1, Math.round((niceMax - niceMin) / step));

  return {
    min: niceMin,
    max: niceMax,
    step,
    // Re-derived from the index rather than accumulating `+= step`, which drifts on
    // decimal steps (0.1 + 0.1 + 0.1 = 0.30000000000000004) — and a tick is where
    // that drift becomes a LABEL the reader can see.
    ticks: Array.from({ length: count + 1 }, (_, i) => round12(niceMin + i * step)),
  };
}

/**
 * Snap a mantissa up to the next rung of the 1 / 2 / 2.5 / 5 / 10 ladder.
 *
 * 2.5 is on the ladder because without it a mantissa just past 2 jumps straight to
 * 5, which halves the grid: a range wanting a step of 2,200 got 5,000 and came back
 * with three ticks where six were asked for.
 *
 * The ladder rounds UP rather than to the nearest rung, so the tick count is a
 * ceiling on what was asked for rather than an approximation of it — a request for
 * five ticks never comes back with nine.
 */
function niceMultiple(normalized: number): number {
  if (normalized <= 1) return 1;
  if (normalized <= 2) return 2;
  if (normalized <= 2.5) return 2.5;
  if (normalized <= 5) return 5;
  return 10;
}

/** Trim the float tail off a computed tick without disturbing its value. */
function round12(value: number): number {
  return Number(value.toFixed(12));
}

/**
 * Label one tick, given the step the axis is walking in.
 *
 * ★★★ Compacting each value on its own is the obvious version and it silently
 *     destroys an axis: `2014` becomes `2.0k`, and so do 2016, 2018, 2020 and 2022.
 *     A year axis therefore printed the SAME string on all six ticks — no more use
 *     than one labelled with numbers from a different chart.
 *
 * The STEP decides the unit, so every tick on an axis is scaled the same way and the
 * labels can be read against each other; a step below a thousand is never compacted,
 * which is what keeps a year a year. The number of decimals comes from the step too,
 * so a 2.5 step keeps the `.5` that tells its ticks apart and a 20,000 step does not
 * carry a `.0` that says nothing.
 */
export function svTickLabel(value: number, step: number): string {
  if (!Number.isFinite(value)) return '';
  // Zero is zero in every unit, and `0k` reads as a rounding error.
  if (value === 0) return '0';

  // The cuts sit half a unit below the unit itself: 250,000 reads better as `250k`
  // than as `0.25M`, and 500,000 better as `0.5M` than as `500k`.
  const scale = Number.isFinite(step) && step > 0 ? step : Math.abs(value);
  if (scale >= 500_000) {
    return `${(value / 1_000_000).toFixed(decimalsFor(scale / 1_000_000))}M`;
  }
  if (scale >= 1_000) {
    return `${(value / 1_000).toFixed(decimalsFor(scale / 1_000))}k`;
  }
  return value.toFixed(decimalsFor(scale));
}

/**
 * How many decimals a step needs to stay distinguishable from the next one.
 *
 * A whole step needs none. Below one it needs as many as its magnitude implies, plus
 * one more for the 2.5 rung — the only step on the ladder whose own value carries a
 * decimal.
 */
function decimalsFor(step: number): number {
  if (!Number.isFinite(step) || step <= 0 || Number.isInteger(step)) return 0;
  const exponent = Math.floor(Math.log10(step));
  const mantissa = step / Math.pow(10, exponent);
  const extra = Math.abs(mantissa - 2.5) < 1e-9 ? 1 : 0;
  return Math.min(8, Math.max(0, -exponent + extra));
}
