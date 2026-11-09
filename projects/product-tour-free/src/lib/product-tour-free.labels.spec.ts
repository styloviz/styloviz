import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvProductTourComponent } from './product-tour.component';
import { SV_PRODUCT_TOUR_LABELS } from './product-tour-free.labels';

const STEPS = [{ id: 'one', title: 'One', content: 'First.' }, { id: 'two', title: 'Two', content: 'Second.' }];

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const view = await render(SvProductTourComponent, {
    inputs: { active: true, steps: STEPS },
    providers: providers as never[],
  });
  await new Promise<void>((r) => setTimeout(r, 60));
  view.fixture.detectChanges();
  return view;
}

/** The tour portals its card to `<body>`; drop it so the next render starts clean. */
afterEach(() => {
  document.querySelectorAll('body > div').forEach((n) => {
    if (n.querySelector('[data-sv-tour], [role="dialog"], [data-sv-tour-card]')) n.remove();
  });
});

describe('SvProductTourComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('button', { name: SV_PRODUCT_TOUR_LABELS.skipTour }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ productTour: { skipTour: 'Tour überspringen' } })]);
    expect(screen.getAllByRole('button', { name: 'Tour überspringen' }).length).toBeGreaterThan(0);
    // The visible Skip button is named by its text (`skipLabel`), not a label; only the icon button's
    // accessible name comes from the registry.
    expect(document.querySelector('[aria-label="Skip tour"]')).toBeNull();
  });
});

describe('SvProductTourComponent — composed accessible names (FL-B1c)', () => {
  it('fills a translated template whose slot sits in a different position', async () => {
    await setup([provideSvLabels({ productTour: { goToStepNumber: 'Schritt {step} aufrufen' } })]);
    expect(screen.getAllByRole('button', { name: 'Schritt 2 aufrufen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Go to step 2' })).toBeNull();
  });
});

describe('SvProductTourComponent — visible text (FL-B1d)', () => {
  it('renders the button text an app provides', async () => {
    await setup([provideSvLabels({ productTour: { next: 'Weiter' } })]);
    expect(screen.getAllByRole('button', { name: 'Weiter' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });
});
