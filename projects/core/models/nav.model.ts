/**
 * Navigation models — shared types for sidebar and topbar components.
 */

/** A single leaf item inside a child-navigation group. */
export interface NavChild {
  readonly id:    string;
  readonly label: string;
  /** A third level under this sub-item (`SR-30b`). */
  readonly children?: NavChild[];
}

/** A named group of leaf items used for sidebar sub-navigation. */
export interface NavChildGroup {
  readonly label: string;
  readonly items: NavChild[];
}

export interface MenuItem {
  /** Display label shown in the sidebar */
  readonly label: string;

  /** Angular router path (e.g., '/analytics') */
  readonly route: string;

  /** SVG icon path (`d` attribute) */
  readonly icon: string;

  /** Optional badge text shown next to the label (e.g. "New", "3") */
  readonly badge?: string;

  /** Badge color variant */
  readonly badgeColor?: 'primary' | 'accent' | 'warning' | 'danger';

  /** Optional sub-navigation groups rendered below this item when active */
  readonly childGroups?: NavChildGroup[];

  /** Stable key for `expandedIds`; the route is used when absent. */
  readonly id?: string;

  /** A small status dot after the label — "something new here". */
  readonly dot?: boolean;

  /** A keyboard shortcut hint shown at the end of the row, e.g. `'G D'`. */
  readonly shortcut?: string;

  /** Opens in a new tab, with an external-link mark and a spoken hint. */
  readonly external?: boolean;
}

export interface MenuGroup {
  /** Group heading displayed above the menu items */
  readonly groupLabel: string;

  /** Menu items within this group */
  readonly items: MenuItem[];

  /** Stable key for `collapsedGroups`; the label is used when absent. */
  readonly id?: string;

  /** The heading becomes a button that folds the group away. */
  readonly collapsible?: boolean;

  /** A rule above the group, for a break with no heading. */
  readonly divider?: boolean;
}
