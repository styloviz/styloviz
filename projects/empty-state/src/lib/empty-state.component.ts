import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import type { SvEmptyReason } from '@styloviz/core';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Visual size of the empty state block.
 * - `sm`  — compact, inline use (table cells, sidebars)
 * - `md`  — default card/panel use
 * - `lg`  — full-page / hero-style
 */
export type EmptyStateSize = 'sm' | 'md' | 'lg';

/**
 * Layout axis for the content stack.
 * - `vertical`    — icon → title → message → actions (default)
 * - `horizontal`  — icon on the left, text/actions on the right
 */
export type EmptyStateLayout = 'vertical' | 'horizontal';

/**
 * Built-in icon preset.
 * The component ships a curated set of SVG paths for the most common
 * empty-state scenarios. Set `icon` to `'custom'` and pass `customIcon` (a library name) to override.
 */
export type EmptyStateIcon =
  | 'inbox'
  | 'search'
  | 'folder'
  | 'users'
  | 'chart'
  | 'document'
  | 'notification'
  | 'cart'
  | 'filter'
  | 'star'
  | 'lock'
  | 'error'
  | 'custom';   // falls through to `customIcon`

/** A single CTA button rendered below the message. */
export interface EmptyStateAction {
  id:       string;
  label:    string;
  /**
   * Visual weight. Defaults by POSITION: the first action is `primary`, the
   * rest are `secondary`.
   *
   * ★★★ IT USED TO DEFAULT TO `primary` FOR EVERY ACTION, which is no
   *     hierarchy at all: three primary buttons side by side make the user read
   *     all three to find the one they want, and the page has told them
   *     nothing about which it expects. The position default says it instead.
   */
  style?:   'primary' | 'secondary' | 'ghost';
  /** Optional icon-library name shown before the label. Was `iconPath`. */
  icon?: string;
}

/**
 * Why this container is empty (`OF-07-I5`).
 *
 * ★★★ "NOTHING HERE YET" WHEN THE USER HAS FILTERED IS A LIE THAT READS AS A
 *     BUG. It tells a customer with four thousand orders that they have none,
 *     because they mistyped a search term — and the cheerful inbox glyph above
 *     it agrees. The two facts need different copy, a different glyph and a
 *     different action, which is the same distinction `sv-empty-shell` already
 *     draws in core; this brings it to the full-page treatment.
 */
/**
 * Why the page has nothing to show — an ALIAS of core's `SvEmptyReason`
 * (`OF-07-I1`, `OF-07-M1`).
 *
 * ★★ THE TWO SURFACES HAD SEPARATE VOCABULARIES, and that was the item: this
 *    component knew `no-access` while `sv-empty-shell` — the inline empty
 *    state every data component renders — knew only `no-data` and
 *    `no-results`, so the same fact could be stated on a full page and not in
 *    a table. One union now, exported under both names because both are
 *    published.
 */
export type EmptyStateReason = SvEmptyReason;

// ─── Built-in icon paths ──────────────────────────────────────────────────────

/**
 * Preset → icon-library NAME. Was twelve hand-copied `d` strings.
 * `inbox` was moved Pro → free for this map: a FREE empty-state cannot draw
 * its own default preset otherwise.
 */
const ICON_NAMES: Record<Exclude<EmptyStateIcon, 'custom'>, string> = {
  inbox:        'inbox',
  search:       'search',
  folder:       'folder',
  users:        'users',
  chart:        'bar-chart',
  document:     'file-text',
  notification: 'bell',
  cart:         'shopping-cart',
  filter:       'filter',
  star:         'star',
  lock:         'lock',
  error:        'alert-circle',
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * EmptyState — A polished zero-data placeholder for tables, lists, dashboards,
 * search results, and any panel that may have no content to display.
 *
 * Features:
 * - 12 built-in contextual icon presets (no external assets required)
 * - Custom SVG path override
 * - Optional decorative illustration background ring
 * - Vertical and horizontal layout modes
 * - 3 sizes: sm (inline), md (card), lg (full-page)
 * - Up to 3 CTA action buttons (primary / secondary / ghost)
 * - Optional body slot for projected rich content below the message
 * - Full dark-mode support
 */
@Component({
  selector: 'sv-empty-state',
  standalone: true,
  imports: [NgClass, SvIconComponent],
  templateUrl: './empty-state.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvEmptyStateComponent {
  // ── Content ───────────────────────────────────────────────────────────────

  /**
   * Main heading text. Falls back to copy chosen from `reason`.
   *
   * ★ The default is now empty rather than `'Nothing here yet'`: that string
   *   was the DEFAULT for a filtered list too, which is the whole of
   *   `OF-07-I5`. `resolvedTitle()` picks the sentence that is true.
   */
  title   = input<string>('');

  /** Supporting message under the title. Falls back to copy from `reason`. */
  message = input<string>('');

  // ── Why it is empty (`OF-07-I5`, `OF-07-M2`) ──────────────────────────────

  /**
   * Why this container has nothing in it. Drive it from whether a filter or
   * search is active — not from the row count. @default 'no-data'
   *
   * ★★★ "NOTHING HERE YET" WHEN THE USER HAS FILTERED IS A LIE THAT READS AS A
   *     BUG: it tells a customer with four thousand orders that they have
   *     none, because they mistyped a search term — and the cheerful inbox
   *     glyph above it agrees with the lie. The reason picks the copy AND the
   *     glyph, so the illustration stops obscuring the cause.
   */
  reason = input<EmptyStateReason>('no-data');

  /**
   * The filters currently narrowing the list, in the user's words —
   * `['Status: Overdue', 'Owner: Dana']` (`OF-07-M2`).
   *
   * ★★★ ECHOING THEM TURNS A DEAD END INTO ONE CLICK. "No matching results" is
   *     unanswerable on its own: the user cannot see WHY, and the filter that
   *     is hiding everything is usually one they set three screens ago and
   *     have forgotten. Naming them, with a way to drop them, is the whole fix.
   *
   * ★ Strings, not a filter model. Only the host can render a date range or a
   *   facet id as words a person recognises, and a kit that tried would print
   *   `status_id: 4`.
   */
  activeFilters = input<readonly string[]>([]);

  /**
   * Label for the built-in clear-filters button. `null` renders none.
   * @default 'Clear filters'
   *
   * ★ Rendered only when there are filters to clear, so it cannot offer to
   *   undo something that is not there.
   */
  clearFiltersLabel = input<string | null>('Clear filters');

  /**
   * The device is offline (`OF-07-M1`). Takes precedence over `reason`.
   * @default false
   *
   * ★★ OFFLINE IS NOT "NOTHING HERE" AND NOT "IT FAILED". The data may well
   *    exist; this device cannot reach it, and the fix is the user's (find a
   *    connection), not the server's. "Nothing here yet" sends them looking for
   *    records that are not missing, and "Could not load this" reads as a bug.
   *
   * ★ A flag rather than a fifth `reason`, because `EmptyStateReason` is an
   *   alias of core's published union and widening it would break every
   *   exhaustive `switch` a host has written over it.
   */
  offline = input<boolean>(false);

  /**
   * Label for the preset's retry button, offered for `reason="error"` and for
   * `offline` — the two causes a second attempt can fix (`OF-07-M1`).
   * `null` renders none. @default null
   *
   * ★ Opt-in: a "Try again" nobody listens to is a button that does nothing,
   *   which is worse than none. Bind `(retry)` and set this together.
   */
  retryLabel = input<string | null>(null);

  // ── Icon ──────────────────────────────────────────────────────────────────

  /**
   * Built-in icon preset. Set to `'custom'` and provide `customIcon` to use
   * your own SVG. @default 'inbox'
   */
  icon     = input<EmptyStateIcon>('inbox');

  /**
   * Icon-library NAME — required when `icon === 'custom'`, ignored otherwise.
   *
   * ★ BREAKING (icon sweep): was `iconPath`, a raw `<path d="…">`, alongside an
   * `iconViewBox` that is now deleted. An unresolved name draws no `<svg>` at
   * all, so the decorative ring keeps its shape.
   */
  customIcon = input<string>('');


  /**
   * Show the decorative concentric-ring background behind the icon.
   * @default true
   */
  showRings = input<boolean>(true);

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Overall size. @default 'md' */
  size   = input<EmptyStateSize>('md');

  /** Content stacking axis. @default 'vertical' */
  layout = input<EmptyStateLayout>('vertical');

  /**
   * Whether to render a card surface (border + background + rounded corners)
   * or let the component blend into its parent.
   * @default true
   */
  bordered = input<boolean>(true);

  /** Additional CSS classes on the root element. */
  customClass = input<string>('');

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * CTA buttons rendered below the message.
   * Maximum 3 — first one is typically primary, rest secondary/ghost.
   */
  actions = input<EmptyStateAction[]>([]);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted when any action button is clicked, carrying the action's `id`. */
  actionClick = output<string>();

  /** The built-in clear-filters button was pressed (`OF-07-M2`). */
  readonly clearFilters = output<void>();

  /** The preset retry button was pressed (`retryLabel`, `OF-07-M1`). */
  readonly retry = output<void>();

  // ── Computed ──────────────────────────────────────────────────────────────

  /** True when a filter is narrowing the list. */
  readonly filtered = computed<boolean>(() => this.activeFilters().length > 0);

  /**
   * The reason actually used.
   *
   * ★★ A HOST THAT PASSES FILTERS HAS ALREADY TOLD US THE REASON. Requiring
   *    both `reason="no-results"` and `[activeFilters]` would make the
   *    commonest mistake — filters echoed under "Nothing here yet" — still
   *    possible, and it is exactly the mistake this item is about.
   */
  readonly resolvedReason = computed<EmptyStateReason>(() =>
    this.filtered() && this.reason() === 'no-data' ? 'no-results' : this.reason(),
  );

  /**
   * True when the built-in clear-filters button renders — and, with it, when
   * clearing the filters is THE next step (`OF-07-I2`).
   */
  readonly clearOffered = computed<boolean>(() => this.filtered() && !!this.clearFiltersLabel());

  /** True when the preset retry button renders: an error or offline, with a label. */
  readonly retryOffered = computed<boolean>(() =>
    this.retryLabel() !== null && (this.offline() || this.resolvedReason() === 'error'),
  );

  /** Heading: the host's, else copy that matches the reason. */
  readonly resolvedTitle = computed<string>(() => {
    const stated = this.title().trim();
    if (stated) return stated;
    if (this.offline()) return 'You are offline';
    switch (this.resolvedReason()) {
      case 'no-results': return 'No matching results';
      case 'error':      return 'Could not load this';
      case 'no-access':  return 'You do not have access';
      default:           return 'Nothing here yet';
    }
  });

  /** Supporting line: the host's, else copy that matches the reason. */
  readonly resolvedMessage = computed<string>(() => {
    const stated = this.message().trim();
    if (stated) return stated;
    if (this.offline()) return 'This will load when your connection is back.';
    switch (this.resolvedReason()) {
      // ★ No message for `no-results`: the filter chips below say more than a
      //   sentence could, and a generic "try adjusting your filters" above a
      //   list of the actual filters is noise between the user and the fix.
      case 'no-results': return '';
      case 'error':      return 'Something went wrong while loading. Try again.';
      case 'no-access':  return 'Ask an administrator if you think this is wrong.';
      default:           return '';
    }
  });

  /**
   * Icon-library name to draw: the `custom` override, the explicit preset, or
   * one chosen from the reason.
   *
   * ★★ THE GLYPH IS PART OF THE LIE. A cheerful empty inbox over "no matching
   *    results" says "you have nothing" when the truth is "your filters match
   *    nothing" — so an unstated icon follows the reason rather than defaulting
   *    to `inbox` for every case.
   */
  resolvedIconName = computed<string>(() => {
    const preset = this.icon();
    if (preset === 'custom') return this.customIcon();
    if (preset !== 'inbox') return ICON_NAMES[preset];
    // ★ `alert-triangle`, distinct from the error's `alert-circle`: the free
    //   icon set has no `wifi-off`, and the two causes must not share a glyph.
    if (this.offline()) return 'alert-triangle';
    switch (this.resolvedReason()) {
      case 'no-results': return ICON_NAMES['search'];
      case 'error':      return ICON_NAMES['error'];
      case 'no-access':  return ICON_NAMES['lock'];
      default:           return ICON_NAMES['inbox'];
    }
  });

  /**
   * The actions, with their weight resolved by position.
   *
   * ★★★ `action.style ?? 'primary'` MADE EVERY UNSTYLED ACTION A PRIMARY CTA,
   *     which is no hierarchy at all — three primary buttons side by side make
   *     the user read all three to find the one the page expects. The first
   *     action is primary; the rest are secondary unless they say otherwise.
   */
  /*
   * ★★★ AND WHEN THE LIST IS FILTERED TO NOTHING, THE PRIMARY ACTION IS
   *     "CLEAR FILTERS" — NOT "CREATE A RECORD" (`OF-07-I2`). A filled
   *     "New invoice" beside a text-link "Clear filters" invites the user to
   *     create a duplicate of a record they already have and cannot see. While
   *     the clear-filters button is offered it takes the primary weight, and
   *     every host action that would have been primary — stated or by position
   *     — renders secondary, so the page has exactly one primary.
   */
  readonly resolvedActions = computed<readonly (EmptyStateAction & { resolvedStyle: NonNullable<EmptyStateAction['style']> })[]>(
    () => {
      // The preset retry (error / offline) leads the same way.
      const demote = this.clearOffered() || this.retryOffered();
      return this.actions().map((action, index) => {
        const style = action.style ?? (index === 0 ? 'primary' : 'secondary');
        return { ...action, resolvedStyle: demote && style === 'primary' ? 'secondary' : style };
      });
    },
  );

  // ── Root wrapper ──────────────────────────────────────────────────────────

  rootClasses = computed<string>(() => {
    const bordered = this.bordered()
      ? 'border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
      : '';

    const sizeMap: Record<EmptyStateSize, string> = {
      sm: 'rounded-xl px-6 py-8',
      md: 'rounded-xl px-8 py-12',
      lg: 'rounded-2xl px-10 py-16',
    };

    return [
      'w-full',
      bordered,
      sizeMap[this.size()],
      this.layout() === 'horizontal'
        ? 'flex items-center gap-8'
        : 'flex flex-col items-center text-center',
      this.customClass(),
    ].filter(Boolean).join(' ');
  });

  // ── Icon ring ─────────────────────────────────────────────────────────────

  /** Outer ring container size keyed to component size. */
  ringSizeClass = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-20 w-20';
      case 'lg': return 'h-36 w-36';
      default:   return 'h-28 w-28';
    }
  });

  /** Inner icon container size. */
  iconContainerClass = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-10 w-10';
      case 'lg': return 'h-16 w-16';
      default:   return 'h-14 w-14';
    }
  });

  /** SVG icon size. */
  iconSvgClass = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-5 w-5';
      case 'lg': return 'h-8 w-8';
      default:   return 'h-7 w-7';
    }
  });

  // ── Typography ────────────────────────────────────────────────────────────

  titleClass = computed<string>(() => {
    const base = 'font-semibold text-gray-900 dark:text-white';
    switch (this.size()) {
      case 'sm': return `${base} text-sm`;
      case 'lg': return `${base} text-2xl`;
      default:   return `${base} text-lg`;
    }
  });

  messageClass = computed<string>(() => {
    const base = 'text-gray-500 dark:text-gray-400 leading-relaxed';
    const maxW = this.layout() === 'vertical'
      ? (this.size() === 'lg' ? 'max-w-md' : 'max-w-xs')
      : '';
    switch (this.size()) {
      case 'sm': return `${base} text-xs ${maxW}`;
      case 'lg': return `${base} text-base ${maxW}`;
      default:   return `${base} text-sm ${maxW}`;
    }
  });

  // ── Text block layout ─────────────────────────────────────────────────────

  textBlockClass = computed<string>(() =>
    this.layout() === 'horizontal'
      ? 'flex flex-1 flex-col items-start text-left gap-1 min-w-0'
      : 'flex flex-col items-center gap-1.5'
  );

  actionsClass = computed<string>(() =>
    this.layout() === 'horizontal'
      ? 'flex flex-wrap gap-2 mt-4'
      : 'flex flex-wrap justify-center gap-3 mt-4'
  );

  // ── Action button classes ─────────────────────────────────────────────────

  /**
   * Pre-built action button class strings keyed by style variant.
   * Computed once per `size()` change so the template does a cheap key lookup
   * instead of calling a method inside the `@for` loop on every CD cycle.
   */
  actionClasses = computed<Record<NonNullable<EmptyStateAction['style']>, string>>(() => {
    const base = 'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
    const sizeMap: Record<EmptyStateSize, string> = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-sm',
    };
    const sizeClass = sizeMap[this.size()];

    const make = (styleClass: string) => [base, sizeClass, styleClass].join(' ');

    return {
      primary:   make('bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500 shadow-sm'),
      secondary: make('bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-gray-400 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-700 shadow-sm'),
      ghost:     make('text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'),
    };
  });
}
