import { TestBed } from '@angular/core/testing';
import {
  EnvironmentInjector,
  Injector,
  PLATFORM_ID,
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { createLiveTicker, type SvLiveTickerOptions } from './live-ticker';

/**
 * The ticker's two promises:
 *
 * ONE — hidden means the interval is CLEARED, not skipped. A skipped tick is a
 * timer still firing, and in a zone.js host a change-detection pass.
 *
 * TWO — the gap notice is about this ticker. A hidden stretch while it was not
 * running (user-paused, or a host-fed chart with no generator) is not a hole
 * this ticker made, and must not be reported as one.
 */

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Every injector a test made — destroyed after it, so no ticker outlives its test. */
const injectors: EnvironmentInjector[] = [];

function make(
  overrides: Partial<SvLiveTickerOptions> = {},
  platform: 'browser' | 'server' = 'browser',
) {
  const enabled = signal(true);
  const ms = signal(100);
  let ticks = 0;
  const injector = createEnvironmentInjector(
    [{ provide: PLATFORM_ID, useValue: platform }],
    TestBed.inject(EnvironmentInjector),
  );
  injectors.push(injector);
  const ticker = runInInjectionContext(injector as Injector, () =>
    createLiveTicker({
      tick: () => (ticks += 1),
      intervalMs: () => ms(),
      enabled: () => enabled(),
      ...overrides,
    }),
  );
  return { ticker, enabled, ms, injector, ticks: () => ticks };
}

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));

afterEach(() => {
  injectors.splice(0).forEach((i) => {
    if (!i.destroyed) i.destroy();
  });
  setVisibility('visible');
  vi.useRealTimers();
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

describe('createLiveTicker — the interval', () => {
  it('does nothing until synced, then ticks on the interval', () => {
    const t = make();
    vi.advanceTimersByTime(500);
    expect(t.ticks()).toBe(0);
    expect(t.ticker.active()).toBe(false);

    t.ticker.sync();
    expect(t.ticker.active()).toBe(true);
    vi.advanceTimersByTime(350);
    expect(t.ticks()).toBe(3);
  });

  it('never schedules a second interval on a repeated sync', () => {
    const t = make();
    const set = vi.spyOn(globalThis, 'setInterval');
    t.ticker.sync();
    t.ticker.sync();
    t.ticker.sync();
    expect(set).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(t.ticks()).toBe(1);
  });

  it('stops when disabled and restarts when enabled again', () => {
    const t = make();
    t.ticker.sync();
    t.enabled.set(false);
    t.ticker.sync();
    expect(t.ticker.active()).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(t.ticks()).toBe(0);

    t.enabled.set(true);
    t.ticker.sync();
    vi.advanceTimersByTime(100);
    expect(t.ticks()).toBe(1);
  });

  it('re-creates the interval when its period changes', () => {
    const t = make();
    t.ticker.sync();
    t.ms.set(1_000);
    t.ticker.sync();
    vi.advanceTimersByTime(900);
    expect(t.ticks()).toBe(0);
    vi.advanceTimersByTime(100);
    expect(t.ticks()).toBe(1);
  });

  it('stays off for a zero, negative or non-finite period', () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const t = make();
      t.ms.set(bad);
      t.ticker.sync();
      expect(t.ticker.active()).toBe(false);
    }
  });

  it('never schedules on the server', () => {
    const t = make({}, 'server');
    const set = vi.spyOn(globalThis, 'setInterval');
    t.ticker.sync();
    expect(set).not.toHaveBeenCalled();
    expect(t.ticker.active()).toBe(false);
  });

  it('clears the interval when its injector is destroyed', () => {
    const t = make();
    t.ticker.sync();
    t.injector.destroy();
    expect(t.ticker.active()).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(t.ticks()).toBe(0);
  });
});

describe('createLiveTicker — a hidden tab', () => {
  it('CLEARS the interval while hidden, rather than skipping ticks', () => {
    const t = make();
    t.ticker.sync();
    const clear = vi.spyOn(globalThis, 'clearInterval');

    setVisibility('hidden');
    expect(clear).toHaveBeenCalledTimes(1);
    expect(t.ticker.active()).toBe(false);
    // No timer is pending at all — not one that fires and returns early.
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5_000);
    expect(t.ticks()).toBe(0);
  });

  it('re-creates the interval on return', () => {
    const t = make();
    t.ticker.sync();
    setVisibility('hidden');
    setVisibility('visible');
    expect(t.ticker.active()).toBe(true);
    vi.advanceTimersByTime(100);
    expect(t.ticks()).toBe(1);
  });

  it('does not start while hidden, even when asked to', () => {
    const t = make();
    setVisibility('hidden');
    t.ticker.sync();
    expect(t.ticker.active()).toBe(false);
    setVisibility('visible');
    expect(t.ticker.active()).toBe(true);
  });

  it('never starts in a tab that was born hidden, and owes no gap for it', () => {
    // No `visibilitychange` fires for a tab opened in the background, so the
    // ticker has to read the state it was created in.
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const t = make();
    t.ticker.sync();
    expect(t.ticker.active()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(30_000);
    expect(t.ticks()).toBe(0);

    setVisibility('visible');
    expect(t.ticker.active()).toBe(true);
    // It never ran, so it stopped nothing: the history starts here.
    expect(t.ticker.gapMs()).toBe(0);
    vi.advanceTimersByTime(100);
    expect(t.ticks()).toBe(1);
  });

  it('reports the gap it made', () => {
    const t = make();
    t.ticker.sync();
    setVisibility('hidden');
    vi.advanceTimersByTime(45_000);
    setVisibility('visible');
    expect(t.ticker.gapMs()).toBe(45_000);
    expect(t.ticker.notice()).toContain('45 seconds');
    expect(t.ticks()).toBe(0);
  });

  it('stays quiet about a tab switch under the floor', () => {
    const t = make();
    t.ticker.sync();
    setVisibility('hidden');
    vi.advanceTimersByTime(500);
    setVisibility('visible');
    expect(t.ticker.gapMs()).toBe(500);
    expect(t.ticker.notice()).toBeNull();
  });

  it('reports nothing for a stretch it was not running through', () => {
    // A user-paused chart, or a host-fed one with no generator: the tab hid,
    // but this ticker was sampling nothing, so it made no hole.
    const t = make();
    t.enabled.set(false);
    t.ticker.sync();
    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    setVisibility('visible');
    expect(t.ticker.gapMs()).toBe(0);
    expect(t.ticker.notice()).toBeNull();
  });

  it('reports nothing when it was disabled after the last sync', () => {
    // The interval was still scheduled, but the component had stopped wanting
    // a generator (a host started supplying data) — it was not generating.
    const t = make();
    t.ticker.sync();
    t.enabled.set(false);
    setVisibility('hidden');
    vi.advanceTimersByTime(60_000);
    setVisibility('visible');
    expect(t.ticker.gapMs()).toBe(0);
    expect(t.ticker.active()).toBe(false);
  });

  it('forgets the gap on request, e.g. when the history it described is reset', () => {
    const t = make();
    t.ticker.sync();
    setVisibility('hidden');
    vi.advanceTimersByTime(30_000);
    setVisibility('visible');
    expect(t.ticker.gapMs()).toBe(30_000);

    t.ticker.clearGap();
    expect(t.ticker.gapMs()).toBe(0);
    expect(t.ticker.notice()).toBeNull();
  });
});
