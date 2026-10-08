import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  Directive,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  svUniqueId,
  svWarnUnvirtualizedCeiling,
  type SvDataError,
} from '@styloviz/core';
import type { SortState, TableColumn, TableRowAction } from './data-table.component';

/**
 * Which view is on screen.
 *
 * ★ `'auto'` measures the viewport. The other two exist because a host
 * sometimes knows better than a media query — a table embedded in a narrow
 * panel on a wide screen is still narrow, and a print stylesheet always wants
 * the table.
 */
export type RecordGridMode = 'auto' | 'table' | 'cards';

/** The wide view, supplied as a template so it is not built when unused. */
@Directive({ selector: '[svRecordTable]', standalone: true })
export class SvRecordTableDirective {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * `<sv-record-grid>` — a table that becomes a list of records when there is no
 * room to be a table.
 *
 * ★★★ THE USUAL RESPONSIVE TABLE IS A LIE TOLD IN CSS. The technique everyone
 * reaches for sets `display: block` on the table elements and pipes the column
 * header into each cell through a `data-label` and a `::before`. Two things go
 * wrong and both are invisible: the moment those elements stop being
 * `display: table-*` the browser drops their table roles, so a screen reader is
 * handed a pile of anonymous blocks instead of rows and columns — and generated
 * content from `::before` is not text a user can select, search for or copy.
 * The result LOOKS like labelled cards and is less accessible than the table it
 * replaced.
 *
 * ★★★ THE OTHER COMMON ANSWER IS WORSE: hide the columns that do not fit. A
 * table that silently drops three of its eight fields on a phone is not a
 * responsive table, it is a different table, and nobody is told which one they
 * are reading.
 *
 * So this does neither. Below the breakpoint the markup stops claiming to be a
 * table and becomes what it actually is — a **list of records**, each a `<dl>`
 * of real label/value pairs, which is the structure HTML already has for this
 * and the one a screen reader announces as "Status, definition, Shipped".
 * Nothing is dropped: a `secondary` column moves behind a per-card disclosure
 * and says how many are in there.
 *
 * ```html
 * <sv-record-grid [columns]="columns" [rows]="rows" titleKey="name">
 *   <ng-template svRecordTable>
 *     <sv-data-table [columns]="columns" [rows]="rows" />
 *   </ng-template>
 * </sv-record-grid>
 * ```
 */
@Component({
  selector: 'sv-record-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    SvSkeletonShellComponent,
    SvErrorShellComponent,
    SvEmptyShellComponent,
  ],
  templateUrl: './record-grid.component.html',
  host: { class: 'block' },
})
export class SvRecordGridComponent {
  /** Unique per grid and per application, so two grids never share an id. */
  private readonly uid = svUniqueId('sv-record-grid');

  // ── Data ──────────────────────────────────────────────────────────────────

  /** The same columns the table is given. @default [] */
  readonly columns = input<readonly TableColumn[]>([]);

  /** The rows currently on screen — already filtered, sorted and paged. @default [] */
  readonly rows = input<readonly Record<string, unknown>[]>([]);

  /**
   * The property that identifies a row.
   *
   * ★ Not the index. A card list is re-rendered on every sort and every page,
   * and tracking by position reuses the DOM of one record for another — so a
   * checkbox stays ticked while the record under it changes. @default 'id'
   */
  readonly rowKey = input<string>('id');

  /**
   * The column that titles each card. Empty uses the first column.
   *
   * ★ A card needs a heading, and a `<dl>` cannot supply one: every pair in it
   * is equally a term. Promoting one field out of the list is what makes a
   * stack of cards scannable instead of forty identical blocks.
   * @default ''
   */
  readonly titleKey = input<string>('');

  // ── Which view ────────────────────────────────────────────────────────────

  /** Which view to render: `'auto'` switches to cards below `breakpoint`, `'table'` always shows the supplied table template, `'cards'` always shows the card list. @default 'auto' */
  readonly mode = input<RecordGridMode>('auto');

  /** Width below which `'auto'` switches to cards, in px. @default 768 */
  readonly breakpoint = input<number>(768);

  // ── Behaviour ─────────────────────────────────────────────────────────────

  /** Show a checkbox on each card. @default false */
  readonly selectable = input<boolean>(false);

  /** Selected row keys. Two-way, so the host owns them across pages. */
  readonly selected = model<Set<string>>(new Set());

  /**
   * The sort the user picked in the card view's sort control. Two-way.
   *
   * ★ The grid does NOT reorder `rows` — they arrive already sorted, like
   * everything else about them. The host reads this (or `(sortChange)`) and
   * sorts `rows` itself, the same way it does for a server-sorted table; bind
   * the table's own sort to the same state so both views agree.
   */
  readonly sort = model<SortState | null>(null);

  /** Per-record actions, rendered in the card footer. @default [] */
  readonly rowActions = input<readonly TableRowAction[]>([]);

  /** Show a skeleton list in place of either view while records load. @default false */
  readonly loading = input<boolean>(false);
  /** Load failure, shown with a Retry button in place of either view; takes precedence over the empty state. @default null */
  readonly error = input<SvDataError | string | null>(null);
  /** Text shown in place of either view when `rows` is empty. */
  readonly emptyMessage = input<string>('No records to show');
  /** Emitted when the user presses Retry in the error state; the host should re-run the failed load. */
  readonly retry = output<void>();

  /** Emitted with the action and its row when the user clicks one of a card's `rowActions`, after the action's `handler` has run. */
  readonly actionClick = output<{ action: TableRowAction; row: Record<string, unknown> }>();

  // ── The measurement ───────────────────────────────────────────────────────

  /**
   * Whether the viewport is under the breakpoint.
   *
   * ★★ SEEDED `false`, WHICH MEANS THE SERVER RENDERS THE TABLE. A prerender
   * cannot measure, and of the two guesses the table is the safe one: it holds
   * every field and every label, so a client that never runs the script gets a
   * scrollable table rather than a card list that was guessed at. The switch to
   * cards then happens on the first client frame, where it is a fact rather
   * than a hope.
   */
  private readonly narrow = signal(false);

  constructor() {
    // `X-10`: the grid renders every record it is given — paging is the
    // host's. Past the documented ceiling, say so once in dev mode.
    effect(() => svWarnUnvirtualizedCeiling('sv-record-grid', this.rows().length, false));

    // ★ Keyed on `breakpoint()`: the query used to be built once in the
    //   constructor, so a host that changed `[breakpoint]` after first render
    //   kept switching at the old width forever. The cleanup removes the old
    //   listener before the new query is attached, and again on destroy, or a
    //   destroyed grid keeps answering resize events.
    effect((onCleanup) => {
      const breakpoint = this.breakpoint();
      // `matchMedia` does not exist on the server.
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

      const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
      this.narrow.set(query.matches);
      const onChange = (e: MediaQueryListEvent) => this.narrow.set(e.matches);
      query.addEventListener('change', onChange);
      onCleanup(() => query.removeEventListener('change', onChange));
    });
  }

  /** `true` when the card list is what is rendered. */
  readonly cardsMode = computed(() => {
    const mode = this.mode();
    if (mode === 'cards') return true;
    if (mode === 'table') return false;
    return this.narrow();
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  readonly isEmpty = computed(() => this.rows().length === 0);

  /** Columns that are shown, in order — a hidden column is hidden here too. */
  private readonly shownColumns = computed(() => this.columns().filter((c) => !c.hidden));

  /** The column that titles the card. */
  readonly titleColumn = computed<TableColumn | null>(() => {
    const key = this.titleKey();
    const shown = this.shownColumns();
    return (key ? shown.find((c) => c.key === key) : shown[0]) ?? null;
  });

  /** Everything else, split by priority. */
  readonly primaryFields = computed(() =>
    this.shownColumns().filter(
      (c) => c.key !== this.titleColumn()?.key && c.priority !== 'secondary',
    ),
  );

  readonly secondaryFields = computed(() =>
    this.shownColumns().filter(
      (c) => c.key !== this.titleColumn()?.key && c.priority === 'secondary',
    ),
  );

  /** The sortable columns, for the card view's sort control. */
  readonly sortableColumns = computed(() => this.shownColumns().filter((c) => c.sortable));

  /** The wide view, when the host supplied one. */
  private readonly tableSlot = contentChild(SvRecordTableDirective);
  readonly tableTemplate = computed(() => this.tableSlot()?.template ?? null);

  // ── Values ────────────────────────────────────────────────────────────────

  /**
   * One cell's text.
   *
   * ★ The same resolution the table uses, `render()` included — a column that
   * formats a date or a currency must read identically in both views, or the
   * card list is a second, subtly different table.
   */
  cellText(row: Record<string, unknown>, column: TableColumn): string {
    if (column.render) return column.render(row, column);
    const value = row[column.key];
    return value === null || value === undefined ? '' : String(value);
  }

  rowId(row: Record<string, unknown>): string {
    return String(row[this.rowKey()] ?? '');
  }

  cardTitle(row: Record<string, unknown>): string {
    const column = this.titleColumn();
    return column ? this.cellText(row, column) : '';
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  isSelected(row: Record<string, unknown>): boolean {
    return this.selected().has(this.rowId(row));
  }

  toggleSelect(row: Record<string, unknown>): void {
    const id = this.rowId(row);
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Sorting, without a header row to click ────────────────────────────────

  /**
   * ★★ A CARD LIST HAS NOWHERE TO PUT A SORT. The table's affordance is the
   * header cell, and the card view has no headers — so a table that becomes
   * cards silently loses sorting unless the control is rebuilt somewhere else.
   * That is the half of "responsive" everyone forgets, and it is why this is a
   * real `<select>` with a real label rather than an icon.
   */
  onSortKeyChange(key: string): void {
    if (!key) {
      this.sort.set(null);
      return;
    }
    this.sort.set({ key, direction: this.sort()?.direction ?? 'asc' });
  }

  toggleSortDirection(): void {
    const current = this.sort();
    if (!current) return;
    this.sort.set({
      key: current.key,
      direction: current.direction === 'asc' ? 'desc' : 'asc',
    });
  }

  readonly sortKey = computed(() => this.sort()?.key ?? '');
  readonly sortDirection = computed(() => this.sort()?.direction ?? 'asc');

  readonly sortDirectionLabel = computed(() =>
    this.sortDirection() === 'asc' ? 'Ascending' : 'Descending',
  );

  // ── Per-card disclosure ───────────────────────────────────────────────────

  /**
   * Row keys whose secondary fields are open (two-way).
   *
   * A `model` so a host can restore or persist which cards are open, keyed by
   * `rowKey` — never by position. @default new Set()
   */
  readonly expandedIds = model<ReadonlySet<string>>(new Set());

  isExpanded(row: Record<string, unknown>): boolean {
    return this.expandedIds().has(this.rowId(row));
  }

  toggleExpanded(row: Record<string, unknown>): void {
    const id = this.rowId(row);
    this.expandedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  gridId(suffix: string): string {
    return `${this.uid}-${suffix}`;
  }

  /**
   * Run a card action: its `handler` first, then `actionClick`.
   *
   * ★ `TableRowAction.handler` is required and documented as "called with the
   *   row when the action is triggered", and the data table calls it — but the
   *   card view only emitted `actionClick`. The same `rowActions` array bound to
   *   a table and to this grid therefore did something in one view and nothing
   *   in the other.
   */
  onAction(action: TableRowAction, row: Record<string, unknown>): void {
    action.handler(row);
    this.actionClick.emit({ action, row });
  }
}
