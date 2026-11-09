import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvDashboardShellComponent } from './dashboard-shell.component';
import { SvSidebarComponent } from '../sidebar/sidebar.component';
import { SvTopbarComponent } from '../topbar/topbar.component';
import { SV_LAYOUT_LABELS_DE } from '../layout.labels.de';

/**
 * FL-J3-LU-03 — the shell's skip link (WCAG 2.4.1 Bypass Blocks, `N-9`).
 *
 * ★★ Every page in a dashboard starts with the same sidebar and topbar, and a
 *    keyboard user had to Tab through all of it on every page to reach the
 *    content. The shell now renders a "Skip to main content" link as its very
 *    first focusable element; activating it moves focus to `<main>`.
 */

@Component({
  imports: [SvDashboardShellComponent, SvSidebarComponent, SvTopbarComponent],
  template: `
    <sv-dashboard-shell [skipLink]="skip()" [skipLinkLabel]="label()">
      <sv-sidebar svShellSidebar><a href="/orders">Orders</a></sv-sidebar>
      <sv-topbar svShellTopbar />
      <button type="button">In the page</button>
    </sv-dashboard-shell>`,
})
class Host {
  readonly skip = signal(true);
  readonly label = signal('Skip to main content');
}

async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const r = await render(Host, { providers: providers as never[] });
  const root = r.fixture.nativeElement as HTMLElement;
  return { ...r, root, main: root.querySelector('main') as HTMLElement };
}

describe('SvDashboardShellComponent — skip link (FL-J3-LU-03)', () => {
  it('★ is the FIRST thing Tab reaches — before the sidebar and the topbar', async () => {
    await setup();
    document.body.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Skip to main content' }));
  });

  it('★ activating it moves focus to <main>, which can take focus programmatically only', async () => {
    const { main } = await setup();
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(main.getAttribute('tabindex')).toBe('-1');

    link.focus();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(main);

    // The next Tab continues from the content, not from the top of the shell.
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'In the page' }));
  });

  it('targets <main> by id, and does not navigate (a <base href> would resolve #id against the base)', async () => {
    const { main } = await setup();
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(main.id).toBeTruthy();
    expect(link.getAttribute('href')).toBe(`${location.pathname}#${main.id}`);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(main);
  });

  it('is visually hidden until it takes focus, then shown above the sidebar', async () => {
    await setup();
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link.classList).toContain('sr-only');
    expect(link.classList).toContain('focus:not-sr-only');
    expect(link.classList).toContain('focus:absolute');
    // Above the sidebar (z-50), at the inline start (mirrors under RTL).
    expect(link.classList).toContain('focus:z-[60]');
    expect(link.classList).toContain('focus:start-3');
  });

  it('gives two shells on one page two different targets', async () => {
    TestBed.resetTestingModule();
    @Component({
      imports: [SvDashboardShellComponent],
      template: `<sv-dashboard-shell [contained]="true">A</sv-dashboard-shell><sv-dashboard-shell [contained]="true">B</sv-dashboard-shell>`,
    })
    class Two {}
    const { fixture } = await render(Two);
    const mains = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('main'));
    expect(mains[0].id).not.toBe(mains[1].id);
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-sv-skip-link]'));
    expect(links.map((l) => l.getAttribute('href'))).toEqual(mains.map((m) => `${location.pathname}#${m.id}`));
  });

  it('skipLink=false removes it, for a page that already renders its own — never two', async () => {
    const { fixture, root } = await setup();
    fixture.componentInstance.skip.set(false);
    fixture.detectChanges();
    expect(root.querySelector('[data-sv-skip-link]')).toBeNull();
    expect(screen.queryByRole('link', { name: /skip/i })).toBeNull();
  });

  it('skipLinkLabel renames it', async () => {
    const { fixture } = await setup();
    fixture.componentInstance.label.set('Zum Inhalt');
    fixture.detectChanges();
    expect(screen.getByRole('link', { name: 'Zum Inhalt' })).toBeTruthy();
  });

  it('takes its default text from the layout label pack', async () => {
    TestBed.resetTestingModule();
    @Component({
      imports: [SvDashboardShellComponent],
      template: `<sv-dashboard-shell>Page</sv-dashboard-shell>`,
    })
    class Plain {}
    await render(Plain, { providers: [provideSvLabels(SV_LAYOUT_LABELS_DE)] });
    expect(screen.getByRole('link', { name: SV_LAYOUT_LABELS_DE.layout.skipToMainContent })).toBeTruthy();
    expect(SV_LAYOUT_LABELS_DE.layout.skipToMainContent).not.toBe('Skip to main content');
  });

  it('does not use the page-level data-sv-state hook (templates wait on it)', async () => {
    const { root } = await setup();
    expect(root.querySelector('[data-sv-state]')).toBeNull();
  });

  it('focusMain() is the same move, for a host shortcut', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvDashboardShellComponent);
    fixture.componentInstance.focusMain();
    expect(document.activeElement).toBe((fixture.nativeElement as HTMLElement).querySelector('main'));
  });
});
