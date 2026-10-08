import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { SvEmptyReason } from '../types';

/**
 * EmptyShell — the zero-row state, with the distinction that matters.
 *
 * "No orders" and "no orders *matching these filters*" are different facts and
 * need different copy and different actions. Showing the first when the second
 * is true — the default behaviour of every component in the kit before this —
 * tells a customer with four thousand orders that they have none, because they
 * mistyped a search term. It reads as a bug, and it generates support tickets.
 *
 * Set `reason` from whether any filter, search term or facet is active; the
 * component supplies sensible copy and the matching action for each case, and
 * every string is overridable.
 *
 * This is the inline, dependency-free version that data components render
 * internally. `@styloviz/empty-state` remains the right choice for a full-page
 * illustrated treatment with multiple CTAs.
 */
@Component({
  selector: 'sv-empty-shell',
  standalone: true,
  templateUrl: './empty-shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `reason` is exposed as well as the state: "no orders" and "no orders
  // matching these filters" are different facts, and a test that cannot tell
  // them apart cannot catch the regression that tells a customer with 4,000
  // orders they have none.
  host: {
    'data-sv-state': 'empty',
    '[attr.data-sv-empty-reason]': 'reason()',
  },
})
export class SvEmptyShellComponent {
  /**
   * Why the collection is empty. Drive this from whether a filter or search is
   * active — not from the row count.
   * @default 'no-data'
   */
  readonly reason = input<SvEmptyReason>('no-data');

  /** Heading. Falls back to copy chosen from `reason`. @default '' */
  readonly title = input<string>('');

  /** Supporting line. Falls back to copy chosen from `reason`. @default '' */
  readonly message = input<string>('');

  /**
   * Action label. Falls back to `'Clear filters'` for `no-results` and to no
   * button at all for `no-data` — the kit cannot know what "create one" means
   * in the host's domain, and a button that does nothing useful is worse than
   * none.
   * @default ''
   */
  readonly actionLabel = input<string>('');

  /**
   * Render as a single inline row instead of a centred block.
   * @default false
   */
  readonly compact = input<boolean>(false);

  /** Extra classes for the outer wrapper. @default '' */
  readonly customClass = input<string>('');

  /** The action button was pressed — clear the filters, or start the flow. */
  readonly action = output<void>();

  protected readonly resolvedTitle = computed(() => {
    const stated = this.title();
    if (stated) return stated;
    switch (this.reason()) {
      case 'no-results': return 'No matching results';
      case 'no-access':  return 'You do not have access';
      case 'error':      return 'Could not load this';
      default:           return 'Nothing here yet';
    }
  });

  protected readonly resolvedMessage = computed(() => {
    const stated = this.message();
    if (stated) return stated;
    switch (this.reason()) {
      case 'no-results': return 'Try adjusting or clearing your filters.';
      case 'no-access':  return 'Ask an administrator if you think this is wrong.';
      case 'error':      return 'Something went wrong while loading. Try again.';
      default:           return 'Items will appear here once there are some.';
    }
  });

  /**
   * ★★★ ONLY `no-results` GETS A DEFAULT BUTTON, AND THAT IS THE POINT OF
   *     SEPARATING THE CAUSES. "Clear filters" under `no-access` clears
   *     filters that are not what is hiding the data, and the user tries it
   *     twice before reading the sentence above it. `no-data` has no default
   *     because the kit cannot know what "create one" means in the host's
   *     domain, and `error` has none because the retry belongs to whoever owns
   *     the request — pass `actionLabel` to add one.
   */
  protected readonly resolvedAction = computed(
    () => this.actionLabel() || (this.reason() === 'no-results' ? 'Clear filters' : ''),
  );
}
