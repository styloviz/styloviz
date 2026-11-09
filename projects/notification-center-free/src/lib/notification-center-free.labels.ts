/**
 * The accessible names and visible text `sv-notification-center` renders, in English. Override any of
 * them with `provideSvLabels({ notificationCenter: { … } })` from `@styloviz/core`.
 */
export interface SvNotificationCenterLabels {
  readonly openNotifications: string;
  readonly closePanel: string;
  readonly dismissNotification: string;
  /** `panelTitle`'s default. */
  readonly panelTitle: string;
  /** `redactedLabel`'s default: what a redacted row shows instead of its title. */
  readonly redacted: string;
  readonly markAllRead: string;
  readonly searchPlaceholder: string;
  readonly loadMore: string;
  /** The skeletons' accessible names while the list, or its next page, loads. */
  readonly loading: string;
  readonly loadingMore: string;
  /** The unread badge in the panel header. `{count}`. */
  readonly unreadNew: string;
  /** The footer count. `{count}`, plural. */
  readonly notificationCount: string;
  readonly viewAll: string;
  /** A failed row action's retry button. */
  readonly tryAgain: string;
  readonly errorTitle: string;
  /** The empty state, when a search or tab hides everything vs. when there is nothing. */
  readonly emptyFilteredTitle: string;
  readonly emptyTitle: string;
  readonly emptyFilteredMessage: string;
  readonly emptyMessage: string;
  readonly clearFilters: string;
  /** Display text of the built-in filter tabs (the `tabs` input holds their keys). */
  readonly tabAll: string;
  readonly tabUnread: string;
  readonly tabMentions: string;
  readonly tabSystem: string;
  /** A row's relative time. `{count}` in the `*Ago` ones. */
  readonly timeJustNow: string;
  readonly timeMinutesAgo: string;
  readonly timeHoursAgo: string;
  readonly timeDaysAgo: string;
  /** Date-group headings. */
  readonly groupToday: string;
  readonly groupYesterday: string;
  readonly groupThisWeek: string;
  readonly groupEarlierThisMonth: string;
  readonly groupOlder: string;
}

export const SV_NOTIFICATION_CENTER_LABELS: SvNotificationCenterLabels = {
  openNotifications: 'Open notifications',
  closePanel: 'Close',
  dismissNotification: 'Dismiss notification',
  panelTitle: 'Notifications',
  redacted: 'This notification is no longer available',
  markAllRead: 'Mark all read',
  searchPlaceholder: 'Search notifications…',
  loadMore: 'Load more',
  loading: 'Loading notifications',
  loadingMore: 'Loading more notifications',
  unreadNew: '{count} new',
  notificationCount: '{count, plural, one {# notification} other {# notifications}}',
  viewAll: 'View all',
  tryAgain: 'Try again',
  errorTitle: 'Could not load notifications',
  emptyFilteredTitle: 'No matching notifications',
  emptyTitle: 'You are all caught up',
  emptyFilteredMessage: 'Try a different search or tab.',
  emptyMessage: 'New notifications will appear here.',
  clearFilters: 'Clear filters',
  tabAll: 'All',
  tabUnread: 'Unread',
  tabMentions: 'Mentions',
  tabSystem: 'System',
  timeJustNow: 'just now',
  timeMinutesAgo: '{count}m ago',
  timeHoursAgo: '{count}h ago',
  timeDaysAgo: '{count}d ago',
  groupToday: 'Today',
  groupYesterday: 'Yesterday',
  groupThisWeek: 'This week',
  groupEarlierThisMonth: 'Earlier this month',
  groupOlder: 'Older',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    notificationCenter: SvNotificationCenterLabels;
  }
}
