import {
  DestroyRef,
  PendingTasks,
  computed,
  inject,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import {
  createQuery,
  createRequestGuard,
  isRetryable,
  patchQuery,
  queriesEqual,
  toSvDataError,
  toggleSort,
  type SvDataError,
  type SvDataQuery,
  type SvSortDirection,
} from '@styloviz/core';
import type { SvDataControllerOptions, SvDataSource } from './types';

/**
 * The headless engine behind a wired component: one query in, one page out,
 * with the four things every hand-rolled version of this forgets.
 *
 * @see svDataController
 */
export interface SvDataController<T> {
  // ── Bind these to the component ──────────────────────────────────────────
  /** The current page's rows. Keeps the previous page during a reload. */
  readonly items: Signal<readonly T[]>;
  /** True while a request is in flight. */
  readonly loading: Signal<boolean>;
  /**
   * True while a request is in flight **and** an earlier one has already been
   * applied — the rows on screen answer an older query.
   *
   * With `keepPreviousData` on (the default) this is the state the table is in
   * for most of its life: rows present, but provisional. Bind it to a dimmed
   * body or an `aria-busy` region rather than swapping in a skeleton, and read
   * `error` before it so a retry after a failure shows the failure.
   */
  readonly stale: Signal<boolean>;
  /** The last failure, or `null`. Already normalized for `<sv-error-shell>`. */
  readonly error: Signal<SvDataError | null>;
  /** Total matching records, or `null` when the server does not say. */
  readonly total: Signal<number | null>;
  /** Cursor for the next page, or `null` on the last one. */
  readonly cursor: Signal<string | null>;
  /** The query currently being shown (not the one being typed). */
  readonly query: Signal<SvDataQuery>;
  /**
   * True when the result set is empty *because of* a filter or search, rather
   * than because there is nothing at all. Pick the empty state's `reason` from
   * it — `filtered() ? 'no-results' : 'no-data'` — so the panel offers "Clear
   * filters" instead of telling a customer with 4,000 orders that they have
   * none.
   */
  readonly filtered: Signal<boolean>;
  /** True when there is another page to fetch. */
  readonly hasMore: Signal<boolean>;

  // ── Call these from the component's outputs ──────────────────────────────
  /** Replace the query wholesale — wire to `(queryChange)`. */
  setQuery(query: SvDataQuery): void;
  /** Change part of the query; `patchQuery` handles the page reset for you. */
  patch(patch: Partial<SvDataQuery>): void;
  /** Set the search term. */
  search(term: string): void;
  /** Go to a 1-based page. */
  goToPage(page: number): void;
  /** Cycle a column: unsorted → asc → desc → unsorted. */
  sortBy(key: string, multi?: boolean): void;
  /** Set a single filter. `''` removes it. */
  filter(field: string, value: string): void;
  /** Clear every filter and the search term, and return to page 1. */
  clearFilters(): void;
  /** Re-run the current query immediately — wire to `(retry)`. */
  reload(): void;
  /** Abandon anything in flight. Called automatically on destroy. */
  cancel(): void;
}

const jitter = (ms: number): number => ms * (0.75 + Math.random() * 0.5);

/**
 * Wire a Styloviz collection component to an endpoint in five lines.
 *
 * ```ts
 * readonly orders = svDataController(
 *   createHttpDataSource<Order>({ url: '/api/orders' }),
 * );
 * ```
 * ```html
 * <sv-data-table
 *   [serverSide]="true"
 *   [rows]="orders.items()"       [loading]="orders.loading()"
 *   [error]="orders.error()"      [totalCount]="orders.total()"
 *   (queryChange)="orders.setQuery($event)" (retry)="orders.reload()" />
 * ```
 *
 * What it does that a hand-rolled `subscribe` does not:
 *
 * - **Debounces** query changes, so typing five characters is one request.
 * - **Guards** responses, so a slow answer to an abandoned query cannot
 *   overwrite a newer one — the bug that makes a search box show results for
 *   what the user typed two keystrokes ago, and that looks correct in review.
 * - **Aborts** the superseded request rather than just ignoring it.
 * - **Retries only retryable failures** with jittered backoff. Retrying a 404
 *   delays telling the user something they need to act on.
 *
 * Nothing in the kit depends on this: components stay headless and this is
 * sugar. It needs an injection context for `DestroyRef` (a field initializer is
 * one); pass `destroyRef` if you are calling it from somewhere else.
 */
export function svDataController<T>(
  source: SvDataSource<T>,
  options: SvDataControllerOptions & {
    initialQuery?: Partial<SvDataQuery>;
    destroyRef?: DestroyRef;
    pendingTasks?: PendingTasks;
  } = {},
): SvDataController<T> {
  const {
    debounceMs = 300,
    immediate = true,
    retries = 2,
    retryDelayMs = 400,
    keepPreviousData = true,
    initialQuery,
    destroyRef = inject(DestroyRef),
    pendingTasks = inject(PendingTasks),
  } = options;

  const query = signal<SvDataQuery>(createQuery(initialQuery));
  const items = signal<readonly T[]>([]);
  const error = signal<SvDataError | null>(null);
  const total = signal<number | null>(null);
  const cursor = signal<string | null>(null);
  /** The query the visible rows actually answer — not the one being typed. */
  const applied = signal<SvDataQuery | null>(null);

  const guard = createRequestGuard();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const fetchOnce = async (target: SvDataQuery): Promise<void> => {
    // `start()` supersedes and aborts the previous request in one step — the
    // guard owns the AbortController so the token and the signal cannot drift
    // apart, which is the failure mode of keeping them side by side.
    const req = guard.start();

    for (let attempt = 1; ; attempt++) {
      try {
        const page = await source(target, req.signal);
        if (!req.settle()) return;
        items.set(page.items);
        total.set(page.total);
        cursor.set(page.cursor);
        applied.set(target);
        error.set(null);
        return;
      } catch (cause) {
        if (req.signal.aborted || destroyed) return;

        const normalized = toSvDataError(cause);
        const canRetry = attempt <= retries && isRetryable(normalized);
        if (!canRetry) {
          if (!req.settle()) return;
          error.set(normalized);
          // The rows stay: they answered the last query that *worked*, and
          // blanking the table on a transient 503 destroys context the user
          // still needs to read the error against.
          if (!keepPreviousData) items.set([]);
          return;
        }

        const delay = jitter(retryDelayMs * 2 ** (attempt - 1));
        const slept = await new Promise<boolean>((resolve) => {
          const t = setTimeout(() => resolve(true), delay);
          req.signal.addEventListener('abort', () => { clearTimeout(t); resolve(false); }, { once: true });
        });
        if (!slept) return;
      }
    }
  };

  /**
   * ★★ A fetch in flight blocks application stability.
   *
   * Without this the app is "stable" while the first page is still on the wire,
   * which is invisible in the browser and wrong everywhere else: server-side
   * rendering serialises the skeleton instead of the rows, and
   * `whenStable()`-based tests resolve before the data lands. Registering the
   * request is what makes "the app has settled" mean "the rows are here".
   */
  const run = async (target: SvDataQuery): Promise<void> => {
    const done = pendingTasks.add();
    try {
      await fetchOnce(target);
    } finally {
      done();
    }
  };

  const schedule = (target: SvDataQuery, delay: number): void => {
    clearTimer();
    if (delay <= 0) {
      void run(target);
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      void run(target);
    }, delay);
  };

  const push = (next: SvDataQuery, delay = debounceMs): void => {
    if (queriesEqual(next, untracked(query))) return;
    query.set(next);
    if (!keepPreviousData) items.set([]);
    schedule(next, delay);
  };

  destroyRef.onDestroy(() => {
    destroyed = true;
    clearTimer();
    guard.cancel();
  });

  if (immediate) schedule(untracked(query), 0);

  const isNarrowed = (q: SvDataQuery): boolean =>
    q.search !== '' || Object.values(q.filters).some((v) => v !== '');

  return {
    items: items.asReadonly(),
    loading: guard.pending,
    stale: guard.stale,
    error: error.asReadonly(),
    total: total.asReadonly(),
    cursor: cursor.asReadonly(),
    query: query.asReadonly(),

    // Reads `applied`, not `query`: while a new search is still in flight the
    // rows on screen answer the *old* query, and labelling them "no results for
    // this filter" before the answer lands is a lie either way it resolves.
    filtered: computed(() => {
      const a = applied();
      return items().length === 0 && a !== null && isNarrowed(a);
    }),

    hasMore: computed(() => {
      if (cursor() !== null) return true;
      const t = total();
      const q = query();
      return t !== null && q.page * q.pageSize < t;
    }),

    setQuery: (next) => push(next),
    patch: (p) => push(patchQuery(untracked(query), p)),
    search: (term) => push(patchQuery(untracked(query), { search: term })),
    // A page click is a deliberate act, not a stream of keystrokes — waiting
    // 300ms after it just feels broken.
    goToPage: (page) => push(patchQuery(untracked(query), { page }), 0),
    sortBy: (key, multi = false) =>
      push(patchQuery(untracked(query), { sorts: toggleSort(untracked(query).sorts, key, multi) }), 0),
    filter: (field, value) =>
      push(patchQuery(untracked(query), { filters: { ...untracked(query).filters, [field]: value } })),
    clearFilters: () => push(patchQuery(untracked(query), { filters: {}, search: '' }), 0),

    reload: () => {
      error.set(null);
      clearTimer();
      void run(untracked(query));
    },

    cancel: () => {
      clearTimer();
      guard.cancel();
    },
  };
}

/** Re-exported so callers do not need a second import for the common case. */
export type { SvDataQuery, SvSortDirection };
