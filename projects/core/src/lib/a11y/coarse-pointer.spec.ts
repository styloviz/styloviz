import { svHoverUnavailable, svOnHoverAvailabilityChange } from './coarse-pointer';

/**
 * These two functions decide whether a component may use hover as an *input*
 * rather than as decoration — `sv-cascader` downgrades `expandTrigger="hover"`
 * to `"click"` on their say-so. Two things can go wrong, and only one of them
 * is about `true` vs `false`:
 *
 *  1. The wrong query. `(pointer: coarse)` reads plausibly and is wrong: a
 *     stylus is coarse and hovers perfectly well, and a touchscreen laptop
 *     reports `coarse` for its secondary pointer while its trackpad hovers
 *     fine. Both would strip hover from users who have it. The query string is
 *     therefore asserted directly — a value assertion cannot see it, because a
 *     stubbed MQL returns whatever it was told for any query at all.
 *  2. Throwing. `core` is imported by every component in the kit, so a host
 *     without `matchMedia` must read as "hover works" (the desktop assumption),
 *     not take the render down.
 *
 * The SSR fork — `typeof window === 'undefined'` — is in
 * `coarse-pointer.node.spec.ts`, because jsdom's `window` is non-configurable
 * and a `vi.stubGlobal('window', undefined)` here would throw rather than
 * exercise the branch. That mistake has been made in this repo before.
 */

interface FakeMql {
  matches: boolean;
  readonly listeners: ((e: MediaQueryListEvent) => void)[];
  addEventListener(type: string, cb: (e: MediaQueryListEvent) => void): void;
  removeEventListener(type: string, cb: (e: MediaQueryListEvent) => void): void;
}

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

describe('svHoverUnavailable', () => {
  it('asks whether hovering exists — not how coarse the pointer is', () => {
    const { queries } = stubMatchMedia(fakeMql(true));
    expect(svHoverUnavailable()).toBe(true);
    expect(queries).toEqual(['(hover: none)']);
    // Stated as a negative too, because this is the substitution that would
    // pass every other assertion in this file.
    expect(queries[0]).not.toContain('pointer');
  });

  it('reports false on a device that can hover', () => {
    stubMatchMedia(fakeMql(false));
    expect(svHoverUnavailable()).toBe(false);
  });

  it('assumes hover works — rather than throwing — with no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(svHoverUnavailable()).toBe(false);
  });
});

describe('svOnHoverAvailabilityChange', () => {
  /**
   * The subscription exists because this is not a fixed property of a device.
   * A Surface undocked from its keyboard, or an iPad with a Magic Keyboard
   * attached mid-session, flips it — and a component that read the value once
   * at construction would keep a tap-to-expand cascader on a machine that has
   * had a trackpad for the last ten minutes.
   */
  it('reports the flip when a keyboard or trackpad is attached or removed', () => {
    const mql = fakeMql(false);
    stubMatchMedia(mql);
    const seen: boolean[] = [];

    svOnHoverAvailabilityChange((v) => seen.push(v));
    expect(mql.listeners).toHaveLength(1);

    mql.listeners[0]({ matches: true } as MediaQueryListEvent);
    mql.listeners[0]({ matches: false } as MediaQueryListEvent);

    // Forwards the event's value, not the MQL's: an implementation reading
    // `mql.matches` would report the stale `false` both times.
    expect(seen).toEqual([true, false]);
  });

  it('subscribes to the same query it reads', () => {
    const { queries } = stubMatchMedia(fakeMql(false));
    svOnHoverAvailabilityChange(() => undefined);
    expect(queries).toEqual(['(hover: none)']);
  });

  it('stops calling back once unsubscribed', () => {
    const mql = fakeMql(false);
    stubMatchMedia(mql);
    let calls = 0;

    const off = svOnHoverAvailabilityChange(() => calls++);
    off();

    expect(mql.listeners).toHaveLength(0);
    mql.listeners.forEach((l) => l({ matches: true } as MediaQueryListEvent));
    expect(calls).toBe(0);
  });

  it('returns a callable no-op with no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    let calls = 0;
    const off = svOnHoverAvailabilityChange(() => calls++);
    expect(() => off()).not.toThrow();
    expect(calls).toBe(0);
  });
});
