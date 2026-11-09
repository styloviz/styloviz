import { svHighContrast, svOnHighContrastChange } from './high-contrast';

/**
 * The two queries behind every high-contrast fallback in the kit.
 *
 * ★★ THE QUERY STRINGS ARE ASSERTED DIRECTLY, for the reason
 *    `coarse-pointer.spec.ts` gives: a stubbed MQL answers whatever it was told
 *    for any query at all, so a value assertion cannot see WHICH question was
 *    asked — and asking only `(prefers-contrast: more)` would leave every
 *    Windows High Contrast user with the decoration this helper exists to
 *    remove.
 *
 * The SSR fork lives in `high-contrast.node.spec.ts`: jsdom's `window` is
 * non-configurable, so stubbing it away here throws rather than taking the
 * branch.
 */

interface FakeMql {
  matches: boolean;
  readonly listeners: (() => void)[];
  addEventListener(type: string, cb: () => void): void;
  removeEventListener(type: string, cb: () => void): void;
}

function fakeMql(matches: boolean): FakeMql {
  const listeners: (() => void)[] = [];
  return {
    matches,
    listeners,
    addEventListener(_t, cb) { listeners.push(cb); },
    removeEventListener(_t, cb) {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
}

/** One MQL per query, so a test can set them independently. */
function stubMatchMedia(byQuery: Record<string, FakeMql>): { queries: string[] } {
  const queries: string[] = [];
  vi.stubGlobal('matchMedia', (q: string) => {
    queries.push(q);
    const mql = byQuery[q] ?? fakeMql(false);
    byQuery[q] = mql;
    return mql as unknown as MediaQueryList;
  });
  return { queries };
}

afterEach(() => vi.unstubAllGlobals());

describe('svHighContrast', () => {
  it('★ asks BOTH questions, not just the polite one', () => {
    const { queries } = stubMatchMedia({});
    expect(svHighContrast()).toBe(false);
    expect(queries).toEqual(['(prefers-contrast: more)', '(forced-colors: active)']);
  });

  it('reports true for a contrast preference', () => {
    stubMatchMedia({ '(prefers-contrast: more)': fakeMql(true) });
    expect(svHighContrast()).toBe(true);
  });

  it('★ reports true for forced colors, which is the mode that cannot render a glow at all', () => {
    stubMatchMedia({ '(forced-colors: active)': fakeMql(true) });
    expect(svHighContrast()).toBe(true);
  });

  it('reports false when neither is set', () => {
    stubMatchMedia({
      '(prefers-contrast: more)': fakeMql(false),
      '(forced-colors: active)': fakeMql(false),
    });
    expect(svHighContrast()).toBe(false);
  });

  it('reads as "normal contrast" rather than throwing with no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(svHighContrast()).toBe(false);
  });
});

describe('svOnHighContrastChange', () => {
  it('★ fires when EITHER preference flips', () => {
    const contrast = fakeMql(false);
    const forced = fakeMql(false);
    stubMatchMedia({
      '(prefers-contrast: more)': contrast,
      '(forced-colors: active)': forced,
    });
    const seen: boolean[] = [];
    const off = svOnHighContrastChange((v) => seen.push(v));

    contrast.matches = true;
    contrast.listeners.forEach((l) => l());
    expect(seen).toEqual([true]);

    contrast.matches = false;
    forced.matches = true;
    forced.listeners.forEach((l) => l());
    expect(seen).toEqual([true, true]);

    off();
  });

  it('★ reports the OR, so one preference going away does not undo the other', () => {
    const contrast = fakeMql(true);
    const forced = fakeMql(true);
    stubMatchMedia({
      '(prefers-contrast: more)': contrast,
      '(forced-colors: active)': forced,
    });
    const seen: boolean[] = [];
    svOnHighContrastChange((v) => seen.push(v));

    contrast.matches = false;
    contrast.listeners.forEach((l) => l());
    expect(seen).toEqual([true]);
  });

  it('unsubscribes from both lists', () => {
    const contrast = fakeMql(false);
    const forced = fakeMql(false);
    stubMatchMedia({
      '(prefers-contrast: more)': contrast,
      '(forced-colors: active)': forced,
    });
    const off = svOnHighContrastChange(() => undefined);
    expect(contrast.listeners).toHaveLength(1);
    expect(forced.listeners).toHaveLength(1);

    off();
    expect(contrast.listeners).toHaveLength(0);
    expect(forced.listeners).toHaveLength(0);
  });
});
