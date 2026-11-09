import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { vi } from 'vitest';
import { SvNumberInputComponent } from './number-input.component';

/**
 * `FL-J3-FI-11` / `FI-15-M4` — the wheel policy, as the GUARD sees it.
 *
 * jsdom has no wheel-stepping engine, so whether a wheel CHANGES a focused
 * `type="number"` is measured in the browser (`e2e/number-input-wheel.spec.ts`,
 * Chromium + WebKit: the bare engine steps it in Chromium, the kit's field does
 * not). What this pins is the mechanism that decides it: a wheel over the
 * FOCUSED field is cancelled — which is what stops an engine from stepping —
 * and its delta is handed on as a scroll, so the page still moves.
 */
afterEach(() => vi.restoreAllMocks());

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvNumberInputComponent, { inputs: { value: 5, label: 'Quantity', ...inputs } });
  const field = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type="number"]')!;
  return { fixture, c: fixture.componentInstance, field };
}

const wheel = (el: Element, deltaY = 100, deltaMode = 0): WheelEvent => {
  const e = new WheelEvent('wheel', { deltaY, deltaMode, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
};

describe('sv-number-input — wheel policy', () => {
  it('cancels a wheel over the FOCUSED field, so no engine can step it — and scrolls the page instead', async () => {
    const { c, field } = await setup();
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    field.focus();
    const e = wheel(field, 120);
    expect(e.defaultPrevented).toBe(true);
    expect(scroll).toHaveBeenCalledWith({ left: 0, top: 120 });
    expect(c.value()).toBe(5);
  });

  it('converts a line-mode delta to pixels', async () => {
    const { field } = await setup();
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    field.focus();
    wheel(field, 3, 1);
    expect(scroll).toHaveBeenCalledWith({ left: 0, top: 48 });
  });

  it('scrolls the nearest scrollable ancestor rather than the page when there is one', async () => {
    const { fixture, field } = await setup();
    const box = fixture.nativeElement as HTMLElement;
    box.style.overflowY = 'auto';
    Object.defineProperty(box, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(box, 'clientHeight', { value: 100, configurable: true });
    const own = vi.fn();
    (box as unknown as { scrollBy: typeof own }).scrollBy = own;
    const page = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    field.focus();
    wheel(field, 40);
    expect(own).toHaveBeenCalledWith({ left: 0, top: 40 });
    expect(page).not.toHaveBeenCalled();
  });

  it('leaves the wheel alone when the field is not focused', async () => {
    const { field } = await setup();
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    const e = wheel(field);
    expect(e.defaultPrevented).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('wheelSteps restores the native behaviour', async () => {
    const { field } = await setup({ wheelSteps: true });
    field.focus();
    expect(wheel(field).defaultPrevented).toBe(false);
  });
});
