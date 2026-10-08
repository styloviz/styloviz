import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { SvDataError } from '@styloviz/core';
import {
  applyMissing,
  areaPathOf,
  barsOf,
  gapCount,
  linePathOf,
  pointsOf,
  statsOf,
  toSlots,
  type SparklineMissing,
} from './sparkline-geometry';
import type { SparklineDatum, SparklineTone, SparklineVariant } from './sparkline.types';

/** Tailwind text colour per tone — the SVG paints with `currentColor`. */
const TONE: Readonly<Record<Exclude<SparklineTone, 'auto'>, string>> = {
  primary: 'text-primary-500 dark:text-primary-400',
  positive: 'text-accent-500 dark:text-accent-400',
  warning: 'text-warning-500 dark:text-warning-400',
  negative: 'text-danger-500 dark:text-danger-400',
  neutral: 'text-gray-500 dark:text-gray-400',
};

/**
 * SvSparklineComponent — a chart small enough to live inside a line of text.
 *
 * Pure SVG with no dependencies, matching the rest of the kit's charts. Nothing
 * is measured and no layout is read, so it is safe in a virtualized table cell
 * where hundreds render at once.
 *
 * Colour comes from `currentColor`, so a sparkline inherits whatever text colour
 * surrounds it and dark mode needs no extra work. `tone` sets that colour, and
 * `auto` — the default — resolves to positive or negative by comparing the last
 * value with the first.
 *
 * Accessibility: the SVG is `role="img"` with a generated summary such as
 * *"12 points, trending up 8.7%, from 92 to 100, low 88, high 104"*. Pass
 * `ariaLabel` to override it, or `ariaHidden` when the number beside it already
 * says everything.
 *
 * ```html
 * <sv-sparkline [data]="revenue" variant="area" tone="auto" [showLast]="true" />
 * <sv-sparkline [data]="deploys" variant="winloss" [width]="64" [height]="20" />
 * ```
 */
@Component({
  selector: 'sv-sparkline',
  standalone: true,
  templateUrl: './sparkline.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "fluid() ? 'block w-full leading-none' : 'inline-block align-middle leading-none'",
  },
})
export class SvSparklineComponent {
  // ── Async state ───────────────────────────────────────────────────────────
  //
  // No shells here on purpose. A sparkline lives inside a KPI tile, a table
  // cell or a list row — dropping a bordered error card into one of those
  // wrecks the layout around it. What it owes the host instead is to reserve
  // its exact box and shimmer, and to say *something* rather than draw a flat
  // line that reads as real data meaning "nothing happened".

  /** True while the series is being fetched. @default false */
  readonly loading = input<boolean>(false);

  /**
   * Load failure. Rendered as a muted dash in the same box, not a card.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /** The host should re-run the failed load. Nothing here triggers it. */
  readonly retry = output<void>();

  // ── Data ──────────────────────────────────────────────────────────────────

  /** The series. Bare numbers, or objects carrying an optional label. @default [] */
  data = input<readonly SparklineDatum[]>([]);

  /** Pin the bottom of the value range instead of using the series minimum. */
  domainMin = input<number | null>(null);

  /** Pin the top of the value range instead of using the series maximum. */
  domainMax = input<number | null>(null);

  /**
   * `[min, max]` for the whole group — the shared-domain mode for a table column.
   *
   * ★★★ A COLUMN OF SPARKLINES EACH SCALED TO ITSELF INVITES EXACTLY THE
   * COMPARISON IT CANNOT SUPPORT. Row A rising 2% and row B rising 900% draw the
   * identical shape, side by side, and nothing on the page says otherwise.
   * Compute one range with `svSharedDomain()` over every row's series and hand
   * the same tuple to all of them.
   *
   * Takes precedence over `domainMin` / `domainMax`, which stay for pinning one
   * end. When none of the three is set, the scale is per-series and the
   * accessible label says so — because a reader who cannot see that is being
   * invited to compare heights that do not mean the same thing.
   * @default null
   */
  domain = input<readonly [number, number] | null>(null);

  /**
   * What to do with a missing sample. @default 'gap'
   *
   * ★★ Every one of the four is a claim about data nobody has, which is why
   * this is explicit and why the default is the one that invents nothing:
   * `gap` breaks the line; `skip` closes up and silently rewrites the x axis
   * (the old behaviour); `zero` asserts the value was zero, which for a rate or
   * a price is a different statement from *not collected* and drags the whole
   * domain down with it; `connect` draws a straight line across.
   */
  missing = input<SparklineMissing>('gap');

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Drawing style. @default 'area' */
  variant = input<SparklineVariant>('area');

  /** Width of the drawing box in px. @default 120 */
  width = input<number>(120);

  /** Height of the drawing box in px. @default 36 */
  height = input<number>(36);

  /** Line thickness in px. @default 1.5 */
  strokeWidth = input<number>(1.5);

  /** Round the line through point midpoints. Ignored by bar variants. @default false */
  smooth = input<boolean>(false);

  /** Colour source. @default 'auto' */
  tone = input<SparklineTone>('auto');

  /** Gap between bars in px, for `bar` and `winloss`. @default 1 */
  barGap = input<number>(1);

  /**
   * Stretch to the width of the container instead of drawing at `width`.
   *
   * `width` still sets the viewBox, so it stays the coordinate space the
   * geometry is computed in — only the rendered size follows the parent. Use
   * this for a chart that spans a fluid card; leave it off in a table cell,
   * where a fixed width keeps columns aligned.
   *
   * @default false
   */
  fluid = input<boolean>(false);

  // ── Markers ───────────────────────────────────────────────────────────────

  /** Dot on the most recent point. @default false */
  showLast = input<boolean>(false);

  /** Dots on the lowest and highest points. @default false */
  showExtremes = input<boolean>(false);

  /** Draw a horizontal rule at this value — a target, budget or zero line. */
  baseline = input<number | null>(null);

  // ── Accessibility ─────────────────────────────────────────────────────────

  /** Override the generated summary. */
  ariaLabel = input<string | null>(null);

  /** Hide from assistive tech — use when adjacent text already conveys the data. @default false */
  ariaHidden = input<boolean>(false);

  // ── Derived ───────────────────────────────────────────────────────────────

  /** One slot per datum, `null` where the value is missing — before any policy. */
  private readonly rawSlots = computed(() => toSlots(this.data()));

  /** The same slots with the gap policy applied. */
  protected readonly slots = computed(() => applyMissing(this.rawSlots(), this.missing()));

  /**
   * How many samples the series does not have.
   *
   * ★ Counted on the RAW slots, deliberately. Every policy but `gap` removes
   * the holes — that is what a policy is — so counting after it would report
   * zero missing samples for a chart that had just interpolated three of them,
   * and the label's whole job here is to say what was done to data nobody has.
   */
  protected readonly gaps = computed(() => gapCount(this.rawSlots()));

  protected readonly values = computed(() => this.slots());
  protected readonly stats = computed(() => statsOf(this.slots()));

  /** The bottom of the range actually projected against. */
  private readonly rangeMin = computed(() => this.domain()?.[0] ?? this.domainMin());

  /** The top of the range actually projected against. */
  private readonly rangeMax = computed(() => this.domain()?.[1] ?? this.domainMax());

  /** Whether any part of the range was pinned by the host. */
  protected readonly domainPinned = computed(
    () => this.rangeMin() !== null || this.rangeMax() !== null,
  );

  /** Half the stroke, so the line is never clipped at the top or bottom edge. */
  private readonly pad = computed(() => this.strokeWidth() / 2);

  protected readonly isBars = computed(
    () => this.variant() === 'bar' || this.variant() === 'winloss',
  );

  /** The values that exist, for arithmetic that cannot take a hole. */
  private readonly realValues = computed(() =>
    this.slots().filter((v): v is number => v !== null),
  );

  /**
   * Nothing to draw: a line needs two points, a bar chart needs one.
   *
   * Counted over REAL values — a series of nothing but gaps has slots and no
   * data, and drawing its empty box as a chart would say the opposite.
   */
  protected readonly isEmpty = computed(() =>
    this.isBars() ? this.realValues().length === 0 : this.realValues().length < 2,
  );

  /** Points whose value was outside a pinned range and clamped to the edge. */
  protected readonly clippedCount = computed(
    () => this.points().filter((p) => p.clipped).length,
  );

  protected readonly points = computed(() =>
    pointsOf(
      this.values(),
      this.width(),
      this.height(),
      this.pad(),
      this.rangeMin(),
      this.rangeMax(),
    ),
  );

  protected readonly linePath = computed(() => linePathOf(this.points(), this.smooth()));

  protected readonly areaPath = computed(() =>
    areaPathOf(this.points(), this.height(), this.pad(), this.smooth()),
  );

  protected readonly bars = computed(() =>
    barsOf(this.values(), this.width(), this.height(), {
      gap: this.barGap(),
      baseline: this.variant() === 'winloss' ? (this.baseline() ?? 0) : this.baseline(),
      uniform: this.variant() === 'winloss',
      explicitMin: this.rangeMin(),
      explicitMax: this.rangeMax(),
    }),
  );

  protected readonly lastPoint = computed(() => this.points().at(-1) ?? null);

  protected readonly minPoint = computed(() => {
    const s = this.stats();
    return s ? (this.points()[s.minIndex] ?? null) : null;
  });

  protected readonly maxPoint = computed(() => {
    const s = this.stats();
    return s ? (this.points()[s.maxIndex] ?? null) : null;
  });

  /** y of the reference rule, or null when it falls outside the drawn range. */
  protected readonly baselineY = computed(() => {
    const at = this.baseline();
    if (at === null || this.values().length === 0) return null;

    const projected = pointsOf(
      [at, at],
      this.width(),
      this.height(),
      this.pad(),
      this.rangeMin() ?? Math.min(at, ...this.realValues()),
      this.rangeMax() ?? Math.max(at, ...this.realValues()),
    );
    // ★ The `?? null` arm is unreachable and stays only as a type narrowing:
    // `pointsOf` is called with a two-element array and returns [] only for
    // fewer than two values, so `projected[0]` always exists. No input
    // distinguishes it from `projected[0].y` — it is an equivalent mutant, and
    // the one branch this file does not cover.
    return projected[0]?.y ?? null;
  });

  /** Resolved colour class — `auto` follows the direction of travel. */
  protected readonly toneClass = computed(() => {
    const tone = this.tone();
    if (tone !== 'auto') return TONE[tone];

    const direction = this.stats()?.direction;
    if (direction === 'up') return TONE.positive;
    if (direction === 'down') return TONE.negative;
    return TONE.neutral;
  });

  /** Generated description of the series for assistive tech. */
  protected readonly label = computed(() => {
    const override = this.ariaLabel();
    if (override) return override;

    const s = this.stats();
    if (!s) return 'No data';

    const change =
      s.changePct === null
        ? s.direction
        : `${s.direction} ${Math.abs(s.changePct).toFixed(1)}%`;

    const parts = [
      `Sparkline, ${s.count} point${s.count === 1 ? '' : 's'}`,
      `trending ${change}`,
      `from ${fmt(s.first)} to ${fmt(s.last)}`,
      `low ${fmt(s.min)}, high ${fmt(s.max)}`,
    ];

    // ★ A missing sample changes the shape, so it belongs in the summary. Being
    // told "12 points" when three of them are holes is the reading a sighted
    // reader gets from the break in the line and a screen-reader user did not.
    const gaps = this.gaps();
    if (gaps > 0) {
      parts.push(
        `${gaps} missing ${gaps === 1 ? 'sample' : 'samples'}, ` +
          (this.missing() === 'gap'
            ? 'drawn as breaks'
            : this.missing() === 'connect'
              ? 'drawn as straight lines across'
              : this.missing() === 'zero'
                ? 'drawn as zero'
                : 'left out'),
      );
    }

    // ★ THE COMPARABILITY DISCLOSURE. Without it a column of these invites a
    // comparison of heights that do not share a scale — the single most
    // important thing this component can say about itself.
    const clipped = this.clippedCount();
    if (this.domainPinned()) {
      const lo = this.rangeMin();
      const hi = this.rangeMax();
      parts.push(
        `scale ${lo === null ? 'auto' : fmt(lo)} to ${hi === null ? 'auto' : fmt(hi)}` +
          (clipped > 0 ? `, ${clipped} beyond it` : ''),
      );
    } else {
      parts.push('scaled to this series alone, so its height is not comparable');
    }

    return parts.join(', ');
  });
}

/** Trim float noise without imposing a locale on the caller's data. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}
