/**
 * @styloviz/phone-input — Public API
 */
export { PHONE_COUNTRIES } from './lib/phone-countries';
export type { PhoneCountry, PhoneCountryCode } from './lib/phone-countries';
export {
  SV_E164_MAX_DIGITS,
  svGroupNational,
  svLengthHint,
  svMaxNational,
  svMinNational,
  svNationalLengthState,
  svNationalMask,
} from './lib/phone-plan';
export type { SvNationalLength, SvPhoneLengthState } from './lib/phone-plan';
export { SvPhoneFlagComponent } from './lib/phone-flag.component';
export { SvPhoneInputComponent } from './lib/phone-input.component';
