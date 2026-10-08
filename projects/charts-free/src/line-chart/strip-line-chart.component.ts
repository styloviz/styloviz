import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import {
  SvChartFrameComponent,
  type SvDataError,
  svFiniteExtent,
  svGapNotice,
  svGapRuns,
  svIsGap,
  svUniqueId,
} from '@styloviz/core';
import { NgClass } from '@angular/common';

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
 * A colored band drawn behind the chart data.
 *
 * - `'horizontal'` — a Y-value range band (e.g. "High", "Normal", "Low" zones)
 * - `'vertical'`   — a category-index range band (e.g. highlight a date range / event)
 */
export type StripOrientation = 'horizontal' | 'vertical';

export interface StripBand {
  /** Band orientation. @default 'horizontal' */
  orientation?: StripOrientation;
  /**
   * Start value:
   * - horizontal → Y-axis value (band bottom edge)
   * - vertical   → category index (band left edge)
   */
  start: number;
  /**
   * End value (exclusive-end for vertical, inclusive for horizontal).
   * Omit to extend to chart boundary.
   */
  end?: number;
  /** Fill color (CSS color string). */
  color: string;
  /** Band opacity (0–1). @default 0.15 */
  opacity?: number;
  /** Text label shown inside the band. */
  label?: string;
  /** Position of the label ('start' | 'end' | 'center'). @default 'end' */
  labelPosition?: 'start' | 'end' | 'center';
}

export interface StripSeries {
  /** Display label. */
  label: string;
  /**
   * Data values — one per category. `null` (or `NaN` / `±Infinity`) is a gap:
   * the line breaks there, the axis ignores it, and the table says "No reading".
   */
  data:  (number | null)[];
  /** Line color. @default palette */
  color?: string;
  /** Fill area under the line. @default false */
  fill?: boolean;
  /** Use smooth spline. @default false */
  smooth?: boolean;
  /** Stroke width. @default 2 */
  strokeWidth?: number;
}

export interface StripLineChartOptions {
  /** Chart height in px. @default 300 */
  height?: number;
  /** Show horizontal grid lines. @default true */
  showGrid?: boolean;
  /** Show axis labels. @default true */
  showLabels?: boolean;
  /** Show series legend. @default true */
  showLegend?: boolean;
  /** Show band labels. @default true */
  showBandLabels?: boolean;
  /** Number of grid divisions. @default 5 */
  gridDivisions?: number;
  /** Animate line draw-in on load. @default true */
  animated?: boolean;
  /** Show dots at data-points. @default true */
  showDots?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE: readonly string[] = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316',
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * StripLineChartComponent — Line chart with colored band annotations.
 *
 * Strip bands (horizontal or vertical) are semi-transparent colored rectangles
 * drawn behind the chart data, ideal for highlighting value zones (e.g. Low /
 * Normal / High / Critical) or marking event windows on the time axis.
 *
 * Features:
 * - Any number of horizontal or vertical strip bands via `strips` input
 * - Labels positioned at start, center, or end of each band
 * - Multiple data series with optional gradient area fill
 * - Smooth Catmull-Rom spline option per series
 * - Draw-in animation (stroke-dashoffset) on first render
 * - Hover crosshair + tooltip
 * - Full dark-mode, responsive
 *
 * @example
 * ```html
 * <sv-strip-line-chart
 *   title="Server Response Time"
 *   [categories]="hours"
 *   [series]="[{ label: 'p99 Latency', data: [...], color: '#3b82f6', fill: true }]"
 *   [strips]="[
 *     { start: 0,   end: 200,  color: '#10b981', label: 'Good',     opacity: 0.12 },
 *     { start: 200, end: 500,  color: '#f59e0b', label: 'Warning',  opacity: 0.12 },
 *     { start: 500,            color: '#ef4444', label: 'Critical', opacity: 0.12 },
 *   ]"
 * />
 * ```
 */

@Component({
  selector: 'sv-strip-line-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartFrameComponent,
  ],
  templateUrl: './strip-line-chart.component.html',
  styleUrl: './strip-line-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvStripLineChartComponent {
  /** Per-instance suffix for every id this component puts in the document. */
  readonly _uid = svUniqueId('sv-strip-line-chart');


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

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Chart title shown in the header; also the base of the generated accessible name. */
  title       = input<string>('');
  /** Secondary line shown below the title (rendered only when `title` is set). */
  subtitle    = input<string>('');
  /** X-axis category labels; each series' `data` is indexed by position against these. */
  categories  = input<string[]>([]);
  /** Line series; `data` holds one value per category, and `null` or non-finite values are gaps that break the line. */
  series      = input<StripSeries[]>([]);
  /** Coloured bands drawn behind the data: horizontal bands span a Y-value range, vertical bands span a category-index range. */
  strips      = input<StripBand[]>([]);
  /** Display options: height, grid, axis labels, legend, band labels, grid divisions, dots and draw-in animation. */
  options     = input<StripLineChartOptions>({});
  /** Extra CSS classes applied to the root wrapper. */
  customClass = input<string>('');

  /** Accessible-name override; otherwise a structure summary is generated. @default '' */
  ariaLabel = input<string>('');

  /** Resolved accessible name describing the chart structure. */
  readonly resolvedAriaLabel = computed<string>(() => {
    if (this.ariaLabel()) return this.ariaLabel();
    const cats = this.categories();
    const sets = this.series();
    const base = this.title() || 'Strip line chart';
    if (!cats.length || !sets.length) return base;
    const names = sets.map(s => s.label).filter(Boolean).join(', ');
    return `${base}: ${sets.length} series${names ? ` (${names})` : ''} across ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}.`;
  });

  // ── Resolved options ──────────────────────────────────────────────────────

  chartHeight     = computed(() => this.options().height         ?? 300);
  showGrid        = computed(() => this.options().showGrid       ?? true);
  showLabels      = computed(() => this.options().showLabels     ?? true);
  showLegend      = computed(() => this.options().showLegend     ?? true);
  showBandLabels  = computed(() => this.options().showBandLabels ?? true);
  gridDivisions   = computed(() => this.options().gridDivisions  ?? 5);
  animated        = computed(() => this.options().animated       ?? true);
  showDots        = computed(() => this.options().showDots       ?? true);

  // ── Hover state ───────────────────────────────────────────────────────────

  readonly tooltip = signal<{
    visible: boolean;
    x: number; y: number;
    crossX: number;
    label: string;
    /** `null` is a gap at this category — printed as a gap, never as `0`. */
    items: { color: string; series: string; value: number | null }[];
  }>({ visible: false, x: 0, y: 0, crossX: 0, label: '', items: [] });

  // ── SVG geometry ──────────────────────────────────────────────────────────

  readonly SVG_W = 600;
  readonly PAD   = { top: 24, right: 24, bottom: 48, left: 54 };

  plotW = computed(() => this.SVG_W - this.PAD.left - this.PAD.right);
  plotH = computed(() => this.chartHeight() - this.PAD.top - this.PAD.bottom);

  // ── Axis ──────────────────────────────────────────────────────────────────

  seriesColors = computed<string[]>(() =>
    this.series().map((s, i) => s.color ?? PALETTE[i % PALETTE.length])
  );

  /**
   * The extent of the readings that exist, and how many did not.
   *
   * ★ `Math.max(...data)` with one `NaN` in it is `NaN`, which made every y
   *   `NaN` and blanked the whole chart. The axis is scaled to the values that
   *   exist — the same `svFiniteExtent` rule the line chart uses.
   */
  private readonly extent = computed(() => svFiniteExtent(this.series().flatMap(s => s.data)));

  rawMax = computed<number>(() => {
    const bandMax = this.strips()
      .filter(b => (b.orientation ?? 'horizontal') === 'horizontal')
      .flatMap(b => [b.start, b.end ?? b.start])
      .filter(Number.isFinite);
    return Math.max(this.extent().max ?? 1, ...bandMax, 1);
  });

  rawMin = computed<number>(() => Math.min(this.extent().min ?? 0, 0));

  /** What the breaks in the lines mean, or `null` when there are none. */
  readonly gapNote = computed<string | null>(() =>
    svGapNotice(this.extent().gaps, this.extent().total),
  );

  axisMax = computed<number>(() => {
    const mv = this.rawMax();
    // ★ EQUIVALENT MUTANT — unreachable. `rawMax` is `Math.max(…, 1)`, so `mv`
    // is never <= 0 and no input distinguishes this line from its absence. It
    // stays as a belt on top of braces: the day the floor in `rawMax` moves,
    // this is what keeps the axis from becoming a zero divisor.
    if (mv <= 0) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(mv)));
    return Math.ceil(mv / exp) * exp;
  });

  axisMin = computed<number>(() => {
    const mn = this.rawMin();
    if (mn >= 0) return 0;
    const exp = Math.pow(10, Math.floor(Math.log10(Math.abs(mn))));
    return Math.floor(mn / exp) * exp;
  });

  gridValues = computed<number[]>(() => {
    const [mn, mx] = [this.axisMin(), this.axisMax()];
    const step = (mx - mn) / this.gridDivisions();
    return Array.from({ length: this.gridDivisions() + 1 }, (_, i) =>
      parseFloat((mn + step * i).toFixed(4))
    );
  });

  // ── Coordinates ───────────────────────────────────────────────────────────

  xForIndex(i: number): number {
    const n = this.categories().length;
    return n <= 1 ? this.plotW() / 2 : (i / (n - 1)) * this.plotW();
  }

  yForValue(v: number): number {
    const range = this.axisMax() - this.axisMin();
    // ★ EQUIVALENT MUTANT — `axisMax` is >= 1 and `axisMin` is <= 0 for every
    // input, so `range` is never zero and this arm cannot be reached.
    if (range === 0) return this.plotH() / 2;
    return this.plotH() - ((v - this.axisMin()) / range) * this.plotH();
  }

  gridLineY(v: number): number { return this.yForValue(v); }

  // ── Strip band geometry ───────────────────────────────────────────────────

  bandRects = computed<{
    x: number; y: number; width: number; height: number;
    color: string; opacity: number;
    label: string; labelX: number; labelY: number;
    orientation: StripOrientation;
    index: number;
  }[]>(() => {
    const pH  = this.plotH();
    const pW  = this.plotW();
    const n   = this.categories().length;

    return this.strips().map((b, idx) => {
      const orientation = b.orientation ?? 'horizontal';
      const opacity     = b.opacity     ?? 0.15;
      const labelPos    = b.labelPosition ?? 'end';

      if (orientation === 'horizontal') {
        const yStart = this.yForValue(b.end   ?? this.axisMax());
        const yEnd   = this.yForValue(b.start);
        const rectH  = Math.max(1, yEnd - yStart);

        const labelY = labelPos === 'start'  ? yStart + 12
                     : labelPos === 'center' ? yStart + rectH / 2 + 4
                     :                         yEnd   - 4;
        return {
          x: 0, y: yStart, width: pW, height: rectH,
          color: b.color, opacity,
          label: b.label ?? '', labelX: pW - 4, labelY,
          orientation, index: idx,
        };
      } else {
        // vertical strip: start/end are category indices (can be fractional)
        const xStart = n <= 1 ? 0 : (b.start / (n - 1)) * pW;
        const xEnd   = n <= 1 ? pW : ((b.end ?? n - 1) / (n - 1)) * pW;
        const rectW  = Math.max(1, xEnd - xStart);

        const labelX = labelPos === 'start'  ? xStart + 4
                     : labelPos === 'center' ? xStart + rectW / 2
                     :                         xEnd   - 4;
        return {
          x: xStart, y: 0, width: rectW, height: pH,
          color: b.color, opacity,
          label: b.label ?? '', labelX, labelY: 14,
          orientation, index: idx,
        };
      }
    });
  });

  // ── Line paths ─────────────────────────────────────────────────────────────

  private catmullRom(pts: { x: number; y: number }[]): string {
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[Math.max(i - 2, 0)];
      const p1 = pts[i - 1];
      const p2 = pts[i];
      const p3 = pts[Math.min(i + 1, pts.length - 1)];
      d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}`
         + ` ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}`
         + ` ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  /** The drawable stretches of a series — one per run between gaps. */
  private runs(si: number): { x: number; y: number }[][] {
    return svGapRuns(this.series()[si].data, (v, i) => ({ x: this.xForIndex(i), y: this.yForValue(v) }));
  }

  private runPath(pts: { x: number; y: number }[], smooth: boolean): string {
    // A reading with a gap on both sides: a bare `M` paints nothing, so draw a
    // zero-length segment, which the round line cap turns into a visible dot.
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} h 0`;
    return smooth ? this.catmullRom(pts)
      : 'M ' + pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ');
  }

  /** Line path, broken at every gap rather than joined across it. */
  seriesPath(si: number): string {
    if (this.series()[si].data.length < 2) return '';
    const smooth = this.series()[si].smooth ?? false;
    return this.runs(si).map(run => this.runPath(run, smooth)).join(' ');
  }

  /** Area under the line — one closed shape per run, never painted under a gap. */
  fillPath(si: number): string {
    if (this.series()[si].data.length < 2) return '';
    const smooth = this.series()[si].smooth ?? false;
    const base = this.plotH();
    return this.runs(si)
      .map(run => {
        const lx = run[run.length - 1].x.toFixed(1);
        const fx = run[0].x.toFixed(1);
        return `${this.runPath(run, smooth)} L ${lx} ${base} L ${fx} ${base} Z`;
      })
      .join(' ');
  }

  fillGradId(si: number): string { return `sl-fill-${this._uid}-${si}`; }

  // ── Dots ──────────────────────────────────────────────────────────────────

  /** A marker at a gap would be a dot at a value nobody reported. */
  dots = computed<{ x: number; y: number; value: number }[][]>(() =>
    this.series().map(s =>
      svGapRuns(s.data, (v, i) => ({ x: this.xForIndex(i), y: this.yForValue(v), value: v })).flat()
    )
  );

  // ── Tooltip / hover ───────────────────────────────────────────────────────

  onMouseMove(evt: MouseEvent): void {
    const svg   = evt.currentTarget as SVGElement;
    const rect  = svg.getBoundingClientRect();
    const scaleX = this.SVG_W / rect.width;
    const relX   = (evt.clientX - rect.left) * scaleX - this.PAD.left;
    const pW     = this.plotW();
    if (relX < 0 || relX > pW) { this.tooltip.update(t => ({ ...t, visible: false })); return; }

    const n  = this.categories().length;
    const ci = Math.min(Math.round(relX / pW * (n - 1)), n - 1);
    const items = this.series().map((s, i) => ({
      color:  this.seriesColors()[i],
      series: s.label,
      value:  svIsGap(s.data[ci]) ? null : (s.data[ci] as number),
    }));
    const tipW  = 155;
    const crossX = this.xForIndex(ci);
    const tipX  = Math.min(crossX + this.PAD.left + 8, this.SVG_W - tipW - 4);
    const tipY  = this.PAD.top + 4;

    this.tooltip.set({
      visible: true,
      x: tipX, y: tipY,
      crossX,
      // ★ EQUIVALENT MUTANT — `ci` is clamped to `categories().length - 1`
      // above, so the lookup never misses.
      label: this.categories()[ci] ?? '',
      items,
    });
  }

  onMouseLeave(): void {
    this.tooltip.update(t => ({ ...t, visible: false }));
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  /** A datum as the tooltip prints it — `GAP_TEXT` for a gap, never `0` or `NaN`. */
  formatReading(v: number | null | undefined): string {
    return svIsGap(v) ? GAP_TEXT : this.formatValue(v as number);
  }

  formatValue(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
    return String(Math.round(v));
  }
}
