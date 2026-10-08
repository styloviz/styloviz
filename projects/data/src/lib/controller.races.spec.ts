import { TestBed } from '@angular/core/testing';
import { createQuery, type SvPage } from '@styloviz/core';
import { quietFor, until } from '@testing/async';
import { svDataController, type SvDataController } from './controller';
import type { SvDataSource } from './types';

/**
 * What the controller does when a request loses its race — because it was
 * aborted, because the component was destroyed under it, or because a newer
 * query settled first — and what `keepPreviousData: false` changes.
 *
 * These are the paths that only exist under real latency, so every source here
 * is deliberately slow and every wait polls the state the controller sets. See
 * the header of `@testing/async` for why there are no fixed waits in the test
 * bodies.
 */

const page = <T,>(items: T[], total = items.length): SvPage<T> => ({ items, total, cursor: null });

function make<T>(source: SvDataSource<T>, options: Parameters<typeof svDataController>[1] = {}) {
  TestBed.resetTestingModule();
  return TestBed.runInInjectionContext(() =>
    svDataController<T>(source, { debounceMs: 0, retryDelayMs: 1, ...options }),
  ) as SvDataController<T>;
}

/** Latency inside the fake source — the thing being simulated, not a guess. */
const latency = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('svDataController — a request that loses its race', () => {
  it('does not surface an error from a request that was aborted', async () => {
    // A `fetch` rejects with an AbortError when its signal fires. Reporting
    // that to the user would put "The operation was aborted" on screen every
    // time they typed a sixth character.
    let calls = 0;
    const c = make<string>(async (q, signal) => {
      calls++;
      await latency(15);
      if (signal.aborted) throw signal.reason;
      return page([q.search || 'first']);
    });

    await until(() => calls === 1, { label: 'the first request to start' });
    c.search('second'); // aborts the first
    await until(() => c.items().length > 0 && !c.loading(), { label: 'the second answer' });
    await quietFor();

    expect(c.items()).toEqual(['second']);
    expect(c.error()).toBeNull();
  });

  it('reports nothing at all once the host has been destroyed', async () => {
    let settled: string[] = [];
    TestBed.resetTestingModule();
    const c = TestBed.runInInjectionContext(() =>
      svDataController<string>(
        async () => {
          await latency(20);
          throw new Error('boom');
        },
        { debounceMs: 0, retryDelayMs: 1, retries: 0 },
      ),
    );
    c.error(); // touch the signal so a later write would be observable

    TestBed.resetTestingModule(); // runs DestroyRef callbacks
    await quietFor(60);
    settled = c.error() ? ['error'] : [];
    expect(settled).toEqual([]);
  });

  it('gives up the retry chain when the request is superseded mid-backoff', async () => {
    // The controller sleeps between retries. A new query during that sleep must
    // end the chain rather than letting it wake up and issue a stale request.
    let attempts = 0;
    const c = make<string>(
      async (q) => {
        attempts++;
        if (q.search === '') throw Object.assign(new Error('flaky'), { status: 503 });
        await latency(1);
        return page([q.search]);
      },
      { retries: 5, retryDelayMs: 40 },
    );

    await until(() => attempts >= 1, { label: 'the first attempt' });
    c.search('now'); // supersedes while the retry backoff is sleeping
    await until(() => c.items().length > 0, { label: 'the new query to answer' });
    const attemptsWhenSettled = attempts;
    await quietFor(120); // longer than the abandoned backoff

    expect(c.items()).toEqual(['now']);
    // Assert the negative: the abandoned chain must not have woken up.
    expect(attempts).toBe(attemptsWhenSettled);
  });
});

describe('svDataController — keepPreviousData', () => {
  it('keeps the old rows on screen while the next query is in flight, by default', async () => {
    const c = make<string>(async (q) => {
      await latency(10);
      return page([q.search || 'first']);
    });

    await until(() => c.items().length > 0, { label: 'the first page' });
    c.search('second');
    expect(c.items()).toEqual(['first']); // still there, and loading
    await until(() => c.items()[0] === 'second', { label: 'the second page' });
  });

  it('blanks the table on the next query when told not to keep them', async () => {
    const c = make<string>(
      async (q) => {
        await latency(10);
        return page([q.search || 'first']);
      },
      { keepPreviousData: false },
    );

    await until(() => c.items().length > 0, { label: 'the first page' });
    c.search('second');
    expect(c.items()).toEqual([]);
    await until(() => c.items()[0] === 'second', { label: 'the second page' });
  });

  it('keeps the rows that answered the last working query when one fails', async () => {
    let fail = false;
    const c = make<string>(
      async () => {
        if (fail) throw Object.assign(new Error('gone'), { status: 404 });
        return page(['a']);
      },
      { retries: 0 },
    );

    await until(() => c.items().length > 0, { label: 'the first page' });
    fail = true;
    c.reload();
    await until(() => c.error() !== null, { label: 'the failure' });

    // The rows still answer the last query that worked, and the user needs
    // them to read the error against.
    expect(c.items()).toEqual(['a']);
  });

  it('blanks them on failure when told not to keep them', async () => {
    let fail = false;
    const c = make<string>(
      async () => {
        if (fail) throw Object.assign(new Error('gone'), { status: 404 });
        return page(['a']);
      },
      { retries: 0, keepPreviousData: false },
    );

    await until(() => c.items().length > 0, { label: 'the first page' });
    fail = true;
    c.reload();
    await until(() => c.error() !== null, { label: 'the failure' });
    expect(c.items()).toEqual([]);
  });
});

describe('svDataController — filtered()', () => {
  it('is false for an untouched query', async () => {
    const c = make<string>(async () => page(['a']));
    await until(() => c.items().length > 0, { label: 'the first page' });
    expect(c.filtered()).toBe(false);
  });

  it('is true once a search term has been applied and matched nothing', async () => {
    // `filtered` is specifically "empty BECAUSE of the query" — it stays false
    // while there are rows, and it reads the APPLIED query, not the one being
    // typed. Both halves matter here.
    const c = make<string>(async (q) => (q.search ? page([]) : page(['a'])));
    await until(() => c.items().length > 0, { label: 'the first page' });
    expect(c.filtered()).toBe(false);

    c.search('zzz');
    await until(() => c.filtered(), { label: 'the narrowed query' });
    expect(c.filtered()).toBe(true);
  });

  it('is true for a filter with no search term', async () => {
    // The half `q.search !== ''` cannot see. A filtered-empty table that says
    // "Nothing here yet" instead of "Nothing matched these filters" is the
    // failure this flag exists to prevent.
    const c = make<string>(async () => page([]));
    c.filter('status', 'open');
    await until(() => c.filtered(), { label: 'the narrowed query' });
    expect(c.filtered()).toBe(true);
  });

  it('is false again once the filter is cleared to empty', async () => {
    const c = make<string>(async () => page([]));
    c.filter('status', 'open');
    await until(() => c.filtered(), { label: 'the narrowed query' });
    c.filter('status', '');
    await until(() => !c.filtered(), { label: 'the widened query' });
    expect(c.filtered()).toBe(false);
  });

  it('ignores a query that is identical to the current one', async () => {
    let calls = 0;
    const c = make<string>(async () => {
      calls++;
      return page(['a']);
    });
    await until(() => calls === 1, { label: 'the first request' });
    c.setQuery(createQuery());
    await quietFor();
    expect(calls).toBe(1);
  });
});
