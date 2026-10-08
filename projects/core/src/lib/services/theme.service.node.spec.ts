import { createSsrInjector } from '../../../../../src/testing/ssr-injector';
import { STYLOVIZ_CONFIG } from '../tokens/styloviz.token';
import { ThemeService } from './theme.service';

/**
 * `ThemeService` on a server — no `window`, no `document`, no `localStorage`.
 *
 * ★★★ BOTH CLAIMS USED TO LIVE IN `theme.service.spec.ts` AND HAD ROTTED, the
 * same way `reduced-motion`'s did: they wrote `vi.stubGlobal('window', undefined)`
 * / `('document', undefined)` from inside jsdom, which defines both as
 * NON-CONFIGURABLE globals, so the stub threw "Cannot redefine property" and
 * neither branch was ever taken.
 *
 * They matter:
 *   • **`resolveInitialTheme`** must return `light` on a server whatever
 *     localStorage, `provideStyloviz` and the OS say — the server cannot know
 *     which the user picked, and guessing produces a mismatched first paint,
 *     i.e. a visible flash on every page load.
 *   • **`applyTheme`** must return before touching `document` or
 *     `localStorage` — a storage write during a server render is a crash, not
 *     a cosmetic problem.
 *
 * This file runs under the **`ssr` vitest project** (`environment: 'node'`).
 * There is no TestBed here; see `src/testing/ssr-injector.ts` for why, and for
 * what `tick()` stands in for.
 */

/** A service and its effect pump, with the config the host would have provided. */
function build(config: { colorScheme?: 'light' | 'dark' } | null = null) {
  const { get, tick } = createSsrInjector([
    { provide: STYLOVIZ_CONFIG, useValue: config },
    { provide: ThemeService, useClass: ThemeService, deps: [] },
  ]);
  return { service: get<ThemeService>(ThemeService), tick };
}

describe('ThemeService — server-side rendering', () => {
  /**
   * ★ Guard the guard. If the `ssr` project's `include` glob ever stops
   * matching this file it falls back into `unit` — jsdom — where `window`,
   * `document` and `localStorage` all exist and every assertion below would
   * pass for the wrong reason. This one fails instead.
   */
  it('runs with no window, document or localStorage, which is the point', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(typeof localStorage).toBe('undefined');
  });

  it('renders light on a server, without asking localStorage or the OS', () => {
    // No source of preference is reachable, so there is only one safe answer.
    const { service, tick } = build();
    tick();
    expect(service.isDark()).toBe(false);
  });

  it('renders light even when the host explicitly configured dark', () => {
    // ★ This is the assertion the rotted test could not make at all, and the
    // one that pins the priority order: `typeof window === 'undefined'` is
    // checked BEFORE `config.colorScheme`, so a `provideStyloviz({colorScheme:
    // 'dark'})` app still server-renders light and lets the client correct it.
    // Server-rendering dark here would flash for every light-mode reader.
    const { service, tick } = build({ colorScheme: 'dark' });
    tick();
    expect(service.isDark()).toBe(false);
  });

  it('does not touch the DOM or storage when there is no document', () => {
    // The constructor effect calls `applyTheme` immediately; `setTheme` calls
    // it again. Both must early-return rather than dereference `document` or
    // `localStorage` — either would be a ReferenceError, which this catches by
    // the test simply not throwing.
    const { service, tick } = build();
    tick();

    expect(() => service.setTheme('dark')).not.toThrow();
    expect(service.isDark()).toBe(true);
    expect(() => tick()).not.toThrow();

    // ...and again through the public toggle, which is the path a host uses.
    expect(() => service.toggleTheme()).not.toThrow();
    expect(() => tick()).not.toThrow();
    expect(service.isDark()).toBe(false);
  });

  it('takes the instant path — there is no View Transitions API to find', () => {
    // `setTheme` reads `document.startViewTransition` before deciding whether
    // to cross-fade. With no `document` the optional chain must yield
    // `undefined` and the switch must happen synchronously, not be deferred
    // into a transition callback that will never run.
    const { service, tick } = build();
    tick();
    service.setTheme('dark');
    // Synchronous: asserted BEFORE any flush.
    expect(service.isDark()).toBe(true);
  });
});
