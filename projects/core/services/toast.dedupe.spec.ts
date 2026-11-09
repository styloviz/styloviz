import { ToastService } from './toast.service';

function svc() {
  return new ToastService();
}

/**
 * `X-12` / `OF-19-I1` — deduplication.
 *
 * The defect is not "identical toasts look untidy". A retry loop that fails
 * eleven times raised eleven toasts into a stack bounded at five, so the
 * eleventh failure evicted every other message in the app — including the ones
 * that explained what to do about it.
 */
describe('ToastService — deduplication', () => {
  it('derives a key from variant, title, message and position', () => {
    const s = svc();
    s.success('Saved', { duration: 0, title: 'Done' });
    const key = s.toasts()[0].dedupeKey;
    expect(key).toContain('success');
    expect(key).toContain('Done');
    expect(key).toContain('Saved');
    expect(key).toContain('top-right');
  });

  it('collapses a repeat into the toast already up, and counts it', () => {
    const s = svc();
    const first = s.error('Sync failed', { duration: 0 });
    const again = s.error('Sync failed', { duration: 0 });

    expect(s.toasts()).toHaveLength(1);
    expect(again).toBe(first);           // the caller's handle still works
    expect(s.toasts()[0].count).toBe(2);
  });

  it('counts every repeat, not just the second', () => {
    const s = svc();
    for (let i = 0; i < 11; i++) s.error('Sync failed', { duration: 0 });
    expect(s.toasts()).toHaveLength(1);
    expect(s.toasts()[0].count).toBe(11);
  });

  it('starts every first occurrence at 1', () => {
    const s = svc();
    s.error('Sync failed', { duration: 0 });
    expect(s.toasts()[0].count).toBe(1);
  });

  it('does not collapse toasts that differ in text, variant or position', () => {
    const s = svc();
    s.error('Sync failed', { duration: 0 });
    s.error('Upload failed', { duration: 0 });
    s.warning('Sync failed', { duration: 0 });
    s.error('Sync failed', { duration: 0, position: 'bottom-left' });
    s.error('Sync failed', { duration: 0, title: 'Error' });

    expect(s.toasts()).toHaveLength(5);
  });

  it('★ keeps its place in the stack rather than jumping to the newest slot', () => {
    // Moving a repeat to the end displaces every toast below it — under a
    // pointer that is hovering the stack to pause it, which is how a user
    // clicks Dismiss on the wrong message.
    const s = svc();
    s.info('first', { duration: 0 });
    s.info('second', { duration: 0 });
    s.info('third', { duration: 0 });

    s.info('first', { duration: 0 });

    expect(s.toasts().map((t) => t.message)).toEqual(['first', 'second', 'third']);
    expect(s.toasts()[0].count).toBe(2);
  });

  it('restarts the countdown from the repeat', () => {
    vi.useFakeTimers();
    try {
      const s = svc();
      s.error('Sync failed', { duration: 4000 });
      vi.advanceTimersByTime(3000);

      s.error('Sync failed', { duration: 4000 });
      // The original deadline passes: the toast must still be up, because the
      // repeat is what the user is now reading.
      vi.advanceTimersByTime(1500);
      expect(s.toasts()).toHaveLength(1);

      vi.advanceTimersByTime(2600);
      expect(s.toasts()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes the newer call’s text and action on an explicit key', () => {
    const s = svc();
    const undo = () => {};
    s.info('Saving…', { duration: 0, dedupeKey: 'record-7' });
    s.success('Saved', { duration: 0, dedupeKey: 'record-7', action: { label: 'Undo', callback: undo } });

    expect(s.toasts()).toHaveLength(1);
    const [t] = s.toasts();
    expect(t.message).toBe('Saved');
    expect(t.variant).toBe('success');
    expect(t.action?.label).toBe('Undo');
    expect(t.count).toBe(2);
  });

  it('dedupeKey: null always adds a toast', () => {
    const s = svc();
    s.error('Sync failed', { duration: 0, dedupeKey: null });
    s.error('Sync failed', { duration: 0, dedupeKey: null });
    expect(s.toasts()).toHaveLength(2);
    expect(s.toasts().map((t) => t.count)).toEqual([1, 1]);
  });

  it('a dismissed toast does not keep deduplicating a later one', () => {
    const s = svc();
    const id = s.error('Sync failed', { duration: 0 });
    s.dismiss(id);

    const second = s.error('Sync failed', { duration: 0 });
    expect(second).not.toBe(id);
    expect(s.toasts()).toHaveLength(1);
    expect(s.toasts()[0].count).toBe(1);
  });

  it('a repeat keeps one timer, not one per occurrence', () => {
    // White-box: two live timers for one toast means the FIRST deadline still
    // fires, dismissing a toast whose countdown had just restarted.
    const s = svc();
    const timers = (s as unknown as { timers: Map<string, unknown> }).timers;
    s.error('Sync failed', { duration: 4000 });
    s.error('Sync failed', { duration: 4000 });
    expect(timers.size).toBe(1);
  });

  it('a repeat of a scoped toast keeps its scope answer', () => {
    const s = svc();
    s.info('about this page', { duration: 0, scope: 'route' });
    s.info('about this page', { duration: 0, scope: 'route' });
    expect(s.toasts()[0].scope).toBe('route');
    s.navigated();
    expect(s.toasts()).toHaveLength(0);
  });
});
