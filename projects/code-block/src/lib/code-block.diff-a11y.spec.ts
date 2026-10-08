import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { SvCodeBlockComponent } from './code-block.component';
import type { DiffHunk } from './code-block.types';

/**
 * ============================================================================
 *  Reading a diff without seeing it (audit item DD-07-I2)
 * ============================================================================
 *
 * The backlog asked for one thing — "3 hunks, 12 added, 4 removed" readable
 * without scanning colours. Writing it surfaced a larger defect underneath:
 * EVERY per-line kind was colour-only. The `+`/`−` marker was `aria-hidden`
 * (correctly — read aloud, `−` is "minus", a character rather than a fact) and
 * the only other signal was a background tint, so an added line, a removed line
 * and an unchanged line announced IDENTICALLY. The summary tells you a change
 * has three hunks; it cannot tell you which lines they are.
 *
 * ★ Deliberately NOT the shared `sv-data-summary-table` from `X-9`. That
 *   component exists for facts that reach the page only as geometry, and a
 *   diff's lines are already text in the DOM — a companion table would read the
 *   whole file a second time. What was missing here is a description and a
 *   per-line label, not a tabular equivalent. The rule from `X-9` still governs:
 *   say the geometric fact, never restate one already announced.
 * ============================================================================
 */

function setup(inputs: Record<string, unknown> = {}): ComponentFixture<SvCodeBlockComponent> {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(SvCodeBlockComponent);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture;
}

const el = (f: ComponentFixture<SvCodeBlockComponent>) => f.nativeElement as HTMLElement;

const region = (f: ComponentFixture<SvCodeBlockComponent>) =>
  el(f).querySelector('[role="region"]')!;

/** The text of whatever the region points `aria-describedby` at. */
function description(f: ComponentFixture<SvCodeBlockComponent>): string | null {
  const id = region(f).getAttribute('aria-describedby');
  if (!id) return null;
  const target = el(f).querySelector(`#${id}`);
  return target?.textContent?.trim() ?? null;
}

const hunk = (id: string, lines: DiffHunk['lines'], header?: string): DiffHunk => ({
  id,
  ...(header ? { header } : {}),
  lines,
});

const THREE_HUNKS: readonly DiffHunk[] = [
  hunk('h1', [
    { kind: 'context', text: 'unchanged', oldNo: 1, newNo: 1 },
    { kind: 'del', text: 'was', oldNo: 2, newNo: null },
    { kind: 'add', text: 'is', oldNo: null, newNo: 2 },
  ]),
  hunk('h2', [
    { kind: 'add', text: 'brand new', oldNo: null, newNo: 9 },
    { kind: 'add', text: 'also new', oldNo: null, newNo: 10 },
  ]),
  hunk('h3', [{ kind: 'del', text: 'deleted', oldNo: 30, newNo: null }]),
];

describe('SvCodeBlockComponent — the diff describes its own scale', () => {
  it('states hunk, addition and removal counts as the region description', () => {
    const f = setup({ variant: 'diff', hunks: THREE_HUNKS });
    expect(description(f)).toBe('Diff: 3 hunks, 3 added lines, 2 removed lines.');
  });

  /** ★ "1 hunks" is the tell that a string was generated rather than written. */
  it('says it in the singular when there is one of something', () => {
    const f = setup({
      variant: 'diff',
      hunks: [
        hunk('h1', [
          { kind: 'add', text: 'x', oldNo: null, newNo: 1 },
          { kind: 'del', text: 'y', oldNo: 1, newNo: null },
        ]),
      ],
    });
    expect(description(f)).toBe('Diff: 1 hunk, 1 added line, 1 removed line.');
  });

  it('reports zeroes rather than silence for a context-only diff', () => {
    const f = setup({
      variant: 'diff',
      hunks: [hunk('h1', [{ kind: 'context', text: 'a', oldNo: 1, newNo: 1 }])],
    });
    expect(description(f)).toBe('Diff: 1 hunk, 0 added lines, 0 removed lines.');
  });

  /**
   * ★★ A DESCRIPTION, NOT THE NAME. Folding the counts into the region's
   *    accessible name would mean a host that supplies `ariaLabel` — the
   *    ordinary case, since the diff has no filename to fall back on — silently
   *    loses them. Both must survive together.
   */
  it('keeps a host-supplied label as the name and still carries the counts', () => {
    const f = setup({ variant: 'diff', hunks: THREE_HUNKS, ariaLabel: 'Proposed migration' });
    expect(region(f).getAttribute('aria-label')).toBe('Proposed migration');
    expect(description(f)).toContain('3 hunks');
  });

  it('describes nothing outside the diff variant, and nothing for an empty diff', () => {
    expect(description(setup({ code: 'const a = 1;', filename: 'a.ts' }))).toBeNull();
    expect(description(setup({ variant: 'diff', hunks: [] }))).toBeNull();
  });

  /**
   * ★★ THE COUNTS MUST NOT BE SAID TWICE. `+3` and `−2` announce as "plus
   *    three" and "minus two" — bare numbers with no noun — and the description
   *    already says it properly. This is the `X-9` rule applied here: an
   *    alternative that restates an announced fact is noise.
   */
  it('hides the visual +/− chips from assistive technology', () => {
    const f = setup({ variant: 'diff', hunks: THREE_HUNKS });
    const chips = [...el(f).querySelectorAll('span')].filter((s) =>
      /^[+−]\d+$/.test(s.textContent?.trim() ?? ''),
    );
    expect(chips.length).toBe(2);
    for (const chip of chips) expect(chip.getAttribute('aria-hidden')).toBe('true');
  });

  /** The description must follow the data, not be computed once. */
  it('re-describes the diff when the hunks change', () => {
    const f = setup({ variant: 'diff', hunks: THREE_HUNKS });
    expect(description(f)).toContain('3 hunks');

    f.componentRef.setInput('hunks', [THREE_HUNKS[2]]);
    f.detectChanges();
    expect(description(f)).toBe('Diff: 1 hunk, 0 added lines, 1 removed line.');
  });

  /**
   * ★ Two code blocks on one page is the ordinary layout, and a duplicated id
   *   makes the second region's `aria-describedby` resolve into the first.
   */
  it('gives each instance its own description id', () => {
    // Both instances must share an application: ids are per application (svUniqueId).
    const a = setup({ variant: 'diff', hunks: THREE_HUNKS });
    const b = TestBed.createComponent(SvCodeBlockComponent);
    b.componentRef.setInput('variant', 'diff');
    b.componentRef.setInput('hunks', THREE_HUNKS);
    b.detectChanges();
    const idOf = (f: ComponentFixture<SvCodeBlockComponent>) =>
      region(f).getAttribute('aria-describedby');
    expect(idOf(a)).toBeTruthy();
    expect(idOf(a)).not.toBe(idOf(b));
  });
});

describe('SvCodeBlockComponent — a changed line says so, in words', () => {
  /** Visually-hidden labels in document order, unified mode. */
  const srLabels = (f: ComponentFixture<SvCodeBlockComponent>) =>
    [...region(f).querySelectorAll('.sr-only')].map((n) => n.textContent?.trim() ?? '');

  it('labels every added and removed line, and leaves context silent', () => {
    const f = setup({ variant: 'diff', hunks: THREE_HUNKS });
    expect(srLabels(f)).toEqual([
      'Removed:',
      'Added:',
      'Added:',
      'Added:',
      'Removed:',
    ]);
  });

  /**
   * ★★ The regression this exists to catch is invisible on screen: remove the
   *    labels and the diff still LOOKS right, because colour is doing the work.
   *    So assert the pairing — each label sits with the line it describes.
   */
  it('attaches each label to its own line, not to the hunk', () => {
    const f = setup({ variant: 'diff', hunks: THREE_HUNKS });
    const rows = [...region(f).querySelectorAll('.font-mono')];
    const read = rows.map((r) => ({
      label: r.querySelector('.sr-only')?.textContent?.trim() ?? null,
      text: [...r.querySelectorAll('span:not(.sr-only)')].at(-1)?.textContent ?? '',
    }));
    expect(read).toEqual([
      { label: null, text: 'unchanged' },
      { label: 'Removed:', text: 'was' },
      { label: 'Added:', text: 'is' },
      { label: 'Added:', text: 'brand new' },
      { label: 'Added:', text: 'also new' },
      { label: 'Removed:', text: 'deleted' },
    ]);
  });

  it('keeps the marker glyph itself hidden — it is a character, not a fact', () => {
    const f = setup({ variant: 'diff', hunks: THREE_HUNKS });
    const markers = [...region(f).querySelectorAll('span')].filter(
      (s) => s.textContent === '+' || s.textContent === '−',
    );
    expect(markers.length).toBeGreaterThan(0);
    for (const m of markers) expect(m.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SvCodeBlockComponent — the side-by-side panes', () => {
  const SPLIT: readonly DiffHunk[] = [
    hunk('h1', [
      { kind: 'context', text: 'same', oldNo: 1, newNo: 1 },
      { kind: 'del', text: 'was', oldNo: 2, newNo: null },
      { kind: 'add', text: 'is', oldNo: null, newNo: 2 },
      { kind: 'add', text: 'extra', oldNo: null, newNo: 3 },
    ]),
  ];

  const panes = (f: ComponentFixture<SvCodeBlockComponent>) => [
    ...el(f).querySelectorAll('.grid-cols-2 > div'),
  ];

  /**
   * ★★ Each pane is `tabindex="0"`, so it is a stop on the keyboard path. An
   *    unnamed group is announced as nothing at all — and with two of them per
   *    hunk, a reader lands somewhere with no idea which side they are on.
   */
  it('names each pane so a reader knows which side they are in', () => {
    const f = setup({ variant: 'diff', diffMode: 'split', hunks: SPLIT });
    expect(
      panes(f).map((p) => [p.getAttribute('role'), p.getAttribute('aria-label')]),
    ).toEqual([
      ['group', 'Before'],
      ['group', 'After'],
    ]);
  });

  it('labels a removal on the before side and an addition on the after side', () => {
    const f = setup({ variant: 'diff', diffMode: 'split', hunks: SPLIT });
    const [before, after] = panes(f);
    const labels = (pane: Element) =>
      [...pane.children].map((row) => row.querySelector('.sr-only')?.textContent?.trim() ?? null);
    expect(labels(before)).toEqual([null, 'Removed:', null]);
    expect(labels(after)).toEqual([null, 'Added:', 'Added:']);
  });

  /**
   * ★★★ A BLANK HALF IS PADDING, AND PADDING IS NOT A LINE.
   *
   *      The row exists so the two panes stay in step — the sibling spec proves
   *      it must keep a rendered character or the panes drift out of register.
   *      That character is announced as an empty line the file does not
   *      contain, in a variant where a reader is already hearing everything
   *      twice. Hiding the filler is the only way to have both.
   */
  it('hides an alignment filler from assistive technology, without removing it', () => {
    const f = setup({ variant: 'diff', diffMode: 'split', hunks: SPLIT });
    const [before] = panes(f);
    const rows = [...before.children];
    // Row 3 pairs with 'extra' on the right and has no left counterpart.
    expect(rows.map((r) => r.getAttribute('aria-hidden'))).toEqual([null, null, 'true']);
    // Still rendered, still carrying its space — the layout fix stays intact.
    expect([...rows[2].querySelectorAll('span')].at(-1)?.textContent).toBe(' ');
  });
});

describe('SvCodeBlockComponent — telling the review buttons apart', () => {
  const reviewButtons = (f: ComponentFixture<SvCodeBlockComponent>, label: string) =>
    [...el(f).querySelectorAll<HTMLButtonElement>('button')].filter(
      (b) => b.textContent?.trim() === label,
    );

  /**
   * ★★ Three hunks offered "Accept, button" three times. The visible word is
   *    enough on screen because the hunk is what you are looking at; in a list
   *    of buttons pulled out of context it identifies nothing.
   */
  it('names each button by the change it acts on', () => {
    const f = setup({ variant: 'diff', reviewable: true, hunks: THREE_HUNKS });
    expect(reviewButtons(f, 'Accept').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Accept change 1 of 3',
      'Accept change 2 of 3',
      'Accept change 3 of 3',
    ]);
    expect(reviewButtons(f, 'Reject').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Reject change 1 of 3',
      'Reject change 2 of 3',
      'Reject change 3 of 3',
    ]);
  });

  /**
   * ★ The accessible name must not fight the visible one: a speech-control user
   *   says "click Accept", which has to match. "Accept change 1 of 3" starts
   *   with the visible word, so it does.
   */
  it('keeps the visible word at the start of the accessible name', () => {
    const f = setup({ variant: 'diff', reviewable: true, hunks: THREE_HUNKS });
    for (const b of reviewButtons(f, 'Accept')) {
      expect(b.getAttribute('aria-label')).toMatch(/^Accept\b/);
    }
  });
});
