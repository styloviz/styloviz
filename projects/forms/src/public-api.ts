/**
 * @styloviz/forms — Public API
 *
 * The form-control family: everything a user types into, picks from or toggles,
 * beyond the plain text field in `@styloviz/input-field`. Every control here is
 * a `ControlValueAccessor` and renders the shared `<sv-field-error>` contract
 * from `@styloviz/core`.
 */

// ── Choice ───────────────────────────────────────────────────────────────────
export { SvCheckboxComponent } from './checkbox/checkbox.component';
export type { CheckboxSize, CheckboxVariant, SvCheckboxChange } from './checkbox/checkbox.component';

export { SvRadioGroupComponent } from './radio-group/radio-group.component';
export type {
  RadioGroupLayout,
  RadioGroupVariant,
  RadioGroupSize,
  RadioGroupStyle,
  RadioOption,
} from './radio-group/radio-group.component';

export { SvSegmentedControlComponent } from './segmented-control/segmented-control.component';
export type {
  SegmentedActivation,
  SegmentedSemantics,
  SegmentedSize,
  SegmentedVariant,
  SegmentOption,
} from './segmented-control/segmented-control.component';

// ── Numeric & range ──────────────────────────────────────────────────────────
export { SvNumberInputComponent } from './number-input/number-input.component';
export type {
  NumberInputSize,
  NumberInputVariant,
  NumberInputPreset,
} from './number-input/number-input.component';

export { SvSliderComponent } from './slider/slider.component';
export type { SliderVariant, SliderSize } from './slider/slider.component';

export { SvRatingComponent } from './rating/rating.component';
export type { RatingSize, RatingVariant, SvRatingChange } from './rating/rating.component';

// ── Suggestion & hierarchy ───────────────────────────────────────────────────
export { SvAutocompleteComponent, SvAutocompleteOptionDirective } from './autocomplete/autocomplete.component';
export type {
  AutocompleteSize,
  AutocompleteVariant,
  AutocompleteOption,
  AutocompleteMatch,
  SvAutocompleteOptionContext,
} from './autocomplete/autocomplete.component';



// ── Specialised entry ────────────────────────────────────────────────────────
export { SvOtpInputComponent } from './otp-input/otp-input.component';
export type { OtpInputVariant, OtpInputSize, OtpInputStatus, OtpInputMode } from './otp-input/otp-input.types';

export { SvInputMaskComponent, svDateMaskFormat, svTimeMaskSeparator } from './input-mask/input-mask.component';
export type {
  InputMaskPreset,
  InputMaskSize,
  InputMaskVariant,
  // Whether the field carries a regulated value — suppresses autofill and opts
  // out of every session-replay recorder. `FI-13-I1`; see `docs/pci-scope.md`.
  InputMaskSensitivity,
  InputMaskDateOrder,
} from './input-mask/input-mask.component';

export { SvColorPickerComponent } from './color-picker/color-picker.component';
export type {
  ColorPickerFormat,
  ColorPickerSize,
  ColorSwatch,
} from './color-picker/color-picker.types';

export { SvTimePickerComponent } from './time-picker/time-picker.component';
export type { TimePickerFormat, TimePickerSize } from './time-picker/time-picker.component';

// ── Composition & affordances ────────────────────────────────────────────────
export { SvGroupComponent } from './group/group.component';
export type { GroupOrientation, GroupVariant, GroupGap } from './group/group.component';

export { SvChipComponent } from './chip/chip.component';
export { SvChipGroupComponent } from './chip-group/chip-group.component';
export type { ChipGroupOrientation, ChipGroupSelection } from './chip-group/chip-group.component';
export type { ChipVariant, ChipSize, ChipStyle, ChipRole } from './chip/chip.component';

export { SvLikeComponent } from './like/like.component';
export type { LikeVariant, LikeSize, LikeToggleEvent } from './like/like.component';

export { SvFormErrorSummaryComponent } from './form-error-summary/form-error-summary.component';
export type {
  SvFormError,
  SvFormErrorReachFailure,
} from './form-error-summary/form-error-summary.component';

export { SvInplaceEditComponent } from './inplace-edit/inplace-edit.component';
export type {
  InplaceEditConflict,
  InplaceEditConflictChoice,
  InplaceEditMode,
  InplaceEditSave,
  InplaceEditSize,
  InplaceEditTrigger,
  InplaceEditOption,
} from './inplace-edit/inplace-edit.component';

export { SvSignaturePadComponent } from './signature-pad/signature-pad.component';
export type {
  SignaturePadSize,
  SignaturePoint,
  SignatureStroke,
  SignatureValue,
  // What was agreed to, when, and a digest binding the two to the drawing.
  // Read its doc before relying on the hash — it is not tamper-evidence.
  // `FI-21-M1`.
  SignatureAttestation,
} from './signature-pad/signature-pad.types';
export { isSignatureEmpty, pointCount, rescale, toSvg } from './signature-pad/signature-pad.types';
// The canonical serialisation is exported on purpose: a digest nobody can
// recompute is a digest nobody can check, and the party who should be checking
// is the server, in another language, later.
export {
  SV_SIGNATURE_RECORD_FORMAT,
  svSignatureHash,
  svSignatureRecord,
  svVerifySignature,
} from './signature-pad/signature-pad.types';
export { SvSurveyComponent, svNpsBand } from './survey/survey.component';
export type {
  SvSurveyKind,
  SvSurveyLayout,
  SvSurveyCorner,
  SvSurveyState,
  SvNpsBand,
  SvSurveyOption,
  SvSurveyResponse,
  SvSurveyLabels,
} from './survey/survey.component';
export { SvCronBuilderComponent } from './cron-builder/cron-builder.component';
export type { SvCronBuilderLabels } from './cron-builder/cron-builder.component';
export {
  SV_CRON_HOUR_INTERVALS,
  SV_CRON_MINUTE_INTERVALS,
  SV_CRON_VISUAL_DEFAULTS,
  svCronErrorMessage,
  svCronFromVisual,
  svCronToVisual,
  svCronVisualHint,
  svDescribeCron,
  svFormatCron,
  svNextCronRuns,
  svParseCron,
} from './cron-builder/cron';
export type {
  SvCron,
  SvCronDescribeOptions,
  SvCronError,
  SvCronErrorCode,
  SvCronField,
  SvCronFieldName,
  SvCronLabels,
  SvCronMode,
  SvCronParseResult,
  SvCronRunOptions,
  SvCronVisual,
  SvCronVisualMode,
} from './cron-builder/cron';
export { SV_FORMS_LABELS } from './forms.labels';
export type { SvFormsLabels } from './forms.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './forms.labels.packs';
