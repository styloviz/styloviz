import type { SvDataError } from './types';

declare const ngDevMode: boolean | undefined;

/**
 * ============================================================================
 *  What a chart does with a datum it cannot plot (audit item X-7)
 * ============================================================================
 *
 * Six families were each asked for this separately — bar (negatives), donut and
 * pie (zero totals and negatives), polar area (negatives), treemap (zero and
 * negative weights), heatmap (missing values). Six answers would have been six
 * behaviours, so this is one.
 *
 * The failure they share is not that the datum is rejected. It is that it is
 * accepted and then quietly altered:
 *
 * - A zero-based bar clamps a negative to 0 and warns in **dev only**, so
 *   production drew a missing bar and said nothing.
 * - A pie sums raw values for its denominator, so `[10, -5]` gives a total of 5
 *   and the first slice sweeps 720°. Nothing is dropped and nothing is warned —
 *   the chart draws a *different dataset* than it was given, convincingly.
 * - `[5, -5]` sums to 0, which every pie and donut reads as "no data" and
 *   renders as an empty state, over two non-zero data points.
 * - A treemap divides by its own subtree sum, so a negative weight inverts a
 *   tile's share and the squarify recursion lays out tiles that overlap.
 *
 * So the four behaviours below are named, typed, and one of them is chosen
 * per chart — and whichever is chosen, the *rendered output* says what happened.
 * A `console.warn` is not a disclosure: nobody reading the dashboard sees it.
 * ============================================================================
 */

/**
 * What to do with a datum this chart cannot plot as given.
 *
 * - `render` — plot it truthfully in whatever way the chart can. Only some
 *   charts have such a way (a heatmap can hatch a missing cell; a zero-based
 *   bar has no room below its baseline), so each chart declares whether it
 *   supports this.
 * - `clamp` — plot the nearest value the chart can draw, and **mark the datum**
 *   so the reader can see that this one is not to scale.
 * - `omit` — leave it out, and disclose how many were left out.
 * - `reject` — refuse the whole dataset and show the error state, on the view
 *   that a wrong chart is worse than no chart.
 */
export type SvValuePolicy = 'render' | 'clamp' | 'omit' | 'reject';

/** Everything one chart needs to apply a policy to one collection. */
export interface SvValuePolicyOptions<T> {
  /** The number this chart plots for an item. */
  readonly value: (item: T) => number;
  /** The same item with its plotted value replaced. Only called under `clamp`. */
  readonly clamp: (item: T, to: number) => T;
  /** The requested policy, usually a host input over the chart's own default. */
  readonly policy: SvValuePolicy;
  /**
   * The behaviours this chart can actually carry out. A request outside this set
   * is a host asking for something the chart has no way to draw; it falls back
   * to `fallback` and says so in dev rather than pretending.
   */
  readonly supported: readonly SvValuePolicy[];
  /** Used when `policy` is outside `supported`. Must itself be supported. */
  readonly fallback: SvValuePolicy;
  /** Component selector, so a warning names the chart it came from. */
  readonly selector: string;
  /** What this chart calls one datum — 'bar', 'slice', 'tile', 'cell'. */
  readonly noun: string;
  /**
   * Whether a value is plottable as given. Defaults to "finite and not
   * negative", which is what the five share-of-total families need; the heatmap
   * passes its own, because a negative temperature is perfectly plottable there
   * and a missing one is not.
   */
  readonly plottable?: (value: number) => boolean;
  /** The value a clamped datum takes. @default 0 */
  readonly clampTo?: number;
  /**
   * Why an unplottable value cannot be drawn on THIS chart, and what the reader
   * should take from the ones that remain. Used under `omit` only.
   *
   * ★ Parameterised because the default is a claim about share-of-total charts —
   *   "this chart plots a share of a total, and a missing value cannot be part of
   *   one" — and it was being told to readers of a heatmap, which plots no total
   *   and has no percentages below. A disclosure that misdescribes the chart it
   *   sits under is not much better than no disclosure: the reader now has a
   *   confident, wrong account of what they are looking at.
   *
   * @param described How the missing value reads in prose — see `describeValue`.
   * @param remaining How many items are still plotted.
   */
  readonly omitReason?: (described: string, remaining: number) => string;
}

/** The dataset a chart should plot, and what it must disclose about it. */
export interface SvValuePolicyResult<T> {
  /**
   * What to draw. The **same array reference** when every value was plottable,
   * so the common case allocates nothing and a host's input identity survives
   * change detection.
   */
  readonly items: readonly T[];
  /**
   * Items in `items` whose value was altered, for the visible marker `clamp`
   * promises. A set, not a list, because a heatmap asks this per cell.
   */
  readonly clamped: ReadonlySet<T>;
  /** How many items were left out under `omit`. */
  readonly omitted: number;
  /**
   * One sentence for the chart to render beside the plot, or `null` when nothing
   * was altered and there is nothing to disclose.
   */
  readonly notice: string | null;
  /** Set only under `reject`, for the chart to hand to its error state. */
  readonly error: SvDataError | null;
}

/**
 * `true` for a value a share-of-total chart can plot, and the default predicate.
 *
 * Exported because charts need the same test to decide their empty state: "every
 * value was unplottable and the policy omitted them all" is empty, and
 * `items.length === 0` alone cannot tell that apart from "the host passed
 * nothing", which needs different copy.
 */
export function svIsPlottableShare(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Shared empty set — the untouched result is by far the common one. */
const EMPTY_SET: ReadonlySet<never> = new Set<never>();

/**
 * The policies a share-of-total chart can carry out. See `svResolveShares` for
 * why `render` and `clamp` are not among them.
 */
const SV_SHARE_POLICIES: readonly SvValuePolicy[] = ['omit', 'reject'];

/** The least a share-of-total chart needs from one datum. */
export interface SvSharePoint {
  readonly label: string;
  readonly value: number;
}

/** A share-of-total dataset, resolved: what to plot and what it adds up to. */
export interface SvShareResult<T> extends SvValuePolicyResult<T> {
  /** Sum over `items` — the only correct denominator for a share. */
  readonly total: number;
  /**
   * There are points to plot and they add to nothing. Distinct from "no points":
   * `[0, 0]` is a real answer about a real dataset, and drawing the same "No data
   * to plot" for both tells the reader the fetch failed when it did not.
   */
  readonly allZero: boolean;
}

/**
 * The policy, applied the way every share-of-total chart needs it.
 *
 * Seven components — two pies, three pie variants, two donuts — each wrote
 * `total = slices.reduce((s, x) => s + x.value, 0)` and divided by it. That is
 * the bug, not a step on the way to it: `[10, -5]` totals 5, so the first slice
 * sweeps 720° and laps the second, and `[5, -5]` totals 0, which every one of
 * them reads as "no data" and renders as an empty state over two real values.
 * Neither case warned. This function is what they call instead, so the fix is in
 * one place and the denominator can only ever be a sum over plotted values.
 *
 * `render` is not offered: a circle has no way to draw a negative arc, so a chart
 * claiming it could would be the substitution X-7 exists to prevent.
 *
 * ★★ Neither is `clamp`. Its contract is "plot the nearest drawable value and
 *    MARK the datum", and its notice ends "Marked in the plot." On a share chart
 *    the nearest drawable value is a 0° arc (or, on a polar area chart, a wedge
 *    of radius 0): invisible, so there is nothing to put a marker on, and the
 *    table printed a flat `0` indistinguishable from a real zero. Accepting it
 *    meant every pie, donut and polar chart asserted a marker it never drew. A
 *    host that asks for it gets `omit` — the documented default — with a dev
 *    warning, the same as any other policy a chart cannot carry out.
 */
export function svResolveShares<T extends SvSharePoint>(
  points: readonly T[],
  policy: SvValuePolicy,
  selector: string,
  noun = 'slice',
): SvShareResult<T> {
  const resolved = svApplyValuePolicy(points, {
    value: (p) => p.value,
    clamp: (p, to) => ({ ...p, value: to }),
    policy,
    supported: SV_SHARE_POLICIES,
    fallback: 'omit',
    selector,
    noun,
  });

  let total = 0;
  for (const point of resolved.items) total += point.value;

  const allZero = resolved.items.length > 0 && total === 0;
  const zeroNote = allZero
    ? `Every one of the ${count(resolved.items.length, noun)} is zero, so there is no share to plot.`
    : null;

  return {
    ...resolved,
    total,
    allZero,
    notice:
      resolved.notice && zeroNote
        ? `${resolved.notice} ${zeroNote}`
        : (resolved.notice ?? zeroNote),
  };
}

/** One warning per selector per reason, so 300 bad cells log once. */
const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode || warned.has(key)) return;
  warned.add(key);
  console.warn(`[styloviz] ${message}`);
}

/** `3 slices` / `1 slice` — the disclosure reads as a sentence either way. */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * How a disclosure names a value it could not plot.
 *
 * `${NaN}` is the string `"NaN"`, and a sentence reading "for example NaN" tells a
 * reader the chart received a measurement it disliked. It received nothing: `NaN`
 * is what `Number(row.amount)` returns for a blank cell, and `Infinity` is what a
 * division by a zero denominator returns. Those are absences and arithmetic
 * accidents, and the sentence says which. A real number is quoted as itself,
 * because "-5" is the value the reader will find in their own source data.
 */
function describeValue(value: number): string {
  if (Number.isNaN(value)) return 'a missing value';
  if (value === Infinity) return 'an unbounded value';
  if (value === -Infinity) return 'a negatively unbounded value';
  return `${value}`;
}

/**
 * Resolves what a chart plots, and what it has to say about it.
 *
 * The policy is applied **before** any share-of-total arithmetic, which is the
 * whole point: a denominator computed from the raw input is already wrong, and no
 * amount of per-slice guarding downstream can recover the shares from it.
 *
 * @example
 * ```ts
 * private readonly plotted = computed(() =>
 *   svApplyValuePolicy(this.slices(), {
 *     value: (s) => s.value,
 *     clamp: (s, to) => ({ ...s, value: to }),
 *     policy: this.valuePolicy(),
 *     supported: ['omit', 'reject'],
 *     fallback: 'omit',
 *     selector: 'sv-pie-chart',
 *     noun: 'slice',
 *   }),
 * );
 * // total is a sum over `plotted().items`, never over `slices()`
 * ```
 */
export function svApplyValuePolicy<T>(
  items: readonly T[],
  options: SvValuePolicyOptions<T>,
): SvValuePolicyResult<T> {
  const {
    value,
    clamp,
    supported,
    fallback,
    selector,
    noun,
    plottable = svIsPlottableShare,
    // The share-of-total wording, which is what five families need and what the
    // other two must override. See `omitReason` on the options.
    omitReason = (described, remaining) =>
      `this chart plots a share of a total, and ${described} cannot be part of one. ` +
      `Percentages below are of the remaining ${count(remaining, noun)}.`,
    clampTo = 0,
  } = options;

  let policy = options.policy;
  if (!supported.includes(policy)) {
    warnOnce(
      `${selector}:unsupported:${policy}`,
      `<${selector}> does not support the '${policy}' value policy — it has no way to ` +
        `draw a ${noun} whose value it cannot plot that way. Using '${fallback}' instead. ` +
        `Supported here: ${supported.map((p) => `'${p}'`).join(', ')}.`,
    );
    policy = fallback;
  }

  const offending: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (!plottable(value(items[i]))) offending.push(i);
  }

  if (!offending.length) {
    return { items, clamped: EMPTY_SET as ReadonlySet<T>, omitted: 0, notice: null, error: null };
  }

  const first = value(items[offending[0]]);
  // "for example" only earns its place when there is more than one to choose from.
  const example =
    offending.length === 1 ? describeValue(first) : `for example ${describeValue(first)}`;

  if (policy === 'render') {
    // The chart said it can draw these truthfully, so nothing is altered here —
    // but the reader is still told, because "truthfully" for an unplottable
    // value means a rendering they have not seen before (a hatch, a gap) and a
    // legend for it is the difference between honest and cryptic.
    return {
      items,
      clamped: EMPTY_SET as ReadonlySet<T>,
      omitted: 0,
      notice: `${count(offending.length, noun)} have no value and are drawn as missing.`,
      error: null,
    };
  }

  if (policy === 'reject') {
    return {
      items: [],
      clamped: EMPTY_SET as ReadonlySet<T>,
      omitted: 0,
      notice: null,
      error: {
        message:
          `This chart cannot plot ${count(offending.length, noun)} in the data ` +
          `(${example}), and is set to reject rather than redraw the ` +
          `dataset without them.`,
        code: 'SV_UNPLOTTABLE_VALUE',
        retryable: false,
      },
    };
  }

  if (policy === 'omit') {
    const kept: T[] = [];
    for (const item of items) {
      if (plottable(value(item))) kept.push(item);
    }
    return {
      items: kept,
      clamped: EMPTY_SET as ReadonlySet<T>,
      omitted: offending.length,
      notice:
        `${count(offending.length, noun)} not shown: ` +
        omitReason(describeValue(first), kept.length),
      error: null,
    };
  }

  const out = items.slice();
  const clamped = new Set<T>();
  for (const i of offending) {
    const replacement = clamp(items[i], clampTo);
    out[i] = replacement;
    clamped.add(replacement);
  }
  return {
    items: out,
    clamped,
    omitted: 0,
    notice:
      `${count(offending.length, noun)} shown at ${clampTo} rather than ` +
      `${offending.length === 1 ? 'its' : 'their'} real value (${example}), which this ` +
      `chart cannot plot. Marked in the plot.`,
    error: null,
  };
}
