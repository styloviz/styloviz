/**
 * The strings `sv-input-field` and `sv-date-picker` render, in
 * English. Override any of them with `provideSvLabels({ inputField: { … } })`
 * from `@styloviz/core`.
 */
export interface SvInputFieldLabels {
  readonly showPassword: string;
  readonly hidePassword: string;
  readonly clearDate: string;
  readonly datePickerCalendar: string;
  readonly previousPeriod: string;
  readonly nextPeriod: string;
  readonly switchViewFrom: string;
  /** The tag after an optional field's label. */
  readonly optionalTag: string;
  /** The date picker's empty-value placeholder (the `placeholder` input's default). */
  readonly selectDate: string;
  /** The calendar footer's clear button. */
  readonly clearButton: string;
  /** The calendar footer's jump-to-today button. */
  readonly todayButton: string;
  /** `sv-input-field`'s clear button (`clearable`). */
  readonly clear: string;
}

export const SV_INPUT_FIELD_LABELS: SvInputFieldLabels = {
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  clearDate: 'Clear date',
  datePickerCalendar: 'Date picker calendar',
  previousPeriod: 'Previous',
  nextPeriod: 'Next',
  switchViewFrom: 'Switch view, currently {view}',
  optionalTag: '(optional)',
  selectDate: 'Select date',
  clearButton: 'Clear',
  todayButton: 'Today',
  clear: 'Clear',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    inputField: SvInputFieldLabels;
  }
}
