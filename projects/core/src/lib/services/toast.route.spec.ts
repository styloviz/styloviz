import { ToastService } from './toast.service';

/** Fresh service per test — it holds signal state, so isolation matters. */
function svc() {
  return new ToastService();
}

/**
 * `X-13` / `OF-19-I5` — what a route change does to the toasts on screen.
 *
 * The decision under test is the DEFAULT, not the mechanism: a toast survives
 * navigation unless its caller said otherwise, because the toast that matters
 * most is the one raised by the action that navigated.
 */
describe('ToastService — route scope', () => {
  it('defaults to global scope', () => {
    const s = svc();
    s.success('Saved', { duration: 0 });
    expect(s.toasts()[0].scope).toBe('global');
  });

  it('records an explicit route scope', () => {
    const s = svc();
    s.error('Could not load this view', { duration: 0, scope: 'route' });
    expect(s.toasts()[0].scope).toBe('route');
  });

  it('★ a success toast raised by a navigating save SURVIVES the navigation', () => {
    const s = svc();
    s.success('Invoice saved', { duration: 0 });
    s.navigated();
    expect(s.toasts().map((t) => t.message)).toEqual(['Invoice saved']);
  });

  it('drops route-scoped toasts on navigation', () => {
    const s = svc();
    s.info('3 filters could not be applied to this view', {
      duration: 0,
      scope: 'route',
    });
    s.navigated();
    expect(s.toasts()).toHaveLength(0);
  });

  it('drops only the route-scoped ones from a mixed stack, keeping order', () => {
    const s = svc();
    s.success('Saved', { duration: 0 });
    s.warning('This page is out of date', { duration: 0, scope: 'route' });
    s.info('Export ready', { duration: 0 });
    s.error('This view failed to load', { duration: 0, scope: 'route' });

    s.navigated();

    expect(s.toasts().map((t) => t.message)).toEqual(['Saved', 'Export ready']);
  });

  it('navigated() is a no-op when nothing is on screen', () => {
    const s = svc();
    expect(() => s.navigated()).not.toThrow();
    expect(s.toasts()).toHaveLength(0);
  });

  it('is a point in time, not a mode — a route toast raised after it stays', () => {
    const s = svc();
    s.navigated();
    s.error('This view failed to load', { duration: 0, scope: 'route' });
    expect(s.toasts()).toHaveLength(1);
  });

  /**
   * White-box on purpose. A leaked timer has NO observable effect through the
   * public API — it fires `dismiss(id)` for an id nothing holds, and that
   * filters nothing out. The consequence is the `timers` map growing by one
   * entry per route-scoped toast for the life of the app, which is only
   * visible from inside. Asserting the bookkeeping is the only way to state
   * the invariant at all, so it is asserted here rather than left to a comment.
   */
  it('clears the auto-dismiss bookkeeping of every toast it drops', () => {
    const s = svc();
    const timers = (s as unknown as { timers: Map<string, unknown> }).timers;

    s.info('stale', { duration: 4000, scope: 'route' });
    s.success('Saved', { duration: 4000 });
    expect(timers.size).toBe(2);

    s.navigated();

    expect(s.toasts().map((t) => t.message)).toEqual(['Saved']);
    expect(timers.size).toBe(1);
  });

  it('a surviving global toast keeps its own countdown running', () => {
    vi.useFakeTimers();
    try {
      const s = svc();
      s.success('Saved', { duration: 4000 });
      s.navigated();
      expect(s.toasts()).toHaveLength(1);
      vi.advanceTimersByTime(4000);
      expect(s.toasts()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
