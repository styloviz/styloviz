import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { svResetWarnOnce } from '@styloviz/core';
import {
  SvSiteFooterComponent,
  type FooterLink,
  type SiteFooterVariant,
} from './site-footer.component';

/**
 * Review wave 2:
 * - the external-link check reads the origin from the injected `DOCUMENT`, not
 *   the global `location`, so a server render and the client agree;
 * - a legal link whose href is missing or was dropped by the URL policy gets
 *   the column links' role + tab-stop fallback, and routes via `linkSelect`.
 */

async function setup(
  inputs: Partial<ComponentInput<SvSiteFooterComponent>> = {},
  doc?: Partial<Document>,
) {
  TestBed.resetTestingModule();
  // Component-level: only the footer's own `inject(DOCUMENT)` sees the double;
  // the renderer and the TestBed root keep the real document.
  if (doc) {
    TestBed.overrideComponent(SvSiteFooterComponent, {
      add: { providers: [{ provide: DOCUMENT, useValue: doc }] },
    });
  }
  return render(SvSiteFooterComponent, {
    inputs: inputs as ComponentInput<SvSiteFooterComponent>,
  });
}

/** A page origin as a DOCUMENT double reports it — link data only, never fetched. */
const SHOP_ORIGIN = 'https://shop.example.test';

describe('SvSiteFooterComponent — origin from the injected DOCUMENT', () => {
  const links = {
    columns: [{ heading: 'Shop', links: [{ label: 'Store', href: 'https://shop.example.test/store' }] }],
    legalLinks: [{ label: 'Status', href: 'https://status.example.test' }],
  };

  it('treats a URL on the DOCUMENT origin as internal, whatever the global location says', async () => {
    // The global `location` is jsdom's localhost; the injected document says otherwise.
    expect(location.origin).not.toBe(SHOP_ORIGIN);
    await setup(links, { location: { origin: SHOP_ORIGIN } as Location });

    const store = screen.getByRole('link', { name: 'Store' });
    expect(store.hasAttribute('rel')).toBe(false);
    const status = screen.getByRole('link', { name: 'Status' });
    expect(status.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('treats every absolute URL as external when the document has no origin', async () => {
    await setup(links, { location: { origin: 'null' } as Location });
    expect(screen.getByRole('link', { name: 'Store' }).getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Status' }).getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('matches the real document origin by default', async () => {
    await setup({ legalLinks: [{ label: 'Here', href: `${location.origin}/terms` }] });
    expect(screen.getByRole('link', { name: 'Here' }).hasAttribute('rel')).toBe(false);
  });
});

describe('SvSiteFooterComponent — href-less legal links stay reachable', () => {
  const VARIANTS: readonly SiteFooterVariant[] = ['default', 'minimal', 'dark'];

  for (const variant of VARIANTS) {
    it(`gives a missing or dropped legal href the link role and a tab stop, and routes it (${variant})`, async () => {
      svResetWarnOnce();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        const selected: FooterLink[] = [];
        const legal = [
          { label: 'Cookies' },
          { label: 'Bad legal', href: 'javascript:alert(1)' },
          { label: 'Terms', href: '/terms' },
        ];
        const { fixture } = await setup({ variant, legalLinks: legal });
        fixture.componentInstance.linkSelect.subscribe((l) => selected.push(l));

        const cookies = screen.getByRole('link', { name: 'Cookies' });
        const bad = screen.getByRole('link', { name: 'Bad legal' });
        for (const a of [cookies, bad]) {
          expect(a.hasAttribute('href')).toBe(false);
          expect(a.getAttribute('role')).toBe('link');
          expect(a.getAttribute('tabindex')).toBe('0');
        }
        // A legal link WITH an href is a native link: no role, no tabindex.
        const terms = screen.getByRole('link', { name: 'Terms' });
        expect(terms.hasAttribute('role')).toBe(false);
        expect(terms.hasAttribute('tabindex')).toBe(false);

        const user = userEvent.setup();
        cookies.focus();
        expect(document.activeElement).toBe(cookies);
        await user.keyboard('{Enter}');
        await user.click(bad);
        expect(selected).toEqual([legal[0], legal[1]]);

        // …and the native one is left to the browser, emitting nothing.
        terms.addEventListener('click', (e) => e.preventDefault(), { once: true });
        await user.click(terms);
        expect(selected).toHaveLength(2);
      } finally {
        warn.mockRestore();
      }
    });
  }
});
