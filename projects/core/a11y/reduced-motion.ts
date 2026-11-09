/**
 * `prefers-reduced-motion` helpers.
 *
 * Premium components must honour the user's motion preference. Use
 * `prefersReducedMotion()` for one-shot checks (e.g. deciding whether to
 * animate) and `onReducedMotionChange()` to react to live OS-level changes.
 *
 * All helpers are SSR-safe — they no-op / return `false` without `window`.
 */

const QUERY = '(prefers-reduced-motion: reduce)';

/** Returns `true` when the user has requested reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(QUERY).matches;
}

/**
 * Subscribes to changes in the reduced-motion preference.
 * @returns an unsubscribe function. No-op (returns a no-op) without `window`.
 */
export function onReducedMotionChange(cb: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {
      /* intentionally empty */
    };
  }
  const mql = window.matchMedia(QUERY);
  const handler = (e: MediaQueryListEvent): void => cb(e.matches);
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}
