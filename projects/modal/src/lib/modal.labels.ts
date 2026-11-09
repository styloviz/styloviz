/**
 * The accessible names `sv-modal` renders, in English. Override any of
 * them with `provideSvLabels({ modal: { … } })` from `@styloviz/core`.
 */
export interface SvModalLabels {
  readonly closeDialog: string;
  readonly dialog: string;
  readonly restoreDialogSize: string;
  readonly maximizeDialog: string;
  readonly loading: string;
  readonly unsavedTitle: string;
  readonly unsavedMessage: string;
  readonly discard: string;
  readonly keepEditing: string;
  readonly slowMessage: string;
  readonly stalledMessage: string;
}

export const SV_MODAL_LABELS: SvModalLabels = {
  closeDialog: 'Close dialog',
  dialog: 'Dialog',
  restoreDialogSize: 'Restore dialog size',
  maximizeDialog: 'Maximize dialog',
  loading: 'Loading…',
  unsavedTitle: 'Discard your changes?',
  unsavedMessage: 'This dialog has changes that have not been saved.',
  discard: 'Discard',
  keepEditing: 'Keep editing',
  slowMessage: 'This is taking longer than usual…',
  stalledMessage: 'This seems to be stuck.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    modal: SvModalLabels;
  }
}
