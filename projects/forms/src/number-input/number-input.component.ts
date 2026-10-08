import {
  Component,
  input,
  output,
  computed,
  untracked,
  linkedSignal,
  signal,
  model,
  ChangeDetectionStrategy,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { svCurrencyAffix, svDescribedBy, svFormatNumber, svUniqueId } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NumberInputSize    = 'sm' | 'md' | 'lg';
export type NumberInputVariant = 'default' | 'currency' | 'percentage' | 'decimal';
export type NumberInputPreset  = 'default' | 'quantity';
/** When a typed value is forced into range — see `SvNumberInputComponent.clampOn`. */
export type NumberInputClamp   = 'blur' | 'input';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * NumberInput — A numeric input with increment/decrement controls.
 *
 * Supports:
 * - Angular signals two-way binding via `[(value)]`
 * - Reactive Forms via `ControlValueAccessor`
 * - Min / max / step constraints
 * - Prefix and suffix slots (currency symbol, %, units)
 * - Format presets: default, currency, percentage, decimal
 * - Layout presets: default, quantity (compact stepper with large +/– for PDP / cart)
 * - Label and hint text
 * - 3 sizes
 * - Disabled and readonly states
 */
@Component({
  selector: 'sv-number-input',
  standalone: true,
  imports: [SvIconComponent],
  templateUrl: './number-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvNumberInputComponent),
      multi: true,
    },
  ],
})
export class SvNumberInputComponent implements ControlValueAccessor {
  // ── Two-way binding ───────────────────────────────────────────────────────

  /** Current numeric value. Use `[(value)]` for two-way binding. @default 0 */
  value = model<number>(0);

  // ── Config ────────────────────────────────────────────────────────────────

  /** Minimum allowed value. @default -Infinity */
  min = input<number>(Number.NEGATIVE_INFINITY);

  /** Maximum allowed value. @default Infinity */
  max = input<number>(Number.POSITIVE_INFINITY);

  /** Step amount for increment/decrement. @default 1 */
  step = input<number>(1);

  /** Number of decimal places. @default 0 */
  decimals = input<number>(0);

  /**
   * When the typed value is forced into `[min, max]` and rounded to `decimals`.
   *
   * ── The defect this exists for (`FI-15-I1` / `FI-15-M2`) ──────────────────
   *
   * ★★★ CLAMPING EVERY KEYSTROKE FIGHTS THE PERSON TYPING. This component used
   *     to clamp and round inside `input`, and `[value]` is bound to the
   *     formatted result — so the field rewrote itself between characters. With
   *     `min = 10`, selecting the contents and typing `50` went: `5` → clamped
   *     to `10` → the box now reads "10" → the `0` lands after it → `100`. The
   *     user typed two characters and got three, and nothing about the control
   *     said why. With `decimals = 0`, `1.5` was unreachable for the same
   *     reason: the `.` rounded away before the `5` arrived.
   *
   * ★★ THE ROUNDING IS THE SAME BUG AS THE CLAMPING, so both defer. An item
   *    about "clamp timing" that left `toFixed` on every keystroke would fix the
   *    half you can see.
   *
   * `'blur'` (the default) lets the field hold what was typed while it is being
   * typed, and settles it when focus leaves. That value is genuinely out of
   * range in between — see `outOfRange`, which is why the control says so
   * rather than pretending.
   *
   * `'input'` restores the old behaviour for hosts that depend on the value
   * never leaving range, even transiently.
   * @default 'blur'
   */
  clampOn = input<NumberInputClamp>('blur');

  // ── Content ───────────────────────────────────────────────────────────────

  /** Label text above the input. */
  label = input<string>('');

  /** Hint text below the input (hidden when `errorMessage` is set). */
  hint = input<string>('');

  /** Error message shown below the input; sets `aria-invalid` and red styling. */
  errorMessage = input<string>('');

  /**
   * A validation failure reported by the **server** — the 422 that comes back
   * after submit, not something the client could have known.
   *
   * It is a separate input from `errorMessage` because it has a different
   * lifetime, not because it needs a second way to show a string. A server
   * error is a statement about *the value that was submitted*: the moment the
   * user edits the field it stops being true, and this input expires itself
   * rather than sitting there telling someone their new email is already taken.
   * `errorMessage` has no such expiry — it is the host's to clear.
   *
   * While live it outranks `errorMessage`: it is the more specific fact, and
   * it is the one the user has not seen yet.
   *
   * Typed structurally rather than as `SvDataError` so this stays dependency
   * free — an `SvDataError` satisfies it unchanged.
   * @default null
   */
  serverError = input<string | { readonly message: string } | null>(null);

  /**
   * The value `serverError` was reported against. Recomputed only when
   * `serverError` itself changes, so editing the field moves the value away
   * from the anchor and the error expires.
   */
  private readonly serverErrorAnchor = linkedSignal<
    string | { readonly message: string } | null,
    unknown
  >({
    source: this.serverError,
    computation: () => untracked(() => this.value()),
  });

  /** `serverError`, but only while it still describes the current value. */
  protected readonly liveServerError = computed(() => {
    const e = this.serverError();
    if (!e) return '';
    if (this.value() !== this.serverErrorAnchor()) return '';
    return typeof e === 'string' ? e : e.message;
  });

  /** What the error slot actually renders. Server first, then client. */
  readonly resolvedError = computed(() => this.liveServerError() || this.errorMessage());


  /** Placeholder text. @default '0' */
  placeholder = input<string>('0');

  /** Text/symbol shown to the left of the value (e.g. '$'). */
  prefix = input<string>('');

  /** Text/symbol shown to the right of the value (e.g. '%'). */
  suffix = input<string>('');

  /** Explicit id for the input. Auto-generated when omitted. */
  inputId = input<string>('');

  /** `aria-label` for the input when there is no visible `label`. */
  ariaLabel = input<string>('');

  /**
   * Ids of description text rendered **outside** this component, appended to
   * whatever `hint`/`errorMessage` already contribute.
   *
   * A composed control — a cart row that prints "Only 3 left" beside the title
   * rather than under the stepper — otherwise has no way to associate the two.
   * Passing the message in as `errorMessage` would render it twice; leaving it
   * unassociated means a screen-reader user hears the quantity and none of the
   * reason it is capped. Same rationale as `ariaLabel`: the visible thing lives
   * in the parent, so the parent has to be able to point at it.
   * @default ''
   */
  ariaDescribedby = input<string>('');

  /**
   * Mark the value invalid when the message explaining why is rendered by the
   * parent (paired with `ariaDescribedby`). `errorMessage`/`serverError` already
   * imply this; use it when the text is not ours to show.
   * @default false
   */
  invalid = input<boolean>(false);

  /** `name` for native form submission. */
  name = input<string>('');

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Size variant. @default 'md' */
  size = input<NumberInputSize>('md');

  /**
   * Format preset. Provides default `prefix`/`suffix` when you don't set them:
   * `percentage` → `'%'` suffix; `currency` → see `currency` below.
   * @default 'default'
   */
  variant = input<NumberInputVariant>('default');

  /**
   * ISO 4217 code — `'USD'`, `'EUR'`, `'JPY'`. @default ''
   *
   * ── The defect this closes (`FI-15-I3`) ──────────────────────────────────
   *
   * ★★★ `variant="currency"` MEANT `'$'`, FOR EVERYONE. The `prefix` input was
   *     the only way out, so every non-USD consumer was either broken or
   *     working around the variant they were told to use.
   *
   * ★★★ AND A PREFIX INPUT CANNOT FIX IT ANYWAY, WHICH IS THE PART WORTH
   *     SAYING. The position is not a constant. `de-DE` writes `1.234,50 €`
   *     and `fr-FR` writes `1 234,50 €` — symbol AFTER the number, with a
   *     non-breaking space. `de-CH` writes `CHF 1'234.50` — three letters,
   *     before, with a space. Half the world's money goes on the other end, and
   *     `prefix` can only ever produce the American shape.
   *
   * With `currency` set, the symbol and its side come from
   * `Intl.NumberFormat` for `locale` — the platform's own CLDR data, not a
   * table in this repo that is wrong the year after it is written.
   *
   * ⚠️ `variant="currency"` WITH NO `currency` STILL RENDERS `'$'`. That is a
   *    compatibility default, not a claim that dollars are neutral: changing it
   *    would silently alter what every existing caller renders. Set `currency`.
   */
  currency = input<string>('');

  /**
   * BCP-47 tag for the currency symbol's placement and the announced value.
   * @default '' — do not localise.
   *
   * ⚠️ `''` MEANS "DO NOT LOCALISE", NOT "USE THE BROWSER'S". Defaulting to the
   *    browser's locale would change what every existing caller renders the day
   *    they upgrade — a US app on a German laptop would start announcing
   *    commas. Opting in is the only version of this that is not a silent
   *    behaviour change.
   *
   * ★★★ IT DOES NOT LOCALISE THE BOX, AND IT CANNOT. This is an
   *     `<input type="number">`, whose IDL value is canonical **by
   *     specification** — `.` for the decimal, no grouping, and `''` for
   *     anything the browser cannot parse. So `1.234,50` cannot go in the
   *     field; writing it there produces an empty field. That is why
   *     `FI-15-I2`/`M1` are narrower here than they read: the browser owns the
   *     decimal separator for this control, and it does the job — a German user
   *     on a German browser types `12,5` and the element hands us `12.5`.
   *
   * ★★ WHAT IT DOES LOCALISE IS THE ANNOUNCEMENT, which the component builds
   *    itself and which nothing constrains. A screen-reader user gets
   *    `1.234,50 €` while the box shows `1234.50`, and that is the right way
   *    round: the box is a machine field, the announcement is for a person.
   *
   * ★★★ AND IT IS PUT ON THE INPUT AS `lang`, WHICH IS THE ONE THING THAT DOES
   *     REACH THE BOX (`FI-15-I2`). Browsers decide which decimal separator a
   *     `type="number"` field ACCEPTS from the element's language, not only
   *     from the browser's own — so `lang="de-DE"` is what lets a German user
   *     on an English browser type `12,5` at all. Without it the comma is
   *     rejected at the keyboard and they get `125`, silently, which is the
   *     defect `FI-15-I2` describes.
   *
   * ⚠️ THAT EFFECT IS THE BROWSER'S AND IS NOT VERIFIED BY THE SUITE. jsdom
   *    does not implement `type="number"` keyboard handling at all, so the spec
   *    asserts only that the attribute is set — which is the entire extent of
   *    what this component controls. Saying so is better than a test that
   *    appears to prove more than it does.
   */
  locale = input<string>('');

  /**
   * Layout preset. `quantity` renders a compact stepper with large +/– buttons,
   * sized for comfortable tapping on product pages and cart rows. @default 'default'
   */
  preset = input<NumberInputPreset>('default');

  // ── State ─────────────────────────────────────────────────────────────────

  /** Disable the input and buttons. @default false */
  disabled = input<boolean>(false);

  /** Make the input read-only (buttons still disabled). @default false */
  readonly = input<boolean>(false);

  /** Mark the field as required (native `required` + `aria-required`). @default false */
  required = input<boolean>(false);

  /** Autofocus the input on render. @default false */
  autofocus = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emits the new value after each change. */
  changed = output<number>();

  // ── CVA internals ────────────────────────────────────────────────────────

  private _onChange: (v: number) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);

  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  /** Stable unique fallback id so the label association always works. */
  private readonly _autoId = svUniqueId('sv-number');
  /** Effective id used by the input and its <label for>. */
  readonly resolvedId = computed(() => this.inputId() || this._autoId);
  /** id of the visible label (referenced by aria-labelledby). */
  readonly labelId    = computed(() => `${this.resolvedId()}-label`);
  /** id of the hint/error description (referenced by aria-describedby). */
  readonly descId     = computed(() => `${this.resolvedId()}-desc`);
  /** True when a hint or error description is rendered. */
  readonly hasDescription = computed(() => !!this.resolvedError() || !!this.hint());

  /** Every id describing the input: the parent's first, then our own slot. */
  readonly describedBy = computed<string | null>(() =>
    svDescribedBy({
      hint: this.hasDescription() && this.descId(),
      // ⚠️ The host's own ids now come AFTER the component's description rather
      // than before it. Deliberate: the field's own hint and rejection are the
      // primary description, and a host adding to them is adding. The previous
      // order was never chosen — it fell out of how the array happened to be
      // written.
      extra: [this.ariaDescribedby().trim()],
    }),
  );

  /** The value is invalid — we know why, the parent says so, or it is out of range. */
  readonly isInvalid = computed<boolean>(
    () => !!this.resolvedError() || this.invalid() || this.outOfRange(),
  );
  /** True when a visible text label is rendered. */
  readonly hasVisibleLabel = computed(() => !!this.label());

  /**
   * What the +/- buttons say they act on.
   *
   * `ariaLabel` counts, not just `label`: a composed control names the field that
   * way (a cart row passes "Quantity, Aurora Runner"), and falling straight
   * through to "value" gave every row in a list two buttons called "Increase
   * value" — indistinguishable from the next row's.
   */
  readonly stepperTarget = computed<string>(() => this.label() || this.ariaLabel() || 'value');

  /** Whether the compact quantity layout preset is active. */
  readonly qtyMode = computed(() => this.preset() === 'quantity');

  /** The currency symbol and which side it goes, from the platform's CLDR data. */
  private readonly currencyAffix = computed(() => svCurrencyAffix(this.locale(), this.currency()));

  /**
   * Prefix to display — explicit value, then the currency, then the variant.
   *
   * ★ `prefix` still wins. It is the escape hatch that existed before
   *   `currency` did, and a host using it has already decided.
   */
  readonly effectivePrefix = computed<string>(() => {
    if (this.prefix()) return this.prefix();
    const affix = this.currencyAffix();
    if (affix.symbol && affix.position === 'before') return affix.symbol + affix.spacing;
    if (affix.symbol) return '';
    // ⚠️ The legacy default. See the `currency` input: changing it would alter
    //    what every existing caller renders.
    return this.variant() === 'currency' ? '$' : '';
  });

  /** Suffix to display — explicit value, then the currency, then the variant. */
  readonly effectiveSuffix = computed<string>(() => {
    if (this.suffix()) return this.suffix();
    const affix = this.currencyAffix();
    if (affix.symbol && affix.position === 'after') return affix.spacing + affix.symbol;
    return this.variant() === 'percentage' ? '%' : '';
  });
  /**
   * Accessible value text including prefix/suffix (announced by screen readers).
   *
   * ★★ THIS IS THE ONE STRING THE COMPONENT FULLY OWNS, so it is the one that
   *    can be localised. The box must hold `1234.50` because
   *    `<input type="number">` says so; the announcement has no such
   *    constraint, and `1.234,50 €` is what a German screen-reader user should
   *    hear. The box is a machine field; this is for a person.
   *
   * ★ It uses the SETTLED value, not the draft. Announcing a half-typed `12.` is
   *   noise, and `aria-valuetext` is re-read on every change.
   */
  readonly valueText = computed<string>(() => {
    const p = this.effectivePrefix();
    const s = this.effectiveSuffix();
    const n = this.locale()
      ? svFormatNumber(this.value(), this.decimals(), this.locale())
      : this.displayValue();
    return p || s ? `${p}${n}${s}` : (this.locale() ? n : '');
  });

  // ★ A programmatic write — a form reset, a server echo — DOES clear the draft.
  //   It is the host stating a value, not an input signal drifting underneath a
  //   focused field, and a reset the user cannot see is a reset that did not
  //   happen.
  writeValue(val: number): void         { this._draft.set(null); this.value.set(val ?? 0); }
  registerOnChange(fn: (v: number) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this._formDisabled.set(isDisabled); }

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly canDecrement = computed<boolean>(() =>
    !this.resolvedDisabled() && !this.readonly() && this.value() > this.min()
  );

  readonly canIncrement = computed<boolean>(() =>
    !this.resolvedDisabled() && !this.readonly() && this.value() < this.max()
  );

  /**
   * What the user has typed, while they are typing it. `null` when settled.
   *
   * ★★★ WITHOUT THIS THE DEFERRED CLAMP BUYS NOTHING. `[value]` is bound to
   *     `displayValue()`, so re-formatting the number on every keystroke writes
   *     the formatted text back into the element the user is typing in — the
   *     same fight, entered through the template instead of the handler. While a
   *     draft is held, the binding echoes the raw text and Angular writes back
   *     the string that is already there, so the caret stays put.
   *
   * ★★ It also means an external `value` change is NOT yanked into a focused
   *    field. That is the right behaviour on its own merits: a value arriving
   *    from a form reset or a server echo has no business overwriting a
   *    half-typed number under the cursor.
   */
  private readonly _draft = signal<string | null>(null);

  readonly displayValue = computed<string>(() =>
    this._draft() ?? this.value().toFixed(this.decimals())
  );

  /**
   * The current value sits outside `[min, max]`.
   *
   * ★★★ ONLY REACHABLE BECAUSE CLAMPING DEFERS, AND THAT IS EXACTLY WHY IT HAS
   *     TO BE SHOWN. Allowing a transient out-of-range value and saying nothing
   *     would replace a control that fought the user with one that lied to them.
   *     It self-heals on blur, so this is a state you see while typing `500`
   *     into a field that stops at `100`, not one you can submit by accident.
   */
  readonly outOfRange = computed<boolean>(
    () => this.value() < this.min() || this.value() > this.max(),
  );

  readonly inputHeight = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-8 text-xs';
      case 'lg': return 'h-11 text-base';
      default:   return 'h-9 text-sm';
    }
  });

  readonly btnSize = computed<string>(() => {
    if (this.qtyMode()) return 'h-11 w-11 text-lg';
    switch (this.size()) {
      case 'sm': return 'h-8 w-8 text-xs';
      case 'lg': return 'h-11 w-11 text-base';
      default:   return 'h-9 w-9 text-sm';
    }
  });

  readonly labelSize = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'text-xs';
      case 'lg': return 'text-base';
      default:   return 'text-sm';
    }
  });

  readonly hintColorClass = computed<string>(() =>
    this.resolvedError()
      ? 'text-danger-600 dark:text-danger-400'
      : 'text-gray-500 dark:text-gray-400'
  );

  // ── Preset-aware class helpers ─────────────────────────────────────────────

  private readonly _btnBase =
    'flex shrink-0 items-center justify-center font-bold transition-all duration-100 ' +
    'disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-primary-400';

  private readonly _btnColor = computed<string>(() =>
    this.qtyMode()
      ? 'bg-white text-gray-600 hover:bg-primary-50 hover:text-primary-600 active:bg-primary-100 ' +
        'dark:bg-gray-800/40 dark:text-gray-300 dark:hover:bg-primary-900/20 dark:hover:text-primary-300'
      : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:bg-gray-200 ' +
        'dark:bg-gray-700/60 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
  );

  /** Radius + width of the input group (compact + rounder in quantity preset). */
  readonly groupClass = computed<string>(() => {
    const shape = this.qtyMode() ? 'rounded-xl w-fit' : 'rounded-md';
    // `isInvalid`, not `resolvedError`: a parent that renders the message itself
    // still needs the field to look wrong, or the border and `aria-invalid`
    // disagree about the same value.
    const border = this.isInvalid()
      ? 'border-danger-400 focus-within:border-danger-500 focus-within:ring-danger-100 dark:border-danger-500 dark:focus-within:ring-danger-900/30'
      : 'border-gray-300 focus-within:border-primary-500 focus-within:ring-primary-100 dark:border-gray-600 dark:focus-within:border-primary-500 dark:focus-within:ring-primary-900/30';
    return `${shape} ${border}` + (this.resolvedDisabled() ? ' opacity-50 cursor-not-allowed' : '');
  });

  readonly decBtnClass = computed<string>(() => {
    const radius = this.qtyMode() ? 'rounded-l-[11px]' : 'rounded-l-[5px]';
    return `${this._btnBase} ${radius} border-r border-gray-200 dark:border-gray-700 ${this._btnColor()} ${this.btnSize()}`;
  });

  readonly incBtnClass = computed<string>(() => {
    const radius = this.qtyMode() ? 'rounded-r-[11px]' : 'rounded-r-[5px]';
    return `${this._btnBase} ${radius} border-l border-gray-200 dark:border-gray-700 ${this._btnColor()} ${this.btnSize()}`;
  });

  /** Icon dimensions — a touch larger in the quantity preset. */
  readonly iconSize = computed<string>(() => (this.qtyMode() ? 'h-4 w-4' : 'h-3.5 w-3.5'));

  /** Input box sizing — fixed compact width in quantity preset, else flex-1. */
  readonly inputBoxClass = computed<string>(() =>
    this.qtyMode() ? 'w-16 h-11 text-base' : `flex-1 ${this.inputHeight()}`
  );

  // ── Interaction ───────────────────────────────────────────────────────────

  increment(): void {
    if (!this.canIncrement()) return;
    // ★ The stepper is a statement of a number, not a keystroke on the way to
    //   one, so it supersedes an unsettled draft rather than sitting behind it.
    this._draft.set(null);
    this.emit(this.clamp(+(this.value() + this.step()).toFixed(this.decimals())));
  }

  decrement(): void {
    if (!this.canDecrement()) return;
    this._draft.set(null);
    this.emit(this.clamp(+(this.value() - this.step()).toFixed(this.decimals())));
  }

  /**
   * Force a number into `[min, max]`.
   *
   * ★ The stepper clamps BOTH ends, not only the one it moves toward. With
   *   `clampOn = 'blur'` a typed value can sit outside the range while the field
   *   is focused (`500` in a max-100 box), and pressing ↓ from there used to
   *   produce `499` — a step that stays out of range and looks like the field
   *   ignored the key. It now lands on `100`, the nearest value that is valid.
   */
  private clamp(v: number): number {
    return Math.max(this.min(), Math.min(this.max(), v));
  }

  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const num = parseFloat(raw);

    if (this.clampOn() === 'input') {
      if (!isNaN(num)) {
        this.emit(Math.max(this.min(), Math.min(this.max(), +num.toFixed(this.decimals()))));
      }
      return;
    }

    this._draft.set(raw);
    // ★ `-`, `.`, `1e` and an empty box are all states on the way to a number.
    //   The last committed value stands until one arrives; blur settles whatever
    //   is left.
    if (isNaN(num)) return;
    // Exactly what was typed. Not clamped, not rounded — that is the point.
    this.emit(num);
  }

  /**
   * Settle the field: round, clamp, and drop the draft.
   *
   * ★★ A DRAFT THAT IS NOT A NUMBER IS DISCARDED, NOT COMMITTED. Leaving the
   *    field on `-` or an empty box restores the last committed value rather
   *    than writing `NaN` or silently choosing `0` — the user removed some
   *    characters, they did not state a new number.
   */
  onBlur(): void {
    // ★★ `touched` NOW MEANS TOUCHED. `emit()` used to call `_onTouched()` on
    //    every keystroke, so a control was "touched" from the first character —
    //    which makes the flag useless for its one job, deciding when a form may
    //    start showing errors at somebody. There was no blur handler to own it
    //    before; now there is.
    this._onTouched();
    this.settle();
  }

  /** Round, clamp and drop the draft — shared by blur and Enter. */
  private settle(): void {
    if (this.clampOn() === 'input') return;

    const draft = this._draft();
    this._draft.set(null);
    if (draft === null) return;

    const num = parseFloat(draft);
    if (isNaN(num)) return;
    const settled = this.clamp(+num.toFixed(this.decimals()));
    if (settled !== this.value()) this.emit(settled);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp')   { event.preventDefault(); this.increment(); }
    if (event.key === 'ArrowDown') { event.preventDefault(); this.decrement(); }
    // ★★ ENTER SETTLES, because Enter in a form SUBMITS without a blur. A
    //    deferred clamp that only ran on blur let `500` in a max-100 field
    //    reach `(ngSubmit)` untouched. `keydown` fires before the implicit
    //    submission, so the form model holds the settled value by the time
    //    the submit handler reads it. Default is NOT prevented — submission
    //    still happens; it just happens with a valid number.
    if (event.key === 'Enter') this.settle();
  }

  private emit(v: number): void {
    this.value.set(v);
    this._onChange(v);
    this.changed.emit(v);
  }
}
