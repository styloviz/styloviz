import { svDigitsOnly } from '@styloviz/core';
import type { PhoneCountry } from './phone-countries';

/**
 * Numbering plans, and why this file refuses to pretend it knows them.
 *
 * ★★★ THE BUNDLED MASK WAS THE NANP MASK WITH A `+` BOLTED ON.
 * `phone-intl` was `+# (###) ###-####`: **one** country-code digit and **ten**
 * national ones. It was applied to the United Kingdom (+44), Australia (+61),
 * Germany (+49), France (+33), India (+91) and Japan (+81) — every one of which
 * has a two-digit country code that could not be typed into `+#` at all, and a
 * national length that is not ten. Selecting "United Kingdom" and entering a
 * real London number was impossible, and the field said nothing.
 *
 * ★★ The country code was the wasted slot. The picker already shows `+44`, so
 * spending mask positions on it left the field with fewer than the number
 * needed. Taking it out of the mask is the fix and the simplification at once.
 *
 * ★★★ AND THE PART THAT CANNOT BE FIXED BY A BIGGER TABLE: numbering plans
 * change more often than a release cycle. New mobile prefixes, new area codes,
 * whole plans renumbered. A table bundled into a component is stale the day it
 * ships, so what this file owes is not authority but **honesty about its
 * limits**: the grouping is cosmetic, the check is a length bound, and a host
 * with real requirements passes its own plans in — or validates with a library
 * that is updated on its own schedule.
 */

/**
 * E.164's hard ceiling: country code plus national number, at most 15 digits.
 *
 * ★ This one really is fixed — it is the format's definition rather than any
 * country's plan — so it is the one bound worth enforcing rather than hinting.
 */
export const SV_E164_MAX_DIGITS = 15;

/** How long a national number may be: exact, or `[min, max]`. */
export type SvNationalLength = number | readonly [number, number];

export function svMinNational(length: SvNationalLength): number {
  return typeof length === 'number' ? length : length[0];
}

export function svMaxNational(length: SvNationalLength): number {
  return typeof length === 'number' ? length : length[1];
}

/**
 * Build a mask of `#` placeholders from a grouping.
 *
 * `[3, 3, 4]` becomes `### ### ####`. A country whose plan states an explicit
 * `nationalMask` keeps it — the parentheses in `(###) ###-####` are what a US
 * reader expects, and deriving them from a group list would lose them.
 */
export function svNationalMask(country: PhoneCountry): string {
  if (country.nationalMask) return country.nationalMask;
  const groups = country.groups ?? [svMaxNational(country.nationalDigits)];
  return groups.map((n) => '#'.repeat(n)).join(' ');
}

/** Where the digits typed so far sit against the plan. */
export type SvPhoneLengthState = 'empty' | 'short' | 'ok' | 'over';

export function svNationalLengthState(
  digits: string,
  country: PhoneCountry,
): SvPhoneLengthState {
  const n = svDigitsOnly(digits).length;
  if (n === 0) return 'empty';
  if (n < svMinNational(country.nationalDigits)) return 'short';
  if (n > svMaxNational(country.nationalDigits)) return 'over';
  return 'ok';
}

/**
 * A sentence about the length, or `''` when there is nothing to say.
 *
 * ★★ A HINT, NOT AN ERROR, and the distinction is the whole point. The plan
 * this is measured against may be out of date — that is the premise of the
 * file — so a number the table calls too short may be perfectly dialable. It
 * says what it expected and leaves the judgement to the person who can
 * actually check. The one exception is the E.164 ceiling, which is the format's
 * own rule and cannot go stale.
 */
export function svLengthHint(digits: string, country: PhoneCountry): string {
  const n = svDigitsOnly(digits).length;
  const dial = country.dialCode.replace(/\D/g, '').length;
  if (n + dial > SV_E164_MAX_DIGITS) {
    return `That is ${n + dial} digits including ${country.dialCode}. E.164 allows at most ` +
      `${SV_E164_MAX_DIGITS}, so this cannot be stored as an international number.`;
  }

  const state = svNationalLengthState(digits, country);
  if (state === 'empty' || state === 'ok') return '';

  const min = svMinNational(country.nationalDigits);
  const max = svMaxNational(country.nationalDigits);
  const expected = min === max ? `${min} digits` : `${min}–${max} digits`;
  // One sentence for both directions: "usually 10 digits; this has 7" and
  // "…; this has 12" already say which way it is off.
  return `${country.name} numbers are usually ${expected}; this has ${n}.`;
}

/**
 * Group digits for display, without ever dropping one.
 *
 * ★ Anything past the last group stays on the end rather than being discarded.
 * A formatter that silently truncates is how a correct number becomes a wrong
 * one, and the plan being wrong is the case this file exists to expect.
 */
export function svGroupNational(digits: string, groups: readonly number[]): string {
  const clean = svDigitsOnly(digits);
  if (!clean) return '';
  if (!groups.length) return clean;

  const out: string[] = [];
  let at = 0;
  for (const size of groups) {
    if (at >= clean.length) break;
    out.push(clean.slice(at, at + size));
    at += size;
  }
  if (at < clean.length) out.push(clean.slice(at));
  return out.join(' ');
}
