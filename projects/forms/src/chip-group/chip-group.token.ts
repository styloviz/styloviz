import { InjectionToken } from '@angular/core';

/**
 * What a chip needs from the group it is inside, and nothing more.
 *
 * A token rather than the component class because the group queries its chips
 * with `contentChildren(SvChipComponent)` while each chip asks the group
 * whether it holds the tab stop. Importing both ways is a cycle; importing an
 * interface from a third file is not.
 */
export interface SvChipGroupContext {
  /** Whether this chip is the group's single tab stop. */
  isTabStop(chip: unknown): boolean;
  /** The chip took focus by any means — pointer, `Tab`, or script. */
  setActive(chip: unknown): void;
  /** Arrow / Home / End inside a chip. Returns whether the group consumed it. */
  handleKeydown(chip: unknown, event: KeyboardEvent): void;
  /**
   * Whether the set is a set of toggles at all. In a `'none'` group a chip's
   * `selectable` styling flag no longer makes it a checkbox.
   */
  selectionMode(): 'multiple' | 'none';
}

export const SV_CHIP_GROUP = new InjectionToken<SvChipGroupContext>('SV_CHIP_GROUP');
