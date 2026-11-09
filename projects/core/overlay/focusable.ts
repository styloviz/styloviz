/**
 * What counts as focusable, in one place.
 *
 * ★★ THE KIT HAD TEN COPIES OF THIS SELECTOR AND THEY DID NOT AGREE. Some
 *    excluded disabled controls, some did not; some counted `[role="button"]`,
 *    some counted `[contenteditable]`, most counted neither. A focus trap built
 *    on a selector that matches a DISABLED input will happily nominate that
 *    input as its "first focusable" — and `focus()` on a disabled control is a
 *    no-op, so Tab wraps into nothing and the trap leaks. The disagreements are
 *    not cosmetic; they are the difference between a working trap and a silent
 *    one.
 */
export const SV_FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  'audio[controls]',
  'video[controls]',
  'iframe',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Is this element one the browser would actually put focus on?
 *
 * ★ Deliberately NOT a layout test. The obvious extra check — does it render,
 *   via `getClientRects()` or `offsetParent` — is worse than useless here: it
 *   is wrong under `content-visibility`, wrong for an element inside a
 *   collapsing transition, and in jsdom it reports EVERY element as invisible,
 *   which would make every one of these helpers return nothing under test
 *   while behaving correctly in a browser. A guard that only works where it is
 *   never exercised is not a guard. So this checks the things that are true of
 *   the DOM itself — detached, `hidden`, `inert`, `disabled` — and leaves
 *   visibility to the caller, which usually knows.
 */
export function svIsFocusable(el: Element | null | undefined): el is HTMLElement {
  // `typeof` guard: with no DOM (SSR) `HTMLElement` is undefined and a bare
  // `instanceof` would throw a ReferenceError rather than answer false.
  if (!el || typeof HTMLElement === 'undefined' || !(el instanceof HTMLElement)) return false;
  if (!el.isConnected) return false;
  if (el.hasAttribute('disabled')) return false;
  if (el.hidden) return false;
  // ★ `closest`, not a check on the element itself: both of these are
  //   INHERITED. A button three levels inside an `inert` or `aria-hidden`
  //   subtree carries neither attribute and is still unreachable.
  if (el.closest('[inert], [aria-hidden="true"]')) return false;
  return el.matches(SV_FOCUSABLE_SELECTOR) || el.tabIndex >= 0;
}

/**
 * Every focusable element inside `root`, in tab order, `root` itself excluded.
 *
 * Elements inside an `inert` or `aria-hidden` subtree are dropped — a focus
 * trap that hands back a node no browser will focus is how a trap starts
 * failing silently.
 */
export function svFocusableWithin(root: Element | null | undefined): HTMLElement[] {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>(SV_FOCUSABLE_SELECTOR)].filter(svIsFocusable);
}

/** The first focusable element inside `root`, or `null`. */
export function svFirstFocusableWithin(root: Element | null | undefined): HTMLElement | null {
  return svFocusableWithin(root)[0] ?? null;
}
