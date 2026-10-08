import { render } from '@testing-library/angular';
import { SvDataTableComponent, type ServerPageEvent, type TableColumn } from './data-table.component';

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
  age: number;
  status: string;
}

const COLUMNS: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'age', label: 'Age', sortable: true },
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
  return { c: fixture.componentInstance, fixture, el: fixture.nativeElement as HTMLElement };
}

/**
 * DD-09-I2 — response ordering, ported from the Pro table. The table renders a
 * server page verbatim, so a late response to an older query must be droppable.
 */
describe('SvDataTableComponent (free) — server response ordering', () => {
  it('stamps every rendered-control request with an id that only ever goes up', async () => {
    const { c, fixture, el } = await setup({ serverSide: true });
    const ids: (number | undefined)[] = [];
    c.serverPageChange.subscribe((e: ServerPageEvent) => ids.push(e.requestId));

    // Drive it through the rendered sort headers, not just the API.
    const headers = el.querySelectorAll<HTMLElement>('thead [aria-sort]');
    expect(headers.length).toBeGreaterThan(0);
    headers[0].click();
    fixture.detectChanges();
    c.goTo(2);
    c.setColFilter('name', 'a');

    expect(ids).toEqual([1, 2, 3]);
    expect(c.serverRequestId()).toBe(3);
  });

  it('refuses a response that a newer request has already superseded', async () => {
    const { c } = await setup({ serverSide: true });
    const ids: number[] = [];
    c.serverPageChange.subscribe(e => ids.push(e.requestId ?? -1));

    c.onSort(COLUMNS[0], new MouseEvent('click'));
    c.onSort(COLUMNS[1], new MouseEvent('click'));

    expect(c.acceptsResponse(ids[0])).toBe(false);
    expect(c.acceptsResponse(ids[1])).toBe(true);
  });

  it('exposes the same id to a queryChange handler, which runs with the emission', async () => {
    const { c } = await setup({ serverSide: true });
    const fromEvent: (number | undefined)[] = [];
    const fromSignal: number[] = [];
    c.serverPageChange.subscribe(e => fromEvent.push(e.requestId));
    c.queryChange.subscribe(() => fromSignal.push(c.serverRequestId()));

    c.goTo(2);
    c.goTo(1);

    expect(fromSignal).toEqual(fromEvent);
  });

  it('issues no id at all in client mode', async () => {
    const { c } = await setup();
    c.goTo(2);
    expect(c.serverRequestId()).toBe(0);
  });
});

/** DD-09-I4 — inline edit validation, ported from the Pro table. */
describe('SvDataTableComponent (free) — edit validation', () => {
  const EDITABLE: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', editable: true },
    {
      key: 'age', label: 'Age', editable: true,
      validate: v => (/^\d+$/.test(v) ? null : 'Whole numbers only'),
    },
  ];

  async function editing(key = 'age') {
    const harness = await setup({ columns: EDITABLE, rows: ROWS });
    const col = EDITABLE.find(c => c.key === key)!;
    harness.c.startEdit(ROWS[0], col, new MouseEvent('dblclick'));
    harness.fixture.detectChanges();
    return { ...harness, col };
  }

  it('marks the rendered editor invalid, describes it, and announces the message', async () => {
    const { c, fixture, el } = await editing();
    const input = el.querySelector<HTMLInputElement>('tbody input[type="text"]')!;
    input.value = '30x';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(c.editError()).toBe('Whole numbers only');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(c.editErrorId);
    const msg = el.querySelector(`#${c.editErrorId}`)!;
    expect(msg.getAttribute('aria-live')).toBe('polite');
    expect(msg.textContent).toContain('Whole numbers only');
  });

  it('leaves the editor unmarked while the value is fine', async () => {
    const { c, el } = await editing();
    const input = el.querySelector<HTMLInputElement>('tbody input[type="text"]')!;
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(el.querySelector(`#${c.editErrorId}`)!.textContent!.trim()).toBe('');
  });

  it('commits a valid value on Enter and closes', async () => {
    const { c, fixture, el, col } = await editing();
    const commits: unknown[] = [];
    c.editComplete.subscribe(e => commits.push(e));

    const input = el.querySelector<HTMLInputElement>('tbody input[type="text"]')!;
    input.value = '31';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(commits).toEqual([{ row: ROWS[0], column: col, oldValue: '30', newValue: '31' }]);
    expect(c.editingCell()).toBeNull();
    expect(el.querySelector('tbody input[type="text"]')).toBeNull();
  });

  it('refuses to commit an invalid value on Enter and keeps the editor open', async () => {
    const { c, fixture, el } = await editing();
    const commits: unknown[] = [];
    c.editComplete.subscribe(e => commits.push(e));

    const input = el.querySelector<HTMLInputElement>('tbody input[type="text"]')!;
    input.value = 'thirty';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(commits).toEqual([]);
    expect(c.editingCell()).not.toBeNull();
    expect(el.querySelector('tbody input[type="text"]')).not.toBeNull();
  });

  it('lets Escape out of an invalid value', async () => {
    const { c } = await editing();
    c.editDraft.set('thirty');
    c.cancelEdit();
    expect(c.editingCell()).toBeNull();
  });

  it('validates against the row being edited, not the first one', async () => {
    const { c, fixture } = await setup({
      columns: [{
        key: 'name', label: 'Name', editable: true,
        validate: (v: string, row: Row) => (v === row.status ? null : `must equal ${row.status}`),
      }] as TableColumn<Row>[],
      rows: ROWS,
    });
    c.startEdit(ROWS[1], c.columns()[0], new MouseEvent('dblclick'));
    fixture.detectChanges();

    expect(c.editError()).toBe('must equal pending');
    c.editDraft.set('pending');
    expect(c.editError()).toBeNull();
  });
});
