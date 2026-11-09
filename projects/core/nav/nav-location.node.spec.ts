import {
  svHashNavLocation,
  svNoopNavLocation,
  svQueryParamNavLocation,
  type SvNavLocation,
} from './nav-location';

/**
 * ============================================================================
 *  The navigation location seam, with no DOM at all — `X-8`, `X-9`
 * ============================================================================
 *
 * This is the server. `X-9` asks, per family, *"what renders on the server,
 * before any observer or measurement runs?"* — and for anything reading the URL
 * the answer has to be **the component's own default**, not a guess and not a
 * crash.
 *
 * Running here rather than stubbing is deliberate, and the reason is recorded in
 * `vitest.config.ts`: jsdom defines `window` as a NON-CONFIGURABLE global, so
 * `vi.stubGlobal('window', undefined)` throws and the guard never gets taken.
 * Four tests in this repo had already rotted that way. Where there genuinely is
 * no `window`, a dropped guard fails with `ReferenceError: window is not
 * defined` and says so.
 */

/** Every implementation, including the ones that would normally touch history. */
const IMPLEMENTATIONS: readonly [string, () => SvNavLocation][] = [
  ['noop', svNoopNavLocation],
  ['query', svQueryParamNavLocation],
  ['hash', () => svHashNavLocation('section')],
];

describe('SvNavLocation — on the server', () => {
  it('has no window to read, which is the premise of this file', () => {
    expect(typeof window).toBe('undefined');
  });

  it.each(IMPLEMENTATIONS)('%s reads null rather than throwing', (_name, create) => {
    expect(create().read('section')).toBeNull();
  });

  it.each(IMPLEMENTATIONS)('%s writes nothing rather than throwing', (_name, create) => {
    const location = create();
    expect(() => location.write('section', 'usage')).not.toThrow();
    expect(() => location.write('section', 'usage', 'push')).not.toThrow();
    expect(() => location.write('section', null)).not.toThrow();
  });

  /**
   * A write must not become readable either. If it did, a component would
   * server-render one value and hydrate to another, which is the mismatch this
   * whole guard exists to avoid.
   */
  it.each(IMPLEMENTATIONS)('%s does not remember a write', (_name, create) => {
    const location = create();
    location.write('section', 'usage');
    expect(location.read('section')).toBeNull();
  });

  it.each(IMPLEMENTATIONS)('%s subscribes and unsubscribes without a window', (_name, create) => {
    const location = create();
    let calls = 0;
    const off = location.subscribe(() => calls++);

    expect(calls).toBe(0);
    expect(() => off()).not.toThrow();
  });

  /**
   * ★ The behavioural claim, not just the absence of a crash: with no DOM, every
   * implementation is indistinguishable from the no-op. That is what makes
   * server rendering predictable — the component takes its own default on the
   * server whichever location the consumer wired up.
   */
  it('makes every implementation behave exactly like the no-op', () => {
    const noop = svNoopNavLocation();

    for (const [name, create] of IMPLEMENTATIONS) {
      const location = create();
      location.write('section', 'usage', 'push');
      expect(location.read('section'), name).toBe(noop.read('section'));
    }
  });

  /** `kind` is static metadata, so it survives where the DOM does not. */
  it('still reports its kind, for diagnostics', () => {
    expect(svQueryParamNavLocation().kind).toBe('query');
    expect(svHashNavLocation('section').kind).toBe('hash:section');
    expect(svNoopNavLocation().kind).toBe('noop');
  });
});
