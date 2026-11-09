/**
 * The accessible names `sv-streaming-markdown` renders, in English. Override any of them with
 * `provideSvLabels({ streamingMarkdown: { … } })` from `@styloviz/core`.
 */
export interface SvStreamingMarkdownLabels {
  readonly done: string;
  readonly notDone: string;
  readonly responseComplete: string;
}

export const SV_STREAMING_MARKDOWN_LABELS: SvStreamingMarkdownLabels = {
  done: 'Done',
  notDone: 'Not done',
  responseComplete: 'Response complete',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    streamingMarkdown: SvStreamingMarkdownLabels;
  }
}
