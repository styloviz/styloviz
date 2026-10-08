import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvStepperComponent } from './stepper.component';
import type { StepperItem } from './stepper.component';

/**
 * ============================================================================
 *  Hotkey navigation
 * ============================================================================
 *
 * The handler itself is shared with the Pro twin, so the arrow/digit tests
 * mirror `projects/stepper/src/lib/stepper.keyboard.spec.ts`. The TAB-ORDER
 * half does not: the free template roves unconditionally
 * (`step.index === clampedActiveIndex() ? 0 : -1`) where Pro asks
 * `stepTabIndex()`. That difference is asserted at the bottom of this file,
 * because it is the whole reason the two templates are not identical.
 */

const STEPS: StepperItem[] = [
  { id: 'a', label: 'Account' },
  { id: 'b', label: 'Billing' },
  { id: 'c', label: 'Shipping' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStepperComponent, {
    inputs: { items: STEPS, enableHotkeys: true, ...inputs },
  });
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;
const stepAt = (f: Fixture, i: number) => f.componentInstance.normalizedSteps()[i];

/** Fire a key on the step at `from` and report whether the default was stopped. */
function press(f: Fixture, key: string, from: number): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  f.componentInstance.onStepKeydown(event, stepAt(f, from));
  return event.defaultPrevented;
}

describe('SvStepperComponent — hotkeys off', () => {
  /** Arrow keys belong to the page unless the host opted in. */
  it('ignores every navigation key and does not preventDefault', async () => {
    const f = await setup({ enableHotkeys: false, activeIndex: 0 });

    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End', '3']) {
      expect(press(f, key, 0), `${key} was handled`).toBe(false);
    }
    expect(f.componentInstance.activeIndex()).toBe(0);
  });
});

describe('SvStepperComponent — horizontal hotkeys', () => {
  it('moves to the next step on ArrowRight', async () => {
    const f = await setup({ activeIndex: 0 });
    expect(press(f, 'ArrowRight', 0)).toBe(true);
    expect(f.componentInstance.activeIndex()).toBe(1);
  });

  it('moves to the previous step on ArrowLeft', async () => {
    const f = await setup({ activeIndex: 2 });
    press(f, 'ArrowLeft', 2);
    expect(f.componentInstance.activeIndex()).toBe(1);
  });

  it('stays on the last step when ArrowRight runs off the end', async () => {
    const f = await setup({ activeIndex: 2 });
    press(f, 'ArrowRight', 2);
    expect(f.componentInstance.activeIndex()).toBe(2);
  });

  it('stays on the first step when ArrowLeft runs off the start', async () => {
    const f = await setup({ activeIndex: 0 });
    press(f, 'ArrowLeft', 0);
    expect(f.componentInstance.activeIndex()).toBe(0);
  });

  it('ignores ArrowDown and ArrowUp while horizontal', async () => {
    const f = await setup({ activeIndex: 1 });
    expect(press(f, 'ArrowDown', 1)).toBe(false);
    expect(press(f, 'ArrowUp', 1)).toBe(false);
    expect(f.componentInstance.activeIndex()).toBe(1);
  });

  it('jumps to the first step on Home and the last on End', async () => {
    const f = await setup({ activeIndex: 1 });
    press(f, 'End', 1);
    expect(f.componentInstance.activeIndex()).toBe(2);
    press(f, 'Home', 2);
    expect(f.componentInstance.activeIndex()).toBe(0);
  });
});

describe('SvStepperComponent — vertical hotkeys', () => {
  it('moves with ArrowDown and ArrowUp', async () => {
    const f = await setup({ orientation: 'vertical', activeIndex: 0 });
    press(f, 'ArrowDown', 0);
    expect(f.componentInstance.activeIndex()).toBe(1);
    press(f, 'ArrowUp', 1);
    expect(f.componentInstance.activeIndex()).toBe(0);
  });

  it('ignores ArrowRight and ArrowLeft while vertical', async () => {
    const f = await setup({ orientation: 'vertical', activeIndex: 1 });
    expect(press(f, 'ArrowRight', 1)).toBe(false);
    expect(press(f, 'ArrowLeft', 1)).toBe(false);
    expect(f.componentInstance.activeIndex()).toBe(1);
  });
});

describe('SvStepperComponent — digit shortcuts', () => {
  it('jumps straight to the nth step', async () => {
    const f = await setup({ activeIndex: 0 });
    expect(press(f, '3', 0)).toBe(true);
    expect(f.componentInstance.activeIndex()).toBe(2);
  });

  it('ignores a digit past the end of the flow', async () => {
    const f = await setup({ activeIndex: 1 });
    expect(press(f, '9', 1)).toBe(false);
    expect(f.componentInstance.activeIndex()).toBe(1);
  });

  /** Steps are 1-indexed on the keyboard, so `0` is not a step at all. */
  it('ignores the digit 0', async () => {
    const f = await setup({ activeIndex: 1 });
    expect(press(f, '0', 1)).toBe(false);
    expect(f.componentInstance.activeIndex()).toBe(1);
  });

  /** A disabled step is refused however it is asked for. */
  it('respects a disabled step when a digit asks for it', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'Account' },
      { id: 'b', label: 'Billing' },
      { id: 'c', label: 'Shipping', status: 'disabled' },
    ];
    const f = await setup({ items, activeIndex: 0 });
    let blocked = 0;
    f.componentInstance.stepBlocked.subscribe(() => blocked++);

    press(f, '3', 0);

    expect(f.componentInstance.activeIndex()).toBe(0);
    expect(blocked).toBe(1);
  });
});

describe('SvStepperComponent — focus and tab order', () => {
  it('moves DOM focus onto the step it navigated to', async () => {
    const f = await setup({ activeIndex: 0 });
    const host = f.nativeElement as HTMLElement;

    press(f, 'ArrowRight', 0);
    f.detectChanges();

    expect(document.activeElement).toBe(host.querySelectorAll('button')[1]);
  });

  it('scopes the focus lookup to its own host', async () => {
    const f = await setup({ activeIndex: 0 });
    const ids = [...(f.nativeElement as HTMLElement).querySelectorAll('button')].map((b) => b.id);

    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id.startsWith(`stepper-item-${f.componentInstance._uid}-`))).toBe(true);
  });

  it('gives only the active step a tab stop with hotkeys on', async () => {
    const f = await setup({ activeIndex: 1 });
    const tabs = [...(f.nativeElement as HTMLElement).querySelectorAll('button')]
      .map((b) => b.getAttribute('tabindex'));
    expect(tabs).toEqual(['-1', '0', '-1']);
  });

  /**
   * ★ The tier difference, asserted rather than assumed. The free template
   * roves unconditionally, so with hotkeys OFF — the default — there are no
   * arrow keys to move between steps and yet only the active step is in the
   * tab sequence. The Pro twin's `stepTabIndex()` returns 0 for every
   * clickable step in that case; see its `stepper.keyboard.spec.ts`.
   *
   * Pinned deliberately: this is the free tier's documented ceiling, and it is
   * the behaviour a Pro upgrade changes.
   */
  it('roves the tab stop even with hotkeys off, and has no stepTabIndex helper', async () => {
    const f = await setup({ enableHotkeys: false, activeIndex: 1 });
    const tabs = [...(f.nativeElement as HTMLElement).querySelectorAll('button')]
      .map((b) => b.getAttribute('tabindex'));

    expect(tabs).toEqual(['-1', '0', '-1']);
    expect((f.componentInstance as unknown as Record<string, unknown>)['stepTabIndex'])
      .toBeUndefined();
  });

  /** A disabled step is not clickable, but the roving rule still owns tabindex. */
  it('keeps the roving rule even when a step is disabled', async () => {
    const items: StepperItem[] = [
      { id: 'a', label: 'Account' },
      { id: 'b', label: 'Billing', status: 'disabled' },
      { id: 'c', label: 'Shipping' },
    ];
    const f = await setup({ items, enableHotkeys: false, activeIndex: 0 });
    const tabs = [...(f.nativeElement as HTMLElement).querySelectorAll('button')]
      .map((b) => b.getAttribute('tabindex'));
    expect(tabs).toEqual(['0', '-1', '-1']);
  });
});

describe('SvStepperComponent — keyboard against an empty flow', () => {
  it('does nothing when there are no steps', async () => {
    const f = await setup({ items: [] as StepperItem[] });
    const event = new KeyboardEvent('keydown', { key: 'End', cancelable: true });
    // `lifecycle` is required since `NV-05-M1`; a phantom step is `pending` on
    // both axes, which is the point — it is not in the list at all.
    const phantom = {
      index: 0,
      item: { id: 'x', label: 'X' },
      state: 'pending' as const,
      lifecycle: 'pending' as const,
    };

    expect(() => f.componentInstance.onStepKeydown(event, phantom)).not.toThrow();
    expect(event.defaultPrevented).toBe(false);
  });
});
