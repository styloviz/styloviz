import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Layout the placeholder imitates while data loads.
 *
 * - `text`  — stacked lines of prose
 * - `list`  — avatar + two lines per row
 * - `table` — a header strip plus aligned cell bars
 * - `card`  — media block, title, two body lines
 * - `chart` — plot area with an axis, for any chart or sparkline
 */
export type SvSkeletonShellVariant = 'text' | 'list' | 'table' | 'card' | 'chart';

/**
 * SkeletonShell — the loading placeholder every data component renders.
 *
 * Deliberately tiny and dependency-free: it lives in `@styloviz/core` so a
 * table, a kanban board and a chart all show the *same* loading treatment
 * without any of them taking a dependency on a component package.
 *
 * It is not a replacement for `@styloviz/skeleton-loader` — that ships eleven
 * composed presets and per-bone control for building bespoke placeholders. This
 * is the five-shape version that data components reach for internally.
 *
 * Width variation across bones is derived from the row index rather than
 * randomised, so the placeholder is stable between renders. A skeleton whose
 * bars resize on every change-detection pass reads as a glitch.
 */
@Component({
  selector: 'sv-skeleton-shell',
  standalone: true,
  templateUrl: './skeleton-shell.component.html',
  styleUrl: './skeleton-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The async contract is a public promise, so it needs one machine-detectable
  // hook rather than 110 hand-written ones. Applied on the shell itself, every
  // component that renders it advertises the state without touching its own
  // template — which is what lets a single test harness assert the contract for
  // every data component instead of one bespoke spec each.
  host: {
    'data-sv-state': 'loading',
    // Bone fill and sweep, per theme — read by `.sv-bone` in the stylesheet.
    // See the note there for why this cannot be a `:where(.dark)` rule.
    class:
      '[--sv-bone-fill:var(--color-gray-200)] [--sv-bone-sheen:rgb(255_255_255/0.35)] dark:[--sv-bone-fill:var(--color-gray-700)] dark:[--sv-bone-sheen:rgb(255_255_255/0.06)]',
  },
})
export class SvSkeletonShellComponent {
  /**
   * Layout to imitate.
   * @default 'list'
   */
  readonly variant = input<SvSkeletonShellVariant>('list');

  /**
   * Number of rows (or lines, or cards) to draw. Clamped to 1–24.
   * @default 3
   */
  readonly rows = input<number>(3);

  /**
   * Number of columns drawn by the `table` variant. Clamped to 1–12.
   * @default 4
   */
  readonly columns = input<number>(4);

  /**
   * Height of the `chart` variant's plot area, as a CSS length.
   * @default '12rem'
   */
  readonly chartHeight = input<string>('12rem');

  /**
   * Announced to assistive tech while the placeholder is on screen.
   * @default 'Loading'
   */
  readonly ariaLabel = input<string>('Loading');

  /** Extra classes for the outer wrapper. @default '' */
  readonly customClass = input<string>('');

  /** Row indices, clamped so a bad input cannot render 10,000 bones. */
  protected readonly rowList = computed(() => indices(this.rows(), 1, 24, 3));

  /** Column indices for the table variant. */
  protected readonly colList = computed(() => indices(this.columns(), 1, 12, 4));

  /** Bars for the chart variant — a fixed count reads better than `rows`. */
  protected readonly barList = computed(() => indices(9, 1, 12, 9));

  /**
   * Deterministic width for the bone at (row, column), between 45% and 95%.
   * Coprime multipliers keep neighbouring bones from landing on the same width,
   * which is what makes the block read as text rather than as a bar chart.
   */
  protected width(row: number, col = 0): string {
    return `${45 + ((row * 37 + col * 23) % 51)}%`;
  }

  /** Deterministic height for a chart bar, between 25% and 95%. */
  protected barHeight(index: number): string {
    return `${25 + ((index * 29) % 71)}%`;
  }
}

/** Build `[0..n)` with `value` coerced into `[min, max]`. */
function indices(value: number, min: number, max: number, fallback: number): readonly number[] {
  const n = Number.isFinite(value) ? Math.floor(value) : fallback;
  return Array.from({ length: Math.min(Math.max(n, min), max) }, (_, i) => i);
}
