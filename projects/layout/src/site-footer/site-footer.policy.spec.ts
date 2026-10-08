import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { svResetWarnOnce } from '@styloviz/core';
import {
  SvSiteFooterComponent,
  type FooterColumn,
  type SiteFooterNewsletterStatus,
} from './site-footer.component';

/**
 * The three P1 contracts the Layout & Utilities audit found missing:
 *
 * - `LU-08-I1` / `M1` — the newsletter is the one interactive thing in the
 *   footer, and it had no pending, success or error state at all.
 * - `LU-08-I2` / `M2` — landmark names were literals, and so were the ids that
 *   named the footer and its field, so two footers on a page collided.
 * - `LU-08-I3` / `M3` — social and external links had no `rel`, no target
 *   policy, and rendered any `href` they were given, `javascript:` included.
 */

async function setup(inputs: Partial<ComponentInput<SvSiteFooterComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvSiteFooterComponent, {
    inputs: inputs as ComponentInput<SvSiteFooterComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

@Component({
  standalone: true,
  imports: [SvSiteFooterComponent],
  template: `
    <sv-site-footer
      [newsletter]="true"
      [newsletterStatus]="status()"
      [newsletterMessage]="message()"
      (subscribe)="submitted.push($event)" />
  `,
})
class NewsletterHost {
  readonly status = signal<SiteFooterNewsletterStatus>('idle');
  readonly message = signal('');
  readonly submitted: string[] = [];
}

async function newsletterHost() {
  TestBed.resetTestingModule();
  const { fixture } = await render(NewsletterHost);
  return fixture;
}

describe('SvSiteFooterComponent — newsletter request state (LU-08-M1)', () => {
  it('renders an empty polite live region before anything happens', async () => {
    const { fixture } = await setup({ newsletter: true });
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent?.trim()).toBe('');
    expect(el(fixture).querySelector('form')?.getAttribute('data-sv-newsletter-status')).toBe('idle');
  });

  it('locks the field and the button while pending without dropping focus, and ignores a second submit', async () => {
    const f = await newsletterHost();
    await userEvent.type(screen.getByLabelText('Email address'), 'a@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Subscribe/ }));
    expect(f.componentInstance.submitted).toEqual(['a@example.test']);

    f.componentInstance.status.set('pending');
    f.detectChanges();

    const field = screen.getByLabelText('Email address') as HTMLInputElement;
    const button = screen.getByRole('button', { name: /Subscribe/ }) as HTMLButtonElement;
    expect(field.readOnly).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    // Not `disabled`: the user submitted from one of these, and a disabled
    // control drops the keyboard focus sitting on it.
    expect(field.disabled).toBe(false);
    expect(button.disabled).toBe(false);
    expect(el(f).querySelector('form')?.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain('Subscribing');

    // The button is still clickable (aria-disabled), so the guard is what stops it.
    const footer = f.debugElement.children[0].componentInstance as SvSiteFooterComponent;
    footer.setEmail('b@example.test');
    await userEvent.click(button);
    expect(f.componentInstance.submitted).toEqual(['a@example.test']);
  });

  it('announces success in the host\'s words and leaves the field clear', async () => {
    const f = await newsletterHost();
    await userEvent.type(screen.getByLabelText('Email address'), 'a@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Subscribe/ }));

    f.componentInstance.message.set('Check your inbox to confirm.');
    f.componentInstance.status.set('success');
    f.detectChanges();

    expect(screen.getByRole('status').textContent).toContain('Check your inbox to confirm.');
    expect((screen.getByLabelText('Email address') as HTMLInputElement).value).toBe('');
    expect(screen.getByLabelText('Email address').getAttribute('aria-invalid')).toBeNull();
  });

  it('on error: announces, marks the field invalid, and gives the address back', async () => {
    const f = await newsletterHost();
    await userEvent.type(screen.getByLabelText('Email address'), 'a@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Subscribe/ }));

    f.componentInstance.status.set('pending');
    f.detectChanges();
    f.componentInstance.message.set('That address is already subscribed.');
    f.componentInstance.status.set('error');
    f.detectChanges();

    const field = screen.getByLabelText('Email address') as HTMLInputElement;
    expect(field.readOnly).toBe(false);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.value).toBe('a@example.test');
    const region = screen.getByRole('status');
    expect(region.textContent).toContain('That address is already subscribed.');
    expect(field.getAttribute('aria-describedby')).toBe(region.id);
  });

  it('falls back to a built-in message when the host sends none', async () => {
    const f = await newsletterHost();
    f.componentInstance.status.set('error');
    f.detectChanges();
    expect(screen.getByRole('status').textContent?.trim().length).toBeGreaterThan(0);
  });

  it('keeps the unbound behaviour: submit emits and clears, nothing is announced', async () => {
    const seen: string[] = [];
    const { fixture } = await setup({ newsletter: true });
    fixture.componentInstance.subscribe.subscribe((e) => seen.push(e));
    await userEvent.type(screen.getByLabelText('Email address'), 'a@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Subscribe/ }));
    expect(seen).toEqual(['a@example.test']);
    expect(fixture.componentInstance.email()).toBe('');
    expect(screen.getByRole('status').textContent?.trim()).toBe('');
  });
});

const COLUMNS: readonly FooterColumn[] = [
  { heading: 'Product', links: [{ label: 'Features', href: '/features' }] },
];

@Component({
  standalone: true,
  imports: [SvSiteFooterComponent],
  template: `
    <sv-site-footer footerLabel="Store footer" [columns]="columns" [legalLinks]="legal" />
    <sv-site-footer [newsletter]="true" [columns]="columns" navLabel="Resources" legalNavLabel="Policies" [legalLinks]="legal" />
  `,
})
class TwoFootersHost {
  readonly columns = COLUMNS;
  readonly legal = [{ label: 'Privacy', href: '/privacy' }];
}

describe('SvSiteFooterComponent — landmark names (LU-08-M2)', () => {
  it('gives every nav a distinct default name', async () => {
    await setup({ columns: COLUMNS, legalLinks: [{ label: 'Privacy', href: '/privacy' }] });
    const names = screen.getAllByRole('navigation').map((n) => n.getAttribute('aria-label'));
    expect(names).toEqual(['Footer', 'Legal']);
  });

  it('takes the host\'s landmark names', async () => {
    await setup({
      footerLabel: 'Store footer',
      navLabel: 'Shop links',
      legalNavLabel: 'Policies',
      columns: COLUMNS,
      legalLinks: [{ label: 'Privacy', href: '/privacy' }],
    });
    expect(screen.getByRole('contentinfo', { name: 'Store footer' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Shop links' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Policies' })).toBeTruthy();
  });

  it('names the legal nav in the minimal variant too', async () => {
    await setup({ variant: 'minimal', legalNavLabel: 'Policies', legalLinks: [{ label: 'Terms', href: '/terms' }] });
    expect(screen.getByRole('navigation', { name: 'Policies' })).toBeTruthy();
  });

  /** Regression: both footers' `aria-labelledby` used to resolve to the FIRST heading. */
  it('names two footers on one page independently', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(TwoFootersHost);
    const footers = [...el(fixture).querySelectorAll('footer')];
    expect(footers).toHaveLength(2);
    const ids = footers.map((f) => f.getAttribute('aria-labelledby'));
    expect(new Set(ids).size).toBe(2);
    expect(screen.getByRole('contentinfo', { name: 'Store footer' })).toBeTruthy();
    expect(screen.getByRole('contentinfo', { name: 'Site footer' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Resources' })).toBeTruthy();
  });

  it('warns once in dev mode when both navs share a name', async () => {
    svResetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup({ navLabel: 'Links', legalNavLabel: 'links', columns: COLUMNS, legalLinks: [{ label: 'Privacy', href: '/privacy' }] });
    expect(warn.mock.calls.some(([m]) => String(m).includes('distinct accessible name'))).toBe(true);
    warn.mockRestore();
  });
});

describe('SvSiteFooterComponent — external-link policy (LU-08-M3)', () => {
  const socials = [{ label: 'GitHub', href: 'https://github.example.test/styloviz', iconName: 'github' }];

  it('puts noopener noreferrer on every social link, and keeps the same tab by default', async () => {
    await setup({ socials });
    const a = screen.getByRole('link', { name: 'GitHub' });
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.hasAttribute('target')).toBe(false);
  });

  it('opens external links in a new tab when asked, and says so', async () => {
    await setup({
      externalTarget: '_blank',
      socials,
      columns: [{ heading: 'More', links: [{ label: 'Blog', href: 'https://blog.example.test' }, { label: 'Docs', href: '/docs' }] }],
      legalLinks: [{ label: 'Status', href: 'https://status.example.test' }],
    });
    const social = screen.getByRole('link', { name: 'GitHub (opens in a new tab)' });
    expect(social.getAttribute('target')).toBe('_blank');

    const blog = screen.getByRole('link', { name: /Blog/ });
    expect(blog.getAttribute('target')).toBe('_blank');
    expect(blog.getAttribute('rel')).toBe('noopener noreferrer');
    expect(blog.textContent).toContain('(opens in a new tab)');

    const status = screen.getByRole('link', { name: /Status/ });
    expect(status.getAttribute('target')).toBe('_blank');
    expect(status.getAttribute('rel')).toBe('noopener noreferrer');

    // Same-origin links are not external: no rel, no target, no suffix.
    const docs = screen.getByRole('link', { name: 'Docs' });
    expect(docs.hasAttribute('target')).toBe(false);
    expect(docs.hasAttribute('rel')).toBe(false);
  });

  it('drops a javascript: href everywhere it can appear', async () => {
    svResetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { fixture } = await setup({
      socials: [{ label: 'Evil', href: ' JaVaScRiPt:alert(1)', iconName: 'github' }],
      columns: [{ heading: 'X', links: [{ label: 'Bad column', href: 'javascript:alert(1)' }] }],
      legalLinks: [{ label: 'Bad legal', href: 'java\tscript:alert(1)' }],
    });
    const hrefs = [...el(fixture).querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs.some((h) => h !== null && /script/i.test(h))).toBe(false);
    // An unsafe column link degrades to the SPA case: still a reachable link
    // that routes through `linkSelect`, never a navigation.
    const bad = screen.getByRole('link', { name: 'Bad column' });
    expect(bad.hasAttribute('href')).toBe(false);
    expect(bad.getAttribute('tabindex')).toBe('0');
    // An unsafe SOCIAL link is not rendered at all: an icon-only <a> with no
    // href would be an unreachable, nameless element.
    expect(el(fixture).querySelector('a[aria-label="Evil"]')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  /** On a real href, Enter already fires a native click: handling both emitted twice. */
  it('emits linkSelect once when Enter activates a column link that has an href', async () => {
    const { fixture } = await setup({ columns: [{ heading: 'More', links: [{ label: 'Docs', href: '/docs' }] }] });
    const seen: unknown[] = [];
    fixture.componentInstance.linkSelect.subscribe((l: unknown) => seen.push(l));
    const docs = screen.getByRole('link', { name: 'Docs' });
    docs.addEventListener('click', (e) => e.preventDefault());
    docs.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    docs.click(); // the browser's own activation
    expect(seen).toHaveLength(1);
  });

  it('treats backslash protocol-relative hrefs as external', async () => {
    await setup({ legalLinks: [{ label: 'Sneaky', href: '/\\evil.example.test' }] });
    expect(screen.getByRole('link', { name: /Sneaky/ }).getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('keeps mailto, tel and relative links as they are', async () => {
    await setup({
      legalLinks: [
        { label: 'Mail', href: 'mailto:hello@example.test' },
        { label: 'Call', href: 'tel:+15555550100' },
        { label: 'Terms', href: '/terms' },
      ],
    });
    expect(screen.getByRole('link', { name: 'Mail' }).getAttribute('href')).toBe('mailto:hello@example.test');
    expect(screen.getByRole('link', { name: 'Call' }).getAttribute('href')).toBe('tel:+15555550100');
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
    expect(screen.getByRole('link', { name: 'Mail' }).hasAttribute('rel')).toBe(false);
  });
});
