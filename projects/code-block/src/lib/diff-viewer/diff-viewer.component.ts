import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  model,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SvChevronsUpDownIcon } from '@styloviz/icons/glyph/chevrons-up-down';
import { svUniqueId } from '@styloviz/core/a11y';
import { injectSvLabels, svFormatLabel } from '@styloviz/core/i18n';
import { SV_CODE_BLOCK_LABELS } from '../code-block.labels';
import {
  svDiffSplitSections,
  svDiffViewItems,
  svLineDiff,
  svPairWordSegments,
  svParsePatch,
  type SvDiffGap,
  type SvDiffSplitSection,
  type SvDiffViewItem,
  type SvDiffViewRow,
  type SvLineDiffStatus,
} from './diff-viewer.logic';

/** How `sv-diff-viewer` lays the two versions out. */
export type SvDiffViewerView = 'unified' | 'split';

/** A row with everything the template shows worked out once (no calls in the `@for`). */
interface DrawRow extends SvDiffViewRow {
  readonly rowCls: string;
  readonly markCls: string;
  readonly glyph: string;
  /** "Added:" / "Removed:" for a screen reader; `''` on an unchanged line. */
  readonly sr: string;
  readonly changedCls: string;
}

/** A fold or gap with its button text worked out. */
interface DrawBreak {
  readonly type: 'fold' | 'gap';
  readonly id: string;
  readonly label: string;
}

type DrawItem = { readonly type: 'row'; readonly id: string; readonly row: DrawRow } | DrawBreak;

interface DrawPair {
  readonly id: string;
  readonly left: DrawRow | null;
  readonly right: DrawRow | null;
  readonly leftCls: string;
  readonly rightCls: string;
}

type DrawSection = { readonly type: 'rows'; readonly id: string; readonly rows: readonly DrawPair[] } | DrawBreak;

const PAD_CLS = 'bg-gray-50/60 dark:bg-gray-900/40';

/** What the viewer is showing, after the comparison has run. */
interface DiffModel {
  readonly rows: readonly SvDiffViewRow[];
  readonly gaps: readonly SvDiffGap[];
  readonly added: number;
  readonly removed: number;
  readonly identical: boolean;
  readonly status: SvLineDiffStatus | 'patch-invalid';
  readonly oldLineCount: number;
  readonly newLineCount: number;
  readonly lineEndingsDiffer: boolean;
  readonly moreFiles: boolean;
  readonly name: string | null;
}

/**
 * ============================================================
 *  SvDiffViewerComponent — compare two texts
 * ============================================================
 *  Install: npm install @styloviz/code-block
 *
 *  Give it two versions (`before` / `after`) or a unified patch (`patch`) and
 *  it shows what changed: unified or split, line numbers on both sides, long
 *  unchanged runs folded behind "Show N unchanged lines", and the words that
 *  changed inside a changed line highlighted.
 *
 *  ★★★ COLOUR IS NEVER THE ONLY SIGNAL. Every added line carries a visible `+`
 *      and every removed one a `−`, and a screen reader hears "Added:" or
 *      "Removed:" before the text; unchanged lines are left silent, because
 *      labelling the unchanged majority triples the reading for no fact.
 *
 *  ★★ IT SAYS WHEN IT DID NOT COMPARE. Past `maxLines` it shows a notice with
 *     both line counts instead of the diff, and when the texts are too
 *     different for a line-by-line comparison it says so above the full
 *     replacement it shows instead. A viewer that froze the tab, or quietly
 *     drew one giant delete, would be worse than one that tells you why.
 *
 *  ★ The comparison is `svLineDiff()` (exported), which adapts the kit's one
 *    diff engine — `svDiffLines` in `@styloviz/core` — to whole texts: CRLF
 *    and LF are treated as equal, and a missing final newline is a change.
 *
 *  Usage:
 *
 *    <sv-diff-viewer [before]="saved" [after]="draft" title="config.yaml" />
 *    <sv-diff-viewer [patch]="gitDiff" view="split" />
 * ============================================================
 */
@Component({
  selector: 'sv-diff-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, SvChevronsUpDownIcon],
  templateUrl: './diff-viewer.component.html',
})
export class SvDiffViewerComponent {
  protected readonly labels = injectSvLabels('codeBlock', SV_CODE_BLOCK_LABELS);
  private readonly uid = svUniqueId('sv-diff');

  // ── Inputs ──────────────────────────────────────────────────────────────────

  /** The original text, compared against `after`. Ignored while `patch` is set. @default '' */
  readonly before = input<string>('');

  /** The new version of the text. Ignored while `patch` is set. @default '' */
  readonly after = input<string>('');

  /**
   * A unified diff (`git diff`, `diff -u`) to show instead of comparing
   * `before` and `after`. The first file is shown; lines the patch leaves out
   * are counted, not unfoldable. @default null
   */
  readonly patch = input<string | null>(null);

  /** Unified (one column, `+` / `−`) or split (old left, new right). Two-way bindable. @default 'unified' */
  readonly view = model<SvDiffViewerView>('unified');

  /** Show the Unified / Split switch in the header. @default true */
  readonly showViewToggle = input<boolean>(true);

  /** Unchanged lines kept visible either side of a change; longer runs fold. @default 3 */
  readonly context = input<number>(3);

  /** Highlight the words that changed inside a changed line. @default true */
  readonly wordDiff = input<boolean>(true);

  /** Show the old and new line numbers. @default true */
  readonly lineNumbers = input<boolean>(true);

  /** Compare lines with leading and trailing whitespace removed. @default false */
  readonly ignoreWhitespace = input<boolean>(false);

  /** Compare lines case-insensitively. @default false */
  readonly ignoreCase = input<boolean>(false);

  /**
   * Refuse to compare when the two texts hold more lines than this between
   * them, and say so instead. `0` lifts the cap — only for texts you know are
   * small. @default 5000
   */
  readonly maxLines = input<number>(5000);

  /** File name shown in the header and used in the region's accessible name. @default '' */
  readonly title = input<string>('');

  /** Name of the old side in the split view. @default 'Before' */
  readonly beforeLabel = input<string>(this.labels.diffBefore);

  /** Name of the new side in the split view. @default 'After' */
  readonly afterLabel = input<string>(this.labels.diffAfter);

  /** Max height of the diff body, e.g. `'28rem'`; it scrolls past that. `''` for none. @default '' */
  readonly maxHeight = input<string>('');

  /** Accessible name of the region. Falls back to the title, then to "Diff". @default '' */
  readonly ariaLabel = input<string>('');

  // ── Derived ─────────────────────────────────────────────────────────────────

  protected readonly summaryId = `${this.uid}-summary`;

  protected readonly diff = computed<DiffModel>(() => {
    const patch = this.patch();
    if (patch !== null) {
      const parsed = svParsePatch(patch);
      return {
        rows: this.wordDiff() ? svPairWordSegments(parsed.rows) : parsed.rows.map((r, id) => ({ ...r, id, segments: null })),
        gaps: parsed.gaps,
        added: parsed.added,
        removed: parsed.removed,
        identical: parsed.valid && parsed.added === 0 && parsed.removed === 0,
        status: parsed.valid || !patch.trim() ? 'ok' : 'patch-invalid',
        oldLineCount: 0,
        newLineCount: 0,
        lineEndingsDiffer: false,
        moreFiles: parsed.moreFiles,
        name: parsed.newName ?? parsed.oldName,
      };
    }
    const diff = svLineDiff(this.before(), this.after(), {
      ignoreWhitespace: this.ignoreWhitespace(),
      ignoreCase: this.ignoreCase(),
      maxLines: Math.max(0, this.maxLines()),
    });
    return {
      rows: this.wordDiff() && diff.status === 'ok'
        ? svPairWordSegments(diff.rows)
        : diff.rows.map((r, id) => ({ ...r, id, segments: null })),
      gaps: [],
      added: diff.added,
      removed: diff.removed,
      identical: diff.identical,
      status: diff.status,
      oldLineCount: diff.oldLineCount,
      newLineCount: diff.newLineCount,
      lineEndingsDiffer: diff.lineEndingsDiffer,
      moreFiles: false,
      name: null,
    };
  });

  /** Folds the reader opened. Cleared whenever the diff itself changes. */
  protected readonly expanded = linkedSignal<DiffModel, ReadonlySet<string>>({
    source: this.diff,
    computation: () => new Set<string>(),
  });

  private readonly viewItems = computed<readonly SvDiffViewItem[]>(() =>
    svDiffViewItems(this.diff().rows, this.context(), this.expanded(), this.diff().gaps),
  );

  /** The unified view, decorated for the template. */
  protected readonly items = computed<readonly DrawItem[]>(() => {
    const cache = new Map<number, DrawRow>();
    return this.viewItems().map((item) =>
      item.type === 'row' ? { type: 'row', id: item.id, row: this.draw(item.row, cache) } : this.drawBreak(item),
    );
  });

  /** The split view, decorated for the template. */
  protected readonly sections = computed<readonly DrawSection[]>(() => {
    if (this.view() !== 'split') return [];
    const cache = new Map<number, DrawRow>();
    return svDiffSplitSections(this.viewItems()).map((section: SvDiffSplitSection): DrawSection => {
      if (section.type !== 'rows') return this.drawBreak(section);
      return {
        type: 'rows',
        id: section.id,
        rows: section.rows.map((pair) => {
          const left = pair.left ? this.draw(pair.left, cache) : null;
          const right = pair.right ? this.draw(pair.right, cache) : null;
          return { id: pair.id, left, right, leftCls: left?.rowCls ?? PAD_CLS, rightCls: right?.rowCls ?? PAD_CLS };
        }),
      };
    });
  });

  /** Width of a line-number gutter, in `ch`, from the largest number shown. */
  protected readonly gutter = computed(() => {
    let max = 0;
    for (const r of this.diff().rows) max = Math.max(max, r.oldNo ?? 0, r.newNo ?? 0);
    return `${String(max).length + 1}ch`;
  });

  protected readonly displayName = computed(() => this.title() || this.diff().name || '');

  protected readonly regionLabel = computed(() => {
    const explicit = this.ariaLabel().trim();
    if (explicit) return explicit;
    const name = this.displayName();
    return name ? svFormatLabel(this.labels.diffViewerNamed, { name }) : this.labels.diffViewerRegion;
  });

  /** The sentence a screen reader gets in place of the colours. */
  protected readonly summary = computed(() => {
    const m = this.diff();
    if (m.identical) return this.labels.diffViewerIdentical;
    return svFormatLabel(this.labels.diffSummary, {
      hunks: countChangeBlocks(m.rows),
      added: m.added,
      removed: m.removed,
    });
  });

  protected readonly tooLargeText = computed(() => {
    const m = this.diff();
    return svFormatLabel(this.labels.diffViewerTooLarge, {
      before: m.oldLineCount,
      after: m.newLineCount,
      max: this.maxLines(),
    });
  });

  // ── Actions ─────────────────────────────────────────────────────────────────

  protected expand(id: string): void {
    this.expanded.update((set) => new Set([...set, id]));
  }

  private drawBreak(item: Extract<SvDiffViewItem, { type: 'fold' | 'gap' }>): DrawBreak {
    const label = svFormatLabel(item.type === 'fold' ? this.labels.diffViewerShowLines : this.labels.diffViewerHiddenLines, {
      count: item.count,
    });
    return { type: item.type, id: item.id, label };
  }

  private draw(row: SvDiffViewRow, cache: Map<number, DrawRow>): DrawRow {
    const hit = cache.get(row.id);
    if (hit) return hit;
    const add = row.kind === 'add';
    const del = row.kind === 'del';
    const drawn: DrawRow = {
      ...row,
      rowCls: add ? 'bg-accent-50 dark:bg-accent-950/30' : del ? 'bg-danger-50 dark:bg-danger-950/30' : '',
      markCls: add ? 'text-accent-700 dark:text-accent-400' : del ? 'text-danger-700 dark:text-danger-400' : 'text-transparent',
      glyph: add ? '+' : del ? '−' : ' ',
      sr: add ? this.labels.diffAdded : del ? this.labels.diffRemoved : '',
      changedCls: add
        ? 'rounded-sm bg-accent-200/80 text-inherit dark:bg-accent-800/60'
        : 'rounded-sm bg-danger-200/80 text-inherit dark:bg-danger-800/60',
    };
    cache.set(row.id, drawn);
    return drawn;
  }
}

/** How many separate change blocks a diff has — the "N changes" in the summary. */
function countChangeBlocks(rows: readonly SvDiffViewRow[]): number {
  let blocks = 0;
  let inBlock = false;
  for (const r of rows) {
    const changed = r.kind !== 'context';
    if (changed && !inBlock) blocks++;
    inBlock = changed;
  }
  return blocks;
}
