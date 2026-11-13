// The module this file augments. It has to be in this entry point's program:
// no other file of the entry imports it.
import type {} from '@styloviz/core/i18n';

/**
 * The visible text and accessible names `@styloviz/ai` renders, in English.
 * Override any of them with `provideSvLabels({ ai: { … } })` from
 * `@styloviz/core`, or per instance through each component's `labels` input.
 */
export interface SvAiLabels {
  /** `sv-suggestions` — the list's accessible name. */
  readonly suggestions: string;
  /** `sv-suggestions` — the skeleton's accessible name while suggestions load. */
  readonly suggestionsLoading: string;
  /** `sv-suggestions` — the empty state. */
  readonly suggestionsEmptyTitle: string;
  readonly suggestionsEmptyMessage: string;
  /** `sv-message-actions` — the toolbar's accessible name. */
  readonly messageActions: string;
  /** Copy button names, per state. */
  readonly copyMessage: string;
  readonly copied: string;
  /** `{shortcut}` e.g. "Ctrl+C". */
  readonly copyFailed: string;
  /** The line beside the copy button when the clipboard refused — `{shortcut}` e.g. "Ctrl+C". */
  readonly copyFallbackHint: string;
  /** Feedback toggles. */
  readonly markHelpful: string;
  readonly markNotHelpful: string;
  /** The regenerate action. */
  readonly regenerate: string;
}

export const SV_AI_LABELS: SvAiLabels = {
  suggestions: 'Suggested prompts',
  suggestionsLoading: 'Loading suggestions',
  suggestionsEmptyTitle: 'No suggestions',
  suggestionsEmptyMessage: 'Suggestions appear here when there are some to offer.',
  messageActions: 'Message actions',
  copyMessage: 'Copy message',
  copied: 'Copied!',
  copyFailed: 'Copying failed — select the text and press {shortcut}',
  copyFallbackHint: 'The clipboard is not available here — select the text and press {shortcut}.',
  markHelpful: 'Helpful',
  markNotHelpful: 'Not helpful',
  regenerate: 'Regenerate',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    ai: SvAiLabels;
  }
}
