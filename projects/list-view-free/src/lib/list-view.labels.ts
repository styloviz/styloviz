/**
 * The accessible names and visible text `sv-list-view` renders, in English. Override any of
 * them with `provideSvLabels({ listView: { … } })` from `@styloviz/core`.
 */
export interface SvListViewLabels {
  readonly checkItem: string;
  readonly selectItem: string;
  readonly expandItem: string;
  readonly collapseItem: string;
  readonly checkAllInGroup: string;
  readonly loadingList: string;
  readonly errorTitle: string;
  readonly emptyFilteredTitle: string;
  readonly emptyTitle: string;
  readonly emptyFilteredMessage: string;
  readonly clearSearch: string;
  readonly selectAll: string;
  readonly itemCount: string;
  readonly selectedCount: string;
  readonly loadingMore: string;
  readonly scrollToLoadMore: string;
  readonly endOfList: string;
  readonly checkedCount: string;
  readonly searchPlaceholder: string;
  readonly emptyMessage: string;
  readonly listName: string;
  /** Live announcement — `{title}` is the row's title. */
  readonly announceSelected: string;
  readonly announceDeselected: string;
  readonly announceChecked: string;
  readonly announceUnchecked: string;
  /** `{count}` picks the plural, `{n}` is the number shown. */
  readonly announceSelectedAll: string;
  readonly announceClearedAll: string;
  /** `{count}` picks the plural, `{n}` is the number shown; `{group}` is the section. */
  readonly announceCheckedGroup: string;
  readonly announceUncheckedGroup: string;
  /** `{action}` is the quick action's label. */
  readonly announceQuickAction: string;
  /** `{action}` is the bulk action's label; `{count}` picks the plural, `{n}` is the number shown. */
  readonly announceBulkAction: string;
  /** Infinite scroll: rows added — `{count}` picks the plural, `{n}` is the number shown. */
  readonly announceLoadedMore: string;
  /** Infinite scroll reached the end — `{count}`, `{n}`. */
  readonly announceEndOfList: string;
  /** FL-F8 swipe actions — the row's Actions button and strip (`{title}` is the row's title), and the strip's close button. */
  readonly swipeActionsFor: string;
  readonly closeSwipeActions: string;
  /** A call-history row's direction, for screen readers. */
  readonly callIncoming: string;
  readonly callOutgoing: string;
  readonly callVideo: string;
  readonly callMissed: string;
  readonly callUnknown: string;
}

export const SV_LIST_VIEW_LABELS: SvListViewLabels = {
  checkItem: 'Check {title}',
  selectItem: 'Select {title}',
  expandItem: 'Expand {title}',
  collapseItem: 'Collapse {title}',
  checkAllInGroup: 'Check all items in {group}',
  loadingList: 'Loading list',
  errorTitle: 'Could not load this list',
  emptyFilteredTitle: 'No matching items',
  emptyTitle: 'Nothing here yet',
  emptyFilteredMessage: 'Try a different search term.',
  clearSearch: 'Clear search',
  selectAll: 'Select all',
  itemCount: '{count, plural, one {# item} other {# items}}',
  selectedCount: '{count} selected',
  loadingMore: 'Loading more items...',
  scrollToLoadMore: 'Scroll to load more',
  endOfList: 'End of list · all {count, plural, one {# item} other {# items}} loaded',
  checkedCount: '{count} checked',
  searchPlaceholder: 'Search list items',
  emptyMessage: 'No items match your filters.',
  listName: 'List view',
  announceSelected: 'Selected {title}.',
  announceDeselected: 'Deselected {title}.',
  announceChecked: 'Checked {title}.',
  announceUnchecked: 'Unchecked {title}.',
  announceSelectedAll: 'Selected all {count, plural, one {{n} visible item} other {{n} visible items}}.',
  announceClearedAll: 'Cleared all selected items.',
  announceCheckedGroup: 'Checked {count, plural, one {the {n} item} other {all {n} items}} in {group}.',
  announceUncheckedGroup: 'Unchecked all items in {group}.',
  announceQuickAction: '{action} action triggered for {title}.',
  announceBulkAction: '{action} applied to {count, plural, one {{n} selected item} other {{n} selected items}}.',
  announceLoadedMore: 'Loaded {count, plural, one {{n} more item} other {{n} more items}}.',
  announceEndOfList: 'End of list. {count, plural, one {The {n} item} other {All {n} items}} loaded.',
  swipeActionsFor: 'Actions for {title}',
  closeSwipeActions: 'Close actions',
  callIncoming: 'Incoming call',
  callOutgoing: 'Outgoing call',
  callVideo: 'Video call',
  callMissed: 'Missed call',
  callUnknown: 'Call',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    listView: SvListViewLabels;
  }
}
