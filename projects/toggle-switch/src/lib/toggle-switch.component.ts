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
import { SvIconComponent } from '@styloviz/icons';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  createFieldError,
  createOptimisticEdit,
  svDescribedBy,
  SvFieldErrorComponent,
  svRequestKey,
  SvSpinnerArcComponent,
  toSvDataError,
  type SvDataError,
  type SvServerError,
  svUniqueId,
} from '@styloviz/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToggleSize    = 'xs' | 'sm' | 'md' | 'lg';
export type ToggleVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

/**
 * Label position relative to the toggle track.
 * - `right`  — label follows the track (default)
 * - `left`   — label precedes the track
 * - `top`    — label stacked above the track
 * - `hidden` — no visible label (aria-label still required for a11y)
 */
export type ToggleLabelPosition = 'right' | 'left' | 'top' | 'hidden';

/**
 * One toggle the host is expected to persist.
 *
 * Emitted by `(toggleRequest)` alongside the plain `(toggled)`. Bind whichever
 * matches the work: `toggled` when the new value is the whole story, this when
 * a server has to agree with it.
 *
 * A switch that silently flips back three seconds later is the defining trust
 * failure of a settings screen, and it happens because the component has no
 * vocabulary for "in flight" and the host has no handle to undo with. These are
 * the two halves of that: bind `[pending]` while the write is out, and call
 * `rollback()` if it fails.
 */
export interface SvToggleChange {
  /** The state the user asked for — already applied to `checked`. */
  readonly checked: boolean;
  /**
   * Idempotency key for this write. Send it, and have the server ignore a key
   * it has already applied: without one, an HTTP interceptor retrying a flaky
   * request turns one toggle into two, and a double-tap becomes on-off-on
   * against a server free to apply them in any order.
   */
  readonly requestKey: string;
  /**
   * Put `checked` back. Refuses — with a dev-mode warning — if the user has
   * toggled again since, because restoring a value from before their newer
   * change would throw that change away silently. Bind `[pending]` so it cannot
   * arise.
   */
  readonly rollback: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ToggleSwitch — An accessible on/off control for settings, feature flags,
 * and boolean preferences.
 *
 * Supports:
 * - Angular signals two-way binding via `[(checked)]`
 * - Reactive Forms via `ControlValueAccessor` (`formControl` / `formControlName`)
 * - 4 sizes × 5 color variants
 * - Optional ON/OFF labels inside the track
 * - Optional icon slots in the thumb (on/off state SVG paths)
 * - Descriptive sub-label beneath the main label
 * - Disabled & loading states
 * - Full keyboard accessibility (Space / Enter toggle)
 * - `aria-checked`, `role="switch"`, focus-visible ring
 */
@Component({
  selector: 'sv-toggle-switch',
  standalone: true,
  imports: [NgClass, SvIconComponent, SvFieldErrorComponent, SvSpinnerArcComponent],
  templateUrl: './toggle-switch.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvToggleSwitchComponent),
      multi: true,
    },
  ],
})
export class SvToggleSwitchComponent implements ControlValueAccessor {
  // ── Two-way binding ───────────────────────────────────────────────────────

  /** Current on/off state. Use `[(checked)]` for two-way binding. @default false */
  checked = model<boolean>(false);

  // ── Content ───────────────────────────────────────────────────────────────

  /** Visible label text. */
  label           = input<string>('');

  /** Smaller descriptor line beneath the label. */
  description     = input<string>('');

  /** Position of the label relative to the track. @default 'right' */
  labelPosition   = input<ToggleLabelPosition>('right');

  /**
   * Text shown inside the track when ON.
   * Keep ≤ 3 characters for `md` size, fewer for smaller sizes. @default ''
   */
  onLabel         = input<string>('');

  /**
   * Text shown inside the track when OFF. @default ''
   */
  offLabel        = input<string>('');

  /**
   * Icon-library NAME rendered inside the thumb when the toggle is ON — e.g.
   * `'check'`. Omit to show a plain thumb.
   *
   * ★ BREAKING (icon sweep): was `onIconPath`, a raw SVG `d` string.
   */
  onIcon          = input<string>('');

  /**
   * Icon-library NAME rendered inside the thumb when the toggle is OFF — e.g.
   * `'close'`. Was `offIconPath`.
   */
  offIcon         = input<string>('');

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Size of the toggle track and thumb. @default 'md' */
  size    = input<ToggleSize>('md');

  /** Active-state color variant. @default 'primary' */
  variant = input<ToggleVariant>('primary');

  // ── State ─────────────────────────────────────────────────────────────────

  /** Disable interaction. @default false */
  disabled = input<boolean>(false);

  /** Mark the control as required (sets `aria-required`). @default false */
  required = input<boolean>(false);

  /**
   * The switch's own value is not known yet — a settings screen that rendered
   * before its settings arrived. Shows a spinner in the thumb and blocks
   * interaction. @default false
   */
  loading  = input<boolean>(false);

  /**
   * The user's change is applied on screen and the write is in flight.
   *
   * ── Why this is not `loading` ────────────────────────────────────────────
   * They are opposite states wearing the same spinner. `loading` means *we do
   * not know what this switch is* — there is nothing on screen to trust yet.
   * `pending` means *we know exactly what the user asked for, it is already
   * drawn, and the server has not agreed yet*. Collapsing the two costs the
   * host the only lock that makes `rollback()` unambiguous: with two writes
   * outstanding there is no single previous state to return to, so the older
   * handle would silently discard the newer change.
   *
   * Bind it for the whole round-trip and clear it in both branches.
   * @default false
   */
  pending = input(false, { transform: booleanAttribute });

  /**
   * The write failed.
   *
   * ── Why this is not `serverError` ────────────────────────────────────────
   * They are different facts about different things, and using one for the
   * other is a real bug rather than a naming preference. `serverError` is the
   * field-error contract: *the server rejected this VALUE*, and it self-expires
   * on the next change because a rejection stops describing a value the moment
   * the value moves. A failed write is *the server never recorded the change* —
   * and reverting it **is** a change, so routing it through `serverError` would
   * clear the message in the same tick the rollback ran. The user would see the
   * switch move back and be told nothing, which is the precise failure this
   * whole contract exists to prevent.
   *
   * Accepts an `SvDataError` or a plain string. Roll the value back as well —
   * a message beside a switch still showing the state that failed to save is
   * worse than either on its own.
   * @default null
   */
  error = input<SvDataError | string | null>(null);

  /**
   * Why this switch cannot be changed. Non-empty locks the control and renders
   * the reason, which `aria-describedby` also points at.
   *
   * Distinct from `disabled`, deliberately. A disabled switch is a dead end: it
   * tells the user they may not, and nothing else, so they are left to guess
   * between "not on your plan", "your admin turned this off" and "this is
   * broken". Those need different next actions, and only the host knows which
   * one applies.
   * @default ''
   */
  lockReason = input<string>('');

  // ── Accessibility ─────────────────────────────────────────────────────────

  /**
   * `aria-label` override — required when `labelPosition === 'hidden'`
   * so screen readers still announce the control's purpose.
   */
  ariaLabel = input<string>('');

  /** id forwarded to the hidden `<input>` for `<label for="">` use. */
  inputId   = input<string>('');

  // ── Extra ─────────────────────────────────────────────────────────────────

  /** Additional CSS classes on the root wrapper element. */
  customClass = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emits the new boolean state after every toggle. */
  toggled = output<boolean>();

  /**
   * The same toggle, carrying what a server write needs: an idempotency key and
   * a guarded way back.
   *
   * Additive, not a replacement — `toggled` still fires, and a switch that only
   * writes to local state has no use for either of these. Both are emitted for
   * one interaction, in this order.
   */
  toggleRequest = output<SvToggleChange>();

  // ── CVA internals ────────────────────────────────────────────────────────

  private _onChange: (v: boolean) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };

  /** Tracks disabled state set programmatically via formControl.disable(). */
  private readonly _formDisabled = signal(false);

  /**
   * Merged disabled state — true when either the [disabled] input or the
   * parent FormControl is disabled. Use this everywhere instead of disabled().
   */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  /** Monotonic toggle counter, so a stale `rollback()` handle can be refused. */
  private readonly _revision = signal(0);

  private readonly _edit = createOptimisticEdit({
    revision: () => this._revision(),
    selector: 'sv-toggle-switch',
    superseded:
      'the switch has been toggled again since, so putting the old value back ' +
      'would discard the newer change. Bind [pending] so it cannot be toggled ' +
      'while the write is in flight.',
  });

  /**
   * Every reason the switch will not respond, in one place.
   *
   * Four inputs reached this condition and three of them used to be spelled out
   * at each call site, which is how `pending` would have been added to the
   * click guard and forgotten in the cursor.
   */
  readonly isLocked = computed<boolean>(
    () => this.resolvedDisabled() || this.loading() || this.pending() || !!this.lockReason(),
  );

  /**
   * Whether the switch stays in the tab order.
   *
   * ★★ A `lockReason` KEEPS IT FOCUSABLE EVEN WHEN IT IS ALSO DISABLED. The
   *    natural way to write a locked setting is `[disabled]="true"` plus the
   *    reason — or a `formControl.disable()` plus the reason — and `tabindex`
   *    used to follow `disabled` alone, so exactly that combination put the
   *    explanation on a control a keyboard or screen-reader user could never
   *    reach. The switch is still inert (`isLocked`, `aria-disabled`); only
   *    focus survives, which is what makes the reason readable.
   */
  protected readonly focusable = computed<boolean>(
    () => !this.resolvedDisabled() || !!this.lockReason(),
  );

  /** Id for the lock reason, so `aria-describedby` can point at it. */
  protected readonly lockReasonId = svUniqueId('sv-toggle-switch-lock');

  /** Id for the failed-write message. */
  protected readonly writeErrorId = svUniqueId('sv-toggle-switch-write-error');

  /** The failure message, normalized from either accepted shape. */
  readonly writeErrorMessage = computed<string>(() => {
    const failure = this.error();
    return failure ? toSvDataError(failure).message : '';
  });

  writeValue(val: boolean): void {
    this.checked.set(!!val);
  }
  registerOnChange(fn: (v: boolean) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this._formDisabled.set(isDisabled); }

  // ── Interaction ───────────────────────────────────────────────────────────

  toggle(): void {
    if (this.isLocked()) return;
    const previous = this.checked();
    const next = !previous;

    // Applied first, told to the host second. A switch that waits for a
    // round-trip before moving reads as broken, which is the whole reason the
    // rollback below has to exist.
    this.checked.set(next);
    this._onChange(next);
    this._onTouched();
    this._revision.update((n) => n + 1);

    this.toggled.emit(next);
    this.toggleRequest.emit({
      checked: next,
      requestKey: svRequestKey('toggle'),
      rollback: this._edit.begin(() => {
        this.checked.set(previous);
        this._onChange(previous);
      }),
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.toggle();
    }
  }

  // ── Computed class maps ───────────────────────────────────────────────────

  /** Root wrapper layout class driven by labelPosition. */
  rootClasses = computed<string>(() => {
    const pos = this.labelPosition();
    const layout = pos === 'top'
      ? 'flex flex-col gap-1.5'
      : pos === 'left'
        ? 'flex flex-row items-center gap-3'
        : 'flex flex-row items-center gap-3';

    return [
      layout,
      // `pending` is deliberately NOT dimmed to 60%: the value on screen is the
      // one the user just chose, and fading it reads as "this did not take".
      this.resolvedDisabled() || this.loading() || this.lockReason()
        ? 'cursor-not-allowed opacity-60'
        : this.pending()
          ? 'cursor-progress'
          : 'cursor-pointer',
      this.customClass(),
    ].filter(Boolean).join(' ');
  });

  /** Track background — variant color when ON, gray when OFF. */
  trackClasses = computed<string>(() => {
    const on = this.checked();

    const variantOn: Record<ToggleVariant, string> = {
      primary: 'bg-primary-600 dark:bg-primary-500',
      success: 'bg-accent-600 dark:bg-accent-500',
      warning: 'bg-warning-500 dark:bg-warning-400',
      danger:  'bg-danger-600 dark:bg-danger-500',
      neutral: 'bg-gray-700 dark:bg-gray-400',
    };

    const sizeMap: Record<ToggleSize, string> = {
      xs: 'h-4 w-7',
      sm: 'h-5 w-9',
      md: 'h-6 w-11',
      lg: 'h-7 w-14',
    };

    return [
      'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out',
      'focus-visible:outline-none',
      sizeMap[this.size()],
      on ? variantOn[this.variant()] : 'bg-gray-200 dark:bg-gray-700',
    ].join(' ');
  });

  /** Thumb translate offset — moves right when ON. */
  thumbClasses = computed<string>(() => {
    const on = this.checked();

    const translateMap: Record<ToggleSize, { off: string; on: string }> = {
      xs: { off: 'translate-x-0.5', on: 'translate-x-3.5' },
      sm: { off: 'translate-x-0.5', on: 'translate-x-4.5' },
      md: { off: 'translate-x-0.5', on: 'translate-x-5.5' },
      lg: { off: 'translate-x-1',   on: 'translate-x-7.5' },
    };

    const sizeMap: Record<ToggleSize, string> = {
      xs: 'h-3 w-3',
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-5.5 w-5.5',
    };

    const t = translateMap[this.size()];

    return [
      'pointer-events-none inline-flex items-center justify-center rounded-full bg-white shadow-sm',
      'transform transition-transform duration-200 ease-in-out ring-0',
      sizeMap[this.size()],
      on ? t.on : t.off,
    ].join(' ');
  });

  /** Icon size inside the thumb. */
  thumbIconClass = computed<string>(() => {
    switch (this.size()) {
      case 'xs': return 'h-1.5 w-1.5';
      case 'sm': return 'h-2.5 w-2.5';
      case 'lg': return 'h-3.5 w-3.5';
      default:   return 'h-3 w-3';
    }
  });

  /** Track label text size. */
  trackLabelClass = computed<string>(() => {
    switch (this.size()) {
      case 'xs': return 'text-[7px]';
      case 'sm': return 'text-[8px]';
      case 'lg': return 'text-[10px]';
      default:   return 'text-[9px]';
    }
  });

  /**
   * Ink for the ON label, which prints ON the track fill and therefore has to be
   * chosen per variant AND per mode.
   *
   * This was a flat `text-white/90` and there is no flat answer: measured against
   * the fills above it read 3.25:1 on `accent-600`, 2.24:1 on `accent-500` and
   * 3.33:1 on `primary-500`. Nor does swapping it for a flat black or a flat
   * white work, because each variant's dark arm is a LIGHTER stop than its light
   * arm — deliberately, since a track with no label is an indicator on a 3:1 bar.
   * So `primary` needs white at 5.25:1 in light and near-black at 5.35:1 in dark,
   * while `warning` needs near-black in both (9.43:1 / 11.69:1). Every pair below
   * clears 4.5:1; the worst is `danger` light at 4.77:1.
   *
   * `gray-950` rather than a literal black so a rebranded scope can move it.
   */
  trackOnInkClass = computed<string>(() => {
    const ink: Record<ToggleVariant, string> = {
      primary: 'text-white dark:text-gray-950',
      success: 'text-gray-950',
      warning: 'text-gray-950',
      danger:  'text-white dark:text-gray-950',
      neutral: 'text-white dark:text-gray-950',
    };
    return ink[this.variant()];
  });

  /** Main label text size. */
  labelClass = computed<string>(() => {
    const base = 'font-medium text-gray-800 dark:text-gray-100 leading-none select-none';
    switch (this.size()) {
      case 'xs': return `${base} text-xs`;
      case 'sm': return `${base} text-sm`;
      case 'lg': return `${base} text-base`;
      default:   return `${base} text-sm`;
    }
  });

  /** Description text size. */
  descClass = computed<string>(() => {
    switch (this.size()) {
      case 'lg': return 'text-sm text-gray-500 dark:text-gray-400 select-none mt-0.5';
      default:   return 'text-xs text-gray-500 dark:text-gray-400 select-none mt-0.5';
    }
  });

  /** Stable unique fallback id so label + ARIA associations always work. */
  private readonly _autoId = svUniqueId('sv-toggle');
  /** Effective id used by the switch and its <label for>. */
  readonly resolvedId = computed(() => this.inputId() || this._autoId);
  /** id of the visible label (referenced by aria-labelledby). */
  readonly labelId    = computed(() => `${this.resolvedId()}-label`);
  /** id of the description (referenced by aria-describedby). */
  readonly descId     = computed(() => `${this.resolvedId()}-desc`);

  /** True when a visible text label is rendered next to the switch. */
  readonly hasVisibleLabel = computed<boolean>(
    () => !!this.label() && this.labelPosition() !== 'hidden'
  );

  /** Resolved aria-label for the button role. */
  resolvedAriaLabel = computed<string>(() =>
    this.ariaLabel() || this.label() || 'Toggle'
  );

  /** Whether to show the thumb icon. */
  hasThumbIcon = computed<boolean>(() =>
    !!(this.checked() ? this.onIcon() : this.offIcon())
  );

  currentThumbIcon = computed<string>(() =>
    this.checked() ? this.onIcon() : this.offIcon()
  );

  showOnLabel  = computed(() => !!this.onLabel()  && this.checked());
  showOffLabel = computed(() => !!this.offLabel()  && !this.checked());

  // ── Validation error ─────────────────────────────────────────────────────
  //
  // This control had no error slot: a form could reject it with no way to say
  // why. `serverError` outranks `errorMessage` while it still describes the
  // current value, and expires on the next change — see `createFieldError`.

  /** Client-side validation message. */
  errorMessage = input<string>('');
  /** A rejection reported by the server about this value. Self-expiring. */
  serverError = input<SvServerError>(null);

  protected readonly fieldError = createFieldError(this.checked, this.serverError, this.errorMessage);
  protected readonly errorId = svUniqueId('sv-toggle-switch-error');

  /**
   * What the switch is described by.
   *
   * The helper text and the validation error can both be present, and
   * `aria-describedby` takes a list — writing one over the other is how a
   * rejection ends up announced nowhere. Empty means the attribute is dropped
   * rather than rendered blank.
   */
  protected readonly describedBy = computed<string | null>(() =>
    svDescribedBy({
      hint: this.description() && this.descId(),
      error: this.fieldError.showError() && this.errorId,
      // The two this control has that the three named slots do not cover: why
      // it will not move, and that the last write did not land.
      extra: [
        this.lockReason() && this.lockReasonId,
        this.writeErrorMessage() && this.writeErrorId,
      ],
    }),
  );

}
