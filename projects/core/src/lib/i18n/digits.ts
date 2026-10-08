/**
 * Reading the digits somebody actually typed.
 *
 * ── The defect this exists for (`FI-16-I3`) ─────────────────────────────────
 *
 * ★★★ `replace(/\D/g, '')` DOES NOT STRIP PUNCTUATION FROM A CODE. IT STRIPS
 *     THE CODE. `\d` is ASCII `0`–`9` and nothing else, so a one-time code
 *     typed on an Arabic, Bengali, Devanagari, Thai or Burmese keypad comes out
 *     as the **empty string**. Measured, all of these produce `''`:
 *
 *         ١٢٣٤٥٦   Arabic-Indic
 *         ১২৩৪৫৬   Bengali
 *         १२३४५६   Devanagari
 *         １２３４５６   fullwidth (what a Japanese IME emits)
 *
 *     The user types their six digits, watches the field stay empty, and has no
 *     way to know why. There is no error, no fallback and no workaround short
 *     of switching keyboards — and the people it happens to are the ones least
 *     likely to be in anybody's test matrix.
 *
 * ★★ THE BACKLOG SAID "NON-LATIN DIGITS ARE NOT HANDLED". They are worse than
 *    unhandled: they are actively deleted by a line that reads like it is
 *    removing spaces and dashes.
 *
 * ── ★★★ WHY THERE IS NO TABLE OF DIGIT SETS HERE ───────────────────────────
 *
 * A list of zero code points — U+0660 for Arabic-Indic, U+09E6 for Bengali, and
 * so on — is correct on the day it is written and incomplete on the day Unicode
 * adds a script. Incomplete in exactly the same silent way as the bug being
 * fixed, for exactly the same users.
 *
 * Unicode's own structure answers it instead. Every character in category `Nd`
 * belongs to a run of ten consecutive code points beginning at that set's zero,
 * so a digit's VALUE is how far it sits from the first `Nd` character below it.
 * Walking back at most nine code points is the whole algorithm, it needs no
 * data of its own, and it is right for a script that does not exist yet.
 */

/** Memoised: code point of a digit → its value, so the walk happens once per run. */
const VALUE_CACHE = new Map<number, number>();

const IS_DIGIT = /\p{Nd}/u;

/**
 * The numeric value of a single decimal digit in any script, or `-1`.
 *
 * ★ Bounded at ten steps by construction: a `Nd` run is exactly ten long, so a
 *   value is never more than nine away from its zero. A character that walks
 *   further than that is not in a well-formed run and is refused rather than
 *   guessed at.
 */
export function svDigitValue(character: string): number {
  if (!character || !IS_DIGIT.test(character)) return -1;
  const cp = character.codePointAt(0)!;
  const cached = VALUE_CACHE.get(cp);
  if (cached !== undefined) return cached;

  for (let back = 0; back <= 9; back++) {
    const below = cp - back - 1;
    if (below < 0 || !IS_DIGIT.test(String.fromCodePoint(below))) {
      VALUE_CACHE.set(cp, back);
      return back;
    }
  }
  return -1;
}

/**
 * Every decimal digit in `text`, in order, as ASCII. Everything else is dropped.
 *
 * The drop-in replacement for `replace(/\D/g, '')` — same result for ASCII
 * input, and a result at all for everyone else.
 *
 * ★★ `Array.from` RATHER THAN A `for` OVER INDICES, because the mathematical
 *    digit sets live in the astral planes and a surrogate pair read as two
 *    characters is two non-digits.
 *
 * ⚠️ IT NORMALISES TO ASCII RATHER THAN PRESERVING THE SCRIPT, and that is the
 *    right way round for this job: the value goes to a server, into a
 *    comparison, or into `Number()`, and every one of those wants `123456`. The
 *    place to put the user's own digits back is the DISPLAY, which is a
 *    separate decision made where it can see the locale.
 */
export function svDigitsOnly(text: string): string {
  if (!text) return '';
  // ★ The common case, taken without allocating: an ASCII-only string is what
  //   the overwhelming majority of input is, and this runs on every keystroke.
  if (!/[^\x20-\x7E]/.test(text)) return text.replace(/\D/g, '');

  let out = '';
  for (const character of Array.from(text)) {
    const value = svDigitValue(character);
    if (value >= 0) out += String(value);
  }
  return out;
}

/**
 * Every decimal digit in `text` rewritten as ASCII, with everything else left
 * exactly where it was.
 *
 * The sibling of `svDigitsOnly` for the case where the SHAPE of the text still
 * matters — a time, a date, a version — and only the digits need normalising.
 * `svDigitsOnly('١٤:٣٠')` is `'1430'`, which has lost the colon that says which
 * half is hours; this returns `'14:30'`.
 *
 * ⚠️ Separators are NOT normalised. An Arabic decimal separator or a fullwidth
 *    colon is a different character from `.` or `:` and stays one — deciding
 *    which punctuation a given field accepts is the field's job, not this
 *    function's, and quietly rewriting `٬` to `,` would be a guess about intent.
 */
export function svNormalizeDigits(text: string): string {
  if (!text) return '';
  // Same fast path as `svDigitsOnly`: ASCII input is already normalised.
  if (!/[^\x20-\x7E]/.test(text)) return text;

  let out = '';
  for (const character of Array.from(text)) {
    const value = svDigitValue(character);
    out += value >= 0 ? String(value) : character;
  }
  return out;
}
