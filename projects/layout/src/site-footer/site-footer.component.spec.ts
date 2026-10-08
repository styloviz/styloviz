import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  SvSiteFooterComponent,
  type FooterColumn,
  type FooterLink,
} from './site-footer.component';

/**
 * The footer supports two ways of navigating: an `href`, and a `linkSelect`
 * output for hosts that route in the SPA. The second is where the trouble was —
 * an `<a>` with no `href` is not focusable and is not announced as a link, so
 * the documented SPA setup produced a footer a keyboard user could not reach at
 * all. Both paths are pinned below.
 */

const COLUMNS: readonly FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Pricing', badge: 'Sale' },
    ],
  },
  { heading: 'Company', links: [{ label: 'About', href: '/about' }] },
];

async function setup(inputs: Partial<ComponentInput<SvSiteFooterComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvSiteFooterComponent, {
    inputs: inputs as ComponentInput<SvSiteFooterComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

describe('SvSiteFooterComponent — navigating', () => {
  it('renders every column and its links', async () => {
    await setup({ columns: COLUMNS });
    expect(screen.getByRole('heading', { name: 'Product' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Features/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'About' })).toBeTruthy();
  });

  it('reports which link was activated', async () => {
    const seen: FooterLink[] = [];
    const { fixture } = await setup({ columns: COLUMNS });
    fixture.componentInstance.linkSelect.subscribe((l) => seen.push(l));

    await userEvent.click(screen.getByRole('link', { name: 'About' }));
    expect(seen.map((l) => l.label)).toEqual(['About']);
  });

  it('leaves a link with no href reachable, and announced as a link', async () => {
    // Omitting `href` is the documented SPA case — the host routes from
    // `linkSelect`. Without a role and a tab stop it was neither focusable nor a
    // link, so the footer simply could not be used from a keyboard.
    await setup({ columns: COLUMNS });
    const spa = screen.getByRole('link', { name: /Pricing/ });
    expect(spa.getAttribute('tabindex')).toBe('0');
    expect(spa.hasAttribute('href')).toBe(false);
  });

  it('routes an href-less link from the keyboard', async () => {
    const seen: FooterLink[] = [];
    const { fixture } = await setup({ columns: COLUMNS });
    fixture.componentInstance.linkSelect.subscribe((l) => seen.push(l));

    const spa = screen.getByRole('link', { name: /Pricing/ });
    spa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(seen.map((l) => l.label)).toEqual(['Pricing']);
  });

  it('does not claim a role it already has', async () => {
    await setup({ columns: COLUMNS });
    const real = screen.getByRole('link', { name: /Features/ });
    expect(real.getAttribute('role')).toBeNull();
    expect(real.getAttribute('tabindex')).toBeNull();
  });

  it('shows a badge beside a link that has one', async () => {
    await setup({ columns: COLUMNS });
    expect(screen.getByText('Sale')).toBeTruthy();
  });

  it('renders no column region at all when there are none', async () => {
    const { fixture } = await setup();
    expect(el(fixture).querySelector('nav[aria-label="Footer"]')).toBeNull();
  });
});

describe('SvSiteFooterComponent — the newsletter', () => {
  it('is off unless asked for', async () => {
    await setup();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('offers a labelled field and a submit', async () => {
    await setup({ newsletter: true });
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Subscribe/ })).toBeTruthy();
  });

  it('reports the address and clears the field', async () => {
    const seen: string[] = [];
    const { fixture } = await setup({ newsletter: true });
    fixture.componentInstance.subscribe.subscribe((e) => seen.push(e));

    await userEvent.type(screen.getByLabelText('Email address'), 'a@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Subscribe/ }));

    expect(seen).toEqual(['a@example.test']);
    expect(fixture.componentInstance.email()).toBe('');
  });

  it('ignores a submit with nothing but whitespace in it', async () => {
    const seen: string[] = [];
    const { fixture } = await setup({ newsletter: true });
    fixture.componentInstance.subscribe.subscribe((e) => seen.push(e));

    fixture.componentInstance.setEmail('   ');
    fixture.componentInstance.onSubmit(new Event('submit'));
    expect(seen).toEqual([]);
  });

  it('does not let the browser navigate away on submit', async () => {
    const { fixture } = await setup({ newsletter: true });
    fixture.componentInstance.setEmail('a@example.test');
    const event = new Event('submit', { cancelable: true });
    fixture.componentInstance.onSubmit(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('takes the host\'s wording', async () => {
    await setup({
      newsletter: true,
      newsletterTitle: 'Join the list',
      newsletterPlaceholder: 'you@work.com',
      newsletterCta: 'Sign up',
    });
    expect(screen.getByText('Join the list')).toBeTruthy();
    expect(screen.getByPlaceholderText('you@work.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sign up/ })).toBeTruthy();
  });
});

describe('SvSiteFooterComponent — the bottom bar', () => {
  it('writes its own copyright from the brand and the year', async () => {
    const year = new Date().getFullYear();
    const { fixture } = await setup({ brandName: 'Styloviz' });
    expect(fixture.componentInstance.resolvedCopyright()).toBe(`© ${year} Styloviz. All rights reserved.`);
  });

  it('leaves the brand out when there is none', async () => {
    const year = new Date().getFullYear();
    const { fixture } = await setup();
    expect(fixture.componentInstance.resolvedCopyright()).toBe(`© ${year}. All rights reserved.`);
  });

  it('defers to a copyright the host wrote', async () => {
    const { fixture } = await setup({ brandName: 'Styloviz', copyright: 'Public domain.' });
    expect(fixture.componentInstance.resolvedCopyright()).toBe('Public domain.');
  });

  it('groups the legal links as a named landmark', async () => {
    await setup({ legalLinks: [{ label: 'Privacy', href: '/privacy' }] });
    expect(screen.getByRole('navigation', { name: 'Legal' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeTruthy();
  });

  /**
   * ★ `FooterPayment.iconPath` — a raw `<path d="…">` in a `0 0 48 32` box —
   * became `icon`, an icon-library NAME, in the icon sweep. It was the last
   * raw-path field in the kit's public API, and nothing in the repo ever set
   * it, which is why it survived so long.
   *
   * The claim is unchanged and is asserted in both directions: a payment with
   * no glyph shows its LABEL as a text pill, and one with a glyph shows the
   * glyph INSTEAD of the label. Asserting only the first would pass with the
   * `@else` branch deleted.
   */
  it('shows payment chips, with or without a glyph', async () => {
    const { fixture } = await setup({
      payments: [{ label: 'Visa' }, { label: 'Amex', icon: 'amex' }],
    });
    const host = fixture.nativeElement as HTMLElement;

    expect(screen.getByText('Visa')).toBeTruthy();
    // The one WITH a name draws a library glyph and drops the VISIBLE text.
    expect(host.querySelectorAll('sv-icon svg').length).toBeGreaterThan(0);

    /**
     * ★★ …but the name must survive, because the mark REPLACED it. `title`
     * alone did not do that: it is not exposed on touch, is not
     * keyboard-reachable, and is only a fallback accessible name. A storefront
     * that renders its accepted cards as five unlabelled shapes tells a
     * screen-reader user nothing about how they can pay.
     */
    const srNames = [...host.querySelectorAll('.sr-only')].map((n) => n.textContent?.trim());
    expect(srNames).toContain('Amex');
  });

  /**
   * ★★ A BRAND MARK IS A FILLED SILHOUETTE, NOT AN OUTLINE.
   *
   * The renderer's default weight is `line`, which sets the root `fill="none"`
   * and `stroke="currentColor"`. The 45 brand glyphs are single filled paths,
   * and they only survive that because the generator marks their node
   * `fill: true` and `nodeFill()` honours it per node. If that ever regresses,
   * every card logo in every footer becomes an unreadable outline — and no
   * existing test would notice, because the `<svg>` is still there.
   */
  it('draws a payment mark filled, not stroked', async () => {
    const { fixture } = await setup({ payments: [{ label: 'Visa', icon: 'visa' }] });
    const host = fixture.nativeElement as HTMLElement;
    const path = host.querySelector('sv-icon svg path');

    expect(path, 'the visa mark drew no path at all').not.toBeNull();
    expect(path!.getAttribute('fill')).toBe('currentColor');
    expect(path!.getAttribute('stroke')).toBe('none');
  });
});

describe('SvSiteFooterComponent — the brand block and variants', () => {
  it('is a named landmark whatever else it contains', async () => {
    await setup();
    expect(screen.getByRole('contentinfo', { name: 'Site footer' })).toBeTruthy();
  });

  it('shows the brand, its tagline and its logo', async () => {
    await setup({ brandName: 'Styloviz', tagline: 'Dashboards, faster.', logoSrc: 'https://example.test/l.png' });
    expect(screen.getByText('Styloviz')).toBeTruthy();
    expect(screen.getByText('Dashboards, faster.')).toBeTruthy();
  });

  it('names each social link for a screen reader', async () => {
    await setup({ socials: [{ label: 'GitHub', href: 'https://example.test', iconName: 'github' }] });
    expect(screen.getByRole('link', { name: 'GitHub' })).toBeTruthy();
  });

  it('collapses to a single row in the minimal variant', async () => {
    const { fixture } = await setup({ variant: 'minimal', columns: COLUMNS });
    expect(fixture.componentInstance.isMinimal()).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Product' })).toBeNull();
  });

  it('stays dark regardless of the page theme in the dark variant', async () => {
    const { fixture } = await setup({ variant: 'dark' });
    expect(fixture.componentInstance.isDark()).toBe(true);
    expect(fixture.componentInstance.rootClass()).toContain('bg-gray-950');
    expect(fixture.componentInstance.rootClass()).not.toContain('dark:');
  });

  it('follows the page theme by default', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.isDark()).toBe(false);
    expect(fixture.componentInstance.rootClass()).toContain('dark:');
  });
});
