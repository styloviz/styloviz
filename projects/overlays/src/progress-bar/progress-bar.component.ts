import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { svWarnOnce } from '@styloviz/core';
import { NgClass } from '@angular/common';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProgressBarVariant  = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type ProgressBarSize     = 'xs' | 'sm' | 'md' | 'lg';
export type ProgressBarLabelPos = 'top' | 'right' | 'inside' | 'none';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ProgressBar — A linear progress indicator.
 *
 * Supports:
 * - Determinate (0–100) and indeterminate (looping) modes
 * - Striped and animated-stripe styles
 * - 4 sizes × 6 color variants
 * - Label positions: top, right, inside, none
 * - Optional rounded cap style
 * - Accessible aria-progressbar attributes
 */
@Component({
  selector: 'sv-progress-bar',
  standalone: true,
  imports: [NgClass],
  templateUrl: './progress-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvProgressBarComponent {
  // ── Value ─────────────────────────────────────────────────────────────────

  /** Progress value (0–100). Ignored when `indeterminate` is true. @default 0 */
  value = input<number>(0);

  /** Maximum value. @default 100 */
  max = input<number>(100);

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Color variant. @default 'primary' */
  variant = input<ProgressBarVariant>('primary');

  /** Bar height. @default 'md' */
  size = input<ProgressBarSize>('md');

  /** Apply diagonal stripe pattern. @default false */
  striped = input<boolean>(false);

  /** Animate stripes (only visible when `striped` is true). @default false */
  animated = input<boolean>(false);

  /** Show pulsing glow on the fill. @default false */
  glow = input<boolean>(false);

  // ── Label ─────────────────────────────────────────────────────────────────

  /** Label position. @default 'top' */
  labelPos = input<ProgressBarLabelPos>('top');

  /** Optional label text. If empty, the percentage is shown when labelPos is top/right. */
  label = input<string>('');

  /**
   * Quantization step for the value reported to assistive technology, in
   * percent. @default 5
   *
   * `1` reports every percent — the old behaviour, and a hundred
   * announcements for a hundred percent. See `announcedPercent` for why the
   * default is not 1.
   */
  announceStep = input<number>(5);

  /** Show percentage text. @default true */
  showPercent = input<boolean>(true);

  /**
   * The percentage is an ESTIMATE, not a measurement (`OF-14-I8`).
   * @default false
   *
   * ★★★ A PERCENTAGE DERIVED FROM A GUESS IS WORSE THAN AN INDETERMINATE BAR,
   *     and this API makes the guess easy: `max` defaults to 100, `value` is a
   *     free number, and a host that has no real total still gets a bar that
   *     looks measured. "43%" is a claim about the remaining work; when it is
   *     a guess, say so. Set this and the bar shows `~40%`, announces "about
   *     40%", and rounds to the nearest `announceStep` so it stops displaying
   *     precision it does not have.
   *
   * ★★ IT IS NOT A SUBSTITUTE FOR `indeterminate`. If you do not know the
   *    total at all, the honest bar is the indeterminate one; this is for the
   *    case where you have a real but rough figure — bytes against a
   *    Content-Length that the server rounded, items against an estimated
   *    count.
   */
  estimated = input<boolean>(false);

  /**
   * The named phases of the work, in order (`OF-14-M3`).
   * @default []
   *
   * ★★★ ONE BAR FOR FIVE PHASES HIDES FOUR OF THEM. A single free-text
   *     `label` could always say "Uploading", but nothing said WHICH of how
   *     many — so a user watching a bar crawl through "Processing" had no way
   *     to know whether that was the last step or the second of five, which is
   *     the difference between waiting and giving up. Pass the phases and the
   *     index; the bar renders the name with its position and announces both.
   *
   * ★★ THE POSITION IS NOT DERIVED FROM THE PERCENTAGE, and must not be: the
   *    phases of real work are not equal in length, and "step 3 of 5" inferred
   *    from 60% would be a second guess stacked on the first. `stageIndex` is
   *    the host's to state.
   */
  stages = input<readonly string[]>([]);

  /** Zero-based index into {@link stages}. @default 0 */
  stageIndex = input<number>(0);

  // ── State ─────────────────────────────────────────────────────────────────

  /** Indeterminate mode — shows an animated sliding fill. @default false */
  indeterminate = input<boolean>(false);

  // ── Accessibility / extra ───────────────────────────────────────────────────

  /** Accessible name for the progress bar (recommended for standalone bars). */
  ariaLabel = input<string>('');

  /** Extra CSS classes merged onto the root wrapper. */
  customClass = input<string>('');

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Emitted once when the bar first reaches 100% (determinate mode only). */
  readonly completed = output<void>();

  private _emittedComplete = false;

  /** The last percentage rendered, for the decrease check (`OF-14-I2`). */
  private _lastPercent = 0;

  /**
   * True while the current value is LOWER than the one before it.
   *
   * ★★★ A DECREASE THAT GLIDES LIKE AN INCREASE READS AS WORK BEING UNDONE.
   *     The fill animates `width` over half a second, and played backwards
   *     that is the most alarming thing a progress bar can do — the audit is
   *     right that non-monotonic progress is the fastest way to lose the
   *     user's trust. The bar therefore SNAPS on the way down: a reset looks
   *     like a reset rather than like regress.
   */
  readonly decreasing = signal<boolean>(false);

  constructor() {
    effect(() => {
      const done = !this.indeterminate() && this.percent() >= 100;
      if (done && !this._emittedComplete) {
        this._emittedComplete = true;
        this.completed.emit();
      } else if (!done) {
        this._emittedComplete = false;
      }
    });

    // ★ Split from the effect above rather than folded into it: that one is
    //   about a threshold, this one about a direction, and a single effect
    //   reading both would re-run each for the other's reason.
    effect(() => {
      const pct = this.indeterminate() ? 0 : this.percent();
      const previous = untracked(() => this._lastPercent);
      this._lastPercent = pct;
      this.decreasing.set(pct < previous);

      // ★★ A FALL TO ZERO IS NOT WARNED ABOUT. That is a restart — a new
      //    upload, a new run — and it is unambiguous on screen. A PARTIAL
      //    decrease is the one nobody means: the total was recalculated
      //    mid-flight, so the bar retreats from 80% to 60% and the user reads
      //    it as twenty per cent of their work being thrown away. Say so once,
      //    with the numbers, in dev.
      if (pct < previous && pct > 0) {
        svWarnOnce(
          'sv-progress-bar/partial-decrease',
          `<sv-progress-bar> went backwards from ${previous}% to ${pct}% without ` +
            'reaching zero. The fill snaps rather than animating, because a ' +
            'reverse glide reads as work being undone — but the number itself ' +
            'still fell. If the total was recalculated, reset to 0 for the new ' +
            'total, or show `[indeterminate]="true"` while you do not know it.',
        );
      }
    });

    // ★ The disclosure half of `OF-14-M1` (tracked as `OF-14-I8`): the bar
    //   clamps an out-of-range value, and clamping SILENTLY is how a host ships
    //   a bar stuck at 100% for a week without noticing its arithmetic is off.
    effect(() => {
      if (this.indeterminate()) return;
      const value = this.value();
      const max = this.max();
      if (!Number.isFinite(value) || !Number.isFinite(max)) {
        svWarnOnce(
          'sv-progress-bar/non-finite',
          `<sv-progress-bar> was given value=${value} and max=${max}. A ` +
            'non-finite figure renders as 0% here rather than as `NaN%`, but ' +
            'the bar is now showing something the data did not say.',
        );
        return;
      }
      if (max <= 0) return; // covered by `percent`, and normal while a list loads
      if (value < 0 || value > max) {
        svWarnOnce(
          'sv-progress-bar/out-of-range',
          `<sv-progress-bar> was given value=${value} against max=${max}, and ` +
            `clamped it to ${value < 0 ? 0 : max}. The bar cannot render a lie, ` +
            'but it also cannot fix the arithmetic behind it — a bar pinned at ' +
            '100% because the count is wrong looks exactly like a bar that is ' +
            'finished.',
        );
      }
    });
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly percent = computed<number>(() => {
    // A max of zero is what a bar bound to `items.length` shows while the list
    // is still loading. Divided through, `percent` was NaN — and NaN reached
    // the DOM as `aria-valuenow="NaN"` and `width: NaN%`.
    const max = this.max();
    if (!Number.isFinite(max) || max <= 0) return 0;
    // ★ NaN survives `Math.min`/`Math.max` — both return NaN when either side
    //   is NaN — so the clamp alone let `value = NaN` through as
    //   `aria-valuenow="NaN"` and `width: NaN%`, while the dev warning below
    //   claimed it rendered as 0% (OF-14-M1). ±Infinity clamps normally.
    const raw = this.value();
    if (Number.isNaN(raw)) return 0;
    const v = Math.max(0, Math.min(max, raw));
    const pct = Math.round((v / max) * 100);
    // ★★ 99.6% MUST NOT READ AS "100%" (OF-14-I1). Rounding a value that is
    //    not yet at `max` up to 100 draws — and announces — a finished bar,
    //    and fires `(completed)`, for work that is not done.
    return pct >= 100 && v < max ? 99 : pct;
  });

  /** The current stage's name, or `''`. */
  readonly stageLabel = computed<string>(() => {
    const stages = this.stages();
    if (stages.length === 0) return '';
    const i = Math.max(0, Math.min(stages.length - 1, Math.trunc(this.stageIndex())));
    return stages[i] ?? '';
  });

  /** `'3 of 5'`, or `''` when there are no stages. */
  readonly stagePosition = computed<string>(() => {
    const stages = this.stages();
    if (stages.length === 0) return '';
    const i = Math.max(0, Math.min(stages.length - 1, Math.trunc(this.stageIndex())));
    return `${i + 1} of ${stages.length}`;
  });

  /**
   * The percentage as TEXT, carrying its own uncertainty (`OF-14-I8`).
   *
   * ★ `~` on screen and "about" in the announcement, because a tilde is not
   *   read out by a screen reader — a sighted user would see the hedge and a
   *   listening one would hear the same false precision as before.
   */
  readonly percentText = computed<string>(() => {
    const pct = this.estimated() ? this.announcedPercent() : this.percent();
    return this.estimated() ? `~${pct}%` : `${pct}%`;
  });

  readonly displayText = computed<string>(() => {
    const stage = this.stageLabel();
    const position = this.stagePosition();
    const named = stage
      ? position ? `${stage} (${position})` : stage
      : this.label();
    if (named) return named;
    return this.showPercent() ? this.percentText() : '';
  });

  /**
   * The percentage REPORTED to assistive technology, quantized to
   * `announceStep`. @see announceStep
   *
   * ★★★ A `role="progressbar"` IS A LIVE REGION IN EVERYTHING BUT NAME. Screen
   *     readers announce its value when `aria-valuenow` changes — NVDA does by
   *     default — so a bar driven by a real upload emitted ONE HUNDRED
   *     ANNOUNCEMENTS on the way to done, and the user could not hear anything
   *     else while it ran. `OF-14-I7` called it "frequent announcements"; the
   *     T0 sweep found the mechanism was not an `aria-live` attribute at all
   *     (there is none in this component) but unthrottled ARIA value churn.
   *
   * ★★ QUANTIZING THE REPORTED VALUE IS THE ONLY LEVER THERE IS. The kit
   *    cannot throttle the screen reader — how often a progressbar is spoken
   *    is the AT's setting, not ours — so the only thing it can change is how
   *    often the attribute changes at all. At the default step of 5 a full
   *    upload announces twenty times instead of a hundred.
   *
   * ★ 0 AND 100 ALWAYS PASS THROUGH EXACTLY. "Started" and "finished" are the
   *   two values a user actually needs, and a bar that reported 95% at the end
   *   because 100 rounded down would be a worse bug than the one this fixes.
   */
  readonly announcedPercent = computed<number>(() => {
    const pct = this.percent();
    const step = this.announceStep();
    if (pct <= 0 || pct >= 100 || !Number.isFinite(step) || step <= 1) return pct;
    const q = Math.round(pct / step) * step;
    // ★★ QUANTIZING MUST NOT INVENT A START OR A FINISH. At the default step
    //    of 5, 98% rounded to 100 — announced as complete (and shown as
    //    "~100%" when `estimated`) while work remained — and 2% rounded to 0,
    //    announced as not started. Only the real 0 and 100 may report as such,
    //    so an in-flight value stays strictly between them. Near the top it
    //    reports the last step below 100 (under-stating, never finishing
    //    early). Near the bottom it reports the EXACT value: rounding up to
    //    the first step overstated by up to a whole step (12% announced as 25%
    //    at a step of 25), and 0 would claim "not started" for work that has
    //    begun — the same false claim as an early 100, at the other end. The
    //    cost is a few extra announcements below half a step, never a false one.
    if (q >= 100) {
      const below = Math.ceil(100 / step) * step - step;
      return below > 0 ? below : pct;
    }
    return q <= 0 ? pct : q;
  });

  /**
   * What `aria-valuetext` carries.
   *
   * ★★ THE STAGE AND ITS POSITION ARE THE HALF A NUMBER CANNOT CARRY
   *    (`OF-14-M3`): "60%" through a five-phase job says nothing about whether
   *    "Processing" is the last step or the second. Announced as
   *    "Processing, step 3 of 5, 60%".
   *
   * ★ `null` when there is nothing to add — no label, no stages, no estimate
   *   — so `aria-valuenow` keeps doing the talking and today's bars announce
   *   exactly what they announced before.
   */
  readonly resolvedValueText = computed<string | null>(() => {
    const parts: string[] = [];
    const stage = this.stageLabel();
    const position = this.stagePosition();
    if (stage) parts.push(stage);
    else if (this.label()) parts.push(this.label());
    if (position) parts.push(`step ${position}`);

    const pct = this.announcedPercent();
    if (this.estimated()) parts.push(`about ${pct}%`);
    else if (parts.length > 0) parts.push(`${pct}%`);

    return parts.length > 0 ? parts.join(', ') : null;
  });

  /**
   * `role="progressbar"` requires an accessible name, and `ariaLabel` defaults to
   * empty — so every bar that relied on `label` alone shipped unnamed. `label` is
   * the visible name when there is one, which keeps the announced name and the
   * rendered text in agreement; the constant is only reached by a bar with no
   * label at all, where "unnamed progressbar" is the alternative.
   */
  readonly accessibleName = computed<string>(() =>
    this.ariaLabel() || this.label() || this.stageLabel() || 'Progress'
  );

  readonly trackHeight = computed<string>(() => {
    switch (this.size()) {
      case 'xs': return 'h-1';
      case 'sm': return 'h-2';
      case 'lg': return 'h-4';
      default:   return 'h-2.5';
    }
  });

  readonly fillClasses = computed<string>(() => {
    const variantMap: Record<ProgressBarVariant, string> = {
      primary: 'bg-primary-500',
      success: 'bg-accent-500',
      warning: 'bg-warning-500',
      danger:  'bg-danger-500',
      info:    'bg-info-500',
      neutral: 'bg-gray-500',
    };

    const classes = [
      // ★ No `transition-[width]` while the value is falling (`OF-14-I2`): a
      //   reverse glide is the most alarming thing a progress bar can do, and
      //   a snap reads as the reset it is.
      this.decreasing() ? 'h-full rounded-full' : 'h-full rounded-full transition-[width] duration-500 ease-out',
      variantMap[this.variant()],
    ];

    if (this.striped()) {
      classes.push(
        'bg-[length:1rem_1rem]',
        'bg-[linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)]',
      );
    }

    if (this.animated() && this.striped()) {
      classes.push('[animation:progress-stripe_1s_linear_infinite]');
    }

    if (this.glow()) {
      // ★★ THE GLOW IS KEYED BY THE TOKEN FAMILY NAMES AND THEN IGNORED THEM.
      //    Every bar fills from `bg-<variant>-*` but glowed a hardcoded rgba, so
      //    a rebrand moved the bar and left the halo behind. `primary` was the
      //    plainest evidence: the bar fills blue and the glow was
      //    `rgba(99,102,241)` — indigo, i.e. `brandaccent`, not `primary` at all.
      //
      // `color-mix` rather than `/60`, because a shadow's colour sits inside an
      // arbitrary value where the opacity shorthand does not apply. Underscores
      // are Tailwind's escape for the spaces.
      //
      // ★ Spelled out rather than built from the variant name. A computed class
      //   is invisible to Tailwind's scanner, which reads source as text — the
      //   utility would never be emitted and the glow would silently not render.
      const glowMap: Record<ProgressBarVariant, string> = {
        primary: 'shadow-[0_0_8px_color-mix(in_oklab,var(--color-primary-500)_60%,transparent)]',
        success: 'shadow-[0_0_8px_color-mix(in_oklab,var(--color-accent-500)_60%,transparent)]',
        warning: 'shadow-[0_0_8px_color-mix(in_oklab,var(--color-warning-500)_60%,transparent)]',
        danger:  'shadow-[0_0_8px_color-mix(in_oklab,var(--color-danger-500)_60%,transparent)]',
        info:    'shadow-[0_0_8px_color-mix(in_oklab,var(--color-info-500)_60%,transparent)]',
        neutral: 'shadow-[0_0_8px_color-mix(in_oklab,var(--color-gray-500)_60%,transparent)]',
      };
      classes.push(glowMap[this.variant()]);
    }

    return classes.join(' ');
  });

  readonly insideLabelVisible = computed<boolean>(() =>
    this.labelPos() === 'inside' && this.size() === 'lg' && this.percent() > 10
  );
}
