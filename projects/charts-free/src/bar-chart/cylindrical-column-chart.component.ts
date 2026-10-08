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
  type SvDataError,
  type SvValuePolicy,
} from '@styloviz/core';

import type { BarChartDataset, BarChartOptions, TooltipState } from './bar-chart.types';
import {
  CLAMPED_BAR_FILL,
  CLAMPED_BAR_STUB_PX,
  DEFAULT_COLORS,
  darkenColor,
  formatChartValue,
  gridTicks,
  lightenColor,
  niceMax,
  resolveBarValues,
} from './bar-chart.utils';

/**
 * CylindricalColumnChartComponent — Vertical column chart with 3-D cylinder caps.
 *
 * Each bar renders as a rectangle body topped with an ellipse, simulating the
 * look of a 3-D cylinder without any canvas or WebGL dependency.
 *
 * @example
 * ```html
 * <sv-cylindrical-column-chart
 *   [categories]="years"
 *   [datasets]="[{ label: 'Energy (TWh)', data: [180, 220, 260, 310] }]"
 *   title="Renewable Energy Generation"
 * />
 * ```
 */
@Component({
  selector: 'sv-cylindrical-column-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartAnimDirective,
    SvChartFrameComponent,
  ],
  templateUrl: './cylindrical-column-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvCylindricalColumnChartComponent {

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
  /** Category labels on the X-axis, one per column group. */
  categories  = input<string[]>([]);
  /** One or more series, drawn side by side as cylindrical columns; each `data` array holds one value per category. */
  datasets    = input<BarChartDataset[]>([]);
  /**
   * What to do with a column this chart cannot draw — a negative value, `NaN`,
   * `Infinity`. The axis starts at zero, so such a column used to be drawn as a
   * silent sliver (or, for `NaN`, blank the whole plot).
   *
   * - `clamp` (default) — draw a marked stub at the baseline and disclose the
   *   real value under the plot.
   * - `reject` — refuse the dataset and show the error state.
   *
   * `omit` is not available: a column's position is its index within its group.
   * For data that genuinely goes below zero, use `<sv-negative-stack-chart>`.
   *
   * @default 'clamp'
   */
  readonly valuePolicy = input<SvValuePolicy>('clamp');

  /** The columns this chart can draw, and what it has to say about the rest. */
  protected readonly plotted = computed(() => resolveBarValues(this.datasets(), this.valuePolicy(), 'sv-cylindrical-column-chart'));

  /** A host error wins; otherwise a `reject` policy's refusal. */
  readonly resolvedError = computed<SvDataError | string | null>(() => this.error() ?? this.plotted().error);
  /** Heading shown above the chart (omitted when empty); also used in the generated accessible name. @default '' */
  title       = input<string>('');
  /** Chart height in px. @default 320 */
  height      = input<number>(320);
  /** Rendering options: `showGrid`, `showLabels`, `showLegend`, `showValues`, `barGap` (default 0.3), `cylinderCapRatio` (default 0.18) and `animationDuration`. */
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
    const base = this.title() || 'Cylindrical column chart';
    if (!cats.length || !sets.length) return base;
    const names = sets.map(s => s.label).filter(Boolean).join(', ');
    return `${base}: ${sets.length} series${names ? ` (${names})` : ''} across ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}.`;
  });
  animDuration = computed(() => { const d = this.options().animationDuration; return d != null ? d + 'ms' : null; });

  readonly tooltip = signal<TooltipState>({ visible: false, x: 0, y: 0, label: '', items: [] });

  readonly SVG_WIDTH = 600;
  readonly PADDING   = { top: 24, right: 24, bottom: 56, left: 56 };

  svgHeight = computed(() => this.height());
  plotW     = computed(() => this.SVG_WIDTH - this.PADDING.left - this.PADDING.right);
  plotH     = computed(() => this.svgHeight() - this.PADDING.top - this.PADDING.bottom);

  showGrid   = computed(() => this.options().showGrid   ?? true);
  showLabels = computed(() => this.options().showLabels ?? true);
  showLegend = computed(() => this.options().showLegend ?? true);
  showValues = computed(() => this.options().showValues ?? false);
  barGap     = computed(() => this.options().barGap     ?? 0.3);
  /** Ellipse cap height as a fraction of bar width. @default 0.18 */
  capRatio   = computed(() => this.options().cylinderCapRatio ?? 0.18);

  seriesColors = computed<string[]>(() =>
    this.datasets().map((d, i) => d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length])
  );

  /** Highest DRAWABLE value — one `NaN` in the data no longer blanks the axis. */
  maxValue = computed<number>(() => this.plotted().max);

  axisMax    = computed<number>(() => niceMax(this.maxValue()));
  gridValues = computed<number[]>(() => gridTicks(this.axisMax(), 5));

  /** Bars with cylinder geometry: body rect + top/bottom ellipse dimensions. */
  cylindricalBars = computed(() => {
    const cats    = this.categories();
    const sets    = this.datasets();
    const pw      = this.plotW();
    const ph      = this.plotH();
    const max     = this.axisMax();
    const ncat    = cats.length;
    const nseries = sets.length;
    const gap     = this.barGap();
    const cap     = this.capRatio();
    const colors  = this.seriesColors();
    const plotted = this.plotted();

    if (!ncat || !nseries) return [];

    const groupW = pw / ncat;
    const barW   = (groupW * (1 - gap)) / nseries;
    const barPad = (groupW * gap) / 2;

    return sets.flatMap((series, si) =>
      cats.map((cat, ci) => {
        const value   = series.data[ci] ?? 0;
        // A clamped column is a marked stub the same size whatever its value was.
        const clamped = plotted.isClamped(si, ci);
        const barH    = clamped ? CLAMPED_BAR_STUB_PX : Math.max((value / max) * ph, 2);
        const capRy = barW * cap;                        // ellipse Y-radius
        const x     = ci * groupW + barPad + si * barW;
        const y     = ph - barH;                          // top of bar
        const cx    = x + barW / 2;                       // ellipse center X
        const rx    = barW / 2;                           // ellipse X-radius
        const color = clamped ? CLAMPED_BAR_FILL : colors[si];
        return {
          x, y, barW, barH, cx, rx, capRy, value, cat, clamped,
          series: series.label, color,
          capColor:  lightenColor(color, 0.28),
          baseColor: darkenColor(color,  0.18),
        };
      })
    );
  });

  gridLineY(v: number): number {
    return this.plotH() - (v / this.axisMax()) * this.plotH();
  }

  formatValue(v: number | string): string {
    return typeof v === 'string' ? v : formatChartValue(v);
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
