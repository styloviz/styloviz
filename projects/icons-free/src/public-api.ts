/**
 * @styloviz/icons — Public API
 *
 * Two ways to use icons:
 *   • By name — `<sv-icon name="arrow-right" />`, after registering the glyph:
 *     `provideSvIcons([arrowRightIcon])` (or every glyph: `provideSvIcons(svAllIcons)`)
 *   • Per-icon components — `<sv-arrow-right-icon />` (`SvArrowRightIcon`)
 *   Either way only the glyphs you import ship (FL-B4).
 */

// ── Core types & helpers ──────────────────────────────────────────────────────
export * from './lib/icon.types';
export { SvIconBase } from './lib/icon-base.directive';
export { SvIconSvgComponent } from './lib/icon-svg.component';
export { SvIconComponent } from './lib/sv-icon.component';
export { provideSvIcons, registerSvIcons, SvIconRegistry, type IconRegistry, type SvIconDef } from './lib/provide-icons';
export { svWarnUnregisteredIcon } from './lib/sv-icon.component';

// ── Registry + all icon components (generated) ────────────────────────────────

export * from './generated';
