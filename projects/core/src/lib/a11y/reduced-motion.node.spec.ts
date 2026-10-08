import { onReducedMotionChange, prefersReducedMotion } from './reduced-motion';

/**
 * The SSR fork of both helpers — `typeof window === 'undefined'`.
 *
 * ★★★ THESE TWO CLAIMS USED TO LIVE IN `reduced-motion.spec.ts` AND HAD ROTTED.
 * They read `vi.stubGlobal('window', undefined)` and asserted the branch below.
 * jsdom defines `window` as a NON-CONFIGURABLE global, so the stub throws
 * "Cannot redefine property: window" — the claims were right, the mechanism had
 * gone out from under them, and the branch had not been executed in a long time.
 *
 * This file runs under the **`ssr` vitest project** (`environment: 'node'`),
 * where there genuinely is no `window`. That is not a stub, so it cannot rot the
 * same way — and if the guard is ever dropped from the implementation, these
 * throw `ReferenceError: window is not defined` and say exactly that.
 *
 * Why the claims matter: `core` is imported by every component in the kit, so a
 * server render that touches motion preferences would crash the render rather
 * than degrade.
 */
describe('reduced-motion under SSR', () => {
  /**
   * ★ Guard the guard.
   *
   * If the `ssr` project's `include` glob ever stops matching this file, it
   * falls back into `unit` — jsdom — where `window` exists and both assertions
   * below would pass for entirely the wrong reason. This one fails instead.
   */
  it('runs with no window at all, which is the point of this file', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('reports no motion preference rather than throwing', () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it('returns a callable no-op that never fires the callback', () => {
    const off = onReducedMotionChange(() => {
      throw new Error('must never be called');
    });
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
  });

  /**
   * Unsubscribing twice is what a component doing `ngOnDestroy` twice looks
   * like, and the no-op branch is the one place where nothing holds state to
   * make that safe by construction.
   */
  it('survives being unsubscribed twice', () => {
    const off = onReducedMotionChange(() => undefined);
    off();
    expect(() => off()).not.toThrow();
  });
});
