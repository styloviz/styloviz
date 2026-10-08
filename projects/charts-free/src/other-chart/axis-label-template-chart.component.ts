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
} from '@styloviz/core';
import { formatChartValue, niceMax, gridTicks, roundedTopRectPath } from '../bar-chart/bar-chart.utils';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A rich axis category with an optional icon colour and sub-label. */
export interface AxisLabelCategory {
  /** Primary label text */
  label: string;
  /** Optional sub-label shown beneath the main label */
  subLabel?: string;
  /** Colour swatch shown on the left of the label (hex / CSS colour) */
  iconColor?: string;
  /** Unicode icon character or emoji */
  icon?: string;
}

export interface AxisLabelTemplateDataset {
  label: string;
  data: number[];
  color?: string;
}

export interface AxisLabelTemplateOptions {
  showGrid?: boolean;
  showLegend?: boolean;
  showValues?: boolean;
  barGap?: number;
  animationDuration?: number;
}

/** Payload emitted by the axis-label-template `barHover` / `barSelect` outputs. */
export interface AxisLabelBarEvent {
  /** Category label. */
  category: string;
  /** Dataset (series) label. */
  series: string;
  /** Bar value. */
  value: number;
  /** Resolved bar colour. */
  color: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  items: { series: string; value: number; color: string }[];
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AxisLabelTemplateChartComponent — Bar chart with richly rendered axis labels.
 *
 * Each X-axis category can include an icon, colour swatch, primary label and a
 * secondary sub-label. The label template is rendered as inline SVG elements,
 * enabling designs impossible with plain text labels.
 *
 * @example
 * ```html
 * <sv-axis-label-template-chart
 *   [categories]="richCategories"
 *   [datasets]="datasets"
 *   title="Sales by Channel"
 * />
 * ```
 */
@Component({
  selector: 'sv-axis-label-template-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartAnimDirective,
    SvChartFrameComponent,
  ],
  templateUrl: './axis-label-template-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvAxisLabelTemplateChartComponent {

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
  // ── Inputs ────────────────────────────────────────────────────────────────
  /** X-axis categories; each renders its label plus an optional icon, colour swatch and sub-label. */
  categories  = input<AxisLabelCategory[]>([]);
  /** Bar series; each `data` array is indexed by category position and drawn as grouped bars. */
  datasets    = input<AxisLabelTemplateDataset[]>([]);
  /** Chart title rendered above the plot; also used as the plot's accessible name. */
  title       = input<string>('');
  /** Chart height in pixels. @default 340 */
  height      = input<number>(340);
  /** Display options: grid, legend, value labels, bar gap ratio and animation duration. */
  options     = input<AxisLabelTemplateOptions>({});
  /** Extra CSS classes applied to the root wrapper. */
  customClass = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────
  /** Emitted when a bar is hovered or keyboard-focused. */
  readonly barHover  = output<AxisLabelBarEvent>();
  /** Emitted when a bar is clicked or activated via keyboard (Enter/Space). */
  readonly barSelect = output<AxisLabelBarEvent>();

  // ── Constants ─────────────────────────────────────────────────────────────
  readonly SVG_WIDTH  = 600;
  readonly PAD        = { top: 20, right: 24, bottom: 72, left: 52 };
  readonly LABEL_H    = 48; // height reserved below axis for custom labels

  // ── Derived ───────────────────────────────────────────────────────────────
  animDuration = computed(() => { const d = this.options().animationDuration; return d != null ? d + 'ms' : null; });
  showGrid     = computed(() => this.options().showGrid   ?? true);
  showLegend   = computed(() => this.options().showLegend ?? true);
  showValues   = computed(() => this.options().showValues ?? false);
  barGapRatio  = computed(() => this.options().barGap     ?? 0.3);

  svgH  = computed(() => this.height());
  plotW = computed(() => this.SVG_WIDTH - this.PAD.left - this.PAD.right);
  plotH = computed(() => this.svgH() - this.PAD.top - this.PAD.bottom);

  seriesColors = computed<string[]>(() => {
    const palette = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899'];
    return this.datasets().map((d, i) => d.color ?? palette[i % palette.length]);
  });

  yMax   = computed(() => niceMax(Math.max(...this.datasets().flatMap(d => d.data), 1)));
  yTicks = computed(() => gridTicks(this.yMax(), 5));

  xStep = computed(() => {
    const n = this.categories().length;
    return n > 1 ? this.plotW() / n : this.plotW();
  });

  bars = computed(() => {
    const cats    = this.categories();
    const sets    = this.datasets();
    const ph      = this.plotH();
    const step    = this.xStep();
    const gap     = this.barGapRatio();
    const n       = sets.length;
    const colors  = this.seriesColors();
    const axMax   = this.yMax();

    if (!cats.length || !n) return [];

    const groupW = step * (1 - gap);
    const barW   = groupW / n;
    const offset = (step - groupW) / 2;

    return sets.flatMap((ds, si) =>
      cats.map((_cat, ci) => {
        const v    = ds.data[ci] ?? 0;
        const barH = (v / axMax) * ph;
        const x    = ci * step + offset + si * barW;
        const y    = ph - barH;
        return {
          path: roundedTopRectPath(x, y, barW - 1, barH, 3),
          color: colors[si],
          value: v,
          catIdx: ci,
          series: ds.label,
          delay: (ci * n + si) * 40,
        };
      })
    );
  });

  yTickY = (v: number) => this.plotH() - (v / this.yMax()) * this.plotH();
  catX   = (ci: number) => ci * this.xStep() + this.xStep() / 2;
  fmt    = (v: number) => formatChartValue(v);

  // ── Tooltip ───────────────────────────────────────────────────────────────
  readonly tooltip = signal<TooltipState>({ visible: false, x: 0, y: 0, label: '', items: [] });

  showTooltip(e: MouseEvent, catIdx: number, seriesLabel: string, value: number, color: string): void {
    const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    const x    = (e.clientX - rect.left) * (this.SVG_WIDTH / rect.width);
    const y    = (e.clientY - rect.top)  * (this.svgH()    / rect.height);
    this.tooltip.set({
      visible: true,
      x: Math.min(x, this.SVG_WIDTH - 150),
      y: Math.max(y - 70, 8),
      label: this.categories()[catIdx]?.label ?? '',
      items: [{ series: seriesLabel, value, color }],
    });
    this.barHover.emit(this.toBarEvent(catIdx, seriesLabel, value, color));
  }

  hideTooltip(): void { this.tooltip.update(t => ({ ...t, visible: false })); }

  private toBarEvent(catIdx: number, series: string, value: number, color: string): AxisLabelBarEvent {
    return { category: this.categories()[catIdx]?.label ?? '', series, value, color };
  }

  /** Emit hover without moving the visual tooltip (keyboard focus). */
  hoverBar(catIdx: number, series: string, value: number, color: string): void {
    this.barHover.emit(this.toBarEvent(catIdx, series, value, color));
  }

  selectBar(catIdx: number, series: string, value: number, color: string): void {
    this.barSelect.emit(this.toBarEvent(catIdx, series, value, color));
  }

  barAriaLabel(catIdx: number, series: string, value: number): string {
    return `${series}, ${this.categories()[catIdx]?.label ?? ''}: ${this.fmt(value)}`;
  }
}
