import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { render } from '@testing-library/angular';
import { afterEach, vi } from 'vitest';
import { svResetWarnOnce } from '@styloviz/core';
import { until } from '@testing/async';
import { SvToolbarComponent } from './toolbar.component';
import type { ToolbarAction, ToolbarGroup } from './toolbar.component';

/**
 * `sv-toolbar` — the overflow menu's edges: where the panel goes when the More
 * button sits low or far right, the keys and clicks that do and do not close
 * it, the scroll re-anchor, and the overflow split when the actions come in
 * groups rather than a flat list.
 *
 * Geometry at `size="md"`: a 32px button, 4px gaps, 12px of chrome — six plain
 * actions need 224px, and at 160px three fit beside the More button.
 */

const ACTIONS: readonly ToolbarAction[] = [
  { id: 'a', label: 'Alpha', icon: 'a' },
  { id: 'b', label: 'Bravo', icon: 'b' },
  { id: 'c', label: 'Charlie', icon: 'c' },
  { id: 'd', label: 'Delta', icon: 'd' },
  { id: 'e', label: 'Echo', icon: 'e', disabled: true },
  { id: 'f', label: 'Foxtrot', icon: 'f', toggle: true },
];

interface Box { top: number; left: number; width: number; height: number }

function rect({ top, left, width, height }: Box): DOMRect {
  return {
    x: left, y: top, top, left, width, height, right: left + width, bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

/** The host is `width` wide; the More button sits at `moreAt`; anything else is a 32px box. */
function geometry(width: number, moreAt: Box = { top: 0, left: 0, width: 32, height: 32 }): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.tagName === 'SV-TOOLBAR') return rect({ top: 0, left: 0, width, height: 40 });
    if (this.hasAttribute('data-sv-toolbar-more')) return rect(moreAt);
    return rect({ top: 0, left: 0, width: 32, height: 32 });
  });
}

@Component({
  standalone: true,
  imports: [SvToolbarComponent],
  template: `<sv-toolbar overflow="menu" label="Editor" [actions]="actions()" [groups]="groups()"
                         [busyIds]="busy()" />
             <button type="button" data-testid="outside">Outside</button>`,
})
class Host {
  readonly actions = signal<readonly ToolbarAction[]>(ACTIONS);
  readonly groups = signal<readonly ToolbarGroup[]>([]);
  readonly busy = signal<readonly string[]>([]);
}

async function setup(width = 160, moreAt?: Box, init?: (h: Host) => void): Promise<ComponentFixture<Host>> {
  geometry(width, moreAt);
  TestBed.resetTestingModule();
  const { fixture } = await render(Host, { detectChangesOnRender: false });
  init?.(fixture.componentInstance);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

const tb = (f: ComponentFixture<Host>) =>
  f.debugElement.query(By.directive(SvToolbarComponent)).componentInstance as SvToolbarComponent;
const host = (f: ComponentFixture<Host>) => (f.nativeElement as HTMLElement).querySelector('sv-toolbar') as HTMLElement;
const inline = (f: ComponentFixture<Host>) =>
  [...host(f).querySelectorAll<HTMLElement>('[data-sv-toolbar-index]')].map((b) => b.dataset['actionId']);
const separators = (f: ComponentFixture<Host>) => host(f).querySelectorAll('[role="separator"]').length;
const more = (f: ComponentFixture<Host>) => host(f).querySelector<HTMLButtonElement>('[data-sv-toolbar-more]') as HTMLButtonElement;
const outside = (f: ComponentFixture<Host>) =>
  (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="outside"]') as HTMLButtonElement;
const menu = () => document.body.querySelector<HTMLElement>('[role="menu"]');
const items = () => [...document.body.querySelectorAll<HTMLButtonElement>('[data-sv-toolbar-menuitem]')];
const press = (key: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });

async function open(f: ComponentFixture<Host>): Promise<void> {
  more(f).click();
  f.detectChanges();
  await f.whenStable();
}

async function settle(f: ComponentFixture<Host>): Promise<void> {
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.querySelectorAll('.sv-toolbar-menu-portal').forEach((n) => n.remove());
});

// ── Where the panel goes ─────────────────────────────────────────────────────

describe('SvToolbarComponent — panel placement', () => {
  it('drops below a More button near the top-left and lines up on its left edge', async () => {
    const f = await setup(160, { top: 10, left: 4, width: 32, height: 32 });
    await open(f);
    const panel = menu() as HTMLElement;
    expect(panel.style.position).toBe('fixed');
    expect(panel.style.top).toBe('48px'); // bottom 42 + 6px gap
    expect(panel.style.bottom).toBe('');
    expect(panel.style.left).toBe('8px'); // clamped to the margin
    expect(panel.style.right).toBe('');
  });

  it('opens upward from a More button near the bottom, aligned to its right edge', async () => {
    // jsdom's viewport is 1024 × 768.
    const f = await setup(160, { top: 700, left: 900, width: 32, height: 32 });
    await open(f);
    const panel = menu() as HTMLElement;
    expect(panel.style.top).toBe('');
    expect(panel.style.bottom).toBe(`${768 - 700 + 6}px`);
    expect(panel.style.right).toBe(`${1024 - 932}px`);
    expect(panel.style.left).toBe('');
    expect(panel.style.maxWidth).toBe(`${932 - 8}px`);
    expect(panel.style.minWidth).toBe('160px');
    // The height is clamped to the room above, within the hard ceiling.
    expect(panel.style.maxHeight).toBe('320px');
  });
});

// ── Opening and closing ──────────────────────────────────────────────────────

describe('SvToolbarComponent — what opens and closes the menu', () => {
  it('toggles closed on a second click of More, handing focus back to it', async () => {
    const f = await setup();
    await open(f);
    expect(menu()).toBeTruthy();
    more(f).click();
    f.detectChanges();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(more(f));
    expect(more(f).getAttribute('aria-expanded')).toBe('false');
  });

  it('does not open a second panel when asked to open while already open', async () => {
    const f = await setup();
    await open(f);
    tb(f).openMenu('last');
    expect(document.body.querySelectorAll('[role="menu"]')).toHaveLength(1);
  });

  it('refuses to open when nothing has overflowed', async () => {
    const f = await setup(400);
    tb(f).openMenu();
    expect(menu()).toBeNull();
    expect(tb(f).menuOpen()).toBe(false);
  });

  it('ignores a close when nothing is open, and an Escape when nothing is open', async () => {
    const f = await setup();
    const before = document.activeElement;
    tb(f).closeMenu(true);
    document.dispatchEvent(press('Escape'));
    expect(document.activeElement).toBe(before);
    expect(tb(f).menuOpen()).toBe(false);
  });

  it('stays open for a mousedown on the toolbar itself', async () => {
    const f = await setup();
    await open(f);
    host(f).querySelector('[data-action-id="a"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu()).toBeTruthy();
  });

  it('closes on a window resize, without stealing focus back', async () => {
    const f = await setup();
    await open(f);
    outside(f).focus();
    window.dispatchEvent(new Event('resize'));
    f.detectChanges();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(outside(f));
  });

  it('a resize with the menu shut changes nothing', async () => {
    const f = await setup();
    window.dispatchEvent(new Event('resize'));
    expect(tb(f).menuOpen()).toBe(false);
    expect(more(f)).toBeTruthy();
  });
});

// ── Keys inside the menu ─────────────────────────────────────────────────────

describe('SvToolbarComponent — keys inside the menu', () => {
  it('closes on Tab, putting focus back on More so the browser continues from the toolbar', async () => {
    const f = await setup();
    await open(f);
    items()[0].dispatchEvent(press('Tab'));
    f.detectChanges();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(more(f));
  });

  it('steps Up one item at a time from the bottom', async () => {
    const f = await setup(120); // two inline: c, d, e, f in the menu
    await open(f);
    expect(items().map((b) => b.textContent?.trim())).toEqual(['Charlie', 'Delta', 'Echo', 'Foxtrot']);
    const [charlie, delta, , foxtrot] = items();
    foxtrot.focus();
    foxtrot.dispatchEvent(press('ArrowUp'));
    expect(document.activeElement).toBe(delta);
    delta.dispatchEvent(press('ArrowUp'));
    expect(document.activeElement).toBe(charlie);
  });

  it('leaves letters and other keys to the page', async () => {
    const f = await setup();
    await open(f);
    const ev = press('x');
    items()[0].dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(menu()).toBeTruthy();
  });

  it('does nothing with keys when every item in it is busy', async () => {
    const f = await setup();
    await open(f);
    f.componentInstance.busy.set(['d', 'f']);
    await settle(f);
    expect(items().every((b) => b.disabled)).toBe(true);
    const ev = press('ArrowDown');
    menu()!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('opening onto a menu of only busy items lands focus nowhere inside it', async () => {
    const f = await setup(160, undefined, (h) => h.busy.set(['d', 'f']));
    more(f).focus();
    await open(f);
    expect(menu()).toBeTruthy();
    expect(items().some((b) => b === document.activeElement)).toBe(false);
  });
});

// ── Focus bookkeeping in the menu ────────────────────────────────────────────

describe('SvToolbarComponent — focus leaving the menu', () => {
  it('forgets the item once focus really leaves, so a later removal does not pull it back', async () => {
    const f = await setup();
    await open(f);
    items()[0].focus();
    outside(f).focus(); // a real exit: relatedTarget is outside the panel

    f.componentInstance.actions.set(ACTIONS.filter((a) => a.id !== 'd'));
    await settle(f);
    expect(document.activeElement).toBe(outside(f));
  });

  it('focus on the panel itself is not an item', async () => {
    const f = await setup();
    await open(f);
    const panel = menu() as HTMLElement;
    panel.focus();
    expect(document.activeElement).toBe(panel);
    // Nothing was remembered, so a data change does not move focus off the panel.
    f.componentInstance.busy.set(['f']);
    await settle(f);
    expect(document.activeElement).toBe(panel);
  });

  it('a menu emptied while focus is outside it does not pull focus into the toolbar', async () => {
    const f = await setup();
    await open(f);
    outside(f).focus();
    f.componentInstance.actions.set(ACTIONS.slice(0, 3));
    await settle(f);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(outside(f));
  });
});

// ── Scroll re-anchoring ──────────────────────────────────────────────────────

describe('SvToolbarComponent — re-anchoring on scroll', () => {
  it('follows the More button when an ancestor scrolls', async () => {
    const box: Box = { top: 10, left: 4, width: 32, height: 32 };
    const f = await setup(160, box);
    await open(f);
    expect(menu()!.style.top).toBe('48px');

    box.top = 110; // the page scrolled the button down by 100px
    document.body.dispatchEvent(new Event('scroll'));
    document.body.dispatchEvent(new Event('scroll'));
    await until(() => menu()!.style.top === '148px', { label: 'the panel re-anchored' });
  });

  it('cancels a re-anchor frame queued before closing, and that frame moves nothing if it runs anyway', async () => {
    const box: Box = { top: 10, left: 4, width: 32, height: 32 };
    const f = await setup(160, box);
    await open(f);
    const panel = menu() as HTMLElement;
    expect(panel.style.top).toBe('48px');

    // Hold the frame instead of letting the browser run it.
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb) + 4240);
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    box.top = 110;
    document.body.dispatchEvent(new Event('scroll'));
    expect(frames).toHaveLength(1);

    more(f).click(); // close
    f.detectChanges();
    expect(menu()).toBeNull();
    expect(cancel).toHaveBeenCalledWith(4241);

    // A frame the browser had already dispatched: it must not resurrect or
    // re-position anything.
    frames[0](0);
    f.detectChanges();
    expect(menu()).toBeNull();
    expect(panel.style.top).toBe('48px');
    expect(more(f).getAttribute('aria-expanded')).toBe('false');
  });
});

// ── Groups in menu mode ──────────────────────────────────────────────────────

describe('SvToolbarComponent — groups in menu mode', () => {
  const GROUPS: readonly ToolbarGroup[] = [
    { id: 'g1', actions: ACTIONS.slice(0, 2) },
    { id: 'empty', actions: [] },
    { id: 'g2', actions: ACTIONS.slice(2, 4) },
  ];

  it('counts the group separators and an empty group when splitting', async () => {
    // Everything inline: 12 + 4×32 + 2 separators×5 + 5 gaps×4 = 170.
    const wide = await setup(170, undefined, (h) => { h.actions.set([]); h.groups.set(GROUPS); });
    expect(inline(wide)).toEqual(['a', 'b', 'c', 'd']);
    expect(separators(wide)).toBe(2);

    // One pixel short. Three beside More would need 170 again (the group
    // separator after b still counts), so two fit — and the separator that
    // would sit between b and More is not drawn.
    const narrow = await setup(169, undefined, (h) => { h.actions.set([]); h.groups.set(GROUPS); });
    expect(inline(narrow)).toEqual(['a', 'b']);
    expect(more(narrow)).toBeTruthy();
    expect(separators(narrow)).toBe(1); // only the empty group's own
  });

  it('collapses to the More button alone when even one action does not fit', async () => {
    const f = await setup(50);
    expect(inline(f)).toEqual([]);
    expect(more(f).getAttribute('tabindex')).toBe('0');
    await open(f);
    expect(items()).toHaveLength(6);
    expect(items().filter((b) => b.disabled).map((b) => b.dataset['actionId'])).toEqual(['e']);
  });

  it('warns about two groups sharing an id', async () => {
    svResetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup(400, undefined, (h) => {
      h.actions.set([]);
      h.groups.set([{ id: 'g', actions: ACTIONS.slice(0, 1) }, { id: 'g', actions: ACTIONS.slice(1, 2) }]);
    });
    expect(warn.mock.calls.some((c) => String(c[0]).includes('two groups share the id "g"'))).toBe(true);
  });
});

// ── Public API on objects the toolbar does not hold ──────────────────────────

describe('SvToolbarComponent — public API with an equal-but-new action', () => {
  it('answers by id when identity is unknown', async () => {
    const f = await setup(400);
    const copy: ToolbarAction = { ...ACTIONS[0] };
    expect(tb(f).indexOf(copy)).toBe(-1);
    expect(tb(f).tabIndexFor(copy)).toBe(0);
    expect(tb(f).tabIndexFor({ ...ACTIONS[1] })).toBe(-1);
  });
});

// ── A focus report racing a re-render ────────────────────────────────────────

describe('SvToolbarComponent — focus on a button that is no longer a tab stop', () => {
  it('ignores focus on a button the toolbar has just moved into the menu, before it re-renders', async () => {
    // The toolbar learns its width from a ResizeObserver; hold its callback.
    const reports: ResizeObserverCallback[] = [];
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: ResizeObserverCallback) { reports.push(cb); }
      observe(): void { /* reported by hand below */ }
      unobserve(): void { /* nothing to undo */ }
      disconnect(): void { /* nothing to undo */ }
    });
    const f = await setup(400);
    expect(inline(f)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    const delta = host(f).querySelector<HTMLButtonElement>('[data-action-id="d"]')!;

    // The container narrows to 160px: Delta now belongs in the More menu, but
    // its inline button is still on screen until the next render — and focus
    // lands on it in that window.
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
    const entry = { borderBoxSize: [{ inlineSize: 160, blockSize: 40 }] } as unknown as ResizeObserverEntry;
    reports.forEach((report) => report([entry], {} as ResizeObserver));
    raf.mockRestore();
    frames.forEach((frame) => frame(0));
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent): void => { errors.push(e.error); };
    window.addEventListener('error', onError);
    delta.focus();
    window.removeEventListener('error', onError);
    expect(errors).toEqual([]);

    await settle(f);
    expect(inline(f)).toEqual(['a', 'b', 'c']);
    // The stray focus report did not move the tab stop.
    expect(host(f).querySelector('[data-action-id="a"]')!.getAttribute('tabindex')).toBe('0');
  });
});
