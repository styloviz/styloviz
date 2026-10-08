import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvInputMaskComponent } from './input-mask.component';

/**
 * Re-verification of `FI-13-I2`, `FI-13-I3`, `FI-13-M2`, `FI-13-M3` and the
 * input-mask site of `FI-16-I3` (2026-09-26) — the doors the first pass left
 * open. Every test here drives the RENDERED component: a real `<input>`, real
 * `input` / `keydown` events, or the CVA entry point a form calls.
 */

async function setup(inputs: Partial<ComponentInput<SvInputMaskComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvInputMaskComponent, {
    inputs: inputs as ComponentInput<SvInputMaskComponent>,
  });
  return { ...r, c: r.fixture.componentInstance };
}

const field = () => screen.getByRole('textbox') as HTMLInputElement;

/** One `input` event carrying the whole string — what browser autofill does. */
function autofill(text: string): HTMLInputElement {
  const input = field();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}

function paste(text: string): void {
  const e = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(e, 'clipboardData', { value: { getData: () => text } });
  field().dispatchEvent(e);
}

describe('writeValue takes the same path as typing (FI-13-I2)', () => {
  it('keeps the letters of an `A` mask instead of rendering the digits alone', async () => {
    const { c, fixture } = await setup({ preset: 'custom', customMask: 'AA#A #AA' });
    c.writeValue('SW1A 1AA');
    fixture.detectChanges();
    expect(c.value()).toBe('SW1A 1AA');
    expect(field().value).toBe('SW1A 1AA');
  });

  it('shapes an E.164 value for phone-us without shifting the digits', async () => {
    const { c } = await setup({ preset: 'phone-us' });
    c.writeValue('+15550109999');
    expect(c.value()).toBe('(555) 010-9999');
    expect(c.hasRejected()).toBe(false);
  });

  it('reports what a form-written value lost rather than dropping it silently', async () => {
    const { c, fixture } = await setup({ preset: 'zip' });
    c.writeValue('SW1A 1AA');
    fixture.detectChanges();
    expect(c.hasRejected()).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('did not fit');
  });
});

describe('autofill arrives as an input event (FI-13-I3 / FI-13-M2)', () => {
  it('an autofilled +1 number in phone-us is not shifted one place', async () => {
    const { c } = await setup({ preset: 'phone-us' });
    const input = autofill('+15550109999');
    expect(c.value()).toBe('(555) 010-9999');
    expect(input.value).toBe('(555) 010-9999');
    expect(c.hasRejected()).toBe(false);
  });

  it('a pasted code with no separator after it still works', async () => {
    const { c } = await setup({ preset: 'phone-us' });
    paste('+1 5550109999');
    expect(c.value()).toBe('(555) 010-9999');
  });

  it('phone-us never silently drops a code that is not +1', async () => {
    const { c } = await setup({ preset: 'phone-us' });
    paste('+44 20 7946 0958');
    // The value cannot be held; the user must be told, not handed a US number.
    expect(c.hasRejected()).toBe(true);
  });
});

describe('non-Latin digits reach every digit site (FI-16-I3)', () => {
  it('a date typed in Arabic-Indic digits is accepted, not refused at the first key', async () => {
    const { c } = await setup({ preset: 'date' });
    autofill('٠٣٢٩٢٠٢٦');
    expect(c.value()).toBe('٠٣/٢٩/٢٠٢٦');
    expect(c.hasRejected()).toBe(false);
  });

  it('still refuses an impossible Arabic-Indic date', async () => {
    const { c } = await setup({ preset: 'date' });
    autofill('١٣');
    expect(c.value()).toBe('١');
    expect(c.hasRejected()).toBe(true);
  });

  it('emits the raw value as ASCII digits for the server', async () => {
    const seen: string[] = [];
    const { c } = await setup({ preset: 'custom', customMask: '##-##' });
    c.rawChanged.subscribe((v: string) => seen.push(v));
    autofill('١٢٣٤');
    expect(c.value()).toBe('١٢-٣٤');
    expect(seen).toEqual(['1234']);
  });

  it('maskedValue redacts non-Latin digits of a card number (FI-13-M3)', async () => {
    const { c } = await setup({ preset: 'credit-card' });
    autofill('٤٢٤٢٤٢٤٢٤٢٤٢٤٢٤٢');
    expect(c.maskedValue()).toBe('•••• •••• •••• ٤٢٤٢');
    expect(c.last4()).toBe('4242');
  });
});

describe('backspace keeps the letters of an `A` mask', () => {
  it('removes one slot, not every letter', async () => {
    const { c } = await setup({ preset: 'custom', customMask: 'AA-##' });
    const input = autofill('AB12');
    expect(c.value()).toBe('AB-12');
    input.selectionStart = 3; // right after the '-'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(c.value()).toBe('A');
  });
});
