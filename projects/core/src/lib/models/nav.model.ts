/**
 * Navigation models — shared types for sidebar and topbar components.
 */

/** A single leaf item inside a child-navigation group. */
export interface NavChild {
  readonly id:    string;
  readonly label: string;
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
}

export interface MenuGroup {
  /** Group heading displayed above the menu items */
  readonly groupLabel: string;

  /** Menu items within this group */
  readonly items: MenuItem[];
}
