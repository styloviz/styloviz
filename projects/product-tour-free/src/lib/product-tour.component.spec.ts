import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvProductTourComponent } from './product-tour.component';
import type { TourStep } from './product-tour.types';

/**
 * A tour is a modal that a host switches on with `[active]="true"` — usually
 * from a flag it fetched, alongside steps it also fetched. Those two do not
 * arrive together, and the gap is where this component was at its worst: with
 * `active` true and `steps` still empty it opened an empty card, reported
 * itself as being on its last step, and fired `complete` for a tour nobody had
 * seen.
 *
 * Everything else worth testing is in the portal: the card is in `<body>`, so
 * a query rooted at the component's own element finds none of it.
 */

const STEPS: TourStep[] = [
  { id: 'welcome', title: 'Welcome', content: 'This is the dashboard.' },
  { id: 'filters', title: 'Filters', content: 'Narrow things down here.' },
  { id: 'export', title: 'Export', content: 'Take it with you.' },
];

async function setup(inputs: Partial<ComponentInput<SvProductTourComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvProductTourComponent, {
    inputs: { steps: STEPS, ...inputs } as ComponentInput<SvProductTourComponent>,
  });
}

/** The card lives in `<body>`, not in the component's element. */
const card = () => document.querySelector<HTMLElement>('body > div:last-of-type');
const bodyText = () => document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const button = (label: string) =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

/** The portal is attached in a microtask, then focus lands 30ms later. */
const settle = () => new Promise<void>((r) => setTimeout(r, 60));

async function open(inputs: Partial<ComponentInput<SvProductTourComponent>> = {}) {
  const r = await setup({ active: true, ...inputs });
  await settle();
  r.fixture.detectChanges();
  return r;
}

describe('SvProductTourComponent — shut', () => {
  it('puts nothing in the document until it is activated', async () => {
    await setup();
    await settle();
    expect(bodyText()).not.toContain('Welcome');
  });

  it('renders the current step once it is', async () => {
    await open();
    expect(bodyText()).toContain('Welcome');
    expect(bodyText()).toContain('This is the dashboard.');
  });

  it('mounts the card outside its own element', async () => {
    const { fixture } = await open();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).not.toContain('This is the dashboard.');
    expect(bodyText()).toContain('This is the dashboard.');
  });

  it('takes the card away again when it closes', async () => {
    const { fixture } = await open();
    fixture.componentInstance.active.set(false);
    fixture.detectChanges();
    await settle();
    expect(bodyText()).not.toContain('This is the dashboard.');
  });
});

describe('SvProductTourComponent — activated before its steps arrive', () => {
  it('shows nothing rather than an empty card', async () => {
    // ★ A host that sets `active` from one request and `steps` from another —
    // which is the ordinary shape — got a card with no title, no body, and a
    // "Done" button.
    const { fixture } = await setup({ steps: [], active: true });
    await settle();
    fixture.detectChanges();

    expect(fixture.componentInstance.currentStep()).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('does not claim to be on its last step when it has none', async () => {
    // `stepIndex >= steps.length - 1` is `0 >= -1`, which is true — so an empty
    // tour was permanently on its final step.
    const { fixture } = await setup({ steps: [], active: true });
    expect(fixture.componentInstance.isLastStep()).toBe(false);
  });

  it('does not complete a tour nobody saw', async () => {
    const { fixture } = await setup({ steps: [], active: true });
    const seen: unknown[] = [];
    fixture.componentInstance.complete.subscribe(() => seen.push(1));

    fixture.componentInstance.goNext();
    expect(seen).toEqual([]);
    expect(fixture.componentInstance.active()).toBe(true);
  });

  it('opens as soon as the steps land', async () => {
    const { fixture } = await setup({ steps: [], active: true });
    await settle();

    fixture.componentRef.setInput('steps', STEPS);
    fixture.detectChanges();
    await settle();

    expect(bodyText()).toContain('Welcome');
  });
});

describe('SvProductTourComponent — a step index out of range', () => {
  it('renders the last step rather than nothing', async () => {
    // `stepIndex` is a two-way model, so a host can put anything in it —
    // including an index left over from a longer list of steps.
    const { fixture } = await open({ stepIndex: 99 });
    expect(fixture.componentInstance.currentStep()?.title).toBe('Export');
    expect(bodyText()).toContain('Take it with you.');
  });

  it('renders the first step for a negative index', async () => {
    const { fixture } = await open({ stepIndex: -3 });
    expect(fixture.componentInstance.currentStep()?.title).toBe('Welcome');
  });
});

describe('SvProductTourComponent — moving through it', () => {
  it('goes forward and back, reporting each move', async () => {
    const { fixture } = await open();
    const seen: number[] = [];
    fixture.componentInstance.stepChange.subscribe((i) => seen.push(i));

    fixture.componentInstance.goNext();
    fixture.detectChanges();
    expect(fixture.componentInstance.stepIndex()).toBe(1);
    expect(bodyText()).toContain('Narrow things down here.');

    fixture.componentInstance.goPrev();
    fixture.detectChanges();
    expect(seen).toEqual([1, 0]);
  });

  it('will not step off either end', async () => {
    const first = await open();
    first.fixture.componentInstance.goPrev();
    expect(first.fixture.componentInstance.stepIndex()).toBe(0);

    const last = await open({ stepIndex: 2 });
    expect(last.fixture.componentInstance.isLastStep()).toBe(true);
  });

  it('clamps a jump to a step that does not exist', async () => {
    const { fixture } = await open();
    fixture.componentInstance.goToStep(99);
    expect(fixture.componentInstance.stepIndex()).toBe(2);
    fixture.componentInstance.goToStep(-1);
    expect(fixture.componentInstance.stepIndex()).toBe(0);
  });

  it('completes on the final step and resets for next time', async () => {
    const { fixture } = await open({ stepIndex: 2 });
    const seen: unknown[] = [];
    fixture.componentInstance.complete.subscribe(() => seen.push(1));

    fixture.componentInstance.goNext();
    fixture.detectChanges();

    expect(seen.length).toBe(1);
    expect(fixture.componentInstance.active()).toBe(false);
    expect(fixture.componentInstance.stepIndex()).toBe(0);
  });

  it('reports a skip and shuts, without claiming completion', async () => {
    const { fixture } = await open({ stepIndex: 1 });
    const done: unknown[] = [];
    const skipped: unknown[] = [];
    fixture.componentInstance.complete.subscribe(() => done.push(1));
    fixture.componentInstance.skip.subscribe(() => skipped.push(1));

    fixture.componentInstance.skipTour();
    fixture.detectChanges();

    expect(skipped.length).toBe(1);
    expect(done).toEqual([]);
    expect(fixture.componentInstance.active()).toBe(false);
  });
});

describe('SvProductTourComponent — the keyboard', () => {
  it('moves with the arrow keys, on either axis', async () => {
    const { fixture } = await open();

    await userEvent.keyboard('{ArrowRight}');
    fixture.detectChanges();
    expect(fixture.componentInstance.stepIndex()).toBe(1);

    await userEvent.keyboard('{ArrowDown}');
    fixture.detectChanges();
    expect(fixture.componentInstance.stepIndex()).toBe(2);

    await userEvent.keyboard('{ArrowLeft}');
    fixture.detectChanges();
    expect(fixture.componentInstance.stepIndex()).toBe(1);
  });

  it('skips on Escape', async () => {
    const { fixture } = await open();
    const skipped: unknown[] = [];
    fixture.componentInstance.skip.subscribe(() => skipped.push(1));

    await userEvent.keyboard('{Escape}');
    fixture.detectChanges();

    expect(skipped.length).toBe(1);
    expect(fixture.componentInstance.active()).toBe(false);
  });

  it('refuses Escape when the tour cannot be skipped', async () => {
    const { fixture } = await open({ allowSkip: false });
    await userEvent.keyboard('{Escape}');
    fixture.detectChanges();
    expect(fixture.componentInstance.active()).toBe(true);
  });

  it('does nothing at all while it is shut', async () => {
    const { fixture } = await setup({ stepIndex: 1 });
    await userEvent.keyboard('{ArrowRight}');
    expect(fixture.componentInstance.stepIndex()).toBe(1);
  });

  it('moves focus into the card so the trap has something to hold', async () => {
    // A focus trap that never seeds focus does not trap: Tab from outside walks
    // straight past the dialog into the page behind it.
    await open();
    expect(card()?.contains(document.activeElement)).toBe(true);
  });
});

describe('SvProductTourComponent — the labels are the host\'s to set', () => {
  it('uses the defaults', async () => {
    await open();
    expect(button('Next')).toBeTruthy();
    expect(button('Skip tour')).toBeTruthy();
  });

  it('takes overrides for every one of them', async () => {
    await open({ nextLabel: 'Weiter', prevLabel: 'Zurück', skipLabel: 'Überspringen' });
    expect(button('Weiter')).toBeTruthy();
    expect(button('Überspringen')).toBeTruthy();
  });

  it('says Done on the last step, not Next', async () => {
    await open({ stepIndex: 2, doneLabel: 'Finish' });
    expect(button('Finish')).toBeTruthy();
    expect(button('Next')).toBeFalsy();
  });

  it('hides the skip control when it is not allowed', async () => {
    await open({ allowSkip: false });
    expect(button('Skip tour')).toBeFalsy();
  });

  it('hides the counter and the dots on request', async () => {
    await open({ showStepCount: false, showProgress: false });
    expect(bodyText()).not.toMatch(/\b1\s*(of|\/)\s*3\b/);
  });
});
