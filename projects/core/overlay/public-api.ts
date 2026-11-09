/*
 * @styloviz/core/overlay — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
export { createCloseGuard, svDismissReason } from './close-guard';
export { createSheetMode, SV_SHEET_SAFE_AREA_PADDING } from './sheet-mode';
export type { SvSheetMode, SvSheetModeOptions } from './sheet-mode';
export { SvOverlayRouteService } from './overlay-route';
export type { SvRouteAwareHandle, SvRouteAwareOptions } from './overlay-route';
export type {
  SvCloseGuard,
  SvCloseGuardOptions,
  SvCloseReason,
  SvCloseVerdict,
  SvDismissReason,
} from './close-guard';
// ── Overlay ─────────────────────────────────────────────────────────────────
// Shared behaviour for portalled panels pinned to a trigger.
export { createAnchorScrollGuard } from './anchor-scroll-guard';
export type { SvAnchorScrollGuard, SvAnchorScrollGuardOptions } from './anchor-scroll-guard';
export {
  svLockBodyScroll,
  svUnlockBodyScroll,
  svBodyScrollLockDepth,
  svResetBodyScrollLock,
} from './body-scroll-lock';
export { createFocusScope } from './focus-scope';
export {
  svRecoverFocus,
  svRestoreFocusedItem,
  svSnapshotFocusedItem,
  svSuccessorIndex,
} from './focus-recovery';
export type { SvFocusRecoveryOptions, SvFocusedItemSnapshot } from './focus-recovery';
export type { SvFocusScope, SvFocusScopeOptions, SvFocusRestoreOutcome } from './focus-scope';
export { SV_FOCUSABLE_SELECTOR, svIsFocusable, svFocusableWithin, svFirstFocusableWithin } from './focusable';
export { svPositionAnchored, svInlineAnchor, svAnchorLost, svInSafeCorridor, svSafeCorridorTriangle } from './anchored-position';
export type { SvSafeCorridorOptions } from './anchored-position';
export { svFixedOrigin, svFixedContainer } from './fixed-origin';
export type { SvFixedOrigin } from './fixed-origin';
export type {
  SvRect,
  SvPlacement,
  SvPlacementSide,
  SvPlacementAlign,
  SvPositionRequest,
  SvPositionResult,
  SvInlineAnchor,
  SvInlineAnchorRequest,
} from './anchored-position';
export { createPortalHost } from './portal-host';
export { SV_TOOLTIP_GROUP, createSvTooltipGroup, provideSvTooltipGroup } from './tooltip-group';
export type { SvTooltipGroup, SvTooltipGroupOptions } from './tooltip-group';
export type { SvPortalHost, SvPortalHostOptions } from './portal-host';
export { SvOverlayStackService, SV_OVERLAY_Z_FLOOR } from './overlay-stack';
export type { SvOverlayLayer, SvOverlayHandle, SvOverlayPushOptions } from './overlay-stack';
export { svStackedPopup } from './stacked-popup';
export type { SvStackedPopup, SvStackedPopupOptions } from './stacked-popup';
