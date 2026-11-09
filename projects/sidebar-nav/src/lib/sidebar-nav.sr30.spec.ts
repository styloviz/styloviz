import { TestBed } from '@angular/core/testing';
import { render, fireEvent, type ComponentInput } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core/dev';
import { type MenuGroup } from '@styloviz/core/models';
import { SV_LINK_ADAPTER, type SvLinkAdapter } from '@styloviz/core/nav';
import { SvSidebarNavComponent } from './sidebar-nav.component';

/**
 * `SR-30` — the sidebar's code-first fixes and its free variants: sub-pages
 * that open on a click, one current page, focus that survives a collapse,
 * arrow keys and type-ahead, collapsible groups, badge styles, shortcuts,
 * external links, RTL-logical classes and translatable strings.
 */

const GROUPS: MenuGroup[] = [
  {
    groupLabel: 'Overview',
    items: [
      { label: 'Dashboard', route: '/dashboard', icon: 'home', shortcut: 'G D' },
      {
        label: 'Orders', route: '/orders', icon: 'shopping-cart', badge: '3', badgeColor: 'danger',
        childGroups: [{ label: 'Status', items: [{ id: 'open', label: 'Open' }, { id: 'shipped', label: 'Shipped' }] }],
      },
      {
        id: 'reports', label: 'Reports', route: '/reports', icon: 'chart', dot: true,
        childGroups: [{ label: 'Kind', items: [{ id: 'sales', label: 'Sales' }] }],
      },
    ],
  },
  {
    groupLabel: 'Help', collapsible: true, divider: true,
    items: [{ label: 'Docs', route: 'https://docs.example.com', icon: 'book-open', external: true }],
  },
];

const ADAPTER: SvLinkAdapter = {
  kind: 'spec',
  href: target => (typeof target === 'string' ? target : target.join('/')),
  navigate: () => true,
};

async function setup(inputs: Partial<ComponentInput<SvSidebarNavComponent>> = {}) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const { fixture } = await render(SvSidebarNavComponent, {
    inputs: { menuGroups: GROUPS, mobileBreakpoint: 0, ...inputs } as ComponentInput<SvSidebarNavComponent>,
    providers: [{ provide: SV_LINK_ADAPTER, useValue: ADAPTER }],
  });
  const host = fixture.nativeElement as HTMLElement;
  const link = (href: string) => host.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);
  const toggle = (label: string) => host.querySelector<HTMLButtonElement>(`[data-sv-nav-toggle][aria-label="${label} sub-pages"]`);
  return { fixture, c: fixture.componentInstance, host, link, toggle };
}

describe('sidebar-nav (SR-30) — sub-pages open on a click', () => {
  it('★ a parent the reader is not on has a toggle that opens it', async () => {
    const v = await setup({ activeRoute: '/dashboard' });
    const t = v.toggle('Orders')!;
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(v.host.textContent).not.toContain('Shipped');
    t.click();
    v.fixture.detectChanges();
    expect(t.getAttribute('aria-expanded')).toBe('true');
    expect(v.host.textContent).toContain('Shipped');
    expect(document.getElementById(t.getAttribute('aria-controls')!)).not.toBeNull();
    expect(v.c.expandedIds()).toEqual(['/orders']);
  });

  it('★ the section you are in opens itself, and closes when you leave — unless you opened it', async () => {
    const v = await setup({ activeRoute: '/orders' });
    expect(v.c.expandedIds()).toEqual(['/orders']);
    v.fixture.componentRef.setInput('activeRoute', '/dashboard');
    v.fixture.detectChanges();
    expect(v.c.expandedIds()).toEqual([]);

    v.toggle('Reports')!.click();                     // opened by the reader (keyed by id)
    v.fixture.componentRef.setInput('activeRoute', '/orders');
    v.fixture.detectChanges();
    v.fixture.componentRef.setInput('activeRoute', '/dashboard');
    v.fixture.detectChanges();
    expect(v.c.expandedIds()).toEqual(['reports']);
  });

  it("expandMode='single' keeps one open", async () => {
    const v = await setup({ activeRoute: '/dashboard', expandMode: 'single' });
    v.toggle('Orders')!.click();
    v.toggle('Reports')!.click();
    v.fixture.detectChanges();
    expect(v.c.expandedIds()).toEqual(['reports']);
  });

  it('a reader may close the section they are in', async () => {
    const v = await setup({ activeRoute: '/orders' });
    v.toggle('Orders')!.click();
    v.fixture.detectChanges();
    expect(v.host.textContent).not.toContain('Shipped');
  });
});

describe('sidebar-nav (SR-30) — current page and focus', () => {
  it('★ one aria-current="page"; the parent of the current sub-page is "true"', async () => {
    const v = await setup({ activeRoute: '/orders', activeChildId: 'open' });
    const pages = v.host.querySelectorAll('[aria-current="page"]');
    expect(pages.length).toBe(1);
    expect(pages[0].textContent!.trim()).toBe('Open');
    expect(v.link('/orders')!.getAttribute('aria-current')).toBe('true');
  });

  it('★ collapsing to the rail with a sub-page focused hands focus to its parent', async () => {
    const v = await setup({ activeRoute: '/orders' });
    const child = v.link('/orders?c=shipped')!;
    child.focus();
    expect(document.activeElement).toBe(child);
    v.fixture.componentRef.setInput('collapsed', true);
    v.fixture.detectChanges();
    await v.fixture.whenStable();
    expect(document.activeElement).toBe(v.link('/orders'));
  });

  it('★ Up/Down/Home/End and type-ahead move between the rows', async () => {
    const v = await setup({ activeRoute: '/orders' });
    const dash = v.link('/dashboard')!;
    dash.focus();
    fireEvent.keyDown(dash, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(v.link('/orders'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(v.link('/orders?c=open'));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(v.link('https://docs.example.com'));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(dash);
    fireEvent.keyDown(dash, { key: 'r' });
    expect(document.activeElement).toBe(v.link('/reports'));
  });

  it('the collapse button controls the aside', async () => {
    const v = await setup();
    const btn = v.host.querySelector('[data-sv-collapse-toggle]')!;
    expect(btn.getAttribute('aria-controls')).toBe(v.host.querySelector('aside')!.id);
  });
});

describe('sidebar-nav (SR-30) — groups and rows', () => {
  it('★ a collapsible group folds away, two-way', async () => {
    const v = await setup();
    const head = v.host.querySelector<HTMLButtonElement>('[data-sv-nav-group-toggle]')!;
    expect(head.textContent).toContain('Help');
    expect(head.getAttribute('aria-expanded')).toBe('true');
    head.click();
    v.fixture.detectChanges();
    expect(v.link('https://docs.example.com')).toBeNull();
    expect(v.c.collapsedGroups()).toEqual(['Help']);
    expect(v.host.querySelector('[data-sv-nav-divider]')).not.toBeNull();
  });

  it('external links open a new tab and say so', async () => {
    const v = await setup();
    const docs = v.link('https://docs.example.com')!;
    expect(docs.target).toBe('_blank');
    expect(docs.rel).toBe('noopener noreferrer');
    expect(docs.textContent).toContain('(opens in a new tab)');
  });

  it('dot, shortcut and the badge variants', async () => {
    const pill = await setup();
    expect(pill.link('/reports')!.querySelector('[data-sv-nav-dot]')).not.toBeNull();
    expect(pill.link('/dashboard')!.querySelector('kbd')!.textContent).toBe('G D');
    expect(pill.link('/orders')!.querySelector('[data-sv-nav-badge]')!.className).toContain('px-1.5');

    const count = await setup({ badgeVariant: 'count' });
    expect(count.link('/orders')!.querySelector('[data-sv-nav-badge]')!.className).toContain('min-w-5');

    const dot = await setup({ badgeVariant: 'dot' });
    const badge = dot.link('/orders')!.querySelector('[data-sv-nav-badge]')!;
    expect(badge.textContent).toBe('');
    expect(dot.link('/orders')!.querySelector('.sr-only')!.textContent).toBe('3');   // still spoken
  });

  it("activeStyle='bar' and density='compact'", async () => {
    const v = await setup({ activeRoute: '/dashboard', activeStyle: 'bar', density: 'compact' });
    const dash = v.link('/dashboard')!;
    expect(dash.className).toContain('before:bg-primary-500');
    expect(dash.className).not.toContain('bg-primary-50 ');
    expect(dash.className).toContain('py-1.5');
  });

  it('the rail keeps a dot for a badge it has no room to print', async () => {
    const v = await setup({ collapsed: true });
    expect(v.link('/orders')!.querySelector('[data-sv-nav-rail-dot]')).not.toBeNull();
  });
});

describe('sidebar-nav (SR-30) — RTL and strings', () => {
  it('★ logical classes, so the sidebar mirrors in RTL', async () => {
    const docked = await setup();
    expect(docked.host.querySelector('aside')!.className).toContain('border-e');
    expect(docked.host.querySelector('aside')!.className).not.toMatch(/\bborder-r\b/);

    // The drawer measures the viewport; give jsdom one, as the drawer spec does.
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      return (this === document.documentElement ? { width: 400, height: 800 } : { width: 0, height: 0 }) as DOMRect;
    };
    try {
      const drawer = await setup({ mobileBreakpoint: 1024 });
      await drawer.fixture.whenStable();
      drawer.fixture.detectChanges();
      const aside = drawer.host.querySelector('aside')!;
      expect(aside.className).toContain('start-0');
      expect(aside.className).toContain('rtl:translate-x-full');
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
  });

  it('labels translate every string', async () => {
    const v = await setup({
      labels: { collapse: 'Navigation einklappen', collapseText: 'Einklappen', toggleChildren: 'Unterseiten von {label}' },
    });
    const btn = v.host.querySelector('[data-sv-collapse-toggle]')!;
    expect(btn.getAttribute('aria-label')).toBe('Navigation einklappen');
    expect(btn.textContent).toContain('Einklappen');
    expect(v.host.querySelector('[data-sv-nav-toggle]')!.getAttribute('aria-label')).toBe('Unterseiten von Orders');
  });
});
