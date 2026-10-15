import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import {
  DtAutoFocusDirective,
  SvDataTableComponent,
  type EditCompleteEvent,
  type TableColumn,
} from './data-table.component';

/**
 * ============================================================================
 *  `sv-data-table` (free) — columns, variants, density, cells, export
 * ============================================================================
 *
 * The visual surface: which columns are on screen and where they stick, how
 * a variant and a density change the classes actually emitted, how a cell
 * resolves its text and its badge colour, inline editing, expandable rows,
 * the summary footer and the mobile card list.
 *
 * The free twin has no column resizing, reordering, projected cell templates
 * or comparison layout — those are Pro. Everything it *does* share with the Pro
 * twin is asserted here independently, because the two components share no code.
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
  { key: 'status', label: 'Status', badge: true },
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
  return {
    fixture,
    c: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
  };
}

function headerCells(el: HTMLElement): HTMLTableCellElement[] {
  return [...el.querySelectorAll<HTMLTableCellElement>('thead tr:first-child th')];
}

function headerLabels(el: HTMLElement): string[] {
  return headerCells(el).map((th) => th.textContent?.trim() ?? '');
}

// ─────────────────────────────────────────────────────────────────────────────

describe('SvDataTableComponent — column visibility', () => {
  it('leaves a column marked hidden out of the grid but keeps it in the toggle list', async () => {
    const columns: TableColumn<Row>[] = [...COLUMNS, { key: 'secret', label: 'Secret', hidden: true }];
    const { el, c, fixture } = await setup({ columns, showColumnToggle: true, showToolbar: true });
    expect(c.visibleColumns().map((col) => col.key)).toEqual(['name', 'age', 'status']);
    expect(headerLabels(el)).not.toContain('Secret');

    el.querySelector<HTMLButtonElement>('button[aria-label="Toggle columns"]')!.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Secret');
  });

  // ★ Was a KNOWN DEFECT pinned here: `hidden: true` filtered the column out
  //   unconditionally, so the Columns menu could never bring it back, and its
  //   checkbox sat ticked for a column that was not on screen.
  it('reveals a column declared hidden from the Columns menu, and hides it again', async () => {
    const columns: TableColumn<Row>[] = [...COLUMNS, { key: 'secret', label: 'Secret', hidden: true }];
    const { el, c, fixture } = await setup({ columns, showColumnToggle: true, showToolbar: true });

    el.querySelector<HTMLButtonElement>('button[aria-label="Toggle columns"]')!.click();
    fixture.detectChanges();
    const secretBox = () => [...el.querySelectorAll<HTMLInputElement>('label input[type="checkbox"]')].at(-1)!;
    expect(secretBox().checked).toBe(false);
    expect(c.visibleColumns().map((col) => col.key)).not.toContain('secret');

    secretBox().click();
    fixture.detectChanges();
    expect(c.visibleColumns().map((col) => col.key)).toContain('secret');
    expect(secretBox().checked).toBe(true);
    expect(c.hiddenColumnKeys().has('secret')).toBe(false);

    secretBox().click();
    fixture.detectChanges();
    expect(c.visibleColumns().map((col) => col.key)).not.toContain('secret');
    expect(secretBox().checked).toBe(false);
  });

  it('hides and restores a column from the toggle panel', async () => {
    const { el, c, fixture } = await setup({ showColumnToggle: true, showToolbar: true });
    const toggle = el.querySelector<HTMLButtonElement>('button[aria-label="Toggle columns"]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const boxes = [...el.querySelectorAll<HTMLInputElement>('label input[type="checkbox"]')];
    expect(boxes.map((b) => b.checked)).toEqual([true, true, true]);

    boxes[1].click();
    fixture.detectChanges();
    expect(c.hiddenColumnKeys().has('age')).toBe(true);
    expect(headerLabels(el)).toEqual(['Name', 'Status']);

    boxes[1].click();
    fixture.detectChanges();
    expect(headerLabels(el)).toEqual(['Name', 'Age', 'Status']);
  });

  it('renders no toggle panel until the button is pressed', async () => {
    const { el } = await setup({ showColumnToggle: true, showToolbar: true });
    expect(el.querySelector('label input[type="checkbox"]')).toBeNull();
  });

  it('hides every column when the user asks it to, without collapsing the table', async () => {
    // The extreme end of the toggle: a header row of nothing but the fixed
    // columns, and an empty-row colspan that is still at least 1.
    const { el, c, fixture } = await setup({ rows: [] });
    c.toggleColumnVisibility('name');
    c.toggleColumnVisibility('age');
    c.toggleColumnVisibility('status');
    fixture.detectChanges();
    expect(c.visibleColumns()).toEqual([]);
    expect(headerLabels(el)).toEqual([]);
    expect(el.querySelector('tbody td')!.getAttribute('colspan')).toBe('0');
  });
});

describe('SvDataTableComponent — pinned columns', () => {
  it('sticks a left-pinned column to the left edge in both the header and the body', async () => {
    const columns: TableColumn<Row>[] = [{ ...COLUMNS[0], pinned: 'left' }, COLUMNS[1], COLUMNS[2]];
    const { c } = await setup({ columns });
    expect(c.getHeaderCellClass(columns[0]).join(' ')).toContain('sticky left-0 z-[25]');
    expect(c.getCellClass(columns[0]).join(' ')).toContain('sticky left-0 z-[5]');
  });

  it('sticks a right-pinned column to the right edge instead', async () => {
    const columns: TableColumn<Row>[] = [COLUMNS[0], COLUMNS[1], { ...COLUMNS[2], pinned: 'right' }];
    const { c } = await setup({ columns });
    expect(c.getHeaderCellClass(columns[2]).join(' ')).toContain('sticky right-0 z-[25]');
    expect(c.getCellClass(columns[2]).join(' ')).toContain('sticky right-0 z-[5]');
  });

  // ★ The header cell paints an opaque band, not the 95% tint it used to — over
  //   a scrolled body the tint let row text show through the pinned heading.
  it('paints a pinned header cell opaque, and pins the filter cell beneath it', async () => {
    const columns: TableColumn<Row>[] = [{ ...COLUMNS[0], pinned: 'left' }, COLUMNS[1], COLUMNS[2]];
    const { c } = await setup({ columns });
    const header = c.getHeaderCellClass(columns[0]).join(' ');
    expect(header).toContain('bg-white');
    expect(header).not.toContain('/95');
    expect(c.pinnedFilterClass(columns[0])).toContain('sticky left-0');
    expect(c.pinnedFilterClass(columns[1])).toBe('');
  });

  it('leaves an unpinned column in the normal flow', async () => {
    const { c } = await setup();
    expect(c.getHeaderCellClass(COLUMNS[1]).join(' ')).not.toContain('sticky');
    expect(c.getCellClass(COLUMNS[1]).join(' ')).not.toContain('sticky');
  });

  it('gives a pinned body cell an inherited background, so rows do not show through it', async () => {
    // A sticky cell that is transparent lets the scrolled-under column bleed
    // through it, which looks like a rendering glitch.
    const columns: TableColumn<Row>[] = [{ ...COLUMNS[0], pinned: 'left' }, COLUMNS[1], COLUMNS[2]];
    const { c } = await setup({ columns });
    expect(c.getCellClass(columns[0]).join(' ')).toContain('bg-inherit');
  });

  it('marks a sortable header as clickable and leaves an unsortable one alone', async () => {
    const { c } = await setup();
    expect(c.getHeaderCellClass(COLUMNS[0]).join(' ')).toContain('cursor-pointer');
    expect(c.getHeaderCellClass(COLUMNS[2]).join(' ')).not.toContain('cursor-pointer');
  });

  it('applies a declared min/max width to the header and the cell', async () => {
    const columns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', minWidth: '12rem', maxWidth: '20rem' },
    ];
    const { el } = await setup({ columns });
    expect(headerCells(el)[0].style.minWidth).toBe('12rem');
    expect(headerCells(el)[0].style.maxWidth).toBe('20rem');
    expect(el.querySelector<HTMLElement>('tbody td')!.style.maxWidth).toBe('20rem');
  });
});

describe('SvDataTableComponent — visual variants', () => {
  it('default: a bordered card with divider rules between rows', async () => {
    const { c } = await setup({ variant: 'default' });
    expect(c.rootClass()).toContain('border border-gray-200/80');
    expect(c.rootClass()).toContain('shadow-sm');
    expect(c.tableClass()).toBe('min-w-full divide-y divide-gray-200 dark:divide-gray-700');
    expect(c.tbodyClass()).toContain('divide-y');
  });

  it('striped: tints every other row and leaves the rest solid', async () => {
    const { c } = await setup({ variant: 'striped' });
    expect(c.getRowClass(ROWS[0], 0)).toContain('bg-white dark:bg-gray-900');
    expect(c.getRowClass(ROWS[1], 1)).toContain('bg-gray-50/60 dark:bg-gray-800/25');
    expect(c.getRowClass(ROWS[2], 2)).toContain('bg-white dark:bg-gray-900');
  });

  it('bordered: rules every cell and drops the row dividers', async () => {
    const { c } = await setup({ variant: 'bordered' });
    expect(c.tableClass()).toBe('min-w-full border-collapse');
    expect(c.tbodyClass()).not.toContain('divide-y');
    expect(c.getHeaderCellClass(COLUMNS[0])).toContain('border border-gray-200 dark:border-gray-700');
    expect(c.getCellClass(COLUMNS[0])).toContain('border border-gray-200 dark:border-gray-700');
  });

  it('borderless: no outer border, no cell rules, no row dividers', async () => {
    const { c } = await setup({ variant: 'borderless' });
    expect(c.rootClass()).not.toContain('border border-gray-200/80');
    expect(c.tbodyClass()).not.toContain('divide-y');
    expect(c.getCellClass(COLUMNS[0]).join(' ')).not.toContain('border ');
  });

  it('unstriped variants leave every row the same colour', async () => {
    const { c } = await setup({ variant: 'default' });
    expect(c.getRowClass(ROWS[1], 1)).toContain('bg-white dark:bg-gray-900');
    expect(c.getRowClass(ROWS[1], 1)).not.toContain('bg-gray-50/60 dark:bg-gray-800/25');
  });

  it('appends customClass to the root so a host can override the surface', async () => {
    const { c } = await setup({ customClass: 'my-table' });
    expect(c.rootClass().endsWith('my-table')).toBe(true);
  });

  it('appends a per-row class from rowClassFn, and nothing when it returns empty', async () => {
    const { c } = await setup({ rowClassFn: (row: Row) => (row.status === 'pending' ? 'ring-2' : '') });
    expect(c.getRowClass(ROWS[1], 1)).toContain('ring-2');
    expect(c.getRowClass(ROWS[0], 0)).not.toContain('ring-2');
    // The falsy return must not push an empty string into the class list.
    expect(c.getRowClass(ROWS[0], 0).every((x) => x !== '')).toBe(true);
  });
});

describe('SvDataTableComponent — density', () => {
  it('compact: the tightest padding and the smallest text', async () => {
    const { c } = await setup({ density: 'compact' });
    expect(c.effectiveDensity()).toBe('compact');
    expect(c.rowPadding()).toBe('px-3 py-1.5');
    expect(c.headerPadding()).toBe('px-3 py-2');
    expect(c.cellTextSize()).toBe('text-xs');
  });

  it('comfortable: the default middle setting', async () => {
    const { c } = await setup();
    expect(c.effectiveDensity()).toBe('comfortable');
    expect(c.rowPadding()).toBe('px-4 py-2.5');
    expect(c.headerPadding()).toBe('px-4 py-3');
    expect(c.cellTextSize()).toBe('text-[13px]');
  });

  it('spacious: the loosest padding, at the same text size as comfortable', async () => {
    const { c } = await setup({ density: 'spacious' });
    expect(c.effectiveDensity()).toBe('spacious');
    expect(c.rowPadding()).toBe('px-5 py-4');
    expect(c.headerPadding()).toBe('px-5 py-3.5');
    expect(c.cellTextSize()).toBe('text-[13px]');
  });

  it('honours the deprecated compact flag as a density of compact', async () => {
    const { c } = await setup({ compact: true });
    expect(c.effectiveDensity()).toBe('compact');
  });

  it('lets an explicit density win over the deprecated flag once the picker is used', async () => {
    const { c } = await setup({ compact: true });
    c.densityOverride.set('spacious');
    expect(c.effectiveDensity()).toBe('spacious');
  });

  it('lets the toolbar picker override the bound density, and says which one is on', async () => {
    const { el, c, fixture } = await setup({
      density: 'comfortable',
      showDensityToggle: true,
      showToolbar: true,
    });
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Row density"] button')];
    expect(buttons.map((b) => b.title)).toEqual(['Compact', 'Comfortable', 'Spacious']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);

    buttons[2].click();
    fixture.detectChanges();
    expect(c.densityOverride()).toBe('spacious');
    expect(c.effectiveDensity()).toBe('spacious');
    expect(
      [...el.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Row density"] button')]
        .map((b) => b.getAttribute('aria-pressed')),
    ).toEqual(['false', 'false', 'true']);
  });

  it('drives the rendered cell padding, not just a computed string', async () => {
    const { el } = await setup({ density: 'compact' });
    expect(el.querySelector('tbody td')!.className).toContain('px-3 py-1.5');
  });
});

describe('SvDataTableComponent — cell rendering', () => {
  it('aligns a column left, centre or right on request', async () => {
    const { c } = await setup();
    expect(c.alignClass({ key: 'a', label: 'A' })).toBe('text-left');
    expect(c.alignClass({ key: 'a', label: 'A', align: 'left' })).toBe('text-left');
    expect(c.alignClass({ key: 'a', label: 'A', align: 'center' })).toBe('text-center');
    expect(c.alignClass({ key: 'a', label: 'A', align: 'right' })).toBe('text-right');
  });

  it('prefers a column render function over the raw value', async () => {
    const columns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', render: (row) => `${row.name} (${row.age})` },
    ];
    const { el, c } = await setup({ columns });
    expect(c.cellValue(ROWS[0], columns[0])).toBe('Charlie (30)');
    expect(el.querySelector('tbody td')!.textContent?.trim()).toBe('Charlie (30)');
  });

  it('renders a null cell as empty text rather than the word null', async () => {
    const { c } = await setup();
    const row = { id: 4, name: null, age: 1, status: 'active' } as unknown as Row;
    expect(c.cellValue(row, COLUMNS[0])).toBe('');
  });

  it('renders a falsy-but-real value rather than swallowing it', async () => {
    // `val == null` and not `!val`: 0 and the empty string are data.
    const { c } = await setup();
    const row = { id: 4, name: '', age: 0, status: 'active' } as unknown as Row;
    expect(c.cellValue(row, COLUMNS[1])).toBe('0');
  });

  it('colours a badge cell from the shared status vocabulary', async () => {
    const { el, c } = await setup();
    expect(c.badgeClass(ROWS[0], COLUMNS[2])).toContain('bg-accent-100');
    expect(c.badgeClass(ROWS[1], COLUMNS[2])).toContain('bg-warning-100');
    expect(el.querySelector('tbody tr td:last-child span')!.className).toContain('rounded-full');
  });

  it('normalises a spaced status to the underscored key before looking it up', async () => {
    const { c } = await setup();
    const row = { id: 5, name: 'Dana', age: 1, status: 'On Leave' } as Row;
    expect(c.badgeClass(row, COLUMNS[2])).toContain('bg-purple-100');
  });

  it('falls back to a neutral badge for a status it does not know', async () => {
    const { c } = await setup();
    const row = { id: 6, name: 'Eve', age: 1, status: 'quantum' } as Row;
    expect(c.badgeClass(row, COLUMNS[2])).toContain('bg-gray-100');
  });

  it('falls back to a neutral badge for a missing status too', async () => {
    const { c } = await setup();
    const row = { id: 7, name: 'Fay', age: 1 } as unknown as Row;
    expect(c.badgeClass(row, COLUMNS[2])).toContain('bg-gray-100');
  });

  it('lets a column override the badge colour for its own values', async () => {
    const col: TableColumn<Row> = {
      key: 'status',
      label: 'Status',
      badge: true,
      badgeColors: { active: 'bg-fuchsia-100' },
    };
    const { c } = await setup({ columns: [col] });
    expect(c.badgeClass(ROWS[0], col)).toBe('bg-fuchsia-100');
    // An override for one value must not wipe the shared vocabulary for others.
    expect(c.badgeClass(ROWS[1], col)).toContain('bg-warning-100');
  });

  it('renders an info icon only for a column that declares a description', async () => {
    const columns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', description: 'The full name' },
      { key: 'age', label: 'Age' },
    ];
    const { el } = await setup({ columns });
    expect(headerCells(el)[0].querySelectorAll('svg').length).toBeGreaterThan(0);
    expect(headerCells(el)[1].querySelectorAll('svg')).toHaveLength(0);
  });
});

describe('SvDataTableComponent — inline editing', () => {
  const EDITABLE: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', editable: true },
    { key: 'age', label: 'Age' },
  ];

  it('marks an editable cell as clickable', async () => {
    const { c } = await setup({ columns: EDITABLE });
    expect(c.getCellClass(EDITABLE[0])).toContain('cursor-pointer');
    expect(c.getCellClass(EDITABLE[1])).not.toContain('cursor-pointer');
  });

  it('moves focus into the editor once it renders', async () => {
    const { el, fixture } = await setup({ columns: EDITABLE });
    el.querySelector<HTMLTableCellElement>('tbody td')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(el.querySelector('input[aria-label="Edit cell value"]'));
  });

  it('opens an input seeded with the current value on double-click', async () => {
    const { el, c, fixture } = await setup({ columns: EDITABLE });
    el.querySelector<HTMLTableCellElement>('tbody td')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();

    expect(c.isEditing(ROWS[0], EDITABLE[0])).toBe(true);
    const input = el.querySelector<HTMLInputElement>('input[aria-label="Edit cell value"]')!;
    expect(input.value).toBe('Charlie');
  });

  it('refuses to edit a column that is not editable', async () => {
    const { el, c } = await setup({ columns: EDITABLE });
    el.querySelectorAll<HTMLTableCellElement>('tbody tr td')[1]
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(c.editingCell()).toBeNull();
  });

  it('reports the old and the new value on Enter and closes the editor', async () => {
    const { el, c, fixture } = await setup({ columns: EDITABLE });
    const seen: EditCompleteEvent<Row>[] = [];
    c.editComplete.subscribe((e) => seen.push(e));

    el.querySelector<HTMLTableCellElement>('tbody td')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    const input = el.querySelector<HTMLInputElement>('input[aria-label="Edit cell value"]')!;
    input.value = 'Charlotte';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ row: ROWS[0], oldValue: 'Charlie', newValue: 'Charlotte' });
    expect(seen[0].column.key).toBe('name');
    expect(c.editingCell()).toBeNull();
    expect(el.querySelector('input[aria-label="Edit cell value"]')).toBeNull();
  });

  it('discards the draft on Escape without reporting an edit', async () => {
    // A cancelled edit that still emits would persist a change the user
    // explicitly backed out of.
    const { el, c, fixture } = await setup({ columns: EDITABLE });
    const seen: EditCompleteEvent<Row>[] = [];
    c.editComplete.subscribe((e) => seen.push(e));

    el.querySelector<HTMLTableCellElement>('tbody td')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    const input = el.querySelector<HTMLInputElement>('input[aria-label="Edit cell value"]')!;
    input.value = 'Nope';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(seen).toEqual([]);
    expect(c.editingCell()).toBeNull();
  });

  it('ignores a save aimed at a cell that is not the one being edited', async () => {
    const { c } = await setup({ columns: EDITABLE });
    const seen: EditCompleteEvent<Row>[] = [];
    c.editComplete.subscribe((e) => seen.push(e));
    c.startEdit(ROWS[0], EDITABLE[0], new MouseEvent('dblclick'));
    c.saveEdit(ROWS[1], EDITABLE[0]);
    c.saveEdit(ROWS[0], EDITABLE[1]);
    expect(seen).toEqual([]);
    expect(c.editingCell()).not.toBeNull();
  });

  it('ignores a save when no cell is being edited at all', async () => {
    const { c } = await setup({ columns: EDITABLE });
    const seen: EditCompleteEvent<Row>[] = [];
    c.editComplete.subscribe((e) => seen.push(e));
    c.saveEdit(ROWS[0], EDITABLE[0]);
    expect(seen).toEqual([]);
  });

  it('closes without reporting an edit when the value never changed', async () => {
    // Double-clicking a cell and clicking away is not an edit. Emitting there
    // costs the host a write — and, for a host that persists on every event, a
    // request — for a value identical to the one it already holds.
    const { el, c, fixture } = await setup({ columns: EDITABLE });
    const seen: EditCompleteEvent<Row>[] = [];
    c.editComplete.subscribe((e) => seen.push(e));

    el.querySelector<HTMLTableCellElement>('tbody td')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    el.querySelector<HTMLInputElement>('input[aria-label="Edit cell value"]')!
      .dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(seen).toEqual([]);
    expect(c.editingCell()).toBeNull();
  });

  it('does not treat a cell in another row as the one being edited', async () => {
    const { c } = await setup({ columns: EDITABLE });
    c.startEdit(ROWS[0], EDITABLE[0], new MouseEvent('dblclick'));
    expect(c.isEditing(ROWS[1], EDITABLE[0])).toBe(false);
    expect(c.isEditing(ROWS[0], EDITABLE[1])).toBe(false);
  });
});

describe('SvDataTableComponent — expandable rows', () => {
  it('renders no expand affordance until asked', async () => {
    const { el } = await setup();
    expect(el.querySelector('button[aria-label="Toggle row details"]')).toBeNull();
  });

  it('opens a detail row per row and reports which row was expanded', async () => {
    const { el, c, fixture } = await setup({ expandable: true });
    const seen: Row[] = [];
    c.rowExpand.subscribe((r) => seen.push(r));

    const toggle = el.querySelector<HTMLButtonElement>('button[aria-label="Toggle row details"]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();
    expect(c.isExpanded(ROWS[0])).toBe(true);
    expect(seen).toEqual([ROWS[0]]);
    expect(
      el.querySelector<HTMLButtonElement>('button[aria-label="Toggle row details"]')!
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(el.querySelectorAll('tbody dl')).toHaveLength(1);
  });

  it('closes an open row on a second activation', async () => {
    const { el, c, fixture } = await setup({ expandable: true });
    el.querySelector<HTMLButtonElement>('button[aria-label="Toggle row details"]')!.click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('button[aria-label="Toggle row details"]')!.click();
    fixture.detectChanges();
    expect(c.isExpanded(ROWS[0])).toBe(false);
    expect(el.querySelector('tbody dl')).toBeNull();
  });

  it('lists every column in the auto detail panel, including hidden ones', async () => {
    const { el, c, fixture } = await setup({ expandable: true });
    c.toggleColumnVisibility('age');
    c.toggleExpand(ROWS[0], new MouseEvent('click'));
    fixture.detectChanges();
    const terms = [...el.querySelectorAll('tbody dl dt')].map((d) => d.textContent?.trim());
    expect(terms).toEqual(['Name', 'Age', 'Status']);
  });

  it('renders a badge column as a badge in the detail panel too', async () => {
    const { el, c, fixture } = await setup({ expandable: true });
    c.toggleExpand(ROWS[0], new MouseEvent('click'));
    fixture.detectChanges();
    expect(el.querySelector('tbody dl dd span')!.className).toContain('rounded-full');
  });

  it('uses a custom renderer in place of the key/value grid when given one', async () => {
    const { el, c, fixture } = await setup({
      expandable: true,
      expandRender: (row: Row) => `Notes for ${row.name}`,
    });
    c.toggleExpand(ROWS[0], new MouseEvent('click'));
    fixture.detectChanges();
    expect(el.querySelector('tbody dl')).toBeNull();
    expect(el.querySelector('tbody')!.textContent).toContain('Notes for Charlie');
  });

  it('expands two rows independently', async () => {
    const { c } = await setup({ expandable: true });
    c.toggleExpand(ROWS[0], new MouseEvent('click'));
    c.toggleExpand(ROWS[1], new MouseEvent('click'));
    expect(c.isExpanded(ROWS[0])).toBe(true);
    expect(c.isExpanded(ROWS[1])).toBe(true);
    c.toggleExpand(ROWS[0], new MouseEvent('click'));
    expect(c.isExpanded(ROWS[0])).toBe(false);
    expect(c.isExpanded(ROWS[1])).toBe(true);
  });
});

describe('SvDataTableComponent — summary footer', () => {
  const WITH_FOOTER: TableColumn<Row>[] = [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age', align: 'right', footerFn: (rows) => String(rows.reduce((n, r) => n + r.age, 0)) },
    { key: 'status', label: 'Status' },
  ];

  it('stays away unless asked for', async () => {
    const { el } = await setup({ columns: WITH_FOOTER });
    expect(el.querySelector('tfoot')).toBeNull();
  });

  it('stays away when no column knows how to summarise itself', async () => {
    const { el, c } = await setup({ showFooter: true });
    expect(c.hasFooterFns()).toBe(false);
    expect(el.querySelector('tfoot')).toBeNull();
  });

  it('summarises every filtered row, not just the visible page', async () => {
    // A total that changes when you turn the page is a total nobody can use.
    const { el } = await setup({ columns: WITH_FOOTER, showFooter: true, pageSize: 2 });
    const cells = [...el.querySelectorAll('tfoot td')].map((td) => td.textContent?.trim());
    expect(cells).toEqual(['', '97', '']);
  });

  it('follows the filter, so the total describes what is on screen', async () => {
    const { el, c, fixture } = await setup({ columns: WITH_FOOTER, showFooter: true });
    c.setColFilter('status', 'pending');
    fixture.detectChanges();
    expect([...el.querySelectorAll('tfoot td')].map((td) => td.textContent?.trim()))
      .toEqual(['', '45', '']);
  });

  it('pads the footer for the select, expand and actions columns so it stays aligned', async () => {
    const { el } = await setup({
      columns: WITH_FOOTER,
      showFooter: true,
      selectable: true,
      expandable: true,
      actions: [{ label: 'Edit', handler: () => undefined }],
    });
    expect(el.querySelectorAll('tfoot td')).toHaveLength(WITH_FOOTER.length + 3);
  });

  it('disappears while loading and when the result set is empty', async () => {
    const { el, fixture } = await setup({ columns: WITH_FOOTER, showFooter: true, loading: true });
    expect(el.querySelector('tfoot')).toBeNull();
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('rows', []);
    fixture.detectChanges();
    expect(el.querySelector('tfoot')).toBeNull();
  });
});

describe('SvDataTableComponent — mobile card layout', () => {
  it('renders no card list until asked', async () => {
    const { el } = await setup();
    expect(el.querySelector('div[tabindex="0"]')).toBeNull();
  });

  it('renders one focusable card per row alongside the desktop table', async () => {
    const { el } = await setup({ cardOnMobile: true });
    const cards = [...el.querySelectorAll<HTMLElement>('div[tabindex="0"]')];
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Charlie');
    expect(el.querySelector('table')).toBeTruthy();
  });

  it('activates a card with Enter and with Space', async () => {
    const { el, c } = await setup({ cardOnMobile: true });
    const seen: Row[] = [];
    c.rowClick.subscribe((r) => seen.push(r));
    const card = el.querySelector<HTMLElement>('div[tabindex="0"]')!;
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(seen).toEqual([ROWS[0], ROWS[0]]);
  });

  it('leaves Space alone inside the card\'s own select control', async () => {
    // Space on a checkbox means "toggle me"; letting it bubble up as a row
    // activation would both select the row and navigate away from it.
    const { el, c } = await setup({ cardOnMobile: true, selectable: true });
    const seen: Row[] = [];
    c.rowClick.subscribe((r) => seen.push(r));
    const card = el.querySelector<HTMLElement>('div[tabindex="0"]')!;
    card.querySelector<HTMLInputElement>('input[aria-label="Select row"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(seen).toEqual([]);
  });

  it('shows the empty message in the card list too', async () => {
    const { el } = await setup({ cardOnMobile: true, rows: [], emptyMessage: 'Nothing here.' });
    expect(el.textContent).toContain('Nothing here.');
  });

  it('shows a card skeleton while loading rather than stale cards', async () => {
    const { el } = await setup({ cardOnMobile: true, loading: true, skeletonRows: 3 });
    const cardList = el.querySelector<HTMLElement>('.block.sm\\:hidden')!;
    expect(cardList.querySelectorAll('.skeleton-wave').length).toBeGreaterThan(0);
    expect(cardList.textContent).not.toContain('Charlie');
  });
});

describe('SvDataTableComponent — scroll container', () => {
  it('caps the body height and turns on vertical scrolling only when maxHeight is set', async () => {
    const { el } = await setup({ maxHeight: '20rem' });
    const area = el.querySelector<HTMLElement>('.overflow-x-auto')!;
    expect(area.style.maxHeight).toBe('20rem');
    expect(area.className).toContain('overflow-y-auto');
  });

  it('leaves the body uncapped by default', async () => {
    const { el } = await setup();
    const area = el.querySelector<HTMLElement>('.overflow-x-auto')!;
    expect(area.style.maxHeight).toBe('');
    expect(area.className).not.toContain('overflow-y-auto');
  });

  it('hides the decorative scroll hint from assistive tech', async () => {
    const { el } = await setup();
    expect(el.querySelector('[aria-hidden="true"].pointer-events-none')).toBeTruthy();
  });

  it('drops the scroll hint entirely when it is turned off', async () => {
    const { el } = await setup({ showScrollHint: false });
    expect(el.querySelector('[aria-hidden="true"].pointer-events-none')).toBeNull();
  });
});


/**
 * DA-07 — `svDtAutoFocus` is a signal input now, focusing after the first
 * render. It was `@Input() enabled = true` with a 0 ms timer, under which a
 * bare `svDtAutoFocus` attribute bound `''` and quietly switched focusing off.
 */
describe('DtAutoFocusDirective', () => {
  @Component({
    imports: [DtAutoFocusDirective],
    template: `<input aria-label="bare" svDtAutoFocus />`,
  })
  class BareHost {}

  @Component({
    imports: [DtAutoFocusDirective],
    template: `<input aria-label="off" [svDtAutoFocus]="false" />`,
  })
  class OffHost {}

  afterEach(() => (document.activeElement as HTMLElement | null)?.blur());

  it('focuses its host after the first render when the attribute is bare', async () => {
    const f = TestBed.createComponent(BareHost);
    f.detectChanges();
    await f.whenStable();
    expect(document.activeElement).toBe(f.nativeElement.querySelector('input'));
  });

  it('leaves focus alone when bound to false', async () => {
    const f = TestBed.createComponent(OffHost);
    f.detectChanges();
    await f.whenStable();
    expect(document.activeElement).not.toBe(f.nativeElement.querySelector('input'));
  });
});
