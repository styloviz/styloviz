import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvDataTableComponent, type CellClickEvent, type TableColumn } from './data-table.component';
import { flush } from '../../../../src/testing/async';

/**
 * ★★ Cells from the keyboard (FL-L1-02b). `(cellClick)` and inline editing
 * sat on a click and a double-click on a `<td>` nothing could focus. The row
 * is still the one tab stop; ArrowRight steps into its cells, Enter / Space is
 * the click, F2 the double-click.
 */

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
  role: string;
}

const COLUMNS: TableColumn<Row>[] = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role', editable: true },
];
const ROWS: Row[] = [
  { id: 1, name: 'Alpha', role: 'Admin' },
  { id: 2, name: 'Beta', role: 'Editor' },
  { id: 3, name: 'Bravo', role: 'Viewer' },
];

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDataTableComponent<Row>, {
    inputs: { columns: COLUMNS, rows: ROWS, responsive: 'none' },
  });
  fixture.detectChanges();
  return fixture;
}
type Fixture = Awaited<ReturnType<typeof setup>>;

const tr = (f: Fixture, id: number) =>
  (f.nativeElement as HTMLElement).querySelector<HTMLElement>(`tr[data-sv-row-key="${id}"]`)!;
const td = (f: Fixture, id: number, col: string) => tr(f, id).querySelector<HTMLElement>(`td[data-sv-col-key="${col}"]`)!;
const tabStops = (f: Fixture) =>
  [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('tr[data-sv-row-key][tabindex="0"]')].map((el) => el.dataset['svRowKey']);

function press(f: Fixture, key: string, on: HTMLElement) {
  if (document.activeElement !== on) on.focus();
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  on.dispatchEvent(event);
  f.detectChanges();
  return event;
}

describe('SvDataTableComponent — cells from the keyboard', () => {
  it('ArrowRight steps into the row; the arrows, Home and End move the cursor; ArrowLeft from the first cell returns', async () => {
    const f = await setup();
    press(f, 'ArrowRight', tr(f, 1));
    expect(document.activeElement).toBe(td(f, 1, 'name'));
    press(f, 'ArrowRight', td(f, 1, 'name'));
    expect(document.activeElement).toBe(td(f, 1, 'role'));
    // The last cell: nothing further, and the key is left alone.
    expect(press(f, 'ArrowRight', td(f, 1, 'role')).defaultPrevented).toBe(false);
    press(f, 'Home', td(f, 1, 'role'));
    expect(document.activeElement).toBe(td(f, 1, 'name'));
    press(f, 'End', td(f, 1, 'name'));
    expect(document.activeElement).toBe(td(f, 1, 'role'));
    press(f, 'ArrowLeft', td(f, 1, 'role'));
    press(f, 'ArrowLeft', td(f, 1, 'name'));
    expect(document.activeElement).toBe(tr(f, 1));
  });

  it('under dir="rtl" the arrows follow what the eye sees: ArrowLeft steps in and on, ArrowRight back', async () => {
    const f = await setup();
    (f.nativeElement as HTMLElement).setAttribute('dir', 'rtl');
    try {
      // Into the row's cells is toward the inline end — the left, here.
      press(f, 'ArrowLeft', tr(f, 1));
      expect(document.activeElement).toBe(td(f, 1, 'name'));
      press(f, 'ArrowLeft', td(f, 1, 'name'));
      expect(document.activeElement).toBe(td(f, 1, 'role'));
      press(f, 'ArrowRight', td(f, 1, 'role'));
      expect(document.activeElement).toBe(td(f, 1, 'name'));
      press(f, 'ArrowRight', td(f, 1, 'name'));
      expect(document.activeElement).toBe(tr(f, 1));
    } finally {
      (f.nativeElement as HTMLElement).removeAttribute('dir');
    }
  });

  it('ArrowDown keeps the column and moves the tab stop with the row', async () => {
    const f = await setup();
    press(f, 'ArrowDown', td(f, 1, 'role'));
    expect(document.activeElement).toBe(td(f, 2, 'role'));
    press(f, 'ArrowDown', td(f, 2, 'role'));
    expect(document.activeElement).toBe(td(f, 3, 'role'));
    expect(tabStops(f)).toEqual(['3']);
  });

  it('Enter and Space on a cell emit cellClick for it, then rowClick — as a click does', async () => {
    const f = await setup();
    const events: string[] = [];
    f.componentInstance.cellClick.subscribe((e: CellClickEvent<Row>) => events.push(`cell ${e.row.id} ${e.column.key} ${e.value}`));
    f.componentInstance.rowClick.subscribe((row: Row) => events.push(`row ${row.id}`));
    expect(press(f, 'Enter', td(f, 2, 'name')).defaultPrevented).toBe(true);
    expect(press(f, ' ', td(f, 2, 'role')).defaultPrevented).toBe(true);
    expect(events).toEqual(['cell 2 name Beta', 'row 2', 'cell 2 role Editor', 'row 2']);
  });

  it('F2 edits an editable cell; Enter saves and the cursor returns to the cell', async () => {
    const f = await setup();
    const saved: unknown[] = [];
    f.componentInstance.editComplete.subscribe((e) => saved.push(e.newValue));
    // Not editable: F2 is left alone.
    expect(press(f, 'F2', td(f, 1, 'name')).defaultPrevented).toBe(false);
    expect(td(f, 1, 'name').querySelector('input')).toBeNull();

    press(f, 'F2', td(f, 1, 'role'));
    const input = td(f, 1, 'role').querySelector<HTMLInputElement>('input')!;
    expect(input).not.toBeNull();
    input.value = 'Owner';
    input.dispatchEvent(new Event('input'));
    // The editor keeps its own keys: Enter here is the editor's, not the cell's.
    press(f, 'Enter', input);
    await flush();
    expect(saved).toEqual(['Owner']);
    expect(document.activeElement).toBe(td(f, 1, 'role'));
  });

  it('Escape cancels the edit and the cursor returns to the cell', async () => {
    const f = await setup();
    press(f, 'F2', td(f, 2, 'role'));
    press(f, 'Escape', td(f, 2, 'role').querySelector<HTMLInputElement>('input')!);
    await flush();
    expect(td(f, 2, 'role').querySelector('input')).toBeNull();
    expect(document.activeElement).toBe(td(f, 2, 'role'));
  });
});
