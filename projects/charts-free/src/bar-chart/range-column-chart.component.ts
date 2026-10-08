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

import type { RangeChartDataset, BarChartOptions, TooltipState } from './bar-chart.types';
import { DEFAULT_COLORS, formatChartValue, gridTicks, niceMax, resolveOmittedBars } from './bar-chart.utils';

export type { RangeChartDataset };

/**
 * RangeColumnChartComponent — Pure-SVG floating column chart.
 *
 * Each bar floats between a `low` and `high` value per category.
 * Ideal for showing temperature ranges, variance bands, min/max comparisons.
 *
 * @example
 * ```html
 * <sv-range-column-chart
 *   [categories]="months"
 *   [datasets]="[{ label: 'Temp', data: [{ low: 22, high: 41 }, ...] }]"
 *   title="Monthly Temperature Range"
 * />
 * ```
 */
@Component({
  selector: 'sv-range-column-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartAnimDirective,
    SvChartFrameComponent,
  ],
  templateUrl: './range-column-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvRangeColumnChartComponent {

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
  /** Category labels on the X-axis. */
  categories  = input<string[]>([]);
  /** One or more range series — each data point has `{ low, high }`. */
  datasets    = input<RangeChartDataset[]>([]);
  /**
   * What to do with a range this chart cannot draw — a `NaN` or unbounded end,
   * a low below zero (the axis starts at zero, so it hung outside the plot), or
   * a high below its low. Such ranges used to be drawn wrong without a word, and
   * one `NaN` blanked the axis.
   *
   * - `omit` (default) — leave the range out and say how many under the plot.
   *   Safe here: every range keeps its own slot, so no other bar moves.
   * - `reject` — refuse the dataset and show the error state.
   *
   * @default 'omit'
   */
  readonly valuePolicy = input<SvValuePolicy>('omit');

  /** Which ranges are left out, and the sentence that says so. */
  protected readonly plotted = computed(() =>
    resolveOmittedBars(this.datasets(), {
      value: (p: RangeChartDataset['data'][number]) => (Number.isFinite(p.low) && p.low < 0 ? p.low : p.high),
      plottable: (p: RangeChartDataset['data'][number]) =>
        Number.isFinite(p.low) && Number.isFinite(p.high) && p.low >= 0 && p.high >= p.low,
      policy: this.valuePolicy(),
      selector: 'sv-range-column-chart',
      noun: 'range',
      reason: 'a range must be finite, start at or above zero and end at or above its start.',
    }),
  );

  /** A host error wins; otherwise a `reject` policy's refusal. */
  readonly resolvedError = computed<SvDataError | string | null>(() => this.error() ?? this.plotted().error);
  /** Heading shown above the chart (omitted when empty); also used in the generated accessible name. @default '' */
  title       = input<string>('');
  /** Chart height in px. @default 320 */
  height      = input<number>(320);
  /** Rendering options: `showGrid`, `showLabels`, `showLegend`, `showValues`, `barGap` (default 0.35), `barRadius` (default 4) and `animationDuration`. */
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
    const base = this.title() || 'Range column chart';
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
  barGap     = computed(() => this.options().barGap     ?? 0.35);
  barRadius  = computed(() => this.options().barRadius  ?? 4);

  seriesColors = computed<string[]>(() =>
    this.datasets().map((d, i) => d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length])
  );

  axisMax = computed<number>(() => {
    // Drawable ranges only — one `NaN` high no longer makes the axis `NaN`.
    const plotted = this.plotted();
    const highs = this.datasets().flatMap((d, si) =>
      d.data.filter((_, ci) => !plotted.isOmitted(si, ci)).map(p => p.high));
    return niceMax(Math.max(...highs, 1));
  });

  gridValues = computed<number[]>(() => gridTicks(this.axisMax(), 5));

  tooltipH = computed(() => 36 + this.tooltip().items.length * 18);

  rangeBars = computed(() => {
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

    const groupW = pw / ncat;
    const barW   = (groupW * (1 - gap)) / nseries;
    const barPad = (groupW * gap) / 2;

    return sets.flatMap((s, si) =>
      cats.flatMap((cat, ci) => {
        if (plotted.isOmitted(si, ci)) return [];
        const pt    = s.data[ci] ?? { low: 0, high: 0 };
        const highY = ph - (pt.high / max) * ph;
        const lowY  = ph - (pt.low  / max) * ph;
        const barH  = Math.max(lowY - highY, 2);
        const x     = ci * groupW + barPad + si * barW;
        return [{
          x, y: highY, barW, barH,
          r: Math.min(r, barW / 2, barH / 2),
          low: pt.low, high: pt.high,
          cat, series: s.label, color: colors[si],
        }];
      })
    );
  });

  gridLineY(v: number): number {
    return this.plotH() - (v / this.axisMax()) * this.plotH();
  }

  formatValue(v: number | string): string {
    return typeof v === 'string' ? v : formatChartValue(v);
  }

  /** All-four-corners rounded rect path — used for floating bars. */
  floatBarPath(x: number, y: number, w: number, h: number, r: number): string {
    if (h <= 0 || w <= 0) return '';
    const sr = Math.min(r, w / 2, h / 2);
    return [
      `M ${x + sr} ${y}`,
      `H ${x + w - sr}`, `Q ${x + w} ${y} ${x + w} ${y + sr}`,
      `V ${y + h - sr}`, `Q ${x + w} ${y + h} ${x + w - sr} ${y + h}`,
      `H ${x + sr}`,     `Q ${x} ${y + h} ${x} ${y + h - sr}`,
      `V ${y + sr}`,     `Q ${x} ${y} ${x + sr} ${y}`, 'Z',
    ].join(' ');
  }

  showTooltip(e: MouseEvent, bar: { cat: string; high: number; low: number; color: string; series: string }): void {
    const svgEl = (e.currentTarget as SVGElement).closest('svg')!;
    const rect  = svgEl.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.SVG_WIDTH / rect.width);
    const y = (e.clientY - rect.top)  * (this.svgHeight() / rect.height);
    this.tooltip.set({
      visible: true,
      x: Math.min(x, this.SVG_WIDTH - 160),
      y: Math.max(y - 76, 8),
      label: bar.cat,
      items: [
        { color: bar.color, series: `${bar.series} — High`, value: bar.high },
        { color: bar.color, series: `${bar.series} — Low`,  value: bar.low  },
      ],
    });
  }

  hideTooltip(): void { this.tooltip.update(t => ({ ...t, visible: false })); }
}
