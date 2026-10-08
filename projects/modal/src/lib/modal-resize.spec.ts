import {
  svClampModalSize,
  svMaximizedSize,
  svResizeModal,
  svRestoredSize,
  type SvModalResizeBounds,
} from './modal-resize';

const BOUNDS: SvModalResizeBounds = {
  minWidth: 280,
  minHeight: 160,
  viewportWidth: 1000,
  viewportHeight: 800,
};

describe('clamping a panel size', () => {
  /**
   * ★★★ THE FAILURE THIS PREVENTS IS A TRAP, NOT A COSMETIC GLITCH.
   *
   * Drag a panel wider than the viewport and the header goes off screen — and
   * with it the ×, the footer buttons and the resize handle you would need to
   * drag it back. With `closeOnEsc="false"` the user has no exit at all.
   */
  it('will not let a panel grow past the viewport', () => {
    const size = svClampModalSize({ width: 5000, height: 5000 }, BOUNDS);
    expect(size.width).toBeLessThanOrEqual(BOUNDS.viewportWidth);
    expect(size.height).toBeLessThanOrEqual(BOUNDS.viewportHeight);
  });

  it('keeps a margin at every edge', () => {
    const size = svClampModalSize({ width: 5000, height: 5000 }, BOUNDS);
    expect(size.width).toBe(1000 - 32);
    expect(size.height).toBe(800 - 32);
  });

  it('will not let a panel shrink below the floor', () => {
    expect(svClampModalSize({ width: 10, height: 10 }, BOUNDS)).toEqual({
      width: 280,
      height: 160,
    });
  });

  /**
   * ★★ WHEN THE TWO CONSTRAINTS CONTRADICT, THE FLOOR WINS.
   *
   * On a viewport narrower than `minWidth` — a phone, or a desktop window
   * dragged very small — honouring the ceiling would collapse the panel to a
   * sliver. Overflowing a tiny viewport is recoverable by scrolling;
   * disappearing into it is not.
   */
  it('overflows a viewport too small for the minimum rather than collapsing', () => {
    const tiny: SvModalResizeBounds = { ...BOUNDS, viewportWidth: 200, viewportHeight: 100 };
    const size = svClampModalSize({ width: 400, height: 400 }, tiny);
    expect(size.width).toBe(280);
    expect(size.height).toBe(160);
  });

  it('drops a non-finite size instead of writing NaN into a style attribute', () => {
    const size = svClampModalSize({ width: Number.NaN, height: Number.POSITIVE_INFINITY }, BOUNDS);
    expect(Number.isFinite(size.width)).toBe(true);
    expect(Number.isFinite(size.height)).toBe(true);
  });
});

describe('dragging', () => {
  it('applies the delta', () => {
    expect(svResizeModal({ width: 400, height: 300 }, 60, 40, BOUNDS)).toEqual({
      width: 460,
      height: 340,
    });
  });

  it('shrinks on a negative delta, down to the floor', () => {
    expect(svResizeModal({ width: 400, height: 300 }, -1000, -1000, BOUNDS)).toEqual({
      width: 280,
      height: 160,
    });
  });

  it('clamps a drag that would leave the viewport', () => {
    const size = svResizeModal({ width: 900, height: 700 }, 900, 900, BOUNDS);
    expect(size.width).toBe(968);
    expect(size.height).toBe(768);
  });

  it('ignores a non-finite delta rather than propagating it', () => {
    expect(svResizeModal({ width: 400, height: 300 }, Number.NaN, 20, BOUNDS)).toEqual({
      width: 400,
      height: 320,
    });
  });
});

describe('maximize and restore', () => {
  it('fills the viewport less the margin', () => {
    expect(svMaximizedSize(BOUNDS)).toEqual({ width: 968, height: 768 });
  });

  /**
   * ★★ RESTORE GOES BACK TO THE SIZE THE USER LEFT IT AT.
   *
   * Someone drags a dialog to the shape they want, maximizes to read something,
   * then restores — and a restore that snapped back to the default has thrown
   * away the adjustment they just made, on a round trip nobody thinks of as
   * destructive.
   */
  it('returns to the dragged size, not to a default', () => {
    expect(svRestoredSize({ width: 640, height: 420 }, BOUNDS)).toEqual({
      width: 640,
      height: 420,
    });
  });

  /**
   * ★★ AND `null` MEANS "LET THE CSS DECIDE".
   *
   * A dialog that was never resized has no pixel size to go back to. Guessing
   * one — 448 px for `size="md"`, say — hard-codes a number that the size class
   * owns, and the two drift the first time the class changes.
   */
  it('gives back null when the panel was never resized', () => {
    expect(svRestoredSize(null, BOUNDS)).toBeNull();
  });

  /** A window narrowed while maximized must not restore to the old width. */
  it('re-clamps the remembered size against the current viewport', () => {
    const narrow: SvModalResizeBounds = { ...BOUNDS, viewportWidth: 500 };
    expect(svRestoredSize({ width: 900, height: 400 }, narrow)?.width).toBe(468);
  });
});
