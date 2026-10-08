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
