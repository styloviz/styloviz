/**
 * @styloviz/cookie-consent — Public API
 *
 * A GDPR / ePrivacy cookie banner: per-category consent, "Reject all" as easy
 * as "Accept all", and a consent record (choices, ISO timestamp, policy version)
 * a host can store and hand back.
 */

// ── Component ────────────────────────────────────────────────────────────────
export {
  SvCookieConsentComponent,
  svReadCookieConsentRecord,
  svCookieConsentIsCurrent,
} from './lib/cookie-consent.component';
export type {
  SvCookieCategory,
  SvCookieConsentState,
  SvCookieConsentMethod,
  SvCookieConsentRecord,
  SvCookieConsentLayout,
  SvCookieConsentCorner,
} from './lib/cookie-consent.component';

// ── Accessible names ─────────────────────────────────────────────────────────
export { SV_COOKIE_CONSENT_LABELS } from './lib/cookie-consent.labels';
export type { SvCookieConsentLabels } from './lib/cookie-consent.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/cookie-consent.labels.packs';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './lib/cookie-consent.labels.packs';
