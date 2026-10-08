export { SvPaginationComponent } from './lib/pagination.component';
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
