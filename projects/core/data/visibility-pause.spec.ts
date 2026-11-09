import { TestBed } from '@angular/core/testing';
import {
  EnvironmentInjector,
  Injector,
  PLATFORM_ID,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { createVisibilityPause } from './visibility-pause';

/**
 * `createVisibilityPause` directly — every live chart's pause and every gap
 * notice sits on it, and it had no spec of its own.
 *
 * `document.visibilityState` is read-only, so it is redefined per test and a
 * real `visibilitychange` is dispatched. `Date.now` is pinned so a 45-second
 * pause takes no time at all.
 */

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Every injector a test made — destroyed after it, so no listener outlives its test. */
const injectors: EnvironmentInjector[] = [];

function inContext<T>(fn: () => T, platform: 'browser' | 'server' = 'browser'): {
  value: T;
  injector: EnvironmentInjector;
} {
  const injector = createEnvironmentInjector(
    [{ provide: PLATFORM_ID, useValue: platform }],
    TestBed.inject(EnvironmentInjector),
  );
  injectors.push(injector);
  return { value: runInInjectionContext(injector as Injector, fn), injector };
}

let clock = 1_000_000;

beforeEach(() => {
  clock = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  injectors.splice(0).forEach((i) => {
    if (!i.destroyed) i.destroy();
  });
  setVisibility('visible');
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

describe('createVisibilityPause', () => {
  it('starts running, with no pause on record', () => {
    const { value: pause } = inContext(() => createVisibilityPause());
    expect(pause.paused()).toBe(false);
    expect(pause.lastPauseMs()).toBe(0);
  });

  it('pauses on hide and measures the stretch on return', () => {
    const { value: pause } = inContext(() => createVisibilityPause());
    setVisibility('hidden');
    expect(pause.paused()).toBe(true);
    // Nothing is known about the length until the tab is back.
    expect(pause.lastPauseMs()).toBe(0);

    clock += 45_000;
    setVisibility('visible');
    expect(pause.paused()).toBe(false);
    expect(pause.lastPauseMs()).toBe(45_000);
  });

  it('keeps the last pause after resuming, so the gap can still be disclosed', () => {
    const { value: pause } = inContext(() => createVisibilityPause());
    setVisibility('hidden');
    clock += 3_000;
    setVisibility('visible');
    clock += 60_000;
    expect(pause.lastPauseMs()).toBe(3_000);
  });

  it('starts paused in a tab that was born hidden, and measures from creation', () => {
    // A middle-clicked dashboard fires no `visibilitychange` before it is
    // first looked at. Reading the state only on change left its feed running
    // at full price the whole time it sat unseen.
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const { value: pause } = inContext(() => createVisibilityPause());
    const seen: boolean[] = [];
    pause.onChange((p) => seen.push(p));
    expect(pause.paused()).toBe(true);

    clock += 12_000;
    setVisibility('visible');
    expect(pause.paused()).toBe(false);
    expect(pause.lastPauseMs()).toBe(12_000);
    expect(seen).toEqual([false]);
  });

  it('does not restart the clock on a repeated hide', () => {
    // Resetting `hiddenAt` on a second `hidden` would under-report the gap.
    const { value: pause } = inContext(() => createVisibilityPause());
    setVisibility('hidden');
    clock += 10_000;
    setVisibility('hidden');
    clock += 10_000;
    setVisibility('visible');
    expect(pause.lastPauseMs()).toBe(20_000);
  });

  it('treats visible-to-visible as nothing at all, not a pause since the epoch', () => {
    const { value: pause } = inContext(() => createVisibilityPause());
    const seen: boolean[] = [];
    pause.onChange((p) => seen.push(p));
    setVisibility('visible');
    expect(pause.lastPauseMs()).toBe(0);
    expect(seen).toEqual([]);
  });

  it('tells listeners after the signals are updated, and lets them unsubscribe', () => {
    const { value: pause } = inContext(() => createVisibilityPause());
    const seen: [boolean, boolean, number][] = [];
    const off = pause.onChange((p) => seen.push([p, pause.paused(), pause.lastPauseMs()]));

    setVisibility('hidden');
    clock += 5_000;
    setVisibility('visible');
    expect(seen).toEqual([
      [true, true, 0],
      [false, false, 5_000],
    ]);

    off();
    setVisibility('hidden');
    expect(seen).toHaveLength(2);
  });

  it('stops listening when its injector is destroyed', () => {
    const { value: pause, injector } = inContext(() => createVisibilityPause());
    const seen: boolean[] = [];
    pause.onChange((p) => seen.push(p));
    injector.destroy();

    setVisibility('hidden');
    expect(pause.paused()).toBe(false);
    expect(seen).toEqual([]);
  });

  it('stops listening on an explicit destroy', () => {
    const { value: pause } = inContext(() => createVisibilityPause());
    pause.destroy();
    setVisibility('hidden');
    expect(pause.paused()).toBe(false);
  });

  it('never pauses on the server, and registers nothing there', () => {
    // A server render that "paused" would put its disclosure in static HTML.
    const add = vi.spyOn(document, 'addEventListener');
    const { value: pause } = inContext(() => createVisibilityPause(), 'server');
    expect(add).not.toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    const seen: boolean[] = [];
    const off = pause.onChange((p) => seen.push(p));
    setVisibility('hidden');
    expect(pause.paused()).toBe(false);
    expect(seen).toEqual([]);
    expect(() => off()).not.toThrow();
    expect(() => pause.destroy()).not.toThrow();
  });
});
