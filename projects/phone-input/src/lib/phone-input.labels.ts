/**
 * The accessible names `sv-phone-input` renders, in English. Override any of
 * them with `provideSvLabels({ phoneInput: { … } })` from `@styloviz/core`.
 */
export interface SvPhoneInputLabels {
  readonly country: string;
  readonly phoneNumber: string;
  readonly extension: string;
  /** The country picker's accessible name: the field label, the country and its dial code. */
  readonly pickerName: string;
  /** Length hint when the number is past E.164's ceiling. */
  readonly lengthHintE164: string;
  /** Length hint for a plan with one national length. */
  readonly lengthHintExact: string;
  /** Length hint for a plan with a range of national lengths. */
  readonly lengthHintRange: string;
}

export const SV_PHONE_INPUT_LABELS: SvPhoneInputLabels = {
  country: 'Country',
  phoneNumber: 'Phone number',
  extension: 'Extension',
  pickerName: '{label}: {country} ({dialCode})',
  lengthHintE164:
    'That is {count} digits including {dialCode}. E.164 allows at most {max}, so this cannot be stored as an international number.',
  lengthHintExact: '{country} numbers are usually {min} digits; this has {count}.',
  lengthHintRange: '{country} numbers are usually {min}–{max} digits; this has {count}.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    phoneInput: SvPhoneInputLabels;
  }
}
