/**
 * "The user wants more contrast, or has taken the palette over."
 *
 * ★★★ TWO QUERIES, ONE ANSWER, AND THAT IS THE DESIGN. `(prefers-contrast:
 *     more)` is a request — macOS "Increase contrast", Windows' contrast
 *     slider — and `(forced-colors: active)` is a seizure: Windows High
 *     Contrast replaces the page's colours with the user's own. A component
 *     that honours one and not the other has a decorative glow left over in
 *     exactly the mode that cannot render it, so both resolve to the same
 *     fallback here rather than at every call site.
 *
 * ★★ WHAT IT IS FOR IS DROPPING DECORATION, NOT RE-COLOURING. A glow, a
 *    gradient and a translucent tint are all ways of saying something with
 *    colour alone; under either query they lose the contrast that made them
 *    legible (1.4.11 asks for 3:1 against what is adjacent, and a blurred edge
 *    has no one contrast to measure). The answer is to fall back to a solid
 *    treatment — not to pick different custom colours, which forced-colors
 *    will override anyway.
 *
 * SSR-safe: `false` without `window`, which is the assumption that renders the
 * markup the client will hydrate.
 */

const QUERIES = ['(prefers-contrast: more)', '(forced-colors: active)'] as const;

/** Returns `true` when the user has asked for more contrast, or forced colors. */
export function svHighContrast(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return QUERIES.some(q => window.matchMedia(q).matches);
}

/**
 * Subscribe to changes in either preference.
 *
 * ★ Both lists are watched and the callback receives the OR, so a component
 *   holds one signal rather than two and cannot get the combination wrong.
 *
 * @returns an unsubscribe function; a no-op without `window`.
 */
export function svOnHighContrastChange(cb: (high: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => { /* intentionally empty */ };
  }
  const lists = QUERIES.map(q => window.matchMedia(q));
  const handler = (): void => cb(lists.some(l => l.matches));
  for (const l of lists) l.addEventListener('change', handler);
  return () => { for (const l of lists) l.removeEventListener('change', handler); };
}
