// ─── Variant ──────────────────────────────────────────────────────────────────

/**
 * All supported bar / column chart variants rendered by the UI Kit.
 *
 * Vertical (column) variants:
 *   column              — single-series basic column chart
 *   grouped-column      — multi-series side-by-side columns
 *   column-placement    — two overlapping series (plan vs actual)
 *   column-drilldown    — click a column to reveal sub-level data
 *   range-column        — floating bar between a low and high value per category
 *   cylindrical-column  — columns with an ellipse cap giving a 3-D feel
 *   rounded-column      — columns with heavily rounded top corners
 *   stacked-column      — multi-series stacked vertically
 *   stacked-column-percent — stacked columns normalized to 100 %
 *
 * Horizontal (bar) variants:
 *   bar                 — single/multi-series horizontal bars
 *   bar-gradient        — horizontal bars with a left→right linear-gradient fill
 *   range-bar           — floating horizontal bar between low and high values
 *   stacked-bar         — multi-series stacked horizontally
 *   stacked-bar-percent — stacked horizontal bars normalized to 100 %
 *   negative-stack      — stacked bar with negative + positive values (population pyramid)
 */
export type BarChartVariant =
  | 'column'
  | 'grouped-column'
  | 'column-placement'
  | 'column-drilldown'
  | 'range-column'
  | 'cylindrical-column'
  | 'rounded-column'
  | 'stacked-column'
  | 'stacked-column-percent'
  | 'bar'
  | 'bar-gradient'
  | 'range-bar'
  | 'stacked-bar'
  | 'stacked-bar-percent'
  | 'negative-stack';

/** Chart orientation — columns grow up; bars grow right (or left for negatives). */
export type BarChartOrientation = 'vertical' | 'horizontal';

// ─── Dataset interfaces ───────────────────────────────────────────────────────

/** Standard dataset used by column, bar, grouped, and stacked variants. */
export interface BarChartDataset {
  /** Series label shown in the legend and tooltip. */
  label: string;
  /** One numeric value per category. */
  data: number[];
  /** Fill color (any valid CSS color). Defaults to auto-palette. */
  color?: string;
  /**
   * Two gradient color stops [startColor, endColor].
   * Used only by the `bar-gradient` variant.
   */
  gradientColors?: [string, string];
  /**
   * Stacking group key. Series sharing the same group stack together.
   * Used by all stacked variants.
   */
  stackGroup?: string;
}

/** Dataset for range-column and range-bar variants. */
export interface RangeChartDataset {
  /** Series label. */
  label: string;
  /** Low and high bound for each category. */
  data: { low: number; high: number }[];
  /** Fill color. Defaults to auto-palette. */
  color?: string;
}

/** A single drilldown level (the sub-chart shown after clicking a column). */
export interface DrilldownLevel {
  /** Title displayed at the top while this level is active. */
  title?: string;
  categories: string[];
  datasets: BarChartDataset[];
}

/**
 * Standard dataset extended with per-category drilldown data.
 * Used by the `column-drilldown` variant.
 */
export interface DrilldownDataset extends BarChartDataset {
  /**
   * Map of category label → sub-level data.
   * Clicking a column switches the chart to the matching sub-level.
   */
  drilldown?: Record<string, DrilldownLevel>;
}

// ─── Options ─────────────────────────────────────────────────────────────────

/** Rendering and feature options shared across all bar / column variants. */
export interface BarChartOptions {
  /** Show horizontal (vertical bars) or vertical (horizontal bars) grid lines. On for `sv-bar-chart`; each bar chart documents its own default on its `options` input (the gradient bar chart turns it off). */
  showGrid?: boolean;
  /** Show axis value labels. @default true */
  showLabels?: boolean;
  /** Show the legend below the chart. @default true */
  showLegend?: boolean;
  /** Show value annotations on / next to each bar. Off for `sv-bar-chart`; each bar chart documents its own default on its `options` input (the gradient bar chart turns it on). */
  showValues?: boolean;
  /** Corner radius applied to bar ends (px). 4 for `sv-bar-chart`; each bar chart documents its own default on its `options` input. */
  barRadius?: number;
  /** Gap fraction between bar groups, as a proportion of group width (0–1). 0.3 for `sv-bar-chart`; each bar chart documents its own default on its `options` input. */
  barGap?: number;
  /** Show a total label on top of each stacked column or at end of stacked bar. @default false */
  showStackTotal?: boolean;
  /**
   * `column-placement` variant: width of the foreground (second) series as a
   * fraction of the background (first) series, which is the wider bar. E.g.
   * 0.5 = the foreground bar is half as wide. Clamped to 0.05–1.
   * @default 0.5
   */
  placementRatio?: number;
  /**
   * `cylindrical-column` variant: height of the ellipse cap as a fraction of
   * the total bar height. @default 0.18
   */
  cylinderCapRatio?: number;
  /** Gradient bar chart: direction of each bar's gradient — along the bar (`'horizontal'`) or across it (`'vertical'`). @default 'horizontal' */
  gradientDirection?: 'horizontal' | 'vertical';
  /** Duration of the bar grow animation in ms. Overrides the default 650 ms. */
  animationDuration?: number;
}

// ─── Internal geometry shapes ─────────────────────────────────────────────────

/** Computed geometry for a single standard bar (column or horizontal bar). */
export interface ComputedBar {
  x: number;
  y: number;
  barW: number;
  barH: number;
  /** Applied corner radius. */
  r: number;
  value: number;
  cat: string;
  series: string;
  color: string;
  seriesIndex: number;
  catIndex: number;
}

/** Computed geometry for a floating range bar (range-column or range-bar). */
export interface ComputedRangeBar {
  x: number;
  y: number;
  barW: number;
  barH: number;
  low: number;
  high: number;
  cat: string;
  series: string;
  color: string;
}

/** Computed geometry for a single segment inside a stacked bar or column. */
export interface ComputedStackSegment {
  x: number;
  y: number;
  barW: number;
  barH: number;
  value: number;
  /** Percent this segment occupies relative to the total stack (0–100). */
  percent: number;
  cat: string;
  series: string;
  color: string;
  /** True when this is the top (column) or rightmost-positive / leftmost-negative (bar) segment. */
  isLast: boolean;
  catIndex: number;
  seriesIndex: number;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

export interface TooltipItem {
  color: string;
  series: string;
  value: number | string;
}

export interface TooltipState {
  visible: boolean;
  /** X in SVG viewBox coordinate space. */
  x: number;
  /** Y in SVG viewBox coordinate space. */
  y: number;
  label: string;
  items: TooltipItem[];
}

// ─── Drilldown runtime state ──────────────────────────────────────────────────

export interface DrilldownState {
  /** Current depth (0 = root level). */
  depth: number;
  /** Breadcrumb labels from root down to the current level. */
  crumbs: string[];
  /** The data currently displayed. */
  current: DrilldownLevel;
}
