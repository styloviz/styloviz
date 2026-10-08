import { computed, signal, type Signal } from '@angular/core';

/**
 * One vocabulary for "why is this surface closing?", shared by every
 * dismissible family.
 *
 * ★★ MODAL AND DRAWER ALREADY HAD THIS, IDENTICALLY AND SEPARATELY — four
 *    string literals each, declared twice. That is the half the audit called
 *    "the right primitive"; the policy built on top of it is what was missing
 *    (`X-11`). Both component unions are subsets of this one, so their public
 *    types keep working unchanged.
 *
 * `route` and `history` are here for `X-13`: a surface closed by a navigation
 * did not close because the user dismissed it, and a host that logs dismissals
 * needs to be able to tell those apart.
 */
export type SvCloseReason =
  | 'backdrop'
  | 'escape'
  | 'close-button'
  | 'programmatic'
  | 'route'
  | 'history';

/**
 * The reasons a component's own published close-reason union can carry —
 * `ModalCloseReason` and `DrawerCloseReason` are exactly this set.
 */
export type SvDismissReason = Exclude<SvCloseReason, 'route' | 'history'>;

/**
 * Fold a close reason into the published component unions.
 *
 * ★★ THOSE UNIONS PREDATE `X-13` AND CANNOT GROW. A host's exhaustive
 *    `switch (reason)` over `ModalCloseReason` stops compiling the day a member
 *    is added, so a navigation or Back close used to be emitted as `'route'` /
 *    `'history'` through a cast — a value the declared type says is
 *    impossible. It is reported as `'programmatic'` instead (the surface closed
 *    on the app's behalf, not through its own controls), and the exact reason
 *    goes out on each component's `dismissedBy` output.
 */
export function svDismissReason(reason: SvCloseReason): SvDismissReason {
  return reason === 'route' || reason === 'history' ? 'programmatic' : reason;
}

/**
 * What a host's own guard said about a close attempt.
 *
 * `false` refuses it. Anything else — `true`, `undefined`, no return at all —
 * is "no objection", so a guard that only cares about one reason can just
 * `return` for the rest.
 */
export type SvCloseVerdict = boolean | void;

export interface SvCloseGuardOptions {
  /**
   * Is there unsaved work? A getter so a component can pass its own input
   * signal and have changes take effect immediately.
   */
  readonly dirty?: () => boolean;
  /**
   * The host's own veto, consulted before the dirty check.
   *
   * ★ A getter returning the function, not the function, because it is
   *   normally an `input()` the host may not have set.
   */
  readonly guard?: () => ((reason: SvCloseReason) => SvCloseVerdict) | null | undefined;
  /**
   * Reasons that skip the dirty prompt entirely.
   *
   * ★★ DEFAULTS TO `['programmatic']`, AND THAT IS A DECISION, NOT AN
   *    OVERSIGHT. The dirty prompt exists for ACCIDENTAL dismissal — a
   *    backdrop click, a stray Escape, the back button. A programmatic close
   *    is the host's own code saying "close now": a component that
   *    second-guesses its own API call is unusable, and the host is the one
   *    place that already knows whether the work was saved. Pass `[]` to
   *    prompt on those too.
   */
  readonly alwaysAllow?: () => readonly SvCloseReason[];
}

export interface SvCloseGuard {
  /** True while a close attempt is waiting on the unsaved-changes prompt. */
  readonly prompting: Signal<boolean>;
  /** The reason that raised the prompt, or `null`. */
  readonly pendingReason: Signal<SvCloseReason | null>;
  /**
   * May the surface close right now?
   *
   * Returns `true` to close immediately. `false` means either the host vetoed
   * it outright or the prompt is now up — `prompting()` says which.
   */
  request(reason: SvCloseReason): boolean;
  /**
   * The user chose to discard their changes. Returns the reason the close
   * should be reported with, or `null` if nothing was pending.
   *
   * ★★ THE ORIGINAL REASON, NOT `'programmatic'`. The user dismissed this with
   *    Escape; the prompt is an interruption in the middle of that, not a new
   *    kind of close. A surface that reports `programmatic` here tells its
   *    host's analytics that code closed a dialog the user closed.
   */
  discard(): SvCloseReason | null;
  /** The user chose to stay. Clears the prompt and closes nothing. */
  keep(): void;
  /** Forget any pending prompt — for a surface that closed by other means. */
  reset(): void;
}

const DEFAULT_ALWAYS_ALLOW: readonly SvCloseReason[] = ['programmatic'];

/**
 * The shared controlled-close policy: a host veto, and one unsaved-changes
 * prompt.
 *
 * ── Why this is shared and not per-component (`X-11`) ───────────────────────
 *
 * ★★★ "YOU HAVE UNSAVED CHANGES" IMPLEMENTED FOUR TIMES WILL BEHAVE FOUR
 *     WAYS. The audit says so and it is right: the interesting part is not the
 *     prompt, it is the ORDER of the questions and what each answer means.
 *     Does a host veto suppress the prompt or stack with it? Does a
 *     programmatic close prompt? What reason does the eventual close report?
 *     Four components answering those independently is four contracts.
 *
 * ★★ A HOST VETO AND A DIRTY PROMPT ARE DIFFERENT REFUSALS. `guard` returning
 *    `false` is the host saying "not now", for its own reasons, with its own
 *    messaging — so it does NOT raise the unsaved-changes prompt. Conflating
 *    them produces the surface that tells a user their changes are unsaved
 *    when the real reason was a request in flight.
 *
 * ★ Synchronous by design. Every close path in this kit — a backdrop click, a
 *   keydown, an `@Output` — is synchronous, and an `async` verdict would mean
 *   every one of them had to become a promise for a question that is almost
 *   always answered from a signal. The prompt IS the asynchronous case, and it
 *   is modelled as state rather than as a pending promise.
 *
 * ```ts
 * private readonly closeGuard = createCloseGuard({
 *   dirty: () => this.dirty(),
 *   guard: () => this.closeGuard_(),
 * });
 *
 * close(reason: ModalCloseReason = 'programmatic'): void {
 *   if (!this.closeGuard.request(reason)) return;   // vetoed, or prompting
 *   …
 * }
 * ```
 */
export function createCloseGuard(options: SvCloseGuardOptions = {}): SvCloseGuard {
  const pending = signal<SvCloseReason | null>(null);

  const api: SvCloseGuard = {
    // Derived rather than a second signal: "is the prompt up?" cannot then
    // disagree with "what raised it?".
    prompting: computed(() => pending() !== null),
    pendingReason: pending.asReadonly(),

    request: (reason: SvCloseReason): boolean => {
      // ★ Already prompting: refuse, and leave the reason alone. Idempotent
      //   for the same reason `createWaitEscalation.start()` is — the caller
      //   is a template event that can fire repeatedly (a user clicking the
      //   backdrop behind the prompt), and re-raising the prompt on each one
      //   would be indistinguishable from never having raised it.
      if (pending() !== null) return false;

      const guard = options.guard?.();
      if (guard && guard(reason) === false) return false;

      const dirty = options.dirty?.() ?? false;
      const allowed = options.alwaysAllow?.() ?? DEFAULT_ALWAYS_ALLOW;
      if (dirty && !allowed.includes(reason)) {
        pending.set(reason);
        return false;
      }

      return true;
    },

    discard: (): SvCloseReason | null => {
      const reason = pending();
      pending.set(null);
      return reason;
    },

    keep: (): void => { pending.set(null); },

    reset: (): void => { pending.set(null); },
  };

  return api;
}
