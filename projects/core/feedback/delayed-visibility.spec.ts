import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createDelayedVisibility } from './delayed-visibility';

/**
 * FL-J3-OF-06 · OF-18-M2 / OF-17-M4 — a loader that appears only after
 * `showAfterMs` and, once shown, stays `minVisibleMs`. Fake timers: the thing
 * under test IS the clock.
 */
function make(showAfterMs: number, minVisibleMs: number, platform = 'browser') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
  const active = signal(false);
  const visible = TestBed.runInInjectionContext(() =>
    createDelayedVisibility(() => active(), { showAfterMs, minVisibleMs }),
  );
  const flush = () => TestBed.tick();
  flush();
  return { active, visible, flush };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createDelayedVisibility', () => {
  it('follows `active` exactly with both delays at 0', () => {
    const { active, visible, flush } = make(0, 0);
    expect(visible()).toBe(false);
    active.set(true); flush();
    expect(visible()).toBe(true);
    active.set(false); flush();
    expect(visible()).toBe(false);
  });

  it('★ never shows for a wait shorter than showAfterMs — no flash', () => {
    const { active, visible, flush } = make(200, 400);
    active.set(true); flush();
    vi.advanceTimersByTime(150);
    active.set(false); flush();
    vi.advanceTimersByTime(1000);
    expect(visible()).toBe(false);
  });

  it('shows once the wait passes showAfterMs', () => {
    const { active, visible, flush } = make(200, 0);
    active.set(true); flush();
    vi.advanceTimersByTime(199);
    expect(visible()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(visible()).toBe(true);
  });

  it('★ once shown, stays at least minVisibleMs — no flicker', () => {
    const { active, visible, flush } = make(200, 400);
    active.set(true); flush();
    vi.advanceTimersByTime(250); // shown at 200
    expect(visible()).toBe(true);
    active.set(false); flush(); // 50 ms after it appeared
    vi.advanceTimersByTime(349);
    expect(visible()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(visible()).toBe(false);
  });

  it('hides at once when it has already been visible long enough', () => {
    const { active, visible, flush } = make(0, 400);
    active.set(true); flush();
    vi.advanceTimersByTime(1000);
    active.set(false); flush();
    expect(visible()).toBe(false);
  });

  it('a new wait during the minimum keeps it up without restarting anything', () => {
    const { active, visible, flush } = make(0, 400);
    active.set(true); flush();
    active.set(false); flush();
    vi.advanceTimersByTime(100);
    active.set(true); flush();
    vi.advanceTimersByTime(1000);
    expect(visible()).toBe(true);
  });

  it('follows `active` exactly on the server — a delay there would drop the loader from the HTML', () => {
    const { active, visible, flush } = make(200, 400, 'server');
    active.set(true); flush();
    expect(visible()).toBe(true);
    active.set(false); flush();
    expect(visible()).toBe(false);
  });

  it('clears its timers when its injector is destroyed', () => {
    const { active, flush } = make(200, 0);
    active.set(true); flush();
    expect(vi.getTimerCount()).toBe(1);
    TestBed.resetTestingModule();
    expect(vi.getTimerCount()).toBe(0);
  });
});
