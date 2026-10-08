import { inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { toSvDataError, type SvDataQuery } from '@styloviz/core';
import { offsetLimitQuery } from './query-presets';
import { defaultResponseMapper } from './fetch-source';
import type { SvDataSource, SvQueryMapper, SvResponseMapper } from './types';

export interface SvHttpSourceOptions<T> {
  /** Endpoint. */
  readonly url: string | ((query: SvDataQuery) => string);
  /** How the query becomes params. @default offsetLimitQuery() */
  readonly mapQuery?: SvQueryMapper;
  /** How the response body becomes a page. @default defaultResponseMapper */
  readonly mapResponse?: SvResponseMapper<T>;
  /** Supply the client explicitly when you are outside an injection context. */
  readonly http?: HttpClient;
}

/**
 * A data source backed by the app's own `HttpClient`.
 *
 * The reason to prefer this over `createFetchDataSource` is interceptors: auth
 * headers, tracing, CSRF and error reporting are already wired into
 * `HttpClient` in most Angular apps, and a source that bypassed it would
 * quietly opt out of all of them.
 *
 * Call it inside an injection context (a field initializer, a factory) so the
 * client resolves itself, or pass `http` explicitly.
 *
 * ```ts
 * readonly orders = svDataController(
 *   createHttpDataSource<Order>({ url: '/api/orders', mapQuery: pageNumberQuery() }),
 * );
 * ```
 *
 * The `AbortSignal` is bridged to an rxjs unsubscribe, so a superseded query
 * genuinely cancels the request rather than leaving it running with its result
 * discarded.
 */
export function createHttpDataSource<T>(options: SvHttpSourceOptions<T>): SvDataSource<T> {
  const { url, mapQuery = offsetLimitQuery(), mapResponse = defaultResponseMapper<T>, http } = options;
  const client = http ?? inject(HttpClient);

  return (query, signal) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }

      const target = typeof url === 'function' ? url(query) : url;
      let params = new HttpParams();
      for (const [key, value] of Object.entries(mapQuery(query))) params = params.set(key, value);

      const sub = client.get(target, { params }).subscribe({
        next: (body) => {
          try {
            resolve(mapResponse(body, query));
          } catch (cause) {
            reject(toSvDataError(cause, 'Could not read the response.'));
          }
        },
        // An abort is the caller superseding this request; the listener below
        // has already rejected, and rejecting twice is a no-op.
        error: (cause: unknown) => reject(signal.aborted ? signal.reason : toSvDataError(cause)),
      });

      signal.addEventListener(
        'abort',
        () => {
          sub.unsubscribe();
          reject(signal.reason);
        },
        { once: true },
      );
    });
}
