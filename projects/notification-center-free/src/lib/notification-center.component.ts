import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  EmbeddedViewRef,
  effect,
  HostListener,
  inject,
  input,
  model,
  OnDestroy,
  output,
  PLATFORM_ID,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  createDebouncer,
  svMergeRecords,
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  SvOverlayStackService,
  type SvOverlayHandle,
  type SvDataError, SvStopPropagationDirective } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

import type {
  NotificationActionClickEvent,
  NotificationCenterVariant,
  NotificationClickEvent,
  NotificationDismissEvent,
  NotificationLoadMoreEvent,
  NotificationMarkAllReadEvent,
  NotificationItem,
  NotificationPriority,
  NotificationQuery,
  NotificationType,
} from './notification-center.types';

// ─── Icon registry ────────────────────────────────────────────────────────────

/**
 * Icon-library NAME per notification type.
 *
 * These were twelve hand-copied Heroicons paths piped through `[attr.d]` at
 * five call sites. A name resolves through the icon library, so `check:icons`
 * catches a typo and the free and Pro twins cannot drift apart in geometry.
 */
const TYPE_ICONS: Record<NotificationType, string> = {
  comment:    'message-square',
  mention:    'at-sign',
  assignment: 'clipboard-list',
  status:     'check-circle',
  invite:     'user-plus',
  approval:   'shield-check',
  deadline:   'clock',
  payment:    'credit-card',
  security:   'shield-check',
  update:     'refresh-cw',
  reaction:   'smile',
  system:     'info',
};

/**
 * ★★ STEP 700, BECAUSE EVERY ONE OF THESE FILLS IS DRAWN BEHIND `text-white`.
 *    All six call sites pair this map with white ink — two carry the actor's
 *    initials as text, four carry a glyph. At 500 the initials measured amber
 *    2.13:1, sky 2.71, primary 3.76 and violet 4.40 against white: an axe sweep
 *    of one page reported ten failing nodes and only saw those four hues,
 *    because which type renders depends on the fixture. 700 is the first step
 *    where every arm clears AA. Same fix, same reason, as `timeline`'s
 *    AVATAR_COLORS and `display-pro/comment`'s `avatarColor()`.
 *
 * ★  THE TWO NEAR-DUPLICATE HUES KEEP THEIR ONE-STEP OFFSET, so `payment` stays
 *    800 against `status`'s 700 and `security` stays 800 against `deadline`'s.
 *    green/emerald and red/rose are barely told apart at the same step, and this
 *    map only earns its keep while all 12 read as 12 — moving every arm to a
 *    flat 700 would have bought readability by spending the distinguishability
 *    that is the reason these stay literal at all.
 *
 *    `check:contrast` cannot see this: the ink is `text-white` in the template
 *    while the fill arrives from `typeColor()`, so no single element carries
 *    both halves of the pair.
 */
const TYPE_COLORS: Record<NotificationType, string> = {
  comment:    'bg-primary-700',
  mention:    'bg-violet-700',
  assignment: 'bg-sky-700',
  status:     'bg-emerald-700',
  invite:     'bg-teal-700',
  approval:   'bg-amber-700',
  deadline:   'bg-rose-700',
  payment:    'bg-green-800',
  security:   'bg-red-800',
  update:     'bg-indigo-700',
  reaction:   'bg-pink-700',
  system:     'bg-gray-700',
};

const TYPE_ACCENT: Record<NotificationType, string> = {
  comment:    'border-primary-400',
  mention:    'border-violet-400',
  assignment: 'border-sky-400',
  status:     'border-emerald-400',
  invite:     'border-teal-400',
  approval:   'border-amber-400',
  deadline:   'border-rose-400',
  payment:    'border-green-500',
  security:   'border-red-500',
  update:     'border-indigo-400',
  reaction:   'border-pink-400',
  system:     'border-gray-400',
};

const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  low:    'bg-gray-400',
  medium: 'bg-warning-400',
  high:   'bg-orange-500',
  urgent: 'bg-danger-500',
};

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)        return 'just now';
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Midnight at the start of `d`, read with LOCAL getters — the user's own day. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * The section heading a notification is filed under.
 *
 * ★ Counted in CALENDAR days in the reader's timezone, not in 24-hour windows
 * since now. The previous `Math.floor((Date.now() - then) / 86400000)` filed a
 * notification that arrived at 23:00 last night under **Today** when read at
 * 10:00 the next morning (11 elapsed hours floors to 0), and one from 20:00 two
 * days ago under **Yesterday** (38 hours floors to 1). Every heading was wrong
 * for whoever opened the panel early in the day, which is when a notification
 * inbox is actually read.
 *
 * Local getters, not `toISOString()`: the day boundary that matters is the
 * user's midnight, not UTC's.
 */
function dateLabel(iso: string): string {
  const then = new Date(iso);
  // Local midnights differ by whole days ± an hour across a DST change, so
  // round rather than floor.
  const diff = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86400000);
  // A timestamp slightly in the future (clock skew between server and client)
  // is still today's news, not "This week"'s.
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return 'This week';
  if (diff < 30) return 'Earlier this month';
  return 'Older';
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * SvNotificationCenterComponent — Premium notification inbox.
 *
 * Selector: `sv-notification-center`
 *
 * Six variants:
 *   - `dropdown`  Bell + floating panel with tabs, search & actions (default)
 *   - `drawer`    Bell + full-height right-side slide panel (Slack/Figma style)
 *   - `inline`    Embedded panel, no trigger — use on dedicated /notifications routes
 *   - `feed`      Activity-feed style list (GitHub/Jira style)
 *   - `compact`   Bell + slim dropdown, no tabs/search
 *   - `grouped`   Bell + dropdown with sticky date-group section headers
 *
 * Floating panels (dropdown, compact, grouped, drawer) are portaled to
 * document.body so they escape every overflow / transform / backdrop-filter
 * ancestor that would otherwise clip or misposition a fixed-positioned panel.
 *
 * @example
 * ```html
 * <sv-notification-center
 *   [notifications]="myNotifications"
 *   variant="dropdown"
 *   (notificationClick)="onNotifClick($event)"
 *   (markAllRead)="markAllRead()" />
 * ```
 */
@Component({
  selector: 'sv-notification-center',
  standalone: true,
  imports: [NgTemplateOutlet,
    SvIconComponent,
    SvSkeletonShellComponent,
    SvErrorShellComponent,
    SvEmptyShellComponent, SvStopPropagationDirective],
  templateUrl: './notification-center.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class SvNotificationCenterComponent implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly vcr        = inject(ViewContainerRef);

  private readonly _floatingPanelTpl = viewChild<TemplateRef<unknown>>('floatingPanel');

  private _portalContainer: HTMLElement | null         = null;
  private readonly _overlayStack = inject(SvOverlayStackService);
  /** Registration while the floating panel is mounted (`X-4`). */
  private _stack: SvOverlayHandle | null = null;
  private _portalView: EmbeddedViewRef<unknown> | null = null;

  /** Trigger element kept for scroll-tracking repositioning. */
  private _triggerEl: HTMLElement | null = null;
  private _scrollHandler: (() => void) | null = null;
  private _scrollRafId: number | null = null;

  // ── Inputs ─────────────────────────────────────────────────────────────────

  /** Presentation: dropdown, drawer, inline, feed, compact or grouped. @default 'dropdown' */
  readonly variant       = input<NotificationCenterVariant>('dropdown');
  /** The notifications to display. */
  readonly notifications = input<NotificationItem[]>([]);
  /** Max height of the scrollable list (CSS length). @default '400px' */
  readonly maxHeight     = input<string>('400px');
  /** Filter tab labels. @default ['All','Unread','Mentions','System'] */
  readonly tabs          = input<string[]>(['All', 'Unread', 'Mentions', 'System']);
  /** Panel heading text. @default 'Notifications' */
  readonly panelTitle    = input<string>('Notifications');
  /** Show the search box. @default true */
  readonly showSearch    = input<boolean>(true);
  /** Animate the bell icon on new notifications. @default true */
  readonly animateBell   = input<boolean>(true);

  /**
   * Render the panel's "View all" control.
   *
   * ★ Off by default, and that default is the fix. The control used to be
   * unconditional markup with no handler on it — a link to the notifications
   * page that went nowhere, which is worse than no link because a user who
   * presses it concludes the page is broken rather than absent. A host that has
   * somewhere to send them opts in and handles `viewAll`; a host that does not
   * never shows the control.
   *
   * @default false
   */
  readonly showViewAll = input<boolean>(false);

  // ── Async state ─────────────────────────────────────────────────────────────

  /**
   * True while notifications are being fetched. Shows a placeholder in place of
   * the list when there is nothing to show yet.
   * @default false
   */
  readonly loading = input<boolean>(false);

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an
   * `HttpErrorResponse`.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /**
   * The server's unread total for the WHOLE feed (`OF-10-I2`).
   * `null` counts the rows in hand instead. @default null
   *
   * ★★★ THE BADGE WAS GUARANTEED WRONG FOR ANY PAGED FEED, not merely
   *     "unreconciled" as the audit put it. `unreadCount` counted the rows
   *     that had been DOWNLOADED, and this component ships `hasMore` — so a
   *     user with 240 unread notifications and a first page of 20 saw a badge
   *     reading 20, and it went UP as they scrolled. Pass the number the
   *     server knows.
   *
   * ★★ IT IS RECONCILED, NOT TRUSTED BLINDLY. A total that the component
   *    simply rendered would sit still while the user marked rows read in
   *    front of it, which is the same class of bug from the other end. The
   *    component subtracts the reads it is holding OPTIMISTICALLY — rows whose
   *    local `read` is true while the `notifications` array you passed still
   *    says false — so the badge drops on the click and the subtraction
   *    disappears by itself when your updated rows arrive. Nothing is tracked
   *    across changes, so a `rollback()` needs no bookkeeping either.
   *
   * ★ Send the updated rows and the new total together. Between the two the
   *   delta is measured against rows you have not updated yet, which is a
   *   transient off-by-one in the safe direction (too low, never too high).
   */
  readonly unreadTotal = input<number | null>(null);

  /**
   * What a redacted row shows instead of its title (`OF-10-I8`).
   * @default 'This notification is no longer available'
   */
  readonly redactedLabel = input<string>('This notification is no longer available');

  /**
   * More notifications exist on the server. Renders the "Load more" control.
   * A notification feed is unbounded — without this a host has to send the
   * user's entire history to render a dropdown.
   * @default false
   */
  readonly hasMore = input<boolean>(false);

  /** True while the next page is being fetched. @default false */
  readonly loadingMore = input<boolean>(false);

  /**
   * Ids with a write in flight. Those rows dim and stop responding, so a second
   * click cannot race the first and leave `rollback()` ambiguous.
   * @default []
   */
  readonly pendingIds = input<readonly string[] | ReadonlySet<string>>([]);

  /**
   * Ids whose last write FAILED, mapped to the message to show on that row.
   *
   * ★★★ `pendingIds` HAD NO COUNTERPART, AND THAT IS `OF-10-M2`. Optimistic
   *     read/dismiss rolls back correctly (`OF-10-I1`, fixed in T0) — the row
   *     reverts, and the user is told nothing. A notification that silently
   *     un-dismissed itself looks like the click never landed, so they click
   *     again, and again, against an endpoint that is refusing.
   *
   * ★★ PER ROW, not one banner. `error` above is for the FEED — "could not
   *    load notifications" — and putting a single row's failure there says the
   *    whole list is broken. The two are different facts and the audit's own
   *    reasoning for `role="alert"` vs `role="status"` applies: scope the
   *    message to what actually failed.
   *
   * ```ts
   * this.itemErrors.set({ 'n-14': 'Could not mark as read.' });
   * ```
   *
   * @default {}
   */
  readonly itemErrors = input<Readonly<Record<string, string>> | ReadonlyMap<string, string>>({});

  /**
   * Delay before `queryChange` fires, in milliseconds. `0` emits immediately.
   * @default 300
   */
  readonly debounceMs = input<number>(300);

  /**
   * Filter and search on the server instead of in the component. Leaves the
   * supplied `notifications` untouched — the host is responsible for returning
   * only matching rows. Required for a real feed: filtering client-side can
   * only ever search the page you already downloaded.
   * @default false
   */
  readonly serverSide = input<boolean>(false);

  // ── Controllable state ──────────────────────────────────────────────────────

  /**
   * Whether the panel is open. Two-way bindable, so a host can open the centre
   * from a route or a keyboard shortcut. Ignored by the always-visible
   * `inline` and `feed` variants.
   */
  readonly open = model<boolean>(false);

  /**
   * The selected tab label. Two-way bindable, so the tab survives a reload.
   * @default 'All'
   */
  readonly activeTab = model<string>('All');

  /** The search box contents. Two-way bindable. @default '' */
  readonly search = model<string>('');

  // ── Outputs ────────────────────────────────────────────────────────────────

  /** Emitted when a notification row is clicked. */
  readonly notificationClick = output<NotificationClickEvent>();
  /** Emitted when an inline action on a notification is clicked. */
  readonly actionClick       = output<NotificationActionClickEvent>();
  /** Emitted when "mark all as read" is triggered. */
  readonly markAllRead       = output<NotificationMarkAllReadEvent>();
  /** Emitted when a notification is dismissed. */
  readonly dismiss           = output<NotificationDismissEvent>();
  /**
   * The tab or search term changed — fetch the matching notifications.
   * Debounced by `debounceMs`, and never emitted twice for the same query.
   */
  readonly queryChange       = output<NotificationQuery>();
  /** The user asked for the next page. */
  readonly loadMore          = output<NotificationLoadMoreEvent>();
  /** The host should re-run the failed load. */
  readonly retry             = output<void>();
  /**
   * The user asked for the full notifications surface — navigate there.
   * Only reachable when `showViewAll` is set; the panel closes first, because
   * leaving a floating panel open over the page it just navigated to is how a
   * dropdown ends up covering its own destination.
   */
  readonly viewAll           = output<void>();

  // ── State ──────────────────────────────────────────────────────────────────

  // The panel's own state now lives in models, so a host can read, restore and
  // deep-link it. These aliases keep the existing template bindings working.
  readonly _open       = this.open;
  readonly _activeTab  = this.activeTab;
  readonly _search     = this.search;
  readonly _items      = signal<NotificationItem[]>([]);

  /**
   * Optimistic writes the host has not confirmed yet, keyed by write
   * (`OF-10-I1`). Each holds the ids it still applies to.
   *
   * ★★★ AN OVERLAY, NOT A SNAPSHOT, BECAUSE THE HOST'S LIST KEEPS MOVING.
   *     The local list used to be a copy of `notifications` with the change
   *     written into it, so any host push — a realtime arrival about a
   *     different row — replaced the copy and threw the change away: a row the
   *     user had just opened flicked back to unread until the server answered.
   *     And `rollback()` restored a snapshot, which after a push either erased
   *     the pushed rows or had to give up. Now the local list is always
   *     `notifications` with the pending writes laid over it, so a push keeps
   *     them and a rollback removes ONE write and nothing else.
   *
   * ★★ AN ENTRY ENDS IN ONE OF THREE WAYS: the host's list confirms it (the
   *    row arrives read; a dismissed row stops arriving), the row disappears
   *    from the host's list (nothing left to overlay), or its `rollback()` is
   *    called. Confirmation is per id, so a mark-all-read the host confirms in
   *    pages drains a page at a time.
   */
  private readonly _optimistic = new Map<number, { readonly kind: 'read' | 'dismiss'; readonly ids: Set<string> }>();
  private _writeSeq = 0;

  /** Debounced search term — what `queryChange` is built from. */
  private readonly _debouncedSearch = createDebouncer('', {
    delayMs: this.debounceMs,
    destroyRef: inject(DestroyRef),
  });

  /** `pendingIds` normalized to a Set. */
  private readonly _pending = computed<ReadonlySet<string>>(() => {
    const ids = this.pendingIds();
    return ids instanceof Set ? ids : new Set(ids as readonly string[]);
  });

  /** Whether this notification has a write in flight. */
  isPending(item: NotificationItem): boolean {
    return this._pending().has(item.id);
  }

  /** `itemErrors` normalized to a Map, so either shape can be bound. */
  private readonly _itemErrors = computed<ReadonlyMap<string, string>>(() => {
    const errors = this.itemErrors();
    return errors instanceof Map
      ? errors
      : new Map(Object.entries(errors as Readonly<Record<string, string>>));
  });

  /** The message for this row's failed write, or `null`. */
  errorFor(item: NotificationItem): string | null {
    return this._itemErrors().get(item.id) ?? null;
  }

  /**
   * Classes that make a row's async state VISIBLE.
   *
   * ★★★ `pendingIds` WAS BEHAVIOUR-ONLY, AND ITS OWN DOCSTRING SAID
   *     OTHERWISE: "those rows dim and stop responding". The handlers did
   *     refuse — `isPending` guarded every one of them — but `isPending` was
   *     never referenced in the template, so nothing dimmed and nothing said
   *     the click had landed. A row that refuses input and looks unchanged is
   *     indistinguishable from a dead row, which is the same defect as
   *     `OF-06-I7` one component over.
   */
  rowStateClass(item: NotificationItem): string {
    return this.isPending(item) ? 'opacity-60 pointer-events-none' : '';
  }

  /** The row's "Try again" was pressed. */
  readonly retryItem = output<NotificationItem>();

  /**
   * Re-run the failed write for this row.
   *
   * ★ No `stopPropagation` here: the block this button sits in carries
   *   `svStopPropagation`, which the row's action buttons already use for the
   *   same reason. Doing it in both places looked prudent and was not — a
   *   mutation removing the directive stayed green, because the handler was
   *   covering for it while leaving the MESSAGE TEXT beside the button still
   *   falling through to the row's overlay button.
   */
  onRetryItem(item: NotificationItem): void {
    // ★ A pending row has a write in flight; retrying it would be the double
    //   submit `pendingIds` exists to prevent.
    if (this.isPending(item)) return;
    this.retryItem.emit(item);
  }

  /**
   * Whether a search term or a non-default tab is narrowing the list — which
   * decides whether an empty list means "nothing here" or "nothing matching".
   */
  readonly isFiltered = computed(() => {
    const tabs = this.tabs();
    return this.search().trim().length > 0 || this.activeTab() !== (tabs[0] ?? 'All');
  });

  /** Reset the search and return to the first tab. */
  clearFilters(): void {
    this.search.set('');
    this.activeTab.set(this.tabs()[0] ?? 'All');
  }
  readonly _panelStyle = signal<{
    top?: string;
    bottom?: string;
    right: string;
    maxH?: string;
  }>({ right: '0px' });

  private _clickOutsideHandler: ((e: Event) => void) | null = null;

  /** Last query handed to the host — guards against re-emitting the same one. */
  private _lastQuery = '';

  constructor() {
    effect(() => {
      const host = this.notifications();
      this._prune(host);
      this._items.set(this._overlay(host));
    });   // no options: `allowSignalWrites` was removed in Angular 21 — it is
         // ignored, and passing it logs a deprecation notice on every effect
         // creation. One component rendered 18 times printed it 20 times.

    // Feed the debouncer from the model, so a host writing `search` (restoring
    // it from a URL, say) goes through the same path as typing.
    effect(() => this._debouncedSearch.set(this.search()));

    // One handler for the host whether the user typed or switched tab. The
    // string guard matters: the query object is rebuilt on every recompute, so
    // emitting on identity would fetch a result set already on screen.
    effect(() => {
      const query: NotificationQuery = {
        tab: this.activeTab(),
        search: this._debouncedSearch.value().trim(),
      };
      const key = `${query.tab}\u0000${query.search}`;
      if (key === this._lastQuery) return;
      this._lastQuery = key;
      this.queryChange.emit(query);
    });


    effect(() => {
      // Clean up portal when variant changes while panel is open
      if (!this._open()) {
        this._destroyPortal();
      }
    });
  }

  /**
   * Pending open-transition timer.
   *
   * ★ It has to be cleared on destroy. Without the handle the callback below
   * still ran after teardown, mounting a `[data-nc-portal]` panel into
   * `document.body` that nothing owned any more and attaching a document click
   * listener and a window scroll listener that `ngOnDestroy` had already
   * finished removing — so a route change made while the bell was being opened
   * left an orphan panel on screen and two listeners running for the life of
   * the tab. Matches the Pro twin, which already held the handle.
   */
  private _openTimer?: ReturnType<typeof setTimeout>;

  ngOnDestroy(): void {
    clearTimeout(this._openTimer);
    this._removeClickOutside();
    this._removeScrollListener();
    this._destroyPortal();
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  /**
   * The rows as the panel shows them: one per `id`, one per `dedupeKey`,
   * ordered (`OF-10-I3`, `OF-10-M4`, `OF-10-M5`).
   *
   * ★★★ EVERY COUNT IS TAKEN OVER THIS, NOT OVER `_items` (`OF-10-I2`). The
   *     raw list still holds the duplicates and the collapsed rows the panel
   *     does not render, so the badge counted a repeated id twice and counted
   *     every row folded into a `dedupeKey` group — and clicking the one row
   *     the user could see marked only that row read, so the badge stayed up
   *     over a list with nothing unread in it, permanently.
   */
  private readonly _merged = computed<readonly NotificationItem[]>(() =>
    svMergeRecords<NotificationItem>([], this._items()).items,
  );

  /** Unread among the rows actually in hand — as rendered, see `_merged`. */
  readonly loadedUnreadCount = computed(() => this._merged().filter(n => !n.read).length);

  /**
   * Rows this component has marked read that the host has not confirmed yet.
   *
   * ★ DERIVED, NOT COUNTED. An incremented counter would have to be unwound
   *   by every `rollback()`, by a re-send of the same list, and by a dismissal
   *   of an already-counted row — three places to forget. Comparing the local
   *   list against the host's makes all three self-correcting.
   */
  private readonly _optimisticReads = computed<number>(() => {
    const host = new Map(this.notifications().map(n => [n.id, n.read]));
    // ★★ Over the RAW rows whenever a server total is in play: the server
    //    counts every row, including the siblings a `dedupeKey` group folds
    //    away. Opening a group of three marks three rows read, and subtracting
    //    one made the badge jump by two when the host confirmed. Without a
    //    total the badge counts rendered rows, so the rendered list is the
    //    right basis there.
    const rows = this.unreadTotal() === null ? this._merged() : this._items();
    const seen = new Set<string>();
    return rows.filter(n => {
      if (!n.read || host.get(n.id) !== false || seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    }).length;
  });

  /**
   * What the badge shows: the server's total when there is one, minus the
   * reads not yet confirmed (`OF-10-I2`). See {@link unreadTotal}.
   */
  readonly unreadCount = computed<number>(() => {
    const total = this.unreadTotal();
    if (total === null) return this.loadedUnreadCount();
    return Math.max(0, total - this._optimisticReads());
  });

  readonly badgeLabel = computed(() => {
    const c = this.unreadCount();
    return c > 99 ? '99+' : c > 0 ? String(c) : '';
  });

  /**
   * Classes for the trigger bell.
   *
   * `cssClass` on `<sv-icon>` is a single string, so the conditional
   * `[class.animate-bounce]` the hand-drawn `<svg>` carried has to fold into
   * the value. Kept identical to the Pro twin so the two cannot drift.
   */
  readonly bellCssClass = computed(() =>
    this.animateBell() && this.unreadCount() > 0 ? 'w-5 h-5 animate-bounce' : 'w-5 h-5',
  );

  readonly filteredItems = computed(() => {
    // With `serverSide`, the supplied list IS the answer to the current query.
    // Filtering it again would hide rows the server deliberately returned.
    const tab   = this.serverSide() ? 'All' : this._activeTab();
    const query = this.serverSide() ? '' : this._search().toLowerCase().trim();
    // ★★★ IDENTITY, VERSION, DEDUPLICATION AND ORDER IN ONE PASS, AND
    //     DEFENSIVELY — the host owns this list and a realtime one arrives in
    //     pieces. `@for` tracks by `item.id` and Angular THROWS on a duplicate
    //     track key, so a naively appended stream did not render a muddled
    //     panel: it rendered an exception. `svMergeRecords` collapses a
    //     repeated id (keeping the higher `version`, not the later position),
    //     collapses rows sharing a `dedupeKey`, and orders what is left.
    //
    // ★★ THE ORDER RULE MOVED WITH IT, and it fixes two things the inline sort
    //    got wrong. `new Date('n/a').getTime()` is NaN, and a comparator that
    //    returns NaN makes the sort's result implementation-defined — one
    //    unparsed timestamp from one integration and the same data renders in
    //    a different order from pass to pass. And rows that tie now break the
    //    tie on `id`, so a live list does not twitch when something unrelated
    //    changes.
    //
    // ★ `svMergeRecords([], …)` rather than `svOrderRecords`: merging nothing
    //   into the list is how the collapse rules get applied to it, and the
    //   report is discarded here because there is nobody to report to — the
    //   host merges its own stream and reads it there.
    let list: NotificationItem[] = [
      ...this._merged(),
    // ★★★ REDACTION HAPPENS HERE, BEFORE THE SEARCH FILTER BELOW (`OF-10-I8`).
    //     Sanitising what is RENDERED would still leave the hidden title
    //     searchable: type it, watch a row appear, and the search box is an
    //     oracle for the thing being withheld. Doing it in front of the filter
    //     means the real title is not in the list the query runs over — and
    //     not in the template at all, so it cannot leak through a title
    //     attribute, an aria-label or a render site added later.
    ].map(n => this._redact(n));
    if (tab === 'Unread')        list = list.filter(n => !n.read);
    else if (tab === 'Mentions') list = list.filter(n => n.type === 'mention');
    else if (tab === 'System')   list = list.filter(n => ['system','update','security'].includes(n.type));
    if (query) {
      list = list.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.body?.toLowerCase().includes(query) ||
        n.actor?.name.toLowerCase().includes(query) ||
        n.target?.label.toLowerCase().includes(query)
      );
    }
    return list;
  });

  readonly groupedItems = computed(() => {
    const map = new Map<string, NotificationItem[]>();
    for (const n of this.filteredItems()) {
      const label = dateLabel(n.timestamp);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(n);
    }
    const ORDER = ['Today', 'Yesterday', 'This week', 'Earlier this month', 'Older'];
    return [...map.entries()]
      .sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
      .map(([label, items]) => ({ label, items }));
  });

  readonly tabUnread = computed<Record<string, number>>(() => {
    const all     = this._merged();
    // ★ The All / Unread tabs count the same thing the bell does. With a
    //   server `unreadTotal` they used to show the size of the page in hand
    //   next to a badge showing the total — two numbers for one fact.
    const unread  = this.unreadCount();
    const mention = all.filter(n => n.type === 'mention' && !n.read).length;
    const sys     = all.filter(n => ['system','update','security'].includes(n.type) && !n.read).length;
    return { All: unread, Unread: unread, Mentions: mention, System: sys };
  });

  // ── Panel open / close ─────────────────────────────────────────────────────

  /**
   * Toggles the floating panel. On open, portals the panel to document.body
   * so it is never clipped by overflow:hidden, transform, or backdrop-filter
   * on any ancestor element.
   */
  togglePanel(event: MouseEvent): void {
    if (this._open()) {
      this._open.set(false);
      this._destroyPortal();
      this._removeClickOutside();
      this._removeScrollListener();
      return;
    }

    if (!isPlatformBrowser(this.platformId)) return;

    this._triggerEl = event.currentTarget as HTMLElement;
    const rect = this._triggerEl.getBoundingClientRect();
    this._panelStyle.set(this._computePosition(rect));
    this._open.set(true);

    // setTimeout allows Angular to process the signal update so the viewChild
    // template ref is available before _createPortal() runs.
    this._openTimer = setTimeout(() => {
      this._createPortal();
      this._attachClickOutside();
      this._attachScrollListener();
    }, 0);
  }

  closePanel(): void {
    this._open.set(false);
    this._destroyPortal();
    this._removeClickOutside();
    this._removeScrollListener();
  }

  /** Close the floating panel when Escape is pressed while it is open. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this._open()) return;
    // ★ `X-4`: only the topmost surface owns Escape. A confirm dialog opened
    //   from a notification's action used to close the panel under it too —
    //   one keystroke, two surfaces gone.
    if (this._stack && !this._stack.isTopmost()) return;
    this.closePanel();
  }

  // ── Portal helpers ─────────────────────────────────────────────────────────

  /**
   * Computes a viewport-safe position for the floating panel.
   *
   * Horizontal: right-aligned with the trigger's right edge, clamped so the
   *   panel never overflows the left viewport edge.
   *
   * Vertical (flip logic):
   *   - Prefer BELOW the trigger when there is at least 280 px of clearance.
   *   - Flip ABOVE when there is more space above than below.
   *   - `maxH` caps the panel so it never clips the opposite viewport edge.
   */
  private _computePosition(rect: DOMRect): {
    top?: string;
    bottom?: string;
    right: string;
    maxH?: string;
  } {
    const GAP    = 8;
    const EDGE   = 8;
    const vw     = window.innerWidth;
    const vh     = window.innerHeight;
    const panelW = 416;

    // ── Horizontal ──────────────────────────────────────────────────────────
    const rawRight = vw - rect.right;
    const rightVal = Math.max(EDGE, Math.min(rawRight, vw - panelW - EDGE));

    // ── Vertical (flip) ─────────────────────────────────────────────────────
    const spaceBelow = vh - rect.bottom - GAP - EDGE;
    const spaceAbove = rect.top      - GAP - EDGE;
    const minFit     = 280; // px — minimum useful panel height

    if (spaceBelow >= minFit || spaceBelow >= spaceAbove) {
      // Show below — anchor top, cap height
      return {
        top:   `${rect.bottom + GAP}px`,
        right: `${rightVal}px`,
        maxH:  `${Math.max(minFit, spaceBelow)}px`,
      };
    } else {
      // Flip above — anchor bottom (panel grows upward), cap height
      return {
        bottom: `${vh - rect.top + GAP}px`,
        right:  `${rightVal}px`,
        maxH:   `${Math.max(minFit, spaceAbove)}px`,
      };
    }
  }

  /**
   * Appends a portal host <div> to document.body and renders the
   * #floatingPanel template into it via Angular's ViewContainerRef.
   *
   * The host div has no transform / filter / overflow, so position:fixed
   * children are viewport-relative in all browsers.
   */
  private _createPortal(): void {
    const tpl = this._floatingPanelTpl();
    if (!tpl || this._portalContainer) return;

    const container = document.createElement('div');
    container.setAttribute('data-nc-portal', '');
    // ★★ `X-4`: THE Z-INDEX COMES FROM THE OVERLAY STACK. The panel's own
    //    `z-[9999]` used to be its page-level z-index — a number of its own,
    //    below nothing and above everything, so a confirm dialog opened from a
    //    notification's action painted UNDER the panel it came from, and a
    //    dropdown opened inside the panel under it too. The container is now
    //    a positioned stacking context at the stack's value; the classes on
    //    the panel only order its own backdrop and sheet inside it.
    this._stack = this._overlayStack.push('anchored', { element: () => this._portalContainer });
    container.style.position = 'relative';
    container.style.zIndex = String(this._stack.zIndex);
    document.body.appendChild(container);
    this._portalContainer = container;

    // EmbeddedViewRef remains in Angular's view/CD tree even though
    // its DOM nodes are moved to document.body.
    const view = this.vcr.createEmbeddedView(tpl);
    view.rootNodes.forEach(node => container.appendChild(node));
    this._portalView = view;
  }

  private _destroyPortal(): void {
    // Every close path — toggle, closePanel, the `open` model, destroy — ends
    // here, so this is the one release point.
    this._stack?.release();
    this._stack = null;
    this._portalView?.destroy();
    this._portalView = null;
    this._portalContainer?.remove();
    this._portalContainer = null;
  }

  // ── Scroll / resize tracking ───────────────────────────────────────────────

  /**
   * Recomputes panel position on every scroll / resize so the panel
   * tracks the trigger button as the page scrolls.
   * Uses requestAnimationFrame to throttle updates.
   */
  private _attachScrollListener(): void {
    this._removeScrollListener();
    let pending = false;
    this._scrollHandler = () => {
      if (pending) return;
      pending = true;
      this._scrollRafId = requestAnimationFrame(() => {
        pending = false;
        if (this._triggerEl && this._open()) {
          this._panelStyle.set(this._computePosition(this._triggerEl.getBoundingClientRect()));
        }
      });
    };
    // capture:true catches scroll events on any nested scrollable ancestor
    window.addEventListener('scroll', this._scrollHandler, { passive: true, capture: true });
    window.addEventListener('resize', this._scrollHandler, { passive: true });
  }

  private _removeScrollListener(): void {
    // ★ SSR: `ngOnDestroy` runs at the end of a prerender. The handler is only
    // ever assigned in the browser, so this is belt-and-braces — but the belt
    // is what keeps one component from failing a whole route.
    if (this._scrollHandler && typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._scrollHandler, true);
      window.removeEventListener('resize', this._scrollHandler);
      this._scrollHandler = null;
    }
    if (this._scrollRafId !== null) {
      cancelAnimationFrame(this._scrollRafId);
      this._scrollRafId = null;
    }
  }

  // ── Click-outside ──────────────────────────────────────────────────────────

  private _attachClickOutside(): void {
    this._removeClickOutside();
    this._clickOutsideHandler = (e: Event) => {
      const target   = e.target as Element;
      const inHost   = target.closest('sv-notification-center, sv-notification-center');
      const inPortal = target.closest('[data-nc-portal]');
      // ★ `X-4`: a click inside a surface opened FROM the panel (a menu, a
      //   dialog — portalled elsewhere) is not "outside" it.
      if (this._stack?.isInsideHigherSurface(target)) return;
      if (!inHost && !inPortal) this.closePanel();
    };
    document.addEventListener('click', this._clickOutsideHandler, true);
  }

  private _removeClickOutside(): void {
    // ★ SSR: see `_removeScrollListener` above.
    if (this._clickOutsideHandler && typeof document !== 'undefined') {
      document.removeEventListener('click', this._clickOutsideHandler, true);
      this._clickOutsideHandler = null;
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  /** The host's rows with every pending write laid over them. */
  private _overlay(host: readonly NotificationItem[]): NotificationItem[] {
    const read = new Set<string>();
    const gone = new Set<string>();
    for (const op of this._optimistic.values()) {
      for (const id of op.ids) (op.kind === 'read' ? read : gone).add(id);
    }
    return host
      .filter(n => !gone.has(n.id))
      .map(n => (read.has(n.id) && !n.read ? { ...n, read: true } : { ...n }));
  }

  /** Drop what the host's list has confirmed, or no longer contains. */
  private _prune(host: readonly NotificationItem[]): void {
    const byId = new Map<string, boolean>();
    // A repeated id counts as read only if every copy is.
    for (const n of host) byId.set(n.id, (byId.get(n.id) ?? true) && n.read);
    for (const [seq, op] of this._optimistic) {
      for (const id of [...op.ids]) {
        const read = byId.get(id);
        const settled = read === undefined || (op.kind === 'read' && read);
        if (settled) op.ids.delete(id);
      }
      if (op.ids.size === 0) this._optimistic.delete(seq);
    }
  }

  /**
   * Record an optimistic write and return its `rollback` handle.
   *
   * ★ The handle undoes THIS write only, whenever it is called. It used to
   *   restore a whole-list snapshot, which is why it had to refuse once
   *   anything else had changed — and a refused rollback left the failed write
   *   on screen for good. Removing one entry from the overlay cannot undo
   *   anything else, so there is nothing to refuse. Once the host has
   *   confirmed (or dropped) the rows, the entry is gone and the call is a
   *   no-op.
   */
  private _write(kind: 'read' | 'dismiss', ids: Iterable<string>): () => void {
    const seq = ++this._writeSeq;
    const set = new Set(ids);
    if (set.size > 0) this._optimistic.set(seq, { kind, ids: set });
    this._items.set(this._overlay(this.notifications()));
    return () => {
      if (!this._optimistic.delete(seq)) return;
      this._items.set(this._overlay(this.notifications()));
    };
  }

  /**
   * The rows one press on `item` acts on: itself, and every row collapsed into
   * it by a shared `dedupeKey` (`OF-10-M4`).
   *
   * ★★ THE ROW IS ONE EVENT, SO THE WRITE IS TOO. Acting on the survivor alone
   *    left its siblings behind: opening it kept them unread (a badge nothing
   *    visible explains), and dismissing it promoted the next sibling into its
   *    place — the notification the user just dismissed came straight back.
   */
  private _groupOf(item: NotificationItem): ReadonlySet<string> {
    const key = item.dedupeKey;
    const ids = new Set<string>([item.id]);
    if (key === undefined) return ids;
    for (const n of this._items()) if (n.dedupeKey === key) ids.add(n.id);
    return ids;
  }

  onNotificationClick(item: NotificationItem): void {
    if (this.isPending(item)) return;
    const group = this._groupOf(item);
    const collapsedIds = this._items()
      .filter(n => n.id !== item.id && group.has(n.id) && !n.read)
      .map(n => n.id);
    const notification = { ...this._original(item), read: true };
    const rollback = this._write('read', group);
    this.notificationClick.emit({
      notification,
      rollback,
      ...(collapsedIds.length ? { collapsedIds } : {}),
    });
  }

  /**
   * A redacted row with its content removed rather than merely hidden.
   *
   * ★ `body`, `actor`, `target` and `actions` go with the title: an actor's
   *   name and a target's label are sentences about the same record, and an
   *   action button would post to a resource the user may not touch.
   */
  private _redact(item: NotificationItem): NotificationItem {
    if (!item.redacted) return item;
    return {
      ...item,
      title: this.redactedLabel(),
      body: undefined,
      actor: undefined,
      target: undefined,
      actions: undefined,
    };
  }

  /**
   * The host's own row for this id.
   *
   * ★ The template holds the REDACTED copy, so an event emitted straight from
   *   it would hand the host back a row whose title this component invented.
   *   The host owns the real one — including `redacted: true`, which is what
   *   lets it decide what a click on such a row means.
   */
  private _original(item: NotificationItem): NotificationItem {
    return this._items().find(n => n.id === item.id) ?? item;
  }

  onActionClick(item: NotificationItem, actionId: string, event: Event): void {
    event.stopPropagation();
    // ★ A redacted row renders no actions, so this is the public-API arm of
    //   the same rule: the action would post to a record the user cannot see.
    if (item.redacted) return;
    this.actionClick.emit({ notification: this._original(item), actionId });
  }

  onDismiss(item: NotificationItem, event: Event): void {
    event.stopPropagation();
    if (this.isPending(item)) return;
    // ★ Resolved BEFORE the removal: afterwards there is no row left to
    //   resolve, and the host would be handed the redacted copy.
    const real = this._original(item);
    const group = this._groupOf(item);
    const collapsedIds = [...group].filter(id => id !== item.id);
    // The rollback rebuilds from the host's list, so the row returns in its
    // original position rather than at the end.
    const rollback = this._write('dismiss', group);
    this.dismiss.emit({
      notification: real,
      rollback,
      ...(collapsedIds.length ? { collapsedIds } : {}),
    });
  }

  onMarkAllRead(): void {
    const unreadIds = this._items().filter(n => !n.read).map(n => n.id);
    const rollback = this._write('read', unreadIds);
    this.markAllRead.emit({ unreadIds, rollback });
  }

  /**
   * Hand the user to the full notifications surface.
   *
   * The panel closes on the way out: it is portalled to `document.body` at a
   * fixed position, so one left open would hang over the page it just navigated
   * to with nothing on that page able to dismiss it.
   */
  onViewAll(): void {
    this.closePanel();
    this.viewAll.emit();
  }

  /** Ask the host for the next page of notifications. */
  onLoadMore(): void {
    this.loadMore.emit({
      loaded: this._items().length,
      query: { tab: this.activeTab(), search: this.search().trim() },
    });
  }

  setTab(tab: string): void {
    this.activeTab.set(tab);
    this.search.set('');
  }

  // ── Template helpers ───────────────────────────────────────────────────────

  typeIcon(type: NotificationType): string    { return TYPE_ICONS[type];    }
  typeColor(type: NotificationType): string   { return TYPE_COLORS[type];   }
  typeAccent(type: NotificationType): string  { return TYPE_ACCENT[type];   }
  priorityColor(p: NotificationPriority): string { return PRIORITY_COLORS[p]; }
  initials(name: string): string  { return initials(name);  }
  timeAgo(iso: string): string    { return timeAgo(iso);    }
  dateLabel(iso: string): string  { return dateLabel(iso);  }
}
