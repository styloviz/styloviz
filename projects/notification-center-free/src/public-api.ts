export { SvNotificationCenterComponent } from './lib/notification-center.component';
export {
  NotificationCenterVariant,
  NotificationType,
  NotificationPriority,
  NotificationAction,
  NotificationItem,
  NotificationClickEvent,
  NotificationActionClickEvent,
  NotificationDismissEvent,
  NotificationQuery,
  NotificationLoadMoreEvent,
  NotificationCursor,
  NotificationMarkAllReadEvent,
} from './lib/notification-center.types';
export { SV_NOTIFICATION_CENTER_LABELS } from './lib/notification-center-free.labels';
export type { SvNotificationCenterLabels } from './lib/notification-center-free.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/notification-center-free.labels.packs';
