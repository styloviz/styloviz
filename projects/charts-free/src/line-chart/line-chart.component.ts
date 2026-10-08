import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  SvChartAnimDirective,
  SvChartFrameComponent,
  SvDataSummaryTableComponent,
  type SvDataError,
  type SvDataSummary,
  svFiniteExtent,
  svGapNotice,
  svGapRuns,
  svIsGap,
  svUniqueId,
} from '@styloviz/core';

/**
 * What the table and tooltip print for a gap.
 *
 * ★ Never `0` and never `NaN`: `0` asserts a measurement nobody took, and `NaN`
 *   leaks an implementation detail into the reader's sentence. Same wording as
 *   the heatmap's missing square.
 */
const GAP_TEXT = 'No reading';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Visual rendering style of the chart.
 *
 * - `'line'`            — Straight-segment multi-series line chart
 * - `'spline'`          — Smooth Catmull-Rom bezier curves
 * - `'step'`            — Step-wise horizontal → vertical connections
 * - `'stacked'`         — Cumulative stacked values across series
 * - `'stacked-percent'` — 100% stacked (each category normalised to 100%)
 * - `'inversed'`        — Transposed: categories on Y-axis, values on X-axis
 */
export type LineChartType =
  | 'line'
  | 'spline'
  | 'step'
  | 'stacked'
  | 'stacked-percent'
  | 'inversed';

/** Shape of data-point markers. */
export type LineChartMarkerShape = 'circle' | 'square' | 'diamond' | 'triangle';

/**
 * A value-range zone that colors part of a series line differently.
 *
 * Example — three zones on a precipitation chart:
 * ```ts
 * zones: [
 *   { end: 50,             color: '#ef4444', label: 'Low'    },
 *   { start: 50, end: 70,  color: '#f59e0b', label: 'Medium' },
 *   { start: 70,           color: '#10b981', label: 'High'   },
 * ]
 * ```
 */
export interface LineChartZone {
  /** Lower bound (inclusive). Omit for −∞. */
  start?: number;
  /** Upper bound (inclusive). Omit for +∞. */
  end?: number;
  /** Stroke color for this zone. */
  color: string;
  /** Optional dash pattern for this zone (e.g. `'6,3'`). */
  dashArray?: string;
  /** Label shown in the zone legend chip. */
  label?: string;
}

/** A reference line annotation drawn on the chart. */
export interface LineChartAnnotation {
  /** `'horizontal'` — horizontal reference line at a Y value.
   *  `'vertical'`   — vertical reference line at a category index. */
  type: 'horizontal' | 'vertical';
  /** Y-value for horizontal; category index (0-based) for vertical. */
  value: number;
  /** Text label. */
  label: string;
  /** Line + text color. @default '#6b7280' */
  color?: string;
}

/** A single data series. */
export interface LineChartSeries {
  /** Display name shown in legend and tooltip. */
  label: string;
  /**
   * The readings, one per category.
   *
   * `null` is a GAP — a reading that was not taken. The line breaks there
   * rather than joining across it, because joining invents a value nobody
   * recorded and sending `0` instead asserts one. `NaN` and `Infinity` are
   * treated the same way: a chart cannot tell a sensor fault from a
   * `parseFloat('n/a')`, and both used to blank the entire series.
   */
  data: (number | null)[];
  /** Stroke color. Defaults to the built-in palette. */
  color?: string;
  /** Fill the area under the line with a semi-transparent gradient. @default false */
  fill?: boolean;
  /**
   * Use smooth Catmull-Rom bezier curves.
   * When `chartType` is `'spline'` all series are always smooth.
   * @default false
   */
  smooth?: boolean;
  /** Stroke width in px. @default 2 */
  strokeWidth?: number;
  /**
   * SVG `stroke-dasharray` pattern (e.g. `'6,3'`).
   * Use to distinguish projected / estimated data from solid historical data.
   */
  dashArray?: string;
  /**
   * Milliseconds to delay the draw animation.
   * Set increasing values across series for a staggered reveal.
   * @default 0
   */
  animationDelay?: number;
  /**
   * Per-data-point color overrides.
   * The line is rendered as individually colored segments between each pair of points.
   */
  pointColors?: string[];
  /**
   * Value-range zones for multi-colored line coloring (line-zone variant).
   * Each zone clips the full series path to its value range.
   */
  zones?: LineChartZone[];
  /** Shape of the marker at each data point. @default 'circle' */
  markerShape?: LineChartMarkerShape;
}

/** Chart-wide display options. */
export interface LineChartOptions {
  /** Show horizontal grid lines. @default true */
  showGrid?: boolean;
  /** Show axis value labels. @default true */
  showLabels?: boolean;
  /** Show the series legend below the chart. @default true */
  showLegend?: boolean;
  /** Show data-point markers. @default true */
  showDots?: boolean;
  /** Number of horizontal grid divisions. @default 5 */
  gridDivisions?: number;
  /** Animate the line draw-on when first rendered. @default true */
  animated?: boolean;
  /** Duration of the draw-on animation in ms. @default 1400 */
  animationDuration?: number;
  /** Show a vertical crosshair line on hover. @default true */
  showCrosshair?: boolean;
  /** Show value labels on each data point. @default false */
  showDataLabels?: boolean;
  /** Reference annotations drawn as horizontal or vertical lines. */
  annotations?: LineChartAnnotation[];
  /** Optional label for the Y-axis. */
  yAxisTitle?: string;
  /** Optional label for the X-axis. */
  xAxisTitle?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_COLORS: readonly string[] = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
  '#14b8a6', // teal-500
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LineChartComponent — A pure-SVG line chart with 6 visual types and 10 demo variants.
 *
 * Supported chart types (via `chartType` input):
 * - `'line'`            — Straight-segment multi-series line
 * - `'spline'`          — Smooth Catmull-Rom bezier curves
 * - `'step'`            — Step-wise horizontal→vertical connections
 * - `'stacked'`         — Cumulative stacked lines (with optional fill bands)
 * - `'stacked-percent'` — 100% normalised stacked
 * - `'inversed'`        — Transposed axes (categories on Y, values on X)
 *
 * Additional per-series features:
 * - `dashArray`      — dashed / projected segments (Dashed Line variant)
 * - `animationDelay` — staggered draw animation (Custom Animation variant)
 * - `pointColors`    — per-point multicolor line (Multi Colored Line variant)
 * - `zones`          — value-range zone coloring via SVG clipPath (Line Zone variant)
 * - `markerShape`    — circle | square | diamond | triangle
 *
 * @example
 * ```html
 * <sv-line-chart
 *   chartType="spline"
 *   title="Temperature Trends"
 *   [categories]="months"
 *   [series]="tempSeries"
 *   [options]="{ animated: true, showCrosshair: true }"
 * />
 * ```
 */

@Component({
  selector: 'sv-line-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartAnimDirective,
    SvChartFrameComponent,
    SvDataSummaryTableComponent,
  ],
  templateUrl: './line-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvLineChartComponent {
  /** Per-instance suffix for every id this component puts in the document. */
  readonly _uid = svUniqueId('sv-line-chart');


  // ── Async state ─────────────────────────────────────────────────────────────

  /** True while the series are being fetched. @default false */
  readonly loading = input<boolean>(false);

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an
   * `HttpErrorResponse`.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /** Copy for the empty state. @default 'No data to plot' */
  readonly emptyMessage = input<string>('No data to plot');

  /**
   * Whether a filter, not an absence of data, is why the chart is empty.
   * @default false
   */
  readonly filtered = input<boolean>(false);

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  /** Nothing to plot. */
  readonly chartIsEmpty = computed(() => this.series().length === 0);

  // ── Inputs ───────────────────────────────────────────────────────────────

  /** Category labels shown on the axis. */
  categories = input<string[]>([]);

  /** Data series. */
  series = input<LineChartSeries[]>([]);

  /** Visual chart type. @default 'line' */
  chartType = input<LineChartType>('line');

  /** Chart title. */
  title = input<string>('');

  /** Chart subtitle / source attribution shown below the title. */
  subtitle = input<string>('');

  /** Chart height in px. @default 300 */
  height = input<number>(300);

  /** Chart-wide display options. */
  options = input<LineChartOptions>({});

  /** Additional CSS classes on the root element. */
  customClass = input<string>('');

  /**
   * Accessible-name override for the chart image. When empty, a concise data
   * summary is generated; the full data is exposed via a visually-hidden table.
   * @default ''
   */
  ariaLabel = input<string>('');

  // ── Accessibility ───────────────────────────────────────────────────────────

  /** Concise summary used as the chart's accessible name. */
  readonly chartDescription = computed<string>(() => {
    const cats = this.categories();
    const sets = this.series();
    const base = this.title() || 'Line chart';
    if (!cats.length || !sets.length) return base;
    const names = sets.map(s => s.label).filter(Boolean).join(', ');
    const seriesPart = sets.length === 1
      ? (names ? `series ${names}` : '1 series')
      : `${sets.length} series${names ? ` (${names})` : ''}`;
    return `${base}: ${seriesPart} across ${cats.length} point${cats.length === 1 ? '' : 's'}.`;
  });

  /** Resolved accessible name — explicit override or the generated summary. */
  readonly resolvedAriaLabel = computed<string>(() => this.ariaLabel() || this.chartDescription());

  /**
   * Cell value for the screen-reader data table.
   *
   * ★ A gap reads as a gap. `?? 0` here printed a missing reading as "0" — a
   *   measurement nobody took — and let `NaN` through as the word "NaN".
   */
  cellValue(seriesIndex: number, catIndex: number): string {
    return this.formatReading(this.series()[seriesIndex]?.data[catIndex]);
  }

  /**
   * The line as rows — one point per row, one column per series.
   *
   * ★ The pro twin slices this to its visible zoom window and adds a "showing
   *   6–15 of 40" overview. There is no `zoomable` here, so every point is on
   *   screen and both would be describing a window that does not exist.
   */
  protected readonly a11ySummary = computed<SvDataSummary>(() => {
    const sets = this.series();
    return {
      caption: this.title() || 'Line chart',
      columns: ['Point', ...sets.map((s) => s.label)],
      rows: this.categories().map((cat, ci) => ({
        key: cat,
        header: cat,
        cells: sets.map((_, si) => this.cellValue(si, ci)),
      })),
    };
  });

  // ── Internal state ───────────────────────────────────────────────────────

  readonly tooltip = signal<{
    visible: boolean;
    x: number; y: number;
    crossX: number; crossY: number;
    catIndex: number;
    label: string;
    /** `null` is a gap at this category — printed as a gap, never as `0`. */
    items: { color: string; series: string; value: number | null }[];
  }>({
    visible: false,
    x: 0, y: 0,
    crossX: 0, crossY: 0,
    catIndex: -1,
    label: '',
    items: [],
  });

  // ── Chart geometry ────────────────────────────────────────────────────────

  readonly SVG_WIDTH = 600;  readonly PAD = { top: 28, right: 24, bottom: 52, left: 56 };

  /** Padding for inversed layout — wider left margin for category labels. */
  readonly PAD_INV = { top: 24, right: 40, bottom: 44, left: 130 };

  svgHeight  = computed(() => this.height());
  isInversed = computed(() => this.chartType() === 'inversed');

  // Normal layout
  plotW = computed(() => this.SVG_WIDTH   - this.PAD.left     - this.PAD.right);
  plotH = computed(() => this.svgHeight() - this.PAD.top      - this.PAD.bottom);

  // Inversed layout
  plotW_inv = computed(() => this.SVG_WIDTH   - this.PAD_INV.left - this.PAD_INV.right);
  plotH_inv = computed(() => this.svgHeight() - this.PAD_INV.top  - this.PAD_INV.bottom);

  // ── Resolved options ─────────────────────────────────────────────────────

  showGrid       = computed(() => this.options().showGrid       ?? true);
  showLabels     = computed(() => this.options().showLabels     ?? true);
  showLegend     = computed(() => this.options().showLegend     ?? true);
  showDots       = computed(() => this.options().showDots       ?? true);
  gridDivisions  = computed(() => this.options().gridDivisions  ?? 5);
  animated       = computed(() => this.options().animated       ?? true);
  animDuration   = computed(() => { const d = this.options().animationDuration; return d != null ? d + 'ms' : null; });
  showCrosshair  = computed(() => this.options().showCrosshair  ?? true);
  showDataLabels = computed(() => this.options().showDataLabels ?? false);
  annotations    = computed(() => this.options().annotations    ?? []);
  yAxisTitle     = computed(() => this.options().yAxisTitle     ?? '');
  xAxisTitle     = computed(() => this.options().xAxisTitle     ?? '');

  // ── Data processing ──────────────────────────────────────────────────────

  seriesColors = computed<string[]>(() =>
    this.series().map((s, i) => s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length])
  );

  /** Cumulative stacked data [seriesIndex][catIndex] — used by `'stacked'`. */
  stackedData = computed<number[][]>(() => {
    const series = this.series();
    const result: number[][] = [];
    for (let si = 0; si < series.length; si++) {
      result.push(series[si].data.map((v, ci) => {
        // ★ A STACK CANNOT HONOUR A GAP. Every band above this one is positioned
        //   by the running total, so a missing reading has to count as zero for
        //   the stack to add up at all — which substitutes a number the host did
        //   not send. It is unavoidable and therefore disclosed: `gapNote` says
        //   so in words whenever the chart is stacked.
        let sum = svIsGap(v) ? 0 : (v as number);
        for (let prev = 0; prev < si; prev++) {
          const below = series[prev].data[ci];
          sum += svIsGap(below) ? 0 : (below as number);
        }
        return sum;
      }));
    }
    return result;
  });

  /** 100%-normalised stacked data — used by `'stacked-percent'`. */
  stackedPercentData = computed<number[][]>(() => {
    const series = this.series();
    const n      = series[0]?.data.length ?? 0;
    const totals = Array.from({ length: n }, (_, ci) =>
      series.reduce((sum, s) => sum + (svIsGap(s.data[ci]) ? 0 : (s.data[ci] as number)), 0)
    );
    const result: number[][] = [];
    for (let si = 0; si < series.length; si++) {
      const prev = si > 0 ? result[si - 1] : null;
      result.push(series[si].data.map((v, ci) => {
        const base = prev ? prev[ci] : 0;
        const value = svIsGap(v) ? 0 : (v as number);
        return base + (totals[ci] > 0 ? (value / totals[ci]) * 100 : 0);
      }));
    }
    return result;
  });

  /** Y-data used for rendering (dispatches to raw / stacked / stacked-%). */
  effectiveData = computed<(number | null)[][]>(() => {
    const type = this.chartType();
    if (type === 'stacked')         return this.stackedData();
    if (type === 'stacked-percent') return this.stackedPercentData();
    return this.series().map(s => s.data);
  });

  /**
   * Floor data for stacked fill bands.
   * Series 0 → all zeros; series i → stacked line of series i-1.
   */
  stackedBaseData = computed<number[][]>(() => {
    const type = this.chartType();
    const n    = this.categories().length;
    if (type !== 'stacked' && type !== 'stacked-percent') {
      return this.series().map(() => Array(n).fill(0) as number[]);
    }
    const stacked = type === 'stacked' ? this.stackedData() : this.stackedPercentData();
    return stacked.map((_, si) =>
      si === 0 ? (Array(n).fill(0) as number[]) : stacked[si - 1]
    );
  });

  // ── Axis bounds ──────────────────────────────────────────────────────────

  rawMax = computed<number>(() => {
    const type = this.chartType();
    if (type === 'stacked-percent') return 100;
    if (type === 'stacked') {
      return Math.max(this.stackedData().reduce((m, row) => Math.max(m, ...row), 0), 1);
    }
    // ★ REGRESSION — this was `Math.max(...data, 1)`, and `Math.max` of anything
    //   containing `NaN` is `NaN`. One unusable reading made the axis maximum
    //   `NaN`, so EVERY point's y came back `NaN` and the whole series rendered
    //   as `M 0 NaN L 173 NaN …`, which SVG draws as nothing at all. Measured on
    //   four points with one gap: the entire line vanished, silently.
    const max = svFiniteExtent(this.series().flatMap(s => s.data)).max;
    return Math.max(max ?? 0, 1);
  });

  rawMin = computed<number>(() => {
    if (this.chartType() === 'stacked-percent') return 0;
    const min = svFiniteExtent(this.series().flatMap(s => s.data)).min;
    return Math.min(min ?? 0, 0);
  });

  /**
   * How many readings are missing, across every series.
   *
   * Counted over the RAW series rather than `effectiveData`, because stacking
   * substitutes a zero for a gap and counting after that would report none.
   */
  readonly gapCount = computed<number>(
    () => svFiniteExtent(this.series().flatMap(s => s.data)).gaps,
  );

  /**
   * What the breaks in the lines mean, or `null` when there are none.
   *
   * ★ A break is genuinely ambiguous on sight — "no data here" to one reader, a
   *   rendering glitch to another, and easy to miss entirely at one missing
   *   point in a dense series. Saying how many there are turns it from something
   *   to interpret into something the reader has been told.
   */
  readonly gapNote = computed<string | null>(() => {
    const stacked = this.chartType() === 'stacked' || this.chartType() === 'stacked-percent';
    const total = this.series().reduce((n, s) => n + s.data.length, 0);
    return svGapNotice(this.gapCount(), total, stacked);
  });

  axisMin = computed<number>(() => {
    const mn = this.rawMin();
    if (mn >= 0) return 0;
    const exp = Math.pow(10, Math.floor(Math.log10(Math.abs(mn))));
    return Math.floor(mn / exp) * exp;
  });

  axisMax = computed<number>(() => {
    const mv = this.rawMax();
    // ★ EQUIVALENT MUTANT — unreachable, kept as a belt on top of braces.
    // `rawMax` is `Math.max(…, 1)` on both of its data arms and a literal 100 on
    // the percentage arm, so `mv` is never <= 0 and no input distinguishes this
    // line from its absence. Deleting it is safe today and dangerous the moment
    // the floor in `rawMax` moves, which is why it stays.
    if (mv <= 0) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(mv)));
    return Math.ceil(mv / exp) * exp;
  });

  gridValues = computed<number[]>(() => {
    const min  = this.axisMin();
    const max  = this.axisMax();
    const div  = this.gridDivisions();
    const step = (max - min) / div;
    return Array.from({ length: div + 1 }, (_, i) =>
      parseFloat((min + step * i).toFixed(4))
    );
  });

  // ── Coordinate helpers — Normal layout ───────────────────────────────────

  xForIndex(i: number): number {
    const n = this.categories().length;
    return n <= 1 ? this.plotW() / 2 : (i / (n - 1)) * this.plotW();
  }

  yForValue(v: number): number {
    const range = this.axisMax() - this.axisMin();
    // ★ EQUIVALENT MUTANT — see `axisMax` above. `axisMax` is >= 1 and `axisMin`
    // is <= 0 for every possible input, so `range` is >= 1 and this arm cannot
    // be reached. It guards the divide-by-zero that WOULD appear if either
    // bound ever gained a data-driven path to zero.
    if (range === 0) return this.plotH() / 2;
    return this.plotH() - ((v - this.axisMin()) / range) * this.plotH();
  }

  gridLineY(val: number): number { return this.yForValue(val); }

  // ── Coordinate helpers — Inversed layout ─────────────────────────────────

  xForValue_inv(v: number): number {
    const range = this.axisMax() - this.axisMin();
    // ★ EQUIVALENT MUTANT — the inversed twin of the guard in `yForValue`, and
    // unreachable for the same reason.
    if (range === 0) return this.plotW_inv() / 2;
    return ((v - this.axisMin()) / range) * this.plotW_inv();
  }

  yForIndex_inv(i: number): number {
    const n = this.categories().length;
    return n <= 1 ? this.plotH_inv() / 2 : (i / (n - 1)) * this.plotH_inv();
  }

  gridLineX_inv(val: number): number { return this.xForValue_inv(val); }

  // ── SVG path builders ─────────────────────────────────────────────────────

  /**
   * A smooth (Catmull-Rom) or straight SVG path — one `<path>` per contiguous
   * run of readings, joined into a single `d`.
   *
   * ★ Each run starts with its own `M`, which is what makes the line BREAK at a
   *   gap instead of joining across it. One element, several subpaths — so the
   *   template, the stroke and the animation are all unchanged.
   */
  buildPath(pts: { x: number; y: number }[], smooth: boolean): string {
    return this.buildRun(pts, smooth);
  }

  /** Build one unbroken run. */
  private buildRun(pts: { x: number; y: number }[], smooth: boolean): string {
    if (pts.length === 0) return '';
    // A reading with a gap on both sides is a run of one. A bare `M` paints
    // nothing, so with dots off the reading vanished; a zero-length segment
    // takes the round line cap and draws it as a dot the width of the line.
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} h 0`;
    if (!smooth) return 'M ' + pts.map(p => `${p.x} ${p.y}`).join(' L ');

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[Math.max(i - 2, 0)];
      const p1 = pts[i - 1];
      const p2 = pts[i];
      const p3 = pts[Math.min(i + 1, pts.length - 1)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
    }
    return d;
  }

  /** Build a step-line path (horizontal then vertical), broken at every gap. */
  buildStepPath(data: readonly (number | null)[]): string {
    return this.runsOf(data)
      .map(pts => {
        let d = `M ${pts[0].x} ${pts[0].y}`;
        if (pts.length === 1) return `${d} h 0`; // an isolated reading — see buildRun
        for (let i = 1; i < pts.length; i++) d += ` H ${pts[i].x} V ${pts[i].y}`;
        return d;
      })
      .join(' ');
  }

  /**
   * The stretches of a series that can actually be drawn, as plot coordinates.
   *
   * The ORIGINAL index is what becomes x — re-indexing the survivors would slide
   * every point after a gap to the left and quietly redate the whole right-hand
   * side of the chart.
   */
  private runsOf(data: readonly (number | null)[]): { x: number; y: number }[][] {
    return svGapRuns(data, (v, i) => ({ x: this.xForIndex(i), y: this.yForValue(v) }));
  }

  /** Whether a series uses smooth curves. */
  isSmooth(s: LineChartSeries): boolean {
    return this.chartType() === 'spline' || s.smooth === true;
  }

  /**
   * ★ GUARD THE SERIES, NOT ONLY ITS DATA.
   *
   * This and the two accessors below defended `effectiveData()[si]` with `?? []`
   * — an index that no longer has a row — and then dereferenced
   * `this.series()[si]` on the very next line without any guard at all. Both
   * arrays are built one-to-one from `series()`, so the `??` fired for exactly
   * the indices where `s` was `undefined`, and `isSmooth(s)` threw
   * "Cannot read properties of undefined (reading 'smooth')" before the fallback
   * could do anything. The guard could never succeed.
   *
   * Reachable whenever the series list shortens while a template still holds the
   * old index — one change-detection pass, which is long enough to throw out of
   * a `@for` body and blank the whole chart rather than one line.
   */
  /** Full series path dispatching by chartType. */
  seriesPath(si: number): string {
    const s = this.series()[si];
    if (!s) return '';
    const data = this.effectiveData()[si];
    if (this.chartType() === 'step') return this.buildStepPath(data);
    const smooth = this.isSmooth(s);
    return this.runsOf(data).map(run => this.buildRun(run, smooth)).join(' ');
  }

  /** Fill area — down to y=0 for simple series, or to the previous stacked line. */
  fillPath(si: number): string {
    const s      = this.series()[si];
    if (!s) return '';
    const data   = this.effectiveData()[si];
    const isStep = this.chartType() === 'step';
    const smooth = !isStep && this.isSmooth(s);
    const isStk  = this.chartType() === 'stacked' || this.chartType() === 'stacked-percent';
    // `si` is known good — the guard above returned for anything else — and
    // `stackedBaseData` is built one-to-one from `series()`, so no fallback is
    // needed here any more.
    const base   = isStk ? this.stackedBaseData()[si] : [];

    if (data.length === 0) return '';

    // ★ ONE CLOSED SHAPE PER RUN, not one shape spanning the gaps. A single
    //   `Z` around the whole series would fill straight across a break — the
    //   area under a stretch of missing readings, drawn as if it had been
    //   measured, which is precisely the claim the break exists to avoid.
    const runs = svGapRuns(data, (v, i) => ({ x: this.xForIndex(i), y: this.yForValue(v), i }));
    if (runs.length === 0) return '';

    const bPts = isStk && base.length > 0
      ? base.map((v, i) => ({ x: this.xForIndex(i), y: this.yForValue(svIsGap(v) ? 0 : (v as number)) }))
      : null;

    return runs
      .map(run => {
        const topPath = isStep
          ? this.buildStepPath(data.map((v, i) =>
              i >= run[0].i && i <= run[run.length - 1].i ? v : null))
          : this.buildRun(run, smooth);
        if (!topPath) return '';

        if (bPts) {
          // Walk the floor back under this run only, so the band closes against
          // the stack beneath the readings it actually covers.
          const under = run.map(p => bPts[p.i]).reverse();
          const lastB = under[0];
          const rev = under.map(p => `L ${p.x} ${p.y}`).join(' ');
          return `${topPath} L ${lastB.x} ${lastB.y} ${rev} Z`;
        }

        const first = run[0];
        const last = run[run.length - 1];
        return `${topPath} L ${last.x} ${this.plotH()} L ${first.x} ${this.plotH()} Z`;
      })
      .filter(Boolean)
      .join(' ');
  }

  /** Dot descriptors for a series. */
  dots(si: number): { x: number; y: number; value: number; color: string; ci: number }[] {
    const s         = this.series()[si];
    // ★ EQUIVALENT MUTANT — unlike its two siblings above, this guard cannot be
    // observed: with no series the data row is empty too, so the `map` body
    // (the only place `s` is read) never runs and the old `?? []` returned the
    // same empty array. It is kept so all three accessors fail the same way,
    // and so the day a caller reads `s` before the map it is already safe.
    if (!s) return [];
    const data      = this.effectiveData()[si];
    const baseColor = this.seriesColors()[si];
    // A marker at a gap would be a dot at a value nobody reported.
    return svGapRuns(data, (v, i) => ({
      x:     this.xForIndex(i),
      y:     this.yForValue(v),
      value: v,
      color: s.pointColors?.[i] ?? baseColor,
      ci:    i,
    })).flat();
  }

  /** Individual colored segments for the multicolor line variant. */
  multiColorSegments(si: number): { d: string; color: string }[] {
    const s         = this.series()[si];
    if (!s) return [];
    const data      = s.data;
    const baseColor = this.seriesColors()[si];
    const segs: { d: string; color: string }[] = [];
    for (let i = 1; i < data.length; i++) {
      // A segment with a gap at either end has nothing to join.
      if (svIsGap(data[i - 1]) || svIsGap(data[i])) continue;
      const x1 = this.xForIndex(i - 1), y1 = this.yForValue(data[i - 1] as number);
      const x2 = this.xForIndex(i),     y2 = this.yForValue(data[i] as number);
      segs.push({ d: `M ${x1} ${y1} L ${x2} ${y2}`, color: s.pointColors?.[i] ?? baseColor });
    }
    return segs;
  }

  /** Clip-rect geometry for a zone. */
  zoneClipRect(si: number, zi: number): { y: number; height: number } {
    const zone = this.series()[si].zones![zi];
    const pH   = this.plotH();
    const topY = zone.end   !== undefined ? this.yForValue(zone.end)   : 0;
    const botY = zone.start !== undefined ? this.yForValue(zone.start) : pH;
    return { y: topY, height: Math.max(0, botY - topY) };
  }

  zoneClipId(si: number, zi: number): string { return `lc-zone-${this._uid}-${si}-${zi}`; }

  // ── Inversed layout ───────────────────────────────────────────────────────

  /** SVG path for an inversed-layout series (horizontal). */
  inversedPath(si: number): string {
    const s      = this.series()[si];
    const smooth = this.chartType() === 'spline' || s.smooth === true;
    return svGapRuns(s.data, (v, i) => ({ x: this.xForValue_inv(v), y: this.yForIndex_inv(i) }))
      .map(run => this.buildRun(run, smooth))
      .join(' ');
  }

  /** Dot descriptors for the inversed layout. */
  dotsInv(si: number): { x: number; y: number; value: number; color: string; ci: number }[] {
    const s         = this.series()[si];
    const baseColor = this.seriesColors()[si];
    return svGapRuns(s.data, (v, i) => ({
      x:     this.xForValue_inv(v),
      y:     this.yForIndex_inv(i),
      value: v,
      color: s.pointColors?.[i] ?? baseColor,
      ci:    i,
    })).flat();
  }

  // ── Marker shape ──────────────────────────────────────────────────────────

  /** SVG path for a non-circle marker. Returns `''` for `'circle'`. */
  markerPath(shape: LineChartMarkerShape | undefined, cx: number, cy: number, r = 4): string {
    switch (shape) {
      case 'square': {
        const h = r * 1.4;
        return `M ${cx - h} ${cy - h} h ${h * 2} v ${h * 2} h ${-h * 2} Z`;
      }
      case 'diamond':
        return `M ${cx} ${cy - r * 1.6} L ${cx + r * 1.3} ${cy} L ${cx} ${cy + r * 1.6} L ${cx - r * 1.3} ${cy} Z`;
      case 'triangle':
        return `M ${cx} ${cy - r * 1.6} L ${cx + r * 1.4} ${cy + r} L ${cx - r * 1.4} ${cy + r} Z`;
      default:
        return '';
    }
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  /**
   * A datum as the table and tooltip print it: `GAP_TEXT` for a gap (null,
   * undefined, NaN, ±Infinity — the `svIsGap` rule), the formatted value otherwise.
   */
  formatReading(v: number | null | undefined): string {
    return svIsGap(v) ? GAP_TEXT : this.formatNumber(v as number);
  }

  /**
   * An axis tick or a data label. Under `stacked-percent` those are SHARES of the
   * category total, so they carry `%`; everywhere else it is `formatNumber`.
   */
  formatValue(v: number): string {
    if (this.chartType() === 'stacked-percent') return `${Math.round(v)}%`;
    return this.formatNumber(v);
  }

  /**
   * A number as the reader supplied it, compacted to k / M.
   *
   * ★ Never `%`: the table and tooltip print the READING, not its share. Under
   *   `stacked-percent` they used to go through `formatValue`, so a reading of
   *   1200 was printed as "1200%".
   */
  formatNumber(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
    return String(v);
  }

  // ── Computed flags ────────────────────────────────────────────────────────

  hasMultiColor = computed(() => this.series().some(s => (s.pointColors?.length ?? 0) > 0));

  hasZones = computed(() => this.series().some(s => (s.zones?.length ?? 0) > 0));

  /** Unique zone labels across all series (for the zone legend). */
  uniqueZoneLabels = computed<{ label: string; color: string; dashArray?: string }[]>(() => {
    const seen = new Set<string>();
    const out: { label: string; color: string; dashArray?: string }[] = [];
    for (const s of this.series()) {
      for (const z of s.zones ?? []) {
        if (z.label && !seen.has(z.label)) {
          seen.add(z.label);
          out.push({ label: z.label, color: z.color, dashArray: z.dashArray });
        }
      }
    }
    return out;
  });

  // ── Mouse events ──────────────────────────────────────────────────────────

  onMouseMove(event: MouseEvent): void {
    const svg    = event.currentTarget as SVGElement;
    const rect   = svg.getBoundingClientRect();
    const inv    = this.isInversed();
    const pad    = inv ? this.PAD_INV : this.PAD;
    const scaleX = this.SVG_WIDTH   / rect.width;
    const scaleY = this.svgHeight() / rect.height;

    const relX = (event.clientX - rect.left) * scaleX - pad.left;
    const relY = (event.clientY - rect.top)  * scaleY - pad.top;
    const pW   = inv ? this.plotW_inv() : this.plotW();
    const pH   = inv ? this.plotH_inv() : this.plotH();

    if (relX < 0 || relX > pW || relY < 0 || relY > pH) {
      this.tooltip.update(t => ({ ...t, visible: false }));
      return;
    }

    const n  = this.categories().length;
    if (n === 0) return;

    const ci = inv
      ? Math.min(Math.round(relY / pH * (n - 1)), n - 1)
      : Math.min(Math.round(relX / pW * (n - 1)), n - 1);

    const crossX = inv ? relX : this.xForIndex(ci);
    const crossY = inv ? this.yForIndex_inv(ci) : relY;

    const items = this.series().map((s, i) => ({
      color:  this.seriesColors()[i],
      series: s.label,
      value:  svIsGap(s.data[ci]) ? null : (s.data[ci] as number),
    }));

    const tipH = 24 + items.length * 18 + 12;
    const tipW = 150;
    const tipX = inv
      ? Math.min(relX + pad.left + 8, this.SVG_WIDTH - tipW - 4)
      : Math.min(this.xForIndex(ci) + pad.left + 8, this.SVG_WIDTH - tipW - 4);
    const tipY = Math.max(relY + pad.top - tipH / 2, 4);

    this.tooltip.set({
      visible: true,
      x: tipX, y: tipY,
      crossX, crossY,
      catIndex: ci,
      // ★ EQUIVALENT MUTANT — `ci` is `Math.min(…, n - 1)` over
      // `categories().length`, so the lookup never misses.
      label: this.categories()[ci] ?? '',
      items,
    });
  }

  onMouseLeave(): void {
    this.tooltip.update(t => ({ ...t, visible: false }));
  }
}
