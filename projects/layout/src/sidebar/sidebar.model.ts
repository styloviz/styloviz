/**
 * Sidebar data models.
 *
 * These interfaces define the shape of navigation menu data.
 * The sidebar component expects data in this format.
 */

/** A single leaf item inside a child-navigation group. */
export interface NavChild {
  id: string;
  label: string;
}

/** A named group of leaf items used for sidebar sub-navigation. */
export interface NavChildGroup {
  label: string;
  items: NavChild[];
}

export interface MenuItem {
  /** Display label shown in the sidebar */
  label: string;

  /** Angular router path (e.g., '/analytics') */
  route: string;

  /**
   * Name of an icon in `@styloviz/icons`, e.g. `'rocket'`.
   *
   * The component used to translate a small fixed set of keys through a
   * private map of seven hand-copied Heroicons paths — so a consumer could
   * only use those seven, and the doc comment still claimed the kit avoided an
   * icon library "to keep the kit dependency-free" long after this package
   * took one. The name now goes straight to `<sv-icon>`, so ANY free glyph
   * works.
   */
  icon: string;

  /** Optional badge text shown next to the label (e.g., "New", "3") */
  badge?: string;

  /** Badge color variant */
  badgeColor?: 'primary' | 'accent' | 'warning' | 'danger';

  /** Optional sub-navigation groups rendered below this item when active */
  childGroups?: NavChildGroup[];
}

export interface MenuGroup {
  /** Group heading displayed above the menu items */
  groupLabel: string;

  /** Menu items within this group */
  items: MenuItem[];
}