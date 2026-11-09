import { svSwipeClamp, svSwipeLogical, svSwipeRelease, svSwipeTrayWidth, type SvSwipeRevealRule } from './swipe-reveal';

/** FL-F8 — where a swiped row lands. Offsets are logical: + reveals the start actions. */
const RULE: SvSwipeRevealRule = { width: 360, actionWidth: 76, startCount: 1, endCount: 2, fullSwipe: true };

describe('swipe-reveal', () => {
  it('converts physical travel to logical, mirrored in right-to-left', () => {
    expect(svSwipeLogical(40, false)).toBe(40);
    expect(svSwipeLogical(40, true)).toBe(-40);
  });

  it('sizes each tray by its action count', () => {
    expect(svSwipeTrayWidth('start', RULE)).toBe(76);
    expect(svSwipeTrayWidth('end', RULE)).toBe(152);
  });

  describe('svSwipeClamp', () => {
    it('★ never moves toward a side with no actions', () => {
      expect(svSwipeClamp(120, { ...RULE, startCount: 0 })).toBe(0);
      expect(svSwipeClamp(-120, { ...RULE, endCount: 0 })).toBe(0);
    });

    it('follows past the tray up to the row width when a full swipe is allowed', () => {
      expect(svSwipeClamp(-300, RULE)).toBe(-300);
      expect(svSwipeClamp(-900, RULE)).toBe(-360);
    });

    it('stops at the tray without a full swipe', () => {
      expect(svSwipeClamp(-300, { ...RULE, fullSwipe: false })).toBe(-152);
      expect(svSwipeClamp(300, { ...RULE, fullSwipe: false })).toBe(76);
    });

    it('treats a non-number as rest', () => {
      expect(svSwipeClamp(Number.NaN, RULE)).toBe(0);
    });
  });

  describe('svSwipeRelease', () => {
    it('closes at rest', () => {
      expect(svSwipeRelease(0, 0, RULE)).toEqual({ kind: 'close' });
    });

    it('★ opens past half the tray, closes short of it', () => {
      expect(svSwipeRelease(-80, 0, RULE)).toEqual({ kind: 'open', side: 'end' });
      expect(svSwipeRelease(-70, 0, RULE)).toEqual({ kind: 'close' });
      expect(svSwipeRelease(40, 0, RULE)).toEqual({ kind: 'open', side: 'start' });
    });

    it('★ commits past 60% of the width, and only with fullSwipe', () => {
      expect(svSwipeRelease(-220, 0, RULE)).toEqual({ kind: 'commit', side: 'end' });
      expect(svSwipeRelease(-220, 0, { ...RULE, fullSwipe: false })).toEqual({ kind: 'open', side: 'end' });
      expect(svSwipeRelease(-150, 0, { ...RULE, fullSwipeRatio: 0.4 })).toEqual({ kind: 'commit', side: 'end' });
    });

    it('a fast flick toward a side opens it from a short drag (16px minimum)', () => {
      expect(svSwipeRelease(-30, -0.6, RULE)).toEqual({ kind: 'open', side: 'end' });
      expect(svSwipeRelease(-10, -0.9, RULE)).toEqual({ kind: 'close' });
    });

    it('★ a flick back toward the middle closes, wherever the row is', () => {
      expect(svSwipeRelease(-140, 0.6, RULE)).toEqual({ kind: 'close' });
    });

    it('never opens a side with no actions', () => {
      expect(svSwipeRelease(200, 0, { ...RULE, startCount: 0 })).toEqual({ kind: 'close' });
    });
  });
});
