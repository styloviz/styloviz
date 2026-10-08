import { computed, signal, type Signal } from '@angular/core';

/**
 * One in-flight request, with the two things its caller needs: the signal to
 * hand the transport, and the settle that says whether to apply the answer.
 *
 * Returned by {@link SvRequestGuard.start}. Prefer it over the bare
 * {@link SvRequestGuard.begin} token — carrying the signal next to the token
 * is what stops the two drifting apart, which is the failure mode of every
 * hand-rolled version of this.
 */
export interface SvRequest {
  /** Monotonic id. Newer requests have higher tokens. */
  readonly token: number;
  /**
   * Aborts as soon as a newer request supersedes this one, or the guard is
   * cancelled. Pass it to `fetch`, to `HttpClient` via `AbortSignal`-aware
   * middleware, or check `signal.aborted` before applying anything.
   */
  readonly signal: AbortSignal;
  /**
   * Settle this request. Returns `false` when it was superseded — the caller
   * must discard the response. Equivalent to `guard.settle(request.token)`.
   */
  settle(): boolean;
}

/**
 * Tracks which in-flight request is still the one the UI cares about.
 *
 * The bug this prevents: the user types "ab", then "abc". Two requests go out.
 * The "ab" response is slower and lands second, so the list ends up showing
 * results for a query the user has already moved past — and nothing in the code
 * looks wrong. Every component that fires a request per keystroke needs this,
 * and none of them had it.
 *
 * Discarding a superseded response is the correctness half. Aborting it is the
 * cost half: an in-flight request the user has already typed past is wasted
 * server work, and on a slow connection it is what makes a filter feel laggy.
 * {@link start} does both.
 */
export interface SvRequestGuard {
  /** True while the newest request has not settled. Bind to `loading`. */
  readonly pending: Signal<boolean>;
  /**
   * True while a newer request is in flight **and** an earlier one has already
   * been applied — that is, whatever is on screen is answered but may be out of
   * date.
   *
   * This is the state a picker has no vocabulary for today: `loading` is true
   * both while the first results are being fetched (nothing on screen, show a
   * skeleton) and while a refinement of them is being fetched (results on
   * screen, keep them and mark them provisional). Blanking the panel on the
   * second is the most jarring thing a search box can do; showing the old list
   * with no indication that it is answering an older query is a quiet lie.
   *
   * `stale` says nothing about *why* the earlier request settled — a failed
   * request settles too. Render the error branch first and this one after it,
   * so a retry in flight shows the error, not stale results.
   */
  readonly stale: Signal<boolean>;
  /**
   * Start a request and take a token. Immediately supersedes any older one,
   * and aborts its signal.
   *
   * Prefer {@link start} unless the transport genuinely cannot be aborted.
   */
  begin(): number;
  /**
   * Start a request and take a token **and** an `AbortSignal`. Immediately
   * supersedes any older one, and aborts its signal.
   */
  start(): SvRequest;
  /** Whether `token` is still the newest request — check before applying data. */
  isCurrent(token: number): boolean;
  /**
   * Settle `token`. Returns `false` if it was superseded, in which case the
   * caller must discard the response. Clears `pending` only for the newest.
   */
  settle(token: number): boolean;
  /**
   * Abandon everything in flight — aborts the current signal and clears
   * `pending` without applying results.
   *
   * Call it on destroy, and when the panel closes: a picker that keeps fetching
   * for a dropdown nobody can see is the same waste as a superseded request.
   */
  cancel(): void;
}

/** The reason every abort this guard raises carries. */
const SUPERSEDED = (): DOMException =>
  new DOMException('Superseded by a newer request.', 'AbortError');

/**
 * A monotonic request guard with per-request abort.
 *
 * ```ts
 * private readonly guard = createRequestGuard();
 *
 * protected async search(term: string): Promise<void> {
 *   const req = this.guard.start();
 *   try {
 *     const rows = await this.api.search(term, req.signal);
 *     if (req.settle()) this.rows.set(rows);
 *   } catch (e) {
 *     if (req.signal.aborted) return;      // superseded — say nothing
 *     if (req.settle()) this.error.set(toSvDataError(e));
 *   }
 * }
 * ```
 * ```html
 * @if (error()) { <sv-error-shell … /> }
 * @else if (guard.stale()) { <ul [attr.aria-busy]="true" class="opacity-60">…</ul> }
 * @else if (guard.pending()) { <sv-skeleton-shell … /> }
 * ```
 *
 * A plain factory, not a service: it holds three counters and needs no
 * injection context, so it can be called straight from a field initializer.
 */
export function createRequestGuard(): SvRequestGuard {
  const latest = signal(0);
  const settled = signal(0);
  // Counts responses actually applied. Distinct from `settled`, which cancel()
  // also advances — cancelling is not an answer, and must not make the next
  // request look like a refinement of one.
  const applied = signal(0);

  let controller: AbortController | null = null;

  const abortInFlight = (): void => {
    controller?.abort(SUPERSEDED());
    controller = null;
  };

  const take = (): number => {
    abortInFlight();
    const token = latest() + 1;
    latest.set(token);
    return token;
  };

  const settle = (token: number): boolean => {
    if (token !== latest()) return false;
    settled.set(token);
    applied.update((n) => n + 1);
    // Settled, not superseded: drop the controller without aborting it, so a
    // late `cancel()` cannot abort a request that already answered.
    controller = null;
    return true;
  };

  return {
    pending: computed(() => latest() > settled()),

    // `applied` rather than `settled > 0`: after a cancel the two disagree, and
    // it is `applied` that answers "is there anything on screen to go stale?".
    stale: computed(() => latest() > settled() && applied() > 0),

    begin: take,

    start: (): SvRequest => {
      const token = take();
      const ac = new AbortController();
      controller = ac;
      return {
        token,
        signal: ac.signal,
        settle: () => settle(token),
      };
    },

    isCurrent: (token: number) => token === latest(),

    settle,

    // Burn a token so that everything already on the wire is superseded: the
    // point of cancel() is that a response arriving after it must be discarded,
    // and merely levelling `settled` with `latest` would still accept the
    // newest in-flight request.
    cancel: () => {
      abortInFlight();
      const void_ = latest() + 1;
      latest.set(void_);
      settled.set(void_);
    },
  };
}
