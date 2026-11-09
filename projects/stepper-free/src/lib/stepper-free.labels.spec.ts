import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvStepperComponent } from './stepper.component';
import { SV_STEPPER_LABELS } from './stepper-free.labels';

const ITEMS = [{ id: 'account', label: 'Account' }, { id: 'review', label: 'Review' }];

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const view = await render(SvStepperComponent, {
    inputs: { items: ITEMS },
    providers: providers as never[],
  });
  return view;
}

describe('SvStepperComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('list', { name: SV_STEPPER_LABELS.progressSteps }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ stepper: { progressSteps: 'Fortschrittsschritte' } })]);
    expect(screen.getAllByRole('list', { name: 'Fortschrittsschritte' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('list', { name: 'Progress steps' })).toBeNull();
  });
});

describe('SvStepperComponent — visible text (FL-B1d)', () => {
  it('renders the optional badge an app provides', async () => {
    TestBed.resetTestingModule();
    await render(SvStepperComponent, {
      inputs: { items: [{ id: 'account', label: 'Account' }, { id: 'extras', label: 'Extras', optional: true }] },
      providers: [provideSvLabels({ stepper: { optional: 'Freiwillig' } })],
    });
    expect(screen.getAllByText('Freiwillig').length).toBeGreaterThan(0);
    expect(screen.queryByText('Optional')).toBeNull();
  });
});

describe('SvStepperComponent — a sentence glued around data (FL-B1e)', () => {
  it('names an optional dot step from a translated template', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvStepperComponent, {
      inputs: { items: [{ id: 'account', label: 'Konto', optional: true }, { id: 'review', label: 'Prüfen' }], variant: 'dot' },
      providers: [provideSvLabels({ stepper: { optionalStepName: '{label} (freiwillig)' } })],
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('button[aria-label="Konto (freiwillig)"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Konto (optional)"]')).toBeNull();
  });
});
