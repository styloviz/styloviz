import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvListViewComponent } from './list-view.component';
import type { ListViewItem } from './list-view.component';
import { quietFor, until } from '../../../../src/testing/async';

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvListViewComponent, {
    inputs: { items: [] as ListViewItem[], ...inputs },
  });
  return fixture;
}

const tree = (): ListViewItem[] => [
  {
    id: 'design',
    title: 'Design',
    children: [
      { id: 'design-1', title: 'Wireframes' },
      { id: 'design-2', title: 'Colour tokens', children: [{ id: 'design-2a', title: 'Palette' }] },
    ],
  },
  { id: 'ops', title: 'Operations' },
];

const titles = (f: { nativeElement: HTMLElement }) =>
  [...f.nativeElement.querySelectorAll('[data-lv-row-btn="1"] p:first-child')].map((p) =>
    p.textContent?.trim(),
  );

describe('SvListViewComponent — grouping', () => {
  const grouped = (): ListViewItem[] => [
    { id: 1, title: 'Alpha', group: 'Today' },
    { id: 2, title: 'Beta', group: 'Today' },
    { id: 3, title: 'Gamma', group: 'Earlier' },
  ];

  /** Grouping is off by default, and the computed must stay empty — not silently
   *  build groups nobody asked for. */
  it('produces no groups until grouping is switched on', async () => {
    const f = await setup({ items: grouped() });
    expect(f.componentInstance.groupedItems()).toEqual([]);
    expect(f.componentInstance.flatItems().map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('keeps rows in first-seen group order, not alphabetical', async () => {
    const f = await setup({ items: grouped(), grouped: true });
    expect(f.componentInstance.groupedItems().map((g) => g.label)).toEqual(['Today', 'Earlier']);
    expect(f.componentInstance.groupedItems()[0].items.map((i) => i.id)).toEqual([1, 2]);
  });

  /** A missing group and a whitespace-only group are the same thing to a reader. */
  it('files rows with a missing or blank group under Ungrouped', async () => {
    const f = await setup({
      grouped: true,
      items: [
        { id: 1, title: 'No group' },
        { id: 2, title: 'Blank group', group: '   ' },
        { id: 3, title: 'Real', group: 'Today' },
      ] as ListViewItem[],
    });
    const groups = f.componentInstance.groupedItems();
    expect(groups.map((g) => g.label)).toEqual(['Ungrouped', 'Today']);
    expect(groups[0].items.map((i) => i.id)).toEqual([1, 2]);
  });

  /** A group label is trimmed, so " Today" and "Today" are one section. */
  it('trims the group label before keying on it', async () => {
    const f = await setup({
      grouped: true,
      items: [
        { id: 1, title: 'A', group: 'Today' },
        { id: 2, title: 'B', group: '  Today  ' },
      ] as ListViewItem[],
    });
    expect(f.componentInstance.groupedItems()).toHaveLength(1);
  });

  it('flattens the groups back out in section order', async () => {
    const f = await setup({ items: grouped(), grouped: true });
    expect(f.componentInstance.flatItems().map((i) => i.id)).toEqual([1, 2, 3]);
    expect(f.componentInstance.visibleItemCount()).toBe(3);
  });

  it('renders a header per group and the rows underneath', async () => {
    const f = await setup({ items: grouped(), grouped: true });
    const headers = [...f.nativeElement.querySelectorAll('section > header')].map((h) =>
      h.textContent?.trim(),
    );
    expect(headers).toEqual(['Today', 'Earlier']);
    expect(titles(f)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  /** `stickyGroupHeaders` is the only thing that pins a header while scrolling. */
  it('drops the sticky positioning when sticky headers are off', async () => {
    const on = await setup({ items: grouped(), grouped: true });
    expect(on.nativeElement.querySelector('section > header')?.className).toContain('sticky');

    const off = await setup({ items: grouped(), grouped: true, stickyGroupHeaders: false });
    expect(off.nativeElement.querySelector('section > header')?.className).not.toContain('sticky');
  });

  it('shows the empty state instead of an empty group list', async () => {
    const f = await setup({ items: [] as ListViewItem[], grouped: true });
    expect(f.nativeElement.querySelector('[data-sv-state="empty"]')).toBeTruthy();
    expect(f.nativeElement.querySelector('section')).toBeNull();
  });

  /** A search that empties every group must read as "no results", not "no data". */
  it('distinguishes a filtered-empty group list from an empty one', async () => {
    const f = await setup({ items: grouped(), grouped: true, searchable: true, query: 'zzz' });
    expect(f.componentInstance.groupedItems()).toEqual([]);
    expect(f.nativeElement.querySelector('[data-sv-state="empty"]')?.textContent).toContain(
      'No matching items',
    );
  });
});

describe('SvListViewComponent — nested rows', () => {
  it('produces no tree rows until nesting is switched on', async () => {
    const f = await setup({ items: tree() });
    expect(f.componentInstance.flattenedNestedItems()).toEqual([]);
    // A flat list of the same data still renders its top-level rows.
    expect(f.componentInstance.flatItems().map((i) => i.id)).toEqual(['design', 'ops']);
  });

  /** Everything starts collapsed, so only the roots are in the flattened list. */
  it('starts collapsed', async () => {
    const f = await setup({ items: tree(), nested: true });
    const rows = f.componentInstance.flattenedNestedItems();
    expect(rows.map((r) => r.item.id)).toEqual(['design', 'ops']);
    expect(rows.map((r) => r.hasChildren)).toEqual([true, false]);
    expect(rows.map((r) => r.depth)).toEqual([0, 0]);
  });

  it('reveals one level per expansion, with the depth that goes with it', async () => {
    const f = await setup({ items: tree(), nested: true });
    const c = f.componentInstance;

    c.toggleExpand(tree()[0]);
    expect(c.flattenedNestedItems().map((r) => r.item.id)).toEqual([
      'design',
      'design-1',
      'design-2',
      'ops',
    ]);

    c.toggleExpand(tree()[0].children![1]);
    const rows = c.flattenedNestedItems();
    expect(rows.map((r) => r.item.id)).toEqual([
      'design',
      'design-1',
      'design-2',
      'design-2a',
      'ops',
    ]);
    expect(rows.find((r) => r.item.id === 'design-2a')?.depth).toBe(2);
  });

  it('collapses again on a second toggle', async () => {
    const f = await setup({ items: tree(), nested: true });
    const c = f.componentInstance;
    c.toggleExpand(tree()[0]);
    c.toggleExpand(tree()[0]);
    expect(c.isExpanded(tree()[0])).toBe(false);
    expect(c.flattenedNestedItems()).toHaveLength(2);
  });

  /** A leaf has nothing to expand — toggling it must not put it in the set,
   *  or an unrelated row that later gains children would appear pre-expanded. */
  it('refuses to expand a leaf', async () => {
    const f = await setup({ items: tree(), nested: true });
    const c = f.componentInstance;
    c.toggleExpand({ id: 'ops', title: 'Operations' });
    c.toggleExpand({ id: 'x', title: 'Empty', children: [] });
    expect(c.isExpanded({ id: 'ops', title: 'Operations' })).toBe(false);
    expect(c.isExpanded({ id: 'x', title: 'Empty', children: [] })).toBe(false);
  });

  /**
   * ★ Twin parity. The Pro template hard-coded a "minus" here whatever the
   * state, so every collapsed node advertised itself as already open while its
   * own aria-label offered to expand it. The free twin was always right; this
   * pins it so the two cannot drift apart again.
   */
  it('shows a plus while collapsed and a minus while expanded', async () => {
    const f = await setup({ items: tree(), nested: true });
    const icon = () =>
      (f.nativeElement.querySelector('sv-icon svg') as SVGElement | null) &&
      f.debugElement.query((d) => d.name === 'sv-icon')?.componentInstance.name();

    expect(icon()).toBe('plus');
    expect(f.nativeElement.querySelector('button[aria-label]')?.getAttribute('aria-label')).toBe(
      'Expand Design',
    );

    f.componentInstance.toggleExpand(tree()[0]);
    f.detectChanges();
    expect(icon()).toBe('minus');
    expect(f.nativeElement.querySelector('button[aria-label]')?.getAttribute('aria-label')).toBe(
      'Collapse Design',
    );
  });

  /** A leaf gets a spacer, not a dead button. */
  it('renders no expander at all for a leaf row', async () => {
    const f = await setup({
      items: [{ id: 'ops', title: 'Operations' }] as ListViewItem[],
      nested: true,
    });
    expect(f.nativeElement.querySelector('button[aria-expanded]')).toBeNull();
  });

  /** The count is of the whole tree, not of the rows currently on screen. */
  it('counts every descendant, collapsed or not', async () => {
    const f = await setup({ items: tree(), nested: true });
    expect(f.componentInstance.flattenedNestedItems()).toHaveLength(2);
    expect(f.componentInstance.visibleItemCount()).toBe(5);
  });

  /** Virtualization needs a fixed row height, which a tree does not have. */
  it('renders the tree in full even when virtualization is asked for', async () => {
    const f = await setup({ items: tree(), nested: true, virtualized: true });
    const c = f.componentInstance;
    expect(c.isVirtualized()).toBe(true);
    expect(c.flatItems()).toEqual([]);
    expect(c.renderItems()).toEqual([]);
    expect(c.allVisibleIds()).toEqual(['design', 'ops']);
  });

  it('checks and select-alls against the visible tree rows', async () => {
    const f = await setup({ items: tree(), nested: true, checkable: true });
    const c = f.componentInstance;
    c.toggleAllChecks(true);
    expect([...c.checkedIds()]).toEqual(['design', 'ops']);

    c.toggleExpand(tree()[0]);
    c.toggleAllChecks(true);
    expect([...c.checkedIds()].sort()).toEqual(['design', 'design-1', 'design-2', 'ops']);
  });

  /** ★ Defect regression, tree flavour: a disabled branch must stay unchecked. */
  it('leaves a disabled tree row out of select-all', async () => {
    const f = await setup({
      nested: true,
      checkable: true,
      items: [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B', disabled: true },
      ] as ListViewItem[],
    });
    const c = f.componentInstance;
    c.toggleAllChecks(true);
    expect([...c.checkedIds()]).toEqual(['a']);
    expect(c.allChecked()).toBe(true);
  });

  it('shows the empty state when the tree has no roots', async () => {
    const f = await setup({ items: [] as ListViewItem[], nested: true });
    expect(f.nativeElement.querySelector('[data-sv-state="empty"]')).toBeTruthy();
  });
});

describe('SvListViewComponent — search', () => {
  const searchable = (): ListViewItem[] => [
    { id: 1, title: 'Invoice', subtitle: 'Acme Ltd', tags: ['urgent'] },
    { id: 2, title: 'Receipt', description: 'Coffee beans', badge: 'new' },
    { id: 3, title: 'Quote', meta: 'Q-114', amount: '€42', duration: '3m', timestamp: '10:04' },
    { id: 4, title: 'Nothing', group: 'Archive' },
  ];

  /** Every documented field is searchable — a query that only matches one of
   *  them proves the haystack has not quietly lost a column. */
  it.each([
    ['acme', 1],
    ['urgent', 1],
    ['coffee', 2],
    ['new', 2],
    ['q-114', 3],
    ['€42', 3],
    ['3m', 3],
    ['10:04', 3],
    ['archive', 4],
  ])('matches %s against the row that carries it', async (query, id) => {
    const f = await setup({ items: searchable(), searchable: true, query });
    expect(f.componentInstance.filteredItems().map((i) => i.id)).toEqual([id]);
  });

  /**
   * The debounced term is trimmed, so "inv" and "inv " are the same search.
   * Without the de-duplication guard the second one would send the host off to
   * fetch a page it already has.
   */
  it('does not re-fetch when the term only changed by whitespace', async () => {
    const f = await setup({ items: searchable(), searchable: true, debounceMs: 0 });
    const seen: string[] = [];
    f.componentInstance.searched.subscribe((t) => seen.push(t));

    f.componentInstance.query.set('inv');
    f.detectChanges();
    await until(() => seen.includes('inv'), { label: 'the search term reached the host' });

    f.componentInstance.query.set('  inv  ');
    f.detectChanges();
    await quietFor();

    expect(seen.filter((t) => t === 'inv')).toHaveLength(1);
  });

  it('is case-insensitive and ignores surrounding whitespace', async () => {
    const f = await setup({ items: searchable(), searchable: true, query: '  ACME  ' });
    expect(f.componentInstance.filteredItems().map((i) => i.id)).toEqual([1]);
  });

  /** A whitespace-only query is not a filter — the whole list must come back. */
  it('treats a whitespace-only query as no query', async () => {
    const f = await setup({ items: searchable(), searchable: true, query: '   ' });
    expect(f.componentInstance.isFiltered()).toBe(false);
    expect(f.componentInstance.filteredItems()).toHaveLength(4);
  });

  it('routes typing in the search box into the query model', async () => {
    const f = await setup({ items: searchable(), searchable: true });
    const input = f.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'receipt';
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(f.componentInstance.query()).toBe('receipt');
    expect(f.componentInstance.filteredItems().map((i) => i.id)).toEqual([2]);
  });

  /** The empty state's "Clear search" button is the only escape from a dead end. */
  it('clears the query from the empty state', async () => {
    const f = await setup({ items: searchable(), searchable: true, query: 'zzz' });
    const clear = [...f.nativeElement.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Clear search'),
    ) as HTMLButtonElement;
    expect(clear).toBeTruthy();
    clear.click();
    f.detectChanges();
    expect(f.componentInstance.query()).toBe('');
    expect(f.componentInstance.filteredItems()).toHaveLength(4);
  });

  /** No search means no dead end, so no clear button either. */
  it('offers no clear button on a genuinely empty list', async () => {
    const f = await setup({ items: [] as ListViewItem[], searchable: true });
    const clear = [...f.nativeElement.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Clear search'),
    );
    expect(clear).toBeUndefined();
  });

  it('keeps a branch whose descendant matches, and prunes the siblings', async () => {
    const f = await setup({ items: tree(), nested: true, searchable: true, query: 'palette' });
    const roots = f.componentInstance.filteredItems();
    expect(roots.map((r) => r.id)).toEqual(['design']);
    expect(roots[0].children!.map((c) => c.id)).toEqual(['design-2']);
    expect(roots[0].children![0].children!.map((c) => c.id)).toEqual(['design-2a']);
  });

  it('keeps a branch that matches on its own', async () => {
    const f = await setup({ items: tree(), nested: true, searchable: true, query: 'operations' });
    expect(f.componentInstance.filteredItems().map((r) => r.id)).toEqual(['ops']);
  });

  it('returns nothing when no node in the tree matches', async () => {
    const f = await setup({ items: tree(), nested: true, searchable: true, query: 'zzz' });
    expect(f.componentInstance.filteredItems()).toEqual([]);
    expect(f.componentInstance.flattenedNestedItems()).toEqual([]);
  });

  /** Grouping and search compose: sections that lose all their rows disappear. */
  it('drops a whole section when none of its rows match', async () => {
    const f = await setup({
      grouped: true,
      searchable: true,
      query: 'alpha',
      items: [
        { id: 1, title: 'Alpha', group: 'Today' },
        { id: 2, title: 'Beta', group: 'Earlier' },
      ] as ListViewItem[],
    });
    expect(f.componentInstance.groupedItems().map((g) => g.label)).toEqual(['Today']);
  });
});
