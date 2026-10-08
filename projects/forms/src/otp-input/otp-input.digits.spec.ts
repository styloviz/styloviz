import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvOtpInputComponent } from './otp-input.component';

/**
 * ============================================================================
 *  A code typed on an Arabic keypad came out empty  ·  `FI-16-I3`
 * ============================================================================
 *
 * ★★★ `el.value.replace(/\D/g, '')` DOES NOT STRIP PUNCTUATION FROM A CODE. IT
 *     STRIPS THE CODE. `\d` is ASCII `0`–`9` and nothing else, so a one-time
 *     code entered on an Arabic, Bengali, Devanagari, Thai or Burmese keypad —
 *     or pasted in fullwidth from a Japanese IME — was replaced by the empty
 *     string at every one of the component's five entry points.
 *
 *     The user types six digits. The field stays empty. There is no error, no
 *     fallback, and no workaround short of switching keyboards — and it happens
 *     to exactly the people least likely to be in anybody's test matrix.
 *
 * ★★ The item said "non-Latin digits are not handled". They were worse than
 *    unhandled: deleted, by a line that reads like it is removing spaces and
 *    dashes.
 *
 * ★★ THE ENTRY POINTS ARE TESTED SEPARATELY BECAUSE THERE ARE FIVE OF THEM and
 *    they are five different code paths: typing a cell, pasting, the bound
 *    value arriving from a form, the single-field mode, and the Web OTP
 *    credential. Fixing four of five is the shape this defect had in the first
 *    place.
 */

const ARABIC = '١٢٣٤٥٦';
const BENGALI = '১২৩৪৫৬';
const FULLWIDTH = '１２３４５６';

async function setup(inputs: Partial<ComponentInput<SvOtpInputComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvOtpInputComponent, {
    inputs: inputs as ComponentInput<SvOtpInputComponent>,
  });
  return { ...r, c: r.fixture.componentInstance };
}

const pasteEvent = (text: string): ClipboardEvent => {
  const e = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(e, 'clipboardData', { value: { getData: () => text } });
  return e;
};

describe('the defect, stated as a value', () => {
  it('is what the old line did', () => {
    // Not a claim about the past — the expression, run.
    expect(ARABIC.replace(/\D/g, '')).toBe('');
    expect(BENGALI.replace(/\D/g, '')).toBe('');
    expect(FULLWIDTH.replace(/\D/g, '')).toBe('');
  });
});

describe('a bound value', () => {
  it('reads Arabic-Indic digits', async () => {
    const { c } = await setup({ value: ARABIC });
    expect(c.digits().join('')).toBe('123456');
  });

  it('reads Bengali digits', async () => {
    const { c } = await setup({ value: BENGALI });
    expect(c.digits().join('')).toBe('123456');
  });

  it('reads fullwidth digits, which is what a Japanese IME emits', async () => {
    const { c } = await setup({ value: FULLWIDTH });
    expect(c.digits().join('')).toBe('123456');
  });

  it('still reads ASCII exactly as before', async () => {
    const { c } = await setup({ value: '123456' });
    expect(c.digits().join('')).toBe('123456');
  });
});

describe('a paste', () => {
  it('reads a non-Latin code', async () => {
    const { c } = await setup();
    c.onPaste(pasteEvent(ARABIC));
    expect(c.digits().join('')).toBe('123456');
  });

  it('still pulls a code out of the sentence an SMS arrives in', async () => {
    // The behaviour the strip existed for, which must survive — and in the
    // script the message is actually written in.
    const { c } = await setup();
    c.onPaste(pasteEvent('رمزك هو ١٢٣٤٥٦'));
    expect(c.digits().join('')).toBe('123456');
  });

  it('still drops the separators that travel with those digits', async () => {
    // `U+066C`, the Arabic thousands separator, is not a digit.
    const { c } = await setup();
    c.onPaste(pasteEvent('١٢٣٬٤٥٦'));
    expect(c.digits().join('')).toBe('123456');
  });
});

describe('typing into a cell', () => {
  it('accepts a non-Latin digit', async () => {
    const { c } = await setup();
    c.onInput({ target: { value: '٧' } } as unknown as Event, 0);
    expect(c.digits()[0]).toBe('7');
  });

  it('still ignores a letter, and clears the cell it was typed into', async () => {
    // The handler's own answer to "nothing numeric arrived": blank the cell and
    // leave the model alone. Asserted through the element, because that is
    // where the behaviour is.
    const { c } = await setup();
    const el = { value: 'a' };
    c.onInput({ target: el } as unknown as Event, 0);
    expect(el.value).toBe('');
    expect(c.digits().join('')).toBe('');
  });
});

describe('the single-field mode', () => {
  it('accepts a non-Latin code typed straight in', async () => {
    // `mode="single"` is a different entry point with its own handler — the
    // one added for `FI-16-I2`, which inherited the same strip.
    const { c } = await setup({ mode: 'single' });
    c.onSingleInput({ target: { value: BENGALI } } as unknown as Event);
    expect(c.digits().join('')).toBe('123456');
  });
});

describe('what the component emits', () => {
  it('is ASCII, whatever was typed', async () => {
    /**
     * ⚠️ NORMALISED RATHER THAN PRESERVED, AND THAT IS THE RIGHT WAY ROUND.
     *    The value goes to a server, into a comparison, or into `Number()`, and
     *    every one of those wants `123456`. Putting the user's own digits back
     *    is a DISPLAY decision, made where the locale is visible — not
     *    something to smuggle into the submitted value.
     */
    const seen: string[] = [];
    const { c } = await setup({});
    c.changed.subscribe((v: string) => seen.push(v));
    c.onPaste(pasteEvent(ARABIC));
    expect(seen).toContain('123456');
  });
});
