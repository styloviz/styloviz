import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvNotificationCenterComponent } from './notification-center.component';
import type { NotificationItem } from './notification-center.types';

/**
 * ============================================================================
 *  `sv-notification-center` (free) — one row's async state (`OF-10-M2`)
 * ============================================================================
 *
 * ★★★ WHY THIS IS IN THE FREE TIER AT ALL. `pendingIds` already was, and the
 *     error half is the other side of the same contract: a free component
 *     with a documented "this row is saving" state and no way to say the save
 *     FAILED is the asymmetry the item is about. `check:parity` asked the
 *     question — declare it Pro-only, or give the free twin the same members —
 *     and the honest answer was the second one.
 *
 * The Pro spec covers the rule in depth, including the variant whose row is
 * itself the click target. This file exists so the free twin's copy is
 * verified rather than assumed.
 */

const note = (id: string): NotificationItem => ({
  id,
  type: 'comment',
  title: `Notification ${id}`,
  timestamp: '2026-07-20T10:00:00Z',
  read: false,
});

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvNotificationCenterComponent, {
    inputs: { variant: 'inline', notifications: [note('a'), note('b')], ...inputs },
  });
  return { c: fixture.componentInstance, fixture };
}

const errorRow = () => document.querySelector('[data-sv-state="item-error"]') as HTMLElement | null;
const retryBtn = () => document.querySelector('[data-sv-item-retry]') as HTMLButtonElement | null;

describe('sv-notification-center (free) — per-row async state', () => {
  it('dims and marks a pending row', async () => {
    const { c } = await setup({ pendingIds: ['a'] });
    expect(c.rowStateClass(note('a'))).toContain('opacity-60');
    expect(c.rowStateClass(note('b'))).toBe('');
    expect(document.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
  });

  it('renders a failed write on its row, as an alert, with a retry', async () => {
    const { c } = await setup({ itemErrors: { a: 'Could not mark as read.' } });
    expect(errorRow()?.textContent).toContain('Could not mark as read.');
    expect(errorRow()?.getAttribute('role')).toBe('alert');

    const retried: string[] = [];
    c.retryItem.subscribe((item) => retried.push(item.id));
    retryBtn()!.click();
    expect(retried).toEqual(['a']);
  });

  it('keeps a row failure out of the feed-level error state', async () => {
    await setup({ itemErrors: { a: 'Could not dismiss.' } });
    expect(document.querySelector('[data-sv-state="error"]')).toBeNull();
  });

  it('refuses to retry a row whose write is still in flight', async () => {
    const { c } = await setup({ itemErrors: { a: 'Could not dismiss.' }, pendingIds: ['a'] });
    const retried: string[] = [];
    c.retryItem.subscribe((item) => retried.push(item.id));
    c.onRetryItem(note('a'));
    expect(retried).toEqual([]);
  });
});
