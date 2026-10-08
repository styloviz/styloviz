/**
 * series-gaps.ts — a reading that is missing, drawn as missing.
 *
 * ★★★ ONE GAP USED TO BLANK THE WHOLE CHART. A line chart's y-axis is derived
 *     from `Math.max(...data)`, and `Math.max` of anything containing `NaN` is
 *     `NaN`. So a single unusable reading poisoned the axis maximum, every
 *     point's y came back `NaN`, and the path rendered as
 *     `M 0 NaN L 173 NaN L 346 NaN` — which SVG draws as nothing at all, with no
 *     error. Measured on four points with one gap: the entire series vanished,
 *     not just the missing point.
 *
 *     That is the worst possible failure for a missing value, because the two
 *     alternatives a host has without gap support are both lies: sending `0`
 *     asserts a reading of zero, and interpolating asserts a reading nobody
 *     took. The honest rendering is a BREAK — the line stops before the gap and
 *     resumes after it, so the reader can see there is nothing there.
 *
 * These live in `@styloviz/core` because the free and Pro line charts are
 * separate components rather than a mirrored pair, and two gap rules that
 * disagree about what counts as missing is exactly the defect the shared axis
 * ladder was written to remove.
 */

/**
 * Whether a datum is a gap rather than a value.
 *
 * `null` and `undefined` are the deliberate ways to say "no reading". `NaN` and
 * `±Infinity` are the accidental ones — a division by zero, a `parseFloat` of
 * `'n/a'`, a sensor fault — and they mean the same thing to a chart, so they are
 * treated the same rather than being allowed through to break the geometry.
 */
export function svIsGap(value: number | null | undefined): boolean {
  return value === null || value === undefined || !Number.isFinite(value);
}

/** The range of the readings that exist, and how many did not. */
export interface SvFiniteExtent {
  /** Smallest usable value, or `null` when there is none. */
  readonly min: number | null;
  /** Largest usable value, or `null` when there is none. */
  readonly max: number | null;
  /** How many entries were gaps. */
  readonly gaps: number;
  /** How many entries there were in total. */
  readonly total: number;
}

/**
 * Min and max over the readings that exist, plus a count of the ones that do not.
 *
 * The gap count comes back with the extent rather than from a second pass
 * because the axis and the disclosure have to describe the same set: a chart
 * that scales to the values it can draw and then reports a total including the
 * ones it cannot is telling the reader two different stories about one series.
 */
export function svFiniteExtent(values: Iterable<number | null | undefined>): SvFiniteExtent {
  let min: number | null = null;
  let max: number | null = null;
  let gaps = 0;
  let total = 0;

  for (const value of values) {
    total++;
    if (svIsGap(value)) {
      gaps++;
      continue;
    }
    const v = value as number;
    if (min === null || v < min) min = v;
    if (max === null || v > max) max = v;
  }

  return { min, max, gaps, total };
}

/**
 * Split a series into the contiguous runs that can actually be drawn.
 *
 * Each run is a stretch with no gap in it, so a path built from the runs stops
 * at every gap and starts again after it. An empty result means the series is
 * entirely missing, which is a different thing from an empty series and should
 * be said differently.
 *
 * `project` is only called for real values, so it never has to defend itself
 * against `NaN` — which is the point: the `NaN` guard belongs here, once, rather
 * than in every coordinate helper that a gap could reach.
 */
export function svGapRuns<T>(
  data: readonly (number | null | undefined)[],
  project: (value: number, index: number) => T,
): T[][] {
  const runs: T[][] = [];
  let run: T[] = [];

  for (let i = 0; i < data.length; i++) {
    if (svIsGap(data[i])) {
      if (run.length > 0) {
        runs.push(run);
        run = [];
      }
      continue;
    }
    run.push(project(data[i] as number, i));
  }
  if (run.length > 0) runs.push(run);

  return runs;
}

/**
 * One sentence naming the gaps, or `null` when there are none.
 *
 * ★ A break in a line is genuinely ambiguous on sight: it reads as "no data
 *   here" to one person and as a rendering glitch to another, and at one missing
 *   point in a dense series it is easy to miss entirely. Saying how many there
 *   are turns the break from something the reader has to interpret into
 *   something they have been told.
 *
 * `stacked` exists because a stacked chart cannot honour a gap: every band above
 * it is positioned by the running total, so the gap has to count as zero for the
 * stack to add up — and a zero that the host did not send is exactly the lie
 * this file exists to prevent. It cannot be avoided, so it is disclosed.
 */
export function svGapNotice(gaps: number, total: number, stacked = false): string | null {
  if (gaps <= 0) return null;

  const what = gaps === 1 ? '1 reading' : `${gaps} readings`;
  if (gaps >= total && total > 0) {
    return `No readings in this series can be plotted — all ${total} are missing.`;
  }
  return stacked
    ? `${what} missing. A stacked chart positions every band by the running total, ` +
        'so a missing reading has to count as zero here; the totals above it are ' +
        'lower than the real ones by whatever was not reported.'
    : `${what} missing. The line breaks rather than joining across the gap, ` +
        'because drawing through it would invent a value nobody recorded.';
}
