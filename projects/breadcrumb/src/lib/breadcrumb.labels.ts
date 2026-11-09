/**
 * The accessible names `sv-breadcrumb` renders, in English. Override any of
 * them with `provideSvLabels({ breadcrumb: { … } })` from `@styloviz/core`.
 */
export interface SvBreadcrumbLabels {
  readonly morePages: string;
  readonly switchPageUnder: string;
  readonly pagesUnder: string;
  readonly hidePages: string;
  readonly showHiddenPages: string;
  readonly navigation: string;
  readonly loadingBreadcrumb: string;
}

export const SV_BREADCRUMB_LABELS: SvBreadcrumbLabels = {
  morePages: 'More pages',
  switchPageUnder: 'Switch page under {name}',
  pagesUnder: '{name} pages',
  hidePages: '{count, plural, one {Hide # page} other {Hide # pages}}',
  showHiddenPages: '{count, plural, one {Show # hidden page} other {Show # hidden pages}}',
  navigation: 'Breadcrumb',
  loadingBreadcrumb: 'Loading breadcrumb…',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    breadcrumb: SvBreadcrumbLabels;
  }
}
