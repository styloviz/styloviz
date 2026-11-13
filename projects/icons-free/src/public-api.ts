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

// The icon machinery is its own entry point (R11): components import it from
// '@styloviz/icons/core', so a chunk that draws icons does not reach every glyph class.
export * from '@styloviz/icons/core';

// ── Registry + all icon components (generated) ────────────────────────────────

export * from './generated';
