import { isRetryable, isSvDataError, toSvDataError } from './errors';

describe('toSvDataError', () => {
  it('prefers the server body message over the framework message', () => {
    const e = toSvDataError({
      status: 422,
      message: 'Http failure response for /api/orders: 422 Unprocessable',
      statusText: 'Unprocessable',
      error: { message: 'Order number already exists.' },
    });
    expect(e.message).toBe('Order number already exists.');
    expect(e.status).toBe(422);
  });

  it('accepts a string body', () => {
    expect(toSvDataError({ status: 500, error: 'Boom' }).message).toBe('Boom');
  });

  it('falls back through statusText to the caller fallback', () => {
    expect(toSvDataError({ status: 503, statusText: 'Service Unavailable' }).message).toBe(
      'Service Unavailable',
    );
    expect(toSvDataError({ status: 503 }, 'Could not load orders.').message).toBe(
      'Could not load orders.',
    );
  });

  it('normalizes an Error', () => {
    expect(toSvDataError(new Error('offline')).message).toBe('offline');
  });

  it('normalizes a bare string', () => {
    expect(toSvDataError('nope').message).toBe('nope');
  });

  it('never renders [object Object] for an unrecognized throw', () => {
    expect(toSvDataError(Symbol('x')).message).toBe('Something went wrong.');
  });

  it('passes an already-normalized error through unchanged', () => {
    const original = { message: 'kept', retryable: false };
    expect(toSvDataError(original)).toBe(original);
  });
});

describe('toSvDataError — retryability', () => {
  it('marks transient statuses retryable', () => {
    for (const status of [0, 429, 500, 503]) {
      expect(toSvDataError({ status }).retryable).toBe(true);
    }
  });

  it('marks deterministic failures non-retryable', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(toSvDataError({ status }).retryable).toBe(false);
    }
  });

  it('assumes retryable when there is no status to judge by', () => {
    expect(toSvDataError(new Error('offline')).retryable).toBe(true);
  });
});

describe('isSvDataError / isRetryable', () => {
  it('does not mistake an HttpErrorResponse for a normalized error', () => {
    expect(isSvDataError({ message: 'x', statusText: 'Not Found' })).toBe(false);
    expect(isSvDataError({ message: 'x', retryable: true })).toBe(true);
  });

  it('does not mistake a server error body for a normalized error', () => {
    // `{ message, status }` is a completely ordinary JSON error body. Passing
    // it through untouched leaves `retryable` undefined, which isRetryable
    // reads as true — a "Try again" button on a 404 that can only fail again.
    expect(isSvDataError({ message: 'Not found', status: 404 })).toBe(false);
    expect(toSvDataError({ message: 'Not found', status: 404 }).retryable).toBe(false);
  });

  it('re-normalizes rather than trusting a bare message object', () => {
    expect(isSvDataError({ message: 'Rate limited', status: 429 })).toBe(false);
    expect(toSvDataError({ message: 'Rate limited', status: 429 }).retryable).toBe(true);
  });

  it('returns an already-normalized error unchanged', () => {
    const normalized = toSvDataError({ status: 503 });
    expect(toSvDataError(normalized)).toBe(normalized);
  });

  it('treats a missing retryable flag as retryable and null as not', () => {
    expect(isRetryable({ message: 'x' })).toBe(true);
    expect(isRetryable({ message: 'x', retryable: false })).toBe(false);
    expect(isRetryable(null)).toBe(false);
  });
});

describe('toSvDataError — picking a field out of the server body', () => {
  it('walks past a blank message to the next usable field', () => {
    // Real bodies do this: a validation envelope with `message: ""` and the
    // useful text under `detail`. Stopping at the first *present* field rather
    // than the first *usable* one puts an empty alert on screen.
    const e = toSvDataError({
      status: 422,
      error: { message: '   ', error: null, detail: 'Order number already exists.' },
    });
    expect(e.message).toBe('Order number already exists.');
  });

  it('walks past a non-string message', () => {
    const e = toSvDataError({ status: 422, error: { message: { code: 9 }, title: 'Rejected' } });
    expect(e.message).toBe('Rejected');
  });

  it('falls through an entirely unusable body past the framework message (OF-16-I6)', () => {
    // Angular's message names the request URL, an internal hostname on screen.
    const e = toSvDataError({
      status: 500,
      error: { message: '', error: '', detail: '', title: '' },
      message: 'Http failure response for https://orders.internal.corp/api: 500',
      statusText: 'Internal Server Error',
    });
    expect(e.message).toBe('Internal Server Error');
    expect(
      toSvDataError(
        { status: 0, message: 'Http failure response for https://10.0.0.4/api: 0 Unknown Error' },
        'Could not load orders.',
      ).message,
    ).toBe('Could not load orders.');
  });
});

describe('toSvDataError — nothing unsafe reaches the display message (OF-16-I6)', () => {
  it('refuses an HTML error page from a proxy', () => {
    const e = toSvDataError(
      { status: 502, error: '<html><body><h1>502 Bad Gateway</h1>nginx/1.25 at lb-3.internal</body></html>' },
      'Could not load orders.',
    );
    expect(e.message).toBe('Could not load orders.');
    expect(e.retryable).toBe(true);
  });

  it('refuses a stack trace in the body or in an Error', () => {
    const trace = 'TypeError: x is undefined\n    at OrderService.load (/srv/app/orders.js:42:7)';
    expect(toSvDataError({ status: 500, error: trace }, 'Failed.').message).toBe('Failed.');
    expect(toSvDataError({ status: 500, error: { detail: trace } }, 'Failed.').message).toBe('Failed.');
    const err = new Error('boom');
    err.message = trace;
    expect(toSvDataError(err, 'Failed.').message).toBe('Failed.');
  });

  it('★ never shows the statusText Angular invents (HTTP/2 "OK", network, timeout)', () => {
    const angular = (status: number, statusText: string) => ({
      status,
      statusText,
      message: `Http failure response for https://api.internal/orders: ${status} ${statusText}`,
      error: null,
    });
    expect(toSvDataError(angular(500, 'OK'), 'Could not load orders.').message).toBe('Could not load orders.');
    expect(toSvDataError(angular(0, 'Unknown Error'), 'Could not load orders.').message).toBe(
      'Could not load orders.',
    );
    expect(toSvDataError(angular(0, 'Request timeout'), 'Could not load orders.').message).toBe(
      'Could not load orders.',
    );
  });

  it('refuses a thrown HTML string', () => {
    expect(toSvDataError('<html><body>502 Bad Gateway</body></html>', 'Failed.').message).toBe('Failed.');
  });

  it('refuses a dump longer than a sentence', () => {
    expect(toSvDataError({ status: 500, error: 'x'.repeat(301) }, 'Failed.').message).toBe('Failed.');
  });

  it('keeps an ordinary server sentence and the original cause', () => {
    const cause = { status: 409, error: { message: 'Order number already exists.' } };
    const e = toSvDataError(cause);
    expect(e.message).toBe('Order number already exists.');
    expect(e.cause).toBe(cause);
  });
});

describe('toSvDataError — string causes', () => {
  it('trims a padded string', () => {
    expect(toSvDataError('  Offline  ').message).toBe('Offline');
  });

  it('uses the fallback for a string that is only whitespace', () => {
    // A blank alert box is indistinguishable from a broken component. The
    // string is truthy, so only the post-trim check can catch it.
    expect(toSvDataError('   \n\t ', 'Could not load orders.').message).toBe(
      'Could not load orders.',
    );
  });

  it('uses the fallback for an empty string', () => {
    expect(toSvDataError('', 'Could not load orders.').message).toBe('Could not load orders.');
  });

  it('marks a bare string retryable and keeps the original as the cause', () => {
    const e = toSvDataError('Offline');
    expect(e.retryable).toBe(true);
    expect(e.cause).toBe('Offline');
  });
});

describe('isSvDataError — what is NOT already normalized', () => {
  it('rejects an HttpErrorResponse-shaped object that happens to carry both fields', () => {
    // This is the case the guard exists for. An HttpErrorResponse has a
    // `message` string, and a caller can easily have a `retryable` on it too;
    // waving it through means `status` is never read and a 404 gets a "Try
    // again" button that can only fail again. `statusText` is the tell.
    const httpish = { message: 'Http failure response: 404', retryable: true, statusText: 'Not Found', status: 404 };
    expect(isSvDataError(httpish)).toBe(false);
    // …and normalising it must therefore look at the status.
    expect(toSvDataError(httpish).retryable).toBe(false);
  });

  it('accepts the same object once statusText is gone', () => {
    const plain = { message: 'Http failure response: 404', retryable: true };
    expect(isSvDataError(plain)).toBe(true);
  });

  it('rejects a class instance, whose prototype is not Object.prototype', () => {
    class Boom {
      readonly message = 'boom';
      readonly retryable = true;
    }
    expect(isSvDataError(new Boom())).toBe(false);
  });

  it('accepts a null-prototype object', () => {
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, {
      message: 'x',
      retryable: false,
    });
    expect(isSvDataError(bare)).toBe(true);
  });

  it('rejects an object with a non-boolean retryable', () => {
    expect(isSvDataError({ message: 'x', retryable: 'yes' })).toBe(false);
  });
});

/**
 * `OF-16-M2` — the correlation id.
 *
 * ★★★ THIS IS THE FIELD THAT TURNS AN UNSUPPORTABLE TICKET INTO A LOG QUERY.
 *     "It said something went wrong" is unanswerable; the same sentence with a
 *     reference is one lookup. Servers already send it — in a header or the
 *     error body — and it was simply being thrown away here.
 */
describe('toSvDataError — the reference', () => {
  const httpish = (over: Record<string, unknown> = {}) => ({
    status: 500,
    statusText: 'Server Error',
    ...over,
  });

  it.each([
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
  ])('reads %s from the error body', (field) => {
    const err = toSvDataError(httpish({ error: { message: 'boom', [field]: 'ref-1' } }));
    expect(err.reference).toBe('ref-1');
  });

  it('★ reads a numeric id, because servers send both', () => {
    const err = toSvDataError(httpish({ error: { message: 'boom', requestId: 12345 } }));
    expect(err.reference).toBe('12345');
  });

  it('ignores a non-finite number rather than reporting "NaN"', () => {
    const err = toSvDataError(httpish({ error: { message: 'boom', requestId: Number.NaN } }));
    expect(err.reference).toBeUndefined();
  });

  it('trims whitespace, and treats a blank as absent', () => {
    expect(toSvDataError(httpish({ error: { requestId: '  ref-2  ' } })).reference).toBe('ref-2');
    expect(toSvDataError(httpish({ error: { requestId: '   ' } })).reference).toBeUndefined();
  });

  it('★ takes `id` only as a last resort', () => {
    // Plenty of error bodies use `id` for the id of the THING that failed
    // rather than of the request.
    const both = toSvDataError(httpish({ error: { id: 'invoice-9', traceId: 'trace-1' } }));
    expect(both.reference).toBe('trace-1');

    const only = toSvDataError(httpish({ error: { id: 'invoice-9' } }));
    expect(only.reference).toBe('invoice-9');
  });

  it.each([
    'x-request-id',
    'x-correlation-id',
    'x-trace-id',
    'x-amzn-requestid',
    'traceparent',
  ])('reads %s from the response headers', (name) => {
    const headers = { get: (n: string) => (n === name ? 'hdr-1' : null) };
    expect(toSvDataError(httpish({ headers })).reference).toBe('hdr-1');
  });

  it('★ prefers the body over the header when both exist', () => {
    // The body's id was chosen by the code that knows about the error; the
    // header's is usually stamped by a proxy for every request alike.
    const headers = { get: () => 'hdr-1' };
    const err = toSvDataError(httpish({ error: { traceId: 'body-1' }, headers }));
    expect(err.reference).toBe('body-1');
  });

  it('★ survives a headers object that throws', () => {
    // `headers` is whatever the host's HTTP layer put there, and an error page
    // is the worst possible place to throw a second error.
    const headers = { get: () => { throw new Error('nope'); } };
    expect(() => toSvDataError(httpish({ headers }))).not.toThrow();
    expect(toSvDataError(httpish({ headers })).reference).toBeUndefined();
  });

  it('survives headers with no `get` at all', () => {
    expect(toSvDataError(httpish({ headers: {} })).reference).toBeUndefined();
  });

  it('is undefined when nothing carries one', () => {
    expect(toSvDataError(httpish({ error: { message: 'boom' } })).reference).toBeUndefined();
    expect(toSvDataError('a string').reference).toBeUndefined();
    expect(toSvDataError(new Error('thrown')).reference).toBeUndefined();
  });

  it('keeps the reference on an already-normalized error', () => {
    const normalized = { message: 'boom', retryable: false, reference: 'ref-3' };
    expect(toSvDataError(normalized).reference).toBe('ref-3');
  });
});
