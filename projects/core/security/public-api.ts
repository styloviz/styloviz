/*
 * @styloviz/core/security — a secondary entry point of @styloviz/core (FL-L2-01).
 * Import from here, or from '@styloviz/core', which re-exports every entry point.
 */
// ── Security ────────────────────────────────────────────────────────────────
// The kit's ONE HTML sanitiser. Anything that renders markup it did not author
// uses these; a second allowlist somewhere else is the failure this prevents.
export {
  svCleanPastedHtml,
  svCleanStyle,
  svEscapeHtml,
  svIsSafeUrl,
  svPasteSummary,
  svPlainTextFromHtml,
  svPlainTextToHtml,
  svSanitizeEditorHtml,
} from './html-sanitizer';
export type { SvEditorHtmlOptions, SvPasteOptions, SvPasteResult, SvPasteSummaryLabels } from './html-sanitizer';
// Compiling a regular expression someone else wrote — see `pattern.ts` for the
// measured cost of not doing this (30 s of frozen main thread, one keystroke).
export { svCompilePattern, svIsCatastrophicPattern } from './pattern';
// Marking the query inside a result label WITHOUT building an HTML string —
// the obvious `replace(re, '<mark>$1</mark>')` + `[innerHTML]` is an injection.
export { svHighlightSegments, svHighlightPositions } from './highlight';
// Building a selector from a value somebody else chose. `CSS.escape` is the
// wrong tool (it escapes identifiers, not quoted attribute values) AND it is a
// `window` property that `?.` cannot guard — see `selector.ts`.
export { svAttrSelector, svEscapeAttrValue } from './selector';
// One sensitive-value policy (masking, copy auditing, host-attribute stripping,
// app-wide privacy declaration) — see `docs/sensitive-value-policy.md`.
export {
  svLast4,
  svMaskTail,
  svStripHostAttributes,
  SV_SENSITIVE_PRIVACY,
  provideSvSensitivePrivacy,
  injectSvSensitivePrivacy,
} from './sensitive-value';
export type { SvSensitiveCopyEvent } from './sensitive-value';
export type { SvHighlightSegment } from './highlight';
export type {
  SvPatternResult,
  SvPatternProblem,
  SvCompilePatternOptions,
} from './pattern';
