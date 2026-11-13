import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { SvIconComponent } from '@styloviz/icons/core';
import { injectSvLabels } from '@styloviz/core/i18n';
import { ThemeService } from '@styloviz/core/services';
import { SV_SHELL_CONTEXT } from '@styloviz/layout/sidebar';
import { SV_LAYOUT_LABELS } from '@styloviz/layout/labels';

import { registerTopbarIcons } from './topbar.component.icons';
/**
 * SvTopbarComponent — the app shell's top bar.
 *
 * Leads with the sidebar toggles (a hamburger below `lg`, a collapse toggle
 * from `lg` up) and ends with a light/dark toggle; everything between is
 * yours: `[topbar-start]` (a brand or breadcrumb), `[topbar-search]` (the
 * flexible middle) and `[topbar-actions]` (buttons, a user menu).
 *
 * Inside `sv-dashboard-shell` the toggles drive the shell directly; on its own
 * it emits `toggleSidebar` / `toggleMobileSidebar` and reads `sidebarCollapsed`.
 *
 * 2.0: the Styloviz site's own links, overflow menu and "Get Pro" button moved
 * out of this component (FL-A6a) — see the CHANGELOG for the migration.
 */
@Component({
  selector: 'sv-topbar',
  standalone: true,
  imports: [SvIconComponent],
  templateUrl: './topbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvTopbarComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerTopbarIcons();

  protected readonly labels = injectSvLabels('layout', SV_LAYOUT_LABELS);

  private readonly shell = inject(SV_SHELL_CONTEXT, { optional: true });

  /** @internal Theme service — the light/dark toggle. */
  protected readonly themeService = inject(ThemeService);

  /** Whether the sidebar is collapsed, for the toggle's icon and pressed state. Ignored inside `sv-dashboard-shell`. @default false */
  readonly sidebarCollapsed = input<boolean>(false);

  /** Render the sidebar toggles. Set false for a layout without a sidebar. @default true */
  readonly showSidebarToggle = input<boolean>(true);

  /** Render the light/dark toggle. @default true */
  readonly showThemeToggle = input<boolean>(true);

  /** Accessible name of the small-screen hamburger. @default 'Open sidebar' */
  readonly openSidebarLabel = input<string>(this.labels.topbarOpenSidebar);

  /** Accessible name of the desktop toggle while the sidebar is collapsed. @default 'Expand sidebar' */
  readonly expandSidebarLabel = input<string>(this.labels.topbarExpandSidebar);

  /** Accessible name of the desktop toggle while the sidebar is expanded. @default 'Collapse sidebar' */
  readonly collapseSidebarLabel = input<string>(this.labels.topbarCollapseSidebar);

  /** Accessible name of the theme toggle in dark mode. @default 'Switch to light mode' */
  readonly lightModeLabel = input<string>(this.labels.topbarLightMode);

  /** Accessible name of the theme toggle in light mode. @default 'Switch to dark mode' */
  readonly darkModeLabel = input<string>(this.labels.topbarDarkMode);

  /** Emits when the desktop sidebar toggle is activated. */
  readonly toggleSidebar = output<void>();

  /** Emits when the small-screen hamburger is activated. */
  readonly toggleMobileSidebar = output<void>();

  /** @internal The collapsed state in force — the shell's, or the input's. */
  readonly isCollapsed = computed(() => this.shell?.collapsed() ?? this.sidebarCollapsed());

  /** @internal */
  protected onToggleSidebar(): void {
    this.shell?.toggleCollapsed();
    this.toggleSidebar.emit();
  }

  /** @internal */
  protected onToggleMobileSidebar(): void {
    this.shell?.toggleMobile();
    this.toggleMobileSidebar.emit();
  }
}
