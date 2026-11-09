/**
 * The text `sv-stat-card` builds in TypeScript — the freshness line and the trend
 * chip's accessible name — in English. Override any of them with
 * `provideSvLabels({ statCard: { … } })` from `@styloviz/core`.
 */
export interface SvStatCardLabels {
  /** How old the figure is, under a minute. */
  readonly ageJustNow: string;
  /** How old the figure is, in minutes — `{count}`. */
  readonly ageMinutes: string;
  /** How old the figure is, in hours — `{count}`. */
  readonly ageHours: string;
  /** How old the figure is, in days — `{count}`. */
  readonly ageDays: string;
  /** The freshness line — `{when}` is one of the `age*` labels. */
  readonly updated: string;
  /** The freshness line for a figure older than `staleAfterMinutes`. */
  readonly updatedStale: string;
  /** The freshness line with its `source` — `{freshness}` is `updated` / `updatedStale`. */
  readonly updatedWithSource: string;
  /** The trend chip's name for an upward trend — `{figure}`, `{period}`. */
  readonly trendUp: string;
  /** The trend chip's name for a downward trend — `{figure}`, `{period}`. */
  readonly trendDown: string;
  /** The trend chip's name for a neutral trend — `{figure}`, `{period}`. */
  readonly trendChange: string;
  /** `{period}` when `trendLabel` is empty. */
  readonly trendPeriodMissing: string;
  /** An sr-only note beside an inline sparkline drawn on a shared `sparklineDomain` — `{low}`, `{high}`. */
  readonly sparklineSharedScale: string;
  /** An sr-only note beside an inline sparkline scaled to its own card. */
  readonly sparklineOwnScale: string;
}

export const SV_STAT_CARD_LABELS: SvStatCardLabels = {
  ageJustNow: 'just now',
  ageMinutes: '{count} min ago',
  ageHours: '{count}h ago',
  ageDays: '{count}d ago',
  updated: 'Updated {when}',
  updatedStale: 'Updated {when} — may be stale',
  updatedWithSource: '{freshness} · {source}',
  trendUp: 'Trend up {figure}, {period}',
  trendDown: 'Trend down {figure}, {period}',
  trendChange: 'Trend change of {figure}, {period}',
  trendPeriodMissing: 'comparison period not stated',
  sparklineSharedScale: 'Trend line on a scale shared with the other cards, {low} to {high}.',
  sparklineOwnScale: 'Trend line scaled to this card alone, so compare the figures, not the line heights.',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    statCard: SvStatCardLabels;
  }
}
