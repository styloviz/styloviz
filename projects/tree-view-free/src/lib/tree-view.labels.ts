/**
 * The accessible names and visible text `sv-tree-view` renders, in English. Override any of
 * them with `provideSvLabels({ treeView: { … } })` from `@styloviz/core`.
 */
export interface SvTreeViewLabels {
  readonly expandNode: string;
  readonly collapseNode: string;
  readonly errorTitle: string;
  readonly emptyText: string;
  /** The `org` layout's scroll region, when `ariaLabel` does not name it. */
  readonly orgChart: string;
}

export const SV_TREE_VIEW_LABELS: SvTreeViewLabels = {
  expandNode: 'Expand {name}',
  collapseNode: 'Collapse {name}',
  errorTitle: 'Could not load this tree',
  emptyText: 'No items to display',
  orgChart: 'Org chart',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    treeView: SvTreeViewLabels;
  }
}
