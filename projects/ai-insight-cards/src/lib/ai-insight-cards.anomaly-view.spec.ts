import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core';
import { SvAiInsightCardsComponent } from './ai-insight-cards.component';
import { SV_ANOMALY_MIN_SAMPLES } from './ai-insight-cards.anomaly';
import type { AiInsight, SvInsightBaseline } from './ai-insight-cards.types';

/**
 * The anomaly variant, through the component.
 *
 * The deviation arithmetic has its own spec in `ai-insight-cards.anomaly.spec.ts`.
 * This file is about what reaches the DOM.
 */

const steady = (centre: number, count = 30): number[] =>
  Array.from({ length: count }, (_, i) => centre + (i % 2 === 0 ? 1 : -1));

function baseline(metric: string, series: readonly number[], current: number, extra: Partial<SvInsightBaseline> = {}): SvInsightBaseline {
  return { metric, series, current, ...extra };
}

async function cards(baselines: readonly SvInsightBaseline[], insights: readonly AiInsight[] = []) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAiInsightCardsComponent, {
    inputs: { variant: 'anomaly', baselines, insights },
  });
  fixture.detectChanges();
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

const q = (f: { nativeElement: HTMLElement }, sel: string) => f.nativeElement.querySelector(sel);
const all = (f: { nativeElement: HTMLElement }, sel: string) =>
  Array.from(f.nativeElement.querySelectorAll<HTMLElement>(sel));
const text = (el: Element | null | undefined) => el?.textContent?.trim() ?? '';
const rowFor = (f: { nativeElement: HTMLElement }, metric: string) =>
  f.nativeElement.querySelector<HTMLElement>(`[data-sv-anomaly-row="${metric}"]`)!;

describe('SvAiInsightCardsComponent — the anomaly variant', () => {
  it('draws a row per baseline with its deviation', async () => {
    const f = await cards([
      baseline('Checkout errors', steady(100), 400),
      baseline('Signups', steady(50), 51),
    ]);

    expect(all(f, '[data-sv-anomaly-row]')).toHaveLength(2);
    expect(text(rowFor(f, 'Checkout errors').querySelector('[data-sv-anomaly-sigma]'))).toContain('+');
    expect(rowFor(f, 'Signups').getAttribute('data-sv-anomaly-severity')).toBe('none');
  });

  /**
   * ★★ THE BASELINE IS ON THE PAGE. "3.4σ above normal" is meaningless without
   * what normal was and how long it was measured over — and those are the two
   * facts that decide whether the reader believes the card.
   */
  it('shows what normal was and how long it was measured over', async () => {
    const f = await cards([baseline('Latency', steady(200), 900, { unit: 'ms' })]);
    const text0 = text(q(f, '[data-sv-anomaly-baseline]'));

    expect(text0).toContain('now 900ms');
    expect(text0).toContain('typically 200ms');
    expect(text0).toContain('30 obs');
  });

  /**
   * ★★ THE SIGN IS NOT DECORATION. A four-sigma drop in errors is the deploy
   * working; the same magnitude upward is an incident.
   */
  it('distinguishes a collapse from a spike', async () => {
    const f = await cards([
      baseline('Errors up', steady(100), 400),
      baseline('Errors down', steady(100), 0),
    ]);

    expect(text(rowFor(f, 'Errors up').querySelector('[data-sv-anomaly-sigma]'))).toMatch(/^\+/);
    expect(text(rowFor(f, 'Errors down').querySelector('[data-sv-anomaly-sigma]'))).toMatch(/^−/);
  });

  /**
   * ★★★ THREE DATA POINTS CANNOT ESTABLISH WHAT NORMAL IS, and the arithmetic
   * gives no hint of it — a confident 40σ off four days of data is the most
   * eye-catching thing on the page and the least worth reading.
   */
  it('claims no severity off a short history, and says why', async () => {
    const f = await cards([baseline('New metric', [100, 101, 99, 100], 9_000)]);
    const row = rowFor(f, 'New metric');

    expect(row.getAttribute('data-sv-anomaly-severity')).toBe('none');
    expect(text(row.querySelector('[data-sv-anomaly-short-history]'))).toContain('no baseline');
    expect(text(row.querySelector('[data-sv-anomaly-short-history]'))).toContain(
      String(SV_ANOMALY_MIN_SAMPLES),
    );
  });

  /**
   * ★★ A ROW OFF TOO LITTLE HISTORY SINKS TO THE BOTTOM WHATEVER ITS SIGMA. It
   * is not a milder finding, it is not a finding, and at the top of a list
   * sorted by magnitude it outranks every real one.
   */
  it('does not let an unsupported row outrank a real finding', async () => {
    const f = await cards([
      baseline('Unsupported', [1, 2], 100_000),
      baseline('Real', steady(100), 400),
    ]);

    const order = all(f, '[data-sv-anomaly-row]').map((n) => n.getAttribute('data-sv-anomaly-row'));
    expect(order).toEqual(['Real', 'Unsupported']);
  });

  /**
   * ★★★ THE NAIVE FIGURE IS SHOWN ONLY TO BE CONTRADICTED. An outage lands
   * several bad readings in the window, which drag the mean up and inflate σ
   * until today's reading scores as unremarkable — the detector is blinded by
   * the very event it exists to catch.
   */
  it('says which findings a mean-and-sigma detector would have missed', async () => {
    const masked = [...steady(100, 25), 400, 400, 400, 400, 400];
    const f = await cards([baseline('Checkout errors', masked, 380)]);

    expect(rowFor(f, 'Checkout errors').getAttribute('data-sv-anomaly-severity')).toBe('severe');
    expect(text(q(f, '[data-sv-anomaly-masked]'))).toContain('under 3σ');
  });

  it('says nothing about masking when the two detectors agree', async () => {
    const f = await cards([baseline('Clean spike', steady(100), 400)]);
    expect(q(f, '[data-sv-anomaly-masked]')).toBeNull();
  });

  /**
   * ★★★ A CONSTANT SERIES HAS ZERO SPREAD, AND `Infinity` RENDERS AS `Infinity`
   * — sorting above every genuine finding and reading as a rendering fault.
   */
  it('renders a real number for a metric that has never once moved', async () => {
    const f = await cards([baseline('Always zero', Array(30).fill(0), 1)]);
    const sigma = text(q(f, '[data-sv-anomaly-sigma]'));

    expect(sigma).not.toContain('Infinity');
    expect(sigma).not.toContain('NaN');
    expect(rowFor(f, 'Always zero').getAttribute('data-sv-anomaly-severity')).toBe('severe');
  });

  it('joins a baseline to the insight that narrates it', async () => {
    const insight: AiInsight = {
      id: 'i1',
      title: 'Checkout errors climbing',
      description: 'Errors rose sharply after the 14:20 deploy.',
      category: 'anomaly',
      priority: 'critical',
      confidence: 91,
      detectedAt: new Date(0),
      source: 'monitoring',
      dataPoints: [],
      status: 'new',
    };
    const f = await cards([baseline('Checkout errors', steady(100), 400, { insightId: 'i1' })], [insight]);

    expect(text(q(f, '[data-sv-anomaly-insight]'))).toContain('after the 14:20 deploy');
  });

  it('says the metric, the reading and the baseline out loud', async () => {
    const f = await cards([baseline('Latency', steady(200), 900, { unit: 'ms' })]);
    const label = rowFor(f, 'Latency').getAttribute('aria-label') ?? '';

    expect(label).toContain('Latency');
    expect(label).toContain('900ms');
    expect(label).toContain('30 observations');
  });

  it('draws an empty state rather than a list of nothing', async () => {
    const f = await cards([]);
    expect(all(f, '[data-sv-anomaly-row]')).toHaveLength(0);
    expect(text(q(f, '[data-sv-anomaly-empty]'))).toContain('No baselines');
  });
});

/**
 * ============================================================================
 *  The thresholds as component inputs (`X-3`, `AI-03-I4`)
 * ============================================================================
 */
async function tuned(extra: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAiInsightCardsComponent, {
    inputs: {
      variant: 'anomaly',
      baselines: [baseline('Signups', steady(100, 20), 900)],
      insights: [],
      ...extra,
    },
  });
  fixture.detectChanges();
  return fixture;
}

describe('SvAiInsightCardsComponent — anomaly thresholds a host can move', () => {
  it('judges history against the floor the host set, and says that number', async () => {
    const f = await tuned({ anomalyMinSamples: 336 });
    const row = rowFor(f, 'Signups');

    expect(row.getAttribute('data-sv-anomaly-severity')).toBe('none');
    expect(f.nativeElement.textContent).toContain('under 336');
    expect(f.nativeElement.textContent).not.toContain('under 14');
  });

  it('keeps the documented default when the host says nothing', async () => {
    const f = await tuned({});
    expect(f.componentInstance.anomalyMinSamples()).toBe(SV_ANOMALY_MIN_SAMPLES);
    // Twenty observations clears the default floor of fourteen, so the finding
    // is claimed rather than withheld.
    expect(rowFor(f, 'Signups').getAttribute('data-sv-anomaly-severity')).toBe('severe');
  });

  it('moves the severity bands with the sigma inputs', async () => {
    // ★ A steady 100 with a MAD-derived spread of ~1.5 puts 900 at ~540σ, so
    //   the bands have to move a long way to reclassify it — which is the
    //   point: the arithmetic is unchanged and only the LINES are the host's.
    const f = await tuned({ anomalyNotable: 600, anomalySevere: 900 });
    expect(rowFor(f, 'Signups').getAttribute('data-sv-anomaly-severity')).toBe('none');
  });

  it('warns once when the host inverts the sigma scale, and applies a monotone one', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    svResetWarnOnce();

    const f = await tuned({ anomalyNotable: 4, anomalySevere: 2 });
    const ours = warn.mock.calls.map(a => String(a[0])).filter(m => m.startsWith('[styloviz]'));

    expect(ours).toHaveLength(1);
    expect(ours[0]).toContain('anomalySevere');
    // And the scale it settled on is monotone: 900 against a steady 100 is far
    // past 4σ, so it is severe — not "notable and severe at once".
    expect(rowFor(f, 'Signups').getAttribute('data-sv-anomaly-severity')).toBe('severe');
    warn.mockRestore();
  });

  /**
   * ★★ THE MASKING NOTE QUOTES THE HOST'S LINE, AND JUDGES BY IT. The naive
   *    figure for this series is ~2.1σ: under a 2.5σ line it was missed, under
   *    a 2σ line it was not — and neither sentence may say the module's 3.
   */
  it('holds the naive detector to the host notable line, and quotes it', async () => {
    const masked = [...steady(100, 25), 400, 400, 400, 400, 400];

    const missed = await tuned({ anomalyNotable: 2.5, baselines: [baseline('Checkout errors', masked, 380)] });
    const note = text(q(missed, '[data-sv-anomaly-masked]'));
    expect(note).toContain('under 2.5σ');
    expect(note).not.toContain('under 3σ');

    const caught = await tuned({ anomalyNotable: 2, baselines: [baseline('Checkout errors', masked, 380)] });
    expect(rowFor(caught, 'Checkout errors').getAttribute('data-sv-anomaly-severity')).toBe('severe');
    expect(q(caught, '[data-sv-anomaly-masked]')).toBeNull();
  });

  it('says nothing when the scale is the right way round', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    svResetWarnOnce();

    await tuned({ anomalyNotable: 2, anomalySevere: 4 });

    expect(warn.mock.calls.map(a => String(a[0])).filter(m => m.startsWith('[styloviz]'))).toEqual([]);
    warn.mockRestore();
  });
});
