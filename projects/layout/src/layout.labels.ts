/**
 * The accessible names and visible text `@styloviz/layout` renders, in English. Override any of them with
 * `provideSvLabels({ layout: { … } })` from `@styloviz/core`.
 */
export interface SvLayoutLabels {
  readonly hideValue: string;
  readonly showValue: string;
  /** `sv-copy-to-clipboard` — `successLabel` default. */
  readonly copied: string;
  /** `sv-copy-to-clipboard` — `ariaLabel` default. */
  readonly copyToClipboard: string;
  /** `sv-copy-to-clipboard` — `sensitiveWarning` default. */
  readonly copiedSensitive: string;
  /** `sv-copy-to-clipboard` — live-region wording per failure reason. */
  readonly copyDenied: string;
  readonly copyInsecureContext: string;
  readonly copyUnavailable: string;
  readonly copyFailed: string;
  /** `sv-scroll-to-top` — `ariaLabel` default. */
  readonly scrollToTop: string;
  /** `sv-sidebar` — `label` default. */
  readonly sidebar: string;
  readonly topbarOpenSidebar: string;
  readonly topbarExpandSidebar: string;
  readonly topbarCollapseSidebar: string;
  readonly topbarLightMode: string;
  readonly topbarDarkMode: string;
  /** `sv-toolbar` — `label` default. */
  readonly toolbar: string;
  /** `sv-toolbar` — `overflowLabel` default. */
  readonly toolbarMoreActions: string;
  /** `sv-page-header` — the actions row's accessible name (FL-J3-NV-09). */
  readonly pageActions: string;
  /** `sv-site-footer` — newsletter input defaults. */
  readonly footerNewsletterTitle: string;
  readonly footerNewsletterText: string;
  readonly footerNewsletterPlaceholder: string;
  readonly footerNewsletterCta: string;
  /** `sv-site-footer` — the newsletter field's visually-hidden label. */
  readonly footerEmailAddress: string;
  /** `sv-site-footer` — live-region wording per status, used when `newsletterMessage` is empty. */
  readonly footerNewsletterPending: string;
  readonly footerNewsletterSuccess: string;
  readonly footerNewsletterError: string;
  /** `sv-site-footer` — landmark and nav names. */
  readonly footerLandmark: string;
  readonly footerNav: string;
  readonly footerLegalNav: string;
  readonly footerNewTab: string;
  /** `sv-site-footer` — the generated copyright line. */
  readonly footerCopyrightBrand: string;
  readonly footerCopyright: string;
  /** `sv-scroll-to-top` pill text when `label` is empty. */
  readonly scrollToTopShort: string;
  /** `sv-dashboard-shell` — the skip link's text (`skipLinkLabel` default). */
  readonly skipToMainContent: string;
  /** `sv-pull-to-refresh` — the region's name, the button, and the two announcements. */
  readonly pullRegion: string;
  readonly pullRefresh: string;
  readonly pullRefreshing: string;
  readonly pullUpdated: string;
  /** `sv-dock` — the toolbar's name (`ariaLabel` default). */
  readonly dock: string;
  /** `sv-dock` — said after a link item that opens in a new tab. */
  readonly dockNewTab: string;
}

export const SV_LAYOUT_LABELS: SvLayoutLabels = {
  hideValue: 'Hide value',
  showValue: 'Show value',
  copied: 'Copied!',
  copyToClipboard: 'Copy to clipboard',
  copiedSensitive: 'Copied. This value is secret — do not paste it anywhere shared.',
  copyDenied: 'Copy blocked by the browser. Select the text and copy it manually.',
  copyInsecureContext: 'Copying needs a secure (HTTPS) page. Select the text and copy it manually.',
  copyUnavailable: 'Clipboard unavailable. Select the text and copy it manually.',
  copyFailed: 'Copy failed',
  scrollToTop: 'Scroll to top',
  sidebar: 'Main navigation',
  topbarOpenSidebar: 'Open sidebar',
  topbarExpandSidebar: 'Expand sidebar',
  topbarCollapseSidebar: 'Collapse sidebar',
  topbarLightMode: 'Switch to light mode',
  topbarDarkMode: 'Switch to dark mode',
  toolbar: 'Toolbar',
  toolbarMoreActions: 'More actions',
  pageActions: 'Page actions',
  footerNewsletterTitle: 'Stay in the loop',
  footerNewsletterText: 'Subscribe for new arrivals, exclusive offers and more.',
  footerNewsletterPlaceholder: 'Enter your email',
  footerNewsletterCta: 'Subscribe',
  footerEmailAddress: 'Email address',
  footerNewsletterPending: 'Subscribing…',
  footerNewsletterSuccess: 'Thanks — you are subscribed.',
  footerNewsletterError: 'That did not work. Please try again.',
  footerLandmark: 'Site footer',
  footerNav: 'Footer',
  footerLegalNav: 'Legal',
  footerNewTab: '(opens in a new tab)',
  footerCopyrightBrand: '© {year} {brand}. All rights reserved.',
  footerCopyright: '© {year}. All rights reserved.',
  scrollToTopShort: 'Top',
  skipToMainContent: 'Skip to main content',
  pullRegion: 'Refreshable content',
  pullRefresh: 'Refresh',
  pullRefreshing: 'Refreshing…',
  pullUpdated: 'Updated',
  dock: 'Dock',
  dockNewTab: '(opens in a new tab)',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    layout: SvLayoutLabels;
  }
}
