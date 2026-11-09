import { render } from '@testing-library/angular';
import type { SvDataQuery } from '@styloviz/core/data';
import { SvDataTableComponent, type TableColumn } from './data-table.component';

/**
 * `debounceMs` (FL-I11): typing in the search box or a text column filter asks
 * the server once the typing settles; everything else asks at once and spends
 * whatever was still settling, since it carries the latest terms anyway.
 */

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
}

const COLUMNS: TableColumn<Row>[] = [{ key: 'name', label: 'Name', sortable: true }];
const ROWS: Row[] = [
  { id: 1, name: 'Charlie' },
  { id: 2, name: 'Alice' },
];

async function setup(extra: Record<string, unknown> = {}) {
  const { fixture } = await render(SvDataTableComponent<Row>, {
    inputs: { columns: COLUMNS, rows: ROWS, serverSide: true, searchable: true, columnFilters: true, ...extra },
  });
  const el = fixture.nativeElement as HTMLElement;
  const queries: SvDataQuery[] = [];
  fixture.componentInstance.queryChange.subscribe((q) => queries.push(q));
  const type = (input: HTMLInputElement, value: string): void => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const settle = (ms: number): void => {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  };
  return { fixture, c: fixture.componentInstance, el, queries, type, settle };
}

describe('SvDataTableComponent — debounced typed queries', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('asks once, with the last term, when typing in the search box settles', async () => {
    const { el, queries, type, settle } = await setup();
    const search = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    type(search, 'a');
    type(search, 'al');
    type(search, 'ali');
    settle(299);
    expect(queries).toHaveLength(0);
    settle(1);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchObject({ search: 'ali', page: 1 });
  });

  it('debounces a text column filter the same way', async () => {
    const { el, queries, type, settle } = await setup({ debounceMs: 50 });
    const filter = [...el.querySelectorAll<HTMLInputElement>('thead input')].find((i) => i.type !== 'checkbox')!;
    type(filter, 'b');
    type(filter, 'bo');
    settle(50);
    expect(queries).toHaveLength(1);
    expect(queries[0].filters).toMatchObject({ name: 'bo' });
  });

  it('asks on every keystroke with debounceMs 0', async () => {
    const { el, queries, type } = await setup({ debounceMs: 0 });
    const search = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    type(search, 'a');
    type(search, 'al');
    expect(queries.map((q) => q.search)).toEqual(['a', 'al']);
  });

  it('a sort while typing settles asks once, carrying the term', async () => {
    const { c, el, queries, type, settle } = await setup();
    type(el.querySelector<HTMLInputElement>('input[type="search"]')!, 'ali');
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatchObject({ search: 'ali', sorts: [{ key: 'name', direction: 'asc' }] });
    settle(300);
    expect(queries).toHaveLength(1);
  });

  it('filters the rows on screen on every keystroke, server or not', async () => {
    const { c, el, type } = await setup({ serverSide: false });
    type(el.querySelector<HTMLInputElement>('input[type="search"]')!, 'ali');
    expect(c.filteredRows().map((r) => r.name)).toEqual(['Alice']);
  });
});
