import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { SvErrorShellComponent, type SvDataError } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';
import { SvSparklineComponent } from '@styloviz/sparkline';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * @deprecated The free card has one colour treatment, so this type has one
 * value and changes nothing. Kept so 1.x code compiles; removed in 2.0. The six
 * semantic colour variants are Pro: `sv-stat-card-pro [variant]`.
 */
export type StatCardVariant = 'default';
export type StatCardTrend   = 'up' | 'down' | 'neutral';
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
  /** @deprecated Has no effect on the free card; removed in 2.0. See {@link StatCardVariant}. */
  variant?:     StatCardVariant;
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
   * When this figure was last refreshed, as `YYYY-MM-DD` or an ISO timestamp.
   *
   * ★★★ A CACHED KPI LOOKS IDENTICAL TO A LIVE ONE. A number is a number, and
   *     nothing about a stale one announces itself — so the reader assumes the
   *     dashboard is current, which is exactly the assumption a broken pipeline
   *     exploits.
   *
   * ★ This is in the FREE tier deliberately. Telling a reader their figure may
   *   be out of date is an honesty feature, not a premium one, and a free card
   *   that hides staleness is the defect rather than a smaller version of it.
   * @default ''
   */
  updatedAt = input<string>('');

  /** How many minutes before the figure is called out as possibly stale. @default 60 */
  staleAfterMinutes = input<number>(60);

  /** Where the figure came from — a warehouse, a job, a service. @default '' */
  source = input<string>('');

  // ── Appearance ────────────────────────────────────────────────────────────

  /**
   * Deprecated, and has no effect: the free card has one colour treatment.
   *
   * @deprecated Kept so 1.x templates compile; removed in 2.0. For the six
   * semantic colour variants use `sv-stat-card-pro [variant]`.
   * @default 'default'
   */
  variant = input<StatCardVariant>('default');

  /** Card layout mode. @default 'default' */
  layout  = input<StatCardLayout>('default');

  /**
   * Name of an icon in `@styloviz/icons`, e.g. `'trending-up'`.
   *
   * This was `iconPath` — a raw `<path d="…">` — with a companion
   * `iconViewBox` because a pasted path might be 20-box or 24-box. Both are
   * gone: a library name is always 24-box, and the viewBox binding is what hid
   * these glyphs from `check:ui` in the first place (a bound `viewBox` does not
   * match a literal `viewBox="…"` test).
   */
  icon        = input<string>('');

  /** SVG viewBox for the icon. @default '0 0 24 24' */
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

  // ── Outputs ───────────────────────────────────────────────────────────────

  /**
   * Deprecated, and never emitted: the free card is not interactive.
   *
   * @deprecated Kept so 1.x templates compile; removed in 2.0. For a card that
   * activates on click, Enter or Space use `sv-stat-card-pro [clickable]`
   * with its `(cardClick)`.
   */
  cardClick  = output<void>();

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
    const when =
      age < 1 ? 'just now'
      : age < 60 ? `${age} min ago`
      : age < 1440 ? `${Math.floor(age / 60)}h ago`
      : `${Math.floor(age / 1440)}d ago`;
    const src = this.source() ? ` · ${this.source()}` : '';
    return this.isStale() ? `Updated ${when} — may be stale${src}` : `Updated ${when}${src}`;
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
    const direction =
      this.trend() === 'up' ? 'up' : this.trend() === 'down' ? 'down' : 'change of';
    const against = this.trendLabel() || 'comparison period not stated';
    return `Trend ${direction} ${figure}, ${against}`;
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
    if (typeof v === 'number') {
      if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
      if (v >= 1_000)     return (v / 1_000).toFixed(1)     + 'K';
      return v.toLocaleString();
    }
    return v;
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

  /** Trend chip color classes. */
  trendClasses = computed<string>(() => {
    switch (this.trend()) {
      case 'up':   return 'bg-accent-50 text-accent-700 ring-1 ring-accent-100 dark:bg-accent-950/50 dark:text-accent-400 dark:ring-accent-900/50';
      case 'down':  return 'bg-danger-50 text-danger-700 ring-1 ring-danger-100 dark:bg-danger-950/50 dark:text-danger-400 dark:ring-danger-900/50';
      default:      return 'bg-gray-100 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700';
    }
  });

  /** Left accent bar + background tint for the minimal layout. */
  minimalAccentClass = computed<{ bar: string; bg: string }>(() => {
    return { bar: 'bg-gray-400 dark:bg-gray-500', bg: '' };
  });

  /** Plain trend text color used by the minimal layout (no pill). */
  minimalTrendColor = computed<string>(() => {
    switch (this.trend()) {
      case 'up':   return 'text-accent-700 dark:text-accent-400';
      case 'down': return 'text-danger-600 dark:text-danger-400';
      default:     return 'text-gray-500 dark:text-gray-400';
    }
  });
}
