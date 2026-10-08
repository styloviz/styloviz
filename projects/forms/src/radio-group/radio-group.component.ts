import {
  Component,
  ElementRef,
  inject,
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
import { NgClass } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { svRovingTarget, svUniqueId } from '@styloviz/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RadioGroupLayout  = 'vertical' | 'horizontal' | 'grid';
export type RadioGroupVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
export type RadioGroupSize    = 'sm' | 'md' | 'lg';
export type RadioGroupStyle   = 'default' | 'card' | 'button';

export interface RadioOption {
  readonly value:        string;
  readonly label:        string;
  readonly description?: string;
  readonly disabled?:    boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * RadioGroup — An accessible radio button group for single-selection.
 *
 * Supports:
 * - Angular signals two-way binding via `[(value)]`
 * - Reactive Forms via `ControlValueAccessor`
 * - Vertical, horizontal, and grid layouts
 * - Default, card, and segmented-button visual styles
 * - 3 sizes × 5 color variants
 * - Per-option disabled state
 * - Optional description per option
 * - Full keyboard navigation (arrow keys)
 */
@Component({
  selector: 'sv-radio-group',
  standalone: true,
  imports: [NgClass],
  templateUrl: './radio-group.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvRadioGroupComponent),
      multi: true,
    },
  ],
})
export class SvRadioGroupComponent implements ControlValueAccessor {
  // ── Two-way binding ───────────────────────────────────────────────────────

  /** Currently selected value. Use `[(value)]` for two-way binding. */
  value = model<string>('');

  // ── Options ───────────────────────────────────────────────────────────────

  /** Array of radio options to render. */
  options = input<RadioOption[]>([]);

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Layout direction. @default 'vertical' */
  layout = input<RadioGroupLayout>('vertical');

  /** Visual style. @default 'default' */
  radioStyle = input<RadioGroupStyle>('default');

  /** Size of each radio item. @default 'md' */
  size = input<RadioGroupSize>('md');

  /** Active color variant. @default 'primary' */
  variant = input<RadioGroupVariant>('primary');

  // ── State ─────────────────────────────────────────────────────────────────

  /** Disable all options. @default false */
  disabled = input<boolean>(false);

  /** Mark the group as required (sets `aria-required`). @default false */
  required = input<boolean>(false);

  /** Optional legend/label for the group. */
  groupLabel = input<string>('');

  /**
   * `aria-label` for the group — use when there is no visible `groupLabel`.
   */
  ariaLabel = input<string>('');

  /** Helper text shown below the group (hidden when `errorMessage` is set). */
  hint = input<string>('');

  /** Error message shown below the group; sets `aria-invalid` when present. */
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


  /** Explicit `name` for the radio inputs. Auto-generated when omitted. */
  groupName = input<string>('');

  /** Additional CSS classes on the root wrapper. */
  customClass = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emits the newly selected value. */
  changed = output<string>();

  // ── CVA internals ────────────────────────────────────────────────────────

  private _onChange: (v: string) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  /** Stable unique fallback name/id so grouping + ARIA associations always work. */
  private readonly _autoId = svUniqueId('sv-radio');
  /** Effective `name` shared by the radio inputs. */
  readonly resolvedName = computed(() => this.groupName() || this._autoId);
  /** id of the visible group label (referenced by aria-labelledby). */
  readonly labelId = computed(() => `${this._autoId}-label`);
  /** id of the hint/error description (referenced by aria-describedby). */
  readonly descId  = computed(() => `${this._autoId}-desc`);
  /** True when a hint or error description is rendered below the group. */
  readonly hasDescription = computed(() => !!this.resolvedError() || !!this.hint());

  /**
   * The single value that should be in the tab order for the button style
   * (roving tabindex): the selected option, or the first enabled option.
   */
  readonly focusableValue = computed<string>(() => {
    const opts = this.options();
    const selected = opts.find(o => o.value === this.value() && !this.isItemDisabled(o));
    if (selected) return selected.value;
    return opts.find(o => !this.isItemDisabled(o))?.value ?? '';
  });

  writeValue(val: string): void         { this.value.set(val ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this._formDisabled.set(isDisabled); }

  // ── Interaction ───────────────────────────────────────────────────────────

  select(option: RadioOption): void {
    if (this.resolvedDisabled() || option.disabled) return;
    this.value.set(option.value);
    this._onChange(option.value);
    this._onTouched();
    this.changed.emit(option.value);
  }

  isSelected(option: RadioOption): boolean {
    return this.value() === option.value;
  }

  isItemDisabled(option: RadioOption): boolean {
    return this.resolvedDisabled() || !!option.disabled;
  }

  /** Roving tabindex for the button style — only one button is tabbable. */
  buttonTabindex(option: RadioOption): number {
    if (this.isItemDisabled(option)) return -1;
    return option.value === this.focusableValue() ? 0 : -1;
  }

  /**
   * Arrow-key navigation for the segmented-button style (WAI-ARIA radiogroup):
   * moving focus also selects, with wraparound and Home/End support.
   */
  onButtonKeydown(event: KeyboardEvent, option: RadioOption): void {
    const key = event.key;
    if (key === ' ' || key === 'Enter') {
      event.preventDefault();
      this.select(option);
      return;
    }
    const opts = this.options().filter(o => !this.isItemDisabled(o));
    if (opts.length === 0) return;
    const i = opts.findIndex(o => o.value === option.value);
    // Movement is `svRovingTarget`'s; the CONSEQUENCE is this component's.
    // Selection follows focus here because the role is `radiogroup` and that is
    // the APG pattern — a chip set sharing the same arithmetic must not.
    const next = svRovingTarget(key, opts.length, i);
    if (next === null) return;
    event.preventDefault();
    const target = opts[next];
    this.select(target);
    this.focusButton(target.value);
  }

  private focusButton(value: string): void {
    setTimeout(() => {
      const nodes = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-radio-button]');
      nodes.forEach(n => {
        if (n.getAttribute('data-radio-button') === value) n.focus();
      });
    });
  }

  // ── Computed classes ──────────────────────────────────────────────────────

  readonly wrapperClasses = computed<string>(() => {
    const layout = this.layout();
    if (this.radioStyle() === 'button') {
      return 'flex flex-wrap gap-2';
    }
    if (layout === 'horizontal') return 'flex flex-wrap gap-x-6 gap-y-3';
    if (layout === 'grid')       return 'grid grid-cols-2 gap-3 sm:grid-cols-3';
    return 'flex flex-col gap-3';
  });

  readonly dotSize = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-3.5 w-3.5';
      case 'lg': return 'h-5 w-5';
      default:   return 'h-4 w-4';
    }
  });

  readonly innerDotSize = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-1.5 w-1.5';
      case 'lg': return 'h-2.5 w-2.5';
      default:   return 'h-2 w-2';
    }
  });

  readonly labelSize = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'text-xs';
      case 'lg': return 'text-base';
      default:   return 'text-sm';
    }
  });

  readonly variantActive = computed<string>(() => {
    const map: Record<RadioGroupVariant, string> = {
      primary: 'border-primary-600 dark:border-primary-500',
      success: 'border-accent-600 dark:border-accent-500',
      warning: 'border-warning-500 dark:border-warning-400',
      danger:  'border-danger-600 dark:border-danger-500',
      neutral: 'border-gray-700 dark:border-gray-300',
    };
    return map[this.variant()];
  });

  readonly variantDot = computed<string>(() => {
    const map: Record<RadioGroupVariant, string> = {
      primary: 'bg-primary-600 dark:bg-primary-500',
      success: 'bg-accent-600 dark:bg-accent-500',
      warning: 'bg-warning-500 dark:bg-warning-400',
      danger:  'bg-danger-600 dark:bg-danger-500',
      neutral: 'bg-gray-700 dark:bg-gray-300',
    };
    return map[this.variant()];
  });

  readonly variantButton = computed<string>(() => {
    const map: Record<RadioGroupVariant, string> = {
      primary: 'bg-primary-600 border-primary-600 text-white',
      success: 'bg-accent-700 border-accent-700 text-white',
      warning: 'bg-warning-500 border-warning-500 text-gray-900 dark:bg-warning-400 dark:border-warning-400',
      danger:  'bg-danger-600 border-danger-600 text-white',
      neutral: 'bg-gray-700 border-gray-700 text-white dark:bg-gray-400 dark:border-gray-400 dark:text-gray-900',
    };
    return map[this.variant()];
  });

  dotClasses(option: RadioOption): string {
    const selected = this.isSelected(option);
    return [
      'shrink-0 rounded-full border-2 flex items-center justify-center transition-all duration-150',
      // Visible focus ring, driven by the sibling `peer` native radio input.
      'peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-primary-500',
      'dark:peer-focus-visible:ring-primary-400 dark:peer-focus-visible:ring-offset-gray-900',
      this.dotSize(),
      selected
        ? this.variantActive()
        : 'border-gray-300 dark:border-gray-600',
    ].join(' ');
  }

  readonly hintColorClass = computed<string>(() =>
    this.resolvedError()
      ? 'text-danger-600 dark:text-danger-400'
      : 'text-gray-500 dark:text-gray-400'
  );

  cardClasses(option: RadioOption): string {
    const selected = this.isSelected(option);
    const disabled = this.isItemDisabled(option);
    return [
      'relative flex gap-3 rounded-xl border-2 p-4 transition-all duration-150',
      selected
        ? 'border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-primary-950/30'
        : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-gray-600',
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    ].join(' ');
  }

  buttonClasses(option: RadioOption): string {
    const selected = this.isSelected(option);
    const disabled = this.isItemDisabled(option);
    const sizeMap: Record<RadioGroupSize, string> = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base',
    };
    return [
      'rounded-lg border font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2',
      sizeMap[this.size()],
      selected
        ? this.variantButton()
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white',
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    ].join(' ');
  }
}
