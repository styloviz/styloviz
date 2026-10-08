import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { SvCodeBlockComponent } from './code-block.component';
import type { CodeFile, DiffHunk, TerminalLine } from './code-block.types';

/**
 * What the component says about its own limits.
 *
 * Four things it used to do silently: cap nothing and build every row of a huge
 * file, fall back to plain text with no badge and no explanation, offer one copy
 * button that meant four different things, and pass invisible reordering
 * characters straight through to a reviewer.
 *
 * ★ Control characters are built from their code point, never typed — spelling a
 *   bidi control literally would put an invisible reordering character into this
 *   file.
 */

const RLO = String.fromCodePoint(0x202e);
const ESC = String.fromCodePoint(0x1b);

function setup(inputs: Record<string, unknown> = {}): ComponentFixture<SvCodeBlockComponent> {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(SvCodeBlockComponent);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture;
}

type Fx = ComponentFixture<SvCodeBlockComponent>;

const el = (f: Fx) => f.nativeElement as HTMLElement;
const text = (f: Fx) => el(f).textContent!.replace(/\s+/g, ' ').trim();
const region = (f: Fx) => el(f).querySelector<HTMLElement>('[role="region"]')!;
const codeRows = (f: Fx) => el(f).querySelectorAll('pre code > span');
const copyButton = (f: Fx) => el(f).querySelectorAll<HTMLButtonElement>('button[aria-label]')[0];
const badge = (f: Fx) => el(f).querySelector('.uppercase');
const showAll = (f: Fx) =>
  Array.from(el(f).querySelectorAll<HTMLButtonElement>('button')).find((b) =>
    b.textContent!.trim().startsWith('Show all'),
  );

const numbered = (count: number): string =>
  Array.from({ length: count }, (_, i) => `const line${i} = ${i};`).join('\n');

// ─── Truncation ───────────────────────────────────────────────────────────────

describe('SvCodeBlockComponent — a file too long to render', () => {
  it('renders only the capped lines and says how many it held back', () => {
    const f = setup({ code: numbered(10), maxRenderedLines: 4 });
    expect(codeRows(f)).toHaveLength(4);
    expect(text(f)).toContain('Showing the first 4 of 10 lines.');
  });

  it('puts the notice OUTSIDE the scroll region', () => {
    // Inside it, the notice sits below the whole rendered screenful — so the
    // reader learns the file was cut only by scrolling to the one place they
    // have no reason to go.
    const f = setup({ code: numbered(10), maxRenderedLines: 4 });
    expect(region(f).contains(showAll(f)!)).toBe(false);
  });

  it('renders the rest when asked, and stops saying anything', () => {
    const f = setup({ code: numbered(10), maxRenderedLines: 4 });
    showAll(f)!.click();
    f.detectChanges();

    expect(codeRows(f)).toHaveLength(10);
    expect(text(f)).not.toContain('Showing the first');
    expect(showAll(f)).toBeUndefined();
  });

  it('renders everything when the cap is 0', () => {
    const f = setup({ code: numbered(50), maxRenderedLines: 0 });
    expect(codeRows(f)).toHaveLength(50);
    expect(showAll(f)).toBeUndefined();
  });

  it('says nothing for a file that fits', () => {
    const f = setup({ code: numbered(10), maxRenderedLines: 600 });
    expect(codeRows(f)).toHaveLength(10);
    expect(showAll(f)).toBeUndefined();
  });

  it('sizes the gutter for the WHOLE file, so numbers do not reflow on expand', () => {
    const f = setup({ code: numbered(120), maxRenderedLines: 4, lineNumbers: true });
    const gutter = el(f).querySelector<HTMLElement>('pre code span[aria-hidden="true"]')!;
    expect(gutter.style.width).toBe('3ch');
  });

  it('re-arms the cap when a new buffer arrives', () => {
    // ★ Held as a plain signal, "show all" would stay set for the rest of the
    //   component's life and the cap would apply to the first big file only.
    //   A REPLACEMENT — content that does not begin with what was shown — is
    //   a new buffer.
    const f = setup({ code: numbered(10), maxRenderedLines: 4 });
    showAll(f)!.click();
    f.detectChanges();
    expect(codeRows(f)).toHaveLength(10);

    f.componentRef.setInput('code', 'header\n' + numbered(11));
    f.detectChanges();
    expect(codeRows(f)).toHaveLength(4);
    expect(text(f)).toContain('Showing the first 4 of 12 lines.');
  });

  it('stays expanded while a stream APPENDS to the buffer (DD-07-I1/M1)', () => {
    // ★★ Resetting on every chunk re-collapsed the block the reader had just
    //    expanded, over and over, while the response was still arriving.
    const f = setup({ code: numbered(10), maxRenderedLines: 4, streaming: true });
    showAll(f)!.click();
    f.detectChanges();
    expect(codeRows(f)).toHaveLength(10);

    for (const n of [11, 12, 20]) {
      f.componentRef.setInput('code', numbered(n));
      f.detectChanges();
      expect(codeRows(f)).toHaveLength(n);
      expect(showAll(f)).toBeUndefined();
    }

    // The stream ends and the host swaps in a different answer: that is new.
    f.componentRef.setInput('streaming', false);
    f.componentRef.setInput('code', 'rewritten\n' + numbered(9));
    f.detectChanges();
    expect(codeRows(f)).toHaveLength(4);
  });

  it('does not expand an append that arrives while still collapsed', () => {
    const f = setup({ code: numbered(10), maxRenderedLines: 4 });
    f.componentRef.setInput('code', numbered(12));
    f.detectChanges();
    expect(codeRows(f)).toHaveLength(4);
    expect(text(f)).toContain('Showing the first 4 of 12 lines.');
  });

  it('re-arms the cap when the tab changes', () => {
    const files: CodeFile[] = [
      { name: 'a.ts', content: numbered(10) },
      { name: 'b.ts', content: numbered(11) },
    ];
    const f = setup({ variant: 'tabs', files, maxRenderedLines: 4 });
    showAll(f)!.click();
    f.detectChanges();
    expect(codeRows(f)).toHaveLength(10);

    el(f).querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    f.detectChanges();
    expect(codeRows(f)).toHaveLength(4);
  });

  it('never shows the notice for a diff or a terminal transcript', () => {
    // Both are bounded by what the caller passed, so a cap it did not ask for
    // would truncate a complete list rather than a runaway one.
    const hunks: DiffHunk[] = [{
      id: 'h1',
      lines: Array.from({ length: 10 }, (_, i) => ({
        kind: 'context' as const, text: `line ${i}`, oldNo: i + 1, newNo: i + 1,
      })),
    }];
    expect(showAll(setup({ variant: 'diff', hunks, maxRenderedLines: 2 }))).toBeUndefined();

    const terminalLines: TerminalLine[] = Array.from({ length: 10 }, (_, i) => ({
      kind: 'stdout' as const, text: `line ${i}`,
    }));
    expect(showAll(setup({ variant: 'terminal', terminalLines, maxRenderedLines: 2 }))).toBeUndefined();
  });

  it('holds the streaming caret back while lines are hidden', () => {
    // The caret means "more is coming HERE". Rendered after a truncated last
    // line it points into the middle of a file that has already arrived.
    const f = setup({ code: numbered(10), maxRenderedLines: 4, streaming: true });
    expect(el(f).querySelector('pre .animate-pulse')).toBeNull();

    showAll(f)!.click();
    f.detectChanges();
    expect(el(f).querySelector('pre .animate-pulse')).not.toBeNull();
  });
});

// ─── What the copy button will copy ───────────────────────────────────────────

describe('SvCodeBlockComponent — the copy button states what it takes', () => {
  it('mentions the line numbers only when there are line numbers to skip', () => {
    expect(copyButton(setup({ code: 'a', lineNumbers: true })).getAttribute('aria-label'))
      .toBe('Copy code, without the line numbers');
    expect(copyButton(setup({ code: 'a', lineNumbers: false })).getAttribute('aria-label'))
      .toBe('Copy code');
  });

  it('names the open file in the tabs variant, and only that file', () => {
    const files: CodeFile[] = [
      { name: 'a.ts', content: 'first' },
      { name: 'b.ts', content: 'second' },
    ];
    const f = setup({ variant: 'tabs', files });
    expect(copyButton(f).getAttribute('aria-label')).toBe('Copy a.ts — the open file only');

    el(f).querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    f.detectChanges();
    expect(copyButton(f).getAttribute('aria-label')).toBe('Copy b.ts — the open file only');
  });

  it('still says what it takes when the open file has no name', () => {
    const f = setup({ variant: 'tabs', files: [{ name: '', content: 'x' }] });
    expect(copyButton(f).getAttribute('aria-label')).toBe('Copy the open file only');
  });

  it('says which side of a diff it takes', () => {
    const hunks: DiffHunk[] = [{
      id: 'h1',
      lines: [{ kind: 'add', text: 'a', oldNo: null, newNo: 1 }],
    }];
    expect(copyButton(setup({ variant: 'diff', hunks })).getAttribute('aria-label'))
      .toBe('Copy the updated code — additions and context, without the + and − markers');
  });

  it('says the prompt is not part of the transcript', () => {
    const terminalLines: TerminalLine[] = [{ kind: 'command', text: 'ls' }];
    expect(copyButton(setup({ variant: 'terminal', terminalLines })).getAttribute('aria-label'))
      .toBe('Copy the transcript, without the prompt');
  });

  it('shows the same sentence on hover as it reads out', () => {
    const f = setup({ code: 'a' });
    const button = copyButton(f);
    expect(button.getAttribute('title')).toBe(button.getAttribute('aria-label'));
  });
});

// ─── Highlighting that did not happen ─────────────────────────────────────────

describe('SvCodeBlockComponent — an unhighlighted language says so', () => {
  const NOTE = 'Not syntax highlighted: no rules for .rb. Shown as plain text.';

  it('explains the fallback and labels the badge', () => {
    // ★ Without this a `.rb` file was flat monospace with NO badge at all —
    //   indistinguishable from Ruby containing no keyword the reader knew.
    const f = setup({ code: 'puts 1', filename: 'script.rb' });
    expect(text(f)).toContain(NOTE);
    expect(badge(f)!.textContent!.trim()).toBe('plain text');
    const id = region(f).getAttribute('aria-describedby')!;
    expect(el(f).querySelector(`#${id}`)!.textContent!.trim()).toBe(NOTE);
  });

  it('says nothing when plain text is what was ASKED for', () => {
    // Answering a request with a notice that it was not honoured would be false.
    const f = setup({ code: 'puts 1', filename: 'script.rb', language: 'plaintext' });
    expect(text(f)).not.toContain('Not syntax highlighted');
    expect(badge(f)).toBeNull();
    expect(region(f).getAttribute('aria-describedby')).toBeNull();
  });

  it('says nothing for a name that never claimed a language', () => {
    expect(text(setup({ code: 'all:', filename: 'Makefile' }))).not.toContain('Not syntax highlighted');
    expect(text(setup({ code: 'x', filename: '.gitignore' }))).not.toContain('Not syntax highlighted');
    expect(text(setup({ code: 'x' }))).not.toContain('Not syntax highlighted');
  });

  it('says nothing when highlighting worked', () => {
    const f = setup({ code: 'const a = 1;', filename: 'a.ts' });
    expect(text(f)).not.toContain('Not syntax highlighted');
    expect(badge(f)!.textContent!.trim()).toBe('typescript');
  });

  it('carries BOTH descriptions when a diff is also unhighlighted', () => {
    // Two `aria-describedby` bindings would have replaced each other.
    const hunks: DiffHunk[] = [{
      id: 'h1',
      lines: [{ kind: 'add', text: 'puts 1', oldNo: null, newNo: 1 }],
    }];
    const f = setup({ variant: 'diff', hunks, filename: 'script.rb' });
    const ids = region(f).getAttribute('aria-describedby')!.split(' ');
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(el(f).querySelector(`#${id}`)).not.toBeNull();
  });
});

// ─── Text that lies about itself ──────────────────────────────────────────────

describe('SvCodeBlockComponent — invisible characters and escape debris', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('pins the region left-to-right whatever the host does', () => {
    // Inheriting a host `dir="rtl"` reverses the visual order of every line
    // while leaving the text alone — read one thing, copy another, via layout.
    expect(region(setup({ code: 'a' })).getAttribute('dir')).toBe('ltr');
  });

  it('renders a bidi control as a visible, warning-coloured token', () => {
    const f = setup({ code: `const s = "x${RLO}y";`, filename: 'a.ts' });
    const token = Array.from(el(f).querySelectorAll('pre code span'))
      .find((s) => s.textContent === '<U+202E>');
    expect(token).not.toBeUndefined();
    expect(token!.className).toContain('text-danger-800');
  });

  it('reveals one inside a DIFF line, where code gets approved', () => {
    const hunks: DiffHunk[] = [{
      id: 'h1',
      lines: [{ kind: 'add', text: `if (admin) {${RLO}`, oldNo: null, newNo: 1 }],
    }];
    expect(text(setup({ variant: 'diff', hunks }))).toContain('<U+202E>');
  });

  it('reveals one inside a diff rendered SIDE BY SIDE too', () => {
    const hunks: DiffHunk[] = [{
      id: 'h1',
      lines: [
        { kind: 'del', text: 'old', oldNo: 1, newNo: null },
        { kind: 'add', text: `new${RLO}`, oldNo: null, newNo: 1 },
      ],
    }];
    expect(text(setup({ variant: 'diff', diffMode: 'split', hunks }))).toContain('<U+202E>');
  });

  it('reveals one in a terminal transcript', () => {
    const terminalLines: TerminalLine[] = [{ kind: 'stdout', text: `done${RLO}` }];
    expect(text(setup({ variant: 'terminal', terminalLines }))).toContain('<U+202E>');
  });

  it('leaves the CLIPBOARD bytes exactly as the host supplied them', async () => {
    // Rewriting source on the way to the clipboard would corrupt a legitimate
    // Arabic string literal to defend against a rare hostile one. Revealing it
    // on screen is the honest half of that trade.
    const code = `const s = "x${RLO}y";`;
    const f = setup({ code, filename: 'a.ts' });
    copyButton(f).click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(code);
  });

  it('strips ANSI escapes from the transcript instead of printing the debris', () => {
    // The ESC itself is non-printing, so what survived on screen was `[31m`.
    const terminalLines: TerminalLine[] = [
      { kind: 'stdout', text: `${ESC}[31mFAIL${ESC}[0m 2 tests` },
    ];
    const f = setup({ variant: 'terminal', terminalLines });
    expect(text(f)).toContain('FAIL 2 tests');
    expect(text(f)).not.toContain('[31m');
  });

  it('strips them from the clipboard as well, since they were never on screen', () => {
    const terminalLines: TerminalLine[] = [
      { kind: 'command', text: `${ESC}[1mnpm test${ESC}[0m` },
    ];
    const f = setup({ variant: 'terminal', terminalLines });
    copyButton(f).click();
    return Promise.resolve().then(() => {
      expect(writeText).toHaveBeenCalledWith('npm test');
    });
  });

  it('emits the HOST\'s hunk object, not the rewritten copy it rendered', () => {
    // A caller cannot apply a hunk whose text is not the text it supplied.
    const hunks: DiffHunk[] = [{
      id: 'h1',
      lines: [{ kind: 'add', text: `if (admin) {${RLO}`, oldNo: null, newNo: 1 }],
    }];
    const f = setup({ variant: 'diff', hunks, reviewable: true });
    const seen: DiffHunk[] = [];
    f.componentInstance.hunkAction.subscribe((e) => seen.push(e.hunk));

    el(f).querySelector<HTMLButtonElement>('button[aria-label^="Accept"]')!.click();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(hunks[0]);
    expect(seen[0].lines[0].text).toBe(`if (admin) {${RLO}`);
  });
});
