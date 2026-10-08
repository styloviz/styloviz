/**
 * @styloviz/anchor — Public API
 */
export { SvAnchorComponent } from './lib/anchor.component';
export type { AnchorItem, AnchorOrientation } from './lib/anchor.component';

export { createScrollSpy } from './lib/scroll-spy';
export type { ScrollSpy, ScrollSpyOptions, ScrollSpySection } from './lib/scroll-spy';

export {
  svActivationThresholds,
  svPickActiveSection,
  svSectionSnapshot,
} from './lib/activation-strategy';
export type {
  AnchorActivation,
  SvSectionSnapshot,
  SvVerticalRect,
} from './lib/activation-strategy';
