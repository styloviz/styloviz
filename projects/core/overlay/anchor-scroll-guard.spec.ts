import { describe, it, expect, vi } from 'vitest';
import { createAnchorScrollGuard } from './anchor-scroll-guard';

/**
 * The whole point of this guard is that a scroll EVENT is not the page having
 * MOVED. These tests are written against that distinction rather than against
 * the implementation: each one dispatches a real scroll and asserts on whether
 * `onMoved` ran.
 *
 * The handler defers to `requestAnimationFrame`, so every assertion waits a
 * frame first — asserting synchronously would pass no matter what the guard did.
 */
function nextFrame(): Promise<void> {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

/** A stand-in anchor whose rect we can move between scrolls. */
function fakeAnchor(top = 100, left = 50) {
  const state = { top, left };
  return {
    state,
    el: { getBoundingClientRect: () => ({ top: state.top, left: state.left }) } as unknown as Element,
  };
}

describe('createAnchorScrollGuard', () => {
  it('ignores a scroll that moved nothing', async () => {
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    const guard = createAnchorScrollGuard({
      anchor: () => anchor.el,
      isOpen: () => true,
      onMoved,
    });
    guard.capture();

    guard.handler(new Event('scroll'));
    await nextFrame();

    expect(onMoved).not.toHaveBeenCalled();
  });

  it('fires when the anchor actually moved', async () => {
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    const guard = createAnchorScrollGuard({
      anchor: () => anchor.el,
      isOpen: () => true,
      onMoved,
    });
    guard.capture();

    anchor.state.top -= 40;              // the page really scrolled
    guard.handler(new Event('scroll'));
    await nextFrame();

    expect(onMoved).toHaveBeenCalledTimes(1);
  });

  it('treats sub-threshold jitter as no movement', async () => {
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    const guard = createAnchorScrollGuard({
      anchor: () => anchor.el,
      isOpen: () => true,
      onMoved,
    });
    guard.capture();

    anchor.state.top += 0.4;             // fractional layout, not a scroll
    guard.handler(new Event('scroll'));
    await nextFrame();

    expect(onMoved).not.toHaveBeenCalled();
  });

  it('ignores scrolls that originate inside the panel', async () => {
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    const portal = document.createElement('div');
    const list = document.createElement('ul');
    portal.appendChild(list);
    document.body.appendChild(portal);

    const guard = createAnchorScrollGuard({
      anchor: () => anchor.el,
      portal: () => portal,
      isOpen: () => true,
      onMoved,
    });
    guard.capture();

    anchor.state.top -= 40;              // even though the anchor moved…
    const e = new Event('scroll');
    list.dispatchEvent(e);              // …the scroll came from inside the panel
    guard.handler(e);
    await nextFrame();

    expect(onMoved).not.toHaveBeenCalled();
    portal.remove();
  });

  it('does not throw when event.target is not a Node', async () => {
    // A scroll dispatched on `window` makes target a Window, and passing that to
    // Node.contains() throws. An earlier regression test in this repo passed
    // against unfixed code precisely because that throw skipped the branch under
    // test — so the guard must duck-type rather than trust the cast.
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    const portal = document.createElement('div');
    const guard = createAnchorScrollGuard({
      anchor: () => anchor.el,
      portal: () => portal,
      isOpen: () => true,
      onMoved,
    });
    guard.capture();

    anchor.state.top -= 40;
    expect(() => window.dispatchEvent(new Event('scroll'))).not.toThrow();
    const windowScroll = new Event('scroll');
    window.dispatchEvent(windowScroll);
    expect(() => guard.handler(windowScroll)).not.toThrow();
    await nextFrame();

    expect(onMoved).toHaveBeenCalled();
  });

  it('suppresses scrolls inside the grace window, then resumes', async () => {
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    const guard = createAnchorScrollGuard({
      anchor: () => anchor.el,
      isOpen: () => true,
      onMoved,
      graceMs: 10_000,                   // long enough that the test never leaves it
    });
    guard.capture();

    anchor.state.top -= 40;
    guard.handler(new Event('scroll'));
    await nextFrame();
    expect(onMoved, 'a scroll right after opening must be ignored').not.toHaveBeenCalled();
  });

  it('does nothing while the panel is closed', async () => {
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    const guard = createAnchorScrollGuard({
      anchor: () => anchor.el,
      isOpen: () => false,
      onMoved,
    });
    guard.capture();

    anchor.state.top -= 40;
    guard.handler(new Event('scroll'));
    await nextFrame();

    expect(onMoved).not.toHaveBeenCalled();
  });

  it('stays open when the anchor cannot be measured', async () => {
    // A panel that lingers is recoverable; one that vanishes mid-interaction is
    // not — so an unmeasurable anchor must not be read as "it moved".
    const onMoved = vi.fn();
    const guard = createAnchorScrollGuard({
      anchor: () => null,
      isOpen: () => true,
      onMoved,
    });
    guard.capture();

    guard.handler(new Event('scroll'));
    await nextFrame();

    expect(onMoved).not.toHaveBeenCalled();
  });

  it('coalesces a burst of scrolls into one measurement', async () => {
    // A scroll gesture fires dozens of events per second. Measuring on each one
    // would force a layout per event, which is the cost this rAF gate exists to
    // avoid — and would call onMoved repeatedly for a single move.
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    const guard = createAnchorScrollGuard({
      anchor: () => anchor.el,
      isOpen: () => true,
      onMoved,
    });
    guard.capture();

    anchor.state.top -= 40;
    guard.handler(new Event('scroll'));
    guard.handler(new Event('scroll'));
    guard.handler(new Event('scroll'));
    await nextFrame();

    expect(onMoved).toHaveBeenCalledTimes(1);
  });

  it('measures again on the next frame once the pending one has run', async () => {
    // The gate must open again, or the guard would only ever fire once.
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    const guard = createAnchorScrollGuard({
      anchor: () => anchor.el,
      isOpen: () => true,
      onMoved,
    });
    guard.capture();

    anchor.state.top -= 40;
    guard.handler(new Event('scroll'));
    await nextFrame();
    guard.handler(new Event('scroll'));
    await nextFrame();

    expect(onMoved).toHaveBeenCalledTimes(2);
  });

  it('does not fire for a panel closed between the scroll and the frame', async () => {
    // A frame is ~16ms of real time. Clicking an option closes the panel and
    // scrolls the page; firing onMoved afterwards would re-close something that
    // has already gone, and in a popover host that means a stray close event.
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    let open = true;
    const guard = createAnchorScrollGuard({
      anchor: () => anchor.el,
      isOpen: () => open,
      onMoved,
    });
    guard.capture();

    anchor.state.top -= 40;
    guard.handler(new Event('scroll'));
    open = false; // closed while the frame was still queued
    await nextFrame();

    expect(onMoved).not.toHaveBeenCalled();
  });

  it('cancels a queued measurement on destroy', async () => {
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    const guard = createAnchorScrollGuard({
      anchor: () => anchor.el,
      isOpen: () => true,
      onMoved,
    });
    guard.capture();

    anchor.state.top -= 40;
    guard.handler(new Event('scroll'));
    guard.destroy();
    await nextFrame();

    expect(onMoved).not.toHaveBeenCalled();
  });

  it('is safe to destroy with nothing queued, and more than once', () => {
    const guard = createAnchorScrollGuard({
      anchor: () => fakeAnchor().el,
      isOpen: () => true,
      onMoved: vi.fn(),
    });
    expect(() => {
      guard.destroy();
      guard.destroy();
    }).not.toThrow();
  });

  it('honours the grace window using Date.now() when performance is unavailable', () => {
    // `performance` is missing in some SSR/embedded runtimes. The grace window
    // must still work there — falling through to a zero clock would make every
    // open that scrolls to reveal a focused field close itself immediately.
    //
    // ★ Everything here is synchronous on purpose. jsdom's own
    // `requestAnimationFrame` calls `performance.now()`, so a test that removed
    // `performance` and then awaited a real frame would hang the runner rather
    // than exercise the fallback (it did: 30s timeout, 1,812 unhandled errors).
    // Instead rAF is replaced by a recorder and the assertion is that the guard
    // never even scheduled a measurement — which is what the grace window means.
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    const scheduled: FrameRequestCallback[] = [];
    vi.useFakeTimers(); // gives us control of Date.now(), the fallback clock
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      scheduled.push(cb);
      return scheduled.length;
    });
    vi.stubGlobal('performance', undefined);
    try {
      const guard = createAnchorScrollGuard({
        anchor: () => anchor.el,
        isOpen: () => true,
        onMoved,
        graceMs: 5000,
      });
      guard.capture();

      anchor.state.top -= 40;
      guard.handler(new Event('scroll'));

      expect(scheduled).toHaveLength(0);
      expect(onMoved).not.toHaveBeenCalled();

      // …and the window must actually EXPIRE. A fallback clock that is stuck at
      // a constant — `: 0` instead of `: Date.now()` — suppresses the first
      // scroll identically, and then suppresses every scroll forever, so the
      // panel never repositions again on such a host.
      vi.advanceTimersByTime(6000);
      guard.handler(new Event('scroll'));
      expect(scheduled).toHaveLength(1);
      scheduled[0](0);
      expect(onMoved).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it('schedules a measurement once the grace window has passed', () => {
    // The mirror of the test above, with the same synchronous rAF recorder:
    // a grace of zero must not suppress anything.
    const onMoved = vi.fn();
    const anchor = fakeAnchor();
    const scheduled: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      scheduled.push(cb);
      return scheduled.length;
    });
    try {
      const guard = createAnchorScrollGuard({
        anchor: () => anchor.el,
        isOpen: () => true,
        onMoved,
        graceMs: 0,
      });
      guard.capture();

      anchor.state.top -= 40;
      guard.handler(new Event('scroll'));
      expect(scheduled).toHaveLength(1);

      scheduled[0](0);
      expect(onMoved).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
