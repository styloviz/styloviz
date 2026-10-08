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
  svResolveShares,
  type SvDataError,
  type SvDataSummary,
  type SvValuePolicy,
  svPrepareShares,
  svShareSummaryRows,
} from '@styloviz/core';
import type { DefaultPieChartOptions, PieSlice, TooltipState } from './pie-chart.types';
import {
  PIE_COLORS,
  buildArcPath,
  explodeTransform,
  formatPieValue,
  sliceAngles,
  toPercent,
} from './pie-chart.utils';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * DefaultPieChartComponent — A pure-SVG animated pie chart.
 *
 * Features:
 * - Slice entrance animation (scale-in per slice, staggered)
 * - Explode-on-hover: hovered slice pushes outward
 * - Hover tooltip showing label, value and percentage
 * - Legend with colour dot, label and percentage
 * - Full dark-mode and responsive support
 * - No external dependencies
 *
 * @example
 * ```html
 * <sv-default-pie-chart
 *   title="Traffic Sources"
 *   [slices]="[{ label: 'Organic', value: 420 }, { label: 'Paid', value: 180 }]"
 * />
 * ```
 */
@Component({
  selector: 'sv-default-pie-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartAnimDirective,
    SvChartFrameComponent,
    SvDataSummaryTableComponent,
  ],
  templateUrl: './default-pie-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvDefaultPieChartComponent {

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

  /**
   * Nothing to plot — no slices, or slices that add to nothing.
   *
   * The second half is not the same condition. `[0, 0]` is a real answer about a
   * real dataset and this chart cannot draw it, so it shows the empty state; the
   * disclosure underneath is what tells the reader that the data arrived and was
   * all zero, rather than that the fetch came back with nothing.
   */
  readonly chartIsEmpty = computed(() => {
    const plotted = this.plotted();
    return plotted.items.length === 0 || plotted.allZero;
  });

  /** The load error, or the policy's refusal to plot this dataset under `reject`. */
  readonly resolvedError = computed<SvDataError | string | null>(
    () => this.error() ?? this.plotted().error,
  );
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Pie slices. Each must have a label and a positive value. */
  slices = input<PieSlice[]>([]);

  /**
   * What to do with a slice this chart cannot plot — a negative value, `NaN`,
   * `Infinity`. A pie divides by the sum of its values, so an unplottable one is
   * not merely undrawable: left in the denominator it changes the angle of every
   * OTHER slice, which is why there is no "leave it alone" option here.
   *
   * - `omit` (default) — drop it, and disclose the count and that the
   *   percentages are of the remainder.
   * - `reject` — refuse the dataset and show the error state.
   *
   * `clamp` is not supported: a clamped slice is a 0° arc, which leaves nothing
   * to mark, so it falls back to `omit` with a dev warning. `render` likewise.
   *
   * @default 'omit'
   */
  readonly valuePolicy = input<SvValuePolicy>('omit');

  /**
   * The slices actually drawn, and what has to be said about the ones that are
   * not. Everything downstream reads `items` and `total` from here — never
   * `slices()` — because a denominator that includes a value the chart did not
   * plot is the defect this replaced.
   */
  protected readonly plotted = computed(() => {
    const resolved = svResolveShares(this.slices(), this.valuePolicy(), 'sv-default-pie-chart');
    // Ordering and the long-tail fold run AFTER the value policy: the policy
    // decides what is plottable, and grouping a value it already refused would
    // put it back into the total by the side door.
    const prepared = svPrepareShares(resolved.items, resolved.total, resolved.notice, {
      order: this.options().sliceOrder,
      minShare: this.options().groupBelow,
      maxSlices: this.options().maxSlices,
      label: this.options().otherLabel,
    });
    return { ...resolved, ...prepared };
  });

  /** Chart title displayed above the SVG. */
  title = input<string>('');

  /** Size of the SVG canvas (width = height). @default 260 */
  size = input<number>(260);

  /** Chart options. */
  options = input<DefaultPieChartOptions>({});

  /** Extra CSS classes on the root wrapper. */
  customClass = input<string>('');

  /**
   * Accessible-name override for the chart image. When empty, a concise data
   * summary is generated; the full data is exposed via a visually-hidden table.
   * @default ''
   */
  ariaLabel = input<string>('');

  // ── Accessibility ───────────────────────────────────────────────────────────

  /** Concise summary used as the chart's accessible name. */
  readonly chartDescription = computed<string>(() => {
    const slices = this.plotted().items;
    const total  = this.total();
    const base = this.title() || 'Pie chart';
    if (!slices.length || !total) return base;
    const parts = slices.map(s => `${s.label} ${toPercent(s.value, total)}`).join(', ');
    return `${base}: ${parts}.`;
  });

  /** Resolved accessible name — explicit override or the generated summary. */
  readonly resolvedAriaLabel = computed<string>(() => this.ariaLabel() || this.chartDescription());

  /** Percentage share for the data table. */
  pct(value: number): string { return toPercent(value, this.total()); }

  /**
   * The slices as rows — value and share per segment.
   *
   * ★ No `overview`. `chartDescription()` already reads every label with its
   *   percentage as the SVG's accessible name, so the shares are announced once
   *   before the table begins. What the table adds is the raw values and a
   *   structure to compare them in, which the sentence cannot give.
   */
  protected readonly a11ySummary = computed<SvDataSummary>(() => ({
    caption: this.title() || 'Pie chart',
    columns: ['Segment', 'Value', 'Share'],
    // One row per drawn slice, plus the slices folded into `Other` listed under
    // it — which is what the fold notice tells the reader this table does.
    rows: svShareSummaryRows(this.plotted(), (s) => [this.fmt(s.value), this.pct(s.value)]),
  }));

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted when a slice (arc or legend entry) is clicked. */
  readonly sliceSelect = output<PieSlice>();

  onSliceClick(index: number): void {
    // Indexes into the PLOTTED slices, which is what the arcs and the legend are
    // built from. Indexing into `slices()` would emit a neighbour once anything
    // ahead of it was omitted.
    const slice = this.plotted().items[index];
    if (slice) this.sliceSelect.emit(slice);
  }

  // ── Hover state ───────────────────────────────────────────────────────────

  readonly hoveredIndex = signal<number>(-1);
  readonly tooltip = signal<TooltipState>({
    visible: false, x: 0, y: 0, label: '', value: 0, pct: '', color: '',
  });

  // ── Resolved options ──────────────────────────────────────────────────────

  showLegend     = computed(() => this.options().showLegend      ?? true);
  showTooltip    = computed(() => this.options().showTooltip     ?? true);
  sliceGap       = computed(() => this.options().sliceGap        ?? 1.5);
  animDuration   = computed(() => { const d = this.options().animationDuration; return d != null ? `${d}ms` : null; });
  explodeOnHover = computed(() => this.options().explodeOnHover  ?? true);
  explodeOffset  = computed(() => this.options().explodeOffset   ?? 10);

  // ── Geometry ──────────────────────────────────────────────────────────────

  cx     = computed(() => this.size() / 2);
  cy     = computed(() => this.size() / 2);
  radius = computed(() => this.size() / 2 - 10);

  // ── Colors ────────────────────────────────────────────────────────────────

  colors = computed<string[]>(() =>
    this.plotted().items.map((s, i) => s.color ?? PIE_COLORS[i % PIE_COLORS.length])
  );

  // ── Totals ────────────────────────────────────────────────────────────────

  total = computed<number>(() => this.plotted().total);

  // ── Arc data ──────────────────────────────────────────────────────────────

  arcs = computed<{
    path: string;
    midAngle: number;
    startAngle: number;
    endAngle: number;
    label: string;
    value: number;
    color: string;
    pct: string;
    delay: number;
  }[]>(() => {
    const slices = this.plotted().items;
    const total  = this.total();
    if (!total || !slices.length) return [];

    const cx  = this.cx();
    const cy  = this.cy();
    const r   = this.radius();
    const gap = this.sliceGap();
    const colors = this.colors();

    let cumDeg = 0;
    return slices.map((sl, i) => {
      const deg           = (sl.value / total) * 360;
      const { start, end } = sliceAngles(cumDeg, deg, gap);
      const mid      = cumDeg + deg / 2;
      cumDeg        += deg;

      return {
        path:       buildArcPath(cx, cy, r, start, end),
        midAngle:   mid,
        startAngle: start,
        endAngle:   end,
        label:      sl.label,
        value:      sl.value,
        color:      colors[i],
        pct:        toPercent(sl.value, total),
        delay:      i * 60,
      };
    });
  });

  // ── Slice transform (explode hover) ───────────────────────────────────────

  sliceTransform(index: number, midAngle: number): string {
    if (!this.explodeOnHover() || this.hoveredIndex() !== index) return '';
    return explodeTransform(midAngle, this.explodeOffset());
  }

  // ── Events ────────────────────────────────────────────────────────────────

  onSliceEnter(event: MouseEvent, index: number): void {
    this.hoveredIndex.set(index);
    if (!this.showTooltip()) return;
    const arc  = this.arcs()[index];
    const rect = (event.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    const s    = this.size();
    const x    = (event.clientX - rect.left) * (s / rect.width);
    const y    = (event.clientY - rect.top)  * (s / rect.height);
    this.tooltip.set({
      visible: true,
      x:       Math.min(x + 12, s - 130),
      y:       Math.max(y - 56, 4),
      label:   arc.label,
      value:   arc.value,
      pct:     arc.pct,
      color:   arc.color,
    });
  }

  onSliceLeave(): void {
    this.hoveredIndex.set(-1);
    this.tooltip.update(t => ({ ...t, visible: false }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  fmt(v: number): string { return formatPieValue(v); }
  trackByLabel(_: number, sl: PieSlice): string { return sl.label; }
}
