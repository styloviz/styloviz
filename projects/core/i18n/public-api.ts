/*
 * @styloviz/core/i18n — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
// ── Locale ──────────────────────────────────────────────────────────────────
// Currency placement and number formatting read out of `Intl`'s own CLDR data,
// not a table in this repo. `FI-15-I3`; a seam, not an `SvLocaleContext`.
export { SV_LOCALE, SV_MACHINE_LOCALE, provideSvLocale, svLocale, svFormatCount, svFormatCompact, svMonthLabels } from './locale';
export { SV_LABEL_OVERRIDES, injectSvLabels, provideSvLabels } from './labels';
export { SvLabelPipe, svFormatLabel } from './label-format';
export { SV_CORE_LABELS } from './core.labels';
export type { SvCoreLabels } from './core.labels';
export type { SvLabelParams } from './label-format';
export type { SvLabelOverrides, SvLabelRegistry } from './labels';
export { svCurrencyAffix, svFormatNumber } from './number-format';
// `replace(/\D/g,'')` does not strip punctuation from a code typed on an Arabic
// or Bengali keypad — it strips the code. `FI-16-I3`.
export { svDigitsOnly, svDigitValue, svNormalizeDigits } from './digits';
export { svParseTime, svResolveHour24, svFormatTime, svDayPeriods } from './time-parse';
export { svComposeDateTime, svZoneOffsetMinutes } from './zoned';
// Which day the week starts on — `en-US` Sunday, `en-GB` Monday, `ar-EG`
// Saturday. A calendar is read by column before it is read by number.
// `FI-09-M2`.
export { svFirstDayOfWeek, svWeekdayLabels } from './week';
// The kit's date-value policy (`FI-09-M1`): a calendar date is `YYYY-MM-DD`,
// with no time and no zone, and `svToday` is the one conversion that has to ask
// which zone's "today" you mean. `SvDateValueAdapter` is the seam a Temporal
// migration swaps behind.
export {
  svAddCalendarDays,
  svCalendarDate,
  svCalendarDateOf,
  svCalendarDateOfInstant,
  svCompareCalendarDates,
  svIsCalendarDate,
  svIsoDateAdapter,
  svToday,
} from './date-value';
export type {
  SvCalendarDate,
  SvDateValueAdapter,
  SvWallClockTime,
} from './date-value';
export type { SvCurrencyAffix } from './number-format';
export type { SvParsedTime, SvDayPeriods, SvParseTimeOptions } from './time-parse';
export type { SvComposedDateTime, SvWallClockStatus } from './zoned';
export { svFoldText, svTextMatches } from './text-fold';
export type { SvTextMatchMode, SvTextMatchOptions } from './text-fold';
/**
 * @internal For other `@styloviz/core` entry points only (`security`'s highlighter)
 * — the `ɵ` prefix is Angular's mark for "not public API; may change in any release".
 */
export { svFoldWithMap as ɵsvFoldWithMap, svFoldedHits as ɵsvFoldedHits, svUnfoldRange as ɵsvUnfoldRange } from './text-fold';
/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './core.labels.packs';
