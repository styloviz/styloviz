import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { SvStepperComponent, type StepperBlockedEvent, type StepperChangeRequest, type StepperItem } from './stepper.component';

/**
 * ============================================================================
 *  A refused move is spoken — FL-J3-NV-05 (`NV-05-I4`)
 * ============================================================================
 *
 * `stepBlocked` carried a reason and nothing said it, so a screen-reader user's
 * Next did nothing, silently. The refusal now goes through the kit's one live
 * region with the step and the reason.
 */

const STEPS: StepperItem[] = [
  { id: 'account', label: 'Account' },
  { id: 'billing', label: 'Billing', status: 'disabled' },
  { id: 'confirm', label: 'Confirm' },
];

async function setup(inputs: Partial<ComponentInput<SvStepperComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStepperComponent, {
    inputs: { items: STEPS, ...inputs } as ComponentInput<SvStepperComponent>,
  });
  const announce = vi.spyOn(TestBed.inject(SvLiveAnnouncer), 'announce');
  const blocked: StepperBlockedEvent[] = [];
  fixture.componentInstance.stepBlocked.subscribe((e) => blocked.push(e));
  return { fixture, cmp: fixture.componentInstance, announce, blocked };
}

describe('SvStepperComponent — blocked moves are announced (FL-J3-NV-05)', () => {
  it('a disabled step: emits stepBlocked AND speaks the step and the reason', async () => {
    const { cmp, announce, blocked } = await setup();
    cmp.onSelect(cmp.normalizedSteps()[1]);
    expect(blocked.map((b) => b.reason)).toEqual(['disabled']);
    expect(announce).toHaveBeenCalledWith('Cannot go to Billing. This step is not available.', { force: true });
  });

  it('a host refusal speaks the host\'s own reason text', async () => {
    const { cmp, announce, fixture } = await setup({ asyncValidation: true });
    fixture.componentInstance.stepChangeRequest.subscribe((r: StepperChangeRequest) => r.deny('Enter an email address.'));
    cmp.onSelect(cmp.normalizedSteps()[2]);
    expect(announce).toHaveBeenCalledWith('Cannot go to Confirm. Enter an email address.', { force: true });
  });

  it('a host refusal with no reason speaks the built-in validation reason', async () => {
    const { cmp, announce, fixture } = await setup({ asyncValidation: true });
    fixture.componentInstance.stepChangeRequest.subscribe((r: StepperChangeRequest) => r.deny());
    cmp.onSelect(cmp.normalizedSteps()[2]);
    expect(announce).toHaveBeenCalledWith('Cannot go to Confirm. Finish the current step first.', { force: true });
  });

  it('announceBlocked=false leaves the announcement to the host (the event still fires)', async () => {
    const { cmp, announce, blocked } = await setup({ announceBlocked: false });
    cmp.onSelect(cmp.normalizedSteps()[1]);
    expect(blocked).toHaveLength(1);
    expect(announce).not.toHaveBeenCalled();
  });

  it('an allowed move announces nothing', async () => {
    const { cmp, announce } = await setup();
    cmp.onSelect(cmp.normalizedSteps()[2]);
    expect(announce).not.toHaveBeenCalled();
  });

  it('really reaches the live region', async () => {
    const { cmp } = await setup();
    cmp.onSelect(cmp.normalizedSteps()[1]);
    const regions = [...document.querySelectorAll('[aria-live]')].map((r) => r.textContent ?? '').join(' ');
    expect(regions).toContain('Cannot go to Billing.');
  });
});
