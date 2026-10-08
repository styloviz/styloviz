/**
 * @styloviz/icons — Public API
 *
 * Two ways to use icons:
 *   • Registry component — `<sv-icon name="arrow-right" />` (import `SvIconComponent`)
 *   • Per-icon components — `import { SvArrowRightIcon } from '@styloviz/icons'`
 *     (best tree-shaking; ships only the glyphs you use)
 */

// ── Core types & helpers ──────────────────────────────────────────────────────
export * from './lib/icon.types';
export { SvIconBase } from './lib/icon-base.directive';
export { SvIconSvgComponent } from './lib/icon-svg.component';
export { SvIconComponent } from './lib/sv-icon.component';
export { provideSvIcons, SV_ICON_REGISTRY, type IconRegistry } from './lib/provide-icons';

// ── Registry + all icon components (generated) ────────────────────────────────
export * from './generated';
