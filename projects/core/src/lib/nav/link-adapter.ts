import {
  InjectionToken,
  type EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';
import { svWarnOnce } from '../dev/warn-once';
import { svIsSafeUrl } from '../security/html-sanitizer';

/**
 * ============================================================================
 *  The link seam — `NV-03-M1`, second half
 * ============================================================================
 *
 * `SvNavLocation` is a keyed store: it answers *"where does this component's
 * state live?"*. This answers a different question — *"how does this component
 * render a link to somewhere else, and who navigates when it is clicked?"* — and
 * no amount of stretching makes one do the other's job. A breadcrumb owns no
 * key; its state **is** the route.
 *
 * ── Why it exists ───────────────────────────────────────────────────────────
 * `docs/navigation-routing-adr.md` names the problem and names the proof:
 * `sv-breadcrumb` and `sv-sidebar` both imported `{ RouterLink } from
 * '@angular/router'`, which is precisely why neither could be dropped into a
 * consumer's app that routes some other way — a hybrid app, a non-routed widget,
 * another framework's shell. The adapter is their migration path (`sv-breadcrumb`
 * and `sv-sidebar-nav` have taken it; `sv-sidebar` still imports `RouterLink`),
 * so like {@link SvNavLocation} it cannot itself depend on the thing they need to
 * escape.
 *
 * ── What `RouterLink` actually provided, and how this replaces it ───────────
 * Two things, and they are separable, which is the whole insight:
 *
 *   1. **An `href` on the anchor.** That is what makes middle-click, ⌘-click,
 *      "copy link address" and the status bar work, and it is plain string work
 *      no router is needed for.
 *   2. **Click interception**, so the app transitions instead of reloading.
 *      That one genuinely needs the router — so it is the ten lines the
 *      *consumer* writes.
 *
 * Splitting them means a component with no adapter still renders real,
 * shareable, right-clickable links. It just reloads the page when one is
 * followed, which is what a component with no router can honestly do.
 *
 * ── ★ The same rule as `sv-mega-menu`'s, and deliberately so ────────────────
 * **The component cancels the browser's navigation exactly when the adapter says
 * it took it.** `navigate` returning `false` means "I did not handle this" and
 * the anchor is left alone; returning `true` means the adapter is navigating and
 * the browser must not also. One event, one navigation — the defect `NV-07-I12`
 * names, avoided here before it can be written.
 */

/**
 * Where a link points, in whatever shape the consumer's router uses.
 *
 * A string is a path. An array is the segment form Angular's router takes —
 * kept because that is what every `BreadcrumbItem` in the wild already holds,
 * and renaming a public field to tidy a type is a migration nobody asked for.
 */
export type SvLinkTarget = string | readonly string[];

/** How a component turns a target into a link, and who navigates. */
export interface SvLinkAdapter {
  /** Names the implementation, for diagnostics only. */
  readonly kind: string;

  /**
   * The `href` to put on the anchor, or `null` for "this is not a link".
   *
   * Always rendered, even when {@link navigate} will cancel the click. An anchor
   * with no `href` is not a link to the browser, to assistive technology, or to
   * the person trying to open it in a new tab.
   *
   * Components bind the result as-is, so the adapter is where an unsafe scheme
   * (`javascript:`, `data:`) must be refused — return `null` for it, as
   * {@link svHrefLinkAdapter} does via {@link svIsSafeUrl}.
   */
  href(target: SvLinkTarget): string | null;

  /**
   * Navigate to `target`. Return `true` when this adapter handled it, so the
   * component cancels the browser's own navigation; `false` to let the anchor
   * be followed normally.
   */
  navigate(target: SvLinkTarget): boolean;
}

/** Join the array form into a path, and leave a string alone. */
function toPath(target: SvLinkTarget): string {
  if (typeof target === 'string') return target;
  if (!target.length) return '';
  const joined = target
    .map((segment, i) => (i === 0 ? segment : segment.replace(/^\//, '')))
    .join('/')
    .replace(/([^:])\/{2,}/g, '$1/');
  return joined;
}

/**
 * The default: render the `href`, let the browser follow it.
 *
 * ★ **It warns, once, the first time a link is actually rendered through it in a
 * dev build.** Silence here would be the worst outcome of this whole change: an
 * app that upgrades and starts doing full page loads on every breadcrumb click
 * still *works*, so nothing fails, nothing logs, and the regression is found
 * weeks later by somebody wondering why the app feels slow. The warning names
 * the one provider call that fixes it.
 *
 * ★ **An unsafe scheme is not a link.** Targets usually come from data — a
 * breadcrumb trail built from a CMS, a menu from a config file — so a
 * `javascript:` or `data:` target is an injection, not a destination. `href`
 * runs every path through {@link svIsSafeUrl} (the same resolve-with-`new URL`
 * check the HTML sanitizer uses, so ` JaVaScRiPt:` and tab-split schemes are
 * caught too) and returns `null` — "this is not a link" — for anything that
 * fails it. Relative paths, `http(s):`, `mailto:` and `tel:` pass.
 */
export function svHrefLinkAdapter(): SvLinkAdapter {
  return {
    kind: 'href',

    href(target) {
      const path = toPath(target);
      if (path === '') return null;
      if (!svIsSafeUrl(path, false)) {
        svWarnOnce(
          `sv-link-adapter/unsafe:${path.slice(0, 40)}`,
          `A navigation link target uses a scheme that is not allowed ("${path.slice(0, 40)}"), ` +
            'so it is rendered without an href. Only relative paths, http(s):, mailto: and tel: ' +
            'are linked by the default adapter.',
        );
        return null;
      }
      return path;
    },

    navigate() {
      svWarnOnce(
        'sv-link-adapter/default',
        'No link adapter is provided, so links in navigation components are followed by ' +
          'the browser — a full page load rather than a router transition. Wire one up with ' +
          'provideSvLinkAdapter(() => ({ kind: "router", href: …, navigate: … })); see ' +
          'docs/navigation-routing-adr.md for the ten-line Angular version.',
      );
      return false;
    },
  };
}

/**
 * Where components look for their link adapter.
 *
 * Defaults to {@link svHrefLinkAdapter}, so a component works — renders real
 * links, navigates, is shareable — with nothing provided at all.
 */
export const SV_LINK_ADAPTER = new InjectionToken<SvLinkAdapter>('SvLinkAdapter', {
  providedIn: 'root',
  factory: svHrefLinkAdapter,
});

/**
 * Wire a link adapter in — as a value, or as a factory when it needs injection.
 *
 * ★ **The factory form is the one a real adapter needs, and the value form is a
 * trap worth naming.** Every useful adapter reaches a router, and `inject()`
 * inside `href` or `navigate` runs when a template calls it — outside any
 * injection context — which throws `NG0203` at click time rather than at
 * startup. Passing a factory means the injection happens once, where it is
 * legal, and the returned closure just uses what it captured.
 *
 * @example
 * // app.config.ts — the Angular router version, in ten lines.
 * providers: [
 *   provideSvLinkAdapter(() => {
 *     const router = inject(Router);
 *     const tree = (t: SvLinkTarget) => (typeof t === 'string' ? router.parseUrl(t) : router.createUrlTree([...t]));
 *     return {
 *       kind: 'angular-router',
 *       href: (t) => router.serializeUrl(tree(t)),
 *       navigate: (t) => { void router.navigateByUrl(tree(t)); return true; },
 *     };
 *   }),
 * ]
 */
export function provideSvLinkAdapter(
  adapter: SvLinkAdapter | (() => SvLinkAdapter),
): EnvironmentProviders {
  return makeEnvironmentProviders([
    typeof adapter === 'function'
      ? { provide: SV_LINK_ADAPTER, useFactory: adapter }
      : { provide: SV_LINK_ADAPTER, useValue: adapter },
  ]);
}

/**
 * Whether a click is the browser's own gesture rather than a plain activation.
 *
 * ★ Shared so the answer cannot drift between components. Cancelling a
 * ⌘/Ctrl/Shift/Alt or middle click takes "open in a new tab" away from a
 * navigation control, which is where people use it most — `sv-mega-menu` reached
 * this conclusion independently and this is the same rule, in one place.
 */
export function svIsModifiedClick(event: Event): boolean {
  const mouse = event as MouseEvent;
  return Boolean(
    mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey || mouse.button === 1,
  );
}
