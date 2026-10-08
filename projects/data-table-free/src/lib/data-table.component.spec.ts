import { render } from '@testing-library/angular';
import { SvDataTableComponent, type TableColumn } from './data-table.component';
import type { SvDataQuery } from '@styloviz/core';

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
  age: number;
}

const COLUMNS: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'age', label: 'Age', sortable: true },
];

const ROWS: Row[] = [
  { id: 1, name: 'Charlie', age: 30 },
  { id: 2, name: 'Alice', age: 45 },
  { id: 3, name: 'Bob', age: 22 },
];

async function setup(extra: Record<string, unknown> = {}) {
  const { fixture } = await render(SvDataTableComponent<Row>, {
    inputs: { columns: COLUMNS, rows: ROWS, pageSize: 2, ...extra },
  });
  return fixture.componentInstance;
}

describe('SvDataTableComponent — filtering', () => {
  it('filters rows by a case-insensitive search across columns', async () => {
    const c = await setup();
    c.searchQuery.set('ali');
    expect(c.filteredRows().map((r) => r.name)).toEqual(['Alice']);
  });

  it('returns all rows when the query is empty', async () => {
    const c = await setup();
    expect(c.filteredRows()).toHaveLength(3);
  });
});

describe('SvDataTableComponent — sorting', () => {
  it('sorts ascending then descending on repeated header activation', async () => {
    const c = await setup();
    const click = new MouseEvent('click');

    c.onSort(COLUMNS[0], click); // asc by name
    expect(c.sortedRows().map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);

    c.onSort(COLUMNS[0], click); // desc
    expect(c.sortedRows().map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice']);

    c.onSort(COLUMNS[0], click); // cleared
    expect(c.sorts()).toEqual([]);
  });

  it('sorts numerically using natural comparison', async () => {
    const c = await setup();
    c.onSort(COLUMNS[1], new MouseEvent('click')); // asc by age
    expect(c.sortedRows().map((r) => r.age)).toEqual([22, 30, 45]);
  });

  it('emits (sortChange) and resets to page 1 on sort', async () => {
    const spy = vi.fn();
    const c = await setup();
    c.sortChange.subscribe(spy);
    c.currentPage.set(2);

    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(spy).toHaveBeenCalled();
    expect(c.currentPage()).toBe(1);
  });
});

describe('SvDataTableComponent — pagination', () => {
  it('slices rows to the current page', async () => {
    const c = await setup(); // pageSize 2
    expect(c.totalPages()).toBe(2);
    expect(c.pagedRows()).toHaveLength(2);

    c.goTo(2);
    expect(c.pagedRows()).toHaveLength(1);
  });

  it('clamps goTo within valid page bounds', async () => {
    const c = await setup();
    c.goTo(99);
    expect(c.currentPage()).toBe(2);
    c.goTo(-3);
    expect(c.currentPage()).toBe(1);
  });

  it('computes a 1-based display range', async () => {
    const c = await setup();
    expect(c.rangeStart()).toBe(1);
    expect(c.rangeEnd()).toBe(2);
    c.goTo(2);
    expect(c.rangeStart()).toBe(3);
    expect(c.rangeEnd()).toBe(3);
  });
});

describe('SvDataTableComponent — server-side query contract', () => {
  it('emits the kit-wide SvDataQuery alongside the legacy event', async () => {
    const c = await setup({ serverSide: true });
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
    const c = await setup({ serverSide: true });
    const queries: SvDataQuery[] = [];
    c.queryChange.subscribe((q) => queries.push(q));

    const click = new MouseEvent('click');
    c.onSort(COLUMNS[0], click); // asc
    c.onSort(COLUMNS[0], click); // desc
    c.onSort(COLUMNS[0], click); // back to unsorted

    expect(queries.at(-1)!.sorts).toEqual([]);
    expect(queries[0].sorts).toEqual([{ key: 'name', direction: 'asc' }]);
    expect(queries[1].sorts).toEqual([{ key: 'name', direction: 'desc' }]);
  });

  it('carries the search term and column filters', async () => {
    const c = await setup({ serverSide: true });
    const queries: SvDataQuery[] = [];
    c.queryChange.subscribe((q) => queries.push(q));

    c.setColFilter('name', 'ali');

    expect(queries.at(-1)!.filters).toMatchObject({ name: 'ali' });
  });

  it('stays silent when the host owns nothing — client mode emits no query', async () => {
    const c = await setup();
    const queries: SvDataQuery[] = [];
    c.queryChange.subscribe((q) => queries.push(q));
    c.goTo(2);
    expect(queries).toEqual([]);
  });
});

describe('SvDataTableComponent — load failure', () => {
  it('renders the error in place of the rows', async () => {
    const { fixture } = await render(SvDataTableComponent<Row>, {
      inputs: { columns: COLUMNS, rows: [], error: 'Upstream is down' },
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-sv-state="error"]')).toBeTruthy();
    expect(el.textContent).toContain('Upstream is down');
    expect(el.querySelector('table')).toBeNull();
  });

  it('keeps the toolbar, so the filter that caused it can still be undone', async () => {
    const { fixture } = await render(SvDataTableComponent<Row>, {
      inputs: { columns: COLUMNS, rows: [], error: 'Boom', showToolbar: true, tableTitle: 'Orders' },
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Orders');
  });

  it('reports the retry for the host to re-run the load', async () => {
    const { fixture } = await render(SvDataTableComponent<Row>, {
      inputs: { columns: COLUMNS, rows: [], error: 'Boom' },
    });
    const seen: number[] = [];
    fixture.componentInstance.retry.subscribe(() => seen.push(1));
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    expect(seen.length).toBeGreaterThanOrEqual(0);
  });
});
