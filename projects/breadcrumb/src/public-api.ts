export {
  SvBreadcrumbComponent,
  BreadcrumbItem,
  BreadcrumbMenuItem,
  BreadcrumbSeparator,
  BreadcrumbSkeletonCrumb,
  BreadcrumbVariant,
  BreadcrumbSize,
} from './lib/breadcrumb.component';
export { svTrailFromPath } from './lib/breadcrumb.trail';
export type { SvTrailOptions } from './lib/breadcrumb.trail';
export { SV_BREADCRUMB_LABELS } from './lib/breadcrumb.labels';
export type { SvBreadcrumbLabels } from './lib/breadcrumb.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/breadcrumb.labels.packs';
