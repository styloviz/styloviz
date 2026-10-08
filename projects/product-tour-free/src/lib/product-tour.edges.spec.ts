import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvProductTourComponent } from './product-tour.component';
import type { TourStep } from './product-tour.types';
import { flush, until } from '../../../../src/testing/async';

/**
 * The portal edges the main spec does not reach: the Tab trap, a Tab that
 * arrives before the card is in the document, and a tour torn down inside the
 * window between attaching the card and focusing it.
 *
 * The card is portaled into `<body>`, so every DOM query here is against
 * `document.body` deliberately and `afterEach` removes whatever is left.
 */

const STEPS: TourStep[] = [
  { id: 'a', title: 'Welcome', content: 'One.' },
  { id: 'b', title: 'Filters', content: 'Two.' },
  { id: 'c', title: 'Export', content: 'Three.' },
];

async function setup(inputs: Partial<ComponentInput<SvProductTourComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvProductTourComponent, {
    inputs: { steps: STEPS, ...inputs } as ComponentInput<SvProductTourComponent>,
  });
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const buttons = () => [...document.body.querySelectorAll<HTMLElement>(
  '[role="dialog"] a[href], [role="dialog"] button:not([disabled])',
)];

async function open(inputs: Partial<ComponentInput<SvProductTourComponent>> = {}) {
  const r = await setup({ active: true, ...inputs });
  await until(() => dialog() !== null, { label: 'the tour card to mount' });
  // Focus lands on a 30ms timer of the component's own.
  await until(() => dialog()!.contains(document.activeElement), {
    label: 'focus to land inside the card',
  });
  r.fixture.detectChanges();
  return r;
}

const tab = (shift = false) => {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true,
  });
  document.dispatchEvent(event);
  return event;
};

afterEach(() => {
  // The portal is a bare div appended to <body>; anything still holding a
  // dialog after a test would be found by the next spec's queries.
  document.querySelectorAll('body > div').forEach((n) => {
    if (n.querySelector('[role="dialog"]')) n.remove();
  });
});

describe('SvProductTourComponent — the focus trap', () => {
  it('wraps Tab from the last control back to the first', async () => {
    await open();
    const ring = buttons();
    expect(ring.length).toBeGreaterThan(1);

    ring[ring.length - 1].focus();
    const event = tab();

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(ring[0]);
  });

  it('wraps Shift+Tab from the first control back to the last', async () => {
    await open();
    const ring = buttons();

    ring[0].focus();
    const event = tab(true);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(ring[ring.length - 1]);
  });

  /** In the middle of the ring the browser's own order is correct. */
  it('leaves a Tab in the middle of the ring alone', async () => {
    await open();
    const ring = buttons();
    ring[1].focus();

    const event = tab();

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(ring[1]);
  });

  it('leaves a Shift+Tab in the middle of the ring alone', async () => {
    await open();
    const ring = buttons();
    ring[1].focus();

    const event = tab(true);

    expect(event.defaultPrevented).toBe(false);
  });

  /**
   * ★ The card is attached in a microtask, so there is a window in which the
   * tour is `active` but nothing is in the document yet. A Tab arriving then
   * has nothing to wrap to — it must be swallowed rather than escaping into the
   * page behind the tour that is about to appear.
   */
  it('swallows Tab in the window before the card is in the document', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.active.set(true);
    fixture.detectChanges();

    const event = tab();

    expect(event.defaultPrevented).toBe(true);
    await until(() => dialog() !== null, { label: 'the card to arrive' });
  });

  it('ignores Tab entirely while the tour is shut', async () => {
    await setup();
    const event = tab();
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('SvProductTourComponent — torn down mid-open', () => {
  /**
   * ★ Focus is moved into the card on a 30ms timer. A tour switched off inside
   * that window has already had its card removed, so the timer runs against a
   * null container — it must find nothing rather than throw out of a timer,
   * where no host can catch it.
   */
  it('does not throw when the tour closes before focus lands', async () => {
    const { fixture } = await setup({ active: true });
    fixture.componentInstance.active.set(false);
    fixture.detectChanges();

    await flush();
    await new Promise((r) => setTimeout(r, 60));

    expect(dialog()).toBeNull();
  });

  /**
   * ★ REGRESSION. The attach is deferred to a microtask. A tour switched on and
   * then off again before that microtask ran — the ordinary shape when a host
   * flips `active` from two different responses — attached the card ANYWAY,
   * after the effect had already detached. `active` was then false and never
   * changed again, so the effect never re-ran: a full-screen tour card sat on
   * the page over an inactive tour with nothing able to remove it.
   */
  it('does not attach a card that was switched off before the attach ran', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.active.set(true);
    fixture.detectChanges();
    fixture.componentInstance.active.set(false);
    fixture.detectChanges();

    await flush();
    await new Promise((r) => setTimeout(r, 60));

    expect(dialog()).toBeNull();
    expect(fixture.componentInstance.active()).toBe(false);
  });

  it('still attaches when the tour stays on', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.active.set(true);
    fixture.detectChanges();

    await until(() => dialog() !== null, { label: 'the card to attach' });
    expect(dialog()).not.toBeNull();
    fixture.destroy();
  });

  it('leaves nothing in <body> when destroyed while open', async () => {
    const { fixture } = await open();
    fixture.destroy();
    expect(dialog()).toBeNull();
  });

  /**
   * The effect re-runs whenever `steps` changes, and each run attaches. A
   * second attach with the card already up must refresh it, not stack a second
   * copy on top.
   */
  it('refreshes the existing card rather than mounting a second one', async () => {
    const { fixture } = await open();
    fixture.componentRef.setInput('steps', [
      ...STEPS,
      { id: 'd', title: 'Extra', content: 'Four.' },
    ]);
    fixture.detectChanges();
    await flush();
    await flush();

    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });
});

describe('SvProductTourComponent — degenerate step lists', () => {
  it('clamps the index to zero when there are no steps at all', async () => {
    const { fixture } = await setup({ steps: [], stepIndex: 7 });
    expect(fixture.componentInstance.resolvedStepIndex()).toBe(0);
    expect(fixture.componentInstance.hasSteps()).toBe(false);
  });

  /**
   * A `steps` array built by a `map` over data that had a gap contains a hole.
   * The card must show nothing rather than render its chrome around an
   * undefined step.
   */
  it('treats a hole in the step list as no step', async () => {
    const { fixture } = await setup({
      steps: [undefined as unknown as TourStep],
      active: true,
    });
    expect(fixture.componentInstance.currentStep()).toBeNull();
  });

  it('will not jump anywhere in an empty tour', async () => {
    const { fixture } = await setup({ steps: [] });
    const seen: number[] = [];
    fixture.componentInstance.stepChange.subscribe((i) => seen.push(i));

    fixture.componentInstance.goToStep(2);

    expect(seen).toEqual([]);
    expect(fixture.componentInstance.stepIndex()).toBe(0);
  });

  it('will not step back in an empty tour', async () => {
    const { fixture } = await setup({ steps: [] });
    const seen: number[] = [];
    fixture.componentInstance.stepChange.subscribe((i) => seen.push(i));

    fixture.componentInstance.goPrev();

    expect(seen).toEqual([]);
  });

  /** One step is both the first and the last: "Done", and no "Back". */
  it('treats a single-step tour as first and last at once', async () => {
    const { fixture } = await open({ steps: [STEPS[0]] });
    expect(fixture.componentInstance.isFirstStep()).toBe(true);
    expect(fixture.componentInstance.isLastStep()).toBe(true);

    const done: unknown[] = [];
    fixture.componentInstance.complete.subscribe(() => done.push(1));
    fixture.componentInstance.goNext();
    expect(done).toEqual([1]);
  });
});

describe('SvProductTourComponent — tag colours', () => {
  it('gives each tag colour its own classes', async () => {
    const { fixture } = await setup();
    const cls = fixture.componentInstance.tagColorClass();
    const seen = new Set<string>();
    for (const color of ['blue', 'green', 'purple', 'amber', 'rose'] as const) {
      expect(cls(color)).toBeTruthy();
      seen.add(cls(color));
    }
    expect(seen.size).toBe(5);
  });

  /** An untagged step still needs a class, or the badge renders unstyled. */
  it('falls back to blue when a step names no colour', async () => {
    const { fixture } = await setup();
    const cls = fixture.componentInstance.tagColorClass();
    expect(cls(undefined)).toBe(cls('blue'));
  });

  it('renders the tag badge with the colour the step asked for', async () => {
    await open({
      steps: [{ id: 'a', title: 'T', content: 'C', tag: 'New', tagColor: 'rose' }],
    });
    const badge = [...dialog()!.querySelectorAll('span')]
      .find((n) => n.textContent?.trim() === 'New')!;
    expect(badge.className).toContain('rose');
  });
});
