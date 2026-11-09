import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { svResetBodyScrollLock } from '@styloviz/core/overlay';
import { until } from '@testing/async';
import {
  SvActionSheetComponent,
  type SvActionSheetAction,
  type SvActionSheetCloseReason,
  type SvActionSheetSelection,
} from './action-sheet.component';

/**
 * FL-F8 — `sv-action-sheet`: the drawer's bottom sheet with a WAI-ARIA menu in
 * it. A choice, Cancel, Escape, a tap on the scrim and a swipe down each close
 * it, and every one of them returns focus to whatever opened it.
 */

const ACTIONS: readonly SvActionSheetAction[] = [
  { id: 'share', label: 'Share', icon: 'share' },
  { id: 'copy', label: 'Copy link', icon: 'link' },
  { id: 'archive', label: 'Archive', description: 'Hidden from the list, kept for a year.', disabled: true },
  { id: 'delete', label: 'Delete', icon: 'trash', destructive: true },
];

const sheet = () => document.body.querySelector<HTMLElement>('[data-sv-action-sheet]');
const items = () => [...document.body.querySelectorAll<HTMLButtonElement>('[data-sv-action-sheet-item]')];
const cancel = () => document.body.querySelector<HTMLButtonElement>('[data-sv-action-sheet-cancel]');
const root = () => document.body.querySelector<HTMLElement>('[data-sv-action-sheet-root]');

function key(target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

function pointer(type: string, target: EventTarget, x: number, y: number, t: number, pointerType = 'touch'): void {
  const e = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(e, { clientX: x, clientY: y, pointerType, pointerId: 1 });
  Object.defineProperty(e, 'timeStamp', { value: t });
  target.dispatchEvent(e);
}

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const opener = document.createElement('button');
  opener.textContent = 'More';
  document.body.appendChild(opener);
  opener.focus();
  const chosen: SvActionSheetSelection[] = [];
  const closed: SvActionSheetCloseReason[] = [];
  const view = await render(SvActionSheetComponent, {
    inputs: { title: 'Invoice INV-2041', actions: ACTIONS, ...inputs } as never,
  });
  const c = view.fixture.componentInstance;
  c.actionSelect.subscribe((s) => chosen.push(s));
  c.closed.subscribe((r) => closed.push(r));
  const open = async () => {
    view.fixture.componentRef.setInput('open', true);
    view.fixture.detectChanges();
    await until(() => document.activeElement?.hasAttribute('data-sv-action-sheet-item') === true, { label: 'focus on the first choice' });
  };
  return { ...view, c, opener, chosen, closed, open };
}

afterEach(() => {
  TestBed.resetTestingModule();
  svResetBodyScrollLock(document);
  document.body.innerHTML = '';
});

describe('SvActionSheetComponent', () => {
  it('★ renders nothing until opened, then a modal dialog in <body> named by its title', async () => {
    const { open } = await setup({ description: 'Due 12 Nov' });
    expect(sheet()).toBeNull();
    await open();
    const dialog = sheet()!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Invoice INV-2041');
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe('Due 12 Nov');
    expect(dialog.closest('[data-sv-portal]')?.parentElement).toBe(document.body);
  });

  it('★ is a menu of menuitems with one tab stop, focus on the first choice', async () => {
    const { open } = await setup();
    await open();
    const menu = document.body.querySelector('[role="menu"]')!;
    expect(menu.getAttribute('aria-orientation')).toBe('vertical');
    expect(items().map((b) => b.getAttribute('role'))).toEqual(['menuitem', 'menuitem', 'menuitem', 'menuitem']);
    expect(items().map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
    expect(document.activeElement).toBe(items()[0]);
  });

  it('★ ↓/↑ move and wrap, Home/End jump, a letter jumps to the next match', async () => {
    const { open } = await setup();
    await open();
    key(items()[0], 'ArrowDown');
    expect(document.activeElement).toBe(items()[1]);
    key(items()[1], 'ArrowUp');
    key(items()[0], 'ArrowUp');
    expect(document.activeElement).toBe(items()[3]);
    key(items()[3], 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    key(items()[0], 'End');
    expect(document.activeElement).toBe(items()[3]);
    key(items()[3], 'Home');
    expect(document.activeElement).toBe(items()[0]);
    key(items()[0], 'c');
    expect(document.activeElement).toBe(items()[1]);
    expect(items()[1].getAttribute('tabindex')).toBe('0');
  });

  it('★ a choice emits actionSelect, closes with "action" and returns focus to the opener', async () => {
    const { open, c, chosen, closed, opener } = await setup();
    await open();
    items()[1].click();
    expect(chosen.map((s) => [s.action.id, s.index])).toEqual([['copy', 1]]);
    expect(closed).toEqual(['action']);
    expect(c.open()).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('a disabled choice stays focusable, says so, and does nothing', async () => {
    const { open, c, chosen } = await setup();
    await open();
    const archive = items()[2];
    expect(archive.getAttribute('aria-disabled')).toBe('true');
    expect(archive.hasAttribute('disabled')).toBe(false);
    archive.click();
    expect(chosen).toEqual([]);
    expect(c.open()).toBe(true);
  });

  it('a destructive choice is drawn in the danger tone and announced as destructive', async () => {
    const { open } = await setup();
    await open();
    const del = items()[3];
    expect(del.className).toContain('text-danger-700');
    expect(del.querySelector('.sr-only')?.textContent).toBe('(destructive)');
  });

  it('★ the Cancel button closes it with "cancel" and returns focus', async () => {
    const { open, closed, opener } = await setup();
    await open();
    expect(cancel()?.textContent?.trim()).toBe('Cancel');
    cancel()!.click();
    expect(closed).toEqual(['cancel']);
    expect(document.activeElement).toBe(opener);
  });

  it('Escape closes it with "escape" — unless closeOnEscape is off', async () => {
    const first = await setup({ closeOnEscape: false });
    await first.open();
    key(items()[0], 'Escape');
    expect(first.c.open()).toBe(true);
    first.fixture.destroy();

    const second = await setup();
    await second.open();
    const e = key(items()[0], 'Escape');
    expect(e.defaultPrevented).toBe(true);
    expect(second.closed).toEqual(['escape']);
    expect(document.activeElement).toBe(second.opener);
  });

  it('★ a tap on the scrim closes it with "backdrop"; a press that started on the panel does not', async () => {
    const { open, closed } = await setup();
    await open();
    // Pressed on the panel, released on the scrim — a slipped scroll, not a tap.
    pointer('pointerdown', sheet()!, 10, 10, 0, 'mouse');
    root()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(closed).toEqual([]);
    pointer('pointerdown', root()!, 10, 10, 0, 'mouse');
    root()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(closed).toEqual(['backdrop']);
  });

  it('closeOnBackdrop="false" keeps it open on a scrim tap', async () => {
    const { open, c } = await setup({ closeOnBackdrop: false });
    await open();
    pointer('pointerdown', root()!, 10, 10, 0, 'mouse');
    root()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(c.open()).toBe(true);
  });

  it('★ Tab cycles between the menu and Cancel — focus never leaves the sheet', async () => {
    const { open } = await setup();
    await open();
    cancel()!.focus();
    const wrap = key(cancel()!, 'Tab');
    expect(wrap.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(items()[0]);
    const back = key(items()[0], 'Tab', { shiftKey: true });
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cancel());
  });

  it('★ a swipe down on the handle follows the finger and closes past a third', async () => {
    const { open, c, closed, fixture } = await setup();
    await open();
    const handle = document.body.querySelector<HTMLElement>('[data-sv-action-sheet-handle]')!;
    sheet()!.getBoundingClientRect = () => ({ top: 400, left: 0, width: 400, height: 300, right: 400, bottom: 700, x: 0, y: 400, toJSON: () => ({}) }) as DOMRect;
    pointer('pointerdown', handle, 200, 410, 0);
    pointer('pointermove', document, 200, 440, 200);
    pointer('pointermove', document, 200, 470, 400);
    fixture.detectChanges();
    expect(sheet()!.style.transform).toBe('translateY(60px)');
    pointer('pointermove', document, 200, 560, 600);
    pointer('pointerup', document, 200, 560, 800);
    expect(c.open()).toBe(false);
    expect(closed).toEqual(['swipe']);
  });

  it('springs back from a short drag, and a mouse drag never moves it', async () => {
    const { open, c, fixture } = await setup();
    await open();
    const handle = document.body.querySelector<HTMLElement>('[data-sv-action-sheet-handle]')!;
    // jsdom lays nothing out: a 0px sheet would make any drag pass the one-third threshold.
    sheet()!.getBoundingClientRect = () => ({ top: 400, left: 0, width: 400, height: 300, right: 400, bottom: 700, x: 0, y: 400, toJSON: () => ({}) }) as DOMRect;
    pointer('pointerdown', handle, 200, 410, 0);
    pointer('pointermove', document, 200, 430, 300);
    pointer('pointerup', document, 200, 430, 600);
    fixture.detectChanges();
    expect(c.open()).toBe(true);
    expect(sheet()!.style.transform).toBe('');

    pointer('pointerdown', handle, 200, 410, 0, 'mouse');
    pointer('pointermove', document, 200, 700, 100, 'mouse');
    pointer('pointerup', document, 200, 700, 200, 'mouse');
    expect(c.open()).toBe(true);
  });

  it('swipeToClose="false" turns the gesture off', async () => {
    const { open, c } = await setup({ swipeToClose: false });
    await open();
    const handle = document.body.querySelector<HTMLElement>('[data-sv-action-sheet-handle]')!;
    pointer('pointerdown', handle, 200, 410, 0);
    pointer('pointermove', document, 200, 700, 50);
    pointer('pointerup', document, 200, 700, 60);
    expect(c.open()).toBe(true);
  });

  it('locks the page scroll while open and releases it on close', async () => {
    const { open, c } = await setup();
    await open();
    expect(document.body.style.overflow).toBe('hidden');
    c.close();
    expect(document.body.style.overflow).toBe('');
  });

  it('★ under reduced motion the portal goes at once; otherwise after the slide', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
    try {
      const { open, c } = await setup();
      await open();
      c.close();
      await until(() => sheet() === null, { label: 'the sheet was removed' });
    } finally {
      window.matchMedia = original;
    }
  });

  it('the panel is inert during its exit slide, and removed afterwards', async () => {
    const { open, c } = await setup();
    await open();
    c.close('programmatic');
    // The attribute is a binding: it lands on the next change detection, well inside the slide.
    await until(() => sheet()?.hasAttribute('inert') === true, { label: 'inert during the slide' });
    await until(() => sheet() === null, { label: 'removed after the slide', timeoutMs: 2000 });
  });

  it('names itself from ariaLabel (or the "Actions" label) when it has no title', async () => {
    const { open } = await setup({ title: '' });
    await open();
    expect(sheet()!.getAttribute('aria-label')).toBe('Actions');
  });

  it('takes its Cancel text from cancelLabel, and can drop the button', async () => {
    const first = await setup({ cancelLabel: 'Keep it' });
    await first.open();
    expect(cancel()?.textContent?.trim()).toBe('Keep it');
    first.fixture.destroy();
    document.body.innerHTML = '';
    const second = await setup({ showCancel: false });
    await second.open();
    expect(cancel()).toBeNull();
  });

  it('★ destroyed while open: no orphaned portal, the scroll lock released', async () => {
    const { open, fixture } = await setup();
    await open();
    fixture.destroy();
    expect(sheet()).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});
