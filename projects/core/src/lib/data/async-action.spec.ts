import { createAsyncAction } from './async-action';
import { createRequestGuard } from './request-guard';

/**
 * ============================================================================
 *  `createAsyncAction` — the write half of the async contract (`X-10`)
 * ============================================================================
 *
 * ★★ THE ONE THING TO KEEP IN MIND WHILE READING THIS FILE: it is FIRST-WINS,
 * and `createRequestGuard` beside it is LATEST-WINS. That is not an
 * inconsistency, it is the point. A newer search supersedes an older one; a
 * second click on Delete does not supersede the first, it deletes twice.
 */

/** A promise you resolve or reject by hand, so timing is explicit. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Let every already-resolved microtask run. */
const flush = () => Promise.resolve().then(() => undefined);

describe('createAsyncAction — idle', () => {
  it('starts idle, with nothing to retry', () => {
    const a = createAsyncAction();
    expect(a.status()).toBe('idle');
    expect(a.pending()).toBe(false);
    expect(a.error()).toBeNull();
    expect(a.canRetry()).toBe(false);
    expect(a.attempts()).toBe(0);
  });

  it('refuses to retry when nothing has run — an empty attempt is not a retry', async () => {
    const a = createAsyncAction();
    expect(await a.retry()).toBe('busy');
    expect(a.attempts()).toBe(0);
  });
});

describe('createAsyncAction — pending', () => {
  it('is pending while the work is in flight and done when it resolves', async () => {
    const a = createAsyncAction();
    const work = deferred();
    const outcome = a.run(() => work.promise);

    expect(a.pending()).toBe(true);
    expect(a.status()).toBe('pending');

    work.resolve();
    expect(await outcome).toBe('done');
    expect(a.pending()).toBe(false);
    expect(a.status()).toBe('idle');
  });

  it('handles synchronous work too — not everything returns a promise', async () => {
    const a = createAsyncAction();
    let ran = 0;
    expect(await a.run(() => { ran++; })).toBe('done');
    expect(ran).toBe(1);
    expect(a.pending()).toBe(false);
  });

  it('hands the work a request whose signal it can pass to the transport', async () => {
    const a = createAsyncAction();
    let seen: AbortSignal | null = null;
    await a.run((req) => { seen = req.signal; });
    expect(seen).toBeInstanceOf(AbortSignal);
    expect(seen!.aborted).toBe(false);
  });
});

describe('createAsyncAction — ★ first-wins, because a write is not a search', () => {
  /**
   * ★★★ THE DOUBLE-SUBMIT BUG, AND IT IS NOT HYPOTHETICAL. Eight families had
   *     an async mode and each decided for itself what `loading` meant; a
   *     double-click on a confirm button sent the destructive request twice in
   *     the ones that only disabled the button in the template — a disabled
   *     attribute applied on the next change-detection pass, which is after
   *     the second click has already been dispatched.
   */
  it('refuses a second run while one is in flight, and does not run the work', async () => {
    const a = createAsyncAction();
    const work = deferred();
    let calls = 0;

    const first = a.run(() => { calls++; return work.promise; });
    expect(await a.run(() => { calls++; })).toBe('busy');

    expect(calls).toBe(1);
    expect(a.attempts()).toBe(1);

    work.resolve();
    expect(await first).toBe('done');
  });

  it('accepts the next run once the first has settled', async () => {
    const a = createAsyncAction();
    expect(await a.run(() => undefined)).toBe('done');
    expect(await a.run(() => undefined)).toBe('done');
    expect(a.attempts()).toBe(2);
  });
});

describe('createAsyncAction — error and retry', () => {
  it('normalizes a rejection into an error and leaves pending false', async () => {
    const a = createAsyncAction();
    expect(await a.run(() => Promise.reject(new Error('Server exploded')))).toBe('failed');

    expect(a.status()).toBe('error');
    expect(a.pending()).toBe(false);
    expect(a.error()?.message).toBe('Server exploded');
  });

  it('uses the fallback message when the rejection says nothing readable', async () => {
    const a = createAsyncAction({ fallbackMessage: 'Could not delete the invoice.' });
    await a.run(() => Promise.reject({}));
    expect(a.error()?.message).toBe('Could not delete the invoice.');
  });

  it('★ offers a retry only when the failure could plausibly succeed again', async () => {
    // A 403 fails identically next time; a "Try again" button for it wastes
    // the user's time twice. `SvDataError.retryable` already knows this.
    const forbidden = createAsyncAction();
    await forbidden.run(() => Promise.reject({ status: 403, message: 'Nope' }));
    expect(forbidden.error()).not.toBeNull();
    expect(forbidden.canRetry()).toBe(false);

    const flaky = createAsyncAction();
    await flaky.run(() => Promise.reject({ status: 503, message: 'Later' }));
    expect(flaky.canRetry()).toBe(true);
  });

  it('re-runs the same work on retry, clearing the error as it starts', async () => {
    const a = createAsyncAction();
    let attempt = 0;
    const work = () => {
      attempt++;
      return attempt === 1 ? Promise.reject(new Error('flaky')) : Promise.resolve();
    };

    expect(await a.run(work)).toBe('failed');
    expect(a.error()?.message).toBe('flaky');

    const retrying = a.retry();
    // ★ The error clears when the retry STARTS, not when it finishes: leaving
    //   it on screen beside a spinner says the thing that is happening already
    //   failed.
    expect(a.error()).toBeNull();
    expect(a.pending()).toBe(true);

    expect(await retrying).toBe('done');
    expect(a.status()).toBe('idle');
    expect(a.attempts()).toBe(2);
  });

  it('a new run clears a previous error', async () => {
    const a = createAsyncAction();
    await a.run(() => Promise.reject(new Error('first')));
    const work = deferred();
    const second = a.run(() => work.promise);
    expect(a.error()).toBeNull();
    work.resolve();
    await second;
  });
});

describe('createAsyncAction — cancel', () => {
  it('aborts the in-flight signal so the transport can stop', async () => {
    const a = createAsyncAction();
    let signal: AbortSignal | null = null;
    const work = deferred();
    const running = a.run((req) => { signal = req.signal; return work.promise; });

    a.cancel();
    expect(signal!.aborted).toBe(true);
    expect(a.pending()).toBe(false);
    expect(a.status()).toBe('idle');

    work.resolve();
    expect(await running).toBe('cancelled');
  });

  it('★ a rejection that arrives after a cancel is NOT reported as an error', async () => {
    // ★★ The user stopped it. Telling them "Request aborted" afterwards reads
    //    as a bug in the thing they just cancelled — and it is the single most
    //    common way a cancellable action goes wrong.
    const a = createAsyncAction();
    const work = deferred();
    const running = a.run((req) => work.promise.catch((e) => {
      expect(req.signal.aborted).toBe(true);
      throw e;
    }));

    a.cancel();
    work.reject(new DOMException('aborted', 'AbortError'));

    expect(await running).toBe('cancelled');
    expect(a.error()).toBeNull();
    expect(a.status()).toBe('idle');
  });

  it('a resolution that arrives after a cancel cannot clear a newer pending', async () => {
    const a = createAsyncAction();
    const first = deferred();
    const running = a.run(() => first.promise);

    a.cancel();
    const second = deferred();
    const next = a.run(() => second.promise);
    expect(a.pending()).toBe(true);

    first.resolve();
    expect(await running).toBe('cancelled');
    // ★ The stale write the guard exists to stop, in its `pending` form: the
    //   cancelled run answering would have made the spinner disappear while
    //   the request the user is actually waiting for was still going.
    expect(a.pending()).toBe(true);

    second.resolve();
    expect(await next).toBe('done');
    expect(a.pending()).toBe(false);
  });

  it('★ a NON-abort rejection after a cancel is discarded too', async () => {
    // Not every transport rejects with an `AbortError` when its signal fires —
    // some throw their own timeout, some throw the server's last words. The
    // question is not what the rejection looks like, it is whether the run
    // that produced it is still the one the surface is waiting for.
    const a = createAsyncAction();
    const work = deferred();
    const running = a.run(() => work.promise);

    a.cancel();
    work.reject(new Error('connection reset'));

    expect(await running).toBe('cancelled');
    expect(a.error()).toBeNull();
  });

  it('clears an error, so a cancelled surface does not reopen showing the last failure', async () => {
    const a = createAsyncAction();
    await a.run(() => Promise.reject(new Error('boom')));
    a.cancel();
    expect(a.error()).toBeNull();
    expect(a.status()).toBe('idle');
  });
});

describe('createAsyncAction — reset and teardown', () => {
  it('reset clears the error, the attempt count and the retryable work', async () => {
    const a = createAsyncAction();
    await a.run(() => Promise.reject(new Error('boom')));
    a.reset();

    expect(a.error()).toBeNull();
    expect(a.attempts()).toBe(0);
    expect(await a.retry()).toBe('busy');
  });

  it('aborts in flight on destroy, so nothing resolves into a dead surface', async () => {
    const hooks: (() => void)[] = [];
    const destroyRef = { onDestroy: (fn: () => void) => { hooks.push(fn); return () => undefined; } };
    const a = createAsyncAction({ destroyRef: destroyRef as never });

    let signal: AbortSignal | null = null;
    const work = deferred();
    const running = a.run((req) => { signal = req.signal; return work.promise; });

    hooks.forEach((fn) => fn());
    expect(signal!.aborted).toBe(true);

    work.resolve();
    expect(await running).toBe('cancelled');
  });

  it('shares a guard when one is supplied, so a read and a write can interlock', async () => {
    const guard = createRequestGuard();
    const a = createAsyncAction({ guard });
    const work = deferred();
    const running = a.run(() => work.promise);

    expect(guard.pending()).toBe(true);
    guard.cancel();               // the host cancelled everything at once
    expect(a.pending()).toBe(false);

    work.resolve();
    expect(await running).toBe('cancelled');
    await flush();
  });
});
