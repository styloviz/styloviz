/**
 * ============================================================================
 *  @testing/async — waiting for state without racing the clock
 * ============================================================================
 *
 *  ★★ THE RULE
 *
 *  A spec that waits a fixed number of milliseconds for something a component
 *  does on its OWN timer is a coin toss, not a test. It passes until the
 *  machine is busy, and then it fails in someone else's pull request.
 *
 *  This is not hypothetical. On 2026-08-05 `controller.spec.ts` failed on
 *
 *      await tick(60);
 *      expect(c.error()).not.toBeNull();
 *
 *  under `npm run coverage:baseline`, minutes after passing 4,339/4,339 under
 *  `npm test`. It was measured rather than re-run, and the numbers were:
 *
 *    • 120 consecutive runs, 60ms wait + 1s grace — the error was NEVER lost.
 *      So the component was right; the wait was wrong.
 *    • The retry chain it was waiting for settled in p50 5.7ms, p95 6.8ms —
 *      but **max 25.4ms**, on an IDLE machine, over 150 samples.
 *
 *  60ms against a 25.4ms tail is 2.4x. The coverage run was 2.5x slower than
 *  the plain run. The margin was already gone; it had just been landing heads.
 *
 *  ---------------------------------------------------------------------------
 *  ★★ AND THE HALF OF THE RULE THAT IS EASY TO MISS
 *
 *  Polling fixes assertions that something DID happen. It cannot fix assertions
 *  that something did NOT — you cannot poll for the absence of an event, and a
 *  longer `setTimeout` is the same bug with a bigger number.
 *
 *  For a negative, wait for a **positive landmark that proves the window has
 *  closed**, and only then assert the absence:
 *
 *      await until(() => calls === 2, { label: 'the debounced request fired' });
 *      await quietFor();          // nothing more may arrive
 *      expect(calls).toBe(2);
 *
 *  Note what this buys. The remaining fixed wait is `quietFor`, and if it is
 *  too short the test **misses a defect** — it does not invent one. A test that
 *  can only fail late is merely weaker; a test that can fail spuriously teaches
 *  the team to re-run instead of to look, and that costs more than the test is
 *  worth.
 *
 *  Related: `@testing/async-contract` for the loading/empty/error contract.
 * ============================================================================
 */

export interface SvUntilOptions {
  /** How long to keep polling before declaring the state never arrived. */
  readonly timeoutMs?: number;
  /** Named in the failure message — write it as the thing you are waiting FOR. */
  readonly label?: string;
  /** Gap between polls. Rarely worth changing. */
  readonly pollMs?: number;
}

/**
 * Poll until `condition` holds.
 *
 * Use for every assertion that something *happened*: a fetch landed, an error
 * surfaced, a flag flipped. The timeout is a safety net for a genuinely broken
 * component, not a scheduling assumption — so it is generous on purpose. A
 * passing test returns as soon as the state is there, usually in a millisecond
 * or two, which makes this *faster* than the fixed waits it replaces as well as
 * steadier.
 *
 * ★ If this throws, do not raise the timeout. Two seconds is already ~80x the
 * worst settle time ever measured in this repo. It means the state never
 * arrived, which is the bug the spec was written to catch.
 */
export async function until(
  condition: () => boolean,
  options: SvUntilOptions = {},
): Promise<void> {
  const { timeoutMs = 2000, label = 'condition', pollMs = 1 } = options;
  const deadline = Date.now() + timeoutMs;
  // ★ The clock alone is not enough. On 2026-10-07 the release sweep failed a
  //   20ms debounce here: the test took 16.5s because the worker was starved,
  //   so the 2000ms passed in a handful of polls while the debounce timer
  //   itself had not been given a turn. "Never arrived" has to mean the event
  //   loop actually ran — so the deadline counts only once this many polls
  //   (each a real macrotask turn) have also happened. On a healthy machine
  //   the two limits coincide; a hung state still fails.
  const minPolls = Math.ceil(timeoutMs / Math.max(pollMs, 1));
  let polls = 0;

  while (!condition()) {
    if (Date.now() >= deadline && polls >= minPolls) {
      throw new Error(
        `until(): ${label} was still false after ${timeoutMs}ms.\n` +
          '  This is a real failure, not a timeout to raise — the state never arrived.\n' +
          '  (2000ms is ~80x the worst settle time measured in this repo.)',
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    polls++;
  }
}

/**
 * {@link until}, for a condition read out of the **rendered DOM**.
 *
 * Runs change detection before every check, because a component fixture does
 * not update itself while a spec is polling — without this the condition reads
 * the same stale markup 2000 times and then reports that the state never
 * arrived.
 *
 * Typed structurally on purpose: this module stays free of Angular imports so
 * it can be used from a library spec, an app spec or a plain unit test alike.
 */
export async function untilRendered(
  fixture: { detectChanges(): void },
  condition: () => boolean,
  options: SvUntilOptions = {},
): Promise<void> {
  await until(
    () => {
      fixture.detectChanges();
      return condition();
    },
    options,
  );
  fixture.detectChanges();
}

/**
 * Poll until `read()` returns something other than `undefined`/`null`, then
 * return it — the common "wait for the value, then assert on it" shape.
 */
export async function untilValue<T>(
  read: () => T | null | undefined,
  options: SvUntilOptions = {},
): Promise<T> {
  await until(() => read() != null, { label: 'a value to arrive', ...options });
  return read() as T;
}

/**
 * A deliberately generous window in which something *could* have happened,
 * for assertions that it did not.
 *
 * Only ever use this AFTER a positive landmark — see the header. On its own it
 * is the same fixed-wait race this module exists to remove.
 *
 * The default is sized against the worst settle time observed in this repo
 * (25.4ms on an idle machine) with room for a loaded CI box, not against the
 * happy path.
 */
export async function quietFor(ms = 120): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Yield to the microtask queue and one macrotask turn.
 *
 * For state a component sets *synchronously* or in an already-resolved promise
 * — no component timer involved, so there is nothing to race. Anything that
 * waits on a timer the component owns belongs in {@link until} instead.
 */
export async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
