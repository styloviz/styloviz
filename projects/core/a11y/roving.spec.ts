import { svRovingTarget } from './roving';

/**
 * `FI-07-I2` / `FI-22-I1` — the arrow-key arithmetic that was written out twice
 * and was about to be written a third time.
 */
describe('svRovingTarget', () => {
  it('steps forward and wraps at the end', () => {
    expect(svRovingTarget('ArrowRight', 3, 0)).toBe(1);
    expect(svRovingTarget('ArrowRight', 3, 2)).toBe(0);
  });

  it('steps back and wraps at the start', () => {
    expect(svRovingTarget('ArrowLeft', 3, 2)).toBe(1);
    expect(svRovingTarget('ArrowLeft', 3, 0)).toBe(2);
  });

  /**
   * Both axes on purpose. A composite widget that is horizontal today is
   * vertical at 400px, and a user pressing Down on a wrapped row is not making
   * a mistake the widget should punish them for.
   */
  it('treats the two axes alike', () => {
    expect(svRovingTarget('ArrowDown', 4, 1)).toBe(svRovingTarget('ArrowRight', 4, 1));
    expect(svRovingTarget('ArrowUp', 4, 1)).toBe(svRovingTarget('ArrowLeft', 4, 1));
  });

  it('jumps to the ends', () => {
    expect(svRovingTarget('Home', 5, 3)).toBe(0);
    expect(svRovingTarget('End', 5, 3)).toBe(4);
  });

  /**
   * ★ `null` and "stay put" are different answers. Returning the current index
   *   for an unhandled key would have every caller `preventDefault()` on Tab,
   *   Escape and every printable character — trapping the user inside a widget
   *   they were trying to leave.
   */
  it('has no opinion about keys that are not navigation', () => {
    for (const key of ['Tab', 'Escape', 'a', ' ', 'Enter', 'PageDown']) {
      expect(svRovingTarget(key, 3, 1)).toBeNull();
    }
  });

  it('says nothing about an empty set', () => {
    expect(svRovingTarget('ArrowRight', 0, 0)).toBeNull();
    expect(svRovingTarget('Home', 0, -1)).toBeNull();
  });

  /**
   * Nothing focused yet, or the focused item was just disabled out from under
   * the cursor. Computing from `-1` would send ArrowLeft to index -2.
   */
  it('lands somewhere sensible when the current index is not in the list', () => {
    expect(svRovingTarget('ArrowRight', 3, -1)).toBe(1);
    expect(svRovingTarget('ArrowLeft', 3, -1)).toBe(2);
    expect(svRovingTarget('ArrowRight', 3, 99)).toBe(1);
  });

  it('handles a single item without moving anywhere it cannot go', () => {
    expect(svRovingTarget('ArrowRight', 1, 0)).toBe(0);
    expect(svRovingTarget('ArrowLeft', 1, 0)).toBe(0);
    expect(svRovingTarget('End', 1, 0)).toBe(0);
  });
});
