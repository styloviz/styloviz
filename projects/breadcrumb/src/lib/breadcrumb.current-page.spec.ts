import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { svResetWarnOnce } from '@styloviz/core';
import { SvBreadcrumbComponent, type BreadcrumbItem } from './breadcrumb.component';

/**
 * ============================================================================
 *  The current page is not a link — `NV-03-I3`
 * ============================================================================
 *
 * The source item says this "needs enforcing, not documenting". The *rendering*
 * was already right and had been from the start — the last crumb is a
 * `<span aria-current="page">`, never an `<a>` — so what was left was the two
 * places the rule was stated but not enforced:
 *
 * ★★ **A `routerLink` on the last crumb was silently dropped.** The component
 * ignored a stated intent without a word, which makes "linking the current page
 * is wrong" and "my link is broken" indistinguishable from the outside. It is a
 * dev-mode warning rather than a thrown error because the render is already
 * correct: nothing is broken, something is redundant.
 *
 * ★★ **A `disabled` last crumb lost its `aria-current`.** The template checks
 * `disabled` *before* `last`, so a permission-gated current page — an ordinary
 * shape, not a contrived one — fell into the disabled branch and rendered with
 * no `aria-current` at all. That is the exact failure the item names in its own
 * words, "misreports state", and it is the half nobody would notice by looking:
 * the crumb still reads correctly on screen.
 *
 * ⚠️ **The sibling-page menu is deliberately not policed.** Deciding whether a
 * menu entry points at the page you are on means knowing the current URL, and
 * this component has no location *by design* — T1 gave the Breadcrumb
 * `SvLinkAdapter` rather than `SvNavLocation` because a breadcrumb owns no key.
 * Adding a location back to produce a warning would undo that decision for a
 * console message, so it stays the consumer's call.
 */

const TRAIL: BreadcrumbItem[] = [
  { label: 'Home', routerLink: '/' },
  { label: 'Orders', routerLink: '/orders' },
  { label: 'Order 42' },
];

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvBreadcrumbComponent, {
    inputs: { items: TRAIL, ...inputs },
    providers: [provideRouter([])],
  });
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

beforeEach(() => svResetWarnOnce());

describe('SvBreadcrumbComponent — the current page is not a link', () => {
  it('renders the last crumb as plain text with aria-current', async () => {
    const { el } = await setup();
    const current = el.querySelector('[aria-current="page"]')!;
    expect(current.tagName).toBe('SPAN');
    expect(current.textContent?.trim()).toBe('Order 42');
    // Every OTHER crumb is a link; only this one is not.
    expect([...el.querySelectorAll('a')].map((a) => a.textContent?.trim()))
      .toEqual(['Home', 'Orders']);
  });

  /** ★ A link on the current page is ignored — the render never honours it. */
  it('still refuses to link the last crumb when a routerLink is given', async () => {
    const withLink = [...TRAIL.slice(0, 2), { label: 'Order 42', routerLink: '/orders/42' }];
    const { el } = await setup({ items: withLink });
    const current = el.querySelector('[aria-current="page"]')!;
    expect(current.tagName).toBe('SPAN');
    expect([...el.querySelectorAll('a')].map((a) => a.getAttribute('href')))
      .toEqual(['/', '/orders']);
  });

  it('warns in dev mode that the last crumb’s routerLink was ignored', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const withLink = [...TRAIL.slice(0, 2), { label: 'Order 42', routerLink: '/orders/42' }];
    await setup({ items: withLink });

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('Order 42');
    expect(warn.mock.calls[0][0]).toContain('routerLink');
    warn.mockRestore();
  });

  /** The ordinary trail is the quiet one — a warning nobody can silence is noise. */
  it('says nothing when the current crumb has no routerLink', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  /**
   * ★★ The half you cannot see. `disabled` is checked first, so before this the
   * current page announced no position at all when it was permission-gated.
   */
  it('keeps aria-current on a disabled current page', async () => {
    const gated = [...TRAIL.slice(0, 2), { label: 'Order 42', disabled: true }];
    const { el } = await setup({ items: gated });
    const current = el.querySelector('[aria-current="page"]')!;
    expect(current).not.toBeNull();
    expect(current.getAttribute('aria-disabled')).toBe('true');
    expect(current.textContent?.trim()).toBe('Order 42');
  });

  /** …and a disabled crumb that is NOT the current page must not claim to be. */
  it('does not put aria-current on a disabled middle crumb', async () => {
    const gated: BreadcrumbItem[] = [
      { label: 'Home', routerLink: '/' },
      { label: 'Orders', disabled: true },
      { label: 'Order 42' },
    ];
    const { el } = await setup({ items: gated, maxVisible: 0 });
    const flagged = [...el.querySelectorAll('[aria-current="page"]')]
      .map((n) => n.textContent?.trim());
    expect(flagged).toEqual(['Order 42']);
  });
});
