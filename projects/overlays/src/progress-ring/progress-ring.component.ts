import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { svHighContrast, svOnHighContrastChange, svUniqueId } from '@styloviz/core';

export type ProgressRingSize    = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ProgressRingVariant = 'default' | 'gradient' | 'dashed' | 'glow';

const SIZES = {
  xs: { size: 48,  stroke: 4,  fontSize: 'text-[10px]' },
  sm: { size: 64,  stroke: 5,  fontSize: 'text-xs'     },
  md: { size: 96,  stroke: 7,  fontSize: 'text-sm'     },
  lg: { size: 128, stroke: 9,  fontSize: 'text-base'   },
  xl: { size: 160, stroke: 11, fontSize: 'text-lg'     },
};

@Component({
  selector: 'sv-progress-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress-ring.component.html',
})
export class SvProgressRingComponent {
  /** Current progress value (0–max). @default 0 */
  value    = input<number>(0);       // 0–100
  /** Value that represents 100%. @default 100 */
  max      = input<number>(100);
  /** Ring size: xs–xl. @default 'md' */
  size     = input<ProgressRingSize>('md');
  /** Visual variant: default, gradient, dashed or glow. @default 'default' */
  variant  = input<ProgressRingVariant>('default');
  /** Progress arc color (any CSS color). @default 'var(--color-primary-500)' */
  color    = input<string>('var(--color-primary-500)');
  /** Track (background) color; defaults to a subtle tint. */
  trackColor = input<string>('');
  /** Primary center label. */
  label    = input<string>('');
  /** Secondary center label below the value. */
  sublabel = input<string>('');
  /** Show the numeric value in the center. @default true */
  showValue = input<boolean>(true);
  /** Unit appended to the value (e.g. %). @default '%' */
  suffix   = input<string>('%');
  /** Animate the arc on value change. @default true */
  animated = input<boolean>(true);
  /** Arc end-cap style. @default 'round' */
  lineCap  = input<'round' | 'butt'>('round');
  /** Accessible name for the ring. Falls back to the label or a generated summary. */
  ariaLabel = input<string>('');
  /**
   * What a screen reader should read for the VALUE (`OF-15-M4`).
   * Falls back to a generated string with the unit. @default ''
   *
   * ★★★ `aria-valuenow` ALONE IS ANNOUNCED AS A BARE NUMBER: "62". Sixty-two
   *     what — per cent, files, minutes, of eight? The ring shows the unit in
   *     the middle of itself, so the sighted answer was never in doubt and the
   *     announced one was.
   *
   * ★★ THE GENERATED FALLBACK READS THE HOST'S OWN VOCABULARY rather than
   *    inventing one: `suffix` when there is one (`'62%'`), and "3 of 8" when
   *    the host cleared the suffix and set a `max` that is not 100 — the shape
   *    a step counter or a file count actually has. Pass `valueText` for
   *    anything else ("4 minutes remaining"), and pass it whenever the value
   *    means something a number cannot say.
   */
  valueText = input<string>('');
  /** Extra CSS classes merged onto the root wrapper. */
  customClass = input<string>('');

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Emitted once when the ring first reaches 100%. */
  readonly completed = output<void>();

  // ── Reduced motion ──────────────────────────────────────────────────────────

  private readonly platformId = inject(PLATFORM_ID);
  private readonly prefersReducedMotion =
    isPlatformBrowser(this.platformId) &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Effective animation flag — disabled when the user prefers reduced motion. */
  readonly animationOn = computed(() => this.animated() && !this.prefersReducedMotion);

  // ── High contrast (`OF-15-I6`, `OF-15-M6`, `X-20`) ────────────────────

  private readonly _highContrast = signal<boolean>(svHighContrast());

  /**
   * The variant actually drawn.
   *
   * ★★★ A GLOW IS THE HARDEST CASE FOR 1.4.11 AND THE LIKELIEST TO FAIL IT.
   *     The requirement is 3:1 against what is adjacent, and a `drop-shadow`
   *     has no single edge to measure — the arc fades into the page over six
   *     pixels, so the boundary that carries the meaning is the lowest-contrast
   *     part of the drawing. Under `prefers-contrast: more` or forced colors it
   *     becomes the solid `default` arc.
   *
   * ★★ `gradient` GOES THE SAME WAY, and for a sharper reason: a gradient is
   *    painted through `url(#…)`, and a paint server is NOT something
   *    forced-colors can override — so in Windows High Contrast the gradient
   *    ring would be the one element on the page still insisting on the
   *    author's colours, at whatever contrast they happen to have against the
   *    user's chosen background.
   *
   * ★ `dashed` STAYS. It carries its meaning in a PATTERN rather than in
   *   colour or blur, which is what a high-contrast mode wants more of, not
   *   less.
   */
  readonly effectiveVariant = computed<ProgressRingVariant>(() => {
    const declared = this.variant();
    if (!this._highContrast()) return declared;
    return declared === 'glow' || declared === 'gradient' ? 'default' : declared;
  });

  private _emittedComplete = false;

  constructor() {
    // ★ Live, not read once: macOS "Increase contrast" and the Windows
    //   high-contrast switch are both toggled mid-session, and a ring that
    //   sampled the preference at construction keeps its glow for as long as
    //   the page is open.
    inject(DestroyRef).onDestroy(svOnHighContrastChange(v => this._highContrast.set(v)));

    effect(() => {
      const done = this.pct() >= 100;
      if (done && !this._emittedComplete) {
        this._emittedComplete = true;
        this.completed.emit();
      } else if (!done) {
        this._emittedComplete = false;
      }
    });
  }

  readonly cfg = computed(() => SIZES[this.size()]);

  /**
   * The value input, made finite (`OF-15-I7`).
   *
   * ★ `NaN` or `Infinity` — a division upstream, a count that has not arrived —
   *   used to reach the dash offset and the centre label as `NaN`: the browser
   *   drops a `NaN` attribute and draws a FULL ring, and the label read "NaN%".
   *   It reads as zero, the same answer a missing `max` already gets.
   */
  private readonly finiteValue = computed<number>(() => {
    const value = this.value();
    return Number.isFinite(value) ? value : 0;
  });

  readonly pct = computed(() => {
    // Same zero-max case as the bar: a ring bound to a count that has not
    // arrived yet divided by zero and put NaN into the dash offset.
    const max = this.max();
    if (!Number.isFinite(max) || max <= 0) return 0;
    return Math.max(0, Math.min(100, (this.finiteValue() / max) * 100));
  });

  /**
   * The value as ARIA should see it.
   *
   * `aria-valuenow` was bound to the raw input while `aria-valuemax` was bound
   * to `max`, so a value past the maximum reported itself out of its own
   * declared range — while the arc, which clamps, showed a full ring.
   */
  readonly clampedValue = computed(() => {
    const max = this.max();
    if (!Number.isFinite(max) || max <= 0) return 0;
    return Math.max(0, Math.min(max, this.finiteValue()));
  });

  /**
   * The figure drawn in the centre (`OF-15-I7`).
   *
   * ★★ THE LABEL WAS THE LAST UNCLAMPED READING. The arc and `aria-valuenow`
   *    both clamp, so a value of 150 drew a full ring, announced "100%" — and
   *    printed "150%" in the middle of it: three answers to one question, the
   *    sighted one disagreeing with the other two. It reads `clampedValue` now.
   *    A host that means over-achievement ("120% of goal") says so with
   *    `sublabel` or `valueText`, not by overflowing a ring that cannot draw it.
   */
  readonly displayValue = computed<number>(() => this.clampedValue());

  /**
   * What `aria-valuetext` carries (`OF-15-M4`). See {@link valueText}.
   *
   * ★ Built from `clampedValue`, not from the raw input: the announced value
   *   and the drawn arc have to agree, and the arc clamps.
   */
  readonly resolvedValueText = computed<string>(() => {
    const stated = this.valueText().trim();
    if (stated) return stated;
    const value = this.clampedValue();
    const suffix = this.suffix();
    if (suffix) return `${value}${suffix}`;
    const max = this.max();
    return Number.isFinite(max) && max > 0 && max !== 100
      ? `${value} of ${max}`
      : `${value}`;
  });

  /** Accessible label resolved from `ariaLabel`, `label`, or a generated summary. */
  readonly resolvedAriaLabel = computed<string>(() =>
    this.ariaLabel() || this.label() || `Progress: ${Math.round(this.pct())}%`
  );

  readonly radius = computed(() => {
    const { size, stroke } = this.cfg();
    return (size - stroke) / 2;
  });

  readonly circumference = computed(() => 2 * Math.PI * this.radius());

  readonly dashOffset = computed(() =>
    this.circumference() - (this.pct() / 100) * this.circumference()
  );

  /**
   * The arc's `stroke-dasharray`, per variant.
   *
   * ★★★ THE `dashed` VARIANT USED TO DRAW NO PROGRESS AT ALL. It set a repeating
   *     dash/gap pattern and then shifted it with `stroke-dashoffset` — but an
   *     offset only SLIDES a repeating pattern, it never ends it, so a dashed
   *     ring at 10% and at 90% were the same full circle of dashes. That
   *     matters twice over here: `dashed` is the variant the high-contrast
   *     fallback keeps (`OF-15-M6`), on the grounds that its meaning is carried
   *     by a pattern — and the pattern carried no value.
   *
   * ★ So the dashes are laid out explicitly up to the progress length, followed
   *   by a gap as long as the whole circle, and the offset is 0 (`arcOffset`).
   */
  readonly dashArray = computed<string>(() => {
    const c = this.circumference();
    if (this.effectiveVariant() !== 'dashed') return `${c}`;
    const dash = c / 20;
    const gap = c / 30;
    const length = (this.pct() / 100) * c;
    const parts: number[] = [];
    let drawn = 0;
    while (drawn < length) {
      const d = Math.min(dash, length - drawn);
      parts.push(d, gap);
      drawn += d + gap;
    }
    // ★ Empty is the solid array fully offset, as for every other variant: a
    //   zero-length dash with a round cap still paints a dot at 12 o'clock.
    if (parts.length === 0) return `${c}`;
    parts[parts.length - 1] = c;
    return parts.map(n => +n.toFixed(3)).join(' ');
  });

  /** `stroke-dashoffset` for the arc: 0 for a non-empty `dashed`, whose array ends itself. */
  readonly arcOffset = computed<number>(() =>
    this.effectiveVariant() === 'dashed' && this.pct() > 0 ? 0 : this.dashOffset(),
  );

  /**
   * Unique gradient id, referenced from the template as `url(#…)`.
   *
   * A counter, not `Math.random()`: this runs in a field initializer, so under
   * SSR the server and the client each pick a different id and the rehydrated
   * ring points `stroke` at a gradient that is not there.
   */
  readonly gradId = svUniqueId('pr-grad');

  readonly trackFill = computed(() =>
    this.trackColor() || 'var(--color-gray-200)'
  );

  // The faded far end of the `gradient` variant's arc.
  //
  // ★★ THIS USED TO BE `color() + '88'` IN THE TEMPLATE, WHICH ONLY WORKS IF
  //    `color` HAPPENS TO BE A 6-DIGIT HEX. The input is documented as "any CSS
  //    color", so `rgb(59 130 246)` or `red` — both inside the contract —
  //    produced `red88`, an invalid stop, and the gradient's far end silently
  //    fell back to fully opaque. It is also what blocked the default from
  //    becoming a token: `var(--color-primary-500)88` is equally invalid.
  //
  // `color-mix` takes whatever the caller passed. 0x88/0xff ≈ 53%.
  readonly gradientEnd = computed(() =>
    `color-mix(in oklab, ${this.color()} 53%, transparent)`
  );
}
