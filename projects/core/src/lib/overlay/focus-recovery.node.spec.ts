import { svRecoverFocus, svRestoreFocusedItem, svSnapshotFocusedItem } from './focus-recovery';
import { svIsFocusable } from './focusable';

/**
 * ============================================================================
 *  Focus recovery with no DOM at all — `X-14`, `X-9`
 * ============================================================================
 *
 * The server. `HTMLElement` is not a global here, and `null instanceof
 * HTMLElement` throws a ReferenceError rather than answering false — so an
 * unguarded check fails a component that calls recovery from a shared code
 * path during SSR. Run in the node project, not stubbed: jsdom's globals are
 * non-configurable, which is why a stub would never take the guard.
 */

describe('focus recovery on the server', () => {
  it('has no HTMLElement global to check against', () => {
    expect(typeof HTMLElement).toBe('undefined');
  });

  it('svRecoverFocus is a no-op returning null', () => {
    expect(svRecoverFocus({ to: [null, undefined], fallback: null })).toBeNull();
  });

  it('svIsFocusable answers false instead of throwing', () => {
    expect(svIsFocusable(null)).toBe(false);
    expect(svIsFocusable({} as Element)).toBe(false);
  });

  it('the keyed-collection helpers are no-ops too', () => {
    expect(svSnapshotFocusedItem([], 'data-key')).toBeNull();
    expect(svRestoreFocusedItem([], 'data-key', { key: 'a', index: 0, control: -1 })).toBeNull();
  });
});
