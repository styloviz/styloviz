import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  Input,
  input,
  model,
  OnInit,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  SvErrorShellComponent,
  SvLiveAnnouncer,
  svRestoreFocusedItem,
  svSnapshotFocusedItem,
  svWarnUnvirtualizedCeiling,
  patchQuery,
  createQuery,
  resolveItemKey,
  svUniqueId,
  warnOnDuplicateItemKeys,
  type SvDataError,
  type SvDataQuery,
  type SvItemKey,
  type SvSort, SvStopPropagationDirective, svToCsv, svDownloadText, SvSpinnerArcComponent } from '@styloviz/core';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';

// ─── Auto-focus directive (colocated) ────────────────────────────────────────

@Directive({ selector: '[svDtAutoFocus]', standalone: true })
export class DtAutoFocusDirective implements OnInit {
  @Input('svDtAutoFocus') enabled = true;
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  ngOnInit(): void { if (this.enabled) setTimeout(() => this.el.nativeElement.focus(), 0); }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc' | null;
export type ColumnAlign   = 'left' | 'center' | 'right';
export type TableVariant  = 'default' | 'striped' | 'bordered' | 'borderless';
export type TableDensity  = 'compact' | 'comfortable' | 'spacious';
export type SelectMode    = 'multi' | 'single';
export type FilterType    = 'text' | 'select' | 'none';
export type LoadingStyle  = 'skeleton' | 'overlay';

export interface TableColumn<T = Record<string, unknown>> {
  /** Unique key matching the row data property. */
  key:             string;
  /** Column header label. */
  label:           string;
  /** Column horizontal alignment. @default 'left' */
  align?:          ColumnAlign;
  /** Allow sorting on this column. @default false */
  sortable?:       boolean;
  /** Minimum column width (e.g., '8rem'). */
  minWidth?:       string;
  /** Maximum column width with text truncation. */
  maxWidth?:       string;
  /** Custom cell render function returning a plain-text string. */
  render?:         (row: T, col: TableColumn<T>) => string;
  /** Render cell value as a status badge pill. */
  badge?:          boolean;
  /** Map of cell values → Tailwind color classes for badge rendering. */
  badgeColors?:    Record<string, string>;
  /**
   * How important this column is when there is not room for all of them.
   *
   * ★ Used by `sv-record-grid`, which turns each row into a card on a narrow
   * screen. `'secondary'` fields sit behind a per-card disclosure instead of
   * being dropped — a responsive table that HIDES columns silently is the
   * defect the card view exists to fix, not a lighter version of it.
   * @default 'primary'
   */
  priority?:       'primary' | 'secondary';
  // ── v2 additions ──────────────────────────────────────────────────────────
  /** Pin column to 'left' or 'right' (sticky positioning). */
  pinned?:         'left' | 'right';
  /** Tooltip text rendered on the column header info icon. */
  description?:    string;
  /** Filter input type shown in the column filter row. @default 'text' */
  filterType?:     FilterType;
  /** Options for select-type column filters. */
  filterOptions?:  string[];
  /**
   * Summary cell for this column, rendered in the sticky `tfoot` row.
   *
   * ★ It receives **every row that survived filtering and sorting** — the
   * whole table, not the page and not a group. Use `groupAggregate` for the
   * per-group figure; the two have the same signature and different scopes,
   * which is exactly why this needs saying.
   */
  footerFn?:       (rows: readonly T[]) => string;
  /** Allow double-click inline cell editing. Emit editComplete to persist. */
  editable?:       boolean;
  /**
   * Rejects a draft edit before it can commit. Return the message to show the
   * user, or `null` when the value is fine.
   *
   * Runs on every keystroke and again on commit, so the error appears while the
   * offending text is still on screen rather than after the cell has closed. An
   * invalid value never emits `editComplete`. Ignored unless `editable`.
   *
   * ```ts
   * { key: 'quantity', label: 'Qty', editable: true,
   *   validate: v => /^\d+$/.test(v) ? null : 'Whole numbers only' }
   * ```
   */
  validate?:       (value: string, row: T) => string | null;
  /** Initially hidden — user can show via the column-toggle panel. */
  hidden?:         boolean;
}

export interface TableRowAction<T = Record<string, unknown>> {
  /** Display label. */
  label:      string;
  /** Icon-library name for the action. Was `iconPath` (a raw `d`). */
  icon?:  string;
  /** Called with the row when the action is triggered. */
  handler:    (row: T) => void;
  /** Return true to hide this action for a specific row. */
  hidden?:    (row: T) => boolean;
  /** Renders with red / danger styling. */
  danger?:    boolean;
}

export interface BulkAction {
  /** Display label. */
  label:     string;
  /** Icon-library name for the action. Was `iconPath` (a raw `d`). */
  icon?: string;
  /** Renders with red / danger styling. */
  danger?:   boolean;
  /** Optional inline handler called with the selected IDs. */
  handler?:  (ids: Set<string | number>) => void;
}

export interface SortState {
  key:       string;
  direction: SortDirection;
}

export interface CellClickEvent<T = Record<string, unknown>> {
  row:    T;
  column: TableColumn<T>;
  value:  string;
}

export interface EditCompleteEvent<T = Record<string, unknown>> {
  row:      T;
  column:   TableColumn<T>;
  oldValue: string;
  newValue: string;
}

export interface ServerPageEvent {
  page:     number;
  pageSize: number;
  sorts:    SortState[];
  filters:  Record<string, string>;
  search:   string;
  /**
   * Monotonic id of this request, starting at 1. Pass it back to
   * `acceptsResponse()` before applying a response — see the ordering guarantee
   * documented on that method. Always set by the table; optional in the type
   * only so objects a host builds by hand keep compiling.
   */
  requestId?: number;
}

// ─── Default badge colors ─────────────────────────────────────────────────────

const DEFAULT_BADGE_COLORS: Record<string, string> = {
  active:     'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
  inactive:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  pending:    'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  error:      'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
  success:    'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
  warning:    'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  info:       'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-400',
  draft:      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  published:  'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400',
  on_leave:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

// ─── Density icon paths (16×16 SVG viewBox) ────────────────────────────────────

const DENSITY_OPTIONS: readonly { value: TableDensity; label: string; icon: string }[] = [
  // ★ Icon-library NAMES (were 16-box `d` strings). The three are chosen as a
  //   FAMILY — 4 lines / 3 lines / 2 lines — so the control reads as a
  //   progression the way the hand-drawn 5/3/2 set did. `rows-2` was tried and
  //   rejected: a boxed shape next to two line stacks does not read as one
  //   scale. Rendered all three at 72px and 14px before choosing.
  { value: 'compact',     label: 'Compact',     icon: 'align-justify' },
  { value: 'comfortable', label: 'Comfortable', icon: 'menu' },
  { value: 'spacious',    label: 'Spacious',    icon: 'equal' },
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * DataTableComponent v2 — Premium feature-rich data table.
 *
 * New in v2:
 * - Visual variants: default | striped | bordered | borderless
 * - Density presets: compact | comfortable | spacious (+ toolbar toggle)
 * - Built-in toolbar: title, global search, column toggle, density picker, CSV export
 * - Multi-column sort via Shift+click
 * - Per-column text/select filters with active filter chips
 * - Expandable rows with auto key-value detail panel
 * - Inline cell editing (double-click) → emits editComplete
 * - Bulk actions toolbar
 * - Footer summary row via column footerFn
 * - Single-select mode (radio buttons)
 * - Status-based row coloring via rowClassFn
 * - Sticky / pinned columns (left or right)
 * - Server-side mode (pagination + sort + filter emitted)
 * - Loading overlay (alternative to skeleton)
 * - Mobile card layout
 * - First/Last page buttons + page-number pills
 * - CSV export
 */
@Component({
  selector: 'sv-data-table',
  standalone: true,
  imports: [NgClass, DtAutoFocusDirective, SvIconComponent, SvErrorShellComponent, SvStopPropagationDirective, SvSpinnerArcComponent],
  templateUrl: './data-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvDataTableComponent<T extends Record<string, unknown> = Record<string, unknown>> {

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly announcer = inject(SvLiveAnnouncer);

  constructor() {
    // `X-10`: this table is paginated by default, so the page size is its
    // ceiling. With pagination off it renders every row — past the documented
    // ceiling, say so once in dev mode.
    effect(() => svWarnUnvirtualizedCeiling('sv-data-table', this.pagedRows().length, false));

    // `X-12`: a row holding focus can leave the page — a filter it no longer
    // matches, an edit, a host refresh. Note where focus was BEFORE the new
    // rows render, and move it to the row now at that index afterwards.
    effect(() => {
      this.pagedRows();
      const snapshot = untracked(() => svSnapshotFocusedItem(this._rowEls(), 'data-sv-row-key'));
      if (!snapshot) return;
      setTimeout(() =>
        svRestoreFocusedItem(this._rowEls(), 'data-sv-row-key', snapshot, {
          fallback: this.host.nativeElement.querySelector('[data-sv-table-scroller]'),
          announce: 'The focused row is no longer shown. Focus moved to the next row.',
          announcer: this.announcer,
        }), 0);
    });
  }

  /** The rendered data rows, in order. */
  private _rowEls(): Element[] {
    return [...this.host.nativeElement.querySelectorAll('tr[data-sv-row-key]')];
  }

  // ── Inputs — Data ─────────────────────────────────────────────────────────

  /** Column definitions (key, header, alignment, optional cell template). */
  columns    = input<TableColumn<T>[]>([]);
  /**
   * The rows to render.
   *
   * `readonly` on purpose: the table never mutates this array, and anything
   * that hands it one — a signal, a `computed`, `svDataController.items` — is
   * handing over a value it still owns. A mutable `T[]` here rejected every
   * one of those at the template boundary while promising a write the table
   * does not perform.
   */
  rows       = input<readonly T[]>([]);
  /**
   * What identifies a row: a property name, or a function for composite keys.
   *
   * Widened from `string` because a row identified by two fields — an order line
   * keyed on `orderId` + `lineNo`, a matrix cell on `row` + `col` — had no way
   * to say so, and the fallback silently keyed it on the whole row's JSON.
   * See the identity contract on `resolveItemKey` in `@styloviz/core`.
   *
   * @default 'id'
   */
  rowKey     = input<SvItemKey<T>>('id');

  // ── Inputs — Selection ────────────────────────────────────────────────────

  /** Enable row selection. @default false */
  selectable  = input<boolean>(false);
  /** 'multi' = checkboxes, 'single' = radio buttons. @default 'multi' */
  selectMode  = input<SelectMode>('multi');
  /** Selected row ids (two-way). */
  selectedIds = model<Set<string | number>>(new Set());
  /**
   * Which rows have their detail panel open (two-way).
   *
   * A `model` rather than internal state because it is the same kind of fact as
   * `selectedIds`: a host restoring a table after a route change, or opening the
   * row a deep link names, has to be able to write it — and one that persists
   * layout has to be able to see it change. Held in a plain signal it was
   * neither settable nor observable from outside.
   */
  expandedRowIds = model<Set<string | number>>(new Set());

  // ── Inputs — Actions ──────────────────────────────────────────────────────

  /** Per-row action buttons. */
  actions     = input<TableRowAction<T>[]>([]);
  /** Bulk actions applied to selected rows. */
  bulkActions = input<BulkAction[]>([]);

  // ── Inputs — Loading ──────────────────────────────────────────────────────

  /** Show a loading state. @default false */
  loading      = input<boolean>(false);
  /** 'skeleton' rows or full-table 'overlay' spinner. @default 'skeleton' */
  loadingStyle = input<LoadingStyle>('skeleton');
  /** Number of skeleton rows while loading. @default 5 */
  skeletonRows = input<number>(5);

  // ── Inputs — Pagination ───────────────────────────────────────────────────

  /** Enable client-side pagination. @default true */
  paginated       = input<boolean>(true);
  /** Rows per page (two-way). @default 10 */
  pageSize        = model<number>(10);
  /** Page-size options offered in the toolbar. @default [10,25,50] */
  pageSizeOptions = input<number[]>([10, 25, 50]);
  /** Server-side mode: disables client filtering/sorting/paging. */
  serverSide      = input<boolean>(false);
  /** Total row count when in server-side mode. */
  totalCount      = input<number | null>(null);

  // ── Inputs — Visual ───────────────────────────────────────────────────────

  /** Table style variant. @default 'default' */
  variant        = input<TableVariant>('default');
  /** Row density: comfortable, compact, etc. @default 'comfortable' */
  density        = input<TableDensity>('comfortable');
  /** Deprecated shorthand for compact density. @deprecated Use density="compact". */
  compact        = input<boolean>(false);
  /** Max body height (CSS length) before the table scrolls. */
  maxHeight      = input<string | null>(null);
  /** Show a hint when the table is horizontally scrollable. @default true */
  showScrollHint = input<boolean>(true);
  /** Callback returning extra Tailwind classes for a given row. */
  rowClassFn     = input<((row: T) => string) | null>(null);

  // ── Inputs — Toolbar ──────────────────────────────────────────────────────

  /**
   * Show the toolbar strip. Left unset it DERIVES from whether the toolbar has
   * anything to put in it — binding `tableTitle` or `[searchable]` used to
   * render nothing at all unless you also remembered this flag, which is a
   * silent no-op: the API accepted your input and ignored it.
   *
   * Set it explicitly to force the strip on (an empty bar as a spacer) or off
   * (a title used only as the accessible name). Every existing call site passes
   * it, so nothing changes for them.
   */
  showToolbar       = input<boolean | undefined>(undefined);

  /** `showToolbar` when set, otherwise "does the toolbar have any content?". */
  protected readonly resolvedShowToolbar = computed(
    () => this.showToolbar() ?? (!!this.tableTitle() || this.searchable()),
  );
  /** Title shown in the toolbar. */
  tableTitle        = input<string>('');
  /** Show a search box in the toolbar. @default false */
  searchable        = input<boolean>(false);
  /** Show the column visibility toggle. @default false */
  showColumnToggle  = input<boolean>(false);
  /** Show an export (CSV) control. @default false */
  exportable        = input<boolean>(false);
  /** Show the density toggle. @default false */
  showDensityToggle = input<boolean>(false);

  // ── Inputs — Features ─────────────────────────────────────────────────────

  /** Enable per-column filters. @default false */
  columnFilters = input<boolean>(false);
  /** Allow sorting by multiple columns. @default false */
  multiSort     = input<boolean>(false);
  /** Enable expandable rows. @default false */
  expandable    = input<boolean>(false);
  /** Renderer for the expanded row detail. */
  expandRender  = input<((row: T) => string) | null>(null);
  /** Show a table footer row. @default false */
  showFooter    = input<boolean>(false);
  /** Render rows as cards on small screens. @default false */
  cardOnMobile  = input<boolean>(false);

  // ── Inputs — Other ────────────────────────────────────────────────────────

  /** Message shown when there are no rows. @default 'No data to display.' */
  emptyMessage = input<string>('No data to display.');
  /** Extra CSS classes for the root element. */
  customClass  = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted with the new sort state when sorting changes. */
  sortChange       = output<SortState[]>();
  /** Emitted with the set of selected row ids. */
  selectionChange  = output<Set<string | number>>();
  /** Emitted with the clicked row. */
  rowClick         = output<T>();
  /** Emitted with the clicked cell context. */
  cellClick        = output<CellClickEvent<T>>();
  /** Emitted when an inline cell edit completes (Pro). */
  editComplete     = output<EditCompleteEvent<T>>();
  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an
   * `HttpErrorResponse`. Rendered in place of the rows, above the toolbar so
   * the user can still change the filter that caused it.
   * @default null
   */
  error = input<SvDataError | string | null>(null);

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  /**
   * Everything the user is asking to see, in the kit's shared shape.
   *
   * This is the output to wire in `serverSide` mode: one handler regardless of
   * whether they paged, sorted, filtered or searched, and the same
   * `SvDataQuery` every other component in the kit emits — so `@styloviz/data`
   * and a hand-rolled fetch both take it without a translation layer.
   */
  readonly queryChange = output<SvDataQuery>();

  /**
   * Emitted in `serverSide` mode with the page, page size, sorts, column filters,
   * search text and request id whenever the user changes any of them.
   * @deprecated Use `queryChange`, which carries the same information in the
   * kit-wide `SvDataQuery` shape. Still emitted, and will be for one more
   * minor.
   */
  serverPageChange = output<ServerPageEvent>();
  /** Emitted with the row when the user expands or collapses its detail panel. */
  rowExpand        = output<T>();
  /** Emitted with the bulk action and the selected row ids. */
  bulkActionClick  = output<{ action: BulkAction; selectedIds: Set<string | number> }>();

  // ── Internal signals ──────────────────────────────────────────────────────

  readonly sorts               = signal<SortState[]>([]);
  readonly currentPage         = signal<number>(1);
  readonly openActionRowId     = signal<string | number | null>(null);
  readonly searchQuery         = signal<string>('');
  readonly columnFiltersRecord = signal<Record<string, string>>({});
  /**
   * Which columns the user has hidden (two-way).
   *
   * A `model` rather than internal state so a saved table layout can be restored
   * by binding it — the free tier had no other way in at all, and the Pro tier
   * could only reach it through a whole-state snapshot. Declared here with the
   * rest of the internal view state because that is where the column toggle lives;
   * it is nonetheless part of the public API.
   */
  readonly hiddenColumnKeys    = model<Set<string>>(new Set());
  /**
   * Columns declared `hidden: true` that the user has since shown from the
   * Columns menu.
   *
   * ★ `hidden` is documented as "initially hidden — the user can show it from
   * the column-toggle panel", but the table used to filter `!col.hidden`
   * unconditionally: the column could never come back, and its checkbox (bound
   * to `hiddenColumnKeys` alone) sat TICKED for a column that was not on screen.
   *
   * Two-way, like `hiddenColumnKeys`: together the two ARE the column-visibility
   * view, and a host that persists one without the other restores a table whose
   * revealed columns have vanished again (`check:collection-identity`).
   */
  readonly revealedColumnKeys  = model<ReadonlySet<string>>(new Set());
  readonly editingCell         = signal<{ rowId: string | number; key: string } | null>(null);
  readonly editDraft           = signal<string>('');
  readonly columnToggleOpen    = signal<boolean>(false);
  readonly densityOverride     = signal<TableDensity | null>(null);

  readonly densityOptions = DENSITY_OPTIONS;

  // ── Computed — columns ────────────────────────────────────────────────────

  visibleColumns = computed<TableColumn<T>[]>(() => {
    const hidden = this.hiddenColumnKeys();
    const revealed = this.revealedColumnKeys();
    return this.columns().filter(col => (!col.hidden || revealed.has(col.key)) && !hidden.has(col.key));
  });

  // ── Computed — density ────────────────────────────────────────────────────

  effectiveDensity = computed<TableDensity>(() =>
    this.densityOverride() ?? (this.compact() ? 'compact' : this.density())
  );

  rowPadding = computed<string>(() => {
    switch (this.effectiveDensity()) {
      case 'compact':  return 'px-3 py-1.5';
      case 'spacious': return 'px-5 py-4';
      default:         return 'px-4 py-2.5';
    }
  });

  headerPadding = computed<string>(() => {
    switch (this.effectiveDensity()) {
      case 'compact':  return 'px-3 py-2';
      case 'spacious': return 'px-5 py-3.5';
      default:         return 'px-4 py-3';
    }
  });

  cellTextSize = computed<string>(() =>
    this.effectiveDensity() === 'compact' ? 'text-xs' : 'text-[13px]'
  );

  // ── Computed — data pipeline ──────────────────────────────────────────────

  readonly filteredRows = computed<readonly T[]>(() => {
    if (this.serverSide()) return this.rows();
    const q        = this.searchQuery().toLowerCase().trim();
    const colFltrs = this.columnFiltersRecord();
    const cols     = this.columns();

    return this.rows().filter(row => {
      if (q) {
        const hit = cols.some(col =>
          String(row[col.key] ?? '').toLowerCase().includes(q)
        );
        if (!hit) return false;
      }
      for (const [key, val] of Object.entries(colFltrs)) {
        if (!val) continue;
        if (!String(row[key] ?? '').toLowerCase().includes(val.toLowerCase()))
          return false;
      }
      return true;
    });
  });

  readonly sortedRows = computed<readonly T[]>(() => {
    if (this.serverSide()) return this.filteredRows();
    const sorts = this.sorts().filter(s => s.direction !== null);
    const data  = this.filteredRows().slice();
    if (sorts.length === 0) return data;

    return data.sort((a, b) => {
      for (const s of sorts) {
        const av = a[s.key], bv = b[s.key];
        if (av == null && bv == null) continue;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = String(av).localeCompare(String(bv), undefined, {
          numeric: true, sensitivity: 'base',
        });
        if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  });

  pagedRows = computed<readonly T[]>(() => {
    if (this.serverSide()) return this.rows();
    if (!this.paginated()) return this.sortedRows();
    const ps   = this.pageSize();
    const page = this.currentPage();
    return this.sortedRows().slice((page - 1) * ps, page * ps);
  });

  totalDisplayCount = computed<number>(() =>
    this.serverSide()
      ? (this.totalCount() ?? this.rows().length)
      : this.sortedRows().length
  );

  totalPages = computed<number>(() =>
    Math.max(1, Math.ceil(this.totalDisplayCount() / this.pageSize()))
  );

  rangeStart = computed<number>(() =>
    this.totalDisplayCount() === 0
      ? 0
      : (this.currentPage() - 1) * this.pageSize() + 1
  );

  rangeEnd = computed<number>(() =>
    Math.min(this.currentPage() * this.pageSize(), this.totalDisplayCount())
  );

  allSelected = computed<boolean>(() => {
    const paged = this.pagedRows();
    if (!paged.length) return false;
    const sel = this.selectedIds();
    return paged.every(row => sel.has(this.getRowId(row)));
  });

  someSelected = computed<boolean>(() => {
    const paged = this.pagedRows();
    const sel   = this.selectedIds();
    return paged.some(row => sel.has(this.getRowId(row))) && !this.allSelected();
  });

  skeletonArray = computed<number[]>(() =>
    Array.from({ length: this.skeletonRows() }, (_, i) => i)
  );

  activeFilterChips = computed<{ key: string; label: string; value: string }[]>(() => {
    const chips: { key: string; label: string; value: string }[] = [];
    const q = this.searchQuery().trim();
    if (q) chips.push({ key: '__search__', label: 'Search', value: q });
    const cols = this.columns();
    for (const [key, value] of Object.entries(this.columnFiltersRecord())) {
      if (!value) continue;
      const col = cols.find(c => c.key === key);
      chips.push({ key, label: col?.label ?? key, value });
    }
    return chips;
  });

  hasFooterFns = computed<boolean>(() =>
    this.columns().some(col => !!col.footerFn)
  );

  totalColspan = computed<number>(() => {
    let n = this.visibleColumns().length;
    if (this.selectable()) n++;
    if (this.expandable()) n++;
    if (this.actions().length > 0) n++;
    return n;
  });

  pageNumbers = computed<number[]>(() => {
    const total   = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [1];
    if (current > 3) pages.push(-1);
    const start = Math.max(2, current - 1);
    const end   = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  });

  // ── Computed — CSS helpers ─────────────────────────────────────────────────

  rootClass = computed<string>(() => {
    const v    = this.variant();
    const base = 'flex flex-col overflow-hidden rounded-xl shadow-sm ';
    const border = v === 'borderless'
      ? ''
      : 'border border-gray-200/80 dark:border-gray-800/60 ';
    return base + border + 'bg-white dark:bg-gray-900 ' + this.customClass();
  });

  tableClass = computed<string>(() =>
    this.variant() === 'bordered'
      ? 'min-w-full border-collapse'
      : 'min-w-full divide-y divide-gray-200 dark:divide-gray-700'
  );

  tbodyClass = computed<string>(() => {
    const v    = this.variant();
    const base = 'bg-white dark:bg-gray-900 ';
    return (v === 'bordered' || v === 'borderless')
      ? base
      : base + 'divide-y divide-gray-100 dark:divide-gray-800/60';
  });

  // ── Sort ──────────────────────────────────────────────────────────────────

  onSort(col: TableColumn<T>, event: MouseEvent | KeyboardEvent): void {
    if (!col.sortable) return;
    const isMulti  = event.shiftKey && this.multiSort();
    const current  = this.sorts();
    const existing = current.findIndex(s => s.key === col.key);

    if (isMulti) {
      const newSorts = [...current];
      if (existing >= 0) {
        const cur = newSorts[existing];
        if (cur.direction === 'asc') newSorts[existing] = { ...cur, direction: 'desc' };
        else newSorts.splice(existing, 1);
      } else {
        newSorts.push({ key: col.key, direction: 'asc' });
      }
      this.sorts.set(newSorts.filter(s => s.direction !== null));
    } else {
      let next: SortDirection;
      if (existing < 0 || current.length > 1)        next = 'asc';
      else if (current[0].direction === 'asc')        next = 'desc';
      else if (current[0].direction === 'desc')       next = null;
      else                                            next = 'asc';
      this.sorts.set(next ? [{ key: col.key, direction: next }] : []);
    }

    this.currentPage.set(1);
    this.sortChange.emit(this.sorts());
    if (this.serverSide()) this.emitServerEvent();
  }

  /** Keyboard sort activation for focusable column headers. */
  onSortKeydown(col: TableColumn<T>, event: KeyboardEvent): void {
    if (!col.sortable) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.onSort(col, event);
    }
  }

  /** Library icon name for a column's sort state. */
  sortIconName(col: TableColumn<T>): string {
    const s = this.sorts().find(x => x.key === col.key);
    if (!s || !s.direction) return 'chevrons-up-down';
    return s.direction === 'asc' ? 'chevron-up' : 'chevron-down';
  }

  sortIcon(col: TableColumn<T>): string {
    const s = this.sorts().find(x => x.key === col.key);
    if (!s || !s.direction) return 'M8 9l4-4 4 4m0 6l-4 4-4-4';
    return s.direction === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7';
  }

  isColumnSorted(col: TableColumn<T>): boolean {
    return this.sorts().some(s => s.key === col.key && !!s.direction);
  }

  getSortIndex(col: TableColumn<T>): number {
    const idx = this.sorts().findIndex(s => s.key === col.key && !!s.direction);
    return idx >= 0 ? idx + 1 : 0;
  }

  getSortAria(col: TableColumn<T>): string | null {
    if (!col.sortable) return null;
    const s = this.sorts().find(x => x.key === col.key);
    if (!s || !s.direction) return 'none';
    return s.direction === 'asc' ? 'ascending' : 'descending';
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  /**
   * Row → key, resolved once per `rows()` change.
   *
   * Selection, expansion and `track` all have to agree on a row's identity, but
   * only `track` knows an index — and a page-relative index would give the same
   * row two different keys on two different pages. Resolving against the source
   * array here settles it in one place, and replaces a `JSON.stringify` that ran
   * per keyless row on every change detection.
   */
  private readonly rowKeys = computed(() => {
    const key = this.rowKey();
    const rows = this.rows();
    warnOnDuplicateItemKeys(rows, key, 'sv-data-table [rows]');
    const map = new Map<T, string | number>();
    rows.forEach((row, i) => map.set(row, resolveItemKey(row, key, i)));
    return map;
  });

  getRowId(row: T): string | number {
    return this.rowKeys().get(row) ?? resolveItemKey(row, this.rowKey(), -1);
  }

  isSelected(row: T): boolean {
    return this.selectedIds().has(this.getRowId(row));
  }

  toggleRow(row: T): void {
    const id  = this.getRowId(row);
    const set = new Set(this.selectedIds());
    if (this.selectMode() === 'single') {
      if (set.has(id)) { set.clear(); } else { set.clear(); set.add(id); }
    } else {
      if (set.has(id)) set.delete(id); else set.add(id);
    }
    this.selectedIds.set(set);
    this.selectionChange.emit(set);
  }

  toggleAll(): void {
    if (this.selectMode() === 'single') return;
    const paged = this.pagedRows();
    const all   = this.allSelected();
    const set   = new Set(this.selectedIds());
    if (all) paged.forEach(row => set.delete(this.getRowId(row)));
    else     paged.forEach(row => set.add(this.getRowId(row)));
    this.selectedIds.set(set);
    this.selectionChange.emit(set);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.selectionChange.emit(new Set());
  }

  // ── Row actions ───────────────────────────────────────────────────────────

  visibleActions(row: T): TableRowAction<T>[] {
    return this.actions().filter(a => !a.hidden?.(row));
  }

  toggleActionMenu(row: T, event: MouseEvent): void {
    event.stopPropagation();
    const id = this.getRowId(row);
    this.openActionRowId.update(cur => cur === id ? null : id);
  }

  isActionMenuOpen(row: T): boolean {
    return this.openActionRowId() === this.getRowId(row);
  }

  runAction(action: TableRowAction<T>, row: T, event: MouseEvent): void {
    event.stopPropagation();
    action.handler(row);
    this.openActionRowId.set(null);
  }

  closeAllMenus(): void {
    this.openActionRowId.set(null);
    this.columnToggleOpen.set(false);
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  runBulkAction(action: BulkAction): void {
    const ids = new Set(this.selectedIds());
    action.handler?.(ids);
    this.bulkActionClick.emit({ action, selectedIds: ids });
  }

  // ── Cell rendering ────────────────────────────────────────────────────────

  cellValue(row: T, col: TableColumn<T>): string {
    if (col.render) return col.render(row, col);
    const val = row[col.key];
    return val == null ? '' : String(val);
  }

  badgeClass(row: T, col: TableColumn<T>): string {
    const val    = String(row[col.key] ?? '').toLowerCase().replace(/\s+/g, '_');
    const colors = { ...DEFAULT_BADGE_COLORS, ...col.badgeColors };
    return colors[val] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }

  alignClass(col: TableColumn<T>): string {
    return { left: 'text-left', center: 'text-center', right: 'text-right' }[col.align ?? 'left'];
  }

  // ── CSS class helpers ─────────────────────────────────────────────────────

  getRowClass(row: T, index: number): string[] {
    const classes: string[] = ['group', 'transition-colors', 'duration-75'];

    if (this.variant() === 'striped') {
      classes.push(
        index % 2 === 0
          ? 'bg-white dark:bg-gray-900'
          : 'bg-gray-50/60 dark:bg-gray-800/25',
      );
    } else {
      classes.push('bg-white dark:bg-gray-900');
    }

    if (this.isSelected(row)) {
      classes.push('!bg-primary-50/60 dark:!bg-primary-950/25');
    } else {
      classes.push('hover:bg-gray-50/80 dark:hover:bg-gray-800/50');
    }

    const custom = this.rowClassFn()?.(row);
    if (custom) classes.push(custom);

    return classes;
  }

  /**
   * The filter cell under a pinned header stays pinned with it — otherwise a
   * sideways scroll slid the Ticket filter away from the Ticket heading above it.
   */
  pinnedFilterClass(col: TableColumn<T>): string {
    if (col.pinned === 'left') return 'sticky left-0 z-[25] bg-white bg-linear-to-r from-gray-50/80 to-gray-50/80 dark:bg-gray-900 dark:from-gray-800/40 dark:to-gray-800/40';
    if (col.pinned === 'right') return 'sticky right-0 z-[25] bg-white bg-linear-to-r from-gray-50/80 to-gray-50/80 dark:bg-gray-900 dark:from-gray-800/40 dark:to-gray-800/40';
    return '';
  }

  getHeaderCellClass(col: TableColumn<T>): string[] {
    const classes: string[] = [
      this.headerPadding(),
      'text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400',
      this.alignClass(col),
    ];
    if (col.sortable) {
      classes.push('cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300');
    }
    if (this.variant() === 'bordered') {
      classes.push('border border-gray-200 dark:border-gray-700');
    }
    if (col.pinned === 'left') {
      classes.push('sticky left-0 z-[25] bg-white bg-linear-to-r from-gray-50/80 to-gray-50/80 dark:bg-gray-900 dark:from-gray-800/40 dark:to-gray-800/40 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.07)]');
    } else if (col.pinned === 'right') {
      classes.push('sticky right-0 z-[25] bg-white bg-linear-to-r from-gray-50/80 to-gray-50/80 dark:bg-gray-900 dark:from-gray-800/40 dark:to-gray-800/40 shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.07)]');
    }
    return classes;
  }

  getCellClass(col: TableColumn<T>): string[] {
    const classes: string[] = [
      this.rowPadding(),
      this.cellTextSize(),
      'text-gray-700 dark:text-gray-300',
      this.alignClass(col),
    ];
    if (this.variant() === 'bordered') {
      classes.push('border border-gray-200 dark:border-gray-700');
    }
    if (col.pinned === 'left') {
      classes.push('sticky left-0 z-[5] bg-inherit shadow-[2px_0_4px_-1px_rgba(0,0,0,0.07)]');
    } else if (col.pinned === 'right') {
      classes.push('sticky right-0 z-[5] bg-inherit shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.07)]');
    }
    if (col.editable) classes.push('cursor-pointer');
    return classes;
  }

  // ── Row expand ────────────────────────────────────────────────────────────

  toggleExpand(row: T, event: MouseEvent): void {
    event.stopPropagation();
    const id  = this.getRowId(row);
    const set = new Set(this.expandedRowIds());
    if (set.has(id)) set.delete(id); else set.add(id);
    this.expandedRowIds.set(set);
    this.rowExpand.emit(row);
  }

  isExpanded(row: T): boolean {
    return this.expandedRowIds().has(this.getRowId(row));
  }

  // ── Inline editing ────────────────────────────────────────────────────────
  //
  // A column's `validate` runs on every keystroke and again on commit. Enter or
  // blur with an invalid value neither commits nor closes — the editor stays
  // open with its error showing. Escape always closes and discards.

  /** Per-instance id prefix, so two tables on one page never share an element id. */
  private readonly _uid = svUniqueId('sv-dt');

  /** Message from the column's `validate` for the draft as it stands, or `null`. */
  readonly editError = computed<string | null>(() => {
    const cell = this.editingCell();
    if (!cell) return null;
    const col = this.columns().find(c => c.key === cell.key);
    if (!col?.validate) return null;
    const row = this.rows().find(r => this.getRowId(r) === cell.rowId);
    return row === undefined ? null : col.validate(this.editDraft(), row);
  });

  /** `id` of the error message, for the editor's `aria-describedby`. One editor is open at a time, so one id is enough. */
  readonly editErrorId = `${this._uid}-edit-error`;
  /** ★ Per instance (1.0 audit, M1): a literal `dt-page-size` id made a second table's "Rows" label point at the first table's select. */
  readonly pageSizeId = `${this._uid}-page-size`;

  startEdit(row: T, col: TableColumn<T>, event: MouseEvent): void {
    if (!col.editable) return;
    event.stopPropagation();
    this.editingCell.set({ rowId: this.getRowId(row), key: col.key });
    this.editDraft.set(this.cellValue(row, col));
  }

  isEditing(row: T, col: TableColumn<T>): boolean {
    const cell = this.editingCell();
    return !!cell && cell.rowId === this.getRowId(row) && cell.key === col.key;
  }

  onEditInput(event: Event): void {
    this.editDraft.set((event.target as HTMLInputElement).value);
  }

  /**
   * Closes the editor, emitting only when the value actually moved.
   * Double-clicking a cell and clicking away is not an edit, and it should not
   * cost the host a write.
   */
  saveEdit(row: T, col: TableColumn<T>): void {
    const cell = this.editingCell();
    if (!cell || cell.rowId !== this.getRowId(row) || cell.key !== col.key) return;

    const newValue = this.editDraft();
    if (col.validate?.(newValue, row)) return;

    const oldValue = this.cellValue(row, col);
    this.editingCell.set(null);
    if (newValue === oldValue) return;
    this.editComplete.emit({ row, column: col, oldValue, newValue });
  }

  cancelEdit(): void { this.editingCell.set(null); }

  // ── Row events ────────────────────────────────────────────────────────────

  onRowClick(row: T): void { this.rowClick.emit(row); }

  /**
   * Keyboard equivalent of clicking a mobile card row. Ignores key events that
   * bubbled up from a nested control (the row select checkbox) so Enter/Space
   * there keeps its own meaning, and swallows Space so the page does not scroll.
   *
   * `event` is typed `Event`, not `KeyboardEvent`: under `strictTemplates`
   * Angular types `$event` on a key pseudo-event (`keydown.enter`) as the base
   * `Event`, and only `target` / `currentTarget` / `preventDefault` are needed.
   */
  onRowKeyActivate(event: Event, row: T): void {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    this.rowClick.emit(row);
  }

  onCellClick(row: T, col: TableColumn<T>, event: MouseEvent): void {
    event.stopPropagation();
    this.cellClick.emit({ row, column: col, value: this.cellValue(row, col) });
    this.rowClick.emit(row);
  }

  // ── Column filters ────────────────────────────────────────────────────────

  getColFilter(key: string): string {
    return this.columnFiltersRecord()[key] ?? '';
  }

  setColFilter(key: string, value: string): void {
    const rec = { ...this.columnFiltersRecord() };
    if (value) rec[key] = value; else delete rec[key];
    this.columnFiltersRecord.set(rec);
    this.currentPage.set(1);
    if (this.serverSide()) this.emitServerEvent();
  }

  onColumnFilterChange(key: string, event: Event): void {
    this.setColFilter(key, (event.target as HTMLInputElement | HTMLSelectElement).value);
  }

  clearFilter(key: string): void {
    if (key === '__search__') this.searchQuery.set('');
    else this.setColFilter(key, '');
    this.currentPage.set(1);
    if (this.serverSide()) this.emitServerEvent();
  }

  clearAllFilters(): void {
    this.columnFiltersRecord.set({});
    this.searchQuery.set('');
    this.currentPage.set(1);
    if (this.serverSide()) this.emitServerEvent();
  }

  // ── Global search ─────────────────────────────────────────────────────────

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
    if (this.serverSide()) this.emitServerEvent();
  }

  // ── Column visibility ─────────────────────────────────────────────────────

  /** Whether a column is on screen — what the Columns menu's checkbox shows. */
  isColumnShown(col: TableColumn<T>): boolean {
    return (!col.hidden || this.revealedColumnKeys().has(col.key)) && !this.hiddenColumnKeys().has(col.key);
  }

  toggleColumnVisibility(key: string): void {
    const col = this.columns().find(c => c.key === key);
    if (col?.hidden) {
      // A column declared hidden is shown by revealing it, and hidden again by
      // taking the reveal back — `hiddenColumnKeys` stays the user's own list.
      const revealed = new Set(this.revealedColumnKeys());
      if (this.isColumnShown(col)) {
        revealed.delete(key);
      } else {
        revealed.add(key);
        if (this.hiddenColumnKeys().has(key)) {
          const hidden = new Set(this.hiddenColumnKeys());
          hidden.delete(key);
          this.hiddenColumnKeys.set(hidden);
        }
      }
      this.revealedColumnKeys.set(revealed);
      return;
    }
    const set = new Set(this.hiddenColumnKeys());
    if (set.has(key)) set.delete(key); else set.add(key);
    this.hiddenColumnKeys.set(set);
  }

  // ── Pagination ────────────────────────────────────────────────────────────

  goTo(page: number): void {
    const clamped = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(clamped);
    this.openActionRowId.set(null);
    if (this.serverSide()) this.emitServerEvent();
  }

  onPageSizeChange(event: Event): void {
    this.pageSize.set(+(event.target as HTMLSelectElement).value);
    this.currentPage.set(1);
    if (this.serverSide()) this.emitServerEvent();
  }

  // ── Server-side ───────────────────────────────────────────────────────────

  // ## The ordering guarantee
  //
  // In `serverSide` mode the table renders `rows` verbatim, so response order is
  // the host's problem: a slow response to an older query must not overwrite a
  // newer one. Every emission carries a monotonic `requestId`, and
  // `acceptsResponse(id)` is false once a newer one has gone out:
  //
  // ```ts
  // onPage(event: ServerPageEvent): void {
  //   this.api.fetch(event).subscribe(page => {
  //     if (!this.table().acceptsResponse(event.requestId ?? 0)) return;
  //     this.rows.set(page.items);
  //   });
  // }
  // ```

  private readonly latestRequestId = signal(0);

  /**
   * Id of the request the table most recently asked for — read it at the top of
   * a `queryChange` handler, which runs synchronously with the emission.
   * `serverPageChange` carries the same value as `requestId` on the event.
   */
  readonly serverRequestId = this.latestRequestId.asReadonly();

  /**
   * Whether a response to request `requestId` is still the one worth applying.
   * `false` once the user has asked for something newer, so a late response is
   * discarded instead of overwriting fresher rows.
   */
  acceptsResponse(requestId: number): boolean {
    return requestId === this.latestRequestId();
  }

  private emitServerEvent(): void {
    const sorts = this.sorts().filter(s => !!s.direction);
    const requestId = this.latestRequestId() + 1;
    this.latestRequestId.set(requestId);

    this.serverPageChange.emit({
      page:     this.currentPage(),
      pageSize: this.pageSize(),
      sorts,
      filters:  this.columnFiltersRecord(),
      search:   this.searchQuery(),
      requestId,
    });

    this.queryChange.emit(
      patchQuery(createQuery(), {
        page:     this.currentPage(),
        pageSize: this.pageSize(),
        // `SortState.direction` is nullable; `SvSort` is not — an unsorted
        // column is one absent from the array, so every consumer does not have
        // to filter it out first. The nulls are already dropped above.
        sorts:    sorts.map(s => ({ key: s.key, direction: s.direction }) as SvSort),
        filters:  this.columnFiltersRecord(),
        search:   this.searchQuery(),
      }),
    );
  }

  // ── CSV export ────────────────────────────────────────────────────────────

  exportCsv(): void {
    const cols = this.visibleColumns();
    const data = this.serverSide() ? this.rows() : this.sortedRows();
    const csv = svToCsv(
      cols.map((c) => c.label),
      data.map((row) => cols.map((col) => this.cellValue(row, col))),
    );
    svDownloadText(document, `export-${Date.now()}.csv`, csv);
  }

  // ── Track helpers ─────────────────────────────────────────────────────────

  trackByKey(_: number, col: TableColumn<T>): string  { return col.key; }
  trackByRow(_: number, row: T): string | number      { return this.getRowId(row); }
}
