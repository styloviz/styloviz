/**
 * The accessible names and button text `sv-product-tour` renders, in English. Override any of
 * them with `provideSvLabels({ productTour: { … } })` from `@styloviz/core`.
 */
export interface SvProductTourLabels {
  /** The icon button's name and the visible Skip button's text (`skipLabel`'s default). */
  readonly skipTour: string;
  readonly goToStepNumber: string;
  /** `nextLabel`'s default. */
  readonly next: string;
  /** `prevLabel`'s default. */
  readonly back: string;
  /** `doneLabel`'s default. */
  readonly done: string;
  /** `svRestoreState` / `svRestoreParams` — a refused restore's `detail` (core's `SvRestoreLabels`). */
  readonly restoreUnreadable: string;
  readonly restoreUnsigned: string;
  /** `{found}`, `{expected}` — the blobs' kinds. */
  readonly restoreForeign: string;
  readonly restoreNoVersion: string;
  /** `{from}`, `{version}`. */
  readonly restoreTooNew: string;
  readonly restoreBadShape: string;
  /** `{from}`. */
  readonly restoreUnmigratable: string;
  readonly linkNoVersion: string;
  readonly linkBadVersion: string;
  /** `{from}`, `{version}`. */
  readonly linkTooNew: string;
}

export const SV_PRODUCT_TOUR_LABELS: SvProductTourLabels = {
  skipTour: 'Skip tour',
  goToStepNumber: 'Go to step {step}',
  next: 'Next',
  back: 'Back',
  done: 'Done',
  restoreUnreadable: 'The saved data is not readable.',
  restoreUnsigned: 'The saved data does not say what wrote it, so it cannot be trusted.',
  restoreForeign: 'That saved data belongs to {found}, not {expected}.',
  restoreNoVersion: 'The saved data has no usable version.',
  restoreTooNew: 'That view was saved by a newer version of this component (v{from}, this is v{version}), so it cannot be read here.',
  restoreBadShape: 'The saved data is not in the expected shape.',
  restoreUnmigratable: 'That view was saved in an older format (v{from}) that can no longer be read.',
  linkNoVersion: 'That link does not say which version of the filters it holds.',
  linkBadVersion: 'That link has no usable version.',
  linkTooNew: 'That link was made by a newer version of this page (v{from}, this is v{version}), so its filters cannot be applied.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    productTour: SvProductTourLabels;
  }
}
