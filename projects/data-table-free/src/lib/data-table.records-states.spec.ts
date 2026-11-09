import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvDataTableComponent, type TableColumn } from './data-table.component';

/**
 * FL-G8 — the records and cards views say what state they are in, as the table
 * view does. Their skeleton was shimmer with no role, so a screen-reader user
 * heard nothing while it loaded; their empty state was a bare paragraph, so a
 * filter that hid every row looked exactly like no data, with no way to undo it.
 */

const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Customer' },
  { key: 'status', label: 'Status' },
];
const ROWS = [
  { id: 'r1', name: 'Ada Lovelace', status: 'Shipped' },
  { id: 'r2', name: 'Grace Hopper', status: 'Packing' },
];

async function table(responsive: 'records' | 'cards', inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDataTableComponent, {
    inputs: { columns: COLUMNS, rows: ROWS, responsive, recordView: 'always', ...inputs },
  });
  fixture.detectChanges();
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

for (const view of ['records', 'cards'] as const) {
  describe(`${view} view — states (FL-G8)`, () => {
    it('announces its loading skeleton', async () => {
      const f = await table(view, { loading: true });
      const busy = el(f).querySelectorAll('[data-sv-state="loading"][role="status"][aria-busy="true"]');
      expect(busy.length).toBeGreaterThan(0);
    });

    it('says no data, with no undo to offer', async () => {
      const f = await table(view, { rows: [] });
      const empty = el(f).querySelector<HTMLElement>(`[data-sv-state="empty"]`)!;
      expect(empty).not.toBeNull();
      expect(empty.getAttribute('data-sv-empty-reason')).toBe('no-data');
      expect(empty.querySelector('button')).toBeNull();
    });

    it('says no matches when a filter hid every row, and Clear filters brings them back', async () => {
      const f = await table(view);
      f.componentInstance.searchQuery.set('nobody by this name');
      f.detectChanges();
      const empty = el(f).querySelector<HTMLElement>(`[data-sv-state="empty"][data-sv-empty-reason="no-results"]`)!;
      expect(empty).not.toBeNull();
      empty.querySelector<HTMLButtonElement>('button')!.click();
      f.detectChanges();
      expect(f.componentInstance.searchQuery()).toBe('');
      expect(el(f).querySelector('[data-sv-state="empty"]')).toBeNull();
    });
  });
}
