import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvStepperComponent } from './stepper.component';
import type { StepperBlockedEvent, StepperChangeRequest, StepperItem } from './stepper.component';

const steps: StepperItem[] = [
  { id: 'a', label: 'Account' },
  { id: 'b', label: 'Billing' },
  { id: 'c', label: 'Confirm' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStepperComponent, {
    inputs: { items: steps, asyncValidation: true, ...inputs },
  });
  return fixture;
}

/** The stepper's own normalized view of a step index. */
const stepAt = (f: Awaited<ReturnType<typeof setup>>, i: number) =>
  f.componentInstance.normalizedSteps()[i];

describe('SvStepperComponent — server-validated transitions', () => {
  /**
   * Moving first and reverting on failure would flash the next step's content,
   * including a form the user has not filled in. So it asks before moving.
   */
  it('does not move until the host allows it', async () => {
    const f = await setup();
    const seen: StepperChangeRequest[] = [];
    f.componentInstance.stepChangeRequest.subscribe((r) => seen.push(r));

    f.componentInstance.onSelect(stepAt(f, 1));
    expect(f.componentInstance.activeIndex()).toBe(0);
    expect(seen).toHaveLength(1);

    seen[0].allow();
    expect(f.componentInstance.activeIndex()).toBe(1);
  });

  it('keeps the user where they are when the host denies', async () => {
    const f = await setup();
    const seen: StepperChangeRequest[] = [];
    const blocked: StepperBlockedEvent[] = [];
    f.componentInstance.stepChangeRequest.subscribe((r) => seen.push(r));
    f.componentInstance.stepBlocked.subscribe((b) => blocked.push(b));

    f.componentInstance.onSelect(stepAt(f, 1));
    seen[0].deny('Card declined');

    expect(f.componentInstance.activeIndex()).toBe(0);
    expect(blocked[0].reason).toBe('Card declined');
  });

  /** A handler that resolves and then errors must not move the user twice. */
  it('honours only the first of allow/deny', async () => {
    const f = await setup();
    const seen: StepperChangeRequest[] = [];
    const blocked: StepperBlockedEvent[] = [];
    f.componentInstance.stepChangeRequest.subscribe((r) => seen.push(r));
    f.componentInstance.stepBlocked.subscribe((b) => blocked.push(b));

    f.componentInstance.onSelect(stepAt(f, 1));
    seen[0].allow();
    seen[0].deny('too late');
    seen[0].allow();

    expect(f.componentInstance.activeIndex()).toBe(1);
    expect(blocked).toHaveLength(0);
  });

  it('emits stepChange only once the move is committed', async () => {
    const f = await setup();
    const seen: StepperChangeRequest[] = [];
    let changes = 0;
    f.componentInstance.stepChangeRequest.subscribe((r) => seen.push(r));
    f.componentInstance.stepChange.subscribe(() => changes++);

    f.componentInstance.onSelect(stepAt(f, 1));
    expect(changes).toBe(0);
    seen[0].allow();
    expect(changes).toBe(1);
  });

  /** A double-click would otherwise start two validations with no defined winner. */
  it('ignores activations while a step is being validated', async () => {
    const f = await setup({ validatingIndex: 0 });
    let asked = 0;
    f.componentInstance.stepChangeRequest.subscribe(() => asked++);

    f.componentInstance.onSelect(stepAt(f, 1));
    expect(asked).toBe(0);
    expect(f.componentInstance.isValidating(0)).toBe(true);
  });

  it('moves straight away when asyncValidation is off', async () => {
    const f = await setup({ asyncValidation: false });
    let asked = 0;
    f.componentInstance.stepChangeRequest.subscribe(() => asked++);

    f.componentInstance.onSelect(stepAt(f, 1));
    expect(asked).toBe(0);
    expect(f.componentInstance.activeIndex()).toBe(1);
  });
});
