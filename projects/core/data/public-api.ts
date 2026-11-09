/*
 * @styloviz/core/data — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
// ── Export primitives ───────────────────────────────────────────────────────
// Free tier: CSV plus the browser-download step, and a dependency-free ZIP
// writer. Styled Excel and PDF build on these in `@styloviz-pro/export`.
export {
  svDiffLines,
  svDiffSummary,
  svDiffValues,
  svValueDiffSummary,
} from './diff';
export type {
  SvChangeKind,
  SvDiffHunk,
  SvDiffLine,
  SvDiffLabels,
  SvDiffLineKind,
  SvDiffOptions,
  SvDiffResult,
  SvValueChange,
  SvValueDiffLabels,
  SvValueDiffOptions,
} from './diff';
export { svSplitPastedList, svApplyPastedList, svPasteListSummary } from './paste-list';
export type { SvUnresolvedValue, SvUnresolvedReason } from './unresolved-value';
export {
  svCheckableDescendants,
  svToggleTriState,
  svRollUpTriState,
  svIndeterminateKeys,
  svCascadeToNewChildren,
} from './tri-state';
export type { SvTriStateAdapter } from './tri-state';
export { svKeyedRequestGuard, SV_SUPERSEDED } from './keyed-request-guard';
export type { SvKeyedRequestGuard } from './keyed-request-guard';
export type { SvPasteListResult, SvPasteRejection, SvApplyPastedOptions, SvPasteListLabels } from './paste-list';
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
} from './types';
export {
  SV_DEFAULT_QUERY,
  createQuery,
  patchQuery,
  queriesEqual,
  toggleSort,
} from './query';
export { toSvDataError, isSvDataError, isRetryable } from './errors';
export { createRequestGuard } from './request-guard';
export { createAsyncAction } from './async-action';
// The picker-shaped controller built on that guard: term in, options out, with
// the debounce, the abort, the stale/loading split and the empty-vs-not-asked
// distinction handled once. Lived in `@styloviz/data` until `FI-23-M3` needed a
// component to own its own fetch — see that package's re-export for why.
export { svSuggestController } from './suggest-controller';
export type {
  SvSuggestController,
  SvSuggestControllerOptions,
  SvSuggestSource,
} from './suggest-controller';
export type { SvRequest, SvRequestGuard } from './request-guard';
// `FI-23-M1` — the adapter layer of the select split: search, paging and async
// state for one select as one object, built on the controller above. Here and
// not in `@styloviz/data` for the same reason the controller is: the select
// consumes it, and a component may not depend on `@styloviz/data`.
export { svSelectSource } from './select-source';
export type {
  SvSelectSource,
  SvSelectSourceOptions,
  SvSelectSourcePage,
  SvSelectSourcePageRequest,
  SvSelectSourceSearch,
} from './select-source';
export type {
  SvAsyncAction,
  SvAsyncActionOptions,
  SvAsyncActionOutcome,
  SvAsyncActionStatus,
  SvPendingDismissal,
} from './async-action';
// The one treatment for "answered, but a newer request is in flight". Six
// picker families needed it; without a shared directive they would have had six
// different answers, three of which are "say nothing".
export { SvStaleDirective } from './stale.directive';
export { createDebouncer } from './debounce';
export type { SvDebouncer, SvDebouncerOptions } from './debounce';
export { resolveItemKey, trackByItemKey, warnOnDuplicateItemKeys } from './item-key';
export { svCutHierarchyCycles } from './hierarchy';
export type {
  SvAcyclicHierarchy,
  SvHierarchyAccessors,
  SvHierarchyCycle,
  SvHierarchyNode,
} from './hierarchy';
export { svAppendSample, svPauseNotice } from './live-feed';
export { svMergeRecords, svOrderRecords } from './record-merge';
export type {
  SvMergeableRecord,
  SvMergeReport,
  SvMergeOptions,
} from './record-merge';
export type {
  SvAppendResult,
  SvAppendSampleOptions,
  SvLateSamplePolicy,
} from './live-feed';
export { createVisibilityPause } from './visibility-pause';
export type { SvLivePause } from './visibility-pause';
export { createLiveTicker } from './live-ticker';
export type { SvLiveTicker, SvLiveTickerOptions } from './live-ticker';
export { createOffscreenPause } from './offscreen-pause';
export type { SvOffscreenPause } from './offscreen-pause';
export {
  SV_OTHER_SHARE_COLOR,
  svGroupSmallShares,
  svOrderShares,
  svPrepareShares,
  svShareSummaryRows,
} from './small-shares';
export type {
  SvGroupSharesOptions,
  SvSmallSharesLabels,
  SvShareRowLabels,
  SvPrepareSharesOptions,
  SvPreparedShares,
  SvShareGrouping,
  SvShareOrder,
  SvShareSlice,
} from './small-shares';
export { svFiniteExtent, svGapNotice, svGapRuns, svIsGap } from './series-gaps';
export { svDecimateIndices } from './series-decimate';
export { SV_SERIES_DIMMED_OPACITY, createSeriesEmphasis } from './series-emphasis';
export type { SvSeriesEmphasis, SvSeriesEmphasisOptions } from './series-emphasis';
export { SV_CHART_DISCLOSURE_LABELS } from './chart-disclosures';
export type { SvChartDisclosureLabels } from './chart-disclosures';
export type { SvFiniteExtent } from './series-gaps';
export { svApplyValuePolicy, svIsPlottableShare, svResolveShares } from './value-policy';
export type {
  SvSharePoint,
  SvShareResult,
  SvShareWording,
  SvValuePolicy,
  SvValuePolicyOptions,
  SvValuePolicyLabels,
  SvValuePolicyResult,
} from './value-policy';
export { svBinDensityStep, svHexBin, svHexPath } from './point-bins';
export type { SvHexBinOptions, SvPointBin } from './point-bins';
export { svNiceScale, svTickLabel } from './nice-scale';
export type { SvNiceScale } from './nice-scale';
// Technical indicators for price charts (FL-D4) — pure, `null` through each warm-up.
export { svSma, svEma, svBollinger, svRsi, svMacd } from './indicators';
export type { SvIndicatorSeries, SvBollingerBands, SvMacd } from './indicators';
export { createStreamOverlay } from './stream-overlay';
export type { SvStreamOverlay } from './stream-overlay';
export { createOptimisticEdit, svRequestKey } from './optimistic';
export type { SvOptimisticEdit, SvOptimisticEditOptions } from './optimistic';
// Persisted state is its own entry point (`@styloviz/core/persist`), re-exported here so
// every existing import keeps working.
export * from '@styloviz/core/persist';
// Async-state shells — the shared loading / error / empty treatment.
export { SvSkeletonShellComponent } from './shells/skeleton-shell.component';
export type { SvSkeletonShellVariant } from './shells/skeleton-shell.component';
export { SvErrorShellComponent } from './shells/error-shell.component';
export { SvEmptyShellComponent } from './shells/empty-shell.component';
export { SvChartFrameComponent } from './shells/chart-frame.component';
export { SvChartSyncDirective, SvChartSyncHub, injectSvChartSync } from './chart-sync';
export type { SvChartSyncFollower, SvChartSyncHandle, SvChartSyncHover, SvChartSyncZoom } from './chart-sync';
export { SvConnectionStatusComponent } from './shells/connection-status.component';
// The declaration a chart makes when it has no fetch to report on.
export type { SvLocalStateChart } from './local-state-chart';
/** `X-4` — one scale contract for every list-shaped surface. */
export { svScaleWindow, svScaleLabel } from './scale-ceiling';
export type { SvScaleWording } from './scale-ceiling';
export type { SvScaleWindow, SvScaleKeep } from './scale-ceiling';
export { SvScaleNoticeComponent } from './shells/scale-notice.component';
