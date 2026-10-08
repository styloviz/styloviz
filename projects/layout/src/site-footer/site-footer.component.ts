import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { SV_LINK_ADAPTER, svIsModifiedClick, svIsSafeUrl, svUniqueId, svWarnOnce } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FooterLink {
  readonly label: string;
  readonly href?: string;
  /** Optional badge, e.g. 'Sale'. */
  readonly badge?: string;
}

export interface FooterColumn {
  readonly heading: string;
  readonly links: readonly FooterLink[];
}

export interface FooterSocial {
  readonly label: string;
  readonly href?: string;
  /**
   * Name of an icon in `@styloviz/icons`, e.g. `'instagram'`.
   *
   * There used to be an `iconPath` fallback taking a raw `<path d="…">`, and
   * every consumer in this repo used it — pasting the Instagram, X, Facebook
   * and YouTube marks by hand into their config, while the library shipped all
   * four. The fallback is gone; pass a name.
   */
  readonly iconName: string;
}

export interface FooterLegalLink {
  readonly label: string;
  readonly href?: string;
}

export interface FooterPayment {
  readonly label: string;
  /**
   * Optional icon-library NAME for the payment mark — e.g. `'visa'`,
   * `'mastercard'`, `'amex'`, `'paypal'`, `'apple-pay'`. When omitted the
   * label renders as a text pill, which is what every consumer in this repo
   * still does.
   *
   * ★ BREAKING (icon sweep): was `iconPath`, a raw `<path d="…">` drawn in a
   * `0 0 48 32` box. It was the last raw-path field in the kit's public API and
   * **nothing in the repo ever set it**, so no rendering changes here — but the
   * free icon set ships all 45 card and wallet marks, and a hand-pasted logo
   * was the exact debt this sweep exists to remove.
   */
  readonly icon?: string;
}

export type SiteFooterVariant = 'default' | 'minimal' | 'dark';

/**
 * Where the newsletter request is (`LU-08-M1`). The footer owns the field; the
 * HOST owns the request, and reports back through `newsletterStatus`.
 *
 * - `idle` — nothing in flight (the default, and all a host that never binds it sees).
 * - `pending` — the request is running: the field is read-only, the button
 *   `aria-disabled`, and a second submit is ignored.
 * - `success` — it worked: the message is announced and the field stays clear.
 * - `error` — it failed: the message is announced, the field is marked
 *   invalid, and the address the user typed is put back so they can retry.
 */
export type SiteFooterNewsletterStatus = 'idle' | 'pending' | 'success' | 'error';

/**
 * How an external link opens (`LU-08-M3`).
 *
 * `_self` keeps today's behaviour. `_blank` opens a new tab, and tells a screen
 * reader so — a context change nobody announced is a WCAG 3.2.5 failure.
 */
export type SiteFooterLinkTarget = '_self' | '_blank';

/** A link after the footer's URL policy has been applied. Internal to the template. */
export interface SiteFooterResolvedLink<T> {
  /** The host's own object — outputs emit this, never a copy. */
  readonly link: T;
  /** The `href` to render, or `null` when there was none or it was unsafe. */
  readonly href: string | null;
  /** Points at another origin: gets `rel="noopener noreferrer"` and the target policy. */
  readonly external: boolean;
}

/** Default live-region wording per newsletter status, used when `newsletterMessage` is empty. */
const NEWSLETTER_DEFAULT_MESSAGES: Readonly<Record<SiteFooterNewsletterStatus, string>> = {
  idle: '',
  pending: 'Subscribing…',
  success: 'Thanks — you are subscribed.',
  error: 'That did not work. Please try again.',
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvSiteFooterComponent — Premium multi-column marketing / commerce footer.
 *
 * A brand block (logo / name, tagline, socials), configurable link columns, an
 * optional newsletter signup, and a bottom bar with copyright, legal links and
 * payment chips. Three variants: `default` (theme-adaptive), `minimal` (a
 * single compact row) and `dark` (always-dark, regardless of page theme).
 *
 * Features:
 * - Any number of link columns with per-link badge
 * - Brand block with optional logo + tagline + social icons
 * - Optional newsletter form (emits `subscribe`)
 * - Legal links + payment chips in the bottom bar
 * - Auto copyright (brand + current year) when none is provided
 * - `linkSelect` output for SPA routing; dark-mode ready; accessible landmarks
 */
@Component({
  selector: 'sv-site-footer',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, SvIconComponent],
  templateUrl: './site-footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvSiteFooterComponent {
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Brand name shown in the brand block / bottom bar. @default '' */
  brandName = input<string>('');

  /** Optional brand logo image URL. @default '' */
  logoSrc = input<string>('');

  /** Short tagline under the brand. @default '' */
  tagline = input<string>('');

  /** Link columns. @default [] */
  columns = input<readonly FooterColumn[]>([]);

  /** Social icon links; `iconName` names a glyph in `@styloviz/icons`. @default [] */
  socials = input<readonly FooterSocial[]>([]);

  /** Show the newsletter signup block. @default false */
  newsletter = input<boolean>(false);

  /** Newsletter heading. @default 'Stay in the loop' */
  newsletterTitle = input<string>('Stay in the loop');

  /** Newsletter supporting text. @default 'Subscribe for new arrivals, exclusive offers and more.' */
  newsletterText = input<string>('Subscribe for new arrivals, exclusive offers and more.');

  /** Newsletter input placeholder. @default 'Enter your email' */
  newsletterPlaceholder = input<string>('Enter your email');

  /** Newsletter submit label. @default 'Subscribe' */
  newsletterCta = input<string>('Subscribe');

  /** Legal links in the bottom bar. @default [] */
  legalLinks = input<readonly FooterLegalLink[]>([]);

  /** Payment method chips. @default [] */
  payments = input<readonly FooterPayment[]>([]);

  /** Copyright line. Auto-generated from brand + current year when empty. @default '' */
  copyright = input<string>('');

  /** Visual variant. @default 'default' */
  variant = input<SiteFooterVariant>('default');

  // ── Newsletter request state (`LU-08-M1`) ─────────────────────────────────

  /**
   * Where the host's newsletter request is: `idle`, `pending`, `success` or
   * `error`. While `pending` the field is read-only, the button is
   * `aria-disabled` (not `disabled`, which would strand the keyboard focus the
   * user submitted from) and a second submit is ignored; `success`/`error` are announced politely. Leave it
   * unbound and the footer behaves exactly as before — `subscribe` fires and
   * the field clears.
   * @default 'idle'
   */
  newsletterStatus = input<SiteFooterNewsletterStatus>('idle');

  /**
   * The text announced for the current `newsletterStatus` — typically the
   * server's own reason on `error`. Empty uses a short built-in message.
   * @default ''
   */
  newsletterMessage = input<string>('');

  // ── Landmarks (`LU-08-M2`) ─────────────────────────────────────────────────

  /**
   * Accessible name of the `<footer>` landmark itself.
   * @default 'Site footer'
   */
  footerLabel = input<string>('Site footer');

  /**
   * Accessible name of the link-columns `<nav>`. Every `<nav>` on a page needs a
   * DISTINCT name, or a screen-reader landmark list shows two identical
   * entries — so if the page header already has a nav called "Footer"
   * (unlikely) or you render two footers, rename it here.
   * @default 'Footer'
   */
  navLabel = input<string>('Footer');

  /**
   * Accessible name of the legal-links `<nav>`. Must differ from `navLabel`; a
   * dev-mode warning fires when they match.
   * @default 'Legal'
   */
  legalNavLabel = input<string>('Legal');

  // ── External links (`LU-08-M3`) ────────────────────────────────────────────

  /**
   * How links to ANOTHER origin open — social links and any absolute
   * `http(s)` column or legal link. `_blank` adds a visually-hidden
   * "(opens in a new tab)" to the name. Either way an external link always
   * carries `rel="noopener noreferrer"`, and any `href` with an unsafe scheme
   * (`javascript:`, `data:`, `vbscript:`) is dropped rather than rendered.
   * @default '_self'
   */
  externalTarget = input<SiteFooterLinkTarget>('_self');

  /**
   * Suffix appended to an external link's accessible name when
   * `externalTarget` is `_blank`.
   * @default '(opens in a new tab)'
   */
  newTabLabel = input<string>('(opens in a new tab)');

  // ── Outputs ───────────────────────────────────────────────────────────────

  /**
   * Emitted when a column / navigation link is activated (an in-app href is
   * also routed through `SV_LINK_ADAPTER` — don't navigate again from here when
   * the app provides one) — and when a legal
   * link with no rendered `href` (none given, or dropped by the URL policy) is
   * activated, so the host can route it. A legal link WITH an href navigates
   * natively and emits nothing, as before.
   */
  linkSelect = output<FooterLink>();

  /** Emitted with the email when the newsletter form is submitted. */
  subscribe = output<string>();

  // ── State ─────────────────────────────────────────────────────────────────

  private readonly _email = signal('');
  readonly email = computed(() => this._email());
  readonly currentYear = new Date().getFullYear();

  /**
   * ★ Per-instance ids. These were the literals `sv-site-footer-heading` and
   *   `sv-footer-email`, so a page with two footers (a storefront preview
   *   inside an admin page is the realistic case) pointed BOTH landmarks'
   *   `aria-labelledby` at the first footer's heading, and both email labels
   *   at the first field.
   */
  private readonly uid = svUniqueId('sv-site-footer');

  /**
   * The page origin, read from the injected `DOCUMENT` rather than the global
   * `location` — on the server that global does not exist while the platform
   * document carries the request URL, so reading the document is what makes
   * the prerendered `rel`/`target` match what the client renders on hydration.
   */
  private readonly origin = originOf(inject(DOCUMENT));
  private readonly links = inject(SV_LINK_ADAPTER);
  readonly headingId = `${this.uid}-heading`;
  readonly emailId = `${this.uid}-email`;
  readonly newsletterStatusId = `${this.uid}-newsletter-status`;

  /**
   * The address most recently handed to `subscribe`. The field clears on
   * submit, as it always has; if the host then reports `error`, this is put
   * back so the user can correct it rather than retype it.
   */
  private _lastSubmitted = '';

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly isMinimal = computed(() => this.variant() === 'minimal');
  readonly isDark = computed(() => this.variant() === 'dark');

  readonly rootClass = computed<string>(() =>
    this.isDark()
      // gray-400, not the kit's usual gray-500, because this arm paints a dark
      // footer in LIGHT mode: gray-500 on gray-950 is 4.16:1, gray-400 is 7.73.
      ? 'border-white/10 bg-gray-950 text-gray-400'
      : 'border-gray-200/80 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-gray-950 dark:text-gray-400',
  );

  readonly resolvedCopyright = computed<string>(() => {
    const explicit = this.copyright();
    if (explicit) return explicit;
    const brand = this.brandName();
    return brand
      ? `© ${this.currentYear} ${brand}. All rights reserved.`
      : `© ${this.currentYear}. All rights reserved.`;
  });

  readonly isPending = computed(() => this.newsletterStatus() === 'pending');
  readonly isNewsletterError = computed(() => this.newsletterStatus() === 'error');

  /** What the polite live region says right now. */
  readonly newsletterAnnouncement = computed<string>(() => {
    const status = this.newsletterStatus();
    if (status === 'idle') return '';
    return this.newsletterMessage() || NEWSLETTER_DEFAULT_MESSAGES[status] || '';
  });

  // ── URL policy (`LU-08-M3`) ───────────────────────────────────────────────

  readonly resolvedColumns = computed(() =>
    this.columns().map(col => ({ column: col, links: col.links.map(l => this.resolveLink(l)) })),
  );
  readonly resolvedSocials = computed(() => this.socials().map(s => this.resolveLink(s)));
  readonly resolvedLegal = computed(() => this.legalLinks().map(l => this.resolveLink(l)));

  /** `target` for an external link under the current policy (`null` for same-tab). */
  readonly externalTargetAttr = computed<string | null>(() =>
    this.externalTarget() === '_blank' ? '_blank' : null,
  );

  /** Whether external links announce that they open a new tab. */
  readonly opensNewTab = computed(() => this.externalTarget() === '_blank');

  constructor() {
    // `newsletterStatus` → put back the address on failure, forget it on success.
    effect(() => {
      const status = this.newsletterStatus();
      untracked(() => {
        if (status === 'error' && this._lastSubmitted && !this._email()) {
          this._email.set(this._lastSubmitted);
        }
        if (status === 'success') this._lastSubmitted = '';
      });
    });

    // Two `<nav>`s with one name are two identical entries in a landmark list.
    effect(() => {
      const nav = this.navLabel().trim().toLowerCase();
      const legal = this.legalNavLabel().trim().toLowerCase();
      if (nav && nav === legal) {
        svWarnOnce(
          `sv-site-footer:nav-label:${nav}`,
          `sv-site-footer: navLabel and legalNavLabel are both "${this.navLabel()}". Every <nav> landmark on a page needs a distinct accessible name.`,
        );
      }
    });
  }

  /**
   * Apply the URL policy to one link: drop an unsafe scheme, and flag a link to
   * another origin as external.
   *
   * ★ `svIsSafeUrl` resolves the value with the URL parser rather than a prefix
   *   check, so ` javascript:`, `JaVaScRiPt:` and a tab-split scheme are all
   *   caught — the same normalisation the browser applies before navigating.
   */
  private resolveLink<T extends { readonly href?: string; readonly label: string }>(
    link: T,
  ): SiteFooterResolvedLink<T> {
    const raw = link.href?.trim() ?? '';
    if (!raw) return { link, href: null, external: false };
    if (!svIsSafeUrl(raw, false)) {
      svWarnOnce(
        `sv-site-footer:unsafe-href:${raw}`,
        `sv-site-footer: dropped the href of "${link.label}" — only http(s), mailto, tel and relative URLs are rendered.`,
      );
      return { link, href: null, external: false };
    }
    return { link, href: raw, external: isExternalHref(raw, this.origin) };
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  /**
   * ★ An in-app href goes through `SV_LINK_ADAPTER` (1.0 release audit, M6).
   *   A column link WITH an href was followed by the browser — a full page load
   *   — while a host routing from `linkSelect` started a router navigation for
   *   the same click: two navigations, and the SPA one thrown away. Now a plain
   *   click on a same-origin path is handed to the app's adapter, exactly as
   *   `sv-breadcrumb` does, and the browser's navigation is cancelled only when
   *   the adapter says it took it. `linkSelect` still fires for every link —
   *   for analytics, or for a host with no adapter that routes itself.
   */
  onLink(link: FooterLink, event: Event): void {
    const href = link.href?.trim() ?? '';
    if (!href) event.preventDefault();
    this.linkSelect.emit(link);
    if (!href || event.defaultPrevented || svIsModifiedClick(event)) return;
    if (!href.startsWith('/') || href.startsWith('//') || !svIsSafeUrl(href, false)) return;
    if (this.links.navigate(href)) event.preventDefault();
  }

  /**
   * A legal link with no rendered `href` is focusable (`role="link"`,
   * `tabindex="0"`) like a column link, so it must also DO something: it emits
   * `linkSelect` for the host to route. One with an href is left to the browser.
   */
  onLegalLink(resolved: SiteFooterResolvedLink<FooterLegalLink>, event: Event): void {
    if (resolved.href) return;
    event.preventDefault();
    this.linkSelect.emit(resolved.link);
  }

  setEmail(value: string): void {
    this._email.set(value);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    // A second submit while the first request runs is how a list gets the same
    // address twice.
    if (this.isPending()) return;
    const value = this._email().trim();
    if (!value) return;
    this._lastSubmitted = value;
    this.subscribe.emit(value);
    this._email.set('');
  }
}

/**
 * Does this (already safe) href leave the site?
 *
 * Only an absolute `http(s)` URL can: relative, `mailto:` and `tel:` links
 * cannot open a page with a handle on this one. With no known origin (a
 * document without a URL) every absolute URL counts as external — the
 * conservative answer, since the cost is one redundant `rel`.
 */
function isExternalHref(href: string, here: string | null): boolean {
  // ★ `/\evil.test` and `\\evil.test` are protocol-relative too: browsers read
  //   a backslash as a slash in http(s) URLs, so they leave the site.
  if (!/^https?:[\\/]{2}/i.test(href) && !/^[\\/]{2}/.test(href)) return false;
  if (!here) return true;
  try {
    return new URL(href, here).origin !== here;
  } catch {
    return true;
  }
}

/** The document's origin, or `null` when it has none (`about:blank` reports the string `'null'`). */
function originOf(doc: Document): string | null {
  const origin = doc.location?.origin;
  return origin && origin !== 'null' ? origin : null;
}
