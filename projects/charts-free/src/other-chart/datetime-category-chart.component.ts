import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  SvChartAnimDirective,
  SvChartFrameComponent,
  type SvDataError,
  svUniqueId,
} from '@styloviz/core';
import { DEFAULT_COLORS, formatChartValue, niceMax, gridTicks } from '../bar-chart/bar-chart.utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DateTimeZoom = 'day' | 'month' | 'year';

export interface DateTimeSeries {
  label: string;
  /** ISO date strings aligned with the categories */
  data: number[];
  color?: string;
  /** Fill the area under this series. Overrides the chart-wide `options.showArea` when set. */
  fill?: boolean;
}

export interface DateTimeCategoryOptions {
  showGrid?: boolean;
  showLegend?: boolean;
  /**
   * Fill the area under every series. A series' own `fill` overrides it either
   * way. This option was declared and read by nothing — every series was filled
   * unless it said `fill: false` — so `showArea: false` had no effect.
   * @default true
   */
  showArea?: boolean;
  zoom?: DateTimeZoom;
  animationDuration?: number;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  items: { series: string; value: number; color: string }[];
}

/** Payload emitted by the `categoryHover` / `categorySelect` outputs. */
export interface DateTimeCategoryEvent {
  /** Formatted category label. */
  category: string;
  /** Index of the category in the `categories` array. */
  index: number;
  /** Value of each series at that category. */
  items: { series: string; value: number; color: string }[];
}

/**
 * Format an ISO date category according to the zoom level.
 *
 * ★ A bare `YYYY-MM-DD` is parsed COMPONENT-WISE, as a local calendar date.
 *
 * ECMA-262 requires the date-only form to be read as **UTC midnight**, and
 * `toLocaleDateString` then renders it in the reader's own zone — so
 * `formatDateLabel('2026-03-15', 'day')` used to print **"Mar 14"** for every
 * user west of UTC, and the axis of a daily chart was labelled a day early for
 * roughly half the world. `new Date('2026-03-15T00:00:00')` (no `Z`) is local,
 * but building the parts directly avoids depending on that subtlety twice.
 *
 * A category carrying a time (`2026-03-15T14:30:00Z`) is an instant, not a
 * calendar day, so it is left to the normal parse and rendered in local time —
 * which is what the reader means by "when did this happen".
 *
 * ★★ THE LOCALE WAS HARD-CODED TO `en-US`. A date axis is the one axis whose
 *    labels are WORDS, and every one of them came out in American English and
 *    American order — "Mar 15" on a German dashboard, "Mar 15" on a Japanese
 *    one — with no input to change it and nothing saying so. It now defaults to
 *    the application's own `LOCALE_ID`, which is the value Angular already
 *    resolves for `DatePipe`, so a correctly configured app is right without
 *    doing anything and any chart can still be overridden on its own.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatDateLabel(iso: string, zoom: DateTimeZoom, locale: string): string {
  const parts = DATE_ONLY.exec(iso.trim());
  const d = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(iso);
  // An unparseable category would render as "Invalid Date" in every label; the
  // raw string is at least the thing the host actually sent.
  if (Number.isNaN(d.getTime())) return iso;
  if (zoom === 'day')   return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  if (zoom === 'month') return d.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  return String(d.getFullYear());
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * DateTimeCategoryChartComponent — Area/line chart with a date-time category axis.
 *
 * The X axis renders ISO date categories formatted according to the `zoom` input
 * (day / month / year). Labels auto-rotate on narrow viewports and thin out
 * automatically to avoid overlap.
 *
 * Supports multiple series with optional area fill and animated path draw-on.
 *
 * @example
 * ```html
 * <sv-datetime-category-chart
 *   [categories]="isoMonths"
 *   [series]="revenueSeries"
 *   title="Monthly Revenue"
 *   [options]="{ zoom: 'month', showArea: true }"
 * />
 * ```
 */

@Component({
  selector: 'sv-datetime-category-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartAnimDirective,
    SvChartFrameComponent,
  ],
  templateUrl: './datetime-category-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvDateTimeCategoryChartComponent {
  /** Per-instance suffix for every id this component puts in the document. */
  readonly _uid = svUniqueId('sv-datetime-category-chart');


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
  /** ISO date strings for the X axis, one per data point. A bare `YYYY-MM-DD` is read as a local calendar day; labels are formatted per `options.zoom` and `locale`. */
  categories  = input<string[]>([]);
  /** Line series; `data` holds one value per category. The area under a line is filled per the series' `fill`, else `options.showArea` (on by default). */
  series      = input<DateTimeSeries[]>([]);
  /** Chart title rendered above the plot; also used as the plot's accessible name. */
  title       = input<string>('');
  /** Chart height in pixels. @default 320 */
  height      = input<number>(320);
  /** Display options: grid, legend, area fill (`showArea`, default true; a series' own `fill` wins), date-label `zoom` (`'day'` | `'month'` | `'year'`, default `'month'`) and animation duration. */
  options     = input<DateTimeCategoryOptions>({});

  /**
   * BCP 47 locale for the date labels on the x-axis.
   *
   * Defaults to the application's `LOCALE_ID` — the same value `DatePipe` uses —
   * so an app that has configured its locale gets matching axis labels without
   * doing anything here. Override per chart for a report that must read in one
   * fixed language whoever opens it.
   *
   * ★ Only the LABELS are localised. The `categories` themselves stay ISO
   *   strings, because they are also the join key for the series and a localised
   *   key would differ between two readers looking at the same dashboard.
   * @default the app's LOCALE_ID
   */
  locale      = input<string>(inject(LOCALE_ID));
  /** Extra CSS classes applied to the root wrapper. */
  customClass = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────
  /** Emitted when a category is hovered or keyboard-focused. */
  readonly categoryHover  = output<DateTimeCategoryEvent>();
  /** Emitted when a category is clicked or activated via keyboard (Enter/Space). */
  readonly categorySelect = output<DateTimeCategoryEvent>();

  // ── Constants ─────────────────────────────────────────────────────────────
  readonly SVG_WIDTH = 600;
  readonly PAD       = { top: 20, right: 24, bottom: 52, left: 56 };

  // ── Derived ───────────────────────────────────────────────────────────────
  animDuration = computed(() => { const d = this.options().animationDuration; return d != null ? d + 'ms' : null; });
  showGrid     = computed(() => this.options().showGrid   ?? true);
  showLegend   = computed(() => this.options().showLegend ?? true);
  showArea     = computed(() => this.options().showArea   ?? true);

  /** Whether a series is drawn with an area fill: its own `fill`, else `options.showArea`. */
  protected filled(s: DateTimeSeries): boolean {
    return s.fill ?? this.showArea();
  }
  zoom         = computed<DateTimeZoom>(() => this.options().zoom ?? 'month');

  svgH  = computed(() => this.height());
  plotW = computed(() => this.SVG_WIDTH - this.PAD.left - this.PAD.right);
  plotH = computed(() => this.svgH() - this.PAD.top - this.PAD.bottom);

  seriesColors = computed<string[]>(() =>
    this.series().map((s, i) => s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length])
  );

  yMax   = computed(() => {
    const all = this.series().flatMap(s => s.data);
    return niceMax(Math.max(...all, 1));
  });
  yTicks = computed(() => gridTicks(this.yMax(), 5));

  /** Formatted X-axis labels from ISO categories */
  xLabels = computed(() =>
    this.categories().map(c => formatDateLabel(c, this.zoom(), this.locale())),
  );

  /** Step between category positions */
  xStep = computed(() => {
    const n = this.categories().length;
    return n > 1 ? this.plotW() / (n - 1) : this.plotW();
  });

  /** Thin out X labels so they don't overlap (keep every Nth) */
  labelStep = computed(() => {
    const step   = this.xStep();
    const minGap = 50; // px between labels
    return Math.max(1, Math.ceil(minGap / step));
  });

  /** Build SVG line path for a series */
  linePath(seriesData: number[]): string {
    const ph   = this.plotH();
    const yMax = this.yMax();
    const step = this.xStep();
    const n    = seriesData.length;
    if (!n) return '';

    return seriesData
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(1)} ${(ph - (v / yMax) * ph).toFixed(1)}`)
      .join(' ');
  }

  /** Build SVG closed area path (fill below line) */
  areaPath(seriesData: number[]): string {
    const line = this.linePath(seriesData);
    if (!line) return '';
    const ph = this.plotH();
    const pw = this.plotW();
    return `${line} L ${pw},${ph} L 0,${ph} Z`;
  }

  yTickY = (v: number) => this.plotH() - (v / this.yMax()) * this.plotH();
  fmt    = (v: number) => formatChartValue(v);

  // ── Tooltip ───────────────────────────────────────────────────────────────
  readonly tooltip = signal<TooltipState>({ visible: false, x: 0, y: 0, label: '', items: [] });

  showTooltip(e: MouseEvent): void {
    const cats   = this.categories();
    const step   = this.xStep();

    const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) * (this.SVG_WIDTH / rect.width) - this.PAD.left;
    const idx  = Math.round(svgX / step);
    const safeIdx = Math.max(0, Math.min(idx, cats.length - 1));
    this.setTooltipFor(safeIdx);
    this.categoryHover.emit(this.toEvent(safeIdx));
  }

  hideTooltip(): void { this.tooltip.update(t => ({ ...t, visible: false })); }

  /** Build the value list for a category index. */
  private itemsFor(idx: number): { series: string; value: number; color: string }[] {
    const colors = this.seriesColors();
    return this.series().map((s, i) => ({ series: s.label, value: s.data[idx] ?? 0, color: colors[i] }));
  }

  private toEvent(idx: number): DateTimeCategoryEvent {
    return { category: formatDateLabel(this.categories()[idx], this.zoom(), this.locale()), index: idx, items: this.itemsFor(idx) };
  }

  private setTooltipFor(idx: number): void {
    const step = this.xStep();
    this.tooltip.set({
      visible: true,
      x: Math.min(idx * step + this.PAD.left, this.SVG_WIDTH - 160),
      y: 12,
      label: formatDateLabel(this.categories()[idx], this.zoom(), this.locale()),
      items: this.itemsFor(idx),
    });
  }

  /** Show tooltip and emit hover for a known category index (keyboard focus). */
  focusCategory(idx: number): void {
    this.setTooltipFor(idx);
    this.categoryHover.emit(this.toEvent(idx));
  }

  selectCategory(idx: number): void {
    this.categorySelect.emit(this.toEvent(idx));
  }

  /** Resolve the category index from a mouse event and emit select. */
  selectFromMouse(e: MouseEvent): void {
    const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) * (this.SVG_WIDTH / rect.width) - this.PAD.left;
    const idx  = Math.max(0, Math.min(Math.round(svgX / this.xStep()), this.categories().length - 1));
    this.selectCategory(idx);
  }

  categoryAriaLabel(idx: number): string {
    const label = formatDateLabel(this.categories()[idx], this.zoom(), this.locale());
    const vals  = this.itemsFor(idx).map(it => `${it.series} ${this.fmt(it.value)}`).join(', ');
    return `${label}: ${vals}`;
  }

  /** X position (full-SVG coordinate) of category `idx`, used for hit-column rects. */
  catColumnX(idx: number): number {
    return idx * this.xStep();
  }
}
