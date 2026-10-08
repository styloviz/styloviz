declare const ngDevMode: boolean | undefined;

/** One warning per key, so a grid of twelve controls logs once. */
const warned = new Set<string>();

/**
 * A dev-only warning, emitted at most once per key. Silent in production.
 *
 * ★★ THE `Set` IS THE POINT, NOT THE `console.warn`. A warning that fires on
 *    every change detection in a list of two hundred rows is noise somebody
 *    turns off, and then the next warning is invisible too.
 *
 * ⚠️ NOT A REPLACEMENT FOR A TYPE OR A TEST. It is for the case where the
 *    component can SEE the host has done something contradictory but cannot
 *    fix it, because the thing to fix is on the host's side.
 */
export function svWarnOnce(key: string, message: string): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[styloviz] ${message}`);
}

/** Test-only: forget what has already been warned about. */
export function svResetWarnOnce(): void { warned.clear(); }
