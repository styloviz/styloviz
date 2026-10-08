import type {
  CodeLanguage,
  CodeLine,
  CodeToken,
  CodeTokenKind,
} from './code-block.types';

/**
 * Zero-dependency syntax highlighter.
 *
 * Deliberately small: a per-language ordered rule list scanned with sticky
 * regexes. It produces a token *model* (never an HTML string), so the template
 * renders it through Angular bindings — no `innerHTML`, no `bypassSecurityTrust*`.
 *
 * It is also streaming-safe: `tokenize()` is pure and cheap enough to re-run on
 * a growing buffer, so a partially-received response highlights correctly
 * without incremental parser state.
 */

interface Rule {
  readonly kind: CodeTokenKind;
  readonly re: RegExp;
}

const rule = (kind: CodeTokenKind, source: string, flags = ''): Rule => ({
  kind,
  re: new RegExp(source, `y${flags}`),
});

/**
 * Openers whose closer has not arrived yet.
 *
 * ★★★ A HALF-RECEIVED STRING HIGHLIGHTED ITS OWN CONTENTS AS CODE.
 *
 *     Every string rule requires the closing quote, so mid-stream
 *     `const a = "if (x) return` matched no string at all and the quote fell
 *     through as plain — leaving `if` and `return` to be claimed by the keyword
 *     rule INSIDE what is actually string content. The colours then rearranged
 *     themselves the moment the closing quote landed, on the one component
 *     whose selling point is that a growing buffer stays correctly coloured.
 *
 *     Each of these mirrors a terminated rule above it and is ordered AFTER it,
 *     so a complete token always wins and these only take what is genuinely
 *     still open. Line-bounded where the language's literal is (`"…"`),
 *     unbounded where it is not (block comments, template and raw strings).
 */
const UNTERMINATED_BLOCK_COMMENT = '/\\*[\\s\\S]*';
const UNTERMINATED_DQ = '"(?:\\\\.|[^"\\\\\\n])*';
const UNTERMINATED_SQ = "'(?:\\\\.|[^'\\\\\\n])*";
const UNTERMINATED_DQ_MULTILINE = '"(?:\\\\.|[^"\\\\])*';
const UNTERMINATED_BACKTICK = '`(?:\\\\.|[^`\\\\])*';

// ─── Rule tables ──────────────────────────────────────────────────────────────
// Order matters — the first rule that matches at the cursor wins.

const JS_KEYWORDS =
  'abstract|as|async|await|break|case|catch|class|const|continue|declare|default|delete|do|else|enum|export|extends|false|finally|for|from|function|get|if|implements|import|in|instanceof|interface|keyof|let|new|null|of|private|protected|public|readonly|return|satisfies|set|static|super|switch|this|throw|true|try|type|typeof|undefined|var|void|while|yield';

const JS_BUILTINS =
  'string|number|boolean|any|unknown|never|object|symbol|bigint|Array|Promise|Record|Partial|Readonly|Map|Set|Date|Math|JSON|Object|console|window|document';

const TS_RULES: readonly Rule[] = [
  rule('comment', '//[^\\n]*'),
  rule('comment', '/\\*[\\s\\S]*?\\*/'),
  rule('string', '`(?:\\\\.|[^`\\\\])*`'),
  rule('string', '"(?:\\\\.|[^"\\\\\\n])*"'),
  rule('string', "'(?:\\\\.|[^'\\\\\\n])*'"),
  rule('comment', UNTERMINATED_BLOCK_COMMENT),
  rule('string', UNTERMINATED_BACKTICK),
  rule('string', UNTERMINATED_DQ),
  rule('string', UNTERMINATED_SQ),
  rule('number', '\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b'),
  rule('keyword', `\\b(?:${JS_KEYWORDS})\\b`),
  rule('builtin', `\\b(?:${JS_BUILTINS})\\b`),
  rule('function', '\\b[A-Za-z_$][\\w$]*(?=\\s*\\()'),
  rule('property', '(?<=\\.)[A-Za-z_$][\\w$]*'),
  rule('operator', '[+\\-*/%=<>!&|^~?:]+'),
  rule('punct', '[{}()[\\];,.]'),
];

const HTML_RULES: readonly Rule[] = [
  rule('comment', '<!--[\\s\\S]*?-->'),
  rule('tag', '</?[A-Za-z][\\w-]*'),
  rule('tag', '/?>'),
  rule('attr', '[A-Za-z_@:[\\]()*#][\\w.\\-@:[\\]()*#]*(?=\\s*=)'),
  rule('string', '"(?:\\\\.|[^"\\\\])*"'),
  rule('string', "'(?:\\\\.|[^'\\\\])*'"),
  rule('comment', '<!--[\\s\\S]*'),
  rule('string', UNTERMINATED_DQ_MULTILINE),
  rule('operator', '='),
];

const CSS_RULES: readonly Rule[] = [
  rule('comment', '/\\*[\\s\\S]*?\\*/'),
  rule('string', '"(?:\\\\.|[^"\\\\])*"'),
  rule('string', "'(?:\\\\.|[^'\\\\])*'"),
  rule('comment', UNTERMINATED_BLOCK_COMMENT),
  rule('string', UNTERMINATED_DQ_MULTILINE),
  rule('keyword', '@[\\w-]+'),
  rule('property', '[a-z-]+(?=\\s*:)'),
  rule('number', '-?\\d*\\.?\\d+(?:px|rem|em|%|vh|vw|fr|s|ms|deg)?'),
  rule('function', '\\b[a-z-]+(?=\\()'),
  rule('punct', '[{}();:,]'),
];

const JSON_RULES: readonly Rule[] = [
  rule('property', '"(?:\\\\.|[^"\\\\])*"(?=\\s*:)'),
  rule('string', '"(?:\\\\.|[^"\\\\])*"'),
  rule('string', UNTERMINATED_DQ_MULTILINE),
  rule('number', '-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b'),
  rule('keyword', '\\b(?:true|false|null)\\b'),
  rule('punct', '[{}[\\],:]'),
];

const BASH_RULES: readonly Rule[] = [
  rule('comment', '#[^\\n]*'),
  rule('string', '"(?:\\\\.|[^"\\\\])*"'),
  rule('string', "'[^']*'"),
  rule('string', UNTERMINATED_DQ_MULTILINE),
  rule('string', "'[^']*"),
  rule('builtin', '\\b(?:npm|npx|node|git|cd|ls|rm|cp|mv|mkdir|echo|cat|curl|export|sudo|ng|pnpm|yarn)\\b'),
  rule('keyword', '\\b(?:if|then|else|fi|for|in|do|done|while|case|esac|function|return|exit)\\b'),
  rule('operator', '[|&><]+|--?[\\w-]+'),
  rule('number', '\\b\\d+\\b'),
];

const PY_KEYWORDS =
  'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield';

const PY_RULES: readonly Rule[] = [
  rule('comment', '#[^\\n]*'),
  rule('string', '"""[\\s\\S]*?"""'),
  rule('string', "'''[\\s\\S]*?'''"),
  // ★ AN UNCLOSED DOCSTRING IS THE ONE PLACE THE "TERMINATED RULES FIRST"
  //   ORDERING IS WRONG, so these two sit above the single-quote rules rather
  //   than below them with the other unterminated openers. Against `"""doc` the
  //   terminated `"(?:…)*"` rule matches the EMPTY STRING `""` — the first two
  //   quotes — which is a complete token, wins on order, and leaves the third
  //   quote to open a one-character string. The docstring then highlighted as
  //   `""` + `"doc`, and a `#` inside it was still a comment.
  rule('string', '"""[\\s\\S]*'),
  rule('string', "'''[\\s\\S]*"),
  rule('string', '"(?:\\\\.|[^"\\\\\\n])*"'),
  rule('string', "'(?:\\\\.|[^'\\\\\\n])*'"),
  rule('string', UNTERMINATED_DQ),
  rule('string', UNTERMINATED_SQ),
  rule('number', '\\b\\d[\\d_]*(?:\\.\\d+)?\\b'),
  rule('keyword', `\\b(?:${PY_KEYWORDS})\\b`),
  rule('builtin', '\\b(?:self|print|len|range|dict|list|set|tuple|int|str|float|bool|open|enumerate|zip)\\b'),
  rule('function', '\\b[A-Za-z_][\\w]*(?=\\s*\\()'),
  rule('operator', '[+\\-*/%=<>!&|^~]+'),
  rule('punct', '[{}()[\\];,.:]'),
];

const GO_KEYWORDS =
  'break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var';

const GO_BUILTINS =
  'bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|rune|string|uint|uint8|uint16|uint32|uint64|uintptr|any|nil|true|false|iota|make|new|len|cap|append|copy|delete|panic|recover|print|println';

const GO_RULES: readonly Rule[] = [
  rule('comment', '//[^\\n]*'),
  rule('comment', '/\\*[\\s\\S]*?\\*/'),
  rule('string', '`(?:[^`])*`'),
  rule('string', '"(?:\\\\.|[^"\\\\\\n])*"'),
  rule('string', "'(?:\\\\.|[^'\\\\\\n])*'"),
  rule('comment', UNTERMINATED_BLOCK_COMMENT),
  rule('string', '`[^`]*'),
  rule('string', UNTERMINATED_DQ),
  rule('string', UNTERMINATED_SQ),
  rule('number', '\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b'),
  rule('keyword', `\\b(?:${GO_KEYWORDS})\\b`),
  rule('builtin', `\\b(?:${GO_BUILTINS})\\b`),
  rule('function', '\\b[A-Za-z_][\\w]*(?=\\s*\\()'),
  rule('property', '(?<=\\.)[A-Za-z_][\\w]*'),
  rule('operator', '[+\\-*/%=<>!&|^~?:]+'),
  rule('punct', '[{}()[\\];,.]'),
];

const RUST_KEYWORDS =
  'as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while';

const RUST_BUILTINS =
  'bool|char|f32|f64|i8|i16|i32|i64|i128|isize|str|u8|u16|u32|u64|u128|usize|String|Vec|Option|Result|Box|Some|None|Ok|Err|HashMap|HashSet|Iterator';

const RUST_RULES: readonly Rule[] = [
  rule('comment', '//[^\\n]*'),
  rule('comment', '/\\*[\\s\\S]*?\\*/'),
  rule('string', '"(?:\\\\.|[^"\\\\])*"'),
  rule('comment', UNTERMINATED_BLOCK_COMMENT),
  rule('string', UNTERMINATED_DQ_MULTILINE),
  rule('number', '\\b\\d[\\d_]*(?:\\.\\d+)?(?:[iuf](?:8|16|32|64|128|size))?\\b'),
  // Attributes and lifetimes, before the keyword rule can claim their words.
  rule('builtin', '#!?\\[[^\\]]*\\]'),
  rule('keyword', `\\b(?:${RUST_KEYWORDS})\\b`),
  rule('builtin', `\\b(?:${RUST_BUILTINS})\\b`),
  rule('function', '\\b[A-Za-z_][\\w]*(?=\\s*[(<])'),
  rule('property', '(?<=\\.)[A-Za-z_][\\w]*'),
  rule('operator', '[+\\-*/%=<>!&|^~?:]+'),
  rule('punct', '[{}()[\\];,.]'),
];

const RULES: Readonly<Record<CodeLanguage, readonly Rule[]>> = {
  typescript: TS_RULES,
  javascript: TS_RULES,
  html: HTML_RULES,
  css: CSS_RULES,
  json: JSON_RULES,
  bash: BASH_RULES,
  python: PY_RULES,
  go: GO_RULES,
  rust: RUST_RULES,
  plaintext: [],
};

// ─── Public helpers ───────────────────────────────────────────────────────────

const EXTENSION_MAP: Readonly<Record<string, CodeLanguage>> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  jsx: 'javascript',
  html: 'html',
  htm: 'html',
  svg: 'html',
  css: 'css',
  scss: 'css',
  json: 'json',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  py: 'python',
  go: 'go',
  rs: 'rust',
};

/** Best-effort language inference from a file name. Falls back to plaintext. */
export function inferLanguage(fileName: string): CodeLanguage {
  // ★ UNREACHABLE BRANCH — the `?? ''` right operand can never be taken, and no
  // test can cover it. `String.prototype.split` always returns an array with at
  // least one element (`''.split('.')` is `['']`), so `.pop()` on it is always a
  // string and the `?.` never short-circuits. It is kept because TypeScript
  // types `Array#pop` as `T | undefined` regardless, so removing it means
  // widening `ext` to `string | undefined` and pushing the same guard one line
  // down. Counted as unreachable, not as missing coverage.
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MAP[ext] ?? 'plaintext';
}

// ─── Text that lies about itself ──────────────────────────────────────────────

/**
 * Unicode bidirectional control characters.
 *
 * ★★★ THE RENDERED CODE AND THE COPIED CODE WERE ALLOWED TO DIFFER.
 *
 *     These characters reorder the glyphs around them and occupy no width, so
 *     `RLO`/`PDI` runs inside a comment or a string literal can make a line
 *     DISPLAY as one statement and copy as another — CVE-2021-42574, "Trojan
 *     Source". The component renders a token model rather than markup, so this
 *     is not an injection route; it is worse than that, because it needs no
 *     injection. A reviewer reading a diff sees the reordered text and approves
 *     the bytes underneath it.
 *
 *     So they are rendered as a visible `<U+202E>` rather than passed through.
 *     Nothing here touches what `copy()` puts on the clipboard: the payload is
 *     built from the raw input, because a component that silently rewrote the
 *     source on the way to the clipboard would be its own, quieter version of
 *     the same problem.
 */
// Written as escapes on purpose: spelling these literally would put invisible
// reordering characters into this file, which is the exact problem.
const BIDI_CONTROL = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/;

const codePoint = (ch: string): string =>
  `<U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}>`;

/**
 * Replace invisible bidi controls with a visible escape.
 *
 * For the text the component renders WITHOUT tokenising — diff lines and
 * terminal output — where `tokenize` is not in the path but the same reordering
 * applies. A diff is the likeliest place for this to matter: it is where code
 * gets approved.
 */
export function revealBidi(text: string): string {
  if (!BIDI_CONTROL.test(text)) return text;
  return [...text].map((ch) => (BIDI_CONTROL.test(ch) ? codePoint(ch) : ch)).join('');
}

/**
 * Strip ANSI escape sequences from terminal text.
 *
 * ★★ REAL TOOL OUTPUT IS FULL OF THESE AND NOTHING HANDLED THEM. Pasting the
 *    output of `npm test` or `git status` into `terminalLines` rendered its
 *    colour codes as literal `[31m` and `[0m` debris — the ESC itself is
 *    non-printing, so what survived on screen was the bracket and the digits.
 *
 *    Stripped rather than interpreted: `TerminalLine.kind` already carries the
 *    one distinction the transcript needs (command · stdout · stderr · exit)
 *    and drives the colour, so honouring an SGR code would mean two sources of
 *    truth for the same pixel and a hidden way to paint stderr green. This also
 *    takes the cursor-movement and erase sequences, which a static transcript
 *    has no way to obey and would otherwise print as garbage.
 */
// ★★ ORDER INSIDE THE ALTERNATION IS THE WHOLE CORRECTNESS ARGUMENT. The
//    single-character form `[@-Z...]` covers Fe bytes 0x40-0x5F, and that
//    range CONTAINS both `[` and `]` — so listed first it matched `ESC]`
//    alone and left `0;my title` behind as text. CSI and OSC therefore come
//    first and the Fe class excludes the two bytes they own.
const ANSI_ESCAPE =
  // eslint-disable-next-line no-control-regex
  /\u001B(?:\[[0-9;?]*[ -/]*[@-~]|\][^\u0007\u001B]*(?:\u0007|\u001B\\)?|[@-Z\\^_])/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE, '');
}

/**
 * Tokenise `source` into lines of typed spans.
 *
 * Pure and allocation-light; safe to call on every keystroke of a streaming
 * buffer. Unknown characters fall through as `plain`, so an unsupported
 * language degrades to readable monospace text rather than failing.
 */
export function tokenize(source: string, language: CodeLanguage): readonly CodeLine[] {
  const rules = RULES[language] ?? [];
  const flat: CodeToken[] = [];

  let i = 0;
  let pending = '';

  /**
   * Append a token, splitting any invisible bidi controls out of it.
   *
   * ★★ EVERY TOKEN GOES THROUGH HERE, NOT JUST THE UNMATCHED CHARACTERS.
   *
   *    Checking for a control at the cursor before running the rules only
   *    catches one that happens to start a token — and a `RLO` run is planted
   *    INSIDE a comment or a string literal, which is exactly where a rule has
   *    already claimed the whole span and moved the cursor past it. So the
   *    reveal has to happen on the way into `flat`, where the surrounding kind
   *    is still known and can be kept for the parts either side.
   */
  const push = (kind: CodeTokenKind, text: string): void => {
    if (!BIDI_CONTROL.test(text)) {
      flat.push({ kind, text });
      return;
    }
    let run = '';
    for (const ch of text) {
      if (!BIDI_CONTROL.test(ch)) {
        run += ch;
        continue;
      }
      if (run) {
        flat.push({ kind, text: run });
        run = '';
      }
      flat.push({ kind: 'bidi', text: codePoint(ch) });
    }
    if (run) flat.push({ kind, text: run });
  };

  const flushPending = (): void => {
    if (pending) {
      push('plain', pending);
      pending = '';
    }
  };

  while (i < source.length) {
    let matched = false;

    for (const r of rules) {
      r.re.lastIndex = i;
      const m = r.re.exec(source);
      if (m && m[0].length > 0) {
        flushPending();
        push(r.kind, m[0]);
        i += m[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      pending += source[i];
      i += 1;
    }
  }
  flushPending();

  // Split tokens on newlines so each line owns its own spans.
  const lines: CodeLine[] = [];
  let current: CodeToken[] = [];

  const pushLine = (): void => {
    lines.push({ no: lines.length + 1, tokens: current });
    current = [];
  };

  for (const token of flat) {
    if (!token.text.includes('\n')) {
      current.push(token);
      continue;
    }
    const parts = token.text.split('\n');
    parts.forEach((part, idx) => {
      if (part) current.push({ kind: token.kind, text: part });
      if (idx < parts.length - 1) pushLine();
    });
  }
  pushLine();

  // A trailing newline produces one empty line — drop it for a tidy render.
  if (lines.length > 1 && lines[lines.length - 1].tokens.length === 0) {
    lines.pop();
  }
  return lines;
}
