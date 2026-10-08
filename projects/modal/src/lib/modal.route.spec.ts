import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvOverlayRouteService, type SvCloseReason } from '@styloviz/core';
import { SvModalComponent, type ModalCloseReason } from './modal.component';
import { until } from '../../../../src/testing/async';

/**
 * ============================================================================
 *  `sv-modal` — route and history (`OF-09-I7`, `OF-09-I8`, `OF-09-M2`, `X-13`)
 * ============================================================================
 *
 * ★★★ A MODAL THAT OUTLIVES ITS ROUTE FLOATS OVER AN UNRELATED PAGE — the
 *     audit's "most common overlay bug in shipped dashboards". A link inside
 *     the dialog, a redirect from a guard, a host that navigates on success,
 *     and the panel is still up, still modal, still describing a page that is
 *     no longer underneath it.
 *
 * ★★ THE SERVICE IS NOT WIRED TO A ROUTER HERE, and that is the design rather
 *    than a shortcut: `@styloviz/core` must not depend on `@angular/router`,
 *    so it takes "we navigated" as a CALL. These tests make that call, which
 *    is exactly what `provideSvOverlayRouteClose()` does from `NavigationEnd`.
 */

async function open(inputs: Partial<ComponentInput<SvModalComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvModalComponent, {
    inputs: { title: 'Edit profile', isOpen: true, ...inputs } as ComponentInput<SvModalComponent>,
  });
  await until(() => document.querySelector('[role="dialog"]') !== null, {
    label: 'the dialog to mount',
  });
  fixture.detectChanges();
  return { c: fixture.componentInstance, fixture, routes: TestBed.inject(SvOverlayRouteService) };
}

/**
 * Press Back, and wait for the environment to actually deliver it.
 *
 * ★★★ THIS WAS `setTimeout(20)`, AND IT FAILED ONCE IN 19 SHARDS. jsdom
 *     dispatches `popstate` on its own schedule, so a fixed wait is a bet that
 *     the machine is not busy — exactly what `@testing/async` was written
 *     about. Under a loaded sweep the 20ms expired first and
 *     `promptedReason()` was still null, which reads as "the modal ignored the
 *     Back button" and is not: nobody had pressed it yet.
 *
 * ★★ The event resolves the wait, so the tests that DO navigate are now
 *    deterministic rather than quick. The grace exists for the one test where
 *    no `popstate` is coming at all — `history.back()` at the first entry is a
 *    no-op, which is the point of "does not claim Back by default" — and is
 *    never waited out by the others.
 */
const back = async () => {
  const delivered = new Promise<void>((resolve) => {
    const onPop = () => { clearTimeout(grace); resolve(); };
    window.addEventListener('popstate', onPop, { once: true });
    const grace = setTimeout(() => {
      window.removeEventListener('popstate', onPop);
      resolve();
    }, 250);
  });

  history.back();
  await delivered;
  // One more turn for the handler's own work to flush.
  await new Promise((resolve) => setTimeout(resolve, 0));
};

afterEach(() => {
  document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
  document.body.style.overflow = '';
  history.replaceState(null, '', '/');
});

describe('sv-modal — a navigation closes it', () => {
  it('closes on navigation, and says the reason was the route', async () => {
    const h = await open();
    const dismissed: ModalCloseReason[] = [];
    const exact: SvCloseReason[] = [];
    h.c.dismissed.subscribe((r) => dismissed.push(r));
    h.c.dismissedBy.subscribe((r) => exact.push(r));

    h.routes.navigated();
    h.fixture.detectChanges();

    expect(h.c.isOpen()).toBe(false);
    // ★ A host logging dismissals can tell "the user closed it" from "the page
    //   changed under it" — on `dismissedBy`. `dismissed` speaks the published
    //   `ModalCloseReason`, which cannot carry `'route'` without breaking every
    //   exhaustive switch over it, so the navigation folds to `'programmatic'`.
    expect(dismissed).toEqual(['programmatic']);
    expect(exact).toEqual(['route']);
  });

  it("★ a host's [canClose] is only ever asked in the published reasons", async () => {
    const asked: ModalCloseReason[] = [];
    const h = await open({
      canClose: (reason: ModalCloseReason) => {
        asked.push(reason);
      },
      dirty: true,
    });
    h.routes.navigated();
    h.fixture.detectChanges();
    expect(asked).toEqual(['programmatic']);
  });

  it('stays open when it says it belongs to the shell', async () => {
    const h = await open({ closeOnNavigation: false });
    h.routes.navigated();
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(true);
  });

  it('★ still asks about unsaved changes first', async () => {
    // ★★ THE TWO POLICIES COMPOSE, and in this order: the navigation asks to
    //    close, the close guard holds it, and the user still gets the choice.
    //    A route change that silently discarded a form would be the same
    //    defect `OF-09-I5` is about, arriving by a different door.
    const h = await open({ dirty: true });
    h.routes.navigated();
    h.fixture.detectChanges();

    expect(h.c.isOpen()).toBe(true);
    expect(h.c.promptingDiscard()).toBe(true);
    expect(h.c.promptedReason()).toBe('route');
  });

  it('registers only while open', async () => {
    const h = await open();
    expect(h.routes.openCount).toBe(1);

    h.c.close('close-button');
    h.fixture.detectChanges();
    expect(h.routes.openCount).toBe(0);

    // …and a navigation after that says nothing to anybody.
    h.routes.navigated();
    expect(h.c.isOpen()).toBe(false);
  });
});

describe('sv-modal — the Back button (OF-09-I8, OF-09-M2)', () => {
  it('does not claim Back by default', async () => {
    const before = history.length;
    const h = await open();

    expect(history.length).toBe(before);
    await back();
    expect(h.c.isOpen()).toBe(true);
  });

  it('★ closes on Back when the dialog is a destination', async () => {
    const h = await open({ backCloses: true });
    const dismissed: ModalCloseReason[] = [];
    const exact: SvCloseReason[] = [];
    h.c.dismissed.subscribe((r) => dismissed.push(r));
    h.c.dismissedBy.subscribe((r) => exact.push(r));

    // The URL is untouched — this is a history entry, not a route.
    expect((history.state as Record<string, unknown>)['__svOverlay']).toBeDefined();

    await back();
    h.fixture.detectChanges();

    expect(h.c.isOpen()).toBe(false);
    expect(dismissed).toEqual(['programmatic']);
    expect(exact).toEqual(['history']);
  });

  it('★ pops its own entry when closed by its own button', async () => {
    // Otherwise the user is left one Back press away from reopening a dialog
    // they just dismissed, once per open.
    const spy = vi.spyOn(history, 'back');
    const h = await open({ backCloses: true });

    h.c.close('close-button');
    h.fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(h.c.isOpen()).toBe(false);
    spy.mockRestore();
  });

  it('★ does not double-pop when Back is what closed it', async () => {
    const h = await open({ backCloses: true });
    const spy = vi.spyOn(history, 'back');

    await back();
    h.fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // ★★ EXACTLY ONE CALL, AND IT IS THE USER'S. The spy sees the press this
    //    test performs as well as anything the component does, which is how
    //    the first version of this assertion (`not.toHaveBeenCalled`) failed
    //    for the wrong reason. The dialog must not take the user a SECOND
    //    page backwards on its way out.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(h.c.isOpen()).toBe(false);
    spy.mockRestore();
  });

  it('★ tidies up when the router DESTROYS the dialog mid-route', async () => {
    // ★★★ THE CASE THIS WHOLE FEATURE IS ABOUT, ARRIVING FROM THE OTHER SIDE.
    //     When a route change destroys the component, no close branch runs at
    //     all — so without a release in `ngOnDestroy` the surface stays
    //     registered forever (a leak that closes a dialog that no longer
    //     exists on the next navigation) and its history entry survives, one
    //     Back press from a dialog that cannot reopen.
    const spy = vi.spyOn(history, 'back');
    const h = await open({ backCloses: true });

    h.fixture.destroy();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(h.routes.openCount).toBe(0);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('asks about unsaved changes before honouring Back', async () => {
    const h = await open({ backCloses: true, dirty: true });
    await back();
    h.fixture.detectChanges();

    expect(h.c.isOpen()).toBe(true);
    expect(h.c.promptedReason()).toBe('history');
  });
});
