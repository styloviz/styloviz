import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvBreadcrumbComponent, type BreadcrumbItem } from './breadcrumb.component';

/**
 * ============================================================================
 *  A breadcrumb menu inside a dark RTL host — FL-J3-NV-02 (`X-18`, `X-13`)
 * ============================================================================
 *
 * The sibling-page menu is portalled to `<body>`, outside the locally dark,
 * right-to-left section it was opened from. `breadcrumb.portal.spec.ts` pins
 * dir and theme one at a time; this pins the COMBINATION, with two trails in the
 * same host so ids and keyboard scope are proved per instance.
 */

const TRAIL: BreadcrumbItem[] = [
  { label: 'Home', routerLink: '/' },
  {
    label: 'Orders',
    routerLink: '/orders',
    menu: [
      { label: 'Refunds', routerLink: '/refunds' },
      { label: 'Returns', routerLink: '/returns' },
      { label: 'Disputes', routerLink: '/disputes' },
    ],
  },
  { label: 'Order #1042' },
];

@Component({
  imports: [SvBreadcrumbComponent],
  template: `
    <section class="dark" dir="rtl" lang="ar">
      <sv-breadcrumb data-trail="a" [items]="trail" />
      <sv-breadcrumb data-trail="b" [items]="trail" />
    </section>
  `,
})
class HostComponent {
  readonly trail = TRAIL;
}

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(HostComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const trail = (k: 'a' | 'b') => root.querySelector<HTMLElement>(`[data-trail="${k}"]`)!;
  const trigger = (k: 'a' | 'b') => trail(k).querySelector<HTMLButtonElement>('[aria-haspopup]')!;
  const cmp = (k: 'a' | 'b') =>
    fixture.debugElement.query((d) => d.nativeElement === trail(k)).componentInstance as SvBreadcrumbComponent;
  return { fixture, root, trail, trigger, cmp };
}

const portals = () => [...document.body.querySelectorAll<HTMLElement>('.sv-breadcrumb-menu-portal')];
const flush = () => new Promise<void>((r) => queueMicrotask(r));

afterEach(() => {
  document.querySelectorAll('.sv-breadcrumb-menu-portal').forEach((n) => n.remove());
});

describe('SvBreadcrumbComponent — menu in a dark RTL host (FL-J3-NV-02)', () => {
  it('the portalled menu carries dark, dir and lang from the host section', async () => {
    const { fixture, trigger } = await setup();
    trigger('a').click();
    fixture.detectChanges();
    const [p] = portals();
    expect(p).toBeTruthy();
    expect(p.classList.contains('dark')).toBe(true);
    expect(p.getAttribute('dir')).toBe('rtl');
    expect(p.getAttribute('lang')).toBe('ar');
  });

  it('two trails in one host have distinct menu ids, and aria-controls names the right one', async () => {
    const { fixture, trigger, cmp } = await setup();
    expect(cmp('a').menuPanelId).not.toBe(cmp('b').menuPanelId);
    expect(trigger('a').getAttribute('aria-controls')).toBe(cmp('a').menuPanelId);
    expect(trigger('b').getAttribute('aria-controls')).toBe(cmp('b').menuPanelId);

    trigger('b').click();
    fixture.detectChanges();
    const menu = document.getElementById(cmp('b').menuPanelId)!;
    expect(menu.getAttribute('role')).toBe('menu');
    expect(document.getElementById(cmp('a').menuPanelId)).toBeNull();
  });

  it('arrow keys move within the open menu only, and Escape returns to its own trigger', async () => {
    const { fixture, trigger } = await setup();
    trigger('a').click();
    fixture.detectChanges();
    await flush();
    const items = [...portals()[0].querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(document.activeElement).toBe(items[0]);

    const key = (k: string) =>
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    key('ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    key('End');
    expect(document.activeElement).toBe(items[2]);
    key('ArrowDown');
    expect(document.activeElement).toBe(items[2]);
    key('Escape');
    fixture.detectChanges();
    expect(portals()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger('a'));
  });
});
