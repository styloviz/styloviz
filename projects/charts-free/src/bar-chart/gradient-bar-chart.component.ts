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
  type SvValuePolicy,
  svUniqueId,
} from '@styloviz/core';

import type { BarChartDataset, BarChartOptions, TooltipState } from './bar-chart.types';
import { DEFAULT_COLORS, formatChartValue, gridTicks, niceMax, lightenColor, resolveBarValues, CLAMPED_BAR_STUB_PX, CLAMPED_BAR_FILL } from './bar-chart.utils';

/**
 * GradientBarChartComponent — Horizontal bar chart with a per-series SVG linear gradient fill.
 *
 * Each bar fills left-to-right with a smooth color transition (lighter → richer).
 * Supply `gradientColors: [startColor, endColor]` on each dataset to customise,
 * or let the component auto-generate them from the series color.
 *
 * @example
 * ```html
 * <sv-gradient-bar-chart
 *   [categories]="companies"
 *   [datasets]="[{
 *     label: 'Revenue (B$)',
 *     data:  [108.8, 98, 93.8, 77.5, 71.8],
 *     gradientColors: ['#bfdbfe','#3b82f6']
 *   }]"
 *   title="Top Revenue Companies"
 *   [options]="{ showValues: true }"
 * />
 * ```
 */

@Component({
  selector: 'sv-gradient-bar-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartAnimDirective,
    SvChartFrameComponent,
    SvDataSummaryTableComponent,
  ],
  templateUrl: './gradient-bar-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvGradientBarChartComponent {
  /** Per-instance suffix for every id this component puts in the document. */
  readonly _uid = svUniqueId('sv-gradient-bar-chart');


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
  readonly chartIsEmpty = computed(() => this.datasets().length === 0);

  /** The load error, or the policy's refusal to plot this dataset under `reject`. */
  readonly resolvedError = computed<SvDataError | string | null>(
    () => this.error() ?? this.plotted().error,
  );
  /** Category labels on the Y-axis, one per bar group. */
  categories  = input<string[]>([]);
  /** One or more series, drawn side by side as horizontal gradient bars; set `gradientColors: [start, end]` on a series to override the gradient derived from its `color`. */
  datasets    = input<BarChartDataset[]>([]);
  /**
   * What to do with a bar this chart cannot draw — a negative value, `NaN`,
   * `Infinity`. This is a zero-based bar chart: height is `(value / axisMax) *
   * plotSize`, and an SVG rect refuses a negative height outright, so such a bar
   * does not look wrong, it is simply absent.
   *
   * - `clamp` (default) — draw it at the baseline, mark it there, and disclose
   *   its real value under the plot.
   * - `reject` — refuse the dataset and show the error state.
   *
   * `omit` is not available: a bar's position is its index within its group, so
   * dropping one value would shift every later bar of that series out from under
   * its own category label. For data that genuinely goes below zero, use
   * `<sv-negative-stack-chart>`.
   *
   * @default 'clamp'
   */
  readonly valuePolicy = input<SvValuePolicy>('clamp');

  /**
   * The bars this chart can draw, and what has to be said about the rest. The
   * axis ceiling reads its `max` from here rather than from `datasets()`, because
   * a single `NaN` in the data made `Math.max` — and therefore the whole axis and
   * every bar on it — `NaN`.
   */
  protected readonly plotted = computed(() => resolveBarValues(this.datasets(), this.valuePolicy(), 'sv-gradient-bar-chart'));

  /** Heading shown above the chart (omitted when empty); also used in the generated accessible name. @default '' */
  title       = input<string>('');
  /** Chart height in px. @default 360 */
  height      = input<number>(360);
  /** Rendering options: `showGrid` (default false), `showLabels`, `showLegend`, `showValues` (default true), `barGap` (default 0.3), `barRadius` (default 4), `gradientDirection` (default `'horizontal'`) and `animationDuration`. */
  options     = input<BarChartOptions>({});
  /** Additional CSS classes on the root element. @default '' */
  customClass = input<string>('');

  /** Accessible-name override; otherwise a structure summary is generated. @default '' */
  ariaLabel = input<string>('');

  /** Resolved accessible name describing the chart structure. */
  readonly resolvedAriaLabel = computed<string>(() => {
    if (this.ariaLabel()) return this.ariaLabel();
    const cats = this.categories();
    const sets = this.datasets();
    const base = this.title() || 'Gradient bar chart';
    if (!cats.length || !sets.length) return base;
    const names = sets.map(s => s.label).filter(Boolean).join(', ');
    return `${base}: ${sets.length} series${names ? ` (${names})` : ''} across ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}.`;
  });
  animDuration = computed(() => { const d = this.options().animationDuration; return d != null ? d + 'ms' : null; });

  readonly tooltip = signal<TooltipState>({ visible: false, x: 0, y: 0, label: '', items: [] });

  readonly SVG_WIDTH = 600;
  readonly PADDING   = { top: 16, right: 48, bottom: 40, left: 140 };

  svgHeight = computed(() => this.height());
  plotW     = computed(() => this.SVG_WIDTH - this.PADDING.left - this.PADDING.right);
  plotH     = computed(() => this.svgHeight() - this.PADDING.top - this.PADDING.bottom);

  showGrid   = computed(() => this.options().showGrid   ?? false);
  showLabels = computed(() => this.options().showLabels ?? true);
  showLegend = computed(() => this.options().showLegend ?? true);
  showValues = computed(() => this.options().showValues ?? true);
  barGap     = computed(() => this.options().barGap     ?? 0.3);
  barRadius  = computed(() => this.options().barRadius  ?? 4);
  gradientDirection = computed(() => this.options().gradientDirection ?? 'horizontal');
  /**
   * End point of each bar's gradient, in the bar's own box: along its length
   * (`'horizontal'`, the default) or across its thickness (`'vertical'`).
   * `gradientDirection` was declared on the options and read by nothing.
   */
  readonly gradientEnd = computed(() =>
    this.gradientDirection() === 'vertical' ? { x2: '0%', y2: '100%' } : { x2: '100%', y2: '0%' },
  );

  seriesColors = computed<string[]>(() =>
    this.datasets().map((d, i) => d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length])
  );

  /** Gradient stop pairs per series: [lighter, richer]. */
  gradientStops = computed<[string, string][]>(() =>
    this.datasets().map((d, i) => {
      if (d.gradientColors) return d.gradientColors;
      const full  = this.seriesColors()[i];
      return [lightenColor(full, 0.55), full] as [string, string];
    })
  );

  maxValue = computed<number>(() => this.plotted().max);

  axisMax    = computed<number>(() => niceMax(this.maxValue()));
  gridValues = computed<number[]>(() => gridTicks(this.axisMax(), 5));

  horizontalBars = computed(() => {
    const cats    = this.categories();
    const sets    = this.datasets();
    const pw      = this.plotW();
    const ph      = this.plotH();
    const max     = this.axisMax();
    const ncat    = cats.length;
    const nseries = sets.length;
    const gap     = this.barGap();
    const r       = this.barRadius();
    const colors  = this.seriesColors();
    const plotted = this.plotted();

    if (!ncat || !nseries) return [];

    const groupH = ph / ncat;
    const barH   = (groupH * (1 - gap)) / nseries;
    const barPad = (groupH * gap) / 2;

    return sets.flatMap((series, si) =>
      cats.map((cat, ci) => {
        // ★ Geometry is built from what the chart CAN draw; `value` in the
        // returned object stays the real number, so the tooltip, the label and
        // the accessible name still report what the caller passed in. `clamped`
        // is what puts a visible marker at the baseline — see `resolveBarValues`.
        const value   = series.data[ci] ?? 0;
        const clamped = plotted.isClamped(si, ci);
        const barW    = clamped ? CLAMPED_BAR_STUB_PX : (value / max) * pw;
        const y     = ci * groupH + barPad + si * barH;
        return {
          x: 0, y, barW, barH,
          r: Math.min(r, barH / 2, barW / 2),
          value, clamped, cat, series: series.label,
          // The mark, and the tooltip swatch that goes with it: a stub replaces
          // the series gradient outright, so the bar cannot be mistaken for a
          // very small real measurement of that series.
          color: clamped ? CLAMPED_BAR_FILL : colors[si],
          fill: clamped ? CLAMPED_BAR_FILL : `url(#grad-${this._uid}-${si})`,
        };
      })
    );
  });

  gridLineX(v: number): number { return (v / this.axisMax()) * this.plotW(); }

  /**
   * A value as the axis, the label, the tooltip and the table all print it.
   *
   * `NaN` and `Infinity` are screened here rather than at each of those four call
   * sites: `formatChartValue(NaN)` is the string `"NaN"`, which a reader takes for
   * a measurement. A blank cell in the source is an absence, and says so.
   */
  formatValue(v: number | string): string {
    if (typeof v === 'string') return v;
    return Number.isFinite(v) ? formatChartValue(v) : 'no value';
  }

  /**
   * Cell value for the screen-reader data table.
   *
   * The REAL number, always — the table is the data, not a transcript of the
   * geometry. What it adds is the one fact the drawing cannot carry non-visually:
   * a bar the chart had to put at the baseline is named as such here.
   */
  cellValue(seriesIndex: number, catIndex: number): string {
    const value = this.datasets()[seriesIndex]?.data[catIndex] ?? 0;
    const text  = this.formatValue(value);
    return this.plotted().isClamped(seriesIndex, catIndex)
      ? `${text} (not drawn to scale)`
      : text;
  }

  /**
   * The bars as rows — one category per row, one column per series.
   *
   * This chart had no non-visual equivalent at all: its bars are not focusable, so
   * a per-bar `aria-label` would have had nothing to attach to, and the SVG's
   * `role="img"` name says only how many series there are. Every number on it
   * reached the page as a gradient length and nothing else.
   */
  protected readonly a11ySummary = computed<SvDataSummary>(() => {
    const sets = this.datasets();
    return {
      caption: this.title() || 'Gradient bar chart',
      columns: ['Category', ...sets.map((s) => s.label)],
      rows: this.categories().map((cat, ci) => ({
        key: cat,
        header: cat,
        cells: sets.map((_, si) => this.cellValue(si, ci)),
      })),
    };
  });

  /** Rounded-right rect path for horizontal bars. */
  horizBarPath(x: number, y: number, w: number, h: number, r: number): string {
    if (w <= 0) return '';
    const sr = Math.min(r, w / 2, h / 2);
    return [
      `M ${x} ${y}`,
      `H ${x + w - sr}`, `Q ${x + w} ${y} ${x + w} ${y + sr}`,
      `V ${y + h - sr}`, `Q ${x + w} ${y + h} ${x + w - sr} ${y + h}`,
      `H ${x}`, 'Z',
    ].join(' ');
  }

  showTooltip(e: MouseEvent, cat: string, series: string, value: number, color: string): void {
    const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.SVG_WIDTH / rect.width);
    const y = (e.clientY - rect.top)  * (this.svgHeight() / rect.height);
    this.tooltip.set({
      visible: true,
      x: Math.min(x, this.SVG_WIDTH - 130),
      y: Math.max(y - 60, 8),
      label: cat,
      items: [{ color, series, value }],
    });
  }

  hideTooltip(): void { this.tooltip.update(t => ({ ...t, visible: false })); }
}
