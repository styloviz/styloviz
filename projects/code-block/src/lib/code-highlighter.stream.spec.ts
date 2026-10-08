import { revealBidi, stripAnsi, tokenize } from './code-highlighter';
import type { CodeLanguage, CodeToken } from './code-block.types';

/**
 * Three ways the highlighter used to describe text as something it was not:
 * a half-received literal coloured as code, an escape sequence printed as
 * debris, and an invisible reordering character passed straight through.
 *
 * ★ Every control character below is written as an escape or built from its code
 *   point, never typed. Spelling them literally would put invisible reordering
 *   characters into this file, which is the problem under test.
 */

const flat = (source: string, language: CodeLanguage): readonly CodeToken[] =>
  tokenize(source, language).flatMap((line) => line.tokens);

const kindOf = (source: string, language: CodeLanguage, text: string): string | undefined =>
  flat(source, language).find((t) => t.text === text)?.kind;

const ESC = String.fromCodePoint(0x1b);
const BEL = String.fromCodePoint(0x07);

/** Every control `revealBidi` knows about, built from its code point. */
const BIDI_CODE_POINTS = [
  0x061c, 0x200e, 0x200f,
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
  0x2066, 0x2067, 0x2068, 0x2069,
] as const;

const RLO = String.fromCodePoint(0x202e);
const PDI = String.fromCodePoint(0x2069);
const RLM = String.fromCodePoint(0x200f);

// ─── Streaming: openers whose closer has not arrived ──────────────────────────

describe('tokenize — a literal that is still being typed', () => {
  it('keeps an unterminated double-quoted string from leaking keywords', () => {
    // The bug: with no closing quote no string rule matched, so `if` and
    // `return` were claimed by the keyword rule INSIDE string content.
    const tokens = flat('const a = "if (x) return', 'typescript');
    expect(tokens).toContainEqual({ kind: 'string', text: '"if (x) return' });
    expect(tokens.some((t) => t.kind === 'keyword' && t.text === 'if')).toBe(false);
    expect(tokens.some((t) => t.kind === 'keyword' && t.text === 'return')).toBe(false);
  });

  it('still prefers the TERMINATED string when the quote does arrive', () => {
    const tokens = flat('const a = "x"; if (y) {}', 'typescript');
    expect(tokens).toContainEqual({ kind: 'string', text: '"x"' });
    expect(tokens).toContainEqual({ kind: 'keyword', text: 'if' });
  });

  it('does not let an unterminated single-line string swallow the next line', () => {
    // `"..."` is line-bounded in TypeScript, so the code below it stays code.
    const lines = tokenize('const a = "oops\nconst b = 2;', 'typescript');
    expect(lines).toHaveLength(2);
    expect(lines[0].tokens).toContainEqual({ kind: 'string', text: '"oops' });
    expect(lines[1].tokens).toContainEqual({ kind: 'keyword', text: 'const' });
  });

  it('carries an unterminated template literal across lines, because it does', () => {
    const lines = tokenize('const t = `line one\nline two', 'typescript');
    expect(lines[0].tokens.at(-1)?.kind).toBe('string');
    expect(lines[1].tokens[0].kind).toBe('string');
  });

  it('treats an unclosed block comment as comment to the end of the buffer', () => {
    const lines = tokenize('const a = 1;\n/* explaining the\nnext bit', 'typescript');
    expect(lines[1].tokens[0].kind).toBe('comment');
    expect(lines[2].tokens[0].kind).toBe('comment');
  });

  it('does not colour a keyword sitting inside an unclosed comment', () => {
    expect(flat('/* return true', 'typescript').some((t) => t.kind === 'keyword')).toBe(false);
  });

  it('prefers the triple quote over the single one in Python', () => {
    // A lone `"` would otherwise claim the opener and stop one character in.
    const lines = tokenize('x = """docstring\nstill the docstring', 'python');
    expect(lines[0].tokens.at(-1)?.text).toBe('"""docstring');
    expect(lines[1].tokens[0].kind).toBe('string');
    expect(kindOf("y = '''also\nopen", 'python', "'''also")).toBe('string');
  });

  it('handles an unclosed quote in every other language it highlights', () => {
    expect(kindOf("echo 'abc", 'bash', "'abc")).toBe('string');
    expect(kindOf('s := `raw', 'go', '`raw')).toBe('string');
    expect(kindOf('let s = "abc', 'rust', '"abc')).toBe('string');
    expect(kindOf('a { content: "x', 'css', '"x')).toBe('string');
    expect(kindOf('{"a', 'json', '"a')).toBe('string');
    expect(kindOf('<div class="a', 'html', '"a')).toBe('string');
    expect(kindOf('<!-- todo', 'html', '<!-- todo')).toBe('comment');
  });

  it('never colours string contents as code at ANY point in the stream', () => {
    // The invariant the component's selling point depends on: the colours must
    // not rearrange themselves as the buffer grows.
    const full = 'const msg = "return true";';
    for (let i = 0; i <= full.length; i++) {
      const wrong = flat(full.slice(0, i), 'typescript').filter(
        (t) => t.kind === 'keyword' && (t.text === 'return' || t.text === 'true'),
      );
      expect(wrong, `prefix of length ${i}`).toEqual([]);
    }
  });
});

// ─── Terminal escape sequences ────────────────────────────────────────────────

describe('stripAnsi', () => {
  it('removes SGR colour codes and keeps the text they wrapped', () => {
    expect(stripAnsi(`${ESC}[31mred${ESC}[0m`)).toBe('red');
    expect(stripAnsi(`a${ESC}[1mb${ESC}[0mc`)).toBe('abc');
  });

  it('removes cursor movement and erase sequences a transcript cannot obey', () => {
    expect(stripAnsi(`${ESC}[2K${ESC}[1Gline`)).toBe('line');
    expect(stripAnsi(`${ESC}[?25lhidden${ESC}[?25h`)).toBe('hidden');
  });

  it('removes an OSC title sequence, including either terminator', () => {
    expect(stripAnsi(`${ESC}]0;my title${BEL}done`)).toBe('done');
    expect(stripAnsi(`${ESC}]0;my title${ESC}\\done`)).toBe('done');
  });

  it('removes a two-character escape with no bracket at all', () => {
    expect(stripAnsi(`${ESC}Mup`)).toBe('up');
  });

  it('leaves text that merely LOOKS like an escape alone', () => {
    // No ESC byte, so `[31m` here is content. A regex written without the ESC —
    // which is what "strip the [31m debris" tempts you into — would eat this.
    expect(stripAnsi('array[31m] = 1')).toBe('array[31m] = 1');
  });

  it('returns ordinary output unchanged', () => {
    expect(stripAnsi('Build complete in 4.2s')).toBe('Build complete in 4.2s');
    expect(stripAnsi('')).toBe('');
  });
});

// ─── Invisible reordering characters ──────────────────────────────────────────

describe('revealBidi', () => {
  it('leaves clean text exactly as it was', () => {
    expect(revealBidi('const a = 1;')).toBe('const a = 1;');
    expect(revealBidi('')).toBe('');
  });

  it('renders every bidi control as a visible code point', () => {
    for (const cp of BIDI_CODE_POINTS) {
      const ch = String.fromCodePoint(cp);
      const shown = `<U+${cp.toString(16).toUpperCase().padStart(4, '0')}>`;
      expect(revealBidi(`a${ch}b`)).toBe(`a${shown}b`);
    }
  });

  it('reveals the CVE-2021-42574 shape — a comment that is not one', () => {
    expect(revealBidi(`/* ${RLO} } ${PDI} if (admin)`)).toBe('/* <U+202E> } <U+2069> if (admin)');
  });

  it('leaves right-to-left LETTERS alone — they are content, not control', () => {
    // Arabic for "hello". Legitimate in a string literal; nothing to warn about.
    const hello = '\u0645\u0631\u062D\u0628\u0627';
    expect(revealBidi(`"${hello}"`)).toBe(`"${hello}"`);
  });
});

describe('tokenize — bidi controls become their own visible token', () => {
  it('emits a bidi token in plaintext, where no rule runs at all', () => {
    expect(flat(`a${RLM}b`, 'plaintext')).toEqual([
      { kind: 'plain', text: 'a' },
      { kind: 'bidi', text: '<U+200F>' },
      { kind: 'plain', text: 'b' },
    ]);
  });

  it('splits one out of the MIDDLE of a string literal', () => {
    // ★ The case a cursor-position check missed: the string rule had already
    //   claimed the whole literal, so the control never sat at the cursor.
    expect(flat(`"a${RLO}b"`, 'typescript')).toEqual([
      { kind: 'string', text: '"a' },
      { kind: 'bidi', text: '<U+202E>' },
      { kind: 'string', text: 'b"' },
    ]);
  });

  it('splits one out of the middle of a comment', () => {
    expect(flat(`// note ${RLO} end`, 'typescript')).toEqual([
      { kind: 'comment', text: '// note ' },
      { kind: 'bidi', text: '<U+202E>' },
      { kind: 'comment', text: ' end' },
    ]);
  });

  it('keeps the surrounding kind rather than flattening the token to plain', () => {
    const tokens = flat(`const s = "x${RLO}y";`, 'typescript');
    expect(tokens.filter((t) => t.kind === 'string').map((t) => t.text)).toEqual(['"x', 'y"']);
    expect(tokens).toContainEqual({ kind: 'keyword', text: 'const' });
  });

  it('reveals a run of consecutive controls one token each', () => {
    expect(flat(`${RLO}${PDI}`, 'plaintext')).toEqual([
      { kind: 'bidi', text: '<U+202E>' },
      { kind: 'bidi', text: '<U+2069>' },
    ]);
  });
});
