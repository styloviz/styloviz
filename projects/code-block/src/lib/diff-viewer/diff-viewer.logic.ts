/**
 * ============================================================
 *  sv-diff-viewer — the pure half
 * ============================================================
 *  `svLineDiff` (two texts → every row), `svWordDiff` (one changed pair → the
 *  words that moved), `svParsePatch` (a unified patch → rows and gaps) and
 *  `svDiffViewItems` (rows → what is drawn, with unchanged runs folded).
 *
 *  ★★★ THE ENGINE IS NOT HERE. `svDiffLines()` in `@styloviz/core` is the
 *      kit's one diff engine (Myers, with an edit budget), shared with
 *      sv-code-block's hosts, the JSON viewer and the tree comparisons. This
 *      file adapts texts to it — line endings, the final newline, a size cap —
 *      and adapts its output to a viewer. A second engine would be a second set
 *      of edge cases found separately.
 *
 *  Nothing here touches Angular or the DOM, so all of it is tested as data.
 * ============================================================
 */
import { svDiffLines } from '@styloviz/core/data';
import { SV_CORE_LABELS } from '@styloviz/core/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SvDiffRowKind = 'add' | 'del' | 'context';

/** One part of a changed line for the word-level highlight. */
export interface SvDiffSegment {
  readonly text: string;
  /** True for the words that differ from the paired line. */
  readonly changed: boolean;
}

/** One line of a diff, with both line numbers. */
export interface SvDiffRow {
  readonly kind: SvDiffRowKind;
  readonly text: string;
  /** Line number in the old text, or `null` for an added line. */
  readonly oldNo: number | null;
  /** Line number in the new text, or `null` for a removed line. */
  readonly newNo: number | null;
  /** This is the last line of its side and that side has no final newline. */
  readonly noEol?: boolean;
}

/** Why a diff has (or has not) got rows. */
export type SvLineDiffStatus = 'ok' | 'too-large' | 'too-different';

export interface SvLineDiffOptions {
  /** Compare with leading and trailing whitespace removed. @default false */
  readonly ignoreWhitespace?: boolean;
  /** Compare case-insensitively. @default false */
  readonly ignoreCase?: boolean;
  /**
   * Refuse to diff when the two texts hold more lines than this between them.
   * The result is `status: 'too-large'` with no rows, which a viewer discloses
   * rather than freezing the tab. `0` means no cap. @default 5000
   */
  readonly maxLines?: number;
  /** Edit budget passed to the core engine; past it the result is `too-different`. @default 4000 */
  readonly maxEdits?: number;
}

export interface SvLineDiff {
  /** Every line of both texts in diff order — unchanged lines included. */
  readonly rows: readonly SvDiffRow[];
  readonly added: number;
  readonly removed: number;
  /** The texts are equal under the comparison rules (line endings aside). */
  readonly identical: boolean;
  readonly status: SvLineDiffStatus;
  readonly oldLineCount: number;
  readonly newLineCount: number;
  /** One side used CRLF and the other LF. Normalised away — but worth saying. */
  readonly lineEndingsDiffer: boolean;
}

// ─── Line diff ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_LINES = 5000;

/**
 * Marks the last line of the side that has no final newline, so the engine
 * sees "x" and "x⏎" as different lines — which they are: git reports the pair
 * as a change with "\ No newline at end of file". Private-use characters, and
 * only ever stripped from that one known row.
 */
const NO_EOL_MARK = '';

interface SplitText {
  readonly lines: string[];
  readonly finalNewline: boolean;
  readonly crlf: boolean;
}

function splitText(text: string): SplitText {
  const crlf = /\r\n/.test(text);
  const normal = text.replace(/\r\n?/g, '\n');
  if (normal === '') return { lines: [], finalNewline: false, crlf };
  const finalNewline = normal.endsWith('\n');
  const body = finalNewline ? normal.slice(0, -1) : normal;
  return { lines: body.split('\n'), finalNewline, crlf };
}

/**
 * Hand lines to the core engine, which splits its input on `\n` and reads an
 * empty string as NO lines. A one-character prefix on every line keeps a text
 * that is a single empty line (`"\n"`) from vanishing; it is sliced off again
 * on the way out.
 */
const encode = (lines: readonly string[]): string => lines.map((l) => ` ${l}`).join('\n');

/**
 * Diff two texts line by line, keeping every unchanged line.
 *
 * - `\r\n` and `\r` are read as `\n`; `lineEndingsDiffer` says when the two
 *   sides disagreed.
 * - A missing final newline on one side only is a change to that last line,
 *   flagged `noEol` on the row it belongs to.
 * - Past `maxLines` nothing is compared (`status: 'too-large'`); past the
 *   engine's edit budget the old text is reported removed and the new one
 *   added (`status: 'too-different'`).
 */
export function svLineDiff(before: string, after: string, options: SvLineDiffOptions = {}): SvLineDiff {
  const a = splitText(before);
  const b = splitText(after);
  const lineEndingsDiffer = a.crlf !== b.crlf && a.lines.length > 0 && b.lines.length > 0;
  const base = { oldLineCount: a.lines.length, newLineCount: b.lines.length, lineEndingsDiffer };

  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  if (maxLines > 0 && a.lines.length + b.lines.length > maxLines) {
    return { ...base, rows: [], added: 0, removed: 0, identical: false, status: 'too-large' };
  }

  // Which side's last line carries the marker, if either.
  const eolDiffers = a.lines.length > 0 && b.lines.length > 0 && a.finalNewline !== b.finalNewline;
  const markOld = eolDiffers && !a.finalNewline ? a.lines.length : 0;
  const markNew = eolDiffers && !b.finalNewline ? b.lines.length : 0;
  const oldLines = markOld ? [...a.lines.slice(0, -1), a.lines[a.lines.length - 1] + NO_EOL_MARK] : a.lines;
  const newLines = markNew ? [...b.lines.slice(0, -1), b.lines[b.lines.length - 1] + NO_EOL_MARK] : b.lines;

  const result = svDiffLines(encode(oldLines), encode(newLines), SV_CORE_LABELS, {
    // Everything as context: the viewer folds unchanged runs itself, and needs
    // the text of every line to unfold them.
    context: Number.MAX_SAFE_INTEGER,
    ignoreWhitespace: options.ignoreWhitespace,
    ignoreCase: options.ignoreCase,
    maxEdits: options.maxEdits,
  });

  const engineRows = result.identical
    ? oldLines.map((text, i) => ({ kind: 'context' as const, text: ` ${text}`, oldNo: i + 1, newNo: i + 1 }))
    : result.hunks.flatMap((h) => h.lines);

  const rows: SvDiffRow[] = engineRows.map((line) => {
    let text = line.text.slice(1);
    const onMarkedRow =
      (markOld > 0 && line.oldNo === markOld && line.kind !== 'add') ||
      (markNew > 0 && line.newNo === markNew && line.kind !== 'del');
    if (onMarkedRow && text.endsWith(NO_EOL_MARK)) text = text.slice(0, -NO_EOL_MARK.length);
    return onMarkedRow
      ? { kind: line.kind, text, oldNo: line.oldNo, newNo: line.newNo, noEol: true }
      : { kind: line.kind, text, oldNo: line.oldNo, newNo: line.newNo };
  });

  return {
    ...base,
    rows,
    added: result.added,
    removed: result.removed,
    identical: result.identical,
    status: result.tooDifferent ? 'too-different' : 'ok',
  };
}

// ─── Word diff ────────────────────────────────────────────────────────────────

const WORD = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;
const MAX_WORD_TOKENS = 400;

function merge(segments: readonly SvDiffSegment[]): SvDiffSegment[] {
  const out: SvDiffSegment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (last && last.changed === s.changed) out[out.length - 1] = { text: last.text + s.text, changed: s.changed };
    else out.push(s);
  }
  return out;
}

/**
 * The words that differ between a removed line and the added line it became.
 *
 * Returns `null` when a highlight would say nothing useful: the lines share no
 * word at all (the whole line is the change), or either is longer than 400
 * tokens (a minified bundle, where a per-word highlight costs more than it
 * tells). Whitespace counts as a token, so an indentation change is visible.
 */
export function svWordDiff(
  before: string,
  after: string,
): { readonly before: readonly SvDiffSegment[]; readonly after: readonly SvDiffSegment[] } | null {
  const a = before.match(WORD) ?? [];
  const b = after.match(WORD) ?? [];
  if (!a.length || !b.length || a.length > MAX_WORD_TOKENS || b.length > MAX_WORD_TOKENS) return null;

  const result = svDiffLines(encode(a), encode(b), SV_CORE_LABELS, {
    context: Number.MAX_SAFE_INTEGER,
    maxEdits: MAX_WORD_TOKENS,
  });
  if (result.identical || result.tooDifferent) return null;

  const lines = result.hunks.flatMap((h) => h.lines);
  const shared = lines.some((l) => l.kind === 'context' && l.text.trim() !== '');
  if (!shared) return null;

  const left: SvDiffSegment[] = [];
  const right: SvDiffSegment[] = [];
  for (const l of lines) {
    const text = l.text.slice(1);
    if (l.kind !== 'add') left.push({ text, changed: l.kind === 'del' });
    if (l.kind !== 'del') right.push({ text, changed: l.kind === 'add' });
  }
  return { before: merge(left), after: merge(right) };
}

// ─── Unified patch ────────────────────────────────────────────────────────────

/** A run of unchanged lines a patch leaves out — known by count, not by text. */
export interface SvDiffGap {
  /** Index into `rows` the gap sits before (`rows.length` for after the last row). */
  readonly before: number;
  readonly count: number;
}

export interface SvParsedPatch {
  readonly rows: readonly SvDiffRow[];
  readonly gaps: readonly SvDiffGap[];
  readonly added: number;
  readonly removed: number;
  /** `--- a/…` and `+++ b/…`, without the `a/` and `b/` prefixes. */
  readonly oldName: string | null;
  readonly newName: string | null;
  /** At least one `@@` hunk header was found. */
  readonly valid: boolean;
  /** The patch carried further files; only the first is in `rows`. */
  readonly moreFiles: boolean;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function patchName(line: string): string | null {
  const name = line.slice(4).split('\t')[0]!.trim();
  if (!name || name === '/dev/null') return null;
  return name.replace(/^[ab]\//, '');
}

/**
 * Read one file of a unified diff (`git diff`, `diff -u`).
 *
 * ★★ PARSED AS TEXT, NEVER EVALUATED OR RENDERED AS MARKUP. Each line is
 *    classified by its first character and its text is kept as a string; a
 *    patch that adds `<script>` shows those characters.
 *
 * Lines between hunks that the header counts say are unchanged become `gaps` —
 * the patch does not carry their text, so a viewer can say how many there are
 * but cannot unfold them. Anything it does not recognise is skipped.
 */
export function svParsePatch(patch: string): SvParsedPatch {
  const lines = patch.replace(/\r\n?/g, '\n').split('\n');
  const rows: SvDiffRow[] = [];
  const gaps: SvDiffGap[] = [];
  let oldName: string | null = null;
  let newName: string | null = null;
  let added = 0;
  let removed = 0;
  let valid = false;
  let moreFiles = false;
  let oldNo = 0;
  let newNo = 0;
  let oldLeft = 0;
  let newLeft = 0;
  let lastOldEnd = 0;

  for (const line of lines) {
    const header = HUNK_HEADER.exec(line);
    if (header) {
      const oldStart = Number(header[1]);
      const newStart = Number(header[3]);
      oldLeft = header[2] === undefined ? 1 : Number(header[2]);
      newLeft = header[4] === undefined ? 1 : Number(header[4]);
      // A zero-length side starts AFTER the line it names (`-0,0` is "before line 1").
      oldNo = oldLeft === 0 ? oldStart : oldStart - 1;
      newNo = newLeft === 0 ? newStart : newStart - 1;
      const hidden = oldNo - lastOldEnd;
      if (hidden > 0) gaps.push({ before: rows.length, count: hidden });
      valid = true;
      continue;
    }

    // `\ No newline at end of file` follows the line it describes — which is
    // often the hunk's last, so it is read before the hunk is considered over.
    if (line.startsWith('\\')) {
      const last = rows[rows.length - 1];
      if (last && valid) rows[rows.length - 1] = { ...last, noEol: true };
      continue;
    }

    const inHunk = oldLeft > 0 || newLeft > 0;
    if (!inHunk) {
      // sv-i18n-ignore: unified-diff syntax, matched, never shown
      if (line.startsWith('diff --git ') || (line.startsWith('--- ') && valid)) {
        if (valid) {
          moreFiles = true;
          break;
        }
      } else if (line.startsWith('--- ') && !valid) {
        oldName = patchName(line);
      } else if (line.startsWith('+++ ') && !valid) {
        newName = patchName(line);
      }
      continue;
    }

    const mark = line[0];
    const text = line.slice(1);
    if (mark === '+') {
      newNo++;
      newLeft--;
      added++;
      rows.push({ kind: 'add', text, oldNo: null, newNo });
    } else if (mark === '-') {
      oldNo++;
      oldLeft--;
      removed++;
      rows.push({ kind: 'del', text, oldNo, newNo: null });
    } else if (mark === ' ' || line === '') {
      // ★ Some tools strip the space off an empty context line — an empty
      //   line inside a hunk is still a context line, not the end of it.
      oldNo++;
      newNo++;
      oldLeft--;
      newLeft--;
      rows.push({ kind: 'context', text: mark === ' ' ? text : '', oldNo, newNo });
    }
    if (oldLeft <= 0 && newLeft <= 0) lastOldEnd = oldNo;
  }

  return { rows, gaps, added, removed, oldName, newName, valid, moreFiles };
}

// ─── View model ───────────────────────────────────────────────────────────────

/** One drawn line, with its word-level segments when it has a partner. */
export interface SvDiffViewRow extends SvDiffRow {
  /** Stable for `@for` — the row's index in the diff. */
  readonly id: number;
  readonly segments: readonly SvDiffSegment[] | null;
}

/** What the viewer draws, top to bottom. */
export type SvDiffViewItem =
  | { readonly type: 'row'; readonly id: string; readonly row: SvDiffViewRow }
  /** An unchanged run folded away — `rows` are drawn once it is expanded. */
  | { readonly type: 'fold'; readonly id: string; readonly count: number; readonly rows: readonly SvDiffViewRow[] }
  /** Unchanged lines a patch did not carry. Cannot be expanded. */
  | { readonly type: 'gap'; readonly id: string; readonly count: number };

/**
 * Pair the removed and added lines of each change block and attach their
 * word-level segments. A block of three removals and two additions pairs the
 * first two of each; the third removal stays whole.
 */
export function svPairWordSegments(rows: readonly SvDiffRow[]): SvDiffViewRow[] {
  const out: SvDiffViewRow[] = rows.map((row, id) => ({ ...row, id, segments: null }));
  let i = 0;
  while (i < out.length) {
    if (out[i]!.kind === 'context') {
      i++;
      continue;
    }
    const dels: number[] = [];
    const adds: number[] = [];
    while (i < out.length && out[i]!.kind !== 'context') {
      (out[i]!.kind === 'del' ? dels : adds).push(i);
      i++;
    }
    const pairs = Math.min(dels.length, adds.length);
    for (let p = 0; p < pairs; p++) {
      const d = out[dels[p]!]!;
      const a = out[adds[p]!]!;
      const words = svWordDiff(d.text, a.text);
      if (!words) continue;
      out[dels[p]!] = { ...d, segments: words.before };
      out[adds[p]!] = { ...a, segments: words.after };
    }
  }
  return out;
}

/**
 * Fold the unchanged runs, keeping `context` lines either side of a change.
 *
 * A run is folded only when that hides at least two lines — a "show 1 line"
 * button is taller than the line it hides. A run at the top keeps only its
 * last `context` lines, one at the bottom only its first. With no change at
 * all, the whole text is one fold. `gaps` (from a patch) are placed where they
 * fall and never fold.
 */
export function svDiffViewItems(
  rows: readonly SvDiffViewRow[],
  context: number,
  expanded: ReadonlySet<string>,
  gaps: readonly SvDiffGap[] = [],
): SvDiffViewItem[] {
  const keep = Math.max(0, Math.floor(context));
  const items: SvDiffViewItem[] = [];
  const gapAt = new Map(gaps.map((g) => [g.before, g.count] as const));
  const hasChange = rows.some((r) => r.kind !== 'context');

  const pushGap = (index: number): void => {
    const count = gapAt.get(index);
    if (count) items.push({ type: 'gap', id: `gap-${index}`, count });
  };

  let i = 0;
  while (i < rows.length) {
    pushGap(i);
    if (rows[i]!.kind !== 'context') {
      items.push({ type: 'row', id: `row-${rows[i]!.id}`, row: rows[i]! });
      i++;
      continue;
    }
    // An unchanged run, stopping at the next change or the next gap.
    let end = i;
    while (end < rows.length && rows[end]!.kind === 'context' && (end === i || !gapAt.has(end))) end++;
    const run = rows.slice(i, end);
    const first = i === 0 || gapAt.has(i);
    const last = end === rows.length || gapAt.has(end);
    const head = !hasChange ? 0 : first ? 0 : keep;
    const tail = !hasChange ? 0 : last ? 0 : keep;
    const hidden = run.length - head - tail;
    const foldId = `fold-${rows[i]!.id}`;

    if (hidden >= 2 && !expanded.has(foldId)) {
      for (const r of run.slice(0, head)) items.push({ type: 'row', id: `row-${r.id}`, row: r });
      items.push({ type: 'fold', id: foldId, count: hidden, rows: run.slice(head, head + hidden) });
      for (const r of run.slice(head + hidden)) items.push({ type: 'row', id: `row-${r.id}`, row: r });
    } else {
      for (const r of run) items.push({ type: 'row', id: `row-${r.id}`, row: r });
    }
    i = end;
  }
  pushGap(rows.length);
  return items;
}

/** One line of the split view: the old side, the new side, or both. */
export interface SvDiffSplitRow {
  readonly id: string;
  readonly left: SvDiffViewRow | null;
  readonly right: SvDiffViewRow | null;
}

/** The split view: runs of side-by-side rows, separated by folds and gaps. */
export type SvDiffSplitSection =
  | { readonly type: 'rows'; readonly id: string; readonly rows: readonly SvDiffSplitRow[] }
  | Extract<SvDiffViewItem, { type: 'fold' | 'gap' }>;

/**
 * Lay the unified items out side by side. Unchanged lines sit on both sides;
 * within a change block the removals and additions are paired line for line,
 * and the shorter side is padded with empty rows.
 */
export function svDiffSplitSections(items: readonly SvDiffViewItem[]): SvDiffSplitSection[] {
  const sections: SvDiffSplitSection[] = [];
  let current: SvDiffSplitRow[] = [];
  let dels: SvDiffViewRow[] = [];
  let adds: SvDiffViewRow[] = [];

  const flushChange = (): void => {
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k++) {
      const left = dels[k] ?? null;
      const right = adds[k] ?? null;
      current.push({ id: `pair-${(left ?? right)!.id}-${right?.id ?? 'x'}`, left, right });
    }
    dels = [];
    adds = [];
  };
  const flushRows = (): void => {
    flushChange();
    if (current.length) sections.push({ type: 'rows', id: `rows-${current[0]!.id}`, rows: current });
    current = [];
  };

  for (const item of items) {
    if (item.type !== 'row') {
      flushRows();
      sections.push(item);
      continue;
    }
    const row = item.row;
    if (row.kind === 'del') {
      if (adds.length) flushChange();
      dels.push(row);
    } else if (row.kind === 'add') {
      adds.push(row);
    } else {
      flushChange();
      current.push({ id: `ctx-${row.id}`, left: row, right: row });
    }
  }
  flushRows();
  return sections;
}
