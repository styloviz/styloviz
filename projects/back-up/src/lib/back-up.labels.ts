/**
 * The visible text `sv-back-up` renders, in English. Override any of them with
 * `provideSvLabels({ backUp: { … } })` from `@styloviz/core`.
 */
export interface SvBackUpLabels {
  /** The `mode="back"` control's text when no `upLabel` names the destination. */
  readonly back: string;
  /** The `mode="up"` control's text when no `upLabel` names the destination. */
  readonly up: string;
  /** `{name}` is the `upLabel`. */
  readonly backTo: string;
  /** `{name}` is the `upLabel`. */
  readonly upTo: string;
}

export const SV_BACK_UP_LABELS: SvBackUpLabels = {
  back: 'Back',
  up: 'Up',
  backTo: 'Back to {name}',
  upTo: 'Up to {name}',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    backUp: SvBackUpLabels;
  }
}
