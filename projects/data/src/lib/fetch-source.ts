import { toSvDataError, type SvDataQuery, type SvPage } from '@styloviz/core';
import { applyQuery, offsetLimitQuery } from './query-presets';
import type { SvDataSource, SvQueryMapper, SvResponseMapper } from './types';

export interface SvFetchSourceOptions<T> {
  /** Endpoint. Any query string already on it is preserved. */
  readonly url: string | ((query: SvDataQuery) => string);
  /** How the query becomes params. @default offsetLimitQuery() */
  readonly mapQuery?: SvQueryMapper;
  /** How the response body becomes a page. @default {@link defaultResponseMapper} */
  readonly mapResponse?: SvResponseMapper<T>;
  /** Extra headers — an auth token, a tenant id. */
  readonly headers?: Record<string, string> | (() => Record<string, string>);
  /** Passed through to `fetch`, e.g. `credentials: 'include'`. */
  readonly init?: Omit<RequestInit, 'signal' | 'headers'>;
}

/**
 * Read a page out of a response body without being told its shape.
 *
 * Accepts a bare array, or an object with the rows under `items` / `data` /
 * `results` / `records` / `rows`, and the count under `total` / `totalCount` /
 * `count` / `meta.total`. These cover the shapes real APIs actually emit; pass
 * `mapResponse` for anything else rather than reshaping the server.
 *
 * `total: null` is returned when no count is present — that is a real state,
 * not zero, and components render "showing 1–20" instead of inventing a
 * page count they cannot know.
 */
export function defaultResponseMapper<T>(body: unknown): SvPage<T> {
  if (Array.isArray(body)) return { items: body as T[], total: body.length, cursor: null };

  const obj = (body ?? {}) as Record<string, unknown>;
  const items =
    (obj['items'] ?? obj['data'] ?? obj['results'] ?? obj['records'] ?? obj['rows']) as T[] | undefined;

  const meta = (obj['meta'] ?? {}) as Record<string, unknown>;
  const rawTotal = obj['total'] ?? obj['totalCount'] ?? obj['count'] ?? meta['total'];
  const total = typeof rawTotal === 'number' ? rawTotal : null;

  const rawCursor = obj['cursor'] ?? obj['nextCursor'] ?? obj['next'] ?? meta['nextCursor'];
  const cursor = typeof rawCursor === 'string' && rawCursor ? rawCursor : null;

  return { items: items ?? [], total, cursor };
}

/**
 * A data source backed by `fetch` — no rxjs, no `HttpClient`, no Angular DI.
 *
 * Use this when your app already has an auth-aware fetch wrapper, or when you
 * are wiring a component outside an injection context. Reach for
 * `createHttpDataSource` instead when you want your existing `HttpClient`
 * interceptors (auth, tracing, retries) to apply.
 */
export function createFetchDataSource<T>(options: SvFetchSourceOptions<T>): SvDataSource<T> {
  const {
    url,
    mapQuery = offsetLimitQuery(),
    mapResponse = defaultResponseMapper<T>,
    headers,
    init,
  } = options;

  return async (query, signal) => {
    const base = typeof url === 'function' ? url(query) : url;
    const target = applyQuery(base, mapQuery(query));
    const hdrs = typeof headers === 'function' ? headers() : headers;

    let response: Response;
    try {
      response = await fetch(target, {
        ...init,
        signal,
        headers: { Accept: 'application/json', ...hdrs },
      });
    } catch (cause) {
      // An abort is the caller superseding this request, not a failure to show.
      if (signal.aborted) throw cause;
      throw toSvDataError(cause);
    }

    if (!response.ok) {
      // Prefer the server's own message: "Card declined" beats "Request failed".
      let detail: unknown = null;
      try {
        detail = await response.json();
      } catch {
        /* a non-JSON error body is normal; fall back to the status text */
      }
      throw toSvDataError({
        status: response.status,
        statusText: response.statusText,
        error: detail,
      });
    }

    return mapResponse(await response.json(), query);
  };
}
