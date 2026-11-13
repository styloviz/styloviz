import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, contentChild, ElementRef, forwardRef, inject, input, model, viewChild } from '@angular/core';
import { svUniqueId } from '@styloviz/core/a11y';
import { injectSvLabels } from '@styloviz/core/i18n';
import { svFragmentHref } from '@styloviz/core/nav';
import { SV_LAYOUT_LABELS } from '@styloviz/layout/labels';
import { SvSidebarComponent } from '@styloviz/layout/sidebar';
import { SV_SHELL_CONTEXT, type SvShellContext } from '@styloviz/layout/sidebar';

/**
 * SvDashboardShellComponent — the app shell's frame.
 *
 * ┌──────────┬────────────────────────────────┐
 * │          │  [svShellTopbar]                │
 * │ [svShell ├────────────────────────────────┤
 * │ Sidebar] │  default slot (your page)       │
 * │          ├────────────────────────────────┤
 * │          │  [svShellFooter]                │
 * └──────────┴────────────────────────────────┘
 *
 * Owns the two pieces of state the parts share — `collapsed` (desktop icon
 * rail) and `mobileOpen` (small-screen overlay) — and hands them to a
 * projected `sv-sidebar` and `sv-topbar` through `SV_SHELL_CONTEXT`, so the
 * usual shell needs no bindings at all. Both are models: bind them to persist
 * the collapsed state or to open the overlay from elsewhere.
 *
 * The default slot is the scrolling content area — put your
 * `<router-outlet />` there. Escape or the backdrop closes the overlay.
 *
 * By default the shell is the viewport (`h-dvh`, a `fixed` sidebar). Set
 * `contained` to embed it — in a panel, a preview frame, a docs page: it then
 * fills its container's height and the sidebar and backdrop position against
 * the shell. Breakpoints stay the viewport's.
 *
 * Skip link (WCAG 2.4.1, FL-J3-LU-03): the shell's first focusable element is
 * a "Skip to main content" link, hidden until focused, that moves focus to the
 * page region (`<main tabindex="-1">`). On by default; `skipLink` turns it off
 * for a page that already ships its own, `skipLinkLabel` renames it.
 *
 * 2.0 (FL-A6a): the shell no longer renders the Styloviz topbar, sidebar,
 * footer, router outlet and six toast hosts itself — see the CHANGELOG.
 */
@Component({
  selector: 'sv-dashboard-shell',
  standalone: true,
  templateUrl: './dashboard-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: SV_SHELL_CONTEXT, useExisting: forwardRef(() => SvDashboardShellComponent) }],
  host: {
    class: 'block',
    '[class.h-full]': 'contained()', // sv-i18n-ignore: host binding key
    '(document:keydown.escape)': 'closeMobile()', // sv-i18n-ignore: host listener key
  },
})
export class SvDashboardShellComponent implements SvShellContext {
  /** Desktop: the sidebar is collapsed to its icon rail. Two-way. @default false */
  readonly collapsed = model<boolean>(false);

  /** Small screens: the sidebar is open as an overlay. Two-way. @default false */
  readonly mobileOpen = model<boolean>(false);

  /** Fill the container instead of the viewport, for a shell embedded in a page. @default false */
  readonly contained = input<boolean>(false);

  /** @internal Visible text — English unless `provideSvLabels({ layout })` says otherwise. */
  protected readonly labels = injectSvLabels('layout', SV_LAYOUT_LABELS);

  /**
   * Render the "Skip to main content" link (WCAG 2.4.1 Bypass Blocks) as the
   * shell's first focusable element. Turn it off only when the page already
   * renders its own skip link — two would be one too many.
   * @default true
   */
  readonly skipLink = input<boolean>(true);

  /** Text of the skip link. @default 'Skip to main content' */
  readonly skipLinkLabel = input<string>(this.labels.skipToMainContent);

  /** The page region's id — the skip link's target. SSR-stable (`svUniqueId`). */
  readonly mainId = svUniqueId('sv-shell-main');

  /**
   * The skip link's href: the page path + `#id`, so it still lands on `<main>`
   * without JavaScript — a bare `#id` resolves against `<base href="/">`.
   */
  protected readonly mainHref = svFragmentHref(inject(DOCUMENT), this.mainId);

  private readonly main = viewChild<ElementRef<HTMLElement>>('main');

  /** @internal Offsets the content only when a sidebar is projected. */
  protected readonly sidebar = contentChild(SvSidebarComponent);

  /** Toggle the desktop icon rail. */
  toggleCollapsed(): void {
    this.collapsed.update((collapsed) => !collapsed);
  }

  /** Toggle the small-screen overlay. */
  toggleMobile(): void {
    this.mobileOpen.update((open) => !open);
  }

  /**
   * Move focus to the page region — what the skip link does. Public so a host
   * can wire its own "skip" affordance (a keyboard shortcut) to the same target.
   */
  focusMain(): void {
    this.main()?.nativeElement.focus();
  }

  /** @internal The skip link: focus `<main>` rather than following `#id`. */
  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.focusMain();
  }

  /** Close the small-screen overlay. */
  closeMobile(): void {
    if (this.mobileOpen()) this.mobileOpen.set(false);
  }
}
