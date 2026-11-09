import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { type SvDataError } from '@styloviz/core/data';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvResultComponent } from './result/result.component';
import { SvProgressBarComponent } from './progress-bar/progress-bar.component';
import { SV_OVERLAYS_LABELS } from './overlays.labels';

/** FL-B1d: the visible text is the package's English default until an app says otherwise. */
const ERROR: SvDataError = { message: 'Could not load the report.', retryable: true, reference: '7f3a9c2' };

async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const view = await render(SvResultComponent, {
    inputs: { status: 'error', title: 'Could not load the report', error: ERROR },
    providers: providers as never[],
  });
  const host = view.fixture.nativeElement as HTMLElement;
  return {
    reference: () => host.querySelector('[data-sv-reference]') as HTMLElement | null,
    copyBtn: () => host.querySelector('[data-sv-copy-reference]') as HTMLButtonElement | null,
  };
}

describe('SvResultComponent — labels', () => {
  it('labels the reference and its copy button in English by default', async () => {
    const view = await setup();
    expect(view.reference()?.textContent).toContain(SV_OVERLAYS_LABELS.resultReference);
    expect(view.copyBtn()?.textContent?.trim()).toBe(SV_OVERLAYS_LABELS.resultCopy);
  });

  it('renders the visible text an app provides', async () => {
    const view = await setup([provideSvLabels({ overlays: { resultReference: 'Referenz', resultCopy: 'Kopieren' } })]);
    expect(view.reference()?.textContent).toContain('Referenz');
    expect(view.reference()?.textContent).not.toContain('Reference');
    expect(view.copyBtn()?.textContent?.trim()).toBe('Kopieren');
  });

  it('names the technical-details rows in the language an app provides (FL-B1e)', async () => {
    TestBed.resetTestingModule();
    const view = await render(SvResultComponent, {
      inputs: { status: 'error', title: 'Could not load the report', error: { ...ERROR, status: 503, code: 'UPSTREAM' }, showDetails: true },
      providers: [provideSvLabels({ overlays: { resultStatus: 'Statuscode', resultCode: 'Fehlercode' } })],
    });
    const terms = [...(view.fixture.nativeElement as HTMLElement).querySelectorAll('[data-sv-details] dt')].map((dt) => dt.textContent?.trim());
    expect(terms).toEqual(['Statuscode', 'Fehlercode']);
  });
});

describe('SvProgressBarComponent — a sentence glued around data (FL-B1e)', () => {
  it('writes the stage position from a translated template', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvProgressBarComponent, {
      inputs: { value: 40, stages: ['Hochladen', 'Prüfen', 'Verarbeiten'], stageIndex: 1 },
      providers: [provideSvLabels({ overlays: { progressStageOf: 'Schritt {n} von {total}' } })],
    });
    expect(fixture.componentInstance.stagePosition()).toBe('Schritt 2 von 3');
  });
});
