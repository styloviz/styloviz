import { Component, InjectionToken, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  SV_LINK_ADAPTER,
  provideSvLinkAdapter,
  svIsModifiedClick,
  type SvLinkAdapter,
} from './link-adapter';
import { svResetWarnOnce } from '../dev/warn-once';

/** Something an adapter factory can only reach through injection. */
const SOME_PREFIX = new InjectionToken<string>('prefix', {
  providedIn: 'root',
  factory: () => '/app',
});

/**
 * ============================================================================
 *  The link seam — `NV-03-M1`, second half
 * ============================================================================
 *
 * `SvNavLocation` answers "where does this component's state live?". This answers
 * "how does this component render a link, and who navigates?", and no amount of
 * stretching makes one do the other's job — a breadcrumb owns no key, because its
 * state IS the route.
 *
 * The insight the tests below pin: `RouterLink` did two separable things, and
 * only one of them needs a router.
 */

@Component({ standalone: true, template: '' })
class Host {
  readonly links = inject(SV_LINK_ADAPTER);
}

function mount(adapter?: SvLinkAdapter) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: adapter ? [provideSvLinkAdapter(adapter)] : [],
  });
  return TestBed.createComponent(Host).componentInstance.links;
}

beforeEach(() => svResetWarnOnce());

describe('svHrefLinkAdapter — the default', () => {
  it('is what a component gets with nothing provided', () => {
    expect(mount().kind).toBe('href');
  });

  it('renders a string target as its own href', () => {
    expect(mount().href('/admin/orders')).toBe('/admin/orders');
  });

  /** The array form is what every `BreadcrumbItem` in the wild already holds. */
  it('joins the segment array into a path', () => {
    expect(mount().href(['/admin', 'orders', '1042'])).toBe('/admin/orders/1042');
  });

  it('is not a link when there is nothing to point at', () => {
    expect(mount().href('')).toBeNull();
    expect(mount().href([])).toBeNull();
  });

  /**
   * ★ Targets come from data — a CMS trail, a config-file menu — so a script
   * scheme is an injection, not a destination. The spellings are the ones a
   * prefix check misses and the browser still runs.
   */
  it.each([
    'javascript:alert(1)',
    ' JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
  ])('refuses the unsafe target %j', (target) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(mount().href(target)).toBeNull();
    expect(mount().href([target])).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it.each([
    '/admin/orders',
    'orders/1042',
    '?page=2',
    '#section',
    'https://example.com/docs',
    'mailto:support@example.com',
    'tel:+15551234567',
  ])('keeps the safe target %j', (target) => {
    expect(mount().href(target)).toBe(target);
  });

  /**
   * ★ `navigate` returns false, which is the whole design: the adapter did not
   * take the navigation, so the component leaves the anchor alone and the browser
   * follows the href. A component with no router can still render a real,
   * shareable, right-clickable link — it just reloads when followed.
   */
  it('declines the navigation, leaving the anchor to the browser', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(mount().navigate('/admin')).toBe(false);
    warn.mockRestore();
  });

  /**
   * ★ And it says so, once. Silence would be the worst outcome of this change: an
   * app that upgrades and starts doing full page loads still WORKS, so nothing
   * fails, nothing logs, and the regression is found weeks later by somebody
   * wondering why the app feels slow.
   */
  it('warns once, naming the provider that fixes it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const links = mount();

    links.navigate('/a');
    links.navigate('/b');
    links.navigate('/c');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('provideSvLinkAdapter');
    warn.mockRestore();
  });
});

describe('provideSvLinkAdapter', () => {
  /** The consumer's ten lines, in the shape the ADR documents. */
  const router: SvLinkAdapter = {
    kind: 'fake-router',
    href: (target) => (typeof target === 'string' ? target : target.join('/')),
    navigate: () => true,
  };

  /**
   * ★ The form a real adapter needs, and the reason the value form is a trap.
   * Every useful adapter reaches a router, and `inject()` inside `href` or
   * `navigate` runs when a TEMPLATE calls it — outside any injection context —
   * throwing NG0203 at click time rather than at startup. A factory injects once,
   * where it is legal. The first draft of the documented example got this wrong.
   */
  it('accepts a factory, so an adapter can inject what it needs', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideSvLinkAdapter(() => {
          const injected = inject(SOME_PREFIX);
          return {
            kind: 'factory-made',
            href: (target) => injected + String(target),
            navigate: () => true,
          };
        }),
      ],
    });
    const links = TestBed.createComponent(Host).componentInstance.links;

    expect(links.kind).toBe('factory-made');
    expect(links.href('/orders')).toBe('/app/orders');
  });

  it('replaces the default', () => {
    expect(mount(router).kind).toBe('fake-router');
  });

  /**
   * ★ The rule, shared with `sv-mega-menu`: the component cancels the browser's
   * navigation exactly when the adapter says it took it. One event, one
   * navigation — `NV-07-I12`'s defect, avoided before it can be written.
   */
  it('reports that it took the navigation', () => {
    expect(mount(router).navigate('/admin')).toBe(true);
  });

  it('does not warn — there is nothing to warn about', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mount(router).navigate('/admin');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('svIsModifiedClick', () => {
  /**
   * ★ Shared so the answer cannot drift between components. Cancelling one of
   * these takes "open in a new tab" away from a navigation control, which is
   * where people use it most.
   */
  it.each([
    ['metaKey', { metaKey: true }],
    ['ctrlKey', { ctrlKey: true }],
    ['shiftKey', { shiftKey: true }],
    ['altKey', { altKey: true }],
    ['middle button', { button: 1 }],
  ])('recognises a %s click', (_name, init) => {
    expect(svIsModifiedClick(new MouseEvent('click', init))).toBe(true);
  });

  it('leaves a plain click alone', () => {
    expect(svIsModifiedClick(new MouseEvent('click'))).toBe(false);
  });
});
