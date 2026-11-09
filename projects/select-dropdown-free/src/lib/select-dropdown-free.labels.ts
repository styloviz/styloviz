/**
 * The accessible names and visible text `sv-select-dropdown` renders, in English. Override any
 * of them with `provideSvLabels({ selectDropdown: { … } })` from
 * `@styloviz/core`.
 */
export interface SvSelectDropdownLabels {
  readonly clearSelection: string;
  readonly clearSearch: string;
  readonly searchOptions: string;
  readonly removeChip: string;
  /** The `placeholder` input's default. */
  readonly placeholder: string;
  /** Beside the label when `optionalTag` is set. */
  readonly optional: string;
  /** The same, beside a floating label. */
  readonly optionalShort: string;
  /** Tooltip on the chip for a value that no longer resolves to an option. */
  readonly staleChipTitle: string;
  /** Tooltip on a single value that no longer resolves to an option. */
  readonly staleValueTitle: string;
  /** Overflow badge for chips that do not fit. */
  readonly moreCount: string;
  /** Multi-select count bar when `maxSelected` is set. */
  readonly selectedOfMax: string;
  /** While the next page of options loads. */
  readonly loadingMore: string;
  /** Fetches the next page of options. */
  readonly loadMore: string;
  /** Multi-select footer button. */
  readonly clearAllCount: string;
  /** The search box placeholder when `svSelectSearch` sets none. */
  readonly searchPlaceholder: string;
  /** Panel text when a search matches nothing and `svSelectSearch` sets none. */
  readonly noResults: string;
  /** Panel text while the first options load and `svSelectSearch` sets none. */
  readonly loading: string;
  /** The panel line while the query is shorter than `minChars`. `{count}` picks the plural, `{n}` is the number shown. */
  readonly minCharsHint: string;
}

export const SV_SELECT_DROPDOWN_LABELS: SvSelectDropdownLabels = {
  clearSelection: 'Clear selection',
  clearSearch: 'Clear search',
  searchOptions: 'Search options',
  removeChip: 'Remove {name}',
  placeholder: 'Select an option',
  optional: '(optional)',
  optionalShort: '(opt)',
  staleChipTitle: 'No longer in the list of options.',
  staleValueTitle: 'This value is no longer in the list of options.',
  moreCount: '+{count} more',
  selectedOfMax: '{selected} / {max} selected',
  loadingMore: 'Loading…',
  loadMore: 'Load more',
  clearAllCount: 'Clear all ({count})',
  searchPlaceholder: 'Search…',
  noResults: 'No results found',
  loading: 'Loading…',
  minCharsHint: 'Type {count, plural, one {{n} character} other {{n} characters}} to search',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    selectDropdown: SvSelectDropdownLabels;
  }
}
