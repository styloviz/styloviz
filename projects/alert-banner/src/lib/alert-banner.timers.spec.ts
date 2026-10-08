import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAlertBannerComponent } from './alert-banner.component';

/**
 * Auto-dismiss, and the WCAG 2.2.1 requirement that a timed message can be
 * paused while the user is reading it.
 *
 * ★ Fake timers throughout this file, deliberately. The countdown arithmetic is
 * `Date.now() - startedAt`, so the test has to CONTROL the clock rather than
 * wait on it: the assertions are about how much time is left, which real time
 * cannot be interrogated for. Vitest's fake timers mock `Date` as well as
 * `setTimeout`, which is what makes the remaining-time assertions exact rather
 * than approximate. (The `@testing/async` helpers are for waiting on a
 * component's own real timer — a different job, and used in the sibling specs.)
 *
 * ★ REGRESSION GUARD — Phase 4 finding (PHASE4_OVERLAYS_FEEDBACK_AUDIT.md, P3).
 *   The two destroy tests at the bottom of this file exist because the defect
 *   they describe SHIPPED: `SvAlertBannerComponent` had no `OnDestroy`, so a
 *   banner removed by its parent (an `@if` flipping false) mid-countdown left
 *   BOTH timers running — and the close-transition timer calls
 *   `dismissed.emit()`, firing an output from a destroyed component.
 *
 *     • "cancels both timers when the component goes away mid-countdown"
 *     • "has nothing to cancel when it is destroyed untouched"  ← the companion
 *       that stops the first one passing for the wrong reason
 *
 *   They are not redundant with the pause/close tests above, which only prove
 *   the timers are cleared on paths the component itself drives. DO NOT DELETE
 *   either in a "we already test timer cleanup" refactor.
 *   Closed 2026-09-14 (`X-2` / `X-3`).
 */

async function setup(inputs: Record<string, unknown> = {}, serverPlatform = false) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAlertBannerComponent, {
    inputs,
    providers: serverPlatform ? [{ provide: PLATFORM_ID, useValue: 'server' }] : [],
  });
  return fixture;
}

describe('SvAlertBannerComponent — auto-dismiss', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('never starts a countdown when autoDismissMs is zero', async () => {
    const f = await setup();
    vi.advanceTimersByTime(60_000);
    expect(f.componentInstance.isVisible()).toBe(true);
    expect(f.componentInstance.isClosing()).toBe(false);
  });

  it('never starts a countdown for a negative autoDismissMs', async () => {
    const f = await setup({ autoDismissMs: -1000 });
    vi.advanceTimersByTime(60_000);
    expect(f.componentInstance.isVisible()).toBe(true);
  });

  it('closes itself once the countdown runs out', async () => {
    const f = await setup({ autoDismissMs: 5_000 });
    const seen: void[] = [];
    f.componentInstance.dismissed.subscribe(() => seen.push(undefined));

    vi.advanceTimersByTime(4_999);
    expect(f.componentInstance.isClosing()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(f.componentInstance.isClosing()).toBe(true);
    // Still on screen until the exit transition finishes.
    expect(f.componentInstance.isVisible()).toBe(true);
    expect(seen).toEqual([]);

    vi.advanceTimersByTime(300);
    expect(f.componentInstance.isVisible()).toBe(false);
    expect(seen.length).toBe(1);
  });

  it('★ starts no timer at all when rendered on the server', async () => {
    // SSR fork: `setTimeout` on the server holds the render open and the alert
    // would "dismiss" into a document nobody is looking at.
    // Filtered by delay: Angular's own bootstrap schedules timers too, so a
    // bare "was setTimeout called" assertion would fail for the wrong reason.
    const scheduled = vi.spyOn(globalThis, 'setTimeout');
    const f = await setup({ autoDismissMs: 5_000 }, true);
    expect(scheduled.mock.calls.filter(([, ms]) => ms === 5_000)).toEqual([]);

    vi.advanceTimersByTime(60_000);
    expect(f.componentInstance.isVisible()).toBe(true);
    expect(f.componentInstance.isClosing()).toBe(false);
    scheduled.mockRestore();
  });
});

describe('SvAlertBannerComponent — pausing while it is being read', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /**
   * ★ Was `[aria-live]`. The banner root no longer carries it — announcing
   *   moved to the shared region (`X-9`) — but it is still the element with
   *   the pointer and focus handlers, so this queries what it actually is.
   */
  const banner = (f: { nativeElement: unknown }) =>
    (f.nativeElement as HTMLElement).querySelector<HTMLElement>('[role="status"]')!;

  it('holds the countdown while the pointer is over it and resumes with the time that was left', async () => {
    const f = await setup({ autoDismissMs: 5_000 });

    vi.advanceTimersByTime(3_000);
    banner(f).dispatchEvent(new MouseEvent('mouseenter'));

    // Paused: no amount of time may close it.
    vi.advanceTimersByTime(60_000);
    expect(f.componentInstance.isClosing()).toBe(false);

    banner(f).dispatchEvent(new MouseEvent('mouseleave'));
    // 2 s were left, not the original 5 s.
    vi.advanceTimersByTime(1_999);
    expect(f.componentInstance.isClosing()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(f.componentInstance.isClosing()).toBe(true);
  });

  it('pauses and resumes on keyboard focus too, not just the pointer', async () => {
    const f = await setup({ autoDismissMs: 4_000 });

    vi.advanceTimersByTime(1_000);
    banner(f).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(60_000);
    expect(f.componentInstance.isClosing()).toBe(false);

    banner(f).dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    vi.advanceTimersByTime(3_000);
    expect(f.componentInstance.isClosing()).toBe(true);
  });

  it('does nothing on hover when there is no countdown to pause', async () => {
    const f = await setup();
    banner(f).dispatchEvent(new MouseEvent('mouseenter'));
    banner(f).dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(60_000);
    expect(f.componentInstance.isVisible()).toBe(true);
  });

  it('ignores a second pause while already paused', async () => {
    // Otherwise the second pause subtracts the elapsed time twice and the
    // remaining countdown collapses to zero.
    const f = await setup({ autoDismissMs: 5_000 });
    vi.advanceTimersByTime(1_000);

    f.componentInstance.pauseAutoDismiss();
    vi.advanceTimersByTime(3_000);
    f.componentInstance.pauseAutoDismiss(); // no-op
    f.componentInstance.resumeAutoDismiss();

    vi.advanceTimersByTime(3_999);
    expect(f.componentInstance.isClosing()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(f.componentInstance.isClosing()).toBe(true);
  });

  it('stays put rather than closing instantly when the clock jumped past the deadline', async () => {
    // The wall clock can outrun a pending `setTimeout`: a backgrounded tab has
    // its timers throttled, and a sleeping machine stops running them
    // altogether. `setSystemTime` reproduces exactly that — Date moves, the
    // pending timer does not fire.
    //
    // The user then hovers (pause) and leaves (resume) with a NEGATIVE amount
    // of time left. `startAutoDismiss` declines to schedule anything, so the
    // banner stays on screen instead of vanishing the instant the machine wakes
    // — which is the right failure for a message the user may not have read.
    const f = await setup({ autoDismissMs: 5_000 });

    vi.setSystemTime(Date.now() + 6_000);
    f.componentInstance.pauseAutoDismiss();

    const scheduled = vi.spyOn(globalThis, 'setTimeout');
    f.componentInstance.resumeAutoDismiss();
    expect(scheduled).not.toHaveBeenCalled();
    scheduled.mockRestore();

    vi.advanceTimersByTime(60_000);
    expect(f.componentInstance.isVisible()).toBe(true);
    expect(f.componentInstance.isClosing()).toBe(false);
  });

  it('ignores a resume while the countdown is already running', async () => {
    // A duplicate timer would fire the close twice.
    const f = await setup({ autoDismissMs: 5_000 });
    const scheduled = vi.spyOn(globalThis, 'setTimeout');
    f.componentInstance.resumeAutoDismiss();
    expect(scheduled).not.toHaveBeenCalled();
    scheduled.mockRestore();
  });

  it('refuses to resume once the alert is already closing', async () => {
    // `focusout` fires as the dismiss button disappears; restarting the
    // countdown there would resurrect a banner on its way out.
    const f = await setup({ autoDismissMs: 5_000 });
    const seen: void[] = [];
    f.componentInstance.dismissed.subscribe(() => seen.push(undefined));

    f.componentInstance.close();
    expect(f.componentInstance.isClosing()).toBe(true);

    f.componentInstance.resumeAutoDismiss();
    vi.advanceTimersByTime(300);
    expect(f.componentInstance.isVisible()).toBe(false);
    expect(seen.length).toBe(1);

    // ★ The emission count is the assertion that matters, not visibility.
    // Without the `isClosing` guard a fresh countdown starts here and fires
    // `close()` a second time 5 s later — the banner still LOOKS gone, but the
    // host is told to remove it twice, so a list splice removes the wrong row
    // and an analytics event is double-counted.
    vi.advanceTimersByTime(60_000);
    expect(f.componentInstance.isVisible()).toBe(false);
    expect(seen.length).toBe(1);
  });
});

describe('SvAlertBannerComponent — closing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cancels a running countdown when dismissed by hand', async () => {
    const f = await setup({ autoDismissMs: 5_000 });
    const seen: void[] = [];
    f.componentInstance.dismissed.subscribe(() => seen.push(undefined));

    vi.advanceTimersByTime(1_000);
    f.componentInstance.close();
    vi.advanceTimersByTime(60_000);

    // Exactly one dismissal — the auto-dismiss timer must not fire as well.
    expect(seen.length).toBe(1);
  });

  it('removes itself from the document, and does not come back', async () => {
    const f = await setup({ message: 'Saved' });
    expect((f.nativeElement as HTMLElement).textContent).toContain('Saved');

    (f.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button[aria-label="Dismiss alert"]')!
      .click();
    vi.advanceTimersByTime(300);
    f.detectChanges();

    expect((f.nativeElement as HTMLElement).textContent).not.toContain('Saved');
    // Re-rendering the same fixture must not resurrect it.
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).not.toContain('Saved');
  });

  it('cancels both timers when the component goes away mid-countdown', async () => {
    // ★ REGRESSION GUARD (Phase 4, P3). `SvAlertBannerComponent` had no
    // `OnDestroy`: a banner removed by its parent mid-countdown left BOTH the
    // auto-dismiss timer and the 300 ms exit-transition timer running, and the
    // latter's callback runs `isVisible.set(false)` then `dismissed.emit()`.
    //
    // ★★ WHAT TO ASSERT, AND WHY NOT THE OBVIOUS THING. The original symptom
    //    was "an output fires after destroy" — but Angular 21 refuses that
    //    emit itself (NG0953) and the subscriber never hears it, so an
    //    emission-count assertion PASSES WITH THE LEAK IN PLACE. Verified by
    //    mutation: delete the `closeTimer` clear from `ngOnDestroy` and a
    //    `dismissed` spy still sees nothing. The framework absorbs the visible
    //    half of this bug; the timer body still runs.
    //
    //    So the assertions below are the two that actually fail when the guard
    //    is removed: the state the callback would have written (`isVisible`),
    //    and the NG0953 the blocked emit logs.
    // Swallowed rather than passed through: NG0953 would otherwise print on a
    // failing run and read as a test-harness problem instead of the assertion.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const f = await setup({ autoDismissMs: 5_000 });
    const seen: void[] = [];
    f.componentInstance.dismissed.subscribe(() => seen.push(undefined));

    f.componentInstance.close(); // starts the 300 ms exit-transition timer
    expect(f.componentInstance.isClosing()).toBe(true);
    expect(f.componentInstance.isVisible()).toBe(true); // transition pending
    expect(seen).toEqual([]);

    f.destroy();
    // Past both deadlines — the 300 ms transition and the 5 s auto-dismiss.
    vi.advanceTimersByTime(60_000);

    // ① The callback never ran, so the state it would have written is untouched.
    expect(f.componentInstance.isVisible()).toBe(true);
    // ② …and nothing tried to emit out of a destroyed component.
    expect(errors).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
    errors.mockRestore();
  });

  it('has nothing to cancel when it is destroyed untouched', async () => {
    // The companion to the test above: without it, an `ngOnDestroy` that called
    // `clearTimeout(null)` unconditionally would satisfy the spy and prove
    // nothing. No countdown was started here, so there is nothing to clear.
    const f = await setup();
    const cleared = vi.spyOn(globalThis, 'clearTimeout');
    f.destroy();
    expect(cleared).not.toHaveBeenCalled();
    cleared.mockRestore();
  });
});
