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

// ─── Types ────────────────────────────────────────────────────────────────────

/** Supported trend-line algorithms. */
export type TrendType = 'linear' | 'exponential' | 'moving-average' | 'polynomial';

export interface TrendLineSeries {
  /** Display name. */
  label: string;
  /**
   * Data values — one per category. `null` (or `NaN` / `±Infinity`) is a gap:
   * no dot is drawn there, the connecting line breaks, and the fit uses only
   * the readings that exist.
   */
  data:  (number | null)[];
  /** Scatter-dot color. @default palette */
  color?: string;
  /** Show connecting line between data-points. @default false */
  showLine?: boolean;
}

export interface TrendLineDefinition {
  /** Algorithm to apply. @default 'linear' */
  type:   TrendType;
  /** Series index this trend applies to. @default 0 */
  seriesIndex?: number;
  /** Stroke color for the trend line. @default auto-derived from series color */
  color?: string;
  /**
   * Moving-average window size (used when `type === 'moving-average'`).
   * @default 3
   */
  maWindow?: number;
  /**
   * Polynomial degree (used when `type === 'polynomial'`).
   * @default 2
   */
  polyDegree?: number;
}

export interface TrendLineChartOptions {
  /** Chart height in px. @default 300 */
  height?: number;
  /** Show horizontal grid lines. @default true */
  showGrid?: boolean;
  /** Show axis labels. @default true */
  showLabels?: boolean;
  /** Show series legend. @default true */
  showLegend?: boolean;
  /** Marker dot radius in px. @default 4 */
  dotRadius?: number;
  /** Show the trend-type switcher. @default true */
  showTypeSelector?: boolean;
  /** Animate line/dot draw-in on first render. @default true */
  animated?: boolean;
  /** Number of grid divisions. @default 5 */
  gridDivisions?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE: readonly string[] = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316',
];

const TREND_LABEL: Record<TrendType, string> = {
  'linear':         'Linear',
  'exponential':    'Exponential',
  'moving-average': 'Moving Avg',
  'polynomial':     'Polynomial',
};

// ─── Regression helpers ───────────────────────────────────────────────────────

/** Returns [slope, intercept] for ordinary least-squares linear regression. */
function linearRegression(xs: number[], ys: number[]): [number, number] {
  const n  = xs.length;
  const sx = xs.reduce((a, v) => a + v, 0);
  const sy = ys.reduce((a, v) => a + v, 0);
  const sxy = xs.reduce((a, v, i) => a + v * ys[i], 0);
  const sxx = xs.reduce((a, v) => a + v * v, 0);
  const denom = n * sxx - sx * sx;
  // ★ EQUIVALENT MUTANT — unreachable from the component. `xs` holds the
  // category indices of the readings that exist — ascending, never repeated —
  // and `trendPaths` refuses to fit fewer than two of them, so the x values are
  // always distinct and the determinant is never zero. The only other caller,
  // `exponentialFit`, has already returned when fewer than two readings survive
  // its filter.
  if (denom === 0) return [0, sy / n];
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return [slope, intercept];
}

/** R² (coefficient of determination). */
function rSquared(xs: number[], ys: number[], predict: (x: number) => number): number {
  const mean   = ys.reduce((a, v) => a + v, 0) / ys.length;
  const ssTot  = ys.reduce((a, v) => a + (v - mean) ** 2, 0);
  const ssRes  = xs.reduce((a, x, i) => a + (ys[i] - predict(x)) ** 2, 0);
  return ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
}

/** Exponential fit: y = a * e^(b*x). Returns predict function. */
function exponentialFit(xs: number[], ys: number[]): (x: number) => number {
  const validXs = xs.filter((_, i) => ys[i] > 0);
  const validYs = ys.filter(y => y > 0);
  if (validYs.length < 2) return _x => ys[0] ?? 0;
  const logYs = validYs.map(y => Math.log(y));
  const [b, logA] = linearRegression(validXs, logYs);
  const a = Math.exp(logA);
  return (x: number) => a * Math.exp(b * x);
}

/** Polynomial (degree 2) fit via normal equations. Returns predict function. */
function polynomialFit(xs: number[], ys: number[], deg = 2): (x: number) => number {
  // Build Vandermonde matrix columns up to degree `deg`, solve via Gaussian elimination.
  const n   = xs.length;
  const d   = Math.min(deg, n - 1);
  const mat: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j <= d; j++) row.push(Math.pow(xs[i], j));
    mat.push([...row, ys[i]]);
  }
  // Gaussian elimination with partial pivoting
  for (let col = 0; col <= d; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(mat[row][col]) > Math.abs(mat[maxRow][col])) maxRow = row;
    }
    [mat[col], mat[maxRow]] = [mat[maxRow], mat[col]];
    for (let row = col + 1; row < n; row++) {
      // ★ EQUIVALENT MUTANT — with distinct x values the Vandermonde matrix is
      // full rank, and `d` is capped at `n - 1`, so the pivot is never zero.
      if (mat[col][col] === 0) continue;
      const f = mat[row][col] / mat[col][col];
      for (let k = col; k <= d + 1; k++) mat[row][k] -= f * mat[col][k];
    }
  }
  const coeffs = new Array(d + 1).fill(0);
  for (let i = d; i >= 0; i--) {
    // ★ EQUIVALENT MUTANT — the back-substitution twin of the pivot skip above,
    // unreachable for the same reason.
    if (mat[i][i] === 0) continue;
    coeffs[i] = mat[i][d + 1];
    for (let k = i + 1; k <= d; k++) coeffs[i] -= mat[i][k] * coeffs[k];
    coeffs[i] /= mat[i][i];
  }
  return (x: number) => coeffs.reduce((sum, c, j) => sum + c * Math.pow(x, j), 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * TrendLineChartComponent — Scatter chart with computed trend-line overlay.
 *
 * Supports four trend algorithms selectable via an inline pill switcher:
 * - **Linear**        — Ordinary least-squares straight-line regression
 * - **Exponential**   — Fitted y = a·eˢ(bx)  (only for positive Y values)
 * - **Moving Avg**    — Simple moving average (configurable window size)
 * - **Polynomial**    — Degree-2 (quadratic) polynomial regression
 *
 * R² goodness-of-fit is displayed for linear, exponential, and polynomial trends.
 *
 * Load animation: data dots scale in with a CSS keyframe, trend line draws in
 * via stroke-dashoffset animation.
 *
 * @example
 * ```html
 * <sv-trend-line-chart
 *   title="Sales vs Forecast"
 *   [categories]="months"
 *   [series]="[{ label: 'Revenue', data: [...], color: '#3b82f6' }]"
 *   [trends]="[{ type: 'linear' }]"
 * />
 * ```
 */

@Component({
  selector: 'sv-trend-line-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartFrameComponent,
  ],
  templateUrl: './trend-line-chart.component.html',
  styleUrl: './trend-line-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvTrendLineChartComponent {
  /** Per-instance suffix for every id this component puts in the document. */
  readonly _uid = svUniqueId('sv-trend-line-chart');


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
  title      = input<string>('');
  /** Secondary line shown below the title. */
  subtitle   = input<string>('');
  /** X-axis category labels; each series' `data` is indexed by position against these. */
  categories = input<string[]>([]);
  /** Scatter series drawn as dots (optionally connected); `data` holds one value per category, and `null` or non-finite values are gaps left out of the fit. */
  series     = input<TrendLineSeries[]>([]);
  /** Trend lines to render. The switcher overrides `type` for the first trend. */
  trends     = input<TrendLineDefinition[]>([{ type: 'linear' }]);
  /** Display options: height, grid, axis labels, legend, dot radius, trend-type switcher, grid divisions and draw-in animation. */
  options    = input<TrendLineChartOptions>({});
  /** Extra CSS classes applied to the root wrapper. */
  customClass = input<string>('');

  /** Accessible-name override; otherwise a structure summary is generated. @default '' */
  ariaLabel = input<string>('');

  /** Resolved accessible name describing the chart structure. */
  readonly resolvedAriaLabel = computed<string>(() => {
    if (this.ariaLabel()) return this.ariaLabel();
    const cats = this.categories();
    const sets = this.series();
    const base = this.title() || 'Trend line chart';
    if (!cats.length || !sets.length) return base;
    const names = sets.map(s => s.label).filter(Boolean).join(', ');
    return `${base}: ${sets.length} series${names ? ` (${names})` : ''} across ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}.`;
  });

  // ── Active trend type (driven by switcher) ────────────────────────────────

  readonly activeTrendType = signal<TrendType>('linear');

  // ── Resolved options ──────────────────────────────────────────────────────

  chartHeight      = computed(() => this.options().height            ?? 300);
  showGrid         = computed(() => this.options().showGrid          ?? true);
  showLabels       = computed(() => this.options().showLabels        ?? true);
  showLegend       = computed(() => this.options().showLegend        ?? true);
  dotRadius        = computed(() => this.options().dotRadius         ?? 4);
  showTypeSelector = computed(() => this.options().showTypeSelector  ?? true);
  animated         = computed(() => this.options().animated          ?? true);
  gridDivisions    = computed(() => this.options().gridDivisions     ?? 5);

  // ── SVG geometry ──────────────────────────────────────────────────────────

  readonly SVG_W = 600;
  readonly PAD   = { top: 24, right: 24, bottom: 48, left: 54 };

  plotW = computed(() => this.SVG_W - this.PAD.left - this.PAD.right);
  plotH = computed(() => this.chartHeight() - this.PAD.top - this.PAD.bottom);

  // ── Derived ───────────────────────────────────────────────────────────────

  seriesColors = computed<string[]>(() =>
    this.series().map((s, i) => s.color ?? PALETTE[i % PALETTE.length])
  );

  trendColor(td: TrendLineDefinition, si: number): string {
    if (td.color) return td.color;
    const base = this.seriesColors()[si] ?? PALETTE[0];
    // Derive a lighter / different hue for the trend vs the scatter dots
    return base;
  }

  // ── Axis computation ──────────────────────────────────────────────────────

  /**
   * The extent of the readings that exist, and how many did not.
   *
   * ★ `Math.max(...data)` with one `NaN` in it is `NaN`, which made every y
   *   `NaN` and blanked the whole chart. The axis is scaled to the values that
   *   exist — the same `svFiniteExtent` rule the line chart uses.
   */
  private readonly extent = computed(() => svFiniteExtent(this.series().flatMap(s => s.data)));

  rawMin = computed<number>(() => Math.min(this.extent().min ?? 0, 0));
  rawMax = computed<number>(() => Math.max(this.extent().max ?? 1, 1));

  /** What the missing dots mean, or `null` when there are none. */
  readonly gapNote = computed<string | null>(() =>
    svGapNotice(this.extent().gaps, this.extent().total),
  );

  axisMin = computed<number>(() => {
    const mn = this.rawMin();
    if (mn >= 0) return 0;
    const exp = Math.pow(10, Math.floor(Math.log10(Math.abs(mn))));
    return Math.floor(mn / exp) * exp;
  });

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

  gridValues = computed<number[]>(() => {
    const [mn, mx] = [this.axisMin(), this.axisMax()];
    const step = (mx - mn) / this.gridDivisions();
    return Array.from({ length: this.gridDivisions() + 1 }, (_, i) =>
      parseFloat((mn + step * i).toFixed(4))
    );
  });

  // ── Coordinate helpers ────────────────────────────────────────────────────

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

  // ── Dot descriptors ───────────────────────────────────────────────────────

  /**
   * One marker per reading that exists. `ci` is the category index, which
   * differs from the array position once a gap has been skipped.
   */
  dots = computed<{ x: number; y: number; value: number; color: string; delay: number; ci: number }[][]>(() =>
    this.series().map((s, si) =>
      svGapRuns(s.data, (v, i) => ({
        x:     this.xForIndex(i),
        y:     this.yForValue(v),
        value: v,
        color: this.seriesColors()[si],
        delay: i * 30,
        ci:    i,
      })).flat()
    )
  );

  /** Dashed connecting line for a series, broken at every gap. */
  linePath(si: number): string {
    return svGapRuns(this.series()[si]?.data ?? [], (v, i) =>
      `${this.xForIndex(i).toFixed(1)} ${this.yForValue(v).toFixed(1)}`,
    )
      .map(run => 'M ' + run.join(' L '))
      .join(' ');
  }

  /** Y for the R² badge — beside the last reading of the first series that exists. */
  r2LabelY(): number {
    const data = this.series()[0]?.data ?? [];
    for (let i = data.length - 1; i >= 0; i--) {
      if (!svIsGap(data[i])) return this.yForValue(data[i] as number);
    }
    return this.yForValue(0);
  }

  // ── Trend computation ─────────────────────────────────────────────────────

  readonly trendTypes: TrendType[] = ['linear', 'exponential', 'moving-average', 'polynomial'];
  trendLabel(t: TrendType): string { return TREND_LABEL[t]; }

  /**
   * Computed trend path for each trend definition.
   * The first trend's type is overridden by `activeTrendType`.
   */
  trendPaths = computed<{ path: string; color: string; r2: number | null; label: string }[]>(() => {
    const defs = this.trends();
    const cats = this.categories();
    if (cats.length < 2 || defs.length === 0) return [];

    return defs.map((td, di) => {
      const type = di === 0 ? this.activeTrendType() : (td.type ?? 'linear');
      const si   = td.seriesIndex ?? 0;
      const s    = this.series()[si];
      if (!s) return { path: '', color: '', r2: null, label: '' };

      // ★ The fit sees only the readings that exist. A gap passed through as
      //   `NaN` poisons every sum in the regression; passed as `0` it drags the
      //   trend toward a measurement nobody took.
      const xs: number[] = [];
      const ys: number[] = [];
      cats.forEach((_, i) => {
        const v = s.data[i];
        if (!svIsGap(v)) { xs.push(i); ys.push(v as number); }
      });
      if (xs.length < 2) return { path: '', color: '', r2: null, label: '' };

      const col  = this.trendColor(td, si);

      let predict: (x: number) => number;
      let r2: number | null = null;

      switch (type) {
        case 'exponential': {
          predict = exponentialFit(xs, ys);
          r2 = rSquared(xs, ys, predict);
          break;
        }
        case 'moving-average': {
          // Window over category positions; a gap inside a window is left out
          // of that window's mean rather than counted as zero.
          const win  = td.maWindow ?? 3;
          const half = Math.floor(win / 2);
          const mas  = new Map<number, number>();
          for (const x of xs) {
            const inWin = ys.filter((_, j) => Math.abs(xs[j] - x) <= half);
            mas.set(x, inWin.reduce((a, v) => a + v, 0) / inWin.length);
          }
          // Sampled points between readings take the nearest reading's mean.
          predict = (x: number) => {
            let best = xs[0];
            for (const c of xs) if (Math.abs(c - x) <= Math.abs(best - x)) best = c;
            return mas.get(best) ?? 0;
          };
          break;
        }
        case 'polynomial': {
          const deg = td.polyDegree ?? 2;
          predict = polynomialFit(xs, ys, deg);
          r2 = rSquared(xs, ys, predict);
          break;
        }
        case 'linear':
        default: {
          const [m, b] = linearRegression(xs, ys);
          predict = (x: number) => m * x + b;
          r2 = rSquared(xs, ys, predict);
          break;
        }
      }

      // Sample 60 points across the span of the readings for a smooth curve
      const steps = 60;
      const x0 = xs[0];
      const span = xs[xs.length - 1] - x0;
      const points: string[] = [];
      for (let k = 0; k <= steps; k++) {
        const x  = x0 + (k / steps) * span;
        const px = this.xForIndex(x);
        const py = this.yForValue(predict(x));
        points.push(`${k === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`);
      }

      return {
        path:  points.join(' '),
        color: col,
        r2,
        label: TREND_LABEL[type],
      };
    });
  });

  /** Formatted R² label for display. */
  r2Label(r2: number | null): string {
    if (r2 === null) return '';
    return `R² = ${r2.toFixed(3)}`;
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  formatValue(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
    return String(Math.round(v));
  }

  // ── Interactions ──────────────────────────────────────────────────────────

  setTrendType(t: TrendType): void { this.activeTrendType.set(t); }
}
