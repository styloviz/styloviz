declare const ngDevMode: boolean | undefined;

/** One warning per component name, so a grid of twelve cards logs once. */
const warned = new Set<string>();

/**
 * Warn that a component is faking work because `simulate` is on.
 *
 * `simulate` defaults to `false` in every component that has it, so production
 * never depends on an integrator remembering a demo switch. This covers the
 * opposite mistake: a demo left on in a dev build, where a fabricated refresh,
 * rewrite, or indexing ramp is indistinguishable from the real thing. Silent in
 * production bundles.
 *
 * Shared rather than copied per package: three components need this warning, and
 * the second copy of "name the component and say the work was faked" always
 * drifts from the first.
 */
export function svWarnSimulating(selector: string): void {
  if (typeof ngDevMode === 'undefined' || !ngDevMode) return;
  if (warned.has(selector)) return;
  warned.add(selector);
  console.warn(
    `[styloviz] <${selector}> ran a simulated action because simulate is true. ` +
      'Nothing left the component and no real work happened — the result you see ' +
      'is bundled sample data. Remove simulate before shipping.',
  );
}
