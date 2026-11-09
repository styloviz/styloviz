import {
  Component,
  Directive,
  input,
  output,
  computed,
  contentChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import { SvAvatarComponent } from '@styloviz/avatar';
import { SvKbdComponent } from '@styloviz/kbd';
import { svShortcutTokens } from '@styloviz/core/a11y';
import { type SvEmptyReason } from '@styloviz/core/data';
import { injectSvLabels } from '@styloviz/core/i18n';
import { SV_EMPTY_STATE_LABELS, type SvEmptyStateLabels } from './empty-state.labels';
import {
  SvIllustrationErrorComponent,
  SvIllustrationNoAccessComponent,
  SvIllustrationNoDataComponent,
  SvIllustrationNoResultsComponent,
} from './empty-state.illustrations';

import { registerEmptyStateIcons } from './empty-state.component.icons';
export { SV_EMPTY_STATE_LABELS } from './empty-state.labels';
export type { SvEmptyStateLabels } from './empty-state.labels';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Visual size of the empty state block.
 * - `sm`  — compact, inline use (table cells, sidebars)
 * - `md`  — default card/panel use
 * - `lg`  — full-page / hero-style
 */
/** `xs` is a one-line row (a table's empty body); `xl` a full-page hero. */
export type EmptyStateSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * The card's treatment.
 * - `default` — the ring stack on a plain card.
 * - `dashed` — a dashed drop-zone border; with exactly one action the whole
 *   card is that action ("Create your first project").
 * - `ghost` — `[svGhost]` content shown faintly behind, fading out: a preview
 *   of what the screen will look like once it has data.
 * - `glow` — a soft tinted glow behind the icon (`sv-glow`).
 */
export type EmptyStateVariant = 'default' | 'dashed' | 'ghost' | 'glow';

/** Centred, or aligned to the start (in a card header, beside other content). */
export type EmptyStateAlign = 'center' | 'start';

/** A built-in illustration, or `'auto'` to pick one by `reason`. */
export type EmptyStateIllustration = 'auto' | 'no-data' | 'no-results' | 'no-access' | 'error';

/** One step of an onboarding checklist. */
export interface EmptyStateStep {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly done?: boolean;
}

/** A person in the "invite teammates" stack. */
export interface EmptyStateAvatar {
  readonly name: string;
  readonly src?: string;
}

/** A quiet link under the actions — "Learn more". */
export interface EmptyStateLink {
  readonly label: string;
  readonly href: string;
}

/** Marks projected content as the illustration — it replaces the ring stack. */
@Directive({ selector: '[svIllustration]', standalone: true })
export class SvEmptyIllustrationDirective {}

/** Marks projected content as the ghost preview behind a `variant="ghost"` card. */
@Directive({ selector: '[svGhost]', standalone: true })
export class SvEmptyGhostDirective {}

/** Marks projected media (an image, a video) shown in place of the icon. */
@Directive({ selector: '[svMedia]', standalone: true })
export class SvEmptyMediaDirective {}

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
  imports: [
    NgClass,
    SvIconComponent,
    SvAvatarComponent,
    SvKbdComponent,
    SvIllustrationNoDataComponent,
    SvIllustrationNoResultsComponent,
    SvIllustrationNoAccessComponent,
    SvIllustrationErrorComponent,
  ],
  templateUrl: './empty-state.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvEmptyStateComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerEmptyStateIcons();

  /** The package's labels — `provideSvLabels({ emptyState: { … } })`; `[labels]` overrides them per instance. */
  private readonly registryLabels = injectSvLabels('emptyState', SV_EMPTY_STATE_LABELS);

  // ── Content ───────────────────────────────────────────────────────────────

  /**
   * Main heading text. Falls back to copy chosen from `reason`.
   *
   * Empty by default, so the heading matches the reason: a filtered list says
   * nothing matched the filters rather than `'Nothing here yet'`.
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
  clearFiltersLabel = input<string | null>(this.registryLabels.clearFilters);

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
   * An unresolved name draws no `<svg>` at all, so the decorative ring keeps
   * its shape.
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

  // ── SR-34: variants and content ───────────────────────────────────────────

  /** The card's treatment: plain, dashed, ghost preview, or glow. @default 'default' */
  variant = input<EmptyStateVariant>('default');

  /** Centred, or aligned to the start of its box. @default 'center' */
  align = input<EmptyStateAlign>('center');

  /**
   * A built-in illustration in place of the ring stack — or `'auto'` to pick
   * one by `reason`. Projected `[svIllustration]` content wins over this.
   * @default null
   */
  illustration = input<EmptyStateIllustration | null>(null);

  /** An onboarding checklist: numbered steps, a check on the done ones. @default [] */
  steps = input<readonly EmptyStateStep[]>([]);

  /**
   * The search that found nothing. With `reason="no-results"` and no `title`,
   * the title says "No results for «query»", and a Clear search button appears.
   * @default ''
   */
  query = input<string>('');

  /** "Did you mean" chips for a search with no results. @default [] */
  suggestions = input<readonly string[]>([]);

  /** Technical detail for an error, behind a "Show details" disclosure. @default '' */
  errorDetails = input<string>('');

  /** With `reason="no-access"`, a button to ask for access. @default '' */
  requestAccessLabel = input<string>('');

  /** A quiet link under the actions — documentation, a guide. @default null */
  secondaryLink = input<EmptyStateLink | null>(null);

  /** People to show in an "invite teammates" stack. @default [] */
  avatars = input<readonly EmptyStateAvatar[]>([]);

  /** How many avatars to draw before a "+N" chip. @default 4 */
  maxAvatars = input<number>(4);

  /** A keyboard shortcut to mention — `'mod+n'` — drawn as keys. @default '' */
  shortcut = input<string>('');

  /** What the shortcut does, after it: "to create a project". @default '' */
  shortcutHint = input<string>('');

  /** Every string the component renders itself. Merged over `SV_EMPTY_STATE_LABELS`. @default {} */
  labels = input<Partial<SvEmptyStateLabels>>({});

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted when any action button is clicked, carrying the action's `id`. */
  actionClick = output<string>();

  /** The built-in clear-filters button was pressed (`OF-07-M2`). */
  readonly clearFilters = output<void>();

  /** The preset retry button was pressed (`retryLabel`, `OF-07-M1`). */
  readonly retry = output<void>();

  /** A checklist step was chosen. */
  readonly stepClick = output<EmptyStateStep>();

  /** A "Did you mean" suggestion was chosen. */
  readonly suggestionClick = output<string>();

  /** The Clear search button. */
  readonly clearQuery = output<void>();

  /** The request-access button. */
  readonly requestAccess = output<void>();

  // ── SR-34: projected parts ────────────────────────────────────────────────

  private readonly _illustrationSlot = contentChild(SvEmptyIllustrationDirective);
  private readonly _ghostSlot = contentChild(SvEmptyGhostDirective);
  private readonly _mediaSlot = contentChild(SvEmptyMediaDirective);
  readonly hasIllustrationSlot = computed(() => this._illustrationSlot() !== undefined);
  readonly hasGhost = computed(() => this._ghostSlot() !== undefined);
  readonly hasMedia = computed(() => this._mediaSlot() !== undefined);

  /** The labels: the registry's (English unless the app provides others), under whatever the host passed. */
  readonly text = computed<SvEmptyStateLabels>(() => ({ ...this.registryLabels, ...this.labels() }));

  /** The built-in illustration to draw, or `null`. */
  readonly builtInIllustration = computed<Exclude<EmptyStateIllustration, 'auto'> | null>(() => {
    const chosen = this.illustration();
    if (chosen === null || this.hasIllustrationSlot()) return null;
    if (chosen !== 'auto') return chosen;
    return this.offline() ? 'error' : this.resolvedReason();
  });

  /** What stands in the icon's place: an illustration, media, or the ring stack. */
  readonly visual = computed<'illustration' | 'media' | 'icon'>(() =>
    this.hasIllustrationSlot() || this.builtInIllustration() !== null ? 'illustration' : this.hasMedia() ? 'media' : 'icon');

  /**
   * ★ `dashed` with exactly one action and nothing else to press: the whole
   *   card IS the action, so it becomes one button — not a card with a button
   *   in it, which would nest one control inside another.
   */
  readonly cardIsAction = computed(() =>
    this.variant() === 'dashed' &&
    this.actions().length === 1 &&
    !this.clearOffered() &&
    !this.retryOffered() &&
    this.steps().length === 0 &&
    this.suggestions().length === 0 &&
    !this.queryClearOffered() &&
    !this.requestAccessOffered() &&
    this.secondaryLink() === null);

  /** Run the card's one action — the dashed card's click, Enter and Space. */
  activateCard(event?: Event): void {
    if (!this.cardIsAction()) return;
    if (event instanceof KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
    }
    this.actionClick.emit(this.actions()[0].id);
  }

  /** A Clear search button, for a search that found nothing. */
  readonly queryClearOffered = computed(() => this.query().trim() !== '' && this.resolvedReason() === 'no-results');

  /** A request-access button, for a no-access state. */
  readonly requestAccessOffered = computed(() => this.requestAccessLabel() !== '' && this.resolvedReason() === 'no-access');

  /** The avatars drawn, and how many are left over. */
  readonly avatarStack = computed(() => {
    const all = this.avatars();
    const max = Math.max(0, this.maxAvatars());
    const shown = all.slice(0, max);
    const more = all.length - shown.length;
    return { shown, more, moreLabel: this.text().moreAvatars.replace('{count}', String(more)) };
  });

  /** The shortcut sentence, split around its keys. */
  readonly shortcutParts = computed(() => {
    const keys = this.shortcut();
    if (!keys) return null;
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const tokens = svShortcutTokens(keys, { isMac });
    if (tokens.length === 0) return null;
    const sentence = this.text().shortcut.replace('{hint}', this.shortcutHint()).trim();
    const [before, after = ''] = sentence.split('{keys}');
    return { before: before.trim(), after: after.trim(), tokens };
  });

  /** Numbered steps, with their state. */
  readonly stepRows = computed(() => {
    const steps = this.steps();
    const next = steps.findIndex((s) => !s.done);
    return steps.map((step, i) => ({ step, number: i + 1, done: !!step.done, current: i === next }));
  });


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
    const text = this.text();
    if (this.offline()) return text.offlineTitle;
    switch (this.resolvedReason()) {
      case 'no-results': {
        const q = this.query().trim();
        return q ? text.noResultsFor.replace('{query}', q) : text.noResultsTitle;
      }
      case 'error':      return text.errorTitle;
      case 'no-access':  return text.noAccessTitle;
      default:           return text.noDataTitle;
    }
  });

  /** Supporting line: the host's, else copy that matches the reason. */
  readonly resolvedMessage = computed<string>(() => {
    const stated = this.message().trim();
    if (stated) return stated;
    const text = this.text();
    if (this.offline()) return text.offlineMessage;
    switch (this.resolvedReason()) {
      // ★ No message for `no-results`: the filter chips below say more than a
      //   sentence could, and a generic "try adjusting your filters" above a
      //   list of the actual filters is noise between the user and the fix.
      case 'no-results': return '';
      case 'error':      return text.errorMessage;
      case 'no-access':  return text.noAccessMessage;
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
    const variant = this.variant();
    const xs = this.size() === 'xs';
    const surface = !this.bordered()
      ? ''
      : variant === 'dashed'
        ? 'border-2 border-dashed border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900'
        : 'border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900';

    const sizeMap: Record<EmptyStateSize, string> = {
      xs: 'rounded-lg px-4 py-3',
      sm: 'rounded-xl px-6 py-8',
      md: 'rounded-xl px-8 py-12',
      lg: 'rounded-2xl px-10 py-16',
      xl: 'rounded-2xl px-6 py-20 sm:px-12 sm:py-28',
    };

    const start = this.align() === 'start';
    const axis = xs
      ? 'flex items-center gap-3 text-start'
      : this.layout() === 'horizontal'
        ? 'flex items-center gap-8'
        : start
          ? 'flex flex-col items-start text-start'
          : 'flex flex-col items-center text-center';

    return [
      'relative isolate w-full overflow-hidden',
      surface,
      sizeMap[this.size()],
      axis,
      this.cardIsAction()
        ? 'cursor-pointer transition-colors hover:border-primary-400 hover:bg-primary-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:hover:border-primary-500/60 dark:hover:bg-primary-500/5 dark:focus-visible:ring-offset-gray-950'
        : '',
      this.customClass(),
    ].filter(Boolean).join(' ');
  });

  // ── Icon ring ─────────────────────────────────────────────────────────────

  /** Outer ring container size keyed to component size. */
  ringSizeClass = computed<string>(() => {
    switch (this.size()) {
      case 'xs': return 'h-8 w-8';
      case 'sm': return 'h-20 w-20';
      case 'lg': return 'h-36 w-36';
      case 'xl': return 'h-44 w-44';
      default:   return 'h-28 w-28';
    }
  });

  /** Inner icon container size. */
  iconContainerClass = computed<string>(() => {
    switch (this.size()) {
      case 'xs': return 'h-8 w-8';
      case 'sm': return 'h-10 w-10';
      case 'lg': return 'h-16 w-16';
      case 'xl': return 'h-20 w-20';
      default:   return 'h-14 w-14';
    }
  });

  /** SVG icon size. */
  iconSvgClass = computed<string>(() => {
    switch (this.size()) {
      case 'xs': return 'h-4 w-4';
      case 'sm': return 'h-5 w-5';
      case 'lg': return 'h-8 w-8';
      case 'xl': return 'h-10 w-10';
      default:   return 'h-7 w-7';
    }
  });

  /** The rings are a centrepiece; a one-line row has no room for them. */
  readonly ringsShown = computed(() => this.showRings() && this.size() !== 'xs');

  // ── Typography ────────────────────────────────────────────────────────────

  titleClass = computed<string>(() => {
    const base = 'font-semibold text-gray-900 dark:text-white';
    switch (this.size()) {
      case 'xs': return `${base} text-sm`;
      case 'sm': return `${base} text-sm`;
      case 'lg': return `${base} text-2xl`;
      case 'xl': return `${base} text-3xl tracking-tight sm:text-4xl`;
      default:   return `${base} text-lg`;
    }
  });

  messageClass = computed<string>(() => {
    const base = 'text-gray-600 dark:text-gray-400 leading-relaxed';
    const maxW = this.layout() === 'vertical' && this.size() !== 'xs'
      ? (this.size() === 'xl' ? 'max-w-lg' : this.size() === 'lg' ? 'max-w-md' : 'max-w-xs')
      : '';
    switch (this.size()) {
      case 'xs': return `${base} text-sm`;
      case 'sm': return `${base} text-xs ${maxW}`;
      case 'lg': return `${base} text-base ${maxW}`;
      case 'xl': return `${base} text-lg ${maxW}`;
      default:   return `${base} text-sm ${maxW}`;
    }
  });

  // ── Text block layout ─────────────────────────────────────────────────────

  textBlockClass = computed<string>(() => {
    if (this.size() === 'xs') return 'flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5';
    return this.layout() === 'horizontal' || this.align() === 'start'
      ? 'relative flex flex-1 flex-col items-start text-start gap-1 min-w-0'
      : 'relative flex flex-col items-center gap-1.5';
  });

  actionsClass = computed<string>(() => {
    if (this.size() === 'xs') return 'flex shrink-0 flex-wrap gap-2';
    return this.layout() === 'horizontal' || this.align() === 'start'
      ? 'flex flex-wrap gap-2 mt-4'
      : 'flex flex-wrap justify-center gap-3 mt-4';
  });

  /** Where the chips and lists sit: centred or to the start. */
  readonly rowJustify = computed(() =>
    this.layout() === 'horizontal' || this.align() === 'start' || this.size() === 'xs' ? 'justify-start' : 'justify-center');

  // ── Action button classes ─────────────────────────────────────────────────

  /**
   * Pre-built action button class strings keyed by style variant.
   * Computed once per `size()` change so the template does a cheap key lookup
   * instead of calling a method inside the `@for` loop on every CD cycle.
   */
  actionClasses = computed<Record<NonNullable<EmptyStateAction['style']>, string>>(() => {
    const base = 'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
    const sizeMap: Record<EmptyStateSize, string> = {
      xs: 'px-2.5 py-1 text-xs',
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-sm',
      xl: 'px-6 py-3 text-base',
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
