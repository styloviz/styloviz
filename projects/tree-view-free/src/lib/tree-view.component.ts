import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  createTypeahead,
  svAttrSelector,
  svCollectionTarget,
  svCutHierarchyCycles,
  svIsTypeaheadKey,
  svRecoverFocus,
  svSuccessorIndex,
  svWarnUnvirtualizedCeiling,
  warnOnDuplicateItemKeys,
  type SvDataError,
} from '@styloviz/core';

declare const ngDevMode: boolean | undefined;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TreeNode {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  children?: TreeNode[];
  readonly expanded?: boolean;
  readonly disabled?: boolean;
  readonly badge?: string;
}

export interface FlatNode {
  readonly node: TreeNode;
  readonly depth: number;
  readonly isLast: boolean;
  readonly hasChildren: boolean;
  readonly isExpanded: boolean;
}

export interface TreeNodeClickEvent {
  readonly node: TreeNode;
  readonly depth: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * SvTreeViewComponent (Free) — Collapsible single-select tree.
 *
 * For the full 8-variant suite (file explorer, checkbox tri-state,
 * org chart, tree table, searchable, draggable, lazy-load) upgrade to
 * `@styloviz-pro/tree-view`.
 *
 * @example
 * ```html
 * <sv-tree-view [nodes]="nodes" (nodeClick)="onNodeClick($event)" />
 * ```
 */
@Component({
  imports: [SvIconComponent, SvSkeletonShellComponent, SvErrorShellComponent, SvEmptyShellComponent],
  selector: 'sv-tree-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="p-2" data-sv-state="loading">
        <sv-skeleton-shell variant="list" [rows]="5" ariaLabel="Loading tree" />
      </div>
    } @else if (error()) {
      <sv-error-shell
        [error]="error()"
        title="Could not load this tree"
        (retry)="retry.emit()"
        data-sv-state="error"
      />
    } @else {

    <div class="sv-tree-view select-none" role="tree" [attr.aria-label]="ariaLabel().trim() || null">
      @for (fn of visibleNodes(); track fn.node.id) {
        <div class="group flex items-center gap-1 rounded-lg px-1 outline-none transition-colors duration-100 cursor-pointer focus-visible:ring-2 focus-visible:ring-brandaccent-400"
             [class]="fn.node.disabled
                        ? 'opacity-40 cursor-not-allowed py-1.5'
                        : isSelected(fn.node.id)
                            ? 'py-1.5 bg-brandaccent-50 dark:bg-brandaccent-900/25'
                            : 'py-1.5 hover:bg-gray-100/70 dark:hover:bg-gray-800/50'"
             (click)="select(fn.node, fn.depth); setActive(fn.node.id)"
             (keydown)="onKeydown($event, fn, $index)"
             role="treeitem"
             [attr.data-tree-id]="fn.node.id"
             [attr.tabindex]="treeTabIndex(fn.node.id)"
             [attr.aria-level]="fn.depth + 1"
             [attr.aria-expanded]="fn.hasChildren ? fn.isExpanded : null"
             [attr.aria-selected]="selectable() ? isSelected(fn.node.id) : null">

          <!--
            Depth spacers, one per level, carrying the optional connector guide.
            Indentation used to be a paddingLeft on the row, which left
            showLines - declared, documented, default true - with nothing to
            hang a line on, so it did nothing at all. The Pro twin has rendered
            these all along; this is the same 20px-per-level geometry.
            (No backticks in here: this template is an inline JS literal.)
          -->
          @for (d of depthArray(fn.depth); track d) {
            <span class="relative w-5 shrink-0 self-stretch" aria-hidden="true">
              @if (showLines()) {
                <span class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2
                             bg-gray-200 dark:bg-gray-700/70"></span>
              }
            </span>
          }

          <!-- Chevron toggle -->
          <!-- Out of the tab order (X-10): ArrowRight/ArrowLeft on the row
               expand and collapse, so a 1,500-row tree stays ONE tab stop. -->
          <button type="button"
                  tabindex="-1"
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded
                         text-gray-400 transition-all hover:text-gray-700 dark:hover:text-gray-200
                         focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brandaccent-400"
                  [class.invisible]="!fn.hasChildren"
                  (click)="toggle(fn.node); $event.stopPropagation()"
                  [attr.aria-label]="(fn.isExpanded ? 'Collapse ' : 'Expand ') + fn.node.label">
            <sv-icon name="chevron-right"
                     [cssClass]="'h-3.5 w-3.5 transition-transform duration-150' + (fn.isExpanded ? ' rotate-90' : '')"
                     [strokeWidth]="2" />
          </button>

          <!-- Icon -->
          @if (fn.node.icon) {
            <span class="shrink-0 text-sm" aria-hidden="true">{{ fn.node.icon }}</span>
          }

          <!-- Label -->
          <span class="flex-1 truncate text-[13px] font-medium"
                [class]="isSelected(fn.node.id)
                           ? 'text-brandaccent-700 dark:text-brandaccent-300'
                           : 'text-gray-800 dark:text-gray-100'">
            {{ fn.node.label }}
          </span>

          <!-- Badge -->
          @if (fn.node.badge) {
            <span class="ml-auto shrink-0 rounded-full bg-gray-100 px-1.5 py-px
                         text-[10px] font-semibold text-gray-600
                         dark:bg-gray-800 dark:text-gray-300">
              {{ fn.node.badge }}
            </span>
          }
        </div>
      }

      @if (!visibleNodes().length) {
        <sv-empty-shell reason="no-data" [title]="emptyText()" data-sv-state="empty" />
      }
    </div>
    }

  `,
})
export class SvTreeViewComponent {
  /** Tree node data (nested children, optional icons). */
  readonly nodes      = input<TreeNode[]>([]);
  /**
   * Enable single-row selection highlight. @default true
   *
   * ★ Also decides whether the rows claim `aria-selected` at all. A display-only
   *   tree that reports `aria-selected="false"` on every row announces a
   *   selection model that does not exist, and a listener can only discover that
   *   by pressing Enter and getting nothing.
   */
  readonly selectable = input<boolean>(true);
  /** Show vertical connector guide lines. @default true */
  readonly showLines  = input<boolean>(true);
  /**
   * What this tree is, e.g. `'Project files'` — names the `role="tree"` region.
   *
   * ★ Two trees side by side both announce as an unnamed "tree" without this.
   *   Left unset, no name is invented: an `aria-label` of "Tree" only repeats
   *   the role. Matches `sv-tree-view-pro`'s input of the same name.
   *
   * @default ''
   */
  readonly ariaLabel  = input<string>('');

  /**
   * True while the tree is being fetched. Replaces it with a placeholder.
   * @default false
   */
  readonly loading = input<boolean>(false);

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an
   * `HttpErrorResponse`.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /** Copy for the empty state. @default 'No items to display' */
  readonly emptyText = input<string>('No items to display');

  /** Fires when an enabled node is clicked or activated with Enter/Space while `selectable`; payload is the node and its depth (0 for roots). */
  readonly nodeClick    = output<TreeNodeClickEvent>();
  /** Fires with the node when an enabled parent is expanded, by its chevron or ArrowRight. */
  readonly nodeExpand   = output<TreeNode>();
  /** Fires with the node when an expanded parent is collapsed, by its chevron or ArrowLeft. */
  readonly nodeCollapse = output<TreeNode>();
  /** Fires with the node when it becomes selected by click or Enter/Space; never fires while `selectable` is false. */
  readonly nodeSelect   = output<TreeNode>();
  /** The host should re-run the failed load. */
  readonly retry        = output<void>();

  /**
   * Expanded node ids. Two-way bindable, so an expansion state loaded from the
   * server — or restored from a URL — survives a reload.
   */
  readonly expandedIds = model<Set<string>>(new Set());
  /** The selected node id. Two-way bindable. */
  readonly selectedId  = model<string | null>(null);
  /** The treeitem currently in the tab order (roving tabindex). */
  readonly activeId    = signal<string | null>(null);

  private readonly _nodes = signal<TreeNode[]>([]);
  private readonly _warnedBindings = new Set<string>();
  private readonly host   = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Injected, not the global: this runs during SSR, where there is no `document`. */
  private readonly _doc = inject(DOCUMENT);

  readonly visibleNodes = computed<FlatNode[]>(() => {
    const rows = this._flatten(this._nodes(), 0, this.expandedIds());
    // `TreeNode.id` is required by the type, but the type cannot require it to be
    // UNIQUE, and a tree is where duplicates are easiest to introduce: ids unique
    // among their own siblings collide the moment two branches are flattened into
    // one `@for`. Angular answers that with NG0955 and an empty tree.
    warnOnDuplicateItemKeys(rows, (n) => n.node.id, 'sv-tree-view [nodes]');
    return rows;
  });

  /** Applied only on the first non-empty node set — after that the user owns it. */
  private _seededFromNodes = false;

  constructor() {
    // `nodes` used to be read once in ngOnInit, so a host that fetched the tree
    // asynchronously and bound the result saw an empty component forever.
    effect(() => {
      // ★ Cut before anything walks it. `_flatten` and `_collectExpanded` both
      //   recurse into `children` unconditionally, so a cycle in the host's data
      //   — the ordinary result of building `children` from a `parentId` map —
      //   recursed until the stack ended and took the tab with it.
      const incoming = svCutHierarchyCycles(this.nodes(), 'sv-tree-view').nodes as TreeNode[];
      // `X-12`: the host may delete the node that holds focus. Note where it
      // was BEFORE the new set renders, so focus can go to its successor.
      const focusedRow = untracked(() => this._focusedRowSnapshot());
      this._nodes.set(incoming);
      if (focusedRow) this._recoverAfterNodesChange(focusedRow);
      if (this._seededFromNodes || incoming.length === 0) return;
      this._seededFromNodes = true;
      const ids = new Set<string>();
      this._collectExpanded(incoming, ids);
      // `node.expanded` seeds this only when nobody else has: `expandedIds` is a
      // `model`, so a host may have bound a restored view, and the flags must not
      // win on first render only to lose on the next write.
      if (ids.size && untracked(this.expandedIds).size === 0) {
        this.expandedIds.set(ids);
      }
      // Seed the roving tabindex on the first node so the tree is tab-reachable.
      // ★ UNREACHABLE BRANCH — the `?? null` right operand can never be taken.
      // The guard four lines up already returned for `incoming.length === 0`,
      // `_nodes` was set to `incoming` synchronously above, and `_flatten` of a
      // non-empty list always yields at least one row — so `[0]` is defined and
      // the `?.` never short-circuits. Kept because the expression is what
      // makes the `activeId` type honest; counted as unreachable, not uncovered.
      this.activeId.set(this.visibleNodes()[0]?.node.id ?? null);
    });

    // `X-10`: a tree renders every visible row. Past the documented ceiling,
    // say so once in dev mode.
    effect(() => svWarnUnvirtualizedCeiling('sv-tree-view', this.visibleNodes().length, false));

    effect(() => this._warnIgnoredBindings());
  }

  /** Dev-mode only, once per instance: bindings the tree cannot act on. */
  private _warnIgnoredBindings(): void {
    if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
    // An unnamed tree: two of them side by side both announce as "tree", and a
    // listener cannot tell the folder pane from the permissions pane.
    if (
      !this.ariaLabel().trim() &&
      !this.host.nativeElement.hasAttribute('aria-labelledby') &&
      !this._warnedBindings.has('no-name')
    ) {
      this._warnedBindings.add('no-name');
      console.warn(
        '[styloviz] sv-tree-view: the tree has no accessible name — [ariaLabel] is ' +
          'empty and the host has no aria-labelledby, so a screen reader announces only ' +
          '"tree". Pass [ariaLabel]="\'Project files\'" (or similar).',
      );
    }
  }

  // ── Focus after the host mutates `nodes` (X-12) ─────────────────────────────

  /** The row holding DOM focus, and its index among the visible rows — or null. */
  private _focusedRowSnapshot(): { readonly id: string; readonly index: number } | null {
    const active = this._doc.activeElement as HTMLElement | null;
    if (!active || !this.host.nativeElement.contains(active)) return null;
    const id = (active.closest('[data-tree-id]') as HTMLElement | null)?.dataset['treeId'];
    if (id === undefined) return null;
    return { id, index: this.visibleNodes().findIndex(fn => fn.node.id === id) };
  }

  /**
   * The kit's mutation rule (`svSuccessorIndex`): when a new `nodes` set drops
   * the focused row, focus the row now at its index, else the one before it,
   * else the tree itself — never `<body>`. Runs after the render, the only
   * point at which the successor row exists.
   */
  private _recoverAfterNodesChange(was: { readonly id: string; readonly index: number }): void {
    setTimeout(() => {
      const list = this.visibleNodes();
      if (list.some(fn => fn.node.id === was.id)) return;
      const next = list[svSuccessorIndex(was.index, list.length)];
      if (next) this.setActive(next.node.id);
      const root = this.host.nativeElement;
      const successor = next ? root.querySelector<HTMLElement>(svAttrSelector('data-tree-id', next.node.id)) : null;
      // The roving tab stop moves with focus; the binding catches up on the
      // next render, and focus cannot wait for it.
      if (successor && !next?.node.disabled) successor.tabIndex = 0;
      svRecoverFocus({
        to: [successor],
        fallback: root.querySelector('[role="tree"]'),
      });
    }, 0);
  }

  toggle(node: TreeNode): void {
    if (node.disabled) return;
    const ids = new Set(this.expandedIds());
    const collapsing = ids.has(node.id);
    if (collapsing) ids.delete(node.id);
    else ids.add(node.id);
    this.expandedIds.set(ids);

    // Collapsing hides every descendant, including the one that may hold focus.
    // The WAI-ARIA tree pattern puts focus on the parent that was collapsed.
    if (collapsing) this._repairFocus(node.id);

    if (collapsing) this.nodeCollapse.emit(node);
    else this.nodeExpand.emit(node);
  }

  /**
   * Put DOM focus back on a rendered row after a collapse removed the one that
   * had it, preferring `preferredId`.
   *
   * ★ Acts only when the row that actually holds focus has left the render.
   *   Collapsing by clicking a chevron leaves focus on that chevron, whose row is
   *   still there, and moving it would put a focus ring on screen for a mouse
   *   user who never asked for one.
   */
  private _repairFocus(preferredId: string): void {
    const active = this._doc.activeElement;
    if (!active || !this.host.nativeElement.contains(active)) return;

    const row = (active as HTMLElement).closest('[data-tree-id]') as HTMLElement | null;
    const activeRowId = row?.dataset['treeId'] ?? null;
    if (activeRowId === null) return;

    const list = this.visibleNodes();
    if (list.some(fn => fn.node.id === activeRowId)) return;

    const target = list.some(fn => fn.node.id === preferredId)
      ? preferredId
      : this._tabStopId();
    if (target) this._focus(target);
  }

  /** One entry per ancestor level, for the indentation spacers. */
  depthArray(depth: number): number[] {
    return Array.from({ length: depth }, (_, i) => i);
  }

  select(node: TreeNode, depth: number): void {
    if (node.disabled || !this.selectable()) return;
    this.selectedId.set(node.id);
    this.nodeSelect.emit(node);
    this.nodeClick.emit({ node, depth });
  }

  isSelected(id: string): boolean { return this.selectedId() === id; }

  // ── Keyboard navigation (WAI-ARIA tree) ─────────────────────────────────────

  /**
   * The treeitem that holds the tab stop.
   *
   * ★★★ THE ACTIVE NODE IS NOT ALWAYS STILL RENDERED, and the `??` above could
   *     not see that: it falls back when `activeId` is null, not when `activeId`
   *     names a row that has gone. Collapsing a parent while a descendant was
   *     active left every row at −1 — a fully populated tree that Tab could not
   *     enter, and no arrow key could rescue it because arrows need focus inside
   *     the tree first.
   */
  private readonly _tabStopId = computed<string | null>(() => {
    const list = this.visibleNodes();
    const active = this.activeId();
    if (active !== null && list.some(fn => fn.node.id === active)) return active;
    return list[0]?.node.id ?? null;
  });

  treeTabIndex(id: string): number {
    return id === this._tabStopId() ? 0 : -1;
  }

  setActive(id: string): void { this.activeId.set(id); }

  /**
   * Arrow / Home / End / Enter / Space handling per the WAI-ARIA tree pattern.
   * Arrow Up/Down move between visible rows; Right expands or steps into a
   * child; Left collapses or steps to the parent; Enter/Space selects.
   */
  onKeydown(event: KeyboardEvent, fn: FlatNode, index: number): void {
    const list = this.visibleNodes();
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); this._focusStep(list, index, +1); break;
      case 'ArrowUp':   event.preventDefault(); this._focusStep(list, index, -1); break;
      case 'Home':      event.preventDefault(); this._focusFrom(list, 0, +1); break;
      case 'End':       event.preventDefault(); this._focusFrom(list, list.length - 1, -1); break;
      case 'PageDown':
      case 'PageUp': {
        // `X-10`: a page of rows, clamped at the ends — never wrapped. Lands on
        // the nearest enabled row in the direction of travel.
        event.preventDefault();
        const next = svCollectionTarget(event.key, list.length, index, { pageSize: 10 }) ?? index;
        const dir = event.key === 'PageDown' ? 1 : -1;
        if (list[next]?.node.disabled) this._focusFrom(list, next, dir);
        else if (list[next]) this._focus(list[next].node.id);
        break;
      }
      case 'ArrowRight':
        event.preventDefault();
        if (fn.hasChildren && !fn.isExpanded)      { this.toggle(fn.node); }
        else if (fn.hasChildren && fn.isExpanded)  { this._focusStep(list, index, +1); }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (fn.hasChildren && fn.isExpanded) { this.toggle(fn.node); }
        else                                 { this._focusParent(list, index, fn.depth); }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.select(fn.node, fn.depth);
        this.setActive(fn.node.id);
        break;
      default:
        this._typeahead(event, list, index);
        return;
    }
  }

  /** `X-10` typeahead over visible, enabled rows — type "re" to reach "Reports". */
  private readonly _typeaheadBuffer = createTypeahead<FlatNode>({ labelOf: fn => fn.node.label });

  private _typeahead(event: KeyboardEvent, list: readonly FlatNode[], index: number): void {
    if (!svIsTypeaheadKey(event)) return;
    const enabled = list.filter(fn => !fn.node.disabled);
    const current = enabled.findIndex(fn => fn.node.id === list[index]?.node.id);
    const next = this._typeaheadBuffer.handle(event.key, enabled, current);
    if (next === null) return;
    event.preventDefault();
    this._focus(enabled[next].node.id);
  }

  /** Move focus by `dir` steps from `from`, skipping disabled rows. */
  private _focusStep(list: readonly FlatNode[], from: number, dir: 1 | -1): void {
    for (let i = from + dir; i >= 0 && i < list.length; i += dir) {
      if (!list[i].node.disabled) { this._focus(list[i].node.id); return; }
    }
  }

  /** From `start`, find the first enabled row in direction `dir` and focus it. */
  private _focusFrom(list: readonly FlatNode[], start: number, dir: 1 | -1): void {
    for (let i = start; i >= 0 && i < list.length; i += dir) {
      if (!list[i].node.disabled) { this._focus(list[i].node.id); return; }
    }
  }

  /** Focus the parent row (nearest previous row with a smaller depth). */
  private _focusParent(list: readonly FlatNode[], index: number, depth: number): void {
    for (let i = index - 1; i >= 0; i--) {
      if (list[i].depth < depth) { this._focus(list[i].node.id); return; }
    }
  }

  /**
   * Set the active id and move DOM focus to that row once the view has caught
   * up with the signals.
   *
   * ★★ A MICROTASK IS TOO EARLY (DD-45-I3, matching the Pro twin's `_focusRow`).
   *    Change detection is itself scheduled from the same event handler, so a
   *    `queueMicrotask` ran BEFORE the re-render: a row that the keystroke's own
   *    state change was about to render was not in the DOM yet, and the focus
   *    call found nothing, leaving the user on whatever they had before. A
   *    macrotask lands after the render, the only point at which the element
   *    that will keep focus is the one on screen.
   */
  private _focus(id: string): void {
    this.setActive(id);
    setTimeout(() => {
      const rows = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-tree-id]');
      rows.forEach(el => { if (el.dataset['treeId'] === id) el.focus(); });
    }, 0);
  }

  /**
   * ★ Appends into one accumulator rather than splicing each level in with
   *   `push(...children)`. A spread call passes one argument per element, so a
   *   branch with more visible descendants than the engine's argument cap —
   *   ~65k in JavaScriptCore, ~124k in V8 — threw `RangeError` and took the
   *   render with it. A demo fixture never gets there; a real folder tree does.
   */
  private _flatten(nodes: TreeNode[], depth: number, expanded: Set<string>): FlatNode[] {
    const out: FlatNode[] = [];
    this._flattenInto(out, nodes, depth, expanded);
    return out;
  }

  private _flattenInto(out: FlatNode[], nodes: TreeNode[], depth: number, expanded: Set<string>): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const hasChildren = !!node.children?.length;
      const isExp = expanded.has(node.id);
      out.push({ node, depth, isLast: i === nodes.length - 1, hasChildren, isExpanded: isExp });
      if (isExp && node.children?.length) {
        this._flattenInto(out, node.children, depth + 1, expanded);
      }
    }
  }

  private _collectExpanded(nodes: TreeNode[], ids: Set<string>): void {
    for (const n of nodes) {
      if (n.expanded) ids.add(n.id);
      if (n.children) this._collectExpanded(n.children, ids);
    }
  }
}
