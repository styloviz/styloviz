/**
 * @styloviz/forms — Public API
 *
 * The form-control family: everything a user types into, picks from or toggles,
 * beyond the plain text field in `@styloviz/input-field`. Every control here is
 * a `ControlValueAccessor` and renders the shared `<sv-field-error>` contract
 * from `@styloviz/core`.
 */

// ── Choice ───────────────────────────────────────────────────────────────────
export { SvCheckboxComponent } from '@styloviz/forms/checkbox';
export type { CheckboxSize, CheckboxVariant, SvCheckboxChange } from '@styloviz/forms/checkbox';

export { SvRadioGroupComponent } from '@styloviz/forms/radio-group';
export type {
  RadioGroupLayout,
  RadioGroupVariant,
  RadioGroupSize,
  RadioGroupStyle,
  RadioOption,
} from '@styloviz/forms/radio-group';

export { SvSegmentedControlComponent } from '@styloviz/forms/segmented-control';
export type {
  SegmentedActivation,
  SegmentedSemantics,
  SegmentedSize,
  SegmentedVariant,
  SegmentOption,
} from '@styloviz/forms/segmented-control';

// ── Numeric & range ──────────────────────────────────────────────────────────
export { SvNumberInputComponent } from '@styloviz/forms/number-input';
export type {
  NumberInputSize,
  NumberInputVariant,
  NumberInputPreset,
} from '@styloviz/forms/number-input';

export { SvSliderComponent } from '@styloviz/forms/slider';
export type { SliderVariant, SliderSize } from '@styloviz/forms/slider';

export { SvRatingComponent } from '@styloviz/forms/rating';
export type { RatingSize, RatingVariant, SvRatingChange } from '@styloviz/forms/rating';

// ── Suggestion & hierarchy ───────────────────────────────────────────────────
export { SvAutocompleteComponent, SvAutocompleteOptionDirective } from '@styloviz/forms/autocomplete';
export type {
  AutocompleteSize,
  AutocompleteVariant,
  AutocompleteOption,
  AutocompleteMatch,
  SvAutocompleteOptionContext,
} from '@styloviz/forms/autocomplete';



// ── Specialised entry ────────────────────────────────────────────────────────
export { SvOtpInputComponent } from '@styloviz/forms/otp-input';
export type { OtpInputVariant, OtpInputSize, OtpInputStatus, OtpInputMode } from '@styloviz/forms/otp-input';

export { SvInputMaskComponent, svDateMaskFormat, svTimeMaskSeparator } from '@styloviz/forms/input-mask';
export type {
  InputMaskPreset,
  InputMaskSize,
  InputMaskVariant,
  // Whether the field carries a regulated value — suppresses autofill and opts
  // out of every session-replay recorder. `FI-13-I1`; see `docs/pci-scope.md`.
  InputMaskSensitivity,
  InputMaskDateOrder,
} from '@styloviz/forms/input-mask';

export { SvColorPickerComponent } from '@styloviz/forms/color-picker';
export type {
  ColorPickerFormat,
  ColorPickerSize,
  ColorSwatch,
} from '@styloviz/forms/color-picker';

export { SvTimePickerComponent } from '@styloviz/forms/time-picker';
export type { TimePickerFormat, TimePickerSize } from '@styloviz/forms/time-picker';

// ── Composition & affordances ────────────────────────────────────────────────
export { SvGroupComponent } from '@styloviz/forms/group';
export type { GroupOrientation, GroupVariant, GroupGap } from '@styloviz/forms/group';

export { SvChipComponent } from '@styloviz/forms/chip';
export { SvChipGroupComponent } from '@styloviz/forms/chip-group';
export type { ChipGroupOrientation, ChipGroupSelection } from '@styloviz/forms/chip-group';
export type { ChipVariant, ChipSize, ChipStyle, ChipRole } from '@styloviz/forms/chip';

export { SvLikeComponent } from '@styloviz/forms/like';
export type { LikeVariant, LikeSize, LikeToggleEvent } from '@styloviz/forms/like';

export { SvFormErrorSummaryComponent } from '@styloviz/forms/form-error-summary';
export type {
  SvFormError,
  SvFormErrorReachFailure,
} from '@styloviz/forms/form-error-summary';

export { SvInplaceEditComponent } from '@styloviz/forms/inplace-edit';
export type {
  InplaceEditConflict,
  InplaceEditConflictChoice,
  InplaceEditMode,
  InplaceEditSave,
  InplaceEditSize,
  InplaceEditTrigger,
  InplaceEditOption,
} from '@styloviz/forms/inplace-edit';

export { SvSignaturePadComponent } from '@styloviz/forms/signature-pad';
export type {
  SignaturePadSize,
  SignaturePoint,
  SignatureStroke,
  SignatureValue,
  // What was agreed to, when, and a digest binding the two to the drawing.
  // Read its doc before relying on the hash — it is not tamper-evidence.
  // `FI-21-M1`.
  SignatureAttestation,
} from '@styloviz/forms/signature-pad';
export { isSignatureEmpty, pointCount, rescale, toSvg } from '@styloviz/forms/signature-pad';
// The canonical serialisation is exported on purpose: a digest nobody can
// recompute is a digest nobody can check, and the party who should be checking
// is the server, in another language, later.
export {
  SV_SIGNATURE_RECORD_FORMAT,
  svSignatureHash,
  svSignatureRecord,
  svVerifySignature,
} from '@styloviz/forms/signature-pad';
export { SvSurveyComponent, svNpsBand } from '@styloviz/forms/survey';
export type {
  SvSurveyKind,
  SvSurveyLayout,
  SvSurveyCorner,
  SvSurveyState,
  SvNpsBand,
  SvSurveyOption,
  SvSurveyResponse,
  SvSurveyLabels,
} from '@styloviz/forms/survey';
export { SvCronBuilderComponent } from '@styloviz/forms/cron-builder';
export type { SvCronBuilderLabels } from '@styloviz/forms/cron-builder';
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
} from '@styloviz/forms/cron-builder';
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
} from '@styloviz/forms/cron-builder';
export { SV_FORMS_LABELS } from '@styloviz/forms/labels';
export type { SvFormsLabels } from '@styloviz/forms/labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from '@styloviz/forms/labels';
