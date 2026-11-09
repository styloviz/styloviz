import { TestBed } from '@angular/core/testing';
import { render, fireEvent, type ComponentInput } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core/dev';
import { type MenuGroup } from '@styloviz/core/models';
import { SV_LINK_ADAPTER, type SvLinkAdapter } from '@styloviz/core/nav';
import { SvSidebarNavComponent } from './sidebar-nav.component';
import type { SidebarNavSelection } from './sidebar-nav.model';

/**
 * `SR-30b` — the rest of the sidebar ticket: the list scrolls in
 * `sv-scroll-area` with edge fades, a third level, a push drawer, and swipe
 * to close / swipe in from the edge.
 */

const GROUPS: MenuGroup[] = [
  {
    groupLabel: 'Workspace',
    items: [
      { label: 'Dashboard', route: '/dashboard', icon: 'home' },
      {
        id: 'settings', label: 'Settings', route: '/settings', icon: 'settings',
        childGroups: [{
          label: 'Account',
          items: [
            { id: 'general', label: 'General' },
            { id: 'team', label: 'Team', children: [{ id: 'members', label: 'Members' }, { id: 'roles', label: 'Roles' }] },
          ],
        }],
      },
      { id: 'reports', label: 'Reports', route: '/reports', icon: 'chart', childGroups: [{ label: 'Kind', items: [{ id: 'sales', label: 'Sales' }] }] },
    ],
  },
];

const ADAPTER: SvLinkAdapter = { kind: 'spec', href: t => (typeof t === 'string' ? t : t.join('/')), navigate: () => true };

let originalRect: typeof Element.prototype.getBoundingClientRect;
beforeEach(() => {
  originalRect = Element.prototype.getBoundingClientRect;
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = originalRect;
});

/** jsdom has no layout; give `<html>` a width so the drawer can measure it. */
function viewport(width: number): void {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this === document.documentElement) return { width, height: 800 } as DOMRect;
    if (this.tagName === 'ASIDE') {
      // Open: on screen. Closed: just past the start edge, as the CSS puts it.
      const open = !this.className.includes('invisible');
      return (open
        ? { width: 288, height: 800, left: 0, right: 288, top: 0, bottom: 800 }
        : { width: 288, height: 800, left: -288, right: 0, top: 0, bottom: 800 }) as DOMRect;
    }
    return { width: 0, height: 0 } as DOMRect;
  };
}

async function setup(inputs: Partial<ComponentInput<SvSidebarNavComponent>> = {}) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const { fixture } = await render(SvSidebarNavComponent, {
    inputs: { menuGroups: GROUPS, mobileBreakpoint: 0, ...inputs } as ComponentInput<SvSidebarNavComponent>,
    providers: [{ provide: SV_LINK_ADAPTER, useValue: ADAPTER }],
  });
  const host = fixture.nativeElement as HTMLElement;
  await fixture.whenStable();
  fixture.detectChanges();
  return {
    fixture,
    c: fixture.componentInstance,
    host,
    link: (href: string) => host.querySelector<HTMLAnchorElement>(`a[href="${href}"]`),
    aside: () => host.querySelector('aside')!,
  };
}

function pointer(type: string, target: EventTarget, x: number, y = 200, pointerType = 'touch'): void {
  const e = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(e, { clientX: x, clientY: y, pointerType, pointerId: 1 });
  target.dispatchEvent(e);
}

describe('sidebar-nav (SR-30b) — the list scrolls with edge fades', () => {
  it('★ the nav sits in a filling sv-scroll-area that adds no tab stop', async () => {
    const v = await setup();
    const area = v.host.querySelector('sv-scroll-area[data-sv-nav-scroll]') as HTMLElement;
    expect(area).not.toBeNull();
    expect(area.className).toContain('flex-1');
    expect(area.className).toContain('min-h-0');            // the `fill` host classes
    expect(area.querySelector('nav')).not.toBeNull();
    expect(area.querySelector('[data-sv-port]')!.hasAttribute('tabindex')).toBe(false);
  });

  it("scrollFade='none' turns the fades off; 'shadow' switches their style", async () => {
    const none = await setup({ scrollFade: 'none' });
    const port = none.host.querySelector<HTMLElement>('[data-sv-port]')!;
    Object.defineProperty(port, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(port, 'scrollHeight', { value: 900, configurable: true });
    port.dispatchEvent(new Event('scroll'));
    none.fixture.detectChanges();
    expect(none.host.querySelector('[data-sv-fade-end]')).toBeNull();

    const shadow = await setup({ scrollFade: 'shadow' });
    const p2 = shadow.host.querySelector<HTMLElement>('[data-sv-port]')!;
    Object.defineProperty(p2, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(p2, 'scrollHeight', { value: 900, configurable: true });
    p2.dispatchEvent(new Event('scroll'));
    shadow.fixture.detectChanges();
    expect(shadow.host.querySelector('[data-sv-fade-end]')!.className).toContain('from-black/15');
  });
});

describe('sidebar-nav (SR-30b) — a third level', () => {
  it('★ a sub-item with children toggles them; links carry the leaf id', async () => {
    const v = await setup({ activeRoute: '/settings' });
    expect(v.link('/settings?c=members')).toBeNull();
    const toggle = v.host.querySelector<HTMLButtonElement>('[data-sv-nav-toggle][aria-label="Team sub-pages"]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    v.fixture.detectChanges();
    expect(v.c.expandedIds()).toContain('settings::team');
    expect(v.link('/settings?c=members')).not.toBeNull();
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).not.toBeNull();
  });

  it('★ a current leaf opens its branch; one page is current, the trail is "true"', async () => {
    const v = await setup({ activeRoute: '/settings', activeChildId: 'roles' });
    expect(v.link('/settings?c=roles')!.getAttribute('aria-current')).toBe('page');
    expect(v.link('/settings?c=team')!.getAttribute('aria-current')).toBe('true');
    expect(v.link('/settings')!.getAttribute('aria-current')).toBe('true');
    expect(v.host.querySelectorAll('[aria-current="page"]').length).toBe(1);
    // The trail stays open, so its sub-item has no toggle.
    expect(v.host.querySelector('[data-sv-nav-toggle][aria-label="Team sub-pages"]')).toBeNull();
  });

  it('picking a leaf reports it and the sub-item above it', async () => {
    const v = await setup({ activeRoute: '/settings', activeChildId: 'members' });
    const picked: SidebarNavSelection[] = [];
    v.c.itemSelected.subscribe(e => picked.push(e));
    v.link('/settings?c=roles')!.click();
    expect(picked[0].child!.id).toBe('roles');
    expect(picked[0].parentChild!.id).toBe('team');
  });

  it("expandMode='single' keeps an open third level with its own section", async () => {
    const v = await setup({ activeRoute: '/dashboard', expandMode: 'single', expandedIds: ['settings', 'settings::team'] });
    v.host.querySelector<HTMLButtonElement>('[data-sv-nav-toggle][aria-label="Reports sub-pages"]')!.click();
    v.fixture.detectChanges();
    expect(v.c.expandedIds()).toEqual(['reports']);
    v.host.querySelector<HTMLButtonElement>('[data-sv-nav-toggle][aria-label="Settings sub-pages"]')!.click();
    v.fixture.detectChanges();
    expect(v.c.expandedIds()).toEqual(['settings']);
  });

  it('★ when a section closes over a focused leaf, focus goes to the SECTION row', async () => {
    const v = await setup({ activeRoute: '/settings', activeChildId: 'members' });
    const leaf = v.link('/settings?c=members')!;
    leaf.focus();
    v.fixture.componentRef.setInput('collapsed', true);
    v.fixture.detectChanges();
    await v.fixture.whenStable();
    expect(document.activeElement).toBe(v.link('/settings'));
  });
});

describe('sidebar-nav (SR-30b) — the drawer', () => {
  it("★ drawerMode='push' opens in the flow: no backdrop, no fixed position, the page moves", async () => {
    viewport(400);
    const v = await setup({ mobileBreakpoint: 1024, drawerMode: 'push', mobileOpen: false });
    expect(v.aside().className).toContain('-ms-72');
    expect(v.aside().className).not.toContain('fixed');
    v.fixture.componentRef.setInput('mobileOpen', true);
    v.fixture.detectChanges();
    expect(v.aside().className).toContain('ms-0');
    expect(v.host.querySelector('button[aria-hidden="true"]')).toBeNull();   // no backdrop
  });

  it('★ a swipe toward the edge past a third of the width closes it; a short one springs back', async () => {
    viewport(400);
    const v = await setup({ mobileBreakpoint: 1024, mobileOpen: true });
    const link = v.link('/dashboard')!;

    pointer('pointerdown', link, 250);
    pointer('pointermove', document, 220);
    pointer('pointermove', document, 200);
    v.fixture.detectChanges();
    expect(v.aside().style.transform).toBe('translateX(-50px)');
    pointer('pointerup', document, 200);
    v.fixture.detectChanges();
    expect(v.c.mobileOpen()).toBe(true);
    expect(v.aside().style.transform).toBe('');

    pointer('pointerdown', link, 250);
    pointer('pointermove', document, 200);
    pointer('pointermove', document, 120);
    pointer('pointerup', document, 120);
    v.fixture.detectChanges();
    expect(v.c.mobileOpen()).toBe(false);
  });

  it('a mouse drag is not a swipe', async () => {
    viewport(400);
    const v = await setup({ mobileBreakpoint: 1024, mobileOpen: true });
    const link = v.link('/dashboard')!;
    pointer('pointerdown', link, 250, 200, 'mouse');
    pointer('pointermove', document, 50, 200, 'mouse');
    pointer('pointerup', document, 50, 200, 'mouse');
    expect(v.c.mobileOpen()).toBe(true);
  });

  it('★ edgeSwipe opens the drawer from the start edge of the screen', async () => {
    viewport(400);
    const v = await setup({ mobileBreakpoint: 1024, mobileOpen: false, edgeSwipe: true });
    pointer('pointerdown', document.body, 10);
    pointer('pointermove', document, 40);
    pointer('pointermove', document, 90);
    pointer('pointerup', document, 90);
    v.fixture.detectChanges();
    expect(v.c.mobileOpen()).toBe(true);
  });

  it('a touch far from the drawer\'s edge does not open it', async () => {
    viewport(400);
    const v = await setup({ mobileBreakpoint: 1024, mobileOpen: false, edgeSwipe: true });
    pointer('pointerdown', document.body, 60);
    pointer('pointermove', document, 160);
    pointer('pointerup', document, 160);
    expect(v.c.mobileOpen()).toBe(false);
  });

  it('without edgeSwipe, nothing listens at the edge', async () => {
    viewport(400);
    const v = await setup({ mobileBreakpoint: 1024, mobileOpen: false });
    pointer('pointerdown', document.body, 10);
    pointer('pointermove', document, 120);
    pointer('pointerup', document, 120);
    expect(v.c.mobileOpen()).toBe(false);
  });

  it('a vertical scroll inside the drawer is not a swipe', async () => {
    viewport(400);
    const v = await setup({ mobileBreakpoint: 1024, mobileOpen: true });
    const link = v.link('/dashboard')!;
    pointer('pointerdown', link, 250, 200);
    pointer('pointermove', document, 245, 260);
    pointer('pointermove', document, 120, 400);
    pointer('pointerup', document, 120, 400);
    expect(v.c.mobileOpen()).toBe(true);
    fireEvent.keyDown(link, { key: 'ArrowDown' });
  });
});

describe('sidebar-nav (SR-30c) — the row-end slot', () => {
  it('★ renders beside each expanded row with the item and whether it is current; not in the rail', async () => {
    const { Component, signal } = await import('@angular/core');
    const { SvSidebarNavItemEndDirective } = await import('./sidebar-nav.templates');
    @Component({
      standalone: true,
      imports: [SvSidebarNavComponent, SvSidebarNavItemEndDirective],
      template: `<sv-sidebar-nav [menuGroups]="groups" activeRoute="/dashboard" [mobileBreakpoint]="0" [collapsed]="rail()">
        <ng-template svSidebarNavItemEnd let-item let-current="current"><i data-end [attr.data-current]="current">{{ item.label }}</i></ng-template>
      </sv-sidebar-nav>`,
    })
    class Host {
      groups = GROUPS;
      rail = signal(false);
    }
    TestBed.resetTestingModule();
    const { fixture } = await render(Host, { providers: [{ provide: SV_LINK_ADAPTER, useValue: ADAPTER }] });
    const ends = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-end]')];
    expect(ends.map((e) => e.textContent)).toEqual(['Dashboard', 'Settings', 'Reports']);
    expect(ends[0].getAttribute('data-current')).toBe('true');
    // Beside the link, not inside it.
    expect(ends[0].closest('a')).toBeNull();
    fixture.componentInstance.rail.set(true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-end]').length).toBe(0);
  });
});
