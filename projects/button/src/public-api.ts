/**
 * @styloviz/button — Public API
 */
export { SvButtonComponent } from './lib/button.component';
export type {
  ButtonVariant,
  ButtonStyle,
  ButtonSize,
  ButtonShape,
  ButtonIconPos,
  ButtonLoader,
  ButtonType,
  ButtonIconTemplate,
} from './lib/button.component';

export { BUTTON_MATRIX, BUTTON_DESIGNED, BUTTON_COLOUR_VARIANTS } from './lib/button.matrix';
export type { ButtonCombo, ButtonComboStatus } from './lib/button.matrix';

export { SV_BUTTON_LABELS } from './lib/button.labels';
export type { SvButtonLabels } from './lib/button.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/button.labels.packs';
