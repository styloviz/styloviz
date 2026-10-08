import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import type { SvUnresolvedValue } from '@styloviz/core';
import { SvStepperComponent, type StepperItem } from './stepper.component';

/**
 * ============================================================================
 *  Controlled-value reconciliation — `X-10`, `NV-05-I1`
 * ============================================================================
 *
 * ★ **A step index is ORDINAL, so this family corrects.** `clampedActiveIndex()`
 * already clamped for DISPLAY, which is why `T0` concluded "the index half is
 * already handled" and why a removed step could not strand the render. But the
 * host's `activeIndex` kept the old value, so the DOM and the host's state
 * disagreed with nobody told — the classic controlled-component bug, one layer
 * down from where the audit was looking.
 *
 * `sv-tabs` does the opposite on the same question, because a tab id is a NAME
 * and has no nearest tab to correct to.
 */

const STEPS: StepperItem[] = [
  { id: 'account', label: 'Account' },
  { id: 'payment', label: 'Payment' },
  { id: 'confirm', label: 'Confirm' },
];

async function setup(inputs: Partial<ComponentInput<SvStepperComponent>> = {}) {
  TestBed.resetTestingModule();
  const seen: SvUnresolvedValue<number>[] = [];
  const { fixture } = await render(SvStepperComponent, {
    inputs: { items: STEPS, ...inputs } as ComponentInput<SvStepperComponent>,
    on: { unresolved: (e: SvUnresolvedValue<number>) => seen.push(e) },
  });
  return { fixture, seen };
}

describe('SvStepperComponent — a step that exists', () => {
  it('says nothing', async () => {
    const { seen } = await setup({ activeIndex: 1 });
    expect(seen).toEqual([]);
  });
});

describe('SvStepperComponent — a step that does not', () => {
  /**
   * ★ The half `T0` did not see: the display was already right, and the host's
   * state was not. Now they agree, and the host is told why.
   */
  it('corrects activeIndex, not just the render', async () => {
    const { fixture, seen } = await setup({ activeIndex: 7 });

    expect(fixture.componentInstance.activeIndex()).toBe(2);
    expect(fixture.componentInstance.clampedActiveIndex()).toBe(2);
    expect(seen).toEqual([
      { requested: 7, rendered: 2, reason: 'out-of-range', corrected: true },
    ]);
  });

  it('follows a list that shrinks underneath it', async () => {
    const { fixture, seen } = await setup({ activeIndex: 2 });
    expect(seen).toEqual([]);

    fixture.componentRef.setInput('items', STEPS.slice(0, 2));
    fixture.detectChanges();

    expect(fixture.componentInstance.activeIndex()).toBe(1);
    expect(seen.at(-1)).toMatchObject({ requested: 2, rendered: 1, corrected: true });
  });

  it('does not re-report on every change detection pass', async () => {
    const { fixture, seen } = await setup({ activeIndex: 7 });
    fixture.detectChanges();
    fixture.detectChanges();
    expect(seen).toHaveLength(1);
  });
});

describe('SvStepperComponent — before the steps have arrived', () => {
  /**
   * ★ An empty step list is not evidence that index 2 is wrong; it is evidence
   * that nothing has arrived. Correcting then resets every deep-linked and
   * resumed wizard to step one on first paint — the failure T1 spent its whole
   * length avoiding.
   */
  it('holds the index and reports not-loaded', async () => {
    const { fixture, seen } = await setup({ items: [], activeIndex: 2 });

    expect(fixture.componentInstance.activeIndex()).toBe(2);
    expect(seen).toEqual([
      { requested: 2, rendered: 2, reason: 'not-loaded', corrected: false },
    ]);
  });

  it('goes quiet once the steps arrive and the index turns out to be fine', async () => {
    const { fixture, seen } = await setup({ items: [], activeIndex: 2 });
    expect(seen).toHaveLength(1);

    fixture.componentRef.setInput('items', STEPS);
    fixture.detectChanges();

    expect(fixture.componentInstance.activeIndex()).toBe(2);
    expect(seen).toHaveLength(1);
  });
});
