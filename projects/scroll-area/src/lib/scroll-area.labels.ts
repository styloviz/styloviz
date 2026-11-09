/**
 * The strings `sv-scroll-area` renders, in English. Override any of them with
 * `provideSvLabels({ scrollArea: { … } })` from `@styloviz/core`; a
 * per-instance input (`backToTopLabel`) still wins over both.
 */
export interface SvScrollAreaLabels {
  /** The back-to-top button's name and tooltip (the `backToTopLabel` input's default). */
  readonly backToTop: string;
  /** The read-out when the content fits and nothing scrolls. */
  readonly scrollNothing: string;
  /** The scroll read-out — `{progress}` and `{shown}` are whole percentages. */
  readonly scrollPosition: string;
}

export const SV_SCROLL_AREA_LABELS: SvScrollAreaLabels = {
  backToTop: 'Back to top',
  scrollNothing: 'Everything fits; nothing to scroll.',
  scrollPosition: 'Scrolled {progress}%; {shown}% of the content is visible.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    scrollArea: SvScrollAreaLabels;
  }
}
