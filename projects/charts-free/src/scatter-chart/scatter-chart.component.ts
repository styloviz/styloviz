import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  SvChartFrameComponent,
  SvDataSummaryTableComponent,
  svBinDensityStep,
  svHexBin,
  svHexPath,
  svNiceScale,
  svTickLabel,
  type SvDataError,
  type SvDataSummary,
  type SvPointBin,
} from '@styloviz/core';
import {
  svScatterCrowding,
  svScatterHygiene,
  svSystematicSample,
} from './scatter-chart.utils';

export interface ScatterPoint {
  readonly x: number;
  readonly y: number;
  readonly size?: number;   // bubble radius (optional)
  readonly label?: string;
}

export interface ScatterSeries {
  readonly name: string;
  readonly color: string;
  readonly points: readonly ScatterPoint[];
}

/** Payload emitted by the scatter `pointHover` / `pointSelect` outputs. */
export interface ScatterPointEvent {
  /** Name of the series the point belongs to. */
  readonly series: string;
  /** The data point itself. */
  readonly point: ScatterPoint;
  /** Resolved series colour. */
  readonly color: string;
}

/** How many series contributed to one bin, and which. */
export interface ScatterBinShare {
  readonly series: string;
  readonly color: string;
  readonly count: number;
}

/**
 * Payload emitted by `binHover` / `binSelect` — one hexagonal neighbourhood.
 *
 * `points` is the actual data, not a count: a bin the host cannot open is a dead
 * end, and "show me these 34 rows" is the first thing anyone asks of a dense plot.
 */
export interface ScatterBinEvent {
  /** Centre of the bin in DATA units, so it can be compared against the axes. */
  readonly x: number;
  readonly y: number;
  /** How many points landed in it. */
  readonly count: number;
  /** The points themselves, in the order they were supplied. */
  readonly points: readonly ScatterPoint[];
  /** Which series contributed, largest share first. */
  readonly shares: readonly ScatterBinShare[];
}

/**
 * What the plot draws.
 *
 * - `points` — one mark per datum, the classic scatter.
 * - `bins` — hexagonal density bins, shaded by how many points landed in each.
 * - `auto` — `points` up to `binThreshold`, `bins` above it. The default,
 *   because the point at which a scatter plot starts lying about its density is
 *   a property of the data, not something a host should have to notice.
 */
export type ScatterRenderMode = 'auto' | 'points' | 'bins';

/**
 * The density ramp, five steps, palest to strongest.
 *
 * Classes rather than inline fills because an inline colour cannot carry a
 * `dark:` variant, and a ramp that does not invert for dark mode puts the densest
 * bins closest to the background. `primary-*` rather than a literal hue so a
 * rebrand moves the ramp with the rest of the kit.
 */
const DENSITY_FILL: readonly string[] = [
  'fill-primary-100 dark:fill-primary-900',
  'fill-primary-200 dark:fill-primary-800',
  'fill-primary-400 dark:fill-primary-600',
  'fill-primary-600 dark:fill-primary-400',
  'fill-primary-800 dark:fill-primary-200',
];

const DENSITY_STEPS = DENSITY_FILL.length;

/** One entry in the flattened plot: a point together with the series it came from. */
interface PlotEntry {
  readonly s: ScatterSeries;
  readonly p: ScatterPoint;
}

/**
 * The sample data this chart used to default to.
 *
 * Kept, exported and bound by the showcase rather than baked in: an
 * unbound chart that draws a convincing plot is indistinguishable from a
 * wired one that is silently receiving nothing.
 */
export const DEMO_SCATTER_SERIES: ScatterSeries[] = [
    {
      name: 'Group A', color: '#3b82f6',
      points: [
        { x: 10, y: 30 }, { x: 20, y: 60 }, { x: 35, y: 45 },
        { x: 50, y: 80 }, { x: 65, y: 55 }, { x: 75, y: 90 }, { x: 85, y: 40 },
      ],
    },
    {
      name: 'Group B', color: '#f59e0b',
      points: [
        { x: 15, y: 70 }, { x: 30, y: 20 }, { x: 45, y: 65 },
        { x: 60, y: 35 }, { x: 70, y: 75 }, { x: 80, y: 50 }, { x: 90, y: 85 },
      ],
    },
];

@Component({
  selector: 'sv-scatter-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvChartFrameComponent, SvDataSummaryTableComponent],
  templateUrl: './scatter-chart.component.html',
})
export class SvScatterChartComponent {
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
  readonly emptyMessage = input<string>('No data to plot');

  /** True when the emptiness is caused by a filter rather than an empty set. */
  readonly filtered = input<boolean>(false);

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  /** Nothing to draw. Distinct from `loading`, which is not yet knowing. */
  readonly chartIsEmpty = computed(() => this.series().length === 0);

  /** Point series: each with a name, color and (x, y) points. */
  series  = input<readonly ScatterSeries[]>([]);
  /** Chart width in pixels. @default 480 */
  width   = input<number>(480);
  /** Chart height in pixels. @default 300 */
  height  = input<number>(300);
  /** Point radius in pixels. @default 6 */
  dotSize = input<number>(6);
  /** Show background grid lines. @default true */
  showGrid = input<boolean>(true);
  /** X-axis label. @default 'X Axis' */
  xLabel   = input<string>('X Axis');
  /** Y-axis label. @default 'Y Axis' */
  yLabel   = input<string>('Y Axis');
  /** Chart title. */
  title    = input<string>('');
  /** Accessible name override for the chart. Falls back to a generated summary. */
  ariaLabel = input<string>('');
  /** Extra CSS classes applied to the root wrapper. */
  customClass = input<string>('');

  // ── Density and scale ───────────────────────────────────────────────────────

  /** What the plot draws. @default 'auto' @see ScatterRenderMode */
  readonly renderMode = input<ScatterRenderMode>('auto');

  /**
   * Point count at which `renderMode: 'auto'` switches to density bins.
   * @default 2000
   *
   * The default is deliberately well above the count at which a plot starts
   * overlapping and well below the count at which the browser struggles: below it
   * a reader can still resolve individual marks, above it the marks are a solid
   * blob whose shade means nothing.
   */
  readonly binThreshold = input<number>(2000);

  /**
   * Point count above which the `points` path paints to a canvas instead of
   * emitting one SVG node per datum. @default 1200
   *
   * ★ The documented switch-over. 1,200 `<circle>` elements is roughly where
   *   layout, hit-testing and change detection stop being free; past it the page
   *   janks on scroll and every keystroke elsewhere in the app pays for the chart.
   *   The raster is the same picture — same radii, same colours, same alpha — so
   *   crossing the line changes the DOM, not the drawing.
   */
  readonly canvasThreshold = input<number>(1200);

  /** Circumradius of one density hexagon, in pixels. @default 9 */
  readonly binRadius = input<number>(9);

  /**
   * Hard cap on how many points are drawn. `0` means no cap. @default 0
   *
   * When it bites, the subset is taken at a fixed stride rather than off the front
   * — and the chart says so, in the notice and in the summary table.
   */
  readonly maxPoints = input<number>(0);

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Emitted when a point is hovered or keyboard-focused. */
  readonly pointHover  = output<ScatterPointEvent>();
  /** Emitted when a point is clicked or activated via keyboard (Enter/Space). */
  readonly pointSelect = output<ScatterPointEvent>();
  /** Emitted when a density bin is hovered or keyboard-focused. */
  readonly binHover = output<ScatterBinEvent>();
  /** Emitted when a density bin is clicked or activated via keyboard. */
  readonly binSelect = output<ScatterBinEvent>();

  readonly hoveredPoint = signal<ScatterPointEvent | null>(null);
  readonly hoveredBin = signal<ScatterBinEvent | null>(null);

  /**
   * `l` carries the y tick labels AND the rotated axis title at `l - 30`, and the
   * labels are `formatChartValue`d, so four characters is the worst case.
   */
  readonly pad = { t: 20, r: 20, b: 40, l: 48 };

  readonly innerW = computed(() => this.width()  - this.pad.l - this.pad.r);
  readonly innerH = computed(() => this.height() - this.pad.t - this.pad.b);

  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  // ── The data pipeline ───────────────────────────────────────────────────────

  /** Every point with the series it belongs to, flattened once. */
  private readonly entries = computed<readonly PlotEntry[]>(() =>
    this.series().flatMap(s => s.points.map(p => ({ s, p }))),
  );

  /**
   * What can be drawn, and what is wrong with the rest.
   *
   * ★★★ This used to be nothing at all, and the consequence was total: a single
   *     point with a missing `x` made `Math.min(...)` return `NaN`, so both axis
   *     ends were `NaN`, so every coordinate in the SVG was `NaN`. Browsers drop a
   *     `NaN` coordinate silently, so one bad row produced an empty white box with
   *     no error in the console and no message on the page.
   */
  readonly hygiene = computed(() =>
    svScatterHygiene(this.entries(), {
      x: e => e.p.x,
      y: e => e.p.y,
      size: e => e.p.size,
    }),
  );

  /** The subset actually drawn, once `maxPoints` has had its say. */
  private readonly sampled = computed(() =>
    svSystematicSample(this.hygiene().usable, this.maxPoints()),
  );

  private readonly drawn = computed(() => this.sampled().items);

  /**
   * The axes come from every usable point, not from the drawn subset.
   *
   * A sample that happens to miss the largest value would otherwise shrink the
   * axis around it, and the plot would claim a range the data does not have.
   */
  readonly xScale = computed(() =>
    svNiceScale(...extent(this.hygiene().usable.map(e => e.p.x))),
  );

  readonly yScale = computed(() =>
    svNiceScale(...extent(this.hygiene().usable.map(e => e.p.y))),
  );

  scaleX(x: number): number {
    const { min, max } = this.xScale();
    return this.pad.l + ((x - min) / (max - min)) * this.innerW();
  }

  scaleY(y: number): number {
    const { min, max } = this.yScale();
    return this.pad.t + (1 - (y - min) / (max - min)) * this.innerH();
  }

  /** Screen pixels back to data units — the bins are binned on screen. */
  private unscaleX(px: number): number {
    const { min, max } = this.xScale();
    return min + ((px - this.pad.l) / this.innerW()) * (max - min);
  }

  private unscaleY(py: number): number {
    const { min, max } = this.yScale();
    return min + (1 - (py - this.pad.t) / this.innerH()) * (max - min);
  }

  /**
   * The grid, from the scales that draw the points.
   *
   * ★★★ THE DEFECT. This was the literal `[0, 25, 50, 75, 100]` for both axes
   *     while `scaleX`/`scaleY` mapped the DATA range across the plot. Any data
   *     that did not happen to span 0–100 was therefore drawn against tick labels
   *     belonging to no data at all: a salary plot showed points at 118,400 beside
   *     an axis labelled `0 25 50 75 100`, and four of the five grid lines fell
   *     outside the plot box entirely.
   */
  readonly gridLines = computed(() => ({
    xTicks: this.xScale().ticks,
    yTicks: this.yScale().ticks,
  }));

  /**
   * Tick label text, per axis.
   *
   * Two methods rather than one because the unit is chosen from the axis STEP, and
   * the two axes rarely share one: a plot of salary against year needs `120k` down
   * the side and `2014` along the bottom, and a single formatter gave both of them
   * `2.0k`.
   */
  xTick(value: number): string {
    return svTickLabel(value, this.xScale().step);
  }

  yTick(value: number): string {
    return svTickLabel(value, this.yScale().step);
  }

  // ── What gets drawn ─────────────────────────────────────────────────────────

  /** `points` or `bins`, after `auto` has looked at how much data there is. */
  readonly drawMode = computed<'points' | 'bins'>(() => {
    const mode = this.renderMode();
    if (mode !== 'auto') return mode;
    return this.drawn().length > this.binThreshold() ? 'bins' : 'points';
  });

  /** True when the points are painted to a canvas rather than emitted as nodes. */
  readonly useRaster = computed(() =>
    this.drawMode() === 'points' && this.drawn().length > this.canvasThreshold(),
  );

  /**
   * Whether the keyboard and the pointer address points or neighbourhoods.
   *
   * ★★ The `CH-16-I2` answer. One focus target per datum is fine for forty points
   *    and absurd for forty thousand — nobody tabs through a cloud. Once the plot
   *    is dense enough to be rasterised or binned, the reachable thing becomes the
   *    bin: a few hundred targets instead of tens of thousands, each announcing how
   *    many points it holds and which series they came from, and each carrying the
   *    real rows out through `binSelect`.
   */
  readonly focusTargets = computed<'points' | 'bins'>(() =>
    this.drawMode() === 'bins' || this.useRaster() ? 'bins' : 'points',
  );

  /** The hexagon outline, one string for every bin, positioned by `transform`. */
  readonly hexPath = computed(() => svHexPath(Math.max(0.5, this.binRadius())));

  /**
   * A fixed-size hexagon for the density key.
   *
   * Not `hexPath()`: the key sits in a 14×14 box and would clip a bin drawn at a
   * `binRadius` of 20, and a key whose swatch is a different shape from the thing
   * it is a key for is worse than no key.
   */
  readonly legendHexPath = svHexPath(6);

  private readonly bins = computed<readonly SvPointBin<PlotEntry>[]>(() => {
    if (this.focusTargets() !== 'bins') return [];
    return svHexBin(this.drawn(), {
      x: e => this.scaleX(e.p.x),
      y: e => this.scaleY(e.p.y),
      radius: Math.max(0.5, this.binRadius()),
    });
  });

  /** The densest bin, which anchors the shading ramp. */
  readonly peakBinCount = computed(() =>
    this.bins().reduce((max, b) => Math.max(max, b.count), 0),
  );

  /**
   * The bins as marks, in reading order — top row first, then left to right.
   *
   * The order is the arrow-key order and the summary-table order, so "the third
   * one along" means the same thing to a mouse, a keyboard and a screen reader.
   */
  readonly binMarks = computed(() => {
    const peak = this.peakBinCount();
    const sorted = [...this.bins()].sort((a, b) => a.r - b.r || a.q - b.q);
    return sorted.map(b => {
      const step = svBinDensityStep(b.count, peak, DENSITY_STEPS);
      const event = this.toBinEvent(b);
      return {
        cx: round(b.cx),
        cy: round(b.cy),
        transform: `translate(${round(b.cx)},${round(b.cy)})`,
        count: b.count,
        step,
        fillClass: DENSITY_FILL[step - 1],
        event,
        ariaLabel: this.binAriaLabel(event),
      };
    });
  });

  /** The points as marks. Empty in bins mode, and empty once rasterised. */
  readonly pointMarks = computed(() => {
    if (this.drawMode() !== 'points' || this.useRaster()) return [];
    return this.drawn().map(e => ({
      series: e.s,
      point: e.p,
      cx: round(this.scaleX(e.p.x)),
      cy: round(this.scaleY(e.p.y)),
      color: e.s.color,
      radius: this.pointRadius(e.p),
      ariaLabel: this.pointAriaLabel(e.s, e.p),
    }));
  });

  /**
   * A point's radius, with an unusable `size` falling back to `dotSize`.
   *
   * ★★ `p.size ?? dotSize()` passed a `NaN` or a negative straight through to
   *    `r`, and an SVG circle with a non-finite radius is simply not painted — one
   *    point missing from an otherwise healthy-looking plot, with nothing anywhere
   *    to say which one or why.
   */
  private pointRadius(p: ScatterPoint): number {
    const size = p.size;
    return size !== undefined && Number.isFinite(size) && size > 0 ? size : this.dotSize();
  }

  // ── The canvas path ─────────────────────────────────────────────────────────

  /**
   * What to paint, as plain data. Pure, so the switch-over is testable without a
   * canvas — the imperative part below is then only the two dozen lines that
   * cannot be.
   */
  readonly rasterPlan = computed(() => {
    if (!this.useRaster()) return [];
    return this.drawn().map(e => ({
      x: round(this.scaleX(e.p.x)),
      y: round(this.scaleY(e.p.y)),
      r: this.pointRadius(e.p),
      color: e.s.color,
    }));
  });

  private readonly rasterUrl = signal<string | null>(null);

  /**
   * The painted layer, as a same-origin `data:` URL for an SVG `<image>`.
   *
   * ★ Why an `<image>` inside the SVG rather than a `<canvas>` beside it: the
   *   export path serialises the live `<svg>` and rasterises it through a canvas,
   *   and an external `href` would taint that canvas and make `toBlob` throw. A
   *   `data:` URL is same-origin, so PNG, SVG and PDF export keep working. It also
   *   avoids keeping a second element's size, device-pixel-ratio and hit-testing in
   *   step with the first.
   */
  readonly rasterHref = computed(() => this.rasterUrl());

  /**
   * Whether the hexagons are drawn as the picture or only as focus targets.
   *
   * They stay visible until the raster has actually painted, which is what a
   * server-rendered page and a browser with no 2-D context both get: a correct
   * hexbin plot rather than an empty box. The element tree is the same either way,
   * so nothing structural changes at hydration — only the fill.
   */
  readonly binsAreVisible = computed(() =>
    this.drawMode() === 'bins' || this.rasterUrl() === null,
  );

  constructor() {
    effect(() => {
      const plan = this.rasterPlan();
      const w = this.width();
      const h = this.height();
      if (!this.browser || !plan.length) {
        this.rasterUrl.set(null);
        return;
      }
      this.rasterUrl.set(paintPoints(plan, w, h));
    });
  }

  // ── Notice ──────────────────────────────────────────────────────────────────

  /**
   * What the reader needs to know that the picture cannot show.
   *
   * Rendered under the plot by the frame rather than logged: a console warning is
   * read by the developer who wired the chart, once, and never by the person
   * looking at the dashboard six months later.
   */
  readonly notice = computed<string | null>(() => {
    const parts: string[] = [];
    const h = this.hygiene();
    const total = this.entries().length;
    const drawn = this.drawn().length;

    if (this.drawMode() === 'bins' && this.binMarks().length) {
      parts.push(
        `${plural(drawn, 'point')} aggregated into ` +
        `${plural(this.binMarks().length, 'hexagonal bin')}; the shading is how many ` +
        `landed in each, and the densest holds ${this.peakBinCount()}.`,
      );
      if (this.series().length > 1) {
        parts.push('Series are pooled — hover or focus a bin for its breakdown.');
      }
    } else if (this.useRaster() && this.rasterHref() === null) {
      // No canvas to paint on (a server render, a locked-down browser): the
      // hexagons are shaded and ARE the picture, so saying "painted as one
      // image" would describe a raster that is not there.
      parts.push(
        `${plural(drawn, 'point')} aggregated into ` +
        `${plural(this.binMarks().length, 'hexagonal bin')} because they could not be ` +
        `painted as one image here; the shading is how many landed in each, and the ` +
        `densest holds ${this.peakBinCount()}.`,
      );
    } else if (this.useRaster()) {
      parts.push(
        `${plural(drawn, 'point')} painted as one image rather than ` +
        `${drawn} separate shapes; the hexagons over it are the hover and keyboard targets.`,
      );
    }

    const stride = this.sampled().stride;
    if (stride > 1) {
      parts.push(
        `Showing ${drawn} of ${h.usable.length} points — every ${ordinal(stride)}, ` +
        `spread evenly so the shape of the cloud is preserved. Individual gaps are not.`,
      );
    }

    if (h.droppedCoord > 0) {
      parts.push(
        `${plural(h.droppedCoord, 'point')} of ${total} had no usable x or y and ` +
        `${h.droppedCoord === 1 ? 'is' : 'are'} not plotted.`,
      );
    }

    if (h.droppedSize > 0) {
      parts.push(
        `${plural(h.droppedSize, 'point')} had a size that cannot be drawn and ` +
        `${h.droppedSize === 1 ? 'is' : 'are'} shown at the default radius.`,
      );
    }

    // In bins mode the count IS the answer to overlapping, so saying it twice
    // would only make the notice longer.
    if (this.drawMode() === 'points' && h.overlapSites > 0) {
      parts.push(
        `${plural(h.overlapping, 'point')} share ${plural(h.overlapSites, 'exact coordinate')} ` +
        `with another, so they are drawn on top of each other.`,
      );
    }

    for (const axis of this.crowding()) parts.push(axis);

    return parts.length ? parts.join(' ') : null;
  });

  /**
   * The "one outlier squashed everything into a corner" sentence, per axis.
   *
   * The plot is not wrong when this happens — that is where the data is — but it is
   * unreadable, and nothing on screen tells the reader that a filter would fix it.
   */
  private readonly crowding = computed<readonly string[]>(() => {
    const out: string[] = [];
    const usable = this.hygiene().usable;
    if (usable.length < 3) return out;

    const axes = [
      { label: this.xLabel(), scale: this.xScale(), values: usable.map(e => e.p.x), name: 'horizontal' },
      { label: this.yLabel(), scale: this.yScale(), values: usable.map(e => e.p.y), name: 'vertical' },
    ];

    for (const axis of axes) {
      const { outliers, coreShare } = svScatterCrowding(axis.values, axis.scale.min, axis.scale.max);
      if (outliers > 0 && coreShare < 0.25) {
        out.push(
          `${plural(outliers, 'extreme ' + axis.label + ' value')} ` +
          `${outliers === 1 ? 'holds' : 'hold'} the ${axis.name} axis open: the rest of the ` +
          `data sits in ${Math.round(coreShare * 100)}% of it.`,
        );
      }
    }
    return out;
  });

  // ── Accessibility ───────────────────────────────────────────────────────────

  /** Generated accessible summary used when `ariaLabel` is not supplied. */
  readonly resolvedAriaLabel = computed<string>(() => {
    if (this.ariaLabel()) return this.ariaLabel();
    const base = this.title() || 'Scatter plot';
    const parts = this.series()
      .map(s => `${s.name}: ${plural(s.points.length, 'point')}`)
      .join(', ');
    if (!parts) return base;
    const nav = this.focusTargets() === 'bins'
      ? ` Drawn as ${plural(this.binMarks().length, 'density bin')}. Use the arrow keys to move between them.`
      : '';
    return `${base}. ${this.xLabel()} versus ${this.yLabel()}. ${parts}.${nav}`;
  });

  /** Per-point accessible label. */
  pointAriaLabel(s: ScatterSeries, p: ScatterPoint): string {
    const name = p.label ? `${p.label}, ` : '';
    return `${name}${s.name}: ${this.xLabel()} ${p.x}, ${this.yLabel()} ${p.y}`;
  }

  private binAriaLabel(event: ScatterBinEvent): string {
    const where = `${this.xLabel()} about ${this.xTick(event.x)}, ` +
      `${this.yLabel()} about ${this.yTick(event.y)}`;
    const shares = event.shares.length > 1
      ? ` — ${event.shares.map(s => `${s.series} ${s.count}`).join(', ')}`
      : '';
    return `${where}: ${plural(event.count, 'point')}${shares}`;
  }

  /**
   * The table that says in rows what the plot says in geometry.
   *
   * It describes whatever the picture is currently drawing, and its rows are the
   * things the keyboard can reach — points when points are reachable, bins when
   * bins are. A table of ten thousand individual rows beside a density plot would
   * technically be the data and would answer nothing.
   */
  readonly a11ySummary = computed<SvDataSummary>(() => {
    const base = this.title() || 'Scatter plot';

    if (this.focusTargets() === 'bins') {
      const marks = this.binMarks();
      return {
        caption: `${base} — density bins`,
        columns: ['Bin', 'Points', 'Series'],
        rows: marks.map(m => ({
          key: `${m.cx},${m.cy}`,
          header: `${this.xLabel()} ${this.xTick(m.event.x)}, ${this.yLabel()} ${this.yTick(m.event.y)}`,
          cells: [
            String(m.count),
            m.event.shares.map(s => `${s.series} ${s.count}`).join(', '),
          ],
        })),
        overview: marks.length
          ? `${plural(this.drawn().length, 'point')} in ${plural(marks.length, 'bin')}. ` +
            `The densest holds ${this.peakBinCount()}.`
          : undefined,
      };
    }

    const marks = this.pointMarks();
    return {
      caption: `${base} — ${this.xLabel()} versus ${this.yLabel()}`,
      columns: ['Point', 'Series', this.xLabel(), this.yLabel()],
      rows: marks.map((m, i) => ({
        key: `${m.series.name}-${i}`,
        header: m.point.label ?? `${this.xTick(m.point.x)}, ${this.yTick(m.point.y)}`,
        cells: [m.series.name, String(m.point.x), String(m.point.y)],
      })),
      overview: marks.length
        ? `${plural(marks.length, 'point')} across ${plural(this.series().length, 'series', 'series')}.`
        : undefined,
    };
  });

  /**
   * The density key: one swatch per step that actually occurs, labelled with the
   * counts it covers.
   *
   * Bounds are read off the bins rather than computed back out of the ramp, so the
   * key can never claim a range no bin is in.
   */
  readonly densityLegend = computed(() => {
    const seen = new Map<number, { min: number; max: number }>();
    for (const m of this.binMarks()) {
      const at = seen.get(m.step);
      if (at) {
        at.min = Math.min(at.min, m.count);
        at.max = Math.max(at.max, m.count);
      } else {
        seen.set(m.step, { min: m.count, max: m.count });
      }
    }
    return [...seen.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([step, range]) => ({
        step,
        fillClass: DENSITY_FILL[step - 1],
        label: range.min === range.max ? String(range.min) : `${range.min}–${range.max}`,
      }));
  });

  // ── Interaction ─────────────────────────────────────────────────────────────

  /** Which mark owns the single tab stop right now. */
  private readonly activeIndex = signal(0);

  private markCount(): number {
    return this.focusTargets() === 'bins' ? this.binMarks().length : this.pointMarks().length;
  }

  isTabStop(index: number): boolean {
    const count = this.markCount();
    if (!count) return false;
    return Math.max(0, Math.min(this.activeIndex(), count - 1)) === index;
  }

  /** True when the given point is the active (hovered/focused) one. */
  isActive(s: ScatterSeries, p: ScatterPoint): boolean {
    const h = this.hoveredPoint();
    return !!h && h.series === s.name && h.point === p;
  }

  isBinActive(event: ScatterBinEvent): boolean {
    return this.hoveredBin() === event;
  }

  private toEvent(s: ScatterSeries, p: ScatterPoint): ScatterPointEvent {
    return { series: s.name, point: p, color: s.color };
  }

  private toBinEvent(bin: SvPointBin<PlotEntry>): ScatterBinEvent {
    const byName = new Map<string, ScatterBinShare>();
    for (const e of bin.items) {
      const at = byName.get(e.s.name);
      if (at) byName.set(e.s.name, { ...at, count: at.count + 1 });
      else byName.set(e.s.name, { series: e.s.name, color: e.s.color, count: 1 });
    }
    return {
      x: this.unscaleX(bin.cx),
      y: this.unscaleY(bin.cy),
      count: bin.count,
      points: bin.items.map(e => e.p),
      shares: [...byName.values()].sort((a, b) => b.count - a.count),
    };
  }

  hoverPoint(s: ScatterSeries, p: ScatterPoint): void {
    const ev = this.toEvent(s, p);
    this.hoveredPoint.set(ev);
    this.pointHover.emit(ev);
  }

  selectPoint(s: ScatterSeries, p: ScatterPoint): void {
    this.pointSelect.emit(this.toEvent(s, p));
  }

  hoverBin(event: ScatterBinEvent): void {
    this.hoveredBin.set(event);
    this.binHover.emit(event);
  }

  selectBin(event: ScatterBinEvent): void {
    this.binSelect.emit(event);
  }

  clearHover(): void {
    this.hoveredPoint.set(null);
    this.hoveredBin.set(null);
  }

  /** Sync the roving index when focus arrives by pointer or by Tab. */
  focusMark(index: number): void {
    const count = this.markCount();
    if (index >= 0 && index < count) this.activeIndex.set(index);
  }

  /**
   * Arrow / Home / End move the tab stop; the moved-to mark takes DOM focus.
   *
   * ★★ Without this a dense plot is thousands of tab stops, which is the same as
   *    being unreachable — nobody presses Tab four hundred times. One tab stop puts
   *    the chart in the page's tab order once and the arrow keys walk it, matching
   *    what the choropleth map already does so the two feel like one kit.
   *
   * Left and Up both step back, Right and Down both step forward: a hex lattice
   * row holds a different number of bins than the row above it, so an arrow that
   * tried to preserve the column would land somewhere arbitrary. Reading order is
   * predictable, and predictable is what gets a reader somewhere.
   */
  onKeydown(event: KeyboardEvent, root: HTMLElement): void {
    const count = this.markCount();
    if (!count) return;

    const current = Math.max(0, Math.min(this.activeIndex(), count - 1));
    let next = current;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = Math.min(count - 1, current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = Math.max(0, current - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.activeIndex.set(next);

    if (this.focusTargets() === 'bins') {
      const mark = this.binMarks()[next];
      if (mark) this.hoverBin(mark.event);
    } else {
      const mark = this.pointMarks()[next];
      if (mark) this.hoverPoint(mark.series, mark.point);
    }
    // The tab stop moved, so DOM focus has to follow it or the next Tab press
    // leaves from the old shape.
    root.querySelector<SVGElement>(`[data-mark-index="${next}"]`)?.focus();
  }
}

/**
 * Smallest and largest of a list, as a tuple for `svNiceScale`.
 *
 * Reduced rather than spread into `Math.min`: `Math.min(...points)` on a large
 * array throws `RangeError: Maximum call stack size exceeded` somewhere around a
 * hundred thousand arguments, which is exactly the size this chart now supports.
 */
function extent(values: readonly number[]): [number, number] {
  if (!values.length) return [0, 100];
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/**
 * Paint the points onto an offscreen canvas and return it as a `data:` URL.
 *
 * Returns `null` when there is no 2-D context to draw on — a locked-down browser,
 * or a test environment without a canvas implementation — and the caller then
 * leaves the density hexagons visible, so the plot degrades to a hexbin rather
 * than to nothing.
 */
function paintPoints(
  plan: readonly { x: number; y: number; r: number; color: string }[],
  width: number,
  height: number,
): string | null {
  if (!canvasWorks()) return null;
  try {
    const canvas = document.createElement('canvas');
    // Backed at the device ratio so the dots are not soft on a retina screen,
    // capped at 2 because a 3× backing store of a full-width plot is megabytes of
    // pixels for a difference nobody can see.
    const ratio = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(ratio, ratio);
    // Matches the `fill-opacity` the SVG circles use, so crossing the switch-over
    // point does not change the drawing.
    ctx.globalAlpha = 0.75;
    for (const mark of plan) {
      ctx.beginPath();
      ctx.arc(mark.x, mark.y, mark.r, 0, Math.PI * 2);
      ctx.fillStyle = mark.color;
      ctx.fill();
    }
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Whether this environment has a 2-D canvas at all, probed once.
 *
 * Once rather than per repaint because the answer cannot change, and because the
 * environments that say no — a server render, a test DOM without a canvas
 * implementation — say it loudly, and a warning per repaint would drown the
 * output it is trying to be visible in.
 */
let canvasSupport: boolean | null = null;

function canvasWorks(): boolean {
  if (canvasSupport !== null) return canvasSupport;
  try {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    canvasSupport = !!probe.getContext('2d') && typeof probe.toDataURL === 'function';
  } catch {
    canvasSupport = false;
  }
  return canvasSupport;
}

/** `1 point` / `2 points`, because "1 points" reads as a bug in the data. */
function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** `2nd`, `3rd`, `11th` — for "every 4th point". */
function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Trim float noise off a coordinate so the emitted attributes stay short. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
