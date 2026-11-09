/**
 * The accessible names `sv-alert-banner` renders, in English. Override any of
 * them with `provideSvLabels({ alertBanner: { … } })` from `@styloviz/core`.
 */
export interface SvAlertBannerLabels {
  readonly dismissAnnouncement: string;
  readonly dismissAlert: string;
}

export const SV_ALERT_BANNER_LABELS: SvAlertBannerLabels = {
  dismissAnnouncement: 'Dismiss announcement',
  dismissAlert: 'Dismiss alert',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    alertBanner: SvAlertBannerLabels;
  }
}
