/**
 * The visible text `sv-jump-menu` renders, in English. Override any of it
 * with `provideSvLabels({ jumpMenu: { … } })` from `@styloviz/core`.
 */
export interface SvJumpMenuLabels {
  readonly label: string;
  readonly placeholder: string;
  readonly go: string;
}

export const SV_JUMP_MENU_LABELS: SvJumpMenuLabels = {
  label: 'Jump to',
  placeholder: 'Select…',
  go: 'Go',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    jumpMenu: SvJumpMenuLabels;
  }
}
