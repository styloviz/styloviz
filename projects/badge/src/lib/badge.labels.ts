/**
 * The accessible names `sv-badge` renders, in English. `{name}` is filled
 * with the badge's own label. Override any of them with
 * `provideSvLabels({ badge: { … } })` from `@styloviz/core`.
 */
export interface SvBadgeLabels {
  readonly removeBadge: string;
  readonly removeUnnamedBadge: string;
}

export const SV_BADGE_LABELS: SvBadgeLabels = {
  removeBadge: 'Remove {name}',
  removeUnnamedBadge: 'Remove badge',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    badge: SvBadgeLabels;
  }
}
