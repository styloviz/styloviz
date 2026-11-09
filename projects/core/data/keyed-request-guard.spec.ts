import { svKeyedRequestGuard, SV_SUPERSEDED } from './keyed-request-guard';

/**
 * ============================================================================
 *  Several requests in flight, each cancellable alone  ·  `FI-05-M1`/`FI-03-M3`
 * ============================================================================
 *
 * ★★★ `createRequestGuard` IS SINGLE-FLIGHT, AND THAT IS RIGHT FOR A SEARCH
 *     BOX: one term, one answer, a newer keystroke supersedes the older
 *     request. It is exactly wrong for a TREE. Expanding three folders means
 *     three requests that are not refinements of each other — settling one must
 *     not discard the other two, and collapsing one must not cancel its
 *     siblings.
 *
 * ★★★ TWO BACKLOG ITEMS ARE THE SAME PROBLEM. `FI-05-M1` is the missing loader
 *     on `sv-tree-select`; `FI-03-M3` is the missing cancellation on
 *     `sv-cascader`. A component with the feature and not the cancellation
 *     would have the second bug by construction, which is why this is one file.
 */

describe('keys are independent', () => {
  it('settles one without discarding another', () => {
    const g = svKeyedRequestGuard();
    const a = g.take('a');
    const b = g.take('b');
    expect(g.settle('a', a)).toBe(true);
    expect(g.settle('b', b)).toBe(true);
  });

  it('supersedes only within a key', () => {
    const g = svKeyedRequestGuard();
    const a1 = g.take('a');
    g.take('b');
    const a2 = g.take('a');          // a newer request for `a` only

    expect(g.settle('a', a1)).toBe(false);
    expect(g.settle('a', a2)).toBe(true);
    expect(g.isPending('b')).toBe(true);
  });

  it('cancels one branch and leaves its siblings alone', () => {
    /**
     * ★★★ THE `FI-03-M3` CASE. A user opens a folder, waits, gets bored,
     *     collapses it and opens another. Cancelling the first must not take
     *     the second with it — and not cancelling it at all means the response
     *     lands in a branch that is no longer on screen.
     */
    const g = svKeyedRequestGuard();
    const a = g.take('a');
    const b = g.take('b');
    g.cancel('a');

    expect(g.settle('a', a)).toBe(false);
    expect(g.settle('b', b)).toBe(true);
  });
});

describe('a cancelled request must not settle', () => {
  it('refuses a late response even with the current token', () => {
    /**
     * ★★★ THE SUBTLE ONE. `cancel` drops the controller but leaves the token
     *     counter alone, so a response from the cancelled request still carries
     *     what looks like the CURRENT token. Checking only the token would let
     *     it through, and children would appear in a branch the user collapsed
     *     — sometimes re-expanding it under their cursor.
     */
    const g = svKeyedRequestGuard();
    const token = g.take('a');
    g.cancel('a');
    expect(g.settle('a', token)).toBe(false);
  });

  it('lets a NEW request for the same key settle afterwards', () => {
    const g = svKeyedRequestGuard();
    g.take('a');
    g.cancel('a');
    const fresh = g.take('a');
    expect(g.settle('a', fresh)).toBe(true);
  });

  it('refuses a token that was never issued', () => {
    const g = svKeyedRequestGuard();
    expect(g.settle('a', 1)).toBe(false);
    expect(g.settle('never-taken', 0)).toBe(false);
  });

  it('refuses the same token twice', () => {
    // ★ A response applied once must not apply again — a retry that reuses a
    //   token would duplicate children.
    const g = svKeyedRequestGuard();
    const t = g.take('a');
    expect(g.settle('a', t)).toBe(true);
    expect(g.settle('a', t)).toBe(false);
  });
});

describe('the abort signal', () => {
  it('is live while the request is, and aborts when superseded', () => {
    const g = svKeyedRequestGuard();
    g.take('a');
    const first = g.signalFor('a')!;
    expect(first.aborted).toBe(false);

    g.take('a');
    expect(first.aborted).toBe(true);
    expect(g.signalFor('a')!.aborted).toBe(false);
  });

  it('says WHY it aborted, so a caller can tell it from a network failure', () => {
    // ⚠️ A superseded request is not an error to show the user. Without a
    //    reason the catch block cannot tell the two apart and shows "failed to
    //    load" for a branch nobody is waiting for.
    const g = svKeyedRequestGuard();
    g.take('a');
    const s = g.signalFor('a')!;
    g.cancel('a');
    expect(s.reason).toBe(SV_SUPERSEDED);
  });

  it('is undefined once settled', () => {
    const g = svKeyedRequestGuard();
    const t = g.take('a');
    g.settle('a', t);
    expect(g.signalFor('a')).toBeUndefined();
  });
});

describe('what is pending', () => {
  it('tracks every outstanding key, which is what drives per-row spinners', () => {
    const g = svKeyedRequestGuard();
    g.take('a');
    g.take('b');
    expect([...g.pending()].sort()).toEqual(['a', 'b']);
  });

  it('clears a key when it settles', () => {
    const g = svKeyedRequestGuard();
    const a = g.take('a');
    g.take('b');
    g.settle('a', a);
    expect([...g.pending()]).toEqual(['b']);
  });

  it('clears a key when it is cancelled', () => {
    const g = svKeyedRequestGuard();
    g.take('a');
    g.cancel('a');
    expect(g.pending().size).toBe(0);
    expect(g.isPending('a')).toBe(false);
  });

  it('is emptied by cancelAll, which is what ngOnDestroy needs', () => {
    const g = svKeyedRequestGuard();
    g.take('a');
    g.take('b');
    const sa = g.signalFor('a')!;
    g.cancelAll();

    expect(g.pending().size).toBe(0);
    expect(sa.aborted).toBe(true);
  });

  it('is a NEW set each time, so a signal consumer actually re-renders', () => {
    /**
     * ⚠️ A mutated Set is the same reference, so a computed reading it never
     *    changes and the spinner never appears. This is the bug that looks like
     *    a template problem and is not.
     */
    const g = svKeyedRequestGuard();
    g.take('a');
    const first = g.pending();
    g.take('b');
    expect(g.pending()).not.toBe(first);
  });
});
