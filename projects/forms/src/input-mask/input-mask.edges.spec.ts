import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvInputMaskComponent } from './input-mask.component';

/**
 * The corners the main spec does not reach: a custom mask with no fixed
 * characters at all, the calendar boundaries the partial-date validator turns
 * on, the 24-hour clock's own boundaries, backspacing across a literal, and
 * what `writeValue` does when a form hands the control something the mask
 * cannot shape.
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

describe('SvInputMaskComponent — custom masks', () => {
  it('accepts a mask made only of placeholders, with no fixed characters', async () => {
    // The degenerate mask. Everything in `applyMask` that copies a literal and
    // consumes a matching one is skipped, so this is the shape most likely to
    // trip an implementation that assumes at least one separator.
    const { fixture } = await setup({ preset: 'custom', customMask: '####' });
    paste('12345');
    expect(fixture.componentInstance.value()).toBe('1234');
    expect(fixture.componentInstance.activePlaceholder()).toBe('____');
  });

  it('accepts an empty custom mask without producing anything', async () => {
    const { fixture } = await setup({ preset: 'custom', customMask: '' });
    paste('12345');
    expect(fixture.componentInstance.value()).toBe('');
  });

  it('keeps literals the typist already supplied instead of doubling them', async () => {
    // Pasting an already-formatted value must not yield '((555)) …'.
    const { fixture } = await setup({ preset: 'custom', customMask: '##-##' });
    paste('12-34');
    expect(fixture.componentInstance.value()).toBe('12-34');
  });

  it('consumes a digit the typist supplied where the mask has a fixed digit', async () => {
    // A mask may pin a leading digit — '1##' for a country code, say. That
    // literal is a digit, so it survives `extractDigits`, and the typist's own
    // '1' must be consumed by it rather than shifted into the first slot.
    const { fixture } = await setup({ preset: 'custom', customMask: '1##' });
    paste('123');
    expect(fixture.componentInstance.value()).toBe('123');
  });

  it('names itself and picks a keyboard per preset', async () => {
    const custom = await setup({ preset: 'custom', customMask: '##' });
    expect(custom.fixture.componentInstance.activeLabel()).toBe('Custom Mask');
    expect(custom.fixture.componentInstance.inputMode()).toBe('text');

    const phone = await setup({ preset: 'phone-intl' });
    expect(phone.fixture.componentInstance.inputMode()).toBe('tel');
    expect(phone.fixture.componentInstance.activeLabel()).toBe('Phone (Intl)');

    const zip = await setup({ preset: 'zip' });
    expect(zip.fixture.componentInstance.inputMode()).toBe('numeric');

    const named = await setup({ preset: 'zip', label: 'Postcode' });
    expect(named.fixture.componentInstance.activeLabel()).toBe('Postcode');
  });
});

describe('SvInputMaskComponent — the date calendar', () => {
  it.each([
    ['a month starting with 2', '2', ''],
    ['month 00', '00', '0'],
    ['month 13', '13', '1'],
    ['day 4x in a 31-day month', '0140', '01'],
    ['32 January', '0132', '01/3'],
    ['31 April', '0431', '04/3'],
    ['30 February', '0230', '02'],
  ] as const)('refuses to let you finish typing %s', async (_why, typed, expected) => {
    const { fixture } = await setup({ preset: 'date' });
    paste(typed);
    expect(fixture.componentInstance.value()).toBe(expected);
  });

  it.each([
    ['31 January', '01312024', '01/31/2024'],
    ['30 April', '04302024', '04/30/2024'],
    ['29 February in a leap year', '02292024', '02/29/2024'],
    ['29 February in a century leap year', '02292000', '02/29/2000'],
  ] as const)('accepts %s', async (_why, typed, expected) => {
    const { fixture } = await setup({ preset: 'date' });
    paste(typed);
    expect(fixture.componentInstance.value()).toBe(expected);
  });

  it('takes 29 February back once a non-leap year finishes being typed', async () => {
    // Accepted tentatively while the year is incomplete, then withdrawn — the
    // retroactive half of the rule.
    const { fixture } = await setup({ preset: 'date' });
    paste('0229');
    expect(fixture.componentInstance.value()).toBe('02/29');
    paste('02292023');
    expect(fixture.componentInstance.value()).toBe('02/29/202');
  });

  it('takes 29 February back for a century that is not a leap year', async () => {
    // 1900 is divisible by 4 but not a leap year; only the %400 rule catches it.
    const { fixture } = await setup({ preset: 'date' });
    paste('02291900');
    expect(fixture.componentInstance.value()).toBe('02/29/190');
  });

  it('rejects year zero', async () => {
    const { fixture } = await setup({ preset: 'date' });
    paste('01010000');
    expect(fixture.componentInstance.value()).toBe('01/01/000');
  });
});

describe('SvInputMaskComponent — the 24-hour clock', () => {
  it.each([
    ['an hour starting with 3', '3', ''],
    ['hour 24', '24', '2'],
    ['a minute starting with 6', '236', '23'],
    ['minute 60 typed in one go', '2360', '23'],
  ] as const)('refuses %s', async (_why, typed, expected) => {
    const { fixture } = await setup({ preset: 'time' });
    paste(typed);
    expect(fixture.componentInstance.value()).toBe(expected);
  });

  it('accepts midnight and one minute to midnight', async () => {
    const midnight = await setup({ preset: 'time' });
    paste('0000');
    expect(midnight.fixture.componentInstance.value()).toBe('00:00');

    const last = await setup({ preset: 'time' });
    paste('2359');
    expect(last.fixture.componentInstance.value()).toBe('23:59');
  });

  it('accepts an empty field as valid rather than rejecting the first keystroke', async () => {
    const { fixture } = await setup({ preset: 'time' });
    paste('');
    expect(fixture.componentInstance.value()).toBe('');
  });
});

describe('SvInputMaskComponent — backspace across a literal', () => {
  it('removes the digit before the separator, not the separator', async () => {
    // Caret sits just after the '1' in '(555) 1'. Backspace deletes that digit,
    // and the ') ' separator goes with it because no digit is left to earn it —
    // otherwise the caret would strand on a separator it can never delete.
    const { fixture } = await setup({ preset: 'phone-us' });
    const input = paste('5551');
    expect(fixture.componentInstance.value()).toBe('(555) 1');

    input.selectionStart = 7; // right after the '1'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('(555');
  });

  it('does nothing when the caret is already at the start', async () => {
    const { fixture } = await setup({ preset: 'phone-us' });
    const input = paste('5551234567');
    input.selectionStart = 0;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    fixture.detectChanges();
    // Assert the negative: nothing was removed.
    expect(fixture.componentInstance.value()).toBe('(555) 123-4567');
  });

  it('falls back to the end of the field when the caret position is unknown', async () => {
    // `selectionStart` is null on inputs the browser gives no selection for.
    const { fixture } = await setup({ preset: 'phone-us' });
    const input = paste('5551234567');
    Object.defineProperty(input, 'selectionStart', { value: null, configurable: true });
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('(555) 123-456');
  });

  it('leaves the value alone for every other key', async () => {
    const { fixture } = await setup({ preset: 'phone-us' });
    const input = paste('5551234567');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('(555) 123-4567');
  });
});

describe('SvInputMaskComponent — writeValue', () => {
  it('shapes a raw value a form hands in', async () => {
    const { fixture } = await setup({ preset: 'phone-us' });
    fixture.componentInstance.writeValue('5551234567');
    expect(fixture.componentInstance.value()).toBe('(555) 123-4567');
  });

  it('treats null as an empty field rather than throwing', async () => {
    const { fixture } = await setup({ preset: 'phone-us' });
    fixture.componentInstance.writeValue(null as unknown as string);
    expect(fixture.componentInstance.value()).toBe('');
  });

  it('keeps text the mask cannot shape rather than blanking the control', async () => {
    // A `custom` control with no mask has nothing to apply; silently clearing
    // the user's value would lose data on every form patch.
    const { fixture } = await setup({ preset: 'custom', customMask: '' });
    fixture.componentInstance.writeValue('anything');
    expect(fixture.componentInstance.value()).toBe('anything');
  });
});

describe('SvInputMaskComponent — clear', () => {
  it('empties the field and tells the host', async () => {
    const { fixture } = await setup({ preset: 'phone-us' });
    paste('5551234567');
    const changes: string[] = [];
    fixture.componentInstance.changed.subscribe((v) => changes.push(v));
    fixture.componentInstance.clear();
    expect(fixture.componentInstance.value()).toBe('');
    expect(changes).toEqual(['']);
  });

  it('refuses to clear a disabled control', async () => {
    const { fixture } = await setup({ preset: 'phone-us', disabled: true });
    fixture.componentInstance.writeValue('5551234567');
    const changes: string[] = [];
    fixture.componentInstance.changed.subscribe((v) => changes.push(v));
    fixture.componentInstance.clear();
    expect(fixture.componentInstance.value()).toBe('(555) 123-4567');
    expect(changes).toEqual([]);
  });
});
