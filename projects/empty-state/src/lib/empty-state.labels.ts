/**
 * Every string `sv-empty-state` renders itself, in English. Override any of
 * them app-wide with `provideSvLabels({ emptyState: { … } })` from
 * `@styloviz/core`, or per instance with `[labels]` (SR-34).
 */
export interface SvEmptyStateLabels {
  /** The title for a search with no results. `{query}` is the search. */
  readonly noResultsFor: string;
  readonly didYouMean: string;
  readonly clearQuery: string;
  readonly errorDetails: string;
  /** `{keys}` stands for the shortcut, drawn as keys; `{hint}` for `shortcutHint`. */
  readonly shortcut: string;
  /** For the "+N" chip after the avatars. `{count}`. */
  readonly moreAvatars: string;
  readonly stepDone: string;
  /** The built-in clear-filters button (`clearFiltersLabel` defaults to it). */
  readonly clearFilters: string;
  /** Default title when `offline` is set. */
  readonly offlineTitle: string;
  /** Default message when `offline` is set. */
  readonly offlineMessage: string;
  /** Default title for `reason="no-results"` with no `query`. */
  readonly noResultsTitle: string;
  /** Default title for `reason="error"`. */
  readonly errorTitle: string;
  /** Default message for `reason="error"`. */
  readonly errorMessage: string;
  /** Default title for `reason="no-access"`. */
  readonly noAccessTitle: string;
  /** Default message for `reason="no-access"`. */
  readonly noAccessMessage: string;
  /** Default title for `reason="no-data"`. */
  readonly noDataTitle: string;
}

export const SV_EMPTY_STATE_LABELS: SvEmptyStateLabels = {
  noResultsFor: 'No results for “{query}”',
  didYouMean: 'Did you mean',
  clearQuery: 'Clear search',
  errorDetails: 'Show details',
  shortcut: 'Press {keys} {hint}',
  moreAvatars: '{count} more',
  stepDone: 'Done',
  clearFilters: 'Clear filters',
  offlineTitle: 'You are offline',
  offlineMessage: 'This will load when your connection is back.',
  noResultsTitle: 'No matching results',
  errorTitle: 'Could not load this',
  errorMessage: 'Something went wrong while loading. Try again.',
  noAccessTitle: 'You do not have access',
  noAccessMessage: 'Ask an administrator if you think this is wrong.',
  noDataTitle: 'Nothing here yet',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    emptyState: SvEmptyStateLabels;
  }
}
