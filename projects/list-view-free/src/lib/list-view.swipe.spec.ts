import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { until } from '@testing/async';
import { SvListViewComponent } from './list-view.component';
import type { ListViewItem, ListViewSwipeAction, ListViewSwipeActionEvent } from './list-view.component';

/**
 * FL-F8 — swipe actions on list rows: start and end actions behind each row,
 * revealed by a horizontal swipe with thresholds, a full swipe that runs the
 * edge action, mirrored in right-to-left, and an Actions button that reaches
 * every action without a swipe (mouse, keyboard, screen reader).
 */

const ITEMS: ListViewItem[] = [
  { id: 1, title: 'Invoice overdue', subtitle: 'Acme Corp' },
  { id: 2, title: 'Weekly digest', subtitle: 'Product team' },
  { id: 3, title: 'Locked thread', disabled: true },
];

const START: ListViewSwipeAction[] = [{ id: 'read', label: 'Mark read', icon: 'mail', tone: 'primary' }];
const END: ListViewSwipeAction[] = [
  { id: 'delete', label: 'Delete', icon: 'trash', tone: 'danger' },
  { id: 'archive', label: 'Archive', icon: 'archive', tone: 'success' },
];

function pointer(type: string, target: EventTarget, x: number, y: number, t: number, pointerType = 'touch'): void {
  const e = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(e, { clientX: x, clientY: y, pointerType, pointerId: 1 });
  Object.defineProperty(e, 'timeStamp', { value: t });
  target.dispatchEvent(e);
}

/** A slow horizontal drag from x=200 by `dx` (physical px). */
function swipe(target: EventTarget, dx: number, pointerType = 'touch', ms = 800): void {
  pointer('pointerdown', target, 200, 30, 0, pointerType);
  for (let i = 1; i <= 8; i++) pointer('pointermove', document, 200 + (dx * i) / 8, 31, (ms * i) / 8, pointerType);
  pointer('pointerup', document, 200 + dx, 31, ms + 50, pointerType);
}

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const events: ListViewSwipeActionEvent[] = [];
  const { fixture } = await render(SvListViewComponent, {
    inputs: { items: ITEMS, swipeStartActions: START, swipeEndActions: END, ...inputs },
  });
  fixture.componentInstance.swipeAction.subscribe((e) => events.push(e));
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const surface = (id: number) => {
    const el = host.querySelector<HTMLElement>(`[data-lv-swipe-row="${id}"] [data-lv-swipe-surface]`)!;
    el.getBoundingClientRect = () => ({ top: 0, left: 0, width: 360, height: 68, right: 360, bottom: 68, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    return el;
  };
  const tray = (id: number, side: 'start' | 'end') =>
    host.querySelector<HTMLElement>(`[data-lv-swipe-row="${id}"] [data-lv-swipe-tray="${side}"]`);
  return { fixture, host, events, surface, tray };
}

describe('SvListViewComponent — swipe actions (FL-F8)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders the plain row markup when no swipe actions are set', async () => {
    const { host } = await setup({ swipeStartActions: [], swipeEndActions: [] });
    expect(host.querySelector('[data-lv-swipe-row]')).toBeNull();
    expect(host.querySelectorAll('[role="listitem"]').length).toBe(3);
  });

  it('★ the trays are inert and hidden from assistive technology until a row is opened', async () => {
    const { tray } = await setup();
    for (const side of ['start', 'end'] as const) {
      expect(tray(1, side)?.hasAttribute('inert')).toBe(true);
      expect(tray(1, side)?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('★ a swipe toward the start past half the tray opens the end actions', async () => {
    const { fixture, surface, tray, events } = await setup();
    swipe(surface(1), -120);
    fixture.detectChanges();
    // Two end actions × 76px — the row rests at the tray's width.
    expect(surface(1).style.transform).toBe('translate3d(-152px, 0, 0)');
    expect(tray(1, 'end')?.hasAttribute('inert')).toBe(false);
    expect(tray(1, 'end')?.getAttribute('aria-hidden')).toBeNull();
    expect(events).toEqual([]);
  });

  it('★ a swipe toward the end opens the start actions; a short drag springs back', async () => {
    const { fixture, surface, tray } = await setup();
    swipe(surface(1), 60);
    fixture.detectChanges();
    expect(surface(1).style.transform).toBe('translate3d(76px, 0, 0)');
    expect(tray(1, 'start')?.hasAttribute('inert')).toBe(false);
    swipe(surface(2), -30);
    fixture.detectChanges();
    expect(surface(2).style.transform).toBe('');
    // Opening another row closed the first.
    expect(surface(1).style.transform).toBe('');
  });

  it('★ a full swipe runs the edge action without a tap', async () => {
    const { fixture, surface, events } = await setup();
    swipe(surface(1), -260);
    fixture.detectChanges();
    expect(events.map((e) => [e.item.id, e.action.id, e.side, e.trigger])).toEqual([[1, 'delete', 'end', 'full-swipe']]);
    expect(surface(1).style.transform).toBe('');
  });

  it('fullSwipe="false" stops a long swipe at the tray', async () => {
    const { fixture, surface, events } = await setup({ fullSwipe: false });
    swipe(surface(1), -300);
    fixture.detectChanges();
    expect(events).toEqual([]);
    expect(surface(1).style.transform).toBe('translate3d(-152px, 0, 0)');
  });

  it('★ a tap on a revealed action runs it and closes the row', async () => {
    const { fixture, surface, tray, events } = await setup();
    swipe(surface(1), -120);
    fixture.detectChanges();
    tray(1, 'end')!.querySelector<HTMLButtonElement>('[data-lv-swipe-action="archive"]')!.click();
    fixture.detectChanges();
    expect(events.map((e) => [e.action.id, e.trigger])).toEqual([['archive', 'tap']]);
    expect(surface(1).style.transform).toBe('');
  });

  it('★ mirrors in right-to-left: a swipe to the left reveals the START actions', async () => {
    const { fixture, surface, tray } = await setup();
    const row = surface(1);
    row.style.direction = 'rtl';
    swipe(row, -60);
    fixture.detectChanges();
    expect(tray(1, 'start')?.hasAttribute('inert')).toBe(false);
    // Logical +76 is a physical move to the left in RTL.
    expect(row.style.transform).toBe('translate3d(-76px, 0, 0)');
  });

  it('★ a vertical drag never moves the row — the list keeps its scroll', async () => {
    const { fixture, surface } = await setup();
    const row = surface(1);
    pointer('pointerdown', row, 200, 30, 0);
    for (let i = 1; i <= 6; i++) pointer('pointermove', document, 202, 30 + i * 20, i * 50);
    pointer('pointerup', document, 202, 150, 400);
    fixture.detectChanges();
    expect(row.style.transform).toBe('');
  });

  it('a mouse drag does nothing — a mouse uses the Actions button', async () => {
    const { fixture, surface, events } = await setup();
    swipe(surface(1), -260, 'mouse');
    fixture.detectChanges();
    expect(surface(1).style.transform).toBe('');
    expect(events).toEqual([]);
  });

  it('a side with no actions does not move', async () => {
    const { fixture, surface } = await setup({ swipeStartActions: [] });
    swipe(surface(1), 200);
    fixture.detectChanges();
    expect(surface(1).style.transform).toBe('');
  });

  it('a tap on a row that is slid open closes it instead of activating it', async () => {
    const { fixture, surface, host } = await setup();
    let clicks = 0;
    fixture.componentInstance.itemClick.subscribe(() => clicks++);
    swipe(surface(2), -120);
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('[data-lv-swipe-row="2"] [data-lv-row-btn="1"]')!.click();
    fixture.detectChanges();
    expect(clicks).toBe(0);
    expect(surface(2).style.transform).toBe('');
  });

  it('disabled rows have no trays and no Actions button', async () => {
    const { host } = await setup();
    expect(host.querySelector('[data-lv-swipe-row="3"] [data-lv-swipe-tray]')).toBeNull();
    expect(host.querySelector('[data-lv-swipe-toggle="3"]')).toBeNull();
  });

  // ── Without a swipe ───────────────────────────────────────────────────────

  it('★ the Actions button opens every action as a strip, focus on the first', async () => {
    const { fixture, host } = await setup();
    const toggle = host.querySelector<HTMLButtonElement>('[data-lv-swipe-toggle="1"]')!;
    expect(toggle.getAttribute('aria-label')).toBe('Actions for Invoice overdue');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    const strip = host.querySelector<HTMLElement>('[data-lv-swipe-menu="1"]')!;
    expect(strip.getAttribute('role')).toBe('group');
    expect(strip.getAttribute('aria-label')).toBe('Actions for Invoice overdue');
    expect([...strip.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual(['Mark read', 'Delete', 'Archive', '']);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    await until(() => document.activeElement === strip.querySelector('button'), { label: 'focus on the first action' });
  });

  it('★ the strip: ←/→ move, Escape closes and returns focus to the Actions button', async () => {
    const { fixture, host } = await setup();
    host.querySelector<HTMLButtonElement>('[data-lv-swipe-toggle="1"]')!.click();
    fixture.detectChanges();
    const strip = host.querySelector<HTMLElement>('[data-lv-swipe-menu="1"]')!;
    const buttons = [...strip.querySelectorAll('button')];
    await until(() => document.activeElement === buttons[0], { label: 'focus on the first action' });
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(buttons[1]);
    buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(buttons[3]);
    buttons[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(host.querySelector('[data-lv-swipe-menu="1"]')).toBeNull();
    await until(() => document.activeElement === host.querySelector('[data-lv-swipe-toggle="1"]'), { label: 'focus back on the Actions button' });
  });

  it('★ clicking an action in the strip runs it with trigger "menu"', async () => {
    const { fixture, host, events } = await setup();
    host.querySelector<HTMLButtonElement>('[data-lv-swipe-toggle="2"]')!.click();
    fixture.detectChanges();
    const strip = host.querySelector<HTMLElement>('[data-lv-swipe-menu="2"]')!;
    [...strip.querySelectorAll('button')][2].click();
    fixture.detectChanges();
    expect(events.map((e) => [e.item.id, e.action.id, e.side, e.trigger])).toEqual([[2, 'archive', 'end', 'menu']]);
    expect(host.querySelector('[data-lv-swipe-menu="2"]')).toBeNull();
  });

  it('the strip keeps the list\'s arrow keys and type-to-jump out', async () => {
    const { fixture, host } = await setup();
    host.querySelector<HTMLButtonElement>('[data-lv-swipe-toggle="1"]')!.click();
    fixture.detectChanges();
    const strip = host.querySelector<HTMLElement>('[data-lv-swipe-menu="1"]')!;
    const spy = vi.spyOn(fixture.componentInstance, 'onRootKeydown');
    strip.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    strip.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('the Actions button is the row\'s roving tab stop partner, not an extra stop per row', async () => {
    const { host } = await setup();
    const stops = [...host.querySelectorAll('[data-lv-swipe-toggle]')].map((b) => b.getAttribute('tabindex'));
    expect(stops).toEqual(['0', '-1']);
  });

  it('closeSwipe() slides an open row shut', async () => {
    const { fixture, surface } = await setup();
    swipe(surface(1), -120);
    fixture.detectChanges();
    fixture.componentInstance.closeSwipe();
    fixture.detectChanges();
    expect(surface(1).style.transform).toBe('');
  });
});
