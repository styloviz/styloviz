import {
  Component,
  input,
  output,
  model,
  computed,
  ChangeDetectionStrategy,
  inject,
  viewChild,
  ElementRef
} from '@angular/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

import { SV_CHIP_GROUP } from '../chip-group/chip-group.token';

export type ChipVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
/**
 * What a chip is being used AS.
 *
 * ── The defect this exists for (`FI-07-I1` / `FI-07-M1`) ────────────────────
 *
 * ★★★ FOUR JOBS, ONE COMPONENT, AND THE ONLY WAY TO PICK ONE WAS A STYLING
 *     FLAG. `selectable` was the switch that decided whether a chip announced as
 *     a checkbox — so "Add label", which does something when you click it, had to
 *     be marked selectable to become clickable at all and was then announced as
 *     a checkbox that never checks. And an "Overdue" badge and a "Frontend"
 *     filter, which mean entirely different things, presented identically.
 *
 * `'auto'` is the default and resolves exactly as the component behaved before:
 * `selectable` → filter, `removable` → token, otherwise status. Naming the role
 * is opt-in, and is what buys the semantics below.
 */
export type ChipRole   = 'auto' | 'status' | 'filter' | 'token' | 'action';
export type ChipSize    = 'sm' | 'md' | 'lg';
export type ChipStyle   = 'filled' | 'soft' | 'outline';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Chip — A compact interactive label for filters, tags, and selections.
 *
 * Supports:
 * - Removable chips with dismiss button
 * - Selectable / toggle mode
 * - Optional leading icon (icon-library name or avatar URL)
 * - 7 color variants × 3 visual styles × 3 sizes
 * - Disabled state
 * - Accessible keyboard interaction
 */
@Component({
  selector: 'sv-chip',
  standalone: true,
  imports: [SvIconComponent],
  templateUrl: './chip.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvChipComponent {
  // ── Content ───────────────────────────────────────────────────────────────

  /** Label text displayed in the chip. */
  label = input<string>('');

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Color variant. @default 'default' */
  variant = input<ChipVariant>('default');

  /** Visual style. @default 'soft' */
  chipStyle = input<ChipStyle>('soft');

  /** Size. @default 'md' */
  size = input<ChipSize>('md');

  /** Accessible name — required for icon/avatar-only chips with no `label`. */
  ariaLabel = input<string>('');

  /**
   * What this chip is being used as. @default 'auto'
   *
   * - `'status'` — a badge. Not interactive, and **explicitly stating it makes it
   *   so**: a `status` chip ignores `selectable`, which stops a badge announcing
   *   as a checkbox because somebody wanted the hover style.
   * - `'filter'` — a toggle. `role="checkbox"` + `aria-checked`, `Space`/`Enter`.
   * - `'token'` — an entry in a set. The body is not interactive; the `×` is a
   *   real button named "Remove <label>".
   * - `'action'` — it does something. `role="button"`, focusable, `Space`/`Enter`,
   *   and it emits `activated`. ★★ THIS ONE WAS NOT BUILDABLE BEFORE at all:
   *   there was no output to listen to and no role but `checkbox`.
   * - `'auto'` — infer from `selectable` / `removable`, i.e. what this component
   *   has always done.
   */
  chipRole = input<ChipRole>('auto');

  /**
   * A category announced before the label, e.g. `'Status'` → "Status: Overdue".
   *
   * ★★ OFF BY DEFAULT, AND THAT IS NOT TIMIDITY. Prefixing every non-interactive
   *    chip would turn a skills list into "Status: Angular, Status: TypeScript".
   *    The component cannot know which plain chips are badges and which are
   *    decoration — the host can, and this is how it says so.
   *
   * ★ Rendered as `sr-only` text rather than `aria-label` for chips with no ARIA
   *   role, because `aria-label` on a bare `<span>` is not reliably announced.
   *   Roled chips fold it into their name instead.
   */
  categoryLabel = input<string>('');

  /**
   * Name of an icon in `@styloviz/icons`, e.g. `'star'`.
   *
   * This used to be a raw `<path d="…">` string. That put SVG geometry in
   * every consumer's config and skipped the library's sizing, stroke and
   * dark-mode handling — pass a name instead.
   */
  icon = input<string>('');

  /** Avatar image URL for a leading avatar. Takes precedence over `icon`. */
  avatarSrc = input<string>('');

  /** Avatar initials (fallback when avatarSrc fails). */
  avatarInitials = input<string>('');

  // ── State ─────────────────────────────────────────────────────────────────

  /**
   * Selected/active state. Two-way bindable with `[(selected)]`; also works as
   * a controlled `[selected]` input or uncontrolled (toggled on click). @default false
   */
  selected = model<boolean>(false);

  /** Allow toggling the selected state on click. @default false */
  selectable = input<boolean>(false);

  /** Show a dismiss (×) button to remove the chip. @default false */
  removable = input<boolean>(false);

  /** Disable interaction. @default false */
  disabled = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────
  // Note: the `selected` model already emits `selectedChange` automatically.

  /** Emitted when the dismiss button is clicked. */
  removed = output<void>();

  /**
   * The chip was activated — click, `Enter` or `Space`. Only for
   * `chipRole="action"`.
   *
   * ★★ A SELECTABLE CHIP HAS `selectedChange`; AN ACTION CHIP HAD NOTHING. The
   *    only way to react to a chip click was to make it selectable and watch the
   *    toggle, which is why "Add label" chips in this kit were checkboxes.
   */
  activated = output<void>();

  // ── Derived state ─────────────────────────────────────────────────────────

  /** Current selected state (reflects the `selected` model). */
  readonly isSelected = computed<boolean>(() => this.selected());

  // ── Membership of a group, when there is one ──────────────────────────────

  /**
   * The `sv-chip-group` this chip sits in, or `null` when it stands alone.
   *
   * Optional on purpose: a lone status chip is a perfectly good thing and must
   * not require a container to exist.
   */
  private readonly group = inject(SV_CHIP_GROUP, { optional: true });

  private readonly rootRef = viewChild<ElementRef<HTMLElement>>('chipRoot');
  private readonly removeRef = viewChild<ElementRef<HTMLButtonElement>>('removeBtn');

  /** The enclosing group declared its members are not toggles. */
  private readonly inNonSelectingGroup = computed(() => this.group?.selectionMode() === 'none');

  /**
   * The role this chip actually has, with `'auto'` resolved.
   *
   * ★ Inference order matters: `selectable` wins over `removable`, because a
   *   removable filter chip is a filter that can also be dismissed, not a token.
   *
   * ★ Inside `<sv-chip-group selectionMode="none">`, `selectable` infers
   *   nothing — the group has said its members are not toggles.
   */
  readonly resolvedRole = computed<Exclude<ChipRole, 'auto'>>(() => {
    const stated = this.chipRole();
    if (stated !== 'auto') return stated;
    if (this.selectable() && !this.inNonSelectingGroup()) return 'filter';
    if (this.removable()) return 'token';
    return 'status';
  });

  /** Toggles its own state — `role="checkbox"`. */
  readonly isFilter = computed(() => this.resolvedRole() === 'filter');
  /** Does something — `role="button"`. */
  readonly isAction = computed(() => this.resolvedRole() === 'action');

  /**
   * The ARIA role written onto the chip, or `null` for the ones that have none.
   *
   * ★★ STATUS AND TOKEN CARRY NO ROLE ON PURPOSE. A badge is labelled text and a
   *    token's only interactive part is its `×`; inventing a role for either
   *    would announce a control that does not exist.
   */
  readonly ariaRole = computed<string | null>(() =>
    this.isFilter() ? 'checkbox' : this.isAction() ? 'button' : null,
  );

  /** Whether a keyboard can land on this chip at all. */
  readonly focusable = computed(() => (this.isFilter() || this.isAction()) && !this.disabled());

  /**
   * Inside a group, a removable chip whose body is not focusable (a token) is
   * reached through its `×` — the only part of it that does anything.
   *
   * ★★ WITHOUT THIS, "ONE TAB STOP" WAS ONLY TRUE OF FILTERS. Every `×` in a
   *    row of tokens was a native button with its own tab stop, so a group of
   *    twelve applied filters was still twelve `Tab`s (`FI-07-I2`).
   */
  readonly removeIsRovingTarget = computed(
    () => !!this.group && this.removable() && !this.disabled() && !this.focusable(),
  );

  /** Whether a group's arrows can land on this chip — on its body, or on its `×`. */
  readonly rovable = computed(() => this.focusable() || this.removeIsRovingTarget());

  /**
   * The `×` button's tab index. Outside a group it keeps its native place in
   * the tab order (`null`). Inside one it is either the chip's roving stop (a
   * token) or out of the order entirely, because the chip body already holds
   * the stop and `Delete` / `Backspace` removes the chip from there.
   */
  readonly removeTabIndex = computed<number | null>(() => {
    if (!this.group || !this.removable()) return null;
    if (this.removeIsRovingTarget()) return this.group.isTabStop(this) ? 0 : -1;
    return -1;
  });

  /** `Delete` removes a focusable removable chip inside a group — its `×` is out of the tab order. */
  readonly removeShortcut = computed<string | null>(() =>
    this.group && this.removable() && this.focusable() ? 'Delete Backspace' : null,
  );

  /**
   * ★★ THE TAB STOP BELONGS TO THE SET, NOT TO THE CHIP. Alone, a selectable
   *    chip is its own stop and `0` is right. Inside a group, exactly one
   *    member is reachable by `Tab` and the rest are reached with the arrows —
   *    which is the difference between one control and twenty.
   */
  readonly rovingTabIndex = computed<number | null>(() => {
    if (!this.focusable()) return null;
    if (!this.group) return 0;
    return this.group.isTabStop(this) ? 0 : -1;
  });

  /** Move focus here. Called by the group when the arrows point at this chip. */
  focus(): void {
    const target = this.removeIsRovingTarget() ? this.removeRef() : this.rootRef();
    target?.nativeElement.focus();
  }

  /** Let the group know the tab stop should follow the user. */
  onFocus(): void {
    this.group?.setActive(this);
  }

  /**
   * Arrows go to the group; everything else is the chip's own.
   *
   * `Space` and `Enter` are bound separately and still toggle — movement and
   * selection are deliberately different keys here, because arrowing past a
   * filter that silently turns itself on is a data-loss bug.
   */
  onKeydown(event: KeyboardEvent): void {
    if (
      this.removeShortcut() &&
      !this.disabled() &&
      event.target === this.rootRef()?.nativeElement &&
      (event.key === 'Delete' || event.key === 'Backspace')
    ) {
      event.preventDefault();
      this.removed.emit();
      return;
    }
    this.group?.handleKeydown(this, event);
  }

  /**
   * `Space` / `Enter` on the chip body.
   *
   * ★★ ONLY THE BODY'S OWN KEYS. These listeners sit on the chip root, so a
   *    key pressed on the `×` bubbled up here too — and `preventDefault()`
   *    cancelled the button's own activation. `Enter` on "Remove Design" did
   *    nothing on a token, and toggled the filter instead of removing it on a
   *    removable filter chip.
   */
  onActivateKey(event: Event): void {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    this.onClick();
  }

  /** Accessible name — explicit ariaLabel, else the visible label. */
  readonly resolvedAriaLabel = computed<string>(() => this.ariaLabel() || this.label());

  /**
   * The full name, category included.
   *
   * ★ An explicit `ariaLabel` is NOT prefixed. The host stated the whole name;
   *   gluing a category onto it would be second-guessing them.
   */
  readonly accessibleName = computed<string>(() => {
    const base = this.resolvedAriaLabel();
    const cat = this.categoryLabel();
    return cat && !this.ariaLabel() ? `${cat}: ${base}` : base;
  });

  /**
   * Text rendered `sr-only` for chips that carry no ARIA role.
   *
   * ★★★ THIS ALSO FIXES A NAMELESS CHIP. `ariaLabel` is documented as "required
   *     for icon/avatar-only chips" and was only ever applied when `selectable`
   *     — so an icon-only STATUS chip had no accessible name at all, and a
   *     reader met an empty span. Without a role, `aria-label` would not have
   *     been announced either; `sr-only` text is what actually works.
   */
  readonly srOnlyName = computed<string>(() => {
    if (this.ariaRole() !== null) return '';
    if (!this.label()) return this.accessibleName();
    return this.categoryLabel() ? `${this.categoryLabel()}: ` : '';
  });

  // ── Computed classes ──────────────────────────────────────────────────────

  readonly sizeClasses = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-6 px-2 text-[10px] gap-1';
      case 'lg': return 'h-8 px-3 text-sm gap-1.5';
      default:   return 'h-7 px-2.5 text-xs gap-1.5';
    }
  });

  readonly avatarSize = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-3.5 w-3.5 text-[7px]';
      case 'lg': return 'h-5 w-5 text-[9px]';
      default:   return 'h-4 w-4 text-[8px]';
    }
  });

  readonly iconSize = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-2.5 w-2.5';
      case 'lg': return 'h-3.5 w-3.5';
      default:   return 'h-3 w-3';
    }
  });

  readonly rootClasses = computed<string>(() => {
    const sel = this.isSelected();
    const disabled = this.disabled();
    const v = this.variant();
    const s = this.chipStyle();

    const map: Record<ChipVariant, Record<ChipStyle, { base: string; active: string }>> = {
      default: {
        filled:  { base: 'bg-gray-700 text-white dark:bg-gray-600',            active: 'bg-gray-900 dark:bg-gray-500' },
        soft:    { base: 'bg-gray-100 text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700', active: 'bg-gray-200 dark:bg-gray-700' },
        outline: { base: 'bg-transparent text-gray-700 ring-1 ring-gray-300 dark:text-gray-300 dark:ring-gray-600', active: 'bg-gray-100 dark:bg-gray-800' },
      },
      primary: {
        filled:  { base: 'bg-primary-600 text-white',                          active: 'bg-primary-700' },
        soft:    { base: 'bg-primary-50 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-950/60 dark:text-primary-300 dark:ring-primary-800', active: 'bg-primary-100 dark:bg-primary-900/60' },
        outline: { base: 'bg-transparent text-primary-700 ring-1 ring-primary-400 dark:text-primary-400 dark:ring-primary-700', active: 'bg-primary-50 dark:bg-primary-950/40' },
      },
      success: {
        filled:  { base: 'bg-accent-700 text-white',                          active: 'bg-accent-800' },
        soft:    { base: 'bg-accent-50 text-accent-700 ring-1 ring-accent-200 dark:bg-accent-950/60 dark:text-accent-300 dark:ring-accent-800', active: 'bg-accent-100 dark:bg-accent-900/60' },
        outline: { base: 'bg-transparent text-accent-700 ring-1 ring-accent-400 dark:text-accent-400 dark:ring-accent-700', active: 'bg-accent-50 dark:bg-accent-950/40' },
      },
      warning: {
        filled:  { base: 'bg-warning-500 text-gray-900',                         active: 'bg-warning-600' },
        soft:    { base: 'bg-warning-50 text-warning-700 ring-1 ring-warning-200 dark:bg-warning-950/60 dark:text-warning-300 dark:ring-warning-800', active: 'bg-warning-100 dark:bg-warning-900/60' },
        outline: { base: 'bg-transparent text-warning-700 ring-1 ring-warning-400 dark:text-warning-400 dark:ring-warning-700', active: 'bg-warning-50 dark:bg-warning-950/40' },
      },
      danger: {
        filled:  { base: 'bg-danger-600 text-white',                              active: 'bg-danger-700' },
        soft:    { base: 'bg-danger-50 text-danger-700 ring-1 ring-danger-200 dark:bg-danger-950/60 dark:text-danger-300 dark:ring-danger-800', active: 'bg-danger-100 dark:bg-danger-900/60' },
        outline: { base: 'bg-transparent text-danger-700 ring-1 ring-danger-400 dark:text-danger-400 dark:ring-danger-700', active: 'bg-danger-50 dark:bg-danger-950/40' },
      },
      info: {
        filled:  { base: 'bg-info-700 text-white',                              active: 'bg-info-800' },
        soft:    { base: 'bg-info-50 text-info-700 ring-1 ring-info-200 dark:bg-info-950/60 dark:text-info-300 dark:ring-info-800', active: 'bg-info-100 dark:bg-info-900/60' },
        outline: { base: 'bg-transparent text-info-700 ring-1 ring-info-400 dark:text-info-400 dark:ring-info-700', active: 'bg-info-50 dark:bg-info-950/40' },
      },
      purple: {
        filled:  { base: 'bg-brand-600 text-white',                           active: 'bg-brand-700' },
        soft:    { base: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:ring-brand-800', active: 'bg-brand-100 dark:bg-brand-900/60' },
        outline: { base: 'bg-transparent text-brand-700 ring-1 ring-brand-400 dark:text-brand-400 dark:ring-brand-700', active: 'bg-brand-50 dark:bg-brand-950/40' },
      },
    };

    const entry = map[v][s];
    const colorClasses = sel ? `${entry.base} ${entry.active}` : entry.base;

    return [
      'inline-flex items-center rounded-md font-medium select-none transition-all duration-150',
      this.sizeClasses(),
      colorClasses,
      disabled
        ? 'cursor-not-allowed opacity-50'
        : this.isFilter() || this.isAction() || this.removable() ? 'cursor-pointer' : '',
    ].filter(Boolean).join(' ');
  });

  // ── Interaction ───────────────────────────────────────────────────────────

  onClick(): void {
    if (this.disabled()) return;
    // ★ An action chip does NOT carry selection state. Toggling `selected` here
    //   would give "Add label" a checked appearance it has no meaning for.
    if (this.isAction()) { this.activated.emit(); return; }
    if (!this.isFilter()) return;
    this.selected.set(!this.selected());  // model.set() auto-emits selectedChange
  }

  onRemove(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled()) return;
    this.removed.emit();
  }
}
