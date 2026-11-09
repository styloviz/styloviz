export { SvJumpMenuComponent } from './lib/jump-menu.component';
export { SV_JUMP_MENU_LABELS } from './lib/jump-menu.labels';
export type { SvJumpMenuLabels } from './lib/jump-menu.labels';
export type {
  JumpMenuItem,
  JumpMenuSize,
  JumpMenuChangeEvent,
} from './lib/jump-menu.component';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/jump-menu.labels.packs';

// Types a public input or output names, so a host can name them too (FL-G8, check:public-types).
export type { JumpMenuJumpedEvent } from './lib/jump-menu.component';
