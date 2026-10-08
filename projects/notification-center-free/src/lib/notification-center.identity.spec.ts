import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvNotificationCenterComponent } from './notification-center.component';
import type { NotificationItem } from './notification-center.types';

/**
 * `X-12` / `OF-10-I3` / `OF-10-I5` / `OF-10-M1` / `OF-10-M4` — the free twin.
 *
 * The identity contract is not a premium feature: the free panel tracks by
 * `item.id` too, so a duplicate id throws there exactly as it does in Pro. The
 * rules themselves live in `svMergeRecords` and are tested in
 * `record-merge.node.spec.ts`; this is the twin applying them.
 */

const note = (id: string, over: Partial<NotificationItem> = {}): NotificationItem => ({
  id,
  type: 'comment',
  title: `Notification ${id}`,
  timestamp: new Date(2026, 2, 15, 9, 0).toISOString(),
  read: false,
  ...over,
});

const at = (d: number, h = 9) => new Date(2026, 2, d, h, 0).toISOString();

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvNotificationCenterComponent, {
    inputs: { variant: 'inline', notifications: [], ...inputs },
  });
  return fixture.componentInstance;
}

const ids = (c: SvNotificationCenterComponent) => c.filteredItems().map((n) => n.id);

describe('SvNotificationCenterComponent (free) — identity and order', () => {
  it('renders one row for a repeated id, keeping the higher version', async () => {
    const c = await setup({
      notifications: [note('a', { version: 5, title: 'v5' }), note('a', { version: 2, title: 'v2' })],
    });
    expect(ids(c)).toEqual(['a']);
    expect(c.filteredItems()[0].title).toBe('v5');
  });

  it('collapses rows sharing a dedupeKey, keeping the newest', async () => {
    const c = await setup({
      notifications: [
        note('c1', { dedupeKey: 'ticket-14', timestamp: at(10) }),
        note('c2', { dedupeKey: 'ticket-14', timestamp: at(12) }),
      ],
    });
    expect(ids(c)).toEqual(['c2']);
  });

  it('uses seq when every row has one', async () => {
    const c = await setup({
      notifications: [note('a', { seq: 1, timestamp: at(20) }), note('b', { seq: 2, timestamp: at(10) })],
    });
    expect(ids(c)).toEqual(['b', 'a']);
  });

  it('sorts an unparseable timestamp last', async () => {
    const c = await setup({
      notifications: [note('bad', { timestamp: 'n/a' }), note('ok', { timestamp: at(10) })],
    });
    expect(ids(c)).toEqual(['ok', 'bad']);
  });

  it('still puts pinned rows first', async () => {
    const c = await setup({
      notifications: [note('new', { timestamp: at(20) }), note('pin', { timestamp: at(1), pinned: true })],
    });
    expect(ids(c)).toEqual(['pin', 'new']);
  });
});
