import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { SvErrorShellComponent, type SvDataError } from '@styloviz/core/data';
import { injectSvLabels, svFormatLabel, svLocale, svFormatCompact } from '@styloviz/core/i18n';
import { SvIconComponent } from '@styloviz/icons/core';
import { SvSparklineComponent } from '@styloviz/sparkline';
import { SV_STAT_CARD_LABELS } from './stat-card.labels';

import { registerStatCardIcons } from './stat-card.component.icons';
// ─── Types ────────────────────────────────────────────────────────────────────

export type StatCardTrend   = 'up' | 'down' | 'neutral';
/**
 * Which direction of `trend` is GOOD news — and so which one is painted green.
 * `'up-is-good'` (revenue, sign-ups), `'down-is-good'` (churn, cost, latency,
 * error rate) or `'neutral'` (a change that is neither: headcount, volume).
 * The arrow and the words follow `trend` regardless; only the colour moves.
 */
export type StatCardTrendPolarity = 'up-is-good' | 'down-is-good' | 'neutral';

export type StatCardLayout  = 'default' | 'compact' | 'horizontal' | 'minimal';

/** A single point in the inline sparkline (value 0–100 scale, or raw). */
export interface SparkPoint {
  value: number;
  label?: string;
}

/**
 * All data needed to render a StatCard.
 * Pass these individually as inputs or compose them into a stats object.
 */
export interface StatCardData {
  title:        string;
  value:        string | number;
  previousValue?: string | number;
  prefix?:      string;
  suffix?:      string;
  trend?:       StatCardTrend;
  trendValue?:  number;        // absolute delta (e.g. 1234)
  trendPercent?: number;       // % change (e.g. 12.4)
  trendLabel?:  string;        // e.g. "vs last month"
  /** Name of an icon in `@styloviz/icons` (was a raw SVG path + viewBox). */
  icon?:        string;
  sparkline?:   SparkPoint[];
  loading?:     boolean;
  description?: string;
  linkLabel?:   string;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * StatCard — A metric summary card for dashboards.
 *
 * Features:
 * - 4 layout modes: default · compact · horizontal · minimal
 * - Neutral colour treatment (the six semantic colour variants are Pro: `sv-stat-card-pro [variant]`)
 * - Trend indicator (up / down / neutral) with % and absolute delta
 * - Inline SVG sparkline chart (no external lib)
 * - Skeleton loading state
 * - Accessible markup (aria-label, role="status")
 * - Click-through CTA link slot
 */
@Component({
  selector: 'sv-stat-card',
  standalone: true,
  imports: [SvSparklineComponent, NgClass, NgTemplateOutlet, DecimalPipe, SvIconComponent, SvErrorShellComponent],
  templateUrl: './stat-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvStatCardComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerStatCardIcons();

  /** The English this card builds in TypeScript; override with `provideSvLabels({ statCard: … })`. */
  protected readonly labels = injectSvLabels('statCard', SV_STAT_CARD_LABELS);

  // ── Core content ─────────────────────────────────────────────────────────

  /** Card title / metric label. */
  title       = input<string>('');

  /** Primary metric value — string or number, displayed as-is or formatted. */
  value       = input<string | number>('');

  /** Optional prefix rendered before the value (e.g. "$", "€"). */
  prefix      = input<string>('');

  /** Optional suffix rendered after the value (e.g. "K", "%", "ms"). */
  suffix      = input<string>('');

  /** Short helper text beneath the title (e.g. "Last 30 days"). */
  description = input<string>('');

  // ── Trend ─────────────────────────────────────────────────────────────────

  /** Direction of change. @default 'neutral' */
  trend        = input<StatCardTrend>('neutral');

  /** Absolute delta value shown alongside the trend icon. */
  trendValue   = input<number | null>(null);

  /** Percentage change shown in the trend chip. */
  trendPercent = input<number | null>(null);

  /** Comparison context label (e.g. "vs last month"). @default '' */
  trendLabel   = input<string>('');

  /**
   * Which direction is good news — see {@link StatCardTrendPolarity}.
   * `'up-is-good'` paints a rise green and a fall red; `'down-is-good'` swaps
   * them, for a churn or cost KPI; `'neutral'` paints any change grey.
   * @default 'up-is-good'
   */
  trendPolarity = input<StatCardTrendPolarity>('up-is-good');

  /**
   * `[min, max]` for the inline sparkline, shared across a KPI row. Unset, each
   * card scales its line to itself, and two cards rising 2% and 900% draw the
   * same shape side by side. Compute one range with `svSharedDomain()` from
   * `@styloviz/sparkline` over every card's series and bind it to all of them.
   * An sr-only note says which kind of scale the line is on.
   * @default null
   */
  sparklineDomain = input<readonly [number, number] | null>(null);

  /**
   * When this figure was last refreshed, as `YYYY-MM-DD` or an ISO timestamp.
   *
   * Renders an "Updated … ago" line under the figure, marked stale past
   * `staleAfterMinutes`, because a cached KPI looks identical to a live one.
   * @default ''
   */
  updatedAt = input<string>('');

  /** How many minutes before the figure is called out as possibly stale. @default 60 */
  staleAfterMinutes = input<number>(60);

  /** Where the figure came from — a warehouse, a job, a service. @default '' */
  source = input<string>('');

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Card layout mode. @default 'default' */
  layout  = input<StatCardLayout>('default');

  /**
   * Name of an icon in `@styloviz/icons`, e.g. `'trending-up'`.
   *
   * A library glyph is always drawn on a 24-unit box, so there is no viewBox
   * to pass.
   */
  icon        = input<string>('');

  // ── Sparkline ─────────────────────────────────────────────────────────────

  /**
   * Array of data points for the inline sparkline.
   * Values should be on a consistent numeric scale; the component
   * normalises them internally. Empty array hides the sparkline.
   */
  sparkline = input<SparkPoint[]>([]);

  // ── State ─────────────────────────────────────────────────────────────────

  /** Show skeleton loading shimmer instead of content. @default false */
  loading = input<boolean>(false);

  /**
   * The figure could not be loaded. Rendered in place of the metric, because a
   * card that keeps showing a stale number after a failed refresh is worse than
   * one that admits it: the reader has no way to tell the two apart.
   *
   * Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`.
   * @default null
   */
  error = input<SvDataError | string | null>(null);

  // ── Interaction ───────────────────────────────────────────────────────────

  /** Label for the bottom "view more" link. Empty string hides the link. */
  linkLabel = input<string>('');

  /** Additional CSS classes merged on the root card element. */
  customClass = input<string>('');

  /** BCP 47 locale for dates and numbers. @default the kit's locale (`SV_LOCALE`) */
  readonly locale = input<string>(svLocale());

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted when the "view more" link is clicked. */
  linkClick  = output<void>();

  /** The host should re-run the failed load. */
  retry      = output<void>();

  // ── Computed ──────────────────────────────────────────────────────────────

  /**
   * How old the figure is, in whole minutes, or `null` when it does not say.
   *
   * ★ A bare `YYYY-MM-DD` is read as a LOCAL calendar day. `new Date()` on that
   *   form is UTC midnight, which is the previous day west of Greenwich —
   *   enough to report this morning's refresh as a day old.
   */
  readonly ageInMinutes = computed<number | null>(() => {
    const raw = this.updatedAt().trim();
    if (!raw) return null;
    const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    const when = dayOnly
      ? new Date(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3]))
      : new Date(raw);
    if (Number.isNaN(when.getTime())) return null;
    const ms = Date.now() - when.getTime();
    return ms < 0 ? 0 : Math.floor(ms / 60_000);
  });

  /** True when the figure is old enough that it should not be read as current. */
  readonly isStale = computed(() => {
    const age = this.ageInMinutes();
    const limit = this.staleAfterMinutes();
    return age !== null && Number.isFinite(limit) && limit > 0 && age > limit;
  });

  /** The freshness line, in words. */
  readonly freshnessLabel = computed<string>(() => {
    const age = this.ageInMinutes();
    if (age === null) return '';
    const l = this.labels;
    const locale = this.locale();
    // Counts go in as strings so the English line stays "1234d ago", ungrouped.
    const when =
      age < 1 ? l.ageJustNow
      : age < 60 ? svFormatLabel(l.ageMinutes, { count: String(age) }, locale)
      : age < 1440 ? svFormatLabel(l.ageHours, { count: String(Math.floor(age / 60)) }, locale)
      : svFormatLabel(l.ageDays, { count: String(Math.floor(age / 1440)) }, locale);
    const freshness = svFormatLabel(this.isStale() ? l.updatedStale : l.updated, { when }, locale);
    const source = this.source();
    return source ? svFormatLabel(l.updatedWithSource, { freshness, source }, locale) : freshness;
  });

  /** True when a trend figure is shown with nothing to compare it against. */
  readonly trendPeriodMissing = computed(
    () => (this.trendPercent() !== null || this.trendValue() !== null) && !this.trendLabel(),
  );

  /**
   * The trend, as a screen reader should hear it.
   *
   * ★★★ "+12%" AGAINST LAST WEEK, LAST MONTH AND LAST YEAR ARE THREE DIFFERENT
   *     CLAIMS. A sighted reader sees the figure in the context of the dashboard
   *     around it; a screen-reader user gets the number alone.
   */
  readonly trendAriaLabel = computed<string>(() => {
    const pct = this.trendPercent();
    const val = this.trendValue();
    if (pct === null && val === null) return '';
    const figure = pct !== null ? `${pct}%` : String(val);
    const l = this.labels;
    const template = this.trend() === 'up' ? l.trendUp : this.trend() === 'down' ? l.trendDown : l.trendChange;
    const period = this.trendLabel() || l.trendPeriodMissing;
    return svFormatLabel(template, { figure, period }, this.locale());
  });

  /** The metric itself is only shown once there is one: not loading, not failed. */
  showBody     = computed(() => !this.loading() && !this.error());

  hasIcon      = computed(() => !!this.icon());
  hasSparkline = computed(() => this.sparkline().length >= 2);
  hasLink      = computed(() => !!this.linkLabel());
  hasTrend     = computed(() =>
    this.trend() !== 'neutral' || this.trendPercent() !== null || this.trendValue() !== null
  );

  /** Formatted value — passes numbers through DecimalPipe logic, strings untouched. */
  displayValue = computed<string>(() => {
    const v = this.value();
    // ★ One rule for free, Pro and Spotlight (FL-J3-DD-23): `svFormatCompact`
    //   abbreviates from 1,000 up on the MAGNITUDE (so -2,500,000 reads
    //   "-2.5M", as +2,500,000 does), in the locale's own compact notation
    //   ("2,5 Mio.", "1.2万") instead of an English "K"/"M" glued on.
    return typeof v === 'number' ? svFormatCompact(v, this.locale()) : v;
  });

  /** Formatted trend percent string, e.g. "12.4%". */
  displayTrendPercent = computed<string>(() => {
    const p = this.trendPercent();
    if (p === null) return '';
    return `${Math.abs(p).toFixed(1)}%`;
  });

  // ── Color maps ────────────────────────────────────────────────────────────

  /** Icon wrapper background + text. */
  iconClasses = computed<string>(() => {
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  });

  /** Border color for the card — subtle gray, no colored accent. */
  accentClass = computed<string>(() => {
    return 'border-gray-200/80 dark:border-gray-800';
  });

  /** `'good' | 'bad' | 'neutral'` — the trend read through `trendPolarity`. */
  readonly trendTone = computed<'good' | 'bad' | 'neutral'>(() => {
    const t = this.trend();
    const polarity = this.trendPolarity();
    if (t === 'neutral' || polarity === 'neutral') return 'neutral';
    return (t === 'up') === (polarity === 'up-is-good') ? 'good' : 'bad';
  });

  /** The sr-only comparability note beside the inline sparkline. */
  readonly sparklineNote = computed<string>(() => {
    const domain = this.sparklineDomain();
    return domain
      ? svFormatLabel(this.labels.sparklineSharedScale, { low: svFormatCompact(domain[0], this.locale()), high: svFormatCompact(domain[1], this.locale()) }, this.locale())
      : this.labels.sparklineOwnScale;
  });

  /** Trend chip color classes. */
  trendClasses = computed<string>(() => {
    switch (this.trendTone()) {
      case 'good': return 'bg-accent-50 text-accent-700 ring-1 ring-accent-100 dark:bg-accent-950/50 dark:text-accent-400 dark:ring-accent-900/50';
      case 'bad':  return 'bg-danger-50 text-danger-700 ring-1 ring-danger-100 dark:bg-danger-950/50 dark:text-danger-400 dark:ring-danger-900/50';
      default:      return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700';
    }
  });

  /** Left accent bar + background tint for the minimal layout. */
  minimalAccentClass = computed<{ bar: string; bg: string }>(() => {
    return { bar: 'bg-gray-400 dark:bg-gray-500', bg: '' };
  });

  /** Plain trend text color used by the minimal layout (no pill). */
  minimalTrendColor = computed<string>(() => {
    switch (this.trendTone()) {
      case 'good': return 'text-accent-700 dark:text-accent-400';
      case 'bad':  return 'text-danger-600 dark:text-danger-400';
      default:     return 'text-gray-500 dark:text-gray-400';
    }
  });
}
