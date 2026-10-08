import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { SvChartFrameComponent, type SvDataError } from '@styloviz/core';
import { NgClass } from '@angular/common';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiveUpdateDataset {
  readonly label: string;
  readonly data:  readonly number[];
  readonly color?: string;
}

export interface LiveUpdateSource {
  readonly id:       string;
  readonly label:    string;
  readonly datasets: readonly LiveUpdateDataset[];
}

export interface LiveUpdateChartOptions {
  /** Chart height in px. @default 300 */
  height?: number;
  /** Transition duration for bar animation in ms. @default 600 */
  transitionDuration?: number;
  /** Bar corner radius. @default 4 */
  barRadius?: number;
  /** Show value labels on bars. @default false */
  showValues?: boolean;
  /** Show grid. @default true */
  showGrid?: boolean;
  /** Show legend. @default true */
  showLegend?: boolean;
}

// ─── Default palette ─────────────────────────────────────────────────────────

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// ─── Default data sources ─────────────────────────────────────────────────────

/** Sample sources for the showcase — NOT a component default. */
export const DEMO_LIVE_SOURCES: LiveUpdateSource[] = [
  {
    id: '2022',
    label: '2022',
    datasets: [
      { label: 'Revenue',  data: [120, 95, 145, 88, 130, 105, 160, 140, 115, 180, 125, 190], color: PALETTE[0] },
      { label: 'Expenses', data: [ 80, 70, 100, 65,  90,  75, 110,  95,  85, 120,  90, 130], color: PALETTE[1] },
    ],
  },
  {
    id: '2023',
    label: '2023',
    datasets: [
      { label: 'Revenue',  data: [135, 110, 160, 98, 150, 120, 175, 155, 130, 200, 145, 210], color: PALETTE[0] },
      { label: 'Expenses', data: [ 90,  78, 115, 72, 100,  83, 120, 105,  92, 132,  98, 142], color: PALETTE[1] },
    ],
  },
  {
    id: '2024',
    label: '2024',
    datasets: [
      { label: 'Revenue',  data: [150, 128, 178, 110, 168, 140, 195, 172, 148, 222, 165, 235], color: PALETTE[0] },
      { label: 'Expenses', data: [ 98,  85, 128,  80, 112,  92, 133, 115, 102, 145, 108, 155], color: PALETTE[1] },
    ],
  },
];

const CATEGORIES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / exp) * exp;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LiveUpdateChartComponent — Animated dataset-switching column chart.
 *
 * Uses SVG <rect> elements with CSS `y` and `height` style properties
 * (SVG 2.0 geometry-as-CSS). The same DOM nodes are reused across dataset
 * switches (stable `track` key = cat+series), so the browser transitions the
 * style values smoothly — no JS animation loop required.
 *
 * The Y-axis is fixed to the global max across all sources so the grid never
 * rescales mid-animation, keeping motion focused on the bars alone.
 *
 * @example
 * ```html
 * <sv-live-update-chart
 *   title="Annual Revenue vs Expenses"
 *   [sources]="mySources"
 *   [categories]="months"
 *   [options]="{ showValues: true, transitionDuration: 600 }"
 * />
 * ```
 */
@Component({
  selector: 'sv-live-update-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartFrameComponent,
  ],
  templateUrl: './live-update-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvLiveUpdateChartComponent implements OnInit {

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
   * Nothing to plot.
   *
   * The plot's data lives in `sources`, not `categories` — a host that has
   * supplied axis labels but whose first fetch has not landed yet has nothing
   * to draw, and reporting that as "loaded" made `activeSource()` undefined
   * downstream. Both halves are the empty state.
   */
  readonly chartIsEmpty = computed(
    () => this.categories().length === 0 || this.sources().length === 0,
  );

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Chart title, rendered in the header and used in the default accessible name. @default 'Revenue & Expenses' */
  title      = input<string>('Revenue & Expenses');

  /** Accessible-name override for the chart image. @default '' */
  ariaLabel = input<string>('');

  /** Resolved accessible name — explicit override or a description of the stream. */
  readonly resolvedAriaLabel = computed<string>(() => this.ariaLabel() || (this.title() + ' — live updating chart'));
  /** X-axis category labels; each dataset's `data[i]` is plotted against `categories[i]`. @default Jan–Dec month abbreviations */
  categories = input<string[]>(CATEGORIES);
  /**
   * Switchable data sets, one toggle button each; the bars animate between them and the Y-axis is fixed to the max across all sources.
   * The first source is active on init; an empty array shows the empty state. @default []
   */
  sources    = input<LiveUpdateSource[]>([]);
  /** Height, bar transition duration, corner radius, and value-label/grid/legend toggles — see `LiveUpdateChartOptions`. @default {} */
  options    = input<LiveUpdateChartOptions>({});

  // ── Resolved options ──────────────────────────────────────────────────────

  chartHeight = computed(() => this.options().height             ?? 300);
  transDur    = computed(() => this.options().transitionDuration ?? 600);
  barRadius   = computed(() => this.options().barRadius          ?? 4);
  showValues  = computed(() => this.options().showValues         ?? false);
  showGrid    = computed(() => this.options().showGrid           ?? true);
  showLegend  = computed(() => this.options().showLegend         ?? true);

  // ── Internal state ────────────────────────────────────────────────────────

  readonly activeSourceId = signal<string>('');

  // ── SVG geometry ──────────────────────────────────────────────────────────

  readonly SVG_W = 600;
  readonly PAD   = { top: 24, right: 24, bottom: 44, left: 52 };

  plotW = computed(() => this.SVG_W - this.PAD.left - this.PAD.right);
  plotH = computed(() => this.chartHeight() - this.PAD.top - this.PAD.bottom);

  // ── Active source ─────────────────────────────────────────────────────────

  // Explicitly `| undefined`: with no sources, `sources()[0]` IS undefined at
  // runtime. Letting the inferred type hide that turned every honest `?.` into
  // an NG8107 "unnecessary optional chain" warning and made the `if (!src)`
  // guards below look like dead code.
  activeSource = computed<LiveUpdateSource | undefined>(() =>
    this.sources().find(s => s.id === this.activeSourceId()) ?? this.sources()[0]
  );

  /**
   * Global axis ceiling spanning ALL sources so the grid never rescales when
   * switching datasets — animation stays focused on bar height only.
   */
  globalMax = computed(() => {
    const all = this.sources().flatMap(s => s.datasets.flatMap(d => [...d.data]));
    return niceMax(Math.max(...all, 1));
  });

  gridValues = computed(() => {
    const max  = this.globalMax();
    const step = max / 5;
    return Array.from({ length: 6 }, (_, i) => i * step);
  });

  // ── Bar descriptors ───────────────────────────────────────────────────────

  /**
   * One descriptor per bar. `x`, `barW`, `barH`, `y`, `color` are what the
   * template binds to. The stable track key `cat + series` ensures Angular
   * patches the SAME <rect> DOM node on every source switch, letting the CSS
   * transition fire on the changed `y` and `height` style values.
   */
  bars = computed(() => {
    const src  = this.activeSource();
    if (!src) return [];
    const cats    = this.categories();
    const sets    = src.datasets;
    const pw      = this.plotW();
    const ph      = this.plotH();
    const max     = this.globalMax();
    const ncat    = cats.length;
    const nseries = sets.length;
    const groupW  = pw / ncat;
    const gap     = 0.25;
    const barW    = (groupW * (1 - gap)) / nseries;
    const barPad  = (groupW * gap) / 2;

    return sets.flatMap((series, si) =>
      cats.map((cat, ci) => {
        const value = series.data[ci] ?? 0;
        const barH  = ph > 0 ? (value / max) * ph : 0;
        const x     = ci * groupW + barPad + si * barW;
        const y     = ph - barH;
        const color = series.color ?? PALETTE[si % PALETTE.length];
        return { x, y, barW, barH, value, cat, series: series.label, color };
      })
    );
  });

  seriesColors = computed(() =>
    (this.activeSource()?.datasets ?? []).map(
      (d, i) => d.color ?? PALETTE[i % PALETTE.length]
    )
  );

  // ── Axis ──────────────────────────────────────────────────────────────────

  gridLineY(v: number): number {
    return this.plotH() - (v / this.globalMax()) * this.plotH();
  }

  // ── CSS transition string ─────────────────────────────────────────────────

  /**
   * Both `y` and `height` need to transition together so bars grow/shrink
   * from the baseline. `y` moves up as `height` grows — they must be in sync.
   */
  barTransition = computed(() => {
    const d = `${this.transDur()}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    return `y ${d}, height ${d}`;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const srcs = this.sources();
    if (srcs.length > 0) this.activeSourceId.set(srcs[0].id);
  }

  // ── Interactions ──────────────────────────────────────────────────────────

  switchSource(id: string): void {
    this.activeSourceId.set(id);
  }

  formatValue(v: number): string {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(Math.round(v));
  }
}
