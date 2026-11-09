/*
 * @styloviz/core/feedback — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
export { SvBannerStackService } from './banner-stack';
export type {
  SvBannerSlot,
  SvBannerRegistration,
  SvBannerHandle,
} from './banner-stack';
/** The kit's one spinning-arc indicator — see the component for why it lives here. */
export { SvSpinnerArcComponent } from './spinner-arc.component';
export { createWaitEscalation, svFormatExpectedWait } from './wait-escalation';
/** Show a loader late and keep it long enough to read (FL-J3-OF-06). */
export { createDelayedVisibility } from './delayed-visibility';
export type { SvDelayedVisibilityOptions } from './delayed-visibility';
export type {
  SvExpectedWaitLabels,
  SvWaitEscalation,
  SvWaitEscalationOptions,
  SvWaitStage,
} from './wait-escalation';
