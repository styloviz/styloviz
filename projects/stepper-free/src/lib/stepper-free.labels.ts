/**
 * The accessible names `sv-stepper` renders, in English. Override any of
 * them with `provideSvLabels({ stepper: { … } })` from `@styloviz/core`.
 */
export interface SvStepperLabels {
  readonly statusTracker: string;
  readonly progressSteps: string;
  readonly progress: string;
  readonly unsavedTitle: string;
  readonly unsavedMessage: string;
  readonly discard: string;
  readonly keepEditing: string;
  readonly loadError: string;
  readonly optional: string;
  /** A dot / progress-bar step's accessible name when it is optional — `{label}` is the step's. */
  readonly optionalStepName: string;
  /** `svRestoreState` / `svRestoreParams` — a refused restore's `detail` (core's `SvRestoreLabels`). */
  readonly restoreUnreadable: string;
  readonly restoreUnsigned: string;
  /** `{found}`, `{expected}` — the blobs' kinds. */
  readonly restoreForeign: string;
  readonly restoreNoVersion: string;
  /** `{from}`, `{version}`. */
  readonly restoreTooNew: string;
  readonly restoreBadShape: string;
  /** `{from}`. */
  readonly restoreUnmigratable: string;
  readonly linkNoVersion: string;
  readonly linkBadVersion: string;
  /** `{from}`, `{version}`. */
  readonly linkTooNew: string;
  /** FL-J3-NV-05 — a refused move, spoken. `{label}` the step, `{reason}` why. */
  readonly stepBlocked: string;
  /** The spoken reason when the step is disabled. */
  readonly blockedDisabled: string;
  /** The spoken reason when the current step did not validate. */
  readonly blockedValidation: string;
}

export const SV_STEPPER_LABELS: SvStepperLabels = {
  statusTracker: 'Status tracker',
  progressSteps: 'Progress steps',
  progress: 'Step {current} of {total}',
  unsavedTitle: 'Leave this step?',
  unsavedMessage: 'This step has changes that have not been saved.',
  discard: 'Discard',
  keepEditing: 'Keep editing',
  loadError: 'Could not load these steps',
  optional: 'Optional',
  optionalStepName: '{label} (optional)',
  restoreUnreadable: 'The saved data is not readable.',
  restoreUnsigned: 'The saved data does not say what wrote it, so it cannot be trusted.',
  restoreForeign: 'That saved data belongs to {found}, not {expected}.',
  restoreNoVersion: 'The saved data has no usable version.',
  restoreTooNew: 'That view was saved by a newer version of this component (v{from}, this is v{version}), so it cannot be read here.',
  restoreBadShape: 'The saved data is not in the expected shape.',
  restoreUnmigratable: 'That view was saved in an older format (v{from}) that can no longer be read.',
  linkNoVersion: 'That link does not say which version of the filters it holds.',
  linkBadVersion: 'That link has no usable version.',
  linkTooNew: 'That link was made by a newer version of this page (v{from}, this is v{version}), so its filters cannot be applied.',
  stepBlocked: 'Cannot go to {label}. {reason}',
  blockedDisabled: 'This step is not available.',
  blockedValidation: 'Finish the current step first.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    stepper: SvStepperLabels;
  }
}
