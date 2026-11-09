import { InjectionToken, type Signal } from '@angular/core';

/**
 * The state `sv-dashboard-shell` shares with the `sv-sidebar` and `sv-topbar`
 * projected into it, so neither needs a binding to stay in step: the topbar's
 * toggles drive the shell, and the sidebar reads it.
 *
 * Provided by `SvDashboardShellComponent`; a sidebar or topbar used without a
 * shell falls back to its own inputs. Inject it to build a custom shell part.
 */
export interface SvShellContext {
  /** Desktop: the sidebar is collapsed to its icon rail. */
  readonly collapsed: Signal<boolean>;
  /** Small screens: the sidebar is open as an overlay. */
  readonly mobileOpen: Signal<boolean>;
  /** The shell fills its container rather than the viewport, so its parts position against it. */
  readonly contained: Signal<boolean>;
  toggleCollapsed(): void;
  toggleMobile(): void;
  closeMobile(): void;
}

export const SV_SHELL_CONTEXT = new InjectionToken<SvShellContext>('SV_SHELL_CONTEXT');
