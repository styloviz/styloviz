import { TestBed } from '@angular/core/testing';
import { createQuery, type SvDataQuery, type SvPage } from '@styloviz/core';
import { flush, quietFor, until } from '@testing/async';
import { svDataController, type SvDataController } from './controller';
import type { SvDataSource } from './types';

const page = <T,>(items: T[], total = items.length): SvPage<T> => ({ items, total, cursor: null });

/** Build a controller inside an injection context (it needs DestroyRef). */
function make<T>(source: SvDataSource<T>, options: Parameters<typeof svDataController>[1] = {}) {
  TestBed.resetTestingModule();
  return TestBed.runInInjectionContext(() =>
    svDataController<T>(source, { debounceMs: 0, retryDelayMs: 1, ...options }),
  ) as SvDataController<T>;
}

/**
 * Latency inside a fake source — this one is legitimate. It *is* the thing
 * being simulated, not a guess about how long the controller will take.
 *
 * ★ Every wait in a test BODY below goes through `until` / `quietFor` instead.
 * This file used to hold 24 fixed-ms waits and one of them (`tick(60)` for a
 * retry chain whose tail measures 25.4ms on an idle machine) failed a release
 * gate on 2026-08-05. See the header of `@testing/async`.
 */
const latency = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('svDataController — fetching', () => {
  it('fetches once on creation', async () => {
    const calls: SvDataQuery[] = [];
    const c = make<string>(async (q) => { calls.push(q); return page(['a']); });

    await until(() => c.items().length > 0, { label: 'the first page to land' });
    await quietFor();

    expect(calls).toHaveLength(1);
    expect(c.items()).toEqual(['a']);
  });

  it('waits for the first query when the host says so', async () => {
    let calls = 0;
    make<string>(async () => { calls++; return page([]); }, { immediate: false });

    // A negative with no landmark to wait for: nothing is supposed to happen at
    // all. `quietFor` is the whole test, and it is the one shape where a bare
    // wait is honest — too short only ever under-detects.
    await quietFor();

    expect(calls).toBe(0);
  });

  it('reports loading while in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const c = make<string>(async () => { await gate; return page(['a']); });

    await until(() => c.loading(), { label: 'the request to be in flight' });
    expect(c.loading()).toBe(true);

    release();
    await until(() => !c.loading(), { label: 'the request to settle' });
    expect(c.loading()).toBe(false);
  });
});

describe('svDataController — debounce', () => {
  it('collapses a burst of changes into one request', async () => {
    let calls = 0;
    const c = make<string>(async () => { calls++; return page([]); }, { debounceMs: 20 });
    await until(() => calls === 1, { label: 'the initial fetch' });

    c.search('a'); c.search('ab'); c.search('abc');

    // Landmark first — the debounced request fires — and only then the claim
    // that the other two keystrokes did NOT each become a request.
    await until(() => calls === 2, { label: 'the debounced request' });
    await quietFor();

    expect(calls).toBe(2);
  });

  it('does not debounce a page click — that just feels broken', async () => {
    const seen: number[] = [];
    const c = make<string>(async (q) => { seen.push(q.page); return page([]); }, { debounceMs: 50 });
    await until(() => seen.length === 1, { label: 'the initial fetch' });

    c.goToPage(3);

    // The claim is that page 3 arrives WITHOUT waiting out the 50ms debounce,
    // so the window has to be shorter than the debounce or it proves nothing.
    await until(() => seen.includes(3), { timeoutMs: 40, label: 'page 3 to be fetched undebounced' });

    expect(seen).toContain(3);
  });

  it('ignores a change that leaves the query identical', async () => {
    let calls = 0;
    const c = make<string>(async () => { calls++; return page([]); });
    await until(() => calls === 1, { label: 'the initial fetch' });

    c.setQuery(createQuery());
    await quietFor();

    expect(calls).toBe(1);
  });
});

describe('svDataController — request guard', () => {
  it('discards a slow answer to an abandoned query', async () => {
    // The bug: the user types "ab", then "abc". "ab" is slower and lands
    // second, so the list shows results for a query already moved past — and
    // nothing in the code looks wrong.
    const delays: Record<string, number> = { ab: 40, abc: 5 };
    const c = make<string>(async (q) => {
      await latency(delays[q.search] ?? 0);
      return page([q.search]);
    });
    await until(() => c.items().length > 0, { label: 'the initial fetch' });

    c.search('ab');
    await until(() => c.loading(), { label: '"ab" to be in flight' });
    c.search('abc');

    // "abc" is the fast one, so it lands first. The test is only meaningful
    // once the SLOW "ab" has had time to come back and be discarded — so wait
    // past its 40ms, and not by a hair.
    await until(() => c.items().length > 0, { label: '"abc" to land' });
    await quietFor(150);

    expect(c.items()).toEqual(['abc']);
  });

  it('aborts the superseded request instead of just ignoring it', async () => {
    const aborted: string[] = [];
    const c = make<string>(async (q, signal) => {
      signal.addEventListener('abort', () => aborted.push(q.search));
      await latency(30);
      return page([q.search]);
    });
    await until(() => c.loading(), { label: 'the initial fetch to start' });

    c.search('one');
    await until(() => c.query().search === 'one', { label: '"one" to be the live query' });
    c.search('two');

    await until(() => aborted.includes('one'), { label: '"one" to be aborted' });

    expect(aborted).toContain('one');
  });
});

describe('svDataController — failure', () => {
  it('surfaces a non-retryable failure immediately', async () => {
    let calls = 0;
    const c = make<string>(async () => {
      calls++;
      throw { status: 404, message: 'No such report' };
    });

    await until(() => c.error() !== null, { label: 'the 404 to surface' });
    await quietFor();

    expect(calls).toBe(1); // "immediately" means it was never retried
    expect(c.error()?.message).toBe('No such report');
    expect(c.error()?.retryable).toBe(false);
  });

  it('retries a retryable failure, then gives up', async () => {
    let calls = 0;
    const c = make<string>(async () => {
      calls++;
      throw { status: 503, message: 'Upstream down' };
    }, { retries: 2 });

    await until(() => c.error() !== null, { label: 'the retries to be exhausted' });
    await quietFor();

    expect(calls).toBe(3); // the original plus two retries, and no more
    expect(c.error()?.message).toBe('Upstream down');
  });

  it('recovers silently when a retry succeeds', async () => {
    let calls = 0;
    const c = make<string>(async () => {
      if (++calls === 1) throw { status: 503 };
      return page(['ok']);
    });

    await until(() => c.items().length > 0, { label: 'the retry to succeed' });

    expect(c.items()).toEqual(['ok']);
    expect(c.error()).toBeNull(); // "silently" — the user never saw the 503
  });

  it('keeps the previous rows through a failure', async () => {
    // Blanking the table on a transient 503 destroys the context the user
    // needs to read the error against.
    let fail = false;
    const c = make<string>(async () => {
      if (fail) throw { status: 500 };
      return page(['a']);
    });
    await until(() => c.items().length > 0, { label: 'the first page' });

    fail = true;
    c.search('x');
    await until(() => c.error() !== null, { label: 'the failure to surface' });

    expect(c.items()).toEqual(['a']);
    expect(c.error()).not.toBeNull();
  });

  it('clears the error and refetches on reload', async () => {
    // ★ This is the test that failed the 2026-08-05 release gate on a fixed
    // 60ms wait. The retry chain it waits for settles at p50 5.7ms but has
    // been measured at 25.4ms on an idle machine.
    let fail = true;
    const c = make<string>(async () => {
      if (fail) throw { status: 500 };
      return page(['fresh']);
    });

    await until(() => c.error() !== null, { label: 'the failure to surface' });

    fail = false;
    c.reload();

    await until(() => c.items().length > 0, { label: 'the reload to land' });

    expect(c.error()).toBeNull();
    expect(c.items()).toEqual(['fresh']);
  });

  it('clears the error the moment reload is called, not when the answer lands', async () => {
    // ★★ The test above asserts only the END state, and that is not enough:
    // deleting `error.set(null)` from `reload()` leaves it passing, because the
    // successful refetch clears the error on its own way through. Mutation-
    // tested on 2026-08-05 — it survived, and this test is why it no longer
    // does.
    //
    // The behaviour that actually differs is what the user sees after pressing
    // Retry: the message goes at once, rather than lingering until the response
    // arrives. So the source is made slow enough to have an observable middle,
    // and `reload()` sets the signal synchronously — no wait, nothing to race.
    let fail = true;
    const c = make<string>(async () => {
      if (fail) throw { status: 500 };
      await latency(50);
      return page(['fresh']);
    });

    await until(() => c.error() !== null, { label: 'the failure to surface' });

    fail = false;
    c.reload();
    expect(c.error()).toBeNull();
    expect(c.items()).toEqual([]); // and the stale rows are gone with it

    await until(() => c.items().length > 0, { label: 'the reload to land' });
    expect(c.items()).toEqual(['fresh']);
  });
});

describe('svDataController — derived state', () => {
  it('distinguishes an empty account from an empty filter', async () => {
    const c = make<string>(async (q) => page(q.search ? [] : ['a']));
    await until(() => c.items().length > 0, { label: 'the unfiltered page' });
    expect(c.items()).toEqual(['a']);
    expect(c.filtered()).toBe(false);

    c.search('nothing');
    await until(() => c.filtered(), { label: 'the empty result to be read as filtered' });
    expect(c.filtered()).toBe(true);
  });

  it('does not claim "no results" while the answer is still in flight', async () => {
    // Labelling the rows before the response lands is wrong either way it
    // resolves.
    const c = make<string>(async (q) => { await latency(30); return page(q.search ? [] : ['a']); });
    await until(() => c.items().length > 0, { label: 'the first page' });

    c.search('x');

    // ★ Assert the invariant against the CONDITION it is about — "while in
    // flight" — not against a stopwatch that hopes to still be inside it.
    await until(() => c.loading(), { label: 'the search to be in flight' });
    expect(c.loading()).toBe(true);
    expect(c.filtered()).toBe(false);
  });

  it('reports another page from the total', async () => {
    const c = make<string>(async () => page(['a'], 100));
    await until(() => c.items().length > 0, { label: 'the page' });
    expect(c.hasMore()).toBe(true);
  });

  it('reports no more on the last page', async () => {
    const c = make<string>(async () => page(['a'], 1));
    await until(() => c.items().length > 0, { label: 'the page' });
    expect(c.hasMore()).toBe(false);
  });

  it('reports another page from a cursor even with no total', async () => {
    const c = make<string>(async () => ({ items: ['a'], total: null, cursor: 'next' }));
    await until(() => c.items().length > 0, { label: 'the page' });
    expect(c.hasMore()).toBe(true);
  });
});

describe('svDataController — query shaping', () => {
  // `push()` calls `query.set()` synchronously, so every assertion in this
  // block reads state that is already there — nothing here races a timer.
  // `flush()` only lets the fetch it kicked off settle before the next step.

  it('resets to page 1 when the search changes', async () => {
    const seen: SvDataQuery[] = [];
    const c = make<string>(async (q) => { seen.push(q); return page([]); });
    await until(() => seen.length === 1, { label: 'the initial fetch' });

    c.goToPage(4);
    await until(() => seen.length === 2, { label: 'the page-4 fetch' });

    c.search('x');
    await until(() => seen.length === 3, { label: 'the search fetch' });

    expect(seen.at(-1)!.page).toBe(1);
  });

  it('cycles a column unsorted → asc → desc → unsorted', async () => {
    const c = make<string>(async () => page([]));
    await flush();

    c.sortBy('name');
    expect(c.query().sorts).toEqual([{ key: 'name', direction: 'asc' }]);

    c.sortBy('name');
    expect(c.query().sorts).toEqual([{ key: 'name', direction: 'desc' }]);

    c.sortBy('name');
    expect(c.query().sorts).toEqual([]);
  });

  it('clears filters and the search together', async () => {
    const c = make<string>(async () => page([]));
    await flush();

    c.filter('status', 'open');
    c.search('abc');
    c.clearFilters();

    expect(c.query().filters).toEqual({});
    expect(c.query().search).toBe('');
  });
});

describe('svDataController — teardown', () => {
  it('stops fetching once the injector is destroyed', async () => {
    let calls = 0;
    TestBed.resetTestingModule();
    const c = TestBed.runInInjectionContext(() =>
      svDataController<string>(async () => { calls++; return page([]); }, { debounceMs: 5 }),
    );
    await until(() => calls === 1, { label: 'the initial fetch' });

    const before = calls;
    c.search('x');
    TestBed.resetTestingModule(); // triggers DestroyRef

    // The debounce is 5ms and the destroy raced it. Wait well past both before
    // claiming the fetch never happened.
    await quietFor();

    expect(calls).toBe(before);
  });
});
