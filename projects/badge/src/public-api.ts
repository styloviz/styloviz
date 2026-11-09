/**
 * @styloviz/badge — Public API
 */
export { SvBadgeComponent, SV_BADGE_TONE_WORDS } from './lib/badge.component';
export type {
  BadgeVariant,
  BadgeSize,
  BadgeStyle,
  BadgeShape,
} from './lib/badge.component';
export { SV_BADGE_LABELS } from './lib/badge.labels';
export type { SvBadgeLabels } from './lib/badge.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/badge.labels.packs';
