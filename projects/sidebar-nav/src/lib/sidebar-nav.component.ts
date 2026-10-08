import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  untracked,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
  svStackedPopup,
  SV_LINK_ADAPTER,
  svElementSize,
  svFocusableWithin,
  svIsModifiedClick,
  svNavParam,
  svNavRecorder,
  svRecoverFocus,
  type MenuGroup,
  type MenuItem,
  type NavChild,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';
import {
  svSidebarActiveItem,
  svSidebarRouteActive,
  type SidebarNavSelection,
} from './sidebar-nav.model';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Sidebar Navigation — `N-1`.
 *
 * ## ★★★ This is a SPLIT, not a green field
 *
 * `projects/layout/src/sidebar` already had `menuGroups`, `childGroups`,
 * badges, `collapsed` for the rail and `mobileOpen` for the drawer. The backlog
 * called it *"the documentation site's own chrome, unusable in a consumer's
 * dashboard"*; read properly it was **most of `N-1` already**, and two things
 * made it unusable by a buyer:
 *
 *   1. **The kit's brand was welded in** — a home link hard-coded to
 *      `/components`, a `logo-icon-sm.svg`, the wordmark, and a footer of
 *      `docsUrl` / `githubUrl` / `npmUrl` / `communityUrl` / `version`.
 *   2. ★★ **It imported `RouterLink` and `RouterLinkActive` and injected
 *      `Router`** — which is the exact thing `X-8` exists to stop. *"A kit that
 *      hard-depends on the Angular router is unusable in a hybrid or non-routed
 *      app"*, and here was the existence proof, shipped: the component a hybrid
 *      consumer would most want was the one they could not take.
 *
 * So this component has no brand and no router. The chrome is
 * **content-projected** — `[slot=header]` and `[slot=footer]` — and every link
 * goes through `SvLinkAdapter`.
 *
 * ## ★★ Where you are is the HOST's to say, and that is a decision
 *
 * `routerLinkActive` answered *"am I on this route?"*, and neither of `X-8`'s
 * seams does: `SvNavLocation` is a keyed store (*where does my state live?*),
 * `SvLinkAdapter` renders and navigates (*who takes this click?*). Neither
 * answers *"where am I now?"*.
 *
 * A third seam was the obvious move and would have been wrong. Route matching
 * is the router's hardest job — trailing slashes, matrix params, query strings,
 * segment boundaries — and an `isActive(target)` on the adapter would make
 * every consumer reimplement it, subtly differently. So `activeRoute` is an
 * ordinary controlled input (`docs/controlled-state-adr.md`): the host owns
 * where it is, and a host with a router writes `[activeRoute]="router.url"`.
 *
 * ★ The **sub**-item is different, because it genuinely is component state that
 * lives in the address — and that is precisely `SvNavLocation`'s job, so
 * `childKey` reads it through `svNavParam` rather than through a regex over
 * `router.url` the way `sv-sidebar` does.
 *
 * ## Features
 * - Grouped items with badges, sub-navigation groups, and an icon per item
 * - Three states out of one model: expanded, collapsed rail, mobile drawer
 * - No `@angular/router` import anywhere — links are real `<a href>` via the adapter
 * - Header and footer are yours; this component ships no brand
 * - Records to the shared navigation stream (`X-15`)
 *
 * @example
 * ```html
 * <sv-sidebar-nav
 *   [menuGroups]="groups"
 *   [activeRoute]="router.url"
 *   [(collapsed)]="railed"
 *   (itemSelected)="close()">
 *   <a slot="header" href="/">Acme</a>
 *   <span slot="footer">v2.4</span>
 * </sv-sidebar-nav>
 * ```
 */
@Component({
  selector: 'sv-sidebar-nav',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, SvIconComponent],
  templateUrl: './sidebar-nav.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvSidebarNavComponent {
  private readonly links = inject(SV_LINK_ADAPTER);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Grouped navigation items. @default [] */
  menuGroups = input<readonly MenuGroup[]>([]);

  /**
   * The path the reader is on, so one item can be marked current.
   *
   * ★ Controlled rather than derived. See the class note: matching a route is
   *   the router's job, and a component that guessed at it would be wrong in a
   *   different way in every app. `[activeRoute]="router.url"` is the whole
   *   wiring for a routed app. @default ''
   */
  activeRoute = input<string>('');

  /**
   * URL parameter naming the open sub-item — the `?c=…` `sv-sidebar` has always
   * used. Read through `SvNavLocation`, so it is inert until the app provides
   * one. `null` turns sub-item tracking off. @default 'c'
   */
  childKey = input<string | null>('c');

  /**
   * Pin the open sub-item, ignoring the URL. For a host that keeps this in its
   * own state rather than in the address. @default null
   */
  activeChildId = input<string | null>(null);

  /** Icon-only rail. Two-way via `[(collapsed)]`. @default false */
  collapsed = model<boolean>(false);

  /** Mobile drawer open. Two-way via `[(mobileOpen)]`. @default false */
  mobileOpen = model<boolean>(false);

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   * `scripts/generate-component-docs.mjs` lifts an input's JSDoc verbatim into
   * one table cell, so the reasoning lives here.
   *
   * ── `N-1`: `mobileOpen` was state with nothing attached to it ────────────────
   * The model existed and the template rendered the same `<aside>` whatever it
   * said — no off-canvas, no backdrop, no Escape, no focus handling. A host that
   * wired a hamburger to `[(mobileOpen)]` got a flag and a sidebar that never
   * moved.
   *
   * ★ Built here, not composed. `sv-drawer` lives in `@styloviz-pro/overlays`,
   * and a FREE package cannot depend on a Pro one (`check:tier`,
   * `check:peer-deps`). The drawer is small: translate classes, a backdrop
   * button, Escape, and focus moved in on open and back to the opener on close.
   *
   * ★★ Measured, like `sv-mega-menu`'s `mobileBreakpoint`, and zero width is NOT
   * mobile: `svElementSize` reports zero on the server and for the first frame,
   * and treating that as small would prerender every page with the sidebar
   * hidden off-canvas. Unknown means the docked sidebar.
   */

  /**
   * Viewport width below which the sidebar becomes an off-canvas drawer driven
   * by `mobileOpen`. Set to `0` to keep it docked at every size — e.g. when it
   * is embedded in a panel rather than used as the page's shell.
   * @default 1024
   */
  mobileBreakpoint = input<number>(1024);

  /**
   * Accessible name of the `<nav>` landmark. A page with two of these — a
   * primary sidebar and a secondary panel — needs them told apart.
   * @default 'Main navigation'
   */
  ariaLabel = input<string>('Main navigation');

  /**
   * Render the header / footer slots at all. A rail with no chrome is a common
   * shape and an empty bordered box is not. @default true
   */
  showHeader = input<boolean>(true);
  /** Render the footer area holding the `[slot=footer]` content and, outside the mobile drawer, the collapse toggle. @default true */
  showFooter = input<boolean>(true);

  /**
   * Names this sidebar in the shared navigation-analytics stream (`X-15`).
   * Ignored unless `provideSvNavTelemetry()` is wired up. @default null
   */
  surfaceId = input<string | null>(null);

  /** Additional CSS classes on the `<aside>`. */
  customClass = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────

  /**
   * Something was picked. Carries the group and, for a sub-item, the child —
   * a host closing a drawer needs the event, and a host doing its own
   * analytics needs to know *which* thing was clicked, not just that one was.
   */
  itemSelected = output<SidebarNavSelection>();

  /**
   * The drawer should close. Emitted alongside `mobileOpen` being set to
   * `false`, for a host that has its own shell state to keep in step.
   */
  mobileClose = output<void>();

  /** The rail toggle was pressed. `collapsed` is already flipped. */
  toggleCollapse = output<boolean>();

  // ── Seams ─────────────────────────────────────────────────────────────────

  /**
   * ★ `?c=…` through `SvNavLocation` rather than a regex over `router.url`.
   *   `sv-sidebar` reads the param with `match(/[?&]c=([^&]+)/)`, which is both
   *   a router dependency and a hand-rolled parser; this is the seam T1 built
   *   for exactly this, and it is inert in an app that provides no location.
   */
  private readonly childParam = svNavParam(() => this.childKey());

  private readonly nav = svNavRecorder('sidebar', () => this.surfaceId());

  /** The viewport, measured. Zero on the server and on the first frame. */
  private readonly viewport = svElementSize(() =>
    typeof document === 'undefined' ? null : document.documentElement,
  );

  /** Whatever held focus when the drawer opened — the host's hamburger, usually. */
  private opener: HTMLElement | null = null;

  constructor() {
    // Focus follows the drawer. An effect because `mobileOpen` is a model the
    // HOST writes, and the host's hamburger is the one place this component
    // never sees a click from.
    effect(() => {
      const open = this.drawerOpen();
      untracked(() => (open ? this.onDrawerOpened() : this.onDrawerClosed()));
    });
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  /** The top-level item the reader is inside, or `null`. */
  protected readonly currentItem = computed<MenuItem | null>(() =>
    svSidebarActiveItem(this.menuGroups(), this.activeRoute()),
  );

  /** The open sub-item's id: the host's, else the URL's. */
  protected readonly openChildId = computed<string | null>(
    () => this.activeChildId() ?? this.childParam.value(),
  );

  /** Whether the sidebar is an off-canvas drawer at this viewport width. */
  readonly isDrawer = computed<boolean>(() => {
    const limit = this.mobileBreakpoint();
    if (limit <= 0) return false;
    const width = this.viewport().width;
    return width > 0 && width < limit;
  });

  /** Whether the drawer is actually showing — `mobileOpen` means nothing when docked. */
  readonly drawerOpen = computed<boolean>(() => this.isDrawer() && this.mobileOpen());

  /** The icon-only rail. A drawer is always full width, so it never rails. */
  protected readonly railed = computed<boolean>(() => this.collapsed() && !this.isDrawer());

  protected readonly asideClasses = computed<string>(() => {
    const base = 'flex h-full flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900';
    if (!this.isDrawer()) {
      return [base, 'transition-all duration-300', this.railed() ? 'w-20' : 'w-64', this.customClass()]
        .filter(Boolean)
        .join(' ');
    }
    return [
      base,
      // `visibility` rides the transition so a closed drawer's links leave the
      // Tab order — an off-screen link that still takes focus is a focus trap
      // the reader cannot see.
      'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-xl transition-[transform,visibility] duration-300',
      this.mobileOpen() ? 'visible translate-x-0' : 'invisible -translate-x-full',
      this.customClass(),
    ]
      .filter(Boolean)
      .join(' ');
  });

  // ── Helpers the template asks ─────────────────────────────────────────────

  protected isActive(item: MenuItem): boolean {
    return this.currentItem() === item;
  }

  /**
   * Sub-navigation shows for the item the reader is inside — which is
   * `svSidebarRouteActive`, not `currentItem`, so a nested pair like
   * `/settings` and `/settings/billing` can both have panels open.
   */
  protected showsChildren(item: MenuItem): boolean {
    return (
      !this.railed() &&
      !!item.childGroups?.length &&
      svSidebarRouteActive(item.route, this.activeRoute())
    );
  }

  protected itemClasses(item: MenuItem): string {
    const base =
      'group mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset';
    const state = this.isActive(item)
      ? 'bg-primary-50 font-semibold text-primary-700 dark:bg-primary-950/70 dark:text-primary-300'
      : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-gray-100';
    return `${base} ${state} ${this.railed() ? 'justify-center' : ''}`;
  }

  protected childClasses(child: NavChild): string {
    const base =
      'flex w-full items-center rounded-md py-[5px] pl-3 pr-2 text-[12.5px] font-medium transition-colors ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset';
    return this.openChildId() === child.id
      ? `${base} bg-primary-50 text-primary-700 dark:bg-primary-950/70 dark:text-primary-300`
      : `${base} text-gray-500 hover:bg-gray-100/60 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-300`;
  }

  protected badgeClasses(item: MenuItem): string {
    const tint = {
      primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300',
      accent: 'bg-accent-100 text-accent-700 dark:bg-accent-900/50 dark:text-accent-300',
      warning: 'bg-warning-100 text-warning-700 dark:bg-warning-900/50 dark:text-warning-300',
      danger: 'bg-danger-100 text-danger-700 dark:bg-danger-900/50 dark:text-danger-300',
    }[item.badgeColor ?? 'primary'];
    return `rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tint}`;
  }

  /** The `href` for a top-level item, or for one of its sub-items. */
  protected hrefFor(item: MenuItem, child?: NavChild): string | null {
    const key = this.childKey();
    const base = this.links.href(item.route);
    if (!child || !key || base === null) return base;
    // `?` or `&` by what the ADAPTER produced, not by `item.route`: an adapter
    // is free to add a query of its own, and the separator has to follow it.
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}${encodeURIComponent(key)}=${encodeURIComponent(child.id)}`;
  }

  // ── Interaction ───────────────────────────────────────────────────────────

  /**
   * ★ The browser's navigation is cancelled exactly when the adapter says it
   *   took it — one event, one navigation, the rule `NV-07-I12` made a
   *   principle. A modified click is never intercepted: that gesture means
   *   "open this somewhere else".
   *
   * ★★ The adapter is handed a PATH — `item.route` — never the finished `href`.
   *   `SvLinkTarget`'s contract is "a string is a path", and the ten-line router
   *   adapter does `router.navigate([target])`, which percent-encodes a `?`:
   *   `/orders?c=shipped` became a route called `orders%3Fc%3Dshipped`. The
   *   sub-item is not part of the path; it is component state that lives in the
   *   address, which is `SvNavLocation`'s job (the class note). So:
   *
   *   · a top-level item      → `navigate(item.route)`
   *   · a sub-item, with an addressable location, on the item's own page
   *                           → no navigation at all, just `childParam.set` —
   *                             the page is not changing, one param is
   *   · any other sub-item    → the anchor is followed. Its `href` carries the
   *                             param and the adapter could only drop it; a
   *                             full load that lands in the right place beats a
   *                             transition that lands in the wrong one.
   */
  protected onSelect(
    event: MouseEvent,
    group: MenuGroup,
    item: MenuItem,
    child: NavChild | null,
  ): void {
    if (svIsModifiedClick(event)) return;

    const href = this.hrefFor(item, child ?? undefined) ?? item.route;

    if (child === null || this.childKey() === null) {
      if (this.links.navigate(item.route)) event.preventDefault();
    } else if (this.childParam.addressable() && this.onItemPage(item)) {
      event.preventDefault();
      this.childParam.set(child.id);
    }

    this.nav.record({
      intent: 'jump',
      key: href,
      label: child?.label ?? item.label,
    });
    this.itemSelected.emit({ item, group, child });
    this.closeDrawer();
  }

  /** Is the reader on `item.route` itself — not beneath it, query and hash aside? */
  private onItemPage(item: MenuItem): boolean {
    const path = (url: string) => url.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
    return path(this.activeRoute()) === path(item.route);
  }

  /** Close the drawer, if it is open. Idempotent. */
  protected closeDrawer(): void {
    if (!this.mobileOpen()) return;
    this.mobileOpen.set(false);
    this.mobileClose.emit();
  }

  // ── The drawer (`N-1`) ────────────────────────────────────────────────────

  /**
   * On the overlay stack while open (`X-4`): Escape belongs to the topmost
   * surface only, so a dialog opened over this one takes it first.
   */
  protected readonly _stackedPopup = svStackedPopup({
    open: () => this.drawerOpen(),
    layer: 'sheet',
  });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    // Only the topmost surface acts on Escape (`X-4`).
    if (!this._stackedPopup.ownsEscape()) return;
    if (this.drawerOpen()) this.closeDrawer();
  }

  /**
   * Keep Tab inside the open drawer. The page underneath is behind a backdrop
   * and cannot be clicked, so letting Tab wander into it would put focus
   * somewhere the reader can neither see nor use. On the host rather than the
   * `<aside>`: it is a delegation root, not a control, and a template handler on
   * a landmark reads to the lint rules as an unfocusable control.
   */
  @HostListener('keydown', ['$event'])
  onDrawerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.drawerOpen()) return;
    const all = svFocusableWithin(this.asideEl());
    if (all.length === 0) return;
    const first = all[0];
    const last = all[all.length - 1];
    const active = typeof document === 'undefined' ? null : document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private asideEl(): HTMLElement | null {
    return this.host.nativeElement.querySelector('aside');
  }

  private onDrawerOpened(): void {
    if (typeof document === 'undefined') return;
    const active = document.activeElement;
    this.opener = active instanceof HTMLElement && active !== document.body ? active : null;
    // After render: until the classes flip, the drawer is `visibility: hidden`,
    // and a hidden element cannot take focus.
    afterNextRender(
      () => {
        const aside = this.asideEl();
        svRecoverFocus({ to: [svFocusableWithin(aside)[0]], fallback: aside });
      },
      { injector: this.injector },
    );
  }

  private onDrawerClosed(): void {
    const opener = this.opener;
    if (opener === null || typeof document === 'undefined') return;
    this.opener = null;
    // Only when focus is still ours to give back. A drawer closed by the host
    // while the reader is typing somewhere else must not pull them out of it.
    const active = document.activeElement;
    const aside = this.asideEl();
    const ours = active === null || active === document.body || (aside?.contains(active) ?? false);
    if (!ours) return;
    afterNextRender(
      () => svRecoverFocus({ to: [opener], fallback: this.host.nativeElement }),
      { injector: this.injector },
    );
  }

  protected onToggleCollapse(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    this.toggleCollapse.emit(next);
  }
}
