import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output } from '@angular/core';
import { SvIconComponent } from '@styloviz/icons';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { svAttrSelector, type MenuGroup } from '@styloviz/core';

/**
 * SidebarComponent — **this documentation site's own chrome**.
 *
 * ⚠️ NOT THE ONE TO REACH FOR IN AN APP. `N-1` split this component on
 *    2026-09-21: its reusable half is **`sv-sidebar-nav` in
 *    `@styloviz/sidebar-nav`**, which has no brand welded in and — the part
 *    that matters — **no `@angular/router` import**. This one keeps
 *    `RouterLink`, `RouterLinkActive` and `inject(Router)`, which is exactly
 *    why the backlog called it unusable in a consumer's dashboard: it is the
 *    existence proof `X-8` was written about.
 *
 * It stays, unchanged and supported, because it works perfectly for the fully
 * routed site it was written for and because deleting it would be a migration
 * charged to consumers for no benefit they asked for. Reimplementing it on top
 * of `sv-sidebar-nav` is a follow-up with no consumer-visible surface; see the
 * amendment in `docs/navigation-catalog-adr.md`.
 *
 * Collapsible navigation sidebar with grouped menu items.
 *
 * Features:
 * - Expanded mode: shows icons + labels + group headings
 * - Collapsed mode: shows icons only with tooltip-style labels
 * - Mobile mode: slides in as overlay from the left
 * - Active route highlighting via RouterLinkActive
 * - Accessible keyboard navigation
 */
@Component({
  selector: 'sv-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, SvIconComponent],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvSidebarComponent {
  /** Whether the sidebar is in collapsed (icon-only) mode */
  collapsed = input<boolean>(false);

  /** Whether the mobile sidebar overlay is open */
  mobileOpen = input<boolean>(false);

  /** Emits when the mobile sidebar should close */
  mobileClose = output<void>();

  /**
   * Deprecated, and never emitted: the sidebar has no collapse toggle of its own — the toggle
   * lives in `sv-topbar` (`(toggleSidebar)`), and the parent shell owns `collapsed`.
   *
   * @deprecated Kept so 1.x templates compile; removed in 2.0. Drive
   * `[collapsed]` from the shell instead.
   */
  toggleCollapse = output<void>();

  /**
   * Navigation menu groups injected by the parent shell.
   * Defaults to the built-in NAVIGATION_ITEMS so the component
   * works out-of-the-box, but buyers can pass their own structure.
   */
  menuGroups = input<MenuGroup[]>([]);

  // ── Footer resource links (override to point at your own URLs) ───────────

  /** Documentation site URL. */
  readonly docsUrl = input<string>('#docs');

  /** GitHub repository URL. */
  readonly githubUrl = input<string>('#github');

  /** npm package URL. */
  readonly npmUrl = input<string>('#npm');

  /** Community / forum URL. */
  readonly communityUrl = input<string>('#community');

  /** Version label shown in the footer (e.g. `v1.0`, `v0.1.3`). */
  readonly version = input<string>('v1.0');

  /**
   * Show the footer resource icons (Docs · GitHub · npm · Community). Defaults
   * to `true` for the standalone library look; a host app can set `false` to
   * render just the version label without forking the component.
   */
  readonly showFooterLinks = input<boolean>(true);

  // ── Router-aware sub-navigation ─────────────────────────────────────────

  private readonly router = inject(Router);

  /** Host element — used to locate and center the active nav item. */
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    // Keep the selected navigation item centered in the sidebar viewport
    // whenever the selection changes (and on initial load).
    effect(() => {
      const id = this.activeChildId();
      if (!id || typeof requestAnimationFrame === 'undefined') return;
      // Defer to the next frame so the active item (and its expanded
      // sub-navigation) are present in the DOM before we measure/scroll.
      requestAnimationFrame(() => {
        // ⚠️ Was `CSS.escape(id)`, unguarded — and `CSS` is undefined in jsdom
        //    and anywhere without that global, so this threw inside a
        //    `requestAnimationFrame` callback where nothing catches it.
        const el = this.host.nativeElement.querySelector<HTMLElement>(
          svAttrSelector('data-nav-item', id),
        );
        if (!el) return;
        const reduceMotion =
          typeof matchMedia !== 'undefined' &&
          matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
  }

  /** Reactive snapshot of the current URL, updated on every navigation. */
  private readonly routerUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * ID of the active child item (read from ?c= query param), or `null` on a
   * bare `/components` route — which shows the dashboard overview, so no child
   * item should appear selected.
   */
  readonly activeChildId = computed(() => {
    const match = this.routerUrl().match(/[?&]c=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  });

  /** True when the current route starts with the given path. */
  isOnRoute(route: string): boolean {
    return this.routerUrl().startsWith(route);
  }

  /** Tailwind class string for a sidebar child nav item. */
  childItemClass(id: string): string {
    const base = 'flex w-full items-center rounded-md py-[5px] pl-3 pr-2 text-[12.5px] font-medium transition-colors duration-100';
    if (this.activeChildId() === id) {
      return `${base} bg-primary-50 text-primary-700 dark:bg-primary-950/70 dark:text-primary-300`;
    }
    return `${base} text-gray-500 hover:bg-gray-100/60 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-300`;
  }

}