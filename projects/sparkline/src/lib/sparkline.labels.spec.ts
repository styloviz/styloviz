import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvSparklineComponent } from './sparkline.component';
import { SV_SPARKLINE_LABELS } from './sparkline.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSparklineComponent, { inputs: { error: 'nope' }, providers: providers as never[] });
  return fixture.nativeElement as HTMLElement;
}

describe('SvSparklineComponent — accessible names', () => {
  it('names the error state in English by default', async () => {
    const el = await setup();
    expect(el.querySelector('[data-sv-state="error"]')?.getAttribute('aria-label')).toBe(SV_SPARKLINE_LABELS.couldNotLoadRetry);
  });

  it('renders the names an app provides', async () => {
    const el = await setup([provideSvLabels({ sparkline: { couldNotLoadRetry: 'Laden fehlgeschlagen — erneut versuchen' } })]);
    expect(el.querySelector('[data-sv-state="error"]')?.getAttribute('aria-label')).toBe('Laden fehlgeschlagen — erneut versuchen');
  });

  it('renders the visible tooltip an app provides (FL-B1d)', async () => {
    const el = await setup([provideSvLabels({ sparkline: { couldNotLoadClickToRetry: 'Laden fehlgeschlagen — zum Wiederholen klicken' } })]);
    expect(el.querySelector('[data-sv-state="error"]')?.getAttribute('title')).toBe('Laden fehlgeschlagen — zum Wiederholen klicken');
  });

  it('builds the generated description from the labels an app provides (FL-B1e)', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSparklineComponent, {
      inputs: { data: [100, 110] },
      providers: [
        provideSvLabels({
          sparkline: {
            summaryPoints: 'Sparkline, {count, plural, one {{n} Punkt} other {{n} Punkte}}',
            trendingBy: 'Tendenz {direction} {percent} %',
            directionUp: 'steigend',
          },
        }),
      ],
    });
    const label = (fixture.nativeElement as HTMLElement).querySelector('svg')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Sparkline, 2 Punkte');
    expect(label).toContain('Tendenz steigend 10.0 %');
  });
});

