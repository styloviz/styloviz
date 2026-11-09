/**
 * series-decimate.ts — which readings of a long series to draw.
 *
 * A line through ten thousand readings on a 520-unit-wide plot puts about twenty
 * points in every horizontal unit. They cannot be told apart on screen, and each
 * one still costs path data the browser has to parse and stroke. The fix is to
 * draw fewer points, but which ones matters:
 *
 * ★★ EVERY Nth POINT IS THE WRONG SAMPLE. A spike between two kept points just
 *    disappears, and a spike is often the reason someone is looking at the chart.
 *    This keeps the lowest and the highest finite reading of every bucket (a
 *    bucket is one horizontal plot unit), so the outline of the line — every peak
 *    and every trough — is drawn exactly. Only the points that are hidden
 *    behind their neighbours anyway are left out.
 *
 * ★ BREAKS STAY WHERE THEY ARE. A reading next to a gap is always kept, so a
 *   line still stops and resumes at the real readings either side of a missing
 *   one (see `series-gaps.ts`), instead of the break moving to whichever
 *   reading the bucket happened to keep.
 *
 * ★ ONE SHARED INDEX SET FOR ALL SERIES. Several series on one axis share their
 *   categories, so the kept indices are the union of what each series needs.
 *   That keeps the series aligned, and gives a screen-reader table one row per
 *   kept index that is true for every column.
 */
import { svIsGap } from './series-gaps';

/**
 * The indices of `series` worth drawing at `buckets` horizontal units, between
 * `start` and `end` (inclusive).
 *
 * For each bucket and each series it keeps the lowest and highest finite reading,
 * plus any reading next to a gap. `start` and `end` are always kept. The result
 * is sorted. Returns `null` when there is nothing to save: the window holds no
 * more than two points per bucket, so everything can be drawn.
 */
export function svDecimateIndices(
  series: readonly (readonly (number | null | undefined)[])[],
  start: number,
  end: number,
  buckets: number,
): number[] | null {
  const lo = Math.max(0, Math.floor(start));
  const hi = Math.floor(end);
  const span = hi - lo + 1;
  const width = Math.max(1, Math.floor(buckets));
  if (!Number.isFinite(span) || span <= width * 2) return null;

  const keep = new Set<number>([lo, hi]);
  const bucketOf = (i: number) => Math.min(width - 1, Math.floor(((i - lo) / span) * width));

  for (const data of series) {
    let bucket = -1;
    let minI = -1;
    let maxI = -1;
    const flush = () => {
      if (minI >= 0) keep.add(minI);
      if (maxI >= 0) keep.add(maxI);
      minI = -1;
      maxI = -1;
    };
    for (let i = lo; i <= hi; i++) {
      const b = bucketOf(i);
      if (b !== bucket) {
        flush();
        bucket = b;
      }
      const v = data[i];
      if (svIsGap(v)) continue;
      // A reading beside a gap is where the line stops or resumes.
      if ((i > 0 && svIsGap(data[i - 1])) || (i < data.length - 1 && svIsGap(data[i + 1]))) keep.add(i);
      if (minI < 0 || (v as number) < (data[minI] as number)) minI = i;
      if (maxI < 0 || (v as number) > (data[maxI] as number)) maxI = i;
    }
    flush();
  }

  return [...keep].sort((a, b) => a - b);
}
