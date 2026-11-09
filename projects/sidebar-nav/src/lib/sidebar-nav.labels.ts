/*
 * Override any label app-wide with `provideSvLabels({ sidebarNav: { … } })`
 * from `@styloviz/core`, or per instance with `[labels]`.
 */
/** Every string the sidebar renders. `{label}` is replaced by the item's label. */
export interface SvSidebarNavLabels {
  readonly close: string;
  readonly expand: string;
  readonly collapse: string;
  /** The visible text on the collapse button. */
  readonly collapseText: string;
  /** A sub-page toggle's accessible name. */
  readonly toggleChildren: string;
  /** Read after an external link's label. */
  readonly external: string;
  /** The `<nav>` landmark's accessible name (`ariaLabel` defaults to it). */
  readonly navigation: string;
  /** `sv-bottom-nav`: read after a destination's label when it carries a `dot`. */
  readonly newActivity: string;
}

export const SV_SIDEBAR_NAV_LABELS: SvSidebarNavLabels = {
  close: 'Close navigation',
  expand: 'Expand navigation',
  collapse: 'Collapse navigation',
  collapseText: 'Collapse',
  toggleChildren: '{label} sub-pages',
  external: '(opens in a new tab)',
  navigation: 'Main navigation',
  newActivity: 'new activity',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    sidebarNav: SvSidebarNavLabels;
  }
}
