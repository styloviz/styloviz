import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { MenuGroup } from '@styloviz/core';
import { ICON_REGISTRY } from '@styloviz/icons';
import { SvSidebarComponent } from './sidebar.component';
import { NAVIGATION_ITEMS } from './navigation.data';

/**
 * The sidebar renders whatever navigation the host hands it, in two widths. The
 * collapsed width is where the interesting failure lives: labels disappear, so
 * every item has to keep a name some other way, or a screen-reader user is
 * given a column of unlabelled icons.
 */

const GROUPS: MenuGroup[] = [
  {
    groupLabel: 'Overview',
    items: [
      { label: 'Dashboard', route: '/dashboard', icon: 'chart-bar' },
      { label: 'Reports', route: '/reports', icon: 'book-open', badge: '3', badgeColor: 'primary' },
    ],
  },
  {
    groupLabel: 'Manage',
    items: [{ label: 'Users', route: '/users', icon: 'users' }],
  },
];

async function setup(inputs: Partial<ComponentInput<SvSidebarComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvSidebarComponent, {
    inputs: { menuGroups: GROUPS, ...inputs } as ComponentInput<SvSidebarComponent>,
    providers: [provideRouter([])],
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

describe('SvSidebarComponent — the navigation it was given', () => {
  it('is a named navigation landmark', async () => {
    await setup();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy();
  });

  it('renders every group and every item', async () => {
    await setup();
    expect(screen.getByText('Overview')).toBeTruthy();
    expect(screen.getByText('Manage')).toBeTruthy();
    for (const label of ['Dashboard', 'Reports', 'Users']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('points each item at its route', async () => {
    const { fixture } = await setup();
    const hrefs = [...el(fixture).querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/users');
  });

  it('shows a badge on the item that has one', async () => {
    await setup();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders nothing at all when given no navigation', async () => {
    const { fixture } = await setup({ menuGroups: [] });
    expect(el(fixture).querySelector('nav')?.textContent?.trim()).toBe('');
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy();
  });
});

describe('SvSidebarComponent — collapsed', () => {
  it('keeps every item named once the labels are gone', async () => {
    // Collapsed, the visible text is dropped and only the icon is left. Without
    // a title or an aria-label on the link, that is a column of anonymous
    // buttons to anyone not looking at it.
    const { fixture } = await setup({ collapsed: true });
    const links = [...el(fixture).querySelectorAll<HTMLAnchorElement>('nav a')];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const name = link.getAttribute('aria-label') ?? link.getAttribute('title') ?? link.textContent?.trim() ?? '';
      expect(name).not.toBe('');
    }
  });

  it('still renders all the items', async () => {
    const { fixture } = await setup({ collapsed: true });
    expect([...el(fixture).querySelectorAll('nav a')].length).toBe(3);
  });
});

describe('SvSidebarComponent — the footer strip', () => {
  it('shows the version it was told to show', async () => {
    await setup({ version: 'v2.4.1' });
    expect(screen.getAllByText('v2.4.1').length).toBeGreaterThan(0);
  });

  it('points the resource links where the host said', async () => {
    await setup({
      docsUrl: 'https://docs.example.test',
      githubUrl: 'https://github.example.test',
      npmUrl: 'https://npm.example.test',
      communityUrl: 'https://forum.example.test',
    });
    expect(screen.getByRole('link', { name: 'Documentation' }).getAttribute('href')).toBe('https://docs.example.test');
    expect(screen.getByRole('link', { name: 'npm package' }).getAttribute('href')).toBe('https://npm.example.test');
    expect(screen.getByRole('link', { name: 'Community forum' }).getAttribute('href')).toBe('https://forum.example.test');
  });

  it('opens every outbound link safely', async () => {
    const { fixture } = await setup();
    const outbound = [...el(fixture).querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')];
    expect(outbound.length).toBeGreaterThan(0);
    for (const a of outbound) {
      expect(a.getAttribute('rel')).toContain('noopener');
    }
  });

  it('drops the resource icons when the host does not want them, keeping the version', async () => {
    await setup({ showFooterLinks: false, version: 'v9' });
    expect(screen.queryByRole('link', { name: 'Documentation' })).toBeNull();
    expect(screen.getAllByText('v9').length).toBeGreaterThan(0);
  });
});

describe('SvSidebarComponent — talking to the shell', () => {
  // ★ This used to call `mobileClose.emit()` itself and then assert that it
  //   had fired — true of any component. It now drives the real control: a
  //   navigation link, which closes the mobile overlay as it navigates.
  it('asks the shell to close the mobile overlay when a link is followed', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSidebarComponent, {
      inputs: { menuGroups: GROUPS, mobileOpen: true } as ComponentInput<SvSidebarComponent>,
      providers: [provideRouter([{ path: '**', children: [] }])],
    });
    let closes = 0;
    fixture.componentInstance.mobileClose.subscribe(() => { closes += 1; });

    await userEvent.click(screen.getAllByRole('link', { name: /Users/ })[0]);

    expect(closes).toBe(1);
  });
});

describe('SvSidebarComponent — route awareness', () => {
  it('selects nothing when the url names no child', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.activeChildId()).toBeNull();
  });

  it('knows which top-level section it is in', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.isOnRoute('/')).toBe(true);
    expect(fixture.componentInstance.isOnRoute('/nowhere')).toBe(false);
  });

  it('styles the selected child differently from the rest', async () => {
    const { fixture } = await setup();
    const c = fixture.componentInstance;
    expect(c.childItemClass('anything')).toContain('text-gray-500');
    expect(c.childItemClass('anything')).not.toContain('bg-primary-50');
  });

  /**
   * This used to assert that the component's private map held a path for each
   * of the seven names it "ships", and '' for anything else — pinning the very
   * limit that made the map wrong: a consumer could only use those seven, and
   * an eighth silently rendered nothing.
   *
   * `item.icon` goes straight to `<sv-icon>` now, so the claim worth pinning is
   * that the name reaches the library — and that the names this package's own
   * demo data uses all resolve in the FREE registry, since `<sv-icon>` reads
   * only that one and a Pro name would render blank.
   */
  it('passes the item icon name through to the library', async () => {
    const { fixture } = await setup();
    const host = fixture.nativeElement as HTMLElement;
    const names = [...host.querySelectorAll('sv-icon')].length;
    expect(names).toBeGreaterThan(0);
    expect([...host.querySelectorAll('svg')].every((n) => n.closest('sv-icon'))).toBe(true);
  });

  it('uses only FREE glyph names in its shipped demo navigation', () => {
    const used = new Set(
      NAVIGATION_ITEMS.flatMap((g) => g.items.map((i) => i.icon)).filter(Boolean),
    );
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) {
      expect(ICON_REGISTRY[name as keyof typeof ICON_REGISTRY], `glyph ${name}`).toBeTruthy();
    }
  });
});
