/**
 * live-feed.ts — the questions every streaming chart has to answer, answered once.
 *
 * ★★★ SIX VARIANTS ANSWERED THESE SIX DIFFERENT WAYS, WHICH MEANS FIVE OF THEM
 *     WERE WRONG ABOUT SOMETHING. A chart that updates on a timer has to decide
 *     what happens when the tab is hidden, how much history it keeps, what it
 *     does with a sample that arrives out of order or twice, and what it tells
 *     the reader about any of it. None of those are chart-specific questions and
 *     none of them were being asked consistently.
 *
 * ★ The visibility half lives in `visibility-pause.ts` because it needs an
 *   injection context and a `document`. Everything here is arithmetic on an
 *   array, which is what lets it be tested with no DOM and no Angular at all.
 */

/** How a feed treats a sample that is not newer than the one before it. */
export type SvLateSamplePolicy = 'append' | 'drop' | 'reorder';

/** Options for {@link svAppendSample}. */
export interface SvAppendSampleOptions<T = unknown> {
  /**
   * How many samples to keep. Older ones fall off the front.
   * @default 0 — unbounded
   */
  readonly retain?: number;
  /**
   * What to do with a sample whose timestamp is not after the last one.
   *
   * - `append` (default) — keep it in arrival order. Right for a feed with no
   *   meaningful timestamps, where position IS the order.
   * - `drop` — refuse it. Right when a repeat is a retransmission.
   * - `reorder` — insert it where its timestamp belongs. Right when the
   *   transport can genuinely deliver out of order.
   * @default 'append'
   */
  readonly late?: SvLateSamplePolicy;
  /** Reads a sample's timestamp. Required for `drop` and `reorder`. */
  readonly timestamp?: (sample: T) => number;
}

/** The new history, and what had to be done to get it. */
export interface SvAppendResult<T> {
  readonly samples: readonly T[];
  /** True when the incoming sample was refused. */
  readonly dropped: boolean;
  /** True when it had to be inserted before the end. */
  readonly reordered: boolean;
  /** How many old samples fell off the front to stay within `retain`. */
  readonly evicted: number;
}

/**
 * Append one sample to a bounded history, applying the late-sample policy.
 *
 * ★ Returns a NEW array only when something changed, so an unchanged history
 *   keeps its identity for change detection.
 *
 * ★ `retain` counts the result, not the input: a feed asked to keep 60 points
 *   holds 60 after the append, not 61. Off-by-one here is a chart that slowly
 *   grows past the window its own axis is drawn for.
 */
export function svAppendSample<T>(
  history: readonly T[],
  sample: T,
  options: SvAppendSampleOptions<T> = {},
): SvAppendResult<T> {
  const retain = options.retain ?? 0;
  const late = options.late ?? 'append';
  const stamp = options.timestamp;

  let reordered = false;
  let next: T[];

  if (late !== 'append' && stamp && history.length > 0) {
    const incoming = stamp(sample);
    const last = stamp(history[history.length - 1]!);

    if (Number.isFinite(incoming) && Number.isFinite(last) && incoming <= last) {
      if (late === 'drop') {
        return { samples: history, dropped: true, reordered: false, evicted: 0 };
      }
      // `reorder`: find the first sample it should precede.
      const at = history.findIndex(s => {
        const t = stamp(s);
        return Number.isFinite(t) && t > incoming;
      });
      const index = at === -1 ? history.length : at;
      next = [...history.slice(0, index), sample, ...history.slice(index)];
      reordered = index < history.length;
    } else {
      next = [...history, sample];
    }
  } else {
    next = [...history, sample];
  }

  let evicted = 0;
  if (retain > 0 && next.length > retain) {
    evicted = next.length - retain;
    next = next.slice(evicted);
  }

  return { samples: next, dropped: false, reordered, evicted };
}

/**
 * The sentence a feed owes its reader after a pause, or `null` when the gap is
 * too short to matter.
 *
 * ★★ A RESUMED FEED THAT SAYS NOTHING DRAWS A CONTINUOUS LINE ACROSS A GAP
 *    WHERE NOTHING WAS SAMPLED. That is the same lie as interpolating a missing
 *    reading, and worse, because the reader has no reason to suspect it: the
 *    chart looks exactly like one that ran the whole time.
 *
 * The floor exists because a tab switch of half a second is not a gap in the
 * data — it is a person alt-tabbing — and a chart that announced every one of
 * those would train its reader to ignore the line that matters.
 */
export function svPauseNotice(pausedMs: number, floorMs = 2000): string | null {
  if (!Number.isFinite(pausedMs) || pausedMs < floorMs) return null;

  const seconds = Math.round(pausedMs / 1000);
  const spell =
    seconds < 60
      ? `${seconds} second${seconds === 1 ? '' : 's'}`
      : `${Math.round(seconds / 60)} minute${Math.round(seconds / 60) === 1 ? '' : 's'}`;

  return (
    `Updates stopped for ${spell} while this tab was in the background, so ` +
    'nothing was sampled over that stretch. The line resumes rather than ' +
    'filling it in.'
  );
}
