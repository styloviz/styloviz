/**
 * ============================================================================
 *  `X-4` — one scale contract for every list-shaped surface
 * ============================================================================
 *
 * ★★★ A DEGRADED VIEW MUST NEVER BE SILENTLY DEGRADED, and that is the whole
 *     contract. A transcript, a registry, a task queue, an event feed and a
 *     case table all have the same failure: the host hands over five thousand
 *     rows, the component renders every one of them, and either the page dies
 *     or somebody quietly adds a `slice(0, 100)` — after which the surface is
 *     showing a hundred rows and saying it is showing everything. The second
 *     outcome is worse than the first, because a page that freezes is at least
 *     honest about being in trouble.
 *
 * ★★ THE CEILING IS PART OF THE COMPONENT'S CONTRACT, NOT AN IMPLEMENTATION
 *    DETAIL. `sv-artifact-panel` and `sv-ai-writing-assistant` already had this
 *    right — past a line or token cap they degrade to counts and MARK the
 *    result `approximate` — so this generalises their pattern rather than
 *    inventing one, which is why the wording here echoes theirs: say what is
 *    missing and why, not merely "100 of 5,000".
 *
 * ★ WHAT THIS IS NOT. It is not virtualization. A window plus an honest label
 *   is what a component can guarantee in every host, on the server, and inside
 *   an `OnPush` change detector; a virtual scroller is a choice a host makes
 *   about its own layout. The ceiling is the floor of correct behaviour, and it
 *   leaves the door open.
 */

/** Which end of an over-long list survives the window. */
export type SvScaleKeep =
  /** The host's order, from the top: registries, catalogues, case tables. */
  | 'first'
  /**
   * The newest rows: transcripts, feeds, logs.
   *
   * ★★★ TRUNCATING A TRANSCRIPT FROM THE TOP IS THE ONLY CORRECT DIRECTION,
   *     and `slice(0, n)` does the opposite. A conversation cut at its first
   *     hundred messages hides the part the user is having right now, and the
   *     reply they are reading is the one that vanished.
   */
  | 'last';

export interface SvScaleWindow<T> {
  /** The rows to render. */
  readonly items: readonly T[];
  /**
   * How many rows the HOST supplied.
   *
   * ★★ The total is a fact about the data, never about the window. Every count
   *    a surface shows beside a truncated list — "1,240 tasks" — has to come
   *    from here, or the page reports the size of its own truncation as the
   *    size of the queue.
   */
  readonly total: number;
  /** `items.length`. */
  readonly shown: number;
  /** How many rows are not on screen. `0` when nothing was dropped. */
  readonly hidden: number;
  /** The ceiling in force, or `0` when there is none. */
  readonly ceiling: number;
  /** True when rows were dropped — the flag a surface must render. */
  readonly truncated: boolean;
  /** Which end survived. */
  readonly keep: SvScaleKeep;
}

/**
 * Window an over-long list, and say so.
 *
 * `ceiling` of `0` or less means no ceiling — the kit's convention for "never"
 * on every other threshold, and the opt-out a host with a virtual scroller of
 * its own needs.
 *
 * ★ A non-integer ceiling is floored rather than refused: 100.5 rows is not a
 *   thing, and a host computing a ceiling from a viewport height will produce
 *   fractions.
 *
 * @example
 * ```ts
 * readonly window = computed(() => svScaleWindow(this.messages(), this.maxMessages(), 'last'));
 * // template: @for (m of window().items; …) and <sv-scale-notice [window]="window()" noun="message" />
 * ```
 */
export function svScaleWindow<T>(
  items: readonly T[] | null | undefined,
  ceiling: number,
  keep: SvScaleKeep = 'first',
): SvScaleWindow<T> {
  const all = items ?? [];
  const total = all.length;
  const cap =
    Number.isFinite(ceiling) && ceiling > 0 ? Math.floor(ceiling) : 0;

  if (cap === 0 || total <= cap) {
    return { items: all, total, shown: total, hidden: 0, ceiling: cap, truncated: false, keep };
  }

  const windowed = keep === 'last' ? all.slice(total - cap) : all.slice(0, cap);
  return {
    items: windowed,
    total,
    shown: windowed.length,
    hidden: total - windowed.length,
    ceiling: cap,
    truncated: true,
    keep,
  };
}

/**
 * The sentence a truncated surface shows, or `null` when nothing was dropped.
 *
 * ★★ IT NAMES THE MISSING ROWS AND WHICH END THEY WERE AT. "Showing 100 of
 *    5,000" leaves the reader to work out whether they are looking at the
 *    beginning or the end of their own data, and in a transcript or a feed that
 *    is the only question that matters.
 *
 * @param noun singular noun for a row — `message`, `task`, `tool`, `event`.
 */
export function svScaleLabel<T>(window: SvScaleWindow<T>, noun = 'row'): string | null {
  if (!window.truncated) return null;

  const n = (value: number): string => value.toLocaleString('en-US');
  const plural = window.hidden === 1 ? noun : `${noun}s`;
  // ★ `older` for a transcript or a feed, where the window kept the newest and
  //   the dropped rows are behind the reader; `further` for a list in the
  //   host's own order, where they are simply beyond the end of the window.
  const which = window.keep === 'last' ? 'older' : 'further';

  return (
    `${n(window.hidden)} ${which} ${plural} of ${n(window.total)} are not shown — ` +
    `this view holds ${n(window.ceiling)} at a time. Filter, search or page to reach them.`
  );
}
