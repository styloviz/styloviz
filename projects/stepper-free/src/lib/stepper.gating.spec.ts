import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvStepperComponent } from './stepper.component';
import type { StepperBlockedEvent, StepperItem } from './stepper.component';

/**
 * ============================================================================
 *  What the FREE stepper does and does not gate
 * ============================================================================
 *
 * The Pro twin has three ways to refuse a step: `disabled`, linear sequencing,
 * and per-step `guardRules`. The free tier has exactly one — `disabled` — plus
 * the whole-component `interactive` switch. Half of this file therefore asserts
 * an ABSENCE: a free stepper must let a user jump from step 1 to step 4,
 * because there is no wizard gate in this tier and pretending otherwise would
 * be a silent, undebuggable navigation failure for anyone who upgraded their
 * expectations but not their package.
 *
 * The Pro counterpart is `projects/stepper/src/lib/stepper.linear.spec.ts`.
 */

const WIZARD: StepperItem[] = [
  { id: 'a', label: 'Account' },
  { id: 'b', label: 'Billing' },
  { id: 'c', label: 'Shipping' },
  { id: 'd', label: 'Confirm' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStepperComponent, {
    inputs: { items: WIZARD, ...inputs },
  });
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;
const stepAt = (f: Fixture, i: number) => f.componentInstance.normalizedSteps()[i];

function watch(f: Fixture) {
  const blocked: StepperBlockedEvent[] = [];
  const changes: number[] = [];
  f.componentInstance.stepBlocked.subscribe((e) => blocked.push(e));
  f.componentInstance.stepChange.subscribe((e) => changes.push(e.currentIndex));
  return { blocked, changes };
}

describe('SvStepperComponent — no linear gate in the free tier', () => {
  /**
   * ★ The mirror image of the Pro spec's headline test. There, jumping to the
   * last step from the first is refused; here it must succeed, because the
   * free stepper is a progress indicator, not a wizard.
   */
  it('jumps to the last step from the first with nothing complete', async () => {
    const f = await setup({ activeIndex: 0 });
    const { blocked, changes } = watch(f);

    f.componentInstance.onSelect(stepAt(f, 3));

    expect(f.componentInstance.activeIndex()).toBe(3);
    expect(changes).toEqual([3]);
    expect(blocked).toEqual([]);
  });

  /** The Pro-only API surface is genuinely absent, not merely inert. */
  it('exposes no linear, guardRules or telemetry member', async () => {
    const f = await setup();
    const c = f.componentInstance as unknown as Record<string, unknown>;

    expect(c['linear']).toBeUndefined();
    expect(c['guardRules']).toBeUndefined();
    expect(c['telemetry']).toBeUndefined();
    // …while the shared surface is present, so this is a tier difference and
    // not a broken component.
    expect(c['stepBlocked']).toBeDefined();
    expect(c['branchChange']).toBeDefined();
  });

  it('emits stepClick for every step, refused or not', async () => {
    const f = await setup({ activeIndex: 0 });
    const clicks: number[] = [];
    f.componentInstance.stepClick.subscribe((e) => clicks.push(e.index));

    f.componentInstance.onSelect(stepAt(f, 2));
    f.componentInstance.onSelect(stepAt(f, 2));

    expect(clicks).toEqual([2, 2]);
  });

  /** Re-selecting the active step is a no-op, not a transition. */
  it('emits no change for the step already active', async () => {
    const f = await setup({ activeIndex: 1 });
    const { changes } = watch(f);

    f.componentInstance.onSelect(stepAt(f, 1));

    expect(changes).toEqual([]);
  });
});

describe('SvStepperComponent — disabled steps', () => {
  const withDisabled: StepperItem[] = [
    { id: 'a', label: 'Account' },
    { id: 'b', label: 'Billing', status: 'disabled' },
    { id: 'c', label: 'Confirm' },
  ];

  it('refuses a disabled step and says why', async () => {
    const f = await setup({ items: withDisabled, activeIndex: 0 });
    const { blocked, changes } = watch(f);

    f.componentInstance.onSelect(stepAt(f, 1));

    expect(f.componentInstance.activeIndex()).toBe(0);
    expect(changes).toEqual([]);
    expect(blocked).toEqual([expect.objectContaining({ index: 1, reason: 'disabled' })]);
  });

  it('marks a disabled step aria-disabled', async () => {
    const f = await setup({ items: withDisabled, activeIndex: 0 });
    const buttons = [...(f.nativeElement as HTMLElement).querySelectorAll('button')];

    expect(buttons[1].getAttribute('aria-disabled')).toBe('true');
    expect(buttons[2].getAttribute('aria-disabled')).toBe('false');
  });

  it('reports a disabled step as non-clickable and the others as clickable', async () => {
    const f = await setup({ items: withDisabled });
    const c = f.componentInstance;
    expect(c.normalizedSteps().map((s) => c.isClickable(s))).toEqual([true, false, true]);
  });
});

describe('SvStepperComponent — non-interactive', () => {
  /**
   * ★ Regression. `interactive=false` is what an order-status tracker uses.
   * The rows stay in the DOM as real <button>s with a live (click) handler, so
   * the refusal has to happen in `onSelect` — `blockReason` used to return
   * `null` for a non-interactive stepper, which meant every step still
   * navigated on click. The stepper looked read-only (dimmed, aria-disabled,
   * not-allowed cursor) and was not.
   */
  it('does not move when a step is clicked', async () => {
    const f = await setup({ interactive: false, activeIndex: 0 });
    const { changes, blocked } = watch(f);

    (f.nativeElement as HTMLElement).querySelectorAll('button')[2].click();

    expect(f.componentInstance.activeIndex()).toBe(0);
    expect(changes).toEqual([]);
    expect(blocked).toEqual([expect.objectContaining({ index: 2, reason: 'disabled' })]);
  });

  it('does not move when a step is activated from the keyboard', async () => {
    const f = await setup({ interactive: false, enableHotkeys: true, activeIndex: 0 });
    const { changes } = watch(f);

    const event = new KeyboardEvent('keydown', { key: 'End', cancelable: true });
    f.componentInstance.onStepKeydown(event, stepAt(f, 0));

    expect(f.componentInstance.activeIndex()).toBe(0);
    expect(changes).toEqual([]);
  });

  it('reports every step as non-clickable', async () => {
    const f = await setup({ interactive: false });
    const c = f.componentInstance;
    expect(c.normalizedSteps().map((s) => c.isClickable(s))).toEqual([
      false, false, false, false,
    ]);
  });
});

describe('SvStepperComponent — bounds', () => {
  it('clamps an activeIndex past the end onto the last step', async () => {
    const f = await setup({ activeIndex: 99 });
    expect(f.componentInstance.clampedActiveIndex()).toBe(3);
  });

  it('clamps a negative activeIndex onto the first step', async () => {
    const f = await setup({ activeIndex: -5 });
    expect(f.componentInstance.clampedActiveIndex()).toBe(0);
  });

  it('survives an empty item list', async () => {
    const f = await setup({ items: [] as StepperItem[], activeIndex: 2 });
    expect(f.componentInstance.clampedActiveIndex()).toBe(0);
    expect(f.componentInstance.normalizedSteps()).toEqual([]);
    expect((f.nativeElement as HTMLElement).querySelectorAll('button')).toHaveLength(0);
  });
});
