import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SvSidebarComponent } from '../sidebar/sidebar.component';
import { SvTopbarComponent } from '../topbar/topbar.component';
import { SvFooterComponent } from '../footer/footer.component';
import { SvToastHostComponent } from '@styloviz/toast';

/**
 * DashboardShellComponent
 *
 * The master layout wrapper. Every dashboard page renders inside this shell.
 * It composes the sidebar, topbar, main content area, and footer.
 *
 * Layout structure:
 * ┌──────────┬────────────────────────────────┐
 * │          │  Topbar                         │
 * │ Sidebar  ├────────────────────────────────┤
 * │          │  <router-outlet> (page content) │
 * │          ├────────────────────────────────┤
 * │          │  Footer                         │
 * └──────────┴────────────────────────────────┘
 */
@Component({
  selector: 'sv-dashboard-shell',
  standalone: true,
  imports: [RouterOutlet, SvSidebarComponent, SvTopbarComponent, SvFooterComponent, SvToastHostComponent],
  templateUrl: './dashboard-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvDashboardShellComponent {
  /**
   * Demo user displayed in the topbar. In a real app this comes from an auth
   * service.
   *
   * `avatar` is deliberately EMPTY. This is a published package: a default that
   * hot-links an avatar CDN means every buyer's dashboard makes a third-party
   * request they did not ask for and cannot clear under a CSP — and a local
   * `/demo/…` path would be just as wrong, since their app does not serve it.
   * With no src, `sv-avatar` renders the initials from `name`, which is the
   * right thing to show for a user whose picture you do not have.
   */
  readonly currentUser = { name: 'Alex Johnson', email: 'alex@example.com', avatar: '' };

  /**
   * Controls whether the sidebar is collapsed (icons only) or expanded.
   * Signal makes this reactive — topbar toggle button and sidebar both stay in sync.
   */
  sidebarCollapsed = signal<boolean>(false);

  /**
   * Controls mobile sidebar visibility.
   * On mobile, the sidebar is hidden by default and slides in as an overlay.
   */
  mobileSidebarOpen = signal<boolean>(false);

  /**
   * Toggle sidebar between collapsed and expanded states (desktop).
   */
  toggleSidebar(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  /**
   * Toggle mobile sidebar overlay.
   */
  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((open) => !open);
  }

  /**
   * Close mobile sidebar (e.g., after navigation or backdrop click).
   */
  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }
}