import {
  svBodyScrollLockDepth,
  svLockBodyScroll,
  svResetBodyScrollLock,
  svUnlockBodyScroll,
} from './body-scroll-lock';

/**
 * A spec that leaves the depth above zero poisons every spec after it in the
 * same document, and the failure lands somewhere unrelated.
 */
afterEach(() => {
  svResetBodyScrollLock(document);
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
});

describe('body scroll lock', () => {
  it('locks on the first take and restores on the last release', () => {
    svLockBodyScroll(document);
    expect(document.body.style.overflow).toBe('hidden');

    svUnlockBodyScroll(document);
    expect(document.body.style.overflow).toBe('');
    expect(svBodyScrollLockDepth()).toBe(0);
  });

  /**
   * ★★★ THE ONE THAT MATTERS: TWO DIALOGS, ONE CLOSES.
   *
   * Per-instance locking is correct right up to the moment two modals are open
   * — which `SvModalService` makes ordinary, since a dialog can open a confirm
   * on top of itself. Closing the top one used to clear `body.overflow` while
   * the one underneath was still up, and the page started scrolling behind an
   * open dialog. Nothing errors; the background just moves.
   */
  it('stays locked while a second holder is still open', () => {
    svLockBodyScroll(document);
    svLockBodyScroll(document);
    expect(svBodyScrollLockDepth()).toBe(2);

    svUnlockBodyScroll(document);
    expect(document.body.style.overflow).toBe('hidden');

    svUnlockBodyScroll(document);
    expect(document.body.style.overflow).toBe('');
  });

  /**
   * ★★ THE PAGE IS PUT BACK THE WAY IT WAS, NOT BLANKED.
   *
   * A full-height app shell with its own `overflow: hidden` on `<body>` — which
   * is most dashboards — would otherwise have it wiped by the first modal that
   * closed, and the page would scroll for the rest of the session.
   */
  it('restores the host page own styles rather than clearing them', () => {
    document.body.style.overflow = 'clip';
    document.body.style.paddingRight = '7px';

    svLockBodyScroll(document);
    expect(document.body.style.overflow).toBe('hidden');

    svUnlockBodyScroll(document);
    expect(document.body.style.overflow).toBe('clip');
    expect(document.body.style.paddingRight).toBe('7px');
  });

  /**
   * ★★ A DOUBLE RELEASE MUST NOT DRIVE THE COUNT NEGATIVE.
   *
   * A modal destroyed while open unlocks from `ngOnDestroy` as well as from its
   * close path. At -1 the NEXT lock would only bring it back to 0 and would
   * apply nothing at all, so the following dialog would open over a scrolling
   * page — a bug one dialog removed from its cause.
   */
  it('ignores releases it was never given', () => {
    svUnlockBodyScroll(document);
    svUnlockBodyScroll(document);
    expect(svBodyScrollLockDepth()).toBe(0);

    svLockBodyScroll(document);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('drops every lock on reset', () => {
    svLockBodyScroll(document);
    svLockBodyScroll(document);
    svLockBodyScroll(document);

    svResetBodyScrollLock(document);

    expect(svBodyScrollLockDepth()).toBe(0);
    expect(document.body.style.overflow).toBe('');
  });
});
