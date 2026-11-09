/**
 * The text and accessible names `sv-search-bar` renders, in English. Override any of
 * them with `provideSvLabels({ searchBar: { … } })` from `@styloviz/core`.
 */
export interface SvSearchBarLabels {
  readonly clearSearch: string;
  readonly searchSuggestions: string;
  readonly removeFilter: string;
  /** The input's placeholder (`placeholder` defaults to it). */
  readonly searchPlaceholder: string;
  /** The opening state — nothing searched for yet (`noDataLabel` defaults to it). */
  readonly typeToSearch: string;
  /** A search that answered with nothing (`noResultsLabel` defaults to it). */
  readonly noResults: string;
  /** Under the no-results message — `{term}` is the query that matched nothing. */
  readonly nothingMatched: string;
  /** Announced when the suggestion list settles. `{count}` picks the plural, `{n}` is the formatted count. */
  readonly suggestionCount: string;
}

export const SV_SEARCH_BAR_LABELS: SvSearchBarLabels = {
  clearSearch: 'Clear search',
  searchSuggestions: 'Search suggestions',
  removeFilter: 'Remove filter {name}',
  searchPlaceholder: 'Search…',
  typeToSearch: 'Type to search',
  noResults: 'No results found',
  nothingMatched: 'Nothing matched “{term}”',
  suggestionCount: '{count, plural, one {{n} suggestion} other {{n} suggestions}}',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    searchBar: SvSearchBarLabels;
  }
}
