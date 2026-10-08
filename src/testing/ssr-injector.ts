import {
  Injector,
  type StaticProvider,
  ɵChangeDetectionScheduler as ChangeDetectionScheduler,
  ɵEffectScheduler as EffectScheduler,
} from '@angular/core';

/**
 * An Angular injector for the `ssr` vitest project — **no DOM, no TestBed**.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `@styloviz/core` services fork on `typeof window === 'undefined'` /
 * `typeof document === 'undefined'`, which is the state a server render puts
 * them in. Asserting those forks from inside jsdom by writing
 * `vi.stubGlobal('window', undefined)` **stopped working**: jsdom defines both
 * as NON-CONFIGURABLE globals, so the stub throws "Cannot redefine property"
 * and the branch is never taken. Four tests had been passing on that stub
 * without ever reaching the code they named.
 *
 * The `ssr` project runs those specs under the `node` environment, where there
 * genuinely is no `window`. That is not a stub, so it cannot rot the same way.
 *
 * ── Why not TestBed ──────────────────────────────────────────────────────────
 * Measured, in order, under `environment: 'node'`:
 *   • `platformBrowserDynamicTesting()` → NG0200, circular `DocumentToken`
 *     (`RendererFactory2 → DomRendererFactory2 → EventManager → DOCUMENT`).
 *     The browser testing platform is a DOM platform; there is no DOM.
 *   • `platformCore()` + `ApplicationModule` → NG0201 for `ErrorHandler`, then
 *     `ApplicationInitStatus`, then `ApplicationRef` — reassembling an
 *     application by hand, one missing provider at a time.
 * A service test needs neither a renderer nor an ApplicationRef. It needs an
 * injection context and somewhere for `effect()` to be queued.
 *
 * ── The two ɵ symbols, and why they are acceptable here ──────────────────────
 * `effect()` in a constructor resolves `EffectScheduler`, and a signal write
 * notifies `ChangeDetectionScheduler`. Both are `ɵ`-prefixed, i.e. not part of
 * Angular's public API contract, so a major bump may move them.
 *
 * That risk is taken deliberately: if either symbol disappears the import
 * fails **loudly at module load**, which is the opposite of the failure mode
 * this replaces — a stub that silently stopped stubbing. `provideZonelessChangeDetection()`
 * is the public alternative and was tried first; it resolves `ApplicationRef`,
 * which is the DOM-less-application rabbit hole above.
 *
 * ── The scheduler is a QUEUE, not an eager runner ────────────────────────────
 * Running a watch the moment it is scheduled works for the first pass and then
 * throws *"Schedulers cannot synchronously execute watches while scheduling"*
 * the first time an effect is re-triggered by a signal write inside another
 * effect — measured. So work is queued and released by `tick()`, which is the
 * same shape as `TestBed.tick()` and reads the same way in a spec.
 *
 * @example
 * const { get, tick } = createSsrInjector([{ provide: STYLOVIZ_CONFIG, useValue: null }]);
 * const service = get(ThemeService);
 * tick();                       // let the constructor effect run
 * expect(service.isDark()).toBe(false);
 */
export function createSsrInjector(providers: StaticProvider[] = []): {
  /** Resolve a token from the injector. */
  get: <T>(token: unknown) => T;
  /** Release every queued effect, the way `TestBed.tick()` does. */
  tick: () => void;
} {
  type Watch = { run: () => void };
  const queued = new Set<Watch>();

  /**
   * `add` is what Angular calls today; `schedule` is what it called before.
   * Both are provided so a minor bump that renames one does not read as a
   * behavioural failure in an unrelated spec.
   */
  const effects = {
    add: (node: Watch) => queued.add(node),
    schedule: (node: Watch) => queued.add(node),
    remove: (node: Watch) => queued.delete(node),
    flush: () => runQueue(),
  } as unknown as EffectScheduler;

  /**
   * An effect may schedule another effect. Ten passes is a generous ceiling —
   * a genuine cycle would otherwise hang the run rather than fail it, and a
   * hang is far harder to diagnose than a stale value.
   */
  const runQueue = (): void => {
    for (let pass = 0; pass < 10 && queued.size > 0; pass++) {
      for (const node of [...queued]) {
        queued.delete(node);
        node.run();
      }
    }
    if (queued.size > 0) {
      throw new Error(
        `createSsrInjector: effects still queued after 10 flush passes — ` +
          `an effect is re-scheduling itself. This is a real cycle, not a test-harness limit.`,
      );
    }
  };

  const injector = Injector.create({
    providers: [
      // Nothing renders here, so a signal write has no view to dirty.
      { provide: ChangeDetectionScheduler, useValue: { notify: () => undefined } },
      { provide: EffectScheduler, useValue: effects },
      ...providers,
    ],
  });

  return {
    get: <T>(token: unknown): T => injector.get(token as never) as T,
    tick: runQueue,
  };
}
