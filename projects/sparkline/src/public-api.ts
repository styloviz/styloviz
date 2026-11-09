export { SvSparklineComponent } from './lib/sparkline.component';
export type {
  SparklineVariant,
  SparklineTone,
  SparklineDatum,
  SparklinePoint,
  SparklineBar,
  SparklineStats,
} from './lib/sparkline.types';
export type { SparklinePad } from './lib/sparkline-geometry';
export {
  applyMissing,
  areaPathOf,
  barsOf,
  domainOf,
  gapCount,
  linePathOf,
  pointsOf,
  statsOf,
  svSharedDomain,
  toSlots,
  toValues,
} from './lib/sparkline-geometry';
export type { SparklineMissing } from './lib/sparkline-geometry';
export { SV_SPARKLINE_LABELS } from './lib/sparkline.labels';
export type { SvSparklineLabels } from './lib/sparkline.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/sparkline.labels.packs';
