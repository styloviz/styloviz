export {
  SvStreamingMarkdownComponent,
} from './lib/streaming-markdown.component';

export type {
  MarkdownDensity,
  MarkdownLinkClick,
} from './lib/streaming-markdown.component';

export type {
  MdInlineKind,
  MdInline,
  MdBlockKind,
  MdListItem,
  MdTableRow,
  MdAlign,
  MdBlock,
} from './lib/streaming-markdown.types';

export { parseMarkdown, parseInline, safeHref, safeImageSrc } from './lib/markdown-parser';
export { SV_STREAMING_MARKDOWN_LABELS } from './lib/streaming-markdown.labels';
export type { SvStreamingMarkdownLabels } from './lib/streaming-markdown.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/streaming-markdown.labels.packs';
