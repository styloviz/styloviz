import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvNotificationCenterComponent } from './notification-center.component';
import type { NotificationItem } from './notification-center.types';

/**
 * Everything the panel shows comes out of one `filteredItems` computed: pinned
 * rows first, then newest first, then the tab, then the search. The cases that
 * matter are the ones a happy-path list never produces — two pinned rows, a
 * search term that only matches a field other than the title, a tab list the
 * host replaced entirely, and an unread count past the badge's own ceiling.
 */

const note = (id: string, over: Partial<NotificationItem> = {}): NotificationItem => ({
  id,
  type: 'comment',
  title: `Notification ${id}`,
  timestamp: new Date(2026, 2, 15, 9, 0).toISOString(),
  read: false,
  ...over,
});

/** Local wall-clock, not `new Date('…')` — a bare date string is UTC midnight. */
const at = (d: number, h = 9) => new Date(2026, 2, d, h, 0).toISOString();

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvNotificationCenterComponent, {
    inputs: { variant: 'inline', notifications: [], ...inputs },
  });
  return fixture.componentInstance;
}

const ids = (c: SvNotificationCenterComponent) => c.filteredItems().map((n) => n.id);

describe('SvNotificationCenterComponent — ordering', () => {
  it('puts newest first', async () => {
    const c = await setup({
      notifications: [note('old', { timestamp: at(10) }), note('new', { timestamp: at(14) })],
    });
    expect(ids(c)).toEqual(['new', 'old']);
  });

  it('lifts a pinned notification above a newer unpinned one', async () => {
    const c = await setup({
      notifications: [note('new', { timestamp: at(14) }), note('pinned', { timestamp: at(10), pinned: true })],
    });
    expect(ids(c)).toEqual(['pinned', 'new']);
  });

  /** Two pinned rows have to fall back to the time sort rather than to input order. */
  it('orders pinned rows among themselves by time', async () => {
    const c = await setup({
      notifications: [
        note('pin-old', { timestamp: at(10), pinned: true }),
        note('loose', { timestamp: at(15) }),
        note('pin-new', { timestamp: at(13), pinned: true }),
      ],
    });
    expect(ids(c)).toEqual(['pin-new', 'pin-old', 'loose']);
  });

  it('leaves a single-item list alone', async () => {
    const c = await setup({ notifications: [note('only')] });
    expect(ids(c)).toEqual(['only']);
  });

  /** The sort must not mutate the input array the host still holds a reference to. */
  it('does not reorder the array it was given', async () => {
    const supplied = [note('old', { timestamp: at(10) }), note('new', { timestamp: at(14) })];
    const c = await setup({ notifications: supplied });
    expect(ids(c)).toEqual(['new', 'old']);
    expect(supplied.map((n) => n.id)).toEqual(['old', 'new']);
  });
});

describe('SvNotificationCenterComponent — the tabs', () => {
  const mixed = () => [
    note('unread'),
    note('read', { read: true }),
    note('mention', { type: 'mention' }),
    note('system', { type: 'system' }),
    note('update', { type: 'update', read: true }),
    note('security', { type: 'security' }),
  ];

  it('shows everything on the first tab', async () => {
    const c = await setup({ notifications: mixed() });
    expect(c.filteredItems()).toHaveLength(6);
  });

  it('keeps only the unread ones on Unread', async () => {
    const c = await setup({ notifications: mixed(), activeTab: 'Unread' });
    expect(ids(c).sort()).toEqual(['mention', 'security', 'system', 'unread']);
  });

  it('keeps only mentions on Mentions', async () => {
    const c = await setup({ notifications: mixed(), activeTab: 'Mentions' });
    expect(ids(c)).toEqual(['mention']);
  });

  /** System is three types, not one — the read `update` belongs there too. */
  it('collects system, update and security on System', async () => {
    const c = await setup({ notifications: mixed(), activeTab: 'System' });
    expect(ids(c).sort()).toEqual(['security', 'system', 'update']);
  });

  it('shows everything for a tab label it does not recognise', async () => {
    const c = await setup({ notifications: mixed(), tabs: ['All', 'Archive'], activeTab: 'Archive' });
    expect(c.filteredItems()).toHaveLength(6);
  });

  it('counts the unread per tab, ignoring the ones already read', async () => {
    const c = await setup({ notifications: mixed() });
    expect(c.tabUnread()).toEqual({ All: 4, Unread: 4, Mentions: 1, System: 2 });
  });

  it('reports zero for every tab on an empty list', async () => {
    const c = await setup();
    expect(c.tabUnread()).toEqual({ All: 0, Unread: 0, Mentions: 0, System: 0 });
  });
});

describe('SvNotificationCenterComponent — searching', () => {
  const corpus = () => [
    note('by-title', { title: 'Deploy finished' }),
    note('by-body', { title: 'Something', body: 'The deploy pipeline failed' }),
    note('by-actor', { title: 'Something', actor: { id: 'bot-1', name: 'Deploy Bot' } }),
    note('by-target', { title: 'Something', target: { label: 'deploy.yml' } }),
    note('no-match', { title: 'Unrelated' }),
  ];

  it('matches the title, the body, the actor and the target alike', async () => {
    const c = await setup({ notifications: corpus(), search: 'deploy' });
    expect(ids(c).sort()).toEqual(['by-actor', 'by-body', 'by-target', 'by-title']);
  });

  it('is case-insensitive and ignores surrounding whitespace', async () => {
    const c = await setup({ notifications: corpus(), search: '  DEPLOY.YML  ' });
    expect(ids(c)).toEqual(['by-target']);
  });

  /** A row with no body, actor or target must not throw on the optional chain. */
  it('survives a notification with none of the optional fields', async () => {
    const c = await setup({ notifications: [note('bare')], search: 'anything' });
    expect(ids(c)).toEqual([]);
  });

  it('narrows within the active tab rather than replacing it', async () => {
    const c = await setup({
      notifications: [
        note('a', { title: 'Deploy finished' }),
        note('b', { title: 'Deploy failed', read: true }),
      ],
      activeTab: 'Unread',
      search: 'deploy',
    });
    expect(ids(c)).toEqual(['a']);
  });
});

describe('SvNotificationCenterComponent — the badge', () => {
  it('shows nothing when everything is read', async () => {
    const c = await setup({ notifications: [note('a', { read: true })] });
    expect(c.unreadCount()).toBe(0);
    expect(c.badgeLabel()).toBe('');
  });

  it('shows the count while it fits', async () => {
    const c = await setup({ notifications: [note('a'), note('b')] });
    expect(c.badgeLabel()).toBe('2');
  });

  /** 99 fits; 100 does not, and a three-digit badge breaks the bell. */
  it('caps at 99+', async () => {
    const under = await setup({ notifications: Array.from({ length: 99 }, (_, i) => note(`n${i}`)) });
    expect(under.badgeLabel()).toBe('99');

    const over = await setup({ notifications: Array.from({ length: 100 }, (_, i) => note(`n${i}`)) });
    expect(over.badgeLabel()).toBe('99+');
  });
});

describe('SvNotificationCenterComponent — what counts as filtered', () => {
  /**
   * "Filtered" decides whether an empty list says "all caught up" or "nothing
   * matching". The first tab is whatever the HOST called it, so a host that
   * renamed its tabs must not have its default tab treated as a filter.
   */
  it('treats the host first tab as unfiltered, whatever it is called', async () => {
    const c = await setup({ tabs: ['Inbox', 'Archive'], activeTab: 'Inbox' });
    expect(c.isFiltered()).toBe(false);

    const archived = await setup({ tabs: ['Inbox', 'Archive'], activeTab: 'Archive' });
    expect(archived.isFiltered()).toBe(true);
  });

  /** With no tabs at all the fallback is 'All'; it still must not read as filtered. */
  it('falls back to All when the host supplied no tabs', async () => {
    const c = await setup({ tabs: [], activeTab: 'All' });
    expect(c.isFiltered()).toBe(false);
  });

  it('counts a whitespace-only search as no search', async () => {
    const c = await setup({ search: '   ' });
    expect(c.isFiltered()).toBe(false);
  });

  it('returns to the host first tab when the filters are cleared', async () => {
    const c = await setup({ tabs: ['Inbox', 'Archive'], activeTab: 'Archive', search: 'x' });
    c.clearFilters();
    expect(c.activeTab()).toBe('Inbox');
    expect(c.search()).toBe('');

    const noTabs = await setup({ tabs: [], activeTab: 'Whatever', search: 'x' });
    noTabs.clearFilters();
    expect(noTabs.activeTab()).toBe('All');
  });

  it('clears the search when the tab changes, so the two never stack invisibly', async () => {
    const c = await setup({ search: 'deploy' });
    c.setTab('Unread');
    expect(c.activeTab()).toBe('Unread');
    expect(c.search()).toBe('');
  });
});

describe('SvNotificationCenterComponent — rows with a write in flight', () => {
  it('accepts pendingIds as a Set as readily as an array', async () => {
    const fromSet = await setup({ notifications: [note('a')], pendingIds: new Set(['a']) });
    expect(fromSet.isPending(note('a'))).toBe(true);
    expect(fromSet.isPending(note('b'))).toBe(false);

    const fromArray = await setup({ notifications: [note('a')], pendingIds: ['a'] });
    expect(fromArray.isPending(note('a'))).toBe(true);
  });

  /** The negative: an in-flight row must not be marked read by a click on it. */
  it('ignores a click on a row that is still saving', async () => {
    const c = await setup({ notifications: [note('a')], pendingIds: ['a'] });
    let emitted = 0;
    c.notificationClick.subscribe(() => emitted++);

    c.onNotificationClick(note('a'));
    expect(emitted).toBe(0);
    expect(c._items()[0].read).toBe(false);
  });
});

describe('SvNotificationCenterComponent — mark all read', () => {
  /**
   * ★ The negative that matters. "Mark all read" operates on the whole list,
   * NOT on what the current filter happens to show — a user who marks all read
   * while searching would otherwise be left with unread rows they were told
   * were cleared.
   */
  it('marks every notification, including the ones the filter hides', async () => {
    const c = await setup({
      notifications: [note('shown', { title: 'Deploy done' }), note('hidden', { title: 'Unrelated' })],
      search: 'deploy',
    });
    expect(ids(c)).toEqual(['shown']);

    const seen: string[][] = [];
    c.markAllRead.subscribe((e) => seen.push([...e.unreadIds]));
    c.onMarkAllRead();

    expect(c.unreadCount()).toBe(0);
    expect(c._items().every((n) => n.read)).toBe(true);
    expect(seen[0].sort()).toEqual(['hidden', 'shown']);
  });

  it('reports no ids and changes nothing when everything is already read', async () => {
    const c = await setup({ notifications: [note('a', { read: true })] });
    const seen: string[][] = [];
    c.markAllRead.subscribe((e) => seen.push([...e.unreadIds]));

    c.onMarkAllRead();
    expect(seen[0]).toEqual([]);
    expect(c.unreadCount()).toBe(0);
  });

  it('changes nothing on an empty list', async () => {
    const c = await setup();
    const seen: string[][] = [];
    c.markAllRead.subscribe((e) => seen.push([...e.unreadIds]));
    c.onMarkAllRead();
    expect(seen[0]).toEqual([]);
    expect(c._items()).toEqual([]);
  });
});

describe('SvNotificationCenterComponent — row actions', () => {
  it('reports which action was pressed without opening the notification', async () => {
    const c = await setup({ notifications: [note('a', { actions: [{ id: 'approve', label: 'Approve' }] })] });
    const seen: { actionId: string }[] = [];
    let opened = 0;
    c.actionClick.subscribe((e) => seen.push(e));
    c.notificationClick.subscribe(() => opened++);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stop = vi.spyOn(event, 'stopPropagation');
    c.onActionClick(note('a'), 'approve', event);

    expect(seen[0].actionId).toBe('approve');
    // Without the stopPropagation the row's own click handler would fire too,
    // marking the notification read behind the action.
    expect(stop).toHaveBeenCalled();
    expect(opened).toBe(0);
  });
});
