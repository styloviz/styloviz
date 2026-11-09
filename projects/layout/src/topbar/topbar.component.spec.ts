import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ThemeService } from '@styloviz/core/services';
import { SvTopbarComponent } from './topbar.component';

/**
 * The topbar owns two things — the sidebar toggles and the theme toggle — and
 * three slots. On its own it reports the toggles as outputs; inside the shell
 * it drives the shell (see the shell spec).
 */

@Component({
  standalone: true,
  imports: [SvTopbarComponent],
  template: `
    <sv-topbar
      [sidebarCollapsed]="collapsed()"
      [showSidebarToggle]="toggles()"
      [showThemeToggle]="theme()"
      (toggleSidebar)="desktop = desktop + 1"
      (toggleMobileSidebar)="mobile = mobile + 1">
      <span topbar-start>Acme</span>
      <input topbar-search aria-label="Search" />
      <button topbar-actions type="button">Account</button>
    </sv-topbar>
  `,
})
class HostComponent {
  readonly collapsed = signal(false);
  readonly toggles = signal(true);
  readonly theme = signal(true);
  desktop = 0;
  mobile = 0;
}

async function setup() {
  TestBed.resetTestingModule();
  const r = await render(HostComponent);
  return { ...r, host: r.fixture.componentInstance };
}

describe('SvTopbarComponent', () => {
  it('is the banner landmark and carries the three slots', async () => {
    await setup();
    const banner = screen.getByRole('banner');
    expect(banner.textContent).toContain('Acme');
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy();
  });

  it('reports the desktop toggle, and says which way it will go', async () => {
    const { host, fixture } = await setup();
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(toggle);
    expect(host.desktop).toBe(1);
    host.collapsed.set(true);
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: 'Expand sidebar' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('reports the small-screen hamburger', async () => {
    const { host } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Open sidebar' }));
    expect(host.mobile).toBe(1);
  });

  it('switches the theme and names the mode it will switch to', async () => {
    await setup();
    const theme = TestBed.inject(ThemeService);
    const before = theme.isDark();
    await userEvent.click(screen.getByRole('button', { name: before ? 'Switch to light mode' : 'Switch to dark mode' }));
    expect(theme.isDark()).toBe(!before);
    expect(screen.getByRole('button', { name: before ? 'Switch to dark mode' : 'Switch to light mode' })).toBeTruthy();
  });

  it('drops the toggles a host does not want', async () => {
    const { host, fixture } = await setup();
    host.toggles.set(false);
    host.theme.set(false);
    fixture.detectChanges();
    expect(screen.queryByRole('button', { name: /sidebar/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /mode/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Account' })).toBeTruthy();
  });

  it('links nowhere a host did not put there', async () => {
    const { fixture } = await setup();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('a').length).toBe(0);
  });
});
