/**
 * The accessible names and visible text `sv-sparkline` renders, in English. Override any of them with
 * `provideSvLabels({ sparkline: { … } })` from `@styloviz/core`.
 */
export interface SvSparklineLabels {
  readonly loading: string;
  readonly couldNotLoadRetry: string;
  /** The error state's tooltip. */
  readonly couldNotLoadClickToRetry: string;
  /** The generated description of an empty series. */
  readonly noData: string;
  /** Generated description — `{count}` drives the plural, `{n}` is the count as shown. */
  readonly summaryPoints: string;
  /** Generated description — `{direction}` is one of the direction words. */
  readonly trending: string;
  /** Generated description — `{direction}` word and `{percent}` change (one decimal). */
  readonly trendingBy: string;
  readonly directionUp: string;
  readonly directionDown: string;
  readonly directionFlat: string;
  /** Generated description — `{first}` and `{last}` values. */
  readonly fromTo: string;
  /** Generated description — `{min}` and `{max}` values. */
  readonly lowHigh: string;
  /** Generated description — `{count}` drives the plural, `{n}` is the count as shown, `{treatment}` how gaps are drawn. */
  readonly missingSamples: string;
  readonly missingAsBreaks: string;
  readonly missingAsLines: string;
  readonly missingAsZero: string;
  readonly missingLeftOut: string;
  /** Generated description of a pinned scale — `{low}` and `{high}`. */
  readonly scale: string;
  /** As `scale`, with `{clipped}` points outside it. */
  readonly scaleClipped: string;
  /** Stands in for an unpinned end of the scale. */
  readonly scaleAuto: string;
  /** The comparability disclosure for a self-scaled series. */
  readonly scaleNotComparable: string;
}

export const SV_SPARKLINE_LABELS: SvSparklineLabels = {
  loading: 'Loading',
  couldNotLoadRetry: 'Could not load — retry',
  couldNotLoadClickToRetry: 'Could not load — click to retry',
  noData: 'No data',
  summaryPoints: 'Sparkline, {count, plural, one {{n} point} other {{n} points}}',
  trending: 'trending {direction}',
  trendingBy: 'trending {direction} {percent}%',
  directionUp: 'up',
  directionDown: 'down',
  directionFlat: 'flat',
  fromTo: 'from {first} to {last}',
  lowHigh: 'low {min}, high {max}',
  missingSamples: '{count, plural, one {{n} missing sample} other {{n} missing samples}}, {treatment}',
  missingAsBreaks: 'drawn as breaks',
  missingAsLines: 'drawn as straight lines across',
  missingAsZero: 'drawn as zero',
  missingLeftOut: 'left out',
  scale: 'scale {low} to {high}',
  scaleClipped: 'scale {low} to {high}, {clipped} beyond it',
  scaleAuto: 'auto',
  scaleNotComparable: 'scaled to this series alone, so its height is not comparable',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    sparkline: SvSparklineLabels;
  }
}
