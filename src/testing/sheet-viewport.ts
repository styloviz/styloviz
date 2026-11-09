/**
 * ============================================================================
 *  @testing/sheet-viewport — a phone viewport for the `X-16` sheet contract
 * ============================================================================
 *
 * `createSheetMode()` reads three things from the window: a `(max-width)`
 * media query, a `(hover: none)` media query and `visualViewport`. jsdom has
 * no layout, so a spec that wants to see a surface become a bottom sheet has
 * to answer all three. This is that answer, shared by every adopter's spec
 * (Dropdown Menu, Modal, Drawer, Popover, Menubar).
 *
 * Call {@link resetSheetViewport} in `afterEach` — it unstubs the globals and
 * removes the fake `visualViewport`.
 */
import { vi } from 'vitest';

/** A `MediaQueryList` double whose `matches` a spec can flip. */
export interface FakeMql {
  matches: boolean;
  readonly listeners: ((e: MediaQueryListEvent) => void)[];
  addEventListener(t: string, cb: (e: MediaQueryListEvent) => void): void;
  removeEventListener(t: string, cb: (e: MediaQueryListEvent) => void): void;
}

/** A media-query list that records its listeners. */
export function fakeMql(matches: boolean): FakeMql {
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

/**
 * Stub the viewport: `narrow` answers the width and hover queries, and
 * `keyboardPx` is how much of an 800px-tall viewport the virtual keyboard
 * covers. Every other media query (reduced motion, colour scheme) answers
 * `false`.
 */
export function stubSheetViewport(narrow: boolean, keyboardPx = 0): { width: FakeMql } {
  const width = fakeMql(narrow);
  const hover = fakeMql(narrow);
  vi.stubGlobal('matchMedia', (q: string) => {
    if (q.includes('hover')) return hover as unknown as MediaQueryList;
    if (q.includes('max-width')) return width as unknown as MediaQueryList;
    return fakeMql(false) as unknown as MediaQueryList;
  });
  vi.stubGlobal('innerHeight', 800);
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: {
      height: 800 - keyboardPx,
      offsetTop: 0,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
  });
  return { width };
}

/** Undo {@link stubSheetViewport}. */
export function resetSheetViewport(): void {
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
}
