import { signal } from '@angular/core';
import { createWaitEscalation, svFormatExpectedWait } from './wait-escalation';

/**
 * ============================================================================
 *  `createWaitEscalation` — a spinner that has been going for ninety seconds
 * ============================================================================
 *
 * ★★ Fake timers throughout: the thing under test IS the clock, and a spec
 * that waited ten real seconds to assert one transition would be deleted by
 * the next person to run the suite.
 */

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createWaitEscalation', () => {
  it('is idle until something starts waiting', () => {
    const w = createWaitEscalation();
    expect(w.stage()).toBe('idle');
    expect(w.slow()).toBe(false);
    expect(w.stalled()).toBe(false);
  });

  it('escalates waiting → slow → stalled on its two thresholds', () => {
    const w = createWaitEscalation({ slowAfterMs: 10_000, stalledAfterMs: 30_000 });
    w.start();
    expect(w.stage()).toBe('waiting');

    vi.advanceTimersByTime(9_999);
    expect(w.stage()).toBe('waiting');

    vi.advanceTimersByTime(1);
    expect(w.stage()).toBe('slow');
    expect(w.slow()).toBe(true);
    expect(w.stalled()).toBe(false);

    vi.advanceTimersByTime(20_000);
    expect(w.stage()).toBe('stalled');
    expect(w.slow()).toBe(true);     // stalled is slow too — it is worse, not other
    expect(w.stalled()).toBe(true);
  });

  it('★ measures both thresholds from the same start, not one after the other', () => {
    // 30s means "thirty seconds into the wait", not "twenty seconds after it
    // became slow". Chaining the second timer off the first is the easy
    // mistake and it makes `stalledAfterMs` mean something else entirely.
    const w = createWaitEscalation({ slowAfterMs: 10_000, stalledAfterMs: 30_000 });
    w.start();
    vi.advanceTimersByTime(30_000);
    expect(w.stage()).toBe('stalled');
  });

  it('★ a repeated start does NOT restart the clock', () => {
    // ★★★ THE FAILURE MODE THAT LOOKS LIKE THE FEATURE WORKING. Every caller
    //     is an `effect` or a template that runs again for reasons unrelated
    //     to the wait — a keystroke elsewhere, a theme change, a parent
    //     re-render. A restarting `start()` means a busy page never escalates
    //     at all, and the harder the page works the more certain it is.
    const w = createWaitEscalation({ slowAfterMs: 10_000, stalledAfterMs: 30_000 });
    w.start();
    vi.advanceTimersByTime(9_000);
    w.start();
    w.start();
    vi.advanceTimersByTime(1_000);
    expect(w.stage()).toBe('slow');

    // ★ And it does not DEMOTE one either, which is the visible half: a
    //   re-render arriving after the escalation would put the surface back to
    //   "waiting, and that is normal" — thirty seconds into a wait that has
    //   already told the user it is slow.
    w.start();
    expect(w.stage()).toBe('slow');
    vi.advanceTimersByTime(20_000);
    expect(w.stage()).toBe('stalled');
    w.start();
    expect(w.stage()).toBe('stalled');
  });

  it('stop returns to idle and cancels the escalation', () => {
    const w = createWaitEscalation({ slowAfterMs: 10_000, stalledAfterMs: 30_000 });
    w.start();
    w.stop();
    expect(w.stage()).toBe('idle');

    vi.advanceTimersByTime(60_000);
    expect(w.stage()).toBe('idle');
  });

  it('a start after a stop begins a fresh wait', () => {
    const w = createWaitEscalation({ slowAfterMs: 10_000 });
    w.start();
    vi.advanceTimersByTime(9_000);
    w.stop();
    w.start();
    vi.advanceTimersByTime(9_000);
    expect(w.stage()).toBe('waiting');   // not slow: the 9s already spent is gone
    vi.advanceTimersByTime(1_000);
    expect(w.stage()).toBe('slow');
  });

  it('★ never demotes a stalled wait back to slow', () => {
    // A suspended tab, a debugger pause, or a fake clock can fire the timers
    // out of order. "Longer than usual" after "this has stopped being a wait"
    // would be the surface talking itself back down.
    const w = createWaitEscalation({ slowAfterMs: 30_000, stalledAfterMs: 10_000 });
    w.start();
    vi.advanceTimersByTime(10_000);
    expect(w.stage()).toBe('stalled');
    vi.advanceTimersByTime(20_000);
    expect(w.stage()).toBe('stalled');
  });

  it('never escalates when a threshold is zero or negative — off is a value', () => {
    const w = createWaitEscalation({ slowAfterMs: 0, stalledAfterMs: -1 });
    w.start();
    vi.advanceTimersByTime(10 * 60_000);
    expect(w.stage()).toBe('waiting');
  });

  it('reads a signal threshold when the wait starts', () => {
    const slow = signal(5_000);
    const w = createWaitEscalation({ slowAfterMs: slow, stalledAfterMs: 0 });

    w.start();
    vi.advanceTimersByTime(5_000);
    expect(w.stage()).toBe('slow');

    // A host that raises the threshold affects the NEXT wait: the timer for
    // this one is already scheduled, and rescheduling on every input change
    // is how the clock ends up restarting (see the repeated-start case).
    slow.set(1_000);
    w.stop();
    w.start();
    vi.advanceTimersByTime(1_000);
    expect(w.stage()).toBe('slow');
  });

  it('defaults to 10s and 30s', () => {
    const w = createWaitEscalation();
    w.start();
    vi.advanceTimersByTime(10_000);
    expect(w.stage()).toBe('slow');
    vi.advanceTimersByTime(20_000);
    expect(w.stage()).toBe('stalled');
  });

  it('clears its timers on destroy, so nothing fires into a dead component', () => {
    const hooks: (() => void)[] = [];
    const destroyRef = { onDestroy: (fn: () => void) => { hooks.push(fn); return () => undefined; } };
    const w = createWaitEscalation({ slowAfterMs: 10_000, destroyRef: destroyRef as never });

    w.start();
    hooks.forEach((fn) => fn());
    vi.advanceTimersByTime(60_000);

    // The stage is whatever it was — what matters is that no timer ran.
    expect(w.stage()).toBe('waiting');
    expect(vi.getTimerCount()).toBe(0);
  });
});

/**
 * ============================================================================
 *  `svFormatExpectedWait` — the sentence said BEFORE the wait goes wrong
 * ============================================================================
 *
 * ★★ Two rules are under test, and both are asymmetric on purpose: round UP
 * (understating a wait is the lie that matters), and snap to a five-second
 * grid above ten seconds (the figure is a host's estimate, not a measurement).
 */
describe('svFormatExpectedWait', () => {
  it('states seconds below a minute', () => {
    expect(svFormatExpectedWait(8_000)).toBe('about 8 seconds');
  });

  it('says "1 second" in the singular', () => {
    expect(svFormatExpectedWait(1_000)).toBe('about 1 second');
  });

  it('rounds a sub-second figure up to one second rather than to zero', () => {
    // "about 0 seconds" is not a sentence. A host passing 200ms has made a
    // units mistake; the component still has to render something true — and
    // rounding up is what makes that so, which is why the explicit floor this
    // once had was deleted rather than kept for reassurance.
    expect(svFormatExpectedWait(200)).toBe('about 1 second');
    expect(svFormatExpectedWait(1)).toBe('about 1 second');
  });

  it('never understates: 6.2s is "7 seconds", not "6"', () => {
    expect(svFormatExpectedWait(6_200)).toBe('about 7 seconds');
  });

  it('snaps to five seconds above ten, upwards', () => {
    expect(svFormatExpectedWait(23_000)).toBe('about 25 seconds');
    expect(svFormatExpectedWait(11_000)).toBe('about 15 seconds');
    expect(svFormatExpectedWait(15_000)).toBe('about 15 seconds');
  });

  it('keeps the second-level grid at exactly ten seconds', () => {
    // The boundary is inclusive below, so a stated 10s is not inflated to 10
    // by a coarser grid it does not need.
    expect(svFormatExpectedWait(10_000)).toBe('about 10 seconds');
  });

  it('switches to minutes at a minute, in the singular', () => {
    expect(svFormatExpectedWait(60_000)).toBe('about 1 minute');
  });

  it('lets the five-second snap carry a near-minute INTO minutes', () => {
    // 59s snaps to 60, and 60 seconds is called a minute. Naming the unit
    // before applying the grid produced "about 60 seconds", which is a
    // sentence nobody says.
    expect(svFormatExpectedWait(59_000)).toBe('about 1 minute');
  });

  it('rounds minutes up too', () => {
    expect(svFormatExpectedWait(61_000)).toBe('about 2 minutes');
    expect(svFormatExpectedWait(150_000)).toBe('about 3 minutes');
  });

  it('returns null for anything that is not a positive finite duration', () => {
    expect(svFormatExpectedWait(0)).toBeNull();
    expect(svFormatExpectedWait(-1)).toBeNull();
    expect(svFormatExpectedWait(Number.NaN)).toBeNull();
    expect(svFormatExpectedWait(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
