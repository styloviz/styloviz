import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  DestroyRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  createDebouncer,
  createTypeahead,
  createVariableVirtualizer,
  svCollectionTarget,
  svIsTypeaheadKey,
  svWarnUnvirtualizedCeiling,
  warnOnDuplicateItemKeys,
  type SvDataError,
} from '@styloviz/core';

declare const ngDevMode: boolean | undefined;

export type ListViewMode =
  | 'default'
  | 'checklist'
  | 'nested'
  | 'virtualization'
  | 'scrolling'
  | 'grouped'
  | 'template'
  | 'call-history';

export type ListViewVariant = 'default' | 'soft' | 'outlined';
export type ListViewDensity = 'compact' | 'comfortable' | 'spacious';
export type ListViewSelectionMode = 'none' | 'single' | 'multiple';
export type ListViewCallType = 'incoming' | 'outgoing' | 'missed' | 'video';
export type ListViewActionTone = 'neutral' | 'primary' | 'danger';

export interface ListViewItem {
  id: string | number;
  title: string;
  subtitle?: string;
  description?: string;
  group?: string;
  badge?: string;
  meta?: string;
  timestamp?: string;
  duration?: string;
  avatarUrl?: string;
  tags?: string[];
  amount?: string;
  callType?: ListViewCallType;
  unread?: boolean;
  disabled?: boolean;
  children?: ListViewItem[];
}

export interface ListViewItemClickEvent {
  item: ListViewItem;
}

export interface ListViewCheckChangeEvent {
  item: ListViewItem;
  checked: boolean;
}

export interface ListViewLoadMoreEvent {
  visibleCount: number;
  totalCount: number;
}

export interface ListViewQuickAction {
  id: string;
  label: string;
  /** Icon-library name for the action button — e.g. `'phone'`. Was `iconPath`. */
  icon?: string;
  tone?: ListViewActionTone;
}

export interface ListViewQuickActionClickEvent {
  item: ListViewItem;
  action: ListViewQuickAction;
}

export interface ListViewBulkAction {
  id: string;
  label: string;
  /** Icon-library name for the action button — e.g. `'trash'`. Was `iconPath`. */
  icon?: string;
  tone?: ListViewActionTone;
}

export interface ListViewBulkActionClickEvent {
  action: ListViewBulkAction;
  selectedIds: Set<string | number>;
}

interface ListViewGroup {
  label: string;
  items: ListViewItem[];
}

interface FlattenedItem {
  item: ListViewItem;
  depth: number;
  hasChildren: boolean;
  /** Position among its own siblings, and how many siblings there are. */
  posinset: number;
  setsize: number;
}

@Component({
  selector: 'sv-list-view',
  standalone: true,
  imports: [
    NgClass,
    NgTemplateOutlet,
    SvIconComponent,
    SvSkeletonShellComponent,
    SvErrorShellComponent,
    SvEmptyShellComponent,
  ],
  templateUrl: './list-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvListViewComponent {
  /** Items to render (label, meta, optional children/avatar/actions). */
  items = input<ListViewItem[]>([]);
  /**
   * One preset switch. `checklist`, `template` and `call-history` change what a
   * row shows and compose with everything else.
   *
   * `nested`, `grouped` and `scrolling` are Pro presets and this build ignores
   * them — use `[nested]` / `[grouped]` directly, which work here. `virtualization`
   * windows a flat list, and windowing cannot be combined with `[nested]` or
   * `[grouped]`. The full matrix, and the dev warning that enforces it, is on
   * `_ignoredCombinations`.
   * @default 'default'
   */
  mode = input<ListViewMode>('default');
  /** Visual variant. @default 'default' */
  variant = input<ListViewVariant>('default');
  /** Row density. @default 'comfortable' */
  density = input<ListViewDensity>('comfortable');

  /** Selection behaviour: none, single or multiple. @default 'none' */
  selectionMode = input<ListViewSelectionMode>('none');
  /** Show checkboxes on rows. @default false */
  checkable = input<boolean>(false);
  /** Enable nested (tree) rows. @default false */
  nested = input<boolean>(false);
  /** Virtualize long lists for performance. @default false */
  virtualized = input<boolean>(false);
  /** Group rows under section headers. @default false */
  grouped = input<boolean>(false);
  /** Show a search box to filter items. @default false */
  searchable = input<boolean>(false);
  /** Keep group headers pinned while scrolling. @default true */
  stickyGroupHeaders = input<boolean>(true);

  /** Load more items as the user scrolls to the end. @default false */
  infiniteScroll = input<boolean>(false);
  /** Whether more items are available to load. @default false */
  hasMore = input<boolean>(false);
  /** Show a loading indicator while fetching more. @default false */
  loadingMore = input<boolean>(false);
  /** Viewport height (px) for the virtualized list. @default 360 */
  viewportHeight = input<number>(360);
  /**
   * Height of a **single-line** row, in pixels — the base every windowed row is
   * measured from.
   *
   * Windowing has to know where row 4,000 starts without rendering rows 0–3,999,
   * so a row's height is computed rather than measured: this base, plus a line
   * for a `subtitle`/`description` and a strip for `tags` on the rows that carry
   * them. See `rowHeightOf`. The estimate is what the row is then sized to, so
   * the scrollbar and the rows agree exactly.
   * @default 68
   */
  itemHeight = input<number>(68);
  /** Extra rows rendered above/below the viewport. @default 5 */
  overscan = input<number>(5);

  /** Placeholder for the search box. @default 'Search list items' */
  searchPlaceholder = input<string>('Search list items');
  /** Message shown when no items match. @default 'No items match your filters.' */
  emptyMessage = input<string>('No items match your filters.');
  /** Extra CSS classes for the root. */
  customClass = input<string>('');
  /** Accessible label for the list. @default 'List view' */
  ariaLabel = input<string>('List view');
  /** Announce row actions to screen readers. @default true */
  announceActions = input<boolean>(true);
  /** Show per-row quick actions on hover/focus. @default false */
  showQuickActions = input<boolean>(false);
  /** Per-row quick actions. */
  quickActions = input<ListViewQuickAction[]>([]);
  /** Bulk actions for checked rows. */
  bulkActions = input<ListViewBulkAction[]>([]);
  /** Enable keyboard hotkeys for bulk actions. @default false */
  enableBulkHotkeys = input<boolean>(false);
  /** Map of hotkey → bulk action id. */
  bulkHotkeys = input<Record<string, string>>({});
  /** Enable roving-tabindex keyboard navigation. @default true */
  enableRovingFocus = input<boolean>(true);

  // ── Async state ─────────────────────────────────────────────────────────────

  /**
   * True while the first page is being fetched. Replaces the list with a
   * placeholder. For the *next* page use `loadingMore`, which keeps the rows
   * already on screen.
   * @default false
   */
  loading = input<boolean>(false);

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an
   * `HttpErrorResponse`.
   * @default null
   */
  error = input<SvDataError | string | null>(null);

  /**
   * Search on the server instead of in the component. The supplied `items` are
   * rendered as given — filtering them again would hide rows the server
   * deliberately returned, and client-side search can only ever look at the
   * page already downloaded.
   * @default false
   */
  serverSide = input<boolean>(false);

  /**
   * Delay before `searched` fires, in milliseconds. `0` emits immediately.
   * @default 300
   */
  debounceMs = input<number>(300);

  /** Selected row ids (two-way). */
  selectedIds = model<Set<string | number>>(new Set());
  /** Checked row ids (two-way). */
  checkedIds = model<Set<string | number>>(new Set());
  /**
   * Which nested items are expanded (two-way).
   *
   * A `model` alongside `selectedIds` and `checkedIds` because it is the same
   * kind of fact and the host has the same reasons to reach it: open the branch
   * a deep link names, restore the tree after a route change, persist what the
   * user had open. Held in a private signal it could be neither set nor observed
   * — the one piece of this component's item state that was unreachable.
   */
  expandedIds = model<Set<string | number>>(new Set());

  /**
   * The row the keyboard cursor is on (two-way) — the roving tab stop.
   *
   * ★★★ Windowed lists made this unavoidable. Roving focus used to walk the
   * RENDERED buttons, and a windowed list renders twenty of five hundred: the
   * cursor stopped dead at the edge of the window instead of the end of the
   * list, and scrolling the focused row out of the window dropped focus to
   * `<body>`. A keyboard cursor over a list that is only partly in the DOM has
   * to be an id, not an element.
   *
   * Two-way because it is the same kind of fact as `selectedIds`: a host can
   * put the cursor on the row a deep link names, and read where the user left it.
   */
  readonly activeItemId = model<string | number | null>(null);

  /**
   * Scroll position of the list viewport, in pixels (two-way).
   *
   * Written on every scroll, applied to the viewport whenever it changes from
   * the outside — bind it and the position survives what destroys the component:
   * a route change, a tab switch, a `@defer` block re-entering, an infinite-scroll
   * page arriving. Without it, restoring a list meant restoring its rows and
   * landing the user back at the top of them.
   */
  readonly scrollOffset = model<number>(0);

  /** Emitted with the clicked item. */
  itemClick = output<ListViewItemClickEvent>();
  /** Emitted with the current selection set. */
  selectionChange = output<Set<string | number>>();
  /** Emitted when a row's checkbox changes. */
  checkChange = output<ListViewCheckChangeEvent>();
  /** Emitted when more items should be loaded (infinite scroll). */
  loadMore = output<ListViewLoadMoreEvent>();
  /** Emitted when a quick action is clicked. */
  quickActionClick = output<ListViewQuickActionClickEvent>();
  /** Emitted when a bulk action is triggered. */
  bulkActionClick = output<ListViewBulkActionClickEvent>();
  /**
   * The debounced search term — fetch matching rows. Debounced by `debounceMs`
   * and never emitted twice for the same term. Pair with `serverSide`.
   *
   * Named `searched` rather than `queryChange`, and that is load-bearing: `query`
   * below is a `model()`, which already owns an output of that name and emits it
   * on every keystroke. Declaring it here as well claimed the same binding twice
   * — Angular reports "Output 'queryChange' is bound to both 'query' and
   * 'queryChange'", the component's metadata stops resolving, and every component
   * importing it then fails with "Component imports must be standalone
   * components…". It also made the debounce contract above a lie, since the
   * model's undebounced emission went out under the same name.
   *
   * `sv-search-bar` has the identical shape and solves it the same way:
   * `value = model()` for the two-way text, `searched = output()` for the
   * debounced notification. Enforced by `model-output-collision` in
   * scripts/check-ui-invariants.mjs.
   */
  searched = output<string>();
  /** The host should re-run the failed load. */
  retry = output<void>();

  /**
   * The search term. Two-way bindable, so it can be restored from a URL and
   * kept in step with a server-side query.
   */
  readonly query = model<string>('');
  readonly liveAnnouncement = signal<string>('');

  /** Debounced search term — what `searched` is built from. */
  private readonly debouncedQuery = createDebouncer('', {
    delayMs: this.debounceMs,
    destroyRef: inject(DestroyRef),
  });

  /** Last term handed to the host — guards against re-emitting the same one. */
  private lastQuery: string | null = null;

  constructor() {
    effect(() => this.debouncedQuery.set(this.query()));
    effect(() => {
      const term = this.debouncedQuery.value().trim();
      if (term === this.lastQuery) return;
      this.lastQuery = term;
      this.searched.emit(term);
    });

    effect(() => this.applyScrollOffset());
    effect(() => this._warnIgnoredModes());
    // `X-10`: an unwindowed list keeps one tab stop, but its DOM still grows
    // with the data — past the documented ceiling, say so once in dev mode.
    effect(() =>
      svWarnUnvirtualizedCeiling(
        'sv-list-view',
        this.isNested() ? this.flattenedNestedItems().length : this.flatItems().length,
        this.isVirtualized() && !this.isNested() && !this.isGrouped(),
      ),
    );
    effect(() => this._announcePaging());
  }

  /**
   * Put the viewport back where `scrollOffset` says it should be.
   *
   * Reads `loading`, `error` and the row count as well as the offset, so the
   * restore re-runs once there is something to scroll: a host that restores a
   * saved offset alongside a fetch would otherwise be applying it to a skeleton.
   */
  private applyScrollOffset(): void {
    const wanted = this.scrollOffset();
    if (this.loading() || this.error() || this.visibleItemCount() === 0) return;

    this.virtual.setScrollTop(wanted);
    if (this.syncViewportScroll(wanted)) return;

    // ★ The rows are there but their scroller is not — a restore that lands in
    // the same pass as the rows themselves (`loading` flipping false with an
    // offset already bound) runs before the branch has been drawn, so there is
    // nothing to scroll yet. A microtask is still too early; the next render is
    // exactly when the element exists.
    afterNextRender(() => this.syncViewportScroll(wanted), { injector: this.injector });
  }

  /**
   * Write `wanted` to the scroller. False when there is no scroller yet.
   *
   * Writes only when the DOM disagrees, which is what stops the scroll handler's
   * own `scrollOffset.set` from bouncing back as a second scroll.
   */
  private syncViewportScroll(wanted: number): boolean {
    const el = this.viewportEl();
    if (!el) return false;
    if (Math.round(el.scrollTop) !== Math.round(wanted)) el.scrollTop = wanted;
    return true;
  }

  /** Whether a search term is narrowing the list. */
  readonly isFiltered = computed(() => this.query().trim().length > 0);

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly loadingGuard = signal<boolean>(false);

  readonly isCheckable = computed(() => this.checkable() || this.mode() === 'checklist');
  readonly isSelectable = computed(() => this.selectionMode() !== 'none');
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly bulkSelectedIds = computed(() => (this.isCheckable() ? this.checkedIds() : this.selectedIds()));
  readonly bulkSelectedCount = computed(() => this.bulkSelectedIds().size);
  readonly hasQuickActions = computed(() => this.showQuickActions() && this.quickActions().length > 0);
  readonly isNested = computed(() => this.nested());
  readonly isVirtualized = computed(() => this.virtualized() || this.mode() === 'virtualization');
  readonly isGrouped = computed(() => this.grouped());
  readonly isTemplateMode = computed(() => this.mode() === 'template');
  readonly isCallHistoryMode = computed(() => this.mode() === 'call-history');
  readonly isScrollingMode = computed(() => false);

  readonly filteredItems = computed<ListViewItem[]>(() => {
    // With `serverSide`, the supplied list IS the answer to the current query.
    const q = this.serverSide() ? '' : this.query().trim().toLowerCase();
    const source = this.items();
    // `ListViewItem.id` is required by the type, but the type cannot require it
    // to be UNIQUE — and `track item.id` meets a repeat with NG0955, which takes
    // the whole list down and names neither the input nor the key. Checked
    // against the unfiltered source, so a duplicate is reported even while a
    // search happens to be hiding one of the pair.
    warnOnDuplicateItemKeys(source, 'id', 'sv-list-view [items]');
    if (!q) return source;

    if (this.isNested()) {
      return this.filterNested(source, q);
    }

    return source.filter(item => this.itemMatches(item, q));
  });

  readonly flattenedNestedItems = computed<FlattenedItem[]>(() => {
    if (!this.isNested()) return [];
    const rows = this.flattenTree(this.filteredItems(), 0);
    // Nested mode has its own collision space: two ids unique among their own
    // siblings still collide once flattened into one `@for`.
    warnOnDuplicateItemKeys(rows, (n) => n.item.id, 'sv-list-view [items] (nested)');
    return rows;
  });

  readonly groupedItems = computed<ListViewGroup[]>(() => {
    if (!this.isGrouped()) return [];

    const map = new Map<string, ListViewItem[]>();
    for (const item of this.filteredItems()) {
      const key = item.group?.trim() || 'Ungrouped';
      const groupItems = map.get(key) ?? [];
      groupItems.push(item);
      map.set(key, groupItems);
    }

    return [...map.entries()].map(([label, items]) => ({ label, items }));
  });

  readonly flatItems = computed<ListViewItem[]>(() => {
    if (this.isNested()) return [];
    if (this.isGrouped()) return this.groupedItems().flatMap(g => g.items);
    return this.filteredItems();
  });

  /**
   * Extra height a second line of text adds: `mt-1` (4px) over one `text-xs`
   * line (16px). A constant rather than an input because the row markup is the
   * component's own — a host cannot change the type scale it is measuring.
   */
  private static readonly SECOND_LINE_PX = 20;

  /** Extra height a tag strip adds: `mt-2` (8px) over one `text-[11px]` chip (20px). */
  private static readonly TAG_STRIP_PX = 28;

  /**
   * How tall row `item` is, in pixels — `itemHeight` plus whatever that row
   * renders beyond one line.
   *
   * ★★ Every windowed row used to be forced to `itemHeight` flat. A row with a
   * subtitle is taller than one without, so the fixed height CLIPPED the second
   * line — and the rows that survived did so only because the virtualized branch
   * rendered a stripped-down row that could not show a subtitle, an avatar, a
   * badge or a quick action in the first place. One row template plus a computed
   * height fixes both halves: the window now renders the same row as the rest of
   * the kit, and the scrollbar still knows exactly how tall the list is.
   */
  rowHeightOf(item: ListViewItem): number {
    const base = Math.max(1, this.itemHeight());
    let extra = 0;

    if (this.isTemplateMode()) {
      if (item.description) extra += SvListViewComponent.SECOND_LINE_PX;
      if (item.tags?.length) extra += SvListViewComponent.TAG_STRIP_PX;
    } else if (item.subtitle || item.description) {
      extra += SvListViewComponent.SECOND_LINE_PX;
    }

    return base + extra;
  }

  /**
   * Row windowing, shared with the rest of the kit via `@styloviz/core`.
   *
   * Only enabled for flat lists — a nested tree indents and expands, and a
   * grouped list has sticky section headers between its rows; both render in
   * full and the virtualizer reports the whole range. `_warnIgnoredModes` says
   * so out loud when a host asks for both.
   *
   * ★ `onNearEnd` is the infinite-scroll "close to the bottom" check that used
   * to be hand-inlined in `onContainerScroll` — moved into `@styloviz/core` (A0)
   * so `data-table` and `select-dropdown` don't have to re-derive the same
   * `scrollTop + clientHeight >= scrollHeight - threshold` arithmetic. It fires
   * on every qualifying scroll regardless of `hasMore` / `loadingMore` / an
   * in-tick burst — that gating is this component's own policy, kept here
   * exactly as before, not pushed down into the shared primitive.
   */
  private readonly virtual = createVariableVirtualizer<ListViewItem>({
    items: this.flatItems,
    itemSize: computed(() => (_: number, item: ListViewItem) => this.rowHeightOf(item)),
    viewportHeight: this.viewportHeight,
    overscan: this.overscan,
    enabled: computed(() => this.isVirtualized() && !this.isNested() && !this.isGrouped()),
    onNearEnd: () => this.handleNearEnd(),
  });

  readonly totalVirtualHeight = this.virtual.totalHeight;
  readonly virtualRange = this.virtual.range;
  readonly virtualItems = this.virtual.items;
  readonly topSpacerHeight = this.virtual.topSpacer;
  readonly bottomSpacerHeight = this.virtual.bottomSpacer;

  readonly renderItems = computed<readonly ListViewItem[]>(() =>
    this.isVirtualized() && !this.isNested() ? this.virtualItems() : this.flatItems()
  );

  readonly allVisibleIds = computed<(string | number)[]>(() => {
    if (this.isNested()) {
      return this.flattenedNestedItems().map(n => n.item.id);
    }
    return this.flatItems().map(item => item.id);
  });

  /**
   * The visible rows a bulk check may actually touch.
   *
   * ★ Disabled rows are excluded. Their own checkbox is rendered `[disabled]`
   * and `toggleCheck` refuses them, so a "select all" that swept them in left
   * the user unable to uncheck them again — and every bulk action then applied
   * to a row the UI had greyed out.
   */
  readonly checkableVisibleIds = computed<(string | number)[]>(() => {
    if (this.isNested()) {
      return this.flattenedNestedItems().filter(n => !n.item.disabled).map(n => n.item.id);
    }
    return this.flatItems().filter(item => !item.disabled).map(item => item.id);
  });

  readonly allChecked = computed(() => {
    // Against `checkableVisibleIds`, not every visible row: otherwise a list
    // holding one disabled row could never show the header box as checked.
    const ids = this.checkableVisibleIds();
    if (!ids.length) return false;
    const checked = this.checkedIds();
    return ids.every(id => checked.has(id));
  });

  readonly checkedCount = computed(() => this.checkedIds().size);
  readonly visibleItemCount = computed(() => {
    if (this.isNested()) {
      return this.countTreeItems(this.filteredItems());
    }
    return this.flatItems().length;
  });

  readonly rootClasses = computed(() => {
    const base =
      'rounded-2xl border bg-white/90 shadow-sm backdrop-blur-sm dark:bg-gray-900/80 dark:shadow-none';

    const variantMap: Record<ListViewVariant, string> = {
      default: 'border-gray-200/80 dark:border-gray-700/70',
      soft: 'border-primary-100/80 bg-primary-50/40 dark:border-primary-900/50 dark:bg-primary-950/25',
      outlined: 'border-2 border-gray-300 dark:border-gray-600',
    };

    return [base, variantMap[this.variant()], this.customClass()].filter(Boolean).join(' ');
  });

  readonly rowPadding = computed(() => {
    const densityMap: Record<ListViewDensity, string> = {
      compact: 'px-3 py-2',
      comfortable: 'px-4 py-3',
      spacious: 'px-5 py-4',
    };
    return densityMap[this.density()];
  });

  // ── The keyboard cursor ─────────────────────────────────────────────────────

  /**
   * Every row the cursor may land on, in the order they read — the full list,
   * not the rendered window. Disabled rows are not stops.
   */
  readonly focusableItems = computed<readonly ListViewItem[]>(() => {
    if (this.isNested()) {
      return this.flattenedNestedItems().filter(n => !n.item.disabled).map(n => n.item);
    }
    return this.flatItems().filter(item => !item.disabled);
  });

  readonly focusableIds = computed<readonly (string | number)[]>(() =>
    this.focusableItems().map(item => item.id),
  );

  /**
   * `X-10` — whether the rows carry the roving tab stop. When they do, the
   * region around them is NOT a second tab stop (`tabindex="-1"`: still
   * focusable by script, which is how a scrolled-away row's focus is rescued).
   */
  readonly regionTabIndex = computed(() =>
    this.enableRovingFocus() && this.focusableIds().length > 0 ? -1 : 0,
  );

  /**
   * Whether the row that owns the roving tab stop is in the DOM right now.
   *
   * ★★★ DA-45 — ONLY A FLAT WINDOWED LIST CAN STRAND IT. A host that restores
   *     a saved cursor (`activeItemId`) far down a virtualized list while the
   *     window is at the top rendered no row with `tabindex="0"` — and because
   *     the rows own the stop, the region was `-1` as well. Tab skipped the
   *     whole list (axe: `scrollable-region-focusable` on the viewport).
   *     Nested and grouped lists render every focusable row (a collapsed
   *     branch's children are not focusable), so they cannot strand it.
   */
  readonly tabStopRendered = computed(() => {
    const id = this.tabStopId();
    if (id === null || !this.isVirtualized() || this.isNested() || this.isGrouped()) return true;
    return this.renderItems().some(item => item.id === id);
  });

  /**
   * The scrolling viewport stands in for the tab stop while the row that owns
   * it is outside the window, and hands focus to that row when a keyboard
   * arrives (`onViewportFocus`). Otherwise `-1`: focusable by script only,
   * which is how `rescueFocus` parks focus when a scroll unmounts the row.
   */
  readonly viewportTabIndex = computed<0 | -1>(() =>
    this.enableRovingFocus() && !this.tabStopRendered() ? 0 : -1,
  );

  /** True while `rescueFocus` parks focus on the viewport, so it is not handed back. */
  private parkingFocus = false;

  /**
   * Focus arrived on the viewport itself. When it is standing in for the tab
   * stop and the focus came from the keyboard, bring the cursor row into the
   * window and move focus onto it — Tab lands where the user left off.
   *
   * ★ Keyboard only. `:focus-visible` is how the platform tells a Tab from a
   *   pointer: a press on the viewport's scrollbar must not throw the reader
   *   back to the cursor row they have just scrolled away from.
   */
  onViewportFocus(event: FocusEvent): void {
    if (this.parkingFocus || this.viewportTabIndex() !== 0) return;
    const el = event.currentTarget as HTMLElement | null;
    if (!el || event.target !== el || !isKeyboardFocus(el)) return;
    const id = this.tabStopId();
    if (id !== null) this.focusRow(id);
  }

  /** `X-10` typeahead over row titles — type "ma" to reach "Marketing". */
  private readonly typeahead = createTypeahead<ListViewItem>({ labelOf: item => item.title });

  /**
   * The one row that carries `tabindex="0"`.
   *
   * A list is a single tab stop: Tab reaches the list, arrows move within it.
   * Falls back to the first row when `activeItemId` names a row that a search or
   * a page change has since taken away — otherwise the list would have no tab
   * stop at all and Tab would skip straight past it.
   */
  readonly tabStopId = computed<string | number | null>(() => {
    const ids = this.focusableIds();
    const active = this.activeItemId();
    if (active !== null && ids.includes(active)) return active;
    return ids[0] ?? null;
  });

  /** `0` for the row that owns the tab stop, `-1` for the rest. */
  rowTabIndex(item: ListViewItem): number {
    if (!this.enableRovingFocus()) return 0;
    return item.id === this.tabStopId() ? 0 : -1;
  }

  onSearchInput(value: string): void {
    this.query.set(value);
  }

  onContainerScroll(event: Event): void {
    // ★ `virtual.onScroll` now owns both halves of what this handler used to
    // do inline: it updates `scrollTop` (driving the virtualized window) and,
    // synchronously afterwards, evaluates the near-bottom check and invokes
    // `handleNearEnd()` below when it qualifies — same order as before this
    // moved into `@styloviz/core`.
    this.virtual.onScroll(event);

    const top = (event.target as { scrollTop?: number } | null)?.scrollTop ?? 0;
    this.scrollOffset.set(Math.max(0, top));

    this.rescueFocus();
  }

  /**
   * Move focus off a row that is about to be unmounted by the scroll.
   *
   * ★★ Without this, scrolling with the keyboard in a windowed list handed focus
   * to `<body>`: the focused button left the window, Angular removed it, and the
   * user's next Tab started again from the top of the page. The viewport is
   * `tabindex="-1"` so it can catch focus, and `activeItemId` remembers where the
   * cursor was, so the next arrow key carries on from that row rather than from
   * nothing.
   */
  private rescueFocus(): void {
    const active = document.activeElement as HTMLElement | null;
    const row = active?.closest?.('[data-lv-row-btn="1"]') as HTMLElement | null;
    if (!row || !this.host.nativeElement.contains(row)) return;

    const id = row.dataset['lvId'];
    if (id !== undefined && this.renderItems().some(item => String(item.id) === id)) return;

    this.parkingFocus = true;
    try {
      this.viewportEl()?.focus({ preventScroll: true });
    } finally {
      this.parkingFocus = false;
    }
  }

  /** The scrolling element — where the offset is read from and written to. */
  private viewportEl(): HTMLElement | null {
    return (this.host.nativeElement as HTMLElement).querySelector('[data-lv-viewport]');
  }

  /**
   * The infinite-scroll page request, gated by this component's own policy —
   * not the shared virtualizer's concern. See the doc comment on `virtual`.
   */
  private handleNearEnd(): void {
    if (!this.infiniteScroll() || !this.hasMore() || this.loadingMore() || this.loadingGuard()) {
      return;
    }

    this.loadingGuard.set(true);
    this.loadMore.emit({ visibleCount: this.renderItems().length, totalCount: this.flatItems().length });
    queueMicrotask(() => this.loadingGuard.set(false));
  }

  onItemActivate(item: ListViewItem): void {
    if (item.disabled) return;

    this.itemClick.emit({ item });

    if (this.selectionMode() === 'single') {
      const next = new Set<string | number>([item.id]);
      this.selectedIds.set(next);
      this.selectionChange.emit(next);
      this.announce(`Selected ${item.title}.`);
      return;
    }

    if (this.selectionMode() === 'multiple') {
      const next = new Set(this.selectedIds());
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      this.selectedIds.set(next);
      this.selectionChange.emit(next);
      this.announce(next.has(item.id) ? `Selected ${item.title}.` : `Deselected ${item.title}.`);
    }
  }

  toggleCheck(item: ListViewItem, checked: boolean): void {
    if (item.disabled) return;

    const next = new Set(this.checkedIds());
    if (checked) next.add(item.id);
    else next.delete(item.id);

    this.checkedIds.set(next);
    this.checkChange.emit({ item, checked });
    this.announce(checked ? `Checked ${item.title}.` : `Unchecked ${item.title}.`);
  }

  toggleAllChecks(checked: boolean): void {
    const next = checked ? new Set(this.checkableVisibleIds()) : new Set<string | number>();
    this.checkedIds.set(next);
    this.announce(checked ? `Selected all ${next.size} visible items.` : 'Cleared all selected items.');
  }

  // ── Checking a whole section ────────────────────────────────────────────────
  //
  // ★★★ THE GROUPED LIST RENDERED NO CHECKBOX AT ALL. `[grouped]` with
  //     `checkable` drew the "Select all" box in the toolbar, the "N checked"
  //     tally in the footer and the bulk-action bar — and not one row control to
  //     put a number in either of them. The only way to check anything was the
  //     toolbar's all-or-nothing box. Rows get their control from the shared row
  //     template now; a section gets one too, because "check this section" is the
  //     thing a grouped list exists to make possible.

  /** The rows in one section that a check may actually touch. */
  private groupCheckableIds(label: string): (string | number)[] {
    const group = this.groupedItems().find(g => g.label === label);
    return group ? group.items.filter(item => !item.disabled).map(item => item.id) : [];
  }

  /** True when every checkable row in the section is checked. */
  isGroupChecked(label: string): boolean {
    const ids = this.groupCheckableIds(label);
    if (!ids.length) return false;
    const checked = this.checkedIds();
    return ids.every(id => checked.has(id));
  }

  /**
   * True when some — but not all — of the section is checked.
   *
   * A native checkbox reports `indeterminate` as "mixed" to a screen reader,
   * which is the whole reason to set it rather than paint a dash.
   */
  isGroupIndeterminate(label: string): boolean {
    const ids = this.groupCheckableIds(label);
    if (!ids.length) return false;
    const checked = this.checkedIds();
    const hits = ids.filter(id => checked.has(id)).length;
    return hits > 0 && hits < ids.length;
  }

  /**
   * Check or uncheck one section, leaving every other section alone.
   *
   * A group is not an item, so its label never enters `checkedIds` — a host
   * reading that set back gets item ids and nothing else.
   */
  toggleGroupChecks(label: string, checked: boolean): void {
    const ids = this.groupCheckableIds(label);
    if (!ids.length) return;

    const next = new Set(this.checkedIds());
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }

    this.checkedIds.set(next);
    this.announce(
      checked
        ? `Checked all ${ids.length} items in ${label}.`
        : `Unchecked all items in ${label}.`
    );
  }

  toggleExpand(item: ListViewItem): void {
    if (!item.children?.length) return;

    const next = new Set(this.expandedIds());
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    this.expandedIds.set(next);
  }

  isExpanded(item: ListViewItem): boolean {
    return this.expandedIds().has(item.id);
  }

  isSelected(item: ListViewItem): boolean {
    return this.selectedIds().has(item.id);
  }

  isChecked(item: ListViewItem): boolean {
    return this.checkedIds().has(item.id);
  }

  toggleSelected(item: ListViewItem, checked: boolean): void {
    if (item.disabled || this.selectionMode() === 'none') {
      return;
    }

    if (this.selectionMode() === 'single') {
      const next = checked ? new Set<string | number>([item.id]) : new Set<string | number>();
      this.selectedIds.set(next);
      this.selectionChange.emit(next);
      return;
    }

    const next = new Set(this.selectedIds());
    if (checked) next.add(item.id);
    else next.delete(item.id);
    this.selectedIds.set(next);
    this.selectionChange.emit(next);
    this.announce(checked ? `Selected ${item.title}.` : `Deselected ${item.title}.`);
  }

  onQuickAction(item: ListViewItem, action: ListViewQuickAction): void {
    if (item.disabled) return;
    this.quickActionClick.emit({ item, action });
    this.announce(`${action.label} action triggered for ${item.title}.`);
  }

  onBulkAction(action: ListViewBulkAction): void {
    const selected = new Set(this.bulkSelectedIds());
    this.bulkActionClick.emit({ action, selectedIds: selected });
    this.announce(`${action.label} applied to ${selected.size} selected item${selected.size === 1 ? '' : 's'}.`);
  }

  onRootKeydown(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const tag = target?.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
      return;
    }

    if (this.enableRovingFocus() && this.handleRovingFocusKey(event, target)) {
      return;
    }

    // Bulk hotkeys win over typeahead: they are opt-in and only live while a
    // selection exists, so a host that armed `a` for Archive keeps it.
    if (!this.enableBulkHotkeys() || this.bulkSelectedCount() === 0 || this.bulkActions().length === 0) {
      this.handleTypeahead(event, target);
      return;
    }

    const key = event.key.toLowerCase();
    const explicit = this.bulkHotkeys()[key];

    const fallbackMap: Record<string, string> = {
      delete: 'delete',
      backspace: 'delete',
      a: 'archive',
      r: 'mark-read',
    };

    const actionId = explicit ?? fallbackMap[key];
    const action = actionId ? this.bulkActions().find(item => item.id === actionId) : undefined;
    if (!action) {
      this.handleTypeahead(event, target);
      return;
    }

    event.preventDefault();
    this.onBulkAction(action);
  }

  /**
   * ★★★ THIS USED TO WALK THE DOM, and a windowed list is not in the DOM.
   *
   * `rowButtons()` returned the rendered buttons — twenty of five hundred — so
   * `Math.min(rowButtons.length - 1, …)` clamped ArrowDown at the bottom edge of
   * the WINDOW and called it the end of the list. Home and End reached the ends
   * of the window too. The cursor now walks `focusableIds`, which is the whole
   * list, and the row is scrolled into the window before it is focused.
   */
  private handleRovingFocusKey(event: KeyboardEvent, target: HTMLElement | null): boolean {
    const key = event.key;
    if (
      key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End' &&
      key !== 'PageDown' && key !== 'PageUp'
    ) {
      return false;
    }

    const ids = this.focusableIds();
    if (!ids.length) {
      return false;
    }

    // Where the cursor is: the row the event came from, or — when focus was
    // rescued off a row the scroll unmounted — the last row it was on.
    const currentId = this.rowIdOf(target) ?? this.activeItemId();
    const currentIndex = currentId === null ? -1 : ids.indexOf(currentId);

    // `X-10`: arrows clamp, Home/End go to the ends, PageUp/PageDown jump one
    // viewport of rows and clamp — the shared collection contract.
    const nextIndex = svCollectionTarget(key, ids.length, currentIndex, { pageSize: this.pageSize() });
    if (nextIndex === null) return false;

    event.preventDefault();
    this.focusRow(ids[nextIndex]);
    return true;
  }

  /** Rows per PageUp/PageDown: one viewport of single-line rows. */
  private pageSize(): number {
    return Math.max(1, Math.floor(this.viewportHeight() / Math.max(1, this.itemHeight())));
  }

  /** `X-10` typeahead: a printable key moves to the next row whose title starts with it. */
  private handleTypeahead(event: KeyboardEvent, target: HTMLElement | null): void {
    if (!this.enableRovingFocus() || !svIsTypeaheadKey(event)) return;
    const items = this.focusableItems();
    const currentId = this.rowIdOf(target) ?? this.activeItemId();
    const current = currentId === null ? -1 : items.findIndex(item => item.id === currentId);
    const next = this.typeahead.handle(event.key, items, current);
    if (next === null) return;
    event.preventDefault();
    this.focusRow(items[next].id);
  }

  /** The id of the row an event came from, matched back to a live item id. */
  private rowIdOf(target: HTMLElement | null): string | number | null {
    const row = target?.closest('[data-lv-row-btn="1"]') as HTMLElement | null;
    const raw = row?.dataset['lvId'];
    if (raw === undefined) return null;
    // `data-` attributes are strings; `ListViewItem.id` may be a number.
    return this.focusableIds().find(id => String(id) === raw) ?? null;
  }

  /**
   * Put the cursor on `id`: remember it, bring it into the window if windowing
   * has it off screen, then focus it.
   *
   * The focus is synchronous whenever the row is already rendered, which is
   * every unwindowed list and most windowed steps. Only a jump that had to
   * scroll waits a tick, because the row it wants does not exist until the
   * window has moved and been rendered.
   */
  private focusRow(id: string | number): void {
    this.activeItemId.set(id);

    if (this.scrollRowIntoView(id)) {
      setTimeout(() => this.rowElement(id)?.focus(), 0);
      return;
    }

    this.rowElement(id)?.focus();
  }

  /** Scrolls `id` into the window if it is outside it. True if it scrolled. */
  private scrollRowIntoView(id: string | number): boolean {
    if (!this.isVirtualized() || this.isNested() || this.isGrouped()) return false;

    const index = this.flatItems().findIndex(item => item.id === id);
    if (index < 0) return false;

    const top = this.virtual.offsetOf(index);
    const bottom = this.virtual.offsetOf(index + 1);
    const current = this.virtual.scrollTop();
    const viewport = Math.max(0, this.viewportHeight());

    let next = current;
    if (top < current) next = top;
    else if (bottom > current + viewport) next = bottom - viewport;
    if (next === current) return false;

    this.scrollOffset.set(next);
    this.virtual.setScrollTop(next);
    const el = this.viewportEl();
    if (el) el.scrollTop = next;
    return true;
  }

  /**
   * The rendered row button for `id`, or null when the window does not hold it.
   *
   * Matched on the dataset rather than through an attribute selector: an id is
   * host data, and interpolating it into a selector is a query-injection waiting
   * to happen the first time one contains a quote.
   */
  private rowElement(id: string | number): HTMLElement | null {
    const key = String(id);
    const rows = (this.host.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      'button[data-lv-row-btn="1"]:not([disabled])'
    );
    for (const row of Array.from(rows)) {
      if (row.dataset['lvId'] === key) return row;
    }
    return null;
  }

  trackById(_: number, item: ListViewItem): string | number {
    return item.id;
  }

  trackByNested(_: number, node: FlattenedItem): string | number {
    return node.item.id;
  }

  /**
   * Call type → icon-library name.
   *
   * ★★ The `video` case was a REAL DEFECT, not just raw-path debt. It returned
   * only the LENS WEDGE of a video-camera glyph — `[attr.d]` binds one path, so
   * whoever copied it had to drop the camera body. Rendered at the 14px this
   * list uses, it read as an unrecognisable squiggle. The library `video` glyph
   * is a `<rect>` body plus the wedge, which is why a name works and a single
   * `d` string never could. `video` was moved Pro → free for the free twin.
   *
   * ⬜ The arrows are mapped FAITHFULLY to what shipped: `incoming` is an UP
   * arrow and `outgoing` a DOWN arrow. That is inverted from the convention in
   * most call UIs (received points down/in, placed points up/out). Left as-is
   * on purpose — an icon sweep should not silently change behaviour — but it
   * is flagged in STYLOVIZ_RELEASE_TODO.md as a product decision.
   */
  /**
   * Call direction → icon-library NAME.
   *
   * ★★★ THE ARROWS WERE INVERTED. `incoming` returned `arrow-up` and `outgoing`
   * returned `arrow-down`, which is backwards from every call log a user has
   * ever seen — iOS Phone, the Android dialer, WhatsApp, Skype and Teams all
   * draw an incoming call as an arrow coming DOWN-and-IN and an outgoing call
   * as one going UP-and-OUT. A caller reading this list would have read every
   * row's direction wrong.
   *
   * The diagonals are the call-log idiom specifically; a plain up/down arrow is
   * the trend idiom and is what made the mistake easy to miss. `arrow-down-left`
   * and `arrow-up-right` were moved Pro → free for this, because the free twin
   * resolves through `<sv-icon>`.
   *
   * ★★ `missed` is now its OWN branch. It used to fall through to the default,
   * which meant an item with **no `callType` at all** drew the same red cross
   * and claimed a missed call that never happened. Unknown now gets a neutral
   * handset instead — see `callTypeClass` for the matching colour.
   *
   * ★ `missed` keeps a cross rather than sharing the red incoming arrow that
   * some dialers use, deliberately: colour is not an accessible discriminator,
   * so incoming and missed must differ in SHAPE and not only in green-vs-red.
   */
  callTypeIcon(type: ListViewCallType | undefined): string {
    if (type === 'incoming') return 'arrow-down-left';
    if (type === 'outgoing') return 'arrow-up-right';
    if (type === 'video') return 'video';
    if (type === 'missed') return 'close';
    return 'phone';
  }

  /**
   * What a screen reader hears, since the glyph is decorative and the colour
   * says nothing to anyone who cannot see it.
   *
   * ★ Without this the call DIRECTION — the entire point of a call-history row
   * — reached nobody using assistive technology, and nobody who cannot tell
   * green from red.
   */
  callTypeLabel(type: ListViewCallType | undefined): string {
    if (type === 'incoming') return 'Incoming call';
    if (type === 'outgoing') return 'Outgoing call';
    if (type === 'video') return 'Video call';
    if (type === 'missed') return 'Missed call';
    return 'Call';
  }

  /**
   * ★ `missed` is explicit here for the same reason as in `callTypeIcon`: red
   * used to be the FALLBACK, so an item with no `callType` was painted as a
   * failure. Unknown is now neutral grey.
   *
   * ★ AND `video` IS THE ONE LITERAL LEFT, because it is the one entry that
   * names a MEDIUM rather than an outcome. `incoming`/`outgoing`/`missed` are
   * connected, placed and failed — the same three things the kit paints accent,
   * primary and danger everywhere else, so a rebrand should move them. A video
   * call is neither good nor bad news; violet marks it as a different sort of
   * call, and no token family owns that idea.
   */
  callTypeClass(type: ListViewCallType | undefined): string {
    if (type === 'incoming') return 'text-accent-700 dark:text-accent-400';
    if (type === 'outgoing') return 'text-primary-600 dark:text-primary-400';
    if (type === 'video') return 'text-violet-600 dark:text-violet-400';
    if (type === 'missed') return 'text-danger-600 dark:text-danger-400';
    return 'text-gray-500 dark:text-gray-400';
  }

  initials(item: ListViewItem): string {
    const source = item.title.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('');
    return source.toUpperCase() || 'NA';
  }

  nestedIndent(depth: number): string {
    const baseIndent = 0.5;
    return `${baseIndent + depth * 1.2}rem`;
  }

  actionToneClass(tone: ListViewActionTone | undefined): string {
    if (tone === 'primary') {
      return 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 dark:border-primary-900/60 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/45';
    }
    if (tone === 'danger') {
      return 'border-danger-200 bg-danger-50 text-danger-700 hover:bg-danger-100 dark:border-danger-900/60 dark:bg-danger-900/30 dark:text-danger-300 dark:hover:bg-danger-900/45';
    }
    return 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-gray-800';
  }

  // ── Which modes compose, and which quietly do not ───────────────────────────
  //
  // ★★★ EIGHT PRESETS AND FOUR BOOLEANS SHARE ONE TEMPLATE, and the template
  //     picks ONE branch: nested, then grouped, then flat. So `[nested]` with
  //     `[virtualized]` renders the tree unwindowed, `[grouped]` with
  //     `[virtualized]` renders every section in full, and `[nested]` with
  //     `[grouped]` throws the grouping away — each of them silently, and each of
  //     them a host that read the input list, wired up two features and got one.
  //
  //     The matrix, stated once:
  //
  //       default · checklist · template · call-history  — row presets, compose
  //                                                        with everything below
  //       virtualization                                 — flat lists only
  //       [grouped]                                      — sections, unwindowed
  //       [nested]                                       — tree, unwindowed,
  //                                                        beats grouped
  //       nested · grouped · scrolling (as `mode`)        — Pro presets, ignored
  //
  //     Dev-mode only, once per combination.

  /** Combinations where one input wins and the other does nothing. */
  private readonly _ignoredCombinations: readonly {
    readonly key: string;
    readonly when: () => boolean;
    readonly message: string;
  }[] = [
    {
      key: 'nested+virtualized',
      when: () => this.isNested() && this.isVirtualized(),
      message:
        'windowing is ignored while the list is nested — a tree expands and ' +
        'indents, so it renders in full. Drop [virtualized], or flatten the data.',
    },
    {
      key: 'grouped+virtualized',
      when: () => this.isGrouped() && this.isVirtualized(),
      message:
        'windowing is ignored while the list is grouped — sticky section headers ' +
        'need every section rendered. Drop [virtualized], or drop [grouped] and ' +
        'pre-sort the rows.',
    },
    {
      key: 'nested+grouped',
      when: () => this.isNested() && this.isGrouped(),
      message:
        'grouping is ignored while the list is nested — the tree wins and ' +
        'item.group is never read. Pick one.',
    },
    {
      key: 'checkable+selectionMode',
      when: () => this.isCheckable() && this.isSelectable(),
      message:
        'the selection control is not rendered while the list is checkable — a row ' +
        'carries one control, and the checkbox wins. Read [(checkedIds)] instead of ' +
        '[(selectedIds)], or drop [checkable].',
    },
    {
      key: 'pro-preset',
      when: () => {
        const mode = this.mode();
        return mode === 'nested' || mode === 'grouped' || mode === 'scrolling';
      },
      message:
        'mode="nested", "grouped" and "scrolling" are Pro presets and this build ' +
        'ignores them — the list renders flat. Use [nested] or [grouped] directly, ' +
        'or [viewportHeight] for a fixed-height scroller.',
    },
  ];

  private readonly _warnedCombinations = new Set<string>();

  private _warnIgnoredModes(): void {
    if (typeof ngDevMode === 'undefined' || !ngDevMode) return;

    for (const combination of this._ignoredCombinations) {
      if (!combination.when() || this._warnedCombinations.has(combination.key)) continue;
      this._warnedCombinations.add(combination.key);
      console.warn(`[styloviz] sv-list-view: ${combination.message}`);
    }
  }

  /**
   * Paging state the live region has already spoken about. `active` latches once
   * the list admits to having pages, so a list that never pages stays silent.
   */
  private pagingSpoken = { count: 0, more: false, active: false };

  /**
   * Say when a page arrives and when the pages run out.
   *
   * A sighted user watches "Scroll to load more" turn into the end marker. Nothing
   * carried that to a screen reader, so a keyboard user paging a 500-row list had
   * no way to tell a slow page from the end of the data. The previous count is
   * what makes this a transition rather than a running total re-read on every
   * render.
   */
  private _announcePaging(): void {
    const paged = this.isScrollingMode() || this.infiniteScroll();
    const count = this.visibleItemCount();
    const more = this.hasMore();
    const loadingMore = this.loadingMore();
    const settling = this.loading() || Boolean(this.error());

    const previous = this.pagingSpoken;
    this.pagingSpoken = { count, more, active: previous.active || more || loadingMore };

    if (!paged || settling || loadingMore || !previous.active) return;

    const added = count - previous.count;
    const parts: string[] = [];
    if (added > 0) parts.push(`Loaded ${added} more item${added === 1 ? '' : 's'}.`);
    if (!more && previous.more) parts.push(`End of list. All ${count} items loaded.`);
    if (parts.length) this.announce(parts.join(' '));
  }

  private announce(message: string): void {
    if (!this.announceActions()) {
      return;
    }

    this.liveAnnouncement.set('');
    queueMicrotask(() => this.liveAnnouncement.set(message));
  }

  private itemMatches(item: ListViewItem, query: string): boolean {
    const haystack = [
      item.title,
      item.subtitle,
      item.description,
      item.group,
      item.badge,
      item.meta,
      item.timestamp,
      item.duration,
      item.amount,
      ...(item.tags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  }

  private filterNested(items: ListViewItem[], query: string): ListViewItem[] {
    const result: ListViewItem[] = [];

    for (const item of items) {
      const filteredChildren = item.children?.length ? this.filterNested(item.children, query) : [];
      if (this.itemMatches(item, query) || filteredChildren.length > 0) {
        result.push({ ...item, children: filteredChildren });
      }
    }

    return result;
  }

  private flattenTree(items: ListViewItem[], depth: number): FlattenedItem[] {
    const rows: FlattenedItem[] = [];

    items.forEach((item, index) => {
      const hasChildren = Boolean(item.children?.length);
      // Counted against its siblings, not the flattened list: a screen reader
      // reading "2 of 3, level 2" is describing the branch it is standing in.
      rows.push({ item, depth, hasChildren, posinset: index + 1, setsize: items.length });

      if (hasChildren && this.expandedIds().has(item.id)) {
        rows.push(...this.flattenTree(item.children ?? [], depth + 1));
      }
    });

    return rows;
  }

  private countTreeItems(items: ListViewItem[]): number {
    let total = 0;
    for (const item of items) {
      total += 1;
      if (item.children?.length) {
        total += this.countTreeItems(item.children);
      }
    }
    return total;
  }
}

/**
 * Whether `el`'s focus came from the keyboard. `:focus-visible` is the
 * platform's own heuristic; an engine that does not know the selector throws,
 * and then the keyboard reading is the safe one — a stranded tab stop is the
 * worse failure.
 */
function isKeyboardFocus(el: HTMLElement): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}
