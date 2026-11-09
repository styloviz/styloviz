import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvAiInsightCardsComponent, DEMO_INSIGHTS } from './ai-insight-cards.component';
import { SV_AI_INSIGHT_CARDS_LABELS } from './ai-insight-cards.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const result = await render(SvAiInsightCardsComponent, {
    inputs: { variant: 'feed', insights: DEMO_INSIGHTS },
    providers: providers as never[],
  });
  return result;
}

describe('SvAiInsightCardsComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('button', { name: SV_AI_INSIGHT_CARDS_LABELS.dismissInsight })).toBeTruthy();
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ aiInsightCards: { dismissInsight: 'Erkenntnis verwerfen' } })]);
    expect(screen.getAllByRole('button', { name: 'Erkenntnis verwerfen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: SV_AI_INSIGHT_CARDS_LABELS.dismissInsight })).toBeNull();
  });

  /** FL-B1c: a composed name is one template, so a translation can move the slot. */
  it('fills a translated template whose slot sits elsewhere', async () => {
    TestBed.resetTestingModule();
    await render(SvAiInsightCardsComponent, {
      inputs: { variant: 'panel', insights: DEMO_INSIGHTS },
      providers: [provideSvLabels({ aiInsightCards: { aiConfidence: '{percent} % KI-Konfidenz' } })],
    });
    expect(screen.getByRole('img', { name: /^\d+ % KI-Konfidenz$/ })).toBeTruthy();
    expect(screen.queryByRole('img', { name: /^AI confidence: / })).toBeNull();
  });
});

describe('SvAiInsightCardsComponent — visible text (FL-B1d)', () => {
  it('renders the badge and buttons an app provides', async () => {
    await setup([provideSvLabels({ aiInsightCards: { feedBadge: 'KI-Erkenntnisse', accept: 'Annehmen' } })]);
    expect(screen.getByText('KI-Erkenntnisse')).toBeTruthy();
    expect(screen.getAllByText('Annehmen').length).toBeGreaterThan(0);
    expect(screen.queryByText('AI Insights')).toBeNull();
  });
});

describe('SvAiInsightCardsComponent — text built in TypeScript (FL-B1e)', () => {
  it('renders the category and priority names an app provides', async () => {
    await setup([provideSvLabels({ aiInsightCards: { priorityCritical: 'Kritisch' } })]);
    expect(screen.getAllByText('Kritisch').length).toBeGreaterThan(0);
    expect(screen.queryByText(SV_AI_INSIGHT_CARDS_LABELS.priorityCritical)).toBeNull();
  });
});

describe('SvAiInsightCardsComponent — sentences built in TypeScript (FL-B1e wave 4)', () => {
  it('speaks an anomaly row with the templates an app provides', async () => {
    TestBed.resetTestingModule();
    const series = Array.from({ length: 30 }, (_, i) => 200 + (i % 2 === 0 ? 1 : -1));
    const { fixture } = await render(SvAiInsightCardsComponent, {
      inputs: { variant: 'anomaly', baselines: [{ metric: 'Latency', series, current: 900, unit: 'ms' }], insights: [] },
      providers: [
        provideSvLabels({
          aiInsightCards: {
            anomalyRowName: '{metric}: jetzt {current} {unit}. {finding}',
            anomalyAbove: '{sigma} über dem Üblichen ({median}), gemessen über {n} Beobachtungen.',
          },
        }),
      ],
    });
    fixture.detectChanges();
    const row = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-anomaly-row="Latency"]');
    const label = row?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Latency: jetzt 900 ms.');
    expect(label).toContain('gemessen über 30 Beobachtungen.');
    expect(label).not.toContain('observations');
  });
});
