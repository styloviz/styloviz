import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvLiveStreamChartComponent } from './live-chart/live-stream-chart.component';
import { SvBarChartComponent } from './bar-chart/bar-chart.component';
import { SV_CHARTS_LABELS } from './labels/charts-free.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvLiveStreamChartComponent, {
    inputs: {},
    providers: providers as never[],
  });
}

describe('SvLiveStreamChartComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('button', { name: SV_CHARTS_LABELS.resetStream }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ charts: { resetStream: 'Datenstrom zurücksetzen' } })]);
    expect(screen.getAllByRole('button', { name: 'Datenstrom zurücksetzen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Reset stream' })).toBeNull();
  });
});

describe('SvLiveStreamChartComponent — visible text (FL-B1d)', () => {
  it('renders the button text and default title an app provides', async () => {
    await setup([provideSvLabels({ charts: { reset: 'Zurücksetzen', liveStreamTitle: 'Live-Datenstrom' } })]);
    expect(screen.getByText('Zurücksetzen')).toBeTruthy();
    expect(screen.queryByText(SV_CHARTS_LABELS.reset)).toBeNull();
    expect(screen.getAllByText('Live-Datenstrom').length).toBeGreaterThan(0);
  });
});

describe('SvBarChartComponent — text built in TypeScript (FL-B1e)', () => {
  it('composes the generated accessible name from the templates an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvBarChartComponent, {
      inputs: { categories: ['Q1', 'Q2', 'Q3'], datasets: [{ label: 'Umsatz', data: [1, 2, 3] }] },
      providers: [
        provideSvLabels({
          charts: {
            chartBar: 'Balkendiagramm',
            seriesSummaryOneNamed: '{title}: Reihe {names} über {categories, plural, one {# Kategorie} other {# Kategorien}}.',
          },
        }),
      ],
    });
    const c = fixture.componentInstance as unknown as { resolvedAriaLabel: () => string };
    expect(c.resolvedAriaLabel()).toBe('Balkendiagramm: Reihe Umsatz über 3 Kategorien.');
  });
});

/** FL-B1e wave 2: a value-policy disclosure counts the chart's data with the package's own plural template. */
describe('SvBarChartComponent — value-policy disclosure', () => {
  it('counts the clamped bars in the language an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvBarChartComponent, {
      inputs: { categories: ['Jan', 'Feb', 'Mar'], datasets: [{ label: 'Umsatz', data: [120, -50, 90] }] },
      providers: [
        provideSvLabels({
          charts: {
            valueCountBar: '{count, plural, one {# Balken} other {# Balken}}',
            valueClamped: '{items} bei {clampTo} gezeichnet ({example}).',
          },
        }),
      ],
    });
    const notice = (fixture.nativeElement as HTMLElement).querySelector('[data-sv-notice]')?.textContent ?? '';
    expect(notice).toContain('1 Balken bei 0 gezeichnet (-50).');
    expect(notice).not.toContain('1 bar');
  });
});
