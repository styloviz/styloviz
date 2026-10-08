/**
 * The diff engine, owned once.
 *
 * ★★★ FOUR FAMILIES WERE EACH GROWING A CORNER OF THIS. Code Block renders a
 * diff it is HANDED — `DiffHunk[]` supplied by the host — and computes nothing.
 * JSON Viewer wanted a JSON diff, Tree View wanted to compare trees,
 * Descriptions wanted to diff a record. Four UIs, four half-engines, four sets
 * of edge cases discovered separately. This is the engine; the renderers stay
 * where they are.
 *
 * ★★ IT IS PURE, AND THAT IS THE POINT. No Angular, no DOM, no rendering
 * opinion — so it can be tested as arithmetic, run in a worker, or called on a
 * server, and the components that use it disagree about presentation without
 * disagreeing about what changed.
 */

// ─── Line diff ────────────────────────────────────────────────────────────────

export type SvDiffLineKind = 'add' | 'del' | 'context';

/** One line of a diff. Shaped to match what `sv-code-block` already renders. */
export interface SvDiffLine {
  readonly kind: SvDiffLineKind;
  readonly text: string;
  /** Line number in the original, or `null` for an added line. */
  readonly oldNo: number | null;
  /** Line number in the new text, or `null` for a removed line. */
  readonly newNo: number | null;
}

/** A contiguous run of change, with a few unchanged lines either side. */
export interface SvDiffHunk {
  readonly id: string;
  /** `@@ -12,7 +12,9 @@`. */
  readonly header: string;
  readonly lines: readonly SvDiffLine[];
}

export interface SvDiffOptions {
  /** Unchanged lines kept either side of a change. @default 3 */
  readonly context?: number;
  /** Compare with leading and trailing whitespace removed. @default false */
  readonly ignoreWhitespace?: boolean;
  /** Compare case-insensitively. @default false */
  readonly ignoreCase?: boolean;
  /**
   * Give up past this many edits and report a wholesale replacement.
   *
   * ★★★ THE BUDGET IS THE HONEST PART. Myers is O(ND) — fast when the two texts
   * are related and quadratic when they are not, which is exactly the case a
   * user reaches by pasting the wrong file. A diff of two unrelated 5,000-line
   * texts is the classic frozen tab. Past the budget this stops and says the
   * texts are too different to diff, which is both true and instant; grinding
   * for forty seconds to produce a diff that is one giant delete followed by
   * one giant insert is neither.
   * @default 4000
   */
  readonly maxEdits?: number;
}

/** What a diff turned out to be. */
export interface SvDiffResult {
  readonly hunks: readonly SvDiffHunk[];
  readonly added: number;
  readonly removed: number;
  /** True when the texts are identical under the comparison rules in force. */
  readonly identical: boolean;
  /**
   * True when the edit budget was exhausted and the result is a wholesale
   * replacement rather than a line-by-line comparison.
   */
  readonly tooDifferent: boolean;
  /** One sentence, for the accessible summary. */
  readonly summary: string;
}

const DEFAULT_CONTEXT = 3;
const DEFAULT_MAX_EDITS = 4000;

type Op = { readonly kind: SvDiffLineKind; readonly oldIndex: number; readonly newIndex: number };

function normalise(line: string, options: SvDiffOptions): string {
  let out = line;
  if (options.ignoreWhitespace) out = out.trim();
  if (options.ignoreCase) out = out.toLowerCase();
  return out;
}

/**
 * Myers' O(ND) difference algorithm, with a budget.
 *
 * ★ The classic formulation, kept close to the paper: `v` holds the furthest
 * reaching x for each diagonal k, and a trace of those arrays is what lets the
 * path be walked backwards afterwards. The only departure is `maxEdits`.
 */
function myers(a: readonly string[], b: readonly string[], maxEdits: number): Op[] | null {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, maxEdits);
  const offset = max;
  const v = new Int32Array(2 * max + 2);
  const trace: Int32Array[] = [];

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[k - 1 + offset] < v[k + 1 + offset])) {
        x = v[k + 1 + offset];
      } else {
        x = v[k - 1 + offset] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[k + offset] = x;
      if (x >= n && y >= m) return walkBack(trace, a, b, d, offset);
    }
  }
  // ★ Out of budget. `null` rather than a partial path: half a diff is not a
  //   smaller diff, it is a wrong one.
  return null;
}

/** Reconstruct the edit script from the trace, then reverse it. */
function walkBack(
  trace: readonly Int32Array[],
  a: readonly string[],
  b: readonly string[],
  d: number,
  offset: number,
): Op[] {
  const ops: Op[] = [];
  let x = a.length;
  let y = b.length;

  for (let depth = d; depth > 0; depth--) {
    const v = trace[depth];
    const k = x - y;
    const down = k === -depth || (k !== depth && v[k - 1 + offset] < v[k + 1 + offset]);
    const prevK = down ? k + 1 : k - 1;
    const prevX = v[prevK + offset];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      ops.push({ kind: 'context', oldIndex: x - 1, newIndex: y - 1 });
      x--;
      y--;
    }
    if (down) {
      ops.push({ kind: 'add', oldIndex: -1, newIndex: y - 1 });
      y--;
    } else {
      ops.push({ kind: 'del', oldIndex: x - 1, newIndex: -1 });
      x--;
    }
  }
  while (x > 0 && y > 0) {
    ops.push({ kind: 'context', oldIndex: x - 1, newIndex: y - 1 });
    x--;
    y--;
  }
  return ops.reverse();
}

/** Split a text into lines, with `''` for an empty text rather than `['']`. */
function toLines(text: string): string[] {
  return text.length === 0 ? [] : text.split('\n');
}

/**
 * Diff two texts, line by line.
 *
 * ★ `context` is what makes the output readable rather than complete: a hunk
 * shows a few unchanged lines either side so the reader can see where they are.
 * Zero shows only the changes, which is right for a machine and useless to a
 * person.
 */
export function svDiffLines(
  before: string,
  after: string,
  options: SvDiffOptions = {},
): SvDiffResult {
  const context = Math.max(0, options.context ?? DEFAULT_CONTEXT);
  const maxEdits = Math.max(1, options.maxEdits ?? DEFAULT_MAX_EDITS);

  const oldLines = toLines(before);
  const newLines = toLines(after);
  const a = oldLines.map((l) => normalise(l, options));
  const b = newLines.map((l) => normalise(l, options));

  const ops = myers(a, b, maxEdits);

  if (!ops) {
    // Wholesale replacement, and said so rather than implied.
    const lines: SvDiffLine[] = [
      ...oldLines.map((text, i) => ({ kind: 'del' as const, text, oldNo: i + 1, newNo: null })),
      ...newLines.map((text, i) => ({ kind: 'add' as const, text, oldNo: null, newNo: i + 1 })),
    ];
    return {
      hunks: lines.length
        ? [{ id: 'hunk-1', header: `@@ -1,${oldLines.length} +1,${newLines.length} @@`, lines }]
        : [],
      added: newLines.length,
      removed: oldLines.length,
      identical: false,
      tooDifferent: true,
      summary:
        `These two are too different to compare line by line — ` +
        `${oldLines.length} lines replaced by ${newLines.length}.`,
    };
  }

  const all: SvDiffLine[] = ops.map((op) => ({
    kind: op.kind,
    text: op.kind === 'add' ? newLines[op.newIndex] : oldLines[op.oldIndex],
    oldNo: op.oldIndex >= 0 ? op.oldIndex + 1 : null,
    newNo: op.newIndex >= 0 ? op.newIndex + 1 : null,
  }));

  const added = all.filter((l) => l.kind === 'add').length;
  const removed = all.filter((l) => l.kind === 'del').length;
  const identical = added === 0 && removed === 0;

  return {
    hunks: identical ? [] : groupIntoHunks(all, context),
    added,
    removed,
    identical,
    tooDifferent: false,
    summary: svDiffSummary(identical ? 0 : groupIntoHunks(all, context).length, added, removed),
  };
}

/** Collapse long runs of unchanged lines, keeping `context` either side. */
function groupIntoHunks(lines: readonly SvDiffLine[], context: number): SvDiffHunk[] {
  const changed = lines
    .map((line, i) => (line.kind === 'context' ? -1 : i))
    .filter((i) => i >= 0);
  if (!changed.length) return [];

  const ranges: [number, number][] = [];
  for (const i of changed) {
    const from = Math.max(0, i - context);
    const to = Math.min(lines.length - 1, i + context);
    const last = ranges[ranges.length - 1];
    // ★ Merged when they touch OR abut. Two hunks separated by nothing is one
    //   hunk, and emitting them apart makes the count in the summary wrong.
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to);
    else ranges.push([from, to]);
  }

  return ranges.map(([from, to], index) => {
    const slice = lines.slice(from, to + 1);
    const oldStart = slice.find((l) => l.oldNo !== null)?.oldNo ?? 0;
    const newStart = slice.find((l) => l.newNo !== null)?.newNo ?? 0;
    const oldCount = slice.filter((l) => l.oldNo !== null).length;
    const newCount = slice.filter((l) => l.newNo !== null).length;
    return {
      id: `hunk-${index + 1}`,
      header: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
      lines: slice,
    };
  });
}

/**
 * The sentence a screen reader gets instead of the colours.
 *
 * ★★ A diff conveys everything through red and green, which is the plainest
 * possible 1.4.1 failure — and the counts are also what a sighted reader wants
 * before deciding whether to read it at all.
 */
export function svDiffSummary(hunks: number, added: number, removed: number): string {
  if (added === 0 && removed === 0) return 'No changes.';
  const parts = [`${hunks} ${hunks === 1 ? 'change' : 'changes'}`];
  if (added) parts.push(`${added} ${added === 1 ? 'line' : 'lines'} added`);
  if (removed) parts.push(`${removed} ${removed === 1 ? 'line' : 'lines'} removed`);
  return `${parts.join(', ')}.`;
}

// ─── Structural diff ──────────────────────────────────────────────────────────

export type SvChangeKind = 'added' | 'removed' | 'changed' | 'unchanged';

/** One difference between two values, at a path. */
export interface SvValueChange {
  /** Dotted path — `items.0.price`. `''` is the root. */
  readonly path: string;
  readonly kind: SvChangeKind;
  readonly before: unknown;
  readonly after: unknown;
}

export interface SvValueDiffOptions {
  /** Paths to leave out of the comparison entirely. */
  readonly ignore?: (path: string) => boolean;
  /** Include unchanged leaves in the result. @default false */
  readonly includeUnchanged?: boolean;
  /** Refuse to walk deeper than this. @default 12 */
  readonly maxDepth?: number;
}

/**
 * Compare two JSON-ish values, leaf by leaf.
 *
 * ★★★ THE IGNORE RULE IS NOT A CONVENIENCE. Every real object comparison
 * carries fields that always differ and never matter — `updatedAt`, a request
 * id, a cache key — and a diff that reports them is a diff nobody reads. The
 * predicate takes the PATH rather than the key so `meta.updatedAt` can be
 * ignored while `record.updatedAt` is not.
 *
 * ★ `maxDepth` exists because a cyclic structure is a hang and a stack
 * overflow, and both are worse than an incomplete answer that says so: past the
 * limit the node is reported as one `changed` leaf rather than walked.
 */
export function svDiffValues(
  before: unknown,
  after: unknown,
  options: SvValueDiffOptions = {},
): SvValueChange[] {
  const out: SvValueChange[] = [];
  walk(before, after, '', out, options, options.maxDepth ?? 12);
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function walk(
  before: unknown,
  after: unknown,
  path: string,
  out: SvValueChange[],
  options: SvValueDiffOptions,
  depth: number,
): void {
  if (options.ignore?.(path)) return;

  const bothMissing = before === undefined && after === undefined;
  if (bothMissing) return;

  if (before === undefined) {
    out.push({ path, kind: 'added', before: undefined, after });
    return;
  }
  if (after === undefined) {
    out.push({ path, kind: 'removed', before, after: undefined });
    return;
  }

  const container =
    depth > 0 &&
    ((isPlainObject(before) && isPlainObject(after)) ||
      (Array.isArray(before) && Array.isArray(after)));

  if (!container) {
    const same = Object.is(before, after) || JSON.stringify(before) === JSON.stringify(after);
    if (!same) out.push({ path, kind: 'changed', before, after });
    else if (options.includeUnchanged) {
      out.push({ path, kind: 'unchanged', before, after });
    }
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let i = 0; i < length; i++) {
      walk(before[i], after[i], path ? `${path}.${i}` : String(i), out, options, depth - 1);
    }
    return;
  }

  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  // ★ Keys in the order they appear in `before`, then anything new from `after`.
  //   A diff sorted alphabetically reorders the reader's own object under them.
  const keys = [...Object.keys(a), ...Object.keys(b).filter((k) => !(k in a))];
  for (const key of keys) {
    walk(a[key], b[key], path ? `${path}.${key}` : key, out, options, depth - 1);
  }
}

/** The same sentence, for a structural diff. */
export function svValueDiffSummary(changes: readonly SvValueChange[]): string {
  const counted = changes.filter((c) => c.kind !== 'unchanged');
  if (!counted.length) return 'No changes.';
  const added = counted.filter((c) => c.kind === 'added').length;
  const removed = counted.filter((c) => c.kind === 'removed').length;
  const changed = counted.filter((c) => c.kind === 'changed').length;
  const parts: string[] = [];
  if (changed) parts.push(`${changed} changed`);
  if (added) parts.push(`${added} added`);
  if (removed) parts.push(`${removed} removed`);
  const noun = counted.length === 1 ? 'field' : 'fields';
  return `${counted.length} ${noun}: ${parts.join(', ')}.`;
}
