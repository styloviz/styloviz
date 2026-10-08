import type { SvDataError, SvDataQuery, SvPage } from '@styloviz/core';

/**
 * A function that turns a query into one page of results.
 *
 * Promise + `AbortSignal` rather than `Observable`, to match every other
 * transport contract in the kit (`SvUploader`, `cascader`'s `loadData`, the
 * request-guard). It also means `@styloviz/data` has no hard rxjs or
 * `HttpClient` dependency: `createHttpDataSource` bridges to `HttpClient` for
 * hosts that want it, and pays for rxjs only when they import it.
 *
 * The `signal` aborts as soon as a newer query supersedes this one. Honour it —
 * an in-flight request the user has already navigated past is wasted server
 * work, and on a slow connection it is what makes a filter feel laggy.
 */
export type SvDataSource<T> = (
  query: SvDataQuery,
  signal: AbortSignal,
) => Promise<SvPage<T>>;

/**
 * Translates the kit's `SvDataQuery` into whatever your backend accepts.
 *
 * Three presets ship in `query-presets.ts` — offset/limit, page/perPage and
 * cursor — which between them cover the overwhelming majority of REST APIs.
 * Write your own when yours is unusual; it is a pure function of the query.
 */
export type SvQueryMapper = (query: SvDataQuery) => Record<string, string>;

/** Turns your endpoint's JSON into a page the kit understands. */
export type SvResponseMapper<T> = (body: unknown, query: SvDataQuery) => SvPage<T>;

/** Tuning for {@link svDataController}. */
export interface SvDataControllerOptions {
  /**
   * Wait this long after the last change before fetching.
   *
   * 300ms matches `search-bar` and every Phase 2 picker. Set `0` to fetch on
   * every change — correct for a page or sort click, wasteful for typing.
   * @default 300
   */
  readonly debounceMs?: number;

  /**
   * Fetch once on creation. Turn this off when the first query depends on
   * something not yet known — a route param, a tenant id.
   * @default true
   */
  readonly immediate?: boolean;

  /**
   * How many times to re-attempt a **retryable** failure before surfacing it.
   *
   * Only retryable errors qualify (`isRetryable` from `@styloviz/core`: network
   * failures, 429, 5xx). Retrying a 404 or a 422 just delays telling the user
   * something they need to fix, and retrying a non-idempotent call is worse
   * than that.
   * @default 2
   */
  readonly retries?: number;

  /**
   * First backoff delay in ms; each further attempt doubles it and adds up to
   * 25% jitter, so a fleet of dashboards recovering from one outage does not
   * arrive back in lockstep.
   * @default 400
   */
  readonly retryDelayMs?: number;

  /**
   * Keep the previous page visible while the next one loads, instead of
   * blanking to a skeleton.
   *
   * On by default: a table that empties on every keystroke is the most jarring
   * thing a search box can do, and the rows underneath are still true until
   * the answer changes.
   * @default true
   */
  readonly keepPreviousData?: boolean;
}

/** What a source failed with, plus which query it was answering. */
export interface SvDataFailure {
  readonly error: SvDataError;
  readonly query: SvDataQuery;
  /** Attempts already made, including the one that failed. */
  readonly attempts: number;
}
