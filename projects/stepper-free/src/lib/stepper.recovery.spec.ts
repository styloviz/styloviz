import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { until } from '@testing/async';
import { SvStepperComponent } from './stepper.component';
import type {
  StepperBlockedEvent,
  StepperChangeRequest,
  StepperItem,
} from './stepper.component';
import { svSerializeStepperResume } from './stepper.resume';

/**
 * ============================================================================
 *  Where focus goes when the step holding it disappears — `X-14`
 * ============================================================================
 *
 * ★ Focus on `<body>` is focus at the TOP OF THE DOCUMENT: the next Tab goes to
 * the site's first link. Three ways the stepper used to send it there:
 *
 *   · `NV-05-I1` — the host (or a branch switch) removes the focused step;
 *   · `NV-05-I8` — Keep editing / Discard unmount the prompt that holds focus;
 *
 * and one resume bug in the same family, `NV-05-I7`: a stored step that exists
 * only in the stored branch was looked up before the branch was applied.
 */

const STEPS: StepperItem[] = [
  { id: 'a', label: 'Account' },
  { id: 'b', label: 'Billing' },
  { id: 'c', label: 'Confirm' },
];

const FLOW: StepperItem[] = [
  { id: 'type', label: 'Account type' },
  { id: 'personal', label: 'Personal details', branch: 'b2c' },
  { id: 'company', label: 'Company details', branch: 'b2b' },
  { id: 'done', label: 'Finish' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStepperComponent, { inputs: { items: STEPS, ...inputs } });
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;

const button = (f: Fixture, id: string) =>
  (f.nativeElement as HTMLElement).querySelector<HTMLElement>(
    `[id="stepper-item-${f.componentInstance._uid}-${id}"]`,
  );
const focusedStep = (f: Fixture) => {
  const prefix = `stepper-item-${f.componentInstance._uid}-`;
  const id = document.activeElement?.id ?? '';
  return id.startsWith(prefix) ? id.slice(prefix.length) : null;
};
const settled = (f: Fixture, label: string) =>
  until(
    () => {
      f.detectChanges();
      return document.activeElement !== document.body && !!document.activeElement?.isConnected;
    },
    { label },
  );

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('SvStepperComponent — focus when steps disappear (NV-05-I1)', () => {
  it('moves focus to the corrected active step when the focused step is removed', async () => {
    const f = await setup({ activeIndex: 2 });
    button(f, 'c')!.focus();

    f.componentRef.setInput('items', STEPS.slice(0, 2));
    f.detectChanges();
    await settled(f, 'focus lands on a rendered step');

    expect(document.activeElement).not.toBe(document.body);
    expect(f.componentInstance.clampedActiveIndex()).toBe(1);
    expect(focusedStep(f)).toBe('b');
  });

  it('moves focus to the active step when a branch switch removes the focused one', async () => {
    const f = await setup({ items: FLOW, mode: 'branch', activeBranch: 'b2b', activeIndex: 1 });
    button(f, 'company')!.focus();

    f.componentInstance.activeBranch.set('b2c');
    f.detectChanges();
    await settled(f, 'focus lands on the new branch');

    expect(focusedStep(f)).toBe('personal');
  });
});

describe('SvStepperComponent — resuming a branched flow (NV-05-I7)', () => {
  it('applies the stored branch before looking the stored step up', async () => {
    localStorage.setItem(
      'onboarding',
      JSON.stringify(svSerializeStepperResume({ stepId: 'company', branch: 'b2b' })),
    );
    const f = await setup({ items: FLOW, mode: 'branch', persistKey: 'onboarding' });

    expect(f.componentInstance.activeBranch()).toBe('b2b');
    const { visibleItems, clampedActiveIndex } = f.componentInstance;
    expect(visibleItems()[clampedActiveIndex()].id).toBe('company');
  });
});

describe('SvStepperComponent — focus after the unsaved prompt (NV-05-I8)', () => {
  const promptButton = (f: Fixture, attr: string) =>
    (f.nativeElement as HTMLElement).querySelector<HTMLElement>(`[${attr}]`);

  async function prompted() {
    const f = await setup({ activeIndex: 0, dirty: true });
    button(f, 'c')!.focus();
    f.componentInstance.onSelect(f.componentInstance.normalizedSteps()[2]);
    f.detectChanges();
    await until(() => document.activeElement === promptButton(f, 'data-sv-keep-editing'), {
      label: 'the prompt takes focus',
    });
    return f;
  }

  it('returns focus to the step the user pressed on Keep editing', async () => {
    const f = await prompted();
    promptButton(f, 'data-sv-keep-editing')!.click();
    f.detectChanges();
    await settled(f, 'focus leaves the unmounted prompt');

    expect(f.componentInstance.activeIndex()).toBe(0);
    expect(focusedStep(f)).toBe('c');
  });

  it('puts focus on the step moved to on Discard', async () => {
    const f = await prompted();
    promptButton(f, 'data-sv-discard')!.click();
    f.detectChanges();
    await settled(f, 'focus leaves the unmounted prompt');

    expect(f.componentInstance.activeIndex()).toBe(2);
    expect(focusedStep(f)).toBe('c');
  });

  it('cancels the pending prompt focus on destroy', async () => {
    const f = await setup({ activeIndex: 0, dirty: true });
    f.componentInstance.onSelect(f.componentInstance.normalizedSteps()[2]);
    f.detectChanges();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');

    f.destroy();
    await new Promise((resolve) => setTimeout(resolve));

    expect(focus).not.toHaveBeenCalled();
    focus.mockRestore();
  });
});

describe('SvStepperComponent — a denied async move', () => {
  it("reports 'validation' when the host denies without a reason", async () => {
    const f = await setup({ asyncValidation: true });
    const seen: StepperChangeRequest[] = [];
    const blocked: StepperBlockedEvent[] = [];
    f.componentInstance.stepChangeRequest.subscribe((r) => seen.push(r));
    f.componentInstance.stepBlocked.subscribe((b) => blocked.push(b));

    f.componentInstance.onSelect(f.componentInstance.normalizedSteps()[1]);
    seen[0].deny();

    expect(blocked[0].reason).toBe('validation');
  });
});
