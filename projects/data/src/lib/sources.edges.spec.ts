import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { createQuery } from '@styloviz/core';
import { createArrayDataSource } from './array-source';
import { withLatency } from './decorators';
import { createFetchDataSource, defaultResponseMapper } from './fetch-source';
import { createHttpDataSource } from './http-source';
import { applyQuery } from './query-presets';

/**
 * The corners each adapter only meets against a real backend: a URL that
 * depends on the query, a response body that is null, a request that is
 * superseded before it is even sent, and a custom matcher that replaces the
 * default field-by-field comparison.
 */

const abort = () => new AbortController();

// ── array source ─────────────────────────────────────────────────────────────

interface Row {
  readonly id: string;
  readonly name: string;
  readonly team: string | null;
  readonly rank: number | null;
}

const ROWS: Row[] = [
  { id: 'a', name: 'Ada', team: 'core', rank: 2 },
  { id: 'b', name: 'Brendan', team: null, rank: null },
  { id: 'c', name: 'Grace', team: 'ops', rank: 1 },
];

describe('createArrayDataSource — sorting around nulls', () => {
  it('sorts rows with no value to the front, ascending', async () => {
    // `null` is not zero and not the empty string. Sorting it as either puts it
    // in the middle of the numbers, where it reads as a real rank.
    const source = createArrayDataSource(ROWS);
    const page = await source(
      createQuery({ sorts: [{ key: 'rank', direction: 'asc' }] }),
      abort().signal,
    );
    expect(page.items.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts them to the back, descending', async () => {
    const source = createArrayDataSource(ROWS);
    const page = await source(
      createQuery({ sorts: [{ key: 'rank', direction: 'desc' }] }),
      abort().signal,
    );
    expect(page.items.map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('treats two missing values as equal rather than ordering them arbitrarily', async () => {
    const rows: Row[] = [
      { id: 'x', name: 'X', team: null, rank: null },
      { id: 'y', name: 'Y', team: null, rank: null },
    ];
    const source = createArrayDataSource(rows);
    const page = await source(
      createQuery({ sorts: [{ key: 'rank', direction: 'asc' }] }),
      abort().signal,
    );
    expect(page.items.map((r) => r.id)).toEqual(['x', 'y']);
  });
});

describe('createArrayDataSource — filters and matchers', () => {
  it('skips a filter whose value is empty rather than matching nothing', async () => {
    // A cleared filter input sends '', and every row has to come back — not
    // zero rows, which is what a naive `includes('')` on a null field gives.
    const source = createArrayDataSource(ROWS);
    const page = await source(createQuery({ filters: { team: '' } }), abort().signal);
    expect(page.items).toHaveLength(3);
  });

  it('routes a filter through a custom matcher, telling it which field', async () => {
    const seen: (string | null)[] = [];
    const source = createArrayDataSource(ROWS, {
      matcher: (item, term, field) => {
        seen.push(field);
        return field === 'team' && (item as Row).team === term;
      },
    });
    const page = await source(createQuery({ filters: { team: 'ops' } }), abort().signal);
    expect(page.items.map((r) => r.id)).toEqual(['c']);
    expect(new Set(seen)).toEqual(new Set(['team']));
  });

  it('routes a search through the same matcher with a null field', async () => {
    // The null is how a matcher tells "search everything" from "filter one
    // column"; without it a matcher cannot implement a global search at all.
    const fields: (string | null)[] = [];
    const source = createArrayDataSource(ROWS, {
      matcher: (item, term, field) => {
        fields.push(field);
        return (item as Row).name.toLowerCase().includes(term.toLowerCase());
      },
    });
    const page = await source(createQuery({ search: 'gra' }), abort().signal);
    expect(page.items.map((r) => r.id)).toEqual(['c']);
    expect(fields.every((f) => f === null)).toBe(true);
  });

  it('builds a cursor from a key function for composite identities', async () => {
    const source = createArrayDataSource(ROWS, {
      itemKey: (item) => `${(item as Row).team}:${(item as Row).id}`,
      // A page size of 1 forces a cursor to be produced.
    });
    const page = await source(createQuery({ pageSize: 1 }), abort().signal);
    expect(page.cursor).toBe('core:a');
  });
});

// ── withLatency ──────────────────────────────────────────────────────────────

describe('withLatency', () => {
  it('rejects immediately when the request was already superseded', async () => {
    // The caller aborted before the delay even started. Waiting out the sleep
    // first would hold a superseded request open for its full latency.
    const ac = abort();
    ac.abort(new Error('superseded'));
    const slow = withLatency(async () => ({ items: [1], total: 1, cursor: null }), 10_000);
    await expect(slow(createQuery(), ac.signal)).rejects.toThrow('superseded');
  });

  it('still answers when nothing aborted it', async () => {
    const slow = withLatency(async () => ({ items: [1], total: 1, cursor: null }), 1);
    const page = await slow(createQuery(), abort().signal);
    expect(page.items).toEqual([1]);
  });
});

// ── response mapping ─────────────────────────────────────────────────────────

describe('defaultResponseMapper', () => {
  it('reads an empty page out of a null body rather than throwing', async () => {
    // A 204 through a JSON parser is `null`, and it reaches the mapper. An
    // empty table is the honest rendering; a TypeError is not.
    const page = defaultResponseMapper<number>(null);
    expect(page).toEqual({ items: [], total: null, cursor: null });
  });

  it('reads an empty page out of a body with no recognisable list', async () => {
    const page = defaultResponseMapper<number>({ ok: true });
    expect(page.items).toEqual([]);
    expect(page.total).toBeNull();
  });

  it('still finds the list under any of the usual names', async () => {
    expect(defaultResponseMapper<number>({ rows: [1, 2], count: 9 })).toEqual({
      items: [1, 2],
      total: 9,
      cursor: null,
    });
  });
});

// ── fetch source ─────────────────────────────────────────────────────────────

describe('createFetchDataSource — a URL derived from the query', () => {
  it('asks the url function for each request and appends the mapped params', async () => {
    const calls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    try {
      const source = createFetchDataSource<number>({
        url: (q) => `/api/teams/${q.filters['team'] ?? 'all'}/members`,
      });
      await source(createQuery({ filters: { team: 'core' } }), abort().signal);
      await source(createQuery({ filters: { team: 'ops' } }), abort().signal);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(calls[0]).toContain('/api/teams/core/members');
    expect(calls[1]).toContain('/api/teams/ops/members');
    // A static string would have produced the same URL twice.
    expect(calls[0]).not.toBe(calls[1]);
  });
});

// ── http source ──────────────────────────────────────────────────────────────

describe('createHttpDataSource', () => {
  function withHttp<R>(fn: (http: HttpClient, ctrl: HttpTestingController) => R): R {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return fn(TestBed.inject(HttpClient), TestBed.inject(HttpTestingController));
  }

  it('accepts an explicit HttpClient, so it works outside an injection context', async () => {
    await withHttp(async (http, ctrl) => {
      const source = createHttpDataSource<number>({ url: '/api/rows', http });
      const promise = source(createQuery(), abort().signal);
      ctrl.expectOne((r) => r.url === '/api/rows').flush({ items: [1, 2], total: 2 });
      await expect(promise).resolves.toEqual({ items: [1, 2], total: 2, cursor: null });
      ctrl.verify();
    });
  });

  it('asks the url function for each request', async () => {
    await withHttp(async (http, ctrl) => {
      const source = createHttpDataSource<number>({
        url: (q) => `/api/page/${q.page}`,
        http,
      });
      const promise = source(createQuery({ page: 3 }), abort().signal);
      ctrl.expectOne((r) => r.url === '/api/page/3').flush({ items: [], total: 0 });
      await promise;
      ctrl.verify();
    });
  });

  it('takes HttpClient from DI when none is passed, so interceptors apply', async () => {
    // The common case in an app: `createHttpDataSource({ url })` in a field
    // initializer. Injecting is what puts the app's auth and tracing
    // interceptors on the request.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const source = TestBed.runInInjectionContext(() =>
      createHttpDataSource<number>({ url: '/api/rows' }),
    );
    const ctrl = TestBed.inject(HttpTestingController);
    const promise = source(createQuery(), abort().signal);
    ctrl.expectOne((r) => r.url === '/api/rows').flush({ items: [7], total: 1 });
    await expect(promise).resolves.toEqual({ items: [7], total: 1, cursor: null });
    ctrl.verify();
  });

  it('rejects without issuing a request when the signal is already aborted', async () => {
    await withHttp(async (http, ctrl) => {
      const ac = abort();
      ac.abort(new Error('superseded'));
      const source = createHttpDataSource<number>({ url: '/api/rows', http });
      await expect(source(createQuery(), ac.signal)).rejects.toThrow('superseded');
      // Assert the negative: nothing may have gone out.
      ctrl.expectNone(() => true);
    });
  });
});

// ── applyQuery ───────────────────────────────────────────────────────────────

describe('applyQuery', () => {
  it('leaves a URL untouched when there is nothing to append', async () => {
    // No trailing '?', which some routers treat as a different path and some
    // caches treat as a different key.
    expect(applyQuery('/api/rows', {})).toBe('/api/rows');
  });

  it('keeps params already on the URL and adds the mapped ones', async () => {
    const out = applyQuery('/api/rows?tenant=42', { page: '2' });
    expect(out.startsWith('/api/rows?')).toBe(true);
    expect(out).toContain('tenant=42');
    expect(out).toContain('page=2');
  });

  it('lets a mapped param replace one already on the URL', async () => {
    expect(applyQuery('/api/rows?page=1', { page: '9' })).toBe('/api/rows?page=9');
  });
});
