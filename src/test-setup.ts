/**
 * Vitest global setup — initializes the Angular TestBed environment once
 * for every spec. Referenced by `vitest.config.ts` → `test.setupFiles`.
 */
import '@analogjs/vite-plugin-angular/setup-vitest';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { installAngularWarningGuard } from './testing/angular-warning-guard';
import { installStaleFixtureGuard } from './testing/stale-fixture-guard';

/**
 * ★★★ RESET FIRST, AND THAT ONE LINE IS WHAT LETS A SPEC FILE SHARE A PROCESS.
 *
 *     `initTestEnvironment` throws `Cannot set base providers because it has
 *     already been called` if the environment is already up, so this file used
 *     to carry an unwritten requirement: **one process per spec file**. Vitest
 *     satisfies that by isolating each file — until it has only one worker to
 *     isolate with. Then it reuses the process, the second spec file re-runs
 *     this setup, and it throws.
 *
 * ★★ THAT MAKES IT A CORE-COUNT BUG, which is the worst kind to find late. An
 *    8-core dev machine never reproduces it; a 2-core CI runner fails 9 of 10
 *    files in a batch and passes the one that happened to go first. Reproduced
 *    deliberately with `--maxWorkers=1` on an 8-core machine, where it fails
 *    identically — so this is scheduling, not platform.
 *
 * ★ `resetTestEnvironment()` is a no-op when nothing has been initialised, so
 *   the isolated path — still the normal one — is unchanged. What it removes is
 *   the assumption, and `vitest.config.ts` has a paragraph documenting that
 *   assumption as a constraint to work around rather than something to fix.
 */
const testBed = getTestBed();
testBed.resetTestEnvironment();
testBed.initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

/**
 * Turn an Angular `NG####` warning into a test failure, for the packages listed
 * in the guard's own scope. See `src/testing/angular-warning-guard.ts` for why
 * it is framework codes only and why the scope is deliberately partial.
 */
installAngularWarningGuard();

/**
 * Stop a destroyed fixture from being ticked by `@testing-library/angular`'s
 * mounted-fixture registry, which is the entire source of the NG0406 noise in
 * this suite. See `src/testing/stale-fixture-guard.ts` — it is a harness gap,
 * not a component leak.
 */
installStaleFixtureGuard();

/**
 * Silence zone.js's console report for rejections it only *believes* are
 * unhandled.
 *
 * zone.js flags a rejection as unhandled when the handler is attached in a
 * later microtask than the one that created it — which is exactly what `await`
 * inside a `try/catch` looks like from outside. Every test that deliberately
 * fails a request therefore dumped the whole error object to stderr:
 *
 *     stderr | ai-ops/knowledge surfaces a failed load with a retry
 *     HttpErrorResponse { headers: HttpHeaders { … }, status: 500, … }
 *
 * Seven such dumps in two directories alone, on a run where nothing failed.
 * Traced to `zone.js: handleUnhandledRejection → api.onUnhandledError`, whose
 * guard is `showUncaughtError: () => !ZoneImpl[__symbol__('ignoreConsoleError…')]`
 * — read off the **Zone object**, and only once zone.js has loaded. Hence here,
 * after the import above, rather than as a global set beforehand.
 *
 * Safe because it suppresses zone's *printing*, not the detection: Vitest keeps
 * its own `unhandledRejection` listener and fails the run on a real one.
 * `src/zone-flags.spec.ts` asserts both halves of that, so this cannot quietly
 * become a way to lose errors.
 */
(Zone as unknown as Record<string, unknown>)['__zone_symbol__ignoreConsoleErrorUncaughtError'] = true;

/**
 * Give jsdom the one legacy editing API it is asked for passively.
 *
 * ★ This is a gap in the TEST ENVIRONMENT, not a defect in the component.
 * Verified in Chromium: `queryCommandState`, `queryCommandValue` and
 * `execCommand` all exist and return `false`/`''` rather than throwing, even for
 * an empty selection. jsdom implements none of them.
 *
 * `sv-rich-text-editor` registers a `document:selectionchange` listener that
 * calls `document.queryCommandState` eight times to light up its toolbar. The
 * moment anything focuses the editor — which `autoFocus` does by design —
 * jsdom fires selectionchange and the handler throws
 * `TypeError: document.queryCommandState is not a function` **out of a document
 * listener**, where no test can catch it. Vitest reports it as an unhandled
 * error and warns it "might cause false positive tests". A spec author has no
 * way to avoid triggering it, which is why the stub belongs here rather than in
 * any one spec.
 *
 * ★ `execCommand` is deliberately NOT stubbed. Nothing calls it passively — it
 * only runs from an explicit toolbar action — so a spec that reaches it should
 * fail loudly rather than silently format nothing. That is a signal the
 * behaviour needs a real browser, which is what `e2e/` is for.
 *
 * Returns `false`: "no formatting is applied here", which is the truth for a
 * selection jsdom never laid out. Defined only when absent, so a future jsdom
 * that implements it properly wins.
 */
{
  const doc = document as Document & { queryCommandState?: (command: string) => boolean };
  if (typeof doc.queryCommandState !== 'function') {
    doc.queryCommandState = () => false;
  }
}

/**
 * ★ `Element.prototype.scrollIntoView` — jsdom implements NO scrolling at all.
 *
 * `sv-form-error-summary` centres the field it jumps to. In jsdom that call
 * throws `TypeError: scrollIntoView is not a function` from inside a
 * `setTimeout`, where no spec can catch it: the assertions still pass, Vitest
 * reports an unhandled error, and the failure looks like it belongs to whatever
 * test happened to be running when the timer fired.
 *
 * ★ The stub does nothing rather than recording calls. jsdom has no layout, so
 * there is no scroll position for a spec to assert against — a test that
 * checked "did it scroll" would be checking that this line exists. What is
 * worth asserting is where FOCUS landed, and that jsdom does model.
 *
 * Defined only when absent, so a future jsdom that implements it wins.
 */
{
  const proto = Element.prototype as Element & { scrollIntoView?: () => void };
  if (typeof proto.scrollIntoView !== 'function') {
    proto.scrollIntoView = () => { /* jsdom has no layout to scroll */ };
  }
}

/**
 * ★ `crypto.subtle` — jsdom ships `crypto` with `randomUUID` and
 * `getRandomValues` and **no `subtle` at all**.
 *
 * `sv-signature-pad`'s attestation is a SHA-256 digest over the consent wording
 * and the strokes together (`FI-21-M1`), and `svSignatureHash` correctly returns
 * `null` when `crypto.subtle` is missing — that is real behaviour on plain
 * `http://`, in an insecure iframe and during SSR, and the component degrades to
 * an unattested value rather than throwing. So the production code was right and
 * **eight of its tests could not run**: `attest()` returned `null` for the
 * environment's reason rather than the test's, and the specs read
 * `(await pad.attest(AT))!.consentText` off it.
 *
 * ★★ THE REAL NODE IMPLEMENTATION, NOT A STUB. `node:crypto`'s `webcrypto` is a
 *    genuine WebCrypto, so the digests are actual SHA-256 — which is what makes
 *    `svVerifySignature`'s `ok` / `mismatch` tests worth anything. A fake that
 *    returned a fixed string would let a broken record-serialiser pass.
 *
 * ⚠️ One test got QUIETLY BETTER, and it is worth knowing which: "returns the
 *    plain value when no attestation can be produced" was passing for two
 *    reasons at once — no consent text *and* no `subtle`. It now passes for the
 *    one it claims. A spec that wants the absent-`subtle` path must remove it
 *    explicitly, the same way the accordion's find-in-page specs install the
 *    browser they mean.
 *
 * Defined only when absent, so a future jsdom that implements it wins.
 */
{
  const c = globalThis.crypto as Crypto & { subtle?: SubtleCrypto };
  if (c && !c.subtle) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { webcrypto } = require('node:crypto') as { webcrypto: Crypto };
    Object.defineProperty(c, 'subtle', { value: webcrypto.subtle, configurable: true });
  }
}
