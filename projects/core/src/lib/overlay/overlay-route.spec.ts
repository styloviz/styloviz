import { TestBed } from '@angular/core/testing';
import { SvOverlayRouteService } from './overlay-route';
import type { SvCloseReason } from './close-guard';

/**
 * ============================================================================
 *  `SvOverlayRouteService` — route and history integration (`X-13`)
 * ============================================================================
 *
 * ★★★ THE BUG THE AUDIT NAMES: a modal that outlives its route and floats over
 *     an unrelated page. It is the most common overlay defect in shipped
 *     dashboards, and it happens because nothing in the surface knows the page
 *     underneath it has been replaced.
 *
 * ★★ jsdom implements the session history properly — `pushState`, `back()` and
 *    a real `popstate` — which is what makes the Back-button half testable at
 *    all. `back()` is asynchronous, so every test that presses it awaits a
 *    macrotask.
 */

function service(): SvOverlayRouteService {
  TestBed.resetTestingModule();
  return TestBed.inject(SvOverlayRouteService);
}

/** A surface that records how it was closed. */
function surface(overrides: Partial<{ closeOnNavigation: boolean; backCloses: boolean }> = {}) {
  const closed: SvCloseReason[] = [];
  return {
    closed,
    options: {
      // ⚠️ A block body, not a concise one. `closed.push(reason)` returns the
      //    new LENGTH, so the concise form inferred `(reason) => number` and
      //    every later reassignment of `close` — which returns `void` — was a
      //    type error against a helper nobody meant to be generic over its
      //    return.
      close: (reason: SvCloseReason): void => { closed.push(reason); },
      closeOnNavigation: () => overrides.closeOnNavigation ?? true,
      backCloses: () => overrides.backCloses ?? false,
    },
  };
}

const back = async () => {
  history.back();
  await new Promise((resolve) => setTimeout(resolve, 20));
};

afterEach(() => {
  // Leave the session history where the next test expects it.
  history.replaceState(null, '', '/');
});

describe('SvOverlayRouteService — a navigation closes what belongs to the page', () => {
  it('closes a registered surface, with the reason "route"', () => {
    const s = service();
    const modal = surface();
    s.register(modal.options);

    s.navigated();

    expect(modal.closed).toEqual(['route']);
  });

  it('★ leaves a surface that says it belongs to the shell', () => {
    // A global command palette or a support widget is not part of the page
    // the user just left, and closing it on every navigation would make it
    // useless as a launcher — which is the only thing it is for.
    const s = service();
    const shellSurface = surface({ closeOnNavigation: false });
    s.register(shellSurface.options);

    s.navigated();

    expect(shellSurface.closed).toEqual([]);
  });

  it('closes several at once, and survives them releasing mid-loop', () => {
    // ★ `close()` normally leads straight to `release()`, which mutates the
    //   list being walked — so the loop iterates a snapshot. Without it the
    //   second of three surfaces is skipped.
    const s = service();
    const made = [surface(), surface(), surface()];
    const handles = made.map((m) => s.register(m.options));
    made.forEach((m, i) => {
      const handle = handles[i];
      m.options.close = (reason: SvCloseReason) => { m.closed.push(reason); handle.release(); };
    });

    s.navigated();

    expect(made.map((m) => m.closed)).toEqual([['route'], ['route'], ['route']]);
    expect(s.openCount).toBe(0);
  });

  it('★ the DEFAULTS, from a surface that configures nothing', async () => {
    // ★★ THE HELPER ABOVE ALWAYS PASSES BOTH FLAGS, SO THE DEFAULTS WERE
    //    UNTESTED — a mutation flipping either one stayed green. They are
    //    documented opposite ways round on purpose, and that asymmetry is the
    //    whole design: a navigation closes a surface unless it says otherwise,
    //    and Back does NOT unless it says so.
    const s = service();
    const closed: SvCloseReason[] = [];
    const before = history.length;
    const handle = s.register({ close: (reason) => closed.push(reason) });

    expect(history.length).toBe(before);     // nothing pushed: backCloses is off

    await back();
    expect(closed).toEqual([]);              // …so Back is not ours to take

    s.navigated();
    expect(closed).toEqual(['route']);       // …but a navigation is
    handle.release();
  });

  it('says nothing to a surface that has already been released', () => {
    const s = service();
    const modal = surface();
    s.register(modal.options).release();

    s.navigated();

    expect(modal.closed).toEqual([]);
  });
});

describe('SvOverlayRouteService — the Back button', () => {
  it('does not touch history unless the surface asks', () => {
    const s = service();
    const before = history.length;
    s.register(surface().options);

    // ★ The default is NO for a reason: Back closing a transient question
    //   would eat a press the user meant for the page.
    expect(history.length).toBe(before);
  });

  it('★ pushes a marked entry and closes on Back, with the reason "history"', async () => {
    const s = service();
    const panel = surface({ backCloses: true });
    s.register(panel.options);

    // The host's own state survives, and the URL is untouched: this is a
    // history ENTRY, not a route.
    expect((history.state as Record<string, unknown>)['__svOverlay']).toBeDefined();

    await back();

    expect(panel.closed).toEqual(['history']);
  });

  it('one Back press closes one surface — the one opened last', async () => {
    const s = service();
    const first = surface({ backCloses: true });
    const second = surface({ backCloses: true });
    s.register(first.options);
    s.register(second.options);

    await back();

    expect(second.closed).toEqual(['history']);
    expect(first.closed).toEqual([]);
  });

  it('★ closes ONE surface even when no marker survives at all', async () => {
    // ★★★ THE CASE THE `break` IS FOR, and the previous test could not see it:
    //     there, going back one entry lands on the FIRST surface's own marker,
    //     so the state check stops the loop and the `break` is redundant.
    //     Here the host has rewritten the current entry — `replaceState` in a
    //     router guard, an analytics library stamping its own state — so NO
    //     marker matches, and without the `break` a single Back press would
    //     close every open surface at once.
    const s = service();
    const first = surface({ backCloses: true });
    const second = surface({ backCloses: true });
    s.register(first.options);
    s.register(second.options);

    history.replaceState({ rewrittenByTheHost: true }, '', '');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(second.closed).toEqual(['history']);
    expect(first.closed).toEqual([]);
  });

  it('★ pops its own entry when the surface is closed by other means', async () => {
    // Otherwise the user is left one Back press away from reopening a dialog
    // they just dismissed — the history grows a junk entry per open.
    const s = service();
    const panel = surface({ backCloses: true });
    const handle = s.register(panel.options);
    const withEntry = history.length;

    handle.release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect((history.state as Record<string, unknown> | null)?.['__svOverlay']).toBeUndefined();
    expect(history.length).toBe(withEntry);   // back, not a new push
    // ★★ AND IT DOES NOT CLOSE ITSELF AGAIN. The `back()` it just called
    //    produces a `popstate`; without counting its own pops the service
    //    sees a state with no marker and calls `close()` a second time —
    //    which for a family that emits `dismissed` on close is two
    //    dismissals for one action.
    expect(panel.closed).toEqual([]);
  });

  it("★ its own pop never closes the surface UNDERNEATH", async () => {
    // ★★★ WHAT COUNTING ITS OWN POPS IS ACTUALLY FOR, and the single-surface
    //     test could not show it: there, `release()` splices the entry before
    //     popping, so there is nothing left to close by accident.
    //
    //     With two surfaces it matters. A panel is open; the host pushes a
    //     state of its own (a router guard, a wizard step); a second panel
    //     opens and closes. The `back()` that tidies the second panel's entry
    //     lands on the host's state — which carries no marker — and an
    //     unguarded listener reads that as "the first panel's entry is gone"
    //     and closes a panel the user is still looking at.
    const s = service();
    const under = surface({ backCloses: true });
    s.register(under.options);

    history.pushState({ page: 'pushed-by-the-host' }, '', '');

    const over = surface({ backCloses: true });
    const overHandle = s.register(over.options);

    overHandle.release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(over.closed).toEqual([]);
    expect(under.closed).toEqual([]);
    expect(s.openCount).toBe(1);
  });

  it('★ does NOT call back() when the Back press is what closed it', async () => {
    // The user pressed Back once. Popping again would take them a second
    // page backwards, which is not what they asked for.
    const s = service();
    const panel = surface({ backCloses: true });
    const handle = s.register(panel.options);
    // ⚠️ `handle.release` is deliberately NOT called yet — the point of this
    //    test is what happens when Back closes the surface before the host
    //    releases it. This used to be written as a bare `handle.release;`,
    //    which evaluates a property and discards it: dead code that reads
    //    like a forgotten call.

    const atOpen = history.length;
    await back();
    handle.release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(panel.closed).toEqual(['history']);
    expect(history.length).toBe(atOpen);
  });

  it('★ does NOT call back() when a navigation closed it', async () => {
    // The navigation already left that entry behind; going back would undo
    // the navigation the host just performed.
    const s = service();
    const panel = surface({ backCloses: true });
    const handle = s.register(panel.options);

    s.navigated();
    handle.release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(panel.closed).toEqual(['route']);
    expect((history.state as Record<string, unknown> | null)?.['__svOverlay']).toBeDefined();
  });

  it('★ leaves history alone when the user has navigated on since', async () => {
    // ★★ The stale entry is the lesser evil by a long way: calling `back()`
    //    here would take the user off a page they reached after the dialog
    //    opened, which is a navigation they never asked for.
    const s = service();
    const panel = surface({ backCloses: true });
    const handle = s.register(panel.options);

    history.pushState({ page: 'somewhere-else' }, '', '');
    const afterNav = history.length;

    handle.release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(history.length).toBe(afterNav);
    expect((history.state as Record<string, unknown>)['page']).toBe('somewhere-else');
    expect(panel.closed).toEqual([]);
  });

  it('★ releasing twice pops one entry, not two', async () => {
    // ★★ THIS IS WHAT THE `released` FLAG IS FOR. Every family in this kit
    //    has more than one close path, and a component that calls `release()`
    //    from both its close handler and its teardown would otherwise take
    //    the user a page backwards.
    // ★★ A SPY ON `history.back`, NOT AN ASSERTION ABOUT WHERE WE LAND. jsdom's
    //    `back()` is asynchronous AND coalesces two synchronous calls into one
    //    move, so in this environment a double pop is indistinguishable from a
    //    single one by state or by length — I measured it. In a real browser
    //    it takes the user two pages backwards, so the guard is real and the
    //    test has to watch the CALL rather than the effect.
    const s = service();
    const spy = vi.spyOn(history, 'back');
    const panel = surface({ backCloses: true });
    const handle = s.register(panel.options);

    handle.release();
    handle.release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(panel.closed).toEqual([]);
    spy.mockRestore();
  });

  it('ignores a Back press that belongs to the page, not to a surface', async () => {
    const s = service();
    history.pushState({ page: 'a' }, '', '');
    const panel = surface({ backCloses: false });
    s.register(panel.options);

    await back();

    expect(panel.closed).toEqual([]);
  });
});
