/*
 * @styloviz/core/a11y — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
// Accessibility
export { prefersReducedMotion, onReducedMotionChange } from './reduced-motion';
export { svHoverUnavailable, svOnHoverAvailabilityChange } from './coarse-pointer';
export { svHighContrast, svOnHighContrastChange } from './high-contrast';
export { svReadableInk } from './readable-ink';
export { svIsRtl, svLogicalArrowKey, svPointerFraction } from './direction';
export { SvLiveAnnouncer, svAnnouncePriorityFor } from './live-announcer';
export type {
  SvAnnouncePriority,
  SvAnnounceOptions,
  SvAnnouncement,
  SvScopedAnnouncer,
} from './live-announcer';
export { svUniqueId, SvIdSequence } from './unique-id';
// Arrow-key movement inside a composite widget. Movement only — whether moving
// also selects is the caller's to decide, and radiogroups and chip sets differ.
export { svRovingTarget } from './roving';
export { SvRevealFocusDirective, svUnobscuredDelta } from './reveal-focus';
export type { SvBox, SvStickyBand, SvStickySide } from './reveal-focus';
// `X-10` — keyboard at scale: one tab stop, page jumps that clamp, typeahead,
// and the documented ceiling for a collection that renders every row.
export {
  svCollectionTarget,
  createTypeahead,
  svIsTypeaheadKey,
  svWarnUnvirtualizedCeiling,
  SV_UNVIRTUALIZED_ROW_CEILING,
} from './collection-keys';
export type {
  SvCollectionTargetOptions,
  SvTypeahead,
  SvTypeaheadOptions,
} from './collection-keys';
export {
  svColorName,
  injectSvColorNamer,
  svContrastRatio,
  svFormatRatio,
  svHexToRgb,
  svIsValidHex,
  svNormalizeHex,
  svRelativeLuminance,
  svWcagGrade,
} from './contrast';
export type { SvColorNameLabels, SvRgb, SvWcagGrade } from './contrast';
export { SvDataSummaryTableComponent } from './data-summary-table.component';
export { SV_EMPTY_SUMMARY } from './data-summary';
export type { SvDataSummary, SvSummaryRow } from './data-summary';
export { SV_CHART_A11Y, SvChartDataTableDirective, provideSvChartA11y } from './chart-a11y';
export type { SvChartA11yConfig, SvChartDataTableMode } from './chart-a11y';
export { SvShortcutRegistryService, SV_SHORTCUT_SEQUENCE_TIMEOUT_MS } from './shortcut-registry';
export type {
  SvShortcutScope,
  SvShortcutBinding,
  SvShortcutHandle,
  SvShortcutConflict,
} from './shortcut-registry';
export {
  svParseShortcut,
  svMatchesShortcut,
  svShortcutTokens,
  svShortcutSequenceTokens,
  svParseShortcutSequence,
  svShortcutId,
  svIsTextEntryTarget,
} from './shortcut';
export type {
  SvShortcut,
  SvShortcutModifier,
  SvShortcutTokensOptions,
} from './shortcut';
