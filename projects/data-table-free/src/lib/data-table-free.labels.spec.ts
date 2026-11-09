import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvLiveAnnouncer } from '@styloviz/core/a11y';
import { provideSvLabels } from '@styloviz/core/i18n';
import { flush } from '../../../../src/testing/async';
import { SvDataTableComponent, type TableColumn } from './data-table.component';
import { SV_DATA_TABLE_LABELS } from './data-table-free.labels';

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
}

const COLUMNS: TableColumn<Row>[] = [{ key: 'name', label: 'Name' }];
const ROWS: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
];

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvDataTableComponent<Row>, {
    inputs: { columns: COLUMNS, rows: ROWS, pageSize: 2, searchable: true },
    providers: providers as never[],
  });
}

describe('SvDataTableComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getByRole('searchbox', { name: SV_DATA_TABLE_LABELS.searchTable })).toBeTruthy();
    expect(screen.getByRole('button', { name: SV_DATA_TABLE_LABELS.nextPage })).toBeTruthy();
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ dataTable: { searchTable: 'Tabelle durchsuchen', nextPage: 'Nächste Seite' } })]);
    expect(screen.getByRole('searchbox', { name: 'Tabelle durchsuchen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nächste Seite' })).toBeTruthy();
    expect(screen.queryByRole('searchbox', { name: 'Search table' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
  });

  it('fills a composed name from a template whose slot moves (FL-B1c)', async () => {
    await setup([provideSvLabels({ dataTable: { goToPage: '{page}. Seite' } })]);
    expect(screen.getByRole('button', { name: '2. Seite' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Page 2' })).toBeNull();
  });
});

describe('SvDataTableComponent — visible text (FL-B1d)', () => {
  it('uses the search placeholder an app provides', async () => {
    await setup([provideSvLabels({ dataTable: { searchPlaceholder: 'Suchen…' } })]);
    expect(screen.getByPlaceholderText('Suchen…')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Search…')).toBeNull();
  });
});

describe('SvDataTableComponent — TS-built text (FL-B1e)', () => {
  it('announces the focus move in the language an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvDataTableComponent<Row>, {
      inputs: { columns: COLUMNS, rows: ROWS, selectable: true, responsive: 'none' },
      providers: [provideSvLabels({ dataTable: { focusedRowHidden: 'Die fokussierte Zeile wird nicht mehr angezeigt.' } })],
    });
    fixture.detectChanges();
    const announce = vi.spyOn(TestBed.inject(SvLiveAnnouncer), 'announce');
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLInputElement>('tr[data-sv-row-key="2"] input[type="checkbox"]')!.focus();
    fixture.componentRef.setInput('rows', ROWS.filter((r) => r.id !== 2));
    fixture.detectChanges();
    await flush();
    expect(announce).toHaveBeenCalledWith('Die fokussierte Zeile wird nicht mehr angezeigt.');
  });
});

describe('SvDataTableComponent — one-word UI text (FL-B1e)', () => {
  it('names the density options with the words an app provides', async () => {
    const { fixture } = await setup([
      provideSvLabels({ dataTable: { densityCompact: 'Kompakt', densityComfortable: 'Bequem', densitySpacious: 'Großzügig' } }),
    ]);
    expect(fixture.componentInstance.densityOptions.map((d) => d.label)).toEqual(['Kompakt', 'Bequem', 'Großzügig']);
  });
});
