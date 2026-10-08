import { svDigitValue, svDigitsOnly } from './digits';

/**
 * ============================================================================
 *  `replace(/\D/g, '')` deletes the code  ·  `FI-16-I3`
 * ============================================================================
 *
 * ★★★ `\d` IS ASCII `0`–`9` AND NOTHING ELSE. A one-time code typed on an
 *     Arabic, Bengali, Devanagari, Thai or Burmese keypad came out as the
 *     EMPTY STRING — the user typed six digits, watched the field stay empty,
 *     and had no way to know why. No error, no fallback, no workaround short of
 *     switching keyboards, and it happens to exactly the people least likely to
 *     be in anybody's test matrix.
 *
 * ★★ The backlog said "non-Latin digits are not handled". They were worse than
 *    unhandled: actively deleted, by a line that reads like it is removing
 *    spaces and dashes.
 *
 * ★★ AND THERE IS NO TABLE OF DIGIT SETS IN THE IMPLEMENTATION, which these
 *    tests are partly here to keep true. A list of zero code points is correct
 *    the day it is written and incomplete the day Unicode adds a script —
 *    incomplete in the same silent way as the bug, for the same users. The
 *    algorithm uses Unicode's own run structure instead, so the last test below
 *    passes for scripts nobody here has heard of.
 */

/** Every case is a real keypad somebody is using right now. */
const DIGIT_SETS: readonly [string, string][] = [
  ['ASCII', '0123456789'],
  ['Arabic-Indic', '٠١٢٣٤٥٦٧٨٩'],
  ['Extended Arabic-Indic (Persian/Urdu)', '۰۱۲۳۴۵۶۷۸۹'],
  ['Bengali', '০১২৩৪৫৬৭৮৯'],
  ['Devanagari', '०१२३४५६७८९'],
  ['Thai', '๐๑๒๓๔๕๖๗๘๙'],
  ['Myanmar', '၀၁၂၃၄၅၆၇၈၉'],
  ['Khmer', '០១២៣៤៥៦៧៨៩'],
  ['Fullwidth (what a Japanese IME emits)', '０１２３４５６７８９'],
];

describe('svDigitsOnly', () => {
  it.each(DIGIT_SETS)('reads %s digits as their values', (_name, digits) => {
    expect(svDigitsOnly(digits)).toBe('0123456789');
  });

  it('is the exact behaviour that was broken', () => {
    // ★★★ The regression, stated as a value: this is a six-digit OTP typed on
    //     an Arabic keypad. `'١٢٣٤٥٦'.replace(/\D/g, '')` is `''`.
    expect('١٢٣٤٥٦'.replace(/\D/g, '')).toBe('');
    expect(svDigitsOnly('١٢٣٤٥٦')).toBe('123456');
  });

  it('still drops everything that is not a digit', () => {
    // The job the old line was written for, which must survive.
    expect(svDigitsOnly('(555) 010-1234')).toBe('5550101234');
    expect(svDigitsOnly('a1b2c3')).toBe('123');
    expect(svDigitsOnly('')).toBe('');
    expect(svDigitsOnly('no digits here')).toBe('');
  });

  it('drops the separators that come WITH a non-Latin keypad', () => {
    // `U+066C` is the Arabic thousands separator and `U+066B` the decimal one.
    // They arrive alongside the digits and are not digits.
    expect(svDigitsOnly('١٢٣٬٤٥٦')).toBe('123456');
  });

  it('keeps order across a mixed string', () => {
    // Someone pasting from a bilingual document, or a keyboard switched
    // mid-entry. The digits are in the order they appear, whatever script.
    expect(svDigitsOnly('12٣٤৫৬')).toBe('123456');
  });

  it('handles digits outside the BMP', () => {
    /**
     * ★★ `Array.from`, NOT AN INDEX LOOP. The mathematical digit sets live in
     *    the astral planes, so a surrogate pair read as two `charAt`s is two
     *    non-digits and the value silently disappears — the same failure as the
     *    one being fixed, one plane up.
     */
    expect(svDigitsOnly('𝟎𝟏𝟐')).toBe('012');
  });

  it('leaves an ASCII-only string to the fast path unchanged', () => {
    // This runs on every keystroke, so the common case does not pay for the
    // general one. Asserted because the fast path is a second implementation.
    expect(svDigitsOnly('0123456789')).toBe('0123456789');
    expect(svDigitsOnly('1-2-3')).toBe('123');
    // A non-ASCII character forces the slow path; the result must not differ.
    expect(svDigitsOnly('1-2-3é')).toBe('123');
  });
});

describe('svDigitValue', () => {
  it('gives the value regardless of script', () => {
    expect(svDigitValue('7')).toBe(7);
    expect(svDigitValue('٧')).toBe(7); // Arabic-Indic seven
    expect(svDigitValue('৭')).toBe(7); // Bengali seven
    expect(svDigitValue('７')).toBe(7); // fullwidth seven
  });

  it('returns -1 for anything that is not a decimal digit', () => {
    for (const ch of ['a', ' ', '-', '', '٫', '½', 'Ⅶ']) {
      // ★ `½` and `Ⅶ` are the interesting ones: they are Unicode NUMBERS but
      //   not DECIMAL digits (`No` and `Nl`, not `Nd`). A regex matching
      //   `\p{N}` instead of `\p{Nd}` would accept them and then have no
      //   sensible value to return.
      expect(svDigitValue(ch), JSON.stringify(ch)).toBe(-1);
    }
  });

  it('is right for every digit of every set, not just the zeros', () => {
    for (const [name, digits] of DIGIT_SETS) {
      Array.from(digits).forEach((ch, i) => {
        expect(svDigitValue(ch), `${name} ${i}`).toBe(i);
      });
    }
  });

  it('works on a set this file does not list, which is the point', () => {
    /**
     * ★★★ THE CLAIM THAT THERE IS NO TABLE. Lao digits (U+0ED0–U+0ED9) are
     *     deliberately absent from `DIGIT_SETS` above and from the
     *     implementation. If somebody replaces the run walk with a list of
     *     known scripts, this is the test that goes red — and it stands in for
     *     every script Unicode has not added yet.
     */
    expect(svDigitsOnly('໑໒໓')).toBe('123');
    expect(svDigitValue('໙')).toBe(9);
  });

  it('answers the same on a second call, since values are memoised', () => {
    // The cache is keyed by code point; a bug there would show as a wrong
    // answer only on the second call, which is the sort of thing a single
    // assertion misses.
    expect(svDigitValue('٥')).toBe(5);
    expect(svDigitValue('٥')).toBe(5);
    expect(svDigitValue('٦')).toBe(6);
  });
});
