import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SV_LINK_ADAPTER,
  SV_NAV_TELEMETRY,
  provideSvNavLocation,
  svQueryParamNavLocation,
  svResetWarnOnce,
  type MenuGroup,
  type SvLinkAdapter,
  type SvLinkTarget,
  type SvNavEvent,
  type SvNavTelemetry,
} from '@styloviz/core';
import { SvSidebarNavComponent } from './sidebar-nav.component';
import type { SidebarNavSelection } from './sidebar-nav.model';

/**
 * ============================================================================
 *  `N-1` — the reusable half of a sidebar
 * ============================================================================
 *
 * ★★★ THE TWO ASSERTIONS THAT ARE THE WHOLE ITEM, and they are both negative:
 *     **no router import** and **no brand**. `sv-sidebar` shipped with
 *     `RouterLink`, `RouterLinkActive` and `inject(Router)` — the existence
 *     proof `X-8` was written about, since the component a hybrid consumer
 *     would most want was the one they could not take — and with a home link
 *     hard-coded to `/components`. Everything else here was already built.
 */

const GROUPS: MenuGroup[] = [
  {
    groupLabel: 'Overview',
    items: [
      { label: 'Dashboard', route: '/dashboard', icon: 'home' },
      {
        label: 'Orders',
        route: '/orders',
        icon: 'shopping-cart',
        badge: '3',
        badgeColor: 'danger',
        childGroups: [
          { label: 'Status', items: [{ id: 'open', label: 'Open' }, { id: 'shipped', label: 'Shipped' }] },
        ],
      },
    ],
  },
  {
    groupLabel: 'Admin',
    items: [
      { label: 'Settings', route: '/settings', icon: 'settings' },
      { label: 'Billing', route: '/settings/billing', icon: 'credit-card' },
    ],
  },
];

function adapter() {
  const went: SvLinkTarget[] = [];
  const value: SvLinkAdapter = {
    kind: 'spec',
    href: (target) => (typeof target === 'string' ? target : target.join('/')),
    navigate: (target) => {
      went.push(target);
      return true;
    },
  };
  return { went, value };
}

function telemetry() {
  const seen: SvNavEvent[] = [];
  const sink: SvNavTelemetry = {
    kind: 'spec',
    retention: '30d',
    consent: () => true,
    record: (e) => seen.push(e),
  };
  return { seen, sink };
}

async function setup(
  inputs: Partial<ComponentInput<SvSidebarNavComponent>> = {},
  extra: { providers?: unknown[]; links?: ReturnType<typeof adapter> } = {},
) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const links = extra.links ?? adapter();
  const tel = telemetry();
  const picked: SidebarNavSelection[] = [];

  const { fixture } = await render(SvSidebarNavComponent, {
    inputs: { menuGroups: GROUPS, ...inputs } as ComponentInput<SvSidebarNavComponent>,
    providers: [
      { provide: SV_LINK_ADAPTER, useValue: links.value },
      { provide: SV_NAV_TELEMETRY, useValue: tel.sink },
      ...((extra.providers ?? []) as never[]),
    ],
  });
  fixture.componentInstance.itemSelected.subscribe((e) => picked.push(e));
  return { fixture, c: fixture.componentInstance, went: links.went, seen: tel.seen, picked };
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const links = (f: { nativeElement: unknown }) => [...el(f).querySelectorAll('a')];
const linkFor = (f: { nativeElement: unknown }, href: string) =>
  links(f).find((a) => a.getAttribute('href') === href);
/**
 * The labels of whatever is marked current.
 *
 * ⚠️ The first span, not `textContent`. A top-level item's badge is inside its
 *    own `<a>`, so the whole node reads "Orders3" — which passes an assertion
 *    nobody meant to write and fails the one they did.
 */
const current = (f: { nativeElement: unknown }) =>
  [...el(f).querySelectorAll('[aria-current="page"]')].map((a) =>
    (a.querySelector('span') ?? a).textContent?.trim(),
  );

// ─── The split itself ────────────────────────────────────────────────────────

describe('SvSidebarNavComponent — what the split removed', () => {
  /**
   * ★★★ THE ITEM, AS A TEST. `sv-sidebar` imports `RouterLink`,
   *     `RouterLinkActive` and injects `Router`, which is why a hybrid or
   *     non-routed consumer cannot use it. Nothing here does.
   */
  it('renders real links through the adapter, with no router anywhere', async () => {
    const f = await setup();
    expect(linkFor(f.fixture, '/dashboard')).toBeTruthy();
    expect(linkFor(f.fixture, '/orders')).toBeTruthy();
    // Rendered by this component, so the test would fail the moment somebody
    // "improved" an item into a div with a click handler.
    expect(links(f.fixture).every((a) => a.tagName === 'A')).toBe(true);
  });

  /** ★ No logo, no wordmark, no home link — the host's, projected. */
  it('ships no brand of its own', async () => {
    const f = await setup();
    expect(el(f.fixture).querySelector('img')).toBeNull();
    expect(el(f.fixture).textContent).not.toContain('styloviz');
    expect(linkFor(f.fixture, '/components')).toBeUndefined();
  });

  it('names its landmark so two of them can be told apart', async () => {
    const f = await setup({ ariaLabel: 'Settings navigation' });
    expect(el(f.fixture).querySelector('nav')?.getAttribute('aria-label')).toBe(
      'Settings navigation',
    );
  });
});

// ─── Where you are ───────────────────────────────────────────────────────────

describe('SvSidebarNavComponent — the current item', () => {
  it('marks the item the reader is on', async () => {
    const f = await setup({ activeRoute: '/orders' });
    expect(current(f.fixture)).toEqual(['Orders']);
  });

  /** ★ A detail page keeps its section lit — `{ exact: false }`'s behaviour. */
  it('stays on the section for a page beneath it', async () => {
    const f = await setup({ activeRoute: '/orders/8814' });
    expect(current(f.fixture)).toEqual(['Orders']);
  });

  /**
   * ★★ SEGMENT BOUNDARIES, NOT `startsWith`. `/settings` must not light up for
   *    `/settingsomething`, and the bug only ever appears once a second,
   *    similarly-named route exists — which is exactly when nobody is looking.
   */
  it('does not match a route that merely shares a prefix', async () => {
    const f = await setup({ activeRoute: '/settingsomething' });
    expect(current(f.fixture)).toEqual([]);
  });

  /**
   * ★★ THE LONGEST match wins. With `/settings` and `/settings/billing` both in
   *    the menu, first-match lights the parent and leaves the child looking
   *    unvisited — the one arrangement in which a nested menu is guaranteed
   *    wrong.
   */
  it('prefers the more specific of two matching routes', async () => {
    const f = await setup({ activeRoute: '/settings/billing' });
    expect(current(f.fixture)).toEqual(['Billing']);
  });

  /** ★ Paging a table must not de-highlight the section it is in. */
  it('ignores the query string and the hash', async () => {
    const f = await setup({ activeRoute: '/orders?page=2#top' });
    expect(current(f.fixture)).toEqual(['Orders']);
  });

  it('marks nothing at all with no activeRoute', async () => {
    const f = await setup();
    expect(current(f.fixture)).toEqual([]);
  });
});

// ─── Sub-navigation ──────────────────────────────────────────────────────────

describe('SvSidebarNavComponent — sub-navigation', () => {
  it('opens the sub-items of the section the reader is inside', async () => {
    const f = await setup({ activeRoute: '/orders' });
    expect(el(f.fixture).textContent).toContain('Shipped');
  });

  it('keeps them closed everywhere else', async () => {
    const f = await setup({ activeRoute: '/dashboard' });
    expect(el(f.fixture).textContent).not.toContain('Shipped');
  });

  /** ★ A rail has no room for them, and a tooltip is not a sub-menu. */
  it('keeps them closed in the collapsed rail', async () => {
    const f = await setup({ activeRoute: '/orders', collapsed: true });
    expect(el(f.fixture).textContent).not.toContain('Shipped');
  });

  it('carries the child in the href, so a sub-item is a real shareable link', async () => {
    const f = await setup({ activeRoute: '/orders' });
    expect(linkFor(f.fixture, '/orders?c=shipped')).toBeTruthy();
  });

  it('honours a different childKey', async () => {
    const f = await setup({ activeRoute: '/orders', childKey: 'tab' });
    expect(linkFor(f.fixture, '/orders?tab=shipped')).toBeTruthy();
  });

  it('lets the host pin the open child instead of the URL', async () => {
    const f = await setup({ activeRoute: '/orders', activeChildId: 'shipped' });
    expect(current(f.fixture)).toEqual(['Orders', 'Shipped']);
  });
});

// ─── Selection ───────────────────────────────────────────────────────────────

describe('SvSidebarNavComponent — picking something', () => {
  const click = (a: Element, init: MouseEventInit = {}) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
    a.dispatchEvent(event);
    return event;
  };

  it('lets the adapter navigate and cancels the browser, exactly once', async () => {
    const f = await setup();
    const event = click(linkFor(f.fixture, '/orders')!);

    expect(f.went).toEqual(['/orders']);
    expect(event.defaultPrevented).toBe(true);
    expect(f.picked[0]).toMatchObject({
      item: expect.objectContaining({ label: 'Orders' }),
      group: expect.objectContaining({ groupLabel: 'Overview' }),
      child: null,
    });
  });

  /**
   * ★★ A ⌘-click means "open this somewhere else". Intercepting one turns a new
   *    tab into a navigation in the current one — `NV-07-I12`'s failure.
   */
  it('never intercepts a modified click', async () => {
    const f = await setup();
    const event = click(linkFor(f.fixture, '/orders')!, { metaKey: true });

    expect(f.went).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
    expect(f.picked).toEqual([]);
  });

  it('reports which sub-item was picked, not just its parent', async () => {
    const f = await setup({ activeRoute: '/orders' });
    click(linkFor(f.fixture, '/orders?c=shipped')!);

    expect(f.picked[0].child).toEqual({ id: 'shipped', label: 'Shipped' });
    expect(f.picked[0].item.label).toBe('Orders');
  });

  /**
   * ★★ `SvLinkTarget` is a PATH. The router adapter does `router.navigate([t])`,
   *    which percent-encodes a `?` — handing it `/orders?c=shipped` produced a
   *    route called `orders%3Fc%3Dshipped`. A sub-item never reaches the adapter.
   */
  it('never hands the adapter a URL with a query', async () => {
    const f = await setup({ activeRoute: '/orders' });
    click(linkFor(f.fixture, '/orders')!);
    click(linkFor(f.fixture, '/orders?c=shipped')!);
    expect(f.went).toEqual(['/orders']);
  });

  /**
   * ★ On the item's own page a sub-item is a state change, not a navigation —
   *   `SvNavLocation` writes the one param and nothing else happens.
   */
  it('writes a sub-item through the location, without navigating, on the item`s page', async () => {
    window.history.replaceState(null, '', '/orders');
    const f = await setup(
      { activeRoute: '/orders' },
      { providers: [provideSvNavLocation(svQueryParamNavLocation())] },
    );
    const event = click(linkFor(f.fixture, '/orders?c=shipped')!);

    expect(event.defaultPrevented).toBe(true);
    expect(f.went).toEqual([]);
    expect(new URLSearchParams(window.location.search).get('c')).toBe('shipped');
    window.history.replaceState(null, '', '/');
  });

  /**
   * ★ With no location to hold it, the param lives only in the `href` — and the
   *   adapter, which takes paths, could only drop it. The anchor is followed.
   */
  it('lets the browser follow a sub-item when there is no location to hold it', async () => {
    const f = await setup({ activeRoute: '/orders' });
    const event = click(linkFor(f.fixture, '/orders?c=shipped')!);

    expect(event.defaultPrevented).toBe(false);
    expect(f.went).toEqual([]);
    expect(f.picked[0].child?.id).toBe('shipped');
  });

  it('lets the browser follow a sub-item from a page beneath the item', async () => {
    const f = await setup(
      { activeRoute: '/orders/8814' },
      { providers: [provideSvNavLocation(svQueryParamNavLocation())] },
    );
    const event = click(linkFor(f.fixture, '/orders?c=shipped')!);

    expect(event.defaultPrevented).toBe(false);
    expect(f.went).toEqual([]);
  });

  /** ★ The separator follows what the ADAPTER produced, not `item.route`. */
  it('appends with & when the adapter`s href already has a query', async () => {
    const links = adapter();
    const withLang: SvLinkAdapter = { ...links.value, href: (t) => `${String(t)}?lang=en` };
    const f = await setup({ activeRoute: '/orders' }, { links: { went: links.went, value: withLang } });
    expect(linkFor(f.fixture, '/orders?lang=en&c=shipped')).toBeTruthy();
  });

  /** ★ A drawer that stays open over the page it just navigated to is the bug. */
  it('closes the mobile drawer on a pick, and says so', async () => {
    const f = await setup({ mobileOpen: true });
    const closed: number[] = [];
    f.c.mobileClose.subscribe(() => closed.push(1));

    click(linkFor(f.fixture, '/orders')!);

    expect(f.c.mobileOpen()).toBe(false);
    expect(closed).toEqual([1]);
  });

  it('says nothing about the drawer when it was never open', async () => {
    const f = await setup();
    const closed: number[] = [];
    f.c.mobileClose.subscribe(() => closed.push(1));

    click(linkFor(f.fixture, '/orders')!);

    expect(closed).toEqual([]);
  });
});

// ─── The rail ────────────────────────────────────────────────────────────────

describe('SvSidebarNavComponent — the collapsed rail', () => {
  it('hides the labels and keeps them as titles', async () => {
    const f = await setup({ collapsed: true });
    const orders = linkFor(f.fixture, '/orders')!;
    expect(orders.textContent?.trim()).toBe('');
    expect(orders.getAttribute('title')).toBe('Orders');
  });

  it('drops the group headings for dividers', async () => {
    const f = await setup({ collapsed: true });
    expect(el(f.fixture).textContent).not.toContain('Overview');
  });

  /** A toggle is an action on this page, so it is a real button. */
  it('toggles through a real button that says which way it goes', async () => {
    const f = await setup();
    const toggle = el(f.fixture).querySelector('button')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    toggle.click();
    f.fixture.detectChanges();

    expect(f.c.collapsed()).toBe(true);
    expect(toggle.getAttribute('aria-label')).toBe('Expand navigation');
  });
});

// ─── The chrome is the host's ────────────────────────────────────────────────

describe('SvSidebarNavComponent — projected chrome', () => {
  it('omits the header and footer boxes when told to', async () => {
    const f = await setup({ showHeader: false, showFooter: false });
    expect(el(f.fixture).querySelector('button')).toBeNull();
    expect(el(f.fixture).querySelectorAll('nav').length).toBe(1);
  });
});

// ─── The shared stream (`X-15`) ──────────────────────────────────────────────

describe('SvSidebarNavComponent — X-15', () => {
  it('records a pick as a jump from the sidebar surface', async () => {
    const f = await setup({ surfaceId: 'shell' });
    linkFor(f.fixture, '/orders')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    expect(f.seen).toEqual([
      expect.objectContaining({
        surface: 'sidebar',
        surfaceId: 'shell',
        intent: 'jump',
        key: '/orders',
        label: 'Orders',
      }),
    ]);
  });

  /**
   * ★★ "Are people reaching settings through the sidebar or through search?" is
   *    the question `X-15` exists to answer, and the sidebar is one of the two
   *    surfaces in it. The sub-item's own label is what gets recorded, because
   *    "Orders" and "Orders → Shipped" are different destinations.
   */
  it('records the sub-item by its own label', async () => {
    const f = await setup({ activeRoute: '/orders' });
    linkFor(f.fixture, '/orders?c=shipped')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );

    expect(f.seen[0]).toMatchObject({ label: 'Shipped', key: '/orders?c=shipped' });
  });

  it('records nothing for a modified click, because nothing happened', async () => {
    const f = await setup();
    linkFor(f.fixture, '/orders')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }),
    );
    expect(f.seen).toEqual([]);
  });
});
