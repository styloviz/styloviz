import { render } from '@testing-library/angular';
import {
  SvDataTableComponent,
  type BulkAction,
  type TableColumn,
  type TableRowAction,
} from './data-table.component';
import type { SvDataError } from '@styloviz/core';

/**
 * ============================================================================
 *  `sv-data-table` (free) — load states, selection, bulk actions, the toolbar
 * ============================================================================
 *
 * Everything here is a *decision the component makes about what to show*:
 * skeleton vs overlay vs rows, empty vs filtered-empty, error instead of stale
 * data, whether the toolbar strip exists at all. The data pipeline itself is in
 * `data-table.pipeline.spec.ts`.
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

function bodyText(el: HTMLElement): string {
  return el.querySelector('tbody')?.textContent ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────

describe('SvDataTableComponent — loading state', () => {
  it('marks the body busy and shows one skeleton row per skeletonRows', async () => {
    const { el } = await setup({ loading: true, skeletonRows: 4 });
    const tbody = el.querySelector('tbody')!;
    expect(tbody.getAttribute('data-sv-state')).toBe('loading');
    // Sighted users see shimmer; `aria-busy` is what everyone else gets.
    expect(tbody.getAttribute('aria-busy')).toBe('true');
    expect(tbody.querySelectorAll('tr')).toHaveLength(4);
    expect(tbody.querySelectorAll('.skeleton-wave').length).toBeGreaterThan(0);
  });

  it('hides the real rows behind the skeleton rather than showing stale data', async () => {
    const { el } = await setup({ loading: true });
    expect(bodyText(el)).not.toContain('Charlie');
  });

  it('gives the skeleton a cell for every rendered column, so the shimmer lines up', async () => {
    const { el } = await setup({ loading: true, skeletonRows: 1, selectable: true, expandable: true });
    const cells = el.querySelectorAll('tbody tr:first-child td');
    expect(cells).toHaveLength(COLUMNS.length + 2);
  });

  it('adds an actions cell to the skeleton when the table has row actions', async () => {
    const { el } = await setup({
      loading: true,
      skeletonRows: 1,
      actions: [{ label: 'Edit', handler: () => undefined }],
    });
    expect(el.querySelectorAll('tbody tr:first-child td')).toHaveLength(COLUMNS.length + 1);
  });

  it('announces the overlay style as a live status instead of drawing skeleton rows', async () => {
    const { el } = await setup({ loading: true, loadingStyle: 'overlay' });
    const status = el.querySelector('[role="status"][aria-label="Loading"]')!;
    expect(status).toBeTruthy();
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(el.querySelectorAll('.skeleton-wave')).toHaveLength(0);
    // The overlay floats over the real rows, which stay readable underneath.
    expect(bodyText(el)).toContain('Charlie');
  });

  it('draws no overlay for the skeleton style', async () => {
    const { el } = await setup({ loading: true, loadingStyle: 'skeleton' });
    expect(el.querySelector('[role="status"][aria-label="Loading"]')).toBeNull();
  });

  it('draws no overlay when nothing is loading', async () => {
    const { el } = await setup({ loadingStyle: 'overlay' });
    expect(el.querySelector('[role="status"][aria-label="Loading"]')).toBeNull();
  });

  it('hides the pagination footer while loading, so nobody pages an empty grid', async () => {
    const { el } = await setup({ loading: true });
    expect(el.querySelector('nav[aria-label="Table pagination"]')).toBeNull();
  });

  it('replaces the skeleton with the rows once loading finishes', async () => {
    const { el, fixture } = await setup({ loading: true });
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    expect(el.querySelector('tbody')!.hasAttribute('data-sv-state')).toBe(false);
    expect(bodyText(el)).toContain('Charlie');
  });
});

describe('SvDataTableComponent — empty state', () => {
  it('shows the empty message when there are no rows at all', async () => {
    const { el } = await setup({ rows: [], emptyMessage: 'No orders yet.' });
    expect(bodyText(el)).toContain('No orders yet.');
  });

  it('defaults to a generic message when none is supplied', async () => {
    const { el } = await setup({ rows: [] });
    expect(bodyText(el)).toContain('No data to display.');
  });

  it('disappears as soon as rows arrive', async () => {
    const { el, fixture } = await setup({ rows: [] });
    expect(bodyText(el)).toContain('No data to display.');

    fixture.componentRef.setInput('rows', ROWS);
    fixture.detectChanges();
    expect(bodyText(el)).not.toContain('No data to display.');
    expect(bodyText(el)).toContain('Charlie');
  });

  it('shows the empty row on a page beyond the last, rather than a blank grid', async () => {
    // `goTo` clamps, but a host binding `currentPage` past the end still lands
    // on an out-of-range slice — the empty branch must catch it.
    const { c, el, fixture } = await setup();
    c.currentPage.set(9);
    fixture.detectChanges();
    expect(c.pagedRows()).toEqual([]);
    expect(bodyText(el)).toContain('No data to display.');
  });

  it('spans the empty cell across every rendered column', async () => {
    const { el, c } = await setup({
      rows: [],
      selectable: true,
      expandable: true,
      actions: [{ label: 'Edit', handler: () => undefined }],
    });
    expect(c.totalColspan()).toBe(COLUMNS.length + 3);
    expect(el.querySelector('tbody td')!.getAttribute('colspan')).toBe(String(COLUMNS.length + 3));
  });

  it('counts only the columns actually on screen in the colspan', async () => {
    const { c } = await setup({ rows: [] });
    expect(c.totalColspan()).toBe(3);
    c.toggleColumnVisibility('age');
    expect(c.totalColspan()).toBe(2);
  });

  it('offers a way out when the emptiness was caused by a filter', async () => {
    // Without this the user sees "No data to display." over a dataset that is
    // not empty, and no clue that their own filter is why.
    const { el, c, fixture } = await setup();
    c.setColFilter('name', 'nobody');
    fixture.detectChanges();
    expect(bodyText(el)).toContain('No data to display.');

    const clear = [...el.querySelectorAll<HTMLButtonElement>('tbody button')].find(
      (b) => b.textContent?.trim() === 'Clear filters',
    )!;
    expect(clear).toBeTruthy();
    clear.click();
    fixture.detectChanges();
    expect(bodyText(el)).toContain('Charlie');
  });

  it('offers no "Clear filters" escape hatch when nothing is filtered', async () => {
    const { el } = await setup({ rows: [] });
    expect(bodyText(el)).not.toContain('Clear filters');
  });
});

describe('SvDataTableComponent — load failure', () => {
  it('renders the error in place of the rows', async () => {
    const { el } = await setup({ rows: [], error: 'Upstream is down' });
    expect(el.querySelector('[data-sv-state="error"]')).toBeTruthy();
    expect(el.textContent).toContain('Upstream is down');
    expect(el.querySelector('table')).toBeNull();
  });

  it('does not fall back to the rows it still holds', async () => {
    // Showing yesterday's rows under a failed refresh is worse than showing
    // nothing: the user cannot tell the data is stale and will act on it.
    const { el } = await setup({ rows: ROWS, error: 'Upstream is down' });
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).not.toContain('Charlie');
    expect(el.textContent).not.toContain('Alice');
  });

  it('wins over the loading state — a failed load is not still loading', async () => {
    const { el } = await setup({ rows: [], error: 'Boom', loading: true });
    expect(el.querySelector('[data-sv-state="error"]')).toBeTruthy();
    expect(el.querySelector('[data-sv-state="loading"]')).toBeNull();
  });

  it('keeps the toolbar, so the filter that caused it can still be undone', async () => {
    const { el } = await setup({ rows: [], error: 'Boom', showToolbar: true, tableTitle: 'Orders' });
    expect(el.textContent).toContain('Orders');
  });

  it('keeps the active-filter chips visible above the failure', async () => {
    const { el, c, fixture } = await setup({ rows: [], error: 'Boom' });
    c.setColFilter('status', 'active');
    fixture.detectChanges();
    expect(el.textContent).toContain('Active filters:');
  });

  it('hides the pagination footer, which would page nothing', async () => {
    const { el } = await setup({ rows: ROWS, error: 'Boom' });
    expect(el.querySelector('nav[aria-label="Table pagination"]')).toBeNull();
  });

  it('offers retry as a real focusable button, not a line of text', async () => {
    const { el } = await setup({ rows: [], error: 'Boom' });
    const shell = el.querySelector('[data-sv-state="error"]')!;
    const button = shell.querySelector('button')!;
    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(button.disabled).toBe(false);
    expect(button.tabIndex).toBe(0);
    expect(button.textContent?.trim()).toBe('Try again');
  });

  it('emits (retry) when that button is pressed', async () => {
    const { el, c } = await setup({ rows: [], error: 'Boom' });
    const seen: number[] = [];
    c.retry.subscribe(() => seen.push(1));
    el.querySelector<HTMLButtonElement>('[data-sv-state="error"] button')!.click();
    expect(seen).toEqual([1]);
  });

  it('announces the failure rather than silently swapping the spinner out', async () => {
    const { el } = await setup({ rows: [], error: 'Boom' });
    expect(el.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('offers no retry for a failure that cannot succeed on retry', async () => {
    // A 404 will 404 again; a button that always fails trains people to stop
    // trusting the button.
    const error: SvDataError = { message: 'Not found', status: 404, retryable: false };
    const { el } = await setup({ rows: [], error });
    const shell = el.querySelector('[data-sv-state="error"]')!;
    expect(shell.textContent).toContain('Not found');
    expect(shell.querySelector('button')).toBeNull();
  });

  it('shows the status code beside the message when the error carries one', async () => {
    const error: SvDataError = { message: 'Server error', status: 503, retryable: true };
    const { el } = await setup({ rows: [], error });
    expect(el.querySelector('[data-sv-state="error"]')!.textContent).toContain('503');
  });

  it('clears back to the table once the retry succeeds', async () => {
    const { el, fixture } = await setup({ rows: [], error: 'Boom' });
    fixture.componentRef.setInput('error', null);
    fixture.componentRef.setInput('rows', ROWS);
    fixture.detectChanges();
    expect(el.querySelector('[data-sv-state="error"]')).toBeNull();
    expect(bodyText(el)).toContain('Charlie');
  });
});

describe('SvDataTableComponent — selection', () => {
  it('is not selectable until asked', async () => {
    const { el } = await setup();
    expect(el.querySelector('tbody input[aria-label="Select row"]')).toBeNull();
  });

  it('renders a checkbox per row in multi mode and toggles it', async () => {
    const { el, c } = await setup({ selectable: true });
    const boxes = el.querySelectorAll<HTMLInputElement>('tbody input[aria-label="Select row"]');
    expect(boxes).toHaveLength(2);
    expect(boxes[0].type).toBe('checkbox');

    const seen: Set<string | number>[] = [];
    c.selectionChange.subscribe((s) => seen.push(s));

    boxes[0].click();
    expect([...c.selectedIds()]).toEqual([1]);
    boxes[1].click();
    expect([...c.selectedIds()]).toEqual([1, 2]);
    boxes[0].click();
    expect([...c.selectedIds()]).toEqual([2]);
    expect(seen).toHaveLength(3);
  });

  it('renders radios in single mode and lets only one row be selected', async () => {
    const { el, c } = await setup({ selectable: true, selectMode: 'single' });
    const radios = el.querySelectorAll<HTMLInputElement>('tbody input[aria-label="Select row"]');
    expect(radios[0].type).toBe('radio');

    c.toggleRow(ROWS[0]);
    c.toggleRow(ROWS[1]);
    expect([...c.selectedIds()]).toEqual([2]);
  });

  it('deselects the selected row in single mode when it is chosen again', async () => {
    const { c } = await setup({ selectable: true, selectMode: 'single' });
    c.toggleRow(ROWS[0]);
    c.toggleRow(ROWS[0]);
    expect([...c.selectedIds()]).toEqual([]);
  });

  it('omits the select-all box in single mode, where it has no meaning', async () => {
    const { el, c } = await setup({ selectable: true, selectMode: 'single' });
    expect(el.querySelector('thead input[aria-label="Select all rows on this page"]')).toBeNull();
    c.toggleAll();
    expect([...c.selectedIds()]).toEqual([]);
  });

  it('selects and clears only the rows on the current page', async () => {
    // A "select all" that quietly grabs rows the user cannot see turns a bulk
    // delete into a much bigger delete than they authorised.
    const { el, c, fixture } = await setup({ selectable: true });
    const selectAll = el.querySelector<HTMLInputElement>(
      'thead input[aria-label="Select all rows on this page"]',
    )!;

    selectAll.click();
    expect([...c.selectedIds()]).toEqual([1, 2]);
    expect(c.allSelected()).toBe(true);

    c.goTo(2);
    fixture.detectChanges();
    expect(c.allSelected()).toBe(false);
    c.toggleAll();
    expect([...c.selectedIds()]).toEqual([1, 2, 3]);

    c.toggleAll();
    expect([...c.selectedIds()]).toEqual([1, 2]);
  });

  it('reports a partial page selection as indeterminate, not as unchecked', async () => {
    const { el, c, fixture } = await setup({ selectable: true });
    c.toggleRow(ROWS[0]);
    fixture.detectChanges();
    expect(c.someSelected()).toBe(true);
    expect(c.allSelected()).toBe(false);
    const selectAll = el.querySelector<HTMLInputElement>(
      'thead input[aria-label="Select all rows on this page"]',
    )!;
    expect(selectAll.indeterminate).toBe(true);
    expect(selectAll.checked).toBe(false);
  });

  it('reports a fully selected page as neither partial nor indeterminate', async () => {
    const { c } = await setup({ selectable: true });
    c.toggleAll();
    expect(c.allSelected()).toBe(true);
    expect(c.someSelected()).toBe(false);
  });

  it('treats an empty page as unselected rather than fully selected', async () => {
    // `[].every()` is true, so a naive allSelected would tick the header box on
    // an empty table.
    const { c } = await setup({ rows: [], selectable: true });
    expect(c.allSelected()).toBe(false);
    expect(c.someSelected()).toBe(false);
  });

  it('clears the whole selection and says so', async () => {
    const { c } = await setup({ selectable: true });
    c.toggleAll();
    const seen: Set<string | number>[] = [];
    c.selectionChange.subscribe((s) => seen.push(s));
    c.clearSelection();
    expect([...c.selectedIds()]).toEqual([]);
    expect(seen[0].size).toBe(0);
  });

  it('identifies rows by the configured rowKey', async () => {
    const { c } = await setup({ rowKey: 'name' });
    expect(c.getRowId(ROWS[0])).toBe('Charlie');
  });

  it('falls back to the row index when the key column is missing', async () => {
    // Without a fallback every keyless row shares the id `undefined`, so selecting
    // one selects all of them. The fallback is the row's position (audit item X-6);
    // it used to be `JSON.stringify(row)`, which ran per row on every change
    // detection and handed two rows with equal content the *same* key — a duplicate
    // track key dressed up as an identity.
    const { c } = await setup({ rowKey: 'missing' });
    expect(c.getRowId(ROWS[0])).toBe(0);
    expect(c.getRowId(ROWS[1])).toBe(1);
  });

  it('keeps two keyless rows apart', async () => {
    const rows = [
      { name: 'a', age: 1, status: 'active' },
      { name: 'b', age: 2, status: 'active' },
    ] as unknown as Row[];
    const { c } = await setup({ rows, rowKey: 'id', selectable: true, pageSize: 10 });
    c.toggleRow(rows[0]);
    expect(c.isSelected(rows[0])).toBe(true);
    expect(c.isSelected(rows[1])).toBe(false);
  });

  it('tints the selected row so it does not read as an ordinary one', async () => {
    const { c } = await setup({ selectable: true });
    c.toggleRow(ROWS[0]);
    expect(c.getRowClass(ROWS[0], 0)).toContain('!bg-primary-50/60 dark:!bg-primary-950/25');
    expect(c.getRowClass(ROWS[1], 1)).not.toContain('!bg-primary-50/60 dark:!bg-primary-950/25');
    // An unselected row keeps its hover affordance; a selected one drops it so
    // the hover tint cannot fight the selection tint.
    expect(c.getRowClass(ROWS[1], 1)).toContain('hover:bg-gray-50/80 dark:hover:bg-gray-800/50');
    expect(c.getRowClass(ROWS[0], 0)).not.toContain('hover:bg-gray-50/80 dark:hover:bg-gray-800/50');
  });
});

describe('SvDataTableComponent — bulk actions', () => {
  const BULK: BulkAction[] = [
    { label: 'Archive' },
    { label: 'Delete', danger: true },
  ];

  it('stays hidden until something is selected', async () => {
    const { el } = await setup({ selectable: true, bulkActions: BULK });
    expect(el.textContent).not.toContain('rows selected');
  });

  it('stays hidden when rows are selected but no bulk action exists', async () => {
    const { el, c, fixture } = await setup({ selectable: true });
    c.toggleRow(ROWS[0]);
    fixture.detectChanges();
    expect(el.textContent).not.toContain('row selected');
  });

  it('appears with a singular then a plural count once rows are selected', async () => {
    const { el, c, fixture } = await setup({ selectable: true, bulkActions: BULK });
    c.toggleRow(ROWS[0]);
    fixture.detectChanges();
    expect(el.textContent).toContain('row selected');
    expect(el.textContent).not.toContain('rows selected');

    c.toggleRow(ROWS[1]);
    fixture.detectChanges();
    expect(el.textContent).toContain('rows selected');
  });

  it('hands the selected ids to the action handler and reports the click', async () => {
    const handler = vi.fn();
    const actions: BulkAction[] = [{ label: 'Archive', handler }];
    const { el, c, fixture } = await setup({ selectable: true, bulkActions: actions });
    c.toggleRow(ROWS[0]);
    fixture.detectChanges();

    const emitted: { action: BulkAction; selectedIds: Set<string | number> }[] = [];
    c.bulkActionClick.subscribe((e) => emitted.push(e));

    [...el.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.trim() === 'Archive')!
      .click();

    expect(handler).toHaveBeenCalledWith(new Set([1]));
    expect(emitted[0].action.label).toBe('Archive');
    expect([...emitted[0].selectedIds]).toEqual([1]);
  });

  it('still reports the click when the action carries no inline handler', async () => {
    const { c } = await setup({ selectable: true, bulkActions: BULK });
    c.toggleRow(ROWS[0]);
    const emitted: { action: BulkAction }[] = [];
    c.bulkActionClick.subscribe((e) => emitted.push(e));
    c.runBulkAction(BULK[0]);
    expect(emitted[0].action).toBe(BULK[0]);
  });

  it('renders an icon only for the actions that declare one', async () => {
    const actions: BulkAction[] = [{ label: 'Archive', icon: 'package' }, { label: 'Delete' }];
    const { el, c, fixture } = await setup({ selectable: true, bulkActions: actions });
    c.toggleRow(ROWS[0]);
    fixture.detectChanges();
    const bar = el.querySelector<HTMLElement>('[aria-label="Clear selection"]')!.parentElement!;
    expect(bar.querySelectorAll('svg')).toHaveLength(1);
  });

  it('clears the selection from the bulk bar', async () => {
    const { el, c, fixture } = await setup({ selectable: true, bulkActions: BULK });
    c.toggleRow(ROWS[0]);
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('button[aria-label="Clear selection"]')!.click();
    expect(c.selectedIds().size).toBe(0);
  });
});

describe('SvDataTableComponent — toolbar', () => {
  it('derives itself from having content, so a bare tableTitle is not a silent no-op', async () => {
    const { el } = await setup({ tableTitle: 'Orders' });
    expect(el.querySelector('h3')?.textContent).toBe('Orders');
  });

  it('appears for a searchable table with no title', async () => {
    const { el } = await setup({ searchable: true });
    expect(el.querySelector('input[aria-label="Search table"]')).toBeTruthy();
  });

  it('stays away when there is nothing to put in it', async () => {
    const { el } = await setup();
    expect(el.querySelector('h3')).toBeNull();
    expect(el.querySelector('input[aria-label="Search table"]')).toBeNull();
  });

  it('can be forced on as an empty spacer strip', async () => {
    const { el } = await setup({ showToolbar: true });
    // Nothing but the row-count badge, which is always in the strip.
    expect(el.querySelector('h3')).toBeNull();
    expect(el.textContent).toContain('3');
  });

  /**
   * ★ REGRESSION. `showToolbar` documents that setting it to `false` leaves
   * "a title used only as the accessible name" — but the free template never
   * put `tableTitle` anywhere once the strip was suppressed, so the promise was
   * a no-op and the table had no accessible name at all. The Pro twin carries
   * `[attr.aria-label]="tableTitle() || null"` on the `<table>`; the free one
   * did not. Fixed by adding the same binding.
   */
  it('★ names the table for a screen reader when the toolbar is forced off', async () => {
    const { el } = await setup({ tableTitle: 'Orders', showToolbar: false });
    expect(el.querySelector('h3')).toBeNull();
    expect(el.querySelector('table')!.getAttribute('aria-label')).toBe('Orders');
  });

  it('gives the table no aria-label when there is no title to name it with', async () => {
    // An empty `aria-label` is worse than none: it overrides any name the host
    // may have supplied on the element.
    const { el } = await setup();
    expect(el.querySelector('table')!.hasAttribute('aria-label')).toBe(false);
  });

  it('shows the filtered row count, not the raw one', async () => {
    const { c, fixture } = await setup({ tableTitle: 'Orders' });
    c.setColFilter('status', 'pending');
    fixture.detectChanges();
    expect(c.totalDisplayCount()).toBe(1);
  });
});

describe('SvDataTableComponent — row events', () => {
  it('emits (rowClick) for the clicked row', async () => {
    const { el, c } = await setup();
    const seen: Row[] = [];
    c.rowClick.subscribe((r) => seen.push(r));
    el.querySelector<HTMLTableRowElement>('tbody tr')!.click();
    expect(seen).toEqual([ROWS[0]]);
  });

  it('emits (cellClick) with the resolved value, and the row alongside it', async () => {
    const { el, c } = await setup();
    const cells: { value: string; key: string }[] = [];
    const rows: Row[] = [];
    c.cellClick.subscribe((e) => cells.push({ value: e.value, key: e.column.key }));
    c.rowClick.subscribe((r) => rows.push(r));

    el.querySelector<HTMLTableCellElement>('tbody tr td')!.click();
    expect(cells).toEqual([{ value: 'Charlie', key: 'name' }]);
    expect(rows).toEqual([ROWS[0]]);
  });
});

describe('SvDataTableComponent — row actions', () => {
  it('renders no actions column when there are no actions', async () => {
    const { el } = await setup();
    expect(el.querySelector('button[aria-label="Row actions"]')).toBeNull();
  });

  it('opens one row menu at a time and runs the chosen action on that row', async () => {
    const edit = vi.fn();
    const actions: TableRowAction<Row>[] = [
      { label: 'Edit', handler: edit },
      { label: 'Delete', handler: () => undefined, danger: true },
    ];
    const { el, c, fixture } = await setup({ actions });

    const triggers = [...el.querySelectorAll<HTMLButtonElement>('button[aria-label="Row actions"]')];
    expect(triggers).toHaveLength(2);
    expect(triggers[0].getAttribute('aria-expanded')).toBe('false');

    triggers[0].click();
    fixture.detectChanges();
    expect(c.isActionMenuOpen(ROWS[0])).toBe(true);

    [...el.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.trim() === 'Edit')!
      .click();
    fixture.detectChanges();
    expect(edit).toHaveBeenCalledWith(ROWS[0]);
    // The menu must close, or the next click lands on a stale overlay.
    expect(c.openActionRowId()).toBeNull();
  });

  it('switches the open menu when a second row is activated', async () => {
    const actions: TableRowAction<Row>[] = [{ label: 'Edit', handler: () => undefined }];
    const { el, c, fixture } = await setup({ actions });
    const triggers = () => [...el.querySelectorAll<HTMLButtonElement>('button[aria-label="Row actions"]')];

    triggers()[0].click();
    fixture.detectChanges();
    triggers()[1].click();
    fixture.detectChanges();
    expect(c.isActionMenuOpen(ROWS[0])).toBe(false);
    expect(c.isActionMenuOpen(ROWS[1])).toBe(true);

    triggers()[1].click();
    fixture.detectChanges();
    expect(c.openActionRowId()).toBeNull();
  });

  it('hides an action for the rows it does not apply to', async () => {
    const actions: TableRowAction<Row>[] = [
      { label: 'Edit', handler: () => undefined },
      { label: 'Approve', handler: () => undefined, hidden: (row) => row.status !== 'pending' },
    ];
    const { c } = await setup({ actions });
    expect(c.visibleActions(ROWS[0]).map((a) => a.label)).toEqual(['Edit']);
    expect(c.visibleActions(ROWS[1]).map((a) => a.label)).toEqual(['Edit', 'Approve']);
  });

  it('renders no trigger at all for a row whose every action is hidden', async () => {
    const actions: TableRowAction<Row>[] = [
      { label: 'Approve', handler: () => undefined, hidden: (row) => row.status !== 'pending' },
    ];
    const { el, c } = await setup({ actions });
    expect(c.visibleActions(ROWS[0])).toEqual([]);
    // Row 1 (Charlie) is active, row 2 (Alice) is pending — one trigger only.
    expect(el.querySelectorAll('button[aria-label="Row actions"]')).toHaveLength(1);
  });

  it('closes every open menu at once', async () => {
    const actions: TableRowAction<Row>[] = [{ label: 'Edit', handler: () => undefined }];
    const { c } = await setup({ actions, showColumnToggle: true, showToolbar: true });
    c.openActionRowId.set(1);
    c.columnToggleOpen.set(true);
    c.closeAllMenus();
    expect(c.openActionRowId()).toBeNull();
    expect(c.columnToggleOpen()).toBe(false);
  });
});
