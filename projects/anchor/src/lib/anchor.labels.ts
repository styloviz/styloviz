/**
 * Every string `sv-anchor` renders, in English. Override any of them app-wide
 * with `provideSvLabels({ anchor: { … } })` from `@styloviz/core`, or per
 * instance with the `labels` input. `{label}` is replaced by the item's label.
 */
export interface SvAnchorLabels {
  /** The collapse toggle's accessible name. */
  readonly toggle: string;
  /** The `<nav>` landmark's default accessible name (the `ariaLabel` input's default). */
  readonly onThisPage: string;
}

export const SV_ANCHOR_LABELS: SvAnchorLabels = {
  toggle: 'Subsections of {label}',
  onThisPage: 'On this page',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    anchor: SvAnchorLabels;
  }
}
