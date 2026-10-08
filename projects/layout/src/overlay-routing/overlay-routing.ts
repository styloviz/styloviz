import {
  ENVIRONMENT_INITIALIZER,
  inject,
  type EnvironmentProviders,
  type Provider,
  makeEnvironmentProviders,
} from '@angular/core';
import { NavigationEnd, Router, type CanDeactivateFn } from '@angular/router';
import { SvOverlayRouteService, ToastService } from '@styloviz/core';

/**
 * Tell the overlay layer when the app navigates (`X-13`).
 *
 * ── Why this lives here and not in `@styloviz/core` ─────────────────────────
 *
 * ★★★ CORE DOES NOT DEPEND ON `@angular/router`, AND MUST NOT. It is the base
 *     every other package builds on, including in apps that never route, so a
 *     hard peer on the router just to learn "did we navigate?" would be the
 *     tail wagging the dog. `SvOverlayRouteService` therefore owns the policy
 *     and the history plumbing — neither of which needs a router — and takes
 *     that one fact as a call.
 *
 * ★★ THIS IS THAT CALL, AND IT IS THE WHOLE ROUTER HALF OF `X-13`. Layout
 *    already has the router as a peer and is where an app's shell lives.
 *
 * ★ AN APP THAT WIRES NOTHING KEEPS TODAY'S BEHAVIOUR EXACTLY. That is
 *   deliberate for a published kit: "a modal now closes on navigation" is a
 *   behaviour change, and it happens when the app asks for it, in one line.
 *
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [provideRouter(routes), provideSvOverlayRouteClose()],
 * });
 * ```
 *
 * Surfaces opt out individually with `[closeOnNavigation]="false"` — a global
 * command palette belongs to the shell, not to the page the user just left.
 *
 * ── Toasts are told too, and they answer differently ────────────────────────
 *
 * The same `NavigationEnd` calls `ToastService.navigated()`, which drops only
 * the toasts raised with `{ scope: 'route' }`. ★★ A TOAST DEFAULTS TO
 * SURVIVING, and an overlay defaults to closing, because the commonest toast in
 * any app is the confirmation of the action that navigated — deleting it on
 * arrival would delete the thing the user was supposed to read.
 *
 * ── What counts as navigating ──────────────────────────────────────────────
 *
 * By default every committed navigation does, query and fragment changes
 * included. ★ A page that mirrors its filters into `?q=` or its scroll
 * position into `#section` navigates on every keystroke or scroll, and would
 * close the dialog the user is typing in. `{ closeOn: 'path' }` counts only a
 * change of path, which is what "the user left the page" means in such an app.
 */
export function provideSvOverlayRouteClose(
  options: SvOverlayRouteCloseOptions = {},
): EnvironmentProviders {
  const closeOn = options.closeOn ?? 'url';
  const initializer: Provider = {
    provide: ENVIRONMENT_INITIALIZER,
    multi: true,
    useValue: (): void => {
      const router = inject(Router);
      const overlays = inject(SvOverlayRouteService);
      const toasts   = inject(ToastService);
      let lastPath: string | null = null;
      // ★ `NavigationEnd` only: the surfaces are closed AFTER the new route is
      //   committed, so a host listening to `(dismissed)` sees the page it
      //   arrived at rather than the one it is leaving. A `NavigationStart`
      //   version also fires for navigations that are then cancelled by a
      //   guard, which would close a dialog and leave the user where they
      //   were — with nothing on screen to explain it.
      router.events.subscribe((event) => {
        if (!(event instanceof NavigationEnd)) return;
        const path = svUrlPath(event.urlAfterRedirects);
        const samePage = lastPath === path;
        lastPath = path;
        if (closeOn === 'path' && samePage) return;
        overlays.navigated();
        toasts.navigated();
      });
    },
  };
  return makeEnvironmentProviders([initializer]);
}

/** Options for {@link provideSvOverlayRouteClose}. */
export interface SvOverlayRouteCloseOptions {
  /**
   * `'url'` — any committed navigation closes route-bound surfaces, query and
   * fragment changes included. `'path'` — only a change of path does.
   * @default 'url'
   */
  readonly closeOn?: 'url' | 'path';
}

/** The path part of a router URL — no query string, no fragment. */
function svUrlPath(url: string): string {
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

/**
 * Hold a navigation while an open overlay has unsaved changes.
 *
 * ★★★ `provideSvOverlayRouteClose()` ALONE ASKS TOO LATE. It closes overlays on
 *     `NavigationEnd`, so a dirty dialog raised its "discard your changes?"
 *     prompt over the page the user had already been taken to — and Keep
 *     editing kept a form about a page that no longer existed. A guard runs
 *     BEFORE the route changes, which is the only point where "stay" still
 *     means something.
 *
 * What it does: when any open, route-aware surface (`sv-modal`, `sv-drawer`)
 * reports `[dirty]` and has `closeOnNavigation` on, it cancels the navigation
 * and raises that surface's own unsaved-changes prompt. Discard closes the
 * surface and re-issues the navigation (`router.navigateByUrl` of the
 * attempted URL); Keep editing leaves the user on the page. A clean page is
 * never held.
 *
 * ```ts
 * // app.config.ts
 * providers: [provideRouter(routes), provideSvOverlayRouteClose()],
 *
 * // app.routes.ts — on each route whose page opens editable overlays
 * { path: 'contacts', component: ContactsPage, canDeactivate: [svOverlayCanDeactivate] },
 * ```
 *
 * ★ The re-issued navigation carries the original call's extras — `replaceUrl`,
 *   `state`, `skipLocationChange`… — read from the held navigation while the
 *   guard runs, so Discard lands exactly where the user was going, the way
 *   they were going there.
 */
export const svOverlayCanDeactivate: CanDeactivateFn<unknown> = (
  _component,
  _currentRoute,
  _currentState,
  nextState,
) => {
  const target = nextState?.url;
  if (!target) return true;
  const router = inject(Router);
  const overlays = inject(SvOverlayRouteService);
  const extras = router.currentNavigation()?.extras;
  return !overlays.requestLeave(() => {
    void router.navigateByUrl(target, extras);
  });
};
