import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvNotificationCenterComponent } from './notification-center.component';
import type { NotificationItem } from './notification-center.types';

/**
 * ============================================================================
 *  The badge on a paged feed, and a row the user may no longer read — FREE
 *  `OF-10-I2` · `OF-10-I8`
 * ============================================================================
 *
 * ★ The twin of the Pro file, kept as a copy rather than a shared helper for
 *   the reason the other twin specs give: the two components are separate
 *   published packages, and a shared spec would let one of them drift into
 *   passing on the other's code.
 *
 * ★★★ THE BADGE WAS NOT MERELY "UNRECONCILED", IT WAS GUARANTEED WRONG. The
 *     count was taken over the rows that had been DOWNLOADED, and this
 *     component ships `hasMore` — so a user with 240 unread and a first page
 *     of 20 saw "20", and the number went UP as they scrolled. `unreadTotal`
 *     is the server's answer; the component subtracts only the reads it is
 *     holding optimistically, so the badge still drops the moment a row is
 *     clicked.
 *
 * ★★ AND THE TITLE IS THE LEAK. "Dana commented on Q3 layoffs" is a sentence
 *    about a document, and an inbox keeps it long after that document's
 *    permissions change. `redacted` replaces the content and leaves the row,
 *    because the row's existence is not the secret — and the redaction happens
 *    in front of the search filter, so the withheld title cannot be probed for
 *    by typing it.
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

describe('sv-notification-center — the unread badge against a paged feed', () => {
  it('counts the rows in hand when there is no server total', async () => {
    const { c } = await setup();
    expect(c.unreadCount()).toBe(2);
    expect(c.badgeLabel()).toBe('2');
  });

  it('★ shows the server total, not the size of the first page', async () => {
    const { c } = await setup({ unreadTotal: 240, hasMore: true });
    expect(c.loadedUnreadCount()).toBe(2);
    expect(c.unreadCount()).toBe(240);
    expect(c.badgeLabel()).toBe('99+');
  });

  it('★ still drops the moment a row is marked read, before the host answers', async () => {
    const { c, fixture } = await setup({ unreadTotal: 240, hasMore: true });
    c.onNotificationClick(c.filteredItems()[0]);
    fixture.detectChanges();
    expect(c.unreadCount()).toBe(239);
  });

  it('★ subtracts every optimistic read, and only those', async () => {
    const { c, fixture } = await setup({ unreadTotal: 240, hasMore: true });
    c.onMarkAllRead();
    fixture.detectChanges();
    // Two rows in hand were unread; the other 238 are not this click's to mark.
    expect(c.unreadCount()).toBe(238);
  });

  it('★ stops subtracting once the host confirms the read', async () => {
    // The delta is measured against the rows the host passed, so an updated
    // list retires it with no bookkeeping.
    const { c, fixture } = await setup({ unreadTotal: 240, hasMore: true });
    c.onNotificationClick(c.filteredItems()[0]);
    fixture.detectChanges();
    expect(c.unreadCount()).toBe(239);

    fixture.componentRef.setInput('notifications', [note('a', { read: true }), note('b')]);
    fixture.componentRef.setInput('unreadTotal', 239);
    fixture.detectChanges();
    expect(c.unreadCount()).toBe(239);
  });

  it('★ needs no unwinding after a rollback', async () => {
    const { c, fixture } = await setup({ unreadTotal: 240, hasMore: true });
    let rollback: (() => void) | null = null;
    c.notificationClick.subscribe((e) => { rollback = e.rollback; });

    c.onNotificationClick(c.filteredItems()[0]);
    fixture.detectChanges();
    expect(c.unreadCount()).toBe(239);

    rollback!();
    fixture.detectChanges();
    expect(c.unreadCount()).toBe(240);
  });

  it('never goes below zero, whatever the host sends', async () => {
    const { c, fixture } = await setup({ unreadTotal: 1 });
    c.onMarkAllRead();
    fixture.detectChanges();
    expect(c.unreadCount()).toBe(0);
    expect(c.badgeLabel()).toBe('');
  });

  it('honours a server total of zero rather than falling back to the rows', async () => {
    // `0` is an answer; only `null` means "you count them".
    const { c } = await setup({ unreadTotal: 0 });
    expect(c.unreadCount()).toBe(0);
  });
});

describe('sv-notification-center — a notification the user may no longer read', () => {
  const SECRET = 'Dana commented on Q3 layoffs';
  const redacted = () => [
    note('a'),
    note('secret', {
      title: SECRET,
      body: 'We are closing the Berlin office',
      actor: { id: 'u-dana', name: 'Dana Lee' },
      target: { label: 'Q3 layoffs.docx' },
      actions: [{ id: 'open', label: 'Open' }],
      redacted: true,
    }),
  ];

  it('★ keeps the row and replaces its content', async () => {
    const { c } = await setup({ notifications: redacted() });
    const row = c.filteredItems().find((n) => n.id === 'secret')!;

    expect(row).toBeTruthy();
    expect(row.title).toBe('This notification is no longer available');
    expect(row.body).toBeUndefined();
    expect(row.actor).toBeUndefined();
    expect(row.target).toBeUndefined();
    expect(row.actions).toBeUndefined();
  });

  it('★★ does not render the withheld title anywhere in the panel', async () => {
    // Including a title attribute or an aria-label, which is why the redaction
    // is applied to the data rather than to each render site.
    const { fixture } = await setup({ notifications: redacted() });
    expect((fixture.nativeElement as HTMLElement).innerHTML).not.toContain('Q3 layoffs');
    expect((fixture.nativeElement as HTMLElement).innerHTML).not.toContain('Dana');
  });

  it('★★ cannot be probed for by searching the withheld title', async () => {
    // A row appearing for a query only its hidden title matches would turn the
    // search box into an oracle for the thing being withheld.
    const { c, fixture } = await setup({ notifications: redacted() });
    c.search.set('layoffs');
    fixture.detectChanges();
    expect(c.filteredItems()).toEqual([]);

    c.search.set('Dana');
    fixture.detectChanges();
    expect(c.filteredItems()).toEqual([]);
  });

  it('is findable by the placeholder it does show', async () => {
    const { c, fixture } = await setup({ notifications: redacted() });
    c.search.set('no longer available');
    fixture.detectChanges();
    expect(c.filteredItems().map((n) => n.id)).toEqual(['secret']);
  });

  it('takes the host label when one is given', async () => {
    const { c } = await setup({
      notifications: redacted(),
      redactedLabel: 'Hidden by permissions',
    });
    expect(c.filteredItems().find((n) => n.id === 'secret')!.title).toBe('Hidden by permissions');
  });

  it('★★ refuses an action click, which is public API', async () => {
    const { c } = await setup({ notifications: redacted() });
    let clicks = 0;
    c.actionClick.subscribe(() => clicks++);

    const row = c.filteredItems().find((n) => n.id === 'secret')!;
    c.onActionClick(row, 'open', new MouseEvent('click'));

    expect(clicks).toBe(0);
  });

  it('★ hands the host back its own row, not the redacted copy', async () => {
    // The host owns the real title and `redacted: true` with it — that is what
    // lets it decide what a click on such a row means.
    const { c } = await setup({ notifications: redacted() });
    const seen: NotificationItem[] = [];
    c.notificationClick.subscribe((e) => seen.push(e.notification));

    c.onNotificationClick(c.filteredItems().find((n) => n.id === 'secret')!);

    expect(seen).toHaveLength(1);
    expect(seen[0].title).toBe(SECRET);
    expect(seen[0].redacted).toBe(true);
    expect(seen[0].read).toBe(true);
  });

  it('★ can still be dismissed, and the host gets the real row', async () => {
    const { c } = await setup({ notifications: redacted() });
    const seen: NotificationItem[] = [];
    c.dismiss.subscribe((e) => seen.push(e.notification));

    c.onDismiss(c.filteredItems().find((n) => n.id === 'secret')!, new MouseEvent('click'));

    expect(seen[0].title).toBe(SECRET);
    expect(c.filteredItems().map((n) => n.id)).toEqual(['a']);
  });

  it('leaves every other row untouched', async () => {
    const { c } = await setup({ notifications: redacted() });
    const row = c.filteredItems().find((n) => n.id === 'a')!;
    expect(row.title).toBe('Notification a');
  });
});
