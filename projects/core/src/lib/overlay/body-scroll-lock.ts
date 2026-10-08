/**
 * Body scroll lock, shared by every surface on the page that takes one.
 *
 * ★★★ IT IS REFERENCE-COUNTED, AND THAT IS THE WHOLE POINT.
 *
 * Each surface locking and unlocking on its own is correct right up to the
 * moment two are open — which the imperative `SvModalService` makes ordinary: a
 * dialog opens a confirm on top of itself. Close the top one and a per-instance
 * `unlockScroll()` clears `body.overflow`, so the page starts scrolling
 * underneath a dialog that is still open. Nothing errors; the background just
 * begins moving behind a modal overlay, which reads as a rendering glitch and
 * is nearly impossible to attribute to the dialog that closed.
 *
 * ★★ THIS LIVED IN `@styloviz/modal` AND THREE OTHER FAMILIES HAD THEIR OWN,
 *    UNCOUNTED COPY. Drawer, Confirm Dialog and Command Palette each wrote the
 *    four lines above with no depth and no saved previous value, so every
 *    combination of them hit the bug this file's first paragraph describes —
 *    and `X-5` is the backlog item for exactly that. Moved into core so there
 *    is one; `@styloviz/modal` still re-exports it, so its consumers are
 *    unaffected.
 *
 * The count also fixes the subtler half: `paddingRight` compensates for the
 * scrollbar that hiding the overflow removes. Measured a second time while the
 * lock is already on, the scrollbar is already gone, so the measurement comes
 * back 0 and the compensation is lost — the page shifts sideways under the
 * second dialog. The width measured by the FIRST lock is the only correct one,
 * so it is the one kept until the last unlock.
 */

interface LockState {
  /** How many modals currently want the page not to scroll. */
  depth: number;
  /** What `body.style.overflow` was before the first lock. */
  overflow: string;
  /** What `body.style.paddingRight` was before the first lock. */
  paddingRight: string;
}

const state: LockState = { depth: 0, overflow: '', paddingRight: '' };

/**
 * Take a lock. Returns the new depth, which is what the tests assert on.
 *
 * The first caller measures and applies; later callers only increment.
 */
export function svLockBodyScroll(doc: Document): number {
  if (state.depth === 0) {
    const body = doc.body;
    // ★ The PREVIOUS values are saved, not assumed to be empty. A host with its
    // own `overflow: hidden` on `<body>` — a full-height app shell, which is
    // most dashboards — would otherwise have it wiped by the first modal that
    // closed, and the page would start scrolling for the rest of the session.
    state.overflow = body.style.overflow;
    state.paddingRight = body.style.paddingRight;

    const scrollbar = doc.defaultView
      ? doc.defaultView.innerWidth - doc.documentElement.clientWidth
      : 0;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
  }
  return ++state.depth;
}

/**
 * Release a lock. Only the last one out restores the page.
 *
 * Releasing more times than you locked cannot drive the depth negative — a
 * modal destroyed while open unlocks from `ngOnDestroy`, and a double release
 * would otherwise leave the count at -1 and the NEXT lock would never apply
 * anything.
 */
export function svUnlockBodyScroll(doc: Document): number {
  if (state.depth === 0) return 0;
  state.depth--;
  if (state.depth === 0) {
    doc.body.style.overflow = state.overflow;
    doc.body.style.paddingRight = state.paddingRight;
  }
  return state.depth;
}

/** Current depth. Exported for tests and for diagnosing a stuck page. */
export function svBodyScrollLockDepth(): number {
  return state.depth;
}

/**
 * Drop every lock and restore the page.
 *
 * For `closeAll()` and for test teardown: a spec that leaves the depth above
 * zero poisons every spec after it in the same document, and the failure lands
 * somewhere unrelated.
 */
export function svResetBodyScrollLock(doc: Document): void {
  if (state.depth > 0) {
    doc.body.style.overflow = state.overflow;
    doc.body.style.paddingRight = state.paddingRight;
  }
  state.depth = 0;
  state.overflow = '';
  state.paddingRight = '';
}
