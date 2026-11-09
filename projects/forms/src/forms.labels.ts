/**
 * The strings `sv-autocomplete`, `sv-input-mask`, `sv-time-picker`,
 * `sv-inplace-edit`, `sv-color-picker`, `sv-otp-input`, `sv-segmented-control`,
 * `sv-group`, `sv-chip`, `sv-number-input`, `sv-form-error-summary`, `sv-like`,
 * `sv-signature-pad`, `sv-slider`, `sv-survey` and `sv-cron-builder` render, in English. Override any of
 * them with `provideSvLabels({ forms: { … } })` from `@styloviz/core`.
 */
export interface SvFormsLabels {
  readonly clear: string;
  readonly hour: string;
  readonly minute: string;
  readonly second: string;
  readonly amOrPm: string;
  readonly save: string;
  readonly cancel: string;
  readonly colorPicker: string;
  readonly saturationAndBrightness: string;
  readonly hue: string;
  readonly opacity: string;
  readonly hexColorValue: string;
  readonly numberInput: string;
  readonly oneTimeCode: string;
  readonly rating: string;
  readonly timePicker: string;
  readonly digitOf: string;
  readonly soldOutOption: string;
  readonly typeTimeFor: string;
  readonly typeTime: string;
  readonly collapseGroup: string;
  readonly expandGroup: string;
  readonly removeChip: string;
  readonly removeItem: string;
  readonly decreaseNamed: string;
  readonly decreaseValue: string;
  readonly increaseNamed: string;
  readonly increaseValue: string;
  /** `sv-autocomplete`'s placeholder (its `placeholder` input's default). */
  readonly searchPlaceholder: string;
  /** `sv-autocomplete`'s empty result (its `noResultsLabel` input's default). */
  readonly noResultsFound: string;
  /** `sv-color-picker`'s hex field heading. */
  readonly hexHeading: string;
  /** `sv-color-picker`'s preset swatches heading. */
  readonly presetsHeading: string;
  /** `sv-form-error-summary`'s busy message (its `busyMessage` input's default). */
  readonly rechecking: string;
  /** `sv-form-error-summary`'s note on an error with no field to focus. */
  readonly cannotJumpToField: string;
  /** `sv-inplace-edit`'s text for an empty value (its `emptyText` input's default). */
  readonly emptyValue: string;
  /** `sv-inplace-edit`'s required error (its `requiredMessage` input's default). */
  readonly fieldRequired: string;
  /** `sv-inplace-edit`'s conflict panel: the user's own value. */
  readonly conflictYours: string;
  /** `sv-inplace-edit`'s conflict panel: keep the user's value. */
  readonly conflictKeepMine: string;
  /** `sv-inplace-edit`'s conflict panel: the other writer's value. */
  readonly conflictTheirs: string;
  /** `sv-inplace-edit`'s conflict panel: take the other writer's value. */
  readonly conflictUseTheirs: string;
  /** `sv-like`'s save-failure message; `{message}` is the error. */
  readonly notSaved: string;
  /** `sv-otp-input`'s verifying status. */
  readonly verifying: string;
  /** `sv-signature-pad`'s field label (its `label` input's default). */
  readonly signature: string;
  /** `sv-signature-pad`'s typed-name field label (its `typedNameLabel` input's default). */
  readonly typeFullName: string;
  /** `sv-signature-pad`'s undo-last-stroke button. */
  readonly undo: string;
  /** `sv-time-picker`'s hour column heading. */
  readonly hourHeading: string;
  /** `sv-time-picker`'s minute column heading. */
  readonly minuteHeading: string;
  /** `sv-time-picker`'s second column heading. */
  readonly secondHeading: string;
  /** `sv-time-picker`'s AM/PM column heading. */
  readonly periodHeading: string;
  /** `sv-time-picker`'s set-to-now button. */
  readonly now: string;
  /** `sv-time-picker`'s close button. */
  readonly done: string;
  /** `sv-autocomplete`'s truncation note — `{shown}` / `{total}` arrive formatted. */
  readonly autocompleteTruncated: string;
  /** The same note with `serverSide`, where typing more is the host's call. */
  readonly autocompleteTruncatedServer: string;
  /** `sv-color-picker`'s contrast sentence — `{ratio}` arrives formatted. */
  readonly contrastFails: string;
  readonly contrastLargeOnly: string;
  /** `{grade}` is the WCAG grade (`AA`, `AAA`). */
  readonly contrastPasses: string;
  /** `sv-color-picker`'s default preset swatch names, shown as each swatch's title and accessible name. */
  readonly swatchRed: string;
  readonly swatchOrange: string;
  readonly swatchAmber: string;
  readonly swatchYellow: string;
  readonly swatchGreen: string;
  readonly swatchTeal: string;
  readonly swatchCyan: string;
  readonly swatchBlue: string;
  readonly swatchIndigo: string;
  readonly swatchPurple: string;
  readonly swatchPink: string;
  readonly swatchGray: string;
  readonly swatchBlack: string;
  readonly swatchWhite: string;
  /** `sv-form-error-summary`'s default heading — `{count}` picks the plural, `{n}` is the number shown. */
  readonly errorSummaryHeading: string;
  /** `sv-group`'s error-count badge, for screen readers. */
  readonly groupErrorCount: string;
  /** `sv-inplace-edit`'s conflict prompt — `{who}` / `{when}` come from the conflict. */
  readonly conflictByAt: string;
  readonly conflictBy: string;
  readonly conflictElsewhereAt: string;
  readonly conflictElsewhere: string;
  /** `sv-input-mask`'s preset labels. */
  readonly maskPhoneUs: string;
  readonly maskPhoneIntl: string;
  readonly maskCreditCard: string;
  readonly maskDate: string;
  readonly maskTime: string;
  readonly maskSsn: string;
  readonly maskZip: string;
  readonly maskIp: string;
  readonly maskCustom: string;
  /** `sv-input-mask`'s announcement when typed characters were dropped. */
  readonly maskRejected: string;
  /** `sv-like`'s accessible-name part after a failed save. */
  readonly likeNotSavedState: string;
  /** `sv-otp-input`'s announcement after a rejected code is cleared. */
  readonly otpCleared: string;
  /** `sv-slider`'s range handles, with no label. */
  readonly rangeMinimum: string;
  readonly rangeMaximum: string;
  /** `sv-slider`'s range handles — `{name}` is the label. */
  readonly rangeMinimumNamed: string;
  readonly rangeMaximumNamed: string;
  /** `sv-autocomplete`'s panel line while the query is shorter than `minChars`. `{count}` picks the plural, `{n}` is the number shown. */
  readonly minCharsHint: string;
  /** `sv-color-picker`'s trigger name with a `label`. `{label}`, `{color}` (the colour in words), `{value}` (the code). */
  readonly colorPickerTriggerName: string;
  /** `sv-color-picker`'s trigger name without a `label`. `{color}`, `{value}`. */
  readonly colorPickerTriggerNameDefault: string;
  /** `sv-color-picker`'s saturation/brightness area value text. `{saturation}`, `{brightness}` (whole percentages). */
  readonly colorPickerAreaValue: string;
  /** `sv-rating`'s scale nouns per variant; `{count}` is the scale size (the noun agrees with the scale, not the score). */
  readonly ratingNounStar: string;
  readonly ratingNounHeart: string;
  readonly ratingNounFire: string;
  readonly ratingNounThumb: string;
  /** `sv-rating`'s value text. `{value}`, `{max}`, `{noun}`. */
  readonly ratingValueText: string;
  /** `sv-rating`'s value text when the level has a label. `{value}`, `{max}`, `{label}`. */
  readonly ratingValueTextLevel: string;
  /** `sv-rating` summary's accessible name. `{average}`, `{max}`, `{noun}`, `{count}` picks the plural, `{total}` is the formatted review count. */
  readonly ratingSummaryName: string;
  /** `sv-rating` summary line. `{total}` is the formatted review count; `{count}` picks the plural. */
  readonly ratingReviewCount: string;
  /** `sv-time-picker` trigger text with no value, and the typed-entry error. `{hint}` is the format hint. */
  readonly timePickerPlaceholder: string;
  readonly timePickerInvalid: string;
  /** `sv-autocomplete`’s Create row (`creatable`). */
  readonly createOption: string;
  /** `sv-time-picker` typed-entry hint. `{time}` is an example time in the control’s own format and day periods. */
  readonly timePickerExample: string;
  /** `sv-input-mask` `date` placeholder letters for the day, month and year fields, and the `time` hour and minute (`DD.MM.YYYY`, `HH:MM`). */
  readonly maskDayLetters: string;
  readonly maskMonthLetters: string;
  readonly maskYearLetters: string;
  readonly maskHourLetters: string;
  readonly maskMinuteLetters: string;
  /** `sv-survey`'s default question for each kind — `question` overrides it. */
  readonly surveyNpsQuestion: string;
  readonly surveyCsatQuestion: string;
  readonly surveyQuestion: string;
  /** `sv-survey`'s NPS end labels, under 0 and 10. */
  readonly surveyNpsLow: string;
  readonly surveyNpsHigh: string;
  /** `sv-survey`'s CSAT levels, 1 to 5 — each one names its radio and shows once chosen. */
  readonly surveyCsat1: string;
  readonly surveyCsat2: string;
  readonly surveyCsat3: string;
  readonly surveyCsat4: string;
  readonly surveyCsat5: string;
  /** `sv-survey`'s follow-up prompt after a score (NPS, CSAT) or a choice (one question), and the "Optional" note beside it. */
  readonly surveyFollowUp: string;
  readonly surveyFollowUpChoice: string;
  readonly surveyOptional: string;
  /** `sv-survey`'s free-text answer label for a one-question survey with no options. */
  readonly surveyAnswer: string;
  /** `sv-survey`'s submit button, and the message when it is pressed with nothing answered. */
  readonly surveySubmit: string;
  readonly surveyRequired: string;
  /** `sv-survey`'s close button. */
  readonly surveyDismiss: string;
  /** `sv-survey`'s thank-you state. */
  readonly surveyThanksTitle: string;
  readonly surveyThanksMessage: string;
  /** `sv-cron-builder`'s group name (when `label` is not set), the mode switch's name, and its six modes. */
  readonly cronLegend: string;
  readonly cronFrequency: string;
  readonly cronModeMinutes: string;
  readonly cronModeHourly: string;
  readonly cronModeDaily: string;
  readonly cronModeWeekly: string;
  readonly cronModeMonthly: string;
  readonly cronModeCustom: string;
  /** `sv-cron-builder` with no value yet — the hint where the editor goes. */
  readonly cronChooseFrequency: string;
  /** `sv-cron-builder`'s interval picker label and its options (`{n}` = the interval). */
  readonly cronEvery: string;
  readonly cronIntervalMinutes: string;
  readonly cronIntervalHours: string;
  /** `sv-cron-builder`'s minute-past-the-hour picker (hourly mode). */
  readonly cronAtMinute: string;
  /** `sv-cron-builder`'s day pickers (weekly, monthly). */
  readonly cronWeekdays: string;
  readonly cronMonthDays: string;
  /** `sv-cron-builder`'s Custom field and the hint under it. */
  readonly cronExpression: string;
  readonly cronExpressionHint: string;
  /** `sv-cron-builder`'s preview region, the next-runs heading (`{zone}` = IANA zone) and its empty text. */
  readonly cronPreview: string;
  readonly cronNextRuns: string;
  readonly cronNoRuns: string;
  /** Cron validation messages. `{field}` is one of the `cronField*` names; `{token}` the rejected text. */
  readonly cronErrEmpty: string;
  readonly cronErrFieldCount: string;
  readonly cronErrInvalid: string;
  readonly cronErrRange: string;
  readonly cronErrStep: string;
  readonly cronErrNoDays: string;
  readonly cronFieldMinute: string;
  readonly cronFieldHour: string;
  readonly cronFieldDayOfMonth: string;
  readonly cronFieldMonth: string;
  readonly cronFieldDayOfWeek: string;
  /** `svDescribeCron` sentences for the shapes the visual modes make. */
  readonly cronDescEveryNMinutes: string;
  readonly cronDescHourly: string;
  readonly cronDescDaily: string;
  readonly cronDescWeekdays: string;
  readonly cronDescWeekly: string;
  readonly cronDescMonthly: string;
  /** `svDescribeCron` clauses for every other expression, joined with ", ". The first is capitalised. */
  readonly cronDescAtTimes: string;
  readonly cronDescAtMinutes: string;
  readonly cronDescPastEveryNHours: string;
  readonly cronDescDuringHours: string;
  readonly cronDescOnDays: string;
  readonly cronDescOnEveryNthDay: string;
  readonly cronDescOnWeekdays: string;
  /** Both day fields set: cron runs on EITHER (`Or`), or — when one is written with `*` — on days matching BOTH (`If`). */
  readonly cronDescOrWeekdays: string;
  readonly cronDescIfWeekdays: string;
  readonly cronDescInMonths: string;
  /** A run of three or more values in a list ("Monday through Friday"). */
  readonly cronRange: string;
  /** Ordinal day numbers, chosen by the locale's ordinal plural rule (`Intl.PluralRules` `type: 'ordinal'`). */
  readonly cronOrdinalOne: string;
  readonly cronOrdinalTwo: string;
  readonly cronOrdinalFew: string;
  readonly cronOrdinalOther: string;
}

export const SV_FORMS_LABELS: SvFormsLabels = {
  clear: 'Clear',
  hour: 'Hour',
  minute: 'Minute',
  second: 'Second',
  amOrPm: 'AM or PM',
  save: 'Save',
  cancel: 'Cancel',
  colorPicker: 'Color picker',
  saturationAndBrightness: 'Saturation and brightness',
  hue: 'Hue',
  opacity: 'Opacity',
  hexColorValue: 'Hex color value',
  numberInput: 'Number input',
  oneTimeCode: 'One-time code',
  rating: 'Rating',
  timePicker: 'Time picker',
  digitOf: 'Digit {index} of {total}',
  soldOutOption: '{name} (sold out)',
  typeTimeFor: '{name} — type a time',
  typeTime: 'Time — type a time',
  collapseGroup: 'Collapse {name}',
  expandGroup: 'Expand {name}',
  removeChip: 'Remove {name}',
  removeItem: 'Remove item',
  decreaseNamed: 'Decrease {name}',
  decreaseValue: 'Decrease value',
  increaseNamed: 'Increase {name}',
  increaseValue: 'Increase value',
  searchPlaceholder: 'Search…',
  noResultsFound: 'No results found',
  hexHeading: 'Hex',
  presetsHeading: 'Presets',
  rechecking: 'Rechecking…',
  cannotJumpToField: '(could not jump to this field)',
  emptyValue: 'Empty',
  fieldRequired: 'This field cannot be empty',
  conflictYours: 'Yours',
  conflictKeepMine: 'Keep mine',
  conflictTheirs: 'Theirs',
  conflictUseTheirs: 'Use theirs',
  notSaved: 'Not saved: {message}',
  verifying: 'Verifying…',
  signature: 'Signature',
  typeFullName: 'Or type your full name',
  undo: 'Undo',
  hourHeading: 'Hour',
  minuteHeading: 'Min',
  secondHeading: 'Sec',
  periodHeading: 'Period',
  now: 'Now',
  done: 'Done',
  autocompleteTruncated: 'Showing {shown} of {total} — keep typing to narrow',
  autocompleteTruncatedServer: 'Showing {shown} of {total}',
  contrastFails: 'Contrast {ratio} — fails WCAG for any text size',
  contrastLargeOnly: 'Contrast {ratio} — passes for large text only',
  contrastPasses: 'Contrast {ratio} — passes {grade} for body text',
  swatchRed: 'Red',
  swatchOrange: 'Orange',
  swatchAmber: 'Amber',
  swatchYellow: 'Yellow',
  swatchGreen: 'Green',
  swatchTeal: 'Teal',
  swatchCyan: 'Cyan',
  swatchBlue: 'Blue',
  swatchIndigo: 'Indigo',
  swatchPurple: 'Purple',
  swatchPink: 'Pink',
  swatchGray: 'Gray',
  swatchBlack: 'Black',
  swatchWhite: 'White',
  errorSummaryHeading: '{count, plural, one {There is a problem} other {There are {n} problems}}',
  groupErrorCount: '{count, plural, one {{n} field needs attention} other {{n} fields need attention}}',
  conflictByAt: '{who} changed this field {when}. Choose which version to keep.',
  conflictBy: '{who} changed this field. Choose which version to keep.',
  conflictElsewhereAt: 'This field was changed elsewhere {when}. Choose which version to keep.',
  conflictElsewhere: 'This field was changed elsewhere. Choose which version to keep.',
  maskPhoneUs: 'Phone (US)',
  maskPhoneIntl: 'Phone (Intl)',
  maskCreditCard: 'Credit Card',
  maskDate: 'Date',
  maskTime: 'Time',
  maskSsn: 'SSN (US)',
  maskZip: 'ZIP+4 (US)',
  maskIp: 'IP Address',
  maskCustom: 'Custom Mask',
  maskRejected: '{count, plural, one {{n} character did not fit this format and was not entered.} other {{n} characters did not fit this format and were not entered.}}',
  likeNotSavedState: 'not saved',
  otpCleared: 'Code cleared. Enter the code again.',
  rangeMinimum: 'Range minimum',
  rangeMaximum: 'Range maximum',
  rangeMinimumNamed: '{name} minimum',
  rangeMaximumNamed: '{name} maximum',
  minCharsHint: 'Type {count, plural, one {{n} character} other {{n} characters}} to search',
  colorPickerTriggerName: '{label}: {color}, {value}',
  colorPickerTriggerNameDefault: 'Pick colour: {color}, {value}',
  colorPickerAreaValue: 'Saturation {saturation}%, brightness {brightness}%',
  ratingNounStar: '{count, plural, one {star} other {stars}}',
  ratingNounHeart: '{count, plural, one {heart} other {hearts}}',
  ratingNounFire: '{count, plural, one {flame} other {flames}}',
  ratingNounThumb: '{count, plural, one {thumb} other {thumbs}}',
  ratingValueText: '{value} of {max} {noun}',
  ratingValueTextLevel: '{value} of {max} — {label}',
  ratingSummaryName: 'Average {average} of {max} {noun} from {count, plural, one {{total} review} other {{total} reviews}}',
  ratingReviewCount: '{total} {count, plural, one {review} other {reviews}}',
  timePickerPlaceholder: 'Select time',
  timePickerInvalid: 'Not a time — {hint}',
  createOption: 'Create “{label}”',
  timePickerExample: 'e.g. {time}',
  maskDayLetters: 'DD',
  maskMonthLetters: 'MM',
  maskYearLetters: 'YYYY',
  maskHourLetters: 'HH',
  maskMinuteLetters: 'MM',
  surveyNpsQuestion: 'How likely are you to recommend us to a friend or colleague?',
  surveyCsatQuestion: 'How satisfied are you with your experience?',
  surveyQuestion: 'How did we do?',
  surveyNpsLow: 'Not likely',
  surveyNpsHigh: 'Very likely',
  surveyCsat1: 'Very dissatisfied',
  surveyCsat2: 'Dissatisfied',
  surveyCsat3: 'Neutral',
  surveyCsat4: 'Satisfied',
  surveyCsat5: 'Very satisfied',
  surveyFollowUp: 'What’s the main reason for your score?',
  surveyFollowUpChoice: 'Anything you’d like to add?',
  surveyOptional: 'Optional',
  surveyAnswer: 'Your answer',
  surveySubmit: 'Send feedback',
  surveyRequired: 'Choose an answer first.',
  surveyDismiss: 'Close survey',
  surveyThanksTitle: 'Thank you!',
  surveyThanksMessage: 'Your feedback helps us decide what to improve next.',
  cronLegend: 'Schedule',
  cronFrequency: 'Frequency',
  cronModeMinutes: 'Minutes',
  cronModeHourly: 'Hourly',
  cronModeDaily: 'Daily',
  cronModeWeekly: 'Weekly',
  cronModeMonthly: 'Monthly',
  cronModeCustom: 'Custom',
  cronChooseFrequency: 'Choose how often it runs.',
  cronEvery: 'Every',
  cronIntervalMinutes: '{n, plural, one {# minute} other {# minutes}}',
  cronIntervalHours: '{n, plural, one {# hour} other {# hours}}',
  cronAtMinute: 'At minute',
  cronWeekdays: 'Days of the week',
  cronMonthDays: 'Days of the month',
  cronExpression: 'Cron expression',
  cronExpressionHint: 'Five fields: minute, hour, day of month, month, day of week.',
  cronPreview: 'Schedule preview',
  cronNextRuns: 'Next runs ({zone})',
  cronNoRuns: 'No upcoming runs found.',
  cronErrEmpty: 'Enter a cron expression.',
  cronErrFieldCount: 'Enter five fields separated by spaces: minute, hour, day of month, month and day of week.',
  cronErrInvalid: 'The {field} field has “{token}”, which is not a value, range or step.',
  cronErrRange: 'In the {field} field, “{token}” is outside {min}–{max}.',
  cronErrStep: 'In the {field} field, the step in “{token}” must be from 1 to {max}.',
  cronErrNoDays: 'Choose at least one day.',
  cronFieldMinute: 'minute',
  cronFieldHour: 'hour',
  cronFieldDayOfMonth: 'day-of-month',
  cronFieldMonth: 'month',
  cronFieldDayOfWeek: 'day-of-week',
  cronDescEveryNMinutes: '{n, plural, one {Every minute} other {Every # minutes}}',
  cronDescHourly: '{n, plural, one {At minute {minute} past every hour} other {At minute {minute} past every # hours}}',
  cronDescDaily: 'Every day at {time}',
  cronDescWeekdays: 'Every weekday at {time}',
  cronDescWeekly: 'Every {days} at {time}',
  cronDescMonthly: 'On the {days} of every month at {time}',
  cronDescAtTimes: 'At {times}',
  cronDescAtMinutes: '{count, plural, one {At minute {list}} other {At minutes {list}}}',
  cronDescPastEveryNHours: '{n, plural, one {past every hour} other {past every # hours}}',
  cronDescDuringHours: '{count, plural, one {during hour {list}} other {during hours {list}}}',
  cronDescOnDays: 'on the {days} of the month',
  cronDescOnEveryNthDay: 'on every {nth} day of the month',
  cronDescOnWeekdays: 'on {days}',
  cronDescOrWeekdays: '{dom}, or on any {days}',
  cronDescIfWeekdays: '{dom}, but only on a {days}',
  cronDescInMonths: 'in {months}',
  cronRange: '{from} through {to}',
  cronOrdinalOne: '{n}st',
  cronOrdinalTwo: '{n}nd',
  cronOrdinalFew: '{n}rd',
  cronOrdinalOther: '{n}th',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    forms: SvFormsLabels;
  }
}
