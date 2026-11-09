import { APP_ID, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { svUniqueId } from './unique-id';

/**
 * ============================================================================
 *  Per-application element ids — `X-10`'s SSR half, `T0-2`
 * ============================================================================
 *
 * `T0-2` was careful not to claim a defect it had not reproduced. The first test
 * below **is** that reproduction, and it fails for the module-counter scheme the
 * seven navigation packages used. Everything after it is the fix.
 *
 * ── How one process stands in for a server and a browser ────────────────────
 * `TestBed.resetTestingModule()` builds a fresh root injector, which is what
 * Angular SSR does per request and what the browser does once on load. So two
 * TestBed cycles in one process are exactly two application instances sharing
 * one module — a long-lived server rendering its second page, and a client
 * rendering its first.
 */

/** The old scheme: a counter that belongs to the MODULE. */
let moduleCounter = 0;

@Component({ standalone: true, template: '' })
class ModuleCounterHost {
  readonly uid = `sv-thing-${++moduleCounter}`;
}

@Component({ standalone: true, template: '' })
class InjectorCounterHost {
  readonly uid = svUniqueId('sv-thing');
}

function idFrom<T extends { uid: string }>(type: new () => T, appId?: string): string {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: appId ? [{ provide: APP_ID, useValue: appId }] : [],
  });
  return TestBed.createComponent(type).componentInstance.uid;
}

describe('the defect — a counter that belongs to the module', () => {
  /**
   * ★ The reproduction. A long-lived server process shares the counter across
   * requests, so the second page it renders emits `sv-thing-2` while the browser,
   * which just loaded the module, emits `sv-thing-1`. Server HTML and first
   * client render disagree — a hydration mismatch, after which Angular discards
   * the prerendered DOM, and any `aria-controls` read in between pointed at an
   * element that no longer exists.
   */
  it('gives two applications different ids for the same first component', () => {
    const server = idFrom(ModuleCounterHost);
    const client = idFrom(ModuleCounterHost);

    expect(server).toBe('sv-thing-1');
    expect(client).toBe('sv-thing-2');
    expect(server).not.toBe(client);
  });
});

describe('svUniqueId', () => {
  /** The same two application instances, now agreeing. */
  it('gives two applications the SAME id for the same first component', () => {
    expect(idFrom(InjectorCounterHost)).toBe(idFrom(InjectorCounterHost));
  });

  it('still separates two components within one application', () => {
    TestBed.resetTestingModule();
    const first = TestBed.createComponent(InjectorCounterHost).componentInstance.uid;
    const second = TestBed.createComponent(InjectorCounterHost).componentInstance.uid;

    expect(first).not.toBe(second);
  });

  it('counts from one within its application', () => {
    expect(idFrom(InjectorCounterHost, 'ng')).toBe('sv-thing-ng-1');
  });

  /**
   * ★ The instinct here is a random id, and it is wrong: random differs between
   * the server and the client BY CONSTRUCTION, which is the mismatch being fixed.
   * The id has to be deterministic per render pass and independent between
   * passes.
   */
  it('is deterministic, not random', () => {
    const runs = [
      idFrom(InjectorCounterHost),
      idFrom(InjectorCounterHost),
      idFrom(InjectorCounterHost),
    ];
    expect(new Set(runs).size).toBe(1);
  });

  describe('two applications on one page', () => {
    /**
     * ★★ The case that makes `APP_ID` mandatory rather than decorative, and it is
     * a REGRESSION this change would otherwise introduce. The module counter had
     * one virtue — two applications on a page shared it, so their ids could not
     * collide. A counter per injector gives each its own, both restart at 1, and
     * `aria-controls` starts resolving into the other app. Same defect this repo
     * already fixed twice, for two tab strips and two speed dials.
     */
    it('separates them, so aria-controls cannot resolve into the other app', () => {
      expect(idFrom(InjectorCounterHost, 'shell')).toBe('sv-thing-shell-1');
      expect(idFrom(InjectorCounterHost, 'widget')).toBe('sv-thing-widget-1');
    });

    /**
     * ⚠️ The first draft skipped Angular's default to keep ids short. The default
     * is `'ng'` when bootstrapping and `'a'` under `TestBed`, so the special case
     * was both magic and wrong — this pins that it is gone.
     */
    it('includes even the default, with no special case', () => {
      expect(idFrom(InjectorCounterHost, 'ng')).toContain('-ng-');
    });
  });
});
