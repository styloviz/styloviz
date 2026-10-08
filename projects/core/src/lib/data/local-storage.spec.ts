import { svLocalStorage } from './persisted-store';

/**
 * `svLocalStorage()` — the one guarded way to reach `localStorage` (1.0 audit, M4).
 *
 * With site data blocked, evaluating the global throws — `typeof localStorage`
 * included — so a guard written as `typeof localStorage === 'undefined'` is
 * itself the crash.
 */
describe('svLocalStorage', () => {
  it('returns the storage when it is available', () => {
    expect(svLocalStorage()).toBe(window.localStorage);
  });

  it('returns null instead of throwing when reading the global throws', () => {
    const desc = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    try {
      // The naive guard really does throw here — this is the bug, not a strawman.
      expect(() => typeof localStorage === 'undefined').toThrow();
      expect(svLocalStorage()).toBeNull();
    } finally {
      if (desc) Object.defineProperty(window, 'localStorage', desc);
    }
  });
});
