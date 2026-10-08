import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { SvCodeBlockComponent } from './code-block.component';
import type { DiffHunk, DiffHunkEvent, TerminalLine } from './code-block.types';

/**
 * The diff variant: the unified list, the side-by-side pairing, the +/− counts
 * and the per-hunk review buttons. Plus the terminal variant's line kinds,
 * which are the other place a `kind` discriminator drives the markup.
 */

function setup(inputs: Record<string, unknown> = {}): ComponentFixture<SvCodeBlockComponent> {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(SvCodeBlockComponent);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture;
}

const el = (f: ComponentFixture<SvCodeBlockComponent>) => f.nativeElement as HTMLElement;

/**
 * One entry per side-by-side row: [left text, right text], '' for a blank half.
 *
 * ★ `:not(.sr-only)` — this helper describes what is DRAWN, and the row also
 *   carries a visually-hidden "Removed:" / "Added:" that only a screen reader
 *   receives. Folding that into the visible text would make every assertion
 *   below claim the pane renders a word it does not.
 */
const splitRows = (f: ComponentFixture<SvCodeBlockComponent>) =>
  [...el(f).querySelectorAll('.grid-cols-2')].flatMap((grid) => {
    // The panes are column-major — each owns the scroll for its whole side — so
    // the two sides are read separately and zipped. Read the spans, not the raw
    // text: the number and the code sit in separate spans with no whitespace
    // between them in the compiled template.
    const side = (pane: Element) =>
      [...pane.children].map((row) =>
        [...row.querySelectorAll('span:not(.sr-only)')]
          .map((sp) => sp.textContent ?? '')
          .join(' ')
          .trim(),
      );
    const [left = [], right = []] = [...grid.children].map(side);
    return left.map((l, i) => [l, right[i] ?? '']);
  });

const hunk = (id: string, lines: DiffHunk['lines'], header?: string): DiffHunk => ({
  id,
  ...(header ? { header } : {}),
  lines,
});

describe('SvCodeBlockComponent — split panes clip their own overflow', () => {
  /**
   * ★★★ THE BUG THIS EXISTS TO CATCH LOOKS LIKE A FONT GLITCH.
   *
   *     A grid column does not constrain an over-wide child, so a long line in
   *     the left pane paints straight across the divider and on top of the
   *     right pane's text. Two overlapping columns of code read as a rendering
   *     artefact rather than a layout bug, which is exactly why it survives
   *     review — and `min-w-0` is the half that is usually missing, because a
   *     grid item's automatic minimum size is its content.
   */
  it('gives every split pane min-w-0 and its own horizontal scroll', () => {
    const f = setup({
      variant: 'diff',
      diffMode: 'split',
      hunks: [
        hunk('h', [
          { kind: 'del', text: 'a'.repeat(400), oldNo: 1, newNo: null },
          { kind: 'add', text: 'b'.repeat(400), oldNo: null, newNo: 1 },
        ]),
      ],
    });
    const panes = el(f).querySelectorAll('.grid-cols-2 > div');
    expect(panes.length).toBe(2);
    for (const pane of Array.from(panes)) {
      expect(pane.className).toContain('min-w-0');
      expect(pane.className).toContain('overflow-x-auto');
      // Scrolling the pane rather than the row is what keeps a keyboard able to
      // reach a long line without spending one tab stop per line of the diff.
      expect(pane.getAttribute('tabindex')).toBe('0');
    }
    // A row must be able to outgrow the visible box, or its add/delete tint
    // stops at the fold and slides out of register when the reader scrolls.
    for (const row of Array.from(el(f).querySelectorAll('.grid-cols-2 > div > div'))) {
      expect(row.className).toContain('w-max');
      expect(row.className).toContain('min-w-full');
    }
  });

  /**
   * ★★★ THE PANES ARE INDEPENDENT COLUMNS, SO NOTHING PADS A BLANK HALF.
   *
   *     An empty span forms no line box and collapses to height 0, sliding
   *     every row below it in that pane out of register with the other side —
   *     measured as line 16 sitting opposite line 20. A jsdom test cannot see
   *     height, so it guards the mechanism instead: the blank half must still
   *     render a character.
   */
  it('renders a space in a blank half so the row keeps its line box', () => {
    const f = setup({
      variant: 'diff',
      diffMode: 'split',
      hunks: [
        hunk('h', [
          { kind: 'context', text: 'kept', oldNo: 1, newNo: 1 },
          { kind: 'add', text: 'added', oldNo: null, newNo: 2 },
        ]),
      ],
    });
    const [left] = Array.from(el(f).querySelectorAll('.grid-cols-2 > div'));
    // Row 2 has no left counterpart: its code span must not be empty.
    const codeSpans = Array.from(left.children).map(
      (row) => Array.from(row.querySelectorAll('span')).at(-1)?.textContent ?? '',
    );
    expect(codeSpans).toEqual(['kept', ' ']);
  });
});

describe('SvCodeBlockComponent — diff counts', () => {
  it('counts additions and removals across every hunk, ignoring context', () => {
    const f = setup({
      variant: 'diff',
      hunks: [
        hunk('h1', [
          { kind: 'context', text: 'a', oldNo: 1, newNo: 1 },
          { kind: 'del', text: 'b', oldNo: 2, newNo: null },
          { kind: 'add', text: 'c', oldNo: null, newNo: 2 },
          { kind: 'add', text: 'd', oldNo: null, newNo: 3 },
        ]),
        hunk('h2', [{ kind: 'del', text: 'e', oldNo: 9, newNo: null }]),
      ],
    });
    expect(el(f).textContent).toContain('+2');
    expect(el(f).textContent).toContain('−2');
  });

  it('reports zeroes for a diff with only context lines', () => {
    const f = setup({
      variant: 'diff',
      hunks: [hunk('h1', [{ kind: 'context', text: 'a', oldNo: 1, newNo: 1 }])],
    });
    expect(el(f).textContent).toContain('+0');
    expect(el(f).textContent).toContain('−0');
  });

  it('shows no counts at all outside the diff variant', () => {
    const f = setup({ code: 'const a = 1;', filename: 'a.ts' });
    expect(el(f).textContent).not.toContain('+0');
  });
});

describe('SvCodeBlockComponent — side-by-side pairing', () => {
  it('pairs each removal with the addition that replaces it', () => {
    const f = setup({
      variant: 'diff',
      diffMode: 'split',
      hunks: [
        hunk('h1', [
          { kind: 'del', text: 'old one', oldNo: 1, newNo: null },
          { kind: 'del', text: 'old two', oldNo: 2, newNo: null },
          { kind: 'add', text: 'new one', oldNo: null, newNo: 1 },
          { kind: 'add', text: 'new two', oldNo: null, newNo: 2 },
        ]),
      ],
    });
    expect(splitRows(f)).toEqual([
      ['1 old one', '1 new one'],
      ['2 old two', '2 new two'],
    ]);
  });

  it('leaves the right half blank when more lines were removed than added', () => {
    const f = setup({
      variant: 'diff',
      diffMode: 'split',
      hunks: [
        hunk('h1', [
          { kind: 'del', text: 'gone one', oldNo: 1, newNo: null },
          { kind: 'del', text: 'gone two', oldNo: 2, newNo: null },
          { kind: 'add', text: 'kept', oldNo: null, newNo: 1 },
        ]),
      ],
    });
    expect(splitRows(f)).toEqual([
      ['1 gone one', '1 kept'],
      ['2 gone two', ''],
    ]);
  });

  it('leaves the left half blank for a pure insertion', () => {
    const f = setup({
      variant: 'diff',
      diffMode: 'split',
      hunks: [
        hunk('h1', [
          { kind: 'add', text: 'brand new', oldNo: null, newNo: 1 },
          { kind: 'add', text: 'also new', oldNo: null, newNo: 2 },
        ]),
      ],
    });
    expect(splitRows(f)).toEqual([
      ['', '1 brand new'],
      ['', '2 also new'],
    ]);
  });

  it('repeats a context line on both sides and flushes the pending pair first', () => {
    // A context line ends the current change block: the removals and additions
    // above it must be paired and emitted BEFORE it, not after.
    const f = setup({
      variant: 'diff',
      diffMode: 'split',
      hunks: [
        hunk('h1', [
          { kind: 'del', text: 'was', oldNo: 1, newNo: null },
          { kind: 'add', text: 'is', oldNo: null, newNo: 1 },
          { kind: 'context', text: 'same', oldNo: 2, newNo: 2 },
          { kind: 'del', text: 'later', oldNo: 3, newNo: null },
        ]),
      ],
    });
    expect(splitRows(f)).toEqual([
      ['1 was', '1 is'],
      ['2 same', '2 same'],
      ['3 later', ''],
    ]);
  });

  it('renders one flat list in unified mode instead of pairing', () => {
    const f = setup({
      variant: 'diff',
      diffMode: 'unified',
      hunks: [
        hunk('h1', [
          { kind: 'context', text: 'same', oldNo: 1, newNo: 1 },
          { kind: 'del', text: 'was', oldNo: 2, newNo: null },
          { kind: 'add', text: 'is', oldNo: null, newNo: 2 },
        ]),
      ],
    });
    expect(el(f).querySelector('.grid-cols-2')).toBeNull();
    const text = el(f).textContent ?? '';
    expect(text).toContain('was');
    expect(text).toContain('is');
    // The +/−/space markers are what tell the three kinds apart in one column.
    expect(text).toContain('+');
    expect(text).toContain('−');
  });

  it('drops the line-number gutter when lineNumbers is off, in both modes', () => {
    const lines: DiffHunk['lines'] = [
      { kind: 'del', text: 'was', oldNo: 7, newNo: null },
      { kind: 'add', text: 'is', oldNo: null, newNo: 7 },
    ];
    const split = setup({
      variant: 'diff',
      diffMode: 'split',
      lineNumbers: false,
      hunks: [hunk('h1', lines)],
    });
    expect(splitRows(split)).toEqual([['was', 'is']]);

    const unified = setup({ variant: 'diff', lineNumbers: false, hunks: [hunk('h1', lines)] });
    expect(unified.nativeElement.textContent).not.toContain('7');
  });
});

describe('SvCodeBlockComponent — reviewing a hunk', () => {
  const HUNKS = [
    hunk('h1', [{ kind: 'add' as const, text: 'x', oldNo: null, newNo: 1 }], '@@ -1 +1 @@'),
    hunk('h2', [{ kind: 'del' as const, text: 'y', oldNo: 2, newNo: null }], '@@ -2 +2 @@'),
  ];

  const reviewButtons = (f: ComponentFixture<SvCodeBlockComponent>, label: string) =>
    [...el(f).querySelectorAll<HTMLButtonElement>('button')].filter(
      (b) => b.textContent?.trim() === label,
    );

  it('offers no review buttons unless asked', () => {
    const f = setup({ variant: 'diff', hunks: HUNKS });
    expect(reviewButtons(f, 'Accept')).toEqual([]);
    // The header row itself still renders, because the hunks have headers.
    expect(el(f).textContent).toContain('@@ -1 +1 @@');
  });

  it('renders no header row for a hunk with neither header nor review buttons', () => {
    const f = setup({
      variant: 'diff',
      hunks: [hunk('h1', [{ kind: 'add', text: 'x', oldNo: null, newNo: 1 }])],
    });
    // Scoped to the code region — the component's own header bar is also
    // `.bg-gray-50` and is always present.
    expect(el(f).querySelector('[role="region"] .bg-gray-50')).toBeNull();
  });

  it('renders a header row for an unheaded hunk once it is reviewable', () => {
    const f = setup({
      variant: 'diff',
      reviewable: true,
      hunks: [hunk('h1', [{ kind: 'add', text: 'x', oldNo: null, newNo: 1 }])],
    });
    expect(reviewButtons(f, 'Accept').length).toBe(1);
  });

  it('reports which hunk was accepted and which was rejected', () => {
    const f = setup({ variant: 'diff', reviewable: true, hunks: HUNKS });
    const seen: DiffHunkEvent[] = [];
    f.componentInstance.hunkAction.subscribe((e) => seen.push(e));

    reviewButtons(f, 'Accept')[1].click();
    reviewButtons(f, 'Reject')[0].click();

    expect(seen.map((e) => [e.hunk.id, e.action])).toEqual([
      ['h2', 'accept'],
      ['h1', 'reject'],
    ]);
  });
});

describe('SvCodeBlockComponent — terminal lines', () => {
  const LINES: TerminalLine[] = [
    { kind: 'command', text: 'npm run build' },
    { kind: 'stdout', text: 'compiling…' },
    { kind: 'stderr', text: 'warning: unused import' },
    { kind: 'exit', text: 'exit status 1' },
  ];

  it('prefixes only the command with a prompt glyph', () => {
    const f = setup({ variant: 'terminal', terminalLines: LINES });
    const rows = [...el(f).querySelectorAll('.font-mono > div')];
    expect(rows.map((r) => r.textContent?.trim().startsWith('$'))).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it('colours stdout, stderr and the exit line differently', () => {
    const f = setup({ variant: 'terminal', terminalLines: LINES });
    const classes = [...el(f).querySelectorAll('.font-mono > div')].map(
      (r) => r.lastElementChild!.className,
    );
    expect(classes[1]).toContain('text-gray-400');
    expect(classes[2]).toContain('text-danger-400');
    expect(classes[3]).toContain('text-warning-400');
  });

  it('shows a caret while a response is still arriving, and not once it has', () => {
    const streaming = setup({ variant: 'terminal', terminalLines: LINES, streaming: true });
    expect(streaming.nativeElement.querySelector('.animate-pulse')).not.toBeNull();

    const done = setup({ variant: 'terminal', terminalLines: LINES });
    expect(done.nativeElement.querySelector('.animate-pulse')).toBeNull();
  });

  it('shows a caret after the last code line when a block is still streaming', () => {
    const f = setup({ code: 'const a = 1;\nconst b = 2;', streaming: true });
    const carets = el(f).querySelectorAll('.animate-pulse');
    expect(carets.length).toBe(1);
  });
});

describe('SvCodeBlockComponent — the code region', () => {
  it('numbers lines by default and drops the gutter when told to', () => {
    // Scoped to <code>: the copy icon in the header is aria-hidden too.
    const gutters = (f: ComponentFixture<SvCodeBlockComponent>) =>
      (f.nativeElement as HTMLElement).querySelectorAll('code [aria-hidden="true"]');

    expect(gutters(setup({ code: 'a\nb\nc' })).length).toBe(3);
    expect(gutters(setup({ code: 'a\nb\nc', lineNumbers: false })).length).toBe(0);
  });

  it('widens the gutter for a file long enough to need three digits', () => {
    const short = setup({ code: 'a\nb' });
    const long = setup({ code: Array.from({ length: 120 }, (_, i) => `line ${i}`).join('\n') });
    const width = (f: ComponentFixture<SvCodeBlockComponent>) =>
      (f.nativeElement as HTMLElement).querySelector<HTMLElement>('code [aria-hidden="true"]')!
        .style.width;
    expect(width(short)).toBe('2ch');
    expect(width(long)).toBe('3ch');
  });

  it('switches between wrapping and horizontal scrolling', () => {
    const wrapped = setup({ code: 'a', wrap: true });
    expect(wrapped.nativeElement.innerHTML).toContain('whitespace-pre-wrap');

    const scrolled = setup({ code: 'a' });
    expect(scrolled.nativeElement.innerHTML).not.toContain('whitespace-pre-wrap');
  });

  it('emphasises exactly the requested lines', () => {
    const f = setup({ code: 'a\nb\nc', highlightLines: [2] });
    const rows = [...el(f).querySelectorAll('code > span')];
    expect(rows.map((r) => r.className.includes('bg-primary-50'))).toEqual([false, true, false]);
  });

  it('emphasises nothing when no lines are requested', () => {
    const f = setup({ code: 'a\nb\nc' });
    const rows = [...el(f).querySelectorAll('code > span')];
    expect(rows.some((r) => r.className.includes('bg-primary-50'))).toBe(false);
  });
});
