import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import {
  provideSvLinkAdapter,
  svResetWarnOnce,
  type SvLinkAdapter,
  type SvLinkTarget,
} from '@styloviz/core';
import { SvBreadcrumbComponent, type BreadcrumbItem } from './breadcrumb.component';

/**
 * ============================================================================
 *  Links without `@angular/router` — `NV-03-M1`, second half
 * ============================================================================
 *
 * This component used to `import { RouterLink } from '@angular/router'`, and that
 * one import is why `@styloviz/breadcrumb` could not be dropped into a hybrid
 * app, a non-routed widget, or another framework's shell — the exact case
 * `docs/navigation-routing-adr.md` names, with this component as its proof.
 *
 * `RouterLink` did two separable things, and separating them is the fix:
 *   1. an `href` on the anchor — plain string work, no router needed;
 *   2. click interception — which genuinely needs one, so it is the consumer's.
 *
 * What the tests below protect is that (1) still happens with nothing provided.
 * A crumb that is not a real link cannot be middle-clicked, copied, or read as a
 * link by assistive technology, and that would be a worse component than the one
 * with the hard dependency.
 */

const ITEMS: BreadcrumbItem[] = [
  { label: 'Home', routerLink: '/' },
  { label: 'Orders', routerLink: '/orders' },
  { label: 'Order #1042' },
];

function recordingAdapter() {
  const navigated: SvLinkTarget[] = [];
  const adapter: SvLinkAdapter = {
    kind: 'fake-router',
    href: (target) => (typeof target === 'string' ? target : target.join('/')),
    navigate: (target) => {
      navigated.push(target);
      return true;
    },
  };
  return { adapter, navigated };
}

async function setup(adapter?: SvLinkAdapter, items: BreadcrumbItem[] = ITEMS) {
  TestBed.resetTestingModule();
  const view = await render(SvBreadcrumbComponent, {
    inputs: { items },
    providers: adapter ? [provideSvLinkAdapter(adapter)] : [],
  });
  return view;
}

const anchors = (container: Element) => [...container.querySelectorAll('a')];

beforeEach(() => svResetWarnOnce());

describe('SvBreadcrumbComponent — links with no adapter provided', () => {
  /**
   * ★ The point of splitting `href` from navigation. With nothing wired up the
   * crumbs are still real links: shareable, right-clickable, and announced as
   * links. They just reload the page when followed.
   */
  it('renders real hrefs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { container } = await setup();

    expect(anchors(container).map((a) => a.getAttribute('href'))).toEqual(['/', '/orders']);
    warn.mockRestore();
  });

  it('leaves the current page as text rather than a link', async () => {
    const { container } = await setup();
    expect(anchors(container)).toHaveLength(2);
    expect(container.textContent).toContain('Order #1042');
  });

  /** Nothing took the navigation, so the browser must be left to follow it. */
  it('does not cancel the click', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { container } = await setup();

    const event = new MouseEvent('click', { cancelable: true, bubbles: true });
    anchors(container)[1].dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    warn.mockRestore();
  });

  /**
   * ★ And it says so once. An app that upgrades and starts doing full page loads
   * still WORKS — nothing fails and nothing logs — so the regression would be
   * found weeks later by somebody wondering why the app feels slow.
   */
  it('warns, naming the provider that fixes it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { container } = await setup();

    anchors(container)[1].dispatchEvent(
      new MouseEvent('click', { cancelable: true, bubbles: true }),
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('provideSvLinkAdapter'));
    warn.mockRestore();
  });
});

describe('SvBreadcrumbComponent — links with an adapter provided', () => {
  it('renders the adapter`s hrefs', async () => {
    const { adapter } = recordingAdapter();
    const { container } = await setup(adapter);
    expect(anchors(container).map((a) => a.getAttribute('href'))).toEqual(['/', '/orders']);
  });

  /**
   * ★ The rule, shared with `sv-mega-menu`: the click is cancelled exactly when
   * the adapter says it took the navigation. One event, one navigation — without
   * this the router transitions AND the browser reloads, which is `NV-07-I12`'s
   * defect arriving in a second family.
   */
  it('hands the target to the adapter and cancels the browser', async () => {
    const { adapter, navigated } = recordingAdapter();
    const { container } = await setup(adapter);

    const event = new MouseEvent('click', { cancelable: true, bubbles: true });
    anchors(container)[1].dispatchEvent(event);

    expect(navigated).toEqual(['/orders']);
    expect(event.defaultPrevented).toBe(true);
  });

  /**
   * ★ A modified click is the browser's own gesture. Cancelling it takes "open in
   * a new tab" away from a navigation control, which is where people use it most.
   * Same `svIsModifiedClick` both families call, so the answer cannot drift.
   */
  it.each([
    ['metaKey', { metaKey: true }],
    ['ctrlKey', { ctrlKey: true }],
    ['shiftKey', { shiftKey: true }],
    ['middle button', { button: 1 }],
  ])('never steals a %s click', async (_name, init) => {
    const { adapter, navigated } = recordingAdapter();
    const { container } = await setup(adapter);

    const event = new MouseEvent('click', { cancelable: true, bubbles: true, ...init });
    anchors(container)[1].dispatchEvent(event);

    expect(navigated).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  /** `crumbClick` still reports the activation, whoever ends up navigating. */
  it('still emits crumbClick', async () => {
    const { adapter } = recordingAdapter();
    const seen: BreadcrumbItem[] = [];

    TestBed.resetTestingModule();
    const { container } = await render(SvBreadcrumbComponent, {
      inputs: { items: ITEMS },
      providers: [provideSvLinkAdapter(adapter)],
      on: { crumbClick: (item: BreadcrumbItem) => seen.push(item) },
    });

    anchors(container)[1].dispatchEvent(
      new MouseEvent('click', { cancelable: true, bubbles: true }),
    );

    expect(seen.map((i) => i.label)).toEqual(['Orders']);
  });

  /** A disabled crumb renders as text, so there is no link to follow. */
  it('never navigates for a disabled crumb', async () => {
    const { adapter, navigated } = recordingAdapter();
    const { container } = await setup(adapter, [
      { label: 'Locked', routerLink: '/locked', disabled: true },
      { label: 'Here' },
    ]);

    for (const a of anchors(container)) {
      a.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));
    }

    expect(navigated).toEqual([]);
  });
});
