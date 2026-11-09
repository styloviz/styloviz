import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvNotificationCenterComponent } from './notification-center.component';
import type { NotificationItem } from './notification-center.types';
import { until } from '../../../../src/testing/async';

/**
 * `SR-10` — the search box's wrapper was `pt-3` only. In the dropdown and
 * inline variants the tabs bar below it supplies the gap and the separator, so
 * a host passing `[tabs]="[]"` got the input flush against the list.
 */
const note = (id: string, timestamp: string): NotificationItem => ({
  id, type: 'comment', title: `Notification ${id}`, timestamp, read: false,
});

const NOTES = [note('today', new Date().toISOString()), note('old', '2020-01-01T10:00:00Z')];

afterEach(() => document.querySelectorAll('[data-nc-portal]').forEach((n) => n.remove()));

/** The wrapper around the search input: input → div.relative → wrapper. */
function searchWrapper(root: ParentNode): HTMLElement {
  const input = root.querySelector<HTMLInputElement>('input[type="search"]');
  expect(input, 'the search box is rendered').not.toBeNull();
  return input!.parentElement!.parentElement!;
}

async function mount(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvNotificationCenterComponent, { inputs: { notifications: NOTES, ...inputs } });
  return fixture.nativeElement as HTMLElement;
}

async function openPanel(host: HTMLElement): Promise<ParentNode> {
  await userEvent.click(host.querySelector<HTMLButtonElement>('[aria-label="Open notifications"]')!);
  // Wait for the panel's CONTENT, not just the portal host: a host can mount
  // before the view inside it has rendered.
  await until(() => document.querySelector('[data-nc-portal] input[type="search"]') !== null, {
    label: 'the panel search box to render',
  });
  return document.querySelector('[data-nc-portal]')!;
}

describe('SvNotificationCenterComponent — search box spacing (SR-10)', () => {
  it('dropdown with tabs=[]: the search wrapper owns its bottom gap and separator', async () => {
    const panel = await openPanel(await mount({ variant: 'dropdown', tabs: [] }));
    const wrapper = searchWrapper(panel);
    expect(wrapper.classList).toContain('pb-3');
    expect(wrapper.classList).toContain('border-b');
  });

  it('dropdown with tabs: the tabs bar keeps supplying the gap, so no extra padding', async () => {
    const panel = await openPanel(await mount({ variant: 'dropdown' }));
    const wrapper = searchWrapper(panel);
    expect(wrapper.classList).not.toContain('pb-3');
    expect(wrapper.classList).not.toContain('border-b');
  });

  it('inline with tabs=[]: the search wrapper owns its bottom gap and separator', async () => {
    const wrapper = searchWrapper(await mount({ variant: 'inline', tabs: [] }));
    expect(wrapper.classList).toContain('pb-3');
    expect(wrapper.classList).toContain('border-b');
  });
});
