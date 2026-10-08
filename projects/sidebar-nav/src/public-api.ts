export { SvSidebarNavComponent } from './lib/sidebar-nav.component';

/**
 * ★ The MODEL is exported, not just the component — `docs/navigation-catalog-adr.md`
 *   asks for "one model with three renderers", and what makes `N-2` (Bottom
 *   Navigation) and `N-3` (Navigation Rail) cheap is that the data shape and
 *   the active-matching rule are here rather than private to a sidebar.
 */
export { svSidebarActiveItem, svSidebarRouteActive } from './lib/sidebar-nav.model';
export type {
  MenuGroup,
  MenuItem,
  NavChild,
  NavChildGroup,
  SidebarNavSelection,
} from './lib/sidebar-nav.model';
