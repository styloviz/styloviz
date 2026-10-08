import type { SvDataError } from './types';

/** Shape of an `HttpErrorResponse` without importing `@angular/common/http`. */
interface HttpLikeError {
  readonly status?: unknown;
  readonly statusText?: unknown;
  readonly message?: unknown;
  readonly error?: unknown;
  /** `HttpHeaders`, duck-typed: only `get` is needed, and only if present. */
  readonly headers?: { readonly get?: (name: string) => string | null };
}

/**
 * Body fields APIs use for a correlation id, most specific first.
 *
 * ★ `id` is LAST and deliberately last: plenty of error bodies use it for the
 *   id of the thing that failed rather than of the request, so it is a
 *   fallback rather than a first guess.
 */
const REFERENCE_FIELDS = [
  'requestId',
  'request_id',
  'traceId',
  'trace_id',
  'correlationId',
  'correlation_id',
  'errorId',
  'error_id',
  'reference',
  'incidentId',
  'id',
] as const;

/**
 * Headers that carry one. Checked AFTER the body.
 *
 * ★★ THE BODY WINS OVER THE HEADER when both exist, because the body's id was
 *    chosen by the code that knows about the error while the header's is
 *    usually stamped by a proxy for every request alike — and a per-request
 *    id from the edge is the less useful of the two when support goes looking.
 */
const REFERENCE_HEADERS = [
  'x-request-id',
  'x-correlation-id',
  'x-trace-id',
  'x-amzn-requestid',
  'traceparent',
] as const;

/** Pull a correlation id out of an error body, if it has one. */
function referenceFromBody(body: unknown): string | undefined {
  if (!isObject(body)) return undefined;
  for (const field of REFERENCE_FIELDS) {
    const v = body[field];
    if (typeof v === 'string' && v.trim()) return v.trim();
    // ★ A numeric id is still an id. Servers send both, and rejecting a number
    //   means dropping the reference for the ones that send it that way.
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

/** …or out of its response headers. */
function referenceFromHeaders(e: HttpLikeError): string | undefined {
  const get = e.headers?.get;
  if (typeof get !== 'function') return undefined;
  for (const name of REFERENCE_HEADERS) {
    let value: string | null = null;
    try {
      // ★ Guarded: `headers` is whatever the host's HTTP layer put there, and
      //   an error page is the worst place to throw a second error.
      value = get.call(e.headers, name);
    } catch { value = null; }
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/** Statuses where retrying the same request can plausibly succeed. */
const RETRYABLE = new Set([0, 408, 425, 429, 500, 502, 503, 504]);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

/**
 * Pull the most useful human-readable string out of a server error body.
 * APIs disagree on the field name, so try the common ones in order of how
 * specific they usually are.
 */
function messageFromBody(body: unknown): string {
  if (typeof body === 'string') return displayable(body);
  if (!isObject(body)) return '';
  for (const field of ['message', 'error', 'detail', 'title'] as const) {
    const v = body[field];
    if (typeof v === 'string') {
      const text = displayable(v);
      if (text) return text;
    }
  }
  return '';
}

/** Longest server string shown verbatim; anything longer is a dump, not a sentence. */
const MAX_DISPLAY_LENGTH = 300;

/**
 * `SvDataError.message` is documented as SAFE TO DISPLAY (`OF-16-I6`), so a
 * string that is plainly not a sentence meant for a user is refused and the
 * caller falls through to the next candidate. Refused: markup (a proxy's HTML
 * 502 page), stack traces, and anything past `MAX_DISPLAY_LENGTH`.
 */
function displayable(raw: string): string {
  const text = raw.trim();
  if (!text || text.length > MAX_DISPLAY_LENGTH) return '';
  if (/^<|<\/?[a-z][\s\S]*>/i.test(text)) return '';
  if (/\n\s*at\s+\S|^\w*(Error|Exception):.*\n/.test(text)) return '';
  return text;
}

/**
 * Angular's own `HttpErrorResponse.message` — `Http failure response for
 * https://internal-host/api/orders: 500 …` — names the request URL, which is
 * an internal hostname leak on screen (`OF-16-I6`). It is never shown.
 */
const FRAMEWORK_HTTP_MESSAGE = /^Http failure (response|during parsing) for /i;

/**
 * `statusText` values Angular invents rather than receives. HTTP/2 and `fetch`
 * carry no reason phrase, so Angular fills in `'OK'` — which, once the
 * framework message above is skipped, would put "OK" on an error screen. A
 * network failure and a timeout get `'Unknown Error'` / `'Request timeout'`.
 * None says more than the caller's `fallbackMessage`, so all three fall through to it.
 */
const ANGULAR_PLACEHOLDER_STATUS = new Set(['OK', 'Unknown Error', 'Request timeout']);

/**
 * Normalize anything thrown into a renderable `SvDataError`.
 *
 * Handles `HttpErrorResponse`, `Error`, a plain string, and an already-normalized
 * `SvDataError` (returned unchanged). Anything unrecognized becomes a generic
 * message rather than `[object Object]` on screen.
 *
 * `retryable` is inferred from the status: a 404 or a 403 will fail identically
 * on retry, so offering "Try again" for them is a lie. Pass `fallbackMessage`
 * when the calling context can say something better than "Something went wrong".
 *
 * ```ts
 * this.http.get<Page>(url).subscribe({
 *   error: (e) => this.error.set(toSvDataError(e, 'Could not load orders.')),
 * });
 * ```
 */
export function toSvDataError(cause: unknown, fallbackMessage = 'Something went wrong.'): SvDataError {
  if (isSvDataError(cause)) return cause;

  if (typeof cause === 'string') {
    return { message: displayable(cause) || fallbackMessage, retryable: true, cause };
  }

  if (isObject(cause)) {
    const e = cause as HttpLikeError;
    const status = typeof e.status === 'number' ? e.status : undefined;

    // Prefer the server's own words, then the framework's, then the caller's.
    const message =
      messageFromBody(e.error) ||
      (typeof e.message === 'string' && !FRAMEWORK_HTTP_MESSAGE.test(e.message.trim())
        ? displayable(e.message)
        : '') ||
      (typeof e.statusText === 'string' && !ANGULAR_PLACEHOLDER_STATUS.has(e.statusText.trim())
        ? displayable(e.statusText)
        : '') ||
      fallbackMessage;

    return {
      message,
      status,
      retryable: status === undefined ? true : RETRYABLE.has(status),
      reference: referenceFromBody(e.error) ?? referenceFromHeaders(e),
      cause,
    };
  }

  return { message: fallbackMessage, retryable: true, cause };
}

/**
 * Type guard for an already-normalized error.
 *
 * Two things have to hold, and both are load-bearing.
 *
 * It must be a *plain* object: `new Error('x')` and `HttpErrorResponse` both
 * have a string `message`, so a duck-type check alone lets them through
 * un-normalized, arriving with no `retryable` flag.
 *
 * And it must carry a boolean `retryable`. That flag *is* the normalization —
 * it is the one field `toSvDataError` derives rather than copies. Without this
 * check, a server's own JSON error body (`{ message: 'Not found', status: 404 }`
 * is a completely ordinary shape) passes the guard, is returned untouched, and
 * reaches the UI with `retryable` undefined — which {@link isRetryable} then
 * reads as *true*. The result is a "Try again" button on a 404, which will fail
 * identically every time the user presses it.
 */
export function isSvDataError(value: unknown): value is SvDataError {
  if (!isObject(value) || typeof value['message'] !== 'string') return false;
  if (typeof value['retryable'] !== 'boolean') return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null) && !('statusText' in value);
}

/**
 * Whether the UI should offer a retry. Defaults to `true` for errors that did
 * not say — an extra button is a smaller failure than a dead end.
 */
export function isRetryable(error: SvDataError | null | undefined): boolean {
  return error ? error.retryable !== false : false;
}
