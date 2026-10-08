export { SvCodeBlockComponent } from './lib/code-block.component';
export { SvTerminalComponent } from './lib/terminal.component';

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
} from './lib/terminal.types';

export { out, err } from './lib/terminal.types';
