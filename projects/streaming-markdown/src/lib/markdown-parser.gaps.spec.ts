import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvStreamingMarkdownComponent } from './streaming-markdown.component';
import { parseInline, parseMarkdown, safeImageSrc } from './markdown-parser';
import type { MdBlock, MdInline } from './streaming-markdown.types';

/**
 * Five gaps in the parser, every one of them found by round-tripping a rich text
 * document through Markdown and back rather than by reading the code. All five
 * were wrong RENDERS rather than exotic edge cases, and four show up in ordinary
 * technical prose:
 *
 * 1. `![a](b)` rendered as a stray bang followed by a link.
 * 2. A table cell containing `|` split into two cells and shifted every column
 *    after it.
 * 3. `snake_case_name` rendered with an italic run through the middle.
 * 4. A code span written with two backticks so it could contain one closed at the
 *    backtick it was written to contain.
 * 5. A four-backtick fence around a Markdown snippet closed at the snippet's own
 *    inner fence and spilled the rest of the document out as prose.
 */

async function setup(inputs: Partial<ComponentInput<SvStreamingMarkdownComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStreamingMarkdownComponent, {
    inputs: inputs as ComponentInput<SvStreamingMarkdownComponent>,
  });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const inlinesOf = (b: MdBlock): readonly MdInline[] => b.inlines ?? [];

// ── Parsing ─────────────────────────────────────────────────────────────────

describe('parseInline — images', () => {
  it('reads alt text and src out of ![alt](src)', () => {
    const spans = parseInline('![Revenue chart](/img/rev.png)');
    expect(spans).toEqual([{ kind: 'image', text: 'Revenue chart', href: '/img/rev.png' }]);
  });

  /**
   * ★★★ THE REGRESSION THIS EXISTS FOR. Before the `!` branch, `[` matched
   * first and the bang fell through to the literal-text accumulator, so the
   * reader saw `!` and a clickable path where an image belonged. Asserting only
   * "there is one span" would pass under that bug too — the assertion has to be
   * that the FIRST span is the image and that no text span precedes it.
   */
  it('does not leave the bang behind as a text span', () => {
    const spans = parseInline('![a](/a.png)');
    expect(spans.length).toBe(1);
    expect(spans[0].kind).toBe('image');
  });

  it('keeps surrounding prose either side of an image', () => {
    const spans = parseInline('see ![a](/a.png) here');
    expect(spans.map((s) => s.kind)).toEqual(['text', 'image', 'text']);
    expect(spans[0].text).toBe('see ');
    expect(spans[2].text).toBe(' here');
  });

  /**
   * ★★ ALT TEXT IS NOT PARSED, and that is a decision rather than an omission.
   * The alt lands in an attribute, and an attribute cannot hold a `<strong>`.
   * Carrying `children` here would make a renderer that recursed emit the words
   * twice — once in the attribute and once as visible text beside the image.
   */
  it('carries alt text verbatim, with no child spans', () => {
    const [img] = parseInline('![a **bold** alt](/a.png)');
    expect(img.text).toBe('a **bold** alt');
    expect(img.children).toBeUndefined();
  });

  it('degrades a rejected src to the alt text rather than a broken image', () => {
    const spans = parseInline('![the map](javascript:alert(1))');
    expect(spans[0].kind).toBe('text');
    expect(spans[0].text).toBe('the map');
  });

  it('leaves a bang that is not followed by a bracket alone', () => {
    expect(parseInline('wow!')).toEqual([{ kind: 'text', text: 'wow!' }]);
    expect(parseInline('!not an image')).toEqual([{ kind: 'text', text: '!not an image' }]);
  });

  /**
   * A half-typed image is the streaming case: the closing paren has not arrived
   * yet. It must render as the literal characters received so far, not blank the
   * paragraph and not swallow the rest of the buffer.
   */
  it('treats an unterminated image as literal text', () => {
    expect(parseInline('![alt](/a.pn')).toEqual([{ kind: 'text', text: '![alt](/a.pn' }]);
    expect(parseInline('![alt')).toEqual([{ kind: 'text', text: '![alt' }]);
  });

  it('parses an image nested inside a link', () => {
    const [link] = parseInline('[![logo](/logo.png)](https://example.com)');
    expect(link.kind).toBe('link');
    expect(link.href).toBe('https://example.com');
    expect(link.children?.[0]).toEqual({ kind: 'image', text: 'logo', href: '/logo.png' });
  });

  it('parses an image inside emphasis', () => {
    const [strong] = parseInline('**![a](/a.png)**');
    expect(strong.kind).toBe('strong');
    expect(strong.children?.[0].kind).toBe('image');
  });

  /**
   * ★★ AN ESCAPED BANG DEMOTES THE IMAGE TO A LINK — it does not make the whole
   * construct literal, and I initially expected it to. `\!` is an escape for one
   * character; the `[a](/a.png)` after it is still perfectly good link syntax and
   * CommonMark parses it as one. So the result is a literal `!` followed by a
   * real anchor, which is what an author writing `\!` is asking for: show me the
   * bang, keep the link.
   */
  it('demotes an image to a link when the bang is escaped', () => {
    const spans = parseInline('\\![a](/a.png)');
    expect(spans.map((s) => s.kind)).toEqual(['text', 'link']);
    expect(spans[0].text).toBe('!');
    expect(spans[1].href).toBe('/a.png');
  });
});

// ── src safety ──────────────────────────────────────────────────────────────

describe('safeImageSrc', () => {
  it('accepts the ordinary web and relative forms', () => {
    expect(safeImageSrc('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(safeImageSrc('/img/a.png')).toBe('/img/a.png');
    expect(safeImageSrc('./a.png')).toBe('./a.png');
    expect(safeImageSrc('img/a.png')).toBe('img/a.png');
  });

  /**
   * ★★★ `data:image/*` IS ACCEPTED HERE AND REJECTED BY `safeHref`, ON PURPOSE.
   * An `href` is navigated to; an `<img src>` is fetched and handed to the image
   * decoder. See the comment on DATA_IMAGE for why `svg+xml` is included: an SVG
   * loaded through `<img>` runs in the spec's secure static mode, with scripting
   * and external references disabled.
   */
  it('accepts data: URLs that name an image media type', () => {
    expect(safeImageSrc('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(safeImageSrc('data:image/svg+xml,%3Csvg%2F%3E')).toBe('data:image/svg+xml,%3Csvg%2F%3E');
  });

  it('rejects a data: URL that is not an image', () => {
    expect(safeImageSrc('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(safeImageSrc('data:,hello')).toBeNull();
    // `data:image` with no separator is not a media type, it is a prefix match.
    expect(safeImageSrc('data:imagex/png;base64,AA==')).toBeNull();
  });

  it('rejects the schemes that cannot produce an image at all', () => {
    // These are valid hrefs — a link to them is fine — but nothing fetches.
    expect(safeImageSrc('mailto:a@example.com')).toBeNull();
    expect(safeImageSrc('tel:+15551234')).toBeNull();
  });

  it('rejects the executable schemes', () => {
    expect(safeImageSrc('javascript:alert(1)')).toBeNull();
    expect(safeImageSrc('vbscript:msgbox')).toBeNull();
    expect(safeImageSrc('')).toBeNull();
  });
});

// ── Table pipes ─────────────────────────────────────────────────────────────

describe('parseMarkdown — pipes inside table cells', () => {
  /**
   * ★★★ THE COLUMN COUNT IS THE ASSERTION THAT CATCHES THIS. Under the old
   * `split('|')` the escaped pipe produced a third cell, so the row had one more
   * column than the header and every value after it was displayed under the
   * wrong heading — silently, with no parse error anywhere.
   */
  it('keeps an escaped pipe inside its cell', () => {
    const [table] = parseMarkdown('| a | b |\n| --- | --- |\n| x \\| y | z |');
    expect(table.rows?.[0].length).toBe(2);
    expect(table.rows?.[0][0].map((s) => s.text).join('')).toBe('x | y');
    expect(table.rows?.[0][1].map((s) => s.text).join('')).toBe('z');
  });

  it('still splits on an unescaped pipe', () => {
    const [table] = parseMarkdown('| a | b |\n| --- | --- |\n| x | y |');
    expect(table.rows?.[0].length).toBe(2);
  });

  /**
   * ★★ A ROW ENDING IN AN ESCAPED PIPE. The trailing-delimiter strip must not
   * eat it — `| a \|` has one cell whose last character is a pipe, and treating
   * that pipe as the row terminator drops the character and leaves `a \` behind.
   */
  it('does not mistake a trailing escaped pipe for the row terminator', () => {
    const [table] = parseMarkdown('| a |\n| --- |\n| x \\|');
    expect(table.rows?.[0].length).toBe(1);
    expect(table.rows?.[0][0].map((s) => s.text).join('')).toBe('x |');
  });

  /** A literal backslash before a real separator: `\\` then `|` is a split. */
  it('treats a doubled backslash as a literal, leaving the next pipe active', () => {
    const [table] = parseMarkdown('| a | b |\n| --- | --- |\n| x \\\\ | y |');
    expect(table.rows?.[0].length).toBe(2);
    expect(table.rows?.[0][0].map((s) => s.text).join('')).toBe('x \\');
  });

  /**
   * ★★★ BACKSLASH PARITY, WHICH NOTHING ELSE IN THIS FILE REACHES. A row ending
   * in `\\|` — a literal backslash as the cell's last character, then the row's
   * own terminator — is the only shape that asks whether the pipe is escaped.
   * Every other fixture has a non-backslash character before the final pipe, so
   * counting "any backslash" instead of "an odd number" passed all of them: the
   * terminator was read as escaped, left in place, and split into a phantom
   * second cell.
   */
  it('counts backslashes in pairs when deciding if the terminator is escaped', () => {
    const [table] = parseMarkdown('| a |\n| --- |\n| x \\\\|');
    expect(table.rows?.[0].length).toBe(1);
    expect(table.rows?.[0][0].map((s) => s.text).join('')).toBe('x \\');
  });

  it('reads alignment through the same splitter', () => {
    const [table] = parseMarkdown('| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |');
    expect(table.align).toEqual(['left', 'center', 'right']);
  });
});

// ── Rendering ───────────────────────────────────────────────────────────────

describe('SvStreamingMarkdownComponent — images', () => {
  it('renders an img with the parsed src and alt', async () => {
    const f = await setup({ content: '![Revenue](/img/rev.png)' });
    const img = el(f).querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/img/rev.png');
    expect(img.getAttribute('alt')).toBe('Revenue');
  });

  /**
   * ★★ AN EMPTY ALT IS NOT A MISSING ALT. `alt=""` tells a screen reader the
   * image is decorative and to skip it; omitting the attribute makes some
   * readers announce the file name instead, which is worse than silence.
   */
  it('emits alt="" for an image with no alt text', async () => {
    const f = await setup({ content: '![](/img/spacer.png)' });
    const img = el(f).querySelector('img')!;
    expect(img.hasAttribute('alt')).toBe(true);
    expect(img.getAttribute('alt')).toBe('');
  });

  it('renders no img at all when the src was rejected', async () => {
    const f = await setup({ content: '![the map](javascript:alert(1))' });
    expect(el(f).querySelector('img')).toBeNull();
    expect(el(f).textContent).toContain('the map');
  });

  it('renders an image inside a list item and a table cell', async () => {
    const f = await setup({
      content: '- ![a](/a.png)\n\n| h |\n| --- |\n| ![b](/b.png) |',
    });
    const srcs = Array.from(el(f).querySelectorAll('img')).map((i) => i.getAttribute('src'));
    expect(srcs).toEqual(['/a.png', '/b.png']);
  });

  it('leaves the paragraph text intact around an image', async () => {
    const f = await setup({ content: 'before ![a](/a.png) after' });
    const p = el(f).querySelector('p')!;
    expect(p.textContent).toBe('before  after');
    expect(p.querySelector('img')).not.toBeNull();
  });

  /** Blocks still parse as blocks when an image is the whole paragraph. */
  it('puts a lone image in a paragraph block, not a new block kind', async () => {
    const blocks = parseMarkdown('![a](/a.png)');
    expect(blocks.length).toBe(1);
    expect(blocks[0].kind).toBe('paragraph');
    expect(inlinesOf(blocks[0])[0].kind).toBe('image');
  });
});

// ── Underscores inside words ────────────────────────────────────────────────

describe('parseInline — underscore flanking', () => {
  /**
   * ★★★ THE ONE THAT MATTERS MOST IN PRACTICE. Technical prose is full of
   * `snake_case`, `__init__` and `my_var_name`, and a parser without CommonMark's
   * flanking rule renders each of them with an italic run through the middle.
   * Asserting "there is no em span" is the whole test — asserting on the
   * concatenated text would pass under the bug, because the text is unchanged
   * and only the markup is wrong.
   */
  it('does not italicise an underscore inside a word', () => {
    expect(parseInline('snake_case_name')).toEqual([{ kind: 'text', text: 'snake_case_name' }]);
    expect(parseInline('my_var_name and other_thing').every((s) => s.kind === 'text')).toBe(true);
  });

  /**
   * ★★ `__init__` REALLY IS BOLD, and I wrote a test asserting it was not before
   * checking. Both markers are flanked by spaces, so the flanking rule does not
   * apply and CommonMark makes it strong emphasis — which is exactly why every
   * style guide tells Python authors to write it as `` `__init__` ``. The rule
   * this parser now implements is about underscores INSIDE a word, not about
   * identifiers that happen to end in one.
   */
  it('still reads __init__ as strong, because CommonMark does', () => {
    const spans = parseInline('call __init__ first');
    expect(spans.map((s) => s.kind)).toEqual(['text', 'strong', 'text']);
    expect(spans[1].children?.[0].text).toBe('init');
  });

  it('still italicises an underscore that stands alone', () => {
    const spans = parseInline('an _emphasis_ here');
    expect(spans.map((s) => s.kind)).toEqual(['text', 'em', 'text']);
    expect(spans[1].children?.[0].text).toBe('emphasis');
  });

  it('still reads __strong__ at a word boundary', () => {
    const [span] = parseInline('__loud__');
    expect(span.kind).toBe('strong');
    expect(span.children?.[0].text).toBe('loud');
  });

  /**
   * ★★ THE CLOSER IS SKIPPED TOO, NOT JUST THE OPENER. `_b_ c_d_e` has a valid
   * opening `_`, and the first `_` after it that `indexOf` finds is the one
   * inside `c_d`. Pairing with that one italicises across the whole phrase and
   * leaves the real closer as literal text. Only checking the opener passes the
   * first two tests in this block and fails this one.
   */
  it('skips an intra-word underscore when looking for the closer', () => {
    const spans = parseInline('_b_ c_d_e');
    expect(spans[0].kind).toBe('em');
    expect(spans[0].children?.[0].text).toBe('b');
    expect(spans.slice(1).map((s) => s.text).join('')).toBe(' c_d_e');
  });

  /**
   * ★★★ THE FIXTURE ABOVE NEVER REACHES THE CLOSER'S GUARD, and I only found
   * that by mutating: in `_b_ c_d_e` the FIRST underscore after the opener is
   * already a valid closer, so the intra-word skip is never asked a question.
   * Applying the flanking rule to the opener alone passed it. Here the first
   * candidate closer is inside `c_d` and must be stepped over — mutate the skip
   * away and the emphasis stops after `c`, leaving `d text_` as loose text.
   */
  it('steps over an intra-word underscore to reach the real closer', () => {
    const spans = parseInline('_em c_d text_');
    expect(spans.length).toBe(1);
    expect(spans[0].kind).toBe('em');
    expect(spans[0].children?.map((s) => s.text).join('')).toBe('em c_d text');
  });

  /** `*` needs no exception — nobody writes an asterisk inside a word. */
  it('leaves the asterisk rules alone', () => {
    const [span] = parseInline('a*b*c');
    expect(span.kind).toBe('text');
    expect(parseInline('a*b*c')[1].kind).toBe('em');
  });
});

// ── Backtick runs ───────────────────────────────────────────────────────────

describe('parseInline — code span fences', () => {
  /**
   * ★★★ A RUN OF N CLOSES ONLY ON A RUN OF N. Under `indexOf('`')` the span
   * below closed at its own content: the result was an empty `<code>` followed by
   * `a`, then a second code span, then a loose backtick — four wrong spans where
   * there should be one.
   */
  it('lets a two-backtick span contain a backtick', () => {
    expect(parseInline('``a`b``')).toEqual([{ kind: 'code', text: 'a`b' }]);
  });

  it('reads an ordinary single-backtick span', () => {
    expect(parseInline('`code`')).toEqual([{ kind: 'code', text: 'code' }]);
  });

  /** CommonMark strips one space from each end so `` ` `` is a lone backtick. */
  it('strips one padding space from each end', () => {
    expect(parseInline('`` ` ``')).toEqual([{ kind: 'code', text: '`' }]);
    // Only one, and only when both are present.
    expect(parseInline('``  a  ``')).toEqual([{ kind: 'code', text: ' a ' }]);
    expect(parseInline('`` a``')).toEqual([{ kind: 'code', text: ' a' }]);
  });

  it('does not strip a span that is nothing but spaces', () => {
    expect(parseInline('`  `')).toEqual([{ kind: 'code', text: '  ' }]);
  });

  /**
   * ★★★ THE WHOLE UNMATCHED RUN IS LITERAL. This is the assertion that caught a
   * bug in my own fix: advancing one character at a time left the second backtick
   * of an unmatched ``` `` ``` in the input, so the next pass opened a
   * single-backtick span from the middle of the marker and closed it on the
   * trailing one — `` ``a` `` came out as a literal backtick plus a code span
   * holding `a`, which is markup the author never wrote.
   */
  it('treats an unmatched run as literal text, all of it', () => {
    expect(parseInline('``a`')).toEqual([{ kind: 'text', text: '``a`' }]);
    expect(parseInline('```x')).toEqual([{ kind: 'text', text: '```x' }]);
  });

  /** A longer run inside is content, not a closer. */
  it('does not close on a longer run', () => {
    expect(parseInline('`a``b`')).toEqual([{ kind: 'code', text: 'a``b' }]);
  });

  it('keeps markup literal inside a code span', () => {
    expect(parseInline('`**not bold**`')).toEqual([{ kind: 'code', text: '**not bold**' }]);
  });
});

// ── Fence length ────────────────────────────────────────────────────────────

describe('parseMarkdown — fence length', () => {
  /**
   * ★★★ A FOUR-BACKTICK FENCE MUST SURVIVE ITS OWN CONTENTS. Truncating the
   * marker to three closed the block at the snippet's inner fence, so the rest of
   * the document rendered as prose — the failure was two blocks downstream of the
   * line that caused it, which is why it went unnoticed.
   */
  it('does not close a four-backtick fence on an inner three', () => {
    const blocks = parseMarkdown('````\n```\nnested\n```\n````');
    expect(blocks.length).toBe(1);
    expect(blocks[0].kind).toBe('code');
    expect(blocks[0].code).toBe('```\nnested\n```');
    expect(blocks[0].complete).toBe(true);
  });

  it('closes a three-backtick fence on a longer one', () => {
    const blocks = parseMarkdown('```\nbody\n````');
    expect(blocks.length).toBe(1);
    expect(blocks[0].code).toBe('body');
    expect(blocks[0].complete).toBe(true);
  });

  it('still reads a plain fence with a language', () => {
    const [block] = parseMarkdown('```ts\nconst a = 1;\n```');
    expect(block.language).toBe('ts');
    expect(block.code).toBe('const a = 1;');
  });

  it('still reports an unterminated fence as incomplete', () => {
    const [block] = parseMarkdown('````\nstill typing');
    expect(block.kind).toBe('code');
    expect(block.complete).toBe(false);
    expect(block.code).toBe('still typing');
  });

  it('applies the same rule to tildes', () => {
    const blocks = parseMarkdown('~~~~\n~~~\ninner\n~~~\n~~~~');
    expect(blocks.length).toBe(1);
    expect(blocks[0].code).toBe('~~~\ninner\n~~~');
  });
});

// ── Parentheses in URLs ─────────────────────────────────────────────────────

describe('parseInline — parentheses inside a URL', () => {
  /**
   * ★★★ EVERY WIKIPEDIA DISAMBIGUATION LINK HITS THIS. `indexOf(')')` truncated
   * the URL at the first inner paren, and the truncated string then failed
   * `safeHref`'s path check — so the link silently became plain text and a stray
   * `)` was left sitting in the prose. Two visible failures from one missing
   * depth counter.
   */
  it('keeps a URL that contains a balanced pair', () => {
    const [link] = parseInline('[Mercury](https://en.wikipedia.org/wiki/Mercury_(planet))');
    expect(link.kind).toBe('link');
    expect(link.href).toBe('https://en.wikipedia.org/wiki/Mercury_(planet)');
  });

  it('leaves no stray paren behind in the text', () => {
    const spans = parseInline('see [x](https://a.dev/f(1)) here');
    expect(spans.map((s) => s.kind)).toEqual(['text', 'link', 'text']);
    expect(spans[2].text).toBe(' here');
  });

  it('applies the same rule to an image source', () => {
    const [img] = parseInline('![d](/img/chart_(2024).png)');
    expect(img.kind).toBe('image');
    expect(img.href).toBe('/img/chart_(2024).png');
  });

  /**
   * ★★ THE SAFETY SIDE OF THE SAME BUG. `(javascript:alert(1))` truncated to
   * `javascript:alert(1` — still rejected, but the trailing `)` escaped into the
   * visible text, which is how you notice a parser is guessing.
   */
  it('rejects the whole address rather than a truncated one', () => {
    expect(parseInline('[label](javascript:alert(1))')).toEqual([{ kind: 'text', text: 'label' }]);
  });

  it('treats an unbalanced open paren as unterminated, not as a link', () => {
    const spans = parseInline('[x](https://a.dev/(1');
    expect(spans.every((s) => s.kind === 'text')).toBe(true);
  });

  it('still reads an ordinary URL with no parens', () => {
    const [link] = parseInline('[x](https://a.dev/p)');
    expect(link.href).toBe('https://a.dev/p');
  });
});
