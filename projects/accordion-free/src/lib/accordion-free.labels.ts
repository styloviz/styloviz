/**
 * The screen-reader text `sv-accordion` builds, in English. Override any of
 * it with `provideSvLabels({ accordion: { … } })` from `@styloviz/core`.
 */
export interface SvAccordionLabels {
  /** Announced as the search query changes — `{query}` is the query; `{count}` drives the plural, `{n}` arrives as digits. */
  readonly searchNoMatches: string;
  readonly searchMatches: string;
  /** Announced when focus is recovered after a section collapses — `{title}` is the section's. */
  readonly sectionCollapsed: string;
}

export const SV_ACCORDION_LABELS: SvAccordionLabels = {
  searchNoMatches: 'No sections match {query}.',
  searchMatches: '{count, plural, one {{n} section matches {query}.} other {{n} sections match {query}.}}',
  sectionCollapsed: '{title} collapsed.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    accordion: SvAccordionLabels;
  }
}
