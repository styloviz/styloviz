// ─── Public types ─────────────────────────────────────────────────────────────

/** Languages the built-in zero-dependency highlighter can tokenise. */
export type CodeLanguage =
  | 'typescript'
  | 'javascript'
  | 'html'
  | 'css'
  | 'json'
  | 'bash'
  | 'python'
  /**
   * ★ Added because a kit that ships a developer-portfolio template has to be
   *   able to show that developer's actual code. Labelling a `.go` file
   *   TYPESCRIPT — which is what the extension map did before — is a small lie
   *   on a page whose whole argument is precision.
   */
  | 'go'
  | 'rust'
  | 'plaintext';

/** Layout preset for the component. */
export type CodeBlockVariant = 'block' | 'tabs' | 'diff' | 'terminal';

/** How a diff is laid out. */
export type CodeBlockDiffMode = 'unified' | 'split';

/** Semantic class of a highlighted token. */
export type CodeTokenKind =
  | 'plain'
  | 'keyword'
  | 'builtin'
  | 'string'
  | 'comment'
  | 'number'
  | 'function'
  | 'property'
  | 'tag'
  | 'attr'
  | 'operator'
  | 'punct'
  /**
   * An invisible bidirectional control character, rendered as a visible
   * `<U+202E>`. Styled as a warning rather than as syntax: it is not something
   * the author typed to be read, it is something that changes how everything
   * around it is read. See `revealBidi` in the highlighter.
   */
  | 'bidi';

/** One highlighted span within a line. */
export interface CodeToken {
  readonly kind: CodeTokenKind;
  readonly text: string;
}

/** One rendered source line. */
export interface CodeLine {
  /** 1-based line number. */
  readonly no: number;
  readonly tokens: readonly CodeToken[];
}

/** A named source file — used by the `block` and `tabs` variants. */
export interface CodeFile {
  /** Display name, e.g. `app.component.ts`. Also the accessible name. */
  readonly name: string;
  /** Language for highlighting. Inferred from the extension when omitted. */
  readonly language?: CodeLanguage;
  readonly content: string;
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

export type DiffLineKind = 'add' | 'del' | 'context';

/** One line inside a diff hunk. */
export interface DiffLine {
  readonly kind: DiffLineKind;
  readonly text: string;
  /** Line number in the original file, or `null` for an added line. */
  readonly oldNo: number | null;
  /** Line number in the new file, or `null` for a removed line. */
  readonly newNo: number | null;
}

/** A contiguous group of changed lines. */
export interface DiffHunk {
  /** Stable id — used as the `@for` track key and in `hunkAction`. */
  readonly id: string;
  /** Optional header, e.g. `@@ -12,7 +12,9 @@`. */
  readonly header?: string;
  readonly lines: readonly DiffLine[];
}

export type DiffHunkAction = 'accept' | 'reject';

/** Emitted when a hunk is accepted or rejected. */
export interface DiffHunkEvent {
  readonly hunk: DiffHunk;
  readonly action: DiffHunkAction;
}

// ─── Terminal ─────────────────────────────────────────────────────────────────

export type TerminalLineKind = 'command' | 'stdout' | 'stderr' | 'exit';

/** One line of terminal output. */
export interface TerminalLine {
  readonly kind: TerminalLineKind;
  readonly text: string;
}
