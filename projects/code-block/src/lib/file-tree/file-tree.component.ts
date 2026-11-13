import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import { SvIconComponent } from '@styloviz/icons/core';
import { SvTreeViewComponent, type TreeNode } from '@styloviz/tree-view';
import { type SvDataError } from '@styloviz/core/data';
import { injectSvLabels, svLocale } from '@styloviz/core/i18n';
import { SV_CODE_BLOCK_LABELS } from '../code-block.labels';
import { svFileIconClass, svFileIconName } from './file-tree.icons-map';

import { registerFileTreeIcons } from './file-tree.component.icons';

/** One file or folder. */
export interface SvFileNode {
  /** Unique across the whole tree — it is the tree's identity and the selection value. */
  readonly id: string;
  /** The file or folder name, e.g. `app.component.ts`. Drives the icon. */
  readonly name: string;
  /**
   * `folder` or `file`. Optional: a node with `children` is a folder. Set it
   * for an EMPTY folder (or one whose children are not loaded), which would
   * otherwise read as a file.
   */
  readonly kind?: 'file' | 'folder';
  readonly children?: readonly SvFileNode[];
  /** Start expanded. Seeds `expandedIds` only when nothing else has. */
  readonly expanded?: boolean;
  readonly disabled?: boolean;
  /** A short chip after the name — a git status (`M`, `A`), a count. */
  readonly badge?: string;
}

/** How siblings are ordered. */
export type SvFileTreeSort = 'folders-first' | 'none';

/**
 * ============================================================
 *  SvFileTreeComponent — a project's files
 * ============================================================
 *  Install: npm install @styloviz/code-block @styloviz/tree-view
 *
 *  Files and folders with a glyph chosen from each name (folders, TypeScript,
 *  images, archives, spreadsheets, lockfiles, `package.json`, Dockerfiles…),
 *  folders sorted first, expand / collapse, single selection and the full
 *  WAI-ARIA tree keyboard.
 *
 *  ★★★ IT IS `sv-tree-view` WITH FILE ICONS, NOT A SECOND TREE. Roles,
 *      roving tabindex, arrow keys, type-ahead, focus recovery when a node is
 *      removed, the loading / error / empty states — all of it is
 *      `sv-tree-view`'s engine, specified and tested once (docs/ADR-aria.md,
 *      rule 2). This component maps files to tree nodes and hands the tree an
 *      icon template; it owns no keyboard code of its own.
 *
 *  ★ Every glyph is from the free icon set and decorative — a row is named by
 *    its file name, and "folder" is said by `aria-expanded`.
 *
 *  Usage:
 *
 *    <sv-file-tree [nodes]="files" ariaLabel="Project files" (fileOpen)="open($event)" />
 * ============================================================
 */
@Component({
  selector: 'sv-file-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvTreeViewComponent, SvIconComponent],
  templateUrl: './file-tree.component.html',
})
export class SvFileTreeComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerFileTreeIcons();
  protected readonly labels = injectSvLabels('codeBlock', SV_CODE_BLOCK_LABELS);

  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** The files and folders, nested through `children`. @default [] */
  readonly nodes = input<readonly SvFileNode[]>([]);

  /** What this tree is, e.g. `'Project files'` — names the `role="tree"`. @default 'Files' */
  readonly ariaLabel = input<string>(this.labels.fileTreeLabel);

  /** True while the tree is being fetched. Shows a placeholder instead. @default false */
  readonly loading = input<boolean>(false);

  /** Load failure — shows an error with a retry button. @default null */
  readonly error = input<SvDataError | string | null>(null);

  /** Copy for the empty tree. @default 'No files' */
  readonly emptyText = input<string>(this.labels.fileTreeEmpty);

  /** Allow selecting a node (click, Enter or Space). @default true */
  readonly selectable = input<boolean>(true);

  /** Draw the indentation guide lines. @default true */
  readonly showLines = input<boolean>(true);

  /** `folders-first` (A→Z, numbers in numeric order) or `none` to keep the order given. @default 'folders-first' */
  readonly sort = input<SvFileTreeSort>('folders-first');

  /** Locale whose collation orders the names (`sort="folders-first"`). @default svLocale() */
  readonly locale = input<string>(svLocale());

  /**
   * Choose the glyph yourself. Return the name of an icon registered with
   * `provideSvIcons` (or one `svFileIconName` returns). `null` uses
   * `svFileIconName`. @default null
   */
  readonly iconFor = input<((node: SvFileNode) => string) | null>(null);

  /** Expanded folder ids. Two-way bindable, so a host can restore the view. @default new Set() */
  readonly expandedIds = model<Set<string>>(new Set());

  /** The selected node id. Two-way bindable. @default null */
  readonly selectedId = model<string | null>(null);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** A file or folder was selected by click, Enter or Space. */
  readonly nodeSelect = output<SvFileNode>();

  /** A FILE (not a folder) was activated — open it. */
  readonly fileOpen = output<SvFileNode>();

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  // ── Derived ─────────────────────────────────────────────────────────────────

  private readonly collator = computed(
    () => new Intl.Collator(this.locale(), { numeric: true, sensitivity: 'base' }),
  );

  /** Every node by id — the tree hands back `TreeNode`s; this finds the file. */
  private readonly byId = computed(() => {
    const map = new Map<string, SvFileNode>();
    const walk = (list: readonly SvFileNode[]): void => {
      for (const n of list) {
        map.set(n.id, n);
        if (n.children) walk(n.children);
      }
    };
    walk(this.nodes());
    return map;
  });

  /** The files as tree nodes, sorted. */
  protected readonly treeNodes = computed<TreeNode[]>(() => {
    const sort = this.sort();
    const collator = this.collator();
    const convert = (list: readonly SvFileNode[]): TreeNode[] => {
      const ordered = sort === 'none' ? list : [...list].sort((a, b) => compareFiles(a, b, collator));
      return ordered.map((n) => ({
        id: n.id,
        label: n.name,
        expanded: n.expanded,
        disabled: n.disabled,
        badge: n.badge,
        children: kindOf(n) === 'folder' ? convert(n.children ?? []) : undefined,
      }));
    };
    return convert(this.nodes());
  });

  // ── Template helpers ────────────────────────────────────────────────────────

  protected iconName(id: string): string {
    const node = this.byId().get(id);
    if (!node) return 'file';
    return this.iconFor()?.(node) ?? svFileIconName(node.name, kindOf(node));
  }

  protected iconClass(id: string): string {
    const node = this.byId().get(id);
    if (!node || this.iconFor()) return 'text-gray-500 dark:text-gray-400';
    return svFileIconClass(svFileIconName(node.name, kindOf(node)));
  }

  protected onSelect(tree: TreeNode): void {
    const node = this.byId().get(tree.id);
    if (!node) return;
    this.nodeSelect.emit(node);
    if (kindOf(node) === 'file') this.fileOpen.emit(node);
  }
}

/** A node is a folder when it says so or when it has children. */
function kindOf(node: SvFileNode): 'file' | 'folder' {
  return node.kind ?? (node.children ? 'folder' : 'file');
}

/** Folders before files, then by name in the collator's order. */
function compareFiles(a: SvFileNode, b: SvFileNode, collator: Intl.Collator): number {
  const ka = kindOf(a);
  const kb = kindOf(b);
  if (ka !== kb) return ka === 'folder' ? -1 : 1;
  return collator.compare(a.name, b.name);
}
