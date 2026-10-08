/**
 * scatter-chart.utils.ts — the arithmetic a scatter plot cannot get wrong.
 *
 * A scatter plot is the one chart in the kit whose axes come entirely from the
 * data: there is no category list to fall back on, so both scales are
 * `(v - min) / (max - min)` over whatever the host happened to send. That makes
 * every one of these functions load-bearing, and it is why they live outside the
 * component where they can be tested without a DOM.
 *
 * The axis rounding and tick labelling are NOT here: `svNiceScale` and `svTickLabel`
 * live in `@styloviz/core`, because the box plot needs the same ladder and two
 * charts in one kit that disagree about where a tick belongs is a bug the reader
 * sees.
 */

/** Points that could not be drawn as given, and points drawn on top of each other. */
export interface SvScatterHygiene<T> {
  /** Everything with a finite x and y, in input order. */
  readonly usable: readonly T[];
  /** Dropped for having no position: a non-finite x or y. */
  readonly droppedCoord: number;
  /**
   * Kept, but drawn at the default radius because the supplied `size` was not a
   * usable one. A non-finite radius makes an SVG circle vanish without an error.
   */
  readonly droppedSize: number;
  /** Points sharing an exact coordinate with at least one other point. */
  readonly overlapping: number;
  /** How many distinct coordinates those points are stacked on. */
  readonly overlapSites: number;
}

/** How much of an axis the bulk of the data actually occupies. */
export interface SvScatterCrowding {
  /** Points outside the dense core — the middle 98% of the values. */
  readonly outliers: number;
  /** Share of the drawn axis the dense core spans, `0`–`1`. */
  readonly coreShare: number;
}

/** A subset actually drawn, and the stride that produced it. */
export interface SvScatterSample<T> {
  readonly items: readonly T[];
  /** `1` when everything was kept. Above that, one point in `stride` is drawn. */
  readonly stride: number;
}

/**
 * Separate the points that can be drawn from the ones that cannot, and count the
 * ones drawn on top of each other.
 *
 * ★★ Every one of these used to pass through silently, and all four produce a
 *    picture indistinguishable from a correct one:
 *
 *    - a non-finite x or y poisons `Math.min`/`Math.max`, so the whole axis
 *      becomes `NaN` and EVERY point vanishes — one bad row blanks the chart;
 *    - a non-finite or negative `size` makes that one circle vanish, with the
 *      rest of the plot looking perfectly healthy;
 *    - coincident points cannot be seen at all: the tenth is the same pixels as
 *      the first, so ten rows and one row are the same drawing.
 */
export function svScatterHygiene<T>(
  items: readonly T[],
  accessors: {
    readonly x: (item: T) => number;
    readonly y: (item: T) => number;
    readonly size?: (item: T) => number | undefined;
  },
): SvScatterHygiene<T> {
  const usable: T[] = [];
  let droppedCoord = 0;
  let droppedSize = 0;
  const sites = new Map<string, number>();

  for (const item of items) {
    const x = accessors.x(item);
    const y = accessors.y(item);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      droppedCoord++;
      continue;
    }
    const size = accessors.size?.(item);
    if (size !== undefined && !(Number.isFinite(size) && size > 0)) droppedSize++;
    usable.push(item);
    const key = `${x},${y}`;
    sites.set(key, (sites.get(key) ?? 0) + 1);
  }

  let overlapping = 0;
  let overlapSites = 0;
  for (const count of sites.values()) {
    if (count > 1) {
      overlapping += count;
      overlapSites++;
    }
  }

  return { usable, droppedCoord, droppedSize, overlapping, overlapSites };
}

/**
 * How much of the drawn axis the bulk of the data occupies.
 *
 * ★★ A single extreme value stretches the axis to reach it and squashes every
 *    other point into a corner. The plot is not wrong — that IS where the data is
 *    — but it is unreadable, and nothing about it says the readable version is one
 *    filter away. This measures the middle 98% against the drawn span so the chart
 *    can say "two points are holding 95% of this axis empty".
 *
 * `values` need not be sorted. Fewer than three values has no meaningful core, so
 * the whole axis counts as core and nothing is an outlier.
 */
export function svScatterCrowding(
  values: readonly number[],
  axisMin: number,
  axisMax: number,
): SvScatterCrowding {
  const finite = values.filter(v => Number.isFinite(v));
  const span = axisMax - axisMin;
  if (finite.length < 3 || !(span > 0)) return { outliers: 0, coreShare: 1 };

  const sorted = [...finite].sort((a, b) => a - b);
  const lo = quantile(sorted, 0.01);
  const hi = quantile(sorted, 0.99);
  const outliers = sorted.filter(v => v < lo || v > hi).length;
  return { outliers, coreShare: Math.min(1, Math.max(0, (hi - lo) / span)) };
}

function quantile(sorted: readonly number[], p: number): number {
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

/**
 * Take at most `limit` items, spread evenly across the input.
 *
 * ★★ `slice(0, limit)` is the obvious version and it is a different chart. Feeds
 *    arrive sorted — by date, by id, by the value being plotted — so the first
 *    5,000 of 50,000 rows is the first tenth of the RANGE, not a tenth of the
 *    cloud, and the plot draws a confident picture of a subset the reader was
 *    never told about. A fixed stride keeps the shape of the whole.
 *
 * `limit` of zero or less means "no cap": everything is returned with a stride
 * of 1.
 */
export function svSystematicSample<T>(
  items: readonly T[],
  limit: number,
): SvScatterSample<T> {
  if (!Number.isFinite(limit) || limit <= 0 || items.length <= limit) {
    return { items, stride: 1 };
  }
  const stride = Math.ceil(items.length / limit);
  const kept: T[] = [];
  for (let i = 0; i < items.length; i += stride) kept.push(items[i]);
  return { items: kept, stride };
}
