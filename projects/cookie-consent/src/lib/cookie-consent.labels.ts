/**
 * The visible text and accessible names `@styloviz/cookie-consent` renders, in
 * English. Override any of them app-wide with `provideSvLabels({ cookieConsent: { … } })`
 * from `@styloviz/core`, ship a language pack (`provideSvLabels(SV_COOKIE_CONSENT_LABELS_DE)`),
 * or per instance through the component's `labels` input.
 */
export interface SvCookieConsentLabels {
  /** The banner's region name — what a screen reader announces on landmark navigation. */
  readonly region: string;
  /** The banner and dialog heading. */
  readonly title: string;
  /** The banner's explanation. */
  readonly message: string;
  /** Shown instead of nothing when the visitor chose under an older policy `version`. */
  readonly policyChanged: string;
  /** The privacy / cookie policy link text. */
  readonly policyLink: string;
  /** The three decisions. Accept and reject carry equal weight on screen. */
  readonly acceptAll: string;
  readonly rejectAll: string;
  readonly save: string;
  /** Opens the per-category preferences. */
  readonly customise: string;
  /** The preferences dialog's close button. */
  readonly close: string;
  /** The preferences dialog heading. */
  readonly preferencesTitle: string;
  /** The line under the preferences heading. */
  readonly preferencesIntro: string;
  /** The category list's group name (a visually hidden legend). */
  readonly categories: string;
  /** The badge beside a required category. */
  readonly alwaysOn: string;
  /** Announced politely once a choice is recorded. */
  readonly saved: string;
  /** The four built-in categories, used when the host passes none. */
  readonly necessary: string;
  readonly necessaryDescription: string;
  readonly functional: string;
  readonly functionalDescription: string;
  readonly analytics: string;
  readonly analyticsDescription: string;
  readonly marketing: string;
  readonly marketingDescription: string;
}

export const SV_COOKIE_CONSENT_LABELS: SvCookieConsentLabels = {
  region: 'Cookie consent',
  title: 'We value your privacy',
  message:
    'We use cookies to keep this site working and, with your permission, to measure and improve it. Optional cookies stay off until you turn them on, and you can change your mind at any time.',
  policyChanged: 'Our cookie policy has changed since you last chose. Please review your choices.',
  policyLink: 'Cookie policy',
  acceptAll: 'Accept all',
  rejectAll: 'Reject all',
  save: 'Save choices',
  customise: 'Customise',
  close: 'Close',
  preferencesTitle: 'Cookie preferences',
  preferencesIntro:
    'Strictly necessary cookies keep the site working and are always on. Everything else stays off unless you turn it on.',
  categories: 'Cookie categories',
  alwaysOn: 'Always on',
  saved: 'Your cookie choices have been saved.',
  necessary: 'Strictly necessary',
  necessaryDescription: 'Sign-in, security and remembering this choice. The site cannot work without them.',
  functional: 'Functional',
  functionalDescription: 'Remember preferences such as language and layout between visits.',
  analytics: 'Analytics',
  analyticsDescription: 'Count visits and measure which pages work, so we can improve them.',
  marketing: 'Marketing',
  marketingDescription: 'Measure campaigns and show relevant offers on other sites.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    cookieConsent: SvCookieConsentLabels;
  }
}
