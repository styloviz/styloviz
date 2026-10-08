import { ToastService } from './toast.service';

/** Fresh service per test — it holds signal state, so isolation matters. */
function svc() {
  return new ToastService();
}

describe('ToastService — creating toasts', () => {
  it('success() appends a toast and returns its id', () => {
    const s = svc();
    const id = s.success('Saved', { duration: 0 });
    expect(s.toasts()).toHaveLength(1);
    expect(s.toasts()[0].id).toBe(id);
    expect(s.toasts()[0].variant).toBe('success');
    expect(s.toasts()[0].position).toBe('top-right'); // default
  });

  it('error() defaults to the error variant and a longer duration', () => {
    const s = svc();
    s.error('Boom');
    expect(s.toasts()[0].variant).toBe('error');
    expect(s.toasts()[0].duration).toBe(6000);
  });

  it('respects an explicit position', () => {
    const s = svc();
    s.info('Hi', { duration: 0, position: 'bottom-left' });
    expect(s.toasts()[0].position).toBe('bottom-left');
  });
});

describe('ToastService — dismissing', () => {
  it('dismiss() removes a single toast by id', () => {
    const s = svc();
    const a = s.success('A', { duration: 0 });
    s.success('B', { duration: 0 });
    s.dismiss(a);
    expect(s.toasts().map((t) => t.message)).toEqual(['B']);
  });

  it('dismissAll() clears everything', () => {
    const s = svc();
    s.success('A', { duration: 0 });
    s.warning('B', { duration: 0 });
    s.dismissAll();
    expect(s.toasts()).toEqual([]);
  });
});

describe('ToastService — auto-dismiss timer', () => {
  it('removes a toast automatically after its duration', () => {
    vi.useFakeTimers();
    try {
      const s = svc();
      s.success('Temp', { duration: 100 });
      expect(s.toasts()).toHaveLength(1);
      vi.advanceTimersByTime(100);
      expect(s.toasts()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps persistent toasts (duration 0) indefinitely', () => {
    vi.useFakeTimers();
    try {
      const s = svc();
      s.success('Sticky', { duration: 0 });
      vi.advanceTimersByTime(10_000);
      expect(s.toasts()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('defaults to 4 s when no duration is given', () => {
    vi.useFakeTimers();
    try {
      const s = svc();
      s.success('Saved');
      expect(s.toasts()[0].duration).toBe(4000);
      expect(s.toasts()[0].dismissible).toBe(true); // the other default
      vi.advanceTimersByTime(3999);
      expect(s.toasts()).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(s.toasts()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels the timer when the toast is dismissed by hand', () => {
    // Otherwise the timer fires later against an id that is gone. Harmless
    // today, but it also means dismissAll() cannot be trusted to have stopped
    // everything.
    vi.useFakeTimers();
    try {
      const s = svc();
      s.success('A', { duration: 100 });
      const b = s.success('B', { duration: 100 });
      s.dismiss(b);
      vi.advanceTimersByTime(100);
      expect(s.toasts()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * Pause/resume exists so a toast does not disappear while the pointer is over
 * the stack and the user is reading it. What matters is that the *remaining*
 * time is preserved — resuming with a fresh full duration would be a different,
 * and wrong, behaviour that a simple "still there after resume" test cannot
 * tell apart.
 */
describe('ToastService — pause and resume', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds a paused toast open past its original deadline', () => {
    const s = svc();
    const id = s.success('Hover me', { duration: 1000 });
    vi.advanceTimersByTime(400);
    s.pause(id);
    vi.advanceTimersByTime(5000);
    expect(s.toasts()).toHaveLength(1);
  });

  it('resumes with the time that was left, not a fresh full duration', () => {
    const s = svc();
    const id = s.success('Hover me', { duration: 1000 });
    vi.advanceTimersByTime(400);
    s.pause(id);
    vi.advanceTimersByTime(5000); // paused: the clock does not count
    s.resume(id);

    vi.advanceTimersByTime(599);
    expect(s.toasts()).toHaveLength(1); // 600ms were left
    vi.advanceTimersByTime(1);
    expect(s.toasts()).toHaveLength(0);
  });

  it('ignores resume on a toast that is still running, so a later pause still holds', () => {
    // Pointer moving between stacked toasts fires enter/leave in pairs that can
    // arrive out of order, so `resume` on a *live* toast is a real event.
    //
    // ★ Why the pause afterwards is the load-bearing part: resuming a live
    // timer starts a second timeout and overwrites the map entry with its
    // handle, orphaning the first. Nothing looks wrong yet — both fire around
    // the same time. But the orphan can no longer be cleared, so the next
    // `pause` cancels only the newer one and the toast vanishes from under the
    // pointer that is holding it open. Without this second half the test cannot
    // tell the guarded implementation from the unguarded one.
    const s = svc();
    const id = s.success('Live', { duration: 1000 });
    vi.advanceTimersByTime(900);

    s.resume(id); // stray resume — must be a no-op
    s.pause(id); // the user is now hovering

    vi.advanceTimersByTime(5000);
    expect(s.toasts()).toHaveLength(1);
  });

  it('ignores a second pause while already paused', () => {
    // ★ REGRESSION GUARD (T0-1). `sv-toast-host` calls `pauseAll()` from BOTH
    //   `mouseenter` and `focusin`, so hovering a toast and then tabbing into
    //   its action button pauses it twice. Without the `!timer.handle` guard the
    //   second call subtracts the same elapsed span from `remaining` again.
    //
    // ★★ The numbers are chosen so the bug is unambiguous rather than
    //    marginal. 400 ms elapse before the first pause, leaving 600. The
    //    second pause subtracts that 400 a second time, leaving 200 — so the
    //    toast dies 400 ms early, and the 599/1 split below lands on either
    //    side of it: an unguarded implementation is already gone at 599.
    const s = svc();
    const id = s.success('Hover then tab', { duration: 1000 });
    vi.advanceTimersByTime(400);

    s.pause(id); // mouseenter
    s.pause(id); // focusin — must be a no-op

    vi.advanceTimersByTime(5000); // paused: the clock does not count
    s.resume(id);

    vi.advanceTimersByTime(599);
    expect(s.toasts()).toHaveLength(1); // 600 ms were left, not 200
    vi.advanceTimersByTime(1);
    expect(s.toasts()).toHaveLength(0);
  });

  it('still dismisses on time when a stray resume arrives and no pause follows', () => {
    const s = svc();
    const id = s.success('Live', { duration: 1000 });
    vi.advanceTimersByTime(900);
    s.resume(id);
    vi.advanceTimersByTime(100);
    expect(s.toasts()).toHaveLength(0);
  });

  it('does nothing for an id that has no timer', () => {
    const s = svc();
    const persistent = s.success('Sticky', { duration: 0 });
    expect(() => {
      s.pause(persistent);
      s.resume(persistent);
      s.pause('svz-toast-does-not-exist');
      s.resume('svz-toast-does-not-exist');
    }).not.toThrow();
    vi.advanceTimersByTime(10_000);
    // Assert the negative: none of those calls may have started a countdown.
    expect(s.toasts()).toHaveLength(1);
  });

  it('dismissAll() stops a paused toast from ever coming back', () => {
    const s = svc();
    const id = s.success('A', { duration: 1000 });
    s.pause(id);
    s.dismissAll();
    s.resume(id);
    vi.advanceTimersByTime(10_000);
    expect(s.toasts()).toEqual([]);
  });
});
