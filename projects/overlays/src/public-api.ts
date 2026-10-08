/**
 * @styloviz/overlays — Public API
 *
 * The overlay and feedback family: everything that appears *over* the page or
 * reports the state of something happening on it. Grouped as one package
 * because that is how the docs group them, so the install line is derivable
 * from where the component was found.
 */

// ── Anchored panels ──────────────────────────────────────────────────────────
export { SvTooltipComponent } from './tooltip/tooltip.component';
export type {
  TooltipPosition,
  TooltipVariant,
  TooltipSize,
  TooltipTrigger,
} from './tooltip/tooltip.component';
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
