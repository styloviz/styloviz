import {
  Component,
  input,
  output,
  computed,
  signal,
  model,
  forwardRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  SvFieldErrorComponent,
  createFieldError,
  svPointerFraction,
  type SvServerError,
  svUniqueId,
} from '@styloviz/core';
import { SvNumberInputComponent } from '../number-input/number-input.component';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SliderVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
export type SliderSize    = 'sm' | 'md' | 'lg';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Slider — A range input for selecting numeric values.
 *
 * Supports:
 * - Single value via `[(value)]`
 * - Range (two-handle) via `[(rangeStart)]` + `[(rangeEnd)]`
 * - Step, min, max constraints
 * - Formatted value display (prefix, suffix)
 * - Tick marks (single mode)
 * - 3 sizes × 5 color variants
 * - Disabled state
 * - Premium range slider with floating value bubbles
 */
@Component({
  selector: 'sv-slider',
  standalone: true,
  imports: [SvFieldErrorComponent, SvNumberInputComponent],
  templateUrl: './slider.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvSliderComponent),
      multi: true,
    },
  ],
})
export class SvSliderComponent implements ControlValueAccessor {
  // ── Two-way bindings ──────────────────────────────────────────────────────

  /** Single slider value. Use `[(value)]` for two-way binding. @default 50 */
  value = model<number>(50);

  /** Range slider lower bound. Use with `range=true`. @default 20 */
  rangeStart = model<number>(20);

  /** Range slider upper bound. Use with `range=true`. @default 80 */
  rangeEnd = model<number>(80);

  // ── Config ────────────────────────────────────────────────────────────────

  /** Enable range (two-handle) mode. @default false */
  range = input<boolean>(false);

  /**
   * Smallest allowed distance between the two handles. `null` uses one `step`.
   * @default null
   *
   * ── Why this input exists (`FI-24-M2`) ────────────────────────────────────
   *
   * ★★ THE GAP WAS ALREADY THERE AND NOBODY HAD SAID SO. The handlers clamped
   *    `start` to `end - step` and `end` to `start + step`, so the handles could
   *    never actually meet — a one-step minimum enforced as a side effect of
   *    clamping, documented nowhere, and impossible to change. A price filter
   *    that must span at least £50 had to police it from outside and fight the
   *    component's own clamp on the way.
   *
   * ★ `null` rather than a numeric default so the existing behaviour keeps
   *   tracking `step` when `step` changes, instead of freezing at whatever
   *   `step` happened to be when this input was added.
   */
  minGap = input<number | null>(null);

  /**
   * Render a number field bound to each handle. @default false
   *
   * ── Why a slider needs one (`FI-24-M1`, mitigating `FI-24-I3`) ────────────
   *
   * ★★★ A SLIDER IS A TERRIBLE WAY TO STATE AN EXACT NUMBER. On a 0–10,000
   *     track, one pixel is tens of units: "about 4,200" is the best a drag can
   *     do, and if the answer has to be 4,250 the control simply cannot express
   *     it. Keyboard arrows can, one step at a time, which on that track is 200
   *     presses. The standard mitigation is to pair the track with a field, and
   *     every serious price filter on the web does exactly this.
   *
   * ★★ THE FIELD IS NOT A SECOND CONTROL, IT IS THE SAME ONE. It writes through
   *    the same handlers the handles use, so `minGap`, `min`, `max` and `step`
   *    hold identically however the number arrived — and a host binding
   *    `[(rangeStart)]` sees one value, not two that can disagree.
   *
   * ★ The field clamps on BLUR, not per keystroke (`sv-number-input`'s own
   *   default). Typing "4250" into a field that clamps every character never
   *   gets past the first digit that leaves range.
   */
  showInputs = input<boolean>(false);

  /** The gap actually enforced — the stated one, else a single step. */
  readonly resolvedMinGap = computed<number>(() => {
    const stated = this.minGap();
    return stated === null || stated < 0 ? this.step() : stated;
  });

  /** Minimum value. @default 0 */
  min = input<number>(0);

  /** Maximum value. @default 100 */
  max = input<number>(100);

  /** Step increment. @default 1 */
  step = input<number>(1);

  /** Optional label above the slider. */
  label = input<string>('');

  /** Explicit id forwarded to the (single) native input. Auto-generated when omitted. */
  inputId = input<string>('');

  /** `aria-label` for the slider when there is no visible `label`. */
  ariaLabel = input<string>('');

  /**
   * Show the current value.
   *
   * ★★ THIS USED TO BE IGNORED IN RANGE MODE. The single slider honoured it;
   *    the two-handle one drew its value bubbles unconditionally, so a host
   *    that had already rendered a formatted range above the track — the normal
   *    thing to do for money, where `4000000` is not a label anybody wants —
   *    got the raw numbers printed on top of it anyway, with no way to turn
   *    them off. One input, one meaning, both modes.
   * @default true
   */
  showValue = input<boolean>(true);

  /**
   * Turn a raw value into the text on the bubbles and the min/max labels.
   *
   * ★ A price range slider is the case this exists for. Without it the scale
   *   under the track reads `200000 … 4000000`, which is a number a computer
   *   wrote; with `formatMoneyShort` it reads `$200k … $4M`. `prefix`/`suffix`
   *   cannot do this — they concatenate, they do not format, so no combination
   *   of them produces a grouped or abbreviated figure.
   *
   *   Pass a STABLE reference (a class field or a bound method), not an arrow
   *   written in the template: a new function identity on every change
   *   detection pass defeats the memoisation on the computed signals below.
   * @default null
   */
  valueFormat = input<((value: number) => string) | null>(null);

  /** Text prefix for value display (e.g. '$'). */
  prefix = input<string>('');

  /** Text suffix for value display (e.g. '%'). */
  suffix = input<string>('');

  /** Show tick marks below the track (single mode only). @default false */
  showTicks = input<boolean>(false);

  /** Number of visible tick marks (evenly spaced). @default 5 */
  tickCount = input<number>(5);

  /** Disable interaction. @default false */
  disabled = input<boolean>(false);

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Color variant. @default 'primary' */
  variant = input<SliderVariant>('primary');

  /** Size — controls track height and thumb size. @default 'md' */
  size = input<SliderSize>('md');

  // ── Outputs ───────────────────────────────────────────────────────────────
  // Note: the `value` model already emits `valueChange` automatically.

  /** Emits updated range as [start, end]. */
  rangeChange = output<[number, number]>();

  // ── ControlValueAccessor (binds the single `value`) ────────────────────────

  private _onChange: (v: number) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);

  /** Merged disabled state — `[disabled]` input OR `formControl.disable()`. */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  /** Stable unique fallback id so the label association always works. */
  private readonly _autoId = svUniqueId('sv-slider');
  /** Effective id used by the single native input and its <label for>. */
  readonly resolvedId = computed(() => this.inputId() || this._autoId);

  writeValue(val: number): void {
    if (val !== null && val !== undefined && !Number.isNaN(Number(val))) {
      this.value.set(Number(val));
    }
  }
  registerOnChange(fn: (v: number) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this._formDisabled.set(isDisabled); }

  // ── Computed: layout ─────────────────────────────────────────────────────

  /** Wrapper height = thumb diameter so the thumb centers on the track naturally. */
  readonly wrapHeight = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-3.5';
      case 'lg': return 'h-5';
      default:   return 'h-4';
    }
  });

  readonly trackHeight = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-1';
      case 'lg': return 'h-2.5';
      default:   return 'h-1.5';
    }
  });

  // ── Computed: fill ───────────────────────────────────────────────────────

  /**
   * Where `v` sits along the track, 0–100.
   *
   * `min` and `max` are the host's, so the span can legitimately be zero — a
   * budget slider over a single allowed price, a date range of one day. The
   * division then yields `NaN`, and `\`${NaN}%\`` is not a length: the browser
   * drops the declaration outright, so the fill does not degrade, it vanishes.
   * Returning 0 keeps an empty bar, which is at least true.
   */
  private position(v: number): number {
    const span = this.max() - this.min();
    if (!Number.isFinite(span) || span === 0) return 0;
    return Math.max(0, Math.min(100, ((v - this.min()) / span) * 100));
  }

  readonly fillPercent = computed<string>(() => `${this.position(this.value())}%`);

  readonly rangeFillLeft = computed<string>(() => `${this.position(this.rangeStart())}%`);

  readonly rangeFillRight = computed<string>(() => `${this.position(this.rangeEnd())}%`);

  /** CSS right inset for the active fill div (100% - rightHandle%) */
  readonly rangeFillRightInset = computed<string>(
    () => `${100 - this.position(this.rangeEnd())}%`,
  );

  // ── Computed: display ─────────────────────────────────────────────────────

  /**
   * One funnel for every number this component prints.
   *
   * `valueFormat` replaces the raw number; `prefix`/`suffix` still wrap
   * whatever comes out, so `[valueFormat]` and `suffix="%"` compose rather than
   * fight. Everything the reader sees AND everything assistive tech is told
   * goes through here — a slider whose bubble says "$1.2M" while its
   * `aria-valuetext` says "1200000" is two different sliders.
   */
  private format(value: number): string {
    const formatter = this.valueFormat();
    return `${this.prefix()}${formatter ? formatter(value) : value}${this.suffix()}`;
  }

  readonly displayValue = computed<string>(() => this.format(this.value()));

  readonly displayStart = computed<string>(() => this.format(this.rangeStart()));

  readonly displayEnd = computed<string>(() => this.format(this.rangeEnd()));

  /** The scale under the track — formatted the same way as the handles. */
  readonly displayMin = computed<string>(() => this.format(this.min()));
  readonly displayMax = computed<string>(() => this.format(this.max()));

  /** Tick labels, through the same funnel. Every number the slider prints agrees. */
  tickLabel(tick: number): string {
    return this.format(tick);
  }

  // Accessible value text — announces the formatted value (with prefix/suffix).
  readonly valueText = computed<string>(() => this.displayValue());
  readonly startText = computed<string>(() => this.displayStart());
  readonly endText   = computed<string>(() => this.displayEnd());

  /** Accessible name for the single slider (label takes precedence). */
  readonly singleAriaLabel = computed<string>(() => this.ariaLabel() || this.label());

  /** Accessible names for the two range handles, prefixed with the label. */
  private readonly _groupName = computed<string>(() => this.ariaLabel() || this.label());
  readonly startAriaLabel = computed<string>(() => {
    const n = this._groupName();
    return n ? `${n} minimum` : 'Range minimum';
  });
  readonly endAriaLabel = computed<string>(() => {
    const n = this._groupName();
    return n ? `${n} maximum` : 'Range maximum';
  });

  readonly ticks = computed<number[]>(() => {
    const count = this.tickCount();
    // `i / (count - 1)` spreads N ticks across the span — and is 0/0 for a
    // single tick, which rendered the string "NaN" under the track.
    if (count <= 0) return [];
    if (count === 1) return [this.min()];
    return Array.from({ length: count }, (_, i) =>
      Math.round(this.min() + (i / (count - 1)) * (this.max() - this.min())),
    );
  });

  // ── Computed: colors ──────────────────────────────────────────────────────

  readonly fillColor = computed<string>(() => {
    const map: Record<SliderVariant, string> = {
      primary: 'bg-primary-500',
      success: 'bg-accent-500',
      warning: 'bg-warning-500',
      danger:  'bg-danger-500',
      neutral: 'bg-gray-500',
    };
    return map[this.variant()];
  });

  /**
   * ★★ THE BUBBLE CARRIES ITS OWN INK, BECAUSE ONE INK CANNOT SERVE FIVE FILLS.
   *
   * The template used to say `text-white` and leave the fill to this map, which
   * put white on `accent-600` at 3.65:1 and on `warning-500` at 2.13:1 — the
   * value a user reads while dragging, unreadable on two of five variants. Moving
   * the ink in here is the same answer `indicatorClass` reached for the same
   * reason: `warning` keeps its yellow and takes near-black text, because white
   * needs `warning-700` and `warning-700` is not yellow any more.
   *
   * It also has to be here rather than a second `text-` in the template, since two
   * competing ink classes on one element resolve by stylesheet order, which is
   * Tailwind's to decide and not this component's.
   */
  readonly bubbleColor = computed<string>(() => {
    const map: Record<SliderVariant, string> = {
      primary: 'bg-primary-600 text-white',
      success: 'bg-accent-700 text-white',
      warning: 'bg-warning-500 text-gray-900',
      danger:  'bg-danger-600 text-white',
      neutral: 'bg-gray-700 text-white',
    };
    return map[this.variant()];
  });

  // ── Computed: thumb classes ───────────────────────────────────────────────

  /** Single slider thumb: size + color ring. */
  readonly singleThumbClasses = computed<string>(() => {
    const sizeMap: Record<SliderSize, string> = {
      sm: '[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5',
      md: '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4',
      lg: '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5',
    };
    const colorMap: Record<SliderVariant, string> = {
      primary: '[&::-webkit-slider-thumb]:bg-primary-600 [&::-webkit-slider-thumb]:ring-primary-200 [&::-moz-range-thumb]:bg-primary-600',
      success: '[&::-webkit-slider-thumb]:bg-accent-600 [&::-webkit-slider-thumb]:ring-accent-200 [&::-moz-range-thumb]:bg-accent-600',
      warning: '[&::-webkit-slider-thumb]:bg-warning-500 [&::-webkit-slider-thumb]:ring-warning-200 [&::-moz-range-thumb]:bg-warning-500',
      danger:  '[&::-webkit-slider-thumb]:bg-danger-600 [&::-webkit-slider-thumb]:ring-danger-200 [&::-moz-range-thumb]:bg-danger-600',
      neutral: '[&::-webkit-slider-thumb]:bg-gray-600 [&::-webkit-slider-thumb]:ring-gray-200 [&::-moz-range-thumb]:bg-gray-600',
    };
    // Stronger ring on keyboard focus for a clear focus indicator.
    const focusRing = 'focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-moz-range-thumb]:ring-2';
    return `${sizeMap[this.size()]} ${colorMap[this.variant()]} ${focusRing}`;
  });

  /** Range slider thumb: size + color ring (same for both handles). */
  readonly rangeThumbClasses = computed<string>(() => {
    const sizeMap: Record<SliderSize, string> = {
      sm: '[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5',
      md: '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4',
      lg: '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5',
    };
    const colorMap: Record<SliderVariant, string> = {
      primary: '[&::-webkit-slider-thumb]:bg-primary-600 [&::-webkit-slider-thumb]:ring-primary-300 [&::-moz-range-thumb]:bg-primary-600',
      success: '[&::-webkit-slider-thumb]:bg-accent-600 [&::-webkit-slider-thumb]:ring-accent-300 [&::-moz-range-thumb]:bg-accent-600',
      warning: '[&::-webkit-slider-thumb]:bg-warning-500 [&::-webkit-slider-thumb]:ring-warning-300 [&::-moz-range-thumb]:bg-warning-500',
      danger:  '[&::-webkit-slider-thumb]:bg-danger-600 [&::-webkit-slider-thumb]:ring-danger-300 [&::-moz-range-thumb]:bg-danger-600',
      neutral: '[&::-webkit-slider-thumb]:bg-gray-600 [&::-webkit-slider-thumb]:ring-gray-300 [&::-moz-range-thumb]:bg-gray-600',
    };
    const focusRing = 'focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-moz-range-thumb]:ring-2';
    return `${sizeMap[this.size()]} ${colorMap[this.variant()]} ${focusRing}`;
  });

  // ── Which handle the pointer gets (FI-24-I1) ──────────────────────────────
  //
  // The two handles are stacked native `<input type="range">` elements filling
  // the same box, so WHICH ONE A CLICK REACHES IS DECIDED BY Z-ORDER — the
  // component cannot intercept the hit test, only arrange it in advance.
  //
  // ★★★ THE OLD RULE WAS A MAGIC NUMBER THAT COVERED ONE CASE OF THREE.
  //     `position(start) >= 97 ? start on top : end on top`. It handles "both
  //     handles jammed against the maximum", and nothing else:
  //
  //     • start 50 / end 51, in the middle of the track. End is on top. A user
  //       reaching for START grabs END, which is already at its lower clamp, so
  //       dragging left does nothing at all. The only way to move the start
  //       handle is to drag the end one out of the way first — and nothing on
  //       screen says so.
  //     • 97 % is not "adjacent", it is "near the right edge". On a long track
  //       two handles a pixel apart at 40 % are as stuck as two at 99 %.

  /** Value under the pointer, from the last hover over the track. */
  private readonly _pointerValue = signal<number | null>(null);

  /**
   * Track the pointer so the right handle is already on top when the click
   * lands.
   *
   * ⚠️ HOVER IS A MOUSE AND PEN CONCEPT. A touch has no "before", so the first
   *    tap uses the fallback rule below and a drag corrects from there. That is
   *    a real limitation of stacked native inputs and is better stated than
   *    papered over.
   */
  onTrackPointerMove(event: PointerEvent): void {
    const el = event.currentTarget as HTMLElement;
    if (el.getBoundingClientRect().width === 0) return;
    /**
     * ★★★ `(clientX - rect.left) / rect.width` HAS A DIRECTION IN IT AND THE
     *     DIRECTION IS LTR (`FI-24-I2`). `clientX` and `rect.left` are physical
     *     coordinates; the fraction this needs is logical. In an RTL slider the
     *     handle at `max` is drawn at the physical LEFT, so the old expression
     *     reported `0` where the value was `max` — and this fraction is what
     *     `startOnTop` uses to decide WHICH HANDLE a click reaches. The wrong
     *     handle was picked, and then it moved the wrong way.
     *
     * ⚠️ This is the one part of the RTL fix that CSS cannot do. The fill and
     *    the bubbles moved to `inset-inline-*`, which the browser resolves from
     *    the same `direction` the native input reads, so those two cannot
     *    disagree. A pointer coordinate has no logical equivalent.
     */
    const frac = svPointerFraction(event.clientX, el);
    this._pointerValue.set(this.min() + frac * (this.max() - this.min()));
  }

  onTrackPointerLeave(): void { this._pointerValue.set(null); }

  /**
   * Whether the START handle is the one a click will reach.
   *
   * ① Nearest handle to the pointer, when there is a pointer and it is not
   *    exactly equidistant. This is the rule users expect and the one that fixes
   *    two adjacent handles anywhere on the track.
   * ② Otherwise the handle that has somewhere to go: if `end` is pinned at `max`
   *    and `start` is not at `min`, only `start` can usefully move. This is the
   *    exact form of what the 97 % threshold was approximating.
   * ③ Otherwise `end`, which is the conventional default and the one that keeps
   *    a fresh range slider behaving as it always has.
   */
  readonly startOnTop = computed<boolean>(() => {
    const p = this._pointerValue();
    if (p !== null) {
      const ds = Math.abs(p - this.rangeStart());
      const de = Math.abs(p - this.rangeEnd());
      if (ds !== de) return ds < de;
    }
    return this.rangeEnd() >= this.max() && this.rangeStart() > this.min();
  });

  readonly startZIndex = computed<string>(() => (this.startOnTop() ? 'z-20' : 'z-10'));
  readonly endZIndex   = computed<string>(() => (this.startOnTop() ? 'z-10' : 'z-20'));

  // ── Interaction ───────────────────────────────────────────────────────────

  onSingleChange(event: Event): void {
    const v = Number((event.target as HTMLInputElement).value);
    this.value.set(v);          // model.set() auto-emits valueChange
    this._onChange(v);
    this._onTouched();
  }

  onSingleBlur(): void { this._onTouched(); }

  // ── Paired number fields (FI-24-M1) ───────────────────────────────────────
  //
  // These go through the SAME clamping as the handles rather than writing the
  // models directly. Two paths to one value that clamp differently is how a
  // range ends up with `start` past `end` and no error anywhere.

  /**
   * Decimal places for the paired fields, inferred from `step`.
   *
   * ★ A `step` of `0.5` with a whole-number field is a field that cannot express
   *   half the values the track can. Inferring beats another input nobody would
   *   remember to set in step with `step`.
   */
  readonly inputDecimals = computed<number>(() => {
    const str = String(this.step());
    const dot = str.indexOf('.');
    return dot === -1 ? 0 : str.length - dot - 1;
  });

  /** A number typed into the single-value field. */
  setValueFromInput(v: number): void {
    const clamped = Math.max(this.min(), Math.min(this.max(), v));
    if (clamped === this.value()) return;
    this.value.set(clamped);
    this._onChange(clamped);
    this._onTouched();
  }

  /** A number typed into the range-start field. */
  setRangeStartFromInput(v: number): void {
    const clamped = Math.max(
      this.min(),
      Math.min(v, this.rangeEnd() - this.resolvedMinGap()),
    );
    if (clamped === this.rangeStart()) return;
    this.rangeStart.set(clamped);
    this.rangeChange.emit([clamped, this.rangeEnd()]);
  }

  /** A number typed into the range-end field. */
  setRangeEndFromInput(v: number): void {
    const clamped = Math.min(
      this.max(),
      Math.max(v, this.rangeStart() + this.resolvedMinGap()),
    );
    if (clamped === this.rangeEnd()) return;
    this.rangeEnd.set(clamped);
    this.rangeChange.emit([this.rangeStart(), clamped]);
  }

  onRangeStartChange(event: Event): void {
    const el = event.target as HTMLInputElement;
    const v = Math.min(Number(el.value), this.rangeEnd() - this.resolvedMinGap());
    this.syncThumb(el, v);
    this.rangeStart.set(v);
    this.rangeChange.emit([v, this.rangeEnd()]);
  }

  onRangeEndChange(event: Event): void {
    const el = event.target as HTMLInputElement;
    const v = Math.max(Number(el.value), this.rangeStart() + this.resolvedMinGap());
    this.syncThumb(el, v);
    this.rangeEnd.set(v);
    this.rangeChange.emit([this.rangeStart(), v]);
  }

  /**
   * Put a clamped value back into the native input.
   *
   * 🔺 `[value]` only writes when the MODEL changes. Drag the start handle into
   *    the gap once and the model settles at `end − minGap`; drag it in again
   *    and the model does not move — so Angular writes nothing, and the native
   *    thumb sits wherever the pointer left it, past the gap and even past the
   *    end handle, while the fill, the bubble and the form value all say
   *    otherwise. The clamp held in the data and not on screen.
   */
  private syncThumb(el: HTMLInputElement, v: number): void {
    if (Number(el.value) !== v) el.value = String(v);
  }

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
  private readonly _errUid = svUniqueId('sv-slider');

}
