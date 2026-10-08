import {
  SV_ASPECT_TOLERANCE,
  SV_PAGE_STEP,
  SV_STEP,
  svAriaValue,
  svAspect,
  svAspectLabel,
  svClampPosition,
  svClipInset,
  svPositionForKey,
  svPositionFromPointer,
  svPositionLabel,
} from './image-compare.geometry';

// ── Aspect ratio ────────────────────────────────────────────────────────────

describe('whether the two images are comparable at all', () => {
  /**
   * ★★★ TWO IMAGES OF DIFFERENT ASPECT RATIOS CANNOT BE COMPARED BY WIPING. One
   * of them is scaled or cropped to fit, so part of what the reader is shown as
   * "the change" is the reframing — and the widget looks exactly right.
   */
  it('accepts two images of the same shape', () => {
    const a = svAspect(1920, 1080, 1280, 720);
    expect(a.mismatched).toBe(false);
    expect(a.difference).toBeCloseTo(0, 6);
  });

  it('refuses a 4:3 against a 16:9', () => {
    const a = svAspect(1600, 1200, 1920, 1080);
    expect(a.mismatched).toBe(true);
    expect(svAspectLabel(a)).toContain('different shapes');
    expect(svAspectLabel(a)).toContain('not the change');
  });

  /**
   * ★★ 1% RATHER THAN 0. Two exports of the same source routinely differ by a
   * pixel, and refusing that would train people to ignore the warning.
   */
  it('tolerates a one-pixel difference between two exports of the same source', () => {
    expect(svAspect(1920, 1080, 1920, 1081).mismatched).toBe(false);
  });

  it('sits exactly on the tolerance without tripping', () => {
    // before 2.0, after 2.0 × (1 − tolerance): difference is exactly tolerance.
    const after = 2 * (1 - SV_ASPECT_TOLERANCE);
    expect(svAspect(2, 1, after, 1).mismatched).toBe(false);
  });

  /**
   * ★★ RELATIVE, NOT ABSOLUTE. An absolute threshold treats 0.5 against 0.55 —
   * a 10% reframing — as the same as 3.0 against 3.05, which is under 2%.
   */
  it('measures the difference relative to the ratio, not in absolute terms', () => {
    // The same ABSOLUTE gap of 0.02 either side of the threshold: on portrait
    // ratios it is a 4% reframing, on panoramic ones it is under 1%.
    const portraits = svAspect(48, 100, 50, 100); // 0.48 vs 0.50
    const panoramas = svAspect(300, 100, 302, 100); // 3.00 vs 3.02
    expect(portraits.difference).toBeGreaterThan(panoramas.difference * 4);
    expect(portraits.mismatched).toBe(true);
    expect(panoramas.mismatched).toBe(false);
  });

  /**
   * ★★ AND THE INVARIANT THAT MAKES THE LABEL SIMPLE. `known: false` always
   * comes with `mismatched: false` — nothing is claimed about a pair that was
   * never measured — so `svAspectLabel` does not re-check `known`. A mutation
   * proved the extra guard could not change any result the module can produce;
   * this test is what holds the invariant it was standing in for.
   */
  it('claims nothing until both images have reported their size', () => {
    for (const a of [
      svAspect(0, 0, 1920, 1080),
      svAspect(1920, 1080, 0, 0),
      svAspect(Number.NaN, 1080, 1920, 1080),
      svAspect(1920, 1080, 1920, Number.POSITIVE_INFINITY),
      svAspect(-1920, 1080, 1920, 1080),
    ]) {
      expect(a.known).toBe(false);
      expect(a.mismatched).toBe(false);
      expect(svAspectLabel(a)).toBe('');
    }
  });

  it('says nothing when there is nothing wrong', () => {
    expect(svAspectLabel(svAspect(1920, 1080, 1920, 1080))).toBe('');
  });
});

// ── Position ────────────────────────────────────────────────────────────────

describe('the wipe position', () => {
  it('clamps into the box', () => {
    expect(svClampPosition(-1)).toBe(0);
    expect(svClampPosition(2)).toBe(1);
    expect(svClampPosition(0.4)).toBe(0.4);
  });

  it('recovers to the middle from a nonsense position rather than producing NaN', () => {
    expect(svClampPosition(Number.NaN)).toBe(0.5);
  });

  it('reads a position off a pointer', () => {
    expect(svPositionFromPointer(150, 100, 200)).toBeCloseTo(0.25, 6);
    expect(svPositionFromPointer(100, 100, 200)).toBe(0);
    expect(svPositionFromPointer(300, 100, 200)).toBe(1);
  });

  it('clamps a pointer dragged outside the box', () => {
    expect(svPositionFromPointer(-500, 100, 200)).toBe(0);
    expect(svPositionFromPointer(9999, 100, 200)).toBe(1);
  });

  /**
   * ★★★ THE ZERO CASE IS COVERED TWICE AND THE NEGATIVE CASE ONCE. Removing the
   * width guard entirely left this first assertion green: dividing by zero gives
   * ±Infinity, and `svClampPosition` returns 0.5 for anything non-finite. So the
   * line the guard actually decides is the second one — a negative width divides
   * cleanly to a mirrored position that nothing downstream would question.
   */
  it('centres rather than dividing by a zero-width box', () => {
    expect(svPositionFromPointer(150, 100, 0)).toBe(0.5);
    expect(svPositionFromPointer(150, 100, Number.NaN)).toBe(0.5);
  });

  it('centres rather than mirroring a negatively-measured box', () => {
    // (150 − 100) / −200 = −0.25, which clamps to 0 — a plausible-looking
    // answer at the wrong end of the image.
    expect(svPositionFromPointer(150, 100, -200)).toBe(0.5);
  });
});

// ── Keyboard ────────────────────────────────────────────────────────────────

describe('the keyboard contract', () => {
  /**
   * ★★★ THIS CONTROL IS ALMOST NEVER KEYBOARD-OPERABLE, and it is a slider —
   * the one widget with an unambiguous, universally-implemented keyboard
   * contract that every screen-reader user already knows.
   */
  it('nudges with the arrows, in both orientations', () => {
    expect(svPositionForKey('ArrowRight', 0.5)).toBeCloseTo(0.5 + SV_STEP, 6);
    expect(svPositionForKey('ArrowUp', 0.5)).toBeCloseTo(0.5 + SV_STEP, 6);
    expect(svPositionForKey('ArrowLeft', 0.5)).toBeCloseTo(0.5 - SV_STEP, 6);
    expect(svPositionForKey('ArrowDown', 0.5)).toBeCloseTo(0.5 - SV_STEP, 6);
  });

  it('jumps with the page keys', () => {
    expect(svPositionForKey('PageUp', 0.5)).toBeCloseTo(0.5 + SV_PAGE_STEP, 6);
    expect(svPositionForKey('PageDown', 0.5)).toBeCloseTo(0.5 - SV_PAGE_STEP, 6);
  });

  it('goes to the extremes with Home and End', () => {
    expect(svPositionForKey('Home', 0.4)).toBe(0);
    expect(svPositionForKey('End', 0.4)).toBe(1);
  });

  it('never steps out of the box', () => {
    expect(svPositionForKey('ArrowLeft', 0)).toBe(0);
    expect(svPositionForKey('ArrowRight', 1)).toBe(1);
    expect(svPositionForKey('PageDown', 0.05)).toBe(0);
    expect(svPositionForKey('PageUp', 0.95)).toBe(1);
  });

  /**
   * ★★ null, NOT THE UNCHANGED POSITION. The caller uses the answer to decide
   * whether to call `preventDefault()`; a handler that "handles" Tab by
   * returning the same number is how a slider traps focus.
   */
  it('declines keys it does not own, rather than swallowing them', () => {
    for (const key of ['Tab', 'Escape', 'a', 'Enter', ' ']) {
      expect(svPositionForKey(key, 0.5)).toBeNull();
    }
  });
});

// ── Rendering ───────────────────────────────────────────────────────────────

describe('the clip', () => {
  it('hides everything at zero and nothing at one', () => {
    expect(svClipInset(0)).toBe('inset(0 100.000% 0 0)');
    expect(svClipInset(1)).toBe('inset(0 0.000% 0 0)');
  });

  it('reveals half at the middle', () => {
    expect(svClipInset(0.5)).toBe('inset(0 50.000% 0 0)');
  });

  it('clamps rather than emitting a negative inset', () => {
    expect(svClipInset(-1)).toBe('inset(0 100.000% 0 0)');
    expect(svClipInset(2)).toBe('inset(0 0.000% 0 0)');
  });

  /**
   * ★ THREE DECIMALS, NOT ZERO. Rounding the inset to whole per cent quantises
   * a drag on a 1 200 px image to 12 px jumps, which reads as a laggy control.
   */
  it('keeps enough precision that a drag is smooth', () => {
    expect(svClipInset(0.5005)).not.toBe(svClipInset(0.5));
  });
});

describe('the accessible value', () => {
  it('reports a whole percentage for the slider', () => {
    expect(svAriaValue(0)).toBe(0);
    expect(svAriaValue(0.427)).toBe(43);
    expect(svAriaValue(1)).toBe(100);
  });

  it('names which image is showing at each end', () => {
    expect(svPositionLabel(0, 'the original', 'the retouch')).toBe('Showing the original only.');
    expect(svPositionLabel(1, 'the original', 'the retouch')).toBe('Showing the retouch only.');
  });

  it('names the split in between', () => {
    expect(svPositionLabel(0.25, 'before', 'after')).toBe('25% after, 75% before.');
  });
});
