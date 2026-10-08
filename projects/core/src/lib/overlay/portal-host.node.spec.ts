import { createPortalHost } from './portal-host';

/**
 * ============================================================================
 *  The portal host with no document — the SSR stub
 * ============================================================================
 *
 * ★ The stub's `element` is `null` at runtime while the type says
 *   `HTMLElement` — kept so no caller breaks at compile time for a branch it
 *   cannot reach (hosts are created on open, a gesture). `available` is the
 *   honest half: it is how code that may run on the server finds out.
 */

describe('createPortalHost on the server', () => {
  it('returns an unavailable stub whose methods do nothing', () => {
    const host = createPortalHost({ label: 'menu' });

    expect(host.available).toBe(false);
    expect(host.element).toBeNull();
    expect(() => {
      host.attach();
      host.sync();
      host.destroy();
      host.destroy();
    }).not.toThrow();
  });
});
