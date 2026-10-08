import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ICON_REGISTRY } from '@styloviz/icons';
import { SvNotificationCenterComponent } from './notification-center.component';
import type {
  NotificationDismissEvent,
  NotificationItem,
  NotificationLoadMoreEvent,
  NotificationMarkAllReadEvent,
  NotificationQuery,
} from './notification-center.types';

const note = (id: string, over: Partial<NotificationItem> = {}): NotificationItem => ({
  id,
  type: 'comment',
  title: `Notification ${id}`,
  timestamp: '2026-07-20T10:00:00Z',
  read: false,
  ...over,
});

const items = (): NotificationItem[] => [note('a'), note('b', { read: true }), note('c')];

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvNotificationCenterComponent, {
    inputs: { variant: 'inline', notifications: items(), ...inputs },
  });
  return fixture.componentInstance;
}

const stateEl = (name: string) => document.querySelector(`[data-sv-state="${name}"]`);
const ids = (c: SvNotificationCenterComponent) => c._items().map((n) => n.id);

describe('SvNotificationCenterComponent — async states', () => {
  it('shows a placeholder while the first load is in flight', async () => {
    await setup({ notifications: [], loading: true });
    expect(stateEl('loading')).toBeTruthy();
  });

  it('announces a load failure and offers a retry', async () => {
    const c = await setup({ notifications: [], error: 'Feed unavailable' });
    expect(screen.getByRole('alert').textContent).toContain('Feed unavailable');

    let retried = 0;
    c.retry.subscribe(() => retried++);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retried).toBe(1);
  });

  /**
   * Telling someone with 400 notifications that they are all caught up, because
   * they mistyped a search term, reads as a bug.
   */
  it('separates "nothing here" from "nothing matching this filter"', async () => {
    const empty = await setup({ notifications: [] });
    expect(empty.isFiltered()).toBe(false);
    expect(stateEl('empty')?.textContent).toContain('all caught up');

    const filtered = await setup({ notifications: [], search: 'zzz' });
    expect(filtered.isFiltered()).toBe(true);
    expect(stateEl('empty')?.textContent).toContain('No matching notifications');
  });

  it('clears the filters from the empty state', async () => {
    const c = await setup({ notifications: [], search: 'zzz', activeTab: 'Unread' });
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(c.search()).toBe('');
    expect(c.activeTab()).toBe('All');
  });
});

describe('SvNotificationCenterComponent — server-driven query', () => {
  async function queries(inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    const seen: NotificationQuery[] = [];
    const { fixture } = await render(SvNotificationCenterComponent, {
      inputs: { variant: 'inline', notifications: items(), debounceMs: 0, ...inputs },
      on: { queryChange: (q: NotificationQuery) => seen.push(q) },
    });
    return { c: fixture.componentInstance, fixture, seen };
  }

  it('emits once for the initial state', async () => {
    const { seen } = await queries();
    expect(seen).toEqual([{ tab: 'All', search: '' }]);
  });

  it('emits when the tab changes', async () => {
    const { c, fixture, seen } = await queries();
    c.setTab('Unread');
    fixture.detectChanges();
    expect(seen[seen.length - 1]).toEqual({ tab: 'Unread', search: '' });
  });

  it('emits a trimmed search term', async () => {
    const { c, fixture, seen } = await queries();
    c.search.set('  invoice  ');
    fixture.detectChanges();
    expect(seen[seen.length - 1]).toEqual({ tab: 'All', search: 'invoice' });
  });

  /** The query object is rebuilt on every recompute — emitting on identity would refetch. */
  it('does not emit twice for the same query', async () => {
    const { fixture, seen } = await queries();
    const before = seen.length;
    fixture.detectChanges();
    fixture.detectChanges();
    expect(seen.length).toBe(before);
  });

  it('debounces a burst of keystrokes into one query', async () => {
    vi.useFakeTimers();
    try {
      const { c, fixture, seen } = await queries({ debounceMs: 300 });
      const before = seen.length;
      for (const term of ['i', 'in', 'inv']) {
        c.search.set(term);
        fixture.detectChanges();
        vi.advanceTimersByTime(100);
      }
      expect(seen.length).toBe(before);
      vi.advanceTimersByTime(300);
      fixture.detectChanges();
      expect(seen.length).toBe(before + 1);
      expect(seen[seen.length - 1].search).toBe('inv');
    } finally {
      vi.useRealTimers();
    }
  });

  /** Client-side filtering can only ever search the page already downloaded. */
  it('leaves the supplied list alone in serverSide mode', async () => {
    const c = await setup({ serverSide: true, search: 'nothing-matches', activeTab: 'Unread' });
    expect(c.filteredItems()).toHaveLength(3);
  });

  it('still filters locally when serverSide is off', async () => {
    const c = await setup({ activeTab: 'Unread' });
    expect(c.filteredItems().map((n) => n.id)).toEqual(['a', 'c']);
  });
});

describe('SvNotificationCenterComponent — optimistic writes', () => {
  it('dismisses immediately and can put the row back where it was', async () => {
    const c = await setup();
    const events: NotificationDismissEvent[] = [];
    c.dismiss.subscribe((e) => events.push(e));

    c.onDismiss(note('b', { read: true }), new Event('click'));
    expect(ids(c)).toEqual(['a', 'c']);

    events[0].rollback();
    expect(ids(c)).toEqual(['a', 'b', 'c']);
  });

  it('marks everything read and reports which ids were unread', async () => {
    const c = await setup();
    const events: NotificationMarkAllReadEvent[] = [];
    c.markAllRead.subscribe((e) => events.push(e));

    c.onMarkAllRead();
    expect(c.unreadCount()).toBe(0);
    expect(events[0].unreadIds).toEqual(['a', 'c']);

    events[0].rollback();
    expect(c.unreadCount()).toBe(2);
  });

  it('marks read on open and can undo that too', async () => {
    const c = await setup();
    const seen: { rollback: () => void }[] = [];
    c.notificationClick.subscribe((e) => seen.push(e));

    c.onNotificationClick(note('a'));
    expect(c._items().find((n) => n.id === 'a')?.read).toBe(true);

    seen[0].rollback();
    expect(c._items().find((n) => n.id === 'a')?.read).toBe(false);
  });

  /**
   * ★ Each rollback undoes ITS OWN write. It used to restore a whole-list
   *   snapshot, and so had to refuse once anything else had changed — which
   *   left the failed dismissal on screen for good. The writes are an overlay
   *   now, so undoing one cannot touch another.
   */
  it('rolls back one write and leaves a later one standing', async () => {
    const c = await setup();
    const events: NotificationDismissEvent[] = [];
    c.dismiss.subscribe((e) => events.push(e));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    c.onDismiss(note('a'), new Event('click'));
    c.onDismiss(note('b', { read: true }), new Event('click'));
    events[0].rollback();

    expect(ids(c)).toEqual(['a', 'c']);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ignores a click or dismiss on a row whose write is still in flight', async () => {
    const c = await setup({ pendingIds: ['a'] });
    let dismissed = 0;
    c.dismiss.subscribe(() => dismissed++);

    c.onDismiss(note('a'), new Event('click'));
    expect(dismissed).toBe(0);
    expect(ids(c)).toEqual(['a', 'b', 'c']);
  });
});

describe('SvNotificationCenterComponent — unbounded feed', () => {
  it('asks for the next page with the offset and the active query', async () => {
    const c = await setup({ hasMore: true, activeTab: 'Unread', search: 'inv' });
    const events: NotificationLoadMoreEvent[] = [];
    c.loadMore.subscribe((e) => events.push(e));

    c.onLoadMore();
    expect(events[0]).toEqual({ loaded: 3, query: { tab: 'Unread', search: 'inv' } });
  });

  it('offers the control only when more exist', async () => {
    await setup({ hasMore: true });
    expect(screen.getAllByRole('button', { name: 'Load more' }).length).toBeGreaterThan(0);

    await setup();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('keeps the loaded rows visible while the next page arrives', async () => {
    await setup({ loadingMore: true, hasMore: true });
    expect(stateEl('loading-more')).toBeTruthy();
    expect(screen.getAllByText('Notification a').length).toBeGreaterThan(0);
  });
});

describe('SvNotificationCenterComponent — controllable panel', () => {
  it('exposes open as a two-way model so a route can open the centre', async () => {
    const c = await setup({ variant: 'dropdown', open: true });
    expect(c.open()).toBe(true);
    c.open.set(false);
    expect(c._open()).toBe(false);
  });
});


describe('SvNotificationCenterComponent — glyphs come from the library', () => {
  const TYPES: readonly NotificationItem['type'][] = [
    'comment', 'mention', 'assignment', 'status', 'invite', 'approval',
    'deadline', 'payment', 'security', 'update', 'reaction', 'system',
  ];

  /**
   * `TYPE_ICONS` was twelve hand-copied Heroicons paths, duplicated verbatim in
   * the free and Pro twins — so the two could drift and no gate would notice.
   * They are names now, shared by both.
   *
   * This is the FREE package: `<sv-icon>` resolves the free registry ONLY, so a
   * Pro-only name renders blank and nothing else says so. `assignment` needed
   * `clipboard-list`, which was Pro — it was moved into free for exactly this.
   */
  it('maps every notification type to a name that resolves in the FREE registry', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvNotificationCenterComponent, {
      inputs: { notifications: [note('n1')] },
    });
    const c = fixture.componentInstance;
    for (const type of TYPES) {
      const name = c.typeIcon(type);
      expect(name, `type ${type}`).toMatch(/^[a-z0-9-]+$/);
      expect(ICON_REGISTRY[name as keyof typeof ICON_REGISTRY], `type ${type}`).toBeTruthy();
    }
  });

  it('draws no glyph by hand', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvNotificationCenterComponent, {
      inputs: { notifications: [note('n1'), note('n2', { type: 'security' })] },
    });
    const host = fixture.nativeElement as HTMLElement;
    const svgs = [...host.querySelectorAll('svg')];
    expect(svgs.length).toBeGreaterThan(0);
    expect(svgs.every((n) => n.closest('sv-icon'))).toBe(true);
  });

  /**
   * The bell used to carry `[class.animate-bounce]="animateBell() && unreadCount() > 0"`
   * directly on a hand-drawn `<svg>`. `cssClass` is a single string, so that
   * condition folded into `bellCssClass()` — these pin the fold, because a
   * class that silently stops being emitted looks like nothing at all.
   *
   * The `>` in that very expression is what hid the bell from `check:ui`'s
   * inline-svg-glyph rule for the whole sweep: the head was cut at the first
   * `>`, which landed inside the binding, before the viewBox. The rule now
   * parses the tag quote-aware, and `draws no glyph by hand` above is what
   * actually caught it.
   */
  it('bounces the bell only when unread notifications exist', async () => {
    const c = await setup({ variant: 'dropdown' });
    expect(c.unreadCount()).toBeGreaterThan(0);
    expect(c.bellCssClass()).toContain('animate-bounce');
    expect(c.bellCssClass()).toContain('w-5');
  });

  it('holds the bell still when everything is read', async () => {
    const c = await setup({
      variant: 'dropdown',
      notifications: items().map((n) => ({ ...n, read: true })),
    });
    expect(c.unreadCount()).toBe(0);
    expect(c.bellCssClass()).not.toContain('animate-bounce');
    expect(c.bellCssClass()).toContain('w-5');
  });

  it('holds the bell still when animateBell is off, unread or not', async () => {
    const c = await setup({ variant: 'dropdown', animateBell: false });
    expect(c.unreadCount()).toBeGreaterThan(0);
    expect(c.bellCssClass()).not.toContain('animate-bounce');
  });
});
