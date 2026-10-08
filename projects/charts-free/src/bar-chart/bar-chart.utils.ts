import {
  svApplyValuePolicy,
  svIsPlottableShare,
  type SvDataError,
  type SvValuePolicy,
} from '@styloviz/core';
import type { BarChartDataset } from './bar-chart.types';

// ─── Color palettes ───────────────────────────────────────────────────────────

/** Primary palette — used for single/grouped series. */
export const DEFAULT_COLORS: readonly string[] = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
];

/** Stack palette — more distinct hues for multi-segment stacked charts. */
export const STACK_COLORS: readonly string[] = [
  '#6366f1', // indigo-500
  '#22d3ee', // cyan-400
  '#fbbf24', // amber-400
  '#34d399', // emerald-400
  '#fb7185', // rose-400
  '#a78bfa', // violet-400
  '#4ade80', // green-400
  '#facc15', // yellow-400
];

// ─── Values a zero-based bar cannot draw ──────────────────────────────────────

/**
 * Height (or width) of the stub drawn where a clamped bar would be, in px.
 *
 * The bar itself is the marker, rather than a separate glyph beside it: the
 * `<path>` is what carries `tabindex`, `role="button"` and the accessible name,
 * and at a true zero it has no area, so the tab stop existed with nothing
 * visible on screen and no focus ring to find. A stub is focusable, visible, and
 * plainly not a measurement — it is the same 3px whatever the value was.
 */
export const CLAMPED_BAR_STUB_PX = 3;

/**
 * Fill for a bar drawn at the baseline instead of at its own value.
 *
 * One colour rather than a light/dark pair: this reaches the DOM as an SVG `fill`
 * ATTRIBUTE, and an attribute cannot carry a `dark:` variant. `warning-600` is the
 * one step of that ramp clearing 3:1 against both a white card and a gray-950 one,
 * and it is the family `sv-chart-frame` paints the disclosure in, so the mark and
 * the sentence explaining it move together when a buyer rebrands.
 *
 * Colour is not the marker on its own — the stub's SIZE is, since it is the same
 * 3px whatever the value was, and the accessible name says so in words.
 */
export const CLAMPED_BAR_FILL = 'var(--color-warning-600)';

/** What the policy left of a bar chart's series, and what it has to disclose. */
export interface BarValuePolicyResult {
  /** True for a bar sitting at the baseline instead of at its own value. */
  isClamped(seriesIndex: number, catIndex: number): boolean;
  /**
   * The highest DRAWABLE value, for `niceMax` to round into an axis ceiling.
   *
   * ★★★ `Math.max(…, NaN)` IS `NaN`, AND `niceMax(NaN)` IS `NaN`. One blank cell
   *     in the source therefore made the axis `NaN`, every bar's height `NaN`,
   *     and every grid tick `NaN` — and SVG drops a `NaN` dimension in silence,
   *     so the whole plot went blank from one bad number. Screening the values
   *     here is what keeps the axis a number.
   */
  readonly max: number;
  /** One sentence for the reader, or `null` when every bar is drawn to scale. */
  readonly notice: string | null;
  /** Set only under `reject`. */
  readonly error: SvDataError | null;
}

const NO_CLAMPS: BarValuePolicyResult['isClamped'] = () => false;

/**
 * Resolves what a zero-based bar chart can draw, and what it must say about it.
 *
 * `sv-bar-chart` and `sv-gradient-bar-chart` plot height (or width) as
 * `(value / axisMax) * plotSize`. For a negative value that is negative too, and
 * an SVG `<rect>` **refuses a negative height or width outright**: nothing
 * renders. The bar does not look wrong, it simply is not there.
 *
 * This replaced a `clampBarValue()` that clamped to 0 and warned **in dev only**,
 * so a production dashboard drew a missing bar and said nothing at all. What is
 * different now is not the geometry — a clamped 0 draws exactly as much as the
 * negative did — but that the chart marks the bar at the baseline and states the
 * count under the plot, where somebody reading the dashboard can see it.
 *
 * ★★ `omit` is not supported, and that is a layout fact rather than a
 *    preference. Categories come from a separate `categories` input and a bar's
 *    position is its index within its group, so dropping one value would shift
 *    every later bar of that series out from under its own label and out of
 *    alignment with its siblings. `clamp` is the default for the same reason: a
 *    bar has a baseline to put a marker on, which is exactly what a pie's 0° arc
 *    does not.
 *
 * For data that genuinely goes below zero, `<sv-negative-stack-chart>` is the
 * component built for it — a diverging layout centred on zero.
 */
export function resolveBarValues(
  datasets: readonly BarChartDataset[],
  policy: SvValuePolicy,
  selector: string,
): BarValuePolicyResult {
  const flat = datasets.flatMap((d) => d.data);
  const resolved = svApplyValuePolicy(flat, {
    value: (v) => v,
    clamp: (_v, to) => to,
    policy,
    supported: ['clamp', 'reject'],
    fallback: 'clamp',
    selector,
    noun: 'bar',
  });

  if (resolved.error) {
    return { isClamped: NO_CLAMPS, max: 1, notice: null, error: resolved.error };
  }

  // Identity: every value is drawable, so there is nothing to mark and nothing
  // to screen out of the axis.
  if (resolved.items === flat) {
    return { isClamped: NO_CLAMPS, max: Math.max(...flat, 1), notice: null, error: null };
  }

  // Keyed by position, not by value: `clamp` replaces each offending number with
  // 0, and a set of numbers cannot tell that 0 from a category that really is 0.
  const clamped = new Set<string>();
  let max = 1;
  datasets.forEach((series, si) => {
    series.data.forEach((value, ci) => {
      if (svIsPlottableShare(value)) max = Math.max(max, value);
      else clamped.add(`${si}:${ci}`);
    });
  });

  return {
    isClamped: (si, ci) => clamped.has(`${si}:${ci}`),
    max,
    notice: resolved.notice,
    error: null,
  };
}

/** What a stacked or range chart left undrawn, and what it has to disclose. */
export interface BarOmitPolicyResult {
  /** True for a segment or range the chart leaves out of the plot. */
  isOmitted(seriesIndex: number, catIndex: number): boolean;
  /** One sentence for the reader, or `null` when everything is drawn. */
  readonly notice: string | null;
  /** Set only under `reject`. */
  readonly error: SvDataError | null;
}

const NO_OMISSIONS: BarOmitPolicyResult['isOmitted'] = () => false;

/**
 * Resolves which cells a stacked or range bar chart cannot draw — `omit` or
 * `reject`, never silently.
 *
 * ★★ These variants used to skip such a value with no word at all: a stacked
 *    segment `<= 0` was `continue`d out of the column, and a range whose low was
 *    negative hung below the baseline, outside the plot. One `NaN` anywhere made
 *    `Math.max` — and so the axis and every bar — `NaN`, blanking the chart.
 *
 * Unlike `resolveBarValues`, `omit` IS safe here: a segment's position is its
 * place in the stack and a range bar keeps its own slot, so leaving one out does
 * not slide any other bar away from its category label.
 */
export function resolveOmittedBars<P>(
  datasets: readonly { readonly data: readonly P[] }[],
  options: {
    /** The number checked for plottability — what the notice quotes. */
    readonly value: (point: P) => number;
    /** Whether the point can be drawn. @default finite and not negative */
    readonly plottable?: (point: P) => boolean;
    readonly policy: SvValuePolicy;
    readonly selector: string;
    readonly noun: string;
    /** Why an omitted point cannot be drawn on this chart. */
    readonly reason: string;
  },
): BarOmitPolicyResult {
  const cells = datasets.flatMap((d, si) => d.data.map((point, ci) => ({ si, ci, point })));
  const drawable = options.plottable ?? ((p: P) => svIsPlottableShare(options.value(p)));
  const bad = new Set(cells.filter((c) => !drawable(c.point)));
  const resolved = svApplyValuePolicy(cells, {
    // A cell the chart cannot draw reads through as NaN when its own number is
    // perfectly finite (a range whose low is above its high), so the predicate
    // below — not the number — is what decides.
    value: (c) => (bad.has(c) && svIsPlottableShare(options.value(c.point)) ? Number.NaN : options.value(c.point)),
    clamp: (c) => c,
    policy: options.policy,
    supported: ['omit', 'reject'],
    fallback: 'omit',
    selector: options.selector,
    noun: options.noun,
    plottable: (v) => svIsPlottableShare(v),
    omitReason: () => options.reason,
  });

  if (resolved.error) return { isOmitted: NO_OMISSIONS, notice: null, error: resolved.error };
  if (!bad.size) return { isOmitted: NO_OMISSIONS, notice: null, error: null };

  const omitted = new Set([...bad].map((c) => `${c.si}:${c.ci}`));
  return {
    isOmitted: (si, ci) => omitted.has(`${si}:${ci}`),
    notice: resolved.notice,
    error: null,
  };
}

/**
 * The height a stacked segment contributes: its value when it is a finite,
 * positive number, and `0` — not drawn — otherwise. Stacks only add positive
 * parts; `NaN` used to reach the sums and blank the whole axis.
 * `resolveOmittedBars` is what discloses the ones this drops.
 */
export function stackValue(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}

// ─── Axis helpers ─────────────────────────────────────────────────────────────

/**
 * Return a nice round ceiling value for a given data maximum.
 * Example: niceMax(87) → 100, niceMax(1234) → 2000
 */
export function niceMax(maxValue: number): number {
  if (maxValue <= 0) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(Math.abs(maxValue))));
  return Math.ceil(maxValue / exp) * exp;
}

/**
 * Return up to `count + 1` evenly-spaced tick values from 0 to `axisMax`.
 * Default produces 6 ticks: [0, 20, 40, 60, 80, 100] for axisMax=100.
 *
 * ★★★ THE RESULT IS ALWAYS DISTINCT, AND THAT IS A CORRECTNESS REQUIREMENT
 *     RATHER THAN A TIDINESS ONE. Ticks are rounded to whole numbers, so an
 *     axis smaller than `count` cannot carry `count` of them: axisMax=1 over
 *     five steps used to come back as [0,0,0,1,1,1]. Every chart renders its
 *     ticks with `track val`, which makes a repeated value a DUPLICATE KEY —
 *     NG0955 in the console, on any chart plotting small integers. A headcount,
 *     a defect count and an error count are all small integers.
 *
 * ★★ A short axis gets fewer, whole steps rather than a squeezed six, so
 *    axisMax=3 reads 0·1·2·3 instead of 0·1·1·2·2·3.
 */
export function gridTicks(axisMax: number, count = 5): number[] {
  if (axisMax <= 0) return [0];
  const steps = Math.max(1, Math.min(count, Math.ceil(axisMax)));
  const ticks = Array.from({ length: steps + 1 }, (_, i) =>
    Math.round((axisMax / steps) * i)
  );
  // Fractional maxima can still round two adjacent steps together.
  return [...new Set(ticks)];
}

/**
 * Return `count * 2 + 1` ticks spanning -axisMax to +axisMax symmetrically.
 * Used by the negative-stack variant where the axis is centered at zero.
 */
export function gridTicksSymmetric(axisMax: number, count = 5): number[] {
  const step = axisMax / count;
  return Array.from({ length: count * 2 + 1 }, (_, i) =>
    parseFloat(((i - count) * step).toFixed(2))
  );
}

// ─── Value formatting ─────────────────────────────────────────────────────────

/** Format a number compactly for axis labels and value annotations. */
export function formatChartValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return v % 1 !== 0 ? v.toFixed(1) : String(v);
}

/** Format a number as a rounded percentage string (e.g. `42%`). */
export function formatPercent(v: number): string {
  return `${Math.round(v)}%`;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

/**
 * Resolve a bar's fill color.
 * Uses `override` when provided, otherwise cycles through `palette`.
 */
export function resolveColor(
  index: number,
  override?: string,
  palette: readonly string[] = DEFAULT_COLORS
): string {
  return override ?? palette[index % palette.length];
}

// ─── SVG path builders ────────────────────────────────────────────────────────

/**
 * Plain rectangle — used for stacked segments that must have no rounding
 * on all four corners.
 */
export function rectPath(x: number, y: number, w: number, h: number): string {
  if (w <= 0 || h <= 0) return '';
  return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
}

/**
 * Rectangle with rounded top-left and top-right corners.
 * Standard shape for a vertical column bar.
 */
export function roundedTopRectPath(
  x: number, y: number, w: number, h: number, r: number
): string {
  if (h <= 0) return '';
  const safeR = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + safeR} ${y}`,
    `H ${x + w - safeR}`,
    `Q ${x + w} ${y} ${x + w} ${y + safeR}`,
    `V ${y + h}`,
    `H ${x}`,
    `V ${y + safeR}`,
    `Q ${x} ${y} ${x + safeR} ${y}`,
    'Z',
  ].join(' ');
}

/**
 * Rectangle with rounded top-right and bottom-right corners.
 * Standard shape for a horizontal bar (grows left→right).
 */
export function roundedRightRectPath(
  x: number, y: number, w: number, h: number, r: number
): string {
  if (w <= 0) return '';
  const safeR = Math.min(r, w / 2, h / 2);
  return [
    `M ${x} ${y}`,
    `H ${x + w - safeR}`,
    `Q ${x + w} ${y} ${x + w} ${y + safeR}`,
    `V ${y + h - safeR}`,
    `Q ${x + w} ${y + h} ${x + w - safeR} ${y + h}`,
    `H ${x}`,
    'Z',
  ].join(' ');
}

/**
 * Rectangle with rounded top-left and bottom-left corners.
 * Used for negative horizontal bars that grow rightward from the center axis
 * (visually they grow left, so the "end" cap is on the left).
 */
export function roundedLeftRectPath(
  x: number, y: number, w: number, h: number, r: number
): string {
  if (w <= 0) return '';
  const safeR = Math.min(r, w / 2, h / 2);
  return [
    `M ${x + safeR} ${y}`,
    `H ${x + w}`,
    `V ${y + h}`,
    `H ${x + safeR}`,
    `Q ${x} ${y + h} ${x} ${y + h - safeR}`,
    `V ${y + safeR}`,
    `Q ${x} ${y} ${x + safeR} ${y}`,
    'Z',
  ].join(' ');
}

/**
 * Build the path for a stacked column segment.
 * Only the topmost segment (`isTop === true`) gets rounded corners.
 */
export function stackedColumnSegmentPath(
  x: number, y: number, w: number, h: number, r: number, isTop: boolean
): string {
  if (h <= 0) return '';
  return isTop ? roundedTopRectPath(x, y, w, h, r) : rectPath(x, y, w, h);
}

/**
 * Build the path for a stacked bar segment.
 * Only the last visible end segment gets rounded corners.
 * Pass `negative = true` for segments that grow leftward.
 */
// ─── Color manipulation ───────────────────────────────────────────────────────

/**
 * Lighten a hex color by mixing it toward white.
 * @param hex    Six-digit hex string (e.g. `#3b82f6`).
 * @param amount Mix ratio toward white (0 = no change, 1 = white).
 */
export function lightenColor(hex: string, amount = 0.3): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const num = parseInt(clean, 16);
  const r = Math.min(255, Math.round((num >> 16)          + (255 - (num >> 16))          * amount));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff)  + (255 - ((num >> 8) & 0xff))  * amount));
  const b = Math.min(255, Math.round((num & 0xff)         + (255 - (num & 0xff))          * amount));
  return `rgb(${r},${g},${b})`;
}

/**
 * Darken a hex color by mixing it toward black.
 * @param hex    Six-digit hex string.
 * @param amount Mix ratio toward black (0 = no change, 1 = black).
 */
export function darkenColor(hex: string, amount = 0.2): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const num = parseInt(clean, 16);
  const r = Math.max(0, Math.round((num >> 16)         * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff)        * (1 - amount)));
  return `rgb(${r},${g},${b})`;
}

export function stackedBarSegmentPath(
  x: number, y: number, w: number, h: number, r: number,
  isLast: boolean, negative = false
): string {
  if (w <= 0) return '';
  if (!isLast) return rectPath(x, y, w, h);
  return negative
    ? roundedLeftRectPath(x, y, w, h, r)
    : roundedRightRectPath(x, y, w, h, r);
}
