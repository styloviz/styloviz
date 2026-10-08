import { Component } from '@angular/core';
import { render } from '@testing-library/angular';
import { SvDataTableComponent, type TableColumn } from './data-table.component';

/**
 * Two tables on one page (1.0 audit, M1). The "Rows" select had the literal id
 * `dt-page-size`, so the second table's label pointed at the FIRST table's
 * select, and the page carried a duplicate id.
 */
interface Row extends Record<string, unknown> { id: number; name: string }
const COLUMNS: TableColumn<Row>[] = [{ key: 'name', label: 'Name' }];
const ROWS: Row[] = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }];

@Component({
  standalone: true,
  imports: [SvDataTableComponent],
  template: `
    <sv-data-table [columns]="columns" [rows]="rows" [pageSize]="2" />
    <sv-data-table [columns]="columns" [rows]="rows" [pageSize]="2" />
  `,
})
class TwoTables {
  readonly columns = COLUMNS;
  readonly rows = ROWS;
}

describe('SvDataTableComponent — ids are per instance', () => {
  it('each "Rows" label points at its own select, and no id repeats', async () => {
    const { fixture } = await render(TwoTables);
    const root = fixture.nativeElement as HTMLElement;
    const tables = Array.from(root.querySelectorAll('sv-data-table'));
    expect(tables).toHaveLength(2);
    const ids: string[] = [];
    for (const table of tables) {
      const select = table.querySelector('select[id$="-page-size"]');
      expect(select).not.toBeNull();
      const label = table.querySelector(`label[for="${select!.id}"]`);
      expect(label?.textContent).toContain('Rows');
      ids.push(select!.id);
    }
    expect(new Set(ids).size).toBe(2);
    const all = Array.from(root.querySelectorAll('[id]')).map((e) => e.id);
    expect(all.length).toBe(new Set(all).size);
  });
});
