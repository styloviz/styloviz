export type InsightVariant =
  | 'feed'
  | 'grid'
  | 'inline'
  | 'panel'
  /**
   * The baseline behind the claim. The other four present insights something
   * else decided were insights; this one shows how far from normal the number
   * is, and whether "normal" was measured over enough history to mean anything.
   */
  | 'anomaly';
export type InsightPriority = 'critical' | 'high' | 'medium' | 'low';
export type InsightCategory =
  | 'revenue' | 'churn' | 'performance'
  | 'security' | 'engagement' | 'budget' | 'anomaly';
export type InsightStatus   = 'new' | 'accepted' | 'dismissed';

export interface InsightDataPoint {
  readonly label: string;
  readonly value: string;
  readonly trend?: 'up' | 'down' | 'neutral';
}

export interface AiInsight {
  readonly id:          string;
  readonly title:       string;
  readonly description: string;
  readonly category:    InsightCategory;
  readonly priority:    InsightPriority;
  readonly confidence:  number;   // 0–100
  readonly detectedAt:  Date;
  readonly source:      string;
  readonly dataPoints:  readonly InsightDataPoint[];
  status: InsightStatus;

  /**
   * Where a reader can go and check this claim.
   *
   * ★★★ OPTIONAL IN THE TYPE AND VISIBLE IN THE CARD, WHICH IS THE STRONGER OF
   * THE TWO. A required field is satisfied by `''`, turns every existing host
   * into a compile error, and buys nothing the reader can see. An insight with
   * no evidence renders as what it is — an assertion — and that cannot be
   * satisfied by typing quotes.
   */
  readonly evidenceUrl?: string;

  /** What produced the confidence figure — "logistic model", "z-score vs 30d". */
  readonly confidenceBasis?: string;

  /** The model or rule set that produced this insight. */
  readonly model?: string;

  /** Its version, when the name alone does not pin it. */
  readonly modelVersion?: string;

  /**
   * True for the kit's own sample data.
   *
   * ★★★ THE LABEL TRAVELS WITH THE DATA, NOT WITH THE COMPONENT'S MODE.
   * `DEMO_INSIGHTS` is one copy-paste from a host's fixture and one deploy from
   * a board somebody trusts, and marking the *mode* would not survive that copy.
   */
  readonly sample?: boolean;
}

/**
 * The series behind one insight, for the `anomaly` variant.
 *
 * ★★ THE HISTORY IS THE EVIDENCE. A card claiming "checkout errors are up" with
 * 87 % confidence has shown the reader a number whose provenance is not on the
 * page; this is the provenance.
 */
export interface SvInsightBaseline {
  /** Links to an `AiInsight.id`, when there is a card for this metric. */
  readonly insightId?: string;
  readonly metric: string;
  /** Recent observations, oldest first. */
  readonly series: readonly number[];
  /** The reading being judged. */
  readonly current: number;
  readonly unit?: string;
}
