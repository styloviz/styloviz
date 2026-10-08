/**
 * `sv-ai-insight-cards` — how far from normal, and is "normal" even known.
 *
 * ★★★ AN INSIGHT FEED WITHOUT A BASELINE IS A LIST OF OPINIONS.
 *
 * The four existing variants present insights that something else decided were
 * insights. A card says "Checkout errors are up" with a confidence of 87 %, and
 * nothing anywhere says up FROM WHAT, by how much against the ordinary swing of
 * that metric, or whether there is enough history behind the claim to support
 * it. The reader is asked to trust a percentage whose provenance is not shown.
 *
 * This variant shows the arithmetic. All of it is over a series the host
 * already has.
 */

export type SvAnomalySeverity = 'none' | 'notable' | 'severe';

export interface SvAnomaly {
  /** The observed value being judged. */
  readonly value: number;
  /** Robust centre of the baseline. */
  readonly median: number;
  /**
   * Median absolute deviation, scaled to be comparable with a standard
   * deviation on normally-distributed data.
   */
  readonly spread: number;
  /**
   * Signed deviation in units of `spread`.
   *
   * ★★ THE SIGN IS NOT DECORATION. A four-sigma DROP in error rate is the
   * deploy working; the same magnitude upward is an incident. Reporting the
   * magnitude alone — which is what an unsigned z-score does — makes the two
   * indistinguishable on the card that is supposed to tell you which one
   * happened.
   */
  readonly sigma: number;
  readonly direction: 'above' | 'below' | 'flat';
  readonly severity: SvAnomalySeverity;
  /**
   * False when the baseline is too short to support a claim.
   *
   * ★★★ THREE DATA POINTS CANNOT ESTABLISH WHAT NORMAL IS. Any two numbers have
   * a spread, so the arithmetic always returns something — a confident 6.2σ off
   * a four-day-old metric, which is not a detection, it is a coincidence with a
   * decimal point. The flag exists because the number alone gives no hint that
   * the history behind it is four days long.
   */
  readonly sufficientHistory: boolean;
  /** How many observations the baseline was computed from. */
  readonly samples: number;
  /**
   * The history floor this finding was judged against.
   *
   * ★★★ IT TRAVELS WITH THE FINDING, AND THAT IS THE POINT (`X-3`). The label
   *     has to say "under 14 there is no baseline" — and the moment the floor
   *     became configurable, a label reading the module constant while the
   *     verdict was computed from a host's 30 would state a number that had
   *     nothing to do with the decision it was explaining. Carrying it makes
   *     the two impossible to separate.
   */
  readonly minSamples: number;
}

/**
 * Host overrides for the three lines above (`X-3`).
 *
 * ★★ THE DEFAULTS ARE POLICY, NOT ARITHMETIC. 14 observations, 3σ and 5σ are
 *    reasonable for a daily business metric and wrong for a seasonal one, for a
 *    weekly cohort, and for anything sampled by the minute — a fortnight of
 *    hourly data is 336 observations, and a fortnight of monthly data is not a
 *    baseline at all. A well-reasoned constant is still a guess about someone
 *    else's domain, so it is a default rather than a rule.
 */
export interface SvAnomalyThresholds {
  /** Minimum observations before any severity is claimed. @default 14 */
  readonly minSamples?: number;
  /** Sigma at which a finding is worth a look. @default 3 */
  readonly notable?: number;
  /** Sigma at which it is worth waking somebody. @default 5 */
  readonly severe?: number;
}

/** Every threshold resolved to a usable number. */
export interface SvResolvedAnomalyThresholds {
  readonly minSamples: number;
  readonly notable: number;
  readonly severe: number;
}

/** Below this many observations there is no baseline worth the name. */
export const SV_ANOMALY_MIN_SAMPLES = 14;

/** At or beyond this many sigma, worth a look. */
export const SV_ANOMALY_NOTABLE = 3;

/** At or beyond this, worth waking somebody. */
export const SV_ANOMALY_SEVERE = 5;

/**
 * Fill the gaps, and refuse the combinations that would invert the scale.
 *
 * ★★ A NON-MONOTONE PAIR IS WORSE THAN A WRONG NUMBER. With `severe` below
 *    `notable`, every finding past the notable line is also past the severe one
 *    and the middle band disappears — the component would report everything as
 *    severe while still rendering a "notable" legend. `severe` is therefore
 *    clamped up to `notable`: the two lines coincide, which is a policy someone
 *    could actually mean, instead of a scale that reads backwards.
 *
 * ★ A non-finite or non-positive figure falls back to the default rather than
 *   being clamped to something near it. `0` sigma is not a threshold, and a
 *   `NaN` from a host's own arithmetic must not silently become one.
 */
export function svResolveAnomalyThresholds(
  thresholds?: SvAnomalyThresholds,
): SvResolvedAnomalyThresholds {
  const positive = (value: number | undefined, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

  const minSamples = positive(thresholds?.minSamples, SV_ANOMALY_MIN_SAMPLES);
  const notable = positive(thresholds?.notable, SV_ANOMALY_NOTABLE);
  const severe = Math.max(positive(thresholds?.severe, SV_ANOMALY_SEVERE), notable);
  return { minSamples, notable, severe };
}

/**
 * Scale factor turning a median absolute deviation into a standard-deviation
 * equivalent for normally-distributed data.
 *
 * It exists so the sigma figure means the familiar thing — 3σ is the usual
 * "worth a look" line — while being computed the robust way.
 */
const MAD_TO_SIGMA = 1.4826;

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * How unusual `value` is, against the series' own recent history.
 *
 * ★★★ A FIXED THRESHOLD IS NOT A DETECTOR. "Alert when errors exceed 100" fires
 * every Monday on a metric that is always high on Mondays, and never fires at
 * all on a service whose ordinary volume is four. Every threshold is either
 * noisy or deaf, and which one it is changes as the business grows — so it
 * needs re-tuning forever and nobody ever does. A deviation measured against the
 * metric's own spread adapts by construction.
 *
 * ★★★ AND THE MEAN AND STANDARD DEVIATION ARE DESTROYED BY THE VERY EVENT THEY
 * ARE MEANT TO CATCH. One ten-fold spike in a thirty-day window drags the mean
 * up and inflates σ so far that the spike itself scores under two sigma: the
 * detector is blinded by the anomaly. That is not a rare edge case, it is what
 * happens EVERY time something genuinely goes wrong. The median and the median
 * absolute deviation are unmoved by a handful of extreme points, which is the
 * entire reason to compute them the slower way.
 */
export function svAnomaly(
  baseline: readonly number[],
  value: number,
  thresholds?: SvAnomalyThresholds,
): SvAnomaly {
  const { minSamples, notable, severe } = svResolveAnomalyThresholds(thresholds);
  const clean = baseline.filter((n) => Number.isFinite(n));
  const centre = median(clean);
  const mad = median(clean.map((n) => Math.abs(n - centre)));
  const spread = mad * MAD_TO_SIGMA;

  // ★★★ A CONSTANT SERIES HAS ZERO SPREAD, AND EVERY DEVIATION FROM IT IS
  // INFINITE. A metric that has been exactly zero for thirty days and today
  // reports one is a real event and an undefined division — `Infinity` sigma
  // renders as `Infinity` on the card and sorts above every genuine finding.
  // A change in a metric that has never once moved IS notable, so it is
  // reported as such rather than as nothing, but it is capped at the severe
  // line instead of running away.
  let sigma: number;
  if (spread <= 0) {
    const moved = value !== centre;
    // ★ Capped at the SEVERE line in force, not at the module's — a host that
    //   moved the line moved where "as bad as it gets" is.
    sigma = moved ? Math.sign(value - centre) * severe : 0;
  } else {
    sigma = (value - centre) / spread;
  }

  const magnitude = Math.abs(sigma);
  const sufficientHistory = clean.length >= minSamples;

  return {
    value,
    median: centre,
    spread,
    sigma,
    direction: value > centre ? 'above' : value < centre ? 'below' : 'flat',
    // ★★ A finding off too little history is not a milder finding, it is not a
    // finding — so severity is withheld entirely rather than downgraded.
    severity: !sufficientHistory
      ? 'none'
      : magnitude >= severe
        ? 'severe'
        : magnitude >= notable
          ? 'notable'
          : 'none',
    sufficientHistory,
    samples: clean.length,
    minSamples,
  };
}

/**
 * The mean-and-standard-deviation answer, for comparison only.
 *
 * ★★★ EXPORTED SO THE DIFFERENCE CAN BE SHOWN, NOT SO IT CAN BE USED. Putting
 * the naive figure beside the robust one is the fastest way to make the point
 * that the naive one is blind: on a series with a genuine spike in it, this
 * reports the spike as unremarkable while `svAnomaly` reports it at eight sigma.
 * A reader who has seen those two numbers side by side does not go back to
 * thresholds.
 */
export function svNaiveSigma(baseline: readonly number[], value: number): number {
  const clean = baseline.filter((n) => Number.isFinite(n));
  if (clean.length === 0) return 0;
  const mean = clean.reduce((s, n) => s + n, 0) / clean.length;
  const variance = clean.reduce((s, n) => s + (n - mean) ** 2, 0) / clean.length;
  const sd = Math.sqrt(variance);
  return sd > 0 ? (value - mean) / sd : 0;
}

/** `+4.2σ` / `−3.1σ`. */
export function svFormatSigma(sigma: number): string {
  if (!Number.isFinite(sigma)) return '—';
  const sign = sigma > 0 ? '+' : sigma < 0 ? '−' : '';
  return `${sign}${Math.abs(sigma).toFixed(1)}σ`;
}

/**
 * The finding in words.
 *
 * ★★ IT SAYS THE BASELINE OUT LOUD. "3.4σ above normal" is meaningless without
 * what normal was and how long it was measured over — and those two facts are
 * exactly what a reader needs to decide whether to believe the card.
 */
export function svAnomalyLabel(anomaly: SvAnomaly): string {
  if (!anomaly.sufficientHistory) {
    return `Only ${anomaly.samples} observation${anomaly.samples === 1 ? '' : 's'} of history — under ${anomaly.minSamples} there is no baseline to judge this against, so no severity is claimed.`;
  }
  if (anomaly.severity === 'none') {
    return `Within the ordinary swing of this metric (typically ${anomaly.median}, ±${anomaly.spread.toFixed(1)} over ${anomaly.samples} observations).`;
  }
  const way = anomaly.direction === 'above' ? 'above' : 'below';
  return `${svFormatSigma(anomaly.sigma)} ${way} a typical ${anomaly.median}, measured over ${anomaly.samples} observations.`;
}
