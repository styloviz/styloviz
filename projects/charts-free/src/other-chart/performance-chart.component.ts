import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  OnInit,
} from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { SvChartAnimDirective, SvChartFrameComponent, type SvDataError, svUniqueId } from '@styloviz/core';
import { niceMax, gridTicks, formatChartValue } from '../bar-chart/bar-chart.utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PerformanceChartOptions {
  pointCount?: number;
  showArea?: boolean;
  showGrid?: boolean;
  animationDuration?: number;
}

// ─── Mock data generator ──────────────────────────────────────────────────────

function generateHighVolumeSeries(count: number): number[] {
  const out: number[] = [];
  let v = 500;
  for (let i = 0; i < count; i++) {
    v += (Math.random() - 0.49) * 18;
    v = Math.max(0, Math.min(1000, v));
    out.push(Math.round(v));
  }
  return out;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PerformanceChartComponent — High-volume data rendering demo.
 *
 * Renders up to 10 000 data points as a single compressed SVG polyline path,
 * demonstrating how pure-SVG charts stay smooth without a charting library.
 * Includes a "points rendered" badge and a render-time measurement.
 * The line draws in via the `.lc-line` animation.
 *
 * @example
 * ```html
 * <sv-performance-chart
 *   title="10 000 Point Render"
 *   [options]="{ pointCount: 10000 }"
 * />
 * ```
 */

@Component({
  selector: 'sv-performance-chart',
  standalone: true,
  imports: [NgClass, DecimalPipe, SvChartAnimDirective, SvChartFrameComponent],
  templateUrl: './performance-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvPerformanceChartComponent implements OnInit {
  /** Per-instance suffix for every id this component puts in the document. */
  readonly _uid = svUniqueId('sv-performance-chart');

  // ── Inputs ────────────────────────────────────────────────────────────────
  /**
   * The series to plot — one number per point, in order.
   *
   * Leave it unbound and set `options.pointCount` to run the built-in benchmark
   * against a synthetic series instead. Host data always wins over the
   * benchmark.
   */
  readonly data = input<readonly number[]>([]);
  /** Chart title, rendered above the plot and used as the SVG's accessible name. @default 'High-Volume Chart Performance' */
  title       = input<string>('High-Volume Chart Performance');
  /** SVG and frame height in pixels. @default 320 */
  height      = input<number>(320);
  /** Benchmark point count (`pointCount`, opt-in; ignored when `data` is bound), area fill and grid toggles (both default `true`), and line draw-in `animationDuration` in ms. @default {} */
  options     = input<PerformanceChartOptions>({});
  /** Extra CSS classes applied to the root wrapper. @default '' */
  customClass = input<string>('');

  // ── Async state ───────────────────────────────────────────────────────────
  // The shared chart contract, rendered by `sv-chart-frame`.

  /** True while the series is being fetched. @default false */
  readonly loading = input<boolean>(false);
  /**
   * Load failure. A bare string is accepted; use `toSvDataError()` to normalize
   * an `HttpErrorResponse` and get sensible retry behaviour.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);
  /** Copy for the empty state. @default 'No data to plot' */
  readonly emptyMessage = input<string>('No data to plot');
  /**
   * Distinguishes "no data at all" from "nothing matched the current filters".
   * @default false
   */
  readonly filtered = input<boolean>(false);

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  // ── Constants ─────────────────────────────────────────────────────────────
  readonly SVG_WIDTH = 600;
  readonly PAD       = { top: 16, right: 20, bottom: 40, left: 52 };

  // ── State ─────────────────────────────────────────────────────────────────

  /**
   * How long the built-in benchmark took to synthesise its series, or `null`
   * when the host supplied the data — there is no generation to time then, and
   * the badge would otherwise report 0 ms of work it never did.
   */
  readonly renderMs = signal<number | null>(null);

  /** Points produced by the benchmark. Empty unless `options.pointCount` asked. */
  private readonly generated = signal<readonly number[]>([]);

  /** Host data when bound, the benchmark's own series otherwise. */
  readonly rawData = computed<readonly number[]>(() =>
    this.data().length ? this.data() : this.generated(),
  );

  readonly pointCount = computed(() => this.rawData().length);

  /** Nothing to plot. Drives the frame's empty state. */
  readonly chartIsEmpty = computed(() => this.rawData().length === 0);

  // ── Derived ───────────────────────────────────────────────────────────────
  animDuration = computed(() => { const d = this.options().animationDuration; return d != null ? d + 'ms' : null; });
  showArea     = computed(() => this.options().showArea ?? true);
  showGrid     = computed(() => this.options().showGrid ?? true);

  svgH  = computed(() => this.height());
  plotW = computed(() => this.SVG_WIDTH - this.PAD.left - this.PAD.right);
  plotH = computed(() => this.svgH() - this.PAD.top - this.PAD.bottom);

  yMax   = computed(() => niceMax(Math.max(...this.rawData(), 1)));
  yTicks = computed(() => gridTicks(this.yMax(), 5));

  /** Downsample to at most SVG_WIDTH * 2 points to avoid SVG path bloat */
  private readonly MAX_RENDER_PTS = this.SVG_WIDTH * 2;

  displayData = computed<readonly number[]>(() => {
    const data = this.rawData();
    if (data.length <= this.MAX_RENDER_PTS) return data;
    const step = data.length / this.MAX_RENDER_PTS;
    return Array.from({ length: this.MAX_RENDER_PTS }, (_, i) => data[Math.round(i * step)]);
  });

  linePath = computed<string>(() => {
    const data = this.displayData();
    const pw   = this.plotW();
    const ph   = this.plotH();
    const yMax = this.yMax();
    if (!data.length) return '';

    // A one-point series divides by zero: `0 / 0` is NaN, and the path becomes
    // "M NaN,y" — which the browser rejects outright rather than drawing a dot.
    const lastIndex = Math.max(1, data.length - 1);
    const pts = data.map((v, i) => {
      const x = (i / lastIndex) * pw;
      const y = ph - (v / yMax) * ph;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return 'M ' + pts.join(' L ');
  });

  areaPath = computed<string>(() => {
    const line = this.linePath();
    if (!line) return '';
    const ph = this.plotH();
    const pw = this.plotW();
    return `${line} L ${pw},${ph} L 0,${ph} Z`;
  });

  yTickY  = (v: number) => this.plotH() - (v / this.yMax()) * this.plotH();
  fmt     = (v: number) => formatChartValue(v);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Runs the built-in benchmark, and only when asked for.
   *
   * ★ The count used to be `pointCount ?? 10_000`, so EVERY instance
   * manufactured ten thousand random points whether anyone wanted them or not.
   * Two things followed: the chart could not be pointed at a real series, and
   * its empty state was unreachable by construction — a generator that always
   * fires guarantees there is always data. `pointCount` is now the explicit
   * opt-in, and host `data` takes precedence over it.
   */
  ngOnInit(): void {
    const count = this.options().pointCount;
    if (count == null || this.data().length) return;

    const t0 = performance.now();
    const series = generateHighVolumeSeries(count);
    this.renderMs.set(Math.round(performance.now() - t0));
    this.generated.set(series);
  }
}
