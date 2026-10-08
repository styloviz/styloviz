import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SV_LINK_ADAPTER, type MenuGroup, type SvLinkAdapter } from '@styloviz/core';
import { SvSidebarNavComponent } from './sidebar-nav.component';

/**
 * ============================================================================
 *  `N-1` — `mobileOpen` has to MOVE something
 * ============================================================================
 *
 * The model existed and the template rendered the same `<aside>` whatever it
 * said: no off-canvas, no backdrop, no Escape, no focus handling. These specs
 * drive the drawer the way a host does — through `mobileOpen` — and assert on
 * `document.activeElement`, because "focus went somewhere" cannot tell a
 * recovered focus from one on `<body>`.
 *
 * ⚠️ jsdom has no layout, so `documentElement`'s width is stubbed.
 */

const GROUPS: MenuGroup[] = [
  {
    groupLabel: 'Overview',
    items: [
      { label: 'Dashboard', route: '/dashboard', icon: 'home' },
      { label: 'Orders', route: '/orders', icon: 'shopping-cart' },
    ],
  },
];

const links: SvLinkAdapter = {
  kind: 'spec',
  href: (t) => (typeof t === 'string' ? t : t.join('/')),
  navigate: () => true,
};

let originalRect: typeof Element.prototype.getBoundingClientRect;

function viewport(width: number): void {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this === document.documentElement) return { width, height: 800 } as DOMRect;
    return { width: 0, height: 0 } as DOMRect;
  };
}

beforeEach(() => {
  originalRect = Element.prototype.getBoundingClientRect;
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect;
  document.querySelectorAll('[data-spec-opener]').forEach((n) => n.remove());
});

async function setup(width: number, inputs: Partial<ComponentInput<SvSidebarNavComponent>> = {}) {
  viewport(width);
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSidebarNavComponent, {
    inputs: { menuGroups: GROUPS, ...inputs } as ComponentInput<SvSidebarNavComponent>,
    providers: [{ provide: SV_LINK_ADAPTER, useValue: links }],
  });
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    c: fixture.componentInstance,
    host,
    aside: () => host.querySelector('aside')!,
    backdrop: () => host.querySelector<HTMLButtonElement>('button[aria-hidden="true"]'),
    closeButton: () => host.querySelector<HTMLButtonElement>('button[aria-label="Close navigation"]'),
  };
}

/** The host's hamburger — outside the component, which is the whole point. */
function hamburger(): HTMLButtonElement {
  const button = document.createElement('button');
  button.setAttribute('data-spec-opener', '');
  button.textContent = 'Menu';
  document.body.appendChild(button);
  button.focus();
  return button;
}

async function open(view: Awaited<ReturnType<typeof setup>>) {
  view.fixture.componentRef.setInput('mobileOpen', true);
  view.fixture.detectChanges();
  await view.fixture.whenStable();
}

describe('SvSidebarNavComponent — which form it takes', () => {
  it('stays docked on a wide viewport, whatever mobileOpen says', async () => {
    const v = await setup(1280, { mobileOpen: true });
    expect(v.c.isDrawer()).toBe(false);
    expect(v.aside().className).not.toContain('fixed');
    expect(v.backdrop()).toBeNull();
  });

  /** ★ Unknown width is docked — a prerender must not ship the sidebar hidden. */
  it('stays docked while the width is unknown', async () => {
    const v = await setup(0);
    expect(v.c.isDrawer()).toBe(false);
  });

  it('stays docked at any width with mobileBreakpoint 0', async () => {
    const v = await setup(420, { mobileBreakpoint: 0 });
    expect(v.c.isDrawer()).toBe(false);
  });

  it('is off-canvas and out of the Tab order when closed on a narrow viewport', async () => {
    const v = await setup(420);
    expect(v.c.isDrawer()).toBe(true);
    expect(v.aside().className).toContain('-translate-x-full');
    expect(v.aside().className).toContain('invisible');
    expect(v.backdrop()).toBeNull();
  });

  it('slides in with a backdrop when mobileOpen is set', async () => {
    const v = await setup(420);
    await open(v);
    expect(v.aside().className).toContain('translate-x-0');
    expect(v.aside().className).not.toContain('invisible');
    expect(v.backdrop()).toBeTruthy();
  });

  /** A drawer is full width; a rail inside one would be a strip of icons over a backdrop. */
  it('never rails inside the drawer', async () => {
    const v = await setup(420, { collapsed: true, mobileOpen: true });
    expect(v.host.textContent).toContain('Dashboard');
    expect(v.host.querySelector('button[aria-label="Expand navigation"]')).toBeNull();
  });
});

describe('SvSidebarNavComponent — closing the drawer', () => {
  it('closes on the backdrop and says so', async () => {
    const v = await setup(420);
    await open(v);
    const closed: number[] = [];
    v.c.mobileClose.subscribe(() => closed.push(1));

    v.backdrop()!.click();
    v.fixture.detectChanges();

    expect(v.c.mobileOpen()).toBe(false);
    expect(closed).toEqual([1]);
  });

  it('closes on Escape', async () => {
    const v = await setup(420);
    await open(v);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    v.fixture.detectChanges();

    expect(v.c.mobileOpen()).toBe(false);
  });

  it('ignores Escape when docked', async () => {
    const v = await setup(1280, { mobileOpen: true });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(v.c.mobileOpen()).toBe(true);
  });

  it('has a labelled close button for keyboard and screen-reader users', async () => {
    const v = await setup(420);
    await open(v);

    v.closeButton()!.click();
    v.fixture.detectChanges();

    expect(v.c.mobileOpen()).toBe(false);
  });
});

describe('SvSidebarNavComponent — focus follows the drawer', () => {
  it('moves focus into the drawer when it opens', async () => {
    const v = await setup(420);
    hamburger();
    await open(v);

    expect(v.aside().contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(v.closeButton());
  });

  it('returns focus to the opener when it closes', async () => {
    const v = await setup(420);
    const opener = hamburger();
    await open(v);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    v.fixture.detectChanges();
    await v.fixture.whenStable();

    expect(document.activeElement).toBe(opener);
  });

  it('returns focus to the opener after a pick closes it', async () => {
    const v = await setup(420);
    const opener = hamburger();
    await open(v);

    v.host.querySelector<HTMLAnchorElement>('a[href="/orders"]')!.click();
    v.fixture.detectChanges();
    await v.fixture.whenStable();

    expect(v.c.mobileOpen()).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('does not pull focus back when the host closes it while the reader is elsewhere', async () => {
    const v = await setup(420);
    hamburger();
    await open(v);
    const field = document.createElement('input');
    field.setAttribute('data-spec-opener', '');
    document.body.appendChild(field);
    field.focus();

    v.fixture.componentRef.setInput('mobileOpen', false);
    v.fixture.detectChanges();
    await v.fixture.whenStable();

    expect(document.activeElement).toBe(field);
  });

  it('wraps Tab at both ends while open', async () => {
    const v = await setup(420);
    await open(v);
    const focusables = [...v.aside().querySelectorAll<HTMLElement>('a[href], button')];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    const back = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    first.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });
});
