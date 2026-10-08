import { svHoverUnavailable, svOnHoverAvailabilityChange } from './coarse-pointer';

/**
 * The SSR fork — `typeof window === 'undefined'`.
 *
 * This file runs under the **`node` vitest project**, where there genuinely is
 * no `window`, for the reason spelled out at length in `vitest.config.ts`:
 * jsdom's `window` is non-configurable, so `vi.stubGlobal('window', undefined)`
 * throws instead of taking the branch, and four claims in this repo rotted that
 * way before anyone noticed.
 *
 * Why it matters here specifically: `sv-cascader` reads hover availability in
 * its constructor-time signal initialiser, which runs during a server render.
 * Without the guard that is a `ReferenceError` in the middle of SSR, not a
 * degraded panel.
 */
describe('coarse-pointer under SSR', () => {
  /** Guard the guard: if the `node` include glob stops matching this file it
   *  falls back to jsdom, where `window` exists and both claims below would
   *  pass for the wrong reason. This one fails instead. */
  it('runs with no window at all, which is the point of this file', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('assumes hover is available, which is the markup the client will hydrate', () => {
    expect(svHoverUnavailable()).toBe(false);
  });

  it('returns a callable no-op that never fires the callback', () => {
    const off = svOnHoverAvailabilityChange(() => {
      throw new Error('must never be called');
    });
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
  });

  it('survives being unsubscribed twice, as a double ngOnDestroy would', () => {
    const off = svOnHoverAvailabilityChange(() => undefined);
    off();
    expect(() => off()).not.toThrow();
  });
});
