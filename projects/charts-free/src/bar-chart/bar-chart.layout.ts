/**
 * bar-chart.layout.ts — layout arithmetic the bar charts use internally.
 *
 * Deliberately NOT part of `bar-chart.utils.ts`, which the package re-exports
 * wholesale: these are implementation details, not API, and a patch release
 * must not grow the public surface.
 */

/**
 * Room, in SVG units, for a column of right-aligned category labels at `fontPx`.
 *
 * ★★ AN ESTIMATE, CONSERVATIVE ON PURPOSE. The horizontal bar chart reserved a
 *    fixed 56 units left of the plot, and "Product A" at 11 px needs about 52 —
 *    so it fitted on one machine and was cut off by 2.4 px on another whose
 *    font measured a little wider (CI's Chromium, 12 Oct 2026). Measuring the
 *    text in the browser would differ from the server-rendered markup and
 *    break hydration, so this over-estimates instead: 0.62 em for a Latin
 *    character (mixed-case Manrope averages ~0.55), a full em for a wide one
 *    (CJK, emoji), plus the label's 8-unit gap and 4 units of margin.
 *
 * @param labels  The category labels.
 * @param fontPx  Their font size, in SVG units.
 * @param min     The room to reserve however short the labels are.
 */
export function axisLabelRoom(labels: readonly string[], fontPx: number, min = 56): number {
  const GAP = 8;
  const MARGIN = 4;
  let widest = 0;
  for (const label of labels) {
    let em = 0;
    for (const ch of label) {
      const cp = ch.codePointAt(0) ?? 0;
      em += cp >= 0x2e80 ? 1 : 0.62;
    }
    widest = Math.max(widest, em * fontPx);
  }
  return Math.max(min, Math.ceil(widest + GAP + MARGIN));
}
