/**
 * Notification Center — type definitions
 *
 * Six variants cover the most common global-market notification UI patterns:
 *   'dropdown'   – Bell trigger → floating panel with tabs & search (default)
 *   'drawer'     – Bell trigger → full-height right-side slide-in panel
 *   'inline'     – Panel embedded directly in the page (dedicated route)
 *   'feed'       – Activity-feed: actor + verb + target (GitHub/Jira style)
 *   'compact'    – Bell trigger → minimal slim list, no tabs/search
 *   'grouped'    – Bell trigger → dropdown with sticky date-group headers
 */
export type NotificationCenterVariant =
  | 'dropdown'
  | 'inline';

/** Semantic category — drives the icon and colour of the type badge. */
export type NotificationType =
  | 'comment'
  | 'mention'
  | 'assignment'
  | 'status'
  | 'invite'
  | 'approval'
  | 'deadline'
  | 'payment'
  | 'security'
  | 'update'
  | 'reaction'
  | 'system';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface NotificationAction {
  readonly id:       string;
  readonly label:    string;
  /** @default 'secondary' */
  readonly variant?: 'primary' | 'secondary' | 'danger';
}

export interface NotificationActor {
  readonly id:      string;
  readonly name:    string;
  readonly avatar?: string;
  readonly color?:  string;
}

export interface NotificationTarget {
  readonly label: string;
  readonly href?:  string;
}

export interface NotificationItem {
  readonly id:         string;
  readonly type:       NotificationType;
  readonly title:      string;
  readonly body?:      string;
  readonly priority?:  NotificationPriority;
  readonly timestamp:  string;
  read:                boolean;
  readonly actor?:     NotificationActor;
  readonly target?:    NotificationTarget;
  readonly actions?:   NotificationAction[];
  readonly category?:  string;
  readonly pinned?:    boolean;

  /**
   * The user can no longer see the record this notification is about
   * (`OF-10-I8`).
   *
   * ★★★ THE TITLE IS THE LEAK. "Dana commented on Q3 layoffs" is a sentence
   *     about a document, and a notification inbox keeps it long after the
   *     document's permissions change — so the row outlives the access it was
   *     created under. Set this when the host learns the user lost access:
   *     the row keeps its type, time and read state, and renders
   *     `redactedLabel` in place of its title, body, actor, target and
   *     actions.
   *
   * ★★ THE ROW IS NOT REMOVED, deliberately. Its EXISTENCE is not the secret
   *    — the user was told about it already, and an inbox that silently loses
   *    rows leaves them hunting for something they remember reading. What has
   *    to go is the content.
   *
   * ⚠️ A CLIENT-SIDE REDACTION IS NOT AUTHORIZATION: the title must not be
   *    SENT to a user who may not see it. This is the second line of defence
   *    for a feed the host cannot re-fetch in time, not the first.
   */
  readonly redacted?:  boolean;

  /**
   * Monotonic revision of THIS notification (`X-12`, `OF-10-M1`).
   *
   * ★★★ WITHOUT IT A STALE UPDATE CANNOT BE DETECTED AT ALL. Two sockets, a
   *     retry, or a replay after a reconnect deliver an older copy of a row
   *     after a newer one, and the row silently goes backwards in time —
   *     "assigned to Dana" reverts to "unassigned" and nothing is wrong on
   *     screen. Merge incoming notifications with `svMergeRecords` from
   *     `@styloviz/core` and a lower revision is refused and reported.
   */
  readonly version?:   number;
  /**
   * Monotonic position in the notification STREAM (`OF-10-I5`).
   *
   * ★★ A DIFFERENT AXIS FROM `version`, and both are needed: `version` orders
   *    a row against its own past, `seq` orders rows against each other when
   *    timestamps tie or the clocks disagree — which they do, because
   *    `timestamp` is a string somebody's server rendered.
   *
   * ★ Used for ordering only when EVERY notification has one. A half-sequenced
   *   list has no sequence, and mixing the two rules per pair makes an
   *   intransitive comparator whose sort result depends on the array's
   *   starting arrangement.
   */
  readonly seq?:       number;
  /**
   * Two notifications with the same key are one EVENT and collapse into one
   *  row (`OF-10-I3`, `OF-10-M4`).
   *
   * ★ Different from `id`, which is the same RECORD. Three comments on one
   *   ticket are three records and, in a notification list, one line.
   */
  readonly dedupeKey?: string;
}

export interface NotificationClickEvent {
  readonly notification: NotificationItem;
  /**
   * Undo the optimistic mark-as-read that opening the notification performed. Undoes this write only — later writes stand — and does nothing once the host has confirmed it.
   */
  readonly rollback: () => void;
  /**
   * Other rows this write applied to: the unread rows collapsed into this one
   * by a shared `dedupeKey` (`OF-10-M4`), now marked read with it. Absent
   * when there were none. The server has to update these as well, or they
   * come back on the next fetch.
   */
  readonly collapsedIds?: readonly string[];
}

export interface NotificationActionClickEvent {
  readonly notification: NotificationItem;
  readonly actionId:     string;
}

export interface NotificationDismissEvent {
  readonly notification: NotificationItem;
  /**
   * Undo the optimistic dismissal — the notification returns to the list in its original position. Undoes this write only — later writes stand — and does nothing once the host has confirmed it.
   */
  readonly rollback: () => void;
  /**
   * Other rows this dismissal removed: every row collapsed into this one by a
   * shared `dedupeKey` (`OF-10-M4`), read or not — dismissing the survivor
   * alone would promote the next one into its place. Absent when there were
   * none. The server has to dismiss these as well, or they come back on the
   * next fetch.
   */
  readonly collapsedIds?: readonly string[];
}
// ─── Server-backed notification centre ────────────────────────────────────────

/**
 * What the user is asking to see. Emitted debounced, so a host has one handler
 * to write whether they typed, switched tab, or both.
 */
export interface NotificationQuery {
  /** The selected tab label, exactly as supplied in `tabs`. */
  readonly tab: string;
  /** The search box contents, trimmed. `''` when not searching. */
  readonly search: string;
}

/** Asking for the next page of an unbounded notification list. */
export interface NotificationLoadMoreEvent {
  /** Notifications already rendered — the offset to fetch from. */
  readonly loaded: number;
  /** The query the next page should honour. */
  readonly query: NotificationQuery;
}

/** Marking everything read, with a way to put it back. */
export interface NotificationMarkAllReadEvent {
  /** Ids that were unread before the click — what the server must update. */
  readonly unreadIds: readonly string[];
  /**
   * Undo the optimistic mark-all-read. Call when the request fails.
   * Undoes this write only — later writes stand — and does nothing once the host has confirmed it.
   */
  readonly rollback: () => void;
}
