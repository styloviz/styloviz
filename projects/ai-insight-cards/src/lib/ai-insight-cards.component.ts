import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  svWarnOnce,
  svWarnSimulating,
  type SvDataError,
} from '@styloviz/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import {
  SV_ANOMALY_MIN_SAMPLES,
  SV_ANOMALY_NOTABLE,
  SV_ANOMALY_SEVERE,
  svAnomaly,
  svAnomalyLabel,
  svResolveAnomalyThresholds,
  svFormatSigma,
  svNaiveSigma,
  type SvAnomaly,
  type SvAnomalySeverity,
} from './ai-insight-cards.anomaly';
import type {
  AiInsight,
  InsightCategory,
  InsightPriority,
  InsightVariant,
  SvInsightBaseline,
} from './ai-insight-cards.types';
import {
  svInsightConfidenceLabel,
  svInsightEvidence,
  svInsightIsAttributed,
  svSampleCount,
  svSampleLabel,
  type SvInsightEvidence,
} from './ai-insight-cards.evidence';

// ─── Category icons ──────────────────────────────────────────────────────────

/**
 * Library icon name per category.
 *
 * These were seven hand-copied Heroicons `<path d="…">` strings piped into an
 * inline `<svg>` at three call sites. A name resolves through the icon library,
 * so `check:icons` catches a typo and the shapes stay in step with the kit.
 *
 * `revenue` and `performance` needed glyphs the FREE registry did not have, so
 * `banknote` and `bolt` were **moved** from `@styloviz-pro/icons` into it —
 * this is a free package, and `<sv-icon>` resolves the free registry only.
 */
const CATEGORY_ICONS: Record<InsightCategory, string> = {
  revenue:     'banknote',
  churn:       'log-out',
  performance: 'bolt',
  security:    'shield-check',
  engagement:  'heart',
  budget:      'credit-card',
  anomaly:     'alert-triangle',
};

// ─── Mock insights ────────────────────────────────────────────────────────────

/** Thirty days of a metric sitting around `centre`, with the usual small jitter. */
const quiet = (centre: number, days = 30): number[] =>
  Array.from({ length: days }, (_, i) => centre + ((i * 7) % 5) - 2);

/**
 * Sample baselines, for showcases and tests.
 *
 * ★★ EVERY ROW IS ONE OF THE FOUR CASES THE VARIANT EXISTS TO SEPARATE, because
 * a demo where every metric is quietly normal shows a column of grey badges:
 *
 *   - `Checkout errors` has FIVE bad readings already in the window, so a
 *     mean-and-sigma detector has absorbed the incident and scores today under
 *     3σ — the masking failure, live on the page.
 *   - `p95 latency` is a clean spike both detectors agree on.
 *   - `Signup conversion` is a genuine DROP, which is the case an unsigned
 *     z-score cannot tell from a spike.
 *   - `New endpoint 5xx` has four days of history: the arithmetic gives a huge
 *     number and no severity is claimed from it.
 */
export const DEMO_BASELINES: readonly SvInsightBaseline[] = [
  {
    insightId: 'ins-1',
    metric: 'Checkout errors',
    series: [...quiet(100, 25), 400, 400, 400, 400, 400],
    current: 380,
    unit: '/h',
  },
  { metric: 'p95 latency', series: quiet(210), current: 940, unit: 'ms' },
  { metric: 'Signup conversion', series: quiet(38), current: 12, unit: '%' },
  { metric: 'New endpoint 5xx', series: [2, 1, 3, 2], current: 190, unit: '/h' },
  { metric: 'Queue depth', series: quiet(60), current: 62 },
];

/**
 * Sample insights for the showcase.
 *
 * ★★★ EVERY ONE OF THEM CARRIES `sample: true`, and the card says so on screen.
 * A board rendering believable insights with no data wired is indistinguishable
 * from one rendering real ones, and this array is one copy-paste from a host's
 * fixture and one deploy from a board somebody trusts. The label travels with
 * the data because that is the path it actually takes.
 */
export const DEMO_INSIGHTS: readonly AiInsight[] = [
  {
    id: 'i1',
    title: 'Churn Risk: 12 Enterprise Accounts',
    description: 'Usage patterns indicate elevated churn probability. These accounts show a 40%+ drop in feature engagement over the past 14 days, correlating with historical pre-churn signals.',
    category: 'churn',
    priority: 'critical',
    confidence: 94,
    detectedAt: new Date(Date.now() - 8 * 60_000),
    source: 'Churn Predictor v3.2',
    dataPoints: [
      { label: 'At-risk ARR',        value: '$284K',  trend: 'down'    },
      { label: 'Engagement drop',    value: '−43%',   trend: 'down'    },
      { label: 'Days to renewal',    value: '18d',    trend: 'neutral' },
    ],
    status: 'new',
    sample: true,
  },
  {
    id: 'i2',
    title: 'Cross-Sell Opportunity: 234 Accounts',
    description: 'Growth tier users with high API usage and no add-ons have a 3.4× higher upgrade propensity score. Historical data shows this cohort converts at 28% when contacted within 7 days.',
    category: 'revenue',
    priority: 'high',
    confidence: 87,
    detectedAt: new Date(Date.now() - 34 * 60_000),
    source: 'Revenue Intelligence v2.0',
    dataPoints: [
      { label: 'Potential MRR',      value: '+$41K',  trend: 'up'      },
      { label: 'Avg propensity',     value: '3.4×',   trend: 'up'      },
      { label: 'Action window',      value: '7 days', trend: 'neutral' },
    ],
    status: 'new',
    sample: true,
  },
  {
    id: 'i3',
    title: 'API Latency Anomaly — EMEA',
    description: 'p95 response time in the EMEA region spiked to 680ms, 4.8× above the baseline of 142ms. The anomaly started at 09:14 UTC and correlates with a recent worker queue deployment.',
    category: 'performance',
    priority: 'high',
    confidence: 91,
    detectedAt: new Date(Date.now() - 52 * 60_000),
    source: 'Anomaly Detection v4.1',
    dataPoints: [
      { label: 'p95 latency',        value: '680ms',  trend: 'down'    },
      { label: 'Baseline',           value: '142ms',  trend: 'neutral' },
      { label: 'Affected requests',  value: '8.4%',   trend: 'down'    },
    ],
    status: 'new',
    sample: true,
  },
  {
    id: 'i4',
    title: 'Q3 Marketing Budget Overrun Forecast',
    description: 'Current Q3 marketing spend trajectory projects a $64K overrun (+18%) against the approved $360K budget. Paid social and content channels are the primary contributors.',
    category: 'budget',
    priority: 'medium',
    confidence: 78,
    detectedAt: new Date(Date.now() - 2 * 3_600_000),
    source: 'Budget Forecaster v1.4',
    dataPoints: [
      { label: 'Projected overrun',  value: '+$64K',  trend: 'down'    },
      { label: 'Spend to date',      value: '$298K',  trend: 'neutral' },
      { label: 'Days remaining',     value: '22d',    trend: 'neutral' },
    ],
    status: 'new',
    sample: true,
  },
  {
    id: 'i5',
    title: 'Export Feature: Hidden Growth Signal',
    description: 'New Pro users who discover the bulk-export feature within the first 7 days have a 3× higher 90-day retention rate. Only 12% of new Pro users currently find it without guidance.',
    category: 'engagement',
    priority: 'medium',
    confidence: 82,
    detectedAt: new Date(Date.now() - 5 * 3_600_000),
    source: 'Product Analytics v2.3',
    dataPoints: [
      { label: 'Retention lift',     value: '+3×',    trend: 'up'      },
      { label: 'Current discovery',  value: '12%',    trend: 'down'    },
      { label: 'Impact potential',   value: 'High',   trend: 'up'      },
    ],
    status: 'new',
    sample: true,
  },
  {
    id: 'i6',
    title: 'Unusual Admin Login Patterns',
    description: '3 admin accounts authenticated from new geographic regions outside their established baselines. All events occurred within a 40-minute window — possible credential compromise.',
    category: 'security',
    priority: 'low',
    confidence: 69,
    detectedAt: new Date(Date.now() - 8 * 3_600_000),
    source: 'Security Monitor v1.8',
    dataPoints: [
      { label: 'Affected accounts',  value: '3',      trend: 'neutral' },
      { label: 'New geos',           value: '4',      trend: 'down'    },
      { label: 'Time window',        value: '40 min', trend: 'neutral' },
    ],
    status: 'new',
    sample: true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * SvAiInsightCardsComponent
 *
 * Proactive AI-generated insight cards with priority levels, confidence scores,
 * one-click accept/dismiss, skeleton loading, and four visual variants.
 *
 * ---
 * ### Inputs
 * | Input   | Type           | Default | Description              |
 * |---------|----------------|---------|--------------------------|
 * | variant | InsightVariant | 'feed'  | Layout variant           |
 *
 * ### Variants
 * - `feed`   — Priority-ordered vertical feed with left border accents
 * - `grid`   — 3-column card grid with confidence ring gauges
 * - `inline` — Single featured insight card for embedding in dashboards
 * - `panel`  — Detailed panel with navigation and evidence breakdown
 *
 * ### Usage
 * ```html
 * <sv-ai-insight-cards variant="feed" />
 * <sv-ai-insight-cards variant="grid" />
 * <sv-ai-insight-cards variant="inline" />
 * <sv-ai-insight-cards variant="panel" />
 * ```
 */
@Component({
  selector: 'sv-ai-insight-cards',
  standalone: true,
  imports: [
    NgClass,
    NgTemplateOutlet,
    SvIconComponent,
    SvEmptyShellComponent,
    SvErrorShellComponent,
    SvSkeletonShellComponent,
  ],
  templateUrl: './ai-insight-cards.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvAiInsightCardsComponent implements OnDestroy {

  // ── Async state ─────────────────────────────────────────────────────────────

  /** True while the data is being fetched. @default false */
  readonly loading = input<boolean>(false);

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an
   * `HttpErrorResponse`.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  // ── Inputs ─────────────────────────────────────────────────────────────────

  /** Presentation: `'feed'`, `'grid'`, `'inline'`, `'panel'` or `'anomaly'`. @default 'feed' */
  readonly variant = input<InsightVariant>('feed');

  // ── State ──────────────────────────────────────────────────────────────────

  // ── Content ────────────────────────────────────────────────────────────────
  //
  // Defaults to `[]`: with nothing wired the card renders its empty state, never
  // believable sample insights (`AI-03-I2`). `DEMO_INSIGHTS` is exported for
  // showcases and every entry in it carries `sample: true`.

  /** The insights to show. Decisions are layered locally, never written back. */
  readonly insights = input<readonly AiInsight[]>([]);

  /**
   * The series behind each claim, for the `anomaly` variant.
   *
   * One entry per metric: its recent history and its current reading. The
   * deviation is computed here rather than taken from the host because the
   * arithmetic is where the mistakes are.
   * @default []
   */
  readonly baselines = input<readonly SvInsightBaseline[]>([]);

  /** A fetch is in flight. */
  readonly busy = input<boolean>(false);

  /**
   * Reload with the bundled sample when Refresh is pressed.
   *
   * **Off by default.** Refresh emits `refreshRequested` and waits for a new
   * `insights` — production behaviour must not depend on an integrator
   * remembering to turn a demo switch off. Set it explicitly to `true` in a
   * showcase, where a fabricated reload is the point.
   */
  readonly simulate = input<boolean>(false);

  // ── Evidence and provenance (AI-03) ───────────────────────────────────────

  /**
   * ★★★ A CARD RENDERING BELIEVABLE INSIGHTS WITH NO DATA WIRED IS
   *     INDISTINGUISHABLE FROM ONE RENDERING REAL ONES. The sample data carries
   *     its own label, so the warning survives a copy into a host's fixture —
   *     which is the path this array actually travels.
   */
  readonly sampleCount = computed(() => svSampleCount(this.insights()));

  readonly sampleLabel = computed(() =>
    svSampleLabel(this.sampleCount(), this.insights().length),
  );

  /** Where a reader can go and check one insight, and what to say when nowhere. */
  evidence(insight: AiInsight): SvInsightEvidence {
    return svInsightEvidence(insight);
  }

  /** The confidence figure with whatever produced it. */
  confidenceLabel(insight: AiInsight): string {
    return svInsightConfidenceLabel(insight);
  }

  /** True when the reader can tell what produced the number. */
  isAttributed(insight: AiInsight): boolean {
    return svInsightIsAttributed(insight);
  }

  /**
   * Accept / dismiss decisions made in this session.
   *
   * `insights` is an input, so a decision cannot be written back into it. The
   * status is layered over the incoming list and reported as an output for the
   * host to persist — the caller's array is never mutated.
   */
  private readonly decisions = signal<Readonly<Record<string, AiInsight['status']>>>({});
  readonly isLoading     = signal(false);
  readonly activeIndex   = signal(0);
  readonly priorityFilter = signal<InsightPriority | 'all'>('all');

  // ── Computed ───────────────────────────────────────────────────────────────

  /** Incoming insights with this session's decisions applied. */
  readonly resolvedInsights = computed<readonly AiInsight[]>(() => {
    const decided = this.decisions();
    return this.insights().map(i => (decided[i.id] ? { ...i, status: decided[i.id] } : i));
  });

  /** True while either the host or the built-in simulation is loading. */
  readonly isBusy = computed(() => this.busy() || this.isLoading());

  readonly visibleInsights = computed(() => {
    const f = this.priorityFilter();
    return this.resolvedInsights()
      .filter(i => i.status === 'new')
      .filter(i => f === 'all' || i.priority === f);
  });

  readonly activeInsight = computed(() => {
    const list = this.visibleInsights();
    const idx  = Math.min(this.activeIndex(), list.length - 1);
    return list[idx] ?? null;
  });

  readonly counts = computed(() => ({
    total:    this.visibleInsights().length,
    critical: this.visibleInsights().filter(i => i.priority === 'critical').length,
    high:     this.visibleInsights().filter(i => i.priority === 'high').length,
    medium:   this.visibleInsights().filter(i => i.priority === 'medium').length,
    low:      this.visibleInsights().filter(i => i.priority === 'low').length,
  }));

  readonly filterChips = computed((): { key: InsightPriority | 'all'; label: string; count: number }[] => {
    const c = this.counts();
    return [
      { key: 'all',      label: 'All',      count: c.total    },
      { key: 'critical', label: 'Critical', count: c.critical },
      { key: 'high',     label: 'High',     count: c.high     },
      { key: 'medium',   label: 'Medium',   count: c.medium   },
    ];
  });

  // ── Interactions ───────────────────────────────────────────────────────────

  /** Emitted with the id of an insight the user accepts. */
  readonly insightAccept = output<string>();
  /** Emitted with the id of an insight the user dismisses. */
  readonly insightDismiss = output<string>();
  /** Emitted when the user asks for fresh insights. */
  readonly refreshRequested = output<void>();

  accept(id: string): void {
    this.decisions.update(map => ({ ...map, [id]: 'accepted' as const }));
    this.clampIndex();
    this.insightAccept.emit(id);
  }

  dismiss(id: string): void {
    this.decisions.update(map => ({ ...map, [id]: 'dismissed' as const }));
    this.clampIndex();
    this.insightDismiss.emit(id);
  }

  setFilter(f: InsightPriority | 'all'): void {
    this.priorityFilter.set(f);
    this.activeIndex.set(0);
  }

  prevInsight(): void {
    this.activeIndex.update(i => Math.max(0, i - 1));
  }

  nextInsight(): void {
    this.activeIndex.update(i => Math.min(this.visibleInsights().length - 1, i + 1));
  }

  private _refreshTimer: ReturnType<typeof setTimeout> | null = null;

  refreshInsights(): void {
    this.refreshRequested.emit();

    // The host owns the data: report the intent and wait for new `insights`.
    if (!this.simulate()) return;

    svWarnSimulating('sv-ai-insight-cards');
    this.isLoading.set(true);
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      this._refreshTimer = null;
      // Clearing the decisions is what "refresh" means here — the sample list
      // itself never changes, so without this the cards would not come back.
      this.decisions.set({});
      this.activeIndex.set(0);
      this.isLoading.set(false);
    }, 1800);
  }

  ngOnDestroy(): void {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
  }

  // ── Style helpers ──────────────────────────────────────────────────────────

  /** Library icon name for a category (was `categoryIconPath`, a raw SVG path). */
  categoryIconName(c: InsightCategory): string {
    return CATEGORY_ICONS[c];
  }

  categoryLabel(c: InsightCategory): string {
    return ({ revenue: 'Revenue', churn: 'Churn Risk', performance: 'Performance',
              security: 'Security', engagement: 'Engagement', budget: 'Budget', anomaly: 'Anomaly' })[c];
  }

  priorityLabel(p: InsightPriority): string {
    return ({ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' })[p];
  }

  priorityBorderClass(p: InsightPriority): string {
    return ({ critical: 'border-l-danger-500', high: 'border-l-warning-500',
              medium: 'border-l-primary-500', low: 'border-l-gray-300 dark:border-l-gray-600' })[p];
  }

  priorityDotClass(p: InsightPriority): string {
    return ({ critical: 'bg-danger-500', high: 'bg-warning-500',
              medium: 'bg-primary-500', low: 'bg-gray-400 dark:bg-gray-500' })[p];
  }

  priorityBadgeClass(p: InsightPriority): string {
    return ({
      critical: 'bg-danger-50 text-danger-700 ring-danger-200/60 dark:bg-danger-900/30 dark:text-danger-300 dark:ring-danger-800/40',
      high:     'bg-warning-50 text-warning-700 ring-warning-200/60 dark:bg-warning-900/30 dark:text-warning-300 dark:ring-warning-800/40',
      medium:   'bg-primary-50 text-primary-700 ring-primary-200/60 dark:bg-primary-900/30 dark:text-primary-300 dark:ring-primary-800/40',
      low:      'bg-gray-100 text-gray-600 ring-gray-200/60 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700',
    })[p];
  }

  priorityAccentClass(p: InsightPriority): string {
    return ({
      critical: 'from-danger-500 to-danger-700',
      high:     'from-warning-500 to-orange-600',
      medium:   'from-primary-500 to-primary-700',
      low:      'from-gray-400 to-gray-600',
    })[p];
  }

  /**
   * ★ SEVEN INSIGHT CATEGORIES, SEVEN HUES — an identity palette, so it stays
   *   literal while every priority, confidence and trend colour in this file is
   *   tokenised. `churn` is rose and `security` red because a wall of cards has
   *   to be scannable by category before it is read; tokenised, a revenue
   *   insight would arrive in the buyer's success colour and a churn insight in
   *   their error colour, which is a verdict the category is not making. Three
   *   of the seven are already on orange/purple, which no family owns, and the
   *   header gradients pair each hue with a neighbour (teal, pink, yellow,
   *   violet) purely for depth. Recorded in `scripts/theme-literal.allow.json`.
   */
  categoryIconBg(c: InsightCategory): string {
    return ({ revenue: 'bg-emerald-50 dark:bg-emerald-900/30', churn: 'bg-rose-50 dark:bg-rose-900/30',
              performance: 'bg-amber-50 dark:bg-amber-900/30', security: 'bg-red-50 dark:bg-red-900/30',
              engagement: 'bg-sky-50 dark:bg-sky-900/30', budget: 'bg-orange-50 dark:bg-orange-900/30',
              anomaly: 'bg-purple-50 dark:bg-purple-900/30' })[c];
  }

  categoryIconColor(c: InsightCategory): string {
    return ({ revenue: 'text-emerald-600 dark:text-emerald-400', churn: 'text-rose-600 dark:text-rose-400',
              performance: 'text-amber-600 dark:text-amber-400', security: 'text-red-600 dark:text-red-400',
              engagement: 'text-sky-600 dark:text-sky-400', budget: 'text-orange-600 dark:text-orange-400',
              anomaly: 'text-purple-600 dark:text-purple-400' })[c];
  }

  categoryHeaderGradient(c: InsightCategory): string {
    return ({ revenue: 'from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40',
              churn: 'from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40',
              performance: 'from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40',
              security: 'from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40',
              engagement: 'from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/40',
              budget: 'from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40',
              anomaly: 'from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/40' })[c];
  }

  // The same three confidence bands as `confidenceTextClass` below, which have
  // been token-driven since Phase 3 — so the ring and the percentage beside it
  // were painted from two different systems and only agreed by hand.
  //
  // The step stays 500 rather than matching the text's 600: this is a stroke on a
  // ring, which needs the more saturated end, and 600 as ink needs the darker.
  confidenceRingStroke(n: number): string {
    if (n >= 80) return 'var(--color-accent-500)';
    if (n >= 65) return 'var(--color-warning-500)';
    return 'var(--color-danger-500)';
  }

  confidenceTextClass(n: number): string {
    if (n >= 80) return 'text-accent-700 dark:text-accent-400';
    if (n >= 65) return 'text-warning-700 dark:text-warning-400';
    return 'text-danger-600 dark:text-danger-400';
  }

  ringDash(pct: number): string {
    return `${pct.toFixed(1)} 100`;
  }

  trendClass(trend?: string): string {
    if (trend === 'up')   return 'text-accent-700 dark:text-accent-400';
    if (trend === 'down') return 'text-danger-600 dark:text-danger-400';
    return 'text-gray-600 dark:text-gray-400';
  }

  trendIcon(trend?: string): string {
    if (trend === 'up')   return 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941';
    if (trend === 'down') return 'M2.25 6L9 12.75l4.306-4.307a11.95 11.95 0 015.814 5.519l2.74 1.22m0 0l-5.94 2.28m5.94-2.28l-2.28-5.941';
    return 'M5 12h14';
  }

  /** Library icon name for a trend direction. */
  trendIconName(trend?: string): string {
    if (trend === 'up') return 'trending-up';
    if (trend === 'down') return 'trending-down';
    return 'minus';
  }

  relativeTime(d: Date): string {
    const diff  = Date.now() - d.getTime();
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    if (mins  <  1) return 'just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  // ── Card view-models ──────────────────────────────────────────────────────
  //
  // ★ DA-23. A card's classes, labels, ring and provenance are worked out here
  //   once per change of the insight list — up to twenty helper calls a card
  //   used to re-run on every check, three times over in the spotlight. The
  //   `#provenance` template takes a view too, so a row that stamps it out
  //   does not re-derive what its own card already holds.
  //
  //   `relativeTime` reads the clock, so "4m ago" is as of the last change to
  //   the list — as it was before: this card has no timer of its own.

  private insightView(insight: AiInsight) {
    const points = insight.dataPoints.map((dp) => ({
      dp,
      icon: this.trendIconName(dp.trend),
      ink: this.trendClass(dp.trend),
    }));
    return {
      insight,
      borderClass: this.priorityBorderClass(insight.priority),
      accentClass: this.priorityAccentClass(insight.priority),
      headerGradient: this.categoryHeaderGradient(insight.category),
      iconBg: this.categoryIconBg(insight.category),
      iconName: this.categoryIconName(insight.category),
      iconInk: this.categoryIconColor(insight.category),
      categoryText: this.categoryLabel(insight.category),
      badgeClass: this.priorityBadgeClass(insight.priority),
      dotClass: this.priorityDotClass(insight.priority),
      priorityText: this.priorityLabel(insight.priority),
      ringStroke: this.confidenceRingStroke(insight.confidence),
      ringDashArray: this.ringDash(insight.confidence),
      confidenceInk: this.confidenceTextClass(insight.confidence),
      confidenceText: this.confidenceLabel(insight),
      evidence: this.evidence(insight),
      relativeText: this.relativeTime(insight.detectedAt),
      points,
      topPoints: points.slice(0, 2),
    };
  }

  /** Every visible insight, as a card. */
  protected readonly insightCards = computed(() => this.visibleInsights().map((i) => this.insightView(i)));

  /** The spotlight's insight, as a card. */
  protected readonly activeView = computed(() => {
    const active = this.activeInsight();
    return active ? this.insightView(active) : null;
  });

  /** The anomaly list, with each row's sparkline, sigma and badge. */
  protected readonly anomalyRowVms = computed(() =>
    this.anomalyRows().map((row) => ({
      row,
      ariaLabel: this.anomalyAriaLabel(row),
      spark: this.anomalySpark(row.baseline.series),
      title: this.anomalyTitle(row.anomaly),
      sigmaText: this.fmtSigma(row.anomaly.sigma),
      severityClass: this.severityClass(row.anomaly.severity),
    })),
  );

  // ── Private ────────────────────────────────────────────────────────────────

  private clampIndex(): void {
    const len = this.visibleInsights().length;
    if (this.activeIndex() >= len) {
      this.activeIndex.set(Math.max(0, len - 1));
    }
  }

  // ── Anomaly ──────────────────────────────────────────────────────────────
  //
  // Arithmetic in `ai-insight-cards.anomaly.ts`, tested there.

  /**
   * Each baseline with its deviation worked out, worst first.
   *
   * ★★ Rows with too little history sink to the bottom whatever their sigma.
   * They are not milder findings — they are not findings — and a 40σ row off
   * four days of data at the top of the list is the most eye-catching thing on
   * the page and the least worth reading.
   */
  readonly anomalyRows = computed(() =>
    this.baselines()
      .map(b => ({
        baseline: b,
        anomaly: svAnomaly(b.series, b.current, this.anomalyThresholds()),
        naiveSigma: svNaiveSigma(b.series, b.current),
        insight: this.insights().find(i => i.id === b.insightId) ?? null,
      }))
      .sort((x, y) => {
        if (x.anomaly.sufficientHistory !== y.anomaly.sufficientHistory) {
          return x.anomaly.sufficientHistory ? -1 : 1;
        }
        return Math.abs(y.anomaly.sigma) - Math.abs(x.anomaly.sigma);
      }),
  );

  readonly anomalyFindings = computed(() =>
    this.anomalyRows().filter(r => r.anomaly.severity !== 'none'),
  );

  /**
   * Observations required before any severity is claimed (`X-3`, `AI-03-I4`).
   *
   * ★★★ THE DEFAULT IS A POLICY ABOUT SOMEBODY ELSE'S DOMAIN. Fourteen is
   *     right for a daily business metric and wrong almost everywhere else: a
   *     fortnight of hourly data is 336 observations, a fortnight of monthly
   *     data is not a baseline at all, and a seasonal series needs a season.
   *     The figure was well reasoned and still a guess, so it is a default and
   *     not a rule — and it is the number the card SHOWS when it refuses to
   *     judge, so moving it moves the explanation with it.
   *
   * @default 14 (`SV_ANOMALY_MIN_SAMPLES`, still exported)
   */
  readonly anomalyMinSamples = input<number>(SV_ANOMALY_MIN_SAMPLES);

  /**
   * Sigma at which a finding is worth a look. Also the line the anomaly
   * variant's "a mean-and-sigma detector would have missed this" note judges by
   * and quotes.
   * @default 3 (`SV_ANOMALY_NOTABLE`)
   */
  readonly anomalyNotable = input<number>(SV_ANOMALY_NOTABLE);

  /** Sigma at which it is worth waking somebody. @default 5 (`SV_ANOMALY_SEVERE`) */
  readonly anomalySevere = input<number>(SV_ANOMALY_SEVERE);

  /**
   * The three lines as the component will actually apply them.
   *
   * ★★ IT WARNS WHERE IT HAD TO CORRECT THE HOST. `svResolveAnomalyThresholds`
   *    refuses a scale that reads backwards — a `severe` below `notable` erases
   *    the middle band and reports everything past the notable line as severe —
   *    and a silent correction would leave a host wondering why its numbers do
   *    nothing. The resolver stays pure for callers who use it directly; the
   *    telling-off belongs to the surface that took the input.
   */
  protected readonly anomalyThresholds = computed(() => {
    const asked = {
      minSamples: this.anomalyMinSamples(),
      notable: this.anomalyNotable(),
      severe: this.anomalySevere(),
    };
    const resolved = svResolveAnomalyThresholds(asked);
    if (asked.severe !== resolved.severe && Number.isFinite(asked.severe) && asked.severe > 0) {
      svWarnOnce(
        'sv-ai-insight-cards/anomaly-scale',
        `sv-ai-insight-cards: [anomalySevere] (${asked.severe}σ) is below ` +
          `[anomalyNotable] (${asked.notable}σ), which would report every notable ` +
          `finding as severe. Using ${resolved.severe}σ for both.`,
      );
    }
    return resolved;
  });

  fmtSigma(sigma: number): string { return svFormatSigma(sigma); }
  anomalyTitle(a: SvAnomaly): string { return svAnomalyLabel(a); }

  severityClass(severity: SvAnomalySeverity): string {
    switch (severity) {
      case 'severe':  return 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400';
      case 'notable': return 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400';
      case 'none':    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  }

  /**
   * ★★★ THE NAIVE FIGURE IS SHOWN ONLY TO BE CONTRADICTED. Putting it beside
   * the robust one is the fastest way to make the point that a mean-and-sigma
   * detector is blinded by the very event it exists to catch — and a reader who
   * has seen the two numbers disagree on one real incident does not go back to
   * thresholds.
   *
   * ★★ THE NAIVE DETECTOR IS HELD TO THE HOST'S LINE (`X-3`). "Would have
   *    missed" means "would have scored under the notable line this card is
   *    using", so the comparison and the sentence quoting it both read
   *    `anomalyNotable` as resolved — never the module's 3.
   */
  readonly anomalyMasked = computed(() => {
    const line = this.anomalyThresholds().notable;
    return this.anomalyRows().filter(
      r =>
        r.anomaly.sufficientHistory &&
        r.anomaly.severity !== 'none' &&
        Math.abs(r.naiveSigma) < line,
    );
  });

  /** Sparkline points for a baseline series, as an SVG polyline. */
  anomalySpark(series: readonly number[], width = 96, height = 24): string {
    const clean = series.filter(n => Number.isFinite(n));
    if (clean.length < 2) return '';
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    const span = max - min || 1;
    return clean
      .map((n, i) => {
        const x = (i / (clean.length - 1)) * width;
        const y = height - ((n - min) / span) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  anomalyAriaLabel(row: { baseline: SvInsightBaseline; anomaly: SvAnomaly }): string {
    return `${row.baseline.metric}. Now ${row.baseline.current}${row.baseline.unit ?? ''}. ${svAnomalyLabel(row.anomaly)}`;
  }
}
