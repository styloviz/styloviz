import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvEmptyShellComponent } from '@styloviz/core/data';
import { SvErrorShellComponent } from '@styloviz/core/data';
import { svFormatExpectedWait } from '@styloviz/core/feedback';
import { SV_CORE_LABELS } from './core.labels';
import { provideSvLabels } from './labels';

/** FL-B1d: core's shells render the package's English until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvErrorShellComponent, {
    inputs: { error: 'The request timed out.' },
    providers: providers as never[],
  });
}

afterEach(() => TestBed.resetTestingModule());

describe('core shells — visible text (FL-B1d)', () => {
  it('titles a failure and offers the retry in English by default', async () => {
    await setup();
    expect(screen.getByText(SV_CORE_LABELS.errorTitle)).toBeTruthy();
    expect(screen.getByRole('button', { name: SV_CORE_LABELS.retry })).toBeTruthy();
  });

  it('renders the text an app provides', async () => {
    await setup([provideSvLabels({ core: { errorTitle: 'Etwas ist schiefgelaufen', retry: 'Erneut versuchen' } })]);
    expect(screen.getByText('Etwas ist schiefgelaufen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    expect(screen.queryByText(SV_CORE_LABELS.errorTitle)).toBeNull();
  });
});

describe('core — text built in TypeScript (FL-B1e)', () => {
  it('words an empty shell in the language an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvEmptyShellComponent, {
      inputs: { reason: 'no-results' },
      providers: [provideSvLabels({ core: { emptyNoResultsTitle: 'Keine passenden Ergebnisse', emptyClearFilters: 'Filter löschen' } })],
    });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Keine passenden Ergebnisse');
    expect(text).toContain('Filter löschen');
    expect(text).not.toContain(SV_CORE_LABELS.emptyNoResultsTitle);
  });
});

describe('core helpers — glued sentences become labels (FL-B1e wave 4)', () => {
  it('words an expected wait from the templates and locale it is given', () => {
    const de = { expectedWaitSeconds: 'etwa {count, plural, one {{n} Sekunde} other {{n} Sekunden}}', expectedWaitMinutes: 'etwa {count, plural, one {{n} Minute} other {{n} Minuten}}' };
    expect(svFormatExpectedWait(1_000, de, 'de-DE')).toBe('etwa 1 Sekunde');
    expect(svFormatExpectedWait(8_000, de, 'de-DE')).toBe('etwa 8 Sekunden');
    expect(svFormatExpectedWait(150_000, de, 'de-DE')).toBe('etwa 3 Minuten');
    expect(svFormatExpectedWait(8_000)).toBe('about 8 seconds');
  });
});
