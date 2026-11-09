/**
 * @styloviz/kbd — Public API
 */
export { SvKbdComponent } from './lib/kbd.component';
export type { KbdVariant, KbdSize } from './lib/kbd.component';
export { SV_KBD_KEYS, svKbdChord, svKbdKey, svKbdKeys, svKbdPlatform, svKbdSequence, svKbdSpoken, svKbdSpokenSequence } from './lib/kbd.keys';
export { SV_KBD_LABELS, injectSvKbdLabels } from './lib/kbd.labels';
export type { SvKbdLabels } from './lib/kbd.labels';
export type { SvKbdKey, SvKbdPlatform } from './lib/kbd.keys';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/kbd.labels.packs';
