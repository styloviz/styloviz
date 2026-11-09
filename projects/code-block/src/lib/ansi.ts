/**
 * ============================================================
 *  ANSI SGR → typed segments (for `sv-terminal`)
 * ============================================================
 *  Real tool output — `npm test`, `git status`, a CI runner — colours itself
 *  with SGR escape sequences. `sv-terminal` honours a small, well-defined
 *  subset and drops everything else:
 *
 *  - SGR `0` (reset), `1` (bold), `22` (normal intensity), `39` (default
 *    colour), `30–37` and `90–97` (the eight colours and their bright twins).
 *  - Every other SGR parameter is consumed and ignored — including the
 *    extended `38;5;n` / `38;2;r;g;b` forms, whose sub-parameters are skipped
 *    so a `5` or `2` inside them is never misread as a colour.
 *  - Every non-SGR sequence (cursor movement, erase, OSC titles and links) is
 *    removed. A static log cannot obey "move up one line", and printing it
 *    leaves `[1A` debris on screen.
 *
 *  ★★★ SEGMENTS, NEVER MARKUP. The output is data — `{ text, color, bold }` —
 *      that the template renders as text inside spans. There is no string of
 *      HTML anywhere on this path, so a log line containing `<img onerror>`
 *      prints those characters and nothing else.
 * ============================================================
 */

/** The eight ANSI colours. `bright` variants are a flag on the segment. */
export type SvAnsiColor = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';

/** One run of text with a single style. */
export interface SvAnsiSegment {
  readonly text: string;
  /** Foreground colour, or `null` for the line's own colour. */
  readonly color: SvAnsiColor | null;
  /** From SGR 90–97: the bright twin of `color`. */
  readonly bright: boolean;
  readonly bold: boolean;
}

const COLORS: readonly SvAnsiColor[] = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];

// ★ Same alternation order as `stripAnsi` in the highlighter: CSI and OSC first,
//   then the single-byte Fe form, which excludes `[` and `]` so it cannot eat
//   the introducer of the other two. Group 1 = CSI params, group 2 = CSI final.
const ESCAPE =
  // eslint-disable-next-line no-control-regex
  /\u001B(?:\[([0-9;?]*)[ -/]*([@-~])|\][^\u0007\u001B]*(?:\u0007|\u001B\\)?|[@-Z\\^_])?/g;

interface Style {
  color: SvAnsiColor | null;
  bright: boolean;
  bold: boolean;
}

/** Apply one SGR parameter list (`"1;31"`) to `style`, in place. */
function applySgr(params: string, style: Style): void {
  // `ESC[m` is `ESC[0m`.
  const codes = params === '' ? [0] : params.split(';').map((p) => (p === '' ? 0 : Number(p)));
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]!;
    if (code === 0) {
      style.color = null;
      style.bright = false;
      style.bold = false;
    } else if (code === 1) {
      style.bold = true;
    } else if (code === 22) {
      style.bold = false;
    } else if (code === 39) {
      style.color = null;
      style.bright = false;
    } else if (code >= 30 && code <= 37) {
      style.color = COLORS[code - 30]!;
      style.bright = false;
    } else if (code >= 90 && code <= 97) {
      style.color = COLORS[code - 90]!;
      style.bright = true;
    } else if (code === 38 || code === 48) {
      // Extended colour: skip its sub-parameters rather than read them as codes.
      const mode = codes[i + 1];
      i += mode === 5 ? 2 : mode === 2 ? 4 : 1;
    }
    // Anything else (underline, background, blink…) is outside the subset.
  }
}

/**
 * Split one line of terminal text into styled segments.
 *
 * Text with no escape character returns a single unstyled segment without
 * running the scanner — the common case for most lines of most logs.
 */
export function svParseAnsi(text: string): SvAnsiSegment[] {
  if (!text.includes('\u001B')) return text ? [{ text, color: null, bright: false, bold: false }] : [];

  const out: SvAnsiSegment[] = [];
  const style: Style = { color: null, bright: false, bold: false };
  const push = (chunk: string): void => {
    if (!chunk) return;
    const last = out[out.length - 1];
    if (last && last.color === style.color && last.bright === style.bright && last.bold === style.bold) {
      out[out.length - 1] = { ...last, text: last.text + chunk };
    } else {
      out.push({ text: chunk, color: style.color, bright: style.bright, bold: style.bold });
    }
  };

  let cursor = 0;
  ESCAPE.lastIndex = 0;
  for (let m = ESCAPE.exec(text); m; m = ESCAPE.exec(text)) {
    push(text.slice(cursor, m.index));
    cursor = m.index + m[0].length;
    // Only a CSI ending in `m` is SGR; every other sequence is dropped whole.
    if (m[2] === 'm' && m[1] !== undefined && !m[1].includes('?')) applySgr(m[1], style);
  }
  push(text.slice(cursor));
  return out;
}

/** The text of a line with every escape sequence removed — what copy takes. */
export function svAnsiPlainText(text: string): string {
  return svParseAnsi(text).map((s) => s.text).join('');
}
