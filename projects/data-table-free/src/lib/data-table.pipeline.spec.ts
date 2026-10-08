import { render } from '@testing-library/angular';
import { SvDataTableComponent, type TableColumn } from './data-table.component';
import type { SvDataQuery } from '@styloviz/core';

/**
 * ============================================================================
 *  `sv-data-table` (free) — the data pipeline: filter → sort → page
 * ============================================================================
 *
 * The free and Pro data tables share no code — they are two independently
 * maintained files — so every promise the free one makes is asserted here
 * rather than inherited from `projects/data-table/src/data-table.component.spec.ts`.
 * Where the twins genuinely differ, the test says so and names the difference.
 *
 * Load states, selection and the toolbar live in `data-table.states.spec.ts`;
 * columns, variants and cell rendering in `data-table.columns.spec.ts`.
 */

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
  age: number;
  status: string;
}

const COLUMNS: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'age', label: 'Age', sortable: true, align: 'right' },
  { key: 'status', label: 'Status', badge: true },
];

const ROWS: Row[] = [
  { id: 1, name: 'Charlie', age: 30, status: 'active' },
  { id: 2, name: 'Alice', age: 45, status: 'pending' },
  { id: 3, name: 'Bob', age: 22, status: 'active' },
];

async function setup(extra: Record<string, unknown> = {}) {
  const { fixture } = await render(SvDataTableComponent<Row>, {
    inputs: { columns: COLUMNS, rows: ROWS, pageSize: 2, ...extra },
  });
  return {
    fixture,
    c: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
  };
}

/** The `th` of the header row proper — not the column-filter row below it. */
function headerCells(el: HTMLElement): HTMLTableCellElement[] {
  return [...el.querySelectorAll<HTMLTableCellElement>('thead tr:first-child th')];
}

// ─────────────────────────────────────────────────────────────────────────────

describe('SvDataTableComponent — filtering', () => {
  it('matches case-insensitively across every column, not just the first', async () => {
    const { c } = await setup();
    c.searchQuery.set('ALI');
    expect(c.filteredRows().map((r) => r.name)).toEqual(['Alice']);
  });

  it('matches on a column that is not rendered as text either — the search spans the data', async () => {
    const { c } = await setup();
    c.searchQuery.set('pending');
    expect(c.filteredRows().map((r) => r.name)).toEqual(['Alice']);
  });

  it('returns every row for an empty query', async () => {
    const { c } = await setup();
    expect(c.filteredRows()).toHaveLength(3);
  });

  it('returns nothing at all — not everything — for a query that matches no row', async () => {
    const { c } = await setup();
    c.searchQuery.set('zzz');
    expect(c.filteredRows()).toEqual([]);
  });

  it('narrows to a single column with a column filter', async () => {
    const { c } = await setup();
    c.setColFilter('status', 'pending');
    expect(c.filteredRows().map((r) => r.name)).toEqual(['Alice']);
  });

  it('combines the search term and the column filters with AND', async () => {
    // 'a' alone also matches Bob, whose *status* contains it — the search spans
    // every column, so the column filter has to narrow the result, not widen it.
    const { c } = await setup();
    c.searchQuery.set('a');
    expect(c.filteredRows().map((r) => r.name)).toEqual(['Charlie', 'Alice', 'Bob']);
    c.setColFilter('status', 'pending');
    expect(c.filteredRows().map((r) => r.name)).toEqual(['Alice']);
  });

  it('treats a filter set to the empty string as no filter at all', async () => {
    // `setColFilter(key, '')` deletes the key; a stray empty entry left in the
    // record would otherwise filter every row out via `String(...).includes('')`
    // — harmless — but would also render a chip for a filter nobody set.
    const { c } = await setup();
    c.setColFilter('status', 'active');
    c.setColFilter('status', '');
    expect(c.columnFiltersRecord()).toEqual({});
    expect(c.filteredRows()).toHaveLength(3);
    expect(c.activeFilterChips()).toEqual([]);
  });

  it('treats a missing property as empty rather than matching the word undefined', async () => {
    const rows = [{ id: 9, name: 'Zed', age: 1 } as unknown as Row];
    const { c } = await setup({ rows });
    c.searchQuery.set('undefined');
    expect(c.filteredRows()).toEqual([]);
  });

  it('resets to page 1 when a column filter changes, so the user is not left on an empty page', async () => {
    const { c } = await setup();
    c.goTo(2);
    c.setColFilter('status', 'active');
    expect(c.currentPage()).toBe(1);
  });

  it('lists every active filter as a removable chip, and clears just that one', async () => {
    const { c, el, fixture } = await setup();
    c.searchQuery.set('a');
    c.setColFilter('status', 'active');
    fixture.detectChanges();

    expect(c.activeFilterChips()).toEqual([
      { key: '__search__', label: 'Search', value: 'a' },
      { key: 'status', label: 'Status', value: 'active' },
    ]);

    el.querySelector<HTMLButtonElement>('button[aria-label="Remove Status filter"]')!.click();
    expect(c.columnFiltersRecord()).toEqual({});
    // The search chip must survive removing a different chip.
    expect(c.searchQuery()).toBe('a');
  });

  it('clears the search from its own chip without touching the column filters', async () => {
    const { c } = await setup();
    c.searchQuery.set('a');
    c.setColFilter('status', 'active');
    c.clearFilter('__search__');
    expect(c.searchQuery()).toBe('');
    expect(c.columnFiltersRecord()).toEqual({ status: 'active' });
  });

  it('labels a chip with the column key when no column declares that key', async () => {
    const { c } = await setup();
    c.setColFilter('ghost', 'x');
    expect(c.activeFilterChips()).toEqual([{ key: 'ghost', label: 'ghost', value: 'x' }]);
  });

  it('drops the search term and every column filter on "Clear all"', async () => {
    const { c } = await setup();
    c.searchQuery.set('a');
    c.setColFilter('status', 'active');
    c.clearAllFilters();
    expect(c.activeFilterChips()).toEqual([]);
    expect(c.filteredRows()).toHaveLength(3);
  });

  it('types the global search box into the query and back to page 1', async () => {
    const { c, el } = await setup({ searchable: true, showToolbar: true });
    const input = el.querySelector<HTMLInputElement>('input[aria-label="Search table"]')!;
    c.goTo(2);
    input.value = 'bob';
    input.dispatchEvent(new Event('input'));
    expect(c.searchQuery()).toBe('bob');
    expect(c.currentPage()).toBe(1);
  });

  it('drives the column-filter row from the rendered input', async () => {
    const { c, el } = await setup({ columnFilters: true });
    const input = el.querySelector<HTMLInputElement>('input[aria-label="Filter Name"]')!;
    input.value = 'bo';
    input.dispatchEvent(new Event('input'));
    expect(c.columnFiltersRecord()).toEqual({ name: 'bo' });
    expect(c.filteredRows().map((r) => r.name)).toEqual(['Bob']);
  });

  it('offers a select-type filter as a real <select> of the declared options', async () => {
    const columns: TableColumn<Row>[] = [
      COLUMNS[0],
      COLUMNS[1],
      { key: 'status', label: 'Status', filterType: 'select', filterOptions: ['active', 'pending'] },
    ];
    const { c, el } = await setup({ columns, columnFilters: true });
    const select = el.querySelector<HTMLSelectElement>('select[aria-label="Filter Status"]')!;
    expect([...select.options].map((o) => o.value)).toEqual(['', 'active', 'pending']);
    select.value = 'pending';
    select.dispatchEvent(new Event('change'));
    expect(c.filteredRows().map((r) => r.name)).toEqual(['Alice']);
  });

  it('renders no filter control for a column that opted out with filterType "none"', async () => {
    const columns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', filterType: 'none' },
      COLUMNS[1],
    ];
    const { el } = await setup({ columns, columnFilters: true });
    expect(el.querySelector('input[aria-label="Filter Name"]')).toBeNull();
    expect(el.querySelector('input[aria-label="Filter Age"]')).toBeTruthy();
  });
});

describe('SvDataTableComponent — sorting', () => {
  it('cycles ascending → descending → unsorted on repeated activation', async () => {
    const { c } = await setup();
    const click = new MouseEvent('click');

    c.onSort(COLUMNS[0], click);
    expect(c.sortedRows().map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);

    c.onSort(COLUMNS[0], click);
    expect(c.sortedRows().map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice']);

    c.onSort(COLUMNS[0], click);
    expect(c.sorts()).toEqual([]);
  });

  it('sorts numerically using natural comparison rather than string order', async () => {
    // String order would put 22 before 30 before 45 here by luck; the point is
    // that `numeric: true` is what makes it true for 9 vs 10 as well.
    const rows: Row[] = [
      { id: 1, name: 'a', age: 10, status: 'active' },
      { id: 2, name: 'b', age: 9, status: 'active' },
      { id: 3, name: 'c', age: 100, status: 'active' },
    ];
    const { c } = await setup({ rows, pageSize: 10 });
    c.onSort(COLUMNS[1], new MouseEvent('click'));
    expect(c.sortedRows().map((r) => r.age)).toEqual([9, 10, 100]);
  });

  it('emits (sortChange) and resets to page 1 on sort', async () => {
    const spy = vi.fn();
    const { c } = await setup();
    c.sortChange.subscribe(spy);
    c.currentPage.set(2);

    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(spy).toHaveBeenCalledWith([{ key: 'name', direction: 'asc' }]);
    expect(c.currentPage()).toBe(1);
  });

  it('ignores activation on a column that is not sortable', async () => {
    const { c } = await setup();
    c.onSort(COLUMNS[2], new MouseEvent('click'));
    expect(c.sorts()).toEqual([]);
  });

  it('starts a fresh ascending sort when the sorted column changes', async () => {
    const { c } = await setup();
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    c.onSort(COLUMNS[0], new MouseEvent('click')); // name desc
    c.onSort(COLUMNS[1], new MouseEvent('click'));
    expect(c.sorts()).toEqual([{ key: 'age', direction: 'asc' }]);
  });

  it('sorts from a header click and reports it through aria-sort', async () => {
    const { el, fixture } = await setup();
    const nameHeader = headerCells(el)[0];
    expect(nameHeader.getAttribute('aria-sort')).toBe('none');

    nameHeader.click();
    fixture.detectChanges();
    expect(headerCells(el)[0].getAttribute('aria-sort')).toBe('ascending');

    headerCells(el)[0].click();
    fixture.detectChanges();
    expect(headerCells(el)[0].getAttribute('aria-sort')).toBe('descending');
  });

  it('leaves aria-sort off a column that cannot be sorted', async () => {
    // `aria-sort="none"` on an unsortable column tells a screen reader the
    // column is sortable and merely unsorted, which is a dead end.
    const { el } = await setup();
    expect(headerCells(el)[2].hasAttribute('aria-sort')).toBe(false);
  });

  it('puts sortable headers in the tab order and sorts on Enter and Space', async () => {
    const { el, c, fixture } = await setup();
    const nameHeader = headerCells(el)[0];
    expect(nameHeader.getAttribute('tabindex')).toBe('0');

    nameHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(c.sorts()).toEqual([{ key: 'name', direction: 'asc' }]);

    fixture.detectChanges();
    headerCells(el)[0].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(c.sorts()).toEqual([{ key: 'name', direction: 'desc' }]);
  });

  it('ignores other keys on a header', async () => {
    const { el, c } = await setup();
    headerCells(el)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(c.sorts()).toEqual([]);
  });

  it('leaves an unsortable header out of the tab order', async () => {
    const { el, c } = await setup();
    const idHeader = headerCells(el)[2]; // COLUMNS[2] is not sortable
    expect(idHeader.hasAttribute('tabindex')).toBe(false);
    idHeader.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(c.sorts()).toEqual([]);
  });

  it('marks every column with scope="col" so a screen reader can associate cells with headers', async () => {
    const { el } = await setup({
      selectable: true,
      expandable: true,
      actions: [{ label: 'Edit', handler: () => undefined }],
    });
    expect(headerCells(el).every((th) => th.getAttribute('scope') === 'col')).toBe(true);
  });

  describe('multi-column sort', () => {
    it('accumulates sorts on Shift+click when multiSort is on', async () => {
      const { c } = await setup({ multiSort: true });
      c.onSort(COLUMNS[2], new MouseEvent('click', { shiftKey: true })); // not sortable — ignored
      c.onSort(COLUMNS[1], new MouseEvent('click', { shiftKey: true }));
      c.onSort(COLUMNS[0], new MouseEvent('click', { shiftKey: true }));
      expect(c.sorts()).toEqual([
        { key: 'age', direction: 'asc' },
        { key: 'name', direction: 'asc' },
      ]);
    });

    it('cycles a Shift+clicked column asc → desc → removed, keeping the others', async () => {
      const { c } = await setup({ multiSort: true });
      const shift = () => new MouseEvent('click', { shiftKey: true });
      c.onSort(COLUMNS[1], shift());
      c.onSort(COLUMNS[0], shift());
      c.onSort(COLUMNS[0], shift());
      expect(c.sorts()).toEqual([
        { key: 'age', direction: 'asc' },
        { key: 'name', direction: 'desc' },
      ]);
      c.onSort(COLUMNS[0], shift());
      expect(c.sorts()).toEqual([{ key: 'age', direction: 'asc' }]);
    });

    it('applies the sorts in order, the second breaking ties in the first', async () => {
      const rows: Row[] = [
        { id: 1, name: 'Zoe', age: 30, status: 'active' },
        { id: 2, name: 'Adam', age: 30, status: 'active' },
        { id: 3, name: 'Mia', age: 22, status: 'active' },
      ];
      const { c } = await setup({ rows, multiSort: true, pageSize: 10 });
      const shift = () => new MouseEvent('click', { shiftKey: true });
      c.onSort(COLUMNS[1], shift()); // age asc
      c.onSort(COLUMNS[0], shift()); // then name asc
      expect(c.sortedRows().map((r) => r.name)).toEqual(['Mia', 'Adam', 'Zoe']);
    });

    it('numbers each active sort so the priority is visible', async () => {
      const { c, el, fixture } = await setup({ multiSort: true });
      const shift = () => new MouseEvent('click', { shiftKey: true });
      c.onSort(COLUMNS[1], shift());
      c.onSort(COLUMNS[0], shift());
      fixture.detectChanges();

      expect(c.getSortIndex(COLUMNS[1])).toBe(1);
      expect(c.getSortIndex(COLUMNS[0])).toBe(2);
      expect(c.getSortIndex(COLUMNS[2])).toBe(0);
      expect(headerCells(el)[0].textContent).toContain('2');
    });

    it('hides the priority number while only one column is sorted', async () => {
      const { c, el, fixture } = await setup({ multiSort: true });
      c.onSort(COLUMNS[0], new MouseEvent('click', { shiftKey: true }));
      fixture.detectChanges();
      expect(headerCells(el)[0].textContent).not.toContain('1');
    });

    it('replaces the sort instead of accumulating when multiSort is off', async () => {
      const { c } = await setup();
      const shift = () => new MouseEvent('click', { shiftKey: true });
      c.onSort(COLUMNS[1], shift());
      c.onSort(COLUMNS[0], shift());
      expect(c.sorts()).toEqual([{ key: 'name', direction: 'asc' }]);
    });

    it('collapses a multi-sort back to one column on a plain click', async () => {
      const { c } = await setup({ multiSort: true });
      const shift = () => new MouseEvent('click', { shiftKey: true });
      c.onSort(COLUMNS[1], shift());
      c.onSort(COLUMNS[0], shift());
      c.onSort(COLUMNS[0], new MouseEvent('click'));
      // Two sorts were active, so the plain click restarts at ascending rather
      // than continuing the cycle of whichever column happened to be first.
      expect(c.sorts()).toEqual([{ key: 'name', direction: 'asc' }]);
    });
  });

  it('names a distinct sort icon for each of the three header states', async () => {
    const { c } = await setup();
    expect(c.sortIconName(COLUMNS[0])).toBe('chevrons-up-down');
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(c.sortIconName(COLUMNS[0])).toBe('chevron-up');
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(c.sortIconName(COLUMNS[0])).toBe('chevron-down');
  });

  it('names a distinct legacy sort path for each of the three header states', async () => {
    const { c } = await setup();
    expect(c.sortIcon(COLUMNS[0])).toBe('M8 9l4-4 4 4m0 6l-4 4-4-4');
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(c.sortIcon(COLUMNS[0])).toBe('M5 15l7-7 7 7');
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(c.sortIcon(COLUMNS[0])).toBe('M19 9l-7 7-7-7');
    // An unsorted *other* column keeps the neutral glyph.
    expect(c.sortIcon(COLUMNS[1])).toBe('M8 9l4-4 4 4m0 6l-4 4-4-4');
    expect(c.isColumnSorted(COLUMNS[1])).toBe(false);
  });

  it('sorts rows with a missing value to the end regardless of direction', async () => {
    const rows: Row[] = [
      { id: 1, name: 'Charlie', age: 30, status: 'active' },
      { id: 2, name: null as unknown as string, age: 45, status: 'active' },
      { id: 3, name: 'Bob', age: 22, status: 'active' },
    ];
    const { c } = await setup({ rows, pageSize: 10 });
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(c.sortedRows().map((r) => r.id)).toEqual([3, 1, 2]);
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(c.sortedRows().map((r) => r.id)).toEqual([1, 3, 2]);
  });

  it('keeps a column of nothing but nulls in its original order', async () => {
    // Both sides null means "no opinion" — the comparator must `continue`, not
    // return, or the sort becomes an arbitrary shuffle of equal rows.
    const rows: Row[] = [
      { id: 1, name: null as unknown as string, age: 3, status: 'a' },
      { id: 2, name: null as unknown as string, age: 1, status: 'a' },
      { id: 3, name: null as unknown as string, age: 2, status: 'a' },
    ];
    const { c } = await setup({ rows, pageSize: 10 });
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(c.sortedRows().map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('falls through to the next sort key when the first compares equal', async () => {
    const rows: Row[] = [
      { id: 1, name: 'Same', age: 30, status: 'b' },
      { id: 2, name: 'Same', age: 30, status: 'a' },
    ];
    const { c } = await setup({ rows, multiSort: true, pageSize: 10 });
    const shift = () => new MouseEvent('click', { shiftKey: true });
    c.onSort(COLUMNS[0], shift());
    c.onSort(COLUMNS[1], shift());
    // Every declared sort ties; the comparator must return 0 rather than throw
    // or reorder.
    expect(c.sortedRows().map((r) => r.id)).toEqual([1, 2]);
  });

  it('leaves a single row alone — sorting one row is a no-op, not a crash', async () => {
    const { c } = await setup({ rows: [ROWS[0]] });
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(c.sortedRows()).toEqual([ROWS[0]]);
  });

  it('does not mutate the bound rows array while sorting it', async () => {
    // `sortedRows` slices before sorting; without that the host's own array is
    // reordered underneath it, which breaks any `computed` derived from it.
    const rows = [...ROWS];
    const { c } = await setup({ rows, pageSize: 10 });
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(rows.map((r) => r.name)).toEqual(['Charlie', 'Alice', 'Bob']);
  });

  it('reports no aria-sort value for an unsortable column at all', async () => {
    const { c } = await setup();
    expect(c.getSortAria(COLUMNS[2])).toBeNull();
    expect(c.getSortAria(COLUMNS[0])).toBe('none');
  });
});

describe('SvDataTableComponent — pagination', () => {
  it('slices rows to the current page', async () => {
    const { c } = await setup();
    expect(c.totalPages()).toBe(2);
    expect(c.pagedRows()).toHaveLength(2);
    c.goTo(2);
    expect(c.pagedRows()).toHaveLength(1);
  });

  it('clamps goTo within valid page bounds', async () => {
    const { c } = await setup();
    c.goTo(99);
    expect(c.currentPage()).toBe(2);
    c.goTo(-3);
    expect(c.currentPage()).toBe(1);
  });

  it('reports at least one page even with no rows, so the footer is not "Page 1 of 0"', async () => {
    const { c } = await setup({ rows: [] });
    expect(c.totalPages()).toBe(1);
  });

  it('computes a 1-based display range', async () => {
    const { c } = await setup();
    expect(c.rangeStart()).toBe(1);
    expect(c.rangeEnd()).toBe(2);
    c.goTo(2);
    expect(c.rangeStart()).toBe(3);
    expect(c.rangeEnd()).toBe(3);
  });

  it('reports an empty range as 0 rather than 1', async () => {
    const { c } = await setup({ rows: [] });
    expect(c.rangeStart()).toBe(0);
    expect(c.rangeEnd()).toBe(0);
  });

  it('renders every page as a numbered pill and marks the current one', async () => {
    const { el, fixture } = await setup();
    const pills = () => [
      ...el.querySelectorAll<HTMLButtonElement>(
        'nav[aria-label="Table pagination"] button[aria-label^="Page "]',
      ),
    ];
    expect(pills().map((b) => b.textContent?.trim())).toEqual(['1', '2']);
    expect(pills()[0].getAttribute('aria-current')).toBe('page');

    pills()[1].click();
    fixture.detectChanges();
    expect(pills()[1].getAttribute('aria-current')).toBe('page');
    expect(pills()[0].hasAttribute('aria-current')).toBe(false);
  });

  it('collapses a long page list with ellipsis markers around the current page', async () => {
    const rows: Row[] = Array.from({ length: 100 }, (_, i) => ({
      id: i, name: `n${i}`, age: i, status: 'active',
    }));
    const { c } = await setup({ rows, pageSize: 5 });
    expect(c.totalPages()).toBe(20);
    expect(c.pageNumbers()).toEqual([1, 2, -1, 20]);
    c.goTo(10);
    expect(c.pageNumbers()).toEqual([1, -1, 9, 10, 11, -1, 20]);
    // On the last page the trailing ellipsis must not appear — there is nothing
    // beyond it to elide.
    c.goTo(20);
    expect(c.pageNumbers()).toEqual([1, -1, 19, 20]);
  });

  it('drops each ellipsis exactly at the page where it stops eliding anything', async () => {
    // Both boundaries, because both are off-by-one traps: at page 3 the window
    // already reaches page 2, so a leading "…" would stand for nothing; at page
    // `total - 2` the window already reaches `total - 1`, likewise.
    const rows: Row[] = Array.from({ length: 100 }, (_, i) => ({
      id: i, name: `n${i}`, age: i, status: 'active',
    }));
    const { c } = await setup({ rows, pageSize: 5 }); // 20 pages

    c.goTo(3);
    expect(c.pageNumbers()).toEqual([1, 2, 3, 4, -1, 20]);
    c.goTo(4);
    expect(c.pageNumbers()).toEqual([1, -1, 3, 4, 5, -1, 20]);

    c.goTo(18);
    expect(c.pageNumbers()).toEqual([1, -1, 17, 18, 19, 20]);
    c.goTo(17);
    expect(c.pageNumbers()).toEqual([1, -1, 16, 17, 18, -1, 20]);
  });

  it('lists every page without ellipsis while there are seven or fewer', async () => {
    const rows: Row[] = Array.from({ length: 35 }, (_, i) => ({
      id: i, name: `n${i}`, age: i, status: 'active',
    }));
    const { c } = await setup({ rows, pageSize: 5 });
    expect(c.pageNumbers()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('disables first/prev on the first page and next/last on the last', async () => {
    const { el, fixture, c } = await setup();
    const btn = (label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    expect(btn('First page').disabled).toBe(true);
    expect(btn('Previous page').disabled).toBe(true);
    expect(btn('Next page').disabled).toBe(false);

    btn('Last page').click();
    fixture.detectChanges();
    expect(c.currentPage()).toBe(2);
    expect(btn('Next page').disabled).toBe(true);
    expect(btn('Last page').disabled).toBe(true);
    expect(btn('First page').disabled).toBe(false);
  });

  it('changes the page size from the footer select and returns to page 1', async () => {
    const { el, c } = await setup();
    c.goTo(2);
    const select = el.querySelector<HTMLSelectElement>('select[id$="-page-size"]')!;
    select.value = '25';
    select.dispatchEvent(new Event('change'));
    expect(c.pageSize()).toBe(25);
    expect(c.currentPage()).toBe(1);
  });

  it('shows every row and no pagination footer when paginated is off', async () => {
    const { c, el } = await setup({ paginated: false });
    expect(c.pagedRows()).toHaveLength(3);
    expect(el.querySelector('nav[aria-label="Table pagination"]')).toBeNull();
  });

  it('closes an open row menu when the page changes, so it cannot point at a row that has gone', async () => {
    const { c } = await setup({ actions: [{ label: 'Edit', handler: () => undefined }] });
    c.openActionRowId.set(1);
    c.goTo(2);
    expect(c.openActionRowId()).toBeNull();
  });
});

describe('SvDataTableComponent — server-side query contract', () => {
  it('emits the kit-wide SvDataQuery alongside the legacy event', async () => {
    const { c } = await setup({ serverSide: true });
    const queries: SvDataQuery[] = [];
    const legacy: unknown[] = [];
    c.queryChange.subscribe((q) => queries.push(q));
    c.serverPageChange.subscribe((e) => legacy.push(e));

    c.goTo(2);

    expect(legacy).toHaveLength(1);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchObject({ page: 2, pageSize: 2, search: '', cursor: null });
  });

  it('drops unsorted columns rather than emitting a null direction', async () => {
    // `SvSort` deliberately excludes null: an unsorted column is one absent
    // from the array, so no consumer has to filter the array before using it.
    const { c } = await setup({ serverSide: true });
    const queries: SvDataQuery[] = [];
    c.queryChange.subscribe((q) => queries.push(q));

    const click = new MouseEvent('click');
    c.onSort(COLUMNS[0], click);
    c.onSort(COLUMNS[0], click);
    c.onSort(COLUMNS[0], click);

    expect(queries[0].sorts).toEqual([{ key: 'name', direction: 'asc' }]);
    expect(queries[1].sorts).toEqual([{ key: 'name', direction: 'desc' }]);
    expect(queries.at(-1)!.sorts).toEqual([]);
  });

  it('carries the search term and the column filters', async () => {
    const { c } = await setup({ serverSide: true });
    const queries: SvDataQuery[] = [];
    c.queryChange.subscribe((q) => queries.push(q));

    c.setColFilter('name', 'ali');
    expect(queries.at(-1)!.filters).toMatchObject({ name: 'ali' });

    c.searchQuery.set('bob');
    c.clearFilter('name');
    expect(queries.at(-1)!).toMatchObject({ search: 'bob', filters: {} });
  });

  it('re-queries when the page size changes', async () => {
    const { c, el } = await setup({ serverSide: true });
    const queries: SvDataQuery[] = [];
    c.queryChange.subscribe((q) => queries.push(q));
    const select = el.querySelector<HTMLSelectElement>('select[id$="-page-size"]')!;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(queries.at(-1)!).toMatchObject({ page: 1, pageSize: 50 });
  });

  it('re-queries on "Clear all" and on a search keystroke', async () => {
    const { c, el } = await setup({ serverSide: true, searchable: true, showToolbar: true });
    const queries: SvDataQuery[] = [];
    c.queryChange.subscribe((q) => queries.push(q));

    const input = el.querySelector<HTMLInputElement>('input[aria-label="Search table"]')!;
    input.value = 'x';
    input.dispatchEvent(new Event('input'));
    expect(queries.at(-1)!.search).toBe('x');

    c.clearAllFilters();
    expect(queries.at(-1)!).toMatchObject({ search: '', filters: {}, page: 1 });
  });

  it('stays silent when the host owns nothing — client mode emits no query', async () => {
    const { c } = await setup();
    const queries: SvDataQuery[] = [];
    c.queryChange.subscribe((q) => queries.push(q));
    c.goTo(2);
    c.setColFilter('name', 'a');
    c.clearAllFilters();
    c.clearFilter('name');
    expect(queries).toEqual([]);
  });

  it('renders the rows exactly as handed over, without filtering or paging them again', async () => {
    // Double-filtering a server page is the classic server-side bug: the server
    // already applied the search, so re-applying it client-side hides rows the
    // server deliberately returned.
    const { c } = await setup({ serverSide: true, totalCount: 57 });
    c.searchQuery.set('zzz-matches-nothing');
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(c.pagedRows()).toEqual(ROWS);
    expect(c.filteredRows()).toEqual(ROWS);
    expect(c.sortedRows()).toEqual(ROWS);
  });

  it('paginates against the server total, not the rows in hand', async () => {
    const { c } = await setup({ serverSide: true, totalCount: 57 });
    expect(c.totalDisplayCount()).toBe(57);
    expect(c.totalPages()).toBe(29);
  });

  it('falls back to the row count when the server sends no total', async () => {
    const { c } = await setup({ serverSide: true });
    expect(c.totalDisplayCount()).toBe(3);
  });
});
