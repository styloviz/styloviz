/**
 * The text `@styloviz/core`'s own shells render, in English — the loading,
 * error and empty states every data component shares, and the live-feed badge.
 * Override any of them with `provideSvLabels({ core: { … } })`.
 */
export interface SvCoreLabels {
  readonly loading: string;
  readonly loadingChart: string;
  readonly errorTitle: string;
  readonly retry: string;
  readonly chartEmpty: string;
  readonly chartErrorTitle: string;
  /** `sv-chart-frame` — the chart a11y module's button that shows the plot as a table. */
  readonly chartShowDataTable: string;
  /** …and hides it again. */
  readonly chartHideDataTable: string;
  readonly connectionLive: string;
  readonly connectionReconnecting: string;
  readonly connectionClosed: string;
  readonly reconnect: string;
  /** `toSvDataError`'s message when the failure carries none it can show. */
  readonly errorMessage: string;
  /** `sv-empty-shell` copy per `reason`, used when `title` / `message` / `actionLabel` are empty. */
  readonly emptyNoResultsTitle: string;
  readonly emptyNoAccessTitle: string;
  readonly emptyErrorTitle: string;
  readonly emptyNoDataTitle: string;
  readonly emptyNoResultsMessage: string;
  readonly emptyNoAccessMessage: string;
  readonly emptyErrorMessage: string;
  readonly emptyNoDataMessage: string;
  readonly emptyClearFilters: string;
  /** `svColorName` — orders the three words; an empty one collapses. */
  readonly colorName: string;
  readonly colorBlack: string;
  readonly colorWhite: string;
  readonly colorDarkGrey: string;
  readonly colorLightGrey: string;
  readonly colorGrey: string;
  readonly colorRed: string;
  readonly colorOrange: string;
  readonly colorYellow: string;
  readonly colorLime: string;
  readonly colorGreen: string;
  readonly colorTeal: string;
  readonly colorCyan: string;
  readonly colorBlue: string;
  readonly colorIndigo: string;
  readonly colorPurple: string;
  readonly colorMagenta: string;
  readonly colorVeryDark: string;
  readonly colorDark: string;
  readonly colorVeryPale: string;
  readonly colorPale: string;
  readonly colorMuted: string;
  readonly colorVivid: string;
  /** `svDiffLines` / `svDiffSummary` — `{parts}` are the count phrases joined with `diffListSeparator`. */
  readonly diffNoChanges: string;
  readonly diffTooDifferent: string;
  readonly diffChanges: string;
  readonly diffLinesAdded: string;
  readonly diffLinesRemoved: string;
  readonly diffSummary: string;
  /** Joins the count phrases of `svDiffSummary` and `svValueDiffSummary`. */
  readonly diffListSeparator: string;
  /**
   * `sv-scale-notice` / `svScaleLabel` — a list window that dropped rows. `{noun}` / `{nouns}` are the
   * row's singular and plural, owned by the calling package; `{hidden}`, `{total}` and `{ceiling}` are formatted counts.
   * `older` when the window kept the newest rows (a feed), `further` when it kept the first (a list).
   */
  readonly scaleHiddenOlder: string;
  /** `sv-scale-notice`'s default row noun, singular and plural. */
  readonly scaleNounRow: string;
  readonly scaleNounRows: string;
  readonly scaleHiddenFurther: string;
  /** `svValueDiffSummary`. */
  readonly valueDiffChanged: string;
  readonly valueDiffAdded: string;
  readonly valueDiffRemoved: string;
  readonly valueDiffSummary: string;
  /** `svPauseNotice`. */
  readonly pauseNoticeSeconds: string;
  readonly pauseNoticeMinutes: string;
  /** `svRestoreState` / `svRestoreParams` — `detail` per refusal. */
  readonly restoreUnreadable: string;
  readonly restoreUnsigned: string;
  readonly restoreForeign: string;
  readonly restoreNoVersion: string;
  readonly restoreTooNew: string;
  readonly restoreBadShape: string;
  readonly restoreUnmigratable: string;
  readonly linkNoVersion: string;
  readonly linkBadVersion: string;
  readonly linkTooNew: string;
  /** `svGapNotice`. */
  readonly gapAllMissing: string;
  readonly gapStacked: string;
  readonly gapLine: string;
  /** `svGroupSmallShares` — the notice, and how it lists the folded names. */
  readonly smallSharesNotice: string;
  readonly smallSharesNames: string;
  readonly smallSharesNamesMore: string;
  /** The aggregate slice's name when `label` is not given. */
  readonly smallSharesOther: string;
  /** The aggregate's name when a surviving slice already carries `{label}`. */
  readonly smallSharesOtherTaken: string;
  /** `svShareSummaryRows` — the aggregate's row, and each folded slice's row under it. */
  readonly smallSharesCombinedRow: string;
  readonly smallSharesFoldedRow: string;
  /** `svApplyValuePolicy` — `{items}` is the count with the chart's noun ("3 slices"). */
  readonly valueMissing: string;
  readonly valueUnbounded: string;
  readonly valueNegativelyUnbounded: string;
  readonly valueForExample: string;
  readonly valueRendered: string;
  readonly valueRejected: string;
  readonly valueOmitted: string;
  readonly valueOmitShare: string;
  readonly valueClamped: string;
  /** `svResolveShares` — every plotted value is zero. */
  readonly valueAllZero: string;
  /** `svRestoreParams`: a link in a format no migration can read. `{from}`. */
  readonly linkUnmigratable: string;
  /** `svPasteListSummary`: entries accepted. `{count}` picks the plural, `{n}` is the number shown, `{noun}` / `{nouns}` the caller's noun, singular and plural. */
  readonly pasteListAdded: string;
  /** `svPasteListSummary`: entries past the limit. `{count}`, `{n}`. */
  readonly pasteListOverLimit: string;
  /** `svPasteListSummary`: entries already present. `{count}`, `{n}`. */
  readonly pasteListDuplicate: string;
  /** `svPasteListSummary`: entries matching more than one option. `{count}`, `{n}`. */
  readonly pasteListAmbiguous: string;
  /** `svPasteListSummary`: entries not recognised. `{count}`, `{n}`. */
  readonly pasteListInvalid: string;
  /** `svPasteListSummary`: between the parts. */
  readonly pasteListSeparator: string;
  /** `svPasteListSummary`: the whole sentence. `{parts}`. */
  readonly pasteListSentence: string;
  /** `svFormatExpectedWait` under a minute. `{count}` picks the plural, `{n}` is the number shown. */
  readonly expectedWaitSeconds: string;
  /** `svFormatExpectedWait` from a minute. `{count}`, `{n}`. */
  readonly expectedWaitMinutes: string;
  /** `svPasteSummary`: only elements were removed. `{elements}` picks the plural, `{e}` is the number shown. */
  readonly pasteCleanedElements: string;
  /** `svPasteSummary`: only attributes were removed. `{attributes}` picks the plural, `{a}` is the number shown. */
  readonly pasteCleanedAttributes: string;
  /** `svPasteSummary`: elements and attributes were removed. `{elements}`, `{e}`, `{attributes}`, `{a}`. */
  readonly pasteCleanedBoth: string;
  /** `createCreateFlow` — announced while an awaited create is in flight, when it lands, and when it fails. */
  readonly createPending: string;
  readonly createDone: string;
  readonly createFailed: string;
  /** `createSeriesEmphasis` (FL-J3-CH-03) — the interactive legend's accessible name. */
  readonly seriesLegend: string;
  /** `createSeriesEmphasis` — the legend's off-screen keyboard hint. */
  readonly seriesLegendHint: string;
  /** `createSeriesEmphasis` — announced when a series is shown again. `{series}` is its name. */
  readonly seriesShown: string;
  /** `createSeriesEmphasis` — announced when a series is hidden. */
  readonly seriesHidden: string;
  /** `createSeriesEmphasis` — announced when hiding is refused because it is the last series drawn. */
  readonly seriesLastVisible: string;
}

export const SV_CORE_LABELS: SvCoreLabels = {
  loading: 'Loading',
  loadingChart: 'Loading chart',
  errorTitle: 'Something went wrong',
  retry: 'Try again',
  chartEmpty: 'No data to plot',
  chartErrorTitle: 'Could not load this chart',
  chartShowDataTable: 'Show data table',
  chartHideDataTable: 'Hide data table',
  connectionLive: 'Live',
  connectionReconnecting: 'Reconnecting…',
  connectionClosed: 'Disconnected',
  reconnect: 'Reconnect',
  errorMessage: 'Something went wrong.',
  emptyNoResultsTitle: 'No matching results',
  emptyNoAccessTitle: 'You do not have access',
  emptyErrorTitle: 'Could not load this',
  emptyNoDataTitle: 'Nothing here yet',
  emptyNoResultsMessage: 'Try adjusting or clearing your filters.',
  emptyNoAccessMessage: 'Ask an administrator if you think this is wrong.',
  emptyErrorMessage: 'Something went wrong while loading. Try again.',
  emptyNoDataMessage: 'Items will appear here once there are some.',
  emptyClearFilters: 'Clear filters',
  colorName: '{lightness} {saturation} {hue}',
  colorBlack: 'black',
  colorWhite: 'white',
  colorDarkGrey: 'dark grey',
  colorLightGrey: 'light grey',
  colorGrey: 'grey',
  colorRed: 'red',
  colorOrange: 'orange',
  colorYellow: 'yellow',
  colorLime: 'lime',
  colorGreen: 'green',
  colorTeal: 'teal',
  colorCyan: 'cyan',
  colorBlue: 'blue',
  colorIndigo: 'indigo',
  colorPurple: 'purple',
  colorMagenta: 'magenta',
  colorVeryDark: 'very dark',
  colorDark: 'dark',
  colorVeryPale: 'very pale',
  colorPale: 'pale',
  colorMuted: 'muted',
  colorVivid: 'vivid',
  diffNoChanges: 'No changes.',
  diffTooDifferent: 'These two are too different to compare line by line — {removed} lines replaced by {added}.',
  diffChanges: '{count, plural, one {# change} other {# changes}}',
  diffLinesAdded: '{count, plural, one {# line added} other {# lines added}}',
  diffLinesRemoved: '{count, plural, one {# line removed} other {# lines removed}}',
  diffSummary: '{parts}.',
  diffListSeparator: ', ',
  scaleNounRow: 'row',
  scaleNounRows: 'rows',
  scaleHiddenOlder:
    '{count, plural, one {{hidden} older {noun} of {total} is} other {{hidden} older {nouns} of {total} are}} not shown — this view holds {ceiling} at a time. Filter, search or page to reach them.',
  scaleHiddenFurther:
    '{count, plural, one {{hidden} further {noun} of {total} is} other {{hidden} further {nouns} of {total} are}} not shown — this view holds {ceiling} at a time. Filter, search or page to reach them.',
  valueDiffChanged: '{count} changed',
  valueDiffAdded: '{count} added',
  valueDiffRemoved: '{count} removed',
  valueDiffSummary: '{count, plural, one {# field} other {# fields}}: {parts}.',
  pauseNoticeSeconds:
    'Updates stopped for {count, plural, one {# second} other {# seconds}} while this tab was in the background, so nothing was sampled over that stretch. The line resumes rather than filling it in.',
  pauseNoticeMinutes:
    'Updates stopped for {count, plural, one {# minute} other {# minutes}} while this tab was in the background, so nothing was sampled over that stretch. The line resumes rather than filling it in.',
  restoreUnreadable: 'The saved data is not readable.',
  restoreUnsigned: 'The saved data does not say what wrote it, so it cannot be trusted.',
  restoreForeign: 'That saved data belongs to {found}, not {expected}.',
  restoreNoVersion: 'The saved data has no usable version.',
  restoreTooNew: 'That view was saved by a newer version of this component (v{from}, this is v{version}), so it cannot be read here.',
  restoreBadShape: 'The saved data is not in the expected shape.',
  restoreUnmigratable: 'That view was saved in an older format (v{from}) that can no longer be read.',
  linkNoVersion: 'That link does not say which version of the filters it holds.',
  linkBadVersion: 'That link has no usable version.',
  linkTooNew: 'That link was made by a newer version of this page (v{from}, this is v{version}), so its filters cannot be applied.',
  gapAllMissing: 'No readings in this series can be plotted — all {total} are missing.',
  gapStacked:
    '{count, plural, one {# reading} other {# readings}} missing. A stacked chart positions every band by the running total, so a missing reading has to count as zero here; the totals above it are lower than the real ones by whatever was not reported.',
  gapLine:
    '{count, plural, one {# reading} other {# readings}} missing. The line breaks rather than joining across the gap, because drawing through it would invent a value nobody recorded.',
  smallSharesNotice:
    '{count} slices too small to read were combined into “{label}”, {share}% of the total: {names}. The summary table for screen readers lists each one\'s value separately.',
  smallSharesNames: '{list} and {last}',
  smallSharesNamesMore: '{list} and {count} more',
  smallSharesOther: 'Other',
  smallSharesOtherTaken: '{label} — small slices',
  smallSharesCombinedRow: '{label} ({count} combined)',
  smallSharesFoldedRow: '{label} (in {other})',
  valueMissing: 'a missing value',
  valueUnbounded: 'an unbounded value',
  valueNegativelyUnbounded: 'a negatively unbounded value',
  valueForExample: 'for example {value}',
  valueRendered: '{items} have no value and are drawn as missing.',
  valueRejected:
    'This chart cannot plot {items} in the data ({example}), and is set to reject rather than redraw the dataset without them.',
  valueOmitted: '{items} not shown: {reason}',
  valueOmitShare:
    'this chart plots a share of a total, and {value} cannot be part of one. Percentages below are of the remaining {items}.',
  valueClamped:
    '{items} shown at {clampTo} rather than {count, plural, one {its} other {their}} real value ({example}), which this chart cannot plot. Marked in the plot.',
  valueAllZero: 'Every one of the {items} is zero, so there is no share to plot.',
  linkUnmigratable: 'That link uses an older format (v{from}) that can no longer be read.',
  pasteListAdded: '{count, plural, one {{n} {noun} added} other {{n} {nouns} added}}',
  pasteListOverLimit: '{n} over the limit',
  pasteListDuplicate: '{n} already in the list',
  pasteListAmbiguous: '{n} matched more than one option',
  pasteListInvalid: '{n} not recognised',
  pasteListSeparator: ', ',
  pasteListSentence: '{parts}.',
  expectedWaitSeconds: 'about {count, plural, one {{n} second} other {{n} seconds}}',
  expectedWaitMinutes: 'about {count, plural, one {{n} minute} other {{n} minutes}}',
  pasteCleanedElements: 'Cleaned on paste: removed {elements, plural, one {{e} unsupported element} other {{e} unsupported elements}}.',
  pasteCleanedAttributes: 'Cleaned on paste: removed {attributes, plural, one {{a} attribute} other {{a} attributes}}.',
  pasteCleanedBoth: 'Cleaned on paste: removed {elements, plural, one {{e} unsupported element} other {{e} unsupported elements}} and {attributes, plural, one {{a} attribute} other {{a} attributes}}.',
  createPending: 'Creating “{label}”…',
  createDone: '“{label}” created',
  createFailed: 'Could not create “{label}”.',
  seriesLegend: 'Series',
  seriesLegendHint:
    'Arrow keys move between series; focusing one fades the others. Enter or Space shows or hides it.',
  seriesShown: '{series} shown',
  seriesHidden: '{series} hidden',
  seriesLastVisible: '{series} is the only series shown, so it stays visible.',
};

// Registered directly in `SvLabelRegistry` (labels.ts): core owns the registry,
// so it declares its own namespace there rather than augmenting itself.
