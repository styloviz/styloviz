import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  SvRecordGridComponent,
  SvRecordTableDirective,
} from './record-grid.component';
import type { TableColumn, TableRowAction } from './data-table.component';

/**
 * A table that becomes a list of records when there is no room to be a table.
 *
 * ★★★ THE USUAL RESPONSIVE TABLE IS A LIE TOLD IN CSS: set `display: block` on
 * the table elements and pipe the header into each cell through a `::before`.
 * The browser drops the table roles the moment those elements stop being
 * `display: table-*`, so a screen reader gets a pile of anonymous blocks — and
 * generated content is not text anyone can select, search or copy. It LOOKS
 * like labelled cards and is less accessible than the table it replaced.
 *
 * ★★★ The other common answer is to hide the columns that do not fit, which
 * makes it a different table with nobody told which one they are reading.
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
  { id: 'r1', name: 'Ada Lovelace', status: 'Shipped', total: '£42.00', ref: 'ORD-1', opened: 'Monday', internal: 'x' },
  { id: 'r2', name: 'Grace Hopper', status: 'Packing', total: '£18.50', ref: 'ORD-2', opened: 'Tuesday', internal: 'y' },
];

async function grid(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvRecordGridComponent, {
    inputs: { columns: COLUMNS, rows: ROWS, mode: 'cards', ...inputs },
  });
  fixture.detectChanges();
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const cards = (f: { nativeElement: unknown }) => el(f).querySelectorAll('[data-sv-record]');
const terms = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll('dt')].map((n) => n.textContent?.trim());

describe('SvRecordGridComponent — the card view is a real list of records', () => {
  it('renders one record per row, as a list', async () => {
    const f = await grid();
    expect(el(f).querySelector('[data-sv-records]')?.getAttribute('role')).toBe('list');
    expect(cards(f)).toHaveLength(2);
  });

  it('uses real label/value pairs, not generated content', async () => {
    const f = await grid();
    // ★ `<dt>`/`<dd>` is the structure HTML already has for this, and it is
    //   text a user can select, search and copy — which `::before` is not.
    const first = cards(f)[0];
    expect(first.querySelector('dl')).not.toBeNull();
    expect(first.querySelector('dt')?.textContent?.trim()).toBe('Status');
    expect(first.querySelector('dd')?.textContent?.trim()).toBe('Shipped');
  });

  it('gives each card a heading, because a <dl> cannot supply one', async () => {
    const f = await grid();
    // Every pair in a description list is equally a term, so one field is
    // promoted out — otherwise a stack of cards is forty identical blocks.
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    expect(cards(f)[0].getAttribute('aria-labelledby')).toContain('title-r1');
  });

  it('takes the heading from titleKey when the host names one', async () => {
    const f = await grid({ titleKey: 'ref' });
    expect(screen.getByRole('heading', { name: 'ORD-1' })).toBeTruthy();
    // The promoted column leaves the pair list.
    expect(terms(f)).not.toContain('Reference');
  });

  it('drops a hidden column here too', async () => {
    const f = await grid();
    expect(terms(f)).not.toContain('Internal');
  });

  it('formats a cell exactly as the table would', async () => {
    // ★ A column that formats a date or a currency must read identically in
    //   both views, or the card list is a second, subtly different table.
    const f = await grid({
      columns: [
        { key: 'name', label: 'Customer' },
        { key: 'total', label: 'Total', render: (row: Record<string, unknown>) => `≈ ${row['total']}` },
      ],
    });
    expect(el(f).querySelector('dd')?.textContent?.trim()).toBe('≈ £42.00');
  });

  it('renders an absent value as nothing rather than "undefined"', async () => {
    const f = await grid({ rows: [{ id: 'r1', name: 'Ada', status: null }] });
    expect(el(f).textContent).not.toContain('undefined');
    expect(el(f).textContent).not.toContain('null');
  });
});

describe('SvRecordGridComponent — nothing is dropped', () => {
  it('puts a secondary field behind a disclosure and says how many', async () => {
    const f = await grid();
    // ★★★ Hiding the columns that do not fit makes it a DIFFERENT table, with
    //     nobody told which one they are reading.
    expect(terms(f)).not.toContain('Reference');
    expect(screen.getAllByRole('button', { name: /Show 2 more fields for Ada Lovelace/ })).toHaveLength(1);
  });

  it('reveals them on request, per card', async () => {
    const f = await grid();
    await userEvent.click(screen.getByRole('button', { name: /Show 2 more fields for Ada Lovelace/ }));
    f.detectChanges();

    const opened = cards(f)[0];
    expect([...opened.querySelectorAll('dt')].map((n) => n.textContent?.trim())).toContain('Reference');
    // The other card is untouched — the disclosure is per record.
    expect([...cards(f)[1].querySelectorAll('dt')].map((n) => n.textContent?.trim()))
      .not.toContain('Reference');
  });

  it('offers no disclosure when every field is primary', async () => {
    const f = await grid({ columns: [{ key: 'name', label: 'Customer' }, { key: 'status', label: 'Status' }] });
    expect(el(f).querySelector('[data-sv-record-more]')).toBeNull();
  });
});

describe('SvRecordGridComponent — sorting survives the transformation', () => {
  it('offers a real labelled control, since there are no headers to click', async () => {
    // ★★ The table's affordance is the header cell. A table that becomes cards
    //    loses sorting entirely unless the control is rebuilt somewhere else —
    //    the half of "responsive" everyone forgets.
    await grid();
    const select = screen.getByLabelText('Sort by') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual(['Unsorted', 'Total']);
  });

  it('reports the chosen sort through the two-way sort, for the host to apply', async () => {
    const f = await grid();
    const select = screen.getByLabelText('Sort by') as HTMLSelectElement;
    await userEvent.selectOptions(select, 'total');
    f.detectChanges();
    expect(f.componentInstance.sort()).toEqual({ key: 'total', direction: 'asc' });
  });

  it('reverses the direction, and names it rather than drawing an arrow', async () => {
    const f = await grid({ sort: { key: 'total', direction: 'asc' } });
    const button = screen.getByRole('button', { name: /Sort direction: Ascending/ });
    await userEvent.click(button);
    f.detectChanges();
    expect(f.componentInstance.sort()).toEqual({ key: 'total', direction: 'desc' });
  });

  it('clears back to unsorted', async () => {
    const f = await grid({ sort: { key: 'total', direction: 'asc' } });
    await userEvent.selectOptions(screen.getByLabelText('Sort by') as HTMLSelectElement, '');
    f.detectChanges();
    expect(f.componentInstance.sort()).toBeNull();
    expect(el(f).querySelector('[data-sv-sort-direction]')).toBeNull();
  });

  it('shows no sort control when no column is sortable', async () => {
    const f = await grid({ columns: [{ key: 'name', label: 'Customer' }] });
    expect(el(f).querySelector('[data-sv-sort-key]')).toBeNull();
  });
});

describe('SvRecordGridComponent — selection and actions survive it too', () => {
  it('names each checkbox by the record it selects', async () => {
    const f = await grid({ selectable: true });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select Grace Hopper' }));
    f.detectChanges();
    expect([...f.componentInstance.selected()]).toEqual(['r2']);
  });

  it('keys the selection by the row key, never by position', async () => {
    // ★ A card list is re-rendered on every sort and every page. Tracking by
    //   position reuses one record's DOM for another, so a checkbox stays
    //   ticked while the record under it changes.
    const f = await grid({ selectable: true, selected: new Set(['r2']) });
    const boxes = [...el(f).querySelectorAll<HTMLInputElement>('[data-sv-record-select]')];
    expect(boxes.map((b) => b.checked)).toEqual([false, true]);

    f.componentRef.setInput('rows', [ROWS[1], ROWS[0]]);
    f.detectChanges();
    const after = [...el(f).querySelectorAll<HTMLInputElement>('[data-sv-record-select]')];
    expect(after.map((b) => b.checked)).toEqual([true, false]);
  });

  it('names each action by the record it acts on', async () => {
    const seen: string[] = [];
    const actions: TableRowAction[] = [{ label: 'Refund', handler: () => { /* click is asserted via actionClick */ } }];
    const f = await grid({ rowActions: actions });
    f.componentInstance.actionClick.subscribe((e) => seen.push(e.row['id'] as string));

    await userEvent.click(screen.getByRole('button', { name: 'Refund Grace Hopper' }));
    expect(seen).toEqual(['r2']);
  });

  it('runs the action handler, as the data table does — then emits actionClick', async () => {
    // ★ The card view only emitted, so a rowActions array shared with a table
    //   worked in the table and silently did nothing in the cards.
    const order: string[] = [];
    const actions: TableRowAction[] = [{ label: 'Refund', handler: (row) => order.push('handler:' + String(row['id'])) }];
    const f = await grid({ rowActions: actions });
    f.componentInstance.actionClick.subscribe((e) => order.push('event:' + String(e.row['id'])));

    await userEvent.click(screen.getByRole('button', { name: 'Refund Grace Hopper' }));
    expect(order).toEqual(['handler:r2', 'event:r2']);
  });

  it('honours an action hidden for one row', async () => {
    const actions: TableRowAction[] = [
      { label: 'Refund', handler: () => { /* click is asserted via actionClick */ }, hidden: (row) => row['id'] === 'r1' },
    ];
    await grid({ rowActions: actions });
    expect(screen.queryByRole('button', { name: 'Refund Ada Lovelace' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Refund Grace Hopper' })).toBeTruthy();
  });
});

describe('SvRecordGridComponent — which view, and when', () => {
  it('renders the host’s table when told to', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(
      `<sv-record-grid [columns]="columns" [rows]="rows" mode="table">
         <ng-template svRecordTable><p data-wide>the wide view</p></ng-template>
       </sv-record-grid>`,
      {
        imports: [SvRecordGridComponent, SvRecordTableDirective],
        componentProperties: { columns: COLUMNS, rows: ROWS },
      },
    );
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-wide]')).not.toBeNull();
    expect(host.querySelector('[data-sv-records]')).toBeNull();
  });

  it('never renders both, so no record is in the tree twice', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(
      `<sv-record-grid [columns]="columns" [rows]="rows" mode="cards">
         <ng-template svRecordTable><p data-wide>the wide view</p></ng-template>
       </sv-record-grid>`,
      {
        imports: [SvRecordGridComponent, SvRecordTableDirective],
        componentProperties: { columns: COLUMNS, rows: ROWS },
      },
    );
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    // ★ A template, not projected content: projected content is instantiated
    //   by the host whatever this does with it, putting two copies of every
    //   record in the accessibility tree.
    expect(host.querySelector('[data-wide]')).toBeNull();
    expect(host.querySelector('[data-sv-records]')).not.toBeNull();
  });

  it('starts on the table, which is the safe guess where nothing can be measured', async () => {
    // ★★ A prerender cannot measure. Of the two guesses the table is the safe
    //    one: it holds every field and every label, so a client that never runs
    //    the script gets a scrollable table rather than a guessed card list.
    const f = await grid({ mode: 'auto' });
    expect(f.componentInstance.cardsMode()).toBe(false);
  });

  it('renders the async states in either mode', async () => {
    const loading = await grid({ loading: true });
    expect(loading.nativeElement.querySelector('[data-sv-state="loading"]')).not.toBeNull();

    const failed = await grid({ error: 'Could not load.' });
    expect(failed.nativeElement.querySelector('[data-sv-state="error"]')).not.toBeNull();

    const empty = await grid({ rows: [] });
    expect(empty.nativeElement.querySelector('[data-sv-state="empty"]')).not.toBeNull();
  });
});

describe('SvRecordGridComponent — the host owns the order', () => {
  it('does not reorder rows itself; it renders them in the order bound', async () => {
    const f = await grid({ sort: { key: 'total', direction: 'asc' } });
    // £42.00 before £18.50 — exactly as bound. The host sorts rows from sort.
    expect([...el(f).querySelectorAll('[data-sv-record] h3')].map((h) => h.textContent?.trim()))
      .toEqual(['Ada Lovelace', 'Grace Hopper']);
  });
});

describe('SvRecordGridComponent — the disclosure count reads as English (N-9)', () => {
  it('says "1 more field", not "1 more fields"', async () => {
    const f = await grid({ columns: COLUMNS.filter((c) => c.key !== 'opened') });
    const more = el(f).querySelector('[data-sv-record-more]')!;
    expect(more.textContent?.trim()).toBe('1 more field');
    expect(more.getAttribute('aria-label')).toContain('Show 1 more field for');
  });

  it('keeps the plural for two', async () => {
    const f = await grid();
    expect(el(f).querySelector('[data-sv-record-more]')!.textContent?.trim()).toBe('2 more fields');
  });
});

describe('SvRecordGridComponent — open cards are restorable state (X-6)', () => {
  it('opens the cards named by a bound expandedIds', async () => {
    const f = await grid({ expandedIds: new Set(['r2']) });
    expect([...cards(f)[1].querySelectorAll('dt')].map((n) => n.textContent?.trim())).toContain('Reference');
    expect([...cards(f)[0].querySelectorAll('dt')].map((n) => n.textContent?.trim())).not.toContain('Reference');
  });

  it('writes a toggle back through expandedIds, keyed by row key', async () => {
    const f = await grid();
    const seen: ReadonlySet<string>[] = [];
    f.componentInstance.expandedIds.subscribe((ids) => seen.push(ids));
    await userEvent.click(screen.getByRole('button', { name: /Show 2 more fields for Grace Hopper/ }));
    f.detectChanges();
    expect([...f.componentInstance.expandedIds()]).toEqual(['r2']);
    expect(seen.map((ids) => [...ids])).toEqual([['r2']]);
  });
});

describe('SvRecordGridComponent — the breakpoint is live (N-9)', () => {
  /** A viewport 850px wide, and every listener the grid attaches to it. */
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

  it('re-measures when breakpoint changes after first render, and drops the old listener', async () => {
    const f = await grid({ mode: 'auto' });
    // 850 is wider than the default 768 — the table.
    expect(f.componentInstance.cardsMode()).toBe(false);
    expect(el(f).querySelector('[data-sv-records]')).toBeNull();
    expect(listeners.size).toBe(1);

    f.componentRef.setInput('breakpoint', 900);
    f.detectChanges();
    f.detectChanges(); // the effect's write re-renders on the following pass

    // 850 is narrower than 900 — the cards, rendered.
    expect(f.componentInstance.cardsMode()).toBe(true);
    expect(el(f).querySelector('[data-sv-records]')).not.toBeNull();
    // One live listener: the 768 query's was removed before the 900 one was added.
    expect(listeners.size).toBe(1);
  });

  it('removes its listener when destroyed', async () => {
    const f = await grid({ mode: 'auto', breakpoint: 900 });
    expect(listeners.size).toBe(1);
    f.destroy();
    expect(listeners.size).toBe(0);
  });
});
