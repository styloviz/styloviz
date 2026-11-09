import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  contentChild,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { svUniqueId } from '@styloviz/core/a11y';
import { svIsSwipePointer, svSwipeGesture } from '@styloviz/core/gestures';
import { injectSvLabels } from '@styloviz/core/i18n';
import { svElementSize } from '@styloviz/core/layout';
import { type MenuGroup, type MenuItem, type NavChild } from '@styloviz/core/models';
import { SV_LINK_ADAPTER, svIsModifiedClick, svNavParam, svNavRecorder } from '@styloviz/core/nav';
import { svStackedPopup, svFocusableWithin, svRecoverFocus } from '@styloviz/core/overlay';
import { svAttrSelector } from '@styloviz/core/security';
import { SvIconComponent } from '@styloviz/icons';
import { SvTooltipComponent } from '@styloviz/overlays';
import { SvScrollAreaComponent } from '@styloviz/scroll-area';
import { SvSidebarNavItemEndDirective } from './sidebar-nav.templates';
import {
  SV_SIDEBAR_NAV_LABELS,
  svSidebarActiveItem,
  svSidebarGroupKey,
  svSidebarItemKey,
  svSidebarRouteActive,
  svNavChildHolds,
  type SidebarNavSelection,
  type SvSidebarNavLabels,
} from './sidebar-nav.model';

import { registerSidebarNavIcons } from './sidebar-nav.component.icons';
/** `'multiple'` lets several sections stay open; `'single'` closes the others (`SR-30`). */
export type SidebarNavExpandMode = 'multiple' | 'single';

/** The active row: a tinted fill, or a bar on the start edge (`SR-30`). */
export type SidebarNavActiveStyle = 'fill' | 'bar';

/** Badges as a pill of text, a round count, or a bare dot (`SR-30`). */
export type SidebarNavBadgeVariant = 'pill' | 'count' | 'dot';

/** Row height (`SR-30`). */
export type SidebarNavDensity = 'comfortable' | 'compact';

/**
 * The mobile drawer (`SR-30b`): `'overlay'` slides over the page behind a
 * backdrop; `'push'` opens in the flow and moves the page aside.
 */
export type SidebarNavDrawerMode = 'overlay' | 'push';

/** How the list marks rows hidden past its edges (`SR-30b`). */
export type SidebarNavScrollFade = 'gradient' | 'shadow' | 'none';

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
  imports: [NgClass, NgTemplateOutlet, SvIconComponent, SvTooltipComponent, SvScrollAreaComponent],
  templateUrl: './sidebar-nav.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvSidebarNavComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerSidebarNavIcons();

  /** The package's labels — `provideSvLabels({ sidebarNav: { … } })`; `[labels]` overrides them per instance. */
  private readonly registryLabels = injectSvLabels('sidebarNav', SV_SIDEBAR_NAV_LABELS);
  private readonly links = inject(SV_LINK_ADAPTER);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Grouped navigation items. @default [] */
  menuGroups = input<readonly MenuGroup[]>([]);

  /**
   * The path the reader is on, so one item can be marked current.
   *
   * Controlled rather than derived: matching a route is the router's job, and a
   * component that guessed at it would be wrong in a different way in every
   * app. `[activeRoute]="router.url"` is the whole wiring for a routed app.
   * @default ''
   */
  activeRoute = input<string>('');

  /**
   * URL parameter naming the open sub-item — the same `?c=…` parameter
   * `sv-sidebar` uses. Read through `SvNavLocation`, so it is inert until the app provides
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
  ariaLabel = input<string>(this.registryLabels.navigation);

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

  /**
   * Whether opening one section closes the others. @default 'multiple'
   */
  expandMode = input<SidebarNavExpandMode>('multiple');

  /**
   * Keys (`item.id`, else the route) of the items whose sub-pages are open,
   * and `<item key>::<sub-item id>` for an open third level.
   * The section the reader is inside opens on its own, and closes again when
   * they leave unless they opened it themselves. Two-way. @default []
   */
  expandedIds = model<readonly string[]>([]);

  /** Keys (`group.id`, else its label) of `collapsible` groups folded away. Two-way. @default [] */
  collapsedGroups = model<readonly string[]>([]);

  /** The active row's look. @default 'fill' */
  activeStyle = input<SidebarNavActiveStyle>('fill');

  /** How badges are drawn. @default 'pill' */
  badgeVariant = input<SidebarNavBadgeVariant>('pill');

  /** Row height. @default 'comfortable' */
  density = input<SidebarNavDensity>('comfortable');

  /** Every string the sidebar renders. */
  labels = input<Partial<SvSidebarNavLabels>>({});

  /**
   * Fades at the list's edges while there is more to scroll. `'gradient'`
   * fades to the sidebar's surface (`--sv-sa-fade` to change it); `'shadow'`
   * suits a tinted or translucent sidebar. @default 'gradient'
   */
  scrollFade = input<SidebarNavScrollFade>('gradient');

  /** The drawer below `mobileBreakpoint`: over the page, or pushing it aside. @default 'overlay' */
  drawerMode = input<SidebarNavDrawerMode>('overlay');

  /** Swipe the open drawer toward its edge to close it (touch and pen). @default true */
  swipeToClose = input<boolean>(true);

  /** Swipe in from the start edge of the screen to open the drawer. @default false */
  edgeSwipe = input<boolean>(false);

  /** The row-end template slot (`svSidebarNavItemEnd`). */
  protected readonly itemEnd = contentChild(SvSidebarNavItemEndDirective);

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

  /** The id the collapse toggle points `aria-controls` at. */
  protected readonly navId = svUniqueId('sv-sidebar-nav');

  protected readonly text = computed<SvSidebarNavLabels>(() => ({ ...this.registryLabels, ...this.labels() }));

  /**
   * Keys this component opened because the reader was inside them — and so
   * may close again when they leave. A key the reader toggled leaves this
   * list, and stays as they left it.
   */
  private autoOpened: string[] = [];
  private lastRoute: string | null = null;

  /** How far the open drawer is being dragged toward its edge, in px. */
  protected readonly dragOffset = signal(0);
  /** The gesture in progress: its direction, and what it is doing. */
  private swipe: { rtl: boolean; open: boolean } | null = null;
  /** Stops tracking the gesture in progress — see `beginSwipe`. */
  private stopSwipe: (() => void) | null = null;

  /** A type-ahead buffer and when it lapses. */
  private typed = '';
  private typedAt = 0;

  constructor() {
    // A gesture in progress when the sidebar goes away must not keep its
    // document listeners.
    inject(DestroyRef).onDestroy(() => this.stopSwipe?.());
    // Focus follows the drawer. An effect because `mobileOpen` is a model the
    // HOST writes, and the host's hamburger is the one place this component
    // never sees a click from.
    effect(() => {
      const open = this.drawerOpen();
      untracked(() => (open ? this.onDrawerOpened() : this.onDrawerClosed()));
    });

    // ★★ THE SECTION YOU ARE IN OPENS ITSELF (`SR-30`) — and only on a route
    //    CHANGE, so a reader who closes it is not overruled on the next render.
    effect(() => {
      const route = this.activeRoute();
      const groups = this.menuGroups();
      untracked(() => {
        if (route === this.lastRoute) return;
        this.lastRoute = route;
        const inside = groups
          .flatMap(group => group.items)
          .filter(item => !!item.childGroups?.length && svSidebarRouteActive(item.route, route))
          .map(svSidebarItemKey);
        const now = this.expandedIds();
        // Leaving a section closes what this component opened for it.
        let next = now.filter(key => !this.autoOpened.includes(key) || inside.includes(key));
        // `single` closes other SECTIONS; a sub-item's third level goes with its section.
        const section = (key: string) => key.split('::')[0];
        if (this.expandMode() === 'single' && inside.length) next = next.filter(key => inside.includes(section(key)));
        const added = inside.filter(key => !next.includes(key));
        next = [...next, ...added];
        this.autoOpened = [...this.autoOpened.filter(key => inside.includes(key)), ...added];
        if (next.length !== now.length || next.some((key, i) => key !== now[i])) this.expandedIds.set(next);
      });
    });

    effect(onCleanup => {
      if (!this.edgeSwipe() || !this.isDrawer() || typeof document === 'undefined') return;
      document.addEventListener('pointerdown', this.onEdgeDown);
      onCleanup(() => document.removeEventListener('pointerdown', this.onEdgeDown));
    });

    // ★★ FOCUS NEVER FALLS TO <body> (`SR-30`). Sub-pages vanish when the rail
    //    collapses or a section closes; if one of them held focus, the browser
    //    drops it on the document. Its parent row takes it first.
    effect(() => {
      this.railed();
      this.expandedIds();
      untracked(() => this.rescueFocus());
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
    const base = 'flex h-full flex-col border-e border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900';
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
      ...(this.drawerMode() === 'push'
        ? [
            // ★ Push (`SR-30b`): in the flow, sliding in on its start margin, so
            //   the page beside it is moved, not covered — and the drawer's
            //   own content keeps its width instead of being squeezed.
            'relative w-72 max-w-[85%] shrink-0 transition-[margin,visibility] duration-300',
            this.mobileOpen() ? 'visible ms-0' : 'invisible -ms-72', // sv-i18n-ignore: Tailwind classes
          ]
        : [
            // `85%`, not `85vw`: a fixed element's % is its containing block —
            // the viewport for a page shell, a transformed frame for an
            // embedded one — where `vw` is always the viewport.
            'fixed inset-y-0 start-0 z-50 w-72 max-w-[85%] shadow-xl transition-[transform,visibility] duration-300',
            this.mobileOpen() ? 'visible translate-x-0' : 'invisible -translate-x-full rtl:translate-x-full', // sv-i18n-ignore: Tailwind classes
          ]),
      this.dragOffset() > 0 ? 'transition-none' : '',
      this.customClass(),
    ]
      .filter(Boolean)
      .join(' ');
  });

  /** The open drawer following a finger toward its edge. */
  protected readonly dragTransform = computed(() => {
    const px = this.dragOffset();
    if (px <= 0 || !this.swipe) return null;
    return `translateX(${this.swipe.rtl ? px : -px}px)`;
  });

  /** Whether the backdrop is drawn — an overlay drawer only. */
  protected readonly showBackdrop = computed(() => this.drawerOpen() && this.drawerMode() === 'overlay');

  /**
   * ★ Everything the template draws, worked out once per change — so no
   *   `@for` block calls a method per row per check.
   */
  protected readonly viewGroups = computed<readonly SidebarNavViewGroup[]>(() => {
    this.currentItem();
    this.openChildId();
    this.railed();
    this.expandedIds();
    this.activeStyle();
    this.badgeVariant();
    this.density();
    const collapsed = this.collapsedGroups();
    return this.menuGroups().map(group => {
      const key = svSidebarGroupKey(group);
      return {
        group,
        key,
        open: !group.collapsible || !collapsed.includes(key),
        headingId: `${this.navId}-g-${safeId(key)}`,
        idSuffix: `g-${safeId(key)}`,
        items: group.items.map(item => {
          const open = this.showsChildren(item);
          return {
            item,
            key: svSidebarItemKey(item),
            href: this.hrefFor(item),
            classes: this.itemClasses(item),
            current: this.currentFor(item),
            hasChildren: this.hasChildren(item),
            open,
            childrenId: this.childrenId(item),
            childrenSuffix: `c-${safeId(svSidebarItemKey(item))}`,
            toggleText: this.toggleText(item),
            badgeClass: item.badge ? this.badgeClasses(item) : '',
            childGroups: open
              ? (item.childGroups ?? []).map(childGroup => ({
                  label: childGroup.label,
                  items: childGroup.items.map(child => {
                    const key = `${svSidebarItemKey(item)}::${child.id}`;
                    const current = this.openChildId();
                    const holdsDeeper = child.id !== current && svNavChildHolds(child, current);
                    const hasGrand = !!child.children?.length;
                    const open = hasGrand && (holdsDeeper || this.expandedIds().includes(key));
                    return {
                      child,
                      key,
                      href: this.hrefFor(item, child),
                      classes: this.childClasses(child),
                      current: child.id === current ? ('page' as const) : holdsDeeper ? ('true' as const) : null,
                      hasChildren: hasGrand,
                      open,
                      toggleable: hasGrand && !holdsDeeper,
                      suffix: `c-${safeId(key)}`,
                      toggleText: this.text().toggleChildren.replace('{label}', child.label),
                      children: open
                        ? (child.children ?? []).map(grand => ({
                            child: grand,
                            href: this.hrefFor(item, grand),
                            classes: this.childClasses(grand),
                            current: grand.id === current ? ('page' as const) : null,
                          }))
                        : [],
                    };
                  }),
                }))
              : [],
          };
        }),
      };
    });
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
    return !this.railed() && !!item.childGroups?.length && this.expandedIds().includes(svSidebarItemKey(item));
  }

  /** Whether a row draws a sub-page toggle — never in the rail. */
  protected hasChildren(item: MenuItem): boolean {
    return !this.railed() && !!item.childGroups?.length;
  }

  /**
   * ★ ONE `aria-current="page"`. When a sub-page is the page, the parent is
   *   on the trail, not the page itself — `"true"` says "in here" without a
   *   screen reader announcing two current pages.
   */
  protected currentFor(item: MenuItem): 'page' | 'true' | null {
    if (!this.isActive(item)) return null;
    const child = this.openChildId();
    const holdsChild =
      child !== null && !!item.childGroups?.some(group => group.items.some(entry => svNavChildHolds(entry, child)));
    return holdsChild && this.showsChildren(item) ? 'true' : 'page';
  }

  protected isGroupOpen(group: MenuGroup): boolean {
    return !group.collapsible || !this.collapsedGroups().includes(svSidebarGroupKey(group));
  }

  protected itemKey(item: MenuItem): string {
    return svSidebarItemKey(item);
  }

  protected childrenId(item: MenuItem): string {
    return `${this.navId}-c-${safeId(svSidebarItemKey(item))}`;
  }

  protected toggleText(item: MenuItem): string {
    return this.text().toggleChildren.replace('{label}', item.label);
  }

  /** Open or close an item's sub-pages. */
  toggleItem(item: MenuItem): void {
    const key = svSidebarItemKey(item);
    const now = this.expandedIds();
    this.autoOpened = this.autoOpened.filter(k => k !== key);
    if (now.includes(key)) {
      this.expandedIds.set(now.filter(k => k !== key));
      return;
    }
    this.expandedIds.set(
      this.expandMode() === 'single' ? [...now.filter(k => k.startsWith(`${key}::`)), key] : [...now, key],
    );
  }

  /** Open or close a sub-item's third level. */
  toggleChild(item: MenuItem, child: NavChild): void {
    const key = `${svSidebarItemKey(item)}::${child.id}`;
    const now = this.expandedIds();
    this.expandedIds.set(now.includes(key) ? now.filter(k => k !== key) : [...now, key]);
  }

  /** Fold or unfold a `collapsible` group. */
  toggleGroup(group: MenuGroup): void {
    const key = svSidebarGroupKey(group);
    const now = this.collapsedGroups();
    this.collapsedGroups.set(now.includes(key) ? now.filter(k => k !== key) : [...now, key]);
  }

  protected itemClasses(item: MenuItem): string {
    const pad = this.density() === 'compact' ? 'py-1.5' : 'py-2';
    const base =
      `group relative mb-0.5 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 ${pad} text-[13.5px] font-medium transition-colors ` +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset';
    const active = this.isActive(item);
    let state: string;
    if (active && this.activeStyle() === 'bar') {
      state =
        'font-semibold text-primary-700 dark:text-primary-300 before:absolute before:inset-y-1.5 before:start-0 ' +
        'before:w-[3px] before:rounded-full before:bg-primary-500';
    } else if (active) {
      state = 'bg-primary-50 font-semibold text-primary-700 dark:bg-primary-950/70 dark:text-primary-300';
    } else {
      state =
        'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-gray-100';
    }
    return `${base} ${state} ${this.railed() ? 'justify-center' : ''}`;
  }

  protected childClasses(child: NavChild): string {
    const base =
      'flex w-full items-center rounded-md py-[5px] ps-3 pe-2 text-[12.5px] font-medium transition-colors ' +
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
    switch (this.badgeVariant()) {
      case 'count':
        return `inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums ${tint}`;
      case 'dot':
        return `h-2 w-2 shrink-0 rounded-full ${DOT_TINT[item.badgeColor ?? 'primary']}`;
      default:
        return `rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tint}`;
    }
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
    parentChild: NavChild | null = null,
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
    this.itemSelected.emit(parentChild ? { item, group, child, parentChild } : { item, group, child });
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
    if (event.key !== 'Tab') {
      this.onNavKey(event);
      return;
    }
    if (!this.drawerOpen() || this.drawerMode() === 'push') return;
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

  /**
   * ★ Up/Down, Home/End and type-ahead between the rows (`SR-30`). Tab still
   *   walks every link; a sidebar of forty is what this is for.
   */
  private onNavKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const nav = target?.closest('nav');
    if (!target || !nav || !this.host.nativeElement.contains(nav) || event.altKey || event.ctrlKey || event.metaKey) return;
    const rows = Array.from(nav.querySelectorAll<HTMLElement>('a[data-sv-nav-row]'));
    const at = rows.indexOf(target);
    if (at < 0) return;
    let to = -1;
    switch (event.key) {
      case 'ArrowDown':
        to = Math.min(rows.length - 1, at + 1);
        break;
      case 'ArrowUp':
        to = Math.max(0, at - 1);
        break;
      case 'Home':
        to = 0;
        break;
      case 'End':
        to = rows.length - 1;
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const now = Date.now();
          this.typed = now - this.typedAt > 600 ? event.key.toLowerCase() : this.typed + event.key.toLowerCase();
          this.typedAt = now;
          const label = (el: HTMLElement) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().toLowerCase();
          const order = [...rows.slice(at + 1), ...rows.slice(0, at + 1)];
          const hit = order.find(el => label(el).startsWith(this.typed)) ??
            (this.typed.length > 1 ? undefined : order.find(el => label(el).startsWith(event.key.toLowerCase())));
          if (hit) to = rows.indexOf(hit);
        }
    }
    if (to < 0) return;
    event.preventDefault();
    rows[to].focus();
  }

  /**
   * Walk out from the focused element through every sub-page box around it;
   * the OUTERMOST one that is closing decides where focus goes — its parent row.
   */
  private rescueFocus(): void {
    if (typeof document === 'undefined') return;
    const open = this.openKeys();
    let box = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-sv-nav-children]') ?? null;
    let target: string | null = null;
    while (box && this.host.nativeElement.contains(box)) {
      const key = box.getAttribute('data-sv-nav-children') ?? '';
      if (!open.has(key)) target = key;
      box = box.parentElement?.closest<HTMLElement>('[data-sv-nav-children]') ?? null;
    }
    if (target === null) return;
    const key = target;
    // After render: the rail draws its rows in a tooltip, so the parent link
    // the reader lands on is a NEW element, not the one on screen now.
    afterNextRender(
      () => {
        const active = document.activeElement;
        const gone = active === null || active === document.body || !active.isConnected;
        const parent = this.host.nativeElement.querySelector<HTMLElement>(`a${svAttrSelector('data-sv-nav-parent', key)}`);
        if (gone && parent) parent.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  /** Keys of every open box — top-level items and sub-items with a third level. */
  private openKeys(): Set<string> {
    const keys = new Set<string>();
    for (const vg of this.viewGroups()) {
      for (const row of vg.items) {
        if (!row.open) continue;
        keys.add(row.key);
        for (const cg of row.childGroups) for (const entry of cg.items) if (entry.open) keys.add(entry.key);
      }
    }
    return keys;
  }

  // ── Swipe (`SR-30b`) ──────────────────────────────────────────────────────

  /**
   * ★ Touch and pen only — a mouse drag over a sidebar is a text selection,
   *   not a gesture. The drawer follows the finger, and closes past a third
   *   of its width; anything less springs back.
   */
  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    if (!svIsSwipePointer(event) || !this.swipeToClose() || !this.drawerOpen()) return;
    const aside = this.asideEl();
    if (!aside || !aside.contains(event.target as Node)) return;
    this.beginSwipe(event, true);
  }

  /**
   * ★ The tracking — axis lock, travel, document listeners — is core's
   *   `svSwipeGesture` (FL-J3-OF-20), shared with `sv-drawer`. What stays here
   *   is the sidebar's own rule: close past a third of the width (at most
   *   96px), open past 56px from the edge.
   */
  private beginSwipe(event: PointerEvent, open: boolean): void {
    const rtl = typeof getComputedStyle === 'function' && getComputedStyle(this.host.nativeElement).direction === 'rtl';
    this.stopSwipe?.();
    this.swipe = { rtl, open };
    // Closing travels toward the drawer's own edge — the start edge.
    const closing = rtl ? 'right' : 'left';
    this.stopSwipe = svSwipeGesture(event, {
      toward: open ? closing : rtl ? 'left' : 'right',
      onMove: (travel) => { if (open) this.dragOffset.set(Math.max(0, travel)); },
      onEnd: (sample) => {
        this.stopSwipe = null;
        this.swipe = null;
        const width = this.asideEl()?.getBoundingClientRect().width || 288;
        this.dragOffset.set(0);
        if (!sample) return;
        if (open && sample.travel > Math.min(96, width / 3)) this.closeDrawer();
        if (!open && sample.travel > 56) this.mobileOpen.set(true);
      },
    });
  }

  /**
   * Edge swipe: a touch that starts within 24 px of the edge the drawer opens
   * from, and moves inward, opens it.
   *
   * ★★ THE DRAWER'S EDGE, NOT THE SCREEN'S. The closed drawer sits just past
   *    the start of whatever contains it — the viewport for a page shell, a
   *    frame for an embedded one — so its own rect says where that edge is.
   *    Measuring `window` instead would let a touch anywhere down the left of
   *    the page open a drawer that lives in a panel on the right.
   */
  private readonly onEdgeDown = (event: PointerEvent): void => {
    if (!svIsSwipePointer(event) || this.mobileOpen() || !this.isDrawer()) return;
    const aside = this.asideEl();
    if (!aside) return;
    const rtl = getComputedStyle(this.host.nativeElement).direction === 'rtl';
    const box = aside.getBoundingClientRect();
    const edge = rtl ? box.left : box.right;
    const inward = rtl ? edge - event.clientX : event.clientX - edge;
    if (inward < 0 || inward > 24 || event.clientY < box.top || event.clientY > box.bottom) return;
    this.beginSwipe(event, false);
  };

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

const DOT_TINT = {
  primary: 'bg-primary-500',
  accent: 'bg-accent-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
} as const;

/** A key made safe for an `id` attribute. */
function safeId(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_');
}

interface SidebarNavViewLeaf {
  readonly child: NavChild;
  readonly href: string | null;
  readonly classes: string;
  readonly current: 'page' | null;
}

interface SidebarNavViewChild {
  readonly child: NavChild;
  /** `expandedIds` key for its third level: `<item key>::<child id>`. */
  readonly key: string;
  readonly href: string | null;
  readonly classes: string;
  readonly current: 'page' | 'true' | null;
  readonly hasChildren: boolean;
  readonly open: boolean;
  readonly toggleable: boolean;
  readonly suffix: string;
  readonly toggleText: string;
  readonly children: readonly SidebarNavViewLeaf[];
}

interface SidebarNavViewItem {
  readonly item: MenuItem;
  readonly key: string;
  readonly href: string | null;
  readonly classes: string;
  readonly current: 'page' | 'true' | null;
  readonly hasChildren: boolean;
  readonly open: boolean;
  readonly childrenId: string;
  /** `childrenId` without the per-instance prefix, for the template to scope. */
  readonly childrenSuffix: string;
  readonly toggleText: string;
  readonly badgeClass: string;
  readonly childGroups: readonly { readonly label: string; readonly items: readonly SidebarNavViewChild[] }[];
}

interface SidebarNavViewGroup {
  readonly group: MenuGroup;
  readonly key: string;
  readonly open: boolean;
  readonly headingId: string;
  /** `headingId` without the per-instance prefix, for the template to scope. */
  readonly idSuffix: string;
  readonly items: readonly SidebarNavViewItem[];
}
