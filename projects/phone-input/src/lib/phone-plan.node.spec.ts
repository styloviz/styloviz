import { PHONE_COUNTRIES, type PhoneCountry } from './phone-countries';
import {
  SV_E164_MAX_DIGITS,
  svGroupNational,
  svLengthHint,
  svMaxNational,
  svMinNational,
  svNationalLengthState,
  svNationalMask,
} from './phone-plan';

/**
 * Numbering plans, and the mask that was pretending to be one.
 *
 * ★★★ `phone-intl` was `+# (###) ###-####` — the NANP shape with a `+` bolted
 * on: ONE country-code digit and TEN national ones. It was applied to the UK
 * (+44), Australia (+61), Germany (+49), France (+33), India (+91) and Japan
 * (+81). Not one of those codes fits in `+#`, and not one of those plans is ten
 * digits, so selecting "United Kingdom" and typing a real London number was
 * impossible — silently.
 */

const country = (code: string): PhoneCountry =>
  PHONE_COUNTRIES.find((c) => c.code === code)!;

describe('the bundled plans', () => {
  it('no longer spends mask positions on a country code the picker shows', () => {
    for (const c of PHONE_COUNTRIES) {
      // ★ The wasted slot was the whole bug: the field had ten positions for a
      //   number that needed more, because one was holding a "+".
      expect(svNationalMask(c), c.code).not.toContain('+');
    }
  });

  it('gives every country a plan of its own, not one shared shape', () => {
    const masks = new Set(PHONE_COUNTRIES.map(svNationalMask));
    // US and CA legitimately share the NANP; the other six must not all match.
    expect(masks.size).toBeGreaterThan(4);
  });

  it('lets a two-digit dial code exist at all', () => {
    expect(country('GB').dialCode).toBe('+44');
    expect(svMaxNational(country('GB').nationalDigits)).toBe(10);
  });

  it('keeps the punctuation a US reader recognises', () => {
    // A group list cannot express parentheses, so NANP states its mask outright.
    expect(svNationalMask(country('US'))).toBe('(###) ###-####');
  });

  it('derives a mask from the grouping when there is nothing special to say', () => {
    expect(svNationalMask(country('IN'))).toBe('##### #####');
    expect(svNationalMask(country('JP'))).toBe('## #### ####');
  });

  it('admits the plans that are genuinely variable', () => {
    // ★ Germany's subscriber numbers run from 6 to 11 digits. A single mask
    //   cannot express that, and the range says so rather than picking one.
    expect(svMinNational(country('DE').nationalDigits)).toBe(6);
    expect(svMaxNational(country('DE').nationalDigits)).toBe(11);
  });
});

describe('svNationalLengthState', () => {
  it('says nothing about an empty field', () => {
    expect(svNationalLengthState('', country('US'))).toBe('empty');
  });

  it('recognises a number of the expected length', () => {
    expect(svNationalLengthState('5551234567', country('US'))).toBe('ok');
    expect(svNationalLengthState('7911123456', country('GB'))).toBe('ok');
  });

  it('recognises one that is short or long', () => {
    expect(svNationalLengthState('555', country('US'))).toBe('short');
    expect(svNationalLengthState('55512345678', country('US'))).toBe('over');
  });

  it('accepts anything inside a range', () => {
    for (const n of [6, 8, 11]) {
      expect(svNationalLengthState('9'.repeat(n), country('DE'))).toBe('ok');
    }
    expect(svNationalLengthState('99999', country('DE'))).toBe('short');
  });

  it('ignores the punctuation a mask put there', () => {
    expect(svNationalLengthState('(555) 123-4567', country('US'))).toBe('ok');
  });
});

describe('svLengthHint', () => {
  it('is silent when there is nothing to say', () => {
    expect(svLengthHint('', country('US'))).toBe('');
    expect(svLengthHint('5551234567', country('US'))).toBe('');
  });

  it('says what it expected rather than declaring the number wrong', () => {
    // ★★ A HINT, NOT AN ERROR. The plan may be out of date — that is the premise
    //    of the whole file — so a number the table calls short may be perfectly
    //    dialable. It reports the expectation and leaves the judgement alone.
    const hint = svLengthHint('555', country('US'));
    expect(hint).toContain('usually 10 digits');
    expect(hint).toContain('this has 3');
    expect(hint).not.toContain('invalid');
  });

  it('states a range when the plan has one', () => {
    expect(svLengthHint('999', country('DE'))).toContain('usually 6–11 digits');
  });

  it('treats the E.164 ceiling as the one rule that cannot go stale', () => {
    // 15 digits total, country code included — the format's own definition
    // rather than any country's plan.
    const hint = svLengthHint('9'.repeat(15), country('GB'));
    expect(hint).toContain(`${SV_E164_MAX_DIGITS}`);
    expect(hint).toContain('cannot be stored');
  });
});

describe('svGroupNational', () => {
  it('groups by the plan', () => {
    expect(svGroupNational('5551234567', [3, 3, 4])).toBe('555 123 4567');
    expect(svGroupNational('9876543210', [5, 5])).toBe('98765 43210');
  });

  it('never drops a digit that runs past the last group', () => {
    // ★ A formatter that silently truncates is how a correct number becomes a
    //   wrong one — and the plan being out of date is the case to expect.
    expect(svGroupNational('55512345678901', [3, 3, 4])).toBe('555 123 4567 8901');
  });

  it('stops early rather than padding a short number', () => {
    expect(svGroupNational('5551', [3, 3, 4])).toBe('555 1');
  });

  it('survives an empty grouping and an empty number', () => {
    expect(svGroupNational('5551234567', [])).toBe('5551234567');
    expect(svGroupNational('', [3, 3, 4])).toBe('');
  });
});
