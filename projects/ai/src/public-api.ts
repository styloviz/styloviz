/**
 * @styloviz/ai — Public API
 *
 * The free building blocks of an AI chat surface: the starter prompts and the
 * per-message action row. They compose into `sv-ai-chat`
 * (`@styloviz-pro/ai-chat`) and work on their own in any chat you build.
 */

// ── Accessible names ─────────────────────────────────────────────────────────
export { SV_AI_LABELS } from './ai.labels';
export type { SvAiLabels } from './ai.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './ai.labels.packs';

// ── Suggestions ──────────────────────────────────────────────────────────────
export { SvSuggestionsComponent } from './suggestions/suggestions.component';
export type { SvSuggestion, SvSuggestionsLayout } from './suggestions/suggestions.component';

// ── Message actions ──────────────────────────────────────────────────────────
export { SvMessageActionsComponent } from './message-actions/message-actions.component';
export type {
  SvMessageAction,
  SvMessageCopyState,
  SvMessageFeedback,
} from './message-actions/message-actions.component';
