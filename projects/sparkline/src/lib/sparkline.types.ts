/**
 * How the series is drawn.
 *
 * | Variant   | Encodes                | Reach for it when                          |
 * |-----------|------------------------|--------------------------------------------|
 * | `line`    | shape of the trend     | the series sits inline next to text        |
 * | `area`    | shape + magnitude      | the value is a volume, not a rate          |
 * | `bar`     | discrete magnitudes    | points are counts, not samples over time   |
 * | `winloss` | direction only         | outcomes are binary — up days vs down days |
 */
export type SparklineVariant = 'line' | 'area' | 'bar' | 'winloss';

/**
 * Colour source. `auto` compares the last value with the first and resolves to
 * `positive` or `negative`, which is what a trend sparkline almost always wants.
 */
export type SparklineTone =
  | 'auto'
  | 'primary'
  | 'positive'
  | 'warning'
  | 'negative'
  | 'neutral';

/**
 * A point may be a bare number or carry a label used in the accessible summary.
 *
 * ★ `null` / `undefined` / `NaN` / `Infinity` are all *missing*, and the union
 * says so rather than making a host pre-clean the series — pre-cleaning is
 * exactly how a gap gets silently dropped and the x axis rewritten. What
 * happens to a missing sample is the `missing` input's decision.
 */
export type SparklineDatum =
  | number
  | null
  | undefined
  | { readonly value: number | null | undefined; readonly label?: string };

/** A resolved point in SVG user space. */
export interface SparklinePoint {
  readonly x: number;
  readonly y: number;
  /** Index in the source series. */
  readonly i: number;
  /** Original value, before normalisation. */
  readonly value: number;
  /**
   * The value fell outside a pinned domain and its `y` was clamped to the edge.
   *
   * ★ Without the clamp the point projected off-canvas and the viewBox simply
   * cut the line out of the chart with nothing said. A shared domain across a
   * table column makes this common, not rare: one row's spike is outside the
   * range every other row agreed on.
   */
  readonly clipped?: boolean;
}

/** A resolved bar in SVG user space, for the `bar` and `winloss` variants. */
export interface SparklineBar {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly i: number;
  readonly value: number;
  /** True when the value sits at or above the baseline. */
  readonly positive: boolean;
}

/** Summary of a series — drives the automatic `aria-label`. */
export interface SparklineStats {
  readonly count: number;
  readonly first: number;
  readonly last: number;
  readonly min: number;
  readonly max: number;
  /** Index of the smallest and largest value (first occurrence). */
  readonly minIndex: number;
  readonly maxIndex: number;
  /** Sign of `last - first`. */
  readonly direction: 'up' | 'down' | 'flat';
  /** Percentage change from first to last; `null` when `first` is 0. */
  readonly changePct: number | null;
}
