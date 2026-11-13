import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { SV_SHELL_CONTEXT } from './shell-context';
import { injectSvLabels } from '@styloviz/core/i18n';
import { SV_LAYOUT_LABELS } from '@styloviz/layout/labels';

/**
 * SvSidebarComponent — the app shell's collapsible side panel.
 *
 * A container, not a menu: project a brand into `[svSidebarBrand]`, the
 * navigation into the default slot (`sv-sidebar-nav` from
 * `@styloviz/sidebar-nav` is the tree built for it) and anything pinned to the
 * bottom into `[svSidebarFooter]`. It imports no router, so it works with any
 * navigation model.
 *
 * Three states: expanded (`w-64`), collapsed to an icon rail (`w-20`, from
 * `lg` up), and an overlay that slides in on small screens. Inside
 * `sv-dashboard-shell` all three follow the shell; on its own it follows
 * `collapsed` / `mobileOpen`. Activating a link inside it closes the overlay.
 *
 * 2.0: the Styloviz site's own brand, routed menu and resource links moved out
 * of this component (FL-A6a) — see the CHANGELOG for the migration.
 */
@Component({
  selector: 'sv-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Delegated, not an interaction of its own: a link's keyboard activation
  // fires `click` too, so this covers Enter as well as the pointer.
  host: { '(click)': 'onClick($event)', '(document:keydown.escape)': 'onEscape()' }, // sv-i18n-ignore: host listener key
})
export class SvSidebarComponent {
  protected readonly labels = injectSvLabels('layout', SV_LAYOUT_LABELS);

  private readonly shell = inject(SV_SHELL_CONTEXT, { optional: true });

  /** Collapsed to the icon rail (desktop). Ignored inside `sv-dashboard-shell`, which owns it. @default false */
  readonly collapsed = input<boolean>(false);

  /** Open as an overlay (small screens). Ignored inside `sv-dashboard-shell`, which owns it. @default false */
  readonly mobileOpen = input<boolean>(false);

  /** Accessible name of the panel. @default 'Main navigation' */
  readonly label = input<string>(this.labels.sidebar);

  /** Emits when the overlay should close: a link inside it was activated, or Escape was pressed. */
  readonly mobileClose = output<void>();

  /** @internal The collapsed state in force — the shell's, or the input's. */
  readonly isCollapsed = computed(() => this.shell?.collapsed() ?? this.collapsed());

  /** @internal Inside a `contained` shell the panel positions against the shell, not the viewport. */
  readonly isContained = computed(() => this.shell?.contained() ?? false);

  /** @internal The overlay state in force — the shell's, or the input's. */
  readonly isMobileOpen = computed(() => this.shell?.mobileOpen() ?? this.mobileOpen());

  /**
   * @internal Escape closes the open overlay. Inside `sv-dashboard-shell` the
   * shell does that; on its own the panel did nothing (FL-L4-07).
   */
  onEscape(): void {
    if (this.shell || !this.mobileOpen()) return;
    this.mobileClose.emit();
  }

  /** @internal Closes the overlay when a link inside the panel is activated. */
  onClick(event: MouseEvent): void {
    if (!(event.target instanceof Element) || !event.target.closest('a[href]')) return;
    this.shell?.closeMobile();
    this.mobileClose.emit();
  }
}
