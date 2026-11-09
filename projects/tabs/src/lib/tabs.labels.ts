/**
 * The screen-reader text `sv-tabs` renders, in English. Override any of it
 * with `provideSvLabels({ tabs: { … } })` from `@styloviz/core`.
 */
export interface SvTabsLabels {
  /** Read after a tab whose `dot` is set. */
  readonly unread: string;
  /** Read with a closable tab, through `aria-describedby`. */
  readonly closeHint: string;
  /** Announced after a tab is closed — `{label}` is the tab's label. */
  readonly tabClosed: string;
}

export const SV_TABS_LABELS: SvTabsLabels = {
  unread: '(unread)',
  closeHint: 'Press Delete or Backspace to close this tab.',
  tabClosed: '{label} tab closed.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    tabs: SvTabsLabels;
  }
}
