/**
 * The accessible names and visible text `sv-tag-input` renders, in English. Override any of
 * them with `provideSvLabels({ tagInput: { … } })` from `@styloviz/core`.
 */
export interface SvTagInputLabels {
  readonly clearAll: string;
  readonly removeTag: string;
  /** The `placeholder` input's default. */
  readonly placeholder: string;
  /** Closes the partial-paste report. */
  readonly dismiss: string;
  /** Shown when the query matches no option. */
  readonly noResults: string;
  /** Paste summary: tags accepted. `{count}` picks the plural, `{n}` is the number shown. */
  readonly pasteListAdded: string;
  /** Paste summary: tags past `maxTags`. `{count}`, `{n}`. */
  readonly pasteListOverLimit: string;
  /** Paste summary: tags already present. `{count}`, `{n}`. */
  readonly pasteListDuplicate: string;
  /** Paste summary: entries matching more than one suggestion. `{count}`, `{n}`. */
  readonly pasteListAmbiguous: string;
  /** Paste summary: entries not recognised. `{count}`, `{n}`. */
  readonly pasteListInvalid: string;
  /** Paste summary: between the parts. */
  readonly pasteListSeparator: string;
  /** Paste summary: the whole sentence. `{parts}`. */
  readonly pasteListSentence: string;
  /** Read with a chip the `tagValidator` rejected. `{reason}` is the validator’s message. */
  readonly invalidTag: string;
  /** Under the field while `tagValidator` rejects tags. `{count}` picks the plural, `{n}` is formatted, `{list}` the rejected labels. */
  readonly invalidTagsSummary: string;
}

export const SV_TAG_INPUT_LABELS: SvTagInputLabels = {
  clearAll: 'Clear all',
  removeTag: 'Remove {name}',
  placeholder: 'Add tags…',
  dismiss: 'Dismiss',
  noResults: 'No results found',
  pasteListAdded: '{count, plural, one {{n} tag added} other {{n} tags added}}',
  pasteListOverLimit: '{n} over the limit',
  pasteListDuplicate: '{n} already in the list',
  pasteListAmbiguous: '{n} matched more than one option',
  pasteListInvalid: '{n} not recognised',
  pasteListSeparator: ', ',
  pasteListSentence: '{parts}.',
  invalidTag: 'not valid: {reason}',
  invalidTagsSummary: '{count, plural, one {{n} entry is not valid: {list}} other {{n} entries are not valid: {list}}}',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    tagInput: SvTagInputLabels;
  }
}
