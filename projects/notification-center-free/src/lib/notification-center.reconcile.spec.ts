import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvNotificationCenterComponent } from './notification-center.component';
import type {
  NotificationCenterVariant,
  NotificationClickEvent,
  NotificationDismissEvent,
  NotificationItem,
} from './notification-center.types';

/**
 * ============================================================================
 *  Reconciliation against the host's list  ·  `OF-10-I1` `OF-10-I2` `OF-10-I3`
 *  `OF-10-M4` `OF-10-I8`
 * ============================================================================
 *
 * ★★★ Three defects the earlier passes left behind, each only visible when the
 *     host's list and the panel's list disagree:
 *
 *     1. A `rollback()` taken before a realtime push restored the PRE-PUSH
 *        list, deleting whatever the push delivered.
 *     2. Every count ran over the raw list — duplicates counted twice, rows
 *        folded into a `dedupeKey` group counted although never rendered — so
 *        the badge said "2" over a panel with nothing unread in it.
 *     3. Opening or dismissing a collapsed row acted on the survivor alone:
 *        its siblings stayed unread, or — on dismiss — the next sibling was
 *        promoted into its place and the dismissed notification came back.
 */

const note = (id: string, over: Partial<NotificationItem> = {}): NotificationItem => ({
  id,
  type: 'comment',
  title: `Notification ${id}`,
  timestamp: '2026-07-20T10:00:00Z',
  read: false,
  ...over,
});

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvNotificationCenterComponent, {
    inputs: { variant: 'inline', notifications: [note('a'), note('b')], ...inputs },
  });
  return { c: fixture.componentInstance, fixture };
}

/** Row titles the panel is actually showing. */
const rowTitles = () =>
  [...document.querySelectorAll('[aria-label^="Notification "]')].map((el) => el.getAttribute('aria-label'));

describe('sv-notification-center (free) — rollback after a host push (OF-10-I1)', () => {
  it('★★★ does not erase rows the host delivered after the optimistic change', async () => {
    const { c, fixture } = await setup();
    const events: NotificationClickEvent[] = [];
    c.notificationClick.subscribe((e) => events.push(e));

    c.onNotificationClick(note('a'));
    // A realtime push lands while the read request is still in flight.
    fixture.componentRef.setInput('notifications', [note('c'), note('a'), note('b')]);
    fixture.detectChanges();

    events[0].rollback();
    fixture.detectChanges();

    expect(c.filteredItems().map((n) => n.id)).toContain('c');
    expect(rowTitles()).toContain('Notification c');
    // The write failed: `a` is unread again, as the host's list says.
    expect(c.filteredItems().find((n) => n.id === 'a')?.read).toBe(false);
  });

  it('still restores when nothing arrived in between', async () => {
    const { c, fixture } = await setup();
    const events: NotificationDismissEvent[] = [];
    c.dismiss.subscribe((e) => events.push(e));

    c.onDismiss(note('a'), new MouseEvent('click'));
    fixture.detectChanges();
    expect(rowTitles()).not.toContain('Notification a');

    events[0].rollback();
    fixture.detectChanges();
    expect(rowTitles()).toContain('Notification a');
  });
});

describe('sv-notification-center — pending writes survive host pushes (OF-10-I1)', () => {
  /** The unread badge in the inline header — the count as the user sees it. */
  const headerCount = () =>
    document.querySelector('h2 + span')?.textContent?.trim() ?? '0';

  it('★★★ a row opened while its write is in flight stays read through an unrelated push', async () => {
    const { c, fixture } = await setup();
    c.onNotificationClick(note('a'));
    fixture.detectChanges();
    expect(headerCount()).toBe('1');

    // Something else arrives; the host has not confirmed `a` yet.
    fixture.componentRef.setInput('notifications', [note('c'), note('a'), note('b')]);
    fixture.detectChanges();

    expect(c.filteredItems().find((n) => n.id === 'a')?.read).toBe(true);
    expect(rowTitles()).toContain('Notification c');
    // Before: `a` flicked back to unread and the badge went up to 3.
    expect(headerCount()).toBe('2');
  });

  it('★★ a dismissed row stays gone through an unrelated push', async () => {
    const { c, fixture } = await setup();
    c.onDismiss(note('a'), new MouseEvent('click'));
    fixture.componentRef.setInput('notifications', [note('c'), note('a'), note('b')]);
    fixture.detectChanges();
    expect(rowTitles()).toEqual(expect.arrayContaining(['Notification b', 'Notification c']));
    expect(rowTitles()).not.toContain('Notification a');
  });

  it('★★ rolls back only the failed row when two writes are pending', async () => {
    const { c, fixture } = await setup();
    const events: NotificationClickEvent[] = [];
    c.notificationClick.subscribe((e) => events.push(e));
    c.onNotificationClick(note('a'));
    c.onNotificationClick(note('b'));
    fixture.componentRef.setInput('notifications', [note('a'), note('b'), note('c')]);
    fixture.detectChanges();

    events[0].rollback();
    fixture.detectChanges();

    const read = (id: string) => c.filteredItems().find((n) => n.id === id)?.read;
    expect(read('a')).toBe(false);
    expect(read('b')).toBe(true);
    expect(read('c')).toBe(false);
  });

  it('★ ends when the host confirms — a late rollback then changes nothing', async () => {
    const { c, fixture } = await setup();
    const events: NotificationClickEvent[] = [];
    c.notificationClick.subscribe((e) => events.push(e));
    c.onNotificationClick(note('a'));

    fixture.componentRef.setInput('notifications', [note('a', { read: true }), note('b')]);
    fixture.detectChanges();
    // A later push that says unread is the host's truth now, not overridden.
    fixture.componentRef.setInput('notifications', [note('a'), note('b')]);
    fixture.detectChanges();
    expect(c.filteredItems().find((n) => n.id === 'a')?.read).toBe(false);

    events[0].rollback();
    fixture.detectChanges();
    expect(c.filteredItems().find((n) => n.id === 'a')?.read).toBe(false);
  });

  it('★ ends when the row disappears from the host list', async () => {
    const { c, fixture } = await setup();
    const events: NotificationDismissEvent[] = [];
    c.dismiss.subscribe((e) => events.push(e));
    c.onDismiss(note('a'), new MouseEvent('click'));

    // Confirmed: the host stopped sending `a`.
    fixture.componentRef.setInput('notifications', [note('b')]);
    fixture.detectChanges();
    // If `a` ever comes back, that is the host's decision, not a stale overlay.
    fixture.componentRef.setInput('notifications', [note('a'), note('b')]);
    fixture.detectChanges();
    expect(rowTitles()).toContain('Notification a');

    events[0].rollback();
    fixture.detectChanges();
    expect(rowTitles().filter((t) => t === 'Notification a')).toHaveLength(1);
  });
});

describe('sv-notification-center (free) — counts match what is rendered (OF-10-I2)', () => {
  it('★ counts a repeated id once, like the list does', async () => {
    const { c, fixture } = await setup({
      notifications: [note('a', { version: 1 }), note('a', { version: 2 }), note('b')],
    });
    fixture.detectChanges();
    expect(c.filteredItems()).toHaveLength(2);
    expect(c.unreadCount()).toBe(2);
    expect(c.tabUnread()['All']).toBe(2);
  });

  it('★★ a collapsed group is one unread row, and clears when that row is opened', async () => {
    const { c, fixture } = await setup({
      notifications: [
        note('a', { dedupeKey: 'ticket-14', timestamp: '2026-07-20T12:00:00Z' }),
        note('b', { dedupeKey: 'ticket-14', timestamp: '2026-07-20T11:00:00Z' }),
        note('c'),
      ],
    });
    const events: NotificationClickEvent[] = [];
    c.notificationClick.subscribe((e) => events.push(e));

    expect(c.unreadCount()).toBe(2);
    c.onNotificationClick(c.filteredItems().find((n) => n.id === 'a')!);
    fixture.detectChanges();

    // Before: the badge stayed at 2 over a panel showing one unread row.
    expect(c.unreadCount()).toBe(1);
    expect(events[0].collapsedIds).toEqual(['b']);
  });

  it('★ reconciles a server total against the whole group read optimistically', async () => {
    const { c, fixture } = await setup({
      unreadTotal: 40,
      notifications: [
        note('a', { dedupeKey: 'k', timestamp: '2026-07-20T12:00:00Z' }),
        note('b', { dedupeKey: 'k', timestamp: '2026-07-20T11:00:00Z' }),
      ],
    });
    c.onNotificationClick(c.filteredItems()[0]);
    fixture.detectChanges();
    // ★★ The server counts BOTH rows, and both were just marked read — so the
    //    badge drops by two now, not by one now and by one more on confirm.
    expect(c.unreadCount()).toBe(38);

    // The host confirms: both rows read, and a total that agrees.
    fixture.componentRef.setInput('notifications', [
      note('a', { dedupeKey: 'k', timestamp: '2026-07-20T12:00:00Z', read: true }),
      note('b', { dedupeKey: 'k', timestamp: '2026-07-20T11:00:00Z', read: true }),
    ]);
    fixture.componentRef.setInput('unreadTotal', 38);
    fixture.detectChanges();
    expect(c.unreadCount()).toBe(38);
  });

  it('★ the All and Unread tabs show the same number as the bell', async () => {
    const { c } = await setup({ unreadTotal: 240, variant: 'inline' });
    expect(c.unreadCount()).toBe(240);
    expect(c.tabUnread()['All']).toBe(240);
    expect(c.tabUnread()['Unread']).toBe(240);
  });
});

describe('sv-notification-center (free) — dismissing a collapsed row (OF-10-I3, OF-10-M4)', () => {
  it('★★★ does not promote a sibling into the dismissed row\'s place', async () => {
    const { c, fixture } = await setup({
      notifications: [
        note('a', { dedupeKey: 'k', timestamp: '2026-07-20T12:00:00Z' }),
        note('b', { dedupeKey: 'k', timestamp: '2026-07-20T11:00:00Z' }),
        note('c'),
      ],
    });
    const events: NotificationDismissEvent[] = [];
    c.dismiss.subscribe((e) => events.push(e));
    fixture.detectChanges();
    expect(rowTitles()).toEqual(['Notification a', 'Notification c']);

    c.onDismiss(c.filteredItems()[0], new MouseEvent('click'));
    fixture.detectChanges();

    expect(rowTitles()).toEqual(['Notification c']);
    expect(events[0].notification.id).toBe('a');
    expect(events[0].collapsedIds).toEqual(['b']);

    events[0].rollback();
    fixture.detectChanges();
    expect(rowTitles()).toEqual(['Notification a', 'Notification c']);
  });

  it('adds no collapsedIds for an ordinary row', async () => {
    const { c } = await setup();
    const events: NotificationDismissEvent[] = [];
    c.dismiss.subscribe((e) => events.push(e));
    c.onDismiss(note('a'), new MouseEvent('click'));
    expect('collapsedIds' in events[0]).toBe(false);
  });
});

const VARIANTS: readonly NotificationCenterVariant[] = [
  'dropdown', 'inline',
];

describe('sv-notification-center (free) — redaction in every variant (OF-10-I8)', () => {
  afterEach(() => document.querySelectorAll('[data-nc-portal]').forEach((n) => n.remove()));

  it.each(VARIANTS)('★★ %s never renders the withheld title, actor or target', async (variant) => {
    const { fixture } = await setup({
      variant,
      notifications: [
        note('a', {
          title: 'Dana commented on Q3 layoffs',
          body: 'Secret body',
          actor: { id: 'u1', name: 'Dana Secret' },
          target: { label: 'Q3 layoffs doc' },
          actions: [{ id: 'approve', label: 'Approve' }],
          redacted: true,
        }),
        note('b'),
      ],
    });
    const trigger = document.querySelector('[aria-label="Open notifications"]') as HTMLElement | null;
    if (trigger) {
      trigger.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
    }

    const html = document.body.innerHTML;
    // The panel is showing rows — otherwise the absence below proves nothing.
    expect(html).toContain('Notification b');
    expect(html).toContain('This notification is no longer available');
    for (const secret of ['Q3 layoffs', 'Secret body', 'Dana Secret', 'Approve']) {
      expect(html, `${variant}: ${secret}`).not.toContain(secret);
    }
  });
});
