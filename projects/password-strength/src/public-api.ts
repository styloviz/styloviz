/**
 * @styloviz/password-strength — Public API
 */
export { evaluatePassword, PASSWORD_STRENGTH_LABELS, svPasswordStrengthBandLabels } from './lib/password-strength';
export type {
  PasswordBreachStatus,
  PasswordGuidance,
  PasswordGuidanceOptions,
  PasswordStrengthBand,
} from './lib/password-strength';
export { SvPasswordStrengthComponent } from './lib/password-strength.component';
export type { PasswordStrengthSize } from './lib/password-strength.component';
export { SV_PASSWORD_STRENGTH_LABELS } from './lib/password-strength.labels';
export type { SvPasswordStrengthLabels } from './lib/password-strength.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/password-strength.labels.packs';
