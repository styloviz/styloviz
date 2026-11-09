/**
 * The accessible names and visible text `sv-code-block`, `sv-terminal`, `sv-diff-viewer`,
 * `sv-stack-trace` and `sv-file-tree` render, in English. Override any of
 * them with `provideSvLabels({ codeBlock: { … } })` from `@styloviz/core`.
 */
export interface SvCodeBlockLabels {
  readonly fileTabs: string;
  readonly diffBefore: string;
  readonly diffAfter: string;
  readonly acceptChange: string;
  readonly rejectChange: string;
  /** Screen-reader confirmation after a copy. */
  readonly copied: string;
  /** The visible word on a hunk's accept button. */
  readonly accept: string;
  /** The visible word on a hunk's reject button. */
  readonly reject: string;
  /** Screen-reader prefix on a removed diff line. */
  readonly diffRemoved: string;
  /** Screen-reader prefix on an added diff line. */
  readonly diffAdded: string;
  /** Truncation note — `{shown}` and `{total}` arrive formatted in the block's `locale`. */
  readonly truncatedSummary: string;
  /** Truncation button — `{total}` arrives formatted; `count` picks the plural. */
  readonly showAllLines: string;
  /** `sv-terminal`'s `inputLabel` default. */
  readonly terminalInput: string;
  /** The diff region's description — counts arrive as plurals. */
  readonly diffSummary: string;
  /** The region's name fallback when the block has no file name — `{language}` is the language id. */
  readonly regionCode: string;
  /** Said when a file's extension has no highlighting rules. */
  readonly highlightFallback: string;
  /** The language badge on plain text that fell back from an unknown extension. */
  readonly plainText: string;
  /** The copy button's name, per variant. */
  readonly copyDiff: string;
  readonly copyTranscript: string;
  readonly copyNamedFile: string;
  readonly copyOpenFile: string;
  readonly copyCodeWithoutNumbers: string;
  readonly copyCode: string;
  /** `sv-terminal` — an unknown command. */
  readonly commandNotFound: string;
  /** `sv-terminal` — the hint after an unknown command. */
  readonly commandHelpHint: string;
  /** `sv-terminal` — a command whose handler threw. */
  readonly commandFailed: string;
  /** `sv-terminal` — the scrollback region's name. */
  readonly terminalLog: string;
  /** `sv-terminal` — the copy button's name. */
  readonly terminalCopy: string;
  /** `sv-terminal` — the "jump to latest" button while autoscroll is paused and nothing new has arrived. */
  readonly terminalJumpToLatest: string;
  /** `sv-terminal` — the same button once `count` lines have arrived while paused. */
  readonly terminalJumpNew: string;
  /** Shown and announced when a copy could not reach the clipboard. */
  readonly copyFailed: string;
  /** `sv-diff-viewer` — the region's name when there is no file name. */
  readonly diffViewerRegion: string;
  /** `sv-diff-viewer` — the region's name with a file name. */
  readonly diffViewerNamed: string;
  /** `sv-diff-viewer` — the name of the Unified / Split switch. */
  readonly diffViewerLayout: string;
  readonly diffViewerUnified: string;
  readonly diffViewerSplit: string;
  /** `sv-diff-viewer` — the button on a folded unchanged run. */
  readonly diffViewerShowLines: string;
  /** `sv-diff-viewer` — unchanged lines a patch left out. */
  readonly diffViewerHiddenLines: string;
  readonly diffViewerIdentical: string;
  /** `sv-diff-viewer` — past `maxLines`; `{before}`, `{after}` and `{max}` are line counts. */
  readonly diffViewerTooLarge: string;
  readonly diffViewerTooDifferent: string;
  readonly diffViewerLineEndings: string;
  readonly diffViewerNoNewline: string;
  readonly diffViewerPatchInvalid: string;
  readonly diffViewerPatchMoreFiles: string;
  /** `sv-stack-trace` — the region's name. */
  readonly stackTraceLabel: string;
  readonly stackTraceCopy: string;
  /** `sv-stack-trace` — the toggle on a folded run of library frames. */
  readonly stackTraceShowLibrary: string;
  readonly stackTraceHideLibrary: string;
  /** `sv-stack-trace` — a frame with no function name. */
  readonly stackTraceAnonymous: string;
  /** `sv-stack-trace` — a frame in engine code with no source location. */
  readonly stackTraceNative: string;
  /** `sv-stack-trace` — the chip on a frame resumed after an `await`. */
  readonly stackTraceAsync: string;
  readonly stackTraceEmpty: string;
  /** `sv-stack-trace` — the frame list's name. */
  readonly stackTraceFrames: string;
  /** `sv-file-tree` — the tree's default name. */
  readonly fileTreeLabel: string;
  /** `sv-file-tree` — the empty tree. */
  readonly fileTreeEmpty: string;
}

export const SV_CODE_BLOCK_LABELS: SvCodeBlockLabels = {
  fileTabs: 'Files',
  diffBefore: 'Before',
  diffAfter: 'After',
  acceptChange: 'Accept change {index} of {total}',
  rejectChange: 'Reject change {index} of {total}',
  copied: 'Copied to clipboard',
  accept: 'Accept',
  reject: 'Reject',
  diffRemoved: 'Removed:',
  diffAdded: 'Added:',
  truncatedSummary: 'Showing the first {shown} of {total} lines.',
  showAllLines: '{count, plural, one {Show all {total} line} other {Show all {total} lines}}',
  terminalInput: 'Terminal input',
  diffSummary:
    'Diff: {hunks, plural, one {# hunk} other {# hunks}}, {added, plural, one {# added line} other {# added lines}}, {removed, plural, one {# removed line} other {# removed lines}}.',
  regionCode: '{language} code',
  highlightFallback: 'Not syntax highlighted: no rules for .{ext}. Shown as plain text.',
  plainText: 'plain text',
  copyDiff: 'Copy the updated code — additions and context, without the + and − markers',
  copyTranscript: 'Copy the transcript, without the prompt',
  copyNamedFile: 'Copy {name} — the open file only',
  copyOpenFile: 'Copy the open file only',
  copyCodeWithoutNumbers: 'Copy code, without the line numbers',
  copyCode: 'Copy code',
  commandNotFound: '{command}: command not found',
  commandHelpHint: 'Type `help` to see what this terminal knows.',
  commandFailed: '{command}: command failed',
  terminalLog: 'Terminal output',
  terminalCopy: 'Copy the terminal output',
  terminalJumpToLatest: 'Jump to latest',
  terminalJumpNew: '{count, plural, one {# new line — jump to latest} other {# new lines — jump to latest}}',
  copyFailed: 'Could not copy. Select the text and copy it instead.',
  diffViewerRegion: 'Diff',
  diffViewerNamed: 'Changes to {name}',
  diffViewerLayout: 'Diff layout',
  diffViewerUnified: 'Unified',
  diffViewerSplit: 'Split',
  diffViewerShowLines: '{count, plural, one {Show # unchanged line} other {Show # unchanged lines}}',
  diffViewerHiddenLines: '{count, plural, one {# unchanged line not in the patch} other {# unchanged lines not in the patch}}',
  diffViewerIdentical: 'No differences: the two versions are identical.',
  diffViewerTooLarge: 'This diff is too large to show here: {before} and {after} lines, over the {max}-line limit.',
  diffViewerTooDifferent: 'These versions are too different to compare line by line, so the old text is shown removed and the new text added.',
  diffViewerLineEndings: 'The line endings differ (CRLF and LF). They are ignored in this comparison.',
  diffViewerNoNewline: 'No newline at end of file',
  diffViewerPatchInvalid: 'This patch could not be read: it has no hunk headers (@@ … @@).',
  diffViewerPatchMoreFiles: 'Only the first file in this patch is shown.',
  stackTraceLabel: 'Stack trace',
  stackTraceCopy: 'Copy the stack trace',
  stackTraceShowLibrary: '{count, plural, one {Show # library frame} other {Show # library frames}}',
  stackTraceHideLibrary: '{count, plural, one {Hide # library frame} other {Hide # library frames}}',
  stackTraceAnonymous: '(anonymous)',
  stackTraceNative: 'native code',
  stackTraceAsync: 'async',
  stackTraceEmpty: 'No stack trace to show.',
  stackTraceFrames: '{count, plural, one {# frame} other {# frames}}',
  fileTreeLabel: 'Files',
  fileTreeEmpty: 'No files',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    codeBlock: SvCodeBlockLabels;
  }
}
