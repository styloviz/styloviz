import {
  AfterViewInit,
  Component,
  input,
  output,
  model,
  computed,
  signal,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
  forwardRef,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
  Validator,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import {
  createFieldError,
  svDescribedBy,
  SvAutofillDirective,
  SvSpinnerArcComponent,
  svCompilePattern,
  svUniqueId,
} from '@styloviz/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputType =
  | 'text' | 'email' | 'password' | 'number' | 'tel'
  | 'url'  | 'search' | 'date' | 'datetime-local' | 'time'
  | 'month' | 'week' | 'color';

export type InputSize    = 'sm' | 'md' | 'lg';
export type InputVariant = 'default' | 'filled' | 'flushed';
export type InputState   = 'default' | 'error' | 'success' | 'warning';

export type InputMode =
  | 'none' | 'text' | 'decimal' | 'numeric'
  | 'tel'  | 'search' | 'email' | 'url';

/**
 * A single option for select / datalist suggestion.
 */
export interface InputOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * InputField — A premium form input for dashboards.
 *
 * Features:
 * - text, email, password, number, tel, url, date, time, color, …
 * - Textarea mode (multiline) via `multiline` input
 * - Select mode via `options` input
 * - 3 visual variants: default (bordered) · filled · flushed (underline)
 * - 3 sizes: sm · md · lg
 * - 4 validation states: default · error · success · warning
 * - Leading / trailing icon slots (SVG path)
 * - Inline leading / trailing text addons (e.g. "https://", ".com")
 * - Password show/hide toggle built-in
 * - Character counter with optional max-length
 * - Helper text and error message slots
 * - Full ControlValueAccessor — works with `formControl`, `formControlName`, `ngModel`
 * - Accessible: `<label>`, `aria-describedby`, `aria-invalid`, focus-visible ring
 */
@Component({
  selector: 'sv-input-field',
  standalone: true,
  imports: [NgClass, SvIconComponent, SvSpinnerArcComponent, SvAutofillDirective],
  templateUrl: './input-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvInputFieldComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SvInputFieldComponent),
      multi: true,
    },
  ],
})
export class SvInputFieldComponent implements AfterViewInit, ControlValueAccessor, Validator {
  /**
   * `autofocus` is an input that used to do nothing.
   *
   * The template sets `[attr.autofocus]`, and the browser only honours that
   * attribute while it is parsing the document — an element Angular creates
   * afterwards is never focused by it. The input was published, documented and
   * read by no code, which is the same defect class as Time Picker's
   * `min`/`max` and Live Stock's `autoStart`. The attribute stays for a
   * server-rendered first paint; this is what makes it true on the client.
   */
  ngAfterViewInit(): void {
    if (!this.autofocus() || this.resolvedDisabled() || this.readonly()) return;
    this.inputRef()?.nativeElement.focus();
  }

  // ── Core ──────────────────────────────────────────────────────────────────

  /** Current value. Use `[(value)]` for signal two-way binding. */
  value = model<string>('');

  /** Input type. @default 'text' */
  type = input<InputType>('text');

  /** Renders a `<textarea>` instead of `<input>`. @default false */
  multiline = input<boolean>(false);

  /**
   * When set, renders a `<select>` element.
   * Use `type` is ignored when options are provided.
   */
  options = input<InputOption[]>([]);

  // ── Labels & helpers ──────────────────────────────────────────────────────

  /** Label text shown above the input. */
  label       = input<string>('');

  /** Marks the label with a red asterisk. @default false */
  required    = input<boolean>(false);

  /** Optional label (replaces asterisk with a soft "(optional)" tag). @default false */
  optionalTag = input<boolean>(false);

  /** Placeholder text. */
  placeholder = input<string>('');

  /** Helper text shown below the input (hidden when either error is set). */
  hint        = input<string>('');

  /** Error message — switches state to `error` automatically when non-empty. */
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
   * The shared validation-error contract.
   *
   * ★★ This was a hand-written copy of `createFieldError` — the ninth
   * independent transcription of the same anchor-and-expire logic. Behaviour is
   * byte-for-byte the same and is pinned by `input-field.server-error.spec.ts`;
   * the point of the change is that there is now ONE implementation to keep
   * correct rather than nine chances for one of them to keep showing a
   * rejection about a value the user has already edited away.
   */
  private readonly fieldError = createFieldError(this.value, this.serverError, this.errorMessage);

  /** `serverError`, but only while it still describes the current value. */
  protected readonly liveServerError = computed(() =>
    this.fieldError.showError() && this.fieldError.resolvedError() !== this.errorMessage()
      ? this.fieldError.resolvedError()
      : '',
  );

  /** What the error slot actually renders. Server first, then client. */
  readonly resolvedError = this.fieldError.resolvedError;


  /** Success message — shown below when state is `success`. */
  successMessage = input<string>('');

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Visual style. @default 'default' */
  variant  = input<InputVariant>('default');

  /** Size. @default 'md' */
  size     = input<InputSize>('md');

  /**
   * Explicit validation state override.
   * Automatically set to `'error'` when `errorMessage` is non-empty.
   * @default 'default'
   */
  state    = input<InputState>('default');

  // ── Icons & addons ────────────────────────────────────────────────────────

  /**
   * Icon-library NAME for the leading (left) icon — e.g. `'mail'`.
   *
   * ★ BREAKING (icon sweep): was `leadingIconPath`, a raw SVG `d` string.
   * Every showcase call site wrote it as a STATIC attribute, which Angular
   * silently ignores once the input is renamed — so the old name cannot be
   * left behind as a deprecated alias without the two quietly disagreeing.
   */
  leadingIcon  = input<string>('');

  /**
   * Icon-library NAME for the trailing (right) icon — e.g. `'calendar'`.
   * Was `trailingIconPath`, a raw SVG `d` string.
   */
  trailingIcon = input<string>('');

  /**
   * Short text prepended inside the input (e.g. `'https://'`, `'$'`).
   * Ignored when `leadingIcon` is set.
   */
  leadingAddon  = input<string>('');

  /**
   * Short text appended inside the input (e.g. `'.com'`, `'USD'`).
   * Ignored when `trailingIcon` is set.
   */
  trailingAddon = input<string>('');

  // ── Character counter ─────────────────────────────────────────────────────

  /**
   * Maximum character count shown as a counter below the input.
   * Set to 0 to disable. @default 0
   */
  maxLength = input<number>(0);

  // ── State ─────────────────────────────────────────────────────────────────

  /** Disable the input. @default false */
  disabled  = input<boolean>(false);

  /** Read-only mode. @default false */
  readonly  = input<boolean>(false);

  /** Show a loading spinner in the trailing position. @default false */
  loading   = input<boolean>(false);

  /** id forwarded to the native input — required for external `<label for>`. */
  inputId   = input<string>('');

  /**
   * Accessible name for the control, for the case where there is no visible
   * label.
   *
   * ★★★ A PLACEHOLDER IS NOT AN ACCESSIBLE NAME. It disappears the moment
   * somebody types, it is not reliably announced, and until this input existed
   * a label-less field here rendered an `<input>` with **no name at all** — no
   * `<label>`, no `aria-label`. That is a WCAG 4.1.2 failure, and label-less
   * fields are an ordinary pattern: a search box, an inline sign-up row, a
   * filter above a table.
   *
   * ★ Ignored when `label` is set. `aria-label` overrides a visible `<label>`
   * in the accessibility tree, so letting both apply would let a stale name
   * silently shadow the one on screen.
   */
  ariaLabel = input<string>('');

  /** name attribute for the native input. */
  inputName = input<string>('');

  /** Additional CSS classes on the root wrapper. */
  customClass = input<string>('');

  // ── Native constraints & hints ──────────────────────────────────────────────

  /**
   * `autocomplete` token (e.g. 'email', 'name', 'current-password', 'one-time-code').
   * Defaults to 'current-password' for password type, otherwise the browser default.
   * Applied to the `<input>`, the `<textarea>` (`multiline`, e.g. 'street-address')
   * and the `<select>` (`options`, e.g. 'country', 'bday-month') alike.
   */
  autocomplete = input<string>('');

  /** Virtual-keyboard hint for mobile (e.g. 'numeric', 'email', 'tel'). */
  inputMode = input<InputMode | ''>('');

  /** Native validation regex (without anchors — anchored automatically). */
  pattern = input<string>('');

  /** Minimum length used by the built-in Validator and native `minlength`. @default 0 */
  minLength = input<number>(0);

  /** Native `min` for number/date/range types. */
  min = input<string | number | null>(null);

  /** Native `max` for number/date/range types. */
  max = input<string | number | null>(null);

  /** Native `step` for number/date/range types. */
  step = input<string | number | null>(null);

  /** Native spellcheck toggle. null = browser default. */
  spellcheck = input<boolean | null>(null);

  /** Autofocus the control on render. @default false */
  autofocus = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────
  // Note: `value = model<string>('')` already auto-emits `valueChange` when
  // value.set() is called — no separate output needed.

  /** Emits when the input gains focus. */
  focused      = output<FocusEvent>();

  /** Emits when the input loses focus. */
  blurred      = output<FocusEvent>();

  /** Emits when Enter is pressed. */
  submitted    = output<string>();

  // ── Internal state ────────────────────────────────────────────────────────

  readonly isFocused     = signal(false);
  readonly showPassword  = signal(false);

  readonly inputRef = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>>('inputEl');

  // ── CVA ───────────────────────────────────────────────────────────────────

  private _onChange: (v: string) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void         = () => { /* replaced by registerOnTouched */ };

  /** Tracks disabled state set programmatically via formControl.disable(). */
  private readonly _formDisabled = signal(false);

  /**
   * Merged disabled state — true when either the [disabled] input or the
   * parent FormControl is disabled. Use this everywhere instead of disabled().
   */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  writeValue(val: string): void          { this.value.set(val ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this._formDisabled.set(isDisabled); }

  /**
   * Why the supplied `pattern` was not used, or `null`.
   *
   * ★★ A PLAIN FIELD RATHER THAN A SIGNAL, ON PURPOSE. It is written from
   *    inside `validate()`, which Angular calls during change detection —
   *    writing a signal there is either a
   *    `ExpressionChangedAfterItHasBeenCheckedError` or a write-in-computed
   *    error depending on where the validator was invoked from. Nothing in the
   *    template reads it; it exists so a host or a test can ask.
   */
  private _patternProblem: string | null = null;

  /**
   * The reason the `pattern` input was refused, or `null` when it was used.
   *
   * ★ Only meaningful after `validate()` has run at least once with a non-empty
   *   value — there is nothing to report about a pattern that has not been
   *   needed yet.
   */
  patternProblem(): string | null {
    return this._patternProblem;
  }

  /**
   * The `pattern` as the native `pattern` attribute receives it — `null` when
   * `svCompilePattern` refuses it as catastrophic (`FI-04-I1`).
   *
   * ★★ THE BROWSER RUNS THE ATTRIBUTE TOO. Guarding `validate()` alone left the
   *    same pattern on `<input pattern>`, where constraint validation evaluates
   *    it on the page's main thread as the value changes. A refused pattern is
   *    refused in both places. An INVALID one is still passed through: the
   *    browser ignores a pattern it cannot compile, so nothing is gained.
   */
  protected readonly nativePattern = computed<string | null>(() => {
    const pat = this.pattern();
    if (!pat) return null;
    return svCompilePattern(pat).problem === 'catastrophic' ? null : pat;
  });

  validate(_: AbstractControl): ValidationErrors | null {
    const errors: ValidationErrors = {};
    const v = this.value() ?? '';
    const max = this.maxLength();
    const min = this.minLength();

    if (this.required() && v.length === 0) {
      errors['required'] = true;
    }
    if (max > 0 && v.length > max) {
      errors['maxlength'] = { requiredLength: max, actualLength: v.length };
    }
    if (min > 0 && v.length > 0 && v.length < min) {
      errors['minlength'] = { requiredLength: min, actualLength: v.length };
    }
    const pat = this.pattern();
    if (pat && v.length > 0) {
      /**
       * ★★★ `new RegExp(pat).test(v)` HERE WAS A DENIAL OF SERVICE WITH
       *     `pattern` AS THE PAYLOAD. It runs on every keystroke, and `pattern`
       *     is an input — which for any host filling it from a CMS, a schema or
       *     a URL means it is attacker-controlled. Measured on V8: `(a|a?)+b`
       *     against thirty characters costs **32.9 seconds** of frozen main
       *     thread, uncancellable. `svCompilePattern` refuses that shape; see
       *     `@styloviz/core`'s `pattern.ts` for the figures and the limits.
       *
       * 🔺 THE `try/catch` IT REPLACES WAS ITS OWN DEFECT. "Skip pattern
       *    validation rather than throw" is the right instinct and the wrong
       *    silence: a field advertised as validated, validating nothing, with
       *    no artefact anywhere for anyone to notice. `patternProblem()` now
       *    exposes the reason so a host can surface it in development.
       *
       * ⚠️ It still fails OPEN for the person typing, deliberately — they did
       *    not write the pattern and cannot fix it, and blocking their
       *    submission punishes the only innocent party.
       */
      const compiled = svCompilePattern(pat);
      this._patternProblem = compiled.reason ?? null;
      if (compiled.regexp && !compiled.regexp.test(v)) {
        errors['pattern'] = { requiredPattern: pat, actualValue: v };
      }
    }
    return Object.keys(errors).length > 0 ? errors : null;
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  onNativeChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.value.set(val);   // model().set() auto-emits valueChange
    this._onChange(val);
  }

  onFocus(e: FocusEvent): void {
    this.isFocused.set(true);
    this.focused.emit(e);
  }
  onBlur(e: FocusEvent): void {
    this.isFocused.set(false);
    this._onTouched();
    this.blurred.emit(e);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.multiline()) {
      this.submitted.emit(this.value());
    }
  }

  togglePassword(): void { this.showPassword.update(v => !v); }

  // ── Computed helpers ──────────────────────────────────────────────────────

  /** Stable unique fallback id so label + aria associations always work. */
  private readonly _autoId = svUniqueId('sv-input');
  /** Effective id used by the native control and its <label for>. */
  readonly resolvedId   = computed(() => this.inputId() || this._autoId);

  /** The `aria-label` actually rendered — see {@link ariaLabel}. */
  readonly resolvedAriaLabel = computed<string | null>(() =>
    this.label() ? null : this.ariaLabel() || null,
  );
  /** Id of the hint/error/success description element. */
  readonly describedById = computed(() => `${this.resolvedId()}-desc`);
  /** Id of the character counter. */
  readonly describedByCounterId = computed(() => `${this.resolvedId()}-count`);

  /**
   * Everything below the field that describes it, in reading order.
   *
   * `aria-describedby` takes a **list**, and this named only the message. The
   * counter was rendered, styled and given `aria-live` — so it announced every
   * keystroke — while someone arriving at the field was never told a limit
   * existed. Same shape as the `toggle-switch` and `input-mask` fixes.
   */
  readonly describedByIds = computed<string | null>(() =>
    svDescribedBy({
      // ★ One slot, three possible contents. `hasDescription()` is
      // `showHint() || showError() || showSuccess()`, and the template renders
      // whichever is live into the SAME element — so there is one id here, not
      // two, and the hint/error precedence is a rendering decision rather than
      // an `aria-describedby` one.
      hint: this.hasDescription() && this.describedById(),
      count: this.showCounter() && this.describedByCounterId(),
    }),
  );

  isSelect    = computed(() => this.options().length > 0);
  isPassword  = computed(() => this.type() === 'password');
  isColor     = computed(() => this.type() === 'color');
  isFloating  = computed(() => false);
  /**
   * Whether the browser has filled this control — see `SvAutofillDirective`.
   *
   * Read through a `viewChild` rather than an input, because the answer belongs
   * to the element and the element is one of three (`input`, `textarea`,
   * `select`) depending on the variant.
   */
  private readonly autofill = viewChild(SvAutofillDirective);

  /**
   * ★★ AUTOFILL IS THE THIRD WAY A FIELD GETS FULL, AND THE LABEL ONLY KNEW
   *    ABOUT TWO. `isFocused() || !!value()` covers typing and a bound value.
   *    It does not cover Chrome filling the field on page load, which sets the
   *    element's `value` directly and fires **no `input` event** — so
   *    `value()` stays `''`, the label stays in its resting position, and it
   *    sits on top of the text the browser just put there. `FI-27-I2`.
   *
   *    The fill is not observable as an event, so it is observed as one: see
   *    `SvAutofillDirective` for why `animationstart` on an empty keyframe is
   *    the only notification there is.
   */
  labelIsFloated = computed(
    () => this.isFocused() || !!this.value() || !!this.autofill()?.autofilled(),
  );

  resolvedType = computed<string>(() => {
    if (this.isPassword()) return this.showPassword() ? 'text' : 'password';
    return this.type();
  });

  resolvedState = computed<InputState>(() =>
    this.resolvedError() ? 'error' : this.state()
  );

  charCount      = computed(() => this.value().length);
  showCounter    = computed(() => this.maxLength() > 0);
  counterOver    = computed(() => this.maxLength() > 0 && this.charCount() > this.maxLength());

  showHint       = computed(() => !!this.hint() && !this.resolvedError() && !this.successMessage());
  showError      = this.fieldError.showError;
  showSuccess    = computed(() => !!this.successMessage() && !this.resolvedError());

  /** True when any below-field description (hint/error/success) is rendered. */
  hasDescription = computed(() => this.showHint() || this.showError() || this.showSuccess());

  /** Resolved autocomplete token. Smart default for passwords, else explicit value. */
  resolvedAutocomplete = computed<string | null>(() => {
    if (this.autocomplete()) return this.autocomplete();
    if (this.isPassword()) return 'current-password';
    return null;
  });

  hasLeading     = computed(() => !!this.leadingIcon() || !!this.leadingAddon());
  hasTrailing    = computed(() =>
    !!this.trailingIcon() || !!this.trailingAddon() ||
    this.isPassword() || this.loading()
  );

  // ── Class maps ────────────────────────────────────────────────────────────

  rootClasses = computed(() => ['w-full', this.customClass()].filter(Boolean).join(' '));

  floatingLabelClasses = computed<string>(() => {
    const floated = this.labelIsFloated();
    const s = this.resolvedState();
    const focused = this.isFocused();

    // When leading icon/addon present, offset label so it doesn't overlap
    const notFloatedLeft = this.hasLeading() ? 'left-10' : 'left-3.5';
    const floatedLeft = this.hasLeading() ? 'left-8' : 'left-3';
    const left = floated ? floatedLeft : notFloatedLeft;

    // For multiline, label sits near the top (not vertical-center) when not floated
    const isMulti = this.multiline();
    const notFloatedTopMap: Record<InputSize, string> = { sm: 'top-3', md: 'top-4', lg: 'top-5' };
    const notFloatedTop = isMulti ? notFloatedTopMap[this.size()] : 'top-1/2';
    const notFloatedTranslate = isMulti ? '' : '-translate-y-1/2';

    const textSize = floated ? 'text-[0.7rem] leading-none' : this.labelSizeClass();
    const bg = floated ? 'px-1 bg-white dark:bg-gray-900' : '';

    let color: string;
    if (floated && focused) {
      color = s === 'error'   ? 'text-danger-500'
            : s === 'success' ? 'text-accent-500'
            : s === 'warning' ? 'text-warning-500'
            : 'text-primary-600 dark:text-primary-400';
    } else if (floated) {
      color = s === 'error'   ? 'text-danger-500 dark:text-danger-400'
            : s === 'success' ? 'text-accent-700 dark:text-accent-400'
            : s === 'warning' ? 'text-warning-700 dark:text-warning-400'
            : 'text-gray-500 dark:text-gray-400';
    } else {
      color = 'text-gray-500 dark:text-gray-400';
    }

    const position = floated
      ? `${left} -top-px -translate-y-1/2`
      : `${left} ${notFloatedTop} ${notFloatedTranslate}`.trim();

    return [
      'absolute z-10 pointer-events-none select-none',
      'transition-[top,left,font-size,color,padding,background-color] duration-200 ease-in-out',
      position,
      textSize,
      bg,
      color,
    ].filter(Boolean).join(' ');
  });

  labelSizeClass = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'text-xs';
      case 'lg': return 'text-base';
      default:   return 'text-sm';
    }
  });

  /** Outer track that wraps the native input + addons + icons. */
  trackClasses = computed<string>(() => {
    const v = this.variant();
    const s = this.resolvedState();
    const focused = this.isFocused();

    // Base layout — multiline uses items-start so leading icons align to the top
    const base = `relative flex ${this.multiline() ? 'items-start' : 'items-center'} w-full transition-all duration-150`;

    // Height / font size
    const sizeMap: Record<InputSize, string> = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    };

    // Variant shape & surface
    const variantBase: Record<InputVariant, string> = {
      default:  'rounded-md border bg-white dark:bg-gray-900',
      filled:   'rounded-md border-0 bg-gray-100 dark:bg-gray-800',
      flushed:  'border-b-2 bg-transparent rounded-none',
    };

    // State-driven border/ring
    const isFlushed = v === 'flushed';
    const stateIdle: Record<InputState, string> = {
      default: isFlushed
        ? 'border-gray-300 dark:border-gray-600'
        : 'border-gray-300 dark:border-gray-700',
      error:   isFlushed
        ? 'border-danger-500 dark:border-danger-500'
        : 'border-danger-400 dark:border-danger-500',
      success: isFlushed
        ? 'border-accent-500 dark:border-accent-500'
        : 'border-accent-400 dark:border-accent-500',
      warning: isFlushed
        ? 'border-warning-500 dark:border-warning-500'
        : 'border-warning-400 dark:border-warning-500',
    };

    const stateFocus: Record<InputState, string> = {
      default: isFlushed
        ? 'border-primary-500 dark:border-primary-400'
        : 'border-primary-500 ring-2 ring-primary-500/20 dark:border-primary-400 dark:ring-primary-400/20',
      error:   isFlushed
        ? 'border-danger-500'
        : 'border-danger-500 ring-2 ring-danger-500/20',
      success: isFlushed
        ? 'border-accent-500'
        : 'border-accent-500 ring-2 ring-accent-500/20',
      warning: isFlushed
        ? 'border-warning-500'
        : 'border-warning-500 ring-2 ring-warning-500/20',
    };

    const disabledClass = this.resolvedDisabled()
      ? 'cursor-not-allowed opacity-60 pointer-events-none'
      : '';

    return [
      base,
      sizeMap[this.size()],
      variantBase[v],
      focused ? stateFocus[s] : stateIdle[s],
      disabledClass,
    ].filter(Boolean).join(' ');
  });

  /** The native `<input>`, `<textarea>` or `<select>` element. */
  nativeInputClasses = computed<string>(() => {
    const padL = this.hasLeading() ? 'pl-0' : this.sidepadding();
    const padR = this.hasTrailing() ? 'pr-0' : this.sidepadding();
    const multi = this.multiline();

    return [
      'flex-1 min-w-0 bg-transparent outline-none',
      'text-gray-900 dark:text-white',
      'placeholder-gray-500 dark:placeholder-gray-400',
      'disabled:cursor-not-allowed',
      padL, padR,
      multi ? `resize-y ${this.multilineVertPadding()} min-h-[5rem]` : this.heightClass(),
      this.isColor() ? 'h-10 w-full cursor-pointer rounded-lg p-1' : '',
    ].filter(Boolean).join(' ');
  });

  private sidepadding = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'px-2.5';
      case 'lg': return 'px-4';
      default:   return 'px-3.5';
    }
  });

  private vertPadding = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'py-1.5';
      case 'lg': return 'py-3';
      default:   return 'py-2';
    }
  });

  /** Vertical padding for multiline (textarea) — adds extra top space when floating. */
  private multilineVertPadding = computed<string>(() => {
    if (this.isFloating()) {
      switch (this.size()) {
        case 'sm': return 'pt-4 pb-2';
        case 'lg': return 'pt-5 pb-3';
        default:   return 'pt-5 pb-3';
      }
    }
    return this.vertPadding();
  });

  private heightClass = computed<string>(() => {
    if (this.isFloating()) {
      switch (this.size()) {
        case 'sm': return 'h-12 pt-2 pb-1';
        case 'lg': return 'h-16 pt-4 pb-2';
        default:   return 'h-14 pt-3 pb-2';
      }
    }
    switch (this.size()) {
      case 'sm': return 'h-8 py-0';
      case 'lg': return 'h-12 py-0';
      default:   return 'h-10 py-0';
    }
  });

  addonClasses = computed<string>(() =>
    `flex shrink-0 items-center ${this.vertPadding()} text-gray-500 dark:text-gray-400 text-sm select-none`
  );

  leadingAddonClasses = computed<string>(() =>
    `${this.addonClasses()} pl-3.5 border-r border-gray-200 dark:border-gray-700 mr-3.5 pr-3`
  );

  trailingAddonClasses = computed<string>(() =>
    `${this.addonClasses()} pr-3.5 border-l border-gray-200 dark:border-gray-700 ml-3.5 pl-3`
  );

  iconClass = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-3.5 w-3.5';
      case 'lg': return 'h-5 w-5';
      default:   return 'h-4 w-4';
    }
  });

  iconPadClass = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'px-2';
      case 'lg': return 'px-3.5';
      default:   return 'px-3';
    }
  });


  /**
   * Library icon NAME for the current validation state (empty = none).
   *
   * ★ Replaces `stateIconPath`, which returned three hand-copied `d` strings.
   * `error` and `warning` map to the same glyph deliberately — the two raw
   * paths were the same triangle with the exclamation mark one unit apart, so
   * they always drew the same shape; the colour is what tells them apart.
   */
  readonly stateIconName = computed<string>(() => {
    switch (this.resolvedState()) {
      case 'error':   return 'alert-triangle';
      case 'success': return 'check-circle';
      case 'warning': return 'alert-triangle';
      default:        return '';
    }
  });

  stateIconColorClass = computed<string>(() => {
    switch (this.resolvedState()) {
      case 'error':   return 'text-danger-500';
      case 'success': return 'text-accent-500';
      case 'warning': return 'text-warning-500';
      default:        return 'text-gray-500 dark:text-gray-400';
    }
  });

  hintColorClass = computed<string>(() => {
    switch (this.resolvedState()) {
      case 'error':   return 'text-danger-600 dark:text-danger-400';
      case 'success': return 'text-accent-700 dark:text-accent-400';
      case 'warning': return 'text-warning-700 dark:text-warning-400';
      default:        return 'text-gray-500 dark:text-gray-400';
    }
  });

  // ── Public API ────────────────────────────────────────────────────────────

  focus(): void {
    (this.inputRef()?.nativeElement as HTMLElement | undefined)?.focus();
  }
}
