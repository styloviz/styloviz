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
import { svSuggestController } from './suggest-controller';
import { toSvDataError } from './errors';
import type { SvDataError } from './types';

/** Which slice of the answer a {@link SvSelectSourceSearch} call is for. */
export interface SvSelectSourcePageRequest {
  /** Rows already loaded for this term — the index of the first row wanted. */
  readonly offset: number;
  /** Rows wanted; `0` when the source is not paged. */
  readonly limit: number;
}

/** One page of an answer, when the server can say whether there is more. */
export interface SvSelectSourcePage<T> {
  readonly items: readonly T[];
  /**
   * More rows exist for this term. Omit it and a page that came back full
   * (`items.length >= pageSize`) is taken to mean "there may be more".
   */
  readonly hasMore?: boolean;
}

/**
 * The server call behind a select. Return the rows, or a page that also says
 * whether more exist. Honour `signal`: it aborts the moment a newer term
 * supersedes this one.
 */
export type SvSelectSourceSearch<T> = (
  term: string,
  signal: AbortSignal,
  page: SvSelectSourcePageRequest,
) => Promise<readonly T[] | SvSelectSourcePage<T>>;

/** Options for {@link svSelectSource}. */
export interface SvSelectSourceOptions<T> {
  /** The server call. */
  readonly search: SvSelectSourceSearch<T>;
  /**
   * Rows per page. `0` means the call returns the whole answer for a term and
   * there is no "Load more".
   * @default 0
   */
  readonly pageSize?: number;
  /**
   * Characters required before a term is searched. Applied by the consuming
   * select, which also renders the "type N characters" hint; `undefined` leaves
   * the select's own setting in force.
   */
  readonly minChars?: number;
  /**
   * Keystroke debounce in ms. Applied by the consuming select — which already
   * debounces its search box, and debouncing a second time here would make a
   * 300 ms picker answer in 600. `undefined` leaves the select's own setting.
   */
  readonly debounceMs?: number;
  /** Needed only outside an injection context. */
  readonly destroyRef?: DestroyRef;
  /** Needed only outside an injection context. */
  readonly pendingTasks?: PendingTasks;
}

/**
 * Search, paging and async state for one select, as one object.
 *
 * @see svSelectSource
 */
export interface SvSelectSource<T> {
  /** Every row loaded for the current term, pages appended in order. */
  readonly options: Signal<readonly T[]>;
  /** The first page for a term is in flight. */
  readonly loading: Signal<boolean>;
  /** The rows on screen answer an older term; a newer one is in flight. */
  readonly stale: Signal<boolean>;
  /** The last failure — of the search or of a "Load more" — or `null`. */
  readonly error: Signal<SvDataError | null>;
  /** More rows exist for the current term. */
  readonly hasMore: Signal<boolean>;
  /** A "Load more" is in flight. */
  readonly loadingMore: Signal<boolean>;
  /** The term the visible rows answer. */
  readonly term: Signal<string>;
  /** See {@link SvSelectSourceOptions.minChars}. */
  readonly minChars: number | undefined;
  /** See {@link SvSelectSourceOptions.debounceMs}. */
  readonly debounceMs: number | undefined;

  /** Fetch the first page for `term` now. The select calls this debounced. */
  search(term: string): void;
  /**
   * The panel opened with `term` in the box: fetch unless the rows on screen
   * already answer it.
   */
  open(term: string): void;
  /** Fetch and append the next page. No-op when there is none, or one is in flight. */
  loadMore(): void;
  /** Retry whatever failed — the "Load more" if that was it, else the search. */
  reload(): void;
  /** Abandon anything in flight, keeping what is on screen. */
  cancel(): void;
}

/** The first page, kept as one object so its rows and its `hasMore` can never disagree. */
interface FirstPage<T> {
  readonly items: readonly T[];
  readonly hasMore: boolean;
}

/**
 * The adapter layer of the select split (`FI-23-M1`): where a select's options
 * come from.
 *
 * ```ts
 * readonly people = svSelectSource<SelectOption>({
 *   search: (term, signal, { offset, limit }) => api.people(term, offset, limit, signal),
 *   pageSize: 50,
 *   minChars: 2,
 * });
 * ```
 * ```html
 * <sv-select-dropdown [source]="people" [selectedOption]="current()" />
 * ```
 *
 * One object replaces twelve members of the select's API — `serverSide`,
 * `debounceMs`, `minChars`, `loadOptions`, `hasMore`, `loadingMore`,
 * `loading`, `stale`, `error`, `searchChange`, `retry` and `loadMore` —
 * because they are one conversation with one server.
 *
 * ★★ NOT A SECOND ASYNC ENGINE. The first page is {@link svSuggestController}
 *    — the guard, the abort, the stale/loading split, the pending task — and
 *    "Load more" is one more {@link createRequestGuard}. What this adds is only
 *    the paging: appending a page to the term that asked for it, and never to a
 *    newer term's rows.
 *
 * ★★★ A PAGE BELONGS TO THE FIRST PAGE IT EXTENDS. Appended rows are stored
 *     against the identity of the first-page object they followed, so the
 *     moment a new term's first page lands the old term's extra pages are no
 *     longer read — there is no reset to forget and no window where page two of
 *     "ada" sits under page one of "bob".
 *
 * Needs an injection context (a field initializer is one), or pass
 * `destroyRef` and `pendingTasks`.
 */
export function svSelectSource<T>(options: SvSelectSourceOptions<T>): SvSelectSource<T> {
  const destroyRef = options.destroyRef ?? inject(DestroyRef);
  const pendingTasks = options.pendingTasks ?? inject(PendingTasks);
  const pageSize = Number.isFinite(options.pageSize) && (options.pageSize ?? 0) > 0
    ? Math.floor(options.pageSize as number)
    : 0;

  const normalize = (answer: readonly T[] | SvSelectSourcePage<T>): FirstPage<T> => {
    const items = isPage(answer) ? answer.items : answer;
    const declared = isPage(answer) ? answer.hasMore : undefined;
    return { items, hasMore: declared ?? (pageSize > 0 && items.length >= pageSize) };
  };

  // The first page: the existing engine, unchanged. `debounceMs: 0` and
  // `minChars: 0` because the consuming select applies both — see the options.
  const first = svSuggestController<FirstPage<T>>(
    (term, signal) =>
      options.search(term, signal, { offset: 0, limit: pageSize }).then((a) => [normalize(a)]),
    { debounceMs: 0, minChars: 0, destroyRef, pendingTasks },
  );

  const firstPage = computed<FirstPage<T> | null>(() => first.options()[0] ?? null);

  /** Pages appended after `base`. Ignored once `base` is no longer the first page. */
  const more = signal<{ readonly base: FirstPage<T> | null; readonly items: readonly T[]; readonly hasMore: boolean }>(
    { base: null, items: [], hasMore: false },
  );
  const moreError = signal<SvDataError | null>(null);
  const moreGuard = createRequestGuard();
  destroyRef.onDestroy(() => moreGuard.cancel());

  const extension = computed(() => {
    const page = firstPage();
    const extra = more();
    return page !== null && extra.base === page ? extra : null;
  });

  const rows = computed<readonly T[]>(() => {
    const page = firstPage();
    if (!page) return [];
    const extra = extension();
    return extra ? [...page.items, ...extra.items] : page.items;
  });

  const hasMore = computed(() => {
    const page = firstPage();
    if (!page) return false;
    return extension()?.hasMore ?? page.hasMore;
  });

  const loadMore = (): void => {
    const base = untracked(firstPage);
    if (!base || !untracked(hasMore) || untracked(moreGuard.pending) || untracked(first.loading)) return;
    const term = untracked(first.term);
    const offset = untracked(rows).length;
    const req = moreGuard.start();
    moreError.set(null);
    const done = pendingTasks.add();
    options
      .search(term, req.signal, { offset, limit: pageSize })
      .then((answer) => {
        if (!req.settle() || untracked(firstPage) !== base) return;
        const page = normalize(answer);
        const prior = untracked(extension);
        more.set({ base, items: [...(prior?.items ?? []), ...page.items], hasMore: page.hasMore });
      })
      .catch((cause: unknown) => {
        if (req.signal.aborted) return;
        if (req.settle()) moreError.set(toSvDataError(cause));
      })
      .finally(done);
  };

  const search = (term: string): void => {
    moreGuard.cancel();
    moreError.set(null);
    first.search(term);
  };

  return {
    options: rows,
    loading: first.loading,
    stale: first.stale,
    error: computed(() => moreError() ?? first.error()),
    hasMore,
    loadingMore: moreGuard.pending,
    term: first.term,
    minChars: options.minChars,
    debounceMs: options.debounceMs,
    search,
    // `emptyReason() === 'no-data'` is the never-fetched case, which `term()`
    // alone cannot tell apart from a settled empty term.
    open: (term: string) => {
      if (untracked(first.term) !== term || untracked(first.emptyReason) === 'no-data') search(term);
    },
    loadMore,
    reload: () => {
      if (untracked(moreError)) {
        loadMore();
        return;
      }
      moreGuard.cancel();
      first.reload();
    },
    cancel: () => {
      moreGuard.cancel();
      first.cancel();
    },
  };
}

function isPage<T>(answer: readonly T[] | SvSelectSourcePage<T>): answer is SvSelectSourcePage<T> {
  return !Array.isArray(answer);
}
