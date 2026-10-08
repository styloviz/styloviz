import {
  Component,
  booleanAttribute,
  input,
  output,
  computed,
  signal,
  model,
  ChangeDetectionStrategy,
  forwardRef,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  createFieldError,
  createOptimisticEdit,
  svDescribedBy,
  SvFieldErrorComponent,
  svRequestKey,
  type SvServerError,
  svWarnOnce,
  toSvDataError,
  type SvDataError,
  svUniqueId,
} from '@styloviz/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckboxSize    = 'sm' | 'md' | 'lg';
export type CheckboxVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

/**
 * One change the host is expected to persist (`X-6`).
 *
 * Emitted by `(changeRequest)` alongside the plain `(changed)` — the same
 * contract as `sv-toggle-switch`'s `(toggleRequest)`. A checkbox in a settings
 * list ("Email me weekly digests") writes on click, not on submit, and a box
 * that silently un-ticks itself three seconds later is the same trust failure
 * as a switch that flips back.
 */
export interface SvCheckboxChange {
  /** The state the user asked for — already applied to `checked`. */
  readonly checked: boolean;
  /**
   * Idempotency key for this write. Send it, and have the server ignore a key
   * it has already applied, so a retried request cannot land twice.
   */
  readonly requestKey: string;
  /**
   * Put `checked` back. Refuses — with a dev-mode warning — if the user has
   * changed it again since, because restoring a value from before their newer
   * change would throw that change away silently. Bind `[pending]` so it cannot
   * arise.
   */
  readonly rollback: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Checkbox — An accessible checkbox control with indeterminate state support.
 *
 * Supports:
 * - Angular signals two-way binding via `[(checked)]`
 * - Reactive Forms via `ControlValueAccessor`
 * - Indeterminate / tri-state mode
 * - 3 sizes × 5 color variants
 * - Optional description sub-label
 * - Disabled state
 * - Full keyboard accessibility
 */
@Component({
  selector: 'sv-checkbox',
  standalone: true,
  imports: [NgClass, SvFieldErrorComponent],
  templateUrl: './checkbox.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvCheckboxComponent),
      multi: true,
    },
  ],
})
export class SvCheckboxComponent implements ControlValueAccessor {
  // ── Two-way binding ───────────────────────────────────────────────────────

  /** Current checked state. Use `[(checked)]` for two-way binding. @default false */
  checked = model<boolean>(false);

  // ── Content ───────────────────────────────────────────────────────────────

  /** Visible label text. */
  label = input<string>('');

  /** Smaller descriptor line beneath the label. */
  description = input<string>('');

  /** Explicit id forwarded to the native input. Auto-generated when omitted. */
  inputId = input<string>('');

  /**
   * `aria-label` override — required when there is no visible `label`
   * so screen readers can still announce the control's purpose.
   */
  ariaLabel = input<string>('');

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Size of the checkbox. @default 'md' */
  size = input<CheckboxSize>('md');

  /** Active color variant. @default 'primary' */
  variant = input<CheckboxVariant>('primary');

  // ── State ─────────────────────────────────────────────────────────────────

  /**
   * Show an indeterminate (dash) state. @default false
   *
   * ── ★★★ THIS IS A VISUAL STATE. IT IS NEVER A SUBMITTED VALUE. (`FI-06-I1`)
   *
   * A checkbox has two values and three appearances. `checked` is the value —
   * a `boolean`, the only thing `ControlValueAccessor` ever writes or reads —
   * and `indeterminate` is a separate presentation input the HOST owns,
   * rendered as a dash and announced as `aria-checked="mixed"`.
   *
   * ⚠️ A HOST THAT TREATS "MIXED" AS A THIRD VALUE LOSES DATA ON SUBMIT.
   *    There is no third value to lose it to: whatever `indeterminate` is, this
   *    control writes `true` or `false` and a `FormControl<boolean>` stores one
   *    of those. A parent that stores `null` for "some children selected" and
   *    reads it back gets `false`, silently, because `writeValue(null)` is
   *    `!!null`.
   *
   * ★★ THE HOST MUST CLEAR IT WHEN THE USER ACTS. `indeterminate` is an input,
   *    so this component cannot clear it — and measured before this JSDoc was
   *    written, it does not get cleared: toggling a mixed checkbox leaves
   *    `checked() === true`, `indeterminate() === true`, and the DOM still
   *    reporting `aria-checked="mixed"`. The user clicks a "select all" box
   *    showing a dash, it fills in, and a screen reader still says mixed.
   *    A dev-only warning now says so the first time it happens; see
   *    `toggle()`.
   */
  indeterminate = input<boolean>(false);

  /** Disable interaction. @default false */
  disabled = input<boolean>(false);

  /** Mark the control as required (sets native `required` + `aria-required`). @default false */
  required = input<boolean>(false);

  /** `name` for native form submission. */
  name = input<string>('');

  /** `value` submitted with `name` when checked (grouped checkboxes). */
  value = input<string>('');

  /** Autofocus the control on render. @default false */
  autofocus = input<boolean>(false);

  /** Additional CSS classes on the root wrapper. */
  customClass = input<string>('');

  /**
   * Client-side validation message. "You must accept the terms" had nowhere to
   * go before this: the control rendered a box and a label and nothing else, so
   * a form could reject it with no way to say why.
   */
  errorMessage = input<string>('');

  /**
   * A rejection that came back from the server about THIS value. Self-expires
   * as soon as the value changes — see `createFieldError`.
   */
  serverError = input<SvServerError>(null);

  /**
   * The user's change is applied on screen and its write is in flight (`X-6`).
   *
   * Not `disabled`: the tick the user just placed stays at full strength —
   * fading a value the user chose reads as "this did not take" — and the box
   * stays focusable. It refuses further changes while true, which is what makes
   * `rollback()` unambiguous. Bind it for the whole round-trip.
   * @default false
   */
  pending = input(false, { transform: booleanAttribute });

  /**
   * The write failed (`X-6`). Accepts an `SvDataError` or a plain string.
   *
   * ★ Not `serverError`. That is the field-validation contract and it expires
   *   on the next value change — and a rollback IS a value change, so a failure
   *   routed through it would vanish in the same tick the box un-ticked. The
   *   user would watch it revert and be told nothing. Call `rollback()` as well:
   *   a message beside a box still showing the state that failed is worse than
   *   either alone.
   * @default null
   */
  error = input<SvDataError | string | null>(null);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emits the new boolean state after every change. */
  changed = output<boolean>();

  /**
   * The same change, carrying what a server write needs: an idempotency key and
   * a guarded `rollback()`. Additive — `changed` still fires first, and a
   * checkbox that only writes to local state has no use for this.
   */
  changeRequest = output<SvCheckboxChange>();

  // ── CVA internals ────────────────────────────────────────────────────────

  private _onChange: (v: boolean) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);

  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  /** Monotonic change counter, so a stale `rollback()` handle can be refused. */
  private readonly _revision = signal(0);

  private readonly _edit = createOptimisticEdit({
    revision: () => this._revision(),
    selector: 'sv-checkbox',
    superseded:
      'the checkbox has been changed again since, so putting the old value back ' +
      'would discard the newer change. Bind [pending] so it cannot be changed ' +
      'while the write is in flight.',
  });

  /** The failed-write message, normalized from either accepted shape. */
  readonly writeErrorMessage = computed<string>(() => {
    const failure = this.error();
    return failure ? toSvDataError(failure).message : '';
  });

  /** Stable unique fallback id so label + ARIA associations always work. */
  private readonly _autoId = svUniqueId('sv-checkbox');
  /** Effective id used by the native input and its <label for>. */
  readonly resolvedId = computed(() => this.inputId() || this._autoId);

  /** Shared validation-error contract — server outranks client, server expires. */
  protected readonly fieldError = createFieldError(this.checked, this.serverError, this.errorMessage);
  protected readonly errorId = computed(() => `${this.resolvedId()}-error`);
  protected readonly writeErrorId = computed(() => `${this.resolvedId()}-write-error`);

  /**
   * The checkbox may be described by its own description text, by the error, or
   * by both — `aria-describedby` takes a list, and dropping one to show the
   * other loses information a screen-reader user needs.
   */
  protected readonly describedBy = computed(() =>
    svDescribedBy({
      hint: this.description() && this.descId(),
      error: this.fieldError.showError() && this.errorId(),
      extra: [this.writeErrorMessage() && this.writeErrorId()],
    }),
  );
  /** id of the visible label (referenced by aria-labelledby). */
  readonly labelId    = computed(() => `${this.resolvedId()}-label`);
  /** id of the description (referenced by aria-describedby). */
  readonly descId     = computed(() => `${this.resolvedId()}-desc`);
  /** True when a visible text label is rendered. */
  readonly hasVisibleLabel = computed<boolean>(() => !!this.label());

  writeValue(val: boolean): void        { this.checked.set(!!val); }
  registerOnChange(fn: (v: boolean) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void           { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void       { this._formDisabled.set(isDisabled); }

  // ── Interaction ───────────────────────────────────────────────────────────

  /**
   * While `pending`, the click is refused before the browser flips the native
   * box — returning early from `toggle()` alone would leave the native `checked`
   * property out of step with the signal, and the binding would never correct it
   * because the signal did not change.
   */
  onClick(event: Event): void {
    if (this.pending()) event.preventDefault();
  }

  toggle(): void {
    if (this.resolvedDisabled() || this.pending()) return;
    const previous = this.checked();
    const next = !previous;

    /**
     * ★★★ A MIXED CHECKBOX THAT STAYS MIXED AFTER YOU CLICK IT (`FI-06-I1`).
     *     `indeterminate` is an input, so this component cannot clear it — the
     *     host owns it, and the host is the only thing that knows whether the
     *     children are now all selected. But it CAN see that the contradiction
     *     has happened, and saying nothing is how the state persists: the user
     *     clicks a "select all" showing a dash, the box fills in, and a screen
     *     reader still announces "mixed".
     *
     * ⚠️ A WARNING RATHER THAN A FIX, and deliberately. Clearing it here would
     *    silently disagree with the host on the next change detection — the
     *    input would simply set it back — and a component that fights its own
     *    input is worse than one that reports the conflict.
     */
    if (this.indeterminate()) {
      svWarnOnce(
        'checkbox-indeterminate-not-cleared',
        '<sv-checkbox> was toggled while `indeterminate` was true, and `indeterminate` ' +
          'is an input this component cannot clear. Clear it in your handler for ' +
          '`changed`, or the control keeps rendering a dash and announcing ' +
          'aria-checked="mixed" after the user has already resolved it. ' +
          'Note that `indeterminate` is a VISUAL state — the submitted value is ' +
          'always the boolean `checked`, never a third thing.',
      );
    }

    this.checked.set(next);
    this._onChange(next);
    this._onTouched();
    this._revision.update((n) => n + 1);
    this.changed.emit(next);
    this.changeRequest.emit({
      checked: next,
      requestKey: svRequestKey('checkbox'),
      rollback: this._edit.begin(() => {
        this.checked.set(previous);
        this._onChange(previous);
      }),
    });
  }

  // ── Computed classes ──────────────────────────────────────────────────────

  readonly boxSize = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-3.5 w-3.5';
      case 'lg': return 'h-5 w-5';
      default:   return 'h-4 w-4';
    }
  });

  readonly iconSize = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-2 w-2';
      case 'lg': return 'h-3 w-3';
      default:   return 'h-2.5 w-2.5';
    }
  });

  readonly labelSize = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'text-xs';
      case 'lg': return 'text-base';
      default:   return 'text-sm';
    }
  });

  readonly activeColor = computed<string>(() => {
    const map: Record<CheckboxVariant, string> = {
      primary: 'bg-primary-600 border-primary-600 dark:bg-primary-500 dark:border-primary-500',
      success: 'bg-accent-600 border-accent-600 dark:bg-accent-500 dark:border-accent-500',
      warning: 'bg-warning-500 border-warning-500 dark:bg-warning-400 dark:border-warning-400',
      danger:  'bg-danger-600 border-danger-600 dark:bg-danger-500 dark:border-danger-500',
      neutral: 'bg-gray-700 border-gray-700 dark:bg-gray-400 dark:border-gray-400',
    };
    return map[this.variant()];
  });

  readonly boxClasses = computed<string>(() => {
    const active = this.checked() || this.indeterminate();
    return [
      'shrink-0 self-center rounded border-2 flex items-center justify-center transition-colors duration-150',
      // Visible focus ring, driven by the sibling `peer` input being focused.
      'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2',
      'dark:peer-focus-visible:ring-primary-400 dark:peer-focus-visible:ring-offset-gray-900',
      this.boxSize(),
      active
        ? this.activeColor()
        : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800',
      this.resolvedDisabled()
        ? 'cursor-not-allowed opacity-50'
        : 'cursor-pointer',
    ].join(' ');
  });
}
