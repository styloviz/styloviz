import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAiInsightCardsComponent, DEMO_INSIGHTS } from './ai-insight-cards.component';
import {
  svInsightConfidenceLabel,
  svInsightEvidence,
  svInsightIsAttributed,
  svSampleCount,
  svSampleLabel,
} from './ai-insight-cards.evidence';
import type { AiInsight } from './ai-insight-cards.types';

/**
 * ============================================================================
 *  `AI-03-M1` (evidence and provenance) · `AI-03-I2` (demo vs production)
 * ============================================================================
 *
 * This component renders claims about somebody's business in confident prose,
 * with a percentage beside them. What separates that from a sentence a model
 * invented is somewhere to go and check.
 */

const insight = (over: Partial<AiInsight> = {}): AiInsight => ({
  id: 'i1',
  title: 'Churn risk',
  description: 'Twelve accounts look shaky.',
  category: 'churn',
  priority: 'critical',
  confidence: 87,
  detectedAt: new Date(),
  source: 'Churn Predictor',
  dataPoints: [],
  status: 'new',
  ...over,
});

async function cards(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAiInsightCardsComponent, { inputs });
  fixture.detectChanges();
  return fixture;
}

afterEach(() => TestBed.resetTestingModule());

const q = (f: { nativeElement: HTMLElement }, sel: string) => f.nativeElement.querySelector(sel);
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

// ── Evidence ────────────────────────────────────────────────────────────────

describe('svInsightEvidence', () => {
  it('calls an insight with no link what it is', () => {
    // A required field would be satisfied by '' and buy nothing the reader can
    // see. This cannot be satisfied by typing quotes.
    const e = svInsightEvidence(insight());
    expect(e.href).toBeNull();
    expect(e.checkable).toBe(false);
    expect(e.label).toContain('assertion, not a finding');
  });

  it('treats a blank link as no link', () => {
    expect(svInsightEvidence(insight({ evidenceUrl: '   ' })).checkable).toBe(false);
  });

  it('links an http(s) address', () => {
    const e = svInsightEvidence(insight({ evidenceUrl: 'https://metrics.test/churn?since=14d' }));
    expect(e.href).toBe('https://metrics.test/churn?since=14d');
    expect(e.checkable).toBe(true);
  });

  it('refuses a scheme rather than rendering a dead link', () => {
    // Angular would turn `javascript:` into an `unsafe:` href — a link that does
    // nothing, teaching the reader that evidence links do not work rather than
    // that this one is wrong.
    const e = svInsightEvidence(insight({ evidenceUrl: 'javascript:alert(1)' }));
    expect(e.href).toBeNull();
    expect(e.label).toContain('javascript:');
  });

  it('refuses a relative address, which this component cannot resolve', () => {
    expect(svInsightEvidence(insight({ evidenceUrl: '/dashboards/churn' })).href).toBeNull();
  });
});

// ── Confidence provenance ───────────────────────────────────────────────────

describe('svInsightConfidenceLabel', () => {
  it('admits when nothing was recorded', () => {
    expect(svInsightConfidenceLabel(insight())).toBe('87% — no method or model recorded');
  });

  it('names the method alone', () => {
    expect(svInsightConfidenceLabel(insight({ confidenceBasis: 'z-score vs 30d' }))).toBe(
      '87% — z-score vs 30d',
    );
  });

  it('names the model alone, and says the method is missing', () => {
    expect(svInsightConfidenceLabel(insight({ model: 'churn', modelVersion: 'v3.2' }))).toBe(
      '87% — from churn v3.2, method not recorded',
    );
  });

  it('names both when both are there', () => {
    const label = svInsightConfidenceLabel(
      insight({ confidenceBasis: 'z-score vs 30d', model: 'churn', modelVersion: 'v3.2' }),
    );
    expect(label).toBe('87% — z-score vs 30d, from churn v3.2');
  });

  it('never hides the figure the host already shows', () => {
    // Hiding a number the host is rendering anyway would be a silent regression.
    for (const over of [{}, { model: 'm' }, { confidenceBasis: 'b' }]) {
      expect(svInsightConfidenceLabel(insight(over))).toContain('87%');
    }
  });
});

describe('svInsightIsAttributed', () => {
  it('needs both the method and the model', () => {
    expect(svInsightIsAttributed(insight({ confidenceBasis: 'b', model: 'm' }))).toBe(true);
    expect(svInsightIsAttributed(insight({ confidenceBasis: 'b' }))).toBe(false);
    expect(svInsightIsAttributed(insight({ model: 'm' }))).toBe(false);
    expect(svInsightIsAttributed(insight({ confidenceBasis: ' ', model: 'm' }))).toBe(false);
  });
});

// ── Sample data ─────────────────────────────────────────────────────────────

describe('sample data carries its own label', () => {
  it('marks every bundled demo insight', () => {
    // The label has to survive a copy-paste into a host's fixture, which is the
    // path this array actually travels.
    expect(DEMO_INSIGHTS.length).toBeGreaterThan(0);
    expect(DEMO_INSIGHTS.every((i) => i.sample === true)).toBe(true);
  });

  it('counts only the ones flagged', () => {
    expect(svSampleCount([insight(), insight({ id: 'i2', sample: true })])).toBe(1);
    expect(svSampleCount([])).toBe(0);
  });

  it('says nothing when nothing is sample data', () => {
    expect(svSampleLabel(0, 4)).toBe('');
  });

  it('distinguishes all-sample from some-sample', () => {
    expect(svSampleLabel(4, 4)).toContain('Every insight here');
    expect(svSampleLabel(4, 4)).toContain('None of it is about your system');
    expect(svSampleLabel(2, 5)).toContain('2 of these 5');
  });
});

// ── What reaches the DOM ────────────────────────────────────────────────────

describe('the card says what it is holding', () => {
  it('warns when the demo data is on screen', async () => {
    const f = await cards({ insights: DEMO_INSIGHTS });
    expect(text(q(f, '[data-sv-sample-notice]'))).toContain('sample data');
  });

  it('says nothing about samples for a host’s own insights', async () => {
    const f = await cards({ insights: [insight()] });
    expect(q(f, '[data-sv-sample-notice]')).toBeNull();
  });

  it('links the evidence when there is some', async () => {
    const f = await cards({ insights: [insight({ evidenceUrl: 'https://metrics.test/churn' })] });
    expect(q(f, '[data-sv-evidence-link]')?.getAttribute('href')).toBe('https://metrics.test/churn');
    expect(q(f, '[data-sv-no-evidence]')).toBeNull();
  });

  it('says "assertion" when there is none', async () => {
    const f = await cards({ insights: [insight()] });
    expect(text(q(f, '[data-sv-no-evidence]'))).toContain('assertion');
    expect(q(f, '[data-sv-evidence-link]')).toBeNull();
  });

  it('renders the confidence with whatever produced it', async () => {
    const f = await cards({ insights: [insight({ confidenceBasis: 'z-score vs 30d' })] });
    expect(text(q(f, '[data-sv-confidence-basis]'))).toContain('z-score vs 30d');
  });
});

// ── Every variant that shows a confidence carries its provenance ─────────────
//
// ★★★ AI-03-M1 LANDED IN `feed` ONLY. `grid`, `inline` and `panel` still drew a
//     bare confidence ring — an assertion with a percentage beside it. Each row
//     below renders the real variant, not the helper.

describe('provenance in every variant that shows a confidence', () => {
  for (const variant of ['feed', 'grid', 'inline', 'panel'] as const) {
    describe(`variant "${variant}"`, () => {
      it('links the evidence when there is some', async () => {
        const f = await cards({
          variant,
          insights: [insight({ evidenceUrl: 'https://metrics.test/churn' })],
        });
        const link = q(f, '[data-sv-evidence-link]') as HTMLAnchorElement | null;
        expect(link?.getAttribute('href')).toBe('https://metrics.test/churn');
        expect(link?.getAttribute('rel')).toContain('noopener');
        expect(text(link)).toBe('Check the evidence');
        expect(q(f, '[data-sv-no-evidence]')).toBeNull();
      });

      it('labels an insight with no evidence as an assertion', async () => {
        const f = await cards({ variant, insights: [insight()] });
        expect(text(q(f, '[data-sv-no-evidence]'))).toContain('assertion, not a finding');
        expect(q(f, '[data-sv-evidence-link]')).toBeNull();
      });

      it('refuses a non-http evidence link rather than rendering a dead one', async () => {
        const f = await cards({
          variant,
          insights: [insight({ evidenceUrl: 'javascript:alert(1)' })],
        });
        expect(q(f, '[data-sv-evidence-link]')).toBeNull();
        expect(text(q(f, '[data-sv-no-evidence]'))).toContain('not opened from here');
      });

      it('renders the confidence with its basis and model', async () => {
        const f = await cards({
          variant,
          insights: [insight({ confidenceBasis: 'z-score vs 30d', model: 'churn-v2', modelVersion: '2.3' })],
        });
        expect(text(q(f, '[data-sv-confidence-basis]'))).toBe('87% — z-score vs 30d, from churn-v2 2.3');
      });

      it('says so when nothing recorded how the number was produced', async () => {
        const f = await cards({ variant, insights: [insight()] });
        expect(text(q(f, '[data-sv-confidence-basis]'))).toContain('no method or model recorded');
      });
    });
  }

  it('gives one provenance block per card in the grid', async () => {
    const f = await cards({
      variant: 'grid',
      insights: [insight({ id: 'a' }), insight({ id: 'b', evidenceUrl: 'https://metrics.test/b' })],
    });
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('[data-sv-confidence-basis]').length).toBe(2);
    expect(el.querySelectorAll('[data-sv-evidence-link]').length).toBe(1);
    expect(el.querySelectorAll('[data-sv-no-evidence]').length).toBe(1);
  });

  /**
   * ★★ THE PANEL'S "OTHER INSIGHTS" LIST SHOWS A PERCENTAGE TOO. Its basis used
   *    to live only in a hover `title`, with no evidence link and no assertion
   *    label — invisible on touch and to anyone who does not hover.
   */
  it('gives each other insight in the panel its basis and evidence, on screen', async () => {
    const f = await cards({
      variant: 'panel',
      insights: [
        insight({ id: 'a' }),
        insight({ id: 'b', title: 'Linked', confidenceBasis: 'holdout AUC', evidenceUrl: 'https://metrics.test/b' }),
        insight({ id: 'c', title: 'Bare' }),
      ],
    });
    const row = (id: string) =>
      (f.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-sv-other-insight="${id}"]`)!;

    expect(text(row('b').querySelector('[data-sv-confidence-basis]'))).toContain('holdout AUC');
    const link = row('b').querySelector('[data-sv-evidence-link]');
    expect(link?.getAttribute('href')).toBe('https://metrics.test/b');
    // Never nested inside the row's own button.
    expect(link?.closest('button')).toBeNull();

    expect(text(row('c').querySelector('[data-sv-no-evidence]'))).toContain('assertion, not a finding');
    expect(text(row('c').querySelector('[data-sv-confidence-basis]'))).toContain('no method or model recorded');
  });
});
