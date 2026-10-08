import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvStreamingMarkdownComponent } from './streaming-markdown.component';
import { parseInline, parseMarkdown, safeHref } from './markdown-parser';

describe('markdown-parser — blocks', () => {
  it('parses headings with their level', () => {
    const [b] = parseMarkdown('### Hello');
    expect(b.kind).toBe('heading');
    expect(b.level).toBe(3);
  });

  it('joins wrapped lines into one paragraph', () => {
    const blocks = parseMarkdown('one\ntwo\n\nthree');
    expect(blocks.length).toBe(2);
    expect(blocks[0].kind).toBe('paragraph');
  });

  it('parses fenced code with its language', () => {
    const [b] = parseMarkdown('```ts\nconst a = 1;\n```');
    expect(b.kind).toBe('code');
    expect(b.language).toBe('ts');
    expect(b.code).toBe('const a = 1;');
    expect(b.complete).toBe(true);
  });

  it('marks an unterminated fence incomplete instead of swallowing the rest', () => {
    const [b] = parseMarkdown('```ts\nconst a = 1;');
    expect(b.kind).toBe('code');
    expect(b.complete).toBe(false);
    expect(b.code).toBe('const a = 1;');
  });

  it('parses ordered and unordered lists, tasks and depth', () => {
    const [ul] = parseMarkdown('- one\n- [x] done\n  - nested');
    expect(ul.kind).toBe('list');
    expect(ul.ordered).toBe(false);
    expect(ul.items?.length).toBe(3);
    expect(ul.items?.[1].checked).toBe(true);
    expect(ul.items?.[2].depth).toBe(1);

    const [ol] = parseMarkdown('1. first\n2. second');
    expect(ol.ordered).toBe(true);
    expect(ol.start).toBe(1);
  });

  it('parses tables with alignment', () => {
    const [t] = parseMarkdown('| a | b |\n| :-- | --: |\n| 1 | 2 |');
    expect(t.kind).toBe('table');
    expect(t.head?.length).toBe(2);
    expect(t.rows?.length).toBe(1);
    expect(t.align).toEqual(['left', 'right']);
  });

  it('parses blockquotes and thematic breaks', () => {
    expect(parseMarkdown('> quoted')[0].kind).toBe('quote');
    expect(parseMarkdown('---')[0].kind).toBe('hr');
  });
});

describe('markdown-parser — inline', () => {
  it('parses strong, em, code and strike', () => {
    const kinds = parseInline('**b** *i* `c` ~~s~~').map((s) => s.kind);
    expect(kinds).toContain('strong');
    expect(kinds).toContain('em');
    expect(kinds).toContain('code');
    expect(kinds).toContain('strike');
  });

  it('nests spans arbitrarily', () => {
    const [strong] = parseInline('**bold with `code`**');
    expect(strong.kind).toBe('strong');
    expect(strong.children?.some((c) => c.kind === 'code')).toBe(true);
  });

  it('degrades an unterminated delimiter to literal text (mid-stream)', () => {
    const spans = parseInline('**bo');
    expect(spans.every((s) => s.kind === 'text')).toBe(true);
    expect(spans.map((s) => s.text).join('')).toBe('**bo');
  });

  it('honours backslash escapes', () => {
    const spans = parseInline('\\*not em\\*');
    expect(spans.every((s) => s.kind === 'text')).toBe(true);
    expect(spans.map((s) => s.text).join('')).toBe('*not em*');
  });
});

describe('markdown-parser — link safety', () => {
  it('accepts http, https, mailto and relative URLs', () => {
    expect(safeHref('https://styloviz.dev')).toBe('https://styloviz.dev');
    expect(safeHref('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(safeHref('/docs')).toBe('/docs');
    expect(safeHref('#anchor')).toBe('#anchor');
  });

  it('rejects javascript:, data: and vbscript: URLs', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html;base64,PHN2Zz4=')).toBeNull();
    expect(safeHref('vbscript:msgbox')).toBeNull();
  });

  it('renders a rejected link as plain text rather than an anchor', () => {
    const [span] = parseInline('[click](javascript:alert(1))');
    expect(span.kind).toBe('text');
    expect(span.href).toBeUndefined();
  });
});

describe('SvStreamingMarkdownComponent', () => {
  function render(content: string, inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(SvStreamingMarkdownComponent);
    fixture.componentRef.setInput('content', content);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture;
  }

  it('renders semantic elements, not an HTML string', () => {
    const el = render('## Title\n\nSome **bold** text.').nativeElement as HTMLElement;
    expect(el.querySelector('h2')).toBeTruthy();
    expect(el.querySelector('strong')?.textContent).toBe('bold');
  });

  it('does not pad inline spans with stray whitespace', () => {
    // A control-flow block written as `@default { {{ text }} }` emits the
    // surrounding spaces as a real text node, rendering "Some  bold  text."
    const el = render('Some **bold** and `code` text.').nativeElement as HTMLElement;
    expect(el.querySelector('p')?.textContent).toBe('Some bold and code text.');
  });

  it('never injects raw HTML from the source', () => {
    const el = render('<img src=x onerror=alert(1)>').nativeElement as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('demotes headings by headingOffset', () => {
    const el = render('# Title', { headingOffset: 2 }).nativeElement as HTMLElement;
    expect(el.querySelector('h3')).toBeTruthy();
    expect(el.querySelector('h1')).toBeNull();
  });

  it('renders a task list with an accessible checkbox marker', () => {
    const el = render('- [x] done\n- [ ] todo').nativeElement as HTMLElement;
    const marks = el.querySelectorAll('[role="img"]');
    expect(marks.length).toBe(2);
    expect(marks[0].getAttribute('aria-label')).toBe('Done');
    expect(marks[1].getAttribute('aria-label')).toBe('Not done');
  });

  it('adds rel="noopener noreferrer" to links', () => {
    const el = render('[docs](https://styloviz.dev)').nativeElement as HTMLElement;
    const a = el.querySelector('a');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a?.getAttribute('href')).toBe('https://styloviz.dev');
  });

  it('stays correct as the buffer grows token by token', () => {
    const full = '# Title\n\n- one\n- two\n\n```ts\nconst a = 1;\n```';
    for (let i = 1; i <= full.length; i += 7) {
      expect(() => parseMarkdown(full.slice(0, i))).not.toThrow();
    }
    const blocks = parseMarkdown(full);
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'list', 'code']);
  });
});

/**
 * What a screen reader is told, and when.
 *
 * ★★★ A LIVE REGION UPDATED PER TOKEN IS UNUSABLE, which is why there is none
 *     over the content. But silence had its own cost: a screen-reader user got
 *     no signal that generation had finished and had to poll the region by hand.
 *     The answer is not a quieter live region, it is a different event —
 *     `aria-busy` while tokens arrive, one announcement when they stop.
 */
describe('SvStreamingMarkdownComponent — announcing a stream, not narrating it', () => {
  async function mount(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const r = await render(SvStreamingMarkdownComponent, { inputs: inputs as never });
    return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
  }

  const status = (host: HTMLElement) =>
    host.querySelector('[role="status"]')?.textContent?.trim() ?? '';
  it('marks the region busy while tokens are arriving', async () => {
    const { host, c } = await mount({ content: '# Hi', streaming: true });
    expect(c.busy()).toBe(true);
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('says nothing at all while streaming', async () => {
    // ★ The whole point: no per-token narration.
    const { host } = await mount({ content: '# Hi', streaming: true });
    expect(status(host)).toBe('');
  });

  it('stays silent through many token updates', async () => {
    const { host, rerender } = await mount({ content: '#', streaming: true });
    for (const text of ['# H', '# He', '# Hel', '# Hell', '# Hello']) {
      await rerender({ inputs: { content: text, streaming: true } as never });
      expect(status(host)).toBe('');
    }
  });

  it('announces once when the stream stops', async () => {
    const { host, fixture, rerender } = await mount({ content: '# Hello', streaming: true });
    expect(status(host)).toBe('');
    await rerender({ inputs: { content: '# Hello', streaming: false } as never });
    fixture.detectChanges();
    expect(status(host)).toBe('Response complete');
  });

  it('drops the busy flag when the stream stops', async () => {
    const { host, fixture, rerender } = await mount({ content: '# Hello', streaming: true });
    await rerender({ inputs: { content: '# Hello', streaming: false } as never });
    fixture.detectChanges();
    expect(host.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('says nothing for a document that never streamed', async () => {
    // ★ Announcing "Response complete" on the first render of a static document
    //   reports an event that did not happen.
    const { host } = await mount({ content: '# Static doc', streaming: false });
    expect(status(host)).toBe('');
  });

  it('honours a custom completion message', async () => {
    const { host, fixture, rerender } = await mount({
      content: '# Hi', streaming: true, completionMessage: 'Done thinking',
    });
    await rerender({
      inputs: { content: '# Hi', streaming: false, completionMessage: 'Done thinking' } as never,
    });
    fixture.detectChanges();
    expect(status(host)).toBe('Done thinking');
  });

  it('can be told to announce nothing', async () => {
    const { host, fixture, rerender } = await mount({
      content: '# Hi', streaming: true, completionMessage: '',
    });
    await rerender({
      inputs: { content: '# Hi', streaming: false, completionMessage: '' } as never,
    });
    fixture.detectChanges();
    expect(status(host)).toBe('');
  });

  it('keeps the live region out of the content it describes', async () => {
    // ★ A status region WRAPPING the text would re-announce the whole response
    //   whenever any of it changed — the same spam by another route.
    const { host } = await mount({ content: '# Hello\n\nBody text.', streaming: false });
    const live = host.querySelector('[role="status"]')!;
    expect(live.querySelector('h1')).toBeNull();
    expect(live.textContent).not.toContain('Body text');
  });
});

/**
 * Reading position across a reparse.
 *
 * ★★ The guarantee is that a block already on screen keeps its DOM node as the
 *    stream grows. Without it, a caret or a selection anywhere in the response
 *    is destroyed on every token — and the reader's scroll jumps with it.
 */
describe('SvStreamingMarkdownComponent — what survives a reparse', () => {
  async function mount(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const r = await render(SvStreamingMarkdownComponent, { inputs: inputs as never });
    return { ...r, host: r.fixture.nativeElement as HTMLElement };
  }

  it('keeps already-rendered blocks as the same DOM nodes', async () => {
    const { host, fixture, rerender } = await mount({
      content: '# Title\n\nFirst paragraph.\n\n', streaming: true,
    });
    const heading = host.querySelector('h1');
    const para = host.querySelector('p');

    await rerender({
      inputs: {
        content: '# Title\n\nFirst paragraph.\n\nSecond paragraph.\n',
        streaming: true,
      } as never,
    });
    fixture.detectChanges();

    expect(host.querySelector('h1')).toBe(heading);
    expect(host.querySelector('p')).toBe(para);
    expect(host.querySelectorAll('p').length).toBe(2);
  });

  it('holds that guarantee across many token arrivals', async () => {
    const { host, fixture, rerender } = await mount({
      content: '# Title\n\nStable.\n\n', streaming: true,
    });
    const heading = host.querySelector('h1');
    let text = '# Title\n\nStable.\n\nGrowing';
    for (const ch of ' one word at a time'.split('')) {
      text += ch;
      await rerender({ inputs: { content: text, streaming: true } as never });
      fixture.detectChanges();
      expect(host.querySelector('h1')).toBe(heading);
    }
  });
});
