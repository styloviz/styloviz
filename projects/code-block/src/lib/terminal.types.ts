import type { TerminalLine } from './code-block.types';

/**
 * ============================================================
 *  sv-terminal — types
 * ============================================================
 *  `sv-code-block variant="terminal"` renders a TRANSCRIPT: a fixed list of
 *  lines somebody already produced. This component is the other half — a shell
 *  a visitor can type into, whose output is produced by handlers the host
 *  registers.
 * ============================================================
 */

/** What a command handler gives back. */
export interface TerminalResult {
  /** Lines to print. Empty is legal — `clear` prints nothing. */
  readonly lines?: readonly TerminalLine[];
  /**
   * Wipe the scrollback before printing. `clear` sets this; nothing else
   * should.
   */
  readonly clear?: boolean;
  /**
   * Exit status. Non-zero renders the status line in the error colour, the way
   * a real prompt would — and is what `stderr` output should be paired with so
   * the two cannot disagree.
   */
  readonly code?: number;
}

/**
 * One registered command.
 *
 * ★★★ A HANDLER IS A FUNCTION THE HOST SUPPLIES, NEVER A STRING THE COMPONENT
 *     EVALUATES.
 *
 *     The obvious shape for a web terminal is a map of name → code, or worse a
 *     single handler that receives the raw line and decides what to do with
 *     `eval`. Both turn visitor-supplied text into executed code, in a
 *     component whose entire purpose is to accept visitor-supplied text. This
 *     registry is a lookup: input is matched against `name`, and if nothing
 *     matches, nothing runs. There is no path from typed characters to
 *     execution.
 */
export interface TerminalCommand {
  /** The word typed at the prompt. Matched case-insensitively, exactly. */
  readonly name: string;
  /** One-line description, printed by `help`. */
  readonly summary: string;
  /** Usage line, e.g. `open <project>`. Printed by `help` when present. */
  readonly usage?: string;
  /**
   * Values completed after the command name, for Tab. A function so a host can
   * derive them from live data rather than restating a list that will drift.
   */
  readonly args?: () => readonly string[];
  /**
   * Run it. Sync or async — an async handler lets a host await real work while
   * the prompt shows a busy state.
   *
   * `args` are the whitespace-separated words after the command name, already
   * trimmed. The component never interprets them.
   */
  readonly run: (args: readonly string[]) => TerminalResult | Promise<TerminalResult>;
  /** Keep it out of `help` and out of completion. For easter eggs. */
  readonly hidden?: boolean;
}

/** Emitted after every command, so a host can react (route, toast, log). */
export interface TerminalRanEvent {
  readonly input: string;
  readonly command: TerminalCommand | null;
  readonly result: TerminalResult | null;
  /** `true` when nothing in the registry matched. */
  readonly unknown: boolean;
}

/** Convenience builders — a host writing ten handlers should not repeat these. */
export const out = (...text: readonly string[]): readonly TerminalLine[] =>
  text.map((t) => ({ kind: 'stdout' as const, text: t }));

export const err = (...text: readonly string[]): readonly TerminalLine[] =>
  text.map((t) => ({ kind: 'stderr' as const, text: t }));
