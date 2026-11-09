import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { createSheetMode, SV_SHEET_SAFE_AREA_PADDING, type SvSheetMode } from './sheet-mode';

/**
 * `X-16` — the responsive overlay-to-sheet contract.
 *
 * ★★ Two media queries and a `visualViewport`, all stubbed: jsdom has a fixed
 * 1024×768 viewport, no `matchMedia` that evaluates anything, and no
 * `visualViewport` at all. So the numbers here are the test's, and what is
 * being tested is the arithmetic and the listener bookkeeping — which is where
 * the bugs in this kind of code live.
 */

interface FakeMql {
  matches: boolean;
  readonly listeners: ((e: MediaQueryListEvent) => void)[];
  addEventListener(t: string, cb: (e: MediaQueryListEvent) => void): void;
  removeEventListener(t: string, cb: (e: MediaQueryListEvent) => void): void;
}

function fakeMql(matches: boolean): FakeMql {
  const listeners: ((e: MediaQueryListEvent) => void)[] = [];
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

interface FakeVv {
  height: number;
  offsetTop: number;
  readonly listeners: Record<string, (() => void)[]>;
  addEventListener(t: string, cb: () => void): void;
  removeEventListener(t: string, cb: () => void): void;
  emit(t: string): void;
}

function fakeVisualViewport(height: number, offsetTop = 0): FakeVv {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    height,
    offsetTop,
    listeners,
    addEventListener(t, cb) { (listeners[t] ??= []).push(cb); },
    removeEventListener(t, cb) {
      const list = listeners[t] ?? [];
      const i = list.indexOf(cb);
      if (i >= 0) list.splice(i, 1);
    },
    emit(t) { (listeners[t] ?? []).forEach((cb) => cb()); },
  };
}

/** Stub both queries by the question they ask, not by call order. */
function stubViewport(opts: {
  narrow?: boolean;
  noHover?: boolean;
  innerHeight?: number;
  vv?: FakeVv | null;
}) {
  const width = fakeMql(opts.narrow ?? false);
  const hover = fakeMql(opts.noHover ?? false);
  const queries: string[] = [];
  vi.stubGlobal('matchMedia', (q: string) => {
    queries.push(q);
    return (q.includes('hover') ? hover : width) as unknown as MediaQueryList;
  });
  if (opts.innerHeight !== undefined) {
    vi.stubGlobal('innerHeight', opts.innerHeight);
  }
  if (opts.vv !== undefined) {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: opts.vv,
    });
  }
  return { width, hover, queries };
}

/**
 * A component, because `createSheetMode` takes a `DestroyRef` — and it has to
 * be created in the COMPONENT's injection context, not the environment's.
 *
 * ★ `TestBed.runInInjectionContext` would give it the environment injector,
 *   whose `DestroyRef` fires when the TestBed is torn down rather than when
 *   the component is destroyed — so the cleanup test would pass whatever the
 *   code did. A field initializer is also how a real component calls this.
 */
let OPTIONS: Parameters<typeof createSheetMode>[0] = {};

@Component({ standalone: true, template: '' })
class Host {
  readonly sheet: SvSheetMode = createSheetMode(OPTIONS);
}

async function mount(options: Parameters<typeof createSheetMode>[0] = {}) {
  TestBed.resetTestingModule();
  OPTIONS = options;
  const { fixture } = await render(Host, {});
  return { fixture, sheet: fixture.componentInstance.sheet };
}

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
});

describe('createSheetMode — the breakpoint', () => {
  it('is a sheet on a narrow viewport', async () => {
    stubViewport({ narrow: true });
    const { sheet } = await mount();
    expect(sheet.asSheet()).toBe(true);
  });

  it('is not a sheet on a wide one', async () => {
    stubViewport({ narrow: false });
    const { sheet } = await mount();
    expect(sheet.asSheet()).toBe(false);
  });

  it('asks about width at the Tailwind sm boundary by default', async () => {
    const { queries } = stubViewport({});
    await mount();
    expect(queries).toContain('(max-width: 640px)');
  });

  it('honours a custom breakpoint', async () => {
    const { queries } = stubViewport({});
    await mount({ maxWidth: 480 });
    expect(queries).toContain('(max-width: 480px)');
  });

  it('★ follows a viewport that changes, because phones rotate', async () => {
    const { width } = stubViewport({ narrow: false });
    const { sheet } = await mount();
    expect(sheet.asSheet()).toBe(false);

    width.matches = true;
    width.listeners.forEach((cb) => cb({ matches: true } as MediaQueryListEvent));
    expect(sheet.asSheet()).toBe(true);
  });

  it('can be turned off entirely', async () => {
    stubViewport({ narrow: true });
    const on = signal(false);
    const { sheet } = await mount({ enabled: () => on() });
    expect(sheet.asSheet()).toBe(false);
    on.set(true);
    expect(sheet.asSheet()).toBe(true);
  });
});

describe('createSheetMode — requireTouch', () => {
  it('★ a narrow DESKTOP window is a sheet by default', async () => {
    // There is no room beside the anchor either way, which is the actual
    // problem — the finger is not.
    stubViewport({ narrow: true, noHover: false });
    const { sheet } = await mount();
    expect(sheet.asSheet()).toBe(true);
  });

  it('with requireTouch, a narrow desktop window is not', async () => {
    stubViewport({ narrow: true, noHover: false });
    const { sheet } = await mount({ requireTouch: true });
    expect(sheet.asSheet()).toBe(false);
  });

  it('with requireTouch, a narrow touch viewport is', async () => {
    stubViewport({ narrow: true, noHover: true });
    const { sheet } = await mount({ requireTouch: true });
    expect(sheet.asSheet()).toBe(true);
  });

  it('a wide touch device is never a sheet', async () => {
    stubViewport({ narrow: false, noHover: true });
    const { sheet } = await mount({ requireTouch: true });
    expect(sheet.asSheet()).toBe(false);
  });
});

describe('createSheetMode — the virtual keyboard', () => {
  it('★ measures the keyboard as the viewport the browser took away', async () => {
    // `window.innerHeight` does not change when the keyboard appears, so
    // `bottom: 0` is behind it — and the field the user tapped is the part
    // that is hidden.
    stubViewport({ narrow: true, innerHeight: 800, vv: fakeVisualViewport(500) });
    const { sheet } = await mount();
    expect(sheet.keyboardInset()).toBe(300);
  });

  it('★ counts offsetTop, which iOS uses when the page scrolls under the keyboard', async () => {
    // Ignoring it reports a keyboard taller than it is the moment the user
    // scrolls, pushing the sheet off the top of the screen.
    stubViewport({ narrow: true, innerHeight: 800, vv: fakeVisualViewport(500, 100) });
    const { sheet } = await mount();
    expect(sheet.keyboardInset()).toBe(200);
  });

  it('is zero with no keyboard up', async () => {
    stubViewport({ narrow: true, innerHeight: 800, vv: fakeVisualViewport(800) });
    const { sheet } = await mount();
    expect(sheet.keyboardInset()).toBe(0);
  });

  it('★ never reports a negative inset', async () => {
    // Android reports a visual viewport taller than the layout one mid-
    // animation, and a negative `bottom` puts the sheet off-screen.
    stubViewport({ narrow: true, innerHeight: 800, vv: fakeVisualViewport(900) });
    const { sheet } = await mount();
    expect(sheet.keyboardInset()).toBe(0);
  });

  it('follows the keyboard opening and closing', async () => {
    const vv = fakeVisualViewport(800);
    stubViewport({ narrow: true, innerHeight: 800, vv });
    const { sheet } = await mount();
    expect(sheet.keyboardInset()).toBe(0);

    vv.height = 480;
    vv.emit('resize');
    expect(sheet.keyboardInset()).toBe(320);

    vv.height = 800;
    vv.emit('resize');
    expect(sheet.keyboardInset()).toBe(0);
  });

  it('re-measures on a visual-viewport scroll', async () => {
    const vv = fakeVisualViewport(500, 0);
    stubViewport({ narrow: true, innerHeight: 800, vv });
    const { sheet } = await mount();
    expect(sheet.keyboardInset()).toBe(300);

    vv.offsetTop = 150;
    vv.emit('scroll');
    expect(sheet.keyboardInset()).toBe(150);
  });

  it('is zero where visualViewport does not exist', async () => {
    stubViewport({ narrow: true, innerHeight: 800, vv: null });
    const { sheet } = await mount();
    expect(sheet.keyboardInset()).toBe(0);
  });
});

describe('createSheetMode — cleanup', () => {
  it('★ releases every listener when the host is destroyed', async () => {
    // Overlays are created per row; two media-query listeners and two
    // visualViewport listeners each is a leak that scales with the table.
    const vv = fakeVisualViewport(800);
    const { width, hover } = stubViewport({ narrow: false, innerHeight: 800, vv });
    const { fixture } = await mount();

    expect(width.listeners).toHaveLength(1);
    expect(hover.listeners).toHaveLength(1);
    expect(vv.listeners['resize']).toHaveLength(1);
    expect(vv.listeners['scroll']).toHaveLength(1);

    fixture.destroy();

    expect(width.listeners).toHaveLength(0);
    expect(hover.listeners).toHaveLength(0);
    expect(vv.listeners['resize']).toHaveLength(0);
    expect(vv.listeners['scroll']).toHaveLength(0);
  });

  it('release() is idempotent', async () => {
    const { width } = stubViewport({});
    const { sheet } = await mount();
    sheet.release();
    expect(() => sheet.release()).not.toThrow();
    expect(width.listeners).toHaveLength(0);
  });
});

describe('SV_SHEET_SAFE_AREA_PADDING', () => {
  it('★ carries a fallback, because env() with none drops the declaration', () => {
    // `padding-bottom:` with nothing after it is a dropped rule rather than a
    // zero — which ships looking fine on the developer's desktop.
    expect(SV_SHEET_SAFE_AREA_PADDING).toBe('env(safe-area-inset-bottom, 0px)');
  });
});
