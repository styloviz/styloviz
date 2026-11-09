/**
 * @styloviz/anchor — Public API
 */
export { SvAnchorComponent, svFlattenAnchorItems } from './lib/anchor.component';
export { SV_ANCHOR_LABELS } from './lib/anchor.labels';
export type { SvAnchorLabels } from './lib/anchor.labels';
export type {
  AnchorAppearance,
  AnchorHashSync,
  AnchorItem,
  AnchorMarker,
  AnchorOrientation,
  SvAnchorRow,
} from './lib/anchor.component';

export { createScrollSpy } from './lib/scroll-spy';
export type { ScrollSpy, ScrollSpyOptions, ScrollSpySection } from './lib/scroll-spy';

export {
  svActivationThresholds,
  svPickActiveSection,
  svSectionSnapshot,
} from './lib/activation-strategy';
export type {
  AnchorActivation,
  SvPickContext,
  SvSectionSnapshot,
  SvVerticalRect,
} from './lib/activation-strategy';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/anchor.labels.packs';
