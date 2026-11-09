/**
 * The accessible names and visible text `sv-pagination` renders, in English. Override any of
 * them with `provideSvLabels({ pagination: { … } })` from `@styloviz/core`.
 */
export interface SvPaginationLabels {
  readonly firstPage: string;
  readonly previousPage: string;
  readonly nextPage: string;
  readonly lastPage: string;
  readonly goToPage: string;
  /** The navigation landmark's name — the `ariaLabel` input's default. */
  readonly pagination: string;
  /** Visible summary, split around the bold numbers: "Showing 1–10 of 234". */
  readonly summaryShowing: string;
  /** Second half of the summary split (see `summaryShowing`). */
  readonly summaryOf: string;
  readonly rowsPerPage: string;
  /** The "Go to page" box's label, and the button that submits it. */
  readonly jumpToPage: string;
  readonly jumpGo: string;
  /** The `load-more` variant's button. */
  readonly loadMore: string;
  /** The position, read on the page buttons and announced — `{page}` / `{total}` arrive as digits. */
  readonly positionPage: string;
  readonly positionPageOf: string;
  /** Announced after a page change: pending (`{page}`), settled (`{position}` is `positionPage*`), or failed (`{message}` is the error's). */
  readonly announceLoadingPage: string;
  readonly announcePosition: string;
  readonly announceLoadFailed: string;
}

export const SV_PAGINATION_LABELS: SvPaginationLabels = {
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
  goToPage: 'Page {page}',
  pagination: 'Pagination',
  summaryShowing: 'Showing',
  summaryOf: 'of',
  rowsPerPage: 'Rows per page',
  jumpToPage: 'Go to page',
  jumpGo: 'Go',
  loadMore: 'Load more',
  positionPage: 'Page {page}',
  positionPageOf: 'Page {page} of {total}',
  announceLoadingPage: 'Loading page {page}.',
  announcePosition: '{position}.',
  announceLoadFailed: 'Could not load page {page}. {message}',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    pagination: SvPaginationLabels;
  }
}
