import { TestBed } from '@angular/core/testing';
import { until } from '@testing/async';
import {
  svSelectSource,
  type SvSelectSource,
  type SvSelectSourceOptions,
  type SvSelectSourcePageRequest,
} from './select-source';

/**
 * `FI-23-M1` — the adapter layer of the select split.
 *
 * The first page IS `svSuggestController`, which has its own exhaustive spec;
 * nothing here re-tests the debounce, the guard or the stale/loading split.
 * What is new is paging, and paging has one failure that matters: a page that
 * answers an OLD term being appended under a NEW term's rows.
 */

interface Call {
  readonly term: string;
  readonly page: SvSelectSourcePageRequest;
  readonly signal: AbortSignal;
}

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const rows = (prefix: string, from: number, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}${from + i}`);

function make(options: SvSelectSourceOptions<string>): SvSelectSource<string> {
  TestBed.resetTestingModule();
  return TestBed.runInInjectionContext(() => svSelectSource<string>(options));
}

describe('svSelectSource', () => {
  it('fetches the first page with offset 0 and the page size', async () => {
    const calls: Call[] = [];
    const src = make({
      pageSize: 2,
      search: async (term, signal, page) => { calls.push({ term, page, signal }); return rows(term, 0, 2); },
    });

    src.search('a');
    await until(() => src.options().length === 2, { label: 'first page' });
    expect(calls.map((c) => [c.term, c.page])).toEqual([['a', { offset: 0, limit: 2 }]]);
    expect(src.term()).toBe('a');
  });

  it('infers hasMore from a full page, and trusts an explicit one', async () => {
    const full = make({ pageSize: 2, search: async () => ['x', 'y'] });
    full.search('');
    await until(() => full.options().length === 2, { label: 'full page' });
    expect(full.hasMore()).toBe(true);

    const short = make({ pageSize: 2, search: async () => ['x'] });
    short.search('');
    await until(() => short.options().length === 1, { label: 'short page' });
    expect(short.hasMore()).toBe(false);

    const declared = make({ pageSize: 2, search: async () => ({ items: ['x', 'y'], hasMore: false }) });
    declared.search('');
    await until(() => declared.options().length === 2, { label: 'declared page' });
    expect(declared.hasMore()).toBe(false);
  });

  it('never reports more when it is not paged', async () => {
    const src = make({ search: async () => rows('r', 0, 50) });
    src.search('');
    await until(() => src.options().length === 50, { label: 'whole answer' });
    expect(src.hasMore()).toBe(false);
  });

  it('appends the next page with the right offset, then stops', async () => {
    const calls: SvSelectSourcePageRequest[] = [];
    const src = make({
      pageSize: 2,
      search: async (_term, _signal, page) => {
        calls.push(page);
        return page.offset >= 4 ? rows('r', page.offset, 1) : rows('r', page.offset, 2);
      },
    });

    src.search('');
    await until(() => src.options().length === 2, { label: 'page one' });
    src.loadMore();
    expect(src.loadingMore()).toBe(true);
    await until(() => src.options().length === 4, { label: 'page two' });
    expect(src.loadingMore()).toBe(false);
    src.loadMore();
    await until(() => src.options().length === 5, { label: 'page three' });

    expect(src.options()).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
    expect(calls.map((c) => c.offset)).toEqual([0, 2, 4]);
    expect(src.hasMore()).toBe(false);
  });

  it('ignores a second load-more while one is in flight', async () => {
    const pending = deferred<readonly string[]>();
    let calls = 0;
    const src = make({
      pageSize: 2,
      search: (_t, _s, page) => { calls++; return page.offset === 0 ? Promise.resolve(['a', 'b']) : pending.promise; },
    });
    src.search('');
    await until(() => src.options().length === 2, { label: 'page one' });
    src.loadMore();
    src.loadMore();
    expect(calls).toBe(2);
    pending.resolve(['c', 'd']);
    await until(() => src.options().length === 4, { label: 'page two' });
  });

  /**
   * ★★★ THE ONE THAT MATTERS. Page two of "ada" lands after the user has
   *     already typed "bob" and bob's first page has arrived. Appending it would
   *     put Ada's rows under Bob's results — plausible-looking and wrong.
   */
  it('never appends an old term\'s page under a new term\'s rows', async () => {
    const adaPageTwo = deferred<readonly string[]>();
    const src = make({
      pageSize: 2,
      search: (term, _s, page) => {
        if (term === 'ada' && page.offset === 2) return adaPageTwo.promise;
        return Promise.resolve(rows(term, page.offset, 2));
      },
    });

    src.search('ada');
    await until(() => src.term() === 'ada', { label: 'ada page one' });
    src.loadMore();
    src.search('bob');
    await until(() => src.term() === 'bob', { label: 'bob page one' });
    adaPageTwo.resolve(['ada2', 'ada3']);
    await new Promise((r) => setTimeout(r, 20));

    expect(src.options()).toEqual(['bob0', 'bob1']);
    expect(src.loadingMore()).toBe(false);
  });

  it('drops the appended pages when a new term lands', async () => {
    const src = make({ pageSize: 2, search: async (term, _s, page) => rows(term, page.offset, 2) });
    src.search('a');
    await until(() => src.options().length === 2, { label: 'a one' });
    src.loadMore();
    await until(() => src.options().length === 4, { label: 'a two' });
    src.search('b');
    await until(() => src.term() === 'b', { label: 'b one' });
    expect(src.options()).toEqual(['b0', 'b1']);
  });

  it('reports a failed load-more, keeps the rows, and retries THAT on reload', async () => {
    let failNext = true;
    const offsets: number[] = [];
    const src = make({
      pageSize: 2,
      search: async (_t, _s, page) => {
        offsets.push(page.offset);
        if (page.offset === 2 && failNext) { failNext = false; throw new Error('boom'); }
        return rows('r', page.offset, 2);
      },
    });
    src.search('');
    await until(() => src.options().length === 2, { label: 'page one' });
    src.loadMore();
    await until(() => src.error() !== null, { label: 'load-more failed' });
    expect(src.options()).toEqual(['r0', 'r1']);

    src.reload();
    await until(() => src.options().length === 4, { label: 'retried page two' });
    expect(src.error()).toBeNull();
    expect(offsets).toEqual([0, 2, 2]);
  });

  it('retries the search when it was the search that failed', async () => {
    let fail = true;
    const src = make({ search: async () => { if (fail) { fail = false; throw new Error('503'); } return ['ok']; } });
    src.search('q');
    await until(() => src.error() !== null, { label: 'search failed' });
    src.reload();
    await until(() => src.options().length === 1, { label: 'retried' });
    expect(src.error()).toBeNull();
  });

  it('opens without re-fetching a term it already answers', async () => {
    let calls = 0;
    const src = make({ search: async () => { calls++; return ['x']; } });
    src.open('');
    await until(() => calls === 1 && src.options().length === 1, { label: 'first open' });
    src.open('');
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBe(1);
    src.open('x');
    await until(() => calls === 2, { label: 'different term' });
  });

  it('aborts what is in flight on cancel', async () => {
    const seen: AbortSignal[] = [];
    const src = make({ search: (_t, signal) => { seen.push(signal); return new Promise(() => undefined); } });
    src.search('q');
    await until(() => seen.length === 1, { label: 'request started' });
    src.cancel();
    expect(seen[0].aborted).toBe(true);
    expect(src.loading()).toBe(false);
  });

  it('carries minChars and debounceMs through for the select to apply', () => {
    const src = make({ search: async () => [], minChars: 2, debounceMs: 120 });
    expect(src.minChars).toBe(2);
    expect(src.debounceMs).toBe(120);
    const bare = make({ search: async () => [] });
    expect(bare.minChars).toBeUndefined();
    expect(bare.debounceMs).toBeUndefined();
  });
});
