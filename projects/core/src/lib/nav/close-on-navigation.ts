import { DestroyRef, inject } from '@angular/core';
import { SV_NAV_LOCATION } from './nav-location';

/**
 * ============================================================================
 *  Closing a floating panel when the page underneath changes — `NV-03-I5`, `NV-07-I7`
 * ============================================================================
 *
 * A breadcrumb's sibling-page menu and a mega menu's panel both live in
 * `document.body`, outside the component that owns them and outside whatever the
 * router swaps. So a navigation that replaces the page leaves them **hanging over
 * the new one** — a menu of links to a section the user has already left, drawn on
 * top of where they just arrived.
 *
 * ── ⚠️ `SvOverlayStackService` does not do this, despite the backlog saying so ──
 * The stack service owns z-index bands and `inert` marking. It has no idea what a
 * route is and nothing in it observes navigation. Reaching for it would have
 * produced a change that compiles, reads plausibly, and closes nothing.
 *
 * ── What "a navigation happened" means without importing a router ───────────
 * Three signals, and the third is the only one that needs wiring:
 *
 *   · **`popstate`** — back and forward. Always available.
 *   · **`hashchange`** — following a plain `#` link. Always available.
 *   · **{@link SV_NAV_LOCATION}** — whatever the app told us about. An adapter
 *     over the Angular router notifies on every `NavigationEnd`.
 *
 * ★ **`pushState` fires nothing**, which is the whole difficulty: an SPA
 * navigation is invisible to the platform. That is why the location seam is in
 * the list — it is the one channel an app can use to say *"the page changed"*
 * without this package importing a router. With the default no-op location the
 * first two still work, so back and forward close the panel in every app, and an
 * app that provides a location gets SPA navigation too.
 *
 * The honest statement of the gap: **a component cannot detect a navigation it
 * was never told about**, and the fix is one `provideSvNavLocation(…)` call.
 *
 * ── ★ A location notification is not, by itself, a navigation ──────────────
 * `SvNavLocation.subscribe` fires on external changes **and on every
 * write** — which includes the kit's own. `sv-anchor` rewriting the hash as the
 * reader scrolls, a tab change mirrored into `?tab=`, an accordion deep-link:
 * each is an `svNavParam.set` on the SAME page, and each notifies. Closing on
 * all of them meant scrolling the page shut an open breadcrumb menu.
 *
 * So the location channel is filtered by **path**: a notification closes only
 * when `location.pathname` differs from the last one this helper saw. A
 * query-only or hash-only write is the page describing itself, not leaving;
 * an SPA route change moves the path, and that closes. The two platform events
 * stay unfiltered — `popstate` and `hashchange` are only ever raised by the
 * browser (back/forward, a followed `#` link, an edited address bar), never by
 * `pushState`/`replaceState`, so they cannot be the kit talking to itself.
 *
 * ⚠️ The cost, stated: an app navigation that changes ONLY the query string
 * (`/search?q=a` → `/search?q=b`) through the location seam does not close the
 * panel. That is the same shape as a kit write and cannot be told apart from
 * one without a router; the owner closes explicitly if it matters.
 *
 * On the server there is no path to compare, so every notification closes —
 * the previous behaviour, and harmless, since nothing is open there.
 */

/**
 * Call `close` whenever the page underneath appears to have changed.
 *
 * Call it in a field initializer, inside an injection context; the listeners are
 * released with the component.
 *
 * ```ts
 * private readonly closeOnNav = svCloseOnNavigation(() => this.close());
 * ```
 *
 * `close` must be idempotent — it is called for every signal that arrives, and
 * two of them can describe the same navigation.
 *
 * Location notifications close only when the path changed; `popstate` and
 * `hashchange` always close. See the note above for why.
 */
export function svCloseOnNavigation(close: () => void): void {
  const location = inject(SV_NAV_LOCATION);
  const destroyRef = inject(DestroyRef);

  if (typeof window === 'undefined') {
    destroyRef.onDestroy(location.subscribe(close));
    return;
  }

  let lastPath = window.location.pathname;

  const onLocation = (): void => {
    const path = window.location.pathname;
    if (path === lastPath) return; // a query- or hash-only write: same page
    lastPath = path;
    close();
  };

  const onBrowserNavigation = (): void => {
    // Re-baselined so the location notification that usually follows the
    // same `popstate` is not counted as a second navigation.
    lastPath = window.location.pathname;
    close();
  };

  const unsubscribe = location.subscribe(onLocation);
  window.addEventListener('popstate', onBrowserNavigation);
  window.addEventListener('hashchange', onBrowserNavigation);

  destroyRef.onDestroy(() => {
    unsubscribe();
    window.removeEventListener('popstate', onBrowserNavigation);
    window.removeEventListener('hashchange', onBrowserNavigation);
  });
}
