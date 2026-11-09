/**
 * The text `sv-button` renders, in English. Override any of them with
 * `provideSvLabels({ button: { … } })` from `@styloviz/core`.
 */
export interface SvButtonLabels {
  /** What a loading button says to a screen reader when `loadingLabel` is empty. */
  readonly loading: string;
}

export const SV_BUTTON_LABELS: SvButtonLabels = {
  loading: 'Loading',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    button: SvButtonLabels;
  }
}
