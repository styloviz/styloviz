/**
 * The text `sv-barcode-1d` renders, in English. Override any of it with
 * `provideSvLabels({ barcode1d: { … } })` from `@styloviz/core`.
 */
export interface SvBarcode1dLabels {
  /** The loading skeleton's accessible name. */
  readonly generating: string;
  /** Inspect report — the row names. */
  readonly encoding: string;
  readonly modules: string;
  readonly moduleWidth: string;
  readonly onPaper: string;
  readonly characters: string;
  /** `{count}` modules, `{left}`/`{right}` quiet-zone modules. */
  readonly modulesValue: string;
  /** `{width}` is the width the host asked for, in px. */
  readonly snappedFrom: string;
  /** `{x}` mm per module, `{width}` × `{height}` mm, `{magnification}` %. */
  readonly physicalSize: string;
  readonly pinnedForPrint: string;
  /** `{min}` is the symbology's minimum X-dimension in mm. */
  readonly belowFloor: string;
  /** `{count}` is the characters subset B alone would need. */
  readonly subsetBWouldNeed: string;
  /** Refusal reason for an empty value. */
  readonly nothingToEncode: string;
  /** Refusal reason — `{char}` is the character, `{position}` its 1-based position. */
  readonly code128OutOfRange: string;
  /** Refusal reason — `{name}` is the symbology ("EAN-13"). */
  readonly digitsOnly: string;
  /** Refusal reason — `{value}` as given, `{last}` its last digit, `{payload}` the digits before it, `{expected}` the right check digit. */
  readonly wrongCheckDigit: string;
  /** Refusal reason — `{name}` symbology, `{want}` digits, `{withCheck}` digits with the check, `{actual}` digits given. */
  readonly wrongLength: string;
  /** The inspect summary for a refused value — `{name}` is the symbology. */
  readonly cannotEncode: string;
  /** Appended to the inspect summary — `{check}` is the check character's value. */
  readonly checkCharacter: string;
  /** The symbol's accessible name — `{name}` is the symbology ("EAN-13"), `{text}` the encoded text. */
  readonly barcodeName: string;
  /** The accessible name of a refused value — `{error}` is the refusal reason. */
  readonly barcodeFailed: string;
  /** The scan-size warning — `{x}` mm per module, `{name}` the symbology family, `{min}` its minimum in mm. */
  readonly scanTooSmall: string;
}

export const SV_BARCODE_1D_LABELS: SvBarcode1dLabels = {
  generating: 'Generating barcode',
  encoding: 'encoding',
  modules: 'modules',
  moduleWidth: 'module width',
  onPaper: 'on paper',
  characters: 'characters',
  modulesValue: '{count} + {left}/{right} quiet',
  snappedFrom: '(snapped from {width}px — a sub-pixel module antialiases, and a scanner reads that as a different bar width)',
  physicalSize: '{x}mm/module · {width} × {height}mm · {magnification}%',
  pinnedForPrint: '(pinned for print)',
  belowFloor: '(below the {min}mm floor)',
  subsetBWouldNeed: '(subset B alone would need {count})',
  nothingToEncode: 'Nothing to encode.',
  code128OutOfRange: 'Code 128 here covers printable ASCII only; “{char}” at position {position} is outside it.',
  digitsOnly: '{name} is digits only.',
  wrongCheckDigit:
    'The check digit is wrong: {value} ends in {last}, but {payload} checks to {expected}. A scanner would read this as a different article number, or as nothing.',
  wrongLength: '{name} needs {want} digits (or {withCheck} including the check digit); this has {actual}.',
  cannotEncode: '{name} · cannot encode',
  checkCharacter: ' · check {check}',
  barcodeName: '{name} barcode: {text}',
  barcodeFailed: 'Barcode could not be generated: {error}',
  scanTooSmall:
    'One module measures {x} mm on paper. {name} needs at least {min} mm, so this may not scan. Widen the module or print it larger.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    barcode1d: SvBarcode1dLabels;
  }
}
