import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core';
import { SvStepperComponent } from './stepper.component';
import type {
  StepperFlowStatus,
  StepperInvalidationEvent,
  StepperItem,
  StepperRevisitContext,
} from './stepper.component';

/**
 * ============================================================================
 *  The lifecycle in the component — `NV-05-M1`, `NV-05-I2`, `NV-05-I11`
 * ============================================================================
 *
 * Two axes, and the whole point is that they are separable. `status` pins what a
 * step LOOKS LIKE and still outranks everything, exactly as it did before the
 * machine existed; `lifecycle` says where the step IS, and is what the gate and
 * the transition names read; `valid` is a third, independent fact that touches
 * neither.
 */

const WIZARD: StepperItem[] = [
  { id: 'a', label: 'Account' },
  { id: 'b', label: 'Billing' },
  { id: 'c', label: 'Shipping' },
  { id: 'd', label: 'Confirm' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const { fixture } = await render(SvStepperComponent, {
    inputs: { items: WIZARD, ...inputs },
  });
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;
const stepAt = (f: Fixture, i: number) => f.componentInstance.normalizedSteps()[i];
const lifecycles = (f: Fixture) => f.componentInstance.normalizedSteps().map(s => s.lifecycle);
const presentations = (f: Fixture) => f.componentInstance.normalizedSteps().map(s => s.state);

describe('SvStepperComponent — lifecycle derivation', () => {
  /** The rule this component always had, now named. */
  it('derives complete / active / pending from position when the host says nothing', async () => {
    const f = await setup({ activeIndex: 1 });
    expect(lifecycles(f)).toEqual(['complete', 'active', 'pending', 'pending']);
  });

  it('honours an explicit lifecycle over the position', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'Account', lifecycle: 'complete' },
      { id: 'b', label: 'Billing', lifecycle: 'skipped', optional: true },
      { id: 'c', label: 'Shipping', lifecycle: 'active' },
      { id: 'd', label: 'Confirm', lifecycle: 'pending' },
    ];
    const f = await setup({ items, activeIndex: 0 });
    expect(lifecycles(f)).toEqual(['complete', 'skipped', 'active', 'pending']);
  });

  /**
   * ★★ THE BACKWARD-COMPATIBILITY PROMISE, PINNED. A host that was setting
   *    `status` gets the identical render, and the lifecycle is inferred from it
   *    rather than from the position.
   */
  it('infers a lifecycle from a pinned presentation status', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'A', status: 'complete' },
      { id: 'b', label: 'B', status: 'warning' },
      { id: 'c', label: 'C', status: 'disabled' },
      { id: 'd', label: 'D', status: 'error' },
    ];
    const f = await setup({ items, activeIndex: 0 });
    expect(lifecycles(f)).toEqual(['complete', 'error', 'pending', 'error']);
    expect(presentations(f)).toEqual(['complete', 'warning', 'disabled', 'error']);
  });

  it('lets `status` outrank `lifecycle` for the look while the lifecycle still drives the machine', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'A', lifecycle: 'complete', status: 'warning' },
      { id: 'b', label: 'B' },
    ];
    const f = await setup({ items, activeIndex: 1 });
    expect(stepAt(f, 0).state).toBe('warning');
    expect(stepAt(f, 0).lifecycle).toBe('complete');
  });
});

describe('SvStepperComponent — complete is not valid (NV-05-I11)', () => {
  /**
   * ★★★ THE HEADLINE. The step is finished and its data is wrong, and before
   *     this there was no way to say both: the host had to choose between
   *     showing it done (hiding the problem) and showing it errored (claiming
   *     the user never finished).
   */
  it('renders a complete-but-invalid step as a warning while keeping it complete', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'A', lifecycle: 'complete', valid: false },
      { id: 'b', label: 'B' },
    ];
    const f = await setup({ items, activeIndex: 1 });
    expect(stepAt(f, 0).lifecycle).toBe('complete');
    expect(stepAt(f, 0).state).toBe('warning');
  });

  it('reports complete and valid as two independent fields', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'A', lifecycle: 'complete', valid: false },
      { id: 'b', label: 'B', lifecycle: 'complete', valid: true },
    ];
    const f = await setup({ items, activeIndex: 1 });
    expect(f.componentInstance.flowStatus()).toEqual({
      complete: true,
      valid: false,
      errored: false,
      firstIncompleteIndex: -1,
      unsettledCount: 0,
    });
  });

  it('is complete and valid only when every required step is done', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'A', lifecycle: 'complete' },
      { id: 'b', label: 'B', lifecycle: 'skipped', optional: true },
      { id: 'c', label: 'C', lifecycle: 'complete' },
    ];
    const f = await setup({ items, activeIndex: 2 });
    expect(f.componentInstance.flowStatus()).toEqual({
      complete: true,
      valid: true,
      errored: false,
      firstIncompleteIndex: -1,
      unsettledCount: 0,
    });
  });

  it('names the first unfinished required step', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'A', lifecycle: 'complete' },
      { id: 'b', label: 'B', lifecycle: 'skipped', optional: true },
      { id: 'c', label: 'C', lifecycle: 'error' },
      { id: 'd', label: 'D', lifecycle: 'pending' },
    ];
    const f = await setup({ items, activeIndex: 2 });
    const status = f.componentInstance.flowStatus();
    expect(status.complete).toBe(false);
    expect(status.errored).toBe(true);
    expect(status.firstIncompleteIndex).toBe(2);
    expect(status.unsettledCount).toBe(2);
  });

  /** A skipped required step is NOT a finished one. */
  it('does not treat a skipped required step as complete', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'A', lifecycle: 'skipped' },
      { id: 'b', label: 'B', lifecycle: 'complete' },
    ];
    const f = await setup({ items, activeIndex: 1 });
    expect(f.componentInstance.flowStatus().complete).toBe(false);
    expect(f.componentInstance.flowStatus().firstIncompleteIndex).toBe(0);
  });

  it('exposes both axes per step through stepStates()', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'A', lifecycle: 'complete', valid: false },
    ];
    const f = await setup({ items, activeIndex: 0 });
    expect(f.componentInstance.stepStates()).toEqual([
      { id: 'a', index: 0, lifecycle: 'complete', presentation: 'warning', valid: false },
    ]);
  });

  it('emits flowStatusChange once per distinct status', async () => {
    const f = await setup({ activeIndex: 0 });
    const seen: StepperFlowStatus[] = [];
    f.componentInstance.flowStatusChange.subscribe(s => seen.push(s));

    f.componentInstance.onSelect(stepAt(f, 2));
    f.detectChanges();
    // Same items, same derived status → a re-render must not re-emit.
    f.detectChanges();

    expect(seen.length).toBe(1);
    expect(seen[0].firstIncompleteIndex).toBe(2);
  });
});

describe('SvStepperComponent — a skipped step is settled (NV-05-M1)', () => {
  const withSkip: StepperItem[] = [
    { id: 'a', label: 'A', lifecycle: 'complete' },
    { id: 'b', label: 'B', lifecycle: 'skipped', optional: true },
    { id: 'c', label: 'C', lifecycle: 'active' },
    { id: 'd', label: 'D', lifecycle: 'pending' },
  ];

  /**
   * ★ The free twin has no `linear` gate, so the half of `NV-05-M1` that shows
   *   up here is the RENDER: a skipped step had no appearance of its own, so a
   *   host modelling one had to lie about it — `pending` invites the user back
   *   into a step the flow deliberately passed, `complete` claims work nobody
   *   did. The gating half is asserted in the Pro twin's copy of this spec.
   */
  it('draws a skipped step with a minus, struck through, on a traversed rail', async () => {
    const f = await setup({ items: withSkip, activeIndex: 2 });
    const step = stepAt(f, 1);
    expect(f.componentInstance.stepIconName(step)).toBe('minus');
    expect(f.componentInstance.labelClass(step)).toContain('line-through');
    expect(f.componentInstance.connectorClass(step)).toBe('bg-gray-400 dark:bg-gray-500');
  });

  it('reports a skipped step as settled but not complete', async () => {
    const f = await setup({ items: withSkip, activeIndex: 2 });
    const status = f.componentInstance.flowStatus();
    expect(status.unsettledCount).toBe(2);
    expect(stepAt(f, 1).state).toBe('skipped');
  });
});

describe('SvStepperComponent — named transitions (NV-05-M1)', () => {
  it('reports a first arrival as `enter`', async () => {
    const f = await setup({ activeIndex: 0 });
    const seen: string[] = [];
    f.componentInstance.stepTransition.subscribe(e => seen.push(`${e.transition}:${e.from}`));

    f.componentInstance.onSelect(stepAt(f, 2));

    expect(seen).toEqual(['enter:pending']);
  });

  /**
   * ★ `stepChange` cannot tell these apart, which is why `stepTransition`
   *   exists: both moves land on index 0, and only one of them is a revisit.
   */
  it('reports a return to a finished step as `reopen`', async () => {
    const f = await setup({ activeIndex: 2 });
    const seen: string[] = [];
    f.componentInstance.stepTransition.subscribe(e => seen.push(`${e.transition}:${e.from}`));

    f.componentInstance.onSelect(stepAt(f, 0));

    expect(seen).toEqual(['reopen:complete']);
  });

  it('reports reopen for a step the host marked errored', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'A', lifecycle: 'error' },
      { id: 'b', label: 'B', lifecycle: 'active' },
    ];
    const f = await setup({ items, activeIndex: 1 });
    const seen: string[] = [];
    f.componentInstance.stepTransition.subscribe(e => seen.push(e.transition));

    f.componentInstance.onSelect(stepAt(f, 0));

    expect(seen).toEqual(['reopen']);
  });
});

describe('SvStepperComponent — revisiting an earlier step (NV-05-I2)', () => {
  const partlyDone: StepperItem[] = [
    { id: 'a', label: 'A', lifecycle: 'complete' },
    { id: 'b', label: 'B', lifecycle: 'complete' },
    { id: 'c', label: 'C', lifecycle: 'complete' },
    { id: 'd', label: 'D', lifecycle: 'pending' },
  ];

  /**
   * ★★ THE DEFAULT IS TODAY'S BEHAVIOUR, and this assertion is what stops the
   *    default drifting. Before `revisitPolicy` there was no defined effect at
   *    all, so anything other than "nothing" would start invalidating work in
   *    wizards that never asked for it.
   */
  it('invalidates nothing under the default policy', async () => {
    const f = await setup({ items: partlyDone, activeIndex: 2 });
    const seen: StepperInvalidationEvent[] = [];
    f.componentInstance.stepsInvalidated.subscribe(e => seen.push(e));

    f.componentInstance.onSelect(stepAt(f, 0));

    expect(f.componentInstance.activeIndex()).toBe(0);
    expect(seen).toEqual([]);
  });

  it('names every non-pending later step under `invalidate-later`', async () => {
    const f = await setup({ items: partlyDone, activeIndex: 2, revisitPolicy: 'invalidate-later' });
    const seen: StepperInvalidationEvent[] = [];
    f.componentInstance.stepsInvalidated.subscribe(e => seen.push(e));

    f.componentInstance.onSelect(stepAt(f, 0));

    expect(seen).toHaveLength(1);
    expect(seen[0].stepIds).toEqual(['b', 'c']);
    expect(seen[0].transition).toBe('reset');
    expect(seen[0].index).toBe(0);
    expect(seen[0].previousIndex).toBe(2);
  });

  /** A step that is already pending is already invalid; re-reporting it is noise. */
  it('leaves an already-pending later step out of the event', async () => {
    const f = await setup({ items: partlyDone, activeIndex: 2, revisitPolicy: 'invalidate-later' });
    const seen: StepperInvalidationEvent[] = [];
    f.componentInstance.stepsInvalidated.subscribe(e => seen.push(e));

    f.componentInstance.onSelect(stepAt(f, 0));

    expect(seen[0].stepIds).not.toContain('d');
  });

  /** Forwards is not a revisit. */
  it('emits nothing when the move is forwards', async () => {
    const f = await setup({ items: partlyDone, activeIndex: 0, revisitPolicy: 'invalidate-later' });
    const seen: StepperInvalidationEvent[] = [];
    f.componentInstance.stepsInvalidated.subscribe(e => seen.push(e));

    f.componentInstance.onSelect(stepAt(f, 2));

    expect(seen).toEqual([]);
  });

  /**
   * ★★★ ONLY THE CONSUMER KNOWS WHICH STEPS A REVISIT BREAKS, so the API lets
   *     them say. Editing the address invalidates shipping and nothing else.
   */
  it('asks the host which steps a revisit invalidates under `custom`', async () => {
    const contexts: StepperRevisitContext[] = [];
    const f = await setup({
      items: partlyDone,
      activeIndex: 2,
      revisitPolicy: 'custom',
      invalidatesOnRevisit: (c: StepperRevisitContext) => {
        contexts.push(c);
        return c.step.id === 'a' ? ['c'] : [];
      },
    });
    const seen: StepperInvalidationEvent[] = [];
    f.componentInstance.stepsInvalidated.subscribe(e => seen.push(e));

    f.componentInstance.onSelect(stepAt(f, 0));

    expect(contexts).toHaveLength(1);
    expect(contexts[0].previousIndex).toBe(2);
    expect(contexts[0].lifecycles).toEqual(['complete', 'complete', 'complete', 'pending']);
    expect(seen).toHaveLength(1);
    expect(seen[0].stepIds).toEqual(['c']);
  });

  /** An id that names no visible step would be a silent no-op for the host. */
  it('drops ids that are not visible steps', async () => {
    const f = await setup({
      items: partlyDone,
      activeIndex: 2,
      revisitPolicy: 'custom',
      invalidatesOnRevisit: () => ['ghost', 'b'],
    });
    const seen: StepperInvalidationEvent[] = [];
    f.componentInstance.stepsInvalidated.subscribe(e => seen.push(e));

    f.componentInstance.onSelect(stepAt(f, 0));

    expect(seen[0].stepIds).toEqual(['b']);
  });

  it('emits nothing when the host names no steps', async () => {
    const f = await setup({
      items: partlyDone,
      activeIndex: 2,
      revisitPolicy: 'custom',
      invalidatesOnRevisit: () => [],
    });
    const seen: StepperInvalidationEvent[] = [];
    f.componentInstance.stepsInvalidated.subscribe(e => seen.push(e));

    f.componentInstance.onSelect(stepAt(f, 0));

    expect(seen).toEqual([]);
  });

  /** `custom` with nothing to ask is a wiring mistake, and silently inert. */
  it('warns once when `custom` has no namer', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const f = await setup({ items: partlyDone, activeIndex: 2, revisitPolicy: 'custom' });

    f.componentInstance.onSelect(stepAt(f, 0));
    f.componentInstance.onSelect(stepAt(f, 2));
    f.componentInstance.onSelect(stepAt(f, 1));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('invalidatesOnRevisit');
    warn.mockRestore();
  });

});
