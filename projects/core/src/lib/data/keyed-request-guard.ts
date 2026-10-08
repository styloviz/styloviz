import { computed, signal, type Signal } from '@angular/core';

/**
 * Several requests in flight at once, each cancellable on its own.
 *
 * ── The gap this fills (`FI-05-M1`, `FI-03-M3`) ─────────────────────────────
 *
 * ★★★ `createRequestGuard` IS SINGLE-FLIGHT, AND THAT IS RIGHT FOR A SEARCH
 *     BOX: one term, one answer, and a newer keystroke supersedes the older
 *     request. It is exactly wrong for a TREE. Expanding three folders means
 *     three requests that are not refinements of each other — settling one must
 *     not discard the other two, and collapsing one branch must not cancel its
 *     siblings.
 *
 * ★★★ TWO BACKLOG ITEMS ARE THE SAME PROBLEM. `FI-05-M1` says `sv-tree-select`
 *     "has `loading`/`error` and no loader input at all"; `FI-03-M3` says
 *     `sv-cascader` has no "cancellation of a branch the user has navigated
 *     away from". One is the missing feature and the other is the missing
 *     cancellation, and a component that had the feature without the
 *     cancellation would have the second bug by construction.
 *
 * ── ★★★ WHY A BRANCH THE USER LEFT MUST BE CANCELLED ───────────────────────
 *
 * A user opens a folder, waits, gets bored, collapses it and opens another.
 * Without cancellation the first request is still coming, and when it lands the
 * component inserts children into a branch that is no longer on screen —
 * usually harmlessly, occasionally by re-expanding it under the user's cursor,
 * and always by holding memory and a connection nobody is waiting for. On a
 * deep tree browsed quickly that is dozens of live requests.
 */

export interface SvKeyedRequestGuard {
  /**
   * Start a request for `key`, cancelling any earlier one for the SAME key.
   * Returns the token to hand back to `settle`.
   *
   * ⚠️ It does NOT touch other keys. That is the whole difference from
   *    `createRequestGuard`.
   */
  take(key: string): number;
  /**
   * `true` when this response is still the newest for its key. `false` means it
   * was superseded or cancelled, and the caller must drop it on the floor.
   */
  settle(key: string, token: number): boolean;
  /** Abort the in-flight request for `key`, if any. */
  cancel(key: string): void;
  /** Abort everything. For `ngOnDestroy`, and for a tree being replaced. */
  cancelAll(): void;
  /** The `AbortSignal` for `key`'s current request, or `undefined`. */
  signalFor(key: string): AbortSignal | undefined;
  /** `true` while a request for `key` is outstanding. */
  isPending(key: string): boolean;
  /** Every key with a request outstanding — drives per-row spinners. */
  readonly pending: Signal<ReadonlySet<string>>;
}

/** Why an abort happened, so a caller can tell it from a network failure. */
export const SV_SUPERSEDED = 'sv-superseded';

export function svKeyedRequestGuard(): SvKeyedRequestGuard {
  const latest = new Map<string, number>();
  const controllers = new Map<string, AbortController>();
  const pendingKeys = signal<ReadonlySet<string>>(new Set());

  const publish = (): void => pendingKeys.set(new Set(controllers.keys()));

  const abort = (key: string): void => {
    const c = controllers.get(key);
    if (!c) return;
    c.abort(SV_SUPERSEDED);
    controllers.delete(key);
  };

  return {
    take(key) {
      abort(key);
      const token = (latest.get(key) ?? 0) + 1;
      latest.set(key, token);
      controllers.set(key, new AbortController());
      publish();
      return token;
    },

    settle(key, token) {
      // ★★ A CANCELLED REQUEST MUST NOT SETTLE. `cancel` deletes the
      //    controller but leaves `latest` alone, so a late response from the
      //    cancelled request still carries the current token — which would
      //    make it look current. Checking the controller is what distinguishes
      //    "still wanted" from "was wanted when it started".
      if (latest.get(key) !== token || !controllers.has(key)) return false;
      controllers.delete(key);
      publish();
      return true;
    },

    cancel(key) {
      abort(key);
      publish();
    },

    cancelAll() {
      for (const key of [...controllers.keys()]) abort(key);
      publish();
    },

    signalFor: (key) => controllers.get(key)?.signal,
    isPending: (key) => controllers.has(key),
    pending: computed(() => pendingKeys()),
  };
}
