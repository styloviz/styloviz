import { createQuery } from '@styloviz/core';
import { createFetchDataSource, defaultResponseMapper } from './fetch-source';

const signal_ = () => new AbortController().signal;

/** Swap `fetch` for the duration of one test. */
function withFetch<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => { globalThis.fetch = original; });
}

const ok = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as Response;

const fail = (status: number, body: unknown = null): Response =>
  ({ ok: false, status, statusText: 'Err', json: async () => body }) as Response;

describe('defaultResponseMapper', () => {
  it('accepts a bare array', () => {
    expect(defaultResponseMapper([1, 2])).toEqual({ items: [1, 2], total: 2, cursor: null });
  });

  it('finds the rows under whichever key the API chose', () => {
    for (const key of ['items', 'data', 'results', 'records', 'rows']) {
      expect(defaultResponseMapper({ [key]: ['a'] }).items).toEqual(['a']);
    }
  });

  it('reads the count from meta as well as the top level', () => {
    expect(defaultResponseMapper({ data: [], meta: { total: 91 } }).total).toBe(91);
    expect(defaultResponseMapper({ data: [], totalCount: 7 }).total).toBe(7);
  });

  it('reports an absent count as null, not zero', () => {
    // null and 0 mean different things: "the server did not say" versus
    // "there are none". A component that conflates them renders "0 results"
    // over a full page of rows.
    expect(defaultResponseMapper({ data: ['a'] }).total).toBeNull();
  });

  it('reads the cursor under any of the usual names', () => {
    expect(defaultResponseMapper({ data: [], nextCursor: 'n' }).cursor).toBe('n');
    expect(defaultResponseMapper({ data: [], next: '' }).cursor).toBeNull();
  });
});

describe('createFetchDataSource', () => {
  it('builds the URL from the query preset', async () => {
    let seen = '';
    await withFetch(async (input) => { seen = String(input); return ok([]); }, async () => {
      const src = createFetchDataSource({ url: '/api/orders' });
      await src(createQuery({ page: 2, pageSize: 20 }), signal_());
    });
    expect(seen).toContain('offset=20');
    expect(seen).toContain('limit=20');
  });

  it('prefers the server’s own message over a generic one', async () => {
    // "Card declined" is actionable; "Request failed" sends the user to support.
    await withFetch(async () => fail(422, { message: 'Card declined' }), async () => {
      const src = createFetchDataSource({ url: '/api/x' });
      await expect(src(createQuery(), signal_())).rejects.toMatchObject({
        message: 'Card declined',
        status: 422,
        retryable: false,
      });
    });
  });

  it('survives a non-JSON error body', async () => {
    await withFetch(
      async () => ({ ok: false, status: 502, statusText: 'Bad Gateway', json: async () => { throw new Error('not json'); } }) as unknown as Response,
      async () => {
        const src = createFetchDataSource({ url: '/api/x' });
        await expect(src(createQuery(), signal_())).rejects.toMatchObject({
          status: 502,
          retryable: true,
        });
      },
    );
  });

  it('marks a network failure retryable', async () => {
    await withFetch(async () => { throw new TypeError('Failed to fetch'); }, async () => {
      const src = createFetchDataSource({ url: '/api/x' });
      await expect(src(createQuery(), signal_())).rejects.toMatchObject({ retryable: true });
    });
  });

  it('passes an abort through untouched rather than dressing it as a failure', async () => {
    // An abort is the caller superseding this request. Turning it into an
    // SvDataError would paint an error card over a perfectly healthy screen.
    const ac = new AbortController();
    ac.abort(new DOMException('superseded', 'AbortError'));
    await withFetch(async () => { throw new DOMException('aborted', 'AbortError'); }, async () => {
      const src = createFetchDataSource({ url: '/api/x' });
      await expect(src(createQuery(), ac.signal)).rejects.toBeInstanceOf(DOMException);
    });
  });

  it('sends headers from a factory, so a token can be read fresh each time', async () => {
    let seen: Record<string, string> = {};
    let n = 0;
    await withFetch(async (_i, init) => { seen = init!.headers as Record<string, string>; return ok([]); }, async () => {
      const src = createFetchDataSource({ url: '/api/x', headers: () => ({ Authorization: `Bearer ${++n}` }) });
      await src(createQuery(), signal_());
      await src(createQuery(), signal_());
    });
    expect(seen['Authorization']).toBe('Bearer 2');
  });
});
