import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { provideSvNavLocation, type SvNavLocation } from '@styloviz/core';
import { until } from '../../../../src/testing/async';
import { SvBreadcrumbComponent, type BreadcrumbItem } from './breadcrumb.component';

/**
 * ============================================================================
 *  The portalled menu`s context and lifetime — `X-13`, `NV-03-I4`, `NV-03-I5`
 * ============================================================================
 *
 * The sibling-page menu is appended to `document.body`, which is what makes both
 * of these the same shape of problem: it is outside the theme marker above this
 * component, and outside whatever the router swaps.
 *
 * ★ `NV-03-I4` is called the clearest instance of `X-13` in the category, and
 * it is: a menu opened from a dark sidebar rendered light, and a menu in an
 * Arabic page rendered its chevrons pointing the wrong way. Both look like
 * styling bugs and neither is.
 */

const ITEMS: BreadcrumbItem[] = [
  { label: 'Home', routerLink: '/' },
  {
    label: 'Orders',
    routerLink: '/orders',
    menu: [{ label: 'Refunds', routerLink: '/refunds' }],
  },
  { label: 'Order #1042' },
];

const portal = () => document.body.querySelector('.sv-breadcrumb-menu-portal');

async function setup() {
  TestBed.resetTestingModule();
  const { fixture, container } = await render(SvBreadcrumbComponent, {
    inputs: { items: ITEMS },
  });
  return { fixture, container, component: fixture.componentInstance };
}

const menuTrigger = (container: Element) =>
  container.querySelector<HTMLElement>('[aria-haspopup]');

afterEach(() => {
  document.querySelectorAll('.sv-breadcrumb-menu-portal').forEach((n) => n.remove());
  document.body.innerHTML = '';
});

describe('SvBreadcrumbComponent — the portal host', () => {
  it('mounts the menu outside this component`s subtree', async () => {
    const { container, fixture } = await setup();
    menuTrigger(container)!.click();
    fixture.detectChanges();

    expect(portal()).toBeTruthy();
    expect(container.contains(portal())).toBe(false);
  });

  /** ★ `NV-03-I4`: the context the portal would otherwise have left behind. */
  it('carries dir across', async () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('dir', 'rtl');
    document.body.appendChild(wrapper);

    const { container, fixture } = await setup();
    wrapper.appendChild(container);

    menuTrigger(container)!.click();
    fixture.detectChanges();

    expect(portal()?.getAttribute('dir')).toBe('rtl');
  });

  it('labels the host so it can be found in the DOM', async () => {
    const { container, fixture } = await setup();
    menuTrigger(container)!.click();
    fixture.detectChanges();

    expect(portal()?.getAttribute('data-sv-portal')).toBe('breadcrumb-menu');
  });

  it('takes the host away again on close', async () => {
    const { container, fixture, component } = await setup();
    menuTrigger(container)!.click();
    fixture.detectChanges();
    expect(portal()).toBeTruthy();

    component.closeMenu();
    fixture.detectChanges();

    expect(portal()).toBeNull();
  });
});

describe('SvBreadcrumbComponent — a navigation underneath it', () => {
  /**
   * ★ `NV-03-I5`, and doubly odd here: the menu's own items ARE links, so
   * following one closed it — and any other navigation did not.
   */
  it('closes on back and forward', async () => {
    const { container, fixture, component } = await setup();
    menuTrigger(container)!.click();
    fixture.detectChanges();
    expect(portal()).toBeTruthy();

    window.dispatchEvent(new PopStateEvent('popstate'));
    fixture.detectChanges();

    expect(component.openMenuIndex()).toBeNull();
    expect(portal()).toBeNull();
  });

  it('closes when a hash link is followed', async () => {
    const { container, fixture, component } = await setup();
    menuTrigger(container)!.click();
    fixture.detectChanges();

    window.dispatchEvent(new HashChangeEvent('hashchange'));
    fixture.detectChanges();

    expect(component.openMenuIndex()).toBeNull();
  });

  /** Idempotent: every signal calls close, and two can describe one navigation. */
  it('survives both signals arriving for one navigation', async () => {
    const { container, fixture, component } = await setup();
    menuTrigger(container)!.click();
    fixture.detectChanges();

    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    fixture.detectChanges();

    expect(component.openMenuIndex()).toBeNull();
  });
});

describe('SvBreadcrumbComponent — the portal follows a theme change while open', () => {
  /**
   * ★ `NV-03-I4`: `createPortalHost` copies the scoped `.dark` once, at
   * creation, and only `sync()` re-reads it. The theme is toggled on a scoped
   * wrapper rather than `<html>`: a document-level `.dark` is inherited by the
   * portal already (which is why the host deliberately does not copy it), so
   * the case that needs `sync()` is a locally themed section.
   */
  it('re-reads the scoped theme when the menu repositions', async () => {
    const wrapper = document.createElement('div');
    document.body.appendChild(wrapper);

    const { container, fixture } = await setup();
    wrapper.appendChild(container);

    menuTrigger(container)!.click();
    fixture.detectChanges();
    expect(portal()!.classList.contains('dark')).toBe(false);

    wrapper.classList.add('dark');
    window.dispatchEvent(new Event('scroll'));
    await until(() => portal()!.classList.contains('dark'), {
      label: 'the portal picked up the new theme on reposition',
    });

    wrapper.classList.remove('dark');
    window.dispatchEvent(new Event('scroll'));
    await until(() => !portal()!.classList.contains('dark'), {
      label: 'the portal dropped the theme again',
    });
  });
});

/**
 * ============================================================================
 *  Where focus goes when a navigation closes the menu — `NV-03-I5`, `X-14`
 * ============================================================================
 *
 * A user close (Escape, a selection) returns focus to the trigger: the reader
 * was in the menu and expects to land where they opened it. A NAVIGATION close
 * is different — the reader may be anywhere — so focus moves only if it was in
 * the menu, and then through `svRecoverFocus`: the trigger if it is still in
 * the document, else the `<nav>`, never `<body>`.
 *
 * ★ Each navigation here changes the URL before it is signalled, so the
 * specs hold whether or not `svCloseOnNavigation` filters out signals that do
 * not change it.
 */
describe('SvBreadcrumbComponent — focus after a navigation close', () => {
  const startUrl = window.location.href;
  let step = 0;
  const navigate = (): void => {
    step += 1;
    window.history.pushState(null, '', `/breadcrumb-nav-${step}`);
  };

  afterEach(() => window.history.replaceState(null, '', startUrl));

  /** A location whose `notify` stands in for a router's navigation event. */
  function fakeLocation() {
    const listeners = new Set<() => void>();
    const location: SvNavLocation = {
      kind: 'spec',
      read: () => null,
      write: () => undefined,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    return { location, notify: () => listeners.forEach((l) => l()) };
  }

  async function open(providers: unknown[] = []) {
    TestBed.resetTestingModule();
    const { fixture, container } = await render(SvBreadcrumbComponent, {
      inputs: { items: ITEMS },
      providers: providers as never[],
    });
    const trigger = menuTrigger(container)!;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    const item = document.querySelector<HTMLElement>('.sv-breadcrumb-menu-portal [role="menuitem"]')!;
    await until(() => document.activeElement === item, { label: 'focus moved into the menu' });
    return { fixture, container, trigger, component: fixture.componentInstance };
  }

  it('user close (Escape) returns focus to the trigger', async () => {
    const { fixture, trigger, component } = await open();
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();

    expect(component.openMenuIndex()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('user close (a selection) returns focus to the trigger', async () => {
    const { fixture, trigger, component } = await open();
    component.selectMenuItem({ label: 'Refunds' });
    fixture.detectChanges();

    expect(document.activeElement).toBe(trigger);
  });

  it('back/forward with focus in the menu returns it to the trigger, not <body>', async () => {
    const { fixture, trigger, component } = await open();
    navigate();
    window.dispatchEvent(new PopStateEvent('popstate'));
    fixture.detectChanges();

    expect(component.openMenuIndex()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('an SV_NAV_LOCATION notify with focus in the menu returns it to the trigger', async () => {
    const fake = fakeLocation();
    const { fixture, trigger, component } = await open([provideSvNavLocation(fake.location)]);
    navigate();
    fake.notify();
    fixture.detectChanges();

    expect(component.openMenuIndex()).toBeNull();
    expect(portal()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  /** ★ The half that was wrong: focus the reader put elsewhere is left there. */
  it('an SV_NAV_LOCATION notify leaves focus alone when it was not in the menu', async () => {
    const fake = fakeLocation();
    const { fixture, component } = await open([provideSvNavLocation(fake.location)]);

    const search = document.createElement('input');
    document.body.appendChild(search);
    search.focus();

    navigate();
    fake.notify();
    fixture.detectChanges();

    expect(component.openMenuIndex()).toBeNull();
    expect(document.activeElement).toBe(search);
  });

  it('falls back to the nav landmark when the navigation took the trigger away', async () => {
    const fake = fakeLocation();
    const { fixture, container, trigger } = await open([provideSvNavLocation(fake.location)]);
    trigger.remove();

    navigate();
    fake.notify();
    fixture.detectChanges();

    expect(document.activeElement).toBe(container.querySelector('nav'));
    expect(document.activeElement).not.toBe(document.body);
  });
});
