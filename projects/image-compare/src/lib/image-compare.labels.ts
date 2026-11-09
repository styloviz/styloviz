/**
 * The English text `sv-image-compare` renders. Override any of it with
 * `provideSvLabels({ imageCompare: { … } })` from `@styloviz/core`.
 */
export interface SvImageCompareLabels {
  /** `beforeAlt`'s default. */
  readonly beforeAlt: string;
  /** `afterAlt`'s default. */
  readonly afterAlt: string;
  /** `ariaLabel`'s default: the slider's accessible name. */
  readonly sliderName: string;
  /** The inspect read-out's terms. */
  readonly inspectBefore: string;
  readonly inspectAfter: string;
  readonly inspectDifference: string;
  readonly inspectPosition: string;
  /** The inspect read-out's verdict on the two frames. */
  readonly verdictRotated: string;
  readonly verdictReshaped: string;
  readonly verdictScaled: string;
  readonly verdictIdentical: string;
  readonly verdictUnmeasured: string;
  /**
   * The caveat under the read-out is ONE paragraph in four pieces around markup:
   * `{caveatBefore} <em>{caveatFraming}</em>{caveatMiddle} <code>landmarks</code> {caveatAfter}`.
   * Translate them together.
   */
  readonly caveatBefore: string;
  readonly caveatFraming: string;
  readonly caveatMiddle: string;
  readonly caveatAfter: string;
  /** Note for a pair of the same shape at different pixel sizes; `{before}`/`{after}` are `W×H`. */
  readonly noteScaled: string;
  /** Warning for a pair a quarter turn apart; `{before}`/`{after}` are `W×H`. */
  readonly warningRotated: string;
  /** Warning for a pair of different shapes; `{before}`/`{after}` are the ratios to two places. */
  readonly warningReshaped: string;
  /** The slider's `aria-valuetext` at either end, and in between. */
  readonly positionBeforeOnly: string;
  readonly positionAfterOnly: string;
  readonly positionMix: string;
  /** Shown (and announced) until both images have loaded. */
  readonly loadingImages: string;
  /** Shown when an image failed; `{name}` is its alt text. */
  readonly imageFailed: string;
}

export const SV_IMAGE_COMPARE_LABELS: SvImageCompareLabels = {
  beforeAlt: 'the before image',
  afterAlt: 'the after image',
  sliderName: 'Comparison position',
  inspectBefore: 'before',
  inspectAfter: 'after',
  inspectDifference: 'difference',
  inspectPosition: 'position',
  verdictRotated: 'a quarter turn apart',
  verdictReshaped: 'not comparable by wiping',
  verdictScaled: 'the same shape, different sizes',
  verdictIdentical: 'the same dimensions',
  verdictUnmeasured: 'not measured yet',
  caveatBefore: 'The ratios are read from each file\'s intrinsic size, not from the boxes on screen — the layout stretches both to the same rectangle, so the rendered sizes always agree even when the pictures do not. Matching dimensions do not prove matching',
  caveatFraming: 'framing',
  caveatMiddle: ': two files the same size can still be different crops of the same scene, which nothing measurable from a browser can detect. Turn on',
  caveatAfter: 'and check a fixed feature against the same line on both sides.',
  noteScaled:
    'These are the same shape at different sizes ({before} against {after}), so the wipe is honest — but the smaller one is being scaled up to fit, and will look softer than it is.',
  warningRotated:
    'One of these is a quarter turn out ({before} against {after}). That is almost always an EXIF orientation tag applied to one file and not the other — re-export it rather than re-cropping, because the picture is right and only the rotation is wrong.',
  warningReshaped:
    'These two images are different shapes ({before}:1 against {after}:1), so one of them is being cropped or stretched to fit. Part of what the wipe shows is the reframing, not the change.',
  positionBeforeOnly: 'Showing {before} only.',
  positionAfterOnly: 'Showing {after} only.',
  positionMix: '{afterPercent}% {after}, {beforePercent}% {before}.',
  loadingImages: 'Loading the images to compare…',
  imageFailed: '{name} could not be loaded, so there is nothing to compare.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    imageCompare: SvImageCompareLabels;
  }
}
