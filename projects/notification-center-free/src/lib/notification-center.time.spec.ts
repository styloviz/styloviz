import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvNotificationCenterComponent } from './notification-center.component';
import type { NotificationItem } from './notification-center.types';

/**
 * ============================================================================
 *  Relative time, and the day a notification is filed under
 * ============================================================================
 *
 * ★ The suite runs at Pacific/Marquesas (−09:30) on purpose, so a date read
 * with UTC getters lands on the wrong calendar day here. Both helpers below are
 * therefore driven from LOCAL wall-clock times built with `new Date(y, m, d, h)`
 * — never `new Date('2026-03-15')`, which is UTC midnight and reads as 14 March
 * in this timezone.
 *
 * The grouping headings were genuinely wrong before this file existed: they
 * counted 24-hour windows back from "now" rather than calendar days, so a
 * notification from 23:00 last night was filed under "Today" at 10:00 the next
 * morning. See the tests named for it.
 */

/** 10:00 local on Sunday 15 March 2026 — the "now" every test below reads from. */
const NOW = new Date(2026, 2, 15, 10, 0, 0);

/** A local wall-clock instant, expressed the way a server would send it. */
const at = (y: number, m: number, d: number, h = 0, min = 0, sec = 0): string =>
  new Date(y, m, d, h, min, sec).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvNotificationCenterComponent, {
    inputs: { variant: 'inline', notifications: [], ...inputs },
  });
  return fixture.componentInstance;
}

describe('SvNotificationCenterComponent — relative time', () => {
  it('says "just now" for the last minute and counts minutes after that', async () => {
    const c = await setup();
    expect(c.timeAgo(at(2026, 2, 15, 9, 59, 1))).toBe('just now');
    // Exactly a minute is already a minute, not "just now".
    expect(c.timeAgo(at(2026, 2, 15, 9, 59, 0))).toBe('1m ago');
    expect(c.timeAgo(at(2026, 2, 15, 9, 58))).toBe('2m ago');
    expect(c.timeAgo(at(2026, 2, 15, 9, 11))).toBe('49m ago');
  });

  it('switches to hours at the hour boundary', async () => {
    const c = await setup();
    expect(c.timeAgo(at(2026, 2, 15, 9, 0))).toBe('1h ago');
    expect(c.timeAgo(at(2026, 2, 14, 12, 0))).toBe('22h ago');
  });

  it('switches to days at the day boundary', async () => {
    const c = await setup();
    expect(c.timeAgo(at(2026, 2, 14, 9, 0))).toBe('1d ago');
    expect(c.timeAgo(at(2026, 2, 9, 10, 0))).toBe('6d ago');
  });

  /**
   * Past a week it becomes a date. The assertion is that it is the LOCAL date —
   * at −09:30 an instant just after local midnight is still the previous day in
   * UTC, and a UTC-formatted label would name the wrong day.
   */
  it('falls back to a local calendar date past a week', async () => {
    const c = await setup();
    const iso = at(2026, 1, 20, 0, 30); // 00:30 local on 20 February
    const label = c.timeAgo(iso);
    expect(label).not.toMatch(/ago/);
    expect(label).toBe(new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    expect(label).toContain('20');
  });
});

describe('SvNotificationCenterComponent — which day a notification belongs to', () => {
  it('files this morning under Today', async () => {
    const c = await setup();
    expect(c.dateLabel(at(2026, 2, 15, 9, 0))).toBe('Today');
    expect(c.dateLabel(at(2026, 2, 15, 0, 5))).toBe('Today');
  });

  /**
   * ★ THE REGRESSION. 23:00 last night is 11 elapsed hours ago, which the old
   * `Math.floor(elapsed / 86400000)` scored as 0 and filed under "Today". It is
   * yesterday's news to the person reading it.
   */
  it('files last night under Yesterday, not Today', async () => {
    const c = await setup();
    expect(c.dateLabel(at(2026, 2, 14, 23, 0))).toBe('Yesterday');
    expect(c.dateLabel(at(2026, 2, 14, 0, 1))).toBe('Yesterday');
  });

  /** The same defect one day further out: 38 elapsed hours used to floor to 1. */
  it('does not file the day before yesterday under Yesterday', async () => {
    const c = await setup();
    expect(c.dateLabel(at(2026, 2, 13, 20, 0))).toBe('This week');
  });

  it('files the rest of the week, the month and everything older', async () => {
    const c = await setup();
    expect(c.dateLabel(at(2026, 2, 9, 10, 0))).toBe('This week');   // 6 days
    expect(c.dateLabel(at(2026, 2, 8, 10, 0))).toBe('Earlier this month'); // 7 days
    expect(c.dateLabel(at(2026, 1, 14, 10, 0))).toBe('Earlier this month'); // 29 days
    expect(c.dateLabel(at(2026, 1, 13, 10, 0))).toBe('Older'); // 30 days
  });

  /**
   * A server clock a few minutes ahead of the browser's is common. It must not
   * push tonight's notification into "This week" — a negative difference used
   * to fall straight through to the `< 7` arm.
   */
  it('files a slightly future timestamp under Today', async () => {
    const c = await setup();
    expect(c.dateLabel(at(2026, 2, 15, 10, 5))).toBe('Today');
  });

  /** The boundary is the reader's midnight, so 00:00 and 23:59 of one day agree. */
  it('treats a whole local day as one group', async () => {
    const c = await setup();
    expect(c.dateLabel(at(2026, 2, 14, 0, 0))).toBe('Yesterday');
    expect(c.dateLabel(at(2026, 2, 14, 23, 59))).toBe('Yesterday');
  });
});

/**
 * ★ Twin divergence: the free tier ships only `dropdown` and `inline`, so there
 * is no `grouped` variant to render these headings. `groupedItems()` is still
 * part of the component's API — a host building its own layout reads it — and
 * it is still built on the same `dateLabel`, so the same defect lived here.
 */
describe('SvNotificationCenterComponent — grouping by day', () => {
  const note = (id: string, iso: string): NotificationItem => ({
    id,
    type: 'comment',
    title: `Notification ${id}`,
    timestamp: iso,
    read: false,
  });

  it('puts each notification under its own heading, newest group first', async () => {
    const c = await setup({
      notifications: [
        note('older', at(2026, 1, 1, 12, 0)),
        note('today', at(2026, 2, 15, 9, 0)),
        note('week', at(2026, 2, 11, 9, 0)),
        note('lastnight', at(2026, 2, 14, 23, 0)),
      ],
    });
    expect(c.groupedItems().map((g) => g.label)).toEqual([
      'Today',
      'Yesterday',
      'This week',
      'Older',
    ]);
    // The 23:00 row is the whole point: it must not share a heading with today's.
    expect(c.groupedItems()[0].items.map((n) => n.id)).toEqual(['today']);
    expect(c.groupedItems()[1].items.map((n) => n.id)).toEqual(['lastnight']);
  });

  it('collects several notifications into one heading', async () => {
    const c = await setup({
      notifications: [
        note('a', at(2026, 2, 15, 9, 0)),
        note('b', at(2026, 2, 15, 8, 0)),
        note('c', at(2026, 2, 15, 1, 0)),
      ],
    });
    expect(c.groupedItems()).toHaveLength(1);
    // Newest first inside the group, from the shared sort.
    expect(c.groupedItems()[0].items.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('produces no headings at all for an empty list', async () => {
    const c = await setup();
    expect(c.groupedItems()).toEqual([]);
  });

  /** The headings follow the filter, so a filtered-out day must not leave an empty heading. */
  it('drops a heading whose only notification was filtered out', async () => {
    const c = await setup({
      notifications: [
        { ...note('read-today', at(2026, 2, 15, 9, 0)), read: true },
        note('unread-yesterday', at(2026, 2, 14, 9, 0)),
      ],
      activeTab: 'Unread',
    });
    expect(c.groupedItems().map((g) => g.label)).toEqual(['Yesterday']);
  });
});
