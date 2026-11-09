/**
 * The accessible names `sv-toast-host` renders, in English. Override any of
 * them with `provideSvLabels({ toast: { … } })` from `@styloviz/core`.
 */
export interface SvToastLabels {
  readonly notifications: string;
  readonly dismissNotification: string;
  /** The repeat badge's screen-reader text — `{count}` drives the plural, `{n}` arrives as digits. */
  readonly repeated: string;
  /** The overflow line under a full stack — `{n}` arrives as digits. */
  readonly overflowMore: string;
}

export const SV_TOAST_LABELS: SvToastLabels = {
  notifications: 'Notifications',
  dismissNotification: 'Dismiss notification',
  repeated: '{count, plural, one {Repeated {n} time} other {Repeated {n} times}}',
  overflowMore: '+{n} more',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    toast: SvToastLabels;
  }
}
