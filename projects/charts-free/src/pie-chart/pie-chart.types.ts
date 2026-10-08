import type { SvShareOrder } from '@styloviz/core';

/**
 * Shared types for all Pie Chart variants.
 *
 * Consumed by:
 *  - DefaultPieChartComponent
 *  - PieRadiusChartComponent
 *  - PieLegendTemplateChartComponent
 *  - SmartLabelsPieChartComponent
 */

// ─── Data Model ───────────────────────────────────────────────────────────────

export interface PieSlice {
  /** Display label for this slice. */
  readonly label: string;
  /** Numeric value (absolute, not percentage). */
  readonly value: number;
  /** Optional fill color (CSS color string). Falls back to the default palette. */
  readonly color?: string;
  /**
   * Optional extra description shown in the legend template variant.
   * e.g. "↑ 12% vs last month"
   */
  readonly description?: string;
}

/** A slice that can also specify its own outer-radius fraction. */
export interface PieRadiusSlice extends PieSlice {
  /**
   * Outer-radius multiplier (0.5 – 1.0).
   * 1.0 = full chart radius; 0.8 = 80%.  @default 1.0
   */
  readonly radius?: number;
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface PieChartBaseOptions {
  /**
   * Slice order around the circle.
   *
   * `'value'` puts the largest first, which is the arrangement a pie is easiest
   * to read in: the eye compares neighbouring arcs rather than arcs on opposite
   * sides of the circle, which is the comparison people are worst at.
   * `'input'` (the default) keeps the host's order, which is what a chart with a
   * natural sequence — stages, months, grades — needs.
   * @default 'input'
   */
  sliceOrder?: SvShareOrder;
  /**
   * Fold every slice below this share of the total into one `Other` slice,
   * `0`–`1`.
   *
   * Off by default. Past roughly eight slices the ones at the end are a few
   * degrees each — unlabellable, indistinguishable and barely clickable — and
   * the only fact about them a reader can use is what they came to together.
   * A single small slice is never folded: an `Other` of one is that slice with
   * its name taken away.
   * @default 0
   */
  groupBelow?: number;
  /**
   * Keep at most this many slices, folding the rest into `Other`. Applied after
   * `groupBelow` and against the ordered list, so a chart sorted by value keeps
   * its largest slices.
   * @default 0 — no cap
   */
  maxSlices?: number;
  /** Label for the aggregate slice. @default 'Other' */
  otherLabel?: string;
  /** Show legend. @default true */
  showLegend?: boolean;
  /** Show tooltip on hover. @default true */
  showTooltip?: boolean;
  /** Gap between slices in degrees. @default 1.5 */
  sliceGap?: number;
  /** Duration of the entrance animation in ms. @default 700 */
  animationDuration?: number;
}

export interface DefaultPieChartOptions extends PieChartBaseOptions {
  /** Push hovered slice outward (explode). @default true */
  explodeOnHover?: boolean;
  /** Pixels to offset the exploded slice. @default 10 */
  explodeOffset?: number;
}

export interface PieRadiusChartOptions extends PieChartBaseOptions {
  /** Explode on hover. @default true */
  explodeOnHover?: boolean;
  /** Explode offset in px. @default 8 */
  explodeOffset?: number;
}

export interface PieLegendTemplateOptions extends PieChartBaseOptions {
  /** Legend position. @default 'right' */
  legendPosition?: 'right' | 'bottom';
  /** Show percentage column. @default true */
  showPercentage?: boolean;
  /** Show value column. @default true */
  showValue?: boolean;
  /** Show description (if supplied per slice). @default true */
  showDescription?: boolean;
}

export interface SmartLabelsOptions extends PieChartBaseOptions {
  /** Show connector lines from slice to label. @default true */
  showConnectors?: boolean;
  /** Show percentage in label. @default true */
  showPercentage?: boolean;
  /** Show value in label. @default false */
  showValue?: boolean;
  /** Minimum label font size. @default 11 */
  fontSize?: number;
}

// ─── Internal geometry ────────────────────────────────────────────────────────

export interface ArcData {
  readonly path: string;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly midAngle: number;
  readonly outerR: number;
  readonly cx: number;
  readonly cy: number;
}

export interface LabelPoint {
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
}

export interface TooltipState {
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly value: number;
  readonly pct: string;
  readonly color: string;
}
