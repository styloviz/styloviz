export { SvPaginationComponent } from './lib/pagination.component';
export { SV_PAGINATION_LABELS } from './lib/pagination.labels';
export type { SvPaginationLabels } from './lib/pagination.labels';
export type {
  PaginationSize,
  PaginationVariant,
  SvPaginationMode,
  SvPageRequest,
  SvPageRequestDirection,
  SvPageSizePolicy,
} from './lib/pagination.component';

/**
 * The cursor trail — `NV-04-M1`. Exported as a primitive rather than kept
 * private because `OF-10-M3` needs the same thing in the Notification Center,
 * and two cursor histories would be two answers to "what does Back mean".
 */
export { createSvCursorPager } from './lib/cursor-pager';
export type { SvCursorPager, SvCursorTrail } from './lib/cursor-pager';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/pagination.labels.packs';
