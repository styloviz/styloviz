import {
  SV_ANOMALY_MIN_SAMPLES,
  SV_ANOMALY_NOTABLE,
  SV_ANOMALY_SEVERE,
  svAnomaly,
  svAnomalyLabel,
  svFormatSigma,
  svNaiveSigma,
  svResolveAnomalyThresholds,
} from './ai-insight-cards.anomaly';

/** A steady series: `count` observations around `centre`, alternating ±1. */
const steady = (centre: number, count = 30): number[] =>
  Array.from({ length: count }, (_, i) => centre + (i % 2 === 0 ? 1 : -1));

describe('measuring how unusual a value is', () => {
  it('calls an ordinary value ordinary', () => {
    const a = svAnomaly(steady(100), 101);
    expect(Math.abs(a.sigma)).toBeLessThan(SV_ANOMALY_NOTABLE);
    expect(a.severity).toBe('none');
  });

  it('reports the baseline it judged against', () => {
    const a = svAnomaly(steady(100), 140);
    expect(a.median).toBe(100);
    expect(a.samples).toBe(30);
    expect(a.spread).toBeGreaterThan(0);
  });

  /**
   * ★★★ THE MEAN AND STANDARD DEVIATION ARE DESTROYED BY THE VERY EVENT THEY
   * ARE MEANT TO CATCH.
   *
   * One ten-fold spike in the window drags the mean up and inflates σ so far
   * that the spike itself scores as unremarkable — the detector is blinded by
   * the anomaly. That is not a rare edge case; it is what happens every time
   * something genuinely goes wrong.
   */
  it('still sees the spike that a mean-and-sigma detector is blinded by', () => {
    // ★ FIVE bad readings, not one — because masking needs more than a single
    // outlier, and a real incident is never a single outlier. An outage lasts
    // hours and lands several observations in the window before anybody looks
    // at the chart, and it is exactly then that the mean and σ have already
    // absorbed it. One stray point does not mask itself; a run of them does,
    // which is why the failure mode bites precisely when it matters.
    const baseline = [...steady(100, 25), 400, 400, 400, 400, 400];

    const robust = svAnomaly(baseline, 380);
    const naive = svNaiveSigma(baseline, 380);

    expect(robust.severity).toBe('severe');
    expect(Math.abs(robust.sigma)).toBeGreaterThan(SV_ANOMALY_SEVERE);
    // The naive figure does not even clear the "worth a look" line: the
    // incident has been folded into what the detector now calls normal.
    expect(Math.abs(naive)).toBeLessThan(SV_ANOMALY_NOTABLE);
  });

  /**
   * ★★ THE SIGN IS NOT DECORATION. A four-sigma DROP in error rate is the
   * deploy working; the same magnitude upward is an incident. An unsigned
   * z-score makes the two indistinguishable on the card meant to say which
   * happened.
   */
  it('distinguishes a collapse from a spike of the same size', () => {
    const spike = svAnomaly(steady(100), 200);
    const collapse = svAnomaly(steady(100), 0);

    expect(spike.sigma).toBeGreaterThan(0);
    expect(collapse.sigma).toBeLessThan(0);
    expect(spike.direction).toBe('above');
    expect(collapse.direction).toBe('below');
    expect(Math.abs(spike.sigma)).toBeCloseTo(Math.abs(collapse.sigma), 5);
  });

  it('reports a value sitting exactly on the baseline as flat', () => {
    const a = svAnomaly(steady(100), 100);
    expect(a.sigma).toBe(0);
    expect(a.direction).toBe('flat');
    expect(a.severity).toBe('none');
  });

  it('escalates from notable to severe', () => {
    const baseline = steady(100);
    const spread = svAnomaly(baseline, 100).spread;

    const notable = svAnomaly(baseline, 100 + spread * (SV_ANOMALY_NOTABLE + 0.5));
    const severe = svAnomaly(baseline, 100 + spread * (SV_ANOMALY_SEVERE + 1));

    expect(notable.severity).toBe('notable');
    expect(severe.severity).toBe('severe');
  });
});

describe('a baseline with no spread', () => {
  /**
   * ★★★ A CONSTANT SERIES HAS ZERO SPREAD, AND EVERY DEVIATION FROM IT IS
   * INFINITE.
   *
   * A metric that has been exactly zero for thirty days and today reports one is
   * a real event and an undefined division. `Infinity` renders as `Infinity` on
   * the card and sorts above every genuine finding, so the flat series has to be
   * answered deliberately rather than fallen into.
   */
  it('does not divide by zero when the metric has never once moved', () => {
    const a = svAnomaly(Array(30).fill(0), 1);

    expect(Number.isFinite(a.sigma)).toBe(true);
    expect(a.severity).toBe('severe');
    expect(a.direction).toBe('above');
  });

  it('reports no anomaly when a flat metric stays flat', () => {
    const a = svAnomaly(Array(30).fill(7), 7);
    expect(a.sigma).toBe(0);
    expect(a.severity).toBe('none');
  });

  it('signs a drop from a flat baseline downward', () => {
    expect(svAnomaly(Array(30).fill(7), 0).sigma).toBeLessThan(0);
  });
});

describe('how much history there is', () => {
  /**
   * ★★★ THREE DATA POINTS CANNOT ESTABLISH WHAT NORMAL IS.
   *
   * Any two numbers have a spread, so the arithmetic always returns something —
   * a confident 6.2σ off a four-day-old metric, which is not a detection but a
   * coincidence with a decimal point. Nothing about the number itself hints that
   * the history behind it is four days long.
   */
  it('claims no severity off a baseline too short to support one', () => {
    const a = svAnomaly([100, 101, 99, 100], 900);

    expect(a.sufficientHistory).toBe(false);
    expect(a.severity).toBe('none');
    // The arithmetic is still reported — it is the CLAIM that is withheld.
    expect(Math.abs(a.sigma)).toBeGreaterThan(SV_ANOMALY_SEVERE);
  });

  /**
   * ★★ A FINDING OFF TOO LITTLE HISTORY IS NOT A MILDER FINDING, IT IS NOT A
   * FINDING. Downgrading severe to notable would put it in the same list as
   * genuine findings, one row lower.
   */
  it('withholds severity entirely rather than downgrading it', () => {
    const short = svAnomaly(steady(100, SV_ANOMALY_MIN_SAMPLES - 1), 10_000);
    expect(short.severity).toBe('none');
  });

  it('starts claiming severity at the history floor', () => {
    const enough = svAnomaly(steady(100, SV_ANOMALY_MIN_SAMPLES), 10_000);
    expect(enough.sufficientHistory).toBe(true);
    expect(enough.severity).toBe('severe');
  });

  it('survives an empty baseline without producing NaN', () => {
    const a = svAnomaly([], 42);
    expect(Number.isFinite(a.sigma)).toBe(true);
    expect(a.samples).toBe(0);
    expect(a.severity).toBe('none');
  });

  /**
   * ★★ A GAP IN THE SERIES IS NOT A ZERO. A missing reading arriving as `null`
   * or `NaN` and counted as an observation both shortens the effective history
   * and drags the baseline toward zero.
   */
  it('ignores missing readings rather than treating them as zero', () => {
    const withGaps = [...steady(100, 20), Number.NaN, Number.NaN];
    const a = svAnomaly(withGaps, 100);

    expect(a.samples).toBe(20);
    expect(a.median).toBe(100);
  });
});

describe('saying it in words', () => {
  it('signs the sigma figure', () => {
    expect(svFormatSigma(4.23)).toBe('+4.2σ');
    expect(svFormatSigma(-3.14)).toBe('−3.1σ');
    expect(svFormatSigma(0)).toBe('0.0σ');
  });

  /**
   * ★★ THE LABEL SAYS THE BASELINE OUT LOUD. "3.4σ above normal" is meaningless
   * without what normal was and how long it was measured over — and those two
   * facts are exactly what a reader needs to decide whether to believe the card.
   */
  it('names the baseline and the sample count, not just the deviation', () => {
    const label = svAnomalyLabel(svAnomaly(steady(100), 200));
    expect(label).toContain('100');
    expect(label).toContain('30 observations');
  });

  it('says why no severity is claimed when the history is short', () => {
    const label = svAnomalyLabel(svAnomaly([1, 2, 3], 900));
    expect(label).toContain('no baseline');
    expect(label).toContain('3 observations');
  });
});

/**
 * ============================================================================
 *  Host-configurable thresholds (`X-3`, `AI-03-I4`)
 * ============================================================================
 *
 * ★★★ THE DEFAULTS ARE A POLICY ABOUT SOMEBODY ELSE'S DOMAIN. Fourteen
 *     observations, 3σ and 5σ are reasonable for a daily business metric and
 *     wrong nearly everywhere else — a fortnight of hourly data is 336
 *     observations, a fortnight of monthly data is not a baseline at all, and a
 *     seasonal series needs a season. They stay as defaults, and stay exported,
 *     but a host can now say what its own domain means.
 */
describe('thresholds a host can move', () => {
  it('judges history against the floor it was given', () => {
    const series = steady(100, 20);

    // Default floor is 14, so twenty observations is enough…
    expect(svAnomaly(series, 900).sufficientHistory).toBe(true);
    // …and a host measuring hourly can say that it is not.
    expect(svAnomaly(series, 900, { minSamples: 336 }).sufficientHistory).toBe(false);
    expect(svAnomaly(series, 900, { minSamples: 336 }).severity).toBe('none');
  });

  it('moves the severity lines with the sigma thresholds', () => {
    const a = svAnomaly(steady(100, 30), 104, { notable: 1, severe: 2 });
    expect(a.severity).toBe('severe');

    const b = svAnomaly(steady(100, 30), 104, { notable: 50, severe: 99 });
    expect(b.severity).toBe('none');
  });

  it('caps a zero-spread series at the severe line IN FORCE', () => {
    // ★ A metric that has never moved and moved today is reported at the top of
    //   whatever scale the host set, not at the module's 5.
    const flat = Array.from({ length: 30 }, () => 7);
    expect(svAnomaly(flat, 8, { severe: 12 }).sigma).toBe(12);
    expect(svAnomaly(flat, 6, { severe: 12 }).sigma).toBe(-12);
  });

  it('carries the floor it applied, so the wording cannot contradict the verdict', () => {
    // ★★★ THIS IS WHY THE FLOOR IS ON THE FINDING. The sentence says "under N
    //     there is no baseline"; with the number read from the module constant
    //     it would have stated 14 while the verdict came from 336.
    const a = svAnomaly(steady(100, 20), 900, { minSamples: 336 });
    expect(a.minSamples).toBe(336);
    expect(svAnomalyLabel(a)).toContain('under 336');
    expect(svAnomalyLabel(a)).not.toContain('under 14');
  });

  it('falls back to the default for a figure that is not a threshold', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const t = svResolveAnomalyThresholds({ minSamples: bad, notable: bad, severe: bad });
      expect(t).toEqual({
        minSamples: SV_ANOMALY_MIN_SAMPLES,
        notable: SV_ANOMALY_NOTABLE,
        severe: SV_ANOMALY_SEVERE,
      });
    }
  });

  it('refuses a scale that reads backwards', () => {
    // ★★ With severe BELOW notable, everything past the notable line is also
    //    past the severe one: the middle band disappears and every finding is
    //    reported as severe while the legend still offers three. Clamping the
    //    two together is a policy someone could mean; the inversion is not.
    const t = svResolveAnomalyThresholds({ notable: 4, severe: 2 });
    expect(t.notable).toBe(4);
    expect(t.severe).toBe(4);

    const a = svAnomaly(steady(100, 30), 103, { notable: 4, severe: 2 });
    expect(a.severity).toBe('none');
  });

  it('leaves the default trio alone when asked for nothing', () => {
    expect(svResolveAnomalyThresholds()).toEqual({
      minSamples: SV_ANOMALY_MIN_SAMPLES,
      notable: SV_ANOMALY_NOTABLE,
      severe: SV_ANOMALY_SEVERE,
    });
    expect(svAnomaly(steady(100, 30), 101).minSamples).toBe(SV_ANOMALY_MIN_SAMPLES);
  });
});
