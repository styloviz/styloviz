import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { SvOverlayRouteService, ToastService } from '@styloviz/core';
import { provideSvOverlayRouteClose, type SvOverlayRouteCloseOptions } from './overlay-routing';

/**
 * `X-13` — the router half of route integration, which is this one provider.
 *
 * ★★ The policy is tested where it lives (`overlay-route.spec.ts` in core,
 * plus each adopter's own spec). What is tested HERE is the only thing this
 * file adds: a real `NavigationEnd` from a real `Router` reaches both
 * consumers, and neither is told anything before the navigation commits.
 */

@Component({ standalone: true, template: 'a' })
class PageA {}

@Component({ standalone: true, template: 'b' })
class PageB {}

function setup(options?: SvOverlayRouteCloseOptions) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'a', component: PageA },
        { path: 'b', component: PageB },
        { path: 'blocked', component: PageB, canActivate: [() => false] },
      ]),
      provideSvOverlayRouteClose(options),
    ],
  });
  // ★ The initializer runs on first injector use, not on configuration.
  const router   = TestBed.inject(Router);
  const overlays = TestBed.inject(SvOverlayRouteService);
  const toasts   = TestBed.inject(ToastService);
  return { router, overlays, toasts };
}

describe('provideSvOverlayRouteClose()', () => {
  it('closes a route-aware surface when the app navigates', async () => {
    const { router, overlays } = setup();
    const closed: string[] = [];
    overlays.register({ close: (reason) => closed.push(reason) });

    await router.navigateByUrl('/a');
    expect(closed).toEqual(['route']);
  });

  it('leaves a surface that opted out of route closing alone', async () => {
    const { router, overlays } = setup();
    const closed: string[] = [];
    overlays.register({
      close: (reason) => closed.push(reason),
      closeOnNavigation: () => false,
    });

    await router.navigateByUrl('/a');
    expect(closed).toEqual([]);
  });

  it('drops route-scoped toasts and keeps global ones', async () => {
    const { router, toasts } = setup();
    toasts.success('Saved', { duration: 0 });
    toasts.info('This view is out of date', { duration: 0, scope: 'route' });

    await router.navigateByUrl('/a');

    expect(toasts.toasts().map((t) => t.message)).toEqual(['Saved']);
  });

  it('tells both consumers on every navigation, not just the first', async () => {
    const { router, overlays, toasts } = setup();
    const closed: string[] = [];

    // ★ Each surface releases its registration as it closes — which is what a
    //   real one does in its own close path. Without that, the first entry is
    //   still registered for the SECOND navigation and gets closed twice; that
    //   is the service behaving correctly and the test lying about the shape
    //   of a consumer.
    const open = () => {
      const handle = overlays.register({
        close: (reason) => {
          closed.push(reason);
          handle.release();
        },
      });
      return handle;
    };

    open();
    await router.navigateByUrl('/a');

    open();
    toasts.info('stale', { duration: 0, scope: 'route' });
    await router.navigateByUrl('/b');

    expect(closed).toEqual(['route', 'route']);
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('★ closes nothing for a navigation a guard cancels', async () => {
    // ★★ THIS IS WHY IT LISTENS FOR `NavigationEnd` AND NOT `NavigationStart`.
    //    A cancelled navigation leaves the user exactly where they were — on
    //    the page the dialog belongs to. Closing it on `NavigationStart` would
    //    take the dialog away and leave nothing on screen to explain why,
    //    while the route it was closed "for" never happened.
    const { router, overlays, toasts } = setup();
    const closed: string[] = [];
    overlays.register({ close: (reason) => closed.push(reason) });
    toasts.info('about this page', { duration: 0, scope: 'route' });

    const ok = await router.navigateByUrl('/blocked');

    expect(ok).toBe(false);
    expect(closed).toEqual([]);
    expect(toasts.toasts()).toHaveLength(1);
  });

  it('by default a query or fragment change counts as navigating', async () => {
    const { router, overlays } = setup();
    await router.navigateByUrl('/a');
    const closed: string[] = [];
    overlays.register({ close: (reason) => closed.push(reason) });

    await router.navigateByUrl('/a?q=invoices');
    expect(closed).toEqual(['route']);
  });

  it("★ closeOn: 'path' ignores query and fragment changes, and still closes on a new path", async () => {
    // ★★ A page that mirrors its filters into `?q=` navigates on every
    //    keystroke. Closing on those would close the dialog being typed in.
    const { router, overlays, toasts } = setup({ closeOn: 'path' });
    await router.navigateByUrl('/a');
    const closed: string[] = [];
    const handle = overlays.register({
      close: (reason) => {
        closed.push(reason);
        handle.release();
      },
    });
    toasts.info('about this page', { duration: 0, scope: 'route' });

    await router.navigateByUrl('/a?q=invoices');
    await router.navigateByUrl('/a?q=invoices#totals');
    expect(closed).toEqual([]);
    expect(toasts.toasts()).toHaveLength(1);

    await router.navigateByUrl('/b?q=invoices');
    expect(closed).toEqual(['route']);
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('wires nothing until the app actually navigates', async () => {
    const { overlays, toasts } = setup();
    const closed: string[] = [];
    overlays.register({ close: (reason) => closed.push(reason) });
    toasts.info('still here', { duration: 0, scope: 'route' });

    // No navigation yet — `NavigationEnd` is the trigger, and a bare injector
    // must not behave as though the app had already moved.
    expect(closed).toEqual([]);
    expect(toasts.toasts()).toHaveLength(1);
  });
});
