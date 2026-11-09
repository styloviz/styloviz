import {
  DestroyRef,
  PendingTasks,
  computed,
  inject,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import { createRequestGuard } from './request-guard';
import { toSvDataError } from './errors';
import type { SvDataError, SvEmptyReason } from './types';

/**
 * A function that turns what the user has typed into a list of suggestions.
 *
 * Promise + `AbortSignal`, matching {@link SvDataSource} and every other
 * transport contract in the kit. The `signal` aborts the moment a newer
 * keystroke supersedes this one — honour it, because a picker fires a request
 * per word and the ones nobody is waiting for are pure cost.
 */
export type SvSuggestSource<T> = (term: string, signal: AbortSignal) => Promise<readonly T[]>;

/** Tuning for {@link svSuggestController}. */
export interface SvSuggestControllerOptions {
  /**
   * Wait this long after the last keystroke before fetching. Accepts a signal,
   * so a component can pass its own `debounceMs` input straight through.
   *
   * 300ms matches `search-bar`, `autocomplete` and every Phase 2 picker.
   * @default 300
   */
  readonly debounceMs?: number | Signal<number>;

  /**
   * Do not fetch until the term is at least this long.
   *
   * Below it the controller reports `tooShort` and holds no options — which is
   * a *different* state from "we searched and found nothing", and the reason
   * `emptyReason` exists.
   * @default 0
   */
  readonly minChars?: number | Signal<number>;

  /**
   * Keep the previous suggestions visible while the next set loads.
   *
   * On by default, and this is the option `stale` exists to make honest: the
   * list stays put, `stale` goes true, and the panel dims rather than
   * collapsing under the user's cursor. Turn it off and every keystroke blanks
   * the panel — measurably the most disliked behaviour a combobox has.
   * @default true
   */
  readonly keepPreviousData?: boolean;
}

/**
 * The headless engine behind a server-backed picker: a term in, a list of
 * suggestions out, with the request lifecycle handled once.
 *
 * @see svSuggestController
 */
export interface SvSuggestController<T> {
  // ── Bind these to the component ──────────────────────────────────────────
  /** The suggestions to render. */
  readonly options: Signal<readonly T[]>;
  /** True while a request is in flight. Bind to the component's `loading`. */
  readonly loading: Signal<boolean>;
  /**
   * True while a request is in flight **and** an earlier one has already been
   * applied — the options on screen answer an older term.
   *
   * Render it *after* `error` and *before* `loading`: a first fetch is a
   * skeleton, a refinement is a dimmed list, and a retry after a failure is an
   * error. Collapsing the three into one boolean is what makes a combobox feel
   * like it is fighting the user.
   */
  readonly stale: Signal<boolean>;
  /** The last failure, or `null`. Already normalized for `<sv-error-shell>`. */
  readonly error: Signal<SvDataError | null>;
  /** The term the visible options actually answer — not the one being typed. */
  readonly term: Signal<string>;
  /** What the user has typed, un-debounced. */
  readonly typed: Signal<string>;
  /** True between a keystroke and the debounce settling. */
  readonly typing: Signal<boolean>;
  /** True when the term is shorter than `minChars`, so nothing was fetched. */
  readonly tooShort: Signal<boolean>;
  /**
   * Why the list is empty, or `null` when it is not.
   *
   * `no-results` once a search has answered with nothing; `no-data` for the
   * opening state, where the right copy is "start typing" rather than "no
   * matches". Never non-null while a first load is in flight.
   */
  readonly emptyReason: Signal<SvEmptyReason | null>;

  // ── Call these from the component's outputs ──────────────────────────────
  /** Record a keystroke — wire to `(queryChange)` / `(searched)`. */
  search(term: string): void;
  /** Search now, skipping the debounce. For Enter, and for opening the panel. */
  flush(): void;
  /** Re-run the settled term immediately — wire to `(retry)`. */
  reload(): void;
  /**
   * Abandon anything in flight without clearing what is on screen.
   *
   * Call it when the panel closes. A picker that keeps fetching for a dropdown
   * nobody can see is the same waste as a superseded request, and the response
   * would land against a closed panel.
   */
  cancel(): void;
  /** Back to the opening state: no term, no options, no error. */
  clear(): void;
}

/**
 * Wire a Styloviz picker to a search endpoint in five lines.
 *
 * ```ts
 * readonly people = svSuggestController<Person>(
 *   (term, signal) => fetch(`/api/people?q=${encodeURIComponent(term)}`, { signal })
 *     .then((r) => r.json()),
 *   { minChars: 2 },
 * );
 * ```
 * ```html
 * <sv-autocomplete
 *   [options]="people.options()"  [loading]="people.loading()"
 *   [stale]="people.stale()"      [error]="people.error()"
 *   (inputChange)="people.search($event)" />
 * ```
 *
 * The page-shaped sibling is {@link svDataController} — use that for a table or
 * a list that pages, sorts and filters. This one is for the term → options
 * shape every combobox in the kit has, where there is no page, no sort, and the
 * only query is a string.
 *
 * What it does that a hand-rolled `subscribe` does not:
 *
 * - **Debounces** keystrokes, so typing five characters is one request.
 * - **Guards** responses, so a slow answer to an abandoned term cannot
 *   overwrite a newer one — the bug that makes a combobox show suggestions for
 *   what the user typed two keystrokes ago, and that looks correct in review.
 * - **Aborts** the superseded request rather than just ignoring it.
 * - **Distinguishes** "loading the first time" from "refining what is already
 *   there" (`stale`), and "found nothing" from "not asked yet" (`emptyReason`).
 *
 * There is deliberately **no retry policy**. A table's user is waiting and has
 * nothing else to do, so backoff is right there; a picker's user has a
 * keyboard, and their next keystroke is a better retry than anything a timer
 * can schedule. Expose `error` and let `reload()` be the deliberate one. Wrap
 * the source yourself if your endpoint genuinely needs backoff.
 *
 * Nothing in the kit depends on this: components stay headless and this is
 * sugar. It needs an injection context for `DestroyRef` (a field initializer is
 * one); pass `destroyRef` if you are calling it from somewhere else.
 */
export function svSuggestController<T>(
  source: SvSuggestSource<T>,
  options: SvSuggestControllerOptions & {
    destroyRef?: DestroyRef;
    pendingTasks?: PendingTasks;
  } = {},
): SvSuggestController<T> {
  const {
    debounceMs = 300,
    minChars = 0,
    keepPreviousData = true,
    destroyRef = inject(DestroyRef),
    pendingTasks = inject(PendingTasks),
  } = options;

  const readOption = (v: number | Signal<number>): number => {
    const n = typeof v === 'number' ? v : v();
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const delayOf = (): number => readOption(debounceMs);
  const minCharsOf = (): number => readOption(minChars);

  const typed = signal('');
  const items = signal<readonly T[]>([]);
  const error = signal<SvDataError | null>(null);
  /** The term the visible options answer. `null` until one has landed. */
  const applied = signal<string | null>(null);
  /** True between a keystroke and the debounce elapsing. */
  const armed = signal(false);

  const guard = createRequestGuard();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    armed.set(false);
  };

  const fetchOnce = async (target: string): Promise<void> => {
    const req = guard.start();
    try {
      const next = await source(target, req.signal);
      if (!req.settle()) return;
      items.set(next);
      applied.set(target);
      error.set(null);
    } catch (cause) {
      // A superseded request is not a failure the user should ever see: its
      // rejection is this controller's own abort, arriving after the answer
      // that replaced it.
      if (req.signal.aborted || destroyed) return;
      if (!req.settle()) return;
      error.set(toSvDataError(cause));
      // The options stay: they answered the last term that *worked*, and
      // blanking the panel on a transient 503 takes away the only thing the
      // user can still act on.
      if (!keepPreviousData) items.set([]);
    }
  };

  /**
   * ★★ A fetch in flight blocks application stability — the same reason
   * `svDataController` registers its own. Without it `whenStable()` resolves
   * while the request is still on the wire, and a server render serialises an
   * empty panel.
   */
  const run = async (target: string): Promise<void> => {
    const done = pendingTasks.add();
    try {
      await fetchOnce(target);
    } finally {
      done();
    }
  };

  /** Below `minChars` there is nothing to ask for, and nothing to show. */
  const holdBack = (): void => {
    guard.cancel();
    error.set(null);
    items.set([]);
    applied.set(null);
  };

  const dispatch = (target: string): void => {
    if (destroyed) return;
    if (target.length < minCharsOf()) {
      holdBack();
      return;
    }
    void run(target);
  };

  const schedule = (target: string, delay: number): void => {
    clearTimer();
    if (delay <= 0) {
      dispatch(target);
      return;
    }
    armed.set(true);
    timer = setTimeout(() => {
      timer = null;
      armed.set(false);
      dispatch(target);
    }, delay);
  };

  destroyRef.onDestroy(() => {
    destroyed = true;
    clearTimer();
    guard.cancel();
  });

  return {
    options: items.asReadonly(),
    loading: guard.pending,
    stale: guard.stale,
    error: error.asReadonly(),
    term: computed(() => applied() ?? ''),
    typed: typed.asReadonly(),
    typing: armed.asReadonly(),
    tooShort: computed(() => typed().length < minCharsOf()),

    // Reads `applied`, not the typed term: while a search is in flight the
    // panel answers the *old* term, and calling it "no matches" before the
    // answer lands is a lie either way it resolves.
    emptyReason: computed(() => {
      if (items().length > 0) return null;
      if (guard.pending()) return null;
      return applied() === null ? 'no-data' : 'no-results';
    }),

    search: (term: string) => {
      typed.set(term);
      // Below the threshold there is nothing to wait for: drop the timer and
      // the options now, rather than after a delay that can only end one way.
      if (term.length < minCharsOf()) {
        clearTimer();
        holdBack();
        return;
      }
      schedule(term, delayOf());
    },

    // Enter, and opening the panel: waiting 300ms after a deliberate act is
    // what makes a picker feel broken.
    flush: () => {
      clearTimer();
      dispatch(untracked(typed));
    },

    reload: () => {
      error.set(null);
      clearTimer();
      dispatch(untracked(typed));
    },

    cancel: () => {
      clearTimer();
      guard.cancel();
    },

    clear: () => {
      clearTimer();
      guard.cancel();
      typed.set('');
      items.set([]);
      applied.set(null);
      error.set(null);
    },
  };
}
