import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvSidebarComponent } from './sidebar.component';

/**
 * The sidebar is a container: it owns the three widths and the overlay, and
 * renders whatever the host projects. The behaviour worth pinning is the
 * state (inputs on its own, the shell inside one — see the shell spec), the
 * landmark name, and that following a link closes the overlay.
 */

@Component({
  standalone: true,
  imports: [SvSidebarComponent],
  template: `
    <sv-sidebar [collapsed]="collapsed()" [mobileOpen]="open()" [label]="label()" (mobileClose)="closes = closes + 1">
      <span svSidebarBrand>Acme</span>
      <nav aria-label="Sections"><a href="/orders">Orders</a><button type="button">Not a link</button></nav>
      <span svSidebarFooter>v3</span>
    </sv-sidebar>
  `,
})
class HostComponent {
  readonly collapsed = signal(false);
  readonly open = signal(false);
  readonly label = signal('Main navigation');
  closes = 0;
}

async function setup() {
  TestBed.resetTestingModule();
  const r = await render(HostComponent);
  return { ...r, host: r.fixture.componentInstance, aside: r.fixture.nativeElement.querySelector('aside') as HTMLElement };
}

describe('SvSidebarComponent', () => {
  it('projects the brand, the navigation and the footer into their places', async () => {
    const { aside } = await setup();
    const [brand, body, footer] = [...aside.children] as HTMLElement[];
    expect(brand.textContent).toContain('Acme');
    expect(body.querySelector('nav a')?.textContent).toBe('Orders');
    expect(footer.textContent).toContain('v3');
  });

  it('is a complementary landmark named by its label input', async () => {
    const { host, fixture } = await setup();
    expect(screen.getByRole('complementary', { name: 'Main navigation' })).toBeTruthy();
    host.label.set('Hauptnavigation');
    fixture.detectChanges();
    expect(screen.getByRole('complementary', { name: 'Hauptnavigation' })).toBeTruthy();
  });

  it('is the full width expanded and the icon rail collapsed', async () => {
    const { host, fixture, aside } = await setup();
    expect(aside.classList).toContain('w-64');
    host.collapsed.set(true);
    fixture.detectChanges();
    expect(aside.classList).toContain('w-20');
    expect(aside.getAttribute('data-collapsed')).toBe('true');
  });

  it('slides in only while the overlay is open', async () => {
    const { host, fixture, aside } = await setup();
    expect(aside.classList).toContain('-translate-x-full');
    host.open.set(true);
    fixture.detectChanges();
    expect(aside.classList).toContain('translate-x-0');
    expect(aside.classList).not.toContain('-translate-x-full');
  });

  it('hides a closed overlay below lg, so its links leave the tab order — and never hides it from lg up', async () => {
    // FL-J3-LU-07: translated off-canvas alone, a closed drawer's links were
    // still tabbable and announced. `max-lg:` scopes it to the overlay sizes.
    const { host, fixture, aside } = await setup();
    expect(aside.classList).toContain('max-lg:invisible');
    expect(aside.classList).not.toContain('invisible');
    // Visibility rides the slide, so the panel stays painted while it moves.
    expect(aside.className).toContain('transition-[width,translate,visibility]');
    host.open.set(true);
    fixture.detectChanges();
    expect(aside.classList).not.toContain('max-lg:invisible');
  });

  it('asks for the overlay to close when a link inside it is followed — and only a link', async () => {
    const { host } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Not a link' }));
    expect(host.closes).toBe(0);
    screen.getByRole('link', { name: 'Orders' }).addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(screen.getByRole('link', { name: 'Orders' }));
    expect(host.closes).toBe(1);
  });

  /** FL-L4-07: on its own (no shell), Escape did nothing to the open overlay. */
  it('asks to close the open overlay on Escape, and ignores Escape while closed', async () => {
    const { host, fixture } = await setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.closes).toBe(0);
    host.open.set(true);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.closes).toBe(1);
  });
});
