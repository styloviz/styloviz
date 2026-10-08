import { TestBed } from '@angular/core/testing';
import { quietFor, until } from '@testing/async';
import {
  svSuggestController,
  type SvSuggestController,
  type SvSuggestControllerOptions,
  type SvSuggestSource,
} from './suggest-controller';

/**
 * The picker half of the async contract: term in, options out.
 *
 * Everything here is about the three states a combobox has always conflated —
 * fetching the first list, refining a list already on screen, and having asked
 * for nothing at all — plus the race that makes a slow answer to an abandoned
 * term overwrite a newer one.
 */

function make<T>(
  source: SvSuggestSource<T>,
  options: SvSuggestControllerOptions = {},
): SvSuggestController<T> {
  TestBed.resetTestingModule();
  return TestBed.runInInjectionContext(() =>
    svSuggestController<T>(source, { debounceMs: 0, ...options }),
  );
}

/** Latency inside the fake source — the thing being simulated, not a guess. */
const latency = (ms: number): Promise<unknown> => new Promise((r) => setTimeout(r, ms));

describe('svSuggestController', () => {
  it('opens with nothing asked for, not with an empty result', async () => {
    const c = make<string>(async () => []);
    await quietFor();

    expect(c.options()).toEqual([]);
    expect(c.loading()).toBe(false);
    expect(c.stale()).toBe(false);
    expect(c.term()).toBe('');
    // 'no-data' — "start typing" — rather than 'no-results', which would tell
    // the user their search failed before they made one.
    expect(c.emptyReason()).toBe('no-data');
  });

  it('fetches on a term and reports what the options answer', async () => {
    const c = make<string>(async (term) => [`${term}-1`, `${term}-2`]);
    c.search('ab');
    await until(() => !c.loading(), { label: 'the first answer' });

    expect(c.options()).toEqual(['ab-1', 'ab-2']);
    expect(c.term()).toBe('ab');
    expect(c.emptyReason()).toBeNull();
  });

  it('says no-results once a search has answered with nothing', async () => {
    const c = make<string>(async () => []);
    c.search('zzz');
    await until(() => c.term() === 'zzz', { label: 'the empty answer' });

    expect(c.emptyReason()).toBe('no-results');
  });

  it('reports neither empty state while the first request is in flight', async () => {
    const c = make<string>(async () => {
      await latency(20);
      return [];
    });
    c.search('ab');
    await until(() => c.loading(), { label: 'the request to start' });

    expect(c.emptyReason()).toBeNull();
  });

  describe('stale — the state a picker has no vocabulary for', () => {
    it('is false on the first fetch and true on a refinement', async () => {
      let calls = 0;
      const c = make<string>(async (term) => {
        calls++;
        await latency(15);
        return [term];
      });

      c.search('a');
      await until(() => c.loading(), { label: 'the first request' });
      expect(c.stale()).toBe(false); // nothing on screen yet — this is a skeleton

      await until(() => c.options().length > 0, { label: 'the first answer' });
      c.search('ab');
      await until(() => c.loading(), { label: 'the second request' });

      // Results on screen, answering the older term. Keep them, mark them.
      expect(c.stale()).toBe(true);
      expect(c.options()).toEqual(['a']);
      expect(c.term()).toBe('a');

      await until(() => c.term() === 'ab', { label: 'the second answer' });
      expect(c.stale()).toBe(false);
      expect(calls).toBe(2);
    });

    it('does not go stale after a cancel, because a cancel is not an answer', async () => {
      const c = make<string>(async (term) => {
        await latency(15);
        return [term];
      });

      c.search('a');
      await until(() => c.loading(), { label: 'the first request' });
      c.cancel();
      c.search('b');
      await until(() => c.loading(), { label: 'the second request' });

      expect(c.stale()).toBe(false);
    });
  });

  describe('the race', () => {
    /**
     * The defining bug: the user types "ab" then "abc"; the "ab" response is
     * slower and lands second. Without the guard the panel shows suggestions
     * for a term the user has already moved past, and nothing in the code
     * looks wrong.
     */
    it('discards a slow answer to an abandoned term', async () => {
      const delays: Record<string, number> = { ab: 40, abc: 5 };
      const c = make<string>(async (term) => {
        await latency(delays[term] ?? 0);
        return [term];
      });

      c.search('ab');
      await until(() => c.loading(), { label: 'the slow request' });
      c.search('abc');
      await until(() => c.term() === 'abc', { label: 'the fast answer' });
      await quietFor(60); // long enough for the slow one to come back

      expect(c.options()).toEqual(['abc']);
      expect(c.term()).toBe('abc');
    });

    it('aborts the superseded request rather than only ignoring it', async () => {
      const aborted: string[] = [];
      const c = make<string>(async (term, signal) => {
        signal.addEventListener('abort', () => aborted.push(term), { once: true });
        await latency(30);
        if (signal.aborted) throw signal.reason;
        return [term];
      });

      c.search('a');
      await until(() => c.loading(), { label: 'the first request' });
      c.search('ab');
      await until(() => c.term() === 'ab', { label: 'the second answer' });

      expect(aborted).toEqual(['a']);
    });

    it('never surfaces its own abort as an error the user can see', async () => {
      const c = make<string>(async (term, signal) => {
        await latency(20);
        if (signal.aborted) throw signal.reason;
        return [term];
      });

      c.search('a');
      await until(() => c.loading(), { label: 'the first request' });
      c.search('ab');
      await until(() => c.term() === 'ab', { label: 'the second answer' });
      await quietFor(40);

      expect(c.error()).toBeNull();
    });
  });

  describe('minChars', () => {
    it('does not fetch below the threshold', async () => {
      let calls = 0;
      const c = make<string>(
        async (term) => {
          calls++;
          return [term];
        },
        { minChars: 3 },
      );

      c.search('a');
      c.search('ab');
      await quietFor();

      expect(calls).toBe(0);
      expect(c.tooShort()).toBe(true);
      expect(c.loading()).toBe(false);
    });

    it('fetches once the threshold is met, and drops back when it is not', async () => {
      let calls = 0;
      const c = make<string>(
        async (term) => {
          calls++;
          return [term];
        },
        { minChars: 3 },
      );

      c.search('abc');
      await until(() => c.term() === 'abc', { label: 'the answer' });
      expect(calls).toBe(1);
      expect(c.tooShort()).toBe(false);

      // Backspacing below the threshold clears rather than leaving results for
      // a term the box no longer contains.
      c.search('ab');
      await quietFor();
      expect(c.options()).toEqual([]);
      expect(c.emptyReason()).toBe('no-data');
      expect(calls).toBe(1);
    });
  });

  describe('debounce', () => {
    it('turns a burst of keystrokes into one request', async () => {
      let calls = 0;
      const c = make<string>(
        async (term) => {
          calls++;
          return [term];
        },
        { debounceMs: 20 },
      );

      c.search('a');
      c.search('ab');
      c.search('abc');
      expect(c.typing()).toBe(true);
      expect(calls).toBe(0);

      await until(() => c.term() === 'abc', { label: 'the single answer' });
      expect(calls).toBe(1);
      expect(c.typing()).toBe(false);
    });

    it('flush skips the wait, because Enter is not a keystroke', async () => {
      let calls = 0;
      const c = make<string>(
        async (term) => {
          calls++;
          return [term];
        },
        { debounceMs: 1000 },
      );

      c.search('abc');
      c.flush();
      await until(() => c.term() === 'abc', { label: 'the immediate answer' });

      expect(calls).toBe(1);
      expect(c.typing()).toBe(false);
    });
  });

  describe('failure', () => {
    it('normalizes the failure and keeps the options that worked', async () => {
      let fail = false;
      const c = make<string>(async (term) => {
        if (fail) throw new Error('boom');
        return [term];
      });

      c.search('a');
      await until(() => c.term() === 'a', { label: 'the good answer' });
      fail = true;
      c.search('ab');
      await until(() => c.error() !== null, { label: 'the failure' });

      expect(c.options()).toEqual(['a']);
      expect(c.error()?.message).toBeTruthy();
      expect(c.loading()).toBe(false);
    });

    it('blanks the options on failure when keepPreviousData is off', async () => {
      let fail = false;
      const c = make<string>(
        async (term) => {
          if (fail) throw new Error('boom');
          return [term];
        },
        { keepPreviousData: false },
      );

      c.search('a');
      await until(() => c.term() === 'a', { label: 'the good answer' });
      fail = true;
      c.search('ab');
      await until(() => c.error() !== null, { label: 'the failure' });

      expect(c.options()).toEqual([]);
    });

    it('reload re-runs the current term and clears the error first', async () => {
      let fail = true;
      let calls = 0;
      const c = make<string>(async (term) => {
        calls++;
        if (fail) throw new Error('boom');
        return [term];
      });

      c.search('ab');
      await until(() => c.error() !== null, { label: 'the failure' });
      fail = false;
      c.reload();
      await until(() => c.options().length > 0, { label: 'the retry' });

      expect(c.error()).toBeNull();
      expect(c.options()).toEqual(['ab']);
      expect(calls).toBe(2);
    });

    /**
     * There is no retry policy on purpose. A picker's user has a keyboard, and
     * their next keystroke is a better retry than any timer — so one failure is
     * exactly one call.
     */
    it('does not retry on its own', async () => {
      let calls = 0;
      const c = make<string>(async () => {
        calls++;
        throw new Error('boom');
      });

      c.search('ab');
      await until(() => c.error() !== null, { label: 'the failure' });
      await quietFor(60);

      expect(calls).toBe(1);
    });
  });

  describe('lifecycle', () => {
    it('cancel abandons the request but leaves the panel as it is', async () => {
      const c = make<string>(async (term) => {
        await latency(20);
        return [term];
      });

      c.search('a');
      await until(() => !c.loading(), { label: 'the first answer' });
      c.search('ab');
      await until(() => c.loading(), { label: 'the second request' });
      c.cancel();

      expect(c.loading()).toBe(false);
      // Closing the panel does not erase what was in it.
      expect(c.options()).toEqual(['a']);

      await quietFor(40);
      expect(c.options()).toEqual(['a']);
      expect(c.term()).toBe('a');
    });

    it('clear returns to the opening state', async () => {
      const c = make<string>(async (term) => [term]);
      c.search('ab');
      await until(() => c.term() === 'ab', { label: 'the answer' });

      c.clear();

      expect(c.typed()).toBe('');
      expect(c.options()).toEqual([]);
      expect(c.error()).toBeNull();
      expect(c.emptyReason()).toBe('no-data');
      expect(c.loading()).toBe(false);
    });

    it('writes nothing once the host has been destroyed', async () => {
      TestBed.resetTestingModule();
      const c = TestBed.runInInjectionContext(() =>
        svSuggestController<string>(
          async () => {
            await latency(20);
            throw new Error('boom');
          },
          { debounceMs: 0 },
        ),
      );
      c.search('ab');
      await until(() => c.loading(), { label: 'the request to start' });

      TestBed.resetTestingModule(); // runs DestroyRef callbacks
      await quietFor(60);

      expect(c.error()).toBeNull();
    });
  });
});
