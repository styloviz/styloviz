import { computed, signal, type DestroyRef, type Signal } from '@angular/core';
import { toSvDataError } from './errors';
import { createRequestGuard, type SvRequest, type SvRequestGuard } from './request-guard';
import type { SvDataError } from './types';

/**
 * The async contract for an ACTION — a write the user asked for once.
 *
 * ── Why this exists next to `createRequestGuard` and not instead of it ───────
 *
 * ★★★ READS AND WRITES WANT OPPOSITE RULES, AND CONFLATING THEM IS THE BUG.
 *     A search box wants LATEST-WINS: the user typed past "ab", so the "abc"
 *     request supersedes it and the older answer is discarded. That is
 *     `createRequestGuard`, and it is right for every list, picker and
 *     palette in the kit.
 *
 *     A Delete button wants FIRST-WINS. "Supersede the in-flight request with
 *     a newer one" means *running the destructive thing twice* — which is
 *     exactly what a double-click on Confirm did in eight families, each of
 *     them having decided independently what `loading` meant. So a second
 *     `run()` while one is in flight is REFUSED, and the caller is told so.
 *
 * ★★ AND IT OWNS THE HALF THE GUARD DOES NOT: the error. The guard answers
 *    "is this answer still wanted?"; it has nothing to say about a rejection,
 *    which is why every adopter grew its own `error` signal, its own
 *    normalization (or none), and its own idea of whether a retry was even
 *    possible. `SvDataError.retryable` already encodes that — a 404 will fail
 *    identically on retry, so offering "Try again" for one is a lie.
 *
 * ★ `idle → pending → error → retry | cancelled` is the whole machine. It is
 *   deliberately not a discriminated union of data states: the DATA belongs to
 *   the host, and a component that owns its host's data is the coupling this
 *   contract is trying to remove. `X-10`.
 */
export type SvAsyncActionStatus = 'idle' | 'pending' | 'error';

/**
 * What `run()` did. Returned rather than thrown, because all four are ordinary
 * outcomes a caller has to tell apart — and "it threw" is the one that is not.
 */
export type SvAsyncActionOutcome =
  /** The work resolved. */
  | 'done'
  /** The work rejected; `error()` now holds it. */
  | 'failed'
  /** Refused: something was already in flight. The work did NOT run. */
  | 'busy'
  /** `cancel()` (or teardown) happened first. Nothing was written. */
  | 'cancelled';

/**
 * May the user dismiss the surface while the action is in flight?
 *
 * ★★ THE POINT IS THAT SOMEBODY ANSWERS IT. The audit found eight families
 *    with an async mode and eight answers, most of them implicit: a dialog
 *    that silently swallowed Escape, a drawer that closed and left the request
 *    running, a modal with no opinion at all. Neither answer is wrong; not
 *    having one is.
 */
export type SvPendingDismissal =
  /** Dismissal is refused while pending. The safe default for a write. */
  | 'block'
  /** Dismissal aborts the request (via its `AbortSignal`) and closes. */
  | 'abort';

export interface SvAsyncActionOptions {
  /**
   * Message used when the rejection carries nothing readable.
   * @default 'Something went wrong.'
   */
  readonly fallbackMessage?: string;
  /**
   * Destroy hook. Pass `inject(DestroyRef)` from a field initializer and the
   * in-flight request is aborted on teardown — otherwise a resolution after
   * destruction writes to signals nobody is reading, and a rejection reports
   * an error on a surface that no longer exists.
   */
  readonly destroyRef?: DestroyRef | null;
  /** Share an existing guard. Defaults to one of its own. */
  readonly guard?: SvRequestGuard;
}

export interface SvAsyncAction {
  /** `idle` · `pending` · `error`. Bind whichever the surface renders. */
  readonly status: Signal<SvAsyncActionStatus>;
  /** True while the work is in flight. Bind to `loading` / `aria-busy`. */
  readonly pending: Signal<boolean>;
  /** The last rejection, normalized, or `null`. */
  readonly error: Signal<SvDataError | null>;
  /**
   * True when there is an error AND retrying it could plausibly succeed.
   *
   * ★ A failed DELETE that returned 403 is not retryable, and a "Try again"
   *   button for it wastes the user's time twice.
   */
  readonly canRetry: Signal<boolean>;
  /** How many times the work has been started, including retries. */
  readonly attempts: Signal<number>;

  /**
   * Run `work` once. Refused with `'busy'` if something is already in flight.
   *
   * `work` receives the request: pass `req.signal` to the transport so a
   * `cancel()` actually stops it.
   */
  run(work: (request: SvRequest) => unknown): Promise<SvAsyncActionOutcome>;
  /**
   * Run the last `work` again, clearing the error as it starts.
   *
   * Returns `'busy'` when nothing has been run yet — there is nothing to
   * retry, and inventing an empty attempt would clear the error for free.
   */
  retry(): Promise<SvAsyncActionOutcome>;
  /** Abort what is in flight, clear the error, and return to `idle`. */
  cancel(): void;
  /** Back to `idle` without aborting — for a surface that has closed cleanly. */
  reset(): void;
}

/**
 * One async action's state, with first-wins semantics and a normalized error.
 *
 * ```ts
 * protected readonly save = createAsyncAction({ destroyRef: inject(DestroyRef) });
 *
 * protected async onConfirm(): Promise<void> {
 *   const outcome = await this.save.run((req) => this.api.delete(this.id(), req.signal));
 *   if (outcome === 'done') this.open.set(false);
 * }
 * ```
 * ```html
 * @if (save.error(); as e) { <p role="alert">{{ e.message }}</p> }
 * <button [disabled]="save.pending()" (click)="onConfirm()">Delete</button>
 * ```
 */
export function createAsyncAction(options: SvAsyncActionOptions = {}): SvAsyncAction {
  const guard = options.guard ?? createRequestGuard();
  const error = signal<SvDataError | null>(null);
  const attempts = signal(0);
  let last: ((request: SvRequest) => unknown) | null = null;

  const run = async (work: (request: SvRequest) => unknown): Promise<SvAsyncActionOutcome> => {
    // ★★ FIRST-WINS. The second click on Confirm is not a newer intent, it is
    //    the same intent arriving twice — see the header. Refusing it here is
    //    what makes `[disabled]="pending()"` a courtesy rather than the only
    //    thing standing between the user and two DELETEs.
    if (guard.pending()) return 'busy';

    last = work;
    error.set(null);
    attempts.update((n) => n + 1);
    const request = guard.start();

    try {
      await work(request);
      // ★ `settle()` false means this run was superseded or cancelled. Writing
      //   anything then is the stale-write bug the guard exists to prevent —
      //   here it would clear `pending` for a request that is still running.
      return request.settle() ? 'done' : 'cancelled';
    } catch (cause) {
      // ★★ AN ABORT IS NOT A FAILURE. The user cancelled; reporting "Request
      //    aborted" back to them as an error is the most common way this goes
      //    wrong, and it looks like a bug in the thing they just stopped.
      //
      // ★ AND `settle()` IS THE WHOLE TEST — it does not need help from
      //   `request.signal.aborted`. I wrote both and the extra check survived
      //   every mutation: the signal is the guard's, so the only things that
      //   abort it are a supersede and a cancel, and both of those already
      //   make `settle()` false. Not every transport rejects with an
      //   `AbortError` anyway, so reading the rejection rather than the
      //   bookkeeping would have been the weaker test of the two.
      if (!request.settle()) return 'cancelled';
      error.set(toSvDataError(cause, options.fallbackMessage));
      return 'failed';
    }
  };

  const api: SvAsyncAction = {
    pending: guard.pending,
    error: error.asReadonly(),
    canRetry: computed(() => error()?.retryable === true),
    attempts: attempts.asReadonly(),
    // ★ The two orders are equivalent, and that is worth a line rather than a
    //   reader's time: `run()` clears the error before it starts, so `pending`
    //   and `error` are never both true. Swapping these branches passes every
    //   test in the spec, which is how I know. It is written pending-first
    //   because that is the order a surface renders them in.
    status: computed(() => (guard.pending() ? 'pending' : error() ? 'error' : 'idle')),

    run,

    retry: async (): Promise<SvAsyncActionOutcome> => {
      const work = last;
      if (!work) return 'busy';
      return run(work);
    },

    cancel: (): void => {
      guard.cancel();
      error.set(null);
    },

    reset: (): void => {
      error.set(null);
      attempts.set(0);
      last = null;
    },
  };

  options.destroyRef?.onDestroy(() => guard.cancel());

  return api;
}
