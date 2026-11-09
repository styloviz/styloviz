/**
 * The text `sv-skeleton-loader` renders and announces, in English. Override
 * any of it with `provideSvLabels({ skeletonLoader: { … } })` from
 * `@styloviz/core`; the inputs still override it per instance.
 */
export interface SvSkeletonLoaderLabels {
  /** Announced while content loads (`ariaLabel` defaults to it). */
  readonly loading: string;
  /** Shown at the `slow` stage (`slowMessage` defaults to it). */
  readonly slow: string;
  /** Shown at the `stalled` stage (`stalledMessage` defaults to it). */
  readonly stalled: string;
}

export const SV_SKELETON_LOADER_LABELS: SvSkeletonLoaderLabels = {
  loading: 'Loading content…',
  slow: 'This is taking longer than usual…',
  stalled: 'This content could not be loaded.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    skeletonLoader: SvSkeletonLoaderLabels;
  }
}
