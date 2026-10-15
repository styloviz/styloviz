import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvListViewComponent } from './list-view.component';
import type { ListViewItem } from './list-view.component';
import { untilRendered } from '../../../../src/testing/async';

/**
 * What a windowed list owes the keyboard, the scrollbar and the host (DD-24).
 *
 * Four separate defects met in one place, and they all came from the same
 * mistake — treating "the rows on screen" as if it were "the list":
 *
 *   • roving focus walked the RENDERED buttons, so ArrowDown stopped at the
 *     bottom edge of the window and End reached the bottom of the window;
 *   • scrolling the focused row out of the window dropped focus to `<body>`;
 *   • every row was forced to `itemHeight` flat, clipping any second line;
 *   • the grouped branch rendered no row checkbox at all, so a checkable
 *     grouped list had a "Select all" box and nothing to select.
 *
 * The Pro and free twins share no code, so `list-view` (Pro) asserts the same
 * contract separately. The one difference: `nested`, `grouped` and `scrolling`
 * are Pro `mode` presets, so this tier reaches those branches through the
 * `[nested]` / `[grouped]` inputs and warns when a host asks for the preset.
 */

const many = (n: number): ListViewItem[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `Row ${i + 1}` }));

const GROUPED: ListViewItem[] = [
  { id: 1, title: 'A', group: 'One' },
  { id: 2, title: 'B', group: 'One' },
  { id: 3, title: 'C', group: 'Two' },
  { id: 4, title: 'D', group: 'Two', disabled: true },
];

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvListViewComponent, {
    inputs: { items: many(3), ...inputs },
  });
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof setup>>;

/**
 * 200 rows, 50px each, in a 200px window — four rows on screen out of two
 * hundred, which is the gap every test in this file is about.
 */
const windowed = (inputs: Record<string, unknown> = {}) =>
  setup({
    items: many(200),
    virtualized: true,
    itemHeight: 50,
    viewportHeight: 200,
    overscan: 0,
    ...inputs,
  });

const rows = (f: Fixture) =>
  [
    ...f.nativeElement.querySelectorAll('button[data-lv-row-btn="1"]:not([disabled])'),
  ] as HTMLButtonElement[];

const listItems = (f: Fixture) =>
  [...f.nativeElement.querySelectorAll('[role="listitem"]')] as HTMLElement[];

const viewport = (f: Fixture) =>
  f.nativeElement.querySelector('[data-lv-viewport]') as HTMLElement;

const root = (f: Fixture) => f.nativeElement.querySelector('[role="region"]') as HTMLElement;

/** The id of whatever row owns DOM focus, or null. */
const focusedId = () =>
  (document.activeElement as HTMLElement | null)?.dataset?.['lvId'] ?? null;

/**
 * ★ jsdom reports 0 for every scroll geometry, so a real element is
 * permanently "near the bottom". The numbers have to be stated.
 */
const scrollTo = (scrollTop: number) =>
  ({ target: { scrollTop, clientHeight: 200, scrollHeight: 10_000 } }) as unknown as Event;

/** Drive `onRootKeydown` directly — see the note in `list-view.keyboard.spec.ts`. */
function press(f: Fixture, key: string, from?: HTMLElement) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: from ?? root(f) });
  f.componentInstance.onRootKeydown(event);
  f.detectChanges();
  return event;
}

describe('SvListViewComponent — the keyboard cursor over a windowed list', () => {
  it('reaches the last row of the list, not the last row of the window', async () => {
    const f = await windowed();
    expect(rows(f).length).toBeLessThan(20);

    press(f, 'End');

    expect(f.componentInstance.activeItemId()).toBe(200);
    await untilRendered(f, () => focusedId() === '200', {
      label: 'the last row of the list to take focus',
    });
  });

  it('scrolls the window when the cursor steps past its bottom edge', async () => {
    const f = await windowed();
    const last = rows(f)[rows(f).length - 1];
    const lastId = Number(last.dataset['lvId']);

    press(f, 'ArrowDown', last);

    expect(f.componentInstance.activeItemId()).toBe(lastId + 1);
    expect(f.componentInstance.scrollOffset()).toBeGreaterThan(0);
    await untilRendered(f, () => focusedId() === String(lastId + 1), {
      label: 'the row below the window to take focus',
    });
  });

  it('keeps exactly one tab stop, on the row the cursor is on', async () => {
    const f = await windowed();
    press(f, 'End');
    await untilRendered(f, () => focusedId() === '200', { label: 'the cursor to arrive' });

    const stops = rows(f).filter((row) => row.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
    expect(stops[0].dataset['lvId']).toBe('200');
  });

  /** Every row is a tab stop when the host turns roving focus off. */
  it('hands every row a tab stop when roving focus is off', async () => {
    const f = await windowed({ enableRovingFocus: false });
    expect(rows(f).every((row) => row.getAttribute('tabindex') === '0')).toBe(true);
  });

  /** A windowed row has to be numbered against the list, or it reads as row 1 of 5. */
  it('numbers a windowed row against the whole list', async () => {
    const f = await windowed();
    f.componentInstance.scrollOffset.set(4000);
    f.detectChanges();

    const start = f.componentInstance.virtualRange().start;
    expect(start).toBeGreaterThan(0);

    const first = listItems(f)[0];
    expect(first.getAttribute('aria-posinset')).toBe(String(start + 1));
    expect(first.getAttribute('aria-setsize')).toBe('200');
  });

  it('numbers a grouped row against its own section', async () => {
    const f = await setup({ items: GROUPED, grouped: true });
    const first = listItems(f)[0];
    expect(first.getAttribute('aria-posinset')).toBe('1');
    expect(first.getAttribute('aria-setsize')).toBe('2');
  });

  it('catches focus on the viewport when the scroll unmounts the focused row', async () => {
    const f = await windowed();
    press(f, 'Home');
    expect(focusedId()).toBe('1');

    f.componentInstance.onContainerScroll(scrollTo(4000));
    f.detectChanges();

    expect(document.activeElement).toBe(viewport(f));
    expect(focusedId()).toBeNull();
  });

  /**
   * DA-45 — after a rescue the cursor row is off-window, so the viewport is now
   * the tab stop. Parking focus there must not hand it straight back to the row
   * the user just scrolled away from.
   */
  it('becomes the tab stop after a rescue without bouncing focus back to the row', async () => {
    const f = await windowed();
    press(f, 'Home');
    f.componentInstance.onContainerScroll(scrollTo(4000));
    f.detectChanges();

    expect(document.activeElement).toBe(viewport(f));
    expect(viewport(f).getAttribute('tabindex')).toBe('0');
    expect(f.componentInstance.scrollOffset()).toBe(4000);
  });

  /**
   * DA-45 — a host that restored the cursor far down the list, with the window
   * at the top, used to render no tab stop at all: the cursor row was not in
   * the DOM and the region, deferring to the rows, was -1. Tab skipped the list.
   */
  it('keeps the list reachable by Tab when the cursor row is outside the window', async () => {
    const f = await windowed({ activeItemId: 150 });
    expect(rows(f).some((row) => row.getAttribute('tabindex') === '0')).toBe(false);
    expect(root(f).getAttribute('tabindex')).toBe('-1');
    expect(viewport(f).getAttribute('tabindex')).toBe('0');
  });

  it('hands keyboard focus from the viewport to the remembered row', async () => {
    const f = await windowed({ activeItemId: 150 });
    viewport(f).focus();
    f.detectChanges();
    await untilRendered(f, () => focusedId() === '150', { label: 'the cursor row to take focus' });

    expect(viewport(f).getAttribute('tabindex')).toBe('-1');
    expect(rows(f).filter((row) => row.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it('is not a second tab stop while the cursor row is on screen', async () => {
    const f = await windowed({ activeItemId: 2 });
    expect(viewport(f).getAttribute('tabindex')).toBe('-1');
    expect(rows(f).filter((row) => row.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  /** Focus went to the viewport, but the cursor did not go back to nothing. */
  it('carries on from the row the cursor was on after a rescue', async () => {
    const f = await windowed();
    press(f, 'Home');
    f.componentInstance.onContainerScroll(scrollTo(4000));
    f.detectChanges();

    press(f, 'ArrowDown');

    expect(f.componentInstance.activeItemId()).toBe(2);
  });

  it('leaves focus alone while the focused row is still on screen', async () => {
    const f = await windowed();
    press(f, 'Home');

    f.componentInstance.onContainerScroll(scrollTo(20));
    f.detectChanges();

    expect(focusedId()).toBe('1');
  });

  /** A host that names a row gets the tab stop moved to it. */
  it('takes the cursor position from the host', async () => {
    const f = await setup({ activeItemId: 3 });
    const stops = rows(f).filter((row) => row.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
    expect(stops[0].dataset['lvId']).toBe('3');
  });

  /** Otherwise a search that drops the active row would leave the list untabbable. */
  it('falls back to the first row when the cursor points at a row that is gone', async () => {
    const f = await setup({ activeItemId: 'nope' });
    expect(f.componentInstance.tabStopId()).toBe(1);
  });

  it('never puts the cursor on a disabled row', async () => {
    const f = await setup({
      items: [
        { id: 1, title: 'Alpha', disabled: true },
        { id: 2, title: 'Beta' },
      ],
    });
    expect(f.componentInstance.focusableIds()).toEqual([2]);
    expect(f.componentInstance.tabStopId()).toBe(2);
  });
});

/**
 * ★ Depth was carried by `padding-left` alone, which no screen reader reads, and
 * the expander announced "Expand node" without ever saying whether it was open.
 */
describe('SvListViewComponent — what a nested list says about its shape', () => {
  const TREE: ListViewItem[] = [
    {
      id: 'src',
      title: 'src',
      children: [
        { id: 'app', title: 'app' },
        { id: 'assets', title: 'assets' },
      ],
    },
    { id: 'dist', title: 'dist' },
  ];

  const nested = (inputs: Record<string, unknown> = {}) =>
    setup({ items: TREE, nested: true, expandedIds: new Set(['src']), ...inputs });

  it('publishes a list, not a pile of divs', async () => {
    const f = await nested();
    expect(f.nativeElement.querySelectorAll('[role="list"]')).toHaveLength(1);
    expect(listItems(f)).toHaveLength(4);
  });

  it('numbers a child against its own siblings, at its own level', async () => {
    const f = await nested();
    const [src, app, assets, dist] = listItems(f);

    expect([src.getAttribute('aria-level'), src.getAttribute('aria-posinset'), src.getAttribute('aria-setsize')])
      .toEqual(['1', '1', '2']);
    expect([app.getAttribute('aria-level'), app.getAttribute('aria-posinset'), app.getAttribute('aria-setsize')])
      .toEqual(['2', '1', '2']);
    expect(assets.getAttribute('aria-posinset')).toBe('2');
    expect([dist.getAttribute('aria-level'), dist.getAttribute('aria-posinset')]).toEqual(['1', '2']);
  });

  const expander = (f: Fixture) =>
    f.nativeElement.querySelector('[aria-expanded]') as HTMLButtonElement;

  it('says whether a branch is open, and names the branch', async () => {
    const f = await nested();
    expect(expander(f).getAttribute('aria-expanded')).toBe('true');
    expect(expander(f).getAttribute('aria-label')).toBe('Collapse src');
  });

  it('says a closed branch is closed', async () => {
    const f = await nested({ expandedIds: new Set() });
    expect(expander(f).getAttribute('aria-expanded')).toBe('false');
    expect(expander(f).getAttribute('aria-label')).toBe('Expand src');
    expect(listItems(f)).toHaveLength(2);
  });

  /** A leaf is not a disclosure, so it must not claim a collapsed state. */
  it('leaves a leaf row without an expanded state', async () => {
    const f = await nested();
    expect(f.nativeElement.querySelectorAll('[aria-expanded]')).toHaveLength(1);
  });
});

describe('SvListViewComponent — scroll restoration', () => {
  it('records where the user scrolled to', async () => {
    const f = await windowed();
    f.componentInstance.onContainerScroll(scrollTo(500));
    expect(f.componentInstance.scrollOffset()).toBe(500);
  });

  it('never records a negative offset', async () => {
    const f = await windowed();
    f.componentInstance.onContainerScroll(scrollTo(-40));
    expect(f.componentInstance.scrollOffset()).toBe(0);
  });

  it('puts the viewport back where the host says it was', async () => {
    const f = await windowed();
    f.componentInstance.scrollOffset.set(600);
    f.detectChanges();

    expect(viewport(f).scrollTop).toBe(600);
    expect(f.componentInstance.virtualRange().start).toBeGreaterThan(0);
  });

  /**
   * ★ A host restoring a saved offset alongside a fetch would otherwise apply it
   * to a skeleton and land the user at the top of the rows once they arrived.
   *
   * The restore lands in the same pass that draws the list, so the scroller does
   * not exist yet when the effect runs — `whenStable` is what waits for the
   * `afterNextRender` that finishes the job.
   */
  it('waits for rows before restoring the offset', async () => {
    const f = await windowed({ loading: true, scrollOffset: 600 });
    expect(viewport(f)).toBeNull();

    f.componentRef.setInput('loading', false);
    f.detectChanges();
    await f.whenStable();

    expect(viewport(f).scrollTop).toBe(600);
  });
});

describe('SvListViewComponent — how tall a row is', () => {
  it('measures a single-line row at itemHeight', async () => {
    const f = await windowed();
    expect(f.componentInstance.rowHeightOf({ id: 1, title: 'Row 1' })).toBe(50);
  });

  it('adds a line for a subtitle', async () => {
    const f = await windowed();
    expect(f.componentInstance.rowHeightOf({ id: 1, title: 'Row 1', subtitle: 'Sub' })).toBe(70);
  });

  it('adds a description line and a tag strip in template mode', async () => {
    const f = await windowed({ mode: 'template' });
    expect(
      f.componentInstance.rowHeightOf({
        id: 1,
        title: 'Row 1',
        description: 'Desc',
        tags: ['a'],
      }),
    ).toBe(98);
  });

  /** A subtitle is not rendered in template mode, so it must not be charged for. */
  it('charges template mode for what template mode renders', async () => {
    const f = await windowed({ mode: 'template' });
    expect(f.componentInstance.rowHeightOf({ id: 1, title: 'Row 1', subtitle: 'Sub' })).toBe(50);
  });

  it('never measures a row at zero', async () => {
    const f = await windowed({ itemHeight: 0 });
    expect(f.componentInstance.rowHeightOf({ id: 1, title: 'Row 1' })).toBe(1);
  });

  /** The scrollbar has to agree with the rows it is scrolling. */
  it('totals the list from the real row heights', async () => {
    const f = await windowed({
      items: [
        { id: 1, title: 'One' },
        { id: 2, title: 'Two', subtitle: 'Sub' },
        { id: 3, title: 'Three' },
        { id: 4, title: 'Four', subtitle: 'Sub' },
      ],
    });
    expect(f.componentInstance.totalVirtualHeight()).toBe(4 * 50 + 2 * 20);
  });

  it('sizes a windowed row to its own height', async () => {
    const f = await windowed({
      items: [
        { id: 1, title: 'One' },
        { id: 2, title: 'Two', subtitle: 'Sub' },
      ],
    });
    const heights = listItems(f).map((row) => row.style.height);
    expect(heights).toEqual(['50px', '70px']);
  });

  /** An unwindowed row is whatever its content needs — nothing is measured. */
  it('leaves an unwindowed row unsized', async () => {
    const f = await setup({ items: many(2) });
    expect(listItems(f).every((row) => row.style.height === '')).toBe(true);
  });
});

describe('SvListViewComponent — checking a whole section', () => {
  const grouped = () => setup({ items: GROUPED, grouped: true, checkable: true });

  const check = (input: HTMLInputElement, checked: boolean) => {
    input.checked = checked;
    input.dispatchEvent(new Event('change'));
  };

  const box = (f: Fixture, label: string) =>
    f.nativeElement.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;

  const checkedIds = (f: Fixture) => [...f.componentInstance.checkedIds()].sort();

  /** ★★★ The grouped branch used to render no row control whatsoever. */
  it('gives every grouped row a checkbox', async () => {
    const f = await grouped();
    const boxes = f.nativeElement.querySelectorAll('[role="listitem"] input[type="checkbox"]');
    expect(boxes).toHaveLength(4);
    expect(box(f, 'Check A')).not.toBeNull();
    expect(box(f, 'Check D').disabled).toBe(true);
  });

  it('checks one section and leaves the others alone', async () => {
    const f = await grouped();
    check(box(f, 'Check all items in One'), true);
    f.detectChanges();
    expect(checkedIds(f)).toEqual([1, 2]);
  });

  it('leaves a disabled row out of a section check', async () => {
    const f = await grouped();
    check(box(f, 'Check all items in Two'), true);
    f.detectChanges();
    expect(checkedIds(f)).toEqual([3]);
  });

  /** A group is not an item — a host reading the set back gets item ids only. */
  it('never puts a group label in checkedIds', async () => {
    const f = await grouped();
    check(box(f, 'Check all items in One'), true);
    check(box(f, 'Check all items in Two'), true);
    f.detectChanges();
    expect(checkedIds(f)).toEqual([1, 2, 3]);
  });

  it('unchecks only its own section', async () => {
    const f = await grouped();
    f.componentInstance.checkedIds.set(new Set([1, 2, 3]));
    f.detectChanges();

    check(box(f, 'Check all items in One'), false);
    f.detectChanges();

    expect(checkedIds(f)).toEqual([3]);
  });

  /** `indeterminate` is what a screen reader announces as "mixed". */
  it('reports a partly checked section as mixed', async () => {
    const f = await grouped();
    check(box(f, 'Check A'), true);
    f.detectChanges();

    const header = box(f, 'Check all items in One');
    expect(header.indeterminate).toBe(true);
    expect(header.checked).toBe(false);
  });

  it('reports a fully checked section as checked, not mixed', async () => {
    const f = await grouped();
    check(box(f, 'Check all items in One'), true);
    f.detectChanges();

    const header = box(f, 'Check all items in One');
    expect(header.indeterminate).toBe(false);
    expect(header.checked).toBe(true);
  });

  /** Every checkable row in the section is checked, so the section is checked. */
  it('ignores a disabled row when reading a section back', async () => {
    const f = await grouped();
    check(box(f, 'Check C'), true);
    f.detectChanges();

    const header = box(f, 'Check all items in Two');
    expect(header.checked).toBe(true);
    expect(header.indeterminate).toBe(false);
  });

  it('draws no section checkbox on a list that is not checkable', async () => {
    const f = await setup({ items: GROUPED, grouped: true });
    expect(box(f, 'Check all items in One')).toBeNull();
  });
});

describe('SvListViewComponent — the mode matrix', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  const said = (fragment: string) =>
    warn.mock.calls.some((args: unknown[]) => String(args[0]).includes(fragment));

  it('says so when windowing is asked for on a nested list', async () => {
    await setup({ nested: true, virtualized: true });
    expect(said('windowing is ignored while the list is nested')).toBe(true);
  });

  it('says so when windowing is asked for on a grouped list', async () => {
    await setup({ items: GROUPED, grouped: true, virtualized: true });
    expect(said('windowing is ignored while the list is grouped')).toBe(true);
  });

  it('says so when a nested list is also grouped', async () => {
    await setup({ items: GROUPED, nested: true, grouped: true });
    expect(said('grouping is ignored while the list is nested')).toBe(true);
  });

  it('says so when a checkable list also asks for a selection control', async () => {
    await setup({ checkable: true, selectionMode: 'multiple' });
    expect(said('the selection control is not rendered')).toBe(true);
  });

  it('says it once, however often the list re-renders', async () => {
    const f = await setup({ nested: true, virtualized: true });
    f.detectChanges();
    f.componentInstance.onContainerScroll(scrollTo(10));
    f.detectChanges();
    expect(warn.mock.calls.filter((args: unknown[]) => String(args[0]).includes('nested'))).toHaveLength(1);
  });

  it('stays quiet about a combination that composes', async () => {
    await windowed({ mode: 'checklist' });
    expect(warn).not.toHaveBeenCalled();
  });

  /**
   * ★ The free tier renders these three presets as a plain flat list, which is a
   * feature a host asked for and did not get — the same silence this matrix
   * exists to end. `list-view.modes.spec.ts` asserts the rendering; this asserts
   * that the host is told.
   */
  it.each(['nested', 'grouped', 'scrolling'])(
    'says mode="%s" is a Pro preset it ignores',
    async (mode) => {
      await setup({ mode });
      expect(said('are Pro presets and this build ignores them')).toBe(true);
    },
  );

  it('says nothing about a preset this tier does render', async () => {
    await setup({ mode: 'call-history' });
    expect(warn).not.toHaveBeenCalled();
  });
});
