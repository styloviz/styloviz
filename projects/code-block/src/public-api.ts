export { SvCodeBlockComponent } from './lib/code-block.component';
export { SvTerminalComponent } from './lib/terminal.component';
export { SvDiffViewerComponent } from './lib/diff-viewer/diff-viewer.component';
export type { SvDiffViewerView } from './lib/diff-viewer/diff-viewer.component';
export { SvStackTraceComponent } from './lib/stack-trace/stack-trace.component';
export { SvFileTreeComponent } from './lib/file-tree/file-tree.component';
export type { SvFileNode, SvFileTreeSort } from './lib/file-tree/file-tree.component';

export type {
  CodeLanguage,
  CodeBlockVariant,
  CodeBlockDiffMode,
  CodeTokenKind,
  CodeToken,
  CodeLine,
  CodeFile,
  DiffLineKind,
  DiffLine,
  DiffHunk,
  DiffHunkAction,
  DiffHunkEvent,
  TerminalLineKind,
  TerminalLine,
} from './lib/code-block.types';

export { tokenize, inferLanguage } from './lib/code-highlighter';

export type {
  TerminalResult,
  TerminalCommand,
  TerminalRanEvent,
  TerminalLive,
} from './lib/terminal.types';

// ─── Terminal: ANSI and autoscroll ────────────────────────────────────────────
export { svParseAnsi, svAnsiPlainText } from './lib/ansi';
export type { SvAnsiColor, SvAnsiSegment } from './lib/ansi';
export { svIsScrolledToEnd } from './lib/terminal-scroll';
export type { SvScrollMetrics } from './lib/terminal-scroll';

// ─── Diff viewer ──────────────────────────────────────────────────────────────
export {
  svLineDiff,
  svWordDiff,
  svParsePatch,
  svPairWordSegments,
  svDiffViewItems,
  svDiffSplitSections,
} from './lib/diff-viewer/diff-viewer.logic';
export type {
  SvDiffRowKind,
  SvDiffRow,
  SvDiffSegment,
  SvLineDiff,
  SvLineDiffOptions,
  SvLineDiffStatus,
  SvDiffGap,
  SvParsedPatch,
  SvDiffViewRow,
  SvDiffViewItem,
  SvDiffSplitRow,
  SvDiffSplitSection,
} from './lib/diff-viewer/diff-viewer.logic';

// ─── Stack trace ──────────────────────────────────────────────────────────────
export {
  svParseStackTrace,
  svParseStackFrame,
  svIsLibraryFrame,
  svStackFrameLocation,
} from './lib/stack-trace/stack-trace.logic';
export type { SvStackFrame, SvStackFrameFormat, SvParsedStackTrace } from './lib/stack-trace/stack-trace.logic';

// ─── File tree ────────────────────────────────────────────────────────────────
export { svFileIconName, svFileIconClass } from './lib/file-tree/file-tree.icons-map';
export type { SvFileIconName } from './lib/file-tree/file-tree.icons-map';

export { out, err } from './lib/terminal.types';

// ─── Accessible names (provideSvLabels) ───────────────────────────────────────
export { SV_CODE_BLOCK_LABELS } from './lib/code-block.labels';
export type { SvCodeBlockLabels } from './lib/code-block.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/code-block.labels.packs';
