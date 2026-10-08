import { onReducedMotionChange, prefersReducedMotion } from './reduced-motion';

/**
 * `prefers-reduced-motion` is a *decision input*, not a style. Every animated
 * component in the kit asks these two functions whether it may move, so the
 * cases that matter are the ones where the browser cannot answer: SSR (no
 * `window`) and any host without `matchMedia`. Both must read as "no preference
 * expressed" rather than throwing — a thrown error here takes the whole chart
 * down with it, which is exactly the failure `sv-chart-anim` was written to
 * avoid.
 */

interface FakeMql {
  matches: boolean;
  readonly listeners: ((e: MediaQueryListEvent) => void)[];
  addEventListener(type: string, cb: (e: MediaQueryListEvent) => void): void;
  removeEventListener(type: string, cb: (e: MediaQueryListEvent) => void): void;
}

/** A MediaQueryList double that records what was subscribed and lets us fire it. */
function fakeMql(matches: boolean): FakeMql {
  const listeners: ((e: MediaQueryListEvent) => void)[] = [];
  return {
    matches,
    listeners,
    addEventListener(_type, cb) {
      listeners.push(cb);
    },
    removeEventListener(_type, cb) {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
}

/** Installs a `matchMedia` returning `mql` and records the queries asked for. */
function stubMatchMedia(mql: FakeMql): { queries: string[] } {
  const queries: string[] = [];
  vi.stubGlobal('matchMedia', (q: string) => {
    queries.push(q);
    return mql as unknown as MediaQueryList;
  });
  return { queries };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefersReducedMotion', () => {
  it('reports the preference the browser gives', () => {
    const { queries } = stubMatchMedia(fakeMql(true));
    expect(prefersReducedMotion()).toBe(true);
    // The exact query matters: `(prefers-reduced-motion)` alone matches "no-preference"
    // too, which would report every user as motion-averse.
    expect(queries).toEqual(['(prefers-reduced-motion: reduce)']);
  });

  it('reports false when the user has expressed no preference', () => {
    stubMatchMedia(fakeMql(false));
    expect(prefersReducedMotion()).toBe(false);
  });

  it('reports false — rather than throwing — on a host with no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
  });

  /**
   * ★ THE SSR FORK LIVES IN `reduced-motion.node.spec.ts`.
   *
   * It used to live here, as
   * `vi.stubGlobal('window', undefined); expect(prefersReducedMotion()).toBe(false)`.
   * jsdom defines `window` as a NON-CONFIGURABLE global, so that stub throws
   * "Cannot redefine property: window" and the branch was never taken — the
   * claim was right, the mechanism had gone.
   *
   * The sibling file runs under the `node` vitest project, where there is
   * genuinely no `window`, so it is not a stub and cannot rot the same way.
   * The guard's OTHER clause — `typeof window.matchMedia !== 'function'` — is
   * a different condition and stays asserted here, right above.
   */
});

describe('onReducedMotionChange', () => {
  it('calls back with the new preference when the OS setting flips', () => {
    const mql = fakeMql(false);
    stubMatchMedia(mql);
    const seen: boolean[] = [];

    onReducedMotionChange((r) => seen.push(r));
    expect(mql.listeners).toHaveLength(1);

    mql.listeners[0]({ matches: true } as MediaQueryListEvent);
    mql.listeners[0]({ matches: false } as MediaQueryListEvent);

    // It forwards the event's value, not the MQL's — an implementation that
    // read `mql.matches` would report the stale `false` both times.
    expect(seen).toEqual([true, false]);
  });

  it('stops calling back once unsubscribed', () => {
    const mql = fakeMql(false);
    stubMatchMedia(mql);
    let calls = 0;

    const off = onReducedMotionChange(() => calls++);
    off();

    expect(mql.listeners).toHaveLength(0);
    // Assert the negative directly: firing a listener that is still attached
    // would increment. Nothing is attached, so nothing may run.
    mql.listeners.forEach((l) => l({ matches: true } as MediaQueryListEvent));
    expect(calls).toBe(0);
  });

  it('returns a callable no-op on a host with no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    let calls = 0;
    const off = onReducedMotionChange(() => calls++);
    expect(() => off()).not.toThrow();
    expect(calls).toBe(0);
  });

  // SSR no-op: `reduced-motion.node.spec.ts`, for the reason given above.
});
