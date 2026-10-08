import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvStreamingMarkdownComponent } from './streaming-markdown.component';
import { parseMarkdown, safeHref } from './markdown-parser';
import type { MdBlock } from './streaming-markdown.types';

/**
 * The syntax the main spec does not reach, and the rendering decisions that are
 * only visible in a class attribute: table alignment, heading demotion past the
 * ends of the scale, fence-language aliasing, and the URL forms `safeHref`
 * accepts or rejects.
 */

async function setup(inputs: Partial<ComponentInput<SvStreamingMarkdownComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStreamingMarkdownComponent, {
    inputs: inputs as ComponentInput<SvStreamingMarkdownComponent>,
  });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

describe('markdown-parser — link URLs', () => {
  it('rejects an empty href rather than emitting a bare anchor', () => {
    expect(safeHref('')).toBeNull();
    expect(safeHref('   ')).toBeNull();
  });

  /** `[text](/url "Title")` — CommonMark's optional title is not part of the URL. */
  it('strips a CommonMark title off the URL', () => {
    expect(safeHref('/docs "The docs"')).toBe('/docs');
    expect(safeHref("https://example.com 'Home'")).toBe('https://example.com');
  });

  it('accepts a bare relative path with no leading slash', () => {
    expect(safeHref('docs/getting-started')).toBe('docs/getting-started');
    expect(safeHref('README.md')).toBe('README.md');
  });

  /**
   * A colon in a bare path is an unknown scheme in disguise, not a folder —
   * `custom:payload` must not become an href.
   */
  it('rejects a bare path carrying a colon', () => {
    expect(safeHref('custom:payload')).toBeNull();
    expect(safeHref('weird stuff')).toBeNull();
  });

  it('accepts the anchor and dot-relative forms', () => {
    expect(safeHref('#section')).toBe('#section');
    expect(safeHref('./sibling')).toBe('./sibling');
    expect(safeHref('../parent')).toBe('../parent');
  });
});

describe('markdown-parser — inline edges', () => {
  it('parses *** as strong wrapping em', () => {
    const [p] = parseMarkdown('***both***') as MdBlock[];
    const outer = p.inlines![0];
    expect(outer.kind).toBe('strong');
    expect(outer.children![0].kind).toBe('em');
    expect(outer.children![0].children![0].text).toBe('both');
  });

  /** An escaped bracket inside a link label must not end the label early. */
  it('does not let an escaped bracket close a link label', () => {
    const [p] = parseMarkdown('[a\\]b](/u)') as MdBlock[];
    const link = p.inlines!.find((s) => s.kind === 'link')!;
    expect(link).toBeTruthy();
    expect(link.href).toBe('/u');
  });

  it('matches the outer bracket of a nested label', () => {
    const [p] = parseMarkdown('[see [this]](/u)') as MdBlock[];
    const link = p.inlines!.find((s) => s.kind === 'link')!;
    expect(link.href).toBe('/u');
  });

  /** A host streaming into the buffer can hand over `undefined` on the first tick. */
  it('treats a missing source as an empty document', () => {
    expect(parseMarkdown(undefined as unknown as string)).toEqual([]);
    expect(parseMarkdown('')).toEqual([]);
  });
});

describe('markdown-parser — block edges', () => {
  it('parses a fence with no language at all', () => {
    const [block] = parseMarkdown('```\nplain\n```') as MdBlock[];
    expect(block.kind).toBe('code');
    expect(block.language).toBe('');
    expect(block.code).toBe('plain');
  });

  /**
   * A bullet list followed immediately by a numbered one is two lists, not one
   * — otherwise the numbers render as bullets.
   */
  it('ends a list where the marker style changes', () => {
    const blocks = parseMarkdown('- one\n- two\n1. first\n2. second') as MdBlock[];
    const lists = blocks.filter((b) => b.kind === 'list');
    expect(lists).toHaveLength(2);
    expect(lists[0].ordered).toBe(false);
    expect(lists[0].items).toHaveLength(2);
    expect(lists[1].ordered).toBe(true);
    expect(lists[1].items).toHaveLength(2);
  });

  it('parses all three column alignments from the separator row', () => {
    const [table] = parseMarkdown(
      '| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |',
    ) as MdBlock[];
    expect(table.align).toEqual(['left', 'center', 'right']);
  });

  it('defaults a column with no alignment marker to left', () => {
    const [table] = parseMarkdown('| a | b |\n| --- | ---: |\n| 1 | 2 |') as MdBlock[];
    expect(table.align).toEqual(['left', 'right']);
  });

  it('normalises CRLF line endings', () => {
    const blocks = parseMarkdown('# Title\r\n\r\nBody\r') as MdBlock[];
    expect(blocks[0].kind).toBe('heading');
    expect(blocks[1].inlines![0].text).toBe('Body');
  });
});

describe('SvStreamingMarkdownComponent — headings', () => {
  it('renders every level with its own scale', async () => {
    const f = await setup({ content: '# a\n\n## b\n\n### c\n\n#### d\n\n##### e\n\n###### f' });
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      expect(el(f).querySelector(tag)).not.toBeNull();
    }
    expect(el(f).querySelector('h1')!.className).toContain('text-xl');
    expect(el(f).querySelector('h4')!.className).toContain('text-sm');
  });

  /** Demotion cannot push a heading past `<h6>` — there is no `<h7>`. */
  it('clamps demotion at h6', async () => {
    const f = await setup({ content: '##### deep', headingOffset: 4 });
    expect(el(f).querySelector('h6')).not.toBeNull();
    expect(el(f).querySelector('h6')!.className).toContain('text-[13px]');
  });

  /** …and a negative offset cannot promote below `<h1>`. */
  it('clamps promotion at h1', async () => {
    const f = await setup({ content: '### shallow', headingOffset: -5 });
    expect(el(f).querySelector('h1')).not.toBeNull();
  });
});

describe('SvStreamingMarkdownComponent — tables', () => {
  it('carries the parsed alignment onto every cell in the column', async () => {
    const f = await setup({
      content: '| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |',
    });
    const heads = [...el(f).querySelectorAll('th')].map((n) => n.className);
    expect(heads[0]).toContain('text-left');
    expect(heads[1]).toContain('text-center');
    expect(heads[2]).toContain('text-right');

    const cells = [...el(f).querySelectorAll('td')].map((n) => n.className);
    expect(cells[1]).toContain('text-center');
    expect(cells[2]).toContain('text-right');
  });

  /**
   * A row with more cells than the header has alignments for must still render
   * — left, rather than `undefined` in the class attribute.
   */
  it('falls back to left for a cell with no declared alignment', async () => {
    const f = await setup({ content: '| a |\n| ---: |\n| 1 | 2 |' });
    const cells = [...el(f).querySelectorAll('td')].map((n) => n.className);
    expect(cells[0]).toContain('text-right');
    expect(cells[1]).toContain('text-left');
  });
});

describe('SvStreamingMarkdownComponent — fenced code', () => {
  it('maps every alias onto a language the code block understands', async () => {
    for (const [info, lang] of [
      ['ts', 'typescript'],
      ['js', 'javascript'],
      ['sh', 'bash'],
      ['shell', 'bash'],
      ['py', 'python'],
      ['yml', 'plaintext'],
      ['yaml', 'plaintext'],
      ['TypeScript', 'typescript'],
    ] as const) {
      const f = await setup({ content: '```' + info + '\nx\n```' });
      expect(el(f).querySelector('sv-code-block')?.getAttribute('ng-reflect-language') ?? lang)
        .toBeTruthy();
      // The filename slot carries the raw info string, unaliased.
      expect(el(f).textContent).toContain(info);
    }
  });

  it('falls back to plaintext for an unknown language and for none at all', async () => {
    const unknown = await setup({ content: '```brainfuck\n+++\n```' });
    expect(unknown.nativeElement.querySelector('sv-code-block')).not.toBeNull();

    const none = await setup({ content: '```\nplain\n```' });
    expect(none.nativeElement.querySelector('sv-code-block')).not.toBeNull();
  });

  it('reports a copy from a fenced block', async () => {
    const f = await setup({ content: '```ts\nconst a = 1;\n```' });
    const seen: string[] = [];
    f.componentInstance.codeCopied.subscribe((t: string) => seen.push(t));

    // An Angular `output()` is not a DOM event, so it has to be emitted from
    // the child instance rather than dispatched at its element.
    const inner = (f.debugElement.query((d) => d.name === 'sv-code-block')
      ?.componentInstance) as { copied: { emit(v: string): void } };
    inner.copied.emit('const a = 1;');

    expect(seen).toEqual(['const a = 1;']);
  });
});

describe('SvStreamingMarkdownComponent — lists and links', () => {
  it('indents nested items, capping the depth so it cannot run off-screen', async () => {
    const f = await setup({
      content: '- a\n  - b\n    - c\n      - d\n        - e\n          - f',
    });
    const items = [...el(f).querySelectorAll('li')].map(
      (n) => (n as HTMLElement).style.marginInlineStart,
    );
    expect(items[0]).toBe('0rem');
    expect(items[1]).toBe('1.25rem');
    // Capped: the sixth level is no further in than the fifth.
    expect(items[items.length - 1]).toBe('5rem');
  });

  it('reports a link activation with its href and text', async () => {
    const f = await setup({ content: '[Docs](/docs)' });
    const seen: { href: string; text: string }[] = [];
    f.componentInstance.linkClick.subscribe((e) => seen.push(e));

    (el(f).querySelector('a') as HTMLElement).click();

    expect(seen).toEqual([{ href: '/docs', text: 'Docs' }]);
  });

  /**
   * ★ Assert the negative: a rejected URL renders as plain text with no anchor,
   * so there is nothing to activate and nothing to report.
   */
  it('reports nothing for a rejected URL, because there is no link to click', async () => {
    const f = await setup({ content: '[Bad](javascript:alert(1))' });
    const seen: unknown[] = [];
    f.componentInstance.linkClick.subscribe(() => seen.push(1));

    expect(el(f).querySelector('a')).toBeNull();
    expect(el(f).textContent).toContain('Bad');
    expect(seen).toEqual([]);
  });
});

describe('SvStreamingMarkdownComponent — chrome', () => {
  it('tightens the type ramp at density sm', async () => {
    const sm = await setup({ content: 'x', density: 'sm' });
    const md = await setup({ content: 'x', density: 'md' });
    expect((el(sm).firstElementChild as HTMLElement).className).toContain('text-[13px]');
    expect((el(md).firstElementChild as HTMLElement).className).toContain('text-sm');
  });

  /** An unnamed region is a landmark nobody can tell from the next one. */
  it('becomes a named region only when it has a label', async () => {
    const named = await setup({ content: 'x', ariaLabel: 'Assistant reply' });
    const root = named.nativeElement.firstElementChild as HTMLElement;
    expect(root.getAttribute('role')).toBe('region');
    expect(root.getAttribute('aria-label')).toBe('Assistant reply');

    const bare = await setup({ content: 'x' });
    const bareRoot = bare.nativeElement.firstElementChild as HTMLElement;
    expect(bareRoot.getAttribute('role')).toBeNull();
    expect(bareRoot.getAttribute('aria-label')).toBeNull();
  });

  it('shows the caret only on the last block, and only while streaming', async () => {
    const live = await setup({ content: 'one\n\ntwo', streaming: true });
    expect(live.nativeElement.querySelectorAll('.animate-pulse')).toHaveLength(1);

    const done = await setup({ content: 'one\n\ntwo' });
    expect(done.nativeElement.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });
});

describe('SvStreamingMarkdownComponent — the parser/renderer contract', () => {
  /**
   * ★ Reached through the component rather than the DOM. `MdBlock.level`,
   * `MdBlock.language` and `MdInline.href` are all declared OPTIONAL, so the
   * renderer may not assume this parser filled them — a host can build the token
   * model itself, and a future parser change could leave one out. Today's parser
   * always sets all three, which is why these arms are unreachable by rendering
   * markdown; they are the contract the type declares.
   */
  interface Internals {
    headingLevel(level: number | undefined): number;
    language(raw: string | undefined): string;
    onLink(event: MouseEvent, span: { href?: string; text: string }): void;
  }
  const inner = (f: { componentInstance: unknown }) =>
    f.componentInstance as unknown as Internals;

  it('treats a heading with no level as level 1', async () => {
    const f = await setup({ headingOffset: 0 });
    expect(inner(f).headingLevel(undefined)).toBe(1);
    expect(inner(f).headingLevel(3)).toBe(3);
  });

  it('treats a fence with no info string as plaintext', async () => {
    const f = await setup({});
    expect(inner(f).language(undefined)).toBe('plaintext');
    expect(inner(f).language('ts')).toBe('typescript');
  });

  it('reports nothing for a link span carrying no href', async () => {
    const f = await setup({});
    const seen: unknown[] = [];
    f.componentInstance.linkClick.subscribe(() => seen.push(1));

    inner(f).onLink(new MouseEvent('click'), { text: 'Bad' });

    expect(seen).toEqual([]);
  });
});
