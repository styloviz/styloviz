import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvDataTableComponent, type TableColumn } from './data-table.component';

/**
 * ============================================================================
 *  `sv-data-table` (free) — CSV export
 * ============================================================================
 *
 * The serialiser itself (`svToCsv`) has its own spec in `@styloviz/core`, so
 * nothing here re-tests quoting. What is tested is the table's side of the
 * contract: WHICH columns and WHICH rows it hands over, and what it names the
 * file. The free tier has CSV only — Excel and PDF are the Pro surface.
 *
 * The download is captured rather than performed: `svDownloadText` builds a
 * Blob URL and clicks an anchor, so `URL.createObjectURL` is stubbed to keep
 * the Blob and a capture-phase click listener records the filename.
 * `Blob.text()` does not exist in jsdom — hence `FileReader`.
 */

interface Row extends Record<string, unknown> {
  id: number;
  name: string;
  age: number;
  status: string;
}

const COLUMNS: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'age', label: 'Age', sortable: true, align: 'right' },
  { key: 'status', label: 'Status' },
];

const ROWS: Row[] = [
  { id: 1, name: 'Charlie', age: 30, status: 'active' },
  { id: 2, name: 'Alice', age: 45, status: 'pending' },
  { id: 3, name: 'Bob', age: 22, status: 'active' },
];

interface Download {
  filename: string;
  blob: Blob;
}

const downloads: Download[] = [];
let lastBlob: Blob | null = null;
let originalCreate: typeof URL.createObjectURL;
let originalRevoke: typeof URL.revokeObjectURL;

function onAnchorClick(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLAnchorElement && target.download) {
    // jsdom would otherwise log an unimplemented-navigation error per download.
    event.preventDefault();
    downloads.push({ filename: target.download, blob: lastBlob! });
  }
}

beforeEach(() => {
  downloads.length = 0;
  lastBlob = null;
  originalCreate = window.URL.createObjectURL;
  originalRevoke = window.URL.revokeObjectURL;
  window.URL.createObjectURL = (blob: Blob) => {
    lastBlob = blob;
    return 'blob:styloviz/test';
  };
  window.URL.revokeObjectURL = () => undefined;
  document.addEventListener('click', onAnchorClick, true);
});

afterEach(() => {
  document.removeEventListener('click', onAnchorClick, true);
  window.URL.createObjectURL = originalCreate;
  window.URL.revokeObjectURL = originalRevoke;
});

function readText(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** The house pattern: reset first, so one test can render more than once. */
async function setup(extra: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvDataTableComponent<Row>, {
    inputs: { columns: COLUMNS, rows: ROWS, pageSize: 2, ...extra },
  });
  return {
    fixture,
    c: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
  };
}

async function csvRows(): Promise<string[]> {
  expect(downloads).toHaveLength(1);
  return (await readText(downloads[0].blob)).split('\r\n');
}

// ─────────────────────────────────────────────────────────────────────────────

describe('SvDataTableComponent — the export control', () => {
  it('is absent until the table is told it may export', async () => {
    const { el } = await setup({ showToolbar: true });
    expect([...el.querySelectorAll('button')].some((b) => b.textContent?.includes('Export')))
      .toBe(false);
  });

  it('renders a single Export button that runs the CSV path', async () => {
    const { el } = await setup({ showToolbar: true, exportable: true });
    const button = [...el.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.includes('Export'))!;
    expect(button).toBeTruthy();
    button.click();
    expect(downloads.map((d) => d.filename)).toEqual([
      expect.stringMatching(/^export-\d+\.csv$/) as unknown as string,
    ]);
  });
});

describe('SvDataTableComponent — what gets exported', () => {
  it('writes a header row of the column labels, then one row per record', async () => {
    const { c } = await setup({ paginated: false });
    c.exportCsv();
    expect(await csvRows()).toEqual([
      'Name,Age,Status',
      'Charlie,30,active',
      'Alice,45,pending',
      'Bob,22,active',
    ]);
  });

  it('exports every filtered row, not just the page on screen', async () => {
    // pageSize is 2 of 3 rows: a per-page export is the classic surprise here.
    const { c } = await setup();
    expect(c.pagedRows()).toHaveLength(2);
    c.exportCsv();
    expect(await csvRows()).toHaveLength(4);
  });

  it('follows the filter — an export must match what the user is looking at', async () => {
    const { c } = await setup();
    c.setColFilter('status', 'active');
    c.exportCsv();
    expect(await csvRows()).toEqual(['Name,Age,Status', 'Charlie,30,active', 'Bob,22,active']);
  });

  it('follows the sort order', async () => {
    const { c } = await setup();
    c.onSort(COLUMNS[0], new MouseEvent('click'));
    c.exportCsv();
    expect((await csvRows()).slice(1).map((line) => line.split(',')[0]))
      .toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('leaves out a column the user has hidden', async () => {
    // The point of one shared `exportView` is that hidden means hidden in every
    // format, not just on screen.
    const { c } = await setup();
    c.toggleColumnVisibility('status');
    c.exportCsv();
    const rows = await csvRows();
    expect(rows[0]).toBe('Name,Age');
    expect(rows[1]).toBe('Charlie,30');
  });

  it('runs a column render function, so the file says what the screen says', async () => {
    const columns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age', render: (row) => `$${row.age}.00` },
    ];
    const { c } = await setup({ columns, paginated: false });
    c.exportCsv();
    expect((await csvRows())[1]).toBe('Charlie,$30.00');
  });

  it('exports the page it holds in server-side mode, since it has nothing else', async () => {
    const { c } = await setup({ serverSide: true, totalCount: 500 });
    c.exportCsv();
    expect(await csvRows()).toHaveLength(4);
  });

  it('still writes the header row when there is nothing to export', async () => {
    // A zero-byte file looks like a failed download; a header-only file does not.
    const { c } = await setup({ rows: [] });
    c.exportCsv();
    expect(await csvRows()).toEqual(['Name,Age,Status']);
  });
});
