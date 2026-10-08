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
} from '@styloviz/core';

import type {
  BarChartDataset,
  BarChartOptions,
  BarChartOrientation,
  TooltipState,
} from './bar-chart.types';
import {
  DEFAULT_COLORS,
  CLAMPED_BAR_FILL,
  CLAMPED_BAR_STUB_PX,
  resolveBarValues,
  formatChartValue,
  gridTicks,
  niceMax,
  roundedRightRectPath,
  roundedTopRectPath,
} from './bar-chart.utils';

// Re-export public API so consumers only need to import from this file
export type { BarChartDataset, BarChartOptions, BarChartOrientation } from './bar-chart.types';
export type { BarChartVariant } from './bar-chart.types';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * BarChartComponent — A pure-SVG bar chart with no external dependencies.
 *
 * Supports vertical columns and horizontal bars, multi-series grouped layout,
 * hover tooltips, grid lines, axis labels, legend, and optional value annotations.
 *
 * This component is the base "column" and "bar" variant.
 * See the variant-specific components for stacked, range, gradient, drilldown, etc.
 *
 * @example
 * ```html
 * <sv-bar-chart
 *   [categories]="['Jan','Feb','Mar']"
 *   [datasets]="[{ label: 'Revenue', data: [120, 180, 90] }]"
 * />
 * ```
 */
@Component({
  selector: 'sv-bar-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartAnimDirective,
    SvChartFrameComponent,
    SvDataSummaryTableComponent,
  ],
  templateUrl: './bar-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvBarChartComponent {

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
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Category labels displayed on the axis. */
  categories = input<string[]>([]);

  /** One or more data series. */
  datasets = input<BarChartDataset[]>([]);
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
  protected readonly plotted = computed(() => resolveBarValues(this.datasets(), this.valuePolicy(), 'sv-bar-chart'));


  /** Chart orientation. @default 'vertical' */
  orientation = input<BarChartOrientation>('vertical');

  /** Chart title. */
  title = input<string>('');

  /** Chart height in px. @default 320 */
  height = input<number>(320);

  /** Rendering and feature options. */
  options = input<BarChartOptions>({});

  /** Additional CSS classes on the root element. */
  customClass = input<string>('');

  /**
   * Accessible-name override for the chart image. When empty, a concise
   * data summary is generated automatically; the full data is always exposed
   * to assistive tech via a visually-hidden table. @default ''
   */
  ariaLabel = input<string>('');

  animDuration = computed(() => { const d = this.options().animationDuration; return d != null ? d + 'ms' : null; });

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted when a bar is clicked — for drill-down or selection. */
  readonly barSelect = output<{ category: string; series: string; value: number }>();

  onBarClick(category: string, series: string, value: number): void {
    this.barSelect.emit({ category, series, value });
  }

  // ── Accessibility ───────────────────────────────────────────────────────────

  /** Concise summary used as the chart's accessible name. */
  readonly chartDescription = computed<string>(() => {
    const cats = this.categories();
    const sets = this.datasets();
    const base = this.title() || 'Bar chart';
    if (!cats.length || !sets.length) return base;
    const names = sets.map(s => s.label).filter(Boolean).join(', ');
    const seriesPart = sets.length === 1
      ? (names ? `series ${names}` : '1 series')
      : `${sets.length} series${names ? ` (${names})` : ''}`;
    return `${base}: ${seriesPart} across ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}.`;
  });

  /** Resolved accessible name — explicit override or the generated summary. */
  readonly resolvedAriaLabel = computed<string>(() => this.ariaLabel() || this.chartDescription());

  /**
   * Cell value for the screen-reader data table.
   *
   * The REAL number, always — the table is the data, not a transcript of the
   * geometry. What it adds is the one fact the drawing cannot carry non-visually:
   * a bar the chart had to put at the baseline is named as such here, so the
   * marked stub in the plot is not the only place that says so.
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
   * ★ No `overview`. `chartDescription()` is already the SVG's accessible name,
   *   so a listener has heard the series and the category count before they ever
   *   reach the table; a line here repeating them is the same sentence twice.
   */
  protected readonly a11ySummary = computed<SvDataSummary>(() => {
    const sets = this.datasets();
    return {
      caption: this.title() || 'Bar chart',
      columns: ['Category', ...sets.map((s) => s.label)],
      rows: this.categories().map((cat, ci) => ({
        key: cat,
        header: cat,
        cells: sets.map((_, si) => this.cellValue(si, ci)),
      })),
    };
  });

  // ── Tooltip state ─────────────────────────────────────────────────────────

  readonly tooltip = signal<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    label: '',
    items: [],
  });

  // ── SVG geometry constants ────────────────────────────────────────────────

  readonly SVG_WIDTH  = 600;
  readonly PADDING    = { top: 24, right: 24, bottom: 56, left: 56 };

  svgHeight = computed(() => this.height());
  plotW     = computed(() => this.SVG_WIDTH - this.PADDING.left - this.PADDING.right);
  plotH     = computed(() => this.svgHeight() - this.PADDING.top - this.PADDING.bottom);

  // ── Resolved options ──────────────────────────────────────────────────────

  showGrid   = computed(() => this.options().showGrid   ?? true);
  showLabels = computed(() => this.options().showLabels ?? true);
  showLegend = computed(() => this.options().showLegend ?? true);
  showValues = computed(() => this.options().showValues ?? false);
  barRadius  = computed(() => this.options().barRadius  ?? 4);
  barGap     = computed(() => this.options().barGap     ?? 0.3);

  // ── Derived data ──────────────────────────────────────────────────────────

  seriesColors = computed<string[]>(() =>
    this.datasets().map((d, i) => d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length])
  );

  maxValue = computed<number>(() => this.plotted().max);

  /** Nice round ceiling for the axis max (delegates to shared utility). */
  axisMax = computed<number>(() => niceMax(this.maxValue()));

  /** Evenly-spaced grid tick values (delegates to shared utility). */
  gridValues = computed<number[]>(() => gridTicks(this.axisMax(), 5));

  // ── Vertical bar geometry ─────────────────────────────────────────────────

  verticalBars = computed(() => {
    const cats    = this.categories();
    const sets    = this.datasets();
    const pw      = this.plotW();
    const ph      = this.plotH();
    const max     = this.axisMax();
    const nseries = sets.length;
    const ncat    = cats.length;
    const gap     = this.barGap();
    const colors  = this.seriesColors();
    const plotted = this.plotted();
    const radius  = this.barRadius();

    if (ncat === 0 || nseries === 0) return [];

    const groupW  = pw / ncat;
    const barW    = (groupW * (1 - gap)) / nseries;
    const barPad  = (groupW * gap) / 2;

    return sets.flatMap((series, si) =>
      cats.map((cat, ci) => {
        // ★ Geometry is built from what the chart CAN draw; `value` in the
        // returned object stays the real number, so the tooltip, the label and
        // the accessible name still report what the caller passed in. `clamped`
        // is what puts a visible marker at the baseline — see `resolveBarValues`.
        const value   = series.data[ci] ?? 0;
        const clamped = plotted.isClamped(si, ci);
        const barH    = clamped ? CLAMPED_BAR_STUB_PX : (value / max) * ph;
        const x     = ci * groupW + barPad + si * barW;
        const y     = ph - barH;
        const r     = Math.min(radius, barH / 2);
        return { x, y, barW, barH, r, value, clamped, cat, series: series.label,
                 color: clamped ? CLAMPED_BAR_FILL : colors[si] };
      })
    );
  });

  // ── Horizontal bar geometry ───────────────────────────────────────────────

  horizontalBars = computed(() => {
    const cats    = this.categories();
    const sets    = this.datasets();
    const pw      = this.plotW();
    const ph      = this.plotH();
    const max     = this.axisMax();
    const nseries = sets.length;
    const ncat    = cats.length;
    const gap     = this.barGap();
    const colors  = this.seriesColors();
    const plotted = this.plotted();
    const radius  = this.barRadius();

    if (ncat === 0 || nseries === 0) return [];

    const groupH  = ph / ncat;
    const barH    = (groupH * (1 - gap)) / nseries;
    const barPad  = (groupH * gap) / 2;

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
        const r     = Math.min(radius, barH / 2);
        return { x: 0, y, barW, barH, r, value, clamped, cat, series: series.label,
                 color: clamped ? CLAMPED_BAR_FILL : colors[si] };
      })
    );
  });

  // ── Grid / axis helpers ───────────────────────────────────────────────────

  gridLineY(value: number): number {
    return this.plotH() - (value / this.axisMax()) * this.plotH();
  }

  gridLineX(value: number): number {
    return (value / this.axisMax()) * this.plotW();
  }

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

  /** Build a rounded-top rect path for vertical bars. */
  vertBarPath(x: number, y: number, w: number, h: number, r: number): string {
    return roundedTopRectPath(x, y, w, h, r);
  }

  /** Build a rounded-right rect path for horizontal bars. */
  horizBarPath(x: number, y: number, w: number, h: number, r: number): string {
    return roundedRightRectPath(x, y, w, h, r);
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────

  showTooltip(
    event: MouseEvent,
    cat: string,
    seriesLabel: string,
    value: number,
    color: string
  ): void {
    const rect = (event.currentTarget as SVGElement)
      .closest('svg')!
      .getBoundingClientRect();
    const svgScale = this.SVG_WIDTH / rect.width;
    const x = (event.clientX - rect.left) * svgScale;
    const y = (event.clientY - rect.top) * (this.svgHeight() / rect.height);

    this.tooltip.set({
      visible: true,
      x: Math.min(x, this.SVG_WIDTH - 130),
      y: Math.max(y - 60, 8),
      label: cat,
      items: [{ color, series: seriesLabel, value }],
    });
  }

  /**
   * Shows the tooltip a hover would show, positioned from the bar's own
   * geometry instead of a pointer.
   *
   * ★ `showTooltip` cannot serve keyboard focus, because it reads `clientX` /
   * `clientY` off a MouseEvent and a FocusEvent has neither. Without a
   * coordinate-free path, a bar could be focused and activated but its value
   * would still be mouse-only — which is most of what the tooltip is for.
   */
  focusTooltip(x: number, y: number, cat: string, seriesLabel: string, value: number, color: string): void {
    this.tooltip.set({
      visible: true,
      x: Math.min(Math.max(x, 0), this.SVG_WIDTH - 130),
      y: Math.max(y - 60, 8),
      label: cat,
      items: [{ color, series: seriesLabel, value }],
    });
  }

  hideTooltip(): void {
    this.tooltip.update(t => ({ ...t, visible: false }));
  }

  /** Accessible name for one bar's focus target. */
  barAriaLabel(cat: string, seriesLabel: string, value: number, clamped = false): string {
    const base = `${seriesLabel ? `${seriesLabel}, ` : ''}${cat}: ${this.formatValue(value)}`;
    // A clamped bar is a stub the same size whatever the value was, so the name
    // has to carry what the geometry cannot. Without this a listener heard "-50"
    // and had no way to know the bar in front of them did not represent it.
    return clamped ? `${base}, not drawn to scale — this chart cannot plot it` : base;
  }

  /** Enter or Space activates a focused bar, exactly as a click does. */
  onBarKey(event: Event, cat: string, seriesLabel: string, value: number): void {
    event.preventDefault();
    this.onBarClick(cat, seriesLabel, value);
  }
}
