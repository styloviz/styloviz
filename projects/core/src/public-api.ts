/**
 * @styloviz/core — Public API
 *
 * All exports from this file are part of the public API surface.
 * Do not import from internal paths — always use '@styloviz/core'.
 */

// Token + provider
export { STYLOVIZ_CONFIG, provideStyloviz, provideStylviz } from './lib/tokens/styloviz.token';
export type { StylovizConfig, StyloVizConfig } from './lib/tokens/styloviz.token';

// Services
export { ThemeService } from './lib/services/theme.service';
export type { Theme } from './lib/services/theme.service';

export { ToastService } from './lib/services/toast.service';
export type {
  Toast,
  ToastVariant,
  ToastPosition,
  ToastAction,
  ToastOptions,
  ToastScope,
} from './lib/services/toast.service';

// Directives
export { SvChartAnimDirective } from './lib/directives/chart-animate.directive';
export { SvAutofocusDirective } from './lib/directives/autofocus.directive';
export { SvStopPropagationDirective } from './lib/directives/stop-propagation.directive';
export { SvRevealDirective } from './lib/directives/reveal.directive';

// ── Export primitives ───────────────────────────────────────────────────────
// Free tier: CSV plus the browser-download step, and a dependency-free ZIP
// writer. Styled Excel and PDF build on these in `@styloviz-pro/export`.
export {
  svDiffLines,
  svDiffSummary,
  svDiffValues,
  svValueDiffSummary,
} from './lib/data/diff';
export type {
  SvChangeKind,
  SvDiffHunk,
  SvDiffLine,
  SvDiffLineKind,
  SvDiffOptions,
  SvDiffResult,
  SvValueChange,
  SvValueDiffOptions,
} from './lib/data/diff';
export { svToCsv, svCsvFormulaSafe, svDownloadBlob, svDownloadText } from './lib/export/csv';
export type { SvCsvOptions } from './lib/export/csv';
export { createZipBlob } from './lib/export/zip';
export type { ZipEntry } from './lib/export/zip';

// Accessibility
export { prefersReducedMotion, onReducedMotionChange } from './lib/a11y/reduced-motion';
export { svHoverUnavailable, svOnHoverAvailabilityChange } from './lib/a11y/coarse-pointer';
export { svHighContrast, svOnHighContrastChange } from './lib/a11y/high-contrast';
export { svReadableInk } from './lib/a11y/readable-ink';

// ── Locale ──────────────────────────────────────────────────────────────────
// Currency placement and number formatting read out of `Intl`'s own CLDR data,
// not a table in this repo. `FI-15-I3`; a seam, not an `SvLocaleContext`.
export { svCurrencyAffix, svFormatNumber } from './lib/i18n/number-format';
// `replace(/\D/g,'')` does not strip punctuation from a code typed on an Arabic
// or Bengali keypad — it strips the code. `FI-16-I3`.
export { svDigitsOnly, svDigitValue, svNormalizeDigits } from './lib/i18n/digits';
export { svParseTime, svResolveHour24, svFormatTime } from './lib/i18n/time-parse';
export { svComposeDateTime, svZoneOffsetMinutes } from './lib/i18n/zoned';
// Which day the week starts on — `en-US` Sunday, `en-GB` Monday, `ar-EG`
// Saturday. A calendar is read by column before it is read by number.
// `FI-09-M2`.
export { svFirstDayOfWeek, svWeekdayLabels } from './lib/i18n/week';
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
} from './lib/i18n/date-value';
export type {
  SvCalendarDate,
  SvDateValueAdapter,
  SvWallClockTime,
} from './lib/i18n/date-value';
export { svIsRtl, svPointerFraction } from './lib/a11y/direction';
export { SvLiveAnnouncer, svAnnouncePriorityFor } from './lib/a11y/live-announcer';
export type {
  SvAnnouncePriority,
  SvAnnounceOptions,
  SvAnnouncement,
  SvScopedAnnouncer,
} from './lib/a11y/live-announcer';
export { svSplitPastedList, svApplyPastedList, svPasteListSummary } from './lib/data/paste-list';
export { svWarnOnce, svResetWarnOnce } from './lib/dev/warn-once';
export { svUniqueId, SvIdSequence } from './lib/a11y/unique-id';
export type { SvUnresolvedValue, SvUnresolvedReason } from './lib/data/unresolved-value';
export {
  SV_LINK_ADAPTER,
  provideSvLinkAdapter,
  svHrefLinkAdapter,
  svIsModifiedClick,
} from './lib/nav/link-adapter';
export type { SvLinkAdapter, SvLinkTarget } from './lib/nav/link-adapter';
export {
  svCheckableDescendants,
  svToggleTriState,
  svRollUpTriState,
  svIndeterminateKeys,
  svCascadeToNewChildren,
} from './lib/data/tri-state';
export type { SvTriStateAdapter } from './lib/data/tri-state';
export { svKeyedRequestGuard, SV_SUPERSEDED } from './lib/data/keyed-request-guard';
export type { SvKeyedRequestGuard } from './lib/data/keyed-request-guard';
export type { SvPasteListResult, SvPasteRejection, SvApplyPastedOptions } from './lib/data/paste-list';
export type { SvCurrencyAffix } from './lib/i18n/number-format';
export type { SvParsedTime } from './lib/i18n/time-parse';
export type { SvComposedDateTime, SvWallClockStatus } from './lib/i18n/zoned';

// ── Security ────────────────────────────────────────────────────────────────
// The kit's ONE HTML sanitiser. Anything that renders markup it did not author
// uses these; a second allowlist somewhere else is the failure this prevents.
export {
  svCleanPastedHtml,
  svCleanStyle,
  svEscapeHtml,
  svIsSafeUrl,
  svPasteSummary,
  svPlainTextFromHtml,
  svPlainTextToHtml,
  svSanitizeEditorHtml,
} from './lib/security/html-sanitizer';
export type { SvEditorHtmlOptions, SvPasteOptions, SvPasteResult } from './lib/security/html-sanitizer';
// Compiling a regular expression someone else wrote — see `pattern.ts` for the
// measured cost of not doing this (30 s of frozen main thread, one keystroke).
export { svCompilePattern, svIsCatastrophicPattern } from './lib/security/pattern';
// Marking the query inside a result label WITHOUT building an HTML string —
// the obvious `replace(re, '<mark>$1</mark>')` + `[innerHTML]` is an injection.
export { svHighlightSegments, svHighlightPositions } from './lib/security/highlight';
// Building a selector from a value somebody else chose. `CSS.escape` is the
// wrong tool (it escapes identifiers, not quoted attribute values) AND it is a
// `window` property that `?.` cannot guard — see `selector.ts`.
export { svAttrSelector, svEscapeAttrValue } from './lib/security/selector';
// One sensitive-value policy (masking, copy auditing, host-attribute stripping,
// app-wide privacy declaration) — see `docs/sensitive-value-policy.md`.
export {
  svLast4,
  svMaskTail,
  svStripHostAttributes,
  SV_SENSITIVE_PRIVACY,
  provideSvSensitivePrivacy,
  injectSvSensitivePrivacy,
} from './lib/security/sensitive-value';
export type { SvSensitiveCopyEvent } from './lib/security/sensitive-value';
export type { SvHighlightSegment } from './lib/security/highlight';
export type {
  SvPatternResult,
  SvPatternProblem,
  SvCompilePatternOptions,
} from './lib/security/pattern';
// Arrow-key movement inside a composite widget. Movement only — whether moving
// also selects is the caller's to decide, and radiogroups and chip sets differ.
export { svRovingTarget } from './lib/a11y/roving';
// `X-10` — keyboard at scale: one tab stop, page jumps that clamp, typeahead,
// and the documented ceiling for a collection that renders every row.
export {
  svCollectionTarget,
  createTypeahead,
  svIsTypeaheadKey,
  svWarnUnvirtualizedCeiling,
  SV_UNVIRTUALIZED_ROW_CEILING,
} from './lib/a11y/collection-keys';
export type {
  SvCollectionTargetOptions,
  SvTypeahead,
  SvTypeaheadOptions,
} from './lib/a11y/collection-keys';
export { createCompositionGuard } from './lib/forms/composition';
export type { SvCompositionGuard } from './lib/forms/composition';
// Drop-point caret for drop handlers (`X-4`) — shared by sv-mention and sv-rich-text-editor.
export { svCaretRangeFromPoint } from './lib/forms/caret-from-point';
export {
  svColorName,
  svContrastRatio,
  svFormatRatio,
  svHexToRgb,
  svIsValidHex,
  svNormalizeHex,
  svRelativeLuminance,
  svWcagGrade,
} from './lib/a11y/contrast';
export type { SvRgb, SvWcagGrade } from './lib/a11y/contrast';
export { SvDataSummaryTableComponent } from './lib/a11y/data-summary-table.component';
export { SV_EMPTY_SUMMARY } from './lib/a11y/data-summary';
export type { SvDataSummary, SvSummaryRow } from './lib/a11y/data-summary';

// Models
export type {
  NavChild,
  NavChildGroup,
  MenuItem,
  MenuGroup,
} from './lib/models/nav.model';

// Virtualization
export { createVariableVirtualizer, createVirtualizer } from './lib/virtual/virtualizer';
export type {
  NearEndOptions,
  Virtualizer,
  VirtualizerOptions,
  VariableVirtualizerOptions,
  VirtualRange,
} from './lib/virtual/virtualizer';

// ─── Data wiring ─────────────────────────────────────────────────────────────
// The contract every server-backed component speaks: what was asked for, what
// came back, what failed, and how a row keeps its identity across refreshes.
// Types and helpers only — no HTTP, no rxjs. See `@styloviz/data` for adapters.

export type {
  SvSortDirection,
  SvSort,
  SvDataQuery,
  SvPage,
  SvDataError,
  SvAsyncState,
  SvEmptyReason,
  SvItemKey,
  SvPendingKeys,
  SvMutationStatus,
  SvConnectionState,
} from './lib/data/types';

export {
  SV_DEFAULT_QUERY,
  createQuery,
  patchQuery,
  queriesEqual,
  toggleSort,
} from './lib/data/query';

export { toSvDataError, isSvDataError, isRetryable } from './lib/data/errors';

export { createRequestGuard } from './lib/data/request-guard';
export { createAsyncAction } from './lib/data/async-action';
export { createCloseGuard, svDismissReason } from './lib/overlay/close-guard';
export { SvShortcutRegistryService } from './lib/a11y/shortcut-registry';
export type {
  SvShortcutScope,
  SvShortcutBinding,
  SvShortcutHandle,
  SvShortcutConflict,
} from './lib/a11y/shortcut-registry';
export {
  svParseShortcut,
  svMatchesShortcut,
  svShortcutTokens,
  svShortcutId,
  svIsTextEntryTarget,
} from './lib/a11y/shortcut';
export type {
  SvShortcut,
  SvShortcutModifier,
  SvShortcutTokensOptions,
} from './lib/a11y/shortcut';

export { createSheetMode, SV_SHEET_SAFE_AREA_PADDING } from './lib/overlay/sheet-mode';
export type { SvSheetMode, SvSheetModeOptions } from './lib/overlay/sheet-mode';

export { SvBannerStackService } from './lib/feedback/banner-stack';
export type {
  SvBannerSlot,
  SvBannerRegistration,
  SvBannerHandle,
} from './lib/feedback/banner-stack';

export { SvOverlayRouteService } from './lib/overlay/overlay-route';
export type { SvRouteAwareHandle, SvRouteAwareOptions } from './lib/overlay/overlay-route';
export type {
  SvCloseGuard,
  SvCloseGuardOptions,
  SvCloseReason,
  SvCloseVerdict,
  SvDismissReason,
} from './lib/overlay/close-guard';
// The picker-shaped controller built on that guard: term in, options out, with
// the debounce, the abort, the stale/loading split and the empty-vs-not-asked
// distinction handled once. Lived in `@styloviz/data` until `FI-23-M3` needed a
// component to own its own fetch — see that package's re-export for why.
export { svSuggestController } from './lib/data/suggest-controller';
export type {
  SvSuggestController,
  SvSuggestControllerOptions,
  SvSuggestSource,
} from './lib/data/suggest-controller';
export type { SvRequest, SvRequestGuard } from './lib/data/request-guard';
// `FI-23-M1` — the adapter layer of the select split: search, paging and async
// state for one select as one object, built on the controller above. Here and
// not in `@styloviz/data` for the same reason the controller is: the select
// consumes it, and a component may not depend on `@styloviz/data`.
export { svSelectSource } from './lib/data/select-source';
export type {
  SvSelectSource,
  SvSelectSourceOptions,
  SvSelectSourcePage,
  SvSelectSourcePageRequest,
  SvSelectSourceSearch,
} from './lib/data/select-source';
// …and the token the select's feature children (`svSelectSearch`,
// `svSelectVirtual`, `svSelectBulk`) register through. Shared by both tiers so
// a feature child from one works inside the other's component.
export { SV_SELECT_FEATURE, svMergeSelectFeatures } from './lib/forms/select-feature';
export type { SvSelectFeature, SvSelectFeatureConfig } from './lib/forms/select-feature';
export type {
  SvAsyncAction,
  SvAsyncActionOptions,
  SvAsyncActionOutcome,
  SvAsyncActionStatus,
  SvPendingDismissal,
} from './lib/data/async-action';

// The one treatment for "answered, but a newer request is in flight". Six
// picker families needed it; without a shared directive they would have had six
// different answers, three of which are "say nothing".
export { SvStaleDirective } from './lib/data/stale.directive';

export { createDebouncer } from './lib/data/debounce';
export type { SvDebouncer, SvDebouncerOptions } from './lib/data/debounce';

export { resolveItemKey, trackByItemKey, warnOnDuplicateItemKeys } from './lib/data/item-key';

export { svCutHierarchyCycles } from './lib/data/hierarchy';
export type {
  SvAcyclicHierarchy,
  SvHierarchyAccessors,
  SvHierarchyCycle,
  SvHierarchyNode,
} from './lib/data/hierarchy';

export { svAppendSample, svPauseNotice } from './lib/data/live-feed';

export { svMergeRecords, svOrderRecords } from './lib/data/record-merge';
export type {
  SvMergeableRecord,
  SvMergeReport,
  SvMergeOptions,
} from './lib/data/record-merge';
export type {
  SvAppendResult,
  SvAppendSampleOptions,
  SvLateSamplePolicy,
} from './lib/data/live-feed';
export { createVisibilityPause } from './lib/data/visibility-pause';
export type { SvLivePause } from './lib/data/visibility-pause';
export { createLiveTicker } from './lib/data/live-ticker';
export type { SvLiveTicker, SvLiveTickerOptions } from './lib/data/live-ticker';
export { createOffscreenPause } from './lib/data/offscreen-pause';
export type { SvOffscreenPause } from './lib/data/offscreen-pause';

export {
  SV_OTHER_SHARE_COLOR,
  svGroupSmallShares,
  svOrderShares,
  svPrepareShares,
  svShareSummaryRows,
} from './lib/data/small-shares';
export type {
  SvGroupSharesOptions,
  SvPrepareSharesOptions,
  SvPreparedShares,
  SvShareGrouping,
  SvShareOrder,
  SvShareSlice,
} from './lib/data/small-shares';

export { svFiniteExtent, svGapNotice, svGapRuns, svIsGap } from './lib/data/series-gaps';
export type { SvFiniteExtent } from './lib/data/series-gaps';

export { svApplyValuePolicy, svIsPlottableShare, svResolveShares } from './lib/data/value-policy';
export type {
  SvSharePoint,
  SvShareResult,
  SvValuePolicy,
  SvValuePolicyOptions,
  SvValuePolicyResult,
} from './lib/data/value-policy';

export { svBinDensityStep, svHexBin, svHexPath } from './lib/data/point-bins';
export type { SvHexBinOptions, SvPointBin } from './lib/data/point-bins';

export { svNiceScale, svTickLabel } from './lib/data/nice-scale';
export type { SvNiceScale } from './lib/data/nice-scale';

export { createStreamOverlay } from './lib/data/stream-overlay';
export type { SvStreamOverlay } from './lib/data/stream-overlay';

export { createOptimisticEdit, svRequestKey } from './lib/data/optimistic';
export type { SvOptimisticEdit, SvOptimisticEditOptions } from './lib/data/optimistic';

export {
  svPersistState,
  svRestoreState,
  svRestoreParams,
  svWarnRestoreRefused,
} from './lib/data/persisted-state';
export type {
  SvPersistedState,
  SvRestoreReason,
  SvRestoreResult,
  SvRestoreSpec,
  SvRestoreParamsSpec,
} from './lib/data/persisted-state';

export { svPersistedStore, svLocalStorage } from './lib/data/persisted-store';
export type {
  SvPersistedStore,
  SvPersistedStoreLoad,
  SvPersistedStoreOptions,
  SvPersistedStoreRefusal,
} from './lib/data/persisted-store';

// Async-state shells — the shared loading / error / empty treatment.
export { SvSkeletonShellComponent } from './lib/data/shells/skeleton-shell.component';
export type { SvSkeletonShellVariant } from './lib/data/shells/skeleton-shell.component';
export { SvErrorShellComponent } from './lib/data/shells/error-shell.component';
export { SvEmptyShellComponent } from './lib/data/shells/empty-shell.component';
export { SvChartFrameComponent } from './lib/data/shells/chart-frame.component';
export { SvConnectionStatusComponent } from './lib/data/shells/connection-status.component';

// The declaration a chart makes when it has no fetch to report on.
export type { SvLocalStateChart } from './lib/data/local-state-chart';

// ── Overlay ─────────────────────────────────────────────────────────────────
// Shared behaviour for portalled panels pinned to a trigger.
export { createAnchorScrollGuard } from './lib/overlay/anchor-scroll-guard';
// Global move listeners for the span of a drag only — see the file header (1.0 audit, M2).
export { svListenWhile, type SvListenTarget, type SvListenWhileRef } from './lib/directives/listen-while';
export type { SvAnchorScrollGuard, SvAnchorScrollGuardOptions } from './lib/overlay/anchor-scroll-guard';
export {
  svLockBodyScroll,
  svUnlockBodyScroll,
  svBodyScrollLockDepth,
  svResetBodyScrollLock,
} from './lib/overlay/body-scroll-lock';
export { createFocusScope } from './lib/overlay/focus-scope';
export {
  svRecoverFocus,
  svRestoreFocusedItem,
  svSnapshotFocusedItem,
  svSuccessorIndex,
} from './lib/overlay/focus-recovery';
export { svCloseOnNavigation } from './lib/nav/close-on-navigation';
export { svElementSize, SV_SIZE_ZERO } from './lib/layout/element-size';
export type { SvSize, SvElementSizeOptions } from './lib/layout/element-size';
// `X-5` / `N-7` — one owner for the screen's corners: occupied-region
// registration (kit controls AND the host's chat widget / cookie banner / bottom
// nav), shared offsets, safe-area tokens and the floating z-bands.
export {
  SvFloatingLayerService,
  svFloatingRegion,
  svFloatingInset,
  SV_FLOATING_ORDER,
  SV_FLOATING_Z,
  SV_SAFE_AREA,
} from './lib/layout/floating-layer';
export type {
  SvFloatingAnchor,
  SvFloatingRegion,
  SvFloatingRegionState,
  SvFloatingRegionHandle,
  SvFloatingRegionOptions,
  SvFloatingRegionRef,
  SvSafeAreaSide,
} from './lib/layout/floating-layer';
export type { SvFocusRecoveryOptions, SvFocusedItemSnapshot } from './lib/overlay/focus-recovery';
export type { SvFocusScope, SvFocusScopeOptions, SvFocusRestoreOutcome } from './lib/overlay/focus-scope';
export { SV_FOCUSABLE_SELECTOR, svIsFocusable, svFocusableWithin, svFirstFocusableWithin } from './lib/overlay/focusable';
export { svPositionAnchored, svAnchorLost, svInSafeCorridor } from './lib/overlay/anchored-position';
export { svFixedOrigin, svFixedContainer } from './lib/overlay/fixed-origin';
export type { SvFixedOrigin } from './lib/overlay/fixed-origin';
export type {
  SvRect,
  SvPlacement,
  SvPlacementSide,
  SvPlacementAlign,
  SvPositionRequest,
  SvPositionResult,
} from './lib/overlay/anchored-position';
export { createPortalHost } from './lib/overlay/portal-host';
export type { SvPortalHost, SvPortalHostOptions } from './lib/overlay/portal-host';
export { SvOverlayStackService, SV_OVERLAY_Z_FLOOR } from './lib/overlay/overlay-stack';
export type { SvOverlayLayer, SvOverlayHandle, SvOverlayPushOptions } from './lib/overlay/overlay-stack';
export { svStackedPopup } from './lib/overlay/stacked-popup';
export type { SvStackedPopup, SvStackedPopupOptions } from './lib/overlay/stacked-popup';

// ── Navigation ──────────────────────────────────────────────────────────────
// `X-8`: the one optional place a navigation component reads and writes its
// addressable state. Deliberately router-free — a kit that hard-depends on
// `@angular/router` is unusable in a hybrid or non-routed app, so the router
// implementation is fifteen lines the CONSUMER writes. The default does nothing,
// because a component that starts rewriting the address bar on a package upgrade
// has changed the app's behaviour without being asked.
export {
  SV_NAV_LOCATION,
  provideSvNavLocation,
  svNoopNavLocation,
  svQueryParamNavLocation,
  svHashNavLocation,
  svNavParam,
} from './lib/nav/nav-location';
export type {
  SvNavLocation,
  SvNavWriteMode,
  SvNavKey,
  SvNavParam,
  SvNavParamOptions,
} from './lib/nav/nav-location';

// `X-15`: one stream for "which surface did this navigation come from, and what
// kind of move was it?" — with consent checked per event and record identifiers
// stripped unless the sink declares a retention window. Default: collects
// nothing, and does not nag about it.
export {
  SV_NAV_TELEMETRY,
  provideSvNavTelemetry,
  svNoopNavTelemetry,
  svNavRecorder,
  svNavRecorderFrom,
} from './lib/nav/nav-telemetry';
export type {
  SvNavTelemetry,
  SvNavRecorder,
  SvNavEvent,
  SvNavEventDraft,
  SvNavSurface,
  SvNavIntent,
  SvNavRetention,
} from './lib/nav/nav-telemetry';

// ── Forms ───────────────────────────────────────────────────────────────────
// One `aria-describedby` composer, with one order. The shape it replaces —
// `showError() ? errorId : null` — describes the field with the error INSTEAD
// of the hint, which is not what a list-valued attribute is for.
export { svDescribedBy } from './lib/forms/described-by';
export type { SvDescribedByParts } from './lib/forms/described-by';
// The browser filled the field and told nobody. `animationstart` on an empty
// keyframe is the only notification Chrome's page-load autofill gives.
export { SvAutofillDirective, SV_AUTOFILL_START, SV_AUTOFILL_END } from './lib/forms/autofill.directive';
export { createFieldError } from './lib/forms/field-error';
export type { SvFieldError, SvServerError } from './lib/forms/field-error';
export { SvFieldErrorComponent } from './lib/forms/field-error.component';

// ─── Mentions ─────────────────────────────────────────────────────────────────
// The trigger scan and the atomic token, shared by `sv-mention` (a single-line
// contenteditable) and `sv-rich-text-editor`. Extracted rather than copied: the
// second copy of a rule like "an email address must not open a people-search"
// always drifts from the first.
export {
  SV_MENTION_ATTRS,
  svMentionHtml,
  svMentionLabel,
  svMentionPlainText,
  svMentionRepairs,
  svParseMentions,
  svScanTrigger,
  svTokenIntegrity,
} from './lib/forms/mention-scan';
export type {
  SvMentionRepair,
  SvMentionToken,
  SvTokenIntegrity,
  SvTriggerMatch,
  SvTriggerOptions,
} from './lib/forms/mention-scan';

/** `X-2` — one privacy and redaction contract for the AI pack. */
export {
  SV_AI_COMMON_PATTERNS,
  SV_AI_PRIVACY,
  SV_AI_PRIVACY_DEFAULT,
  provideSvAiPrivacy,
  svAiMask,
  svAiPrivacy,
} from './lib/ai/privacy';
export type { SvAiMaskPattern, SvAiMasked, SvAiPrivacyPolicy } from './lib/ai/privacy';

/** `X-4` — one scale contract for every list-shaped surface. */
export { svScaleWindow, svScaleLabel } from './lib/data/scale-ceiling';
export type { SvScaleWindow, SvScaleKeep } from './lib/data/scale-ceiling';
export { SvScaleNoticeComponent } from './lib/data/shells/scale-notice.component';

/** The kit's one spinning-arc indicator — see the component for why it lives here. */
export { SvSpinnerArcComponent } from './lib/feedback/spinner-arc.component';
export { createWaitEscalation, svFormatExpectedWait } from './lib/feedback/wait-escalation';
export type {
  SvWaitEscalation,
  SvWaitEscalationOptions,
  SvWaitStage,
} from './lib/feedback/wait-escalation';

// ── Development aids ────────────────────────────────────────────────────────
// Dev-mode-only diagnostics. No-ops in a production bundle.
export { svWarnSimulating } from './lib/dev/simulate-warning';
