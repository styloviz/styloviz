import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvTopbarComponent } from './topbar.component';

/**
 * The topbar's job is mostly wiring: two toggles the shell listens to, a set of
 * links that are either in-app routes or outbound URLs, and a small-screen
 * overflow panel.
 *
 * That panel is what these lean on. It used to be marked up as `role="menu"`
 * with `role="menuitem"` links — a promise of arrow-key navigation and focus
 * management that nothing in this component makes good on, so a screen reader
 * announced a menu of eight items and then the arrow keys did nothing. It is a
 * disclosure of ordinary links, and that is what it now says it is.
 */

async function setup(inputs: Partial<ComponentInput<SvTopbarComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvTopbarComponent, {
    inputs: inputs as ComponentInput<SvTopbarComponent>,
    providers: [provideRouter([])],
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const linksNamed = (name: string) => screen.queryAllByRole('link', { name });
const overflowTrigger = () => screen.getByRole('button', { name: 'More navigation' });

describe('SvTopbarComponent — the shell toggles', () => {
  it('asks the shell to collapse the sidebar', async () => {
    let toggles = 0;
    const { fixture } = await setup();
    fixture.componentInstance.toggleSidebar.subscribe(() => { toggles += 1; });

    await userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(toggles).toBe(1);
  });

  it('says which way the sidebar toggle will go, and where it is now', async () => {
    const { fixture } = await setup();
    const open = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(open.getAttribute('aria-pressed')).toBe('true');

    fixture.componentRef.setInput('sidebarCollapsed', true);
    fixture.detectChanges();
    const closed = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(closed.getAttribute('aria-pressed')).toBe('false');
  });

  it('asks the shell to open the mobile sidebar', async () => {
    let toggles = 0;
    const { fixture } = await setup();
    fixture.componentInstance.toggleMobileSidebar.subscribe(() => { toggles += 1; });

    await userEvent.click(screen.getByRole('button', { name: 'Open sidebar' }));
    expect(toggles).toBe(1);
  });

  it('offers a theme switch that says what it will do', async () => {
    await setup();
    const toggle = screen.getByRole('button', { name: /Switch to (light|dark) mode/ });
    expect(toggle).toBeTruthy();
  });
});

describe('SvTopbarComponent — the overflow panel', () => {
  it('is closed to start with', async () => {
    const { fixture } = await setup();
    expect(overflowTrigger().getAttribute('aria-expanded')).toBe('false');
    expect(el(fixture).querySelector(`#${fixture.componentInstance['menuId']}`)).toBeNull();
  });

  it('points the trigger at the panel it opens', async () => {
    const { fixture } = await setup();
    const id = fixture.componentInstance['menuId'];
    expect(overflowTrigger().getAttribute('aria-controls')).toBe(id);

    await userEvent.click(overflowTrigger());
    fixture.detectChanges();
    expect(overflowTrigger().getAttribute('aria-expanded')).toBe('true');
    expect(el(fixture).querySelector(`#${id}`)).not.toBeNull();
  });

  it('gives every instance its own panel id', async () => {
    // Both topbars must share one application: ids are per application (svUniqueId).
    const { fixture: a } = await setup();
    const first = a.componentInstance['menuId'];
    const b = TestBed.createComponent(SvTopbarComponent);
    b.detectChanges();
    await b.whenStable();
    expect(first).toBeTruthy();
    expect(b.componentInstance['menuId']).not.toBe(first);
  });

  it('does not claim to be a menu it cannot behave like', async () => {
    // `role="menu"` commits to arrow-key navigation and focus management. These
    // are links in a disclosure.
    const { fixture } = await setup();
    await userEvent.click(overflowTrigger());
    fixture.detectChanges();

    expect(el(fixture).querySelector('[role="menu"]')).toBeNull();
    expect(el(fixture).querySelector('[role="menuitem"]')).toBeNull();
    expect(screen.queryAllByRole('link', { name: 'Docs' }).length).toBeGreaterThan(0);
  });

  it('closes on Escape', async () => {
    const { fixture } = await setup();
    await userEvent.click(overflowTrigger());
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(overflowTrigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on a pointer down outside it', async () => {
    const { fixture } = await setup();
    await userEvent.click(overflowTrigger());
    fixture.detectChanges();

    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(overflowTrigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('stays open for a pointer down inside it', async () => {
    const { fixture } = await setup();
    await userEvent.click(overflowTrigger());
    fixture.detectChanges();

    overflowTrigger().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(overflowTrigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('closes itself once a link in it has been followed', async () => {
    const { fixture } = await setup();
    await userEvent.click(overflowTrigger());
    fixture.detectChanges();

    const inPanel = el(fixture).querySelector<HTMLAnchorElement>(`#${fixture.componentInstance['menuId']} a`)!;
    await userEvent.click(inPanel);
    fixture.detectChanges();
    expect(overflowTrigger().getAttribute('aria-expanded')).toBe('false');
  });
});

describe('SvTopbarComponent — routes in, URLs out', () => {
  it('navigates in-app for a path', async () => {
    const { fixture } = await setup({ docsUrl: '/docs' });
    expect(fixture.componentInstance['isInternal']('/docs')).toBe(true);
    const docs = linksNamed('Docs')[0];
    expect(docs.getAttribute('href')).toBe('/docs');
    expect(docs.getAttribute('target')).toBeNull();
  });

  it('opens a new tab, safely, for an outbound URL', async () => {
    const { fixture } = await setup({ docsUrl: 'https://docs.example.test' });
    expect(fixture.componentInstance['isInternal']('https://docs.example.test')).toBe(false);
    const docs = linksNamed('Docs')[0];
    expect(docs.getAttribute('href')).toBe('https://docs.example.test');
    expect(docs.getAttribute('target')).toBe('_blank');
    expect(docs.getAttribute('rel')).toContain('noopener');
  });

  it('groups the desktop links as a named landmark', async () => {
    await setup();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
  });
});

describe('SvTopbarComponent — what a host can turn off', () => {
  it('hides the Templates link on request', async () => {
    await setup();
    expect(linksNamed('Templates').length).toBeGreaterThan(0);

    await setup({ showTemplates: false });
    expect(linksNamed('Templates').length).toBe(0);
  });

  it('shows a License link only when asked', async () => {
    await setup();
    expect(linksNamed('License').length).toBe(0);

    await setup({ showLicense: true });
    expect(linksNamed('License').length).toBeGreaterThan(0);
  });

  it('drops the GitHub and npm quick links on request', async () => {
    await setup();
    expect(screen.queryAllByRole('link', { name: 'View on GitHub' }).length).toBe(1);

    await setup({ showGithub: false, showNpm: false });
    expect(screen.queryAllByRole('link', { name: 'View on GitHub' }).length).toBe(0);
    expect(screen.queryAllByRole('link', { name: 'View on npm' }).length).toBe(0);
  });

  it('drops its own Pro call to action when the host provides one', async () => {
    await setup();
    expect(screen.queryAllByRole('link', { name: /Get Pro/ }).length).toBe(1);

    await setup({ showGetPro: false });
    expect(screen.queryAllByRole('link', { name: /Get Pro/ }).length).toBe(0);
  });
});
