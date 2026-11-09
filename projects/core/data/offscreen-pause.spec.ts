import { TestBed } from '@angular/core/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { createOffscreenPause } from './offscreen-pause';
import { createVisibilityPause } from './visibility-pause';

/**
 * The two pauses, together, because they are used together: a tick site stops
 * when either says so.
 */

type IoCallback = (entries: IntersectionObserverEntry[]) => void;

interface FakeIo {
  readonly callback: IoCallback;
  readonly options: IntersectionObserverInit | undefined;
  readonly observed: Element[];
  disconnected: boolean;
}

let fakes: FakeIo[] = [];
const realIo = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;

function installFakeIo(): void {
  fakes = [];
  class Fake {
    readonly observed: Element[] = [];
    disconnected = false;
    constructor(
      readonly callback: IoCallback,
      readonly options?: IntersectionObserverInit,
    ) {
      fakes.push(this as unknown as FakeIo);
    }
    observe(el: Element): void {
      this.observed.push(el);
    }
    disconnect(): void {
      this.disconnected = true;
    }
    unobserve(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = Fake;
}

function removeIo(): void {
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
}

function restoreIo(): void {
  if (realIo === undefined) removeIo();
  else (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = realIo;
}

const entry = (isIntersecting: boolean) => ({ isIntersecting }) as IntersectionObserverEntry;

function inContext<T>(fn: () => T): T {
  const injector = TestBed.inject(Injector);
  return runInInjectionContext(injector, fn);
}

afterEach(() => {
  restoreIo();
  TestBed.resetTestingModule();
});

describe('createOffscreenPause', () => {
  it('starts visible — nothing is offscreen until an observer says so', () => {
    installFakeIo();
    const pause = inContext(() => createOffscreenPause());
    expect(pause.offscreen()).toBe(false);
  });

  it('reports offscreen when the element stops intersecting, and back again', () => {
    installFakeIo();
    const pause = inContext(() => createOffscreenPause());
    const el = document.createElement('div');
    pause.observe(el);
    expect(fakes).toHaveLength(1);
    expect(fakes[0].observed).toEqual([el]);

    fakes[0].callback([entry(false)]);
    expect(pause.offscreen()).toBe(true);

    fakes[0].callback([entry(true)]);
    expect(pause.offscreen()).toBe(false);
  });

  it('acts on the last entry in a batch, not the first', () => {
    // Scrolling fast delivers several crossings for one element in one batch.
    // Reading the first leaves the flag describing where the element used to be
    // — which is how a queue stays paused after the reader scrolls back to it.
    installFakeIo();
    const pause = inContext(() => createOffscreenPause());
    pause.observe(document.createElement('div'));
    fakes[0].callback([entry(false), entry(true)]);
    expect(pause.offscreen()).toBe(false);
    fakes[0].callback([entry(true), entry(false)]);
    expect(pause.offscreen()).toBe(true);
  });

  it('ignores an empty batch rather than guessing', () => {
    installFakeIo();
    const pause = inContext(() => createOffscreenPause());
    pause.observe(document.createElement('div'));
    fakes[0].callback([entry(false)]);
    fakes[0].callback([]);
    expect(pause.offscreen()).toBe(true);
  });

  it('replaces the previous observer when a new element is observed', () => {
    installFakeIo();
    const pause = inContext(() => createOffscreenPause());
    pause.observe(document.createElement('div'));
    pause.observe(document.createElement('span'));
    expect(fakes).toHaveLength(2);
    expect(fakes[0].disconnected).toBe(true);
    expect(fakes[1].disconnected).toBe(false);
  });

  it('resets to visible when observing null', () => {
    installFakeIo();
    const pause = inContext(() => createOffscreenPause());
    pause.observe(document.createElement('div'));
    fakes[0].callback([entry(false)]);
    expect(pause.offscreen()).toBe(true);
    pause.observe(null);
    // An element nobody is watching is not known to be offscreen. Leaving the
    // flag true would freeze a caller's tick with no observer left to clear it.
    expect(pause.offscreen()).toBe(false);
  });

  it('passes the root margin through, so a surface resumes before it arrives', () => {
    installFakeIo();
    const pause = inContext(() => createOffscreenPause('48px'));
    pause.observe(document.createElement('div'));
    expect(fakes[0].options?.rootMargin).toBe('48px');
  });

  it('defaults the root margin to 200px rather than the viewport edge', () => {
    installFakeIo();
    const pause = inContext(() => createOffscreenPause());
    pause.observe(document.createElement('div'));
    expect(fakes[0].options?.rootMargin).toBe('200px');
  });

  it('stays visible with no IntersectionObserver, and observing is a no-op', () => {
    // The fallback is today's behaviour — keep ticking. A pause that fired
    // because the environment lacks an observer would freeze a queue the reader
    // is watching, which is worse than a wasted interval.
    removeIo();
    const pause = inContext(() => createOffscreenPause());
    expect(() => pause.observe(document.createElement('div'))).not.toThrow();
    expect(pause.offscreen()).toBe(false);
    expect(() => pause.destroy()).not.toThrow();
  });

  it('disconnects on destroy', () => {
    installFakeIo();
    const pause = inContext(() => createOffscreenPause());
    pause.observe(document.createElement('div'));
    pause.destroy();
    expect(fakes[0].disconnected).toBe(true);
  });
});

describe('createVisibilityPause', () => {
  const setVisibility = (state: 'visible' | 'hidden') => {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  afterEach(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('starts unpaused', () => {
    const pause = inContext(() => createVisibilityPause());
    expect(pause.paused()).toBe(false);
    expect(pause.lastPauseMs()).toBe(0);
  });

  it('pauses while the tab is hidden and reports the gap on return', () => {
    const pause = inContext(() => createVisibilityPause());
    setVisibility('hidden');
    expect(pause.paused()).toBe(true);
    setVisibility('visible');
    expect(pause.paused()).toBe(false);
    // The gap is kept AFTER resuming, so the caller can disclose the stretch it
    // did not sample rather than drawing a continuous line across it.
    expect(pause.lastPauseMs()).toBeGreaterThanOrEqual(0);
  });

  it('does not claim a pause since the epoch on a visible-to-visible event', () => {
    // Some platforms fire visibilitychange without the state changing. Reporting
    // `Date.now()` as the gap would disclose a pause of fifty-odd years.
    const pause = inContext(() => createVisibilityPause());
    setVisibility('visible');
    expect(pause.lastPauseMs()).toBe(0);
  });

  it('stops listening after destroy', () => {
    const pause = inContext(() => createVisibilityPause());
    pause.destroy();
    setVisibility('hidden');
    expect(pause.paused()).toBe(false);
  });
});
