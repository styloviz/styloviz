import { computed, signal, type DestroyRef, type Signal } from '@angular/core';

/**
 * How long a wait has been going on, in three words instead of a millisecond
 * count.
 *
 * ── The defect this exists for (`OF-18-I5`, `OF-17-I7`) ─────────────────────
 *
 * ★★★ A SPINNER IS INDISTINGUISHABLE FROM A FAILED REQUEST, FOREVER. Both are
 *     "something is happening and I cannot tell you anything about it", and a
 *     spinner that has been going for ninety seconds is no longer telling the
 *     truth: nothing is happening. The user's only move is to reload the page
 *     and lose whatever they had typed — which is exactly what they do.
 *
 * ★★ THE SAME IS TRUE OF A SKELETON, AND WORSE. A skeleton says "the shape of
 *    your data is arriving"; a stuck one says that permanently, in the exact
 *    place the data was going to be. There is no timeout, no error, no retry —
 *    the host's request failed silently and the placeholder outlived it.
 *
 * ★ Two thresholds, not one, because the honest answers differ. At ten seconds
 *   the right thing to say is "this is taking longer than usual" — the request
 *   is probably fine and an error would be a lie. At thirty it is "this has
 *   stopped being a wait", and the surface owes the user a way out: a cancel, a
 *   retry, or at minimum an acknowledgement that it is stuck.
 */
export type SvWaitStage =
  /** Nothing is waiting. */
  | 'idle'
  /** Waiting, and that is normal. */
  | 'waiting'
  /** Longer than usual. Say so; do not claim failure. */
  | 'slow'
  /** Long enough that "waiting" is no longer a useful description. */
  | 'stalled';

export interface SvWaitEscalationOptions {
  /**
   * When `waiting` becomes `slow`, in ms. `0` or less never escalates.
   *
   * Accepts a signal so a component can expose it as an input.
   * @default 10_000
   */
  readonly slowAfterMs?: number | Signal<number>;
  /**
   * When it becomes `stalled`, in ms from the same start. `0` or less never
   * escalates. @default 30_000
   */
  readonly stalledAfterMs?: number | Signal<number>;
  /**
   * Destroy hook. Pass `inject(DestroyRef)` from a field initializer and the
   * timers are cleared on teardown — a timer that fires into a destroyed
   * component is the leak that only shows up under a router which reuses the
   * route.
   */
  readonly destroyRef?: DestroyRef | null;
}

export interface SvWaitEscalation {
  readonly stage: Signal<SvWaitStage>;
  /** `slow` or worse. */
  readonly slow: Signal<boolean>;
  /** `stalled`. */
  readonly stalled: Signal<boolean>;
  /**
   * Begin (or continue) waiting.
   *
   * ★★ IDEMPOTENT, AND THAT IS THE WHOLE DESIGN. Every caller is a template or
   *    an `effect` that runs again for reasons unrelated to the wait — a
   *    keystroke elsewhere, a theme change, a parent re-render. A `start()`
   *    that restarted the clock would mean a busy page never escalates at all,
   *    which is the failure mode that looks like the feature working.
   */
  start(): void;
  /** Stop waiting and return to `idle`. Safe to call when already idle. */
  stop(): void;
  /** Clear the timers. Called for you when `destroyRef` was supplied. */
  destroy(): void;
}

const DEFAULT_SLOW_MS = 10_000;
const DEFAULT_STALLED_MS = 30_000;

/**
 * Escalate a wait through `waiting → slow → stalled` on two timers.
 *
 * ```ts
 * protected readonly wait = createWaitEscalation({
 *   slowAfterMs: this.slowAfterMs,
 *   stalledAfterMs: this.stalledAfterMs,
 *   destroyRef: inject(DestroyRef),
 * });
 *
 * constructor() {
 *   effect(() => (this.loading() ? this.wait.start() : this.wait.stop()));
 * }
 * ```
 *
 * A plain factory: two timers and a signal, no injection context, callable
 * from a field initializer.
 */
export function createWaitEscalation(
  options: SvWaitEscalationOptions = {},
): SvWaitEscalation {
  const msOf = (
    value: number | Signal<number> | undefined,
    fallback: number,
  ): number => {
    const ms = value === undefined ? fallback : typeof value === 'number' ? value : value();
    return Number.isFinite(ms) ? ms : 0;
  };

  const stage = signal<SvWaitStage>('idle');
  let slowTimer: ReturnType<typeof setTimeout> | null = null;
  let stalledTimer: ReturnType<typeof setTimeout> | null = null;

  const clear = (): void => {
    if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
    if (stalledTimer !== null) { clearTimeout(stalledTimer); stalledTimer = null; }
  };

  const api: SvWaitEscalation = {
    stage: stage.asReadonly(),
    // ★ Derived, not a third signal: "is it slow?" cannot then disagree with
    //   "what stage is it?", which is how a two-flag version of this drifts.
    slow: computed(() => stage() === 'slow' || stage() === 'stalled'),
    stalled: computed(() => stage() === 'stalled'),

    start: (): void => {
      if (stage() !== 'idle') return;   // already waiting — see `start`'s note
      stage.set('waiting');

      const slowMs = msOf(options.slowAfterMs, DEFAULT_SLOW_MS);
      const stalledMs = msOf(options.stalledAfterMs, DEFAULT_STALLED_MS);

      if (slowMs > 0) {
        slowTimer = setTimeout(() => {
          slowTimer = null;
          // ★ Never demote: a `stalled` wait that hears from the slow timer
          //   late — a suspended tab, a debugger pause, timers firing out of
          //   order under fake clocks — must not go back to saying "longer
          //   than usual".
          if (stage() === 'waiting') stage.set('slow');
        }, slowMs);
      }
      if (stalledMs > 0) {
        stalledTimer = setTimeout(() => {
          stalledTimer = null;
          // ★ No `idle` check here, unlike the slow timer above. `stop()`
          //   clears both timers, so this callback cannot run after one — I
          //   wrote the guard, it survived every mutation, and it is gone.
          //   The guard above is NOT redundant: it is the never-demote rule,
          //   and removing it turns a stalled wait back into a slow one.
          stage.set('stalled');
        }, stalledMs);
      }
    },

    stop: (): void => {
      clear();
      stage.set('idle');
    },

    destroy: clear,
  };

  options.destroyRef?.onDestroy(clear);

  return api;
}

// ── Stating the expectation (`OF-18-I8`) ─────────────────────────────────────

/**
 * Turn "how long this usually takes" into the sentence a user can act on.
 *
 * ★★★ AN ESCALATION IS AN APOLOGY, NOT AN EXPECTATION. `createWaitEscalation`
 *     above only ever speaks once a wait has already gone wrong — it says
 *     "longer than usual" without ever having said what usual IS. A user who
 *     is told nothing for ten seconds has already decided the page is broken;
 *     the decision that matters is made in the first second, and it is made on
 *     information the host almost always has and never passes on.
 *
 * ★★ NEVER UNDERSTATE. Every figure here rounds UP, and that is deliberate:
 *    a user told "about 1 minute" who waits ninety seconds has been lied to,
 *    while one told "about 2 minutes" who is served in ninety seconds got a
 *    pleasant surprise. The two errors are not symmetrical, so the rounding
 *    is not either.
 *
 * ★ AND DO NOT OVER-CLAIM PRECISION. Above ten seconds the figure snaps to a
 *   five-second grid, because the number came from a host's estimate and
 *   "about 23 seconds" dresses a guess up as a measurement. Below ten it
 *   rounds to the second, where the grid would be coarser than the wait.
 *
 * Returns `null` for anything that is not a positive, finite duration — a
 * caller can pass its raw input straight in and render the result or nothing.
 *
 * @example
 * ```ts
 * svFormatExpectedWait(8_000);   // 'about 8 seconds'
 * svFormatExpectedWait(23_000);  // 'about 25 seconds'
 * svFormatExpectedWait(60_000);  // 'about 1 minute'
 * svFormatExpectedWait(0);       // null
 * ```
 */
export function svFormatExpectedWait(ms: number): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const seconds = ms / 1000;

  // ★ A 200ms expectation still reads "about 1 second" — "about 0 seconds" is
  //   not a sentence, and a host passing a figure that small has made a units
  //   mistake this function cannot fix for it. There is no floor here doing
  //   that work: I wrote `Math.max(1, …)` and no mutation could kill it,
  //   because rounding UP off a positive duration cannot reach zero. The
  //   guarantee is the ceiling's, so the floor is gone.
  const snapped = seconds <= 10
    ? Math.ceil(seconds)
    : Math.ceil(seconds / 5) * 5;

  // ★ The grid is applied BEFORE the unit is chosen, so 59s does not become
  //   "about 60 seconds" — the snap pushed it to a minute, and a minute is
  //   what a minute is called.
  if (snapped < 60) return `about ${snapped} second${snapped === 1 ? '' : 's'}`;

  const minutes = Math.ceil(snapped / 60);
  return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
}
