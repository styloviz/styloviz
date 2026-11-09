/**
 * The accessible names `sv-avatar` renders, in English. Override any of
 * them with `provideSvLabels({ avatar: { … } })` from `@styloviz/core`.
 */
export interface SvAvatarLabels {
  readonly verified: string;
  readonly avatar: string;
  readonly statusOf: string;
  /** `sv-avatar-group`'s default group name — `{count}` people in it. */
  readonly avatarGroup: string;
  /** The overflow chip's visible text — `{count}` hidden. */
  readonly avatarGroupOverflow: string;
  /** The overflow chip's accessible name — `{count}` hidden, `{names}` listed. */
  readonly avatarGroupMore: string;
}

export const SV_AVATAR_LABELS: SvAvatarLabels = {
  verified: 'Verified',
  avatar: 'Avatar',
  statusOf: 'Status: {status}',
  avatarGroup: '{count, plural, one {Group of # person} other {Group of # people}}',
  avatarGroupOverflow: '+{count}',
  avatarGroupMore: '{count, plural, one {# more: {names}} other {# more: {names}}}',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    avatar: SvAvatarLabels;
  }
}
