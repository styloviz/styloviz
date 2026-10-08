/**
 * ============================================================================
 *  Fail a scoped test on an Angular runtime warning
 * ============================================================================
 *
 * The 2026-09-02 chart audit put "no relevant console warnings" on its
 * acceptance gate and found the gate unmeetable: both `line-chart.ragged.spec.ts`
 * hosts bound `showDots` directly while the component exposes that setting
 * through its options contract, so every run printed
 *
 *     NG0303: Can't set value of the 'showDots' input on the
 *     'SvLineChartComponent' component.
 *
 * and every assertion passed anyway. That is the failure mode worth gating: the
 * binding was silently doing NOTHING, so the test proved less than it claimed,
 * and a real template-contract regression would have looked identical.
 *
 * ★ Angular codes only, NOT all console output. The kit warns on purpose — the
 * bar chart's negative-value clamp prints a `[styloviz]` explanation and three
 * specs assert it. A guard that failed on any console call would have to exempt
 * those, and an exemption list is how a gate stops meaning anything. `NG####` is
 * emitted only by the framework, and the framework only emits it when the
 * component/template contract is being misused.
 *
 * ★★ BOTH `console.warn` and `console.error`, and the second one is the one that
 * matters. NG0303 is reported through `console.error`, not `console.warn` —
 * `reportUnknownPropertyError` in `@angular/core` reads
 *
 *     if (shouldThrowErrorOnUnknownProperty) throw new RuntimeError(303, message);
 *     else console.error(formatRuntimeError(303, message));
 *
 * A warn-only guard was written first and silently caught nothing: it passed a
 * synthetic `console.warn('NG0303…')` probe and still let the real ragged-line
 * warning through. Verify a guard against the real defect, not a synthetic one.
 *
 * ── Why not Angular's own `errorOnUnknownProperties` ─────────────────────────
 * That flag (`TestEnvironmentOptions`, or `TestModuleMetadata`) flips the
 * `shouldThrowErrorOnUnknownProperty` branch above and is the idiomatic switch —
 * but it is only settable GLOBALLY at `initTestEnvironment`, or per TestBed
 * configuration. Global would hold all 2,846 tests to a rule only the chart
 * packages have been cleared for; per-TestBed does not survive here because the
 * chart specs call `TestBed.resetTestingModule()` inside their own render
 * helpers, after any hook this file could install. Revisit it as the scope list
 * below approaches the whole repo, and delete this guard when it gets there.
 *
 * ── Scope ────────────────────────────────────────────────────────────────────
 * Charts first, because that is where the debt was measured and cleared. The
 * intent is to widen `SCOPED_PATHS` one package at a time, each after its own
 * warnings are fixed — a repo-wide flip would turn suites red for debt nobody
 * has looked at yet, which teaches people to disable the guard.
 */

/** Spec paths held to the no-Angular-warnings rule. Widen deliberately. */
export const SCOPED_PATHS: readonly string[] = [
  'projects/charts/',
  'projects/charts-free/',
  // Added 2026-09-10, once NG0406 was gone from them. These are the three
  // families the Forms & Inputs audit flagged — date picker, date range picker
  // and input field — and their warnings turned out to be a harness gap rather
  // than component debt, so the scope could widen the moment
  // `installStaleFixtureGuard` landed. 625 tests, zero Angular warnings.
  'projects/input-field/',
  'projects/input-field-free/',
];

/**
 * `NG0303`, `NG0912`, `NG8101` … four digits, always. Anchored on a word
 * boundary so a message merely *quoting* a code inside a longer token does not
 * match.
 */
const ANGULAR_CODE = /\bNG\d{4}\b/;

/** Flattens a `console.warn` argument list the way the console would print it. */
export function warningText(args: readonly unknown[]): string {
  return args
    .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : String(a)))
    .join(' ');
}

/** Whether a `console.warn` call carries an Angular runtime code. */
export function isAngularWarning(args: readonly unknown[]): boolean {
  return ANGULAR_CODE.test(warningText(args));
}

/**
 * Whether a spec file is held to the rule. `testPath` is absolute and the scope
 * list is repo-relative, so this is a substring match rather than a prefix one.
 */
export function isScoped(testPath: string, scopedPaths: readonly string[] = SCOPED_PATHS): boolean {
  return scopedPaths.some((p) => testPath.includes(p));
}

/**
 * Installs the guard. Called once from `src/test-setup.ts`, so it applies to
 * every spec in the `unit` and `icons` projects and costs nothing outside
 * `SCOPED_PATHS`.
 */
export function installAngularWarningGuard(scopedPaths: readonly string[] = SCOPED_PATHS): void {
  let captured: string[] = [];
  /** Whether the CURRENT test is in scope; recomputed per test. */
  let armed = false;

  // Patched once, for the lifetime of the worker, on both channels. Out of scope
  // each is a pass-through, so an unscoped spy in another spec still sees its
  // own calls — and the original is always invoked, so the message is still
  // printed and still attributed to the test by Vitest's reporter.
  for (const channel of ['warn', 'error'] as const) {
    const original = console[channel];
    console[channel] = (...args: readonly unknown[]): void => {
      if (armed && isAngularWarning(args)) captured.push(warningText(args));
      original(...(args as []));
    };
  }

  beforeEach(() => {
    armed = isScoped(expect.getState().testPath ?? '', scopedPaths);
    captured = [];
  });

  afterEach(() => {
    if (!armed || !captured.length) return;
    const seen = captured;
    // Cleared before throwing, or a failure here would re-report on the next
    // test in the file and blame the wrong one.
    captured = [];
    throw new Error(
      `Angular reported ${seen.length} runtime warning(s) during this test.\n\n` +
        seen.map((m) => `  • ${m}`).join('\n\n') +
        `\n\nAn NG#### warning means a binding or template contract is being ` +
        `misused — the assertions can pass while the thing under test does ` +
        `nothing. Fix the host, do not silence the warning.\n` +
        `See src/testing/angular-warning-guard.ts.`,
    );
  });
}
