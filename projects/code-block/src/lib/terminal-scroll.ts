/**
 * The follow-the-output rule for `sv-terminal`, as arithmetic.
 *
 * ★★ A LOG THAT SCROLLS ITSELF WHILE YOU READ IT IS UNREADABLE. Autoscroll
 *    follows new lines only while the reader is already at the bottom; the
 *    moment they scroll up to read an error, it stops, and a "jump to latest"
 *    control takes over. This decides "at the bottom" — kept pure so the rule
 *    is tested as numbers rather than through a layout engine that jsdom does
 *    not have.
 */

/** Scroll metrics of the log box — the three `Element` properties that matter. */
export interface SvScrollMetrics {
  readonly scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

/**
 * True when the box is scrolled to (or within `threshold` px of) its end.
 *
 * ★ A threshold, not equality: fractional device pixels and a line that is
 *   still laying out leave `scrollTop` a pixel or two short of the maximum, and
 *   strict equality would read "the reader scrolled away" from a rounding error
 *   and stop following for no reason anybody could see.
 */
export function svIsScrolledToEnd(metrics: SvScrollMetrics, threshold = 24): boolean {
  const distance = metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight;
  return distance <= Math.max(0, threshold);
}
