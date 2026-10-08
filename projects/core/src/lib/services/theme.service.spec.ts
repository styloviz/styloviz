import { TestBed } from '@angular/core/testing';
import { STYLOVIZ_CONFIG, provideStyloviz, provideStylviz, type StylovizConfig } from '../tokens/styloviz.token';
import { ThemeService } from './theme.service';

/**
 * ThemeService is a *decision* about which of four sources wins, and only the
 * decision is worth testing. Asserting "the html element has class dark" proves
 * `classList.toggle` works; it does not prove the service asked localStorage
 * before it asked the OS. Every test here therefore sets up a disagreement
 * between the sources and checks which one the service believed.
 *
 * Priority contract (documented on the class):
 *   localStorage  →  provideStyloviz colorScheme  →  OS preference  →  light
 */

const STORAGE_KEY = 'styloviz-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

/** Records every media query asked for and answers from a fixed table. */
function stubMatchMedia(answers: Record<string, boolean>): { queries: string[] } {
  const queries: string[] = [];
  vi.stubGlobal('matchMedia', (q: string) => {
    queries.push(q);
    return {
      matches: answers[q] ?? false,
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as MediaQueryList;
  });
  return { queries };
}

/** Builds the service with an explicit config (or none) and flushes its effect. */
function build(config?: StylovizConfig): ThemeService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: config ? [{ provide: STYLOVIZ_CONFIG, useValue: config }] : [],
  });
  return TestBed.inject(ThemeService);
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark', 'light');
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.classList.remove('dark', 'light');
});

describe('ThemeService — which source decides the initial theme', () => {
  it('falls back to light when nothing has an opinion', () => {
    stubMatchMedia({ [DARK_QUERY]: false });
    expect(build().isDark()).toBe(false);
  });

  it('uses the OS preference when there is no stored choice and no config', () => {
    const { queries } = stubMatchMedia({ [DARK_QUERY]: true });
    expect(build().isDark()).toBe(true);
    expect(queries).toContain(DARK_QUERY);
  });

  it('lets a config of dark override an OS that prefers light', () => {
    stubMatchMedia({ [DARK_QUERY]: false });
    expect(build({ colorScheme: 'dark' }).isDark()).toBe(true);
  });

  it('lets a config of light override an OS that prefers dark', () => {
    // The mirror case. Without it, an implementation that returned `'dark'` for
    // *any* configured scheme would still pass the test above.
    stubMatchMedia({ [DARK_QUERY]: true });
    expect(build({ colorScheme: 'light' }).isDark()).toBe(false);
  });

  it('defers to the OS when the config says "system"', () => {
    stubMatchMedia({ [DARK_QUERY]: true });
    expect(build({ colorScheme: 'system' }).isDark()).toBe(true);
  });

  it('prefers a stored dark over a config of light and an OS of light', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    stubMatchMedia({ [DARK_QUERY]: false });
    expect(build({ colorScheme: 'light' }).isDark()).toBe(true);
  });

  it('prefers a stored light over a config of dark and an OS of dark', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    stubMatchMedia({ [DARK_QUERY]: true });
    expect(build({ colorScheme: 'dark' }).isDark()).toBe(false);
  });

  it('ignores a stored value that is not a theme and falls through to the config', () => {
    // Anything can end up in localStorage — another app on the same origin, a
    // half-written value, a schema change. It must not be trusted as a Theme
    // just because the cast says so.
    localStorage.setItem(STORAGE_KEY, 'midnight');
    stubMatchMedia({ [DARK_QUERY]: false });
    expect(build({ colorScheme: 'dark' }).isDark()).toBe(true);
  });

  it('falls back to light on a host that cannot be asked for an OS preference', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(build().isDark()).toBe(false);
  });
});

describe('ThemeService — applying the theme', () => {
  it('puts the dark class on <html> and removes light — without storing a choice nobody made', () => {
    stubMatchMedia({ [DARK_QUERY]: true });
    build();
    TestBed.tick();

    const html = document.documentElement;
    expect(html.classList.contains('dark')).toBe(true);
    expect(html.classList.contains('light')).toBe(false);
    // ★ 1.0 audit H3: the OS preference used to be persisted here, which froze
    //   it — a visitor who later switched their OS to light stayed dark forever.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('puts the light class on <html> and removes dark', () => {
    stubMatchMedia({ [DARK_QUERY]: false });
    document.documentElement.classList.add('dark');
    build();
    TestBed.tick();

    const html = document.documentElement;
    expect(html.classList.contains('light')).toBe(true);
    expect(html.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('remembers an explicit choice, and only that', () => {
    stubMatchMedia({ [DARK_QUERY]: false });
    const s = build();
    TestBed.tick();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    s.setTheme('dark');
    TestBed.tick();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('follows a changed OS preference on the next visit when nothing was chosen', () => {
    stubMatchMedia({ [DARK_QUERY]: true });
    build();
    TestBed.tick();
    stubMatchMedia({ [DARK_QUERY]: false });
    expect(build().isDark()).toBe(false);
  });
});

describe('ThemeService — blocked storage (1.0 audit H3)', () => {
  /**
   * With site data blocked, merely READING `window.localStorage` throws a
   * SecurityError. The service is constructed by every component that injects
   * it, so a throw here took down the app shell.
   */
  function blockStorage(): () => void {
    const desc = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    return () => {
      if (desc) Object.defineProperty(window, 'localStorage', desc);
    };
  }

  it('constructs, applies and switches the theme without storage', () => {
    stubMatchMedia({ [DARK_QUERY]: true });
    const restore = blockStorage();
    try {
      const s = build();
      TestBed.tick();
      expect(s.isDark()).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      s.toggleTheme();
      TestBed.tick();
      expect(s.isDark()).toBe(false);
    } finally {
      restore();
    }
  });
});

describe('ThemeService — switching', () => {
  it('toggles in both directions', () => {
    stubMatchMedia({ [DARK_QUERY]: false });
    const s = build();
    s.toggleTheme();
    expect(s.isDark()).toBe(true);
    s.toggleTheme();
    expect(s.isDark()).toBe(false);
  });

  it('does nothing at all when asked for the theme already in force', () => {
    stubMatchMedia({ [DARK_QUERY]: false });
    const s = build();
    TestBed.tick();
    // A sentinel proves the early return: if setTheme fell through it would
    // reach applyTheme and overwrite this with 'light'.
    localStorage.setItem(STORAGE_KEY, 'sentinel');

    s.setTheme('light');
    TestBed.tick();

    expect(s.isDark()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('sentinel');
  });
});

describe('ThemeService — View Transitions', () => {
  /** Installs a fake `document.startViewTransition`, returning its call log. */
  type ViewTransitionDoc = Record<string, unknown>;

  function stubViewTransition(): { calls: (() => void)[]; restore: () => void } {
    const calls: (() => void)[] = [];
    // `Document.startViewTransition` is typed in lib.dom with an overload the
    // service deliberately does not use, so the double is installed through an
    // index signature rather than fought with a cast per overload.
    const doc = document as unknown as ViewTransitionDoc;
    const had = 'startViewTransition' in doc;
    const prev = doc['startViewTransition'];
    doc['startViewTransition'] = (cb: () => void) => {
      calls.push(cb);
      cb();
      return {};
    };
    return {
      calls,
      restore: () => {
        if (had) doc['startViewTransition'] = prev;
        else delete doc['startViewTransition'];
      },
    };
  }

  it('cross-fades through startViewTransition when the browser offers it', () => {
    stubMatchMedia({ [DARK_QUERY]: false, [REDUCE_QUERY]: false });
    const vt = stubViewTransition();
    try {
      const s = build();
      s.setTheme('dark');
      expect(vt.calls).toHaveLength(1);
      expect(s.isDark()).toBe(true);
      // The callback applies the theme itself so the DOM changes *inside* the
      // transition — deferring it to the effect would fade to the old colours.
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    } finally {
      vt.restore();
    }
  });

  it('switches instantly, without a transition, when the user asks for reduced motion', () => {
    stubMatchMedia({ [DARK_QUERY]: false, [REDUCE_QUERY]: true });
    const vt = stubViewTransition();
    try {
      const s = build();
      s.setTheme('dark');
      expect(s.isDark()).toBe(true);
      // Assert the negative: the API is available and must still not be used.
      expect(vt.calls).toEqual([]);
    } finally {
      vt.restore();
    }
  });

  it('does not start a transition for the theme already in force', () => {
    // The early return in setTheme is only *observable* when the View
    // Transitions API exists: without it, re-setting the current theme is a
    // no-op either way. With it, falling through cross-fades the whole page
    // for a change that never happens — a visible flash on every stray call
    // from a toggle bound to a signal that re-emits.
    stubMatchMedia({ [DARK_QUERY]: false, [REDUCE_QUERY]: false });
    const vt = stubViewTransition();
    try {
      const s = build();
      s.setTheme('light');
      expect(vt.calls).toEqual([]);
      expect(s.isDark()).toBe(false);
    } finally {
      vt.restore();
    }
  });

  it('switches instantly on a browser with no View Transitions API', () => {
    stubMatchMedia({ [DARK_QUERY]: false, [REDUCE_QUERY]: false });
    const doc = document as unknown as Record<string, unknown>;
    expect(doc['startViewTransition']).toBeUndefined(); // jsdom has none — the real case
    const s = build();
    s.setTheme('dark');
    expect(s.isDark()).toBe(true);
  });
});

/**
 * The SSR fork. `typeof window` and `typeof document` read as 'undefined' for a
 * global bound to `undefined`, which is the only way to take these branches from
 * inside jsdom. Both are restored immediately; nothing between the stub and the
 * unstub touches the DOM.
 */
/**
 * ★ THE SERVER-SIDE-RENDERING BLOCK LIVES IN `theme.service.node.spec.ts`.
 *
 * It used to be here, behind `vi.stubGlobal('window', undefined)` and
 * `('document', undefined)`. jsdom defines both as NON-CONFIGURABLE globals, so
 * the stubs throw "Cannot redefine property" and neither branch was ever taken.
 *
 * The sibling file runs under the `node` vitest project — no DOM at all — so
 * `resolveInitialTheme`'s `typeof window === 'undefined'` fork and
 * `applyTheme`'s `typeof document === 'undefined'` early return are executed
 * rather than simulated. It asserts one thing the old pair could not: that a
 * host who configured `colorScheme: 'dark'` still server-renders LIGHT, which
 * is the priority-order claim that stops a first-paint flash.
 */

describe('provideStyloviz', () => {
  it('provides the config it is given', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideStyloviz({ colorScheme: 'dark' })] });
    expect(TestBed.inject(STYLOVIZ_CONFIG).colorScheme).toBe('dark');
  });

  /**
   * ★ The misspelled 0.x name (`provideStylviz`) stays as a deprecated alias,
   *   so upgrading to 1.0 does not break an existing app config.
   */
  it('the deprecated provideStylviz alias still provides the same config', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideStylviz({ colorScheme: 'light' })] });
    expect(TestBed.inject(STYLOVIZ_CONFIG).colorScheme).toBe('light');
  });

  it('provides an empty config — not null — when called with no argument', () => {
    // The default parameter is the interesting half. Called bare, the token must
    // still resolve to an object: every consumer reads `config?.colorScheme`, and
    // a null provider would look identical to "not registered at all".
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideStyloviz()] });
    expect(TestBed.inject(STYLOVIZ_CONFIG)).toEqual({});
  });

  it('a bare provideStyloviz() leaves the theme to the OS', () => {
    stubMatchMedia({ [DARK_QUERY]: true });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideStyloviz()] });
    expect(TestBed.inject(ThemeService).isDark()).toBe(true);
  });
});
