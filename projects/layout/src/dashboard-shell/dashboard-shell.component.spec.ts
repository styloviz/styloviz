import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvDashboardShellComponent } from './dashboard-shell.component';
import { SvSidebarComponent } from '../sidebar/sidebar.component';
import { SvTopbarComponent } from '../topbar/topbar.component';
import { SvFooterComponent } from '../footer/footer.component';

/**
 * The shell's job is the state its parts share. The usual shell binds nothing
 * — the topbar's toggles must reach the sidebar through the shell alone — so
 * that is what these drive, through the real controls.
 */

@Component({
  standalone: true,
  imports: [SvDashboardShellComponent, SvSidebarComponent, SvTopbarComponent, SvFooterComponent],
  template: `
    <sv-dashboard-shell [(collapsed)]="collapsed" [(mobileOpen)]="open">
      <sv-sidebar svShellSidebar><a href="/orders">Orders</a></sv-sidebar>
      <sv-topbar svShellTopbar />
      <p>Page</p>
      <sv-footer svShellFooter>© Acme</sv-footer>
    </sv-dashboard-shell>
  `,
})
class HostComponent {
  readonly collapsed = signal(false);
  readonly open = signal(false);
}

@Component({
  standalone: true,
  imports: [SvDashboardShellComponent],
  template: `<sv-dashboard-shell><p>Page</p></sv-dashboard-shell>`,
})
class BareHostComponent {}

async function setup() {
  TestBed.resetTestingModule();
  const r = await render(HostComponent);
  const root = r.fixture.nativeElement as HTMLElement;
  return {
    ...r,
    host: r.fixture.componentInstance,
    aside: root.querySelector('aside') as HTMLElement,
    content: root.querySelector('main')!.parentElement as HTMLElement,
    backdrop: () => root.querySelector('[aria-hidden="true"].fixed'),
  };
}

describe('SvDashboardShellComponent — composition', () => {
  it('places sidebar, topbar, page and footer, with the page in the main region', async () => {
    await setup();
    expect(screen.getByRole('complementary')).toBeTruthy();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main').textContent).toContain('Page');
    expect(screen.getByRole('contentinfo').textContent).toContain('© Acme');
  });

  it('renders no toast host, router outlet or product chrome of its own', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(BareHostComponent);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('sv-toast-host, router-outlet, aside, header, footer')).toBeNull();
  });

  it('offsets the content only when there is a sidebar to make room for', async () => {
    const { content } = await setup();
    expect(content.classList).toContain('lg:ms-64');
    TestBed.resetTestingModule();
    const bare = await render(BareHostComponent);
    const bareContent = (bare.fixture.nativeElement as HTMLElement).querySelector('main')!.parentElement!;
    expect(bareContent.classList).not.toContain('lg:ms-64');
    expect(bareContent.classList).not.toContain('lg:ms-20');
  });
});

@Component({
  standalone: true,
  imports: [SvDashboardShellComponent, SvSidebarComponent],
  template: `
    <div style="height: 300px">
      <sv-dashboard-shell [contained]="true" [(mobileOpen)]="open">
        <sv-sidebar svShellSidebar />
        <p>Page</p>
      </sv-dashboard-shell>
    </div>
  `,
})
class ContainedHostComponent {
  readonly open = signal(true);
}

describe('SvDashboardShellComponent — contained', () => {
  it('is the viewport by default: full dynamic height, a fixed sidebar', async () => {
    const { fixture, aside } = await setup();
    expect((fixture.nativeElement as HTMLElement).querySelector('sv-dashboard-shell > div')!.classList).toContain('h-dvh');
    expect(aside.classList).toContain('fixed');
  });

  it('fills its container and keeps the sidebar and backdrop inside it', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ContainedHostComponent);
    const root = fixture.nativeElement as HTMLElement;
    const frame = root.querySelector('sv-dashboard-shell > div')!;
    // The host takes the container's height too, or `h-full` resolves against an auto height.
    expect(root.querySelector('sv-dashboard-shell')!.classList).toContain('h-full');
    expect(frame.classList).toContain('h-full');
    expect(frame.classList).not.toContain('h-dvh');
    expect(root.querySelector('aside')!.classList).toContain('absolute');
    expect(root.querySelector('aside')!.classList).not.toContain('fixed');
    expect(root.querySelector('[aria-hidden="true"].absolute')).not.toBeNull();
  });
});

describe('SvDashboardShellComponent — one state, three readers', () => {
  it('collapses from the topbar; the sidebar, the content offset and the bound model follow', async () => {
    const { host, aside, content } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(host.collapsed()).toBe(true);
    expect(aside.classList).toContain('w-20');
    expect(content.classList).toContain('lg:ms-20');
    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(host.collapsed()).toBe(false);
  });

  it('follows a collapsed state the host sets', async () => {
    const { host, fixture, aside } = await setup();
    host.collapsed.set(true);
    fixture.detectChanges();
    expect(aside.classList).toContain('w-20');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
  });
});

describe('SvDashboardShellComponent — the small-screen overlay', () => {
  it('opens from the hamburger with a backdrop kept out of the accessibility tree', async () => {
    const { host, aside, backdrop } = await setup();
    expect(backdrop()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Open sidebar' }));
    expect(host.open()).toBe(true);
    expect(aside.classList).toContain('translate-x-0');
    expect(backdrop()).not.toBeNull();
  });

  it('closes on the backdrop', async () => {
    const { host, backdrop } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Open sidebar' }));
    await userEvent.click(backdrop() as HTMLElement);
    expect(host.open()).toBe(false);
  });

  it('closes on Escape', async () => {
    const { host } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Open sidebar' }));
    await userEvent.keyboard('{Escape}');
    expect(host.open()).toBe(false);
  });

  it('closes when a link in the sidebar is followed', async () => {
    const { host } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Open sidebar' }));
    const link = screen.getByRole('link', { name: 'Orders' });
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(host.open()).toBe(false);
  });
});
