import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import {
  SvBreadcrumbComponent,
  type BreadcrumbItem,
  type BreadcrumbMenuItem,
} from './breadcrumb.component';
import { until } from '../../../../src/testing/async';

/**
 * ============================================================================
 *  `sv-breadcrumb` — the sibling-page dropdown
 * ============================================================================
 *
 * The panel is rendered into `document.body` through a real portal, so almost
 * nothing here can be found by querying the component host: the assertions have
 * to reach the portal element deliberately. That is also why click-outside has
 * to check two containers rather than one, and why closing has to restore focus
 * itself — the trigger is no longer an ancestor of the focused element.
 *
 * ★ jsdom has no layout: `getBoundingClientRect()` returns all zeros and
 * `clientWidth` is 0. Nothing is concluded from a zero measurement here — the
 * two positioning tests stub a rect explicitly and say so.
 */

const MENU: BreadcrumbMenuItem[] = [
  { label: 'Orders', routerLink: '/orders' },
  { label: 'Invoices', routerLink: '/invoices', icon: 'star' },
  { label: 'Refunds', routerLink: '/refunds' },
];

const CRUMBS: BreadcrumbItem[] = [
  { label: 'Home', routerLink: '/' },
  { label: 'Orders', routerLink: '/orders', menu: MENU },
  { label: 'Order 42' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvBreadcrumbComponent, {
    inputs: { items: CRUMBS, ...inputs },
    // Real routes: a `routerLink` click that matches nothing logs an NG04002
    // through the router's error handler, which is noise, not a signal.
    providers: [
      provideRouter(
        ['', 'orders', 'invoices', 'refunds', 'locked', 'b', 'here', 'x'].map((path) => ({
          path,
          children: [],
        })),
      ),
    ],
  });
  fixture.detectChanges();
  return {
    fixture,
    c: fixture.componentInstance,
    el: fixture.nativeElement as HTMLElement,
  };
}

/** The portaled panel — it lives in <body>, not under the component host. */
const panel = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.sv-breadcrumb-menu-portal [role="menu"]');

const portalHost = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.sv-breadcrumb-menu-portal');

const trigger = (el: HTMLElement, index = 0): HTMLButtonElement =>
  [...el.querySelectorAll<HTMLButtonElement>('button[data-trigger]')][index];

const menuItems = (): HTMLAnchorElement[] =>
  [...document.querySelectorAll<HTMLAnchorElement>('.sv-breadcrumb-menu-portal [role="menuitem"]')];

afterEach(() => {
  // A leaked portal would be found by the next test's document-wide query.
  document.querySelectorAll('.sv-breadcrumb-menu-portal').forEach((n) => n.remove());
});

// ─────────────────────────────────────────────────────────────────────────────

describe('SvBreadcrumbComponent — the menu trigger', () => {
  it('renders a trigger only for a crumb that declares sibling pages', async () => {
    const { el } = await setup();
    const triggers = el.querySelectorAll('button[data-trigger]');
    expect(triggers).toHaveLength(1);
    expect(triggers[0].getAttribute('aria-label')).toBe('Switch page under Orders');
    expect(triggers[0].getAttribute('aria-haspopup')).toBe('menu');
    expect(triggers[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('renders no trigger for a crumb whose menu is empty', async () => {
    const items: BreadcrumbItem[] = [{ label: 'Home', routerLink: '/', menu: [] }, { label: 'Here' }];
    const { el } = await setup({ items });
    expect(el.querySelector('button[data-trigger]')).toBeNull();
  });

  it('renders no trigger for a disabled crumb, even one with siblings', async () => {
    // The crumb itself is not navigable; offering its siblings would be a way
    // around the very restriction `disabled` expresses.
    const items: BreadcrumbItem[] = [
      { label: 'Home', routerLink: '/' },
      { label: 'Billing', routerLink: '/b', menu: MENU, disabled: true },
      { label: 'Here' },
    ];
    const { el } = await setup({ items });
    expect(el.querySelector('button[data-trigger]')).toBeNull();
  });

  it('offers a trigger on the current (last) crumb too', async () => {
    const items: BreadcrumbItem[] = [{ label: 'Home', routerLink: '/' }, { label: 'Here', menu: MENU }];
    const { el } = await setup({ items });
    expect(el.querySelectorAll('button[data-trigger]')).toHaveLength(1);
  });

  it('offers a trigger on an unlinked middle crumb too', async () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', routerLink: '/' },
      { label: 'Section', menu: MENU },
      { label: 'Here' },
    ];
    const { el } = await setup({ items });
    expect(el.querySelectorAll('button[data-trigger]')).toHaveLength(1);
  });
});

describe('SvBreadcrumbComponent — opening and closing', () => {
  it('mounts the panel into document.body, outside the component subtree', async () => {
    const { el, fixture } = await setup();
    expect(panel()).toBeNull();

    trigger(el).click();
    fixture.detectChanges();

    const p = panel()!;
    expect(p).toBeTruthy();
    // The whole point of the portal: it escapes any ancestor overflow/transform.
    expect(el.contains(p)).toBe(false);
    expect(portalHost()!.parentElement).toBe(document.body);
    expect(menuItems().map((a) => a.textContent?.trim())).toEqual(['Orders', 'Invoices', 'Refunds']);
  });

  it('names the panel after the crumb and wires it to the trigger', async () => {
    const { el, fixture } = await setup();
    trigger(el).click();
    fixture.detectChanges();

    const p = panel()!;
    expect(p.getAttribute('aria-label')).toBe('Orders pages');
    expect(trigger(el).getAttribute('aria-expanded')).toBe('true');
    expect(trigger(el).getAttribute('aria-controls')).toBe(p.id);
  });

  it('closes on a second activation of the same trigger', async () => {
    const { el, c, fixture } = await setup();
    trigger(el).click();
    fixture.detectChanges();
    trigger(el).click();
    fixture.detectChanges();
    expect(c.openMenuIndex()).toBeNull();
    expect(panel()).toBeNull();
    expect(portalHost()).toBeNull();
  });

  it('moves the open menu to the other crumb rather than opening two panels', async () => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', routerLink: '/', menu: MENU },
      { label: 'Orders', routerLink: '/orders', menu: MENU },
      { label: 'Here' },
    ];
    const { el, c, fixture } = await setup({ items });

    trigger(el, 0).click();
    fixture.detectChanges();
    expect(c.openMenuIndex()).toBe(0);

    trigger(el, 1).click();
    fixture.detectChanges();
    expect(c.openMenuIndex()).toBe(1);
    expect(document.querySelectorAll('.sv-breadcrumb-menu-portal')).toHaveLength(1);
  });

  it('moves focus into the panel on open and back to the trigger on close', async () => {
    const { el, fixture } = await setup();
    const t = trigger(el);
    t.click();
    fixture.detectChanges();

    // `toggleMenu` focuses the first item in a microtask, after the nodes land.
    await until(() => document.activeElement === menuItems()[0], {
      label: 'focus to reach the first menu item',
    });

    menuItems()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(t);
  });

  it('reports the chosen sibling and closes', async () => {
    const { el, c, fixture } = await setup();
    const seen: BreadcrumbMenuItem[] = [];
    c.menuItemSelect.subscribe((i) => seen.push(i));

    trigger(el).click();
    fixture.detectChanges();
    menuItems()[1].click();
    fixture.detectChanges();

    expect(seen).toEqual([MENU[1]]);
    expect(c.openMenuIndex()).toBeNull();
    expect(panel()).toBeNull();
  });

  it('renders an icon only for the sibling entries that declare one', async () => {
    const { el, fixture } = await setup();
    trigger(el).click();
    fixture.detectChanges();
    expect(menuItems().map((a) => a.querySelectorAll('svg').length)).toEqual([0, 1, 0]);
  });

  it('closing when nothing is open is a no-op, not a crash', async () => {
    const { c } = await setup();
    c.closeMenu();
    expect(c.openMenuIndex()).toBeNull();
  });

  it('tears the portal down when the component is destroyed', async () => {
    const { el, fixture } = await setup();
    trigger(el).click();
    fixture.detectChanges();
    expect(portalHost()).toBeTruthy();

    fixture.destroy();
    expect(portalHost()).toBeNull();
  });
});

describe('SvBreadcrumbComponent — dismissal', () => {
  it('closes on a mousedown outside both the host and the panel', async () => {
    const { el, c, fixture } = await setup();
    trigger(el).click();
    fixture.detectChanges();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(c.openMenuIndex()).toBeNull();
  });

  it('stays open for a mousedown inside the portaled panel', async () => {
    // The panel is not a descendant of the host, so a naive `host.contains()`
    // check alone would close the menu the moment the user reached for it.
    const { el, c, fixture } = await setup();
    trigger(el).click();
    fixture.detectChanges();

    menuItems()[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(c.openMenuIndex()).toBe(1);
  });

  it('stays open for a mousedown inside the component host', async () => {
    const { el, c, fixture } = await setup();
    trigger(el).click();
    fixture.detectChanges();

    el.querySelector('nav')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(c.openMenuIndex()).toBe(1);
  });

  it('ignores an outside mousedown while nothing is open', async () => {
    const { c } = await setup();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(c.openMenuIndex()).toBeNull();
  });

  it('closes on Escape from anywhere in the document', async () => {
    // Focus is inside the portal, which is not under the host, so a host-scoped
    // listener would never see the key.
    const { el, c, fixture } = await setup();
    trigger(el).click();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(c.openMenuIndex()).toBeNull();
  });

  it('does nothing on Escape when the menu is already closed', async () => {
    const { c } = await setup();
    c.onHostEscape();
    expect(c.openMenuIndex()).toBeNull();
  });

  it('closes on a viewport resize rather than repositioning from stale coordinates', async () => {
    const { el, c, fixture } = await setup();
    trigger(el).click();
    fixture.detectChanges();
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    expect(c.openMenuIndex()).toBeNull();
  });

  it('ignores a resize while nothing is open', async () => {
    const { c } = await setup();
    window.dispatchEvent(new Event('resize'));
    expect(c.openMenuIndex()).toBeNull();
  });
});

describe('SvBreadcrumbComponent — keyboard inside the menu', () => {
  async function opened() {
    const h = await setup();
    h.fixture.detectChanges();
    trigger(h.el).click();
    h.fixture.detectChanges();
    return h;
  }

  const key = (k: string) =>
    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

  it('walks down the list and stops at the end rather than wrapping', async () => {
    await opened();
    key('ArrowDown');
    expect(document.activeElement).toBe(menuItems()[1]);
    key('ArrowDown');
    expect(document.activeElement).toBe(menuItems()[2]);
    key('ArrowDown'); // already last — must not wrap to the first
    expect(document.activeElement).toBe(menuItems()[2]);
  });

  it('walks back up and stops at the start', async () => {
    await opened();
    key('End');
    expect(document.activeElement).toBe(menuItems()[2]);
    key('ArrowUp');
    expect(document.activeElement).toBe(menuItems()[1]);
    key('ArrowUp');
    expect(document.activeElement).toBe(menuItems()[0]);
    key('ArrowUp'); // already first
    expect(document.activeElement).toBe(menuItems()[0]);
  });

  it('jumps to both ends with Home and End', async () => {
    await opened();
    key('End');
    expect(document.activeElement).toBe(menuItems()[2]);
    key('Home');
    expect(document.activeElement).toBe(menuItems()[0]);
  });

  it('closes on Tab, so focus continues past the trigger instead of into a floating panel', async () => {
    const { c, fixture } = await opened();
    key('Tab');
    fixture.detectChanges();
    expect(c.openMenuIndex()).toBeNull();
  });

  it('ignores a key it has no meaning for', async () => {
    const { c } = await opened();
    key('a');
    expect(document.activeElement).toBe(menuItems()[0]);
    expect(c.openMenuIndex()).toBe(1);
  });

  it('keeps every item out of the tab order — focus is roving, not tabbed', async () => {
    await opened();
    expect(menuItems().every((a) => a.tabIndex === -1)).toBe(true);
  });

  it('does nothing at all when there are no items to move between', async () => {
    // `onMenuKeydown` is reachable with an empty ref list (the panel exists but
    // the crumb's menu emptied out); it must return rather than index into [].
    const { c } = await setup();
    expect(() => c.onMenuKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).not.toThrow();
  });
});

describe('SvBreadcrumbComponent — panel placement', () => {
  /**
   * ★ jsdom gives every element a 0×0 rect at (0,0), so the "flip" decisions
   * are unreachable without stubbing. Both tests below install an explicit rect
   * on the trigger; nothing is concluded from an unstubbed measurement.
   */
  function stubRect(elm: HTMLElement, rect: Partial<DOMRect>): void {
    elm.getBoundingClientRect = () =>
      ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
         toJSON: () => ({}), ...rect }) as DOMRect;
  }

  it('drops below and left-aligns when there is room', async () => {
    const { el, c, fixture } = await setup();
    // 1024×768 jsdom viewport; a trigger near the top-left has room below.
    stubRect(trigger(el), { top: 100, bottom: 120, left: 40, right: 60 });
    trigger(el).click();
    fixture.detectChanges();

    expect(c.menuAbove()).toBe(false);
    const style = c.menuPanelStyle();
    expect(style['position']).toBe('fixed');
    expect(style['top']).toBe('124px');   // rect.bottom + 4px gap
    expect(style['left']).toBe('40px');
    expect(style['bottom']).toBeUndefined();
    expect(style['right']).toBeUndefined();
  });

  it('flips above and right-aligns when the panel would not fit below or to the right', async () => {
    const { el, c, fixture } = await setup();
    // Near the bottom-right corner: 768 - 700 = 68px below (< 240 panel height)
    // and 900 + 192 > 1024 to the right.
    stubRect(trigger(el), { top: 680, bottom: 700, left: 900, right: 980 });
    trigger(el).click();
    fixture.detectChanges();

    expect(c.menuAbove()).toBe(true);
    const style = c.menuPanelStyle();
    expect(style['bottom']).toBe('92px');  // vh - rect.top + gap = 768 - 680 + 4
    expect(style['right']).toBe('44px');   // vw - rect.right = 1024 - 980
    expect(style['top']).toBeUndefined();
    expect(style['left']).toBeUndefined();
  });

  it('stays below when neither side has room but below has more of it', async () => {
    // The half of the flip condition the two cases above cannot reach: below is
    // too short for the panel, yet flipping above would be worse. A short
    // viewport is stubbed for the same reason as the rects — jsdom has no layout.
    const realHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });
    try {
      const { el, c, fixture } = await setup();
      stubRect(trigger(el), { top: 20, bottom: 40, left: 40, right: 60 });
      trigger(el).click();
      fixture.detectChanges();
      // 160px below vs 20px above: both under the 240px panel, below wins.
      expect(c.menuAbove()).toBe(false);
      expect(c.menuPanelStyle()['top']).toBe('44px');
    } finally {
      Object.defineProperty(window, 'innerHeight', { value: realHeight, configurable: true });
    }
  });

  it('repositions on scroll from any ancestor, coalesced to one frame', async () => {
    const { el, c, fixture } = await setup();
    stubRect(trigger(el), { top: 100, bottom: 120, left: 40, right: 60 });
    trigger(el).click();
    fixture.detectChanges();
    expect(c.menuPanelStyle()['top']).toBe('124px');

    // The trigger scrolled up; the panel must follow it, not stay behind.
    stubRect(trigger(el), { top: 20, bottom: 40, left: 40, right: 60 });
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll')); // second in the same frame — coalesced
    await until(() => c.menuPanelStyle()['top'] === '44px', {
      label: 'the panel to follow its trigger',
    });
  });

  it('ignores scroll while the menu is closed', async () => {
    const { c } = await setup();
    window.dispatchEvent(new Event('scroll'));
    expect(c.menuPanelStyle()).toEqual({});
  });
});
