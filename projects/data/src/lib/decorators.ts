import { toSvDataError } from '@styloviz/core';
import type { SvDataSource } from './types';

/** Sleep that gives up as soon as the request is superseded. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });
}

/**
 * Delay a source's answer.
 *
 * The states a buyer most needs to see — the skeleton, the stale-while-loading
 * table, the request that gets superseded mid-flight — are the ones that never
 * appear against a local array, because it answers in under a millisecond. This
 * makes them visible without standing up a server.
 *
 * Also the honest way to demo a search box: with no latency, debounce and the
 * request guard look like dead code.
 */
export function withLatency<T>(source: SvDataSource<T>, ms: number | (() => number)): SvDataSource<T> {
  return async (query, signal) => {
    await sleep(typeof ms === 'function' ? ms() : ms, signal);
    return source(query, signal);
  };
}

export interface SvFailureOptions {
  /**
   * Whether *this* request should fail. A function is re-read per request, so
   * a demo can wire it straight to a toggle.
   */
  readonly when: boolean | (() => boolean);
  /** Status to report. `503` is retryable, `404` is not. @default 503 */
  readonly status?: number;
  /** Message the user sees. @default 'The demo server is unavailable.' */
  readonly message?: string;
}

/**
 * Make a source fail on demand.
 *
 * An error state nobody can trigger is an error state nobody has looked at. A
 * "force error" toggle in a demo is worth more than a screenshot, because it
 * also shows what happens *after*: whether the rows survive, whether the retry
 * button is offered, and whether recovery is silent.
 *
 * Choose the status deliberately — `503` earns a retry, `404` does not, and
 * seeing both is the point.
 */
export function withFailure<T>(source: SvDataSource<T>, options: SvFailureOptions): SvDataSource<T> {
  const { when, status = 503, message = 'The demo server is unavailable.' } = options;
  return async (query, signal) => {
    const failing = typeof when === 'function' ? when() : when;
    if (failing) throw toSvDataError({ status, message });
    return source(query, signal);
  };
}

/**
 * Fail intermittently, at a given rate.
 *
 * Steady failure is easy to build against; intermittent failure is what breaks
 * real dashboards, because it is where a retry policy either recovers silently
 * or thrashes. Useful for exercising backoff by hand.
 *
 * `rate` is clamped to 0–1. Pass `random` to make a demo reproducible.
 */
export function withFlakiness<T>(
  source: SvDataSource<T>,
  rate: number,
  random: () => number = Math.random,
): SvDataSource<T> {
  const p = Math.min(1, Math.max(0, rate));
  return async (query, signal) => {
    if (random() < p) throw toSvDataError({ status: 503, message: 'The connection dropped.' });
    return source(query, signal);
  };
}
