import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvInputMaskComponent } from './input-mask.component';

/**
 * Two separate promises live in this control.
 *
 * The first is formatting: whatever arrives — typed, pasted, or written in by a
 * form — comes out shaped like the mask, with everything that is not a digit
 * dropped.
 *
 * The second is stronger and only applies to `date` and `time`: an impossible
 * value must be *unenterable*, not merely wrong afterwards. February 30th is
 * rejected at the keystroke that would create it, and February 29th is rejected
 * retroactively once a non-leap year finishes being typed. That is the part
 * worth pinning, because it is the part that quietly stops working.
 */

async function setup(inputs: Partial<ComponentInput<SvInputMaskComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvInputMaskComponent, {
    inputs: inputs as ComponentInput<SvInputMaskComponent>,
  });
}

const field = () => screen.getByRole('textbox') as HTMLInputElement;

/** One `input` event carrying the whole string — what a paste looks like. */
function paste(text: string): HTMLInputElement {
  const input = field();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}

describe('SvInputMaskComponent — formatting', () => {
  it.each([
    ['phone-us', '5551234567', '(555) 123-4567'],
    ['phone-intl', '15551234567', '+1 (555) 123-4567'],
    ['credit-card', '4111111111111111', '4111 1111 1111 1111'],
    ['ssn', '123456789', '123-45-6789'],
    ['zip', '123456789', '12345-6789'],
    ['ip', '192168001001', '192.168.001.001'],
    ['date', '12252024', '12/25/2024'],
    ['time', '2359', '23:59'],
  ] as const)('shapes %s input into the mask', async (preset, typed, expected) => {
    const { fixture } = await setup({ preset });
    paste(typed);
    expect(fixture.componentInstance.value()).toBe(expected);
  });

  it('drops everything that is not a digit', async () => {
    const { fixture } = await setup({ preset: 'phone-us' });
    paste('abc555def123-4567');
    expect(fixture.componentInstance.value()).toBe('(555) 123-4567');
  });

  it('stops at the end of the mask instead of running past it', async () => {
    const { fixture } = await setup({ preset: 'phone-us' });
    paste('555123456789999');
    expect(fixture.componentInstance.value()).toBe('(555) 123-4567');
  });

  it('formats as each digit arrives, not only at the end', async () => {
    const { fixture } = await setup({ preset: 'phone-us' });
    await userEvent.type(field(), '5551234567');
    expect(fixture.componentInstance.value()).toBe('(555) 123-4567');
  });

  it('takes a custom mask, where # is the one placeholder', async () => {
    const { fixture } = await setup({ preset: 'custom', customMask: '###-##' });
    paste('AB1234');
    expect(fixture.componentInstance.value()).toBe('123-4');
  });

  it('turns a custom mask into a placeholder by blanking its slots', async () => {
    const { fixture } = await setup({ preset: 'custom', customMask: '###-##' });
    expect(fixture.componentInstance.activePlaceholder()).toBe('___-__');
  });
});

describe('SvInputMaskComponent — impossible dates cannot be entered', () => {
  it('refuses a thirteenth month at the keystroke that would make it', async () => {
    const { fixture } = await setup({ preset: 'date' });
    await userEvent.type(field(), '13');
    expect(fixture.componentInstance.value()).toBe('1');
  });

  it('refuses a day the month does not have', async () => {
    const { fixture } = await setup({ preset: 'date' });
    paste('1232'); // 12/32
    expect(fixture.componentInstance.value()).toBe('12/3');
  });

  it('refuses February 30th', async () => {
    const { fixture } = await setup({ preset: 'date' });
    paste('0230');
    expect(fixture.componentInstance.value()).toBe('02');
  });

  it('accepts February 29th in a leap year', async () => {
    const { fixture } = await setup({ preset: 'date' });
    paste('02292024');
    expect(fixture.componentInstance.value()).toBe('02/29/2024');
  });

  it('takes February 29th back once the year turns out not to be a leap year', async () => {
    // 29 is allowed while the year is unknown — refusing it up front would make
    // Feb 29 untypable in every year. The last digit of 2023 is what invalidates
    // it, and that digit is where it gets dropped.
    const { fixture } = await setup({ preset: 'date' });
    paste('02292023');
    expect(fixture.componentInstance.value()).toBe('02/29/202');
  });

  it('refuses an hour past 23 and a minute past 59', async () => {
    const { fixture } = await setup({ preset: 'time' });
    paste('25');
    expect(fixture.componentInstance.value()).toBe('2');

    paste('2365');
    expect(fixture.componentInstance.value()).toBe('23');
  });

  it('leaves the other presets alone', async () => {
    // A ZIP of 99999 is not a date; calendar rules must not leak across presets.
    const { fixture } = await setup({ preset: 'zip' });
    paste('999999999');
    expect(fixture.componentInstance.value()).toBe('99999-9999');
  });
});

describe('SvInputMaskComponent — what it reports', () => {
  it('reports the masked value and the bare digits separately', async () => {
    const masked: string[] = [];
    const raw: string[] = [];
    const { fixture } = await setup({ preset: 'phone-us' });
    fixture.componentInstance.changed.subscribe((v) => masked.push(v));
    fixture.componentInstance.rawChanged.subscribe((v) => raw.push(v));

    paste('5551234567');
    expect(masked).toEqual(['(555) 123-4567']);
    expect(raw).toEqual(['5551234567']);
  });

  it('offers a clear button only once there is something to clear', async () => {
    const { fixture } = await setup({ preset: 'phone-us' });
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();

    paste('555');
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
  });

  it('empties the field and says so when cleared', async () => {
    const masked: string[] = [];
    const raw: string[] = [];
    const { fixture } = await setup({ preset: 'phone-us' });
    paste('5551234567');
    fixture.detectChanges();
    fixture.componentInstance.changed.subscribe((v) => masked.push(v));
    fixture.componentInstance.rawChanged.subscribe((v) => raw.push(v));

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(fixture.componentInstance.value()).toBe('');
    expect(masked).toEqual(['']);
    expect(raw).toEqual(['']);
  });

  it('refuses to clear while disabled', async () => {
    const { fixture } = await setup({ preset: 'phone-us', disabled: true });
    fixture.componentInstance.value.set('(555) 123-4567');
    fixture.componentInstance.clear();
    expect(fixture.componentInstance.value()).toBe('(555) 123-4567');
  });

  it.each([
    ['phone-us', 'tel'],
    ['phone-intl', 'tel'],
    ['credit-card', 'numeric'],
    ['custom', 'text'],
  ] as const)('asks for the right keyboard on %s', async (preset, mode) => {
    const { fixture } = await setup({ preset });
    expect(fixture.componentInstance.inputMode()).toBe(mode);
    expect(field().getAttribute('inputmode')).toBe(mode);
  });

  it('labels itself from the preset, and defers to an explicit label', async () => {
    const { fixture } = await setup({ preset: 'credit-card' });
    expect(fixture.componentInstance.activeLabel()).toBe('Credit Card');

    const { fixture: named } = await setup({ preset: 'credit-card', label: 'Card on file' });
    expect(named.componentInstance.activeLabel()).toBe('Card on file');
  });
});

describe('SvInputMaskComponent — as a form control', () => {
  it('masks a raw value written in by a form', async () => {
    const { fixture } = await setup({ preset: 'phone-us' });
    fixture.componentInstance.writeValue('5551234567');
    expect(fixture.componentInstance.value()).toBe('(555) 123-4567');
  });

  it('validates a written-in date the same way a typed one is validated', async () => {
    const { fixture } = await setup({ preset: 'date' });
    fixture.componentInstance.writeValue('02/30/2024');
    expect(fixture.componentInstance.value()).toBe('02');
  });

  it('reports edits back to the form', async () => {
    const seen: string[] = [];
    const { fixture } = await setup({ preset: 'phone-us' });
    fixture.componentInstance.registerOnChange((v) => seen.push(v));
    paste('555');
    expect(seen).toEqual(['(555']);
  });

  it('marks itself touched on blur', async () => {
    let touched = false;
    const { fixture } = await setup({ preset: 'phone-us' });
    fixture.componentInstance.registerOnTouched(() => { touched = true; });
    field().dispatchEvent(new FocusEvent('blur'));
    expect(touched).toBe(true);
    expect(fixture.componentInstance.focused()).toBe(false);
  });

  it('takes disabled from the form as well as from its own input', async () => {
    const { fixture } = await setup({ preset: 'phone-us' });
    expect(fixture.componentInstance.resolvedDisabled()).toBe(false);

    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.resolvedDisabled()).toBe(true);
    expect(field().disabled).toBe(true);
  });
});

describe('SvInputMaskComponent — two error channels', () => {
  it('renders a lookup error above the field', async () => {
    await setup({ preset: 'phone-us', error: 'Could not verify this number.' });
    expect(screen.getByText('Could not verify this number.')).toBeTruthy();
  });

  it('renders a form verdict in the field-error slot', async () => {
    await setup({ preset: 'phone-us', errorMessage: 'A phone number is required.' });
    expect(screen.getByRole('alert').textContent).toContain('A phone number is required.');
  });

  it('is described by BOTH when both are live', async () => {
    // One `aria-describedby` used to name only the first, so a server rejection
    // rendered a message that nothing pointed at.
    const { fixture } = await setup({
      preset: 'phone-us',
      error: 'Lookup failed.',
      errorMessage: 'Required.',
    });
    const ids = (field().getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toContain(fixture.componentInstance.errorId);
    expect(ids.length).toBe(2);
  });

  it('is invalid when either channel speaks', async () => {
    const { fixture: lookup } = await setup({ preset: 'phone-us', error: 'Lookup failed.' });
    expect((lookup.nativeElement as HTMLElement).querySelector('input')!.getAttribute('aria-invalid')).toBe('true');

    const { fixture: verdict } = await setup({ preset: 'phone-us', errorMessage: 'Required.' });
    expect((verdict.nativeElement as HTMLElement).querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('expires a server rejection on the next edit', async () => {
    const { fixture } = await setup({ preset: 'phone-us', serverError: 'That number is blocked.' });
    expect(screen.getByRole('alert').textContent).toContain('That number is blocked.');

    paste('555');
    fixture.detectChanges();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('describes itself by nothing when nothing is wrong', async () => {
    await setup({ preset: 'phone-us' });
    expect(field().getAttribute('aria-describedby')).toBeNull();
    expect(field().getAttribute('aria-invalid')).toBeNull();
  });
});
