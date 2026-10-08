import { render } from '@testing-library/angular';
import { SvDataTableComponent, type TableColumn } from './data-table.component';

/**
 * Row identity and state ownership (audit item X-6), free tier.
 *
 * The Pro twin shares no code with this one, so its `data-table.identity.spec.ts`
 * asserts the same contract separately. Kept in step deliberately: a buyer who
 * upgrades must not find that `rowKey` means something different on the other
 * side of the paywall.
 */

interface Line extends Record<string, unknown> {
  orderId: string;
  lineNo: number;
  product: string;
}

const COLUMNS: TableColumn<Line>[] = [
  { key: 'product', label: 'Product' },
  { key: 'lineNo', label: 'Line' },
];

const LINES: Line[] = [
  { orderId: 'A', lineNo: 1, product: 'Bolt' },
  { orderId: 'A', lineNo: 2, product: 'Nut' },
  { orderId: 'B', lineNo: 1, product: 'Washer' },
];

async function setup(extra: Record<string, unknown> = {}) {
  const { fixture } = await render(SvDataTableComponent<Line>, {
    inputs: { columns: COLUMNS, rows: LINES, ...extra },
  });
  return { fixture, c: fixture.componentInstance };
}

describe('SvDataTableComponent — what identifies a row', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('keys rows on a composite the host builds, which a string could not express', async () => {
    const { c } = await setup({ rowKey: (l: Line) => `${l.orderId}/${l.lineNo}` });
    expect(c.getRowId(LINES[0])).toBe('A/1');
    expect(c.getRowId(LINES[2])).toBe('B/1');
  });

  it('still defaults to id, so no existing host has to change anything', async () => {
    const row = { id: 7 };
    const { fixture } = await render(SvDataTableComponent<Record<string, unknown>>, {
      inputs: { columns: [], rows: [row] },
    });
    expect(fixture.componentInstance.getRowId(row)).toBe(7);
  });

  it('falls back to the index and says so, rather than stringifying the row', async () => {
    const { c } = await setup({ rowKey: 'notAField' });
    expect(c.getRowId(LINES[0])).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('falling back to the list index'));
  });

  it('warns when two rows share a key, naming the table and the key', async () => {
    await setup({ rowKey: 'orderId' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sv-data-table [rows]'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"A"'));
  });

  it('gives the same row the same key on every page', async () => {
    const { c } = await setup({ rowKey: (l: Line) => `${l.orderId}/${l.lineNo}`, pageSize: 1 });
    const first = c.getRowId(LINES[2]);
    c.currentPage.set(3);
    expect(c.getRowId(LINES[2])).toBe(first);
  });
});

describe('SvDataTableComponent — who owns the expansion state', () => {
  it('opens the rows the host names, so a deep link can be honoured', async () => {
    const { c } = await setup({
      expandable: true,
      expandedRowIds: new Set(['Nut']),
      rowKey: 'product',
    });
    expect(c.isExpanded(LINES[1])).toBe(true);
    expect(c.isExpanded(LINES[0])).toBe(false);
  });

  it('emits when the user expands a row, so a host can persist it', async () => {
    const { c } = await setup({ expandable: true, rowKey: 'product' });
    const seen: string[][] = [];
    c.expandedRowIds.subscribe((s) => seen.push([...s] as string[]));

    c.toggleExpand(LINES[0], new MouseEvent('click'));
    c.toggleExpand(LINES[0], new MouseEvent('click'));

    expect(seen).toEqual([['Bolt'], []]);
  });
});

/**
 * The free tier has no layout snapshot at all, so before `hiddenColumnKeys` became
 * two-way a user's hidden columns could be neither saved nor restored — they came
 * back on every reload.
 */
describe('SvDataTableComponent — who owns the hidden columns', () => {
  it('hides the columns the host names, so a saved layout can be restored', async () => {
    const { c } = await setup({ hiddenColumnKeys: new Set(['lineNo']), rowKey: 'product' });
    expect(c.visibleColumns().map((col) => col.key)).toEqual(['product']);
  });

  it('emits when the user hides one, so a host can save the layout', async () => {
    const { c } = await setup({ rowKey: 'product' });
    const seen: string[][] = [];
    c.hiddenColumnKeys.subscribe((s) => seen.push([...s]));

    c.toggleColumnVisibility('lineNo');
    c.toggleColumnVisibility('lineNo');

    expect(seen).toEqual([['lineNo'], []]);
  });
});
