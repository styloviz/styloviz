/**
 * @styloviz/overlays — Public API
 *
 * The overlay and feedback family: everything that appears *over* the page or
 * reports the state of something happening on it. Grouped as one package
 * because that is how the docs group them, so the install line is derivable
 * from where the component was found.
 */

// ── Anchored panels ──────────────────────────────────────────────────────────
export { SvTooltipComponent, SvTooltipContentDirective } from '@styloviz/overlays/tooltip';
export { SvTooltipGroupDirective } from '@styloviz/overlays/tooltip';
export type {
  TooltipPosition,
  TooltipVariant,
  TooltipSize,
  TooltipTrigger,
  TooltipTouch,
  TooltipAnimation,
  TooltipStatus,
  TooltipPoint,
  TooltipContentContext,
} from '@styloviz/overlays/tooltip';
export { SV_OVERLAYS_LABELS } from '@styloviz/overlays/labels';
export type { SvOverlaysLabels } from '@styloviz/overlays/labels';

// ── Feedback ─────────────────────────────────────────────────────────────────
export { SvResultComponent } from '@styloviz/overlays/result';
export type { ResultStatus, ResultSize } from '@styloviz/overlays/result';
export { SvSpinnerComponent } from '@styloviz/overlays/spinner';
export type { SpinnerSize, SpinnerVariant, SpinnerStyle } from '@styloviz/overlays/spinner';
export { SvProgressBarComponent } from '@styloviz/overlays/progress-bar';
export type {
  ProgressBarVariant,
  ProgressBarSize,
  ProgressBarLabelPos,
} from '@styloviz/overlays/progress-bar';
export { SvProgressRingComponent } from '@styloviz/overlays/progress-ring';
export type { ProgressRingSize, ProgressRingVariant } from '@styloviz/overlays/progress-ring';
export { SvOnboardingChecklistComponent } from '@styloviz/overlays/onboarding-checklist';
export { SvActionSheetComponent } from '@styloviz/overlays/action-sheet';
export type {
  SvActionSheetAction,
  SvActionSheetCloseReason,
  SvActionSheetSelection,
} from '@styloviz/overlays/action-sheet';
export type {
  SvOnboardingStep,
  SvOnboardingStepToggle,
  SvOnboardingChecklistVariant,
  SvOnboardingChecklistHeadingLevel,
  SvOnboardingChecklistLabels,
} from '@styloviz/overlays/onboarding-checklist';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from '@styloviz/overlays/labels';

// Types a public input or output names, so a host can name them too (FL-G8, check:public-types).
export type { ResultRetryAction } from '@styloviz/overlays/result';
