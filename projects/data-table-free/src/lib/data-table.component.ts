import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { SvLiveAnnouncer, svWarnUnvirtualizedCeiling, svUniqueId, SvRevealFocusDirective, svCollectionTarget, svIsRtl, svLogicalArrowKey } from '@styloviz/core/a11y';
import { SvErrorShellComponent, createDebouncer, resolveItemKey, warnOnDuplicateItemKeys, type SvDataError, type SvDataQuery, type SvItemKey } from '@styloviz/core/data';
import { SvStopPropagationDirective } from '@styloviz/core/directives';
import { svToCsv, svDownloadText } from '@styloviz/core/export';
import { SvSpinnerArcComponent } from '@styloviz/core/feedback';
import { injectSvLabels, SvLabelPipe } from '@styloviz/core/i18n';
import { svRestoreFocusedItem, svSnapshotFocusedItem } from '@styloviz/core/overlay';
import { svAttrSelector } from '@styloviz/core/security';
import { SV_DATA_TABLE_LABELS } from './data-table-free.labels';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import { registerDataTableIcons } from './data-table.component.icons';
import { DtAutoFocusDirective } from './auto-focus.directive';
import { buildServerQuery, ServerRequestLedger } from './server-query';

export { DtAutoFocusDirective };

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc' | null;

/**
 * How the table behaves when there is no room to be a table (FL-C13).
 *
 * - `'none'`    — always the table; it scrolls sideways.
 * - `'cards'`   — below the `sm` breakpoint, a compact card per row, every
 *                 column as a label/value pair. (1.x `cardOnMobile`.)
 * - `'records'` — below `recordBreakpoint`, a **list of records**: each row an
 *                 `<article>` titled by `recordTitleKey`, its fields a real
 *                 `<dl>`, `priority: 'secondary'` columns behind a per-record
 *                 disclosure, a labelled sort control (a card list has no
 *                 header to click), selection and row actions. Nothing is
 *                 dropped and nothing pretends to be a table. (1.x
 *                 `sv-record-grid`.) The server renders the table; the switch
 *                 happens on the first client frame, where it can be measured.
 */
export type DataTableResponsive = 'none' | 'cards' | 'records';

/** `responsive="records"`: switch below the breakpoint (`'auto'`), or always show records. */
export type DataTableRecordView = 'auto' | 'always';
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
   * ★ Used by `responsive="records"`, which turns each row into a record on a narrow
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
  /** Allow inline cell editing — double-click the cell, or F2 on it from the keyboard. Emit editComplete to persist. */
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

const DENSITY_OPTIONS: readonly {
  value: TableDensity;
  labelKey: 'densityCompact' | 'densityComfortable' | 'densitySpacious';
  icon: string;
}[] = [
  // ★ Icon-library NAMES (were 16-box `d` strings). The three are chosen as a
  //   FAMILY — 4 lines / 3 lines / 2 lines — so the control reads as a
  //   progression the way the hand-drawn 5/3/2 set did. `rows-2` was tried and
  //   rejected: a boxed shape next to two line stacks does not read as one
  //   scale. Rendered all three at 72px and 14px before choosing.
  { value: 'compact',     labelKey: 'densityCompact',     icon: 'align-justify' },
  { value: 'comfortable', labelKey: 'densityComfortable', icon: 'menu' },
  { value: 'spacious',    labelKey: 'densitySpacious',    icon: 'equal' },
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
 * - Inline cell editing (double-click, or F2 on a focused cell) → emits editComplete
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
  imports: [NgClass, DtAutoFocusDirective, SvIconComponent, SvErrorShellComponent, SvStopPropagationDirective, SvSpinnerArcComponent, SvLabelPipe, SvRevealFocusDirective],
  templateUrl: './data-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvDataTableComponent<T extends Record<string, unknown> = Record<string, unknown>> {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerDataTableIcons();

  /** @internal Accessible names — English unless `provideSvLabels({ dataTable })` says otherwise. */
  protected readonly labels = injectSvLabels('dataTable', SV_DATA_TABLE_LABELS);

  /**
   * The filter row's classes. In TS rather than the template because the
   * `[&>td]` variants' `>` reads as a tag end to the template scanners.
   */
  protected readonly filterRowClass =
    'border-t border-gray-100 dark:border-gray-800 [&>td:not(.sticky)]:relative [&>td]:before:pointer-events-none [&>td]:before:absolute [&>td]:before:inset-x-0 [&>td]:before:-top-px [&>td]:before:h-0.5 [&>td]:before:bg-white [&>td]:before:bg-linear-to-r [&>td]:before:from-gray-50/80 [&>td]:before:to-gray-50/80 dark:[&>td]:before:bg-gray-900 dark:[&>td]:before:from-gray-800/40 dark:[&>td]:before:to-gray-800/40';

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly announcer = inject(SvLiveAnnouncer);

  constructor() {
    effect(() => {
      if (this.typed.value() === 0) return;
      untracked(() => this.emitServerEvent());
    });

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
          announce: this.labels.focusedRowHidden,
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
  /** Max body height (CSS length) before the table scrolls. */
  maxHeight      = input<string | null>(null);
  /** Show a hint when the table is horizontally scrollable. @default true */
  showScrollHint = input<boolean>(true);
  /** Callback returning extra Tailwind classes for a given row. */
  rowClassFn     = input<((row: T) => string) | null>(null);

  // ── Inputs — Toolbar ──────────────────────────────────────────────────────

  /**
   * Show the toolbar strip. Left unset it is derived from whether the toolbar
   * has anything to put in it — binding `tableTitle` or `[searchable]` is
   * enough to show it.
   *
   * Set it explicitly to force the strip on (an empty bar as a spacer) or off
   * (a title used only as the accessible name).
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
  /**
   * What the table becomes when there is no room to be a table — see
   * `DataTableResponsive`. `'none'` keeps the table and scrolls it sideways;
   * `'cards'` shows a compact label/value card per row below the `sm`
   * breakpoint; `'records'` shows a list of records below `recordBreakpoint`.
   * @default 'none'
   */
  readonly responsive = input<DataTableResponsive>('none');

  /** `responsive="records"`: the column that titles each record. Empty uses the first shown column. @default '' */
  readonly recordTitleKey = input<string>('');

  /** `responsive="records"`: width below which the records replace the table, in px. @default 768 */
  readonly recordBreakpoint = input<number>(768);

  /** `responsive="records"`: `'always'` shows the records at any width — a narrow panel on a wide screen. @default 'auto' */
  readonly recordView = input<DataTableRecordView>('auto');

  /**
   * `responsive="records"`: row keys whose secondary fields are open (two-way),
   * keyed by `rowKey`, never by position, so a host can restore them.
   * @default new Set()
   */
  readonly recordExpandedIds = model<ReadonlySet<string | number>>(new Set());

  // ── Inputs — Other ────────────────────────────────────────────────────────

  /** Message shown when there are no rows. @default 'No data to display.' */
  emptyMessage = input<string>(this.labels.emptyMessage);
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
  /** Emitted when an inline cell edit completes. */
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
   * Milliseconds typing in the search box or a text column filter waits before
   * `queryChange` asks the server again (`serverSide` only). The rows on screen
   * still filter on every keystroke; sorting, paging and clearing ask at once.
   * `0` asks on every keystroke.
   * @default 300
   */
  readonly debounceMs = input<number>(300);

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
   * Bind it to restore a saved set of hidden columns, and read
   * `(hiddenColumnKeysChange)` to store what the user changes.
   */
  readonly hiddenColumnKeys    = model<Set<string>>(new Set());
  /**
   * Columns declared `hidden: true` that the user has since shown from the
   * Columns menu. A `hidden` column starts hidden and stays in the Columns menu,
   * so the user can show it.
   *
   * Two-way, like `hiddenColumnKeys`: together the two ARE the column-visibility
   * view, and a host that persists one without the other restores a table whose
   * revealed columns have vanished again.
   */
  readonly revealedColumnKeys  = model<ReadonlySet<string>>(new Set());
  readonly editingCell         = signal<{ rowId: string | number; key: string } | null>(null);
  readonly editDraft           = signal<string>('');
  readonly columnToggleOpen    = signal<boolean>(false);
  readonly densityOverride     = signal<TableDensity | null>(null);

  readonly densityOptions: readonly { value: TableDensity; label: string; icon: string }[] =
    DENSITY_OPTIONS.map(({ labelKey, ...d }) => ({ ...d, label: this.labels[labelKey] }));

  // ── Computed — columns ────────────────────────────────────────────────────

  visibleColumns = computed<TableColumn<T>[]>(() => {
    const hidden = this.hiddenColumnKeys();
    const revealed = this.revealedColumnKeys();
    return this.columns().filter(col => (!col.hidden || revealed.has(col.key)) && !hidden.has(col.key));
  });

  // ── Computed — density ────────────────────────────────────────────────────

  effectiveDensity = computed<TableDensity>(() =>
    this.densityOverride() ?? this.density()
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
    if (q) chips.push({ key: '__search__', label: this.labels.searchChip, value: q });
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

  // ── responsive="records" (FL-C13 — what sv-record-grid was) ────────────────

  /** `responsive="cards"`: the 1.x `cardOnMobile` card list. */
  protected readonly cardsOn = computed(() => this.responsive() === 'cards');

  /**
   * Whether the viewport is under `recordBreakpoint`.
   *
   * ★ Seeded `false`, so the server renders the table: a prerender cannot
   *   measure, and the table is the safe guess — every field and label is in
   *   it. The switch happens on the first client frame.
   */
  private readonly recordNarrow = signal(false);

  /** Measures the viewport against `recordBreakpoint`, only while `responsive` is `records`. */
  protected readonly recordQuery = effect((onCleanup) => {
    if (this.responsive() !== 'records') return;
    const breakpoint = this.recordBreakpoint();
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    this.recordNarrow.set(query.matches);
    const onChange = (e: MediaQueryListEvent) => this.recordNarrow.set(e.matches);
    query.addEventListener('change', onChange);
    onCleanup(() => query.removeEventListener('change', onChange));
  });

  /** The record list is what is on screen. */
  readonly recordsOn = computed(
    () => this.responsive() === 'records' && (this.recordView() === 'always' || this.recordNarrow()),
  );

  /** The column that titles a record. */
  readonly recordTitleColumn = computed<TableColumn<T> | null>(() => {
    const key = this.recordTitleKey();
    const shown = this.visibleColumns();
    return (key ? shown.find((c) => c.key === key) : shown[0]) ?? null;
  });

  /** The record's fields, title excluded, split by `priority`. */
  readonly recordPrimaryFields = computed(() =>
    this.visibleColumns().filter((c) => c.key !== this.recordTitleColumn()?.key && c.priority !== 'secondary'),
  );
  readonly recordSecondaryFields = computed(() =>
    this.visibleColumns().filter((c) => c.key !== this.recordTitleColumn()?.key && c.priority === 'secondary'),
  );

  /**
   * The records on screen as a view-model, so the template reads fields rather
   * than calling per record: title, ids, selection, the disclosure state, the
   * formatted fields and the actions the row allows.
   */
  readonly recordItems = computed(() => {
    const primary = this.recordPrimaryFields();
    const secondary = this.recordSecondaryFields();
    const expanded = this.recordExpandedIds();
    return this.pagedRows().map((row) => {
      const id = this.getRowId(row);
      const field = (c: TableColumn<T>) => ({ key: c.key, label: c.label, value: this.cellValue(row, c) });
      return {
        row,
        id,
        title: this.recordTitle(row),
        titleId: `${this._uid}-record-${String(id)}-title`, // sv-i18n-ignore: element id
        selected: this.isSelected(row),
        expanded: expanded.has(id),
        primary: primary.map(field),
        secondary: secondary.map(field),
        actions: this.visibleActions(row),
      };
    });
  });

  /** The sortable columns, for the records' sort control. */
  readonly recordSortableColumns = computed(() => this.visibleColumns().filter((c) => c.sortable));

  readonly recordSortKey = computed(() => this.sorts()[0]?.key ?? '');
  readonly recordSortDirection = computed(() => this.sorts()[0]?.direction ?? 'asc');

  recordTitle(row: T): string {
    const column = this.recordTitleColumn();
    return column ? this.cellValue(row, column) : '';
  }

  /** The table's own sort, set from the records' control — both views agree. */
  onRecordSortKeyChange(key: string): void {
    this.applyRecordSort(key ? [{ key, direction: this.sorts()[0]?.direction ?? 'asc' }] : []);
  }

  toggleRecordSortDirection(): void {
    const current = this.sorts()[0];
    if (!current) return;
    this.applyRecordSort([{ key: current.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }]);
  }

  private applyRecordSort(next: SortState[]): void {
    this.sorts.set(next);
    this.currentPage.set(1);
    this.sortChange.emit(this.sorts());
    if (this.serverSide()) this.emitServerEvent();
  }

  toggleRecordExpanded(row: T): void {
    const id = this.getRowId(row);
    this.recordExpandedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  toggleColumnMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.columnToggleOpen.update(open => !open);
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
    return { left: 'text-start', center: 'text-center', right: 'text-end' }[col.align ?? 'left'];
  }

  // ── CSS class helpers ─────────────────────────────────────────────────────

  getRowClass(row: T, index: number): string[] {
    // The roving row cursor (FL-L1) needs a visible focus indicator.
    const classes: string[] = ['group', 'transition-colors', 'duration-75',
      'outline-none', 'focus-visible:outline-2', 'focus-visible:-outline-offset-2', 'focus-visible:outline-primary-500'];

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
   * Which edge each pinned column holds, by key, for `svRevealFocus` on the
   * scroller (WCAG 2.2 SC 2.4.11): a cell that takes focus is scrolled clear
   * of it. Worked out once per column change, not per cell.
   */
  readonly stickySides = computed<Readonly<Record<string, 'start' | 'end'>>>(() => {
    const sides: Record<string, 'start' | 'end'> = {};
    for (const col of this.columns()) {
      if (col.pinned === 'left') sides[col.key] = 'start';
      else if (col.pinned === 'right') sides[col.key] = 'end';
    }
    return sides;
  });

  /**
   * The filter cell under a pinned header stays pinned with it — otherwise a
   * sideways scroll slid the Ticket filter away from the Ticket heading above it.
   */
  pinnedFilterClass(col: TableColumn<T>): string {
    if (col.pinned === 'left') return 'sticky start-0 z-[25] bg-white bg-linear-to-r from-gray-50/80 to-gray-50/80 dark:bg-gray-900 dark:from-gray-800/40 dark:to-gray-800/40';
    if (col.pinned === 'right') return 'sticky end-0 z-[25] bg-white bg-linear-to-r from-gray-50/80 to-gray-50/80 dark:bg-gray-900 dark:from-gray-800/40 dark:to-gray-800/40';
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
      classes.push('sticky start-0 z-[25] bg-white bg-linear-to-r from-gray-50/80 to-gray-50/80 dark:bg-gray-900 dark:from-gray-800/40 dark:to-gray-800/40 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.07)] rtl:shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.07)]');
    } else if (col.pinned === 'right') {
      classes.push('sticky end-0 z-[25] bg-white bg-linear-to-r from-gray-50/80 to-gray-50/80 dark:bg-gray-900 dark:from-gray-800/40 dark:to-gray-800/40 shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.07)] rtl:shadow-[2px_0_4px_-1px_rgba(0,0,0,0.07)]');
    }
    return classes;
  }

  getCellClass(col: TableColumn<T>): string[] {
    const classes: string[] = [
      this.rowPadding(),
      this.cellTextSize(),
      'text-gray-700 dark:text-gray-300',
      this.alignClass(col),
      // The cell cursor's ring — the same one the row cursor draws.
      'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500',
    ];
    if (this.variant() === 'bordered') {
      classes.push('border border-gray-200 dark:border-gray-700');
    }
    if (col.pinned === 'left') {
      classes.push('sticky start-0 z-[5] bg-inherit shadow-[2px_0_4px_-1px_rgba(0,0,0,0.07)] rtl:shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.07)]');
    } else if (col.pinned === 'right') {
      classes.push('sticky end-0 z-[5] bg-inherit shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.07)] rtl:shadow-[2px_0_4px_-1px_rgba(0,0,0,0.07)]');
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
  readonly editErrorId = `${this._uid}-edit-error`; // sv-i18n-ignore: element id
  /** ★ Per instance (1.0 audit, M1): a literal `dt-page-size` id made a second table's "Rows" label point at the first table's select. */
  readonly pageSizeId = `${this._uid}-page-size`; // sv-i18n-ignore: element id

  startEdit(row: T, col: TableColumn<T>, event: Event): void {
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

  // ── Rows from the keyboard (FL-L1) ──────────────────────────────────────
  //
  // ★★★ `(rowClick)` was mouse-only on the table layout: the `<tr>` had a
  //     click handler and no tabindex, while the phone cards already were tab
  //     stops. The body is ONE tab stop (roving tabindex) — Tab still leaves
  //     the table in one press — the arrows, Home and End walk the page, and
  //     Enter or Space activates the row. Keys from a control inside the row
  //     (the select checkbox) keep their own meaning.

  private readonly activeRowKey = signal<string | null>(null);

  /** The one row in the tab order: the last one focused, else the first. */
  private readonly tabStopRowKey = computed<string | null>(() => {
    const rows = this.pagedRows();
    const active = this.activeRowKey();
    if (active !== null && rows.some(row => String(this.getRowId(row)) === active)) return active;
    return rows.length ? String(this.getRowId(rows[0])) : null;
  });

  /** Each paged row's `tabindex`, by position — read as `rowTabIndexes()[i]` in the `@for`. */
  readonly rowTabIndexes = computed<readonly number[]>(() => {
    const stop = this.tabStopRowKey();
    return this.pagedRows().map(row => (String(this.getRowId(row)) === stop ? 0 : -1));
  });

  onRowFocusIn(row: T): void {
    this.activeRowKey.set(String(this.getRowId(row)));
  }

  onRowKeydown(event: KeyboardEvent, row: T): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.rowClick.emit(row);
      return;
    }
    if (svLogicalArrowKey(event.key, svIsRtl(event.currentTarget as Element)) === 'ArrowRight' && this.visibleColumns().length) {
      event.preventDefault();
      this.focusCell(row, this.visibleColumns()[0]);
      return;
    }
    const rows = this.pagedRows();
    const next = svCollectionTarget(event.key, rows.length, rows.indexOf(row));
    if (next === null || !['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
    event.preventDefault();
    this.focusRow(rows[next]);
  }

  // ── Cells from the keyboard (FL-L1-02b) ─────────────────────────────────
  //
  // ★★ The row stays the one tab stop; ArrowRight steps into its cells (mirrored
  //    under RTL), the arrows move the cursor, Home / End jump to the row's ends,
  //    ArrowLeft from the first cell returns to the row. Enter or Space is the
  //    click (`cellClick`, then `rowClick`), F2 the double-click (edit), and a
  //    keyboard edit puts the cursor back on its cell.

  onCellKeydown(event: KeyboardEvent, row: T, col: TableColumn<T>): void {
    // The editor inside the cell keeps its own keys.
    if (event.target !== event.currentTarget) return;
    const cols = this.visibleColumns();
    const at = cols.indexOf(col);
    const rows = this.pagedRows();
    switch (svLogicalArrowKey(event.key, svIsRtl(event.currentTarget as Element))) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.cellClick.emit({ row, column: col, value: this.cellValue(row, col) });
        this.rowClick.emit(row);
        return;
      case 'F2':
        if (!col.editable) return;
        event.preventDefault();
        this.startEdit(row, col, event);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        if (at > 0) this.focusCell(row, cols[at - 1]);
        else this.focusRow(row);
        return;
      case 'ArrowRight':
        if (at >= cols.length - 1) return;
        event.preventDefault();
        this.focusCell(row, cols[at + 1]);
        return;
      case 'Home':
      case 'End':
        event.preventDefault();
        this.focusCell(row, cols[event.key === 'Home' ? 0 : cols.length - 1]);
        return;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'PageUp':
      case 'PageDown': {
        const next = svCollectionTarget(event.key, rows.length, rows.indexOf(row));
        if (next === null) return;
        event.preventDefault();
        this.focusCell(rows[next], col);
        return;
      }
    }
  }

  /** After an edit closed from the keyboard, the cursor goes back to its cell — unless the editor is still open (a failed validation). */
  refocusCell(row: T, col: TableColumn<T>): void {
    setTimeout(() => {
      if (!this.isEditing(row, col)) this.focusCell(row, col);
    });
  }

  private rowEl(row: T): HTMLElement | undefined {
    const key = String(this.getRowId(row));
    return [...this.host.nativeElement.querySelectorAll<HTMLElement>('tr[data-sv-row-key]')]
      .find(tr => tr.getAttribute('data-sv-row-key') === key);
  }

  private focusRow(row: T): void {
    const el = this.rowEl(row);
    if (!el) return;
    this.activeRowKey.set(String(this.getRowId(row)));
    el.tabIndex = 0;
    el.focus();
  }

  private focusCell(row: T, col: TableColumn<T>): void {
    // The row stays the tab stop, so Tab out and back lands on this row.
    this.activeRowKey.set(String(this.getRowId(row)));
    this.rowEl(row)?.querySelector<HTMLElement>(svAttrSelector('data-sv-col-key', col.key))?.focus();
  }

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
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (!(target instanceof HTMLInputElement)) return this.setColFilter(key, target.value);
    const rec = { ...this.columnFiltersRecord() };
    if (target.value) rec[key] = target.value; else delete rec[key];
    this.columnFiltersRecord.set(rec);
    this.typedQueryChanged();
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
    this.typedQueryChanged();
  }

  /** A keystroke's change: back to page 1 now, and ask the server once typing settles. */
  private typedQueryChanged(): void {
    this.currentPage.set(1);
    if (!this.serverSide()) return;
    if (this.debounceMs() > 0) this.typed.set(this.typed.raw() + 1);
    else this.emitServerEvent();
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

  // The ordering guarantee: `./server-query`.

  private readonly requests = new ServerRequestLedger();

  /**
   * Typing settles here before it becomes a request: each keystroke bumps the
   * count, and the settled count asks the server once (FL-I11).
   */
  private readonly typed = createDebouncer(0, { delayMs: this.debounceMs, destroyRef: inject(DestroyRef) });

  /**
   * Id of the request the table most recently asked for — read it at the top of
   * a `queryChange` handler, which runs synchronously with the emission.
   */
  readonly serverRequestId = this.requests.id;

  /**
   * Whether a response to request `requestId` is still the one worth applying.
   * `false` once the user has asked for something newer, so a late response is
   * discarded instead of overwriting fresher rows.
   */
  acceptsResponse(requestId: number): boolean { return this.requests.accepts(requestId); }

  private emitServerEvent(): void {
    // This request carries the latest search and filters, so one still settling is spent.
    this.typed.cancel();
    this.requests.next();
    this.queryChange.emit(buildServerQuery({
      page:     this.currentPage(),
      pageSize: this.pageSize(),
      sorts:    this.sorts(),
      filters:  this.columnFiltersRecord(),
      search:   this.searchQuery(),
    }));
  }

  // ── CSV export ────────────────────────────────────────────────────────────

  exportCsv(): void {
    const cols = this.visibleColumns();
    const data = this.serverSide() ? this.rows() : this.sortedRows();
    const csv = svToCsv(
      cols.map((c) => c.label),
      data.map((row) => cols.map((col) => this.cellValue(row, col))),
    );
    svDownloadText(document, `export-${Date.now()}.csv`, csv); // sv-i18n-ignore: download filename
  }

  // ── Track helpers ─────────────────────────────────────────────────────────

  trackByKey(_: number, col: TableColumn<T>): string  { return col.key; }
  trackByRow(_: number, row: T): string | number      { return this.getRowId(row); }
}
