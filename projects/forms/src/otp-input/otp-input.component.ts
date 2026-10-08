import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  QueryList,
  signal,
  untracked,
  OnDestroy,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import type { OtpInputVariant, OtpInputSize, OtpInputStatus, OtpInputMode } from './otp-input.types';
import {
  createFieldError,
  svDescribedBy,
  SvFieldErrorComponent,
  SvSpinnerArcComponent,
  type SvServerError,
  svDigitsOnly,
  svUniqueId,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

@Component({
  selector: 'sv-otp-input',
  standalone: true,
  imports: [SvIconComponent, SvFieldErrorComponent, SvSpinnerArcComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './otp-input.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvOtpInputComponent),
      multi: true,
    },
  ],
})
export class SvOtpInputComponent implements AfterViewInit, OnDestroy, ControlValueAccessor {
  // ── Inputs ──
  /** Number of code cells. @default 6 */
  length   = input<4 | 5 | 6>(6);
  /** Current code value (two-way). */
  value    = model<string>('');
  /** Visual variant of the cells. @default 'default' */
  variant  = input<OtpInputVariant>('default');
  /** Cell size: sm, md or lg. @default 'md' */
  size     = input<OtpInputSize>('md');
  /** Validation status: idle, error, success or loading. @default 'idle' */
  status   = input<OtpInputStatus>('idle');
  /** Mask entered digits (password-style). @default false */
  mask     = input<boolean>(false);
  /** Disable all cells. @default false */
  disabled = input<boolean>(false);
  /** Accessible label for the code group. */
  label    = input<string>('');
  /** Helper/error text shown below the cells. */
  hint     = input<string>('');
  /** Focus the first cell on render. @default false */
  autoFocus = input<boolean>(false);

  /**
   * How the code is actually taken from the user. @default 'cells'
   *
   * ── The defect this exists for (`FI-16-I2` / `FI-16-M1`) ──────────────────
   *
   * ★★★ SIX BOXES IS SIX FORM FIELDS, AND EVERYTHING THAT READS FORMS BELIEVES
   *     IT. A screen reader announces six controls where the user has one thing
   *     to enter; a password manager sees six fields and offers to fill none of
   *     them; iOS's "From Messages" autofill and Android's SMS suggestion both
   *     look for ONE field with `autocomplete="one-time-code"` and quietly skip
   *     a row of them. The per-cell `aria-label`s ("Digit 3 of 6") make the
   *     announcement survivable; they cannot make the control singular, and it
   *     is the singularity the platform features key off.
   *
   * `'single'` is one real `<input>` with one real `<label>`, drawn over boxes
   * that are `aria-hidden` decoration. Every keystroke, selection, paste and
   * `Backspace` is the browser's own — and so is the OS keyboard's code
   * suggestion, which is the whole point.
   *
   * ★★ NOT THE DEFAULT, DELIBERATELY. The cell version is what every existing
   *    caller renders and it looks different enough to matter — the boxes are
   *    individually focusable, which some designs rely on. Opt in, and the
   *    recommendation is in the docs rather than in a silent behaviour change.
   *
   * 💡 `'single'` is what most current accessibility guidance recommends, and it
   *    is also the only mode `webOtp` can usefully fill.
   */
  mode = input<OtpInputMode>('cells');

  /**
   * Ask the browser to read the code out of an incoming SMS. @default false
   *
   * ── `FI-16-M2`, and what it actually is ──────────────────────────────────
   *
   * ★★ THE WEB OTP API IS AN ADAPTER, NOT A FEATURE. `navigator.credentials.get`
   *    with `{ otp: { transport: ['sms'] } }` resolves when a matching SMS
   *    arrives, and exists in exactly one place — Chromium on Android, in a
   *    secure context, for a message formatted with the site's own domain. So
   *    this is feature-detected, aborted on destroy, and **silent when
   *    unavailable**: a control that logged a warning on every iPhone would be
   *    telling the developer about the user's browser.
   *
   * ⚠️ Requires `mode="single"`. Filling cells from an API that hands you the
   *    whole code at once would work, but the API's own trigger is the presence
   *    of one `autocomplete="one-time-code"` field — so a cells control asking
   *    for it is asking for something it has not set up.
   */
  webOtp = input(false, { transform: booleanAttribute });

  /**
   * Wipe the code when it is rejected, so the user is not editing a code that
   * has already been refused. @default true — `FI-16-M3`.
   *
   * ★★ A REJECTED OTP CANNOT BE REPAIRED, ONLY REPLACED. There is no "fix the
   *    third digit": either the user mistyped, in which case they re-read the
   *    whole code from the message, or the code has expired, in which case
   *    every digit is wrong. Leaving the old one in place makes retrying
   *    *harder* than starting from nothing — the cells are full, each takes one
   *    character, and typing into a full cell does nothing until it is emptied,
   *    so the user has to backspace six times before they can begin.
   *
   *    Turn this off for a rejection that is **not about the code** — "too many
   *    attempts, wait 30 seconds", or a network failure. Clearing there throws
   *    away a code that was very likely correct. The better fix is usually to
   *    not report those through `status="error"` at all.
   */
  clearOnError = input(true, { transform: booleanAttribute });

  // ── Outputs ──
  /** Emitted with the full code once every cell is filled. */
  complete = output<string>();
  /** Emitted on every change to the partial code. */
  changed  = output<string>();
  /** Emitted when a rejected code was wiped — see `clearOnError`. */
  codeCleared = output<void>();

  @ViewChildren('digitInput') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChild('singleInput') singleInput?: ElementRef<HTMLInputElement>;

  private readonly _host = inject(ElementRef<HTMLElement>);

  readonly digits = signal<string[]>([]);
  readonly focused = signal<number>(-1);

  /** Unique id for the status/hint region (aria-describedby). */
  private readonly _baseId = svUniqueId('sv-otp');
  readonly hintId = `${this._baseId}-hint`;
  /** Id of the visible label text, referenced by the digit group. */
  readonly labelId = `${this._baseId}-label`;

  // ── ControlValueAccessor ──
  private _onChange: (v: string) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);
  /** Merged disabled — the `[disabled]` input OR a disabled parent FormControl. */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this._formDisabled.set(isDisabled); }

  constructor() {
    // ── Clear-on-error (`FI-16-M3`) ────────────────────────────────────────
    //
    // On the EDGE into a rejection, never on its presence. `status` is a plain
    // input the host holds at `'error'` until it decides otherwise, so an
    // effect keyed on the current value would wipe each digit as the user
    // typed it — which is the same trap as the one this fixes, only worse.
    effect(() => {
      const rejected = this.rejected();
      untracked(() => {
        const arrived = rejected && !this._wasRejected;
        this._wasRejected = rejected;
        if (!arrived || !this.clearOnError()) return;
        if (this.digits().every((d) => !d)) return; // nothing to throw away
        this._wipe();
      });
    });

    // Keep the cells in sync with the bound `value` (initial value, external
    // resets, and reactive-form writes). untracked() reads `digits` without
    // creating a dependency so this never loops on its own writes.
    effect(() => {
      const len = this.length();
      const v = svDigitsOnly(this.value() ?? '').slice(0, len);
      const arr = Array<string>(len).fill('');
      v.split('').forEach((c, i) => { arr[i] = c; });
      if (arr.join('') !== untracked(() => this.digits()).join('')) {
        this.digits.set(arr);
      }
    });
  }

  readonly slots = computed(() => Array.from({ length: this.length() }, (_, i) => i));

  /** True when the code is taken by one real field rather than N. */
  readonly isSingle = computed(() => this.mode() === 'single');

  /** The code as one string, for the single field's `value`. */
  readonly codeText = computed(() => this.digits().join(''));

  /**
   * Which decorative box the caret is sitting in, or `-1`.
   *
   * ★ The boxes are `aria-hidden`, so this is purely so a sighted user can see
   *   where they are. The real caret is the browser's, inside an input drawn
   *   over the top — which is why every selection and key behaviour is native.
   */
  readonly caretBox = computed(() => {
    if (!this.isSingle() || this.focused() < 0) return -1;
    return Math.min(this.codeText().length, this.length() - 1);
  });

  /** One field takes the whole code, not one character. */
  onSingleInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    // ★ Same normalisation as a paste into the cells: strip anything that is
    //   not a digit rather than rejecting the whole entry, because what arrives
    //   from an SMS is routinely "Your code is 123456".
    const digits = svDigitsOnly(el.value).slice(0, this.length()).split('');
    const d = Array<string>(this.length()).fill('');
    digits.forEach((c, i) => { d[i] = c; });
    this.digits.set(d);
    // Write back so the element never holds characters the model dropped.
    el.value = d.join('');
    this.emitChange(d);
  }

  readonly inputType = computed(() => this.mask() ? 'password' : 'text');

  /** Whether to expose the status region as an error/alert vs a polite status. */
  readonly statusMessage = computed<string>(() => {
    if (this.status() === 'loading') return 'Verifying…';
    return this.hint();
  });

  ngAfterViewInit(): void {
    if (this.autoFocus()) this.focusAt(0);
    this._startWebOtp();
  }

  // ── WebOTP (FI-16-M2) ──────────────────────────────────────────────────────

  private _otpAbort: AbortController | null = null;

  private _startWebOtp(): void {
    if (!this.webOtp() || !this.isSingle()) return;
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    const creds = (navigator as Navigator & { credentials?: CredentialsContainer }).credentials;
    // ★ Feature-detected and SILENT when missing. A control that warned here
    //   would be reporting the user's browser to the developer, every time.
    if (!creds || !('OTPCredential' in window)) return;

    this._otpAbort = new AbortController();
    creds
      .get({
        otp: { transport: ['sms'] },
        signal: this._otpAbort.signal,
      } as CredentialRequestOptions)
      .then((cred) => {
        const code = (cred as (Credential & { code?: string }) | null)?.code;
        if (!code) return;
        const digits = svDigitsOnly(code).slice(0, this.length()).split('');
        const d = Array<string>(this.length()).fill('');
        digits.forEach((c, i) => { d[i] = c; });
        this.digits.set(d);
        this.emitChange(d);
      })
      // ★★ An abort is the normal ending — the user typed the code themselves,
      //    or left the page. Treating it as an error would put a console entry
      //    under every successful sign-in.
      .catch(() => { /* aborted, denied, or no SMS arrived. All ordinary. */ });
  }

  ngOnDestroy(): void {
    this._otpAbort?.abort();
    this._otpAbort = null;
  }

  digitAt(i: number): string {
    return this.digits()[i] ?? '';
  }

  onKeydown(e: KeyboardEvent, i: number): void {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const d = [...this.digits()];
      if (d[i]) {
        d[i] = '';
        this.digits.set(d);
        this.emitChange(d);
      } else if (i > 0) {
        d[i - 1] = '';
        this.digits.set(d);
        this.emitChange(d);
        this.focusAt(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      this.focusAt(i - 1);
    } else if (e.key === 'ArrowRight' && i < this.length() - 1) {
      e.preventDefault();
      this.focusAt(i + 1);
    } else if (e.key === 'Delete') {
      const d = [...this.digits()];
      d[i] = '';
      this.digits.set(d);
      this.emitChange(d);
    }
  }

  onInput(e: Event, i: number): void {
    const el = e.target as HTMLInputElement;
    const raw = svDigitsOnly(el.value);
    if (!raw) { el.value = ''; return; }

    const d = [...this.digits()];

    // Support paste of multiple digits
    if (raw.length > 1) {
      const chars = raw.split('').slice(0, this.length() - i);
      chars.forEach((c, j) => { if (i + j < this.length()) d[i + j] = c; });
      this.digits.set(d);
      this.emitChange(d);
      const next = Math.min(i + chars.length, this.length() - 1);
      this.focusAt(next);
      return;
    }

    d[i] = raw[0] ?? '';
    this.digits.set(d);
    this.emitChange(d);
    if (raw && i < this.length() - 1) this.focusAt(i + 1);
    // Restore displayed value (browser may clear it)
    el.value = this.mask() ? '' : (d[i] ?? '');
  }

  onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const text = e.clipboardData?.getData('text') ?? '';
    const digits = svDigitsOnly(text).slice(0, this.length()).split('');
    const d = Array(this.length()).fill('');
    digits.forEach((c, i) => d[i] = c);
    this.digits.set(d);
    this.emitChange(d);
    const next = Math.min(digits.length, this.length() - 1);
    this.focusAt(next);
  }

  private emitChange(d: string[]): void {
    // Any keystroke ends the clear announcement: the region is about to carry
    // whatever the new state says, and a stale "Code cleared" underneath it
    // would be read out alongside it.
    this._clearedNotice.set('');
    const v = d.join('');
    this.value.set(v);
    this.changed.emit(v);
    this._onChange(v);
    if (v.length === this.length() && !d.includes('')) this.complete.emit(v);
  }

  private focusAt(i: number): void {
    if (this.isSingle()) {
      this.singleInput?.nativeElement.focus();
      return;
    }
    const els = this.digitInputs?.toArray();
    els?.[i]?.nativeElement.focus();
  }

  onFocus(i: number): void { this.focused.set(i); }
  onBlur(): void { this.focused.set(-1); this._onTouched(); }

  /** Empty every cell and focus the first. Public: hosts call it on "Resend". */
  clear(): void {
    this._emptyCells();
    this._clearedNotice.set('');
    this.focusAt(0);
  }

  // ── Clear-on-error ─────────────────────────────────────────────────────────

  /** True while the code on screen has been refused, by either error channel. */
  protected readonly rejected = computed(
    () => this.status() === 'error' || this.fieldError.showError(),
  );

  /** Whether the last effect run saw a rejection, so only the edge fires. */
  private _wasRejected = false;

  /** Screen-reader-only line reporting that the code was thrown away. */
  protected readonly _clearedNotice = signal('');

  /**
   * Empty the cells and tell everyone who is listening.
   *
   * `_onChange` included: `clear()` used to skip it, so a reactive form's
   * control kept the old code after the component had visibly discarded it —
   * a validator would then pass on a value nobody could see.
   */
  private _emptyCells(): void {
    const empty = Array<string>(this.length()).fill('');
    this.digits.set(empty);
    this.value.set('');
    this.changed.emit('');
    this._onChange('');
  }

  private _wipe(): void {
    // Read before the write: `focus` moves out of a disabled or removed input,
    // and the cells are about to be rewritten.
    const hadFocus = this._host.nativeElement.contains(
      this._host.nativeElement.ownerDocument?.activeElement ?? null,
    );

    this._emptyCells();

    // ★ SIX CELLS GOING BLANK IS SILENT. Sighted users see the code vanish;
    //   a screen-reader user hears the rejection and has no idea their input
    //   is gone, so they carry on believing they are editing it. The visible
    //   error says what was wrong; this says what happened to the value.
    this._clearedNotice.set('Code cleared. Enter the code again.');

    // Only if the user was already here. A rejection can land while they have
    // tabbed away to "Resend" or "Use another method", and yanking focus back
    // to a field they deliberately left is worse than leaving it alone.
    if (hadFocus) this.focusAt(0);

    this.codeCleared.emit();
  }

  // ── Style helpers ──
  readonly cellBase = computed(() => {
    const s: Record<OtpInputSize, string> = {
      sm: 'h-9 w-8 text-base',
      md: 'h-11 w-10 text-lg',
      lg: 'h-14 w-12 text-2xl',
    };
    return s[this.size()];
  });

  readonly cellVariant = computed(() => {
    const v: Record<OtpInputVariant, string> = {
      default: 'rounded-md border-2 bg-white dark:bg-gray-900',
      filled:  'rounded-md border-2 bg-gray-100 dark:bg-gray-800',
      underline: 'rounded-none border-b-2 border-t-0 border-l-0 border-r-0 bg-transparent',
      ghost:   'rounded-md border-2 bg-transparent',
    };
    return v[this.variant()];
  });

  cellColorClass(i: number): string {
    const isFocused = this.focused() === i;
    const hasValue  = !!this.digitAt(i);

    if (this.status() === 'error') {
      return isFocused
        ? 'border-danger-500 ring-2 ring-danger-300/40'
        : hasValue ? 'border-danger-400' : 'border-danger-300 dark:border-danger-800';
    }
    if (this.status() === 'success') {
      return 'border-accent-500 dark:border-accent-400';
    }
    if (isFocused) return 'border-primary-500 ring-2 ring-primary-300/40 dark:border-primary-400';
    if (hasValue)  return 'border-gray-400 dark:border-gray-500';
    return 'border-gray-200 dark:border-gray-700';
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

  /**
   * What the digit group is described by.
   *
   * Both the hint region and the error slot can be present at once, and
   * `aria-describedby` takes a list — writing only one of them is how a
   * rejection ends up announced nowhere. Empty means the attribute is dropped
   * rather than rendered blank.
   */
  protected readonly describedBy = computed<string | null>(() =>
    svDescribedBy({
      hint: (!!this.hint() || this.status() === 'loading') && this.hintId,
      error: this.fieldError.showError() && this.errorId(),
    }),
  );
  private readonly _errUid = svUniqueId('sv-otp-input');

}
