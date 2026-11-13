import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { svWarnOnce } from '@styloviz/core/dev';
import { injectSvLabels } from '@styloviz/core/i18n';
import { type MenuItem } from '@styloviz/core/models';
import { SV_LINK_ADAPTER, svIsModifiedClick, svNavRecorder } from '@styloviz/core/nav';
import { SV_SHEET_SAFE_AREA_PADDING } from '@styloviz/core/overlay';
import { SvIconComponent } from '@styloviz/icons/core';
import { SV_SIDEBAR_NAV_LABELS, svSidebarRouteActive, svSidebarItemKey, type SvSidebarNavLabels } from './sidebar-nav.model';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Where the bar sits.
 * - `fixed` — pinned to the bottom of the viewport (the phone app bar).
 * - `sticky` — sticks to the bottom of its scrolling container.
 * - `static` — in the flow, for a frame or a preview that places it itself.
 */
export type BottomNavPosition = 'fixed' | 'sticky' | 'static';

/** The Tailwind breakpoint from which the bar is hidden (`md` = 768px and up). */
export type BottomNavBreakpoint = 'sm' | 'md' | 'lg';

/** `always` shows every label; `active` shows only the current item's, the rest stay as accessible names. */
export type BottomNavLabelVisibility = 'always' | 'active';

/** What the host is told when a destination is picked. */
export interface BottomNavSelection {
  /** The destination. */
  readonly item: MenuItem;
  /** Its position in `items`. */
  readonly index: number;
}

/** One rendered destination. */
interface BottomNavRow {
  readonly item: MenuItem;
  readonly key: string;
  readonly href: string | null;
  readonly current: boolean;
  readonly classes: string;
  readonly labelClasses: string;
  readonly badgeClasses: string;
}

/** Five is the ceiling every platform guideline names; more and the labels stop fitting a phone. */
const MAX_ITEMS = 5;

const BADGE_TINT: Record<NonNullable<MenuItem['badgeColor']>, string> = {
  primary: 'bg-primary-600 text-white',
  accent: 'bg-accent-700 text-white',
  warning: 'bg-warning-700 text-white',
  danger: 'bg-danger-600 text-white',
};

const HIDE_FROM: Record<BottomNavBreakpoint, string> = {
  sm: 'sm:hidden',
  md: 'md:hidden',
  lg: 'lg:hidden',
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Bottom Navigation — `N-2`, the phone renderer of the navigation model.
 *
 * ★★★ LINKS, NOT TABS. A bottom bar moves the reader to another page, so each
 *     destination is a real `<a href>` with `aria-current="page"` on the one
 *     they are on — never `role="tab"`, which promises a panel on THIS page and
 *     an arrow-key model the bar does not have. Tab moves between the links.
 *
 * ★★ THE SAME MODEL AS THE SIDEBAR. Items are core's `MenuItem` and the active
 *    match is `svSidebarRouteActive` (segment boundaries, longest match wins),
 *    so a phone layout and a desktop sidebar fed the same array always agree on
 *    where the reader is. `activeRoute` is controlled: a routed host writes
 *    `[activeRoute]="router.url"`. Links go through `SvLinkAdapter`, so there is
 *    no `@angular/router` import here either.
 *
 * ★ The home indicator. A fixed bar's last pixels sit under it unless padded by
 *   `env(safe-area-inset-bottom)` — with a fallback, or the whole declaration is
 *   dropped in a browser that does not know it. Needs `viewport-fit=cover` in
 *   the host page's viewport meta.
 *
 * Features:
 * - Icon + label per destination, 48px targets, badge (count or text) or a dot
 * - `fixed` / `sticky` / `static`; a fixed bar reserves its own height in the flow
 * - `hideFrom` hides it on wider screens, where the sidebar takes over
 * - Labels always shown, or only for the current item
 *
 * @example
 * ```html
 * <sv-bottom-nav [items]="tabs" [activeRoute]="router.url" hideFrom="md" />
 * ```
 */
@Component({
  selector: 'sv-bottom-nav',
  standalone: true,
  imports: [NgClass, SvIconComponent],
  templateUrl: './bottom-nav.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
    '[attr.data-sv-bottom-nav-position]': 'position()', // sv-i18n-ignore: host binding key
  },
})
export class SvBottomNavComponent {
  private readonly registryLabels = injectSvLabels('sidebarNav', SV_SIDEBAR_NAV_LABELS);
  private readonly links = inject(SV_LINK_ADAPTER);
  private readonly nav = svNavRecorder('bottom-nav', () => this.surfaceId());

  // ── Data ──────────────────────────────────────────────────────────────────

  /**
   * The destinations — three to five. Each `MenuItem` needs `label`, `route`
   * and `icon` (an icon-library name the app has registered); `badge`,
   * `badgeColor`, `dot`, `id` and `external` are honoured. @default []
   */
  readonly items = input<readonly MenuItem[]>([]);

  /**
   * The path the reader is on, so one destination is marked current.
   * Controlled — a routed host writes `[activeRoute]="router.url"`. @default ''
   */
  readonly activeRoute = input<string>('');

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Where the bar sits. @default 'fixed' */
  readonly position = input<BottomNavPosition>('fixed');

  /**
   * Hide the bar from this breakpoint up — the desktop has a sidebar for the
   * same destinations. `null` shows it at every width. @default null
   */
  readonly hideFrom = input<BottomNavBreakpoint | null>(null);

  /** Show every label, or only the current destination's. @default 'always' */
  readonly labelVisibility = input<BottomNavLabelVisibility>('always');

  /**
   * With `position="fixed"`, render an in-flow spacer of the bar's height, so
   * the end of the page is never hidden behind it. @default true
   */
  readonly reserveSpace = input<boolean>(true);

  /** The `<nav>` landmark's accessible name. Defaults to the `navigation` label ('Main navigation'). @default '' */
  readonly ariaLabel = input<string>('');

  /** Names this bar in the navigation stream (`X-15`) when a page has several. @default null */
  readonly surfaceId = input<string | null>(null);

  /** Per-instance overrides for the package labels. @default {} */
  readonly labels = input<Partial<SvSidebarNavLabels>>({});

  // ── Events ────────────────────────────────────────────────────────────────

  /** A destination was picked (a plain click or tap; a modified click opens elsewhere and is not reported). */
  readonly itemSelected = output<BottomNavSelection>();

  // ── Derived state ─────────────────────────────────────────────────────────

  protected readonly text = computed<SvSidebarNavLabels>(() => ({ ...this.registryLabels, ...this.labels() }));

  protected readonly navName = computed(() => this.ariaLabel() || this.text().navigation);

  /** Padding that keeps the bar clear of the home indicator. */
  protected readonly safeArea = SV_SHEET_SAFE_AREA_PADDING;

  /** The index of the current destination — the longest route that matches, or -1. */
  private readonly currentIndex = computed(() => {
    const here = this.activeRoute();
    let best = -1;
    this.items().forEach((item, i) => {
      if (!svSidebarRouteActive(item.route, here)) return;
      if (best === -1 || item.route.length > this.items()[best].route.length) best = i;
    });
    return best;
  });

  protected readonly rows = computed<readonly BottomNavRow[]>(() => {
    const current = this.currentIndex();
    const onlyActive = this.labelVisibility() === 'active';
    return this.items().map((item, i) => {
      const isCurrent = i === current;
      return {
        item,
        key: svSidebarItemKey(item),
        href: this.links.href(item.route),
        current: isCurrent,
        classes: this.itemClasses(isCurrent),
        labelClasses: onlyActive && !isCurrent ? 'sr-only' : 'max-w-full truncate text-[11px] font-medium leading-4',
        badgeClasses: BADGE_TINT[item.badgeColor ?? 'danger'],
      };
    });
  });

  protected readonly hostClasses = computed(() => {
    const hide = this.hideFrom();
    const sticky = this.position() === 'sticky' ? 'sticky bottom-0 z-30' : '';
    return ['block', sticky, hide ? HIDE_FROM[hide] : ''].filter(Boolean).join(' ');
  });

  /**
   * ★ WCAG 2.4.11: a fixed bar covers the bottom of the page, so it says so —
   *   `page-bottom` reserves the band for every scroll that reveals focus. A
   *   sticky bar is inside some scroll container, whose `svRevealFocus` measures it.
   */
  protected readonly stickyEdge = computed<'page-bottom' | 'bottom' | null>(() => {
    const p = this.position();
    return p === 'fixed' ? 'page-bottom' : p === 'sticky' ? 'bottom' : null;
  });

  protected readonly barClasses = computed(() => {
    const pinned = this.position() === 'fixed' ? 'fixed inset-x-0 bottom-0 z-40' : 'relative';
    return [
      pinned,
      'border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950',
    ].join(' ');
  });

  constructor() {
    effect(() => {
      const count = this.items().length;
      if (count > MAX_ITEMS) {
        svWarnOnce(
          'sv-bottom-nav:too-many',
          `sv-bottom-nav: ${count} items — a bottom bar holds three to five destinations. ` +
            'Put the rest behind a "More" destination or in the sidebar.',
        );
      }
    });
  }

  private itemClasses(current: boolean): string {
    const base =
      'group flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 pb-1.5 pt-2 ' +
      'rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500';
    return current
      ? `${base} text-primary-700 dark:text-primary-300`
      : `${base} text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100`;
  }

  // ── Interaction ───────────────────────────────────────────────────────────

  /**
   * ★ The browser's navigation is cancelled exactly when the adapter takes it,
   *   and a modified click (new tab, new window) is never intercepted.
   */
  protected onSelect(event: MouseEvent, item: MenuItem, index: number): void {
    if (svIsModifiedClick(event)) return;
    if (!item.external && this.links.navigate(item.route)) event.preventDefault();
    this.nav.record({ intent: 'jump', key: item.route, label: item.label });
    this.itemSelected.emit({ item, index });
  }
}
