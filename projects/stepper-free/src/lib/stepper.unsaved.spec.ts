import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvStepperComponent } from './stepper.component';
import type { StepperChangeRequest, StepperItem, StepperLeaveReason } from './stepper.component';

/**
 * ============================================================================
 *  Leaving a step with unsaved work — `NV-05-I8`
 * ============================================================================
 *
 * ★★ THE PROMPT IS `createCloseGuard`, the same primitive Modal, Drawer and
 *    Confirm Dialog use (`X-11`, `docs/close-policy-adr.md`). What is tested
 *    here is the STEPPER's use of it — the order the questions are asked in, the
 *    step the answer applies to, and the paths that deliberately do NOT ask.
 *    The primitive's own rules are covered once, in core.
 */

const WIZARD: StepperItem[] = [
  { id: 'a', label: 'Account' },
  { id: 'b', label: 'Billing' },
  { id: 'c', label: 'Shipping' },
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
const prompt = (f: Fixture) =>
  (f.nativeElement as HTMLElement).querySelector('[data-sv-state="unsaved-prompt"]');

describe('SvStepperComponent — the unsaved-changes prompt', () => {
  /**
   * ★★★ THE HEADLINE. One click on another step abandoned everything the user
   *     had typed into the current one, with no warning and no undo.
   */
  it('asks instead of moving when the step is dirty', async () => {
    const f = await setup({ activeIndex: 0, dirty: true });

    f.componentInstance.onSelect(stepAt(f, 2));
    f.detectChanges();

    expect(f.componentInstance.activeIndex()).toBe(0);
    expect(f.componentInstance.promptingDiscard()).toBe(true);
    expect(f.componentInstance.promptedReason()).toBe('step-select');
    expect(prompt(f)).not.toBeNull();
  });

  /**
   * ★★ THE BACKWARD-COMPATIBILITY PROMISE. A stepper that has not adopted the
   *    policy must be byte-identical: no prompt, no held state, no extra render.
   */
  it('moves straight away when nothing is dirty and no guard is set', async () => {
    const f = await setup({ activeIndex: 0 });

    f.componentInstance.onSelect(stepAt(f, 2));
    f.detectChanges();

    expect(f.componentInstance.activeIndex()).toBe(2);
    expect(f.componentInstance.promptingDiscard()).toBe(false);
    expect(prompt(f)).toBeNull();
  });

  it('completes the move when the user discards', async () => {
    const f = await setup({ activeIndex: 0, dirty: true });
    const discarded: StepperLeaveReason[] = [];
    f.componentInstance.discarded.subscribe(r => discarded.push(r));

    f.componentInstance.onSelect(stepAt(f, 2));
    f.componentInstance.discardChanges();
    f.detectChanges();

    expect(f.componentInstance.activeIndex()).toBe(2);
    // ★ The reason the USER acted on, not `programmatic` — the prompt was an
    //   interruption in the middle of a step click, not a new kind of move.
    expect(discarded).toEqual(['step-select']);
    expect(f.componentInstance.promptingDiscard()).toBe(false);
    expect(prompt(f)).toBeNull();
  });

  it('stays put when the user keeps editing', async () => {
    const f = await setup({ activeIndex: 0, dirty: true });
    const cancelled: StepperLeaveReason[] = [];
    const changes: number[] = [];
    f.componentInstance.leaveCancelled.subscribe(r => cancelled.push(r));
    f.componentInstance.stepChange.subscribe(e => changes.push(e.currentIndex));

    f.componentInstance.onSelect(stepAt(f, 2));
    f.componentInstance.keepEditing();
    f.detectChanges();

    expect(f.componentInstance.activeIndex()).toBe(0);
    expect(changes).toEqual([]);
    expect(cancelled).toEqual(['step-select']);
    expect(prompt(f)).toBeNull();
  });

  /**
   * ★ The prompt remembers WHICH step it is standing in front of. Forgetting it
   *   would make Discard either do nothing or move to whatever step was clicked
   *   most recently, which is not the one the question was asked about.
   */
  it('discards onto the step that was actually clicked', async () => {
    const f = await setup({ activeIndex: 0, dirty: true });

    f.componentInstance.onSelect(stepAt(f, 1));
    // A second click while the prompt is up must not re-target it.
    f.componentInstance.onSelect(stepAt(f, 2));
    f.componentInstance.discardChanges();

    expect(f.componentInstance.activeIndex()).toBe(1);
  });

  /** One click, one click event — even though Discard re-enters the activation. */
  it('does not double-count the click when the move resumes', async () => {
    const f = await setup({ activeIndex: 0, dirty: true });
    const clicks: number[] = [];
    f.componentInstance.stepClick.subscribe(e => clicks.push(e.index));

    f.componentInstance.onSelect(stepAt(f, 2));
    f.componentInstance.discardChanges();

    expect(clicks).toEqual([2]);
  });

  /** Re-selecting the step you are on is not leaving it. */
  it('does not prompt when the selected step is the active one', async () => {
    const f = await setup({ activeIndex: 1, dirty: true });

    f.componentInstance.onSelect(stepAt(f, 1));

    expect(f.componentInstance.promptingDiscard()).toBe(false);
  });

  /** A refused step never gets as far as the question. */
  it('does not prompt when the step is blocked anyway', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'Account' },
      { id: 'b', label: 'Billing' },
      { id: 'c', label: 'Shipping', status: 'disabled' },
    ];
    const f = await setup({ items, activeIndex: 0, dirty: true });

    f.componentInstance.onSelect(stepAt(f, 2));

    expect(f.componentInstance.promptingDiscard()).toBe(false);
    expect(f.componentInstance.activeIndex()).toBe(0);
  });

  it('can be driven by the host instead of rendering its own prompt', async () => {
    const f = await setup({ activeIndex: 0, dirty: true, showUnsavedPrompt: false });

    f.componentInstance.onSelect(stepAt(f, 2));
    f.detectChanges();

    expect(f.componentInstance.promptingDiscard()).toBe(true);
    expect(prompt(f)).toBeNull();
  });

  it('gives the prompt an alertdialog role wired to its own copy', async () => {
    const f = await setup({
      activeIndex: 0,
      dirty: true,
      unsavedTitle: 'Hold on',
      unsavedMessage: 'Two fields are unsaved.',
    });

    f.componentInstance.onSelect(stepAt(f, 2));
    f.detectChanges();

    const el = prompt(f) as HTMLElement;
    expect(el.getAttribute('role')).toBe('alertdialog');
    expect(el.getAttribute('aria-modal')).toBeNull();
    const labelId = el.getAttribute('aria-labelledby');
    const describedId = el.getAttribute('aria-describedby');
    expect(el.querySelector(`#${labelId}`)?.textContent?.trim()).toBe('Hold on');
    expect(el.querySelector(`#${describedId}`)?.textContent?.trim()).toBe('Two fields are unsaved.');
  });

  /** ★ "Prompt appeared, press Enter" must not throw the user's work away. */
  it('puts Keep editing ahead of Discard in the tab order', async () => {
    const f = await setup({ activeIndex: 0, dirty: true });

    f.componentInstance.onSelect(stepAt(f, 2));
    f.detectChanges();

    const buttons = [...(prompt(f) as HTMLElement).querySelectorAll('button')];
    expect(buttons[0].hasAttribute('data-sv-keep-editing')).toBe(true);
    expect(buttons[1].hasAttribute('data-sv-discard')).toBe(true);
  });
});

describe('SvStepperComponent — the host veto on leaving', () => {
  /**
   * ★★ A HOST VETO AND A DIRTY PROMPT ARE DIFFERENT REFUSALS — the close-policy
   *    ADR's rule, inherited whole. A veto is the host saying "not now" for its
   *    own reasons, with its own messaging, so it must NOT raise the
   *    unsaved-changes prompt: doing so tells a user their work is at risk when
   *    the real reason was a request in flight.
   */
  it('refuses the move without raising the prompt', async () => {
    const f = await setup({ activeIndex: 0, dirty: true, canLeaveStep: () => false });

    f.componentInstance.onSelect(stepAt(f, 2));
    f.detectChanges();

    expect(f.componentInstance.activeIndex()).toBe(0);
    expect(f.componentInstance.promptingDiscard()).toBe(false);
    expect(prompt(f)).toBeNull();
  });

  /** `void` means "no opinion", so a guard that cares about one case is one `if`. */
  it('treats a guard that returns nothing as no objection', async () => {
    const f = await setup({ activeIndex: 0, canLeaveStep: () => undefined });

    f.componentInstance.onSelect(stepAt(f, 2));

    expect(f.componentInstance.activeIndex()).toBe(2);
  });

  it('tells the guard why the step is being left', async () => {
    const reasons: StepperLeaveReason[] = [];
    const f = await setup({
      activeIndex: 0,
      canLeaveStep: (reason: StepperLeaveReason) => { reasons.push(reason); },
    });

    f.componentInstance.onSelect(stepAt(f, 2));

    expect(reasons).toEqual(['step-select']);
  });

  /** The veto is consulted BEFORE the dirty check, so it wins outright. */
  it('is consulted before the dirty check', async () => {
    const order: string[] = [];
    const f = await setup({
      activeIndex: 0,
      dirty: true,
      canLeaveStep: () => { order.push('guard'); return false; },
    });

    f.componentInstance.onSelect(stepAt(f, 2));

    expect(order).toEqual(['guard']);
    expect(f.componentInstance.promptingDiscard()).toBe(false);
  });
});

describe('SvStepperComponent — what the prompt runs before', () => {
  /**
   * ★★ THE BRANCH SWITCH IS A VISIBLE SIDE EFFECT: it changes which steps
   *    exist. Running it before the prompt would leave the user looking at a
   *    different workflow while being asked whether to leave the step they are
   *    still on.
   */
  it('does not switch branch while the prompt is up', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'Account' },
      { id: 'b', label: 'Business', selectsBranch: 'biz' },
      { id: 'biz-tax', label: 'Tax', branch: 'biz' },
    ];
    const f = await setup({ items, mode: 'branch', activeIndex: 0, dirty: true });

    f.componentInstance.onSelect(stepAt(f, 1));

    expect(f.componentInstance.activeBranch()).toBeNull();
    expect(f.componentInstance.promptingDiscard()).toBe(true);

    f.componentInstance.discardChanges();
    expect(f.componentInstance.activeBranch()).toBe('biz');
  });

  /**
   * ★ Discard resumes the ACTIVATION, not just the index write, so
   *   `asyncValidation` still gets its say. Skipping it would let the unsaved
   *   prompt become a way round the server validation.
   */
  it('still asks the host to validate after a discard', async () => {
    const requests: StepperChangeRequest[] = [];
    const f = await setup({ activeIndex: 0, dirty: true, asyncValidation: true });
    f.componentInstance.stepChangeRequest.subscribe(r => requests.push(r));

    f.componentInstance.onSelect(stepAt(f, 2));
    expect(requests).toHaveLength(0);

    f.componentInstance.discardChanges();
    expect(requests).toHaveLength(1);
    expect(f.componentInstance.activeIndex()).toBe(0);

    requests[0].allow();
    expect(f.componentInstance.activeIndex()).toBe(2);
  });
});
