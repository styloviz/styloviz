/**
 * The visible text the `@styloviz/overlays` components render, in English.
 * Override any of it with `provideSvLabels({ overlays: { … } })` from
 * `@styloviz/core`.
 */
export interface SvOverlaysLabels {
  readonly resultReference: string;
  readonly resultRetrying: string;
  readonly resultCopy: string;
  readonly resultCopied: string;
  readonly resultTechnicalDetails: string;
  /** The technical-details row holding the HTTP status. */
  readonly resultStatus: string;
  /** The technical-details row holding the error code. */
  readonly resultCode: string;
  readonly spinnerLoading: string;
  readonly spinnerSlow: string;
  readonly spinnerStalled: string;
  /** `sv-spinner`'s stated expectation (core's `SvExpectedWaitLabels`) — `{count}` drives the plural, `{n}` is shown. */
  readonly expectedWaitSeconds: string;
  readonly expectedWaitMinutes: string;
  /** `sv-progress-bar`'s stage position (`{n}` / `{total}` arrive as digits), its visible stage line, and the parts of its `aria-valuetext`. */
  readonly progressStageOf: string;
  readonly progressStageWithPosition: string;
  readonly progressStep: string;
  readonly progressAbout: string;
  readonly progressValueSeparator: string;
  /** `sv-progress-ring`'s value text against a non-100 `max`, and its generated name — numbers arrive as digits. */
  readonly progressRingOf: string;
  readonly progressRingName: string;
  /** `sv-onboarding-checklist`'s default heading. */
  readonly onboardingTitle: string;
  /** Its progress line — `{done}` and `{total}` arrive as digits and count required steps only. */
  readonly onboardingProgress: string;
  /** The progress ring's accessible name. */
  readonly onboardingProgressName: string;
  /** The badge on an optional step, and the note saying optional steps do not count. */
  readonly onboardingOptional: string;
  readonly onboardingOptionalNote: string;
  /** The status line once every required step is done. */
  readonly onboardingComplete: string;
  /** A step's action when it names none of its own. */
  readonly onboardingAction: string;
  /** A read-only step's state, read after its title. */
  readonly onboardingStepDone: string;
  readonly onboardingStepTodo: string;
  /** The dismiss button, and the collapse toggle in each direction. */
  readonly onboardingDismiss: string;
  readonly onboardingCollapse: string;
  readonly onboardingExpand: string;
  /** The loading, empty and error states. */
  readonly onboardingLoading: string;
  readonly onboardingEmptyTitle: string;
  readonly onboardingEmptyMessage: string;
  readonly onboardingErrorTitle: string;
  /** `sv-action-sheet`'s accessible name when it has no title, its dismiss button, and the hint read after a destructive choice. */
  readonly actionSheetName: string;
  readonly actionSheetCancel: string;
  readonly actionSheetDestructive: string;
}

export const SV_OVERLAYS_LABELS: SvOverlaysLabels = {
  resultReference: 'Reference',
  resultRetrying: 'Retrying…',
  resultCopy: 'Copy',
  resultCopied: 'Copied',
  resultTechnicalDetails: 'Technical details',
  resultStatus: 'Status',
  resultCode: 'Code',
  spinnerLoading: 'Loading…',
  spinnerSlow: 'This is taking longer than usual…',
  spinnerStalled: 'This seems to be stuck.',
  expectedWaitSeconds: 'about {count, plural, one {{n} second} other {{n} seconds}}',
  expectedWaitMinutes: 'about {count, plural, one {{n} minute} other {{n} minutes}}',
  progressStageOf: '{n} of {total}',
  progressStageWithPosition: '{stage} ({position})',
  progressStep: 'step {position}',
  progressAbout: 'about {pct}%',
  progressValueSeparator: ', ',
  progressRingOf: '{value} of {max}',
  progressRingName: 'Progress: {pct}%',
  onboardingTitle: 'Get set up',
  onboardingProgress: '{done} of {total} done',
  onboardingProgressName: 'Setup progress',
  onboardingOptional: 'Optional',
  onboardingOptionalNote: 'Optional steps don’t count toward completion.',
  onboardingComplete: 'You’re all set — every required step is done.',
  onboardingAction: 'Start',
  onboardingStepDone: 'done',
  onboardingStepTodo: 'not done yet',
  onboardingDismiss: 'Dismiss checklist',
  onboardingCollapse: 'Hide steps',
  onboardingExpand: 'Show steps',
  onboardingLoading: 'Loading setup steps…',
  onboardingEmptyTitle: 'Nothing to set up',
  onboardingEmptyMessage: 'There are no setup steps here yet.',
  onboardingErrorTitle: 'Could not load the setup steps',
  actionSheetName: 'Actions',
  actionSheetCancel: 'Cancel',
  actionSheetDestructive: '(destructive)',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    overlays: SvOverlaysLabels;
  }
}
