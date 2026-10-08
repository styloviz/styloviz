/**
 * ============================================================================
 *  Don't run change detection on a fixture that has already been destroyed
 * ============================================================================
 *
 * The 2026-09-02 Forms & Inputs audit recorded NG0406 — "This instance of the
 * `ApplicationRef` has already been destroyed." — flooding the date-picker,
 * date-range-picker and input-field suites while every assertion passed, and
 * inferred that those components leak scheduled work into a real app on route
 * change.
 *
 * ★★★ THEY DO NOT. IT IS THE HARNESS, NOT THE COMPONENTS. No Styloviz code is
 * involved in the warning at all. The mechanism, read off a captured stack:
 *
 *   1. `render()` from `@testing-library/angular` adds every fixture to a
 *      module-level `mountedFixtures` set.
 *   2. Every synthetic event ticks *all* of them — `dispatchEvent` →
 *      `eventWrapper` → `detectChangesForMountedFixtures()` → for each fixture,
 *      `fixture.detectChanges()`.
 *   3. A spec helper that calls `TestBed.resetTestingModule()` — 521 files in
 *      this repo do, inside their own render helper — destroys the previous
 *      fixtures (`destroyActiveFixtures()`) and then tears down the module,
 *      which destroys the `ApplicationRef`. It cannot remove them from that
 *      set, because the set belongs to the testing library.
 *   4. `ComponentFixture.detectChanges()` calls `this._appRef.tick()`
 *      **without checking its own `_isDestroyed` flag** — which `destroy()`
 *      sets three lines away. So every later event ticks the corpse, and
 *      `ApplicationRef.tick` warns.
 *
 * So a test that renders twice and then types leaves one dead fixture being
 * ticked per keystroke. That is why the count tracks *events after the second
 * render* rather than anything a component does: 45 warnings from the single
 * input-field test that renders twice then types five characters, 220 from the
 * timezone suite, and **zero** from the portal suite — which exercises the
 * portal hardest but calls `fixture.destroy()` explicitly and never re-renders.
 *
 * ★★ It is a `console.warn`, not a throw. `warnIfDestroyed` in `@angular/core`
 * prints and returns, which is exactly why thousands of assertions passed while
 * stderr filled up — and why the noise was read as a component defect for long
 * enough to reach an audit.
 *
 * ── The fix ─────────────────────────────────────────────────────────────────
 * Make `detectChanges()` a no-op once the fixture is destroyed. That is the
 * missing guard, at the point the stack actually blames, and it changes nothing
 * for a live fixture: detecting changes on a destroyed view has no meaning and
 * no observable effect beyond the warning.
 *
 * ★ Deliberately NOT fixed by editing the specs. The defect is in the seam
 * between two libraries, not in any spec — and "render twice in one test" is a
 * legitimate thing to write. Fixing it centrally keeps 521 files honest instead
 * of teaching their authors a workaround.
 *
 * ★ Deliberately NOT fixed by patching `resetTestingModule` to call the testing
 * library's `cleanup()`: that function is not exported, and reaching into the
 * library's module state would break on any upgrade. `_isDestroyed` is read
 * defensively below for the same reason — if a future Angular renames it, the
 * guard degrades to today's behaviour (a warning) rather than breaking a run.
 */
import { ComponentFixture } from '@angular/core/testing';

/** Marker so a double install cannot stack patches. */
const PATCHED = Symbol.for('styloviz.staleFixtureGuard');

type FixtureProto = {
  detectChanges(checkNoChanges?: boolean): void;
  [PATCHED]?: true;
};

/**
 * Installs the guard. Called once from `src/test-setup.ts`, so it applies to
 * every spec in every project.
 */
export function installStaleFixtureGuard(): void {
  const proto = ComponentFixture.prototype as unknown as FixtureProto;
  if (proto[PATCHED]) return;

  const original = proto.detectChanges;
  proto.detectChanges = function detectChanges(
    this: FixtureProto & { _isDestroyed?: boolean },
    checkNoChanges?: boolean,
  ): void {
    if (this._isDestroyed === true) return;
    original.call(this, checkNoChanges);
  };
  proto[PATCHED] = true;
}
