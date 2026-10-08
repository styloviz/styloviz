import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { until } from '@testing/async';
import { SvStepperComponent } from './stepper.component';
import type { StepperBranchChangeEvent, StepperItem } from './stepper.component';

/**
 * ============================================================================
 *  Branch mode — conditional flows
 * ============================================================================
 *
 * Branch mode is NOT a Pro-only feature; the telemetry stream that reports it
 * is. So this file mirrors the Pro branch spec's behaviour assertions and
 * replaces its telemetry assertions with the absence of that output — see the
 * last test.
 */

const FLOW: StepperItem[] = [
  { id: 'type', label: 'Account type', selectsBranch: 'b2c' },
  { id: 'personal', label: 'Personal details', branch: 'b2c' },
  { id: 'company', label: 'Company details', branch: 'b2b' },
  { id: 'done', label: 'Finish' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStepperComponent, {
    inputs: { items: FLOW, mode: 'branch', ...inputs },
  });
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;
const ids = (f: Fixture) => f.componentInstance.visibleItems().map((i) => i.id);
const stepAt = (f: Fixture, i: number) => f.componentInstance.normalizedSteps()[i];

describe('SvStepperComponent — branch visibility', () => {
  it('hides every branch-specific step while no branch is active', async () => {
    const f = await setup({ activeBranch: null });
    expect(ids(f)).toEqual(['type', 'done']);
  });

  it('shows only the active branch’s steps', async () => {
    const f = await setup({ activeBranch: 'b2b' });
    expect(ids(f)).toEqual(['type', 'company', 'done']);
  });

  it('falls back to the shared steps for a branch key nothing declares', async () => {
    const f = await setup({ activeBranch: 'nope' });
    expect(ids(f)).toEqual(['type', 'done']);
  });

  it('shows every step in standard mode regardless of branch keys', async () => {
    const f = await setup({ mode: 'standard', activeBranch: 'b2c' });
    expect(ids(f)).toEqual(['type', 'personal', 'company', 'done']);
  });

  /** Indices are positions in the VISIBLE flow, not in the raw item array. */
  it('renumbers the indicator text over the visible flow', async () => {
    const f = await setup({ activeBranch: 'b2b' });
    const steps = f.componentInstance.normalizedSteps();
    expect(steps.map((s) => f.componentInstance.indicatorText(s))).toEqual(['1', '2', '3']);
    expect(steps[1].item.id).toBe('company');
  });

  it('clamps the active index when a branch switch shortens the flow', async () => {
    const f = await setup({ activeBranch: 'b2b', activeIndex: 2 });
    expect(f.componentInstance.clampedActiveIndex()).toBe(2);

    f.componentInstance.activeBranch.set(null);
    f.detectChanges();

    expect(f.componentInstance.visibleItems()).toHaveLength(2);
    expect(f.componentInstance.clampedActiveIndex()).toBe(1);
  });
});

describe('SvStepperComponent — switching branch', () => {
  it('sets the branch and emits branchChange', async () => {
    const f = await setup({ activeBranch: null, activeIndex: 1 });
    const branches: StepperBranchChangeEvent[] = [];
    f.componentInstance.branchChange.subscribe((e) => branches.push(e));

    f.componentInstance.onSelect(stepAt(f, 0));

    expect(f.componentInstance.activeBranch()).toBe('b2c');
    expect(branches).toEqual([
      expect.objectContaining({ branch: 'b2c', step: expect.objectContaining({ id: 'type' }) }),
    ]);
  });

  it('does not re-emit branchChange when the branch is already active', async () => {
    const f = await setup({ activeBranch: 'b2c', activeIndex: 1 });
    let switches = 0;
    f.componentInstance.branchChange.subscribe(() => switches++);

    f.componentInstance.onSelect(stepAt(f, 0));

    expect(switches).toBe(0);
    expect(f.componentInstance.activeBranch()).toBe('b2c');
  });

  it('leaves the active branch untouched for an ordinary step', async () => {
    const f = await setup({ activeBranch: 'b2b', activeIndex: 0 });
    let switches = 0;
    f.componentInstance.branchChange.subscribe(() => switches++);

    f.componentInstance.onSelect(stepAt(f, 2)); // 'done'

    expect(f.componentInstance.activeBranch()).toBe('b2b');
    expect(switches).toBe(0);
  });

  /** One-shot class: off, on for a beat, off again. */
  it('flashes the branch-shift class and then clears it', async () => {
    const f = await setup({ activeBranch: null, activeIndex: 1 });
    expect(f.componentInstance.branchShiftClass()).toBe('');

    f.componentInstance.onSelect(stepAt(f, 0));

    await until(() => f.componentInstance.branchShiftClass() === 'stp-branch-shift', {
      label: 'the branch-shift class to be applied',
    });
    await until(() => f.componentInstance.branchShiftClass() === '', {
      label: 'the branch-shift class to clear itself',
    });
  });
});

describe('SvStepperComponent — branch badges', () => {
  it('labels a branch-selecting step with its branch key', async () => {
    const f = await setup({ activeBranch: null });
    const step = stepAt(f, 0);
    expect(f.componentInstance.shouldShowBadge(step)).toBe(true);
    expect(f.componentInstance.badgeText(step)).toBe('b2c');
  });

  it('prefers an explicit badge over the branch key', async () => {
    const items: StepperItem[] = [{ id: 'x', label: 'X', selectsBranch: 'b2b', badge: 'New' }];
    const f = await setup({ items });
    expect(f.componentInstance.badgeText(stepAt(f, 0))).toBe('New');
  });

  it('shows no badge for a step with neither', async () => {
    const f = await setup({ activeBranch: null });
    const step = stepAt(f, 1); // 'done'
    expect(f.componentInstance.shouldShowBadge(step)).toBe(false);
    expect(f.componentInstance.badgeText(step)).toBe('');
  });
});
