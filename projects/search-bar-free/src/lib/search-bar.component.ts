import {
  ApplicationRef,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  EmbeddedViewRef,
  HostListener,
  inject,
  input,
  model,
  OnDestroy,
  OnInit,
  output,
  PLATFORM_ID,
  signal,
  TemplateRef,
  ViewChild,
  viewChild,
} from '@angular/core';
import {
  SvErrorShellComponent,
  SvStaleDirective,
  type SvDataError, type SvEmptyReason, SvSpinnerArcComponent, svHighlightSegments,
  svUniqueId,
} from '@styloviz/core';
import { isPlatformBrowser, NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import { SvKbdComponent } from '@styloviz/kbd';
import { FormsModule } from '@angular/forms';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchBarSize    = 'sm' | 'md' | 'lg';
export type SearchBarVariant = 'default' | 'filled' | 'borderless';

/**
 * A single suggestion item displayed in the dropdown.
 */
export interface SearchSuggestion {
  /** Unique identifier — emitted on selection. */
  id:       string;
  /** Primary display text. */
  label:    string;
  /** Optional secondary line (e.g. category, path, role). */
  sublabel?: string;
  /**
   * Optional icon type for the suggestion row.
   * - `'search'`  — magnifier (recent / query suggestion)
   * - `'page'`    — document icon
   * - `'user'`    — person icon
   * - `'tag'`     — tag icon
   * - `'custom'`  — uses `icon`
   */
  iconType?: 'search' | 'page' | 'user' | 'tag' | 'custom';
  /** Icon-library NAME — used when `iconType === 'custom'`. Was `iconPath`. */
  icon?: string;
  /** Highlight / badge label (e.g. "New", "Popular"). */
  badge?:   string;
}

/**
 * A filter chip rendered inside the search input.
 */
export interface SearchFilter {
  id:    string;
  label: string;
}

/**
 * A suggestion item pre-processed for efficient template rendering.
 * Extends `SearchSuggestion` with a resolved icon name and pre-split
 * highlight parts so the template never calls methods inside `@for` loops.
 */
export interface ComputedSuggestion extends SearchSuggestion {
  /** Resolved icon-library NAME for the row icon. */
  resolvedIconName: string;
  /** Pre-split highlight regions for the suggestion label. */
  highlighted: { pre: string; match: string; post: string };
}

const SUGGESTION_ICON_NAMES: Record<Exclude<SearchSuggestion['iconType'], 'custom' | undefined>, string> = {
  search: 'search', page: 'file-text', user: 'user', tag: 'tag',
};

// ─── Constants ───────────────────────────────────────────────────────────────

/** Delay in ms before closing the dropdown on blur — lets suggestion clicks register first. */
const BLUR_CLOSE_DELAY_MS = 150;
/** Gap between the input track and the portaled suggestions panel (px). */
const PANEL_GAP = 4;
/** Minimum breathing room from the viewport edge before the vertical flip triggers (px). */
const PANEL_MARGIN = 8;
/** Preferred panel height used only for the open-above vs open-below decision (px) — ~6 rows. */
const PANEL_PREFERRED_HEIGHT = 288;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SearchBar — A premium, fully-featured search input for dashboards.
 *
 * Features:
 * - Signal-based two-way binding via `[(value)]`
 * - Configurable debounce (default 300 ms)
 * - Typeahead dropdown with keyboard navigation (↑ ↓ Enter Escape)
 * - 4 icon types per suggestion row + custom SVG path support
 * - Inline filter chip tokens (removable)
 * - Loading / searching spinner state
 * - Clear button
 * - Keyboard shortcut hint badge (e.g. ⌘K)
 * - 3 sizes × 3 visual variants
 * - Full dark-mode support
 * - Accessible: `role="combobox"`, `aria-expanded`, `aria-activedescendant`
 */
@Component({
  selector: 'sv-search-bar',
  standalone: true,
  imports: [SvErrorShellComponent, NgClass, FormsModule, SvIconComponent, SvSpinnerArcComponent, SvKbdComponent,
    SvStaleDirective],
  templateUrl: './search-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvSearchBarComponent implements OnInit, OnDestroy {
  // ── Async state ───────────────────────────────────────────────────────────

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an
   * `HttpErrorResponse`.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /** The host should re-run the failed suggestion lookup. */
  readonly retry = output<void>();

  private readonly platformId = inject(PLATFORM_ID);
  private readonly appRef     = inject(ApplicationRef);

  // ── Value ─────────────────────────────────────────────────────────────────

  /** Current input text. Use `[(value)]` for two-way binding. */
  value = model<string>('');

  // ── Content ───────────────────────────────────────────────────────────────

  /**
   * Floating label text — only shown when `variant="floating"`.
   * Acts as a Material Design-style animated label. @default ''
   */
  label = input<string>('');

  /** Placeholder text. @default 'Search…' */
  placeholder = input<string>('Search…');

  /** Explicit accessible name for the input. Falls back to `label` then `placeholder`. */
  ariaLabel = input<string>('');

  /**
   * Keyboard shortcut hint shown on the right side of the input when empty.
   * E.g. `'⌘K'`, `'Ctrl+K'`, `'/''`. Empty string hides the badge.
   * @default ''
   */
  shortcutHint = input<string>('');

  // ── Suggestions ───────────────────────────────────────────────────────────

  /**
   * Suggestion items to display in the dropdown.
   * Pass a filtered/sliced array; the component renders all provided items.
   * Empty array closes the dropdown.
   */
  suggestions = input<SearchSuggestion[]>([]);

  /**
   * Label shown above the suggestions list (e.g. 'Recent searches', 'Results').
   * Empty string hides the header. @default ''
   */
  suggestionsLabel = input<string>('');

  /**
   * Text displayed at the bottom of the dropdown — useful for "View all results".
   * Empty string hides the footer. @default ''
   */
  footerLabel = input<string>('');

  // ── Filters ───────────────────────────────────────────────────────────────

  /**
   * Active filter chips rendered inside the input track.
   * Each chip has an × button that emits `filterRemoved`.
   */
  filters = input<SearchFilter[]>([]);

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Field size: sm, md or lg. @default 'md' */
  size    = input<SearchBarSize>('md');

  /** Visual variant: default, floating, minimal… @default 'default' */
  variant = input<SearchBarVariant>('default');

  /** Show the magnifier icon on the left. @default true */
  showSearchIcon = input<boolean>(true);

  // ── State ─────────────────────────────────────────────────────────────────

  /** Show the spinning loader inside the search icon area. @default false */
  loading = input<boolean>(false);

  /**
   * The results on screen answer an **older** query — a newer request is still
   * in flight.
   *
   * Distinct from `loading`, which cannot separate the two cases it covers: the
   * first fetch (nothing on screen — show a skeleton) and a refinement of
   * results already visible (keep them, and say they are provisional). Blanking
   * the panel on the second is the most jarring thing a picker can do; showing
   * the old list with no indication is a quiet lie.
   *
   * Bind `svSuggestController(...).stale` from `@styloviz/data`, or
   * `createRequestGuard().stale` from `@styloviz/core`. The results dim and
   * report `aria-busy` while staying fully interactive.
   * @default false
   */
  readonly stale = input(false, { transform: booleanAttribute });

  // ── Empty states ──────────────────────────────────────────────────────────
  //
  // ★★ "WE FOUND NOTHING" AND "TYPE TO BEGIN" USED TO BE THE SAME PICTURE —
  //    and that picture was no picture at all. The panel opened only when there
  //    was at least one row in it, so a search that came back with zero results
  //    closed the dropdown, stopped the spinner, and left the user looking at
  //    their own query with no way to tell whether anything had happened. The
  //    two states need different words because they call for different actions:
  //    one says keep going, the other says that term does not exist here.
  //    `FI-20-I2` / `FI-20-M2`.

  /**
   * Why the suggestion list is empty, or `null` when it is not empty (or when
   * nothing has been asked yet and the panel should stay shut).
   *
   * Bind `svSuggestController(...).emptyReason` from `@styloviz/data`, which
   * already distinguishes these two and holds `null` while a first load is in
   * flight — an "opening" message that flashes over a search in progress is a
   * third wrong answer.
   *
   * Leaving this unbound keeps the pre-existing behaviour exactly: an empty
   * `suggestions` array closes the panel and says nothing.
   * @default null
   */
  readonly emptyReason = input<SvEmptyReason | null>(null);

  /** Copy for the opening state — nothing searched for yet. @default 'Type to search' */
  noDataLabel = input<string>('Type to search');

  /** Copy for a search that answered with nothing. @default 'No results found' */
  noResultsLabel = input<string>('No results found');

  /**
   * A second line under `noResultsLabel` — "Check your spelling or try a
   * broader term". Empty hides it. @default ''
   */
  noResultsHint = input<string>('');

  /** Whether the input is disabled. @default false */
  disabled = input<boolean>(false);

  /**
   * Debounce delay in milliseconds before `searched` emits.
   * Set to 0 to emit on every keystroke. @default 300
   */
  debounceMs = input<number>(300);

  /** Additional classes on the root wrapper. */
  customClass = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted (debounced) on every value change. */
  searched      = output<string>();

  /** Emitted when the user presses Enter or clicks a suggestion. */
  submitted     = output<string>();

  /** Emitted when a suggestion row is clicked, carrying the suggestion object. */
  suggestionSelected = output<SearchSuggestion>();

  /** Emitted when the × on a filter chip is clicked. */
  filterRemoved = output<string>();

  /** Emitted when the footer link is clicked. */
  footerClick   = output<void>();

  /** Emitted when the input is cleared via the × button. */
  cleared       = output<void>();

  // ── Internal state ────────────────────────────────────────────────────────

  readonly isFocused        = signal(false);
  readonly activeIndex      = signal(-1);

  /** Per-instance id base so multiple search bars don't collide. */
  private readonly _baseId = svUniqueId('sv-search');
  /** id of the suggestions listbox (referenced by aria-controls). */
  readonly listboxId = `${this._baseId}-listbox`;
  /** DOM id for an option row at index `i` (used by aria-activedescendant). */
  optionId(i: number): string { return `${this._baseId}-opt-${i}`; }
  /** id of the active option, or null when nothing is highlighted. */
  readonly activeDescendantId = computed<string | null>(() =>
    this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : null
  );
  /** Accessible name: explicit ariaLabel, then floating label, then placeholder. */
  readonly accessibleName = computed<string>(() =>
    this.ariaLabel() || this.label() || this.placeholder()
  );

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Delayed blur-close timer — tracked so it can be cleared.
   *
   * ★ It used to be a bare `setTimeout` that nothing owned: a component torn
   * down inside the 150ms window (a route change, a closing modal — exactly
   * when a field is blurred) left a callback running that wrote to a destroyed
   * component's state. The Pro twin already tracked it; this one did not.
   */
  private blurTimer: ReturnType<typeof setTimeout> | null = null;

  /** Template reference to the native <input> element. */
  readonly inputRef  = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  /** Template reference to the track container — used for dropdown positioning. */
  readonly trackRef  = viewChild<ElementRef<HTMLElement>>('trackEl');

  // ── Body-portal state ────────────────────────────────────────────────────
  // Portals the suggestions panel into document.body so ancestor overflow/
  // transform containers can never clip it (see dropdown-instruction.md).

  /** True once the panel has flipped to open above the track (space below is tight). */
  readonly openAbove = signal(false);
  /** Suppresses the dropdown after a viewport resize until focus/typing resumes. */
  readonly resizeSuppressed = signal(false);
  /** Inline style object applied to the portaled panel (position:fixed + viewport coords). */
  readonly panelStyle = signal<Record<string, string>>({});

  private portalEl:   HTMLElement | null = null;
  private portalView: EmbeddedViewRef<object> | null = null;

  /** The ng-template holding the suggestions panel — never rendered inline; instantiated into <body> on open. */
  @ViewChild('panelTpl', { read: TemplateRef })
  private readonly panelTpl!: TemplateRef<object>;

  /** Capture-phase scroll listener — fires for ANY scrollable ancestor, not just the window. */
  private _rafId: number | null = null;
  private readonly _scrollHandler = (): void => {
    if (!this.showDropdown()) return;
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (this.showDropdown()) {
        this._calcPos();
        this.portalView?.detectChanges();
      }
    });
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  /**
   * Suggestions pre-processed once per change-detection cycle.
   * Resolves each item's icon path and highlight split so the template
   * can bind to plain properties instead of calling methods inside `@for`.
   */
  computedSuggestions = computed<ComputedSuggestion[]>(() =>
    this.suggestions().map(s => ({
      ...s,
      resolvedIconName: this.getSuggestionIconName(s),
      highlighted:      this.highlightMatch(s.label),
    }))
  );

  /**
   * Whether the panel has anything at all to show.
   *
   * Rows, a failure, or an explanation of the emptiness. The error arm fixes a
   * bug the error surface shipped with: a failed lookup usually returns no
   * suggestions, and the panel that holds `<sv-error-shell>` would not open, so
   * the error had nowhere to render and `retry` was unreachable.
   */
  readonly panelHasContent = computed(
    () => this.computedSuggestions().length > 0 || !!this.error() || this.emptyReason() !== null,
  );

  showDropdown = computed(() =>
    this.isFocused() && !this.resizeSuppressed() && this.panelHasContent()
  );

  /**
   * Show the empty-state block.
   *
   * Not while there are rows — the reason is stale the moment one arrives — and
   * not over a failure, which is the more specific fact: "no results" for a
   * request that never answered is simply untrue.
   */
  readonly showEmptyState = computed(
    () => this.emptyReason() !== null && this.computedSuggestions().length === 0 && !this.error(),
  );

  /** Headline of the empty state, chosen by the reason it is empty. */
  readonly emptyTitle = computed(() =>
    this.emptyReason() === 'no-results' ? this.noResultsLabel() : this.noDataLabel(),
  );

  /**
   * Second line: the term that matched nothing, quoted back.
   *
   * Repeating the query is what makes the two states unmistakable at a glance
   * — and it catches the trailing space or the stray character the user cannot
   * see in the field.
   */
  readonly emptyDetail = computed(() => {
    if (this.emptyReason() !== 'no-results') return '';
    const term = this.value().trim();
    return this.noResultsHint() || (term ? `Nothing matched “${term}”` : '');
  });

  /**
   * What the live region says.
   *
   * The panel is portalled into `<body>` and torn down on close, and a live
   * region that is inserted with its text already in it is frequently not
   * announced at all — so the region lives in the component's own template,
   * mounted for the life of the control, and only its contents change. This is
   * also where `FI-20-M4`'s result counts belong when they land.
   */
  readonly emptyAnnouncement = computed(() =>
    this.showEmptyState() && this.isFocused()
      ? [this.emptyTitle(), this.emptyDetail()].filter(Boolean).join('. ')
      : '',
  );

  showClear = computed(() => this.value().length > 0 && !this.disabled());

  isFloating     = computed(() => false);
  labelIsFloated = computed(() => this.isFocused() || !!this.value());

  floatingLabelClasses = computed<string>(() => {
    const floated = this.labelIsFloated();
    const focused = this.isFocused();
    const hasIcon = this.showSearchIcon();

    // Not-floated position must align with the input text cursor.
    // inputNativePadClass zeroes the left pad when icon is present, so cursor
    // lands at: iconPaddingClass + iconWidth + gap-1.5
    //   sm: pl-2.5(10) + 14px + 6px = 30px
    //   md: pl-3(12)   + 16px + 6px = 34px
    //   lg: pl-4(16)   + 20px + 6px = 42px
    const notFloatedLeftMap: Record<SearchBarSize, string> = hasIcon
      ? { sm: 'left-[30px]', md: 'left-[34px]', lg: 'left-[42px]' }
      : { sm: 'left-2',      md: 'left-3',       lg: 'left-4' };
    const notFloatedLeft = notFloatedLeftMap[this.size()];
    const floatedLeft    = 'left-3';

    const textSizeMap: Record<SearchBarSize, string> = {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
    };
    const textSize = floated ? 'text-[0.7rem] leading-none' : textSizeMap[this.size()];
    const bg       = floated ? 'px-1 bg-white dark:bg-gray-900' : '';

    const color = focused && floated
      ? 'text-primary-600 dark:text-primary-400'
      : floated
      ? 'text-gray-500 dark:text-gray-400'
      : 'text-gray-500 dark:text-gray-400';

    return [
      'pointer-events-none absolute z-10 transition-all duration-200 select-none whitespace-nowrap',
      floated
        ? `top-0 -translate-y-1/2 ${textSize} ${bg} ${floatedLeft}`
        : `top-1/2 -translate-y-1/2 ${textSize} ${notFloatedLeft}`,
      color,
    ].filter(Boolean).join(' ');
  });

  showShortcut = computed(() =>
    !!this.shortcutHint() && !this.value() && !this.isFocused() && !this.loading()
  );

  // ── Class maps ────────────────────────────────────────────────────────────

  wrapperClasses = computed<string>(() => ['relative w-full', this.customClass()].join(' '));

  trackClasses = computed<string>(() => {
    const sizeMap: Record<SearchBarSize, string> = {
      sm: 'h-8  text-xs',
      md: 'h-10 text-sm',
      lg: 'h-12 text-base',
    };

    const variantMap: Record<SearchBarVariant, string> = {
      default:    'bg-white border border-gray-300 dark:bg-gray-900 dark:border-gray-700 shadow-sm',
      filled:     'bg-gray-100 border border-transparent dark:bg-gray-800 dark:border-transparent',
      borderless: 'bg-transparent border border-transparent',
    };

    const focusRing = this.isFocused()
      ? 'ring-2 ring-primary-500/30 border-primary-500 dark:border-primary-400'
      : 'hover:border-gray-400 dark:hover:border-gray-500';

    return [
      'relative flex w-full items-center gap-1.5 rounded-md transition-all duration-150',
      sizeMap[this.size()],
      variantMap[this.variant()],
      this.disabled() ? 'cursor-not-allowed opacity-60' : focusRing,
      this.filters().length > 0 ? 'flex-wrap py-1' : '',
    ].filter(Boolean).join(' ');
  });

  inputPaddingClass = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'px-2';
      case 'lg': return 'px-4';
      default:   return 'px-3';
    }
  });

  /**
   * When a search icon occupies the left side the input needs no left padding —
   * the icon span + gap-1.5 already create visual spacing.
   * Without an icon, use symmetric px-X. Applies to all variants.
   */
  inputNativePadClass = computed<string>(() => {
    if (this.showSearchIcon()) {
      const rp: Record<SearchBarSize, string> = { sm: 'pr-2', md: 'pr-3', lg: 'pr-4' };
      return `pl-0 ${rp[this.size()]}`;
    }
    return this.inputPaddingClass();
  });

  iconSizeClass = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-3.5 w-3.5';
      case 'lg': return 'h-5 w-5';
      default:   return 'h-4 w-4';
    }
  });

  iconPaddingClass = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'pl-2.5';
      case 'lg': return 'pl-4';
      default:   return 'pl-3';
    }
  });

  // ── Suggestion helpers ────────────────────────────────────────────────────

  getSuggestionIconName(s: SearchSuggestion): string {
    if (s.iconType === 'custom') return s.icon ?? '';
    return s.iconType ? SUGGESTION_ICON_NAMES[s.iconType] : 'search';
  }

  /**
   * Highlight the matched portion of a suggestion label — the label split
   * around the FIRST occurrence of the query.
   *
   * 🔺 THIS WAS THE KIT'S FOURTH IMPLEMENTATION OF "MARK THE QUERY IN A LABEL",
   *    in its third shape — `sv-tree-view` and `sv-command-palette` returned
   *    segments, `sv-autocomplete` built an HTML string and bound it to
   *    `[innerHTML]`, and this returned a triple. The autocomplete one was the
   *    injection (`FI-01-I3`); what let it happen is that three correct answers
   *    were sitting in packages nothing else could import. The search now comes
   *    from `@styloviz/core`.
   *
   * ⚠️ THE `{ pre, match, post }` SHAPE STAYS, AND SO DOES ITS LIMITATION.
   *    `ComputedSuggestion.highlighted` is exported, so changing it is a
   *    breaking change — and the triple can only describe ONE match, so
   *    searching "an" in "banana" still marks only the first. Every other
   *    highlighted surface in the kit marks all of them. Recorded as a
   *    follow-up rather than slipped into a patch release; the adapter below is
   *    where it would be undone.
   */
  highlightMatch(text: string): { pre: string; match: string; post: string } {
    const segments = svHighlightSegments(text, this.value());
    const at = segments.findIndex((s) => s.match);
    if (at === -1) return { pre: text, match: '', post: '' };
    return {
      pre: segments.slice(0, at).map((s) => s.text).join(''),
      match: segments[at].text,
      post: segments.slice(at + 1).map((s) => s.text).join(''),
    };
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  onInput(raw: string): void {
    this.resizeSuppressed.set(false);
    this.value.set(raw);
    this.activeIndex.set(-1);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const ms = this.debounceMs();
    if (ms > 0) {
      this.debounceTimer = setTimeout(() => this.searched.emit(raw), ms);
    } else {
      this.searched.emit(raw);
    }
  }

  onFocus(): void {
    this.resizeSuppressed.set(false);
    this.isFocused.set(true);
  }
  onBlur(): void   {
    // Delay so click on a suggestion registers before closing dropdown.
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.blurTimer = setTimeout(() => this.isFocused.set(false), BLUR_CLOSE_DELAY_MS);
  }

  onKeydown(event: KeyboardEvent): void {
    const computed = this.computedSuggestions();
    const count = computed.length;
    if (!this.showDropdown() && event.key !== 'Enter') return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update(i => Math.min(i + 1, count - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(i => Math.max(i - 1, -1));
        break;
      case 'Enter': {
        event.preventDefault();
        const idx = this.activeIndex();
        if (idx >= 0 && idx < count) {
          this.selectSuggestion(computed[idx]);
        } else {
          this.submitted.emit(this.value());
          this.isFocused.set(false);
        }
        break;
      }
      case 'Escape':
        this.isFocused.set(false);
        this.activeIndex.set(-1);
        this.inputRef()?.nativeElement.blur();
        break;
    }
  }

  selectSuggestion(s: SearchSuggestion): void {
    this.value.set(s.label);
    this.isFocused.set(false);
    this.activeIndex.set(-1);
    this.submitted.emit(s.label);
    this.suggestionSelected.emit(s);
  }

  clearValue(): void {
    this.value.set('');
    this.activeIndex.set(-1);
    this.cleared.emit();
    this.searched.emit('');
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.inputRef()?.nativeElement.focus());
    }
  }

  onFooterClick(): void {
    this.isFocused.set(false);
    this.footerClick.emit();
  }

  focus(): void {
    this.inputRef()?.nativeElement.focus();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    // Viewport resize invalidates the layout — close rather than reposition
    // with now-stale coordinates (dropdown-instruction.md §8). Reopens
    // naturally on the next focus/input.
    if (this.showDropdown()) this.resizeSuppressed.set(true);
  }

  private _calcPos(): void {
    const track = this.trackRef()?.nativeElement;
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const vh   = window.innerHeight;

    const spaceBelow = vh - rect.bottom - PANEL_MARGIN;
    const spaceAbove = rect.top - PANEL_MARGIN;
    const above = spaceBelow < PANEL_PREFERRED_HEIGHT && spaceAbove > spaceBelow;

    this.openAbove.set(above);

    const style: Record<string, string> = {
      position:  'fixed',
      zIndex:    '9999',
      left:      `${rect.left}px`,
      width:     `${rect.width}px`,
      maxHeight: `${Math.max(120, above ? spaceAbove : spaceBelow)}px`,
    };
    style[above ? 'bottom' : 'top'] = above
      ? `${vh - rect.top + PANEL_GAP}px`
      : `${rect.bottom + PANEL_GAP}px`;

    this.panelStyle.set(style);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  constructor() {
    // Mount/unmount the body-portaled panel whenever the dropdown's open
    // state changes — the reactive equivalent of Color Picker's toggle().
    effect(() => {
      if (this.showDropdown()) {
        if (!this.portalView) this._openPanel();
      } else if (this.portalView) {
        this._closePanel();
      }
    });
  }

  ngOnInit(): void {
    // Capture phase catches scroll from any scrollable ancestor, not just window.
    // ★ SSR: prerendered — no `window`. This component sits in the admin
    // template's topbar, which is why `/admin` was the route that failed.
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this._scrollHandler, { passive: true, capture: true });
    }
  }

  ngOnDestroy(): void {
    // ★ SSR: guard the STATEMENT — the timers and the panel teardown below
    // still have to run when the prerender destroys the component.
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this._closePanel();
  }

  // ── Body portal ──────────────────────────────────────────────────────────

  private _openPanel(): void {
    // ★ SSR: reached from a constructor `effect`, and effects DO flush during a
    // prerender. A body-portaled dropdown has nothing to attach to on a server,
    // and the panel opens on hydration anyway.
    if (typeof document === 'undefined') return;
    if (!this.panelTpl) return;
    this._calcPos();

    this.portalEl = document.createElement('div');
    this.portalEl.className = 'sv-search-portal';

    this.portalView = this.panelTpl.createEmbeddedView({});
    this.appRef.attachView(this.portalView);
    // Render BEFORE the nodes reach the document: an unstyled panel inserted
    // into <body> grows the page for a tick, which queues a scroll event that
    // this component's own scroll handler then acts on. See
    // scripts/fix-portal-insertion-order.mjs.
    this.portalView.detectChanges();
    this.portalView.rootNodes.forEach((n: Node) => this.portalEl!.appendChild(n));
    document.body.appendChild(this.portalEl);
  }

  private _closePanel(): void {
    if (this.portalView) {
      this.appRef.detachView(this.portalView);
      this.portalView.destroy();
      this.portalView = null;
    }
    this.portalEl?.remove();
    this.portalEl = null;
  }
}
