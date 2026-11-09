import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core/dev';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SV_LINK_ADAPTER, type SvLinkAdapter, type SvLinkTarget } from '@styloviz/core/nav';
import { provideSvIcons } from '@styloviz/icons';
import { calendarIcon } from '@styloviz/icons/glyph/calendar';
import { folderIcon } from '@styloviz/icons/glyph/folder';
import { homeIcon } from '@styloviz/icons/glyph/home';
import { inboxIcon } from '@styloviz/icons/glyph/inbox';
import { settingsIcon } from '@styloviz/icons/glyph/settings';
import { afterEach, beforeEach, vi } from 'vitest';
import { SvDockComponent, type SvDockItem, type SvDockPosition, type SvDockSelection } from './dock.component';

/**
 * FL-F15 — `sv-dock`. A toolbar by APG (one tab stop, arrows along the dock,
 * Home/End, Enter/Space), real links and buttons, and a transform-only swell
 * that follows the pointer and keyboard focus and stops under reduced motion.
 */

const ITEMS: SvDockItem[] = [
  { id: 'home', label: 'Home', icon: 'home', route: '/app' },
  { id: 'inbox', label: 'Inbox', icon: 'inbox', route: '/app/inbox', badge: 3 },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'files', label: 'Files', icon: 'folder', disabled: true },
  { id: 'settings', label: 'Settings', icon: 'settings', route: '/app/settings' },
];

function adapter() {
  const went: SvLinkTarget[] = [];
  const value: SvLinkAdapter = {
    kind: 'spec',
    href: (target) => {
      const path = typeof target === 'string' ? target : target.join('/');
      return /^\s*javascript:/i.test(path) ? null : path;
    },
    navigate: (target) => {
      went.push(target);
      return true;
    },
  };
  return { went, value };
}

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
function reducedMotion(reduce: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

async function setup(inputs: Partial<ComponentInput<SvDockComponent>> = {}, providers: unknown[] = []) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const links = adapter();
  const picked: SvDockSelection[] = [];
  const { fixture } = await render(SvDockComponent, {
    inputs: { items: ITEMS, ...inputs } as ComponentInput<SvDockComponent>,
    providers: [
      { provide: SV_LINK_ADAPTER, useValue: links.value },
      provideSvIcons([homeIcon, inboxIcon, calendarIcon, folderIcon, settingsIcon]),
      ...(providers as never[]),
    ],
  });
  fixture.componentInstance.itemSelect.subscribe((e) => picked.push(e));
  fixture.detectChanges();
  return { fixture, went: links.went, picked };
}

type Fx = ComponentFixture<unknown> | { nativeElement: unknown };
const el = (f: Fx) => f.nativeElement as HTMLElement;
const toolbar = (f: Fx) => el(f).querySelector('[role="toolbar"]') as HTMLElement;
const controls = (f: Fx) => [...el(f).querySelectorAll<HTMLElement>('[data-sv-dock-control]')];
const nameOf = (c: HTMLElement) => c.querySelector('.sr-only')?.textContent?.replace(/\s+/g, ' ').trim();
const tabStops = (f: Fx) => controls(f).filter((c) => c.getAttribute('tabindex') === '0');
const key = (target: HTMLElement, k: string) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
};

afterEach(() => {
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  else Reflect.deleteProperty(window, 'matchMedia');
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

describe('SvDockComponent — a toolbar of real links and buttons', () => {
  it('★ renders a named toolbar: links for routes, buttons for actions', async () => {
    const { fixture } = await setup();
    expect(toolbar(fixture).getAttribute('aria-label')).toBe('Dock');
    expect(toolbar(fixture).getAttribute('aria-orientation')).toBe('horizontal');
    expect(controls(fixture).map((c) => c.tagName)).toEqual(['A', 'A', 'BUTTON', 'BUTTON', 'A']);
    expect(controls(fixture)[0].getAttribute('href')).toBe('/app');
    expect(controls(fixture)[2].getAttribute('type')).toBe('button');
  });

  it('names every icon-only item by its label, with the badge after it', async () => {
    const { fixture } = await setup();
    expect(controls(fixture).map(nameOf)).toEqual(['Home', 'Inbox, 3', 'Calendar', 'Files', 'Settings']);
    // The tooltip and the badge are decorative — the name already says them.
    for (const tip of el(fixture).querySelectorAll('[data-sv-dock-tip]')) expect(tip.getAttribute('aria-hidden')).toBe('true');
    expect(el(fixture).querySelector('[data-sv-dock-badge]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the label on hover AND on focus, never hover only', async () => {
    const { fixture } = await setup();
    const tip = el(fixture).querySelector('[data-sv-dock-tip]') as HTMLElement;
    expect(tip.classList.contains('group-hover:opacity-100')).toBe(true);
    expect(tip.classList.contains('group-focus-within:opacity-100')).toBe(true);
    expect(tip.textContent?.trim()).toBe('Home');
  });

  it('Escape hides the label until focus moves on (WCAG 1.4.13)', async () => {
    const { fixture } = await setup();
    const [first, second] = controls(fixture);
    first.focus();
    const e = key(first, 'Escape');
    fixture.detectChanges();
    expect(e.defaultPrevented).toBe(true);
    expect(el(fixture).querySelector('[data-sv-dock-tip]')?.classList.contains('invisible')).toBe(true);
    key(first, 'ArrowRight');
    fixture.detectChanges();
    expect(document.activeElement).toBe(second);
    expect(el(fixture).querySelector('[data-sv-dock-tip]')?.classList.contains('invisible')).toBe(false);
  });

  it('takes its name from ariaLabel, then from the labels an app provides', async () => {
    let v = await setup({ ariaLabel: 'Apps' });
    expect(toolbar(v.fixture).getAttribute('aria-label')).toBe('Apps');
    v = await setup({}, [provideSvLabels({ layout: { dock: 'Schnellstart' } })]);
    expect(toolbar(v.fixture).getAttribute('aria-label')).toBe('Schnellstart');
  });
});

describe('SvDockComponent — position', () => {
  const cases: [SvDockPosition, 'horizontal' | 'vertical', string, string][] = [
    ['bottom', 'horizontal', 'bottom-3', 'origin-bottom'],
    ['top', 'horizontal', 'top-3', 'origin-top'],
    ['left', 'vertical', 'left-3', 'origin-left'],
    ['right', 'vertical', 'right-3', 'origin-right'],
  ];

  it.each(cases)('%s: %s, pinned to that edge, items grow away from it', async (position, orientation, edge, origin) => {
    const { fixture } = await setup({ position });
    expect(toolbar(fixture).getAttribute('aria-orientation')).toBe(orientation);
    expect(el(fixture).getAttribute('data-sv-dock-position')).toBe(position);
    expect(el(fixture).classList.contains('absolute')).toBe(true);
    expect(el(fixture).classList.contains(edge)).toBe(true);
    expect(controls(fixture)[0].classList.contains(origin)).toBe(true);
    const list = el(fixture).querySelector('[data-sv-dock-list]') as HTMLElement;
    expect(list.classList.contains(orientation === 'vertical' ? 'flex-col' : 'flex-row')).toBe(true);
  });

  it('static placement stays in the flow', async () => {
    const { fixture } = await setup({ placement: 'static' });
    expect(el(fixture).classList.contains('absolute')).toBe(false);
    expect(el(fixture).classList.contains('relative')).toBe(true);
  });

  it('sizes the items from the size scale', async () => {
    const { fixture } = await setup({ size: 'lg' });
    expect(controls(fixture)[0].classList.contains('h-14')).toBe(true);
  });
});

describe('SvDockComponent — roving keyboard (APG toolbar)', () => {
  it('★ has one tab stop — the current page, else the first item', async () => {
    let v = await setup();
    expect(tabStops(v.fixture)).toEqual([controls(v.fixture)[0]]);
    v = await setup({ activeRoute: '/app/settings' });
    expect(tabStops(v.fixture)).toEqual([controls(v.fixture)[4]]);
  });

  it('ArrowRight / ArrowLeft move along a horizontal dock and wrap; Up/Down are left alone', async () => {
    const { fixture } = await setup();
    const c = controls(fixture);
    c[0].focus();
    key(c[0], 'ArrowRight');
    fixture.detectChanges();
    expect(document.activeElement).toBe(c[1]);
    expect(tabStops(fixture)).toEqual([c[1]]);
    key(c[1], 'ArrowLeft');
    key(c[0], 'ArrowLeft');
    expect(document.activeElement).toBe(c[4]);
    const down = key(c[4], 'ArrowDown');
    expect(down.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(c[4]);
  });

  it('Home and End go to the ends', async () => {
    const { fixture } = await setup();
    const c = controls(fixture);
    c[2].focus();
    key(c[2], 'End');
    expect(document.activeElement).toBe(c[4]);
    key(c[4], 'Home');
    expect(document.activeElement).toBe(c[0]);
  });

  it('a vertical dock moves with ArrowDown / ArrowUp and ignores Left/Right', async () => {
    const { fixture } = await setup({ position: 'left' });
    const c = controls(fixture);
    c[0].focus();
    key(c[0], 'ArrowDown');
    expect(document.activeElement).toBe(c[1]);
    key(c[1], 'ArrowUp');
    expect(document.activeElement).toBe(c[0]);
    expect(key(c[0], 'ArrowRight').defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(c[0]);
  });

  it('★ under dir="rtl" the arrows follow what the eye sees: ArrowLeft is the next item', async () => {
    @Component({
      standalone: true,
      imports: [SvDockComponent],
      template: `<div dir="rtl"><sv-dock [items]="items" /></div>`,
    })
    class RtlHost {
      readonly items = ITEMS;
    }
    TestBed.resetTestingModule();
    const { fixture } = await render(RtlHost, {
      providers: [provideSvIcons([homeIcon, inboxIcon, calendarIcon, folderIcon, settingsIcon])],
    });
    const c = controls(fixture);
    c[0].focus();
    key(c[0], 'ArrowLeft');
    expect(document.activeElement).toBe(c[1]);
    key(c[1], 'ArrowRight');
    expect(document.activeElement).toBe(c[0]);
  });

  it('a disabled item stays focusable and is announced unavailable (APG: discoverable)', async () => {
    const { fixture } = await setup();
    const c = controls(fixture);
    c[2].focus();
    key(c[2], 'ArrowRight');
    expect(document.activeElement).toBe(c[3]);
    expect(c[3].getAttribute('aria-disabled')).toBe('true');
    expect(c[3].hasAttribute('disabled')).toBe(false);
  });
});

describe('SvDockComponent — activation', () => {
  it('★ a click reports source "pointer"; a keyboard click (detail 0) reports "keyboard"', async () => {
    const { fixture, picked } = await setup();
    const c = controls(fixture);
    c[2].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    c[2].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    expect(picked.map((p) => [p.item.id, p.index, p.source])).toEqual([
      ['calendar', 2, 'pointer'],
      ['calendar', 2, 'keyboard'],
    ]);
  });

  it('Space activates a link as it does a button', async () => {
    const { fixture, picked, went } = await setup();
    const c = controls(fixture);
    c[1].focus();
    const e = key(c[1], ' ');
    expect(e.defaultPrevented).toBe(true);
    expect(picked.map((p) => [p.item.id, p.source])).toEqual([['inbox', 'keyboard']]);
    expect(went).toEqual(['/app/inbox']);
  });

  it('a routed item navigates through the link adapter, which cancels the browser’s own', async () => {
    const { fixture, went } = await setup();
    const e = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    controls(fixture)[0].dispatchEvent(e);
    expect(went).toEqual(['/app']);
    expect(e.defaultPrevented).toBe(true);
  });

  it('a modified click on a link is the browser’s: no navigation, no event', async () => {
    const { fixture, went, picked } = await setup();
    const e = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, ctrlKey: true });
    // Read what the dock decided, then stop jsdom from attempting the navigation itself.
    let preventedByDock: boolean | null = null;
    toolbar(fixture).addEventListener('click', (ev) => {
      preventedByDock = ev.defaultPrevented;
      ev.preventDefault();
    });
    controls(fixture)[0].dispatchEvent(e);
    expect(went).toEqual([]);
    expect(picked).toEqual([]);
    expect(preventedByDock).toBe(false);
  });

  it('★ a disabled item never activates', async () => {
    const { fixture, picked } = await setup();
    const e = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
    controls(fixture)[3].dispatchEvent(e);
    expect(picked).toEqual([]);
    expect(e.defaultPrevented).toBe(true);
  });

  it('marks the current page with aria-current and a dot — longest route wins', async () => {
    const { fixture } = await setup({ activeRoute: '/app/inbox/42' });
    expect(controls(fixture).map((c) => c.getAttribute('aria-current'))).toEqual([null, 'page', null, null, null]);
    expect(el(fixture).querySelectorAll('[data-sv-dock-current]').length).toBe(1);
  });
});

describe('SvDockComponent — safe links', () => {
  const UNSAFE: SvDockItem[] = [
    { id: 'evil', label: 'Evil', icon: 'home', href: 'javascript:alert(1)' },
    { id: 'split', label: 'Split', icon: 'home', href: 'java\tscript:alert(1)' },
    { id: 'route', label: 'Route', icon: 'home', route: 'javascript:alert(1)' },
    { id: 'docs', label: 'Docs', icon: 'home', href: 'https://example.com/docs', external: true },
  ];

  it('★ refuses a javascript: href or route — no href attribute, rendered unavailable', async () => {
    const { fixture, picked } = await setup({ items: UNSAFE });
    const c = controls(fixture);
    for (const bad of c.slice(0, 3)) {
      expect(bad.hasAttribute('href')).toBe(false);
      expect(bad.getAttribute('role')).toBe('link');
      expect(bad.getAttribute('aria-disabled')).toBe('true');
    }
    expect(el(fixture).innerHTML).not.toMatch(/javascript:/i);
    c[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    expect(picked).toEqual([]);
  });

  it('opens an external href in a new tab, safely, and says so', async () => {
    const { fixture } = await setup({ items: UNSAFE });
    const docs = controls(fixture)[3];
    expect(docs.getAttribute('href')).toBe('https://example.com/docs');
    expect(docs.getAttribute('target')).toBe('_blank');
    expect(docs.getAttribute('rel')).toBe('noopener noreferrer');
    expect(nameOf(docs)).toBe('Docs (opens in a new tab)');
  });

  it('loads only a safe image', async () => {
    const { fixture } = await setup({
      items: [
        { id: 'a', label: 'App', image: '/assets/app.png' },
        { id: 'b', label: 'Bad', image: 'javascript:alert(1)' },
      ],
    });
    const imgs = el(fixture).querySelectorAll('img');
    expect(imgs.length).toBe(1);
    expect(imgs[0].getAttribute('src')).toBe('/assets/app.png');
    expect(imgs[0].getAttribute('alt')).toBe('');
    // The item without a usable image falls back to its initial, still named by its label.
    expect(nameOf(controls(fixture)[1])).toBe('Bad');
  });
});

describe('SvDockComponent — magnification', () => {
  function stubRect(f: Fx, width: number, height: number): void {
    const list = el(f).querySelector('[data-sv-dock-list]') as HTMLElement;
    const bar = toolbar(f);
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, width, height));
    vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(new DOMRect(-8, -8, width + 16, height + 16));
  }
  const move = (f: Fx, x: number, y = 24, pointerType = 'mouse') => {
    const e = new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(e, 'pointerType', { value: pointerType });
    toolbar(f).dispatchEvent(e);
  };
  const transforms = (f: Fx) => controls(f).map((c) => c.style.transform);

  it('★ scales the item under the pointer most, its neighbours less, by transform only', async () => {
    const { fixture } = await setup();
    stubRect(fixture, 5 * 48 + 4 * 8, 48);
    move(fixture, 2 * 56 + 24); // centre of item 2
    fixture.detectChanges();
    const scale = (s: string) => Number(/scale\(([\d.]+)\)/.exec(s)?.[1] ?? 1);
    const s = transforms(fixture).map(scale);
    expect(s[2]).toBeCloseTo(1.6, 2);
    expect(s[1]).toBeGreaterThan(1);
    expect(s[1]).toBeLessThan(s[2]);
    expect(s[1]).toBeCloseTo(s[3], 3);
    // Neighbours make room by translating, not by changing size.
    const items = [...el(fixture).querySelectorAll<HTMLElement>('[data-sv-dock-item]')];
    expect(items[0].style.transform).toMatch(/^translate3d\(-/);
    expect(items[4].style.transform).toMatch(/^translate3d\(\d/);
    expect(items.every((i) => i.style.width === '' && i.style.height === '')).toBe(true);
    expect((el(fixture).querySelector('[data-sv-dock-backdrop]') as HTMLElement).style.transform).toMatch(/^scaleX\(/);
  });

  it('settles back when the pointer leaves', async () => {
    const { fixture } = await setup();
    stubRect(fixture, 5 * 48 + 4 * 8, 48);
    move(fixture, 24);
    fixture.detectChanges();
    expect(transforms(fixture)[0]).not.toBe('');
    toolbar(fixture).dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(transforms(fixture).every((t) => t === '')).toBe(true);
  });

  it('ignores touch — there is no hover to follow', async () => {
    const { fixture } = await setup();
    stubRect(fixture, 5 * 48 + 4 * 8, 48);
    move(fixture, 24, 24, 'touch');
    fixture.detectChanges();
    expect(transforms(fixture).every((t) => t === '')).toBe(true);
  });

  it('★ follows keyboard focus too', async () => {
    const { fixture } = await setup();
    const c = controls(fixture);
    c[0].focus();
    key(c[0], 'ArrowRight');
    fixture.detectChanges();
    expect(c[1].style.transform).toMatch(/scale\(1\.6\)/);
  });

  it('★ under prefers-reduced-motion nothing moves: no transform at all', async () => {
    reducedMotion(true);
    const { fixture } = await setup();
    expect(toolbar(fixture).getAttribute('data-sv-dock-magnify')).toBe('off');
    stubRect(fixture, 5 * 48 + 4 * 8, 48);
    move(fixture, 2 * 56 + 24);
    const c = controls(fixture);
    c[0].focus();
    key(c[0], 'ArrowRight');
    fixture.detectChanges();
    const styled = [...el(fixture).querySelectorAll<HTMLElement>('[data-sv-dock] *')].filter((n) => n.style.transform !== '');
    expect(styled).toEqual([]);
  });

  it('magnification=false and a scale of 1 also keep it still', async () => {
    for (const inputs of [{ magnification: false }, { magnificationScale: 1 }]) {
      const { fixture } = await setup(inputs);
      stubRect(fixture, 5 * 48 + 4 * 8, 48);
      move(fixture, 24);
      fixture.detectChanges();
      expect(transforms(fixture).every((t) => t === '')).toBe(true);
    }
  });

  it('clamps an oversized scale to 2', async () => {
    const { fixture } = await setup({ magnificationScale: 9 });
    stubRect(fixture, 5 * 48 + 4 * 8, 48);
    move(fixture, 24);
    fixture.detectChanges();
    expect(transforms(fixture)[0]).toBe('scale(2)');
  });
});

describe('SvDockComponent — identity', () => {
  it('tracks items by itemKey, so a refreshed array keeps the focused element', async () => {
    @Component({
      standalone: true,
      imports: [SvDockComponent],
      template: `<sv-dock [items]="items()" />`,
    })
    class Host {
      readonly items = signal<SvDockItem[]>(ITEMS);
    }
    TestBed.resetTestingModule();
    const { fixture } = await render(Host, {
      providers: [provideSvIcons([homeIcon, inboxIcon, calendarIcon, folderIcon, settingsIcon])],
    });
    const before = controls(fixture)[2];
    fixture.componentInstance.items.set(ITEMS.map((i) => ({ ...i })));
    fixture.detectChanges();
    expect(controls(fixture)[2]).toBe(before);
  });
});

describe('SvDockComponent — fits its container (WCAG 1.4.10)', () => {
  /** A ResizeObserver whose callback the spec fires after stubbing the container's size. */
  let resize: (() => void) | null = null;
  const originalRO = globalThis.ResizeObserver;
  beforeEach(() => {
    resize = null;
    globalThis.ResizeObserver = class {
      constructor(cb: () => void) {
        resize = cb;
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  });
  afterEach(() => {
    globalThis.ResizeObserver = originalRO;
  });

  async function inContainer(width: number, height: number, inputs: Partial<ComponentInput<SvDockComponent>> = {}) {
    const v = await setup(inputs);
    const parent = el(v.fixture).parentElement as HTMLElement;
    Object.defineProperty(parent, 'clientWidth', { configurable: true, value: width });
    Object.defineProperty(parent, 'clientHeight', { configurable: true, value: height });
    resize?.();
    v.fixture.detectChanges();
    return v;
  }
  const list = (f: Fx) => el(f).querySelector('[data-sv-dock-list]') as HTMLElement;

  it('keeps the resting size when the row fits', async () => {
    const { fixture } = await inContainer(600, 400);
    expect(list(fixture).getAttribute('data-sv-dock-fit')).toBe('rest');
    expect(controls(fixture)[0].style.width).toBe('');
  });

  it('★ shrinks every item evenly so a narrow container shows all of them, and stops magnifying', async () => {
    // 5 items: room 256 − 16 − 32 = 208 → 41 px each.
    const { fixture } = await inContainer(256, 400);
    expect(list(fixture).getAttribute('data-sv-dock-fit')).toBe('shrunk');
    expect(controls(fixture).map((c) => c.style.width)).toEqual(Array(5).fill('41px'));
    expect(controls(fixture)[0].style.height).toBe('41px');
    expect(toolbar(fixture).getAttribute('data-sv-dock-magnify')).toBe('off');
    expect(list(fixture).className).not.toMatch(/overflow-/);
  });

  it('★ scrolls along the dock when even 32 px items do not fit — every control stays reachable', async () => {
    const { fixture } = await inContainer(150, 400);
    expect(list(fixture).getAttribute('data-sv-dock-fit')).toBe('scroll');
    expect(list(fixture).classList.contains('overflow-x-auto')).toBe(true);
    expect(controls(fixture).map((c) => c.style.width)).toEqual(Array(5).fill('32px'));
    expect(controls(fixture)).toHaveLength(5);
  });

  it('a vertical dock fits the container’s height', async () => {
    const { fixture } = await inContainer(600, 150, { position: 'left' });
    expect(list(fixture).classList.contains('overflow-y-auto')).toBe(true);
    const tall = await inContainer(150, 600, { position: 'left' });
    expect(list(tall.fixture).getAttribute('data-sv-dock-fit')).toBe('rest');
  });
});
