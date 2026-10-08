import { inferLanguage, tokenize } from './code-highlighter';
import type { CodeLanguage } from './code-block.types';

/**
 * The tokeniser's edges: empty input, a trailing newline, a file name with no
 * extension, and a language the type system says cannot happen but a plain-JS
 * host can still bind.
 *
 * The happy paths live in `code-block.component.spec.ts`; this file only holds
 * the cases that file leaves untaken.
 */

describe('inferLanguage — names that are not what they look like', () => {
  it('reads only the LAST extension', () => {
    expect(inferLanguage('app.component.ts')).toBe('typescript');
    expect(inferLanguage('archive.ts.bak')).toBe('plaintext');
  });

  it('ignores the case of the extension', () => {
    expect(inferLanguage('STYLES.CSS')).toBe('css');
  });

  it('falls back to plaintext for a name with no extension at all', () => {
    expect(inferLanguage('Makefile')).toBe('plaintext');
    expect(inferLanguage('')).toBe('plaintext');
  });

  it('treats a dotfile as having no usable extension', () => {
    // `.gitignore`.split('.') is ['', 'gitignore'] — the "extension" is the
    // whole name, which is not in the map.
    expect(inferLanguage('.gitignore')).toBe('plaintext');
  });

  it('maps every alias to the same language as its canonical extension', () => {
    expect(inferLanguage('a.tsx')).toBe('typescript');
    expect(inferLanguage('a.mjs')).toBe('javascript');
    expect(inferLanguage('a.htm')).toBe('html');
    expect(inferLanguage('a.scss')).toBe('css');
    expect(inferLanguage('a.zsh')).toBe('bash');
  });
});

describe('tokenize — edges of the line splitter', () => {
  it('produces one empty line for empty input rather than none', () => {
    // The renderer loops over lines; zero lines would collapse the block to
    // nothing and take the gutter with it.
    const lines = tokenize('', 'typescript');
    expect(lines.length).toBe(1);
    expect(lines[0].no).toBe(1);
    expect(lines[0].tokens).toEqual([]);
  });

  it('drops the phantom line a trailing newline would otherwise create', () => {
    // ★ The false side of this is already covered by sources without a trailing
    // newline; this is the side that trims.
    const lines = tokenize('const a = 1;\n', 'typescript');
    expect(lines.length).toBe(1);
    expect(lines[0].tokens.map((t) => t.text).join('')).toBe('const a = 1;');
  });

  it('keeps a blank line in the MIDDLE of a file', () => {
    // The trailing-newline trim must not eat a deliberate blank separator.
    const lines = tokenize('a\n\nb', 'plaintext');
    expect(lines.length).toBe(3);
    expect(lines[1].tokens).toEqual([]);
  });

  it('keeps only one blank line for a file that is a single newline', () => {
    const lines = tokenize('\n', 'plaintext');
    expect(lines.length).toBe(1);
    expect(lines[0].tokens).toEqual([]);
  });

  it('numbers lines consecutively from 1 however they were split', () => {
    const lines = tokenize('/* a\nb */\nconst c = 1;\n', 'typescript');
    expect(lines.map((l) => l.no)).toEqual([1, 2, 3]);
  });

  it('degrades to plain text for a language it does not know', () => {
    // ★ Unreachable through the typed API, but `language` is a component input
    // and a plain-JS host can bind anything. Falling through to an empty rule
    // list must yield readable monospace text, not a crash.
    const lines = tokenize('SELECT 1;', 'cobol' as CodeLanguage);
    expect(lines.length).toBe(1);
    expect(lines[0].tokens.map((t) => t.kind)).toEqual(['plain']);
    expect(lines[0].tokens[0].text).toBe('SELECT 1;');
  });

  it('round-trips text containing characters no rule matches', () => {
    // The `pending` accumulator is the only thing between an unmatched glyph
    // and it disappearing from the render.
    const src = 'const emoji = "✅ ok"; ¤¤¤';
    const flat = tokenize(src, 'typescript')
      .flatMap((l) => l.tokens.map((t) => t.text))
      .join('');
    expect(flat).toBe(src);
  });
});
