import type {
  SparklineBar,
  SparklineDatum,
  SparklinePoint,
  SparklineStats,
} from './sparkline.types';

/**
 * Sparkline geometry — pure functions, no Angular.
 *
 * The same normalise-then-project maths was copy-pasted into `stat-card`,
 * `ai-token-dashboard` and `rag-knowledge-base`, each with slightly different
 * padding and a different set of edge cases missed. It lives here now, and it
 * is plain arithmetic so it can be tested without a TestBed.
 *
 * SVG user space: x grows right, y grows *down*, so a larger value maps to a
 * smaller y. Every function is total — an empty or single-point series returns
 * empty output rather than `NaN`.
 */

/**
 * Unwrap `SparklineDatum` to plain numbers, dropping anything non-finite.
 *
 * ★★ DROPPING A GAP SHORTENS THE SERIES. That is the `skip` policy, and it is
 * the one this function implements: every point after a missing sample shifts
 * one slot left, so a Tuesday the collector never ran renders as a continuous
 * trend from Monday to Wednesday. Use {@link toSlots} to keep the positions and
 * let the caller choose. Kept as-is because three other packages call it, and
 * for a series with no gaps the two are identical.
 */
export function toValues(data: readonly SparklineDatum[]): number[] {
  const out: number[] = [];
  for (const d of data) {
    const v = typeof d === 'number' ? d : d?.value;
    if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
  }
  return out;
}

/**
 * Unwrap to one slot per datum, with `null` where the value is missing.
 *
 * ★ This is the shape the x axis needs: index *is* position, so a gap stays
 * where it happened instead of closing up and moving everything after it.
 */
export function toSlots(data: readonly SparklineDatum[]): (number | null)[] {
  return data.map((d) => {
    const v = typeof d === 'number' ? d : d?.value;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  });
}

/** What to do with a missing sample. */
export type SparklineMissing = 'gap' | 'skip' | 'zero' | 'connect';

/**
 * Apply a gap policy to a slot array.
 *
 * ★★ THE POINT OF MAKING THIS EXPLICIT: every one of these four is a claim
 * about data nobody has.
 *  - `gap` breaks the line. The only one that says "we do not know".
 *  - `skip` closes up, which silently rewrites the x axis.
 *  - `zero` asserts the value was zero, which for a rate or a price is a
 *    different statement from "not collected" — and it drags the domain down
 *    with it, flattening everything else.
 *  - `connect` draws a straight line across, asserting a trend through the
 *    missing region.
 * Defaulting to `gap` is the only choice that invents nothing.
 */
export function applyMissing(
  slots: readonly (number | null)[],
  policy: SparklineMissing,
): (number | null)[] {
  if (policy === 'gap') return [...slots];
  if (policy === 'skip') return slots.filter((v): v is number => v !== null);
  if (policy === 'zero') return slots.map((v) => v ?? 0);

  // connect — straight line between the nearest real values on either side.
  // Leading and trailing gaps have nothing to interpolate from and stay null;
  // extrapolating them would invent data past the ends of the series.
  const out = [...slots];
  let prev = -1;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === null) continue;
    if (prev >= 0 && i - prev > 1) {
      const from = out[prev] as number;
      const to = out[i] as number;
      const steps = i - prev;
      for (let k = 1; k < steps; k++) out[prev + k] = from + ((to - from) * k) / steps;
    }
    prev = i;
  }
  return out;
}

/** How many slots hold no value. */
export function gapCount(slots: readonly (number | null)[]): number {
  let n = 0;
  for (const v of slots) if (v === null) n++;
  return n;
}

/**
 * Value range to project against, widened so a flat series renders as a line
 * through the middle instead of dividing by zero.
 */
export function domainOf(
  values: readonly (number | null)[],
  explicitMin?: number | null,
  explicitMax?: number | null,
): { min: number; max: number; range: number } {
  // A loop rather than `Math.min(...values)`: spreading a long series into
  // arguments is what makes a 100k-point call throw instead of being slow.
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v === null || !Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === Infinity) return { min: 0, max: 1, range: 1 };

  const min = Math.min(explicitMin ?? lo, explicitMax ?? hi);
  const max = Math.max(explicitMin ?? lo, explicitMax ?? hi);

  return { min, max, range: max - min || 1 };
}

/**
 * One domain covering every series in a group.
 *
 * ★★★ A COLUMN OF SPARKLINES EACH SCALED TO ITSELF INVITES EXACTLY THE
 * COMPARISON IT CANNOT SUPPORT. Row A rising 2% and row B rising 900% draw the
 * identical shape, and the reader has no way to know — the chart is the only
 * thing on the page and it is lying by omission. Compute this once over every
 * row's series and hand the same tuple to all of them, and the heights mean
 * something.
 */
export function svSharedDomain(
  series: readonly (readonly (number | null)[])[],
): readonly [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const one of series) {
    for (const v of one) {
      if (v === null || !Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return lo === Infinity ? [0, 1] : [lo, hi];
}

/** Inset applied to the drawing box. A number pads both axes equally. */
export type SparklinePad = number | { readonly x: number; readonly y: number };

/**
 * Project a series onto `width` × `height`.
 *
 * `pad` insets the drawing so a stroke centred on the top or bottom row is not
 * clipped in half by the viewBox — pass half the stroke width. Give it `{x, y}`
 * when only one axis needs room: a chart that stretches edge to edge still
 * wants vertical padding so its peaks are not sliced.
 */
export function pointsOf(
  values: readonly (number | null)[],
  width: number,
  height: number,
  pad: SparklinePad = 0,
  explicitMin?: number | null,
  explicitMax?: number | null,
): SparklinePoint[] {
  if (values.length < 2) return [];

  const padX = typeof pad === 'number' ? pad : pad.x;
  const padY = typeof pad === 'number' ? pad : pad.y;

  const { min, range } = domainOf(values, explicitMin, explicitMax);
  const innerW = Math.max(0, width - padX * 2);
  const innerH = Math.max(0, height - padY * 2);
  const step = innerW / (values.length - 1);
  const floor = Math.min(padY, height - padY);
  const ceiling = Math.max(padY, height - padY);

  const out: SparklinePoint[] = [];
  values.forEach((value, i) => {
    // A missing slot produces no point AND keeps its x: that is what makes the
    // break land where the gap actually is.
    if (value === null || !Number.isFinite(value)) return;

    const raw = height - padY - ((value - min) / range) * innerH;
    const y = Math.min(ceiling, Math.max(floor, raw));
    out.push({
      i,
      value,
      x: round(padX + i * step),
      y: round(y),
      // ★★ A PINNED DOMAIN PLUS AN OUT-OF-RANGE VALUE USED TO DRAW OFF-CANVAS.
      //    The y came out negative or past the height, the viewBox clipped it,
      //    and the line simply left the chart with nothing said — which is the
      //    failure mode a SHARED domain makes common, because one row's spike
      //    is outside the range every other row agreed on. Clamped to the edge
      //    and flagged, so the label can say how many.
      clipped: raw < floor - 0.05 || raw > ceiling + 0.05,
    });
  });
  return out;
}

/**
 * `d` for the series line.
 *
 * With `smooth`, consecutive points are joined by quadratic segments through
 * their midpoints — each point becomes a control point, so the curve stays
 * inside the data's envelope. A cubic spline would overshoot on a spike, which
 * in a 36px-tall chart reads as data that is not there.
 */
export function linePathOf(points: readonly SparklinePoint[], smooth = false): string {
  if (points.length < 2) return '';
  return runsOf(points)
    .map((run) => subPath(run, smooth))
    .filter(Boolean)
    .join(' ');
}

/**
 * Split points into contiguous runs.
 *
 * ★ A gap is a discontinuity in the INDEX, not in the coordinates — two points
 * either side of a missing Tuesday are adjacent in the array and one slot apart
 * on the axis. Joining them would draw a line through data nobody has, which is
 * the `connect` policy and has to be asked for.
 */
function runsOf(points: readonly SparklinePoint[]): SparklinePoint[][] {
  const runs: SparklinePoint[][] = [];
  let current: SparklinePoint[] = [];
  for (const p of points) {
    const prev = current[current.length - 1];
    if (prev && p.i !== prev.i + 1) {
      runs.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) runs.push(current);
  return runs;
}

function subPath(points: readonly SparklinePoint[], smooth: boolean): string {
  if (points.length === 0) return '';
  // A lone point between two gaps still has to be visible; a zero-length line
  // paints nothing, so it becomes a one-unit stub that a round cap draws as a
  // dot. Dropping it would hide a day we DO have data for.
  if (points.length === 1) {
    return `M${points[0].x},${points[0].y} L${round(points[0].x + 0.01)},${points[0].y}`;
  }

  if (!smooth) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  }

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    d += ` Q${prev.x},${prev.y} ${round((prev.x + curr.x) / 2)},${round((prev.y + curr.y) / 2)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last.x},${last.y}`;
}

/** `d` for the filled area under the line, closed along the baseline. */
export function areaPathOf(
  points: readonly SparklinePoint[],
  height: number,
  pad: SparklinePad = 0,
  smooth = false,
): string {
  if (points.length < 2) return '';
  const floor = round(height - (typeof pad === 'number' ? pad : pad.y));

  // ★ Each contiguous run is closed on its own. One `Z` across a gap would fill
  // underneath the missing region, which is a filled area asserting a volume
  // that was never measured — the exact thing the break is there to avoid.
  return runsOf(points)
    .filter((run) => run.length >= 2)
    .map((run) => {
      const line = subPath(run, smooth);
      return `${line} L${run[run.length - 1].x},${floor} L${run[0].x},${floor} Z`;
    })
    .join(' ');
}

/**
 * Rectangles for the `bar` and `winloss` variants.
 *
 * Bars grow from `baseline` — pass the domain minimum for a column chart, or 0
 * to show values above and below an axis. `winloss` passes a fixed baseline and
 * ignores magnitude.
 */
export function barsOf(
  values: readonly (number | null)[],
  width: number,
  height: number,
  options: {
    gap?: number;
    baseline?: number | null;
    uniform?: boolean;
    explicitMin?: number | null;
    explicitMax?: number | null;
  } = {},
): SparklineBar[] {
  const n = values.length;
  if (n === 0) return [];

  const gap = Math.max(0, options.gap ?? 1);
  const slot = width / n;
  const barW = Math.max(0.5, slot - gap);

  const { min, range } = domainOf(values, options.explicitMin, options.explicitMax);
  const base = options.baseline ?? min;
  // Where the baseline sits vertically, clamped into the box.
  const baseY = clamp(height - ((base - min) / range) * height, 0, height);

  const out: SparklineBar[] = [];
  values.forEach((value, i) => {
    // A missing slot draws nothing and keeps its width, so the bars after it
    // stay where they belong.
    if (value === null || !Number.isFinite(value)) return;

    const positive = value >= base;
    const x = round(i * slot + gap / 2);

    if (options.uniform) {
      // Win/loss: every bar the same size, only the direction carries meaning.
      const h = height / 2 - gap / 2;
      out.push({
        i,
        value,
        positive,
        x,
        width: round(barW),
        y: round(positive ? height / 2 - h : height / 2 + gap / 2),
        height: round(Math.max(1, h)),
      });
      return;
    }

    const valueY = clamp(height - ((value - min) / range) * height, 0, height);
    // A zero-height rect is invisible; keep a hairline so every point reads,
    // and pull it back inside the box so it cannot hang below the baseline.
    const h = Math.max(Math.abs(valueY - baseY), 1);
    const top = Math.min(Math.min(valueY, baseY), height - h);

    out.push({
      i,
      value,
      positive,
      x,
      width: round(barW),
      y: round(Math.max(0, top)),
      height: round(h),
    });
  });
  return out;
}

/** Summary of the series, used for the accessible label. */
export function statsOf(values: readonly (number | null)[]): SparklineStats | null {
  // Indices are into the SLOT array, so `minIndex` still points at the right
  // column when the series has gaps in it.
  const real: { v: number; i: number }[] = [];
  values.forEach((v, i) => {
    if (v !== null && Number.isFinite(v)) real.push({ v, i });
  });
  if (real.length === 0) return null;

  let min = real[0].v;
  let max = real[0].v;
  let minIndex = real[0].i;
  let maxIndex = real[0].i;

  for (const { v, i } of real) {
    if (v < min) {
      min = v;
      minIndex = i;
    }
    if (v > max) {
      max = v;
      maxIndex = i;
    }
  }

  const first = real[0].v;
  const last = real[real.length - 1].v;
  const delta = last - first;

  return {
    count: real.length,
    first,
    last,
    min,
    max,
    minIndex,
    maxIndex,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    changePct: first === 0 ? null : (delta / Math.abs(first)) * 100,
  };
}

// ── Internals ────────────────────────────────────────────────────────────────

/** One decimal is plenty at these sizes and keeps the emitted path small. */
function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
