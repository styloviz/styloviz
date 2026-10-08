import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvSegmentedControlComponent } from './segmented-control.component';
import type { SegmentOption } from './segmented-control.component';

/**
 * `FI-22-I1` / `FI-22-M1` — the same row of buttons is two different widgets.
 *
 * ── The defect ──────────────────────────────────────────────────────────────
 *
 * ★★★ THIS COMPONENT HARD-CODED `radiogroup`. A `radiogroup` SETS A VALUE —
 *     "Monthly / Yearly" on a pricing form is an answer that gets submitted. A
 *     `tablist` CONTROLS VISIBLE CONTENT — "Overview / Activity / Settings"
 *     swaps a panel and answers nothing. Every tab strip built with this control
 *     therefore told a screen-reader user they were answering a question, and
 *     gave them no way to reach the panel, because a radio has no
 *     `aria-controls` and there is no tabpanel relationship to follow.
 *
 * ★★ Nothing about it looked wrong, which is why it stayed that way. The two
 *    render identically; they differ only in what they claim.
 *
 * ── What actually differs ───────────────────────────────────────────────────
 *
 *   radiogroup  role=radiogroup / radio · aria-checked · has an error slot
 *   tablist     role=tablist / tab      · aria-selected · aria-controls → panel
 *                                       · no error slot: a tablist has no value
 *                                         to reject
 */

const OPTIONS: SegmentOption[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const TABS: SegmentOption[] = [
  { value: 'overview', label: 'Overview', controls: 'panel-overview' },
  { value: 'activity', label: 'Activity', controls: 'panel-activity' },
  { value: 'settings', label: 'Settings', controls: 'panel-settings' },
];

async function setup(inputs: Partial<ComponentInput<SvSegmentedControlComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvSegmentedControlComponent, {
    inputs: { options: OPTIONS, ...inputs } as ComponentInput<SvSegmentedControlComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const segs = (h: HTMLElement) => [...h.querySelectorAll<HTMLElement>('[data-seg]')];
const seg = (h: HTMLElement, v: string) => h.querySelector<HTMLElement>(`[data-seg="${v}"]`)!;
const press = (t: HTMLElement, key: string) =>
  t.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

describe('SvSegmentedControlComponent — radiogroup stays the default', () => {
  it('is unchanged for every caller that says nothing', async () => {
    const { fixture } = await setup({ value: 'week', ariaLabel: 'Range' });
    const host = el(fixture);
    expect(host.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    expect(seg(host, 'week').getAttribute('aria-checked')).toBe('true');
    expect(seg(host, 'week').getAttribute('aria-selected')).toBeNull();
  });

  it('carries no tab ids or aria-controls it cannot honour', async () => {
    const { fixture } = await setup({ options: TABS, value: 'overview' });
    const s = seg(el(fixture), 'overview');
    expect(s.getAttribute('aria-controls')).toBeNull();
    expect(s.getAttribute('id')).toBeNull();
  });
});

describe('SvSegmentedControlComponent — tablist', () => {
  it('is a tablist of tabs, with aria-selected rather than aria-checked', async () => {
    const { fixture } = await setup({ options: TABS, value: 'activity', semantics: 'tablist' });
    const host = el(fixture);
    expect(host.querySelector('[role="tablist"]')).not.toBeNull();
    expect(segs(host).every(s => s.getAttribute('role') === 'tab')).toBe(true);
    expect(seg(host, 'activity').getAttribute('aria-selected')).toBe('true');
    expect(seg(host, 'activity').getAttribute('aria-checked')).toBeNull();
    expect(seg(host, 'overview').getAttribute('aria-selected')).toBe('false');
  });

  it('points each tab at the panel it controls', async () => {
    // ★★ Without this a tab is a button that looks like a tab: the reader is
    //    told a panel exists and given no way to reach it.
    const { fixture } = await setup({ options: TABS, value: 'overview', semantics: 'tablist' });
    expect(seg(el(fixture), 'settings').getAttribute('aria-controls')).toBe('panel-settings');
  });

  it('uses the host-supplied tab id when there is one', async () => {
    // ★★ Host-supplied because the relationship is two-way: the panel needs
    //    `aria-labelledby` pointing back, and a host reaching in for a generated
    //    id needs a `viewChild`, which breaks the moment a page renders two of
    //    these.
    const withIds = TABS.map(t => ({ ...t, tabId: `tab-${t.value}` }));
    const { fixture } = await setup({ options: withIds, value: 'overview', semantics: 'tablist' });
    expect(seg(el(fixture), 'activity').getAttribute('id')).toBe('tab-activity');
    expect(fixture.componentInstance.tabIdFor('activity')).toBe('tab-activity');
  });

  it('falls back to a generated id, so a tab is never unnameable', async () => {
    const { fixture } = await setup({ options: TABS, value: 'overview', semantics: 'tablist' });
    const id = seg(el(fixture), 'activity').getAttribute('id');
    expect(id).toBeTruthy();
    expect(fixture.componentInstance.tabIdFor('activity')).toBe(id);
  });

  it('drops the error slot, because a tablist has no value to reject', async () => {
    const { fixture } = await setup({
      options: TABS, value: 'overview', semantics: 'tablist', errorMessage: 'Pick one',
    });
    const host = el(fixture);
    expect(host.textContent).not.toContain('Pick one');
    expect(host.querySelector('[role="tablist"]')?.getAttribute('aria-invalid')).toBeNull();
  });

  it('keeps the error slot for a radiogroup', async () => {
    const { fixture } = await setup({ value: 'day', errorMessage: 'Pick one' });
    expect(el(fixture).textContent).toContain('Pick one');
  });
});

describe('SvSegmentedControlComponent — activation', () => {
  it('selects as you arrow, by default, the way the APG recommends', async () => {
    const { fixture } = await setup({ options: TABS, value: 'overview', semantics: 'tablist' });
    press(seg(el(fixture), 'overview'), 'ArrowRight');
    expect(fixture.componentInstance.value()).toBe('activity');
  });

  it('moves without selecting when panels are expensive', async () => {
    // ★★★ Arrowing across four tabs under automatic activation is four panel
    //     loads to reach one — the same shape as a filter chip that turns itself
    //     on as you scan past it.
    const { fixture } = await setup({
      options: TABS, value: 'overview', semantics: 'tablist', activation: 'manual',
    });
    const host = el(fixture);
    press(seg(host, 'overview'), 'ArrowRight');
    expect(fixture.componentInstance.value()).toBe('overview');
    press(seg(host, 'activity'), 'ArrowRight');
    expect(fixture.componentInstance.value()).toBe('overview');
    // Enter commits what the arrows reached.
    press(seg(host, 'settings'), 'Enter');
    expect(fixture.componentInstance.value()).toBe('settings');
  });

  it('moves the tab stop with the focus under manual activation', async () => {
    // ★★ Otherwise Tab returns to the still-selected tab and the tab the user
    //    arrowed to becomes unreachable — a roving set with two claims on the
    //    stop is worse than one with none.
    const { fixture } = await setup({
      options: TABS, value: 'overview', semantics: 'tablist', activation: 'manual',
    });
    const host = el(fixture);
    press(seg(host, 'overview'), 'ArrowRight');
    fixture.detectChanges();
    expect(seg(host, 'activity').getAttribute('tabindex')).toBe('0');
    expect(seg(host, 'overview').getAttribute('tabindex')).toBe('-1');
  });

  it('settles the tab stop back onto whatever gets selected', async () => {
    const { fixture } = await setup({
      options: TABS, value: 'overview', semantics: 'tablist', activation: 'manual',
    });
    const host = el(fixture);
    press(seg(host, 'overview'), 'ArrowRight');
    seg(host, 'settings').click();
    fixture.detectChanges();
    expect(seg(host, 'settings').getAttribute('tabindex')).toBe('0');
    expect(seg(host, 'activity').getAttribute('tabindex')).toBe('-1');
  });

  it('ignores manual activation for a radiogroup — selection follows focus there', async () => {
    // ★★ Not a default somebody chose: it IS the radio pattern. Honouring
    //    `manual` here would produce a radiogroup that looks right and announces
    //    a state the user never set.
    const { fixture } = await setup({ value: 'day', activation: 'manual' });
    press(seg(el(fixture), 'day'), 'ArrowRight');
    expect(fixture.componentInstance.value()).toBe('week');
  });
});

describe('SvSegmentedControlComponent — tablist badge (re-verified 2026-09-26)', () => {
  it('tints the badge on the selected TAB, which carries aria-selected rather than aria-checked', async () => {
    // The badge's active tint was keyed off `button[aria-checked=true]` only, so
    // in tablist mode the selected tab's badge stayed grey.
    const { fixture } = await setup({
      options: [{ ...TABS[0], badge: 3 }, TABS[1]],
      value: 'overview',
      semantics: 'tablist',
    });
    const badge = seg(el(fixture), 'overview').querySelector('span:last-child')!;
    expect(badge.textContent!.trim()).toBe('3');
    expect(badge.className).toContain('[button[aria-selected=true]_&]:bg-primary-100');
    expect(badge.className).toContain('[button[aria-checked=true]_&]:bg-primary-100');
  });
});
