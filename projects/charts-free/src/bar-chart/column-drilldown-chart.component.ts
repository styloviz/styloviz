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

import type { DrilldownDataset, DrilldownLevel, BarChartOptions, TooltipState } from './bar-chart.types';
import {
  CLAMPED_BAR_FILL,
  CLAMPED_BAR_STUB_PX,
  DEFAULT_COLORS,
  formatChartValue,
  gridTicks,
  niceMax,
  resolveBarValues,
  roundedTopRectPath,
} from './bar-chart.utils';

interface DrilldownBar {
  x: number;
  y: number;
  barW: number;
  barH: number;
  value: number;
  cat: string;
  series: string;
  color: string;
  hasDrilldown: boolean;
  seriesIndex: number;
  catIndex: number;
  /** Drawn as a marked stub at the baseline instead of at its own value. */
  clamped: boolean;
}

/**
 * ColumnDrilldownChartComponent — Column chart with interactive drilldown.
 *
 * Clicking a bar that has associated drilldown data navigates one level deeper.
 * A breadcrumb trail and back button enable navigation back up the drill stack.
 * Drillable bars are visually distinct (cursor pointer, slight glow).
 *
 * @example
 * ```html
 * <sv-column-drilldown-chart
 *   [categories]="quarters"
 *   [datasets]="salesDrilldown"
 *   rootTitle="Annual"
 *   title="Sales by Quarter — click a bar to drill down"
 * />
 * ```
 */
@Component({
  selector: 'sv-column-drilldown-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartAnimDirective,
    SvChartFrameComponent,
  ],
  templateUrl: './column-drilldown-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvColumnDrilldownChartComponent {

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
  /** Top-level category labels on the X-axis; a drilled-into level shows its own `categories` instead. */
  categories  = input<string[]>([]);
  /** Top-level series. A series whose `drilldown` map has an entry for a category makes that column clickable, switching the chart to the sub-level. */
  datasets    = input<DrilldownDataset[]>([]);
  /**
   * What to do with a column this chart cannot draw — a negative value, `NaN`,
   * `Infinity` — at whichever level is showing. Such a column used to be hidden
   * outright (and a drillable one became unreachable), and one `NaN` blanked the
   * axis.
   *
   * - `clamp` (default) — draw a marked stub at the baseline and disclose the
   *   real value under the plot.
   * - `reject` — refuse the level and show the error state.
   *
   * `omit` is not available: a column's position is its category index. For
   * data that genuinely goes below zero, use `<sv-negative-stack-chart>`.
   *
   * @default 'clamp'
   */
  readonly valuePolicy = input<SvValuePolicy>('clamp');
  /** Heading shown above the chart (omitted when empty); also used in the generated accessible name. @default '' */
  title       = input<string>('');
  /** Label of the first breadcrumb, which stands for the top level and stays visible while drilled down. @default 'Root' */
  rootTitle   = input<string>('Root');
  /** Chart height in px. @default 320 */
  height      = input<number>(320);
  /** Rendering options: `showGrid`, `showLabels`, `showLegend`, `showValues`, `barGap` (default 0.35), `barRadius` (default 6) and `animationDuration`. */
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
    const base = this.title() || 'Column drilldown chart';
    if (!cats.length || !sets.length) return base;
    const names = sets.map(s => s.label).filter(Boolean).join(', ');
    return `${base}: ${sets.length} series${names ? ` (${names})` : ''} across ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}.`;
  });
  animDuration = computed(() => { const d = this.options().animationDuration; return d != null ? d + 'ms' : null; });

  readonly tooltip = signal<TooltipState>({ visible: false, x: 0, y: 0, label: '', items: [] });

  // Internal drill stack — each entry represents a drilldown level
  readonly #stack = signal<DrilldownLevel[]>([]);

  canDrillBack = computed(() => this.#stack().length > 0);

  breadcrumbs = computed<string[]>(() => {
    const stack = this.#stack();
    return [this.rootTitle(), ...stack.map(l => l.title ?? '…')];
  });

  displayCategories = computed<string[]>(() => {
    const stack = this.#stack();
    return stack.length ? stack[stack.length - 1].categories : this.categories();
  });

  displayDatasets = computed<DrilldownDataset[]>(() => {
    const stack = this.#stack();
    return stack.length ? (stack[stack.length - 1].datasets as DrilldownDataset[]) : this.datasets();
  });

  /** The level's columns this chart can draw, and what it has to say about the rest. */
  protected readonly plotted = computed(() => resolveBarValues(this.displayDatasets(), this.valuePolicy(), 'sv-column-drilldown-chart'));

  /** A host error wins; otherwise a `reject` policy's refusal. */
  readonly resolvedError = computed<SvDataError | string | null>(() => this.error() ?? this.plotted().error);

  readonly SVG_WIDTH = 600;
  readonly PADDING   = { top: 16, right: 24, bottom: 40, left: 40 };

  svgHeight = computed(() => this.height());
  plotW     = computed(() => this.SVG_WIDTH - this.PADDING.left - this.PADDING.right);
  plotH     = computed(() => this.svgHeight() - this.PADDING.top - this.PADDING.bottom);

  showGrid   = computed(() => this.options().showGrid   ?? true);
  showLabels = computed(() => this.options().showLabels ?? true);
  showLegend = computed(() => this.options().showLegend ?? true);
  showValues = computed(() => this.options().showValues ?? false);
  barGap     = computed(() => this.options().barGap     ?? 0.35);
  barRadius  = computed(() => this.options().barRadius  ?? 6);

  seriesColors = computed<string[]>(() =>
    this.displayDatasets().map((d, i) => d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length])
  );

  /** Rounded from the highest DRAWABLE value — one `NaN` no longer blanks the axis. */
  axisMax = computed<number>(() => niceMax(this.plotted().max));

  gridValues = computed<number[]>(() => gridTicks(this.axisMax()));

  bars = computed<DrilldownBar[]>(() => {
    const cats   = this.displayCategories();
    const sets   = this.displayDatasets();
    const pw     = this.plotW();
    const ph     = this.plotH();
    const max    = this.axisMax();
    const ncat   = cats.length;
    const nser   = sets.length;
    const gap    = this.barGap();
    const colors = this.seriesColors();
    const plotted = this.plotted();

    if (!ncat || !sets.length) return [];

    const groupW = pw / ncat;
    const barW   = (groupW * (1 - gap)) / nser;
    const barPad = (groupW * gap) / 2;
    const result: DrilldownBar[] = [];

    for (let si = 0; si < nser; si++) {
      for (let ci = 0; ci < ncat; ci++) {
        const value   = sets[si].data[ci] ?? 0;
        const clamped = plotted.isClamped(si, ci);
        const barH    = clamped ? CLAMPED_BAR_STUB_PX : (value / max) * ph;
        const x      = ci * groupW + barPad + si * barW;
        const y      = ph - barH;
        const hasDrilldown = !!sets[si].drilldown?.[cats[ci]];
        result.push({
          x, y, barW, barH,
          value, cat: cats[ci], series: sets[si].label,
          color: clamped ? CLAMPED_BAR_FILL : colors[si], hasDrilldown,
          seriesIndex: si, catIndex: ci, clamped,
        });
      }
    }
    return result;
  });

  formatValue(v: number | string): string {
    return typeof v === 'string' ? v : formatChartValue(v);
  }

  barPath(bar: DrilldownBar): string {
    const r = Math.min(this.barRadius(), bar.barW / 2, bar.barH / 2);
    return roundedTopRectPath(bar.x, bar.y, bar.barW, bar.barH, r);
  }

  gridY(v: number): number { return this.plotH() - (v / this.axisMax()) * this.plotH(); }
  gridLineX(ci: number): number {
    const cats = this.displayCategories();
    return (ci / cats.length) * this.plotW() + this.plotW() / cats.length / 2;
  }

  drillDown(bar: DrilldownBar): void {
    if (!bar.hasDrilldown) return;
    const dataset = this.displayDatasets()[bar.seriesIndex];
    const level   = dataset.drilldown![bar.cat];
    this.#stack.update(s => [...s, level]);
    this.tooltip.update(t => ({ ...t, visible: false }));
  }

  drillBack(): void {
    this.#stack.update(s => s.slice(0, -1));
  }

  showTooltip(e: MouseEvent, bar: DrilldownBar): void {
    const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.SVG_WIDTH / rect.width);
    const y = (e.clientY - rect.top)  * (this.svgHeight() / rect.height);
    this.tooltip.set({
      visible: true,
      x: Math.min(x, this.SVG_WIDTH - 145),
      y: Math.max(y - 70, 8),
      label: bar.cat,
      items: [{ color: bar.color, series: bar.series, value: bar.value }],
    });
  }

  /**
   * Shows the tooltip a hover would show, positioned from the bar's own
   * geometry instead of a pointer.
   *
   * ★ `showTooltip` cannot serve keyboard focus: it reads `clientX` / `clientY`
   * off a MouseEvent and a FocusEvent has neither.
   */
  focusTooltip(bar: DrilldownBar): void {
    this.tooltip.set({
      visible: true,
      x: Math.min(Math.max(bar.x, 0), this.SVG_WIDTH - 145),
      y: Math.max(bar.y - 70, 8),
      label: bar.cat,
      items: [{ color: bar.color, series: bar.series, value: bar.value }],
    });
  }

  hideTooltip(): void { this.tooltip.update(t => ({ ...t, visible: false })); }

  /**
   * Accessible name for one bar. Drillable bars say so, because that is the
   * only cue a screen-reader user gets — the visual one is a pulsing dot.
   */
  barAriaLabel(bar: DrilldownBar): string {
    const base = `${bar.series ? `${bar.series}, ` : ''}${bar.cat}: ${this.formatValue(bar.value)}`
      + (bar.clamped ? ', not drawn to scale' : '');
    return bar.hasDrilldown ? `${base}. Drill down into ${bar.cat}` : base;
  }

  /** Enter or Space drills into a focused bar, exactly as a click does. */
  onBarKey(event: Event, bar: DrilldownBar): void {
    if (!bar.hasDrilldown) return;
    event.preventDefault();
    this.drillDown(bar);
  }

  /** Expose Math.abs for template use */
  protected readonly Math = Math;
}
