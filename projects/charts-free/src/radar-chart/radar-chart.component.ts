import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { type SvDataSummary, svUniqueId } from '@styloviz/core/a11y';
import { createSeriesEmphasis, SvChartFrameComponent, type SvDataError } from '@styloviz/core/data';
import { injectSvLabels, svFormatLabel } from '@styloviz/core/i18n';
import { SV_CHARTS_LABELS } from '@styloviz/charts/labels';

export interface RadarSeries {
  readonly name: string;
  readonly color: string;
  readonly values: readonly number[];
}

export interface RadarAxis {
  readonly label: string;
  /** Per-axis maximum used to normalise values. Falls back to `maxValue`. */
  readonly max?: number;
}

/** Payload emitted by the radar `pointHover` / `pointSelect` outputs. */
export interface RadarPointEvent {
  /** Series name the vertex belongs to. */
  readonly series: string;
  /** Axis label the vertex sits on. */
  readonly axis: string;
  /** Raw value at that vertex. */
  readonly value: number;
  /** Resolved series colour. */
  readonly color: string;
}

/**
 * The sample data this chart used to default to.
 *
 * Kept, exported and bound by the showcase rather than baked in: an
 * unbound chart that draws a convincing plot is indistinguishable from a
 * wired one that is silently receiving nothing.
 */
export const DEMO_RADAR_AXES: RadarAxis[] = [
    { label: 'Speed' }, { label: 'Reliability' }, { label: 'Comfort' }, // sv-i18n-ignore: demo sample data the host replaces
    { label: 'Safety' }, { label: 'Efficiency' }, { label: 'Value' }, // sv-i18n-ignore: demo sample data the host replaces
];

export const DEMO_RADAR_SERIES: RadarSeries[] = [
    { name: 'Model A', color: '#3b82f6', values: [80, 70, 90, 85, 75, 65] },
    { name: 'Model B', color: '#f59e0b', values: [60, 85, 65, 70, 90, 80] },
];

/** The axis-label font size, in SVG units — the template's `font-size` and `frame()` share it. */
const RADAR_LABEL_FONT_PX = 10;

@Component({
  selector: 'sv-radar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvChartFrameComponent],
  templateUrl: './radar-chart.component.html',
})
export class SvRadarChartComponent {
  protected readonly labels = injectSvLabels('charts', SV_CHARTS_LABELS);

  // ── Async state ───────────────────────────────────────────────────────────

  /** True while the series is being fetched. @default false */
  readonly loading = input<boolean>(false);

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an
   * `HttpErrorResponse`.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /** Copy for the no-data state. @default 'No data to plot' */
  readonly emptyMessage = input<string>(this.labels.noDataToPlot);

  /** True when the emptiness is caused by a filter rather than an empty set. */
  readonly filtered = input<boolean>(false);

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  /** Nothing to draw. Distinct from `loading`, which is not yet knowing. */
  readonly chartIsEmpty = computed(() => this.series().length === 0);

  /** The radial axes (one spoke per axis label). */
  axes   = input<readonly RadarAxis[]>([]);
  /** Series to plot; each value array aligns with `axes`. */
  series = input<readonly RadarSeries[]>([]);
  /** Chart diameter in pixels. @default 300 */
  size   = input<number>(300);
  /** Number of concentric grid levels. @default 5 */
  levels = input<number>(5);
  /** Global maximum that values are normalised against (per-axis `max` overrides). @default 100 */
  maxValue = input<number>(100);
  /** Show point markers at each value. @default true */
  showDots = input<boolean>(true);
  /** Fill the series area (vs stroke-only). @default true */
  filled   = input<boolean>(true);
  /** Chart title. */
  title  = input<string>('');
  /** Accessible name override for the chart. Falls back to a generated summary. */
  ariaLabel = input<string>('');
  /** Extra CSS classes applied to the root wrapper. */
  customClass = input<string>('');

  /**
   * Legend entries are keyboard buttons: hover or focus one and the other
   * series fade; Enter, Space or a click hides or shows it; the arrow keys move
   * between series. `false` keeps the static legend.
   * @default true
   */
  readonly interactiveLegend = input<boolean>(true);

  /**
   * Names of the series switched off from the legend. Two-way bindable
   * (`[(hiddenSeries)]`) so a host can persist and restore the choice; the
   * last visible series cannot be hidden.
   * @default []
   */
  readonly hiddenSeries = model<readonly string[]>([]);

  /** Isolate (fade the others) and toggle — the shared series-emphasis model. */
  readonly emphasis = createSeriesEmphasis({
    keys: () => this.series().map((s) => s.name),
    hidden: this.hiddenSeries,
  });

  /** Id of the legend's off-screen keyboard hint. */
  protected readonly legendHintId = svUniqueId('sv-radar-chart-legend');

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Emitted when a vertex is hovered or keyboard-focused. */
  readonly pointHover  = output<RadarPointEvent>();
  /** Emitted when a vertex is clicked or activated via keyboard (Enter/Space). */
  readonly pointSelect = output<RadarPointEvent>();

  readonly hoveredPoint = signal<RadarPointEvent | null>(null);

  readonly cx = computed(() => this.size() / 2);
  readonly cy = computed(() => this.size() / 2);
  readonly r  = computed(() => this.size() * 0.38);

  readonly total = computed(() => this.axes().length);

  /** Resolved maximum for axis `i` (per-axis override or the global maximum). */
  axisMax(i: number): number {
    const m = this.axes()[i]?.max;
    return m != null && m > 0 ? m : this.maxValue();
  }

  angle(i: number): number {
    return (i * 2 * Math.PI) / this.total() - Math.PI / 2;
  }

  axisPoint(i: number, pct = 1): { x: number; y: number } {
    const a = this.angle(i);
    return {
      x: this.cx() + this.r() * pct * Math.cos(a),
      y: this.cy() + this.r() * pct * Math.sin(a),
    };
  }

  levelPolygon(level: number): string {
    const pct = level / this.levels();
    return Array.from({ length: this.total() }, (_, i) => {
      const p = this.axisPoint(i, pct);
      return `${p.x},${p.y}`;
    }).join(' ');
  }

  readonly webPolygons = computed(() =>
    Array.from({ length: this.levels() }, (_, i) => this.levelPolygon(i + 1))
  );

  /**
   * The value a vertex is drawn at: the reading, or 0 when there is none.
   *
   * ★ `NaN ?? 0` is `NaN`, so a blank cell used to make one coordinate `NaN`,
   *   and an SVG `points` list with a `NaN` in it does not paint at all — the
   *   whole polygon vanished. It is drawn at the centre, like a missing value,
   *   and `scaleNote` says so.
   */
  private drawnValue(value: number | undefined): number {
    return value != null && Number.isFinite(value) ? value : 0;
  }

  private clampPct(value: number | undefined, i: number): number {
    const max = this.axisMax(i);
    return Math.max(0, Math.min(1, this.drawnValue(value) / max));
  }

  seriesPolygon(s: RadarSeries): string {
    return Array.from({ length: this.total() }, (_, i) => {
      const p = this.axisPoint(i, this.clampPct(s.values[i], i));
      return `${p.x},${p.y}`;
    }).join(' ');
  }

  seriesDots(s: RadarSeries): { x: number; y: number; value: number; axis: string }[] {
    return Array.from({ length: this.total() }, (_, i) => {
      const p = this.axisPoint(i, this.clampPct(s.values[i], i));
      return { ...p, value: this.drawnValue(s.values[i]), axis: this.axes()[i]?.label ?? '' };
    });
  }

  readonly axisLines = computed(() =>
    Array.from({ length: this.total() }, (_, i) => ({
      x1: this.cx(), y1: this.cy(), ...this.axisPoint(i)
    }))
  );

  protected readonly labelFontPx = RADAR_LABEL_FONT_PX;

  readonly labelPoints = computed(() =>
    this.axes().map((ax, i) => {
      const p = this.axisPoint(i, 1.18);
      return { label: ax.label, x: p.x, y: p.y };
    })
  );

  /**
   * The SVG box, grown to hold the axis labels.
   *
   * ★ Labels sit at 1.18× the radius and run outward from their anchor, so a
   *   side label ("Throughput" at 3 o'clock) always drew past a `0 0 size size`
   *   viewBox. `overflow-visible` hid that until a parent clipped — a card with
   *   less padding on a phone cut the label off. The box is measured from an
   *   estimate of each label's extent (0.6em per character at the 10px label
   *   size), so the whole chart scales down to fit instead.
   */
  readonly frame = computed(() => {
    const size = this.size();
    const font = RADAR_LABEL_FONT_PX;
    let minX = 0, minY = 0, maxX = size, maxY = size;
    for (const lp of this.labelPoints()) {
      const w = (lp.label ?? '').length * font * 0.6;
      const anchor = this.textAnchor(lp.x);
      const left = anchor === 'end' ? lp.x - w : anchor === 'middle' ? lp.x - w / 2 : lp.x;
      minX = Math.min(minX, left);
      maxX = Math.max(maxX, left + w);
      minY = Math.min(minY, lp.y - font / 2);
      maxY = Math.max(maxY, lp.y + font / 2);
    }
    const x = Math.floor(minX), y = Math.floor(minY);
    const width = Math.ceil(maxX) - x, height = Math.ceil(maxY) - y;
    return { width, height, viewBox: `${x} ${y} ${width} ${height}` };
  });

  textAnchor(x: number): string {
    const diff = x - this.cx();
    if (diff < -5) return 'end';
    if (diff > 5) return 'start';
    return 'middle';
  }

  /** Generated accessible summary used when `ariaLabel` is not supplied. */
  readonly resolvedAriaLabel = computed<string>(() => {
    if (this.ariaLabel()) return this.ariaLabel();
    const base = this.title() || this.labels.chartRadar;
    const axisList = this.axes().map(a => a.label).join(', ');
    const seriesList = this.series().map(s => s.name).join(', ');
    return svFormatLabel(this.labels.radarSummary, { title: base, axes: axisList, series: seriesList });
  });

  pointAriaLabel(s: RadarSeries, axis: string, value: number): string {
    return svFormatLabel(this.labels.radarPoint, { series: s.name, axis, value: String(value) });
  }

  /**
   * Every vertex the drawing had to move, as a sentence, or `null`.
   *
   * ★ Normalisation clamps to `[0, max]`, so 400 on a spoke whose maximum is 200
   *   sits on the rim exactly where 200 would, and −40 sits at the centre with a
   *   genuine 0. A blank or missing reading is drawn at the centre too. None of
   *   that was visible anywhere; the table carried the raw number, which only
   *   made the table and the picture disagree without saying why.
   */
  private readonly offScaleNote = computed<string | null>(() => {
    const axes = this.axes();
    const over: string[] = [];
    const under: string[] = [];
    const missing: string[] = [];
    for (const s of this.series()) {
      axes.forEach((ax, i) => {
        const v = s.values[i];
        const at = svFormatLabel(this.labels.radarAt, { series: s.name, axis: ax.label });
        if (v == null || !Number.isFinite(v)) missing.push(at);
        else if (v > this.axisMax(i)) {
          over.push(svFormatLabel(this.labels.radarOverItem, { at, value: String(v), max: String(this.axisMax(i)) }));
        } else if (v < 0) under.push(svFormatLabel(this.labels.radarUnderItem, { at, value: String(v) }));
      });
    }
    const parts: string[] = [];
    if (over.length) parts.push(svFormatLabel(this.labels.radarAbove, { items: over.join(', ') }));
    if (under.length) parts.push(svFormatLabel(this.labels.radarBelow, { items: under.join(', ') }));
    if (missing.length) parts.push(svFormatLabel(this.labels.radarMissing, { items: missing.join(', ') }));
    return parts.length ? parts.join(' ') : null;
  });

  /** True when the spokes are normalised against more than one maximum. */
  private readonly mixedAxisMax = computed(
    () => new Set(this.axes().map((_, i) => this.axisMax(i))).size > 1,
  );

  /**
   * What the polygon cannot be read for, under the plot.
   *
   * ★★★ TWO SEPARATE WAYS A RADAR MISLEADS, AND NEITHER IS VISIBLE IN THE
   *     DRAWING.
   *
   *     **Mixed maxima.** `RadarAxis.max` normalises per spoke, so with
   *     different maxima equal distance from the centre is NOT an equal value —
   *     80 out of 200 is drawn INSIDE 60 out of 100. A reader given the bare
   *     numbers would conclude the opposite of what is on screen. The summary
   *     table has carried the per-axis maximum for a while, but a table is the
   *     alternative for someone who cannot see the web; the person being misled
   *     is looking straight at it.
   *
   *     **Axis order.** The polygon's SHAPE and its AREA are entirely artefacts
   *     of the order the axes were written in. Swap two spokes and the same
   *     numbers draw a different figure — a spiky one becomes a smooth one —
   *     with nothing changed in the data. Area in particular reads as a
   *     magnitude and is not one: it is a function of which values happen to sit
   *     next to each other.
   *
   * ★ The order clause needs three spokes to mean anything: with two there is no
   *   ordering to change, and the sentence would be noise on a chart that cannot
   *   exhibit the problem.
   */
  readonly scaleNote = computed<string | null>(() => {
    const axes = this.axes();
    if (!axes.length || !this.series().length) return null;

    const parts: string[] = [];

    if (this.mixedAxisMax()) {
      // Which spoke has which maximum, not only the set of them: "(100, 200)"
      // told the reader the scales disagree without saying which to distrust.
      const byMax = new Map<number, string[]>();
      axes.forEach((ax, i) => {
        const labels = byMax.get(this.axisMax(i)) ?? [];
        labels.push(ax.label);
        byMax.set(this.axisMax(i), labels);
      });
      const maxima = [...byMax]
        .map(([max, axisLabels]) => svFormatLabel(this.labels.radarMaxGroup, { axes: axisLabels.join(', '), max: String(max) }))
        .join('; ');
      parts.push(svFormatLabel(this.labels.radarMixedMaxima, { maxima }));
    }

    const offScale = this.offScaleNote();
    if (offScale) parts.push(offScale);

    if (axes.length > 2) {
      parts.push(this.labels.radarOrderNote);
    }

    return parts.length ? parts.join(' ') : null;
  });

  /**
   * The web as rows — one axis per row, one column per series.
   *
   * ★★ A VERTEX'S VALUE IS ITS DISTANCE FROM THE CENTRE, and nothing else.
   *    `resolvedAriaLabel` names the axes and the series but carries no number,
   *    and the dots that do are optional — `showDots(false)` is a supported
   *    stroke-only look, and `filled` shapes with dots off announce nothing at
   *    all. Even with them on, comparing a two-series hexagon means visiting
   *    twelve tab stops to pair up six values, which is precisely the
   *    comparison the shape is drawn to make instant.
   *
   * ★ `Axis maximum` appears ONLY when the spokes disagree about theirs.
   *   `RadarAxis.max` normalises per spoke, so with mixed maxima equal distance
   *   from the centre is NOT an equal value — 80 out of 200 is drawn INSIDE 60
   *   out of 100. Given the bare numbers a reader would conclude the opposite
   *   of what is on screen. Under one shared maximum the column would repeat
   *   itself on every row, which is noise, so it is left out.
   *
   * ★ A missing value is reported as 0 because that is what is drawn: a values
   *   array shorter than `axes` puts the vertex at the centre.
   */
  protected readonly a11ySummary = computed<SvDataSummary>(() => {
    const sets = this.series();
    const mixed = this.mixedAxisMax();
    return {
      caption: this.title() || this.labels.chartRadar,
      columns: [this.labels.axisColumn, ...sets.map((s) => s.name), ...(mixed ? [this.labels.axisMaximumColumn] : [])],
      // Keyed by position: two spokes can share a label, and a duplicate key is
      // NG0955 in the shared table.
      rows: this.axes().map((ax, i) => ({
        key: `${i}-${ax.label}`,
        header: ax.label,
        cells: [
          ...sets.map((s) => String(this.drawnValue(s.values[i]))),
          ...(mixed ? [String(this.axisMax(i))] : []),
        ],
      })),
    };
  });

  isActive(s: RadarSeries, axis: string): boolean {
    const h = this.hoveredPoint();
    return !!h && h.series === s.name && h.axis === axis;
  }

  private toEvent(s: RadarSeries, axis: string, value: number): RadarPointEvent {
    return { series: s.name, axis, value, color: s.color };
  }

  hoverPoint(s: RadarSeries, axis: string, value: number): void {
    const ev = this.toEvent(s, axis, value);
    this.hoveredPoint.set(ev);
    // A vertex in focus puts its polygon in front (CH-13-M4).
    this.emphasis.emphasize(s.name);
    this.pointHover.emit(ev);
  }

  selectPoint(s: RadarSeries, axis: string, value: number): void {
    this.pointSelect.emit(this.toEvent(s, axis, value));
  }

  clearHover(): void {
    this.hoveredPoint.set(null);
    this.emphasis.emphasize(null);
  }
}
