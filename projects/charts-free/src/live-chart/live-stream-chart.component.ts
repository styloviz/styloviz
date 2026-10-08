import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  SvChartFrameComponent,
  SvConnectionStatusComponent,
  createLiveTicker,
  svAppendSample,
  type SvConnectionState,
  type SvDataError,
  svUniqueId,
} from '@styloviz/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiveStreamSeries {
  /** Display name shown in the legend. */
  readonly label: string;
  /** Stroke / fill color. Defaults to built-in palette. */
  readonly color?: string;
}

export interface LiveStreamChartOptions {
  /** Chart height in px. @default 300 */
  height?: number;
  /** Number of data-points visible at once. @default 20 */
  windowSize?: number;
  /** Milliseconds between new data-points. @default 500 */
  intervalMs?: number;
  /** Render spline (Catmull-Rom) curves. @default true */
  smooth?: boolean;
  /** Show horizontal grid lines. @default true */
  showGrid?: boolean;
  /** Show series legend. @default true */
  showLegend?: boolean;
  /** Show semi-transparent gradient area under each line. @default true */
  fillArea?: boolean;
  /** Fixed Y-axis minimum. @default 0 */
  yMin?: number;
  /** Fixed Y-axis maximum. @default 100 */
  yMax?: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * LiveStreamChartComponent — Real-time scrolling spline chart.
 *
 * Renders N+1 data-points in a clipped SVG group. When a new point arrives
 * the group smoothly slides left by one step-width via a CSS `transform`
 * transition, then the oldest point is removed and the translate snaps back —
 * creating a continuous scrolling stream effect without any JS animation loop.
 *
 * Features:
 * - Smooth Catmull-Rom spline (or straight-line) rendering
 * - Gradient area fills per series
 * - Play / Pause / Reset controls with live-indicator chip
 * - Configurable window size, interval, Y range
 * - Full dark-mode & responsive
 *
 * @example
 * ```html
 * <sv-live-stream-chart
 *   title="CPU & Memory"
 *   [series]="[{ label: 'CPU', color: '#3b82f6' }, { label: 'Memory', color: '#10b981' }]"
 *   [options]="{ windowSize: 30, intervalMs: 400, yMax: 100 }"
 * />
 * ```
 */

@Component({
  selector: 'sv-live-stream-chart',
  standalone: true,
  imports: [
    SvChartFrameComponent,
    SvConnectionStatusComponent,
  ],
  templateUrl: './live-stream-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvLiveStreamChartComponent implements OnInit, OnDestroy {
  /** Per-instance suffix for every id this component puts in the document. */
  readonly _uid = svUniqueId('sv-live-stream-chart');


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
   * Generate the stream's points internally, with `Math.random()`.
   *
   * For demos and screenshots only. This used to be the only behaviour, so a
   * chart wired to a real feed drew invented numbers alongside the real ones.
   * @default false
   */
  readonly demoFeed = input<boolean>(false);

  // ── Live feed ─────────────────────────────────────────────────────────────

  /**
   * State of the socket / `EventSource` behind `push()`. A stream that stops
   * moving looks the same whether the source went quiet or the connection
   * dropped, so the chart cannot infer this — only the host knows. `idle`
   * renders nothing; anything else replaces the LIVE badge with the state.
   * @default 'idle'
   */
  readonly connection = input<SvConnectionState>('idle');

  /**
   * Offer a Reconnect button while `connection` is `reconnecting` or `closed`.
   * Off by default: most hosts retry on their own, and a second manual trigger
   * opens a second socket.
   * @default false
   */
  readonly reconnectable = input<boolean>(false);

  /** The user asked to re-open the feed. */
  readonly reconnect = output<void>();

  /** Show the host's connection state instead of the local LIVE badge. */
  readonly showConnection = computed(() => this.connection() !== 'idle');

  /** Nothing to plot. */
  readonly chartIsEmpty = computed(() => this.series().length === 0);

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Chart title, rendered in the header and used in the default accessible name. @default 'Live Data Stream' */
  title    = input<string>('Live Data Stream');
  /** Secondary line shown under the title; hidden when empty. @default '' */
  subtitle = input<string>('');
  /**
   * The streamed lines, one per entry — `label` for the legend and accessible name, optional `color` (falls back to the palette).
   * `push()` values map to these by index; an empty array shows the empty state.
   */
  series   = input<LiveStreamSeries[]>([
    { label: 'Sensor A', color: PALETTE[0] },
    { label: 'Sensor B', color: PALETTE[1] },
  ]);
  /** Height, visible window size, point interval, smoothing, grid/legend/area toggles and fixed Y range — see `LiveStreamChartOptions`. @default {} */
  options  = input<LiveStreamChartOptions>({});

  /** Accessible-name override for the chart image. @default '' */
  ariaLabel = input<string>('');

  /** Resolved accessible name — explicit override or a description of the stream. */
  readonly resolvedAriaLabel = computed<string>(() => {
    if (this.ariaLabel()) return this.ariaLabel();
    const names = this.series().map(s => s.label).filter(Boolean).join(', ');
    return `${this.title()} — live streaming chart${names ? `, series: ${names}` : ''}.`;
  });

  // ── Resolved options ──────────────────────────────────────────────────────

  chartHeight = computed(() => this.options().height      ?? 300);
  windowSize  = computed(() => this.options().windowSize  ?? 20);
  intervalMs  = computed(() => this.options().intervalMs  ?? 500);
  smooth      = computed(() => this.options().smooth      ?? true);
  showGrid    = computed(() => this.options().showGrid    ?? true);
  showLegend  = computed(() => this.options().showLegend  ?? true);
  fillArea    = computed(() => this.options().fillArea    ?? true);
  yMin        = computed(() => this.options().yMin        ?? 0);
  yMax        = computed(() => this.options().yMax        ?? 100);

  // ── State ─────────────────────────────────────────────────────────────────

  readonly isRunning   = signal(false);
  readonly isAnimating = signal(false);
  readonly slideX      = signal(0);
  readonly pointCount  = signal(0);
  /** Ring-buffer of N+1 values per series (extra point for scroll animation). */
  readonly bufferData  = signal<number[][]>([]);

  /**
   * The demo generator's interval — off while the tab is hidden (not skipped:
   * cleared, and re-created on return) and off whenever there is no generator.
   *
   * ★ Its `notice` is about the GENERATOR. A host-fed stream (`demoFeed`
   *   false) has no timer to stop, and its host kept pushing while the tab was
   *   hidden, so "nothing was sampled" would be false — and is never shown.
   */
  readonly ticker = createLiveTicker({
    tick: () => this.addPoint(),
    intervalMs: () => this.intervalMs(),
    enabled: () => this.isRunning() && this.demoFeed(),
  });

  /** Tab visibility, as the ticker sees it. */
  readonly visibility = this.ticker.visibility;

  /**
   * The gap the generator's last background pause left, in words — and only
   * while there IS a generator. A stream switched to host data since then is
   * drawing the host's readings, which kept arriving while the tab was hidden.
   */
  readonly pauseNotice = computed(() => (this.demoFeed() ? this.ticker.notice() : null));

  /** No animation frames on the server: a push there lands without a slide. */
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Set on destroy, so a host socket that outlives the chart schedules nothing. */
  private destroyed = false;

  /**
   * How many host pushes were folded into a later one because they arrived
   * while a slide was still running. Diagnostic; see `push()`.
   */
  readonly coalescedCount = signal(0);

  // ── SVG geometry ──────────────────────────────────────────────────────────

  readonly SVG_W = 600;
  readonly PAD   = { top: 20, right: 20, bottom: 36, left: 48 };

  plotW = computed(() => this.SVG_W - this.PAD.left - this.PAD.right);
  plotH = computed(() => this.chartHeight() - this.PAD.top - this.PAD.bottom);

  /**
   * Pixel distance between consecutive data-points.
   * With N visible points (indices 0..N-1), step = plotW / (N - 1)
   * so point N (the new one just added) lands at plotW + stepW — off-screen right.
   */
  stepW = computed(() => this.plotW() / Math.max(this.windowSize() - 1, 1));

  // ── Derived ───────────────────────────────────────────────────────────────

  seriesColors = computed<string[]>(() =>
    this.series().map((s, i) => s.color ?? PALETTE[i % PALETTE.length])
  );

  gridValues = computed<number[]>(() => {
    const [mn, mx] = [this.yMin(), this.yMax()];
    return Array.from({ length: 6 }, (_, i) => mn + ((mx - mn) * i) / 5);
  });

  /**
   * CSS transition string applied to the scrolling `<g>` element.
   * Enabled only during the slide animation so the snap-back is instant.
   */
  slideTransition = computed<string>(() =>
    this.isAnimating()
      ? `transform ${Math.round(this.intervalMs() * 0.88)}ms linear`
      : 'none'
  );

  /** Visible X-axis time labels (every ~5th tick). */
  xLabels = computed<{ x: number; label: string }[]>(() => {
    const n     = this.windowSize();
    const count = this.pointCount();
    const step  = this.stepW();
    const every = Math.max(Math.ceil(n / 6), 1);
    const labels: { x: number; label: string }[] = [];
    for (let i = 0; i < n; i++) {
      if (i % every === 0 || i === n - 1) {
        const t = count - n + i + 1;
        if (t > 0) labels.push({ x: i * step, label: String(t) });
      }
    }
    return labels;
  });

  // ── Coordinate helpers ─────────────────────────────────────────────────────

  /** SVG X for point index i (0-based). */
  xAt(i: number): number { return (i + this.lead()) * this.stepW(); }

  /**
   * Empty slots left of the first reading. A host-fed stream starts empty and
   * fills from the right, so the newest reading always sits at the right edge
   * — the same place it sits once the window is full. While a slide is
   * carrying a reading in, that reading is one step further right, off-screen,
   * exactly as it is for a full window.
   */
  readonly lead = computed(() => {
    const held = (this.bufferData()[0]?.length ?? 0) - (this.incoming() ? 1 : 0);
    return Math.max(this.windowSize() - held, 0);
  });

  /** A reading has been appended and is waiting to slide in. */
  private readonly incoming = signal(false);

  /** SVG Y for a data value. */
  yAt(v: number): number {
    const range = this.yMax() - this.yMin();
    if (range === 0) return this.plotH() / 2;
    const c = Math.max(this.yMin(), Math.min(this.yMax(), v));
    return this.plotH() - ((c - this.yMin()) / range) * this.plotH();
  }

  gridLineY(v: number): number { return this.yAt(v); }

  // ── Path builders ──────────────────────────────────────────────────────────

  private catmullRom(pts: { x: number; y: number }[]): string {
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[Math.max(i - 2, 0)];
      const p1 = pts[i - 1];
      const p2 = pts[i];
      const p3 = pts[Math.min(i + 1, pts.length - 1)];
      const cp1x = (p1.x + (p2.x - p0.x) / 6).toFixed(1);
      const cp1y = (p1.y + (p2.y - p0.y) / 6).toFixed(1);
      const cp2x = (p2.x - (p3.x - p1.x) / 6).toFixed(1);
      const cp2y = (p2.y - (p3.y - p1.y) / 6).toFixed(1);
      d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  linePath(si: number): string {
    const data = this.bufferData()[si];
    if (!data || data.length < 2) return '';
    const pts = data.map((v, i) => ({ x: this.xAt(i), y: this.yAt(v) }));
    if (!this.smooth()) {
      return 'M ' + pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ');
    }
    return this.catmullRom(pts);
  }

  areaPath(si: number): string {
    const data = this.bufferData()[si];
    if (!data || data.length < 2) return '';
    const pH  = this.plotH();
    const lp  = this.linePath(si);
    const lx  = this.xAt(data.length - 1).toFixed(1);
    const fx  = this.xAt(0).toFixed(1);
    return `${lp} L ${lx} ${pH} L ${fx} ${pH} Z`;
  }

  gradId(si: number): string { return `lsc-grad-${this._uid}-${si}`; }

  // ── Data generation ────────────────────────────────────────────────────────

  private readonly _phases: number[] = [];

  private generatePoint(si: number): number {
    if (this._phases[si] === undefined) {
      this._phases[si] = Math.random() * Math.PI * 2;
    }
    this._phases[si] += 0.14 + si * 0.04;
    const mid   = (this.yMin() + this.yMax()) / 2;
    const amp   = (this.yMax() - this.yMin()) * 0.3;
    const noise = (Math.random() - 0.5) * amp * 0.45;
    return Math.round(
      mid
      + Math.sin(this._phases[si]) * amp
      + Math.cos(this._phases[si] * 1.7) * amp * 0.4
      + noise
    );
  }

  /**
   * ★ Only the demo generator pre-fills the window. A host-fed stream starts
   *   EMPTY: filling it with `generatePoint()` drew twenty invented readings
   *   per series before the first real one arrived, on a chart whose
   *   `demoFeed` doc promises it never invents data.
   */
  private initBuffer(): void {
    const n = this.demoFeed() ? this.windowSize() : 0;
    this.bufferData.set(
      this.series().map((_, si) =>
        Array.from({ length: n }, () => this.generatePoint(si))
      )
    );
    this.pointCount.set(n);
    this.slideX.set(0);
    this.isAnimating.set(false);
    this.incoming.set(false);
  }

  // ── Timer management ───────────────────────────────────────────────────────

  private _animTmo: ReturnType<typeof setTimeout>             | null = null;
  private _raf1:    ReturnType<typeof requestAnimationFrame>  | null = null;
  private _raf2:    ReturnType<typeof requestAnimationFrame>  | null = null;

  /**
   * Animation flow on each tick:
   * 1. Append new point → buffer has N+1 points; N+1th point is off-screen right.
   * 2. Two rAF frames ensure Angular has rendered the N+1 state before we start CSS transition.
   * 3. Enable transition, set slideX = −stepW → group slides left; oldest point exits left.
   * 4. After transition duration: remove oldest point, snap slideX back to 0 (no transition).
   */
  /**
   * Append one reading per series and slide the window — the ingress for a real
   * feed.
   *
   * ```ts
   * this.socket.on('tick', (values) => this.chart().push(values));
   * ```
   *
   * Values are matched to `series` by index; a short array pads with the last
   * known value rather than dropping the series off the chart.
   *
   * ★ Backpressure: the chart draws at most one point per slide (≈ 0.88 ×
   *   `intervalMs`). Pushes that arrive while a slide is running are
   *   COALESCED — the latest wins and is drawn the moment the slide ends. A
   *   queue would put the chart permanently behind a fast feed; dropping them
   *   (the old behaviour) could lose the final reading of a burst for good, so
   *   the chart sat on a stale value after the feed went quiet.
   *
   * ★ While the tab is hidden nothing animates: each push is appended straight
   *   into the bounded window, so every reading the host sent is there when
   *   the tab comes back and no gap notice is owed.
   */
  push(values: readonly number[]): void {
    if (this.destroyed) return;
    this.appendPoints(this.series().map((_, si) => values[si] ?? this.lastValue(si)));
  }

  /** The most recent value for a series, or 0 before anything has arrived. */
  private lastValue(si: number): number {
    const buf = this.bufferData()[si];
    return buf?.length ? buf[buf.length - 1] : 0;
  }

  /**
   * ★★★ THE LATCH THAT `isAnimating` COULD NOT BE.
   *
   * A slide is claimed HERE, synchronously, the moment a point is appended.
   * `isAnimating` cannot do that job: it also drives `slideTransition`, so it
   * must not go true until the N+1 state has been rendered — two animation
   * frames later. Between the append and those two frames the old guard read
   * `false`, and every tick that landed in that window appended a point of its
   * own.
   *
   * Two frames is ~32 ms at 60 Hz, so ANY `intervalMs` at or below that is
   * permanently past the guard — and on a loaded machine a frame can take far
   * longer than its nominal 16 ms, which is how a 20 ms demo feed put SEVEN
   * points in a five-point window and failed `live-stream-chart.component.spec`
   * during a coverage run. The documented invariant — "a tick that arrives
   * mid-slide is DROPPED, not queued", at most one point above `windowSize` —
   * was simply not enforced by anything.
   *
   * It also leaked: each append overwrote `_raf1`/`_raf2` without cancelling
   * them, so `stopStream()` could only ever cancel the last pair and the
   * earlier ones fired after the host had gone — the exact failure the timer
   * teardown exists to prevent. Re-entry being impossible fixes that too.
   */
  private slideClaimed = false;

  /** The latest push that arrived mid-slide, drawn when the slide ends. */
  private pending: number[] | null = null;

  private addPoint(): void {
    // A generator tick mid-slide is skipped, not coalesced: the generator has
    // no reading the reader is owed, only the next one.
    if (this.slideClaimed) return;
    if (!this.demoFeed()) return;   // a real feed drives this through push()

    this.appendPoints(this.series().map((_, si) => this.generatePoint(si)));
  }

  /** Slide the window along by one reading per series. */
  private appendPoints(newPts: number[]): void {
    if (!this.browser || this.visibility.paused()) {
      this.appendWithoutSlide(newPts);
      return;
    }
    if (this.slideClaimed) {
      if (this.pending) this.coalescedCount.update(n => n + 1);
      this.pending = newPts;
      return;
    }
    this.slideClaimed = true;
    this.incoming.set(true);
    // One slot above the window: the incoming point waits off-screen right
    // until the slide carries it in.
    const retain = this.windowSize() + 1;
    this.bufferData.update(data =>
      data.map((buf, si) => svAppendSample(buf, newPts[si], { retain }).samples as number[]),
    );

    this._raf1 = requestAnimationFrame(() => {
      this._raf2 = requestAnimationFrame(() => {
        this._raf1 = this._raf2 = null;
        this.isAnimating.set(true);
        this.slideX.set(-this.stepW());
        const dur = Math.round(this.intervalMs() * 0.88);
        this._animTmo = setTimeout(() => {
          this._animTmo = null;
          this.finishSlide();
          const next = this.pending;
          this.pending = null;
          if (next) this.appendPoints(next);
        }, dur);
      });
    });
  }

  /** Drop the point that slid out, and release the claim. */
  private finishSlide(): void {
    const n = this.windowSize();
    this.bufferData.update(data => data.map(buf => buf.slice(-n)));
    this.isAnimating.set(false);
    this.slideX.set(0);
    this.pointCount.update(c => c + 1);
    this.slideClaimed = false;
    this.incoming.set(false);
  }

  /**
   * Hidden tab (or a server render): no animation frames will run, so a slide
   * would never finish and every later push would pile into `pending`. Settle
   * whatever is in flight and append directly into the bounded window instead.
   */
  private appendWithoutSlide(newPts: number[]): void {
    this.settle();
    this.appendDirect(newPts);
  }

  /**
   * Land everything in flight at once: finish a claimed slide and draw the
   * coalesced push behind it. Stopping or hiding must not lose the latest
   * reading — a feed that goes quiet right after would leave it unseen for good.
   */
  private settle(): void {
    if (this.slideClaimed) {
      this.cancelAnimation();
      this.finishSlide();
    }
    const queued = this.pending;
    this.pending = null;
    if (queued) this.appendDirect(queued);
  }

  /** One reading per series, straight into the window — no slide. */
  private appendDirect(pts: number[]): void {
    const retain = this.windowSize();
    this.bufferData.update(data =>
      data.map((buf, si) => svAppendSample(buf, pts[si], { retain }).samples as number[]),
    );
    this.pointCount.update(c => c + 1);
  }

  private cancelAnimation(): void {
    if (this._animTmo) { clearTimeout(this._animTmo);         this._animTmo = null; }
    if (this._raf1)    { cancelAnimationFrame(this._raf1);    this._raf1    = null; }
    if (this._raf2)    { cancelAnimationFrame(this._raf2);    this._raf2    = null; }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void  { this.initBuffer(); }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.isRunning.set(false);
    this.cancelAnimation();
    this.slideClaimed = false;
    this.pending = null;
  }

  // ── Controls ───────────────────────────────────────────────────────────────

  startStream(): void {
    this.isRunning.set(true);
    // Only the demo generator needs a timer — `enabled` says so; a real feed
    // calls push() when it has something, which is the whole point of a
    // stream. `sync` is idempotent, so a second start is not a second timer.
    this.ticker.sync();
  }

  stopStream(): void {
    this.isRunning.set(false);
    this.ticker.sync();
    // ★ The claim is released with the timers it was guarding — leaving it set
    // would mean a stopped-and-restarted stream never appended again — and
    // what it was guarding is drawn, not discarded: a coalesced push is the
    // latest reading the host sent.
    this.settle();
  }

  resetStream(): void {
    this.stopStream();
    this._phases.length = 0;
    // The gap described a history that is gone.
    this.ticker.clearGap();
    this.initBuffer();
  }

  toggle(): void {
    if (this.isRunning()) { this.stopStream(); } else { this.startStream(); }
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  fmtValue(v: number): string {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(Math.round(v));
  }
}
