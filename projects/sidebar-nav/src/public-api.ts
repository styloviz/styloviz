export { SvSidebarNavComponent } from './lib/sidebar-nav.component';
export { SvBottomNavComponent } from './lib/bottom-nav.component';
export type {
  BottomNavBreakpoint,
  BottomNavLabelVisibility,
  BottomNavPosition,
  BottomNavSelection,
} from './lib/bottom-nav.component';
export { SvSidebarNavItemEndDirective } from './lib/sidebar-nav.templates';
export type { SvSidebarNavItemEndContext } from './lib/sidebar-nav.templates';

/**
 * ★ The MODEL is exported, not just the component — `docs/navigation-catalog-adr.md`
 *   asks for "one model with three renderers", and what makes `N-2` (Bottom
 *   Navigation) and `N-3` (Navigation Rail) cheap is that the data shape and
 *   the active-matching rule are here rather than private to a sidebar.
 */
export {
  SV_SIDEBAR_NAV_LABELS,
  svSidebarActiveItem,
  svSidebarGroupKey,
  svSidebarItemKey,
  svSidebarRouteActive,
  svNavChildHolds,
} from './lib/sidebar-nav.model';
export type {
  MenuGroup,
  MenuItem,
  NavChild,
  NavChildGroup,
  SidebarNavSelection,
  SvSidebarNavLabels,
} from './lib/sidebar-nav.model';
export type {
  SidebarNavActiveStyle,
  SidebarNavBadgeVariant,
  SidebarNavDensity,
  SidebarNavDrawerMode,
  SidebarNavExpandMode,
  SidebarNavScrollFade,
} from './lib/sidebar-nav.component';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/sidebar-nav.labels.packs';
