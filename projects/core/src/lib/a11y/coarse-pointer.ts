/**
 * "Is the primary pointer a finger?"
 *
 * ── The defect this exists for (`FI-03-I1`) ────────────────────────────────
 *
 * ★★★ A HOVER-TRIGGERED PANEL ON A TOUCHSCREEN IS NOT MERELY UNREACHABLE — IT
 *     IS WORSE THAN THAT. Mobile browsers fire a synthetic `mouseenter` on tap,
 *     so hover expansion half-works: the tap that was meant to *choose* a branch
 *     opens it instead, and a drag across the panel opens whatever the finger
 *     passed over. "Unreachable" would at least be obvious.
 *
 * ★★ THE HOST CANNOT DECIDE THIS AT TEMPLATE TIME. `expandTrigger="hover"` is a
 *    reasonable thing to write for a desktop app, and the same build runs on a
 *    tablet. The component is the only party that knows what the pointer is —
 *    and on a hybrid device it can change mid-session, which is why this is a
 *    subscription and not a one-shot read.
 *
 * `(hover: none)` rather than `(pointer: coarse)`: a stylus is coarse and hovers
 * perfectly well, and a laptop with a touchscreen reports `coarse` for its
 * *secondary* pointer while the trackpad hovers fine. The question here is
 * literally whether hovering exists.
 *
 * SSR-safe: `false` without `window`, which is the desktop assumption and the
 * one that renders the same markup the client will.
 */
const QUERY = '(hover: none)';

export function svHoverUnavailable(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Subscribe to changes. Returns an unsubscribe function; a no-op without
 * `window`.
 */
export function svOnHoverAvailabilityChange(cb: (unavailable: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => { /* intentionally empty */ };
  }
  const mql = window.matchMedia(QUERY);
  const handler = (e: MediaQueryListEvent): void => cb(e.matches);
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}
