/**
 * small-shares.ts — the long tail of a part-to-whole chart, and the order of it.
 *
 * ★★★ A PIE WITH THIRTY SLICES IS NOT A CHART OF THIRTY THINGS. Past roughly
 *     eight, the slices at the end are a few degrees each: they cannot be
 *     labelled, they cannot be told apart, they cannot be clicked reliably, and
 *     their colours run out. What the reader actually takes from the picture is
 *     the three or four big ones plus an unreadable fringe — so the honest
 *     drawing is the big ones plus ONE slice that says how much the fringe came
 *     to, which is the only fact about the fringe anybody can use.
 *
 *     Both of these are OFF by default. Folding a host's categories together is
 *     a decision about their data, and a chart that quietly did it would be
 *     reporting a category the host never sent.
 */

import type { SvSummaryRow } from '../a11y/data-summary';

/**
 * The colour the aggregate slice takes when the host names none.
 *
 * ★ Neutral on purpose. `Other` used to be spread from the first slice it
 *   folded, so it arrived in THAT slice's colour — and a reader matching colours
 *   to the legend saw one real category drawn twice, or read the aggregate as
 *   more of whichever category happened to be folded first. A slate grey says
 *   "not a category" in both themes, and it is a six-digit hex because the
 *   gradient donut derives its light stop from the base colour arithmetically.
 *
 * ★ Slate-500, not the lighter slate-400 it first shipped as. One fill has to
 *   hold in BOTH themes, and slate-400 measured 2.56:1 on a white card — under
 *   the 3:1 WCAG 1.4.11 asks of a graphic a reader has to find — while being
 *   comfortable on dark. Slate-500 is 4.76:1 on white, 3.73:1 on gray-900 and
 *   3.08:1 on gray-800, so the slice and its legend swatch clear 3:1 either way.
 */
export const SV_OTHER_SHARE_COLOR = '#64748b';

/** A slice of a part-to-whole chart: enough shape for grouping and ordering. */
export interface SvShareSlice {
  readonly label: string;
  readonly value: number;
  readonly color?: string;
}

/** How slices are ordered around the chart. */
export type SvShareOrder = 'input' | 'value';

/** What the grouping pass folded together, and what it has to say about it. */
export interface SvShareGrouping<T> {
  /** Survivors in their original relative order, with any `Other` slice last. */
  readonly items: readonly T[];
  /** The aggregate slice in `items`, or `null` when nothing was folded. */
  readonly other: T | null;
  /**
   * The slices folded into `other`, in the order they were met. Empty when
   * nothing was. This is what lets the summary table list them separately, as
   * the notice says it does.
   */
  readonly folded: readonly T[];
  /** How many slices were folded into `Other`. `0` when nothing was. */
  readonly grouped: number;
  /** Their combined value. */
  readonly groupedValue: number;
  /** One sentence for the reader, or `null` when nothing was folded. */
  readonly notice: string | null;
}

/** Options for {@link svGroupSmallShares}. Both thresholds are off at zero. */
export interface SvGroupSharesOptions {
  /**
   * Fold any slice below this share of the total, `0`–`1`.
   * @default 0 — no grouping
   */
  readonly minShare?: number;
  /**
   * Keep at most this many slices, folding the remainder. Applied after
   * `minShare`, and counted against the ordered list so the survivors are the
   * largest ones when the chart is sorted by value.
   * @default 0 — no cap
   */
  readonly maxSlices?: number;
  /** Label for the aggregate slice. @default 'Other' */
  readonly label?: string;
  /** Colour for the aggregate slice. @default SV_OTHER_SHARE_COLOR — a neutral slate */
  readonly color?: string;
}

/**
 * Fold the unreadable tail of a part-to-whole chart into one `Other` slice.
 *
 * ★ NEVER FOLDS A SINGLE SLICE. One slice inside an `Other` of one is the same
 *   slice with its name taken away — strictly worse than leaving it alone, and
 *   it is what a naive threshold does to a chart with one small category.
 *
 * ★ The aggregate goes LAST regardless of ordering. "Other" is not a category
 *   with a rank; sorting it by value would put it in the middle of the ring and
 *   invite the reader to compare it with a real one.
 *
 * ★ The aggregate carries a label, a value and a NEUTRAL colour, and nothing
 *   else. It used to be spread from the first slice it folded, so it inherited
 *   that slice's colour, its description, and on the radius pie its emphasis —
 *   the aggregate drawn as if it were more of one real category. A chart that
 *   gives slices other per-slice fields decides what `Other` gets for them.
 *
 * ★ Non-finite and negative values are left for the value policy that runs
 *   before this — `svResolveShares` has already decided whether they are
 *   clamped, omitted or fatal, and second-guessing that here would mean two
 *   answers to one question.
 */
export function svGroupSmallShares<T extends SvShareSlice>(
  items: readonly T[],
  total: number,
  options: SvGroupSharesOptions = {},
): SvShareGrouping<T> {
  const minShare = options.minShare ?? 0;
  const maxSlices = options.maxSlices ?? 0;
  const noGrouping: SvShareGrouping<T> = {
    items,
    other: null,
    folded: [],
    grouped: 0,
    groupedValue: 0,
    notice: null,
  };

  const wantsShare = Number.isFinite(minShare) && minShare > 0;
  const wantsCap = Number.isFinite(maxSlices) && maxSlices > 0;
  if ((!wantsShare && !wantsCap) || !items.length || !(total > 0)) return noGrouping;

  const keep: T[] = [];
  const fold: T[] = [];

  for (const item of items) {
    const belowShare = wantsShare && item.value / total < minShare;
    // The cap counts survivors, so a chart sorted by value keeps the biggest.
    const pastCap = wantsCap && keep.length >= maxSlices;
    if (belowShare || pastCap) fold.push(item);
    else keep.push(item);
  }

  // Folding one slice renames it and gains nothing.
  if (fold.length < 2) return noGrouping;

  let groupedValue = 0;
  for (const item of fold) groupedValue += item.value;

  const requested = options.label ?? 'Other';
  // ★★ "Other" is also a category hosts send. When one survives the fold, an
  //    aggregate of the same name is a second "Other" on the ring and in the
  //    legend — two entries a reader cannot tell apart, and two marks every
  //    chart template tracks by label (NG0955). The aggregate says what it is.
  const label = keep.some((item) => item.label === requested)
    ? `${requested} — small slices`
    : requested;
  // Only the fields every share slice has. `T` may carry more (a radius, a
  // description), and none of them is true of an aggregate.
  const aggregate: SvShareSlice = {
    label,
    value: groupedValue,
    color: options.color || SV_OTHER_SHARE_COLOR,
  };
  const other = aggregate as T;

  const share = Math.round((groupedValue / total) * 100);
  return {
    items: [...keep, other],
    other,
    folded: fold,
    grouped: fold.length,
    groupedValue,
    // ★★ The notice is VISIBLE text, and the summary table it used to point at
    //    alone is not: `sv-data-summary-table` is clipped to 1×1 for assistive
    //    technology. "The summary table lists them separately" was true in the
    //    DOM and false on the screen, so a sighted reader was sent looking for a
    //    table that is never drawn. The names go in the sentence itself; the
    //    values are said to be in the table, and who that table is for.
    notice:
      `${fold.length} slices too small to read were combined into “${label}”, ` +
      `${share}% of the total: ${foldedNames(fold)}. ` +
      `The summary table for screen readers lists each one's value separately.`,
  };
}

/** How many folded names the notice spells out before it counts the rest. */
const NOTICE_NAME_LIMIT = 6;

/** `A, B and C` — or `A, B, … F and 4 more` past `NOTICE_NAME_LIMIT`. */
function foldedNames(fold: readonly SvShareSlice[]): string {
  const names = fold.map((s) => s.label);
  if (names.length > NOTICE_NAME_LIMIT) {
    const shown = names.slice(0, NOTICE_NAME_LIMIT);
    return `${shown.join(', ')} and ${names.length - NOTICE_NAME_LIMIT} more`;
  }
  // A fold is never fewer than two slices — `svGroupSmallShares` refuses one.
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Order slices around the chart.
 *
 * `'value'` is the convention a pie is easiest to read in — largest first, so
 * the eye compares neighbours rather than arcs on opposite sides of the circle,
 * which is the comparison people are worst at. `'input'` keeps the host's order,
 * which is what a chart with a natural sequence (stages, months, grades) needs.
 *
 * ★ Ties break by input position rather than by whatever `sort` does with them.
 *   Two equal slices swapping places between renders is a picture that moves
 *   for no reason, and `Array.prototype.sort` stability is not the property
 *   being relied on here — reproducibility is.
 *
 * ★ Returns the SAME array when nothing needs reordering, so an unchanged input
 *   keeps its identity for change detection.
 */
export function svOrderShares<T extends SvShareSlice>(
  items: readonly T[],
  order: SvShareOrder,
): readonly T[] {
  if (order !== 'value' || items.length < 2) return items;

  const position = new Map<T, number>();
  items.forEach((item, i) => position.set(item, i));

  return [...items].sort((a, b) => {
    const delta = b.value - a.value;
    return delta !== 0 ? delta : position.get(a)! - position.get(b)!;
  });
}

/** The result of {@link svPrepareShares}. */
export interface SvPreparedShares<T> {
  /** Slices to draw, ordered, with any aggregate last. */
  readonly items: readonly T[];
  /** Unchanged by grouping — the aggregate is a sum, not a sample. */
  readonly total: number;
  /** Everything the reader has to be told, policy notice included. */
  readonly notice: string | null;
  /** How many slices were folded into the aggregate. */
  readonly grouped: number;
  /** The aggregate slice in `items`, or `null` when nothing was folded. */
  readonly other: T | null;
  /** The slices folded into `other`, in the order they were met. */
  readonly folded: readonly T[];
}

/** Ordering and grouping options, as a chart's `options` object carries them. */
export interface SvPrepareSharesOptions extends SvGroupSharesOptions {
  /** Slice order around the chart. @default 'input' */
  readonly order?: SvShareOrder;
}

/**
 * The whole preparation pass a part-to-whole chart runs after its value policy:
 * order the slices, fold the unreadable tail, and merge what has to be said
 * about both into whatever the policy already had to say.
 *
 * ★ Ordering runs BEFORE grouping so that `maxSlices` keeps the largest slices
 *   on a chart sorted by value. Grouping first would cap the input order and
 *   then sort the survivors, which quietly discards big categories that
 *   happened to be written late.
 */
export function svPrepareShares<T extends SvShareSlice>(
  items: readonly T[],
  total: number,
  policyNotice: string | null,
  options: SvPrepareSharesOptions = {},
): SvPreparedShares<T> {
  const ordered = svOrderShares(items, options.order ?? 'input');
  const grouped = svGroupSmallShares(ordered, total, options);
  const notices = [policyNotice, grouped.notice].filter(Boolean) as string[];

  return {
    items: grouped.items,
    total,
    notice: notices.length ? notices.join(' ') : null,
    grouped: grouped.grouped,
    other: grouped.other,
    folded: grouped.folded,
  };
}

/**
 * The summary-table rows for a prepared part-to-whole chart: one per drawn
 * slice, and — under the aggregate — one per slice it folded, marked as such.
 *
 * ★★ THE FOLD NOTICE PROMISES THIS. It tells the reader "the summary table for
 *    screen readers lists each one's value separately", and every table was built from the drawn slices, so it
 *    listed one `Other` row and nothing under it: a disclosure pointing at
 *    detail that did not exist. Built once here so the promise and the rows
 *    cannot drift apart per chart.
 *
 * ★ The folded rows follow the aggregate rather than taking their own place in
 *   the order, and each names the aggregate it belongs to, so a listener hears
 *   them as the breakdown of `Other` — not as extra slices the picture forgot to
 *   draw, and not as values to add to the `Other` row a second time.
 *
 * @param shares The prepared shares — `items`, plus the `other`/`folded` a fold
 *   produced.
 * @param cells The formatted data cells for one slice, in column order. Called
 *   for folded slices too, with the same total, so their shares read against
 *   the whole chart.
 */
export function svShareSummaryRows<T extends SvShareSlice>(
  shares: Pick<SvPreparedShares<T>, 'items' | 'other' | 'folded'>,
  cells: (item: T) => readonly string[],
): SvSummaryRow[] {
  const rows: SvSummaryRow[] = [];
  const { other, folded } = shares;
  // ★ `track row.key` throws NG0955 on a repeat, and labels are the host's:
  //   two slices both called "Direct" are a data mistake the table should still
  //   render, not a console error. A repeat keeps its label and gains a suffix.
  const seen = new Set<string>();
  const unique = (key: string): string => {
    let candidate = key;
    for (let n = 2; seen.has(candidate); n++) candidate = `${key}#${n}`;
    seen.add(candidate);
    return candidate;
  };
  for (const item of shares.items) {
    if (!other || item !== other) {
      rows.push({ key: unique(item.label), header: item.label, cells: cells(item) });
      continue;
    }
    rows.push({
      key: unique(`aggregate:${other.label}`),
      header: `${other.label} (${folded.length} combined)`,
      cells: cells(other),
    });
    folded.forEach((slice, i) => {
      rows.push({
        key: unique(`aggregate:${other.label}:${i}:${slice.label}`),
        header: `${slice.label} (in ${other.label})`,
        cells: cells(slice),
      });
    });
  }
  return rows;
}
