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
  type TemplateRef,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import {
  createTypeahead,
  svCollectionTarget,
  svIsRtl,
  svIsTypeaheadKey,
  svWarnUnvirtualizedCeiling,
} from '@styloviz/core/a11y';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  svCutHierarchyCycles,
  warnOnDuplicateItemKeys,
  type SvDataError,
} from '@styloviz/core/data';
import { svWarn } from '@styloviz/core/dev';
import { injectSvLabels, SvLabelPipe } from '@styloviz/core/i18n';
import { svRecoverFocus, svSuccessorIndex } from '@styloviz/core/overlay';
import { svAttrSelector } from '@styloviz/core/security';
import { SV_TREE_VIEW_LABELS } from './tree-view.labels';

import { registerTreeViewIcons } from './tree-view.component.icons';
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
  /** Second line under the label in the `org` layout — a job title, say. Same name as on `sv-tree-view-pro`. */
  readonly role?: string;
  /** Soft chip on the box in the `org` layout. Same name as on `sv-tree-view-pro`. */
  readonly department?: string;
}

/**
 * How the tree is drawn.
 *
 * - `list` — indented rows, one under another (the default).
 * - `org`  — top-down boxes: each parent centred over its children, joined by
 *            orthogonal connector lines, scrolling sideways when the chart is
 *            wider than its container.
 */
export type TreeViewLayout = 'list' | 'org';

export interface FlatNode {
  readonly node: TreeNode;
  readonly depth: number;
  readonly isLast: boolean;
  readonly hasChildren: boolean;
  readonly isExpanded: boolean;
}

/**
 * What an `iconTemplate` is stamped with, once per row of the `list` layout.
 *
 * `$implicit` is the node, so `let-node` reads it; `expanded` and `depth` are the
 * row's state — a folder glyph that opens when its branch does needs the first.
 */
export interface TreeIconContext {
  readonly $implicit: TreeNode;
  readonly expanded: boolean;
  readonly depth: number;
}

export interface TreeNodeClickEvent {
  readonly node: TreeNode;
  readonly depth: number;
}

/**
 * One box of the `org` layout: a visible row, re-nested under its parent.
 *
 * `index` is the row's position in `visibleNodes()` — the flat order the
 * keyboard engine walks — and `posinset` / `setsize` its place among its
 * siblings, published as `aria-posinset` / `aria-setsize`.
 */
export interface TreeOrgBox {
  readonly fn: FlatNode;
  readonly index: number;
  readonly posinset: number;
  readonly setsize: number;
  readonly children: readonly TreeOrgBox[];
}

/**
 * Re-nest the visible rows for the `org` layout.
 *
 * ★ Built FROM `visibleNodes()`, never from `nodes` directly, so the org chart
 *   cannot disagree with the keyboard engine about which boxes exist: a collapsed
 *   branch is absent from both, and ArrowDown from a box lands on the box this
 *   nesting put next. One pass, no recursion — the depth stack holds the latest
 *   box seen at each level, which is the parent of anything one level deeper.
 */
function nestForOrg(rows: readonly FlatNode[]): TreeOrgBox[] {
  interface Draft { fn: FlatNode; index: number; posinset: number; setsize: number; children: Draft[] }
  const roots: Draft[] = [];
  const groups: Draft[][] = [roots];
  const open: Draft[] = [];
  rows.forEach((fn, index) => {
    const box: Draft = { fn, index, posinset: 0, setsize: 0, children: [] };
    groups.push(box.children);
    const siblings = fn.depth > 0 && open[fn.depth - 1] ? open[fn.depth - 1].children : roots;
    siblings.push(box);
    box.posinset = siblings.length;
    open[fn.depth] = box;
    open.length = fn.depth + 1;
  });
  for (const group of groups) for (const box of group) box.setsize = group.length;
  return roots;
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
  imports: [NgTemplateOutlet, SvIconComponent, SvSkeletonShellComponent, SvErrorShellComponent, SvEmptyShellComponent, SvLabelPipe],
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
        [title]="labels.errorTitle"
        (retry)="retry.emit()"
        data-sv-state="error"
      />
    } @else if (layout() === 'org') {
      @if (!visibleNodes().length) {
        <sv-empty-shell reason="no-data" [title]="emptyText()" data-sv-state="empty" />
      } @else {
        <!--
          The org layout. A wide chart scrolls sideways inside this labelled
          region, never the page; on paper the region lets go and the whole
          chart prints. The tree inside is the SAME tree as the list layout:
          role tree, treeitem and group, one tab stop, one keyboard engine.
        -->
        <div class="sv-tree-view-org overflow-x-auto rounded-xl outline-none
                    focus-visible:ring-2 focus-visible:ring-brandaccent-400 print:overflow-visible"
             role="region"
             tabindex="0"
             data-sv-tree-layout="org"
             [attr.aria-label]="ariaLabel().trim() || labels.orgChart">
          <ul class="flex w-max min-w-full select-none items-start justify-center gap-8 p-4"
              role="tree"
              [attr.aria-label]="ariaLabel().trim() || null">
            @for (box of orgBoxes(); track box.fn.node.id) {
              <ng-container [ngTemplateOutlet]="orgBranch" [ngTemplateOutletContext]="{ $implicit: box }" />
            }
          </ul>
        </div>
      }
    } @else {

    <!-- A tree must own a treeitem (axe aria-required-children, critical), so
         with no rows it is a named group around the empty shell (FL-A8-03). -->
    <div class="sv-tree-view select-none" [attr.role]="visibleNodes().length ? 'tree' : 'group'"
         [attr.aria-label]="ariaLabel().trim() || null" data-sv-tree-root>
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
                <!-- sv-physical: centring — the guide line is centred in its indent cell -->
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
                  class="sv-target flex h-5 w-5 shrink-0 items-center justify-center rounded
                         text-gray-400 transition-all hover:text-gray-700 dark:hover:text-gray-200
                         focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brandaccent-400"
                  [class.invisible]="!fn.hasChildren"
                  (click)="toggle(fn.node); $event.stopPropagation()"
                  [attr.aria-label]="(fn.isExpanded ? labels.collapseNode : labels.expandNode) | svLabel: { name: fn.node.label }">
            <sv-icon name="chevron-right"
                     [cssClass]="'h-3.5 w-3.5 transition-transform duration-150 rtl:-scale-x-100' + (fn.isExpanded ? ' rotate-90 rtl:-rotate-90' : '')"
                     [strokeWidth]="2" />
          </button>

          <!-- Icon: the host's template when given (a glyph per node), else the text icon. -->
          @if (iconTemplate(); as iconTpl) {
            <span class="flex shrink-0 items-center" aria-hidden="true" data-sv-tree-icon>
              <ng-container [ngTemplateOutlet]="iconTpl"
                            [ngTemplateOutletContext]="{ $implicit: fn.node, expanded: fn.isExpanded, depth: fn.depth }" />
            </span>
          } @else if (fn.node.icon) {
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
            <span class="ms-auto shrink-0 rounded-full bg-gray-100 px-1.5 py-px
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

    <!--
      One box of the org layout, and its subtree. The treeitem is the li, so
      its group of children sits INSIDE it as the pattern requires; its name is
      set explicitly, because a name taken from content would read out every
      descendant below it.

      Connectors are CSS borders on two half-width spans across the top of each
      child: the start half carries the bar from the previous sibling, the end
      half the bar to the next one plus the drop into this box. First and last
      children leave off the outer half, an only child keeps just the drop.
      Logical sides throughout, so RTL mirrors with no extra rule.
    -->
    <ng-template #orgBranch let-box>
      @let b = orgBox(box);
      <li class="relative flex flex-col items-center px-2 outline-none
                 [&:focus-visible>.sv-org-card]:ring-2 [&:focus-visible>.sv-org-card]:ring-brandaccent-400"
          [class.pt-6]="b.fn.depth > 0"
          [class.pb-3]="b.fn.hasChildren && !b.fn.isExpanded"
          role="treeitem"
          [attr.data-tree-id]="b.fn.node.id"
          [attr.tabindex]="treeTabIndex(b.fn.node.id)"
          [attr.aria-label]="orgItemLabel(b.fn.node)"
          [attr.aria-level]="b.fn.depth + 1"
          [attr.aria-setsize]="b.setsize"
          [attr.aria-posinset]="b.posinset"
          [attr.aria-expanded]="b.fn.hasChildren ? b.fn.isExpanded : null"
          [attr.aria-selected]="selectable() ? isSelected(b.fn.node.id) : null"
          [attr.aria-disabled]="b.fn.node.disabled || null"
          (click)="onOrgClick($event, b)"
          (keydown)="onOrgKeydown($event, b)">

        @if (b.fn.depth > 0) {
          <span class="pointer-events-none absolute inset-x-0 top-0 h-6" aria-hidden="true" data-sv-org-connector>
            <span class="absolute start-0 top-0 h-full w-1/2 border-gray-300 dark:border-gray-600"
                  [class.border-t]="b.posinset > 1"
                  [class.border-e]="b.setsize > 1 && b.posinset === b.setsize"
                  [class.rounded-se-lg]="b.setsize > 1 && b.posinset === b.setsize"></span>
            <span class="absolute end-0 top-0 h-full w-1/2 border-gray-300 dark:border-gray-600"
                  [class.border-t]="b.posinset < b.setsize"
                  [class.border-s]="b.posinset < b.setsize || b.setsize === 1"
                  [class.rounded-ss-lg]="b.posinset === 1 && b.setsize > 1"></span>
          </span>
        }

        <div class="sv-org-card relative w-52 rounded-xl border px-3 py-2.5 text-start shadow-sm
                    transition-colors duration-100 print:break-inside-avoid print:shadow-none"
             [class]="b.fn.node.disabled
                        ? 'cursor-not-allowed border-gray-200 bg-white opacity-40 dark:border-gray-700 dark:bg-gray-900'
                        : isSelected(b.fn.node.id)
                            ? 'cursor-pointer border-brandaccent-400 bg-brandaccent-50 dark:border-brandaccent-500 dark:bg-brandaccent-950'
                            : 'cursor-pointer border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600'"
             data-sv-org-card>
          <div class="flex items-center gap-2.5">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brandaccent-100
                         text-xs font-bold text-brandaccent-700 dark:bg-brandaccent-900/40 dark:text-brandaccent-200"
                  aria-hidden="true">{{ b.fn.node.icon || orgInitials(b.fn.node.label) }}</span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-[13px] font-semibold leading-tight"
                    [class]="isSelected(b.fn.node.id)
                               ? 'text-brandaccent-700 dark:text-brandaccent-300'
                               : 'text-gray-900 dark:text-gray-100'">{{ b.fn.node.label }}</span>
              @if (b.fn.node.role) {
                <span class="truncate text-[11px] leading-tight text-gray-500 dark:text-gray-400">{{ b.fn.node.role }}</span>
              }
            </span>
          </div>
          @if (b.fn.node.department || b.fn.node.badge) {
            <span class="mt-2 flex items-center gap-1.5">
              @if (b.fn.node.department) {
                <span class="truncate rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium
                             text-gray-600 dark:bg-gray-800 dark:text-gray-300">{{ b.fn.node.department }}</span>
              }
              @if (b.fn.node.badge) {
                <span class="ms-auto shrink-0 rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-semibold
                             text-gray-600 dark:bg-gray-800 dark:text-gray-300">{{ b.fn.node.badge }}</span>
              }
            </span>
          }

          <!-- Out of the tab order like the list chevron: ArrowRight and
               ArrowLeft on the box expand and collapse it. Collapsed, it says
               how many boxes are folded away under it. -->
          @if (b.fn.hasChildren) {
            <span class="absolute inset-x-0 -bottom-3 flex justify-center">
              <button type="button"
                      tabindex="-1"
                      class="sv-target flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full border
                             border-gray-300 bg-white px-1.5 text-[10px] font-semibold text-gray-600 shadow-sm
                             transition-colors hover:border-brandaccent-400 hover:text-brandaccent-700
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandaccent-400
                             dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300
                             dark:hover:border-brandaccent-400 dark:hover:text-brandaccent-300 print:hidden"
                      data-sv-org-toggle
                      (click)="toggle(b.fn.node); setActive(b.fn.node.id); $event.stopPropagation()"
                      [attr.aria-label]="(b.fn.isExpanded ? labels.collapseNode : labels.expandNode) | svLabel: { name: b.fn.node.label }">
                @if (!b.fn.isExpanded) {
                  <span aria-hidden="true">{{ b.fn.node.children?.length }}</span>
                }
                <sv-icon name="chevron-right"
                         [cssClass]="'h-3 w-3 transition-transform duration-150 ' + (b.fn.isExpanded ? '-rotate-90' : 'rotate-90')"
                         [strokeWidth]="2.5" />
              </button>
            </span>
          }
        </div>

        @if (b.children.length) {
          <span class="h-6 w-px shrink-0 bg-gray-300 dark:bg-gray-600" aria-hidden="true" data-sv-org-stem></span>
          <ul class="flex items-start justify-center" role="group">
            @for (child of b.children; track child.fn.node.id) {
              <ng-container [ngTemplateOutlet]="orgBranch" [ngTemplateOutletContext]="{ $implicit: child }" />
            }
          </ul>
        }
      </li>
    </ng-template>
  `,
})
export class SvTreeViewComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerTreeViewIcons();

  /** @internal Accessible names — English unless `provideSvLabels({ treeView })` says otherwise. */
  protected readonly labels = injectSvLabels('treeView', SV_TREE_VIEW_LABELS);

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
  /**
   * Show vertical connector guide lines in the `list` layout. The `org` layout
   * always draws its connectors — they are what make it a chart.
   * @default true
   */
  readonly showLines  = input<boolean>(true);
  /**
   * How the tree is drawn: `list` (indented rows) or `org` (top-down boxes joined
   * by connector lines, each parent centred over its children). Same tree, same
   * keyboard model, same outputs — only the picture changes. `org` shows each
   * node's `role` and `department` and scrolls sideways inside a labelled region
   * when it is wider than its container.
   * @default 'list'
   */
  readonly layout     = input<TreeViewLayout>('list');
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

  /**
   * A template for the glyph before each label in the `list` layout, drawn in
   * place of the text `icon`. Stamped with {@link TreeIconContext} — the node as
   * `$implicit`, plus `expanded` and `depth` — so a host can draw an icon-library
   * glyph per node (`sv-file-tree` draws a file-type glyph this way). Decorative:
   * the row's name is its label. The `org` layout keeps its initials avatar.
   * Same input on `sv-tree-view-pro`.
   * @default null
   */
  readonly iconTemplate = input<TemplateRef<TreeIconContext> | null>(null);

  /** Copy for the empty state. @default 'No items to display' */
  readonly emptyText = input<string>(this.labels.emptyText);

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

  /** The visible rows re-nested as boxes, for the `org` layout only. */
  protected readonly orgBoxes = computed<readonly TreeOrgBox[]>(() =>
    this.layout() === 'org' ? nestForOrg(this.visibleNodes()) : [],
  );

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
      svWarn(
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
        // By hook, not role: an emptied list is a `group`, not a `tree`.
        fallback: root.querySelector('[data-sv-tree-root], [role="tree"]'),
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

  // ── The org layout ──────────────────────────────────────────────────────────

  /** Types the recursive template's context, which Angular hands over untyped. */
  protected orgBox(box: TreeOrgBox): TreeOrgBox { return box; }

  /** A box's accessible name: what it shows, in reading order. */
  protected orgItemLabel(node: TreeNode): string {
    return [node.label, node.role, node.department, node.badge].filter(Boolean).join(', ');
  }

  /** Up to two initials for a box with no `icon`. */
  protected orgInitials(label: string): string {
    const parts = label.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
  }

  /**
   * Keys in the `org` layout — handed straight to `onKeydown`, the list's engine.
   *
   * ★★ THE VISUAL DIRECTION DIFFERS; THE TREE MODEL DOES NOT. Children sit BELOW
   *    their parent here and siblings sit side by side, but the keys keep the
   *    WAI-ARIA tree meanings: ArrowDown / ArrowUp walk the visible boxes in tree
   *    order (depth first), ArrowRight opens a box or steps to its first child,
   *    ArrowLeft closes it or climbs to its parent, Home / End / typeahead as in
   *    the list. Inventing a 2-D grid would give a screen-reader user, who hears
   *    "tree", keys that do something other than what the role promised.
   *
   * ★ Treeitems NEST in this layout, so a key pressed on a child box bubbles
   *   through every ancestor's handler. Only the box that owns the focused
   *   element answers.
   */
  protected onOrgKeydown(event: KeyboardEvent, box: TreeOrgBox): void {
    if (!this._ownsOrgEvent(event)) return;
    this.onKeydown(event, box.fn, box.index);
  }

  /**
   * A click on a box's card selects it — the innermost box only, for the same
   * reason, and only on the card: the treeitem also spans the whitespace around
   * its subtree, and a click there is not a choice of the manager above it.
   */
  protected onOrgClick(event: MouseEvent, box: TreeOrgBox): void {
    if (!this._ownsOrgEvent(event) || !(event.target as HTMLElement).closest('[data-sv-org-card]')) return;
    this.select(box.fn.node, box.fn.depth);
    this.setActive(box.fn.node.id);
  }

  /** Whether the treeitem this handler sits on is the innermost one around the event's target. */
  private _ownsOrgEvent(event: Event): boolean {
    const target = event.target as HTMLElement | null;
    return target?.closest('[role="treeitem"]') === event.currentTarget;
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
    switch (this._inlineArrow(event.key)) {
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

  /**
   * `ArrowLeft`/`ArrowRight` as the tree reads them. Under dir="rtl" the
   * indentation spacers push children to the LEFT, so the APG treeview swaps
   * the pair: ArrowLeft opens a branch, ArrowRight closes it (FL-B9).
   */
  private _inlineArrow(key: string): string {
    if ((key !== 'ArrowLeft' && key !== 'ArrowRight') || !svIsRtl(this.host.nativeElement)) return key;
    return key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
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
