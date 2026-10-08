import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SvFieldErrorComponent, createFieldError, svRovingTarget, type SvServerError, svUniqueId } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

export type SegmentedSize    = 'xs' | 'sm' | 'md' | 'lg';
export type SegmentedVariant = 'default' | 'pills' | 'underline' | 'bordered' | 'swatch';

/**
 * What this control IS, in assistive-technology terms.
 *
 * ── The defect this exists for (`FI-22-I1` / `FI-22-M1`) ───────────────────
 *
 * ★★★ THE SAME ROW OF BUTTONS IS TWO DIFFERENT WIDGETS, and the difference is
 *     not cosmetic. A `radiogroup` **sets a value**: "Monthly / Yearly" on a
 *     pricing form is an answer that gets submitted. A `tablist` **controls
 *     visible content**: "Overview / Activity / Settings" swaps a panel and
 *     changes nothing about the form. They differ in the role, in the state
 *     attribute (`aria-checked` vs `aria-selected`), in whether a relationship
 *     to other content exists at all (`aria-controls` → `role="tabpanel"`), and
 *     in how a screen-reader user is expected to get INTO that content.
 *
 * ★★ This component hard-coded `radiogroup`, so every tab strip built with it
 *    told a screen-reader user they were answering a question. Nothing about it
 *    looked wrong, which is why it stayed that way.
 */
export type SegmentedSemantics = 'radiogroup' | 'tablist';

/**
 * When a tab becomes the selected one.
 *
 * ★★ `'manual'` IS ONLY MEANINGFUL FOR `'tablist'`, and offering it for a
 *    radiogroup would produce a broken radiogroup: selection following focus IS
 *    the radio pattern, not a default someone chose. The input is ignored there,
 *    deliberately, rather than silently producing a control that looks right and
 *    announces wrong.
 *
 * ★★★ IT MATTERS WHEN PANELS ARE EXPENSIVE. With `'automatic'`, arrowing from
 *     the first tab to the last activates every tab on the way — which, with
 *     `@defer`-loaded panels or a fetch per tab, is four loads to reach one. It
 *     is the same shape as a filter chip that turns itself on as you scan past:
 *     movement having a consequence nobody asked for.
 */
export type SegmentedActivation = 'automatic' | 'manual';

export interface SegmentOption {
  readonly value: string;
  readonly label: string;
  /** Name of an icon in `@styloviz/icons` (was a raw SVG path). */
  readonly icon?: string;
  readonly disabled?: boolean;
  readonly badge?: string | number;
  /**
   * Id of the element this segment controls — the `role="tabpanel"`.
   *
   * ★★ ONLY READ IN `tablist` MODE, AND A TAB WITHOUT IT IS A TAB THAT CONTROLS
   *    NOTHING. `aria-controls` is what makes a tab a tab rather than a button
   *    that looks like one; without it a screen-reader user is told there is a
   *    panel and given no way to reach it.
   */
  readonly controls?: string;

  /**
   * Explicit DOM id for this segment's `role="tab"` element.
   *
   * ★★ HOST-SUPPLIED BECAUSE THE RELATIONSHIP IS TWO-WAY AND ONLY THE HOST CAN
   *    WRITE THE OTHER HALF. The panel needs `aria-labelledby="<this id>"`, and
   *    a host that has to reach into the component for a generated id needs a
   *    `viewChild` — which breaks the moment a page renders more than one of
   *    these. Supplying both ids beside each other is the version that keeps
   *    working. Falls back to a generated id when omitted, so a tab is never
   *    unnameable.
   */
  readonly tabId?: string;

  /** CSS colour for the swatch variant (renders a colour dot). */
  readonly color?: string;
  /** Sold-out / unavailable — non-interactive with a strike overlay. */
  readonly soldOut?: boolean;
}

@Component({
  selector: 'sv-segmented-control',
  standalone: true,
  imports: [SvIconComponent, SvFieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './segmented-control.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvSegmentedControlComponent),
      multi: true,
    },
  ],
})
export class SvSegmentedControlComponent implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The selectable segments (value + label, optional icon/badge). */
  options  = input.required<readonly SegmentOption[]>();
  /** Active segment value (two-way). */
  value    = model<string>('');
  /** Control size: sm, md or lg. @default 'md' */
  size     = input<SegmentedSize>('md');
  /** Visual style: default, pills, underline or bordered. @default 'default' */
  variant  = input<SegmentedVariant>('default');
  /** Stretch segments to fill the container width. @default false */
  fullWidth = input<boolean>(false);
  /** Disable the whole control. @default false */
  disabled = input<boolean>(false);
  /** Accessible name for the group. */
  ariaLabel = input<string>('');

  /**
   * Whether this control sets a value or switches visible content.
   * @default 'radiogroup'
   *
   * Defaulted to the behaviour the component has always had, so no existing
   * caller changes meaning. See `SegmentedSemantics` for why the choice is not
   * cosmetic — and note that a `tablist` whose options carry no `controls` is a
   * tablist controlling nothing, which is worse than a radiogroup.
   */
  semantics = input<SegmentedSemantics>('radiogroup');

  /**
   * For `tablist` only: whether arrowing to a tab selects it. @default 'automatic'
   *
   * `'automatic'` matches the APG default and this component's existing
   * behaviour. Use `'manual'` when showing a panel costs something — a fetch, a
   * deferred chunk — so that arrowing across four tabs does not load four
   * panels to reach one.
   */
  activation = input<SegmentedActivation>('automatic');

  /** True when this control is a tablist rather than a radiogroup. */
  readonly isTablist = computed(() => this.semantics() === 'tablist');

  /**
   * Selection follows focus.
   *
   * Always true for a radiogroup — that is the pattern, not a setting. For a
   * tablist it is the APG default and `activation="manual"` turns it off.
   */
  readonly selectsOnMove = computed(
    () => !this.isTablist() || this.activation() === 'automatic',
  );

  /**
   * The DOM id of one segment, so a panel can point back with
   * `aria-labelledby`.
   *
   * Prefers the option's own `tabId`. Public so a host can read back the
   *   generated one, but supplying `tabId` is the version that survives two of
   *   these on a page — a `viewChild` picks whichever renders first.
   *
   * ★ A tabpanel that is not labelled by its tab is announced as an unnamed
   *   region: the user is told there is a panel and not what it is.
   */
  tabIdFor(value: string): string {
    return this.options().find(o => o.value === value)?.tabId
      ?? `${this._errUid}-tab-${value}`;
  }

  /** Emitted with the newly selected segment value. */
  changed = output<string>();

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

  /** Whether a segment is interactive. */
  isEnabled(opt: SegmentOption): boolean {
    return !opt.disabled && !opt.soldOut && !this.resolvedDisabled();
  }

  /**
   * The single segment in the tab order (roving tabindex): the selected one,
   * or the first enabled option when nothing is selected.
   */
  readonly focusableValue = computed<string>(() => {
    const opts = this.options();
    // Under manual activation the tab stop belongs to wherever the user arrowed
    // to, which is not the selected tab.
    const roved = this._roved();
    if (roved) {
      const r = opts.find(o => o.value === roved && this.isEnabled(o));
      if (r) return r.value;
    }
    const sel = opts.find(o => o.value === this.value() && this.isEnabled(o));
    if (sel) return sel.value;
    return opts.find(o => this.isEnabled(o))?.value ?? '';
  });

  /** Where the arrows have moved focus without selecting. `''` when settled. */
  private readonly _roved = signal<string>('');

  segTabIndex(opt: SegmentOption): number {
    if (!this.isEnabled(opt)) return -1;
    return opt.value === this.focusableValue() ? 0 : -1;
  }

  select(opt: SegmentOption): void {
    if (!this.isEnabled(opt)) return;
    // A real selection settles the roving stop back onto the selected segment.
    this._roved.set('');
    this.value.set(opt.value);
    this.changed.emit(opt.value);
    this._onChange(opt.value);
  }

  onBlur(): void { this._onTouched(); }

  /**
   * Arrow / Home / End navigation.
   *
   * ★★ Movement is `svRovingTarget`'s; the CONSEQUENCE is this component's, and
   *    now it depends on what this control claims to be. A radiogroup selects on
   *    move because that IS the radio pattern. A tablist does too by default —
   *    the APG's recommendation — unless the host says panels are expensive.
   *    The same arithmetic, three different answers about what to do with it.
   */
  onKeydown(e: KeyboardEvent, opt: SegmentOption): void {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.select(opt);
      return;
    }
    const opts = this.options().filter(o => this.isEnabled(o));
    if (opts.length === 0) return;
    const i = opts.findIndex(o => o.value === opt.value);
    const next = svRovingTarget(e.key, opts.length, i);
    if (next === null) return;
    e.preventDefault();
    const target = opts[next];
    if (this.selectsOnMove()) {
      this.select(target);
    } else {
      // ★ The tab stop has to follow the focus even when the selection does
      //   not, or Tab would jump back to the still-selected tab and the user
      //   could never reach the one they arrowed to.
      this._roved.set(target.value);
    }
    setTimeout(() => {
      this.host.nativeElement
        .querySelector<HTMLElement>(`[data-seg="${target.value}"]`)?.focus();
    });
  }

  readonly sizeClass = computed(() => ({
    xs: 'h-6 px-2 text-[11px] gap-1',
    sm: 'h-7 px-2.5 text-xs gap-1.5',
    md: 'h-9 px-3.5 text-sm gap-2',
    lg: 'h-11 px-5 text-base gap-2.5',
  }[this.size()]));

  readonly iconSize = computed(() => ({
    xs: 'h-3 w-3',
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }[this.size()]));

  readonly wrapperClass = computed(() => {
    const v = this.variant();
    const base = 'inline-flex items-center transition-all duration-150';
    if (v === 'default')   return base + ' rounded-xl bg-gray-100 p-0.5 dark:bg-gray-800/70';
    if (v === 'pills')     return base + ' gap-1';
    if (v === 'underline') return base + ' border-b border-gray-200 dark:border-gray-700 gap-0';
    if (v === 'bordered')  return base + ' rounded-xl border border-gray-200 dark:border-gray-700 p-0.5';
    if (v === 'swatch')    return 'flex flex-wrap items-center gap-2';
    return base;
  });

  buttonClass(opt: SegmentOption): string {
    const active = this.value() === opt.value;
    const v = this.variant();
    const base = `relative inline-flex items-center justify-center font-medium
      whitespace-nowrap select-none outline-none transition-all duration-150
      focus-visible:ring-2 focus-visible:ring-primary-400/50 focus-visible:z-10
      ${this.sizeClass()}
      ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`;

    if (v === 'default' || v === 'bordered') {
      // gray-600 for the inactive label, not gray-500: `default` lays these on a
      // `bg-gray-100` track (see `wrapperClass`), where gray-500 is 4.40:1 and
      // misses AA. `bordered` has no fill, so it only ever gets darker here.
      return base + (active
        ? ' rounded-lg bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/60 dark:bg-gray-700 dark:text-white dark:ring-gray-600/40'
        : ' rounded-lg text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200');
    }
    if (v === 'pills') {
      return base + ' rounded-full ' + (active
        ? 'bg-primary-600 text-white shadow-sm'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800');
    }
    if (v === 'underline') {
      return base + ' rounded-none border-b-2 -mb-px ' + (active
        ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200');
    }
    return base;
  }

  isSoldOut(opt: SegmentOption): boolean { return !!opt.soldOut; }

  /** Button classes for the swatch variant (colour dot or labelled size chip). */
  swatchClass(opt: SegmentOption): string {
    const active  = this.value() === opt.value;
    const soldOut = this.isSoldOut(opt);
    const cursor  = this.isEnabled(opt) ? 'cursor-pointer' : 'cursor-not-allowed';
    const focus   = 'outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900';
    if (opt.color) {
      const ring = active
        ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900'
        : 'ring-1 ring-inset ring-black/10 hover:ring-black/25 dark:ring-white/20 dark:hover:ring-white/40';
      return `relative inline-flex h-8 w-8 items-center justify-center rounded-full p-0.5 transition-all duration-150 ${ring} ${focus} ${cursor} ${soldOut ? 'opacity-45' : ''}`;
    }
    const state = active
      ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-500 dark:border-primary-400 dark:bg-primary-500/10 dark:text-primary-300'
      : 'border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-500';
    const soldOutChip = soldOut ? 'border-gray-200 text-gray-500 line-through dark:border-gray-700 dark:text-gray-400' : state;
    return `relative inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-all duration-150 ${soldOutChip} ${focus} ${cursor}`;
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
  private readonly _errUid = svUniqueId('sv-segmented-control');

}
