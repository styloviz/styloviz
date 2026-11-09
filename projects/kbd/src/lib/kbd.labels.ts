import { injectSvLabels } from '@styloviz/core/i18n';

/**
 * What `sv-kbd` says for each key it knows, in English — the spoken name a
 * screen reader announces instead of the glyph, and the word drawn on a chip
 * whose key cap carries text (`glyph*`). Override any of them with
 * `provideSvLabels({ kbd: { … } })` from `@styloviz/core`.
 */
export interface SvKbdLabels {
  readonly command: string;
  readonly control: string;
  readonly option: string;
  readonly alt: string;
  readonly shift: string;
  readonly windows: string;
  readonly enter: string;
  readonly return: string;
  readonly escape: string;
  readonly tab: string;
  readonly space: string;
  readonly backspace: string;
  readonly delete: string;
  readonly upArrow: string;
  readonly downArrow: string;
  readonly leftArrow: string;
  readonly rightArrow: string;
  readonly pageUp: string;
  readonly pageDown: string;
  readonly home: string;
  readonly end: string;
  /** Between the steps of a sequence ("G then I"), drawn and spoken. */
  readonly then: string;
  /**
   * The words drawn ON a chip for keys whose cap carries text rather than a
   * symbol — a German keyboard prints `Strg`, `Pos1`, `Ende`, `Bild↑`. The
   * symbol keys (`⌘ ⇧ ⌥ ↵ ⇥ ⌫ ⌦` and the arrows) are not words and stay as
   * they are.
   */
  readonly glyphCtrl: string;
  readonly glyphAlt: string;
  readonly glyphEsc: string;
  readonly glyphSpace: string;
  readonly glyphPageUp: string;
  readonly glyphPageDown: string;
  readonly glyphHome: string;
  readonly glyphEnd: string;
}

export const SV_KBD_LABELS: SvKbdLabels = {
  command: 'Command',
  control: 'Control',
  option: 'Option',
  alt: 'Alt',
  shift: 'Shift',
  windows: 'Windows',
  enter: 'Enter',
  return: 'Return',
  escape: 'Escape',
  tab: 'Tab',
  space: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  upArrow: 'Up arrow',
  downArrow: 'Down arrow',
  leftArrow: 'Left arrow',
  rightArrow: 'Right arrow',
  pageUp: 'Page up',
  pageDown: 'Page down',
  home: 'Home',
  end: 'End',
  then: 'then',
  glyphCtrl: 'Ctrl',
  glyphAlt: 'Alt',
  glyphEsc: 'Esc',
  glyphSpace: 'Space',
  glyphPageUp: 'PgUp',
  glyphPageDown: 'PgDn',
  glyphHome: 'Home',
  glyphEnd: 'End',
};

/**
 * The app's kbd labels, for a component in another package that speaks key
 * names with `svKbdKey` / `svKbdChord` — a package injects only its own
 * namespace, so it borrows kbd's through kbd. Call in an injection context.
 */
export function injectSvKbdLabels(): SvKbdLabels {
  return injectSvLabels('kbd', SV_KBD_LABELS);
}

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    kbd: SvKbdLabels;
  }
}
