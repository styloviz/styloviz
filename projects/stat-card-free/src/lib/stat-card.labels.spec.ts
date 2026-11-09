import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvStatCardComponent } from './stat-card.component';

/** FL-B1e: the sentences the card builds in TypeScript come from its labels. */
describe('SvStatCardComponent — labels', () => {
  const minutesAgo = (n: number): string => new Date(Date.now() - n * 60_000).toISOString();

  it('builds the freshness line and the trend name from the labels an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvStatCardComponent, {
      inputs: { title: 'Umsatz', value: 4821, trend: 'up', trendPercent: 12, updatedAt: minutesAgo(5), source: 'Lager' },
      providers: [
        provideSvLabels({
          statCard: {
            ageMinutes: 'vor {count} Min.',
            updated: 'Aktualisiert {when}',
            trendUp: 'Trend steigend {figure}, {period}',
            trendPeriodMissing: 'Vergleichszeitraum nicht angegeben',
          },
        }),
      ],
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-sv-freshness]')?.textContent?.trim()).toBe('Aktualisiert vor 5 Min. · Lager');
    expect(host.querySelector('[data-sv-trend]')?.getAttribute('aria-label')).toBe(
      'Trend steigend 12%, Vergleichszeitraum nicht angegeben',
    );
  });
});
