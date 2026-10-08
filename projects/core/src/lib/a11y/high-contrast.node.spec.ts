import { svHighContrast, svOnHighContrastChange } from './high-contrast';

/**
 * The SSR fork — `typeof window === 'undefined'`.
 *
 * Under the `node` vitest project, where there genuinely is no `window`: jsdom's
 * is non-configurable, so `vi.stubGlobal('window', undefined)` throws instead of
 * taking the branch. Components read this in a signal initialiser, which runs
 * during a server render — without the guard that is a `ReferenceError` in the
 * middle of SSR rather than a ring with a glow on it.
 */
describe('high-contrast under SSR', () => {
  it('runs with no window at all, which is the point of this file', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('assumes normal contrast, which is the markup the client will hydrate', () => {
    expect(svHighContrast()).toBe(false);
  });

  it('returns a callable no-op that never fires the callback', () => {
    const off = svOnHighContrastChange(() => {
      throw new Error('must never be called');
    });
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
  });

  it('survives being unsubscribed twice, as a double ngOnDestroy would', () => {
    const off = svOnHighContrastChange(() => undefined);
    off();
    expect(() => off()).not.toThrow();
  });
});
