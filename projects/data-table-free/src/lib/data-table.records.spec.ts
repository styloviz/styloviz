import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvDataTableComponent, type TableColumn, type TableRowAction } from './data-table.component';

/**
 * `responsive="records"` — the table becomes a list of records when there is
 * no room to be a table. FL-C13 folded the 1.x `sv-record-grid` into the data
 * table; these are its guarantees, now against the table itself.
 *
 * ★★★ The usual responsive table is a lie told in CSS: `display: block` drops
 * the table roles and `::before` labels are text nobody can select or copy.
 * The other common answer hides the columns that do not fit. This does
 * neither: a real list of `<dl>` records, nothing dropped.
 */

const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Customer' },
  { key: 'status', label: 'Status' },
  { key: 'total', label: 'Total', sortable: true },
  { key: 'ref', label: 'Reference', priority: 'secondary' },
  { key: 'opened', label: 'Opened', priority: 'secondary' },
  { key: 'internal', label: 'Internal', hidden: true },
];

const ROWS = [
  { id: 'r1', name: 'Ada Lovelace', status: 'Shipped', total: 42, ref: 'ORD-1', opened: 'Monday', internal: 'x' },
  { id: 'r2', name: 'Grace Hopper', status: 'Packing', total: 18, ref: 'ORD-2', opened: 'Tuesday', internal: 'y' },
];

async function table(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDataTableComponent, {
    inputs: { columns: COLUMNS, rows: ROWS, responsive: 'records', recordView: 'always', ...inputs },
  });
  fixture.detectChanges();
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const records = (f: { nativeElement: unknown }) => el(f).querySelectorAll('[data-sv-record]');
const terms = (f: { nativeElement: unknown }) => [...el(f).querySelectorAll('[data-sv-record] dt')].map((n) => n.textContent?.trim());
const titles = (f: { nativeElement: unknown }) => [...el(f).querySelectorAll('[data-sv-record] h3')].map((h) => h.textContent?.trim());

describe('sv-data-table responsive="records" — a real list of records', () => {
  it('renders one record per row, as a list, and no table', async () => {
    const f = await table();
    expect(el(f).querySelector('[data-sv-records]')?.getAttribute('role')).toBe('list');
    expect(records(f)).toHaveLength(2);
    expect(el(f).querySelector('table')).toBeNull();
  });

  it('uses real label/value pairs', async () => {
    const f = await table();
    const first = records(f)[0];
    expect(first.querySelector('dt')?.textContent?.trim()).toBe('Status');
    expect(first.querySelector('dd')?.textContent?.trim()).toBe('Shipped');
  });

  it('gives each record a heading, and names the article by it', async () => {
    const f = await table();
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    const article = records(f)[0];
    expect(el(f).querySelector('#' + article.getAttribute('aria-labelledby'))?.textContent?.trim()).toBe('Ada Lovelace');
  });

  it('takes the heading from recordTitleKey', async () => {
    const f = await table({ recordTitleKey: 'ref' });
    expect(screen.getByRole('heading', { name: 'ORD-1' })).toBeTruthy();
    expect(terms(f)).not.toContain('Reference');
  });

  it('drops a hidden column here too', async () => {
    const f = await table();
    expect(terms(f)).not.toContain('Internal');
  });

  it('formats a cell exactly as the table would', async () => {
    const f = await table({
      columns: [
        { key: 'name', label: 'Customer' },
        { key: 'total', label: 'Total', render: (row: Record<string, unknown>) => `≈ ${row['total']}` },
      ],
    });
    expect(el(f).querySelector('[data-sv-record] dd')?.textContent?.trim()).toBe('≈ 42');
  });
});

describe('sv-data-table responsive="records" — nothing is dropped', () => {
  it('puts secondary fields behind a disclosure that says how many', async () => {
    const f = await table();
    expect(terms(f)).not.toContain('Reference');
    expect(screen.getByRole('button', { name: /Show 2 more fields for Ada Lovelace/ })).toBeTruthy();
    expect(el(f).querySelector('[data-sv-record-more]')!.textContent?.trim()).toBe('2 more fields');
  });

  it('says "1 more field" for one', async () => {
    const f = await table({ columns: COLUMNS.filter((c) => c.key !== 'opened') });
    expect(el(f).querySelector('[data-sv-record-more]')!.textContent?.trim()).toBe('1 more field');
  });

  it('reveals them per record, and writes recordExpandedIds by row key', async () => {
    const f = await table();
    await userEvent.click(screen.getByRole('button', { name: /Show 2 more fields for Grace Hopper/ }));
    f.detectChanges();
    expect([...f.componentInstance.recordExpandedIds()]).toEqual(['r2']);
    expect([...records(f)[1].querySelectorAll('dt')].map((n) => n.textContent?.trim())).toContain('Reference');
    expect([...records(f)[0].querySelectorAll('dt')].map((n) => n.textContent?.trim())).not.toContain('Reference');
  });

  it('opens the records named by a bound recordExpandedIds', async () => {
    const f = await table({ recordExpandedIds: new Set(['r1']) });
    expect([...records(f)[0].querySelectorAll('dt')].map((n) => n.textContent?.trim())).toContain('Reference');
  });

  it('offers no disclosure when every field is primary', async () => {
    const f = await table({ columns: COLUMNS.filter((c) => c.priority !== 'secondary') });
    expect(el(f).querySelector('[data-sv-record-more]')).toBeNull();
  });
});

describe('sv-data-table responsive="records" — sorting survives, through the table\'s own sort', () => {
  it('offers a labelled sort control, since there is no header to click', async () => {
    const f = await table();
    const select = el(f).querySelector<HTMLSelectElement>('[data-sv-sort-key]')!;
    expect(el(f).querySelector(`label[for="${select.id}"]`)?.textContent?.trim()).toBe('Sort by');
  });

  it('sorts the records and emits sortChange, as a header click would', async () => {
    const f = await table();
    const seen: unknown[] = [];
    f.componentInstance.sortChange.subscribe((s) => seen.push(s));
    const select = el(f).querySelector<HTMLSelectElement>('[data-sv-sort-key]')!;
    select.value = 'total';
    select.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(seen).toEqual([[{ key: 'total', direction: 'asc' }]]);
    expect(titles(f)).toEqual(['Grace Hopper', 'Ada Lovelace']);
  });

  it('reverses the direction with a named button', async () => {
    const f = await table();
    f.componentInstance.onRecordSortKeyChange('total');
    f.detectChanges();
    await userEvent.click(el(f).querySelector<HTMLButtonElement>('[data-sv-sort-direction]')!);
    f.detectChanges();
    expect(f.componentInstance.sorts()).toEqual([{ key: 'total', direction: 'desc' }]);
    expect(titles(f)).toEqual(['Ada Lovelace', 'Grace Hopper']);
  });

  it('clears back to unsorted', async () => {
    const f = await table();
    f.componentInstance.onRecordSortKeyChange('total');
    f.componentInstance.onRecordSortKeyChange('');
    expect(f.componentInstance.sorts()).toEqual([]);
  });

  it('shows no sort control when no column is sortable', async () => {
    const f = await table({ columns: COLUMNS.map((c) => ({ ...c, sortable: false })) });
    expect(el(f).querySelector('[data-sv-sort-key]')).toBeNull();
  });
});

describe('sv-data-table responsive="records" — selection and actions', () => {
  it('names each checkbox by its record and selects by row key', async () => {
    const f = await table({ selectable: true });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Grace Hopper' }));
    f.detectChanges();
    expect([...f.componentInstance.selectedIds()]).toEqual(['r2']);
  });

  it('keeps a selection on its record when the rows reorder', async () => {
    const f = await table({ selectable: true, selectedIds: new Set(['r2']) });
    const checked = () => [...el(f).querySelectorAll<HTMLInputElement>('[data-sv-record-select]')].map((b) => b.checked);
    expect(checked()).toEqual([false, true]);
    f.componentRef.setInput('rows', [ROWS[1], ROWS[0]]);
    f.detectChanges();
    expect(checked()).toEqual([true, false]);
  });

  it('runs an action handler, named by the record it acts on', async () => {
    const ran: string[] = [];
    const actions: TableRowAction[] = [{ label: 'Refund', handler: (row) => ran.push(String(row['id'])) }];
    await table({ actions });
    await userEvent.click(screen.getByRole('button', { name: 'Refund Grace Hopper' }));
    expect(ran).toEqual(['r2']);
  });

  it('honours an action hidden for one row', async () => {
    const actions: TableRowAction[] = [{ label: 'Refund', handler: () => undefined, hidden: (row) => row['id'] === 'r1' }];
    await table({ actions });
    expect(screen.queryByRole('button', { name: 'Refund Ada Lovelace' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Refund Grace Hopper' })).toBeTruthy();
  });
});

describe('sv-data-table responsive — which view, and when', () => {
  it('is the table with responsive "none", and never both', async () => {
    const f = await table({ responsive: 'none' });
    expect(el(f).querySelector('table')).not.toBeNull();
    expect(el(f).querySelector('[data-sv-records]')).toBeNull();
  });

  it('keeps the 1.x card list as responsive="cards"', async () => {
    const f = await table({ responsive: 'cards' });
    expect(el(f).querySelector('table')).not.toBeNull();
    expect(el(f).querySelector('.sm\\:hidden')).not.toBeNull();
    expect(el(f).querySelector('[data-sv-records]')).toBeNull();
  });

  it('starts on the table in auto, the safe guess where nothing is measured', async () => {
    const f = await table({ recordView: 'auto' });
    expect(f.componentInstance.recordsOn()).toBe(false);
  });

  it('renders loading and empty in place of the records', async () => {
    const loading = await table({ loading: true });
    expect(loading.nativeElement.querySelector('[data-sv-view="records"] .skeleton-wave')).not.toBeNull();
    const empty = await table({ rows: [], emptyMessage: 'Nothing here.' });
    expect(empty.nativeElement.textContent).toContain('Nothing here.');
  });
});

describe('sv-data-table responsive="records" — the breakpoint is live', () => {
  const WIDTH = 850;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  let original: typeof window.matchMedia;

  beforeEach(() => {
    original = window.matchMedia;
    listeners.clear();
    window.matchMedia = ((query: string) => {
      const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity);
      return {
        matches: WIDTH <= max,
        media: query,
        addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
      } as unknown as MediaQueryList;
    }) as typeof window.matchMedia;
  });

  afterEach(() => { window.matchMedia = original; });

  it('re-measures when recordBreakpoint changes, and drops the old listener', async () => {
    const f = await table({ recordView: 'auto' });
    expect(f.componentInstance.recordsOn()).toBe(false);
    expect(listeners.size).toBe(1);
    f.componentRef.setInput('recordBreakpoint', 900);
    f.detectChanges();
    f.detectChanges();
    expect(f.componentInstance.recordsOn()).toBe(true);
    expect(el(f).querySelector('[data-sv-records]')).not.toBeNull();
    expect(listeners.size).toBe(1);
  });

  it('measures nothing unless responsive is "records"', async () => {
    await table({ responsive: 'cards', recordView: 'auto' });
    expect(listeners.size).toBe(0);
  });

  it('removes its listener when destroyed', async () => {
    const f = await table({ recordView: 'auto', recordBreakpoint: 900 });
    expect(listeners.size).toBe(1);
    f.destroy();
    expect(listeners.size).toBe(0);
  });
});
