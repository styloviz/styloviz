import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { svRovingTarget } from '@styloviz/core';
import { SvChipComponent } from '../chip/chip.component';
import { SV_CHIP_GROUP, type SvChipGroupContext } from './chip-group.token';

/** Layout direction of the chips. */
export type ChipGroupOrientation = 'horizontal' | 'vertical';
/** Whether the chips inside can be toggled at all. */
export type ChipGroupSelection = 'multiple' | 'none';

/**
 * A set of chips that belongs to something.
 *
 * ── The defect this exists for ──────────────────────────────────────────────
 *
 * ★★ A SELECTABLE CHIP IS A CHECKBOX THAT BELONGS TO NOTHING. `sv-chip` with
 *    `selectable` renders `role="checkbox"` with its own `tabindex="0"`, which
 *    is valid ARIA and a poor control. Twenty filter chips are then twenty tab
 *    stops — the exact thing roving focus exists to prevent — and, worse, a
 *    screen reader announces "Design, checkbox, not checked" with no way to
 *    know what set it belongs to, how many there are, or which one this is.
 *    The chips were never wrong individually. There was simply nothing above
 *    them. `FI-07-I2` / `FI-07-M2`.
 *
 * One tab stop for the whole set, arrows between members, and a name for the
 * thing they are members of.
 *
 * ── Movement is not selection ───────────────────────────────────────────────
 *
 * ★★ ARROWING PAST A CHIP MUST NOT TOGGLE IT. In a `radiogroup` selection
 *    follows focus and that is correct — there is always exactly one answer, so
 *    moving the focus IS changing the answer. In a multi-select filter bar the
 *    same behaviour silently turns filters on as the user scans past them,
 *    which is a data-loss bug wearing a keyboard shortcut. So this group moves
 *    focus only; `Space` and `Enter` toggle, and the chip already owns those.
 *
 *    This is why `svRovingTarget` returns an index rather than performing a
 *    selection — `sv-radio-group` and this component share every line of the
 *    arithmetic and disagree completely about what to do with the answer.
 *
 * ── Single-select is deliberately absent ────────────────────────────────────
 *
 * ⚠️ There is no `selectionMode: 'single'`. `sv-segmented-control` and
 *    `sv-radio-group` both already do single-select properly, with the right
 *    roles and selection-follows-focus. A third way to pick one of N is the
 *    duplication this component's own primitive was extracted to stop.
 *
 * @example
 * ```html
 * <sv-chip-group label="Filter by tag">
 *   <sv-chip label="Design"   [selectable]="true" [(selected)]="design" />
 *   <sv-chip label="Frontend" [selectable]="true" [(selected)]="frontend" />
 * </sv-chip-group>
 * ```
 */
@Component({
  selector: 'sv-chip-group',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: SV_CHIP_GROUP, useExisting: forwardRef(() => SvChipGroupComponent) },
  ],
  template: `
    <!-- ★ DA-47 — no aria-orientation. It is not allowed on role="group"
           (axe: aria-allowed-attr, critical), and it would say nothing true
           anyway: both arrow axes walk the chips in either layout. -->
    <div
      role="group"
      [attr.aria-label]="label() || null"
      [class]="listClasses()"
    >
      <ng-content />
    </div>
  `,
})
export class SvChipGroupComponent implements SvChipGroupContext {
  /**
   * Accessible name for the set — "Filter by tag", "Skills".
   *
   * ★ Without it the group is an unnamed container, which is worse than no
   *   container: a reader announces a grouping boundary and cannot say what the
   *   grouping is. Supply it, or the chips were better off loose.
   */
  label = input<string>('');

  /**
   * Layout direction. Visual only: both arrow axes walk the chips in either
   * layout, so a user who guesses the wrong axis is still right. @default 'horizontal'
   */
  orientation = input<ChipGroupOrientation>('horizontal');

  /**
   * Whether the chips are toggles or decoration. @default 'multiple'
   *
   * `'none'` still buys the group a name and one tab stop — a row of removable
   * tokens is not selectable but is very much a set. Each token is reached
   * through its `×` (the only part of a token that does anything), so the row
   * is one `Tab` and the arrows walk the remove buttons.
   *
   * In a `'none'` group a chip left on `chipRole="auto"` is never inferred to be
   * a filter from `selectable` — the set has said it holds no toggles. A chip
   * that states `chipRole="filter"` outright is still believed.
   */
  selectionMode = input<ChipGroupSelection>('multiple');

  /** Gap between chips. @default 'sm' */
  gap = input<'xs' | 'sm' | 'md'>('sm');

  /** Additional classes on the group container. */
  customClass = input<string>('');

  private readonly chips = contentChildren(SvChipComponent);

  /**
   * The chips a keyboard can actually land on.
   *
   * A disabled chip is skipped rather than focused-and-ignored: arrowing onto
   * something that cannot be acted on reads as the control being broken.
   *
   * ★ Asks the CHIP whether it is reachable rather than re-deriving it from
   *   `selectable`. A `chipRole="action"` chip is focusable and not selectable,
   *   and a group that tested `selectable` here would arrow straight past the
   *   one member that actually does something. A removable token counts too —
   *   through its `×` — or a row of tokens would be one tab stop per token.
   */
  readonly focusableChips = computed(() => this.chips().filter((c) => c.rovable()));

  /**
   * Which focusable chip holds the group's tab stop.
   *
   * An index rather than a reference, so a chip being removed or disabled does
   * not leave the group pointing at something that is no longer there.
   */
  private readonly activeIndex = signal(0);

  /** Index clamped to the current list — the list changes under it constantly. */
  private readonly safeIndex = computed(() => {
    const n = this.focusableChips().length;
    if (n === 0) return -1;
    return Math.min(Math.max(this.activeIndex(), 0), n - 1);
  });

  isTabStop(chip: unknown): boolean {
    const i = this.safeIndex();
    return i >= 0 && this.focusableChips()[i] === chip;
  }

  setActive(chip: unknown): void {
    const i = this.focusableChips().indexOf(chip as SvChipComponent);
    if (i >= 0) this.activeIndex.set(i);
  }

  handleKeydown(chip: unknown, event: KeyboardEvent): void {
    const list = this.focusableChips();
    const from = list.indexOf(chip as SvChipComponent);
    const next = svRovingTarget(event.key, list.length, from);
    // `null` means this is not a movement key — Tab, Escape and Space must
    // reach the chip and the page untouched.
    if (next === null) return;
    event.preventDefault();
    this.activeIndex.set(next);
    list[next].focus();
  }

  protected readonly listClasses = computed(() => {
    const gap = { xs: 'gap-1', sm: 'gap-2', md: 'gap-3' }[this.gap()];
    const dir = this.orientation() === 'vertical' ? 'flex-col items-start' : 'flex-row flex-wrap items-center';
    return ['flex', dir, gap, this.customClass()].filter(Boolean).join(' ');
  });
}
