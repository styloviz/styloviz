import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render } from '@testing-library/angular';
import { SvNumberInputComponent } from './number-input.component';

/**
 * `FI-15-I1` / `FI-15-M2` re-verified (2026-09-26): the deferred clamp is only
 * honest if (a) the transient out-of-range state is visible in the RENDERED
 * field, not just a signal, (b) Enter — which submits a form without a blur —
 * settles it, and (c) the stepper, pressed from an out-of-range draft, lands
 * back inside the range instead of taking a step that stays outside it.
 */

const type = (input: HTMLInputElement, raw: string) => {
  input.value = raw;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const key = (input: HTMLInputElement, k: string) =>
  input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const r = await render(SvNumberInputComponent, { inputs });
  const host = r.fixture.nativeElement as HTMLElement;
  return { ...r, host, input: host.querySelector('input') as HTMLInputElement };
}

describe('SvNumberInputComponent — a transient out-of-range value is rendered as one', () => {
  it('sets aria-invalid and the danger border while the typed value is out of range', async () => {
    const { fixture, host, input } = await setup({ value: 50, min: 10, max: 100 });
    expect(input.getAttribute('aria-invalid')).toBeNull();

    type(input, '500');
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('.border-danger-400')).not.toBeNull();

    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.value).toBe('100');
  });
});

describe('SvNumberInputComponent — Enter settles the draft', () => {
  it('clamps and rounds on Enter without waiting for blur', async () => {
    const { fixture, input } = await setup({ value: 50, min: 10, max: 100, decimals: 0 });
    type(input, '500');
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(ev);
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(100);
    expect(input.value).toBe('100');
    // Submission is not swallowed — only the value it carries changes.
    expect(ev.defaultPrevented).toBe(false);
  });

  it('hands the form the settled value before (ngSubmit) runs', async () => {
    @Component({
      standalone: true,
      imports: [ReactiveFormsModule, SvNumberInputComponent],
      template: `<form (submit)="$event.preventDefault(); submitted.set(ctrl.value)">
        <sv-number-input [formControl]="ctrl" [min]="1" [max]="10" ariaLabel="Qty" />
        <button type="submit">Go</button>
      </form>`,
    })
    class Host {
      readonly ctrl = new FormControl<number>(5, { nonNullable: true });
      readonly submitted = signal<number | null>(null);
    }
    TestBed.resetTestingModule();
    const { fixture } = await render(Host);
    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    type(input, '99');
    expect(fixture.componentInstance.ctrl.value).toBe(99);
    key(input, 'Enter');
    expect(fixture.componentInstance.ctrl.value).toBe(10);
  });

  it('leaves clampOn="input" alone — it has nothing to settle', async () => {
    const { fixture, input } = await setup({ value: 5, min: 0, max: 10, clampOn: 'input' });
    type(input, '7');
    key(input, 'Enter');
    expect(fixture.componentInstance.value()).toBe(7);
  });
});

describe('SvNumberInputComponent — stepping from an out-of-range draft', () => {
  it('lands on max when stepping down from above it', async () => {
    const { fixture, input } = await setup({ value: 50, min: 10, max: 100 });
    type(input, '500');
    key(input, 'ArrowDown');
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe(100);
    expect(input.value).toBe('100');
  });

  it('lands on min when stepping up from below it', async () => {
    const { fixture, input } = await setup({ value: 50, min: 10, max: 100 });
    type(input, '2');
    key(input, 'ArrowUp');
    expect(fixture.componentInstance.value()).toBe(10);
  });
});
