/**
 * @styloviz/core — Public API
 *
 * All exports from this file are part of the public API surface. Each area is
 * also its own entry point — `@styloviz/core/data`, `@styloviz/core/i18n`, … —
 * and importing from one keeps the other areas out of that chunk (FL-L2-01).
 * Never import from a file path inside the package.
 */

// Every secondary entry point, re-exported, so `@styloviz/core` keeps working. A page or
// package that imports one of them directly lets the bundler keep the rest out of its chunk.
export * from '@styloviz/core/a11y';
export * from '@styloviz/core/ai';
export * from '@styloviz/core/data';
export * from '@styloviz/core/dev';
export * from '@styloviz/core/directives';
export * from '@styloviz/core/export';
export * from '@styloviz/core/feedback';
export * from '@styloviz/core/forms';
export * from '@styloviz/core/gestures';
export * from '@styloviz/core/i18n';
export * from '@styloviz/core/layout';
export * from '@styloviz/core/models';
export * from '@styloviz/core/nav';
export * from '@styloviz/core/overlay';
export * from '@styloviz/core/security';
export * from '@styloviz/core/services';
export * from '@styloviz/core/tokens';
export * from '@styloviz/core/virtual';
