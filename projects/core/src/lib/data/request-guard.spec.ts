import { createRequestGuard } from './request-guard';

describe('createRequestGuard', () => {
  it('is idle before anything starts', () => {
    expect(createRequestGuard().pending()).toBe(false);
  });

  it('is pending between begin and settle', () => {
    const g = createRequestGuard();
    const token = g.begin();
    expect(g.pending()).toBe(true);
    g.settle(token);
    expect(g.pending()).toBe(false);
  });

  /**
   * The bug this exists for: two searches in flight, the OLDER one answers
   * last. Without the guard the stale results overwrite the fresh ones and the
   * list shows a query the user has already moved past.
   */
  it('rejects a slow response that was superseded by a newer request', () => {
    const g = createRequestGuard();
    const first = g.begin();
    const second = g.begin();

    expect(g.settle(first)).toBe(false);
    expect(g.isCurrent(first)).toBe(false);
    expect(g.pending()).toBe(true);

    expect(g.settle(second)).toBe(true);
    expect(g.pending()).toBe(false);
  });

  it('stays pending when only the superseded request settles', () => {
    const g = createRequestGuard();
    const first = g.begin();
    g.begin();
    g.settle(first);
    expect(g.pending()).toBe(true);
  });

  it('clears pending on cancel without accepting anything in flight', () => {
    const g = createRequestGuard();
    const token = g.begin();
    g.cancel();
    expect(g.pending()).toBe(false);
    expect(g.settle(token)).toBe(false);
  });

  it('keeps working after a cancel', () => {
    const g = createRequestGuard();
    g.begin();
    g.cancel();
    const next = g.begin();
    expect(g.pending()).toBe(true);
    expect(g.settle(next)).toBe(true);
  });

  describe('stale', () => {
    it('is false on the first request — nothing on screen has gone stale yet', () => {
      const g = createRequestGuard();
      g.begin();
      expect(g.pending()).toBe(true);
      expect(g.stale()).toBe(false);
    });

    it('is true while a refinement of an applied result is in flight', () => {
      const g = createRequestGuard();
      const first = g.begin();
      g.settle(first);
      g.begin();

      expect(g.pending()).toBe(true);
      expect(g.stale()).toBe(true);
    });

    it('clears once the refinement lands', () => {
      const g = createRequestGuard();
      g.settle(g.begin());
      const second = g.begin();
      g.settle(second);

      expect(g.stale()).toBe(false);
    });

    /**
     * A cancel is not an answer. If it counted as one the next request would
     * render as a refinement of results that were never applied — the panel
     * would show an empty list marked "updating" instead of a skeleton.
     */
    it('stays false when the only settled token came from a cancel', () => {
      const g = createRequestGuard();
      g.begin();
      g.cancel();
      g.begin();

      expect(g.pending()).toBe(true);
      expect(g.stale()).toBe(false);
    });

    it('is false while idle', () => {
      const g = createRequestGuard();
      g.settle(g.begin());
      expect(g.stale()).toBe(false);
    });
  });

  describe('start', () => {
    it('hands out a live signal and settles through the request', () => {
      const g = createRequestGuard();
      const req = g.start();

      expect(req.signal.aborted).toBe(false);
      expect(g.pending()).toBe(true);
      expect(req.settle()).toBe(true);
      expect(g.pending()).toBe(false);
    });

    it('aborts the older request when a newer one starts', () => {
      const g = createRequestGuard();
      const first = g.start();
      const second = g.start();

      expect(first.signal.aborted).toBe(true);
      expect(second.signal.aborted).toBe(false);
      expect(first.settle()).toBe(false);
    });

    it('aborts with an AbortError, so a fetch rejection is identifiable', () => {
      const g = createRequestGuard();
      const req = g.start();
      g.start();

      expect((req.signal.reason as DOMException).name).toBe('AbortError');
    });

    it('aborts in flight on cancel', () => {
      const g = createRequestGuard();
      const req = g.start();
      g.cancel();

      expect(req.signal.aborted).toBe(true);
      expect(req.settle()).toBe(false);
      expect(g.pending()).toBe(false);
    });

    /**
     * Settling drops the controller without aborting it. Otherwise a `cancel()`
     * on panel-close would abort a request that had already answered — harmless
     * for `fetch`, but it fires `abort` listeners the caller registered for the
     * superseded case only.
     */
    it('does not abort a request that already settled', () => {
      const g = createRequestGuard();
      const req = g.start();
      req.settle();
      g.cancel();

      expect(req.signal.aborted).toBe(false);
    });

    it('supersedes a signalled request from a plain begin()', () => {
      const g = createRequestGuard();
      const req = g.start();
      const token = g.begin();

      expect(req.signal.aborted).toBe(true);
      expect(g.isCurrent(token)).toBe(true);
    });

    it('feeds stale the same way begin() does', () => {
      const g = createRequestGuard();
      g.start().settle();
      g.start();

      expect(g.stale()).toBe(true);
    });
  });
});
