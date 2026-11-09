export { SvProductTourComponent } from './lib/product-tour.component';
export type {
  TourPlacement,
  TourStep,
  TourRouteRequest,
} from './lib/product-tour.types';

export {
  SV_TOUR_PROGRESS_KIND,
  SV_TOUR_PROGRESS_VERSION,
  svSerializeTourProgress,
  svRestoreTourProgress,
} from './lib/product-tour.progress';
export type {
  SvTourProgress,
  SvTourStatus,
  SvTourResumeReason,
  SvTourProgressRestored,
  SvTourSchemaStale,
} from './lib/product-tour.progress';
export { SV_PRODUCT_TOUR_LABELS } from './lib/product-tour-free.labels';
export type { SvProductTourLabels } from './lib/product-tour-free.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/product-tour-free.labels.packs';
