import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  forwardRef,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  SvFieldErrorComponent,
  createFieldError,
  createOptimisticEdit,
  svRequestKey,
  toSvDataError,
  type SvDataError,
  type SvServerError,
  svUniqueId,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

export type RatingSize    = 'sm' | 'md' | 'lg' | 'xl';

/**
 * One rating the host is expected to persist (`X-6`).
 *
 * Emitted by `(changeRequest)` alongside the plain `(changed)`. A rating on a
 * product page or a support ticket is saved the moment it is clicked, and the
 * same contract as `sv-toggle-switch`'s `(toggleRequest)` applies: the value is
 * drawn at once, `[pending]` holds it while the write is out, and `rollback()`
 * puts it back if the write fails.
 */
export interface SvRatingChange {
  /** The rating the user chose — already applied to `value`. */
  readonly value: number;
  /** The rating it replaced, which `rollback()` restores. */
  readonly previous: number;
  /** Idempotency key for this write, so a retried request cannot land twice. */
  readonly requestKey: string;
  /**
   * Put `value` back to `previous`. Refuses — with a dev-mode warning — if the
   * user has rated again since, because that would discard their newer choice.
   * Bind `[pending]` so it cannot arise.
   */
  readonly rollback: () => void;
}
export type RatingVariant = 'star' | 'heart' | 'thumb' | 'fire';

/** Plural/singular noun per variant for accessible value text. */
const RATING_NOUN: Record<RatingVariant, [singular: string, plural: string]> = {
  star:  ['star', 'stars'],
  heart: ['heart', 'hearts'],
  fire:  ['flame', 'flames'],
  thumb: ['thumb', 'thumbs'],
};

/**
 * Icon-library name for each variant.
 *
 * These were four hand-copied `<path d="…">` strings, and the template carried
 * a separate copy of each per fill state — twelve literals for four glyphs. A
 * name resolves through `@styloviz/icons`, so `check:icons` catches a typo and
 * the shapes stay in step with the rest of the kit.
 *
 * The variant NAMES are the component's public API and do not change: `fire`
 * still means fire, it just draws the library's `flame`.
 */
const RATING_ICON: Record<RatingVariant, string> = {
  star:  'star',
  heart: 'heart',
  fire:  'flame',
  thumb: 'thumbs-up',
};

@Component({
  selector: 'sv-rating',
  standalone: true,
  imports: [SvIconComponent, SvFieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rating.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvRatingComponent),
      multi: true,
    },
  ],
})
export class SvRatingComponent implements ControlValueAccessor {
  /** Current rating (two-way). @default 0 */
  value    = model<number>(0);
  /** Number of icons in the scale. @default 5 */
  max      = input<number>(5);
  /** Icon size: sm, md, lg or xl. @default 'md' */
  size     = input<RatingSize>('md');
  /** Icon set: star, heart, fire or thumb. @default 'star' */
  variant  = input<RatingVariant>('star');
  /** Display-only mode — no hover or click. @default false */
  readonly = input<boolean>(false);
  /** Allow half-step ratings. @default false */
  half     = input<boolean>(false);
  /** Disable interaction. @default false */
  disabled = input<boolean>(false);
  /** Accessible label for the rating control. */
  label    = input<string>('');
  /** Show the rating count next to the icons. @default false */
  showCount = input<boolean>(false);
  /** Number of ratings to display when showCount is on. @default 0 */
  count    = input<number>(0);
  /** Active icon color (any CSS color). @default '#f59e0b' */
  color    = input<string>('#f59e0b');

  /**
   * What each level of the scale MEANS, from level 1 upwards.
   *
   * ── The defect this exists for (`FI-18-I1` / `FI-18-M2`) ──────────────────
   *
   * ★★★ ONLY STARS ARE ORDINAL BY CONVENTION. Five stars is a quality scale
   *     everyone has already agreed on, so "3 of 5 stars" is a complete
   *     sentence. Three hearts out of five is not a rating of 3 — it is a like
   *     count wearing a rating's clothes, and "3 of 5 hearts" tells a
   *     screen-reader user a number and nothing about what they just said. Fire
   *     and thumb are worse: nobody has a shared scale for either.
   *
   * ★★ So the meaning is declarable instead of assumed. With labels,
   *    `aria-valuetext` becomes "4 of 5 — Really like it", which is what
   *    `aria-valuetext` is FOR: the number is already in `aria-valuenow`, and a
   *    value text that only repeats it earns nothing.
   *
   * ⚠️ Labels are per WHOLE level. A half-step has no name, so `3.5` announces
   *    numerically — which is honest, and better than inventing "between Good
   *    and Great".
   *
   * @example ['Poor', 'Fair', 'Good', 'Great', 'Excellent']
   */
  levelLabels = input<readonly string[]>([]);

  /**
   * What the scale is called, overriding the per-variant noun.
   *
   * `'star' | 'heart' | 'fire' | 'thumb'` pick a GLYPH, and the glyph is not the
   * meaning: a heart scale measuring urgency is not measured in hearts. Supply
   * the plural form — it is used for the whole scale, and only a one-point
   * scale would want a singular, which a host in that position can simply write.
   */
  scaleNoun = input<string>('');

  /**
   * Read-only summary layout: a large average, precise fractional icons and a
   * per-level histogram breakdown (as seen under product reviews). @default false
   */
  summary  = input<boolean>(false);
  /**
   * Per-level counts for the summary histogram. `distribution[i]` is the number
   * of ratings equal to `(i + 1)` items — so `distribution[max - 1]` is the
   * top-rating count. @default []
   */
  distribution = input<number[]>([]);

  /** Emitted with the new rating when the user selects one. */
  changed = output<number>();

  /**
   * The same change, carrying what a server write needs: an idempotency key and
   * a guarded `rollback()` (`X-6`). Additive — `changed` still fires first.
   */
  changeRequest = output<SvRatingChange>();

  /**
   * The user's rating is drawn and its write is in flight (`X-6`).
   *
   * Not `disabled` and not `readonly`: the chosen value stays at full strength
   * — fading it reads as "this did not take" — and the slider stays focusable.
   * It refuses further changes while true, which is what makes `rollback()`
   * unambiguous. Bind it for the whole round-trip.
   * @default false
   */
  pending = input(false, { transform: booleanAttribute });

  /**
   * The write failed (`X-6`). Accepts an `SvDataError` or a plain string.
   *
   * ★ Not `serverError`, which expires on the next value change — and a
   *   rollback IS a change, so the failure would vanish in the same tick the
   *   rating reverted. Call `rollback()` as well.
   * @default null
   */
  error = input<SvDataError | string | null>(null);

  /** The failed-write message, normalized from either accepted shape. */
  readonly writeErrorMessage = computed<string>(() => {
    const failure = this.error();
    return failure ? toSvDataError(failure).message : '';
  });

  /** Monotonic change counter, so a stale `rollback()` handle can be refused. */
  private readonly _revision = signal(0);

  private readonly _edit = createOptimisticEdit({
    revision: () => this._revision(),
    selector: 'sv-rating',
    superseded:
      'the rating has been changed again since, so putting the old value back ' +
      'would discard the newer choice. Bind [pending] so it cannot be changed ' +
      'while the write is in flight.',
  });

  /** Unique per-instance prefix so SVG gradient IDs don't collide across pages. */
  readonly _uid = svUniqueId('sv-rating');

  readonly hovered = signal<number>(0);

  // ── ControlValueAccessor ──
  private _onChange: (v: number) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);
  /** Merged disabled — the `[disabled]` input OR a disabled parent FormControl. */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  writeValue(v: number): void { this.value.set(typeof v === 'number' ? v : 0); }
  registerOnChange(fn: (v: number) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this._formDisabled.set(isDisabled); }

  readonly slots = computed(() => Array.from({ length: this.max() }, (_, i) => i + 1));

  /** True when the control accepts input. */
  readonly interactive = computed(() => !this.summary() && !this.readonly() && !this.resolvedDisabled());

  /** The declared meaning of the current value, or `''` when there is none. */
  readonly levelLabel = computed(() => this.labelForLevel(this.value()));

  /** The declared meaning of a level, or `''`. Whole levels only. */
  labelForLevel(v: number): string {
    if (!Number.isInteger(v) || v < 1) return '';
    return this.levelLabels()[v - 1] ?? '';
  }

  /** The noun for this scale — the host's, else the variant's. */
  readonly scaleNounText = computed(() => {
    const stated = this.scaleNoun().trim();
    if (stated) return stated;
    const [singular, plural] = RATING_NOUN[this.variant()];
    // The noun agrees with the SCALE, not the score: "1 of 5 stars", not
    // "1 of 5 star". Only a one-point scale takes the singular.
    return this.max() === 1 ? singular : plural;
  });

  /**
   * Accessible value text — "3 of 5 stars", or "4 of 5 — Great" when the host
   * has said what the levels mean.
   *
   * ★ The number stays in front of the label rather than replacing it. A slider
   *   that announces only "Great" strands anyone trying to work out how much
   *   further the scale goes.
   */
  readonly valueText = computed(() => {
    const v = this.value();
    const label = this.levelLabel();
    return label
      ? `${v} of ${this.max()} — ${label}`
      : `${v} of ${this.max()} ${this.scaleNounText()}`;
  });

  readonly iconSize = computed(() => ({
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-10 w-10',
  }[this.size()]));

  readonly gapClass = computed(() => ({
    sm: 'gap-0.5',
    md: 'gap-1',
    lg: 'gap-1.5',
    xl: 'gap-2',
  }[this.size()]));

  /**
   * Horizontal padding on each slot, so a HALF target is still 24px wide.
   *
   * ── The defect this exists for (`FI-18-I2`) ───────────────────────────────
   *
   * ★★★ TURNING ON `half` HALVES EVERY TARGET. A 24px glyph split down the
   *     middle gives two 12px targets, and WCAG 2.5.8 asks for 24. On a phone
   *     that is not a near-miss: the difference between 4 and 4.5 is a thumb's
   *     width, and the wrong one is what gets submitted.
   *
   * ★★ THE WIDTH IS THE PRICE OF THE PRECISION, so the control pays it visibly
   *    rather than shipping targets nobody can hit. Padding is applied only when
   *    `half` is on — a whole-step control already has full-glyph targets and
   *    should not get wider for nothing.
   *
   * ★ The keyboard path was never affected: arrows step by 0.5 with `half` on,
   *   and Home/End reach both ends. It is the pointer that was the problem, and
   *   a "use the keyboard" answer is not one on a touchscreen.
   */
  readonly slotPadClass = computed(() => {
    // ★ A read-only rating has no targets, so it pays no width: "3.5 ★" on a
    //   product card is a display, and widening it to 48px slots bought nothing
    //   but a stretched row of stars. (Disabled keeps the width, so toggling
    //   `disabled` does not shift the layout.)
    if (!this.half() || this.readonly()) return '';
    // glyph → padding needed each side to reach a 48px slot (24px per half).
    return {
      sm: 'px-4 py-1', // 16px glyph + 2×16 = 48 wide; + 2×4 = 24 tall — a 16px-tall half is still under 24
      md: 'px-3',   // 24px glyph + 2×12 = 48
      lg: 'px-2',   // 32px glyph + 2×8  = 48
      xl: 'px-1',   // 40px glyph + 2×4  = 48
    }[this.size()];
  });

  // ── Summary / histogram ───────────────────────────────────────────────────

  /** Library icon name for the active variant (reused across every slot). */
  readonly iconName = computed(() => RATING_ICON[this.variant()]);

  /** Total reviews — the explicit `count`, else the sum of `distribution`. */
  readonly summaryTotal = computed(() => {
    const c = this.count();
    if (c > 0) return c;
    return this.distribution().reduce((a, b) => a + (b || 0), 0);
  });

  readonly summaryTotalText = computed(() => this.summaryTotal().toLocaleString());

  /** Average — the bound `value` if set, else computed from `distribution`. */
  readonly summaryAverage = computed(() => {
    if (this.value() > 0) return this.value();
    const d = this.distribution();
    const total = d.reduce((a, b) => a + (b || 0), 0);
    if (!total) return 0;
    const weighted = d.reduce((acc, c, i) => acc + (c || 0) * (i + 1), 0);
    return weighted / total;
  });

  readonly avgDisplay = computed(() => this.summaryAverage().toFixed(1));

  /** Histogram rows from the top level down to 1. */
  readonly histogram = computed(() => {
    const d = this.distribution();
    const total = this.summaryTotal();
    const rows: { level: number; count: number; countText: string; pct: number }[] = [];
    for (let level = this.max(); level >= 1; level--) {
      const count = d[level - 1] || 0;
      rows.push({
        level,
        count,
        countText: count.toLocaleString(),
        pct: total ? (count / total) * 100 : 0,
      });
    }
    return rows;
  });

  /** Fill percentage (0–100) for the i-th summary icon, given the average. */
  avgFillPct(i: number): number {
    return Math.max(0, Math.min(100, (this.summaryAverage() - (i - 1)) * 100));
  }

  /** Accessible label for the whole summary block. */
  readonly summaryAriaLabel = computed(() =>
    `Average ${this.avgDisplay()} of ${this.max()} ${this.scaleNounText()} from ${this.summaryTotalText()} reviews`,
  );

  // ── Interactive fill ──────────────────────────────────────────────────────

  /**
   * How much of the i-th slot is filled, as a percentage.
   *
   * ★ `half` used to mean something different per variant: star drew a real
   * 50/50 gradient, heart drew a *lighter* whole heart, and fire and thumb had
   * no half state at all — `!== 'empty'` painted them completely full, so a
   * 3.5 read as a 4. One clip width now means the same thing everywhere.
   */
  fillPct(i: number): number {
    const level = this.fillLevel(i);
    return level === 'full' ? 100 : level === 'half' ? 50 : 0;
  }

  fillLevel(i: number): 'full' | 'half' | 'empty' {
    const display = this.readonly() ? this.value() : (this.hovered() || this.value());
    if (display >= i) return 'full';
    if (this.half() && display >= i - 0.5) return 'half';
    return 'empty';
  }

  rate(i: number, e?: MouseEvent): void {
    if (this.readonly() || this.resolvedDisabled() || this.pending()) return;
    let v = i;
    if (this.half() && e) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const half = (e.clientX - rect.left) / rect.width < 0.5;
      v = half ? i - 0.5 : i;
    }
    this.commit(this.value() === v ? 0 : v);
  }

  /** Set the rating to an absolute value (clamped to 0..max), and emit. */
  private setRating(v: number): void {
    if (this.pending()) return;
    const clamped = Math.max(0, Math.min(this.max(), v));
    if (clamped === this.value()) return;
    this.commit(clamped);
  }

  /** Apply a user's choice, then tell the host — both outputs, in that order. */
  private commit(next: number): void {
    const previous = this.value();
    this.value.set(next);
    this._revision.update((n) => n + 1);
    this.changed.emit(next);
    this._onChange(next);
    this.changeRequest.emit({
      value: next,
      previous,
      requestKey: svRequestKey('rating'),
      rollback: this._edit.begin(() => {
        this.value.set(previous);
        this._onChange(previous);
      }),
    });
  }

  onBlur(): void { this._onTouched(); }

  /** Arrow / Home / End keyboard control (half-step aware). */
  onKeydown(e: KeyboardEvent): void {
    if (!this.interactive()) return;
    const step = this.half() ? 0.5 : 1;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':   e.preventDefault(); this.setRating(this.value() + step); break;
      case 'ArrowLeft':
      case 'ArrowDown': e.preventDefault(); this.setRating(this.value() - step); break;
      case 'Home':      e.preventDefault(); this.setRating(0); break;
      case 'End':       e.preventDefault(); this.setRating(this.max()); break;
      default: return;
    }
  }

  hover(i: number, e?: MouseEvent): void {
    if (this.readonly() || this.resolvedDisabled() || this.pending()) return;
    if (this.half() && e) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const half = (e.clientX - rect.left) / rect.width < 0.5;
      this.hovered.set(half ? i - 0.5 : i);
    } else {
      this.hovered.set(i);
    }
  }

  clearHover(): void { this.hovered.set(0); }

  // ── Validation error ─────────────────────────────────────────────────────
  //
  // This control had no error slot at all: a form could reject it with no way
  // to say why. `serverError` outranks `errorMessage` while it is still about
  // the current value, and expires on the next change — see `createFieldError`.

  /** Client-side validation message. */
  errorMessage = input<string>('');
  /** A rejection reported by the server about this value. Self-expiring. */
  serverError = input<SvServerError>(null);

  protected readonly fieldError = createFieldError(this.value, this.serverError, this.errorMessage);
  protected readonly errorId = computed(() => `${this._errUid}-error`);
  protected readonly writeErrorId = computed(() => `${this._errUid}-write-error`);

  /** Validation error and failed-write message, whichever are showing. */
  protected readonly describedBy = computed(() => {
    const ids = [
      this.fieldError.showError() ? this.errorId() : '',
      this.writeErrorMessage() ? this.writeErrorId() : '',
    ].filter(Boolean);
    return ids.length ? ids.join(' ') : null;
  });
  private readonly _errUid = svUniqueId('sv-rating');

}
