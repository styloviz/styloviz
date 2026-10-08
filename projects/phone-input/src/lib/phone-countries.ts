/**
 * phone-countries.ts — the bundled country list this package's picker draws
 * from. Deliberately small (a "quick win" set, not an exhaustive ISO 3166
 * list) — pass `countries` on `sv-phone-input` to narrow it further, `plans` to
 * replace the numbering data outright, or fork this file for the full set.
 *
 * ★★★ THE `preset` FIELD IS GONE, AND ITS REMOVAL IS THE FIX. Every non-NANP
 * country used to share one mask — `+# (###) ###-####`, which is the NANP shape
 * with a `+` in front: ONE country-code digit and TEN national ones. The United
 * Kingdom's code is two digits and its numbers are ten, France's are nine,
 * Japan's vary. Selecting "United Kingdom" and typing a real London number was
 * impossible, and nothing said so.
 *
 * ★★ The country code was the wasted slot: the picker already displays `+44`,
 * so spending mask positions on it left fewer than the number needed. The mask
 * now covers the NATIONAL number only.
 *
 * ★ And the numbers below are best-effort, not authority. Numbering plans change
 * more often than a release cycle; `plans` exists so a host can replace them,
 * and the grouping is cosmetic rather than validation.
 */

import type { SvNationalLength } from './phone-plan';

export type PhoneCountryCode = 'US' | 'GB' | 'CA' | 'AU' | 'DE' | 'FR' | 'IN' | 'JP';

export interface PhoneCountry {
  readonly code: string;
  readonly name: string;
  readonly dialCode: string;
  /**
   * How many digits the NATIONAL number has — exact, or `[min, max]` for a plan
   * with more than one length. Used for a hint, never to block input.
   */
  readonly nationalDigits: SvNationalLength;
  /** Cosmetic grouping of the national number, e.g. `[3, 3, 4]`. */
  readonly groups?: readonly number[];
  /**
   * An explicit mask, when the conventional formatting is not just spaces.
   * `(###) ###-####` is what a US reader expects and a group list cannot say.
   */
  readonly nationalMask?: string;
}

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  // NANP: the one plan in this list that really is fixed, and the one whose
  // punctuation readers recognise on sight.
  { code: 'US', name: 'United States',  dialCode: '+1',  nationalDigits: 10,      groups: [3, 3, 4], nationalMask: '(###) ###-####' },
  { code: 'CA', name: 'Canada',         dialCode: '+1',  nationalDigits: 10,      groups: [3, 3, 4], nationalMask: '(###) ###-####' },
  // 10 national digits, conventionally grouped 4-6 for mobiles and 2-4-4 for
  // London. One grouping cannot serve both, which is the point of `plans`.
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', nationalDigits: [9, 10], groups: [4, 6] },
  { code: 'AU', name: 'Australia',      dialCode: '+61', nationalDigits: 9,       groups: [1, 4, 4] },
  // Germany's plan is genuinely variable: subscriber numbers run from 3 to 11
  // digits after the area code. A single mask cannot express it and does not try.
  { code: 'DE', name: 'Germany',        dialCode: '+49', nationalDigits: [6, 11], groups: [4, 7] },
  { code: 'FR', name: 'France',         dialCode: '+33', nationalDigits: 9,       groups: [1, 2, 2, 2, 2] },
  { code: 'IN', name: 'India',          dialCode: '+91', nationalDigits: 10,      groups: [5, 5] },
  { code: 'JP', name: 'Japan',          dialCode: '+81', nationalDigits: [9, 10], groups: [2, 4, 4] },
];
