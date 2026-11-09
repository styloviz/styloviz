/**
 * The strings `sv-timeline` renders, in English. `{name}` is filled with
 * the list's own name. Override any of them with
 * `provideSvLabels({ timeline: { … } })` from `@styloviz/core`.
 */
export interface SvTimelineLabels {
  readonly scrollableList: string;
  /** The error state's heading. */
  readonly loadErrorTitle: string;
  /** The empty state's heading (the `emptyMessage` input's default). */
  readonly emptyMessage: string;
  /** The button that fetches events newer than the first one shown. */
  readonly loadNewer: string;
  /** The button that fetches events older than the last one shown. */
  readonly loadOlder: string;
  /** A step's state, read before its title — complete / current / pending. */
  readonly statusComplete: string;
  readonly statusActive: string;
  readonly statusPending: string;
  /** The list's default accessible name, per resolved intent. */
  readonly intentProcess: string;
  readonly intentFeed: string;
  readonly intentChronology: string;
  /** The expand control — `{count}` drives the plural, `{n}` is the count as shown. */
  readonly showMoreEntries: string;
  /** An item's `variant` in words, before its title, for assistive tech. */
  readonly variantSuccess: string;
  readonly variantError: string;
  readonly variantWarning: string;
  readonly variantInfo: string;
}

export const SV_TIMELINE_LABELS: SvTimelineLabels = {
  scrollableList: '{name}, scrollable',
  loadErrorTitle: 'Could not load these events',
  emptyMessage: 'No events to show',
  loadNewer: 'Load newer',
  loadOlder: 'Load older',
  statusComplete: 'Completed',
  statusActive: 'Current step',
  statusPending: 'Pending',
  intentProcess: 'Progress tracker',
  intentFeed: 'Activity feed',
  intentChronology: 'Timeline',
  showMoreEntries: '{count, plural, one {Show {n} more entry} other {Show {n} more entries}}',
  variantSuccess: 'Success',
  variantError: 'Error',
  variantWarning: 'Warning',
  variantInfo: 'Information',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    timeline: SvTimelineLabels;
  }
}
