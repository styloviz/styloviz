import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { type MenuGroup } from '@styloviz/core/models';
import { SV_LINK_ADAPTER, type SvLinkAdapter } from '@styloviz/core/nav';
import { SvSidebarNavComponent } from './sidebar-nav.component';
import { SV_SIDEBAR_NAV_LABELS } from './sidebar-nav.labels';

/** FL-B1d: the landmark's name is the package's English until an app says otherwise. */
const GROUPS: MenuGroup[] = [{ groupLabel: 'Overview', items: [{ label: 'Dashboard', route: '/dashboard', icon: 'home' }] }];

const links: SvLinkAdapter = {
  kind: 'spec',
  href: (target) => (typeof target === 'string' ? target : target.join('/')),
  navigate: () => true,
};

async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvSidebarNavComponent, {
    inputs: { menuGroups: GROUPS },
    providers: [{ provide: SV_LINK_ADAPTER, useValue: links }, ...(providers as never[])],
  });
}

describe('SvSidebarNavComponent — labels (FL-B1d)', () => {
  it('names the navigation landmark in English by default', async () => {
    await setup();
    expect(screen.getByRole('navigation', { name: SV_SIDEBAR_NAV_LABELS.navigation })).toBeTruthy();
  });

  it('renders the landmark name an app provides', async () => {
    await setup([provideSvLabels({ sidebarNav: { navigation: 'Hauptnavigation' } })]);
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull();
  });
});
