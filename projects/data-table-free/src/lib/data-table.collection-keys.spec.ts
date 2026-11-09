import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { SvDataTableComponent, type TableColumn, type TableVariant } from './data-table.component';
import { flush } from '../../../../src/testing/async';

/**
 * `X-10` — the free table is paginated by default, so its page size is its
 * keyboard ceiling: a 5,000-row dataset renders one page.
 * `X-12` — a row holding focus that leaves the page hands focus to the row now
 * at its index, then the scroller — never `<body>` — and says so.
 */

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
}

const COLUMNS: TableColumn<Row>[] = [{ key: 'name', label: 'Name' }];
const NAMED: Row[] = [
  { id: 1, name: 'Alpha' },
  { id: 2, name: 'Beta' },
  { id: 3, name: 'Bravo' },
  { id: 4, name: 'Delta' },
];

async function setup(extra: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDataTableComponent<Row>, {
    inputs: { columns: COLUMNS, rows: NAMED, selectable: true, responsive: 'none', ...extra },
  });
  fixture.detectChanges();
  return fixture;
}
type Fixture = Awaited<ReturnType<typeof setup>>;

const tr = (f: Fixture, key: number) =>
  (f.nativeElement as HTMLElement).querySelector<HTMLElement>(`tr[data-sv-row-key="${key}"]`);
const box = (f: Fixture, key: number) => tr(f, key)!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;

describe('SvDataTableComponent — X-10 the page size is the ceiling', () => {
  it('renders one page of a 5,000-row dataset', async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `Row ${i}` }));
    const f = await setup({ rows, pageSize: 10 });
    expect((f.nativeElement as HTMLElement).querySelectorAll('tr[data-sv-row-key]')).toHaveLength(10);
  });
});

describe('SvDataTableComponent — X-12 a focused row filtered away', () => {
  const VARIANTS: TableVariant[] = ['default', 'striped', 'bordered', 'borderless'];

  it.each(VARIANTS)('%s: focus moves to the same control in the row now at that index, with an announcement', async (variant) => {
    const f = await setup({ variant });
    const announce = vi.spyOn(TestBed.inject(SvLiveAnnouncer), 'announce');
    box(f, 2).focus();
    f.componentRef.setInput('rows', NAMED.filter((r) => r.id !== 2));
    f.detectChanges();
    await flush();
    expect(document.activeElement).toBe(box(f, 3));
    expect(announce).toHaveBeenCalledWith(expect.stringContaining('no longer shown'));
  });

  it('moves to the predecessor when the last row goes', async () => {
    const f = await setup();
    box(f, 4).focus();
    f.componentRef.setInput('rows', NAMED.slice(0, 3));
    f.detectChanges();
    await flush();
    expect(document.activeElement).toBe(box(f, 3));
  });

  it('falls back to the scroller when no row is left — never <body>', async () => {
    const f = await setup();
    box(f, 1).focus();
    f.componentRef.setInput('rows', []);
    f.detectChanges();
    await flush();
    expect(document.activeElement).toBe((f.nativeElement as HTMLElement).querySelector('[data-sv-table-scroller]'));
  });

  it('leaves focus alone when the focused row survives the change', async () => {
    const f = await setup();
    box(f, 3).focus();
    f.componentRef.setInput('rows', NAMED.filter((r) => r.id !== 1));
    f.detectChanges();
    await flush();
    expect(document.activeElement).toBe(box(f, 3));
  });
});

/**
 * ★★ `(rowClick)` from the keyboard (FL-L1). The `<tr>` had a click handler
 * and no tabindex, so the docs' `(rowClick)="open($event)"` was mouse-only.
 */
describe('SvDataTableComponent — rows from the keyboard', () => {
  const trs = (f: Fixture) => [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('tr[data-sv-row-key]')];
  const focusedKey = () => (document.activeElement as HTMLElement | null)?.dataset?.['svRowKey'] ?? null;
  function press(f: Fixture, key: string, on: HTMLElement) {
    on.focus();
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    on.dispatchEvent(event);
    f.detectChanges();
    return event;
  }

  it('the body is one tab stop; the arrows walk it and Enter / Space activate', async () => {
    const f = await setup();
    const clicked: Row[] = [];
    f.componentInstance.rowClick.subscribe((row) => clicked.push(row));
    expect(trs(f).filter((el) => el.getAttribute('tabindex') === '0').map((el) => el.dataset['svRowKey'])).toEqual(['1']);

    press(f, 'ArrowDown', tr(f, 1)!);
    expect(focusedKey()).toBe('2');
    press(f, 'End', tr(f, 2)!);
    expect(focusedKey()).toBe('4');
    expect(press(f, 'Enter', tr(f, 4)!).defaultPrevented).toBe(true);
    expect(press(f, ' ', tr(f, 4)!).defaultPrevented).toBe(true);
    expect(clicked.map((r) => r.id)).toEqual([4, 4]);
    expect(trs(f).filter((el) => el.getAttribute('tabindex') === '0').map((el) => el.dataset['svRowKey'])).toEqual(['4']);
  });

  it('Space on the select checkbox selects, and does not activate the row', async () => {
    const f = await setup();
    const clicked: Row[] = [];
    f.componentInstance.rowClick.subscribe((row) => clicked.push(row));
    expect(press(f, ' ', box(f, 2)).defaultPrevented).toBe(false);
    expect(clicked).toEqual([]);
  });
});
