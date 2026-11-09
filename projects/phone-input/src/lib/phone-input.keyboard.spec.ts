import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvInputMaskComponent } from '@styloviz/forms';
import { SvPhoneInputComponent } from './phone-input.component';

/**
 * FL-J3-DD-21 — the number field asks for the phone keypad and the national
 * number autofill, and keeps its digits left-to-right inside an RTL page.
 * FL-J3-DD-36 — the fallback accessible name comes from the label pack.
 */
async function setup(inputs: Record<string, unknown> = {}, providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvPhoneInputComponent, { inputs, providers: providers as never[] });
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { el, number: el.querySelector<HTMLInputElement>('sv-input-mask input')! };
}

describe('SvPhoneInputComponent — mobile keyboard, autofill and direction (DD-26-I4)', () => {
  it('uses inputmode="tel" and autocomplete="tel-national" on the number field, not text/off', async () => {
    const { number } = await setup();
    expect(number.getAttribute('inputmode')).toBe('tel');
    expect(number.getAttribute('autocomplete')).toBe('tel-national');
  });

  it('keeps the digits in reading order inside a right-to-left page', async () => {
    const { el, number } = await setup();
    el.setAttribute('dir', 'rtl');
    expect(number.getAttribute('dir')).toBe('ltr');
  });

  it('accepts a pasted national number with separators', async () => {
    const { number } = await setup();
    number.value = '(555) 010-9999';
    number.dispatchEvent(new Event('input'));
    expect(number.value.replace(/\D/g, '')).toBe('5550109999');
  });
});

describe('SvPhoneInputComponent — fallback name from the label pack (FL-J3-DD-36)', () => {
  it('names the number field "Phone number" by default', async () => {
    const { number } = await setup();
    expect(number.getAttribute('aria-label')).toBe('Phone number');
  });

  it('falls back to the PACK when the label is cleared, not to hard-coded English', async () => {
    const { number } = await setup({ label: '' }, [provideSvLabels({ phoneInput: { phoneNumber: 'Telefonnummer' } })]);
    expect(number.getAttribute('aria-label')).toBe('Telefonnummer');
  });
});

describe('SvInputMaskComponent — keyboard / autofill / direction overrides', () => {
  async function mask(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvInputMaskComponent, { inputs });
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('input')!;
  }

  it('keeps the preset defaults when nothing is overridden', async () => {
    const custom = await mask({ preset: 'custom', customMask: '###' });
    expect(custom.getAttribute('inputmode')).toBe('text');
    expect(custom.getAttribute('autocomplete')).toBe('off');
    expect(custom.hasAttribute('dir')).toBe(false);
  });

  it('applies inputmode, autocomplete and inputDir overrides', async () => {
    const input = await mask({ preset: 'custom', customMask: '###', inputmode: 'numeric', autocomplete: 'one-time-code', inputDir: 'ltr' });
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('dir')).toBe('ltr');
  });

  it('never lets an override re-enable autofill on a sensitive field', async () => {
    const input = await mask({ preset: 'credit-card', autocomplete: 'cc-number' });
    expect(input.getAttribute('autocomplete')).toBe('off');
  });
});
