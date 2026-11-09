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
export { SV_PHONE_INPUT_LABELS } from './lib/phone-input.labels';
export type { SvPhoneInputLabels } from './lib/phone-input.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/phone-input.labels.packs';
