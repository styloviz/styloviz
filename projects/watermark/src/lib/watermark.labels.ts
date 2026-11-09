/**
 * The visible text `sv-watermark` renders, in English. Override any of it
 * with `provideSvLabels({ watermark: { … } })` from `@styloviz/core`.
 */
export interface SvWatermarkLabels {
  /** The `text` input's default — the mark itself. */
  readonly mark: string;
  /** Inspect variant: the tile-size term. */
  readonly inspectTile: string;
  /** Inspect variant: the tile-size note — `{width}×{height}` is the rotated extent, `{textWidth}×{textHeight}` the unrotated text box. */
  readonly inspectTileNote: string;
  /** Inspect variant: the mark-count term. */
  readonly inspectMarks: string;
  /** Inspect variant: the opacity term. */
  readonly inspectOpacity: string;
  /** Inspect variant: what a watermark is not. */
  readonly inspectCaveat: string;
  /** Inspect variant: what a tamper report is not. */
  readonly inspectThreatModel: string;
  /** Opacity advice below the usable band (`svOpacityLabel`). */
  readonly opacityTooFaint: string;
  /** Opacity advice above the usable band (`svOpacityLabel`). */
  readonly opacityTooStrong: string;
  /** Opacity advice inside the usable band (`svOpacityLabel`). */
  readonly opacityUsable: string;
}

export const SV_WATERMARK_LABELS: SvWatermarkLabels = {
  mark: 'Confidential',
  inspectTile: 'tile',
  inspectTileNote: '(rotated extent {width}×{height}, not the {textWidth}×{textHeight} text box)',
  inspectMarks: 'marks',
  inspectOpacity: 'opacity',
  inspectCaveat:
    'This is not a security control. Anything rendered in the browser can be removed by somebody with the page source; a watermark defeats the casual crop-and-share, which is what almost every real leak actually is.',
  inspectThreatModel:
    'A tamper report only means the overlay was changed in this browser; it is not proof the content is protected and not a compliance control.',
  opacityTooFaint:
    'Below about 4% the mark survives on screen and disappears the moment the screenshot is saved as a JPEG — which is what happens to every screenshot.',
  opacityTooStrong:
    'Above about 25% the document underneath becomes hard to read, and somebody turns the watermark off entirely.',
  opacityUsable: 'Visible in a compressed screenshot, and light enough to read through.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    watermark: SvWatermarkLabels;
  }
}
