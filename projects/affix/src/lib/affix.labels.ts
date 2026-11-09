/**
 * The state `sv-affix` announces to screen readers, in English. Override any of
 * them with `provideSvLabels({ affix: { … } })` from `@styloviz/core`.
 */
export interface SvAffixLabels {
  /** The element is in normal flow. */
  readonly stateStatic: string;
  /** The element is parked at the end of its container. */
  readonly stateDocked: string;
  /** The element is pinned — `{top}` is its distance from the viewport top, in px. */
  readonly statePinned: string;
}

export const SV_AFFIX_LABELS: SvAffixLabels = {
  stateStatic: 'In flow.',
  stateDocked: 'Parked at the end of its container — it will not float over what comes next.',
  statePinned: 'Pinned {top}px from the top of the viewport.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    affix: SvAffixLabels;
  }
}
