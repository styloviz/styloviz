import type { MenuGroup, MenuItem, NavChild } from '@styloviz/core';

/**
 * ============================================================================
 *  The navigation model — `N-1`, and the half `N-2` / `N-3` will share
 * ============================================================================
 *
 * ★★★ THE MODEL IS THE SHARED THING, NOT THE COMPONENT. `docs/navigation-catalog-adr.md`
 *     asks for "one model with three renderers" so that `N-2` (Bottom
 *     Navigation) and `N-3` (Navigation Rail) are configurations rather than
 *     two more route-sync implementations. Putting a `renderer` input on this
 *     component with one legal value would be a worse version of that promise —
 *     an axis with nothing on it. What actually makes the other two cheap is
 *     that the **data shape and the active-matching rule** live here, exported,
 *     and neither of them is sidebar-specific.
 *
 * ⚠️ `MenuGroup` / `MenuItem` are re-exported from `@styloviz/core`, NOT
 *    redefined. `sv-sidebar` has shipped against them since the layout package
 *    existed, and a second, structurally identical interface in a second
 *    package is how two components that render the same data start disagreeing
 *    about what it means.
 */

export type { MenuGroup, MenuItem, NavChild, NavChildGroup } from '@styloviz/core';

/** What the host is told when somebody picks something. */
export interface SidebarNavSelection {
  /** The top-level item. */
  readonly item: MenuItem;
  /** The group it was rendered under. */
  readonly group: MenuGroup;
  /** The sub-item, when one was picked rather than the parent. */
  readonly child: NavChild | null;
}

/**
 * Is `route` the one the reader is on?
 *
 * ★★ PREFIX MATCHING, ON SEGMENT BOUNDARIES — and the boundary is the whole
 *    point. `routerLinkActive` with `{ exact: false }`, which is what
 *    `sv-sidebar` has always used, treats `/orders` as active for
 *    `/orders/8814`; that is right, and is why a detail page keeps its section
 *    highlighted. A naive `startsWith` also makes `/order` active for
 *    `/orders`, so a dashboard with both `/report` and `/reports` lights up the
 *    wrong row — a bug that only appears once somebody adds the second route.
 *
 * ★ Query and hash are stripped first: `/orders?page=2` is still `/orders`, and
 *   a sidebar that de-highlighted itself when the user paged a table would be
 *   answering a different question from the one it is asked.
 */
export function svSidebarRouteActive(route: string, current: string): boolean {
  if (!route || !current) return false;

  const here = current.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  const target = route.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';

  if (target === '/') return here === '/';
  if (here === target) return true;
  return here.startsWith(`${target}/`);
}

/**
 * Which top-level item, if any, the reader is inside.
 *
 * ★ The LONGEST match wins, not the first. With `/settings` and
 *   `/settings/billing` both in the menu, first-match highlights the parent and
 *   leaves the child looking unvisited — the one arrangement where a nested
 *   menu is guaranteed to be wrong.
 */
export function svSidebarActiveItem(
  groups: readonly MenuGroup[],
  current: string,
): MenuItem | null {
  let best: MenuItem | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      if (!svSidebarRouteActive(item.route, current)) continue;
      if (best === null || item.route.length > best.route.length) best = item;
    }
  }
  return best;
}
