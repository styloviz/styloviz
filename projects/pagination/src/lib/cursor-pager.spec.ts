import { svResetWarnOnce } from '@styloviz/core';
import { createSvCursorPager } from './cursor-pager';

/**
 * ============================================================================
 *  The cursor trail — `NV-04-M1`
 * ============================================================================
 *
 * ★ A keyset API is forward-only: it returns the cursor for the NEXT page and
 * never for the previous one, because a cursor encodes the sort key of the row
 * after the last one you were handed. So Previous is impossible unless something
 * remembers the cursors already used. That is the whole primitive.
 */

describe('createSvCursorPager — the trail', () => {
  beforeEach(() => svResetWarnOnce());

  it('starts on the first page, with no cursor and nothing behind it', () => {
    const pager = createSvCursorPager();
    expect(pager.cursor()).toBeNull();
    expect(pager.pageIndex()).toBe(1);
    expect(pager.hasPrevious()).toBe(false);
    expect(pager.trail()).toEqual([null]);
  });

  it('advances forward and remembers the way back', () => {
    const pager = createSvCursorPager();

    expect(pager.advance('c1')).toBe(true);
    expect(pager.cursor()).toBe('c1');
    expect(pager.pageIndex()).toBe(2);
    expect(pager.hasPrevious()).toBe(true);

    expect(pager.advance('c2')).toBe(true);
    expect(pager.pageIndex()).toBe(3);

    expect(pager.back()).toBe(true);
    // ★ The point of the trail: `c1` was never sent again by the server, and
    //   could not have been recomputed from `c2`.
    expect(pager.cursor()).toBe('c1');
    expect(pager.pageIndex()).toBe(2);
  });

  it('refuses to go back past the first page', () => {
    const pager = createSvCursorPager();
    expect(pager.back()).toBe(false);
    expect(pager.pageIndex()).toBe(1);
  });

  it('resets to the first page and forgets the trail', () => {
    const pager = createSvCursorPager();
    pager.advance('c1');
    pager.advance('c2');
    pager.reset();
    expect(pager.trail()).toEqual([null]);
    expect(pager.hasPrevious()).toBe(false);
  });
});

describe('createSvCursorPager — a server that echoes its own cursor', () => {
  beforeEach(() => svResetWarnOnce());

  /**
   * ★★ THE ORDINAL IS THE THING BEING PROTECTED. A server that returns the
   * cursor it was just given is a real bug class (an off-by-one in a keyset
   * WHERE clause produces exactly that). The naive trail appends it, the ordinal
   * climbs to "page 5, 6, 7" — and every one of those pages is the same rows.
   * The user cannot tell, because the only evidence they have is the number.
   */
  it('refuses an advance to the cursor already on screen, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pager = createSvCursorPager();

    pager.advance('c1');
    expect(pager.advance('c1')).toBe(false);

    expect(pager.pageIndex()).toBe(2);
    expect(pager.trail()).toEqual([null, 'c1']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('already on'));
    warn.mockRestore();
  });

  it('refuses an empty cursor without warning — that is just "no next page"', () => {
    const pager = createSvCursorPager();
    expect(pager.advance('')).toBe(false);
    expect(pager.pageIndex()).toBe(1);
  });
});

describe('createSvCursorPager — restore', () => {
  beforeEach(() => svResetWarnOnce());

  it('adopts a trail so a session can resume mid-list', () => {
    const pager = createSvCursorPager();
    pager.restore([null, 'c1', 'c2']);
    expect(pager.pageIndex()).toBe(3);
    expect(pager.cursor()).toBe('c2');
    expect(pager.back()).toBe(true);
    expect(pager.cursor()).toBe('c1');
  });

  /**
   * ★ Repaired rather than rejected: a trail that round-trips through
   * `JSON.stringify` inside a query string is exactly where the leading `null`
   * goes missing, and throwing there would strand the user on a blank page.
   */
  it('repairs a trail whose leading null was lost', () => {
    const pager = createSvCursorPager(['c1', 'c2']);
    expect(pager.trail()).toEqual([null, 'c1', 'c2']);
    expect(pager.pageIndex()).toBe(3);
  });

  it('treats an empty trail as the first page', () => {
    const pager = createSvCursorPager([]);
    expect(pager.trail()).toEqual([null]);
  });
});
