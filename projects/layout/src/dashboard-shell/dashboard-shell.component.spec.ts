import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvDashboardShellComponent } from './dashboard-shell.component';

/**
 * The shell owns one piece of state the sidebar and the topbar both read, and
 * the whole point of it is that they cannot disagree. So what is checked here
 * is the wiring: a toggle in the topbar moves the sidebar, the mobile overlay
 * closes from its backdrop, and the outlet, the footer and the toast hosts are
 * all actually mounted.
 */

async function setup() {
  TestBed.resetTestingModule();
  return render(SvDashboardShellComponent, { providers: [provideRouter([])] });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const backdrop = (f: { nativeElement: unknown }) =>
  el(f).querySelector('[aria-hidden="true"].fixed.inset-0');

describe('SvDashboardShellComponent — what it composes', () => {
  it('mounts the sidebar, the topbar and the footer', async () => {
    const { fixture } = await setup();
    expect(el(fixture).querySelector('sv-sidebar')).toBeTruthy();
    expect(el(fixture).querySelector('sv-topbar')).toBeTruthy();
    expect(el(fixture).querySelector('sv-footer')).toBeTruthy();
  });

  it('gives the page a main region to render into', async () => {
    await setup();
    expect(screen.getByRole('main')).toBeTruthy();
  });

  it('mounts a toast host for every corner, so a toast has somewhere to go', async () => {
    const { fixture } = await setup();
    expect(el(fixture).querySelectorAll('sv-toast-host').length).toBe(6);
  });

  it('shows a user whose picture it does not have by name, not by hot-linking one', async () => {
    // A default avatar URL in a published package is a third-party request every
    // buyer's dashboard makes and cannot clear under a CSP.
    const { fixture } = await setup();
    expect(fixture.componentInstance.currentUser.avatar).toBe('');
    expect(fixture.componentInstance.currentUser.name).toBeTruthy();
  });
});

describe('SvDashboardShellComponent — one state, two readers', () => {
  it('starts expanded', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.sidebarCollapsed()).toBe(false);
  });

  it('collapses from the topbar, and the sidebar sees it', async () => {
    const { fixture } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.sidebarCollapsed()).toBe(true);
    // The same signal is what the topbar's next label is built from.
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
  });

  it('expands again from the same control', async () => {
    const { fixture } = await setup();
    const c = fixture.componentInstance;
    c.toggleSidebar();
    c.toggleSidebar();
    expect(c.sidebarCollapsed()).toBe(false);
  });
});

describe('SvDashboardShellComponent — the mobile overlay', () => {
  it('has no backdrop until the overlay is opened', async () => {
    const { fixture } = await setup();
    expect(backdrop(fixture)).toBeNull();
  });

  it('opens from the topbar hamburger', async () => {
    const { fixture } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Open sidebar' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.mobileSidebarOpen()).toBe(true);
    expect(backdrop(fixture)).not.toBeNull();
  });

  it('closes when the backdrop is clicked', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.toggleMobileSidebar();
    fixture.detectChanges();

    await userEvent.click(backdrop(fixture) as HTMLElement);
    fixture.detectChanges();
    expect(fixture.componentInstance.mobileSidebarOpen()).toBe(false);
    expect(backdrop(fixture)).toBeNull();
  });

  it('closes on request, and stays closed', async () => {
    const { fixture } = await setup();
    const c = fixture.componentInstance;
    c.closeMobileSidebar();
    expect(c.mobileSidebarOpen()).toBe(false);

    c.toggleMobileSidebar();
    c.closeMobileSidebar();
    expect(c.mobileSidebarOpen()).toBe(false);
  });

  it('keeps the backdrop out of the accessibility tree', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.toggleMobileSidebar();
    fixture.detectChanges();
    expect(backdrop(fixture)?.getAttribute('aria-hidden')).toBe('true');
  });
});
