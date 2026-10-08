import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { svScaleLabel, type SvScaleWindow } from '../scale-ceiling';

/**
 * ScaleNotice — the row that says a list is not all of the list (`X-4`).
 *
 * ★★★ IT EXISTS SO THE WORDING CANNOT DRIFT. Six surfaces need this sentence,
 *     and six hand-written versions is how one of them ends up saying "showing
 *     100 of 5,000" while another says nothing at all — and the one that says
 *     nothing is the defect. One component, one sentence, one place to fix it.
 *
 * ★★ IT RENDERS NOTHING WHEN THE WINDOW IS COMPLETE. A surface can bind it
 *    unconditionally, which is the point: a notice a host has to remember to
 *    show is a notice that will be missing on the screen where it matters.
 *
 * ★ NOT a live region. The list did not change under the reader — it was never
 *   complete — so this is a statement about what they are looking at, read in
 *   place, and an announcement would interrupt them to say the page is behaving
 *   as documented. It IS in the reading order and reachable, which is what the
 *   `sr-only` alternatives in this kit's charts are not allowed to be.
 *
 * @example
 * ```html
 * <sv-scale-notice [window]="visible()" noun="message" />
 * ```
 */
@Component({
  selector: 'sv-scale-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <p
        data-sv-state="truncated"
        [attr.data-sv-hidden-count]="window().hidden"
        [class]="
          'flex items-start gap-1.5 border-t border-gray-200 px-4 py-2 text-[11px] leading-relaxed ' +
          'text-gray-600 dark:border-gray-800 dark:text-gray-400 ' + customClass()
        "
      >{{ text }}</p>
    }
  `,
})
export class SvScaleNoticeComponent {
  /** The window this surface is rendering. */
  readonly window = input.required<SvScaleWindow<unknown>>();

  /** Singular noun for a row — `message`, `task`, `tool`, `event`. @default 'row' */
  readonly noun = input<string>('row');

  /**
   * Replaces the generated sentence outright, for wording or another language.
   * `''` renders nothing even when the window IS truncated — for a surface
   * whose own layout already says so.
   * @default null
   */
  readonly label = input<string | null>(null);

  /** Extra classes on the notice. @default '' */
  readonly customClass = input<string>('');

  /** The sentence, or `null` when there is nothing to disclose. */
  protected readonly message = computed<string | null>(() => {
    const custom = this.label();
    if (custom !== null) return custom.trim() === '' ? null : custom;
    return svScaleLabel(this.window(), this.noun());
  });
}
