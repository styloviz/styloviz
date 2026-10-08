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
  svApplyValuePolicy,
  type SvDataError,
  type SvDataSummary,
  type SvValuePolicy,
} from '@styloviz/core';
import { formatChartValue } from '../bar-chart/bar-chart.utils';

// ─── Public Types ─────────────────────────────────────────────────────────────

/** Bar classification within the waterfall series. */
export type WaterfallBarType = 'increase' | 'decrease' | 'total' | 'intermediate';

/**
 * What a point *is*, declared rather than inferred.
 *
 * - `delta` — a step that moves the running total by `value`.
 * - `subtotal` — a running-sum bar drawn from zero that does **not** advance the
 *   total. Rendered like a total; reads as "where we are so far".
 * - `total` — the cumulative figure, also drawn from zero.
 *
 * A `subtotal` and a `total` differ only in what they claim, and that is the
 * whole reason this is typed: the two read identically in the picture.
 */
export type WaterfallPointKind = 'delta' | 'subtotal' | 'total';

/** Chart layout direction. */
export type WaterfallOrientation = 'vertical' | 'horizontal';

/**
 * A single data point in a waterfall series.
 *
 * @example
 * // A step that moves the running total
 * { label: 'Revenue', value: 403 }
 * { label: 'Tax', value: -365 }
 *
 * // A running sum that does not advance the total
 * { label: 'Balance', kind: 'subtotal' }
 *
 * // The cumulative total, with the figure the source system states for it —
 * // the chart draws the steps and reports any disagreement.
 * { label: 'Net Profit', kind: 'total', value: 38 }
 */
export interface WaterfallPoint {
  /** Category label shown on the axis. */
  label: string;
  /**
   * What this point is. `delta` when omitted.
   *
   * This is the contract; `isTotal` / `isIntermediate` are the older shorthand
   * for `'total'` / `'subtotal'` and still work. `kind` wins when both are given.
   */
  kind?: WaterfallPointKind;
  /**
   * For a `delta`: the amount this step moves the running total by. Required —
   * a step of unknown size cannot be drawn, and what happens to it instead is
   * `valuePolicy`.
   *
   * For a `subtotal` or `total`: the figure the source system **states** for it,
   * and optional. The bar is always drawn from the steps that precede it, never
   * from this number; giving it asks the chart to check the two against each
   * other and disclose any difference.
   */
  value?: number;
  /** Shorthand for `kind: 'total'`. */
  isTotal?: boolean;
  /** Shorthand for `kind: 'subtotal'`. */
  isIntermediate?: boolean;
}

/** Rendering and feature options for WaterfallChartComponent. */
export interface WaterfallChartOptions {
  /** Show background grid lines.                    @default true  */
  showGrid?:          boolean;
  /** Show value data-labels on each bar.            @default true  */
  showLabels?:        boolean;
  /** Show the Increase / Decrease / Total legend.   @default true  */
  showLegend?:        boolean;
  /** Show dashed connector lines between bars.      @default true  */
  showConnectors?:    boolean;
  /** Fill color for positive (increase) bars. Any CSS color. @default 'var(--color-accent-500)' */
  positiveColor?:     string;
  /** Fill color for negative (decrease) bars. Any CSS color. @default 'var(--color-danger-500)' */
  negativeColor?:     string;
  /** Fill color for total and intermediate bars. Any CSS color. @default 'var(--color-primary-500)' */
  totalColor?:        string;
  /** Bar corner radius in pixels.                   @default 4 */
  barRadius?:         number;
  /** Bar entrance animation duration in ms.         @default 650 */
  animationDuration?: number;
  /** String prepended to every formatted value (e.g. `'$'`). */
  valuePrefix?:       string;
  /** String appended to every formatted value (e.g. `'M'`). */
  valueSuffix?:       string;
}

/** Payload emitted by the waterfall `barHover` / `barSelect` outputs. */
export interface WaterfallBarEvent {
  /** Category label of the bar. */
  label: string;
  /** Delta value applied by this bar (the running sum for total/subtotal bars). */
  delta: number;
  /** Running cumulative total at this bar. */
  running: number;
  /** Bar classification. */
  type: WaterfallBarType;
  /** Resolved fill colour. */
  color: string;
}

// ─── Classification and reconciliation ────────────────────────────────────────

/**
 * ============================================================================
 *  A waterfall that does not reconcile (audit items CH-18-I1, CH-18-I2)
 * ============================================================================
 *
 * The whole claim a waterfall makes is that its steps add up to its total. Two
 * things used to stop it keeping that promise, and both were silent:
 *
 * 1. **The classification was inferred.** `isTotal || isIntermediate || value ==
 *    null` all meant "draw the running sum here". So `{ label: 'Net' }` — a row
 *    whose amount failed to come back from the API, or a typo'd key — rendered as
 *    a *reconciled total*, a figure the data never claimed, in the one position a
 *    reader trusts most. `kind` is the contract now; a step with no usable value
 *    goes through `valuePolicy` like any other undrawable datum.
 *
 * 2. **A stated total was ignored.** `value` on a total bar was read and thrown
 *    away: the bar drew the accumulator regardless. A source system stating 500
 *    against steps summing to 480 produced a chart labelled 480 with nothing
 *    anywhere saying the two disagreed — a reconciliation that silently fails to
 *    reconcile. The bar still draws the computed figure (the connectors and every
 *    preceding bar have to agree with it, or the picture lies), and the
 *    difference is disclosed in the plot, in the notice under it, in the bar's
 *    accessible name and in the data table.
 * ============================================================================
 */

/**
 * The declared role of a point.
 *
 * `isIntermediate` is checked before `isTotal`, as it always was, so a point
 * carrying both flags keeps the classification it had before `kind` existed.
 */
function pointKind(pt: WaterfallPoint): WaterfallPointKind {
  if (pt.kind != null) return isPointKind(pt.kind) ? pt.kind : 'delta';
  if (pt.isIntermediate) return 'subtotal';
  if (pt.isTotal) return 'total';
  return 'delta';
}

/**
 * Whether a `kind` read from a point is one this chart knows.
 *
 * ★ Typed, but a series usually arrives as JSON, where the type is a hope. An
 *   unknown `kind` — `'Total'`, `'sub-total'` — used to fall through to "not a
 *   delta" and draw a running sum the data never claimed, which is the
 *   inference `kind` exists to end. It is read as a step instead (so a missing
 *   `value` still goes through `valuePolicy`), and the notice says so.
 */
function isPointKind(kind: unknown): kind is WaterfallPointKind {
  return kind === 'delta' || kind === 'subtotal' || kind === 'total';
}

/**
 * The number `valuePolicy` screens for a point: the amount it moves the total by.
 *
 * A summary bar is not screened. It plots the accumulator, which is finite by
 * construction once the steps are, so it returns 0 and always passes. What it
 * *claims* is checked by `reconcile` instead — a claim this chart cannot read is
 * a failed reconciliation, not an undrawable bar.
 */
function plotValue(pt: WaterfallPoint): number {
  return pointKind(pt) === 'delta' ? (pt.value ?? NaN) : 0;
}

/** How a stated total stands against the steps that precede it. */
type WaterfallReconciliation =
  | { readonly status: 'none' }
  | { readonly status: 'agrees'; readonly stated: number }
  | { readonly status: 'differs'; readonly stated: number; readonly by: number }
  | { readonly status: 'unreadable' };

/**
 * The width of the band inside which two figures count as the same, relative to
 * the larger of them.
 *
 * ★ Why a relative floor exists even when `totalTolerance` is 0. Currency
 *   arithmetic in binary does not close: `0.1 + 0.2 - 0.3` is 5.55e-17, and a
 *   dozen such steps accumulate. An exact `!==` would report a rounding
 *   discrepancy on data that reconciles perfectly, and a chart that cries wolf
 *   about the seventeenth decimal place is one whose warnings get ignored when a
 *   real 20-unit hole appears. 1e-9 relative is far above IEEE noise and far
 *   below any discrepancy a person would enter — the smallest real one is a cent.
 */
const FLOAT_NOISE = 1e-9;

function reconcile(
  stated: number | null | undefined,
  computed: number,
  tolerance: number,
): WaterfallReconciliation {
  if (stated == null) return { status: 'none' };
  if (!Number.isFinite(stated)) return { status: 'unreadable' };
  // A non-finite tolerance would make every comparison false and report every
  // stated total as a discrepancy, so it counts as none at all.
  const band = Math.max(
    Number.isFinite(tolerance) ? Math.abs(tolerance) : 0,
    FLOAT_NOISE * Math.max(1, Math.abs(stated), Math.abs(computed)),
  );
  const by = stated - computed;
  return Math.abs(by) <= band ? { status: 'agrees', stated } : { status: 'differs', stated, by };
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  delta: number;
  running: number;
  color: string;
  type: WaterfallBarType;
  /** The step had no usable value — the tooltip says so rather than "+0". */
  clamped?: boolean;
}

interface RunningRow {
  label: string;
  delta: number;
  from: number;
  to: number;
  type: WaterfallBarType;
  /** Whether a stated figure was checked against the steps, and how it fared. */
  reconciliation: WaterfallReconciliation;
  /** The step's own value was unusable, so it moves the running total by nothing. */
  clamped: boolean;
}

interface GridLineInfo {
  x1: number; y1: number; x2: number; y2: number;
  labelX: number; labelY: number;
  anchor: string;
  label: string;
  value: number;
}

interface ZeroLineCoords {
  x1: number; y1: number; x2: number; y2: number;
  visible: boolean;
}

/** Pre-computed SVG coordinates for a single waterfall bar. */
interface ComputedBar {
  // Data
  label: string;
  delta: number;
  from: number;
  to: number;
  type: WaterfallBarType;
  color: string;
  index: number;
  isPositive: boolean;
  /** This bar's own value could not be used, or its stated total does not add up. */
  flagged: boolean;
  /** Set when the value was unusable — the bar is a stub at no change. */
  clamped: boolean;
  /** One sentence saying what is wrong with this bar, or `null` when nothing is. */
  note: string | null;
  // SVG bar rect
  rx: number; ry: number; rw: number; rh: number;
  // Dashed connector line to the next bar
  cx1: number; cy1: number; cx2: number; cy2: number;
  hasConnector: boolean;
  // Data label
  lx: number; ly: number;
  lAnchor: string;
  labelText: string;
  // Category axis label
  catLabelX: number;
  catLabelY: number;
  catAnchor: string;
  // Animation
  animClass: string;
  delay: number;
}

/** Stroke for a bar the chart is flagging — the semantic token, not the ramp. */
const FLAGGED_BAR_STROKE = 'var(--color-warning-600)';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * WaterfallChartComponent — Pure-SVG waterfall chart.
 *
 * Visualises the cumulative effect of sequentially introduced positive and
 * negative delta values. Supports both vertical (column) and horizontal (bar)
 * orientations, connector lines, data labels, an interactive tooltip, and
 * per-bar entrance animations that trigger when the chart enters the viewport.
 *
 * @example
 * ```html
 * <sv-waterfall-chart
 *   title="Company Revenue and Profit"
 *   [data]="revenueData"
 *   [options]="{ valuePrefix: '$', valueSuffix: 'M' }"
 * />
 * ```
 */
@Component({
  selector: 'sv-waterfall-chart',
  standalone: true,
  imports: [
    NgClass,
    SvChartAnimDirective,
    SvChartFrameComponent,
    SvDataSummaryTableComponent,
  ],
  templateUrl: './waterfall-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvWaterfallChartComponent {

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
  readonly chartIsEmpty = computed(() => this.data().length === 0);

  /** The load error, or the policy's refusal to plot this series under `reject`. */
  readonly resolvedError = computed<SvDataError | string | null>(
    () => this.error() ?? this.plotted().error,
  );

  // ── Inputs ────────────────────────────────────────────────────────────────

  /**
   * The waterfall series, **in the order it should be read**.
   *
   * ★ Order is the meaning here, not a presentation choice (audit item
   *   CH-18-I3). Each bar starts where the previous one ended, so moving a step
   *   changes every running total after it: `[+100, −50, ×2]` and `[+100, ×2,
   *   −50]` end at 100 and 150 from the same three facts. This component
   *   therefore **never sorts** — not by label, not by magnitude, not to put
   *   totals last. What you pass is what is read, and a series assembled from an
   *   unordered source (a `Map`, an object's keys, a `Promise.all` result) has to
   *   be put in order by the caller before it gets here.
   */
  data = input<WaterfallPoint[]>([]);

  /**
   * What to do with a step this chart cannot draw — one whose `value` is absent,
   * `NaN` or `Infinity`. A negative is not one of these: a waterfall is built out
   * of falls as much as rises.
   *
   * - `clamp` (default) — the step moves the running total by nothing, is marked
   *   in the plot, and is named under it. Every later bar keeps its position.
   * - `reject` — refuse the series and show the error state.
   *
   * `omit` is not available: a bar's position is its place in a sequence, so
   * dropping one silently rewrites the arithmetic of every bar after it. `render`
   * is not available either — there is no honest way to draw a step of unknown
   * size.
   *
   * @default 'clamp'
   */
  readonly valuePolicy = input<SvValuePolicy>('clamp');

  /**
   * How far a stated `subtotal` / `total` may sit from the figure its steps add
   * up to before the chart reports a discrepancy, in data units.
   *
   * `0` (the default) means they must agree, subject to a floating-point band
   * that scales with the numbers involved — see `FLOAT_NOISE`. Raise it when the
   * source rounds: a ledger kept in cents but charted in millions reconciles to
   * within 0.000005, and that is a rounding artefact rather than a hole.
   *
   * @default 0
   */
  readonly totalTolerance = input<number>(0);

  /** Chart title displayed above the SVG. */
  title = input<string>('');

  /** Layout direction. @default 'vertical' */
  orientation = input<WaterfallOrientation>('vertical');

  /** SVG height in pixels. @default 380 */
  height = input<number>(380);

  /** Rendering and feature options. */
  options = input<WaterfallChartOptions>({});

  /** Extra CSS classes applied to the root wrapper. */
  customClass = input<string>('');

  /**
   * Accessible-name override for the chart. When empty, a concise summary is
   * generated; the full series is always exposed through a visually-hidden
   * table. @default ''
   */
  ariaLabel = input<string>('');

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Emitted when a bar is hovered or keyboard-focused. */
  readonly barHover  = output<WaterfallBarEvent>();
  /** Emitted when a bar is clicked or activated via keyboard (Enter/Space). */
  readonly barSelect = output<WaterfallBarEvent>();

  // ── SVG viewport ──────────────────────────────────────────────────────────

  /** Fixed SVG logical width — scales responsively via `class="w-full"`. */
  readonly SVG_W = 560;

  // ── Padding by orientation ────────────────────────────────────────────────

  readonly PAD_V = { top: 40, right: 24, bottom: 56, left: 68 } as const;
  readonly PAD_H = { top: 12, right: 80, bottom: 44, left: 112 } as const;

  // ── Derived option signals ────────────────────────────────────────────────

  animDuration   = computed(() => { const d = this.options().animationDuration; return d != null ? `${d}ms` : null; });
  showGrid       = computed(() => this.options().showGrid        ?? true);
  showLabels     = computed(() => this.options().showLabels      ?? true);
  showLegend     = computed(() => this.options().showLegend      ?? true);
  showConnectors = computed(() => this.options().showConnectors  ?? true);
  posColor       = computed(() => this.options().positiveColor   ?? 'var(--color-accent-500)');
  negColor       = computed(() => this.options().negativeColor   ?? 'var(--color-danger-500)');
  totColor       = computed(() => this.options().totalColor      ?? 'var(--color-primary-500)');
  barR           = computed(() => this.options().barRadius       ?? 4);
  svgH           = computed(() => this.height());

  /** Stroke applied to a bar the chart is flagging, and to its legend key. */
  readonly FLAGGED_STROKE = FLAGGED_BAR_STROKE;

  // ── Tooltip state ─────────────────────────────────────────────────────────

  readonly tooltip = signal<TooltipState>({
    visible: false, x: 0, y: 0,
    label: '', delta: 0, running: 0, color: '', type: 'increase', clamped: false,
  });

  // ── The steps this chart can draw ─────────────────────────────────────────

  /**
   * The series with every step the chart cannot draw resolved, and what has to
   * be said about it.
   *
   * ★ This runs *before* the accumulator, which is the point. A single `NaN`
   *   delta poisoned `acc`, and from there every later `from` / `to`, the axis
   *   min and max, the scale and every bar path — one blank cell in a CSV blanked
   *   the entire plot with no error anywhere.
   */
  protected readonly plotted = computed(() =>
    svApplyValuePolicy(this.data(), {
      value: plotValue,
      clamp: (pt, to) => ({ ...pt, value: to }),
      policy: this.valuePolicy(),
      supported: ['clamp', 'reject'],
      fallback: 'clamp',
      selector: 'sv-waterfall-chart',
      noun: 'step',
      plottable: Number.isFinite,
    }),
  );

  // ── Running-total rows ────────────────────────────────────────────────────

  /** Maps each point to a `from / to` pair using a running accumulator. */
  private runningRows = computed<RunningRow[]>(() => {
    const { items, clamped } = this.plotted();
    const tolerance = this.totalTolerance();
    let acc = 0;

    return items.map(pt => {
      const kind = pointKind(pt);

      if (kind === 'delta') {
        // Finite by construction: the policy above either replaced an unusable
        // value or rejected the series outright.
        const delta = pt.value ?? 0;
        const from = acc;
        acc += delta;
        return {
          label: pt.label,
          delta,
          from,
          to: acc,
          type: delta >= 0 ? 'increase' : 'decrease',
          reconciliation: { status: 'none' } as WaterfallReconciliation,
          clamped: clamped.has(pt),
        };
      }

      // A summary bar is drawn from zero to the accumulator and leaves it alone.
      return {
        label: pt.label,
        delta: acc,
        from: 0,
        to: acc,
        type: kind === 'total' ? 'total' : 'intermediate',
        reconciliation: reconcile(pt.value, acc, tolerance),
        clamped: false,
      };
    });
  });

  /**
   * One sentence about a bar the chart is flagging, label-free so the same text
   * serves the plot's notice, the bar's accessible name and the data table.
   */
  private rowNote(row: RunningRow): string | null {
    if (row.clamped) {
      return 'No value this chart can use, so this step moves the running total by nothing.';
    }
    const rec = row.reconciliation;
    if (rec.status === 'differs') {
      return (
        `States ${this.fmtAmount(rec.stated)} against the ${this.fmtAmount(row.to)} its ` +
        `steps add up to — a difference of ${this.fmtAmount(Math.abs(rec.by))}. The bar is ` +
        `drawn from the steps.`
      );
    }
    if (rec.status === 'unreadable') {
      return (
        `The stated total could not be read, so the bar is drawn from the ` +
        `${this.fmtAmount(row.to)} its steps add up to.`
      );
    }
    return null;
  }

  /**
   * What the reader has to be told about this series, under the plot.
   *
   * ★ Not a `console.warn`. A total that does not reconcile is the single most
   *   consequential thing this chart can discover, and the person it matters to
   *   is reading a dashboard, not a browser console.
   */
  protected readonly notice = computed<string | null>(() => {
    const parts: string[] = [];
    const policyNotice = this.plotted().notice;
    if (policyNotice) parts.push(policyNotice);
    for (const pt of this.data()) {
      if (pt.kind != null && !isPointKind(pt.kind)) {
        parts.push(
          `${pt.label}: its kind ("${String(pt.kind)}") is not delta, subtotal or total, ` +
          `so it is read as a step.`,
        );
      }
    }
    for (const row of this.runningRows()) {
      if (row.clamped) continue; // already covered by the policy's own sentence
      const note = this.rowNote(row);
      if (note) parts.push(`${row.label}: ${note}`);
    }
    return parts.length ? parts.join(' ') : null;
  });

  // ── Axis range ────────────────────────────────────────────────────────────

  private axisRange = computed(() => {
    const rows = this.runningRows();
    if (rows.length === 0) return { axMin: 0, axMax: 100 };
    const allVals = [0, ...rows.flatMap(r => [r.from, r.to])];
    const rawMin  = Math.min(...allVals);
    const rawMax  = Math.max(...allVals);

    // ★ An all-zero series has no magnitude to scale to, and rounding 0 up gives
    //   0 back: min === max collapsed the axis onto a single line, stacking all
    //   six grid labels on top of each other at the top of the plot and drawing
    //   the bars from there instead of from the baseline. The default span keeps
    //   a real dataset of zeros looking like one.
    if (rawMin === 0 && rawMax === 0) return { axMin: 0, axMax: 100 };

    const niceUp = (v: number): number => {
      if (v <= 0) return 0;
      const exp = Math.pow(10, Math.floor(Math.log10(v)));
      // Try progressively finer steps to avoid excessive headroom
      for (const frac of [1, 0.5, 0.2, 0.1]) {
        const step = exp * frac;
        const candidate = Math.ceil(v / step) * step;
        if (candidate / v < 1.35) return candidate;
      }
      return Math.ceil(v / (exp * 0.1)) * (exp * 0.1);
    };

    const niceDown = (v: number): number => {
      if (v >= 0) return 0;
      const abs = Math.abs(v);
      const exp = Math.pow(10, Math.floor(Math.log10(abs)));
      for (const frac of [1, 0.5, 0.2, 0.1]) {
        const step = exp * frac;
        const candidate = Math.floor(v / step) * step;
        if (Math.abs(candidate) / abs < 1.35) return candidate;
      }
      return Math.floor(v / (exp * 0.1)) * (exp * 0.1);
    };

    return { axMin: niceDown(rawMin), axMax: niceUp(rawMax) };
  });

  // ── Shared layout geometry ────────────────────────────────────────────────

  private layout = computed(() => {
    const isVert = this.orientation() === 'vertical';
    const pad    = isVert ? this.PAD_V : this.PAD_H;
    const pW     = this.SVG_W - pad.left - pad.right;
    const pH     = this.height() - pad.top - pad.bottom;
    const { axMin, axMax } = this.axisRange();
    const axRange = Math.max(axMax - axMin, 1);
    const scale   = isVert ? pH / axRange : pW / axRange;
    return { isVert, pad, pW, pH, axMin, axMax, axRange, scale };
  });

  // ── Grid lines ────────────────────────────────────────────────────────────

  gridLines = computed<GridLineInfo[]>(() => {
    const { isVert, pad, pW, pH, axMin, axMax } = this.layout();
    const prefix = this.options().valuePrefix ?? '';
    const suffix = this.options().valueSuffix ?? '';
    const count  = 5;
    const step   = (axMax - axMin) / count;

    return Array.from({ length: count + 1 }, (_, i) => {
      const v = axMin + step * i;
      const label = `${prefix}${formatChartValue(v)}${suffix}`;
      if (isVert) {
        const y = pad.top + (axMax - v) * (this.layout().scale);
        return { x1: pad.left, y1: y, x2: pad.left + pW, y2: y, labelX: pad.left - 6, labelY: y + 4, anchor: 'end', label, value: v };
      } else {
        const x = pad.left + (v - axMin) * (this.layout().scale);
        return { x1: x, y1: pad.top, x2: x, y2: pad.top + pH, labelX: x, labelY: pad.top + pH + 18, anchor: 'middle', label, value: v };
      }
    });
  });

  // ── Zero line ─────────────────────────────────────────────────────────────

  zeroLine = computed<ZeroLineCoords>(() => {
    const { isVert, pad, pW, pH, axMin, axMax, scale } = this.layout();
    const visible = axMin < 0 && axMax > 0;
    if (isVert) {
      const y = pad.top + axMax * scale;
      return { x1: pad.left, y1: y, x2: pad.left + pW, y2: y, visible };
    } else {
      const x = pad.left + (-axMin) * scale;
      return { x1: x, y1: pad.top, x2: x, y2: pad.top + pH, visible };
    }
  });

  // ── Pre-computed bars ─────────────────────────────────────────────────────

  bars = computed<ComputedBar[]>(() => {
    const rows  = this.runningRows();
    const n     = rows.length;
    if (n === 0) return [];

    const { isVert, pad, pW, pH, axMax, axMin, scale } = this.layout();
    const pColor  = this.posColor();
    const nColor  = this.negColor();
    const tColor  = this.totColor();
    const GAP     = 0.25;

    const getColor = (t: WaterfallBarType) =>
      t === 'increase' ? pColor : t === 'decrease' ? nColor : tColor;

    /**
     * The figure printed on the bar itself.
     *
     * A summary bar whose stated figure disagrees prints both, because the label
     * is where a reader looks for the total and "480" alone is the answer to a
     * question they did not ask.
     */
    const getLabelText = (row: RunningRow): string => {
      if (row.clamped) return 'no value';
      if (row.type === 'total' || row.type === 'intermediate') {
        const rec = row.reconciliation;
        return rec.status === 'differs'
          ? `${this.fmtAmount(row.to)} ≠ ${this.fmtAmount(rec.stated)}`
          : this.fmtAmount(row.to);
      }
      return this.fmtDelta(row.delta);
    };

    const isFlagged = (row: RunningRow): boolean =>
      row.clamped ||
      row.reconciliation.status === 'differs' ||
      row.reconciliation.status === 'unreadable';

    if (isVert) {
      const bandW  = pW / n;
      const bW     = bandW * (1 - GAP);
      const svgY   = (v: number) => pad.top + (axMax - v) * scale;

      return rows.map((row, i) => {
        const color    = getColor(row.type);
        const isPos    = row.to >= row.from;
        const bX       = pad.left + i * bandW + (bandW * GAP) / 2;
        const topY     = svgY(Math.max(row.from, row.to));
        const botY     = svgY(Math.min(row.from, row.to));
        const bH       = Math.max(botY - topY, 3);
        const bY       = topY;
        const connY    = svgY(row.to);
        const nextBX   = pad.left + (i + 1) * bandW + (bandW * GAP) / 2;

        return {
          label: row.label, delta: row.delta, from: row.from, to: row.to,
          type: row.type, color, index: i, isPositive: isPos,
          flagged: isFlagged(row), clamped: row.clamped, note: this.rowNote(row),
          rx: bX, ry: bY, rw: bW, rh: bH,
          cx1: bX + bW, cy1: connY, cx2: nextBX, cy2: connY,
          hasConnector: i < n - 1,
          lx: bX + bW / 2,
          ly: isPos ? bY - 6 : bY + bH + 14,
          lAnchor: 'middle',
          labelText: getLabelText(row),
          catLabelX: bX + bW / 2,
          catLabelY: pad.top + pH + 20,
          catAnchor: 'middle',
          animClass: isPos ? 'bc-wf-up' : 'bc-wf-down',
          delay: i * 65,
        };
      });
    } else {
      // Horizontal
      const bandH  = pH / n;
      const bH     = bandH * (1 - GAP);
      const svgX   = (v: number) => pad.left + (v - axMin) * scale;

      return rows.map((row, i) => {
        const color    = getColor(row.type);
        const isPos    = row.to >= row.from;
        const bY       = pad.top + i * bandH + (bandH * GAP) / 2;
        const leftX    = svgX(Math.min(row.from, row.to));
        const rightX   = svgX(Math.max(row.from, row.to));
        const bW       = Math.max(rightX - leftX, 3);
        const bX       = leftX;
        const connX    = svgX(row.to);
        const nextBY   = pad.top + (i + 1) * bandH + (bandH * GAP) / 2;

        return {
          label: row.label, delta: row.delta, from: row.from, to: row.to,
          type: row.type, color, index: i, isPositive: isPos,
          flagged: isFlagged(row), clamped: row.clamped, note: this.rowNote(row),
          rx: bX, ry: bY, rw: bW, rh: bH,
          cx1: connX, cy1: bY + bH,
          cx2: connX, cy2: nextBY,
          hasConnector: i < n - 1,
          lx: isPos ? bX + bW + 6 : bX - 6,
          ly: bY + bH / 2 + 4,
          lAnchor: isPos ? 'start' : 'end',
          labelText: getLabelText(row),
          catLabelX: pad.left - 8,
          catLabelY: bY + bH / 2 + 4,
          catAnchor: 'end',
          animClass: isPos ? 'bc-wf-right' : 'bc-wf-left',
          delay: i * 65,
        };
      });
    }
  });

  /** Whether anything in the plot carries the flagged mark, for the legend key. */
  readonly hasFlagged = computed<boolean>(() => this.bars().some(b => b.flagged));

  // ── Accessibility ─────────────────────────────────────────────────────────

  /** Concise summary used as the chart's accessible name. */
  readonly chartDescription = computed<string>(() => {
    const rows = this.runningRows();
    const base = this.title() || 'Waterfall chart';
    if (!rows.length) return base;
    const last = rows[rows.length - 1];
    return (
      `${base}: ${rows.length} step${rows.length === 1 ? '' : 's'} in sequence, ` +
      `ending at ${this.fmtAmount(last.to)}.`
    );
  });

  /** Resolved accessible name — explicit override or the generated summary. */
  readonly resolvedAriaLabel = computed<string>(() => this.ariaLabel() || this.chartDescription());

  /**
   * Accessible name for one bar.
   *
   * The running total is in here rather than only in the tooltip, which is what
   * `mouseenter` opens: a keyboard reader reached the bar, heard its delta, and
   * had no way to learn where the total stood after it — in a chart whose entire
   * subject is where the total stands.
   */
  barAriaLabel(bar: ComputedBar): string {
    const head =
      bar.clamped
        ? `${bar.label}: no value, running total ${this.fmtAmount(bar.to)}`
        : bar.type === 'total' || bar.type === 'intermediate'
          ? `${bar.label}: ${this.typeLabel(bar.type).toLowerCase()} ${this.fmtAmount(bar.to)}`
          : `${bar.label}: ${this.fmtDelta(bar.delta)}, running total ${this.fmtAmount(bar.to)}`;
    return bar.note ? `${head}. ${bar.note}` : head;
  }

  /**
   * The series as a table — one row per step, in the order it is read.
   *
   * ★ Every figure a reader needs is here, including the two the picture keeps
   *   in places a screen reader cannot follow: the running total after each step
   *   (drawn only as a bar's position, and spoken only by a hover tooltip) and
   *   the step number, which is the part of a waterfall that carries the
   *   meaning — see the ordering note on `data`.
   */
  protected readonly a11ySummary = computed<SvDataSummary>(() => {
    const rows = this.runningRows();
    return {
      caption: this.title() || 'Waterfall chart',
      overview:
        rows.length > 0
          ? `Read in order; each step continues from the one before it.`
          : undefined,
      columns: ['Item', 'Step', 'Type', 'Change', 'Running total'],
      rows: rows.map((row, i) => ({
        key: `${i}-${row.label}`,
        header: row.label,
        cells: [
          `${i + 1}`,
          this.typeLabel(row.type),
          this.changeCell(row, i),
          this.runningCell(row),
        ],
      })),
    };
  });

  /**
   * The change column for one row.
   *
   * A step the chart could not draw reports what the source actually held, not
   * the zero the plot shows — the table is the data, and what it adds is the one
   * fact the geometry cannot carry non-visually: that this bar is not to scale.
   */
  private changeCell(row: RunningRow, index: number): string {
    if (row.clamped) {
      return `${this.fmtAmount(this.data()[index]?.value ?? NaN)} (drawn as no change)`;
    }
    if (row.type === 'total' || row.type === 'intermediate') return 'no change';
    return this.fmtDelta(row.delta);
  }

  /** The running-total column, carrying any disagreement with a stated figure. */
  private runningCell(row: RunningRow): string {
    const computedText = this.fmtAmount(row.to);
    const rec = row.reconciliation;
    if (rec.status === 'differs') {
      return (
        `${computedText} (stated ${this.fmtAmount(rec.stated)}, a difference of ` +
        `${this.fmtAmount(Math.abs(rec.by))})`
      );
    }
    if (rec.status === 'unreadable') return `${computedText} (stated total unreadable)`;
    return computedText;
  }

  // ── SVG bar path builder ──────────────────────────────────────────────────

  /**
   * Returns an SVG `d` path string for a rounded-corner rectangle.
   *
   * Rounding is applied to the "visible end" of each bar:
   * - Vertical positive → round top corners
   * - Vertical negative → round bottom corners
   * - Horizontal positive → round right corners
   * - Horizontal negative → round left corners
   */
  barPath(
    rx: number, ry: number, rw: number, rh: number,
    r: number, isPositive: boolean, isVert: boolean,
  ): string {
    if (rw <= 0 || rh <= 0) return '';
    const sr = Math.min(r, rw / 2, rh / 2);
    if (isVert) {
      if (isPositive) {
        // Round top-left and top-right
        return [
          `M ${rx + sr} ${ry}`,
          `H ${rx + rw - sr}`,
          `Q ${rx + rw} ${ry} ${rx + rw} ${ry + sr}`,
          `V ${ry + rh}`,
          `H ${rx}`,
          `V ${ry + sr}`,
          `Q ${rx} ${ry} ${rx + sr} ${ry}`,
          'Z',
        ].join(' ');
      } else {
        // Round bottom-left and bottom-right
        return [
          `M ${rx} ${ry}`,
          `H ${rx + rw}`,
          `V ${ry + rh - sr}`,
          `Q ${rx + rw} ${ry + rh} ${rx + rw - sr} ${ry + rh}`,
          `H ${rx + sr}`,
          `Q ${rx} ${ry + rh} ${rx} ${ry + rh - sr}`,
          'Z',
        ].join(' ');
      }
    } else {
      if (isPositive) {
        // Round top-right and bottom-right
        return [
          `M ${rx} ${ry}`,
          `H ${rx + rw - sr}`,
          `Q ${rx + rw} ${ry} ${rx + rw} ${ry + sr}`,
          `V ${ry + rh - sr}`,
          `Q ${rx + rw} ${ry + rh} ${rx + rw - sr} ${ry + rh}`,
          `H ${rx}`,
          'Z',
        ].join(' ');
      } else {
        // Round top-left and bottom-left
        return [
          `M ${rx + sr} ${ry}`,
          `H ${rx + rw}`,
          `V ${ry + rh}`,
          `H ${rx + sr}`,
          `Q ${rx} ${ry + rh} ${rx} ${ry + rh - sr}`,
          `V ${ry + sr}`,
          `Q ${rx} ${ry} ${rx + sr} ${ry}`,
          'Z',
        ].join(' ');
      }
    }
  }

  // ── Tooltip event handlers ────────────────────────────────────────────────

  private readonly TTW = 168;
  private readonly TTH = 72;

  private toBarEvent(bar: ComputedBar): WaterfallBarEvent {
    return { label: bar.label, delta: bar.delta, running: bar.to, type: bar.type, color: bar.color };
  }

  showTooltip(event: MouseEvent, bar: ComputedBar): void {
    const svgEl = (event.currentTarget as SVGElement).closest('svg')!;
    const rect  = svgEl.getBoundingClientRect();
    const scaleX = this.SVG_W / rect.width;
    const scaleY = this.height() / rect.height;
    const rawX  = (event.clientX - rect.left) * scaleX;
    const rawY  = (event.clientY - rect.top)  * scaleY;
    this.tooltip.set({
      visible: true,
      x: Math.min(rawX + 14, this.SVG_W - this.TTW - 4),
      y: Math.max(Math.min(rawY - this.TTH - 8, this.height() - this.TTH - 4), 2),
      label: bar.label,
      delta: bar.delta,
      running: bar.to,
      color: bar.color,
      type: bar.type,
      clamped: bar.clamped,
    });
    this.barHover.emit(this.toBarEvent(bar));
  }

  /** Positions the tooltip from pre-computed bar geometry (keyboard focus). */
  focusBar(bar: ComputedBar): void {
    this.tooltip.set({
      visible: true,
      x: Math.min(Math.max(bar.rx + bar.rw / 2 - this.TTW / 2, 4), this.SVG_W - this.TTW - 4),
      y: Math.max(bar.ry - this.TTH - 8, 2),
      label: bar.label,
      delta: bar.delta,
      running: bar.to,
      color: bar.color,
      type: bar.type,
      clamped: bar.clamped,
    });
    this.barHover.emit(this.toBarEvent(bar));
  }

  selectBar(bar: ComputedBar): void {
    this.barSelect.emit(this.toBarEvent(bar));
  }

  hideTooltip(): void {
    this.tooltip.update(s => ({ ...s, visible: false }));
  }

  // ── Formatting helpers (template-facing) ──────────────────────────────────

  /**
   * An amount as every label, tooltip, axis tick and table cell prints it.
   *
   * `formatChartValue(NaN)` is the string `"NaN"`, which a reader takes for a
   * measurement. A value the chart could not read is an absence, and says so.
   */
  fmtAmount(v: number): string {
    if (!Number.isFinite(v)) return 'no value';
    return `${this.options().valuePrefix ?? ''}${formatChartValue(v)}${this.options().valueSuffix ?? ''}`;
  }

  /** A step, signed — `+$300M`, `-$200M`. */
  fmtDelta(v: number): string {
    if (!Number.isFinite(v)) return 'no value';
    const sign = v >= 0 ? '+' : '-';
    return `${sign}${this.options().valuePrefix ?? ''}${formatChartValue(Math.abs(v))}${this.options().valueSuffix ?? ''}`;
  }

  fmtTooltipDelta(t: TooltipState): string {
    if (t.clamped) return 'no value';
    if (t.type === 'total' || t.type === 'intermediate') return this.fmtAmount(t.running);
    return this.fmtDelta(t.delta);
  }

  fmtTooltipTotal(v: number): string {
    return this.fmtAmount(v);
  }

  typeLabel(type: WaterfallBarType): string {
    switch (type) {
      case 'increase':     return 'Increase';
      case 'decrease':     return 'Decrease';
      case 'intermediate': return 'Interim Sum';
      default:             return 'Total';
    }
  }
}
