/**
 * @styloviz/ai — Public API
 *
 * The free building blocks of an AI chat surface: the starter prompts and the
 * per-message action row. They compose into `sv-ai-chat`
 * (`@styloviz-pro/ai-chat`) and work on their own in any chat you build.
 */

// ── Accessible names ─────────────────────────────────────────────────────────
export { SV_AI_LABELS } from '@styloviz/ai/labels';
export type { SvAiLabels } from '@styloviz/ai/labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from '@styloviz/ai/labels';

// ── Suggestions ──────────────────────────────────────────────────────────────
export { SvSuggestionsComponent } from '@styloviz/ai/suggestions';
export type { SvSuggestion, SvSuggestionsLayout } from '@styloviz/ai/suggestions';

// ── Message actions ──────────────────────────────────────────────────────────
export { SvMessageActionsComponent } from '@styloviz/ai/message-actions';
export type {
  SvMessageAction,
  SvMessageCopyState,
  SvMessageFeedback,
} from '@styloviz/ai/message-actions';
