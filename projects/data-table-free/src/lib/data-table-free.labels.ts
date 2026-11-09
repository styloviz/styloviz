/**
 * The accessible names and visible text `sv-data-table` renders (its `responsive="records"` view included), in English. Override any of
 * them with `provideSvLabels({ dataTable: { … } })` from `@styloviz/core`.
 */
export interface SvDataTableLabels {
  readonly searchTable: string;
  readonly rowDensity: string;
  readonly toggleColumns: string;
  readonly clearSelection: string;
  readonly loading: string;
  readonly selectAllRowsOnPage: string;
  readonly toggleRowDetails: string;
  readonly selectRow: string;
  readonly editCellValue: string;
  readonly rowActions: string;
  readonly tablePagination: string;
  readonly firstPage: string;
  readonly previousPage: string;
  readonly nextPage: string;
  readonly lastPage: string;
  readonly removeFilter: string;
  readonly filterColumn: string;
  readonly goToPage: string;
  readonly sortAscendingReverse: string;
  readonly sortDescendingReverse: string;
  readonly selectCard: string;
  readonly cardAction: string;
  readonly showMoreFields: string;
  readonly hideMoreFields: string;
  /** `responsive="records"` — the disclosure's visible text while closed; `{count}` secondary fields. */
  readonly recordMoreFields: string;
  /** `responsive="records"` — the disclosure's visible text while open. */
  readonly recordFewerFields: string;
  /** `sv-data-table` — visible text. */
  readonly searchPlaceholder: string;
  readonly columns: string;
  readonly export: string;
  readonly activeFilters: string;
  /** Clears every active filter chip. */
  readonly clearAllFilters: string;
  /** Bulk-actions bar (a no-break space keeps the count with its noun). */
  readonly rowsSelected: string;
  /** Visible word on the clear-selection button (its name is `clearSelection`). */
  readonly clear: string;
  /** Tooltip on a sortable header. */
  readonly sortBy: string;
  /** Visually-hidden header of the row-actions column. */
  readonly actionsColumn: string;
  /** A select filter's no-filter option. */
  readonly filterAll: string;
  readonly filterPlaceholder: string;
  /** The `emptyMessage` input's default. */
  readonly emptyMessage: string;
  /** Empty state with active filters. */
  readonly clearFilters: string;
  /** Footer summary, split around the bold numbers: "Showing 1–10 of 234". */
  readonly summaryShowing: string;
  /** Second half of the summary split (see `summaryShowing`). */
  readonly summaryOf: string;
  /** Page-size label. */
  readonly rowsPerPage: string;
  /** `responsive="records"` — the sort select's label. */
  readonly gridSortBy: string;
  /** `responsive="records"` — the sort select's no-sort option. */
  readonly gridUnsorted: string;
  /** `responsive="records"` — the empty message's default. */
  readonly gridEmptyMessage: string;
  /** Announced when the focused row leaves the page and focus moves on. */
  readonly focusedRowHidden: string;
  /** The density toggle's options. */
  readonly densityCompact: string;
  readonly densityComfortable: string;
  readonly densitySpacious: string;
  /** The active-filter chip for the search box. */
  readonly searchChip: string;
  /** `responsive="records"`' sort-direction button. */
  readonly sortAscending: string;
  readonly sortDescending: string;
}

export const SV_DATA_TABLE_LABELS: SvDataTableLabels = {
  searchTable: 'Search table',
  rowDensity: 'Row density',
  toggleColumns: 'Toggle columns',
  clearSelection: 'Clear selection',
  loading: 'Loading',
  selectAllRowsOnPage: 'Select all rows on this page',
  toggleRowDetails: 'Toggle row details',
  selectRow: 'Select row',
  editCellValue: 'Edit cell value',
  rowActions: 'Row actions',
  tablePagination: 'Table pagination',
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
  removeFilter: 'Remove {name} filter',
  filterColumn: 'Filter {name}',
  goToPage: 'Page {page}',
  sortAscendingReverse: 'Sort direction: Ascending. Activate to reverse.',
  sortDescendingReverse: 'Sort direction: Descending. Activate to reverse.',
  selectCard: 'Select {title}',
  cardAction: '{action} {title}',
  showMoreFields: '{count, plural, one {Show # more field for {title}} other {Show # more fields for {title}}}',
  hideMoreFields: '{count, plural, one {Hide # more field for {title}} other {Hide # more fields for {title}}}',
  recordMoreFields: '{count, plural, one {# more field} other {# more fields}}',
  recordFewerFields: 'Fewer fields',
  searchPlaceholder: 'Search…',
  columns: 'Columns',
  export: 'Export',
  activeFilters: 'Active filters:',
  clearAllFilters: 'Clear all',
  rowsSelected: '{count, plural, one {#\u00a0row selected} other {#\u00a0rows selected}}',
  clear: 'Clear',
  sortBy: 'Sort by {name}',
  actionsColumn: 'Actions',
  filterAll: 'All',
  filterPlaceholder: 'Filter…',
  emptyMessage: 'No data to display.',
  clearFilters: 'Clear filters',
  summaryShowing: 'Showing',
  summaryOf: 'of',
  rowsPerPage: 'Rows',
  gridSortBy: 'Sort by',
  gridUnsorted: 'Unsorted',
  gridEmptyMessage: 'No records to show',
  focusedRowHidden: 'The focused row is no longer shown. Focus moved to the next row.',
  densityCompact: 'Compact',
  densityComfortable: 'Comfortable',
  densitySpacious: 'Spacious',
  searchChip: 'Search',
  sortAscending: 'Ascending',
  sortDescending: 'Descending',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    dataTable: SvDataTableLabels;
  }
}
