/**
 * The accessible names and visible text `sv-ai-insight-cards` renders, in English. Override any of
 * them with `provideSvLabels({ aiInsightCards: { … } })` from `@styloviz/core`.
 */
export interface SvAiInsightCardsLabels {
  readonly dismissInsight: string;
  readonly dismiss: string;
  readonly previousInsight: string;
  readonly nextInsight: string;
  /** The confidence ring. `{percent}` is a number, formatted in the kit's locale. */
  readonly aiConfidence: string;
  /** The loading skeleton's name. */
  readonly loading: string;
  /** Feed variant: the toolbar badge. */
  readonly feedBadge: string;
  readonly activeCount: string;
  readonly refresh: string;
  /** Empty states. */
  readonly emptyTitle: string;
  readonly emptyMessage: string;
  readonly noMatchTitle: string;
  readonly noMatchMessage: string;
  /** Tooltip on the feed's confidence ring. */
  readonly confidenceScoreTitle: string;
  readonly accept: string;
  /** Grid variant heading. */
  readonly gridTitle: string;
  readonly newCount: string;
  /** Inline variant badge. */
  readonly aiSuggested: string;
  readonly detectedVia: string;
  readonly allResolved: string;
  readonly refreshArrow: string;
  /** Panel variant: which insight is showing. */
  readonly position: string;
  /** Panel variant badge. */
  readonly aiGenerated: string;
  /** Panel variant: the word under the confidence figure. */
  readonly confidence: string;
  readonly supportingEvidence: string;
  readonly otherInsights: string;
  readonly acceptAndAct: string;
  readonly remaining: string;
  readonly caughtUp: string;
  readonly loadNew: string;
  /** Anomaly variant. */
  readonly anomalyTitle: string;
  readonly anomalySubtitle: string;
  readonly offBaseline: string;
  readonly anomalyEmptyTitle: string;
  /** Empty hint, split around the `baselines` code token: "Bind `baselines` with each metric's recent history." */
  readonly anomalyEmptyBefore: string;
  /** Second half of the empty-hint split (see `anomalyEmptyBefore`). */
  readonly anomalyEmptyAfter: string;
  /** A row's baseline — the numbers arrive unformatted. */
  readonly baselineLine: string;
  /** The severity badge when nothing is off. */
  readonly severityNormal: string;
  readonly shortHistory: string;
  readonly maskedNote: string;
  /** `svInsightEvidence`: no evidence link. */
  readonly evidenceNone: string;
  readonly evidenceInvalid: string;
  /** `{protocol}` e.g. "ftp:". */
  readonly evidenceScheme: string;
  readonly evidenceCheck: string;
  /** `svInsightConfidenceLabel`. `{percent}` arrives unformatted. */
  readonly confidenceBasisModel: string;
  readonly confidenceBasisOnly: string;
  readonly confidenceModelOnly: string;
  readonly confidenceUnattributed: string;
  /** `svSampleLabel`: every insight is sample data. */
  readonly sampleAll: string;
  /** `svSampleLabel`: some are. Counts arrive unformatted. */
  readonly sampleSome: string;
  /** Category names. */
  readonly categoryRevenue: string;
  readonly categoryChurn: string;
  readonly categoryPerformance: string;
  readonly categorySecurity: string;
  readonly categoryEngagement: string;
  readonly categoryBudget: string;
  readonly categoryAnomaly: string;
  /** The "All" filter chip. */
  readonly filterAll: string;
  /** Priority names. */
  readonly priorityCritical: string;
  readonly priorityHigh: string;
  readonly priorityMedium: string;
  readonly priorityLow: string;
  /** Relative detection time. `{count}` in the `*Ago` ones. */
  readonly timeJustNow: string;
  readonly timeMinutesAgo: string;
  readonly timeHoursAgo: string;
  readonly timeDaysAgo: string;
  /**
   * The anomaly finding (`svAnomalyLabel`). `{count}` drives the plural and `{n}` is
   * the number shown; `{min}` the history floor; `{median}`, `{spread}` and
   * `{sigma}` are pre-formatted.
   */
  readonly anomalyShortHistory: string;
  readonly anomalyOrdinary: string;
  readonly anomalyAbove: string;
  readonly anomalyBelow: string;
  /** An anomaly row's spoken name — `{metric}`, `{current}` with its `{unit}`, then the `{finding}` sentence. */
  readonly anomalyRowName: string;
}

export const SV_AI_INSIGHT_CARDS_LABELS: SvAiInsightCardsLabels = {
  dismissInsight: 'Dismiss insight',
  dismiss: 'Dismiss',
  previousInsight: 'Previous insight',
  nextInsight: 'Next insight',
  aiConfidence: 'AI confidence: {percent}%',
  loading: 'Loading',
  feedBadge: 'AI Insights',
  activeCount: '{count} active',
  refresh: 'Refresh',
  emptyTitle: 'No insights yet',
  emptyMessage: 'Insights appear here as they are detected.',
  noMatchTitle: 'All caught up',
  noMatchMessage: 'No insights match the current filter.',
  confidenceScoreTitle: 'AI confidence score',
  accept: 'Accept',
  gridTitle: 'AI-Generated Insights',
  newCount: '{count} new',
  aiSuggested: 'AI Suggested',
  detectedVia: '{time} via {source}',
  allResolved: 'All insights resolved',
  refreshArrow: 'Refresh →',
  position: '{index} of {total}',
  aiGenerated: 'AI Generated',
  confidence: 'confidence',
  supportingEvidence: 'Supporting evidence',
  otherInsights: 'Other insights',
  acceptAndAct: 'Accept & Act',
  remaining: '{count, plural, one {# insight remaining} other {# insights remaining}}',
  caughtUp: 'You\'re fully caught up',
  loadNew: 'Load new insights',
  anomalyTitle: 'Against baseline',
  anomalySubtitle: 'How far from normal, and whether normal is known.',
  offBaseline: '{count} off baseline',
  anomalyEmptyTitle: 'No baselines to judge against',
  anomalyEmptyBefore: 'Bind',
  anomalyEmptyAfter: 'with each metric\'s recent history.',
  baselineLine: 'now {current}{unit} · typically {median}{unit} over {samples} obs',
  severityNormal: 'normal',
  shortHistory: 'Only {samples} observations — under {minSamples} there is no baseline to judge this against, so no severity is claimed.',
  maskedNote: '{count} of these would score under {notable}σ on a mean-and-standard-deviation detector — the readings that make up the incident have already been absorbed into what such a detector calls normal.',
  evidenceNone: 'No evidence linked — this is an assertion, not a finding.',
  evidenceInvalid: 'The evidence link is not a usable address.',
  evidenceScheme: 'The evidence link uses "{protocol}", which is not opened from here.',
  evidenceCheck: 'Check the evidence',
  confidenceBasisModel: '{percent}% — {basis}, from {model}',
  confidenceBasisOnly: '{percent}% — {basis}',
  confidenceModelOnly: '{percent}% — from {model}, method not recorded',
  confidenceUnattributed: '{percent}% — no method or model recorded',
  sampleAll: 'Every insight here is sample data shipped with the component. None of it is about your system.',
  sampleSome: '{count} of these {total} insights are sample data shipped with the component.',
  categoryRevenue: 'Revenue',
  categoryChurn: 'Churn Risk',
  categoryPerformance: 'Performance',
  categorySecurity: 'Security',
  categoryEngagement: 'Engagement',
  categoryBudget: 'Budget',
  categoryAnomaly: 'Anomaly',
  filterAll: 'All',
  priorityCritical: 'Critical',
  priorityHigh: 'High',
  priorityMedium: 'Medium',
  priorityLow: 'Low',
  timeJustNow: 'just now',
  timeMinutesAgo: '{count}m ago',
  timeHoursAgo: '{count}h ago',
  timeDaysAgo: '{count}d ago',
  anomalyShortHistory:
    '{count, plural, one {Only {n} observation of history} other {Only {n} observations of history}} — under {min} there is no baseline to judge this against, so no severity is claimed.',
  anomalyOrdinary:
    'Within the ordinary swing of this metric (typically {median}, ±{spread} over {count, plural, one {{n} observation} other {{n} observations}}).',
  anomalyAbove: '{sigma} above a typical {median}, measured over {count, plural, one {{n} observation} other {{n} observations}}.',
  anomalyBelow: '{sigma} below a typical {median}, measured over {count, plural, one {{n} observation} other {{n} observations}}.',
  anomalyRowName: '{metric}. Now {current}{unit}. {finding}',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    aiInsightCards: SvAiInsightCardsLabels;
  }
}
