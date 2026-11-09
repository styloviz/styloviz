import { Directive, forwardRef, input } from '@angular/core';
import { SV_TOOLTIP_GROUP, createSvTooltipGroup, type SvTooltipGroup } from '@styloviz/core/overlay';

/**
 * Makes every `sv-tooltip` inside it one group (SR-35): the first waits
 * `groupDelay`, a sibling shows at once while one is up or within `skipDelay`
 * of one closing, and only one is visible — a toolbar's worth of hints that
 * does not make the reader wait at every button.
 *
 * ```html
 * <div role="toolbar" svTooltipGroup [groupDelay]="500">
 *   <sv-tooltip text="Bold" [kbd]="['⌘', 'B']"><button>B</button></sv-tooltip>
 *   <sv-tooltip text="Italic" [kbd]="['⌘', 'I']"><button>I</button></sv-tooltip>
 * </div>
 * ```
 */
@Directive({
  selector: '[svTooltipGroup]',
  standalone: true,
  providers: [{ provide: SV_TOOLTIP_GROUP, useExisting: forwardRef(() => SvTooltipGroupDirective) }],
})
export class SvTooltipGroupDirective implements SvTooltipGroup {
  /** The delay before the group's first tooltip shows, in ms. @default 600 */
  readonly groupDelay = input<number>(600);

  /** For this long after one hides, the next shows at once, in ms. @default 300 */
  readonly skipDelay = input<number>(300);

  private readonly group = createSvTooltipGroup({
    delay: () => this.groupDelay(),
    skipDelay: () => this.skipDelay(),
  });

  delayFor(ownDelay: number): number {
    return this.group.delayFor(ownDelay);
  }

  opened(id: string, close: () => void): void {
    this.group.opened(id, close);
  }

  closed(id: string): void {
    this.group.closed(id);
  }
}
