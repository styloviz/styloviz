/**
 * @styloviz/overlays — Public API
 *
 * The overlay and feedback family: everything that appears *over* the page or
 * reports the state of something happening on it. Grouped as one package
 * because that is how the docs group them, so the install line is derivable
 * from where the component was found.
 */

// ── Anchored panels ──────────────────────────────────────────────────────────
export { SvTooltipComponent, SvTooltipContentDirective } from './tooltip/tooltip.component';
export { SvTooltipGroupDirective } from './tooltip/tooltip-group.directive';
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
} from './tooltip/tooltip.component';
export { SV_OVERLAYS_LABELS } from './overlays.labels';
export type { SvOverlaysLabels } from './overlays.labels';

// ── Feedback ─────────────────────────────────────────────────────────────────
export { SvResultComponent } from './result/result.component';
export type { ResultStatus, ResultSize } from './result/result.component';
export { SvSpinnerComponent } from './spinner/spinner.component';
export type { SpinnerSize, SpinnerVariant, SpinnerStyle } from './spinner/spinner.component';
export { SvProgressBarComponent } from './progress-bar/progress-bar.component';
export type {
  ProgressBarVariant,
  ProgressBarSize,
  ProgressBarLabelPos,
} from './progress-bar/progress-bar.component';
export { SvProgressRingComponent } from './progress-ring/progress-ring.component';
export type { ProgressRingSize, ProgressRingVariant } from './progress-ring/progress-ring.component';
export { SvOnboardingChecklistComponent } from './onboarding-checklist/onboarding-checklist.component';
export { SvActionSheetComponent } from './action-sheet/action-sheet.component';
export type {
  SvActionSheetAction,
  SvActionSheetCloseReason,
  SvActionSheetSelection,
} from './action-sheet/action-sheet.component';
export type {
  SvOnboardingStep,
  SvOnboardingStepToggle,
  SvOnboardingChecklistVariant,
  SvOnboardingChecklistHeadingLevel,
  SvOnboardingChecklistLabels,
} from './onboarding-checklist/onboarding-checklist.component';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './overlays.labels.packs';

// Types a public input or output names, so a host can name them too (FL-G8, check:public-types).
export type { ResultRetryAction } from './result/result.component';
