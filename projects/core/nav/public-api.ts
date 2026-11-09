/*
 * @styloviz/core/nav — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
export {
  SV_LINK_ADAPTER,
  provideSvLinkAdapter,
  svHrefLinkAdapter,
  svIsModifiedClick,
} from './link-adapter';
export type { SvLinkAdapter, SvLinkTarget } from './link-adapter';
export { svCloseOnNavigation } from './close-on-navigation';
export { svFragmentHref } from './fragment-href';
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
} from './nav-location';
export type {
  SvNavLocation,
  SvNavWriteMode,
  SvNavKey,
  SvNavParam,
  SvNavParamOptions,
} from './nav-location';
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
} from './nav-telemetry';
export type {
  SvNavTelemetry,
  SvNavRecorder,
  SvNavEvent,
  SvNavEventDraft,
  SvNavSurface,
  SvNavIntent,
  SvNavRetention,
} from './nav-telemetry';
