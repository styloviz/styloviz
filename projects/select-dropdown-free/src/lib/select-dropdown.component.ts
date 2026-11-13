import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  effect,
  ElementRef,
  EmbeddedViewRef,
  forwardRef,
  HostListener,
  inject,
  input,
  linkedSignal,
  model,
  OnDestroy,
  output,
  signal,
  TemplateRef,
  untracked,
  ViewChild,
  viewChild,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { svIsRtl, svUniqueId } from '@styloviz/core/a11y';
import {
  createDebouncer,
  createRequestGuard,
  SvErrorShellComponent,
  type SvDataError,
  type SvSelectSource,
  SvStaleDirective,
} from '@styloviz/core/data';
import { svWarnOnce } from '@styloviz/core/dev';
import { SvSpinnerArcComponent } from '@styloviz/core/feedback';
import { svMergeSelectFeatures, SV_SELECT_FEATURE } from '@styloviz/core/forms';
import { svTextMatches, injectSvLabels, svFormatLabel, svLocale, SvLabelPipe } from '@styloviz/core/i18n';
import {
  createSheetMode,
  SV_SHEET_SAFE_AREA_PADDING,
  createPortalHost,
  svInlineAnchor,
  type SvPortalHost,
  svStackedPopup,
  createAnchorScrollGuard,
  type SvAnchorScrollGuard,
} from '@styloviz/core/overlay';
import { SvIconComponent } from '@styloviz/icons/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SV_SELECT_DROPDOWN_LABELS } from './select-dropdown-free.labels';

import { registerSelectDropdownIcons } from './select-dropdown.component.icons';
/** Scrolls within this window of opening are ignored by the close-on-scroll handler (ms). */
const SCROLL_CLOSE_GRACE_MS = 400;

export type SelectSize = 'sm' | 'md' | 'lg';
export type SelectVariant = 'default' | 'filled' | 'flushed';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  /**
   * Icon-library name shown before the label — e.g. `'user'`. Was `iconPath`,
   * a raw `<path d="…">`; a name resolves through the icon library so
   * `check:icons` catches a typo that a `d` string rendered as an empty box.
   */
  icon?: string;
  avatarUrl?: string;
  badge?: string;
  badgeColor?: 'gray' | 'blue' | 'green' | 'red' | 'yellow' | 'purple';
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

/**
 * SelectDropdown — A fully-featured, accessible select component for dashboards.
 *
 * Features:
 * - Single and multi-select modes via the `multiple` input
 * - Flat option list and grouped option list (or both together)
 * - Typeahead search with query filtering
 * - Keyboard navigation (↑ ↓ Enter Escape Tab) with scroll-into-view
 * - Chip display for multi-select (up to 3 visible, +N overflow badge)
 * - Clearable selection via an inline × button
 * - Avatar / icon / sublabel / badge per option row
 * - Max-selection cap (`maxSelected`) with disabled-state enforcement
 * - 3 sizes × 3 visual variants (default · filled · flushed)
 * - Full `ControlValueAccessor` integration — works with `FormControl` and `ngModel`
 * - `setDisabledState()` honours both `[disabled]` input and `formControl.disable()`
 * - Full dark-mode support
 * - Accessible: `role="combobox"`, `aria-expanded`, `aria-selected`, `aria-disabled`
 */
@Component({
  selector: 'sv-select-dropdown',
  standalone: true,
  imports: [
    NgClass,
    SvIconComponent,
    SvErrorShellComponent, SvSpinnerArcComponent,
    SvStaleDirective, SvLabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select-dropdown.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvSelectDropdownComponent),
      multi: true,
    },
  ],
})
export class SvSelectDropdownComponent implements ControlValueAccessor, OnDestroy {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerSelectDropdownIcons();

  /** @internal Accessible names — English unless `provideSvLabels({ selectDropdown })` says otherwise. */
  protected readonly labels = injectSvLabels('selectDropdown', SV_SELECT_DROPDOWN_LABELS);
  /** The kit's locale, for plural forms in composed labels. */
  private readonly labelLocale = svLocale();

  // ── Inputs ─────────────────────────────────────────────────────────────────
  /** Selected value(s) — string for single, string[] for multiple (two-way). */
  value        = model<string | string[]>('');
  /** Flat list of options. Use `groups` instead for sectioned lists. */
  options      = input<readonly SelectOption[]>([]);
  /** Grouped options with section labels. */
  groups       = input<SelectGroup[]>([]);
  /** Placeholder shown when nothing is selected. @default 'Select an option' */
  placeholder  = input<string>(this.labels.placeholder);
  /** Field label. */
  label        = input('');
  /** Helper text shown below the field. */
  hint         = input('');
  /** Error message; puts the field in an error state when set. */
  errorMessage = input('');

  /**
   * A validation failure reported by the **server** — the 422 that comes back
   * after submit, not something the client could have known.
   *
   * It is a separate input from `errorMessage` because it has a different
   * lifetime, not because it needs a second way to show a string. A server
   * error is a statement about *the value that was submitted*: the moment the
   * user edits the field it stops being true, and this input expires itself
   * rather than sitting there telling someone their new email is already taken.
   * `errorMessage` has no such expiry — it is the host's to clear.
   *
   * While live it outranks `errorMessage`: it is the more specific fact, and
   * it is the one the user has not seen yet.
   *
   * Typed structurally rather than as `SvDataError` so this stays dependency
   * free — an `SvDataError` satisfies it unchanged.
   * @default null
   */
  serverError = input<string | { readonly message: string } | null>(null);

  /**
   * The value `serverError` was reported against. Recomputed only when
   * `serverError` itself changes, so editing the field moves the value away
   * from the anchor and the error expires.
   */
  private readonly serverErrorAnchor = linkedSignal<
    string | { readonly message: string } | null,
    unknown
  >({
    source: this.serverError,
    computation: () => untracked(() => this.value()),
  });

  /** `serverError`, but only while it still describes the current value. */
  protected readonly liveServerError = computed(() => {
    const e = this.serverError();
    if (!e) return '';
    if (this.value() !== this.serverErrorAnchor()) return '';
    return typeof e === 'string' ? e : e.message;
  });

  /** What the error slot actually renders. Server first, then client. */
  readonly resolvedError = computed(() => this.liveServerError() || this.errorMessage());

  /** Field size: sm, md or lg. @default 'md' */
  size         = input<SelectSize>('md');
  /** Visual variant. @default 'default' */
  variant      = input<SelectVariant>('default');
  /** Allow selecting multiple options. @default false */
  multiple     = input(false);
  /** Show a clear (×) control. @default false */
  clearable    = input(false);
  /** Disable the field. @default false */
  disabled     = input(false);
  /**
   * The host is still resolving the *selected* value — fetching the entity a
   * saved id points at, say. The trigger shows a spinner, reports
   * `aria-busy` and does not open, so a user cannot pick against a value that
   * is about to change under them. The option list's own loading state comes
   * from `source` (`svSelectSource` from `@styloviz/core`); the two are OR-ed
   * in the panel.
   * @default false
   */
  loading      = input(false);

  /** Mark the field as required. @default false */
  required     = input(false);
  /** Show an "optional" tag next to the label. @default false */
  optionalTag  = input(false);
  /** Max selectable options in multiple mode (0 = unlimited). @default 0 */
  maxSelected  = input(0);
  /** Explicit id for the control (for external <label for>). */
  inputId      = input('');
  /**
   * Accessible name for the trigger when there is no visible `label`.
   * Use this instead of a native `aria-label` on the host element (which is
   * not a labelable role and would be an ARIA violation). Falls back to the
   * `placeholder` so the combobox always has an accessible name.
   */
  ariaLabel    = input('');
  /** Extra CSS classes for the control. */
  customClass  = input('');

  // ── Remote options ──────────────────────────────────────────────────────────
  //
  // A server-backed list is a `source` (below); these say what the trigger
  // shows while the host resolves the selected value.

  /**
   * The option matching the current `value`, for when its label lives on the
   * server and is not in `options` yet. Without it a picker restored from a
   * saved id shows the raw id until the user opens the panel.
   * @default null
   */
  selectedOption = input<SelectOption | null>(null);

  // ── Outputs ────────────────────────────────────────────────────────────────
  /** Emitted with the new selection (string or string[]). */
  selectionChange = output<string | string[]>();
  /** Emitted when the dropdown opens. */
  dropdownOpen    = output<void>();
  /** Emitted when the dropdown closes. */
  dropdownClose   = output<void>();

  /**
   * Below 640px, open the panel as a bottom sheet — full width, clear of the
   * home indicator and of the virtual keyboard the search box raises — instead
   * of anchoring it to the trigger, where a phone has no room beside it. The
   * kit's shared contract (`createSheetMode`, as `sv-dropdown-menu`). Off by
   * default, so an existing app does not change on a phone. @default false
   */
  sheetOnNarrow = input<boolean>(false);

  private readonly _sheet = createSheetMode({ enabled: () => this.sheetOnNarrow() });

  /** True while the panel is rendering as a bottom sheet. */
  readonly asSheet = computed(() => this._sheet.asSheet());
  /** The sheet's bottom offset — live, so it rides up with the virtual keyboard. */
  readonly sheetBottom = computed(() => `${this._sheet.keyboardInset()}px`);

  // ── The composed shape (`FI-23-M1`) ────────────────────────────────────────
  //
  // `docs/select-dropdown-split-adr.md`: search, windowing and bulk selection
  // are content children (`svSelectSearch`, `svSelectVirtual`, `svSelectBulk`)
  // and a server list is one adapter (`source`). Each setting resolves as
  // adapter → feature child → the built-in default.

  /**
   * Where the options come from — search, paging and async state as one object.
   *
   * Build it with `svSelectSource({ search, pageSize, minChars, debounceMs })`
   * from `@styloviz/core`. With a source set the component fetches on open,
   * searches as the user types, appends pages on "Load more" and retries a
   * failure itself — no host handler is involved.
   * @default null
   */
  source = input<SvSelectSource<SelectOption> | null>(null);

  /**
   * The feature children, found through `SV_SELECT_FEATURE` — never by class,
   * so this component depends on the interface and on no feature.
   */
  private readonly features = contentChildren(SV_SELECT_FEATURE, { descendants: true });
  private readonly feature = computed(() => svMergeSelectFeatures(this.features()));

  /** `searchable`, after `svSelectSearch`. */
  readonly resolvedSearchable = computed(() => this.feature().searchable ?? false);
  /** `searchPlaceholder`, after `svSelectSearch`. */
  readonly resolvedSearchPlaceholder = computed(
    () => this.feature().searchPlaceholder ?? this.labels.searchPlaceholder);
  /** `noResultsText`, after `svSelectSearch`. */
  readonly resolvedNoResultsText = computed(() => this.feature().noResultsText ?? this.labels.noResults);
  /** `loadingText`, after `svSelectSearch`. */
  readonly resolvedLoadingText = computed(() => this.feature().loadingText ?? this.labels.loading);
  /** `minChars`, after `source` and `svSelectSearch`. */
  readonly resolvedMinChars = computed(
    () => this.source()?.minChars ?? this.feature().minChars ?? 0);
  /** `debounceMs`, after `source` and `svSelectSearch`. */
  readonly resolvedDebounceMs = computed(
    () => this.source()?.debounceMs ?? this.feature().debounceMs ?? 300);
  /** The source has another page. */
  readonly resolvedHasMore = computed(() => this.source()?.hasMore() ?? false);
  /** The source is fetching its next page. */
  readonly resolvedLoadingMore = computed(
    () => this.source()?.loadingMore() ?? false);

  // ── Internal state ─────────────────────────────────────────────────────────
  isOpen           = signal(false);
  searchQuery      = signal('');

  /**
   * Debounced search term. Pairs with the request guard: debounce cuts the
   * number of requests, the guard makes the ones that do overlap land in the
   * right order — type "ab" then "abc" and the slower "ab" response must not
   * replace the newer results.
   */
  private readonly debouncedSearch = createDebouncer('', {
    delayMs: this.resolvedDebounceMs,
    destroyRef: inject(DestroyRef),
  });

  /** Exposed so a host can bind `loading` to it when it prefers. */
  readonly searchGuard = createRequestGuard();

  /** True when this component owns the fetch rather than the host. */
  readonly remote = computed(() => !!this.source());

  /**
   * The options the panel actually renders.
   *
   * Everything downstream — filtering, flattening, the virtual window, the
   * selected-option lookup — reads this rather than the `options` input, so a
   * remote source reaches all of them without a second code path.
   */
  readonly effectiveOptions = computed<readonly SelectOption[]>(() => {
    const source = this.source();
    return source ? source.options() : this.options();
  });

  /**
   * A list the server already searched must not be filtered again: the server
   * matched on fields the component cannot see, and client-side search only
   * ever looks at the page already downloaded. `svSelectSearch [serverSide]`
   * says so for a host-filtered list; a `source` implies it.
   */
  readonly resolvedServerSide = computed(
    () => (this.feature().serverSide ?? false) || this.remote());

  // The host's `loading` is OR-ed in: it may be resolving the *selected*
  // entity while the source is idle.
  readonly panelLoading = computed(() => this.loading() || (this.source()?.loading() ?? false));
  readonly panelStale   = computed(() => this.source()?.stale() ?? false);
  readonly panelError   = computed<SvDataError | string | null>(() => this.source()?.error() ?? null);

  /**
   * Last term handed to the host. Seeded with `''` so the effect's first run —
   * which happens on init, before the user has typed — does not fire a search
   * for an empty box.
   */
  private lastSearch = '';
  activeIndex      = signal(-1);
  isFocused        = signal(false);
  /** How many chips to render; 999 = uncapped (all visible). */
  visibleChipCount = signal<number>(999);

  // ── Panel portal style (set in computePanelPosition, consumed by the portal template) ──
  readonly panelStyle = signal<Record<string, string>>({});

  /** Tracks disabled state set programmatically via formControl.disable(). */
  private readonly _formDisabled = signal(false);

  /**
   * Merged disabled state — true when either the [disabled] input or the
   * parent FormControl is disabled. Use this everywhere instead of disabled().
   */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  /** Stable unique fallback id so label + ARIA associations always work. */
  private readonly _autoId = svUniqueId('sv-select');
  /** Effective id used by the combobox, label and ARIA references. */
  readonly resolvedId   = computed(() => this.inputId() || this._autoId);
  /** id of the listbox popup (referenced by aria-controls). */
  readonly listboxId    = computed(() => `${this.resolvedId()}-listbox`);
  /** id of the visible label (referenced by aria-labelledby). */
  readonly labelId      = computed(() => `${this.resolvedId()}-label`);
  /** id of the hint/error description (referenced by aria-describedby). */
  readonly describedById = computed(() => `${this.resolvedId()}-desc`);
  /** True when a hint or error description is rendered. */
  readonly hasDescription = computed(() => !!this.resolvedError() || !!this.hint());

  /** DOM id for an option row — used by aria-activedescendant. */
  optionDomId(value: string): string {
    return `${this.resolvedId()}-opt-${value.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  /** id of the currently keyboard-active option, or null. */
  readonly activeDescendantId = computed<string | null>(() => {
    const active = this.activeOption();
    return active ? this.optionDomId(active.value) : null;
  });

  @ViewChild('panelTpl', { read: TemplateRef })
  private panelTpl?: TemplateRef<object>;

  private searchRef      = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private triggerRef     = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private listRef        = viewChild<ElementRef<HTMLUListElement>>('listbox');
  private chipWrapperRef = viewChild<ElementRef<HTMLElement>>('chipWrapper');
  private host           = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private appRef         = inject(ApplicationRef);

  /** Container div appended to document.body while the panel is open. */
  private portalEl: HTMLElement | null = null;
  private portalHost: SvPortalHost | null = null;
  /**
   * On the overlay stack while open (`X-4`, `OF-09-I1`): without it a modal
   * this popup sits in stays "topmost", and one Escape closes both.
   */
  protected readonly _stackedPopup = svStackedPopup({
    open: () => this.isOpen(),
    element: () => this.portalEl,
  });
  /** Embedded view holding the panel template nodes. */
  private portalView: EmbeddedViewRef<object> | null = null;
  /** Capture-phase scroll handler — registered once, removed on destroy. */
  private _boundScrollClose!: (e: Event) => void;
  /** Timestamp of the last open(), for the scroll-close grace period. */
  private _scrollGuard!: SvAnchorScrollGuard;

  constructor() {
    effect(() => {
      const term = this.debouncedSearch.value().trim();
      if (term === this.lastSearch) return;
      // Below minChars there is nothing worth asking for, but an emptied box
      // must still reset the list — so '' is always allowed through.
      const min = this.resolvedMinChars();
      if (term.length > 0 && min > 0 && term.length < min) return;
      this.lastSearch = term;
      // `svSelectSearch (searchChange)` fires with a source set too: a host may
      // mirror the term into a URL or an analytics event.
      for (const feature of untracked(this.features)) feature.searchChanged?.(term);
      untracked(this.source)?.search(term);
    });

    // ── Dev guard: a fetched list needs `selectedOption` ─────────────────────
    effect(() => {
      if (!this.remote()) return;
      // Every fetched list is "whatever answers this term", so a valid
      // selection is routinely absent from it. Without `selectedOption` the
      // trigger reads the stale label for a value that is perfectly fine.
      if (this.hasValue() && this.selectedOptions().length === 0 && !this.selectedOption()) {
        svWarnOnce(
          'sv-select-dropdown:load-options-hydration',
          '[sv-select-dropdown] a value is selected that no fetched option resolves, and no '
          + '`selectedOption` was given — the trigger will show it as unavailable. With a '
          + '`source`, pass `selectedOption` so a selection missing from the current '
          + 'results is not mistaken for a deleted one.',
        );
      }
    });

    // When the selected values change in uncapped multi-mode, reset visible
    // count to all, then measure which chips actually fit after the next render.
    effect(() => {
      this.selectedValues(); // track
      if (this.multiple() && !this.maxSelected()) {
        this.visibleChipCount.set(999);
        setTimeout(() => this.measureVisibleChips());
      }
    });

    // Close only when the trigger has actually MOVED, not merely when something
    // emitted a scroll — see createAnchorScrollGuard for why those differ. The
    // grace window covers opening: focusing the in-panel search input makes a
    // short viewport scroll to reveal it, which really does move the trigger,
    // but the user did not ask for the panel to shut.
    this._scrollGuard = createAnchorScrollGuard({
      anchor:  () => this.triggerRef()?.nativeElement,
      portal:  () => this.portalEl,
      // A sheet points at nothing, so a scroll under it (iOS scrolls the page
      // when the keyboard opens) is not a reason to close it.
      isOpen:  () => this.isOpen() && !this.asSheet(),
      onMoved: () => this.closeDropdown(),
      graceMs: SCROLL_CLOSE_GRACE_MS,
    });
    this._boundScrollClose = this._scrollGuard.handler;
    // ★ Runs from the constructor, which executes during a prerender.
    if (typeof document !== 'undefined') {
      document.addEventListener('scroll', this._boundScrollClose, { capture: true, passive: true });
    }
  }

  // CVA callbacks
  private onChange: (v: string | string[]) => void = () => { /* replaced by registerOnChange */ };
  private onTouched: () => void = () => { /* replaced by registerOnTouched */ };

  // ── Flatten all options (groups + flat) ────────────────────────────────────
  allOptions = computed<SelectOption[]>(() => {
    const flat = this.effectiveOptions();
    const grouped = this.groups().flatMap(g => g.options);
    return [...flat, ...grouped];
  });

  // ── Filtered options / groups ──────────────────────────────────────────────
  filteredOptions = computed<readonly SelectOption[]>(() => {
    const q = this.resolvedServerSide() ? '' : this.searchQuery().trim();
    const opts = this.effectiveOptions();
    if (!q) return opts;
    return opts.filter(o => this.optionMatches(o, q));
  });

  filteredGroups = computed<SelectGroup[]>(() => {
    const q = this.resolvedServerSide() ? '' : this.searchQuery().trim();
    const grps = this.groups();
    if (!q) return grps;
    return grps
      .map(g => ({
        ...g,
        options: g.options.filter(o => this.optionMatches(o, q)),
      }))
      .filter(g => g.options.length > 0);
  });

  noResults = computed(() => this.filteredOptions().length === 0 && this.filteredGroups().length === 0);

  /**
   * The local search: label or sublabel, accent- and case-folded in the kit's
   * locale (`FI-01-I4`) — `jose` finds José, as in sv-autocomplete.
   */
  private optionMatches(o: SelectOption, q: string): boolean {
    const opts = { locale: this.labelLocale };
    return svTextMatches(o.label, q, opts) || svTextMatches(o.sublabel, q, opts);
  }

  // ── Flat navigable list (for keyboard nav) ─────────────────────────────────
  navigableOptions = computed<SelectOption[]>(() => [
    ...this.filteredOptions(),
    ...this.filteredGroups().flatMap(g => g.options),
  ]);

  // ── Selected option helpers ────────────────────────────────────────────────
  selectedValues = computed<string[]>(() => {
    const v = this.value();
    if (Array.isArray(v)) return v;
    return v ? [v] : [];
  });

  selectedOptions = computed<SelectOption[]>(() => this.withRecalled(this.resolveSelected()));

  /** Selected values resolved against the options and the hydration hint. */
  private resolveSelected(): SelectOption[] {
    const matched = this.allOptions().filter(o => this.selectedValues().includes(o.value));

    // A value restored from the server often has no matching option yet — the
    // list is fetched on open, or paged. Without the hydration input the
    // trigger would show the raw id until the user opened the panel.
    const hydrated = this.selectedOption();
    if (hydrated && this.selectedValues().includes(hydrated.value)
        && !matched.some(o => o.value === hydrated.value)) {
      return [hydrated, ...matched];
    }
    return matched;
  }

  /**
   * Options the user picked from a FETCHED list, kept while they stay selected.
   *
   * ★★★ WITH A `source` THE LIST IS "WHATEVER ANSWERS THIS TERM", so a pick
   *     made under one search is absent from the next one. `selectedOption`
   *     covers a single hydrated value, but a multi-select has no equivalent:
   *     pick "Ada" under `ada`, search `bob`, and the Ada chip used to vanish
   *     (and then read "Unavailable") although nothing was deleted. The
   *     component SAW the option when it was picked — that is "not in these
   *     results", not "not any more", so it remembers it. Local `options` are
   *     authoritative and are never recalled this way: a value dropped from
   *     them is genuinely stale.
   */
  private readonly _picked = signal<ReadonlyMap<string, SelectOption>>(new Map());

  /** Remember `opts` that are now selected, forgetting what no longer is. */
  private rememberPicked(opts: readonly SelectOption[], selected: readonly string[]): void {
    if (!this.remote()) return;
    const keep = new Set(selected);
    const next = new Map<string, SelectOption>();
    for (const [k, o] of this._picked()) if (keep.has(k)) next.set(k, o);
    for (const o of opts) if (keep.has(o.value)) next.set(o.value, o);
    this._picked.set(next);
  }

  /** Append remembered picks for selected values the current list lacks. */
  private withRecalled(resolved: SelectOption[]): SelectOption[] {
    const picked = this._picked();
    if (!picked.size) return resolved;
    const have = new Set(resolved.map(o => o.value));
    const recalled = this.selectedValues()
      .filter(v => !have.has(v))
      .map(v => picked.get(v))
      .filter((o): o is SelectOption => !!o);
    return recalled.length ? [...resolved, ...recalled] : resolved;
  }

  displayLabel = computed<string>(() => {
    const sel = this.selectedOptions();
    // ★★★ A VALUE THAT RESOLVES TO NOTHING MUST NOT RENDER AS THE PLACEHOLDER.
    //     The placeholder means "nothing is selected", and something is.
    if (!sel.length) return this.hasStaleValue() ? this.staleLabel() : '';
    if (this.multiple()) return '';
    return sel[0].label;
  });

  hasValue = computed(() => this.selectedValues().length > 0);

  // ── The stale-value policy (`FI-23-I2` / `FI-23-M2`) ──────────────────────
  //
  // ★★★ MEASURED ON THE PRO TWIN: THE CONTROL SHOWS THE PLACEHOLDER WHILE
  //     HOLDING A VALUE. Select `'a'` with the trigger reading "Apple", refresh
  //     `options` without `'a'`, and the trigger reads "Select an option" while
  //     `value()` is still `'a'`. The display says empty, the form says `a`.
  //
  //     Worse than "the policy is undefined": there IS a behaviour, and it is
  //     the one that misleads. A user reads the placeholder, concludes nothing
  //     is selected, and submits a value they believe they never chose.
  //
  // ⚠️ FREE, NOT PRO. A control whose display contradicts its value is broken
  //    rather than merely basic.

  /** `true` when a selected value matches no option and no hydration hint. */
  readonly hasStaleValue = computed<boolean>(() => {
    // ⚠️ NO `if (!hasValue()) return false` GUARD, and its absence is
    //    deliberate. One was written, and a fire-test proved it changed no
    //    test: with no value `selectedValues()` is `[]`, and `.some()` on an
    //    empty array is already `false`. A second check that nothing can
    //    distinguish from the first is the kind of line somebody later removes
    //    as dead — correctly — and then nobody remembers what it was for.
    const resolved = new Set(this.selectedOptions().map(o => o.value));
    return this.selectedValues().some(v => !resolved.has(v));
  });

  /** The selected values with nothing to show for them. */
  readonly staleValues = computed<string[]>(() => {
    const resolved = new Set(this.selectedOptions().map(o => o.value));
    return this.selectedValues().filter(v => !resolved.has(v));
  });

  /**
   * What the trigger says for a value that is no longer on offer.
   *
   * ⚠️ NOT THE RAW VALUE — an id displayed where a name belongs reads as a name
   *    somebody chose, which is `sv-tag-input`'s `FI-26-I1`.
   */
  readonly staleLabel = computed<string>(() => {
    const stale = this.staleValues();
    if (!stale.length) return '';
    return stale.length === 1 ? `Unavailable (${stale[0]})` : `${stale.length} unavailable`;
  });

  showClear = computed(() => this.clearable() && this.hasValue() && !this.resolvedDisabled() && !this.loading());

  // ── Overflow chip count ────────────────────────────────────────────────────
  visibleChips = computed<SelectOption[]>(() => {
    const sel = this.selectedOptions();
    // When maxSelected is set use legacy cap of 3; otherwise use measured count.
    const cap = this.maxSelected() > 0 ? 3 : this.visibleChipCount();
    return sel.slice(0, cap);
  });

  overflowCount = computed(() => {
    const total = this.selectedOptions().length;
    const cap   = this.maxSelected() > 0 ? 3 : this.visibleChipCount();
    return Math.max(0, total - cap);
  });

  // ── Max reached ───────────────────────────────────────────────────────────
  maxReached = computed(() => this.multiple() && this.maxSelected() > 0 && this.selectedValues().length >= this.maxSelected());

  // ── Trigger label ─────────────────────────────────────────────────────────
  triggerText = computed(() => {
    if (this.multiple()) return '';
    return this.displayLabel() || '';
  });

  // ── CSS helpers ───────────────────────────────────────────────────────────
  labelSizeClass = computed(() => ({
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  })[this.size()]);

  triggerClasses = computed(() => {
    const s = this.size();
    const v = this.variant();
    const err = !!this.resolvedError();
    const focus = this.isFocused();
    const dis = this.resolvedDisabled();
    const isFloat = false;

    const heights: Record<SelectSize, string> = isFloat
      ? { sm: 'min-h-12', md: 'min-h-14', lg: 'min-h-16' }
      : { sm: 'min-h-8',  md: 'min-h-10', lg: 'min-h-11' };
    const pads: Record<SelectSize, string> = isFloat
      ? { sm: 'px-2.5 pt-1 pb-1', md: 'px-3 pt-3 pb-2', lg: 'px-4 pt-3 pb-2' }
      : { sm: 'px-2.5 py-1', md: 'px-3 py-2', lg: 'px-4 py-2.5' };
    const text: Record<SelectSize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

    const base = [
      'relative flex w-full items-center gap-2 text-start transition-all duration-150',
      'disabled:cursor-not-allowed disabled:opacity-50', // sv-i18n-ignore: Tailwind classes
      heights[s], pads[s], text[s],
    ];

    if (v === 'flushed') {
      base.push(
        'rounded-none border-0 border-b bg-transparent px-0',
        err
          ? 'border-danger-500 dark:border-danger-400'
          : focus
            ? 'border-primary-500 dark:border-primary-400'
            : 'border-gray-300 dark:border-gray-600',
        'focus:outline-none'
      );
    } else if (v === 'filled') {
      base.push(
        'rounded-md border',
        'bg-gray-100 dark:bg-gray-800/60',
        err
          ? 'border-danger-400 dark:border-danger-500'
          : focus
            ? 'border-primary-500 ring-2 ring-primary-500/20 dark:border-primary-400 dark:ring-primary-400/20'
            : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600',
        'focus:outline-none'
      );
    } else {
      // default and floating — both use a bordered card style
      base.push(
        'rounded-md border bg-white dark:bg-gray-900',
        err
          ? 'border-danger-400 dark:border-danger-500 ring-1 ring-danger-400/30'
          : focus
            ? 'border-primary-500 ring-2 ring-primary-500/20 dark:border-primary-400 dark:ring-primary-400/20'
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600',
        'focus:outline-none'
      );
    }

    if (dis) base.push('bg-gray-50 dark:bg-gray-800/40');
    return base.join(' ');
  });

  iconSizeClass = computed(() => ({ sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' })[this.size()]);
  chevronSizeClass = computed(() => ({ sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-4 w-4' })[this.size()]);
  chipTextClass = computed(() => ({ sm: 'text-xs', md: 'text-xs', lg: 'text-sm' })[this.size()]);

  optionPadClass = computed(() => ({ sm: 'px-2.5 py-1.5', md: 'px-3 py-2', lg: 'px-4 py-2.5' })[this.size()]);
  optionTextClass = computed(() => ({ sm: 'text-xs', md: 'text-sm', lg: 'text-base' })[this.size()]);

  /**
   * Static color-class map for option badge chips.
   * `readonly` so the reference is stable; accessed directly in the template
   * as `badgeColorMap[opt.badgeColor ?? 'gray']` — no method call needed.
   */
  readonly badgeColorMap: Readonly<Record<string, string | undefined>> = {
    gray:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    blue:   'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
    green:  'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
    red:    'bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-300',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  };

  // ── Dropdown / keyboard ────────────────────────────────────────────────────
  openDropdown() {
    if (this.resolvedDisabled() || this.loading()) return;
    // Opening is a deliberate act, so it skips the debounce. The condition
    // stops it firing a request per open for a panel already answering the
    // empty box; `emptyReason() === 'no-data'` is the never-fetched case,
    // which `term()` alone cannot distinguish from a settled empty term.
    const source = this.source();
    if (source) source.open(this.searchQuery().trim());
    this.computePanelPosition();
    this._scrollGuard.capture();
    this.isOpen.set(true);
    this.activeIndex.set(-1);
    this.dropdownOpen.emit();
    if (this.panelTpl) {
      // Context-carrying host: dir, lang and a locally scoped theme reach the
      // panel (`X-7`); the DestroyRef takes it down even if teardown is skipped.
      this.portalHost = createPortalHost({
        origin: this.host.nativeElement,
        className: 'sv-sd-portal',
        label: 'select-dropdown',
        destroyRef: this.destroyRef,
      });
      this.portalEl = this.portalHost.element;
      this.portalView = this.panelTpl.createEmbeddedView({});
      this.appRef.attachView(this.portalView);
      // Render BEFORE the nodes reach the document: an unstyled panel inserted
      // into <body> grows the page for a tick, which queues a scroll event that
      // this component's own scroll handler then acts on. See
      // scripts/fix-portal-insertion-order.mjs.
      this.portalView.detectChanges();
      this.portalView.rootNodes.forEach((n: Node) => this.portalEl!.appendChild(n));
      this.portalHost.attach();
    }
    if (this.resolvedSearchable()) {
      setTimeout(() => this.searchRef()?.nativeElement.focus(), 30);
    }
  }

  closeDropdown() {
    // Abandon anything in flight — the response would land against a panel
    // nobody can see. `cancel`, not `clear`: the options stay, because
    // `selectedOptions()` reads them and wiping them would make a live
    // selection read as stale the moment the panel shut.
    this.source()?.cancel();
    this.destroyPortal();
    this.isOpen.set(false);
    this.searchQuery.set('');
    this.activeIndex.set(-1);
    this.isFocused.set(false);
    this.dropdownClose.emit();
  }

  toggleDropdown() {
    if (this.isOpen()) { this.closeDropdown(); } else { this.openDropdown(); }
  }

  ngOnDestroy(): void {
    this.destroyPortal();
    this._scrollGuard.destroy();
    // ★ `ngOnDestroy` runs on the server too — prerender destroys the app
    // after each route.
    if (typeof document !== 'undefined') {
      document.removeEventListener('scroll', this._boundScrollClose, { capture: true });
    }
  }

  private destroyPortal(): void {
    if (this.portalView) {
      this.appRef.detachView(this.portalView);
      this.portalView.destroy();
      this.portalView = null;
    }
    this.portalHost?.destroy();
    this.portalHost = null;
    this.portalEl = null;
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMousedown(e: MouseEvent) {
    // A surface opened FROM this popup is not outside it (`X-4`).
    if (this._stackedPopup.isInsideHigherSurface(e.target)) return;
    // A closed panel has nothing to dismiss. Without this the handler ran on
    // EVERY mousedown anywhere on the page and called closeDropdown(), which
    // emits `dropdownClose` and resets searchQuery/isFocused — so a host
    // listening for the panel closing heard it on every stray click.
    if (!this.isOpen()) return;
    const t = e.target as Node;
    if (this.host.nativeElement.contains(t)) return;
    if (this.portalEl?.contains(t)) return;
    this.closeDropdown();
  }

  // There is deliberately no `@HostListener('window:scroll')` here. One used to
  // sit alongside the capture-phase `_boundScrollClose` above and closed on any
  // scroll with no grace window and no movement check — which defeated the
  // SCROLL_CLOSE_GRACE_MS guard for exactly the case it was added for, since
  // the browser scrolling a focused input into view IS a window scroll. The
  // capture-phase listener already sees window scrolls, so this was pure
  // duplication that only ever fired earlier and less carefully.

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.isOpen()) return;
    // A sheet re-anchors: on a phone the virtual keyboard opening for the
    // search box IS a resize, and closing on it would make search unusable.
    if (this.asSheet()) { this.computePanelPosition(); return; }
    this.closeDropdown();
  }

  private computePanelPosition(): void {
    const trigger = this.triggerRef()?.nativeElement;
    if (!trigger) return;
    if (this.asSheet()) {
      // A sheet is attached to the bottom edge, full width, and sits on top of
      // the virtual keyboard; `top`/`left` are dropped rather than zeroed so it
      // cannot stretch between two edges.
      this.panelStyle.set({
        position:      'fixed',
        zIndex:        '9999',
        left:          '0px',
        right:         '0px',
        maxHeight:     '70vh',
        maxWidth:      '100vw',
        paddingBottom: SV_SHEET_SAFE_AREA_PADDING,
      });
      return;
    }
    const rect             = trigger.getBoundingClientRect();
    const vw               = window.innerWidth;
    const vh               = window.innerHeight;
    const MARGIN           = 8;
    const GAP              = 4;
    const PREFERRED_HEIGHT = 240;

    const spaceBelow = vh - rect.bottom - MARGIN;
    const spaceAbove = rect.top - MARGIN;
    const openUpward = spaceBelow < PREFERRED_HEIGHT && spaceAbove > spaceBelow;
    // Inline edge through the shared engine — the trigger's start edge, which
    // is its RIGHT edge under dir="rtl" (`X-7`). The panel matches the
    // trigger's width; it flips edge when the trigger sits within MARGIN of
    // the far viewport edge, so the panel is pinned to the edge it is near.
    const inline = svInlineAnchor({
      anchor: rect, panelWidth: rect.width + MARGIN, viewportWidth: vw, rtl: svIsRtl(trigger), margin: 0,
    });
    const maxHeight  = Math.max(120, openUpward ? spaceAbove : spaceBelow);

    const style: Record<string, string> = {
      position:  'fixed',
      zIndex:    '9999',
      width:     `${rect.width}px`,
      maxHeight: `${maxHeight}px`,
    };
    style[openUpward ? 'bottom' : 'top'] = openUpward
      ? `${vh - rect.top + GAP}px`
      : `${rect.bottom + GAP}px`;
    style[inline.edge] = `${inline.offset}px`;

    this.panelStyle.set(style);
  }

  /**
   * Measures the chip wrapper element to determine how many chips fit in one
   * row, then updates `visibleChipCount` accordingly. Called after render via
   * a `setTimeout` inside the `effect` so DOM positions are available.
   */
  private measureVisibleChips(): void {
    const wrapper = this.chipWrapperRef()?.nativeElement;
    if (!wrapper) return;
    const chips = Array.from(wrapper.querySelectorAll<HTMLElement>('[data-chip]'));
    if (!chips.length) { this.visibleChipCount.set(0); return; }

    const wrapperRight = wrapper.getBoundingClientRect().right;

    // Check if every chip fits inside the wrapper (no overflow)
    const allFit = chips.every(c => c.getBoundingClientRect().right <= wrapperRight + 1);
    if (allFit) {
      this.visibleChipCount.set(chips.length);
      return;
    }

    // Some chips overflow — find how many fit while leaving ~60 px for "+N more"
    const BADGE_RESERVE = 60;
    const availRight    = wrapperRight - BADGE_RESERVE;
    let   count         = 0;
    for (const chip of chips) {
      if (chip.getBoundingClientRect().right > availRight) break;
      count++;
    }
    this.visibleChipCount.set(Math.max(1, count));
  }

  onTriggerKeydown(e: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', ' ', 'Enter', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      if (!this.isOpen()) {
        this.openDropdown();
        this.activeIndex.set(0);
      } else {
        this.navigateList(e.key);
      }
    }
    if (e.key === 'Escape') this.closeDropdown();
    if (e.key === 'Tab') this.closeDropdown();
  }

  onSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); this.navigateList('ArrowDown'); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); this.navigateList('ArrowUp'); }
    if (e.key === 'Home')      { e.preventDefault(); this.navigateList('Home'); }
    if (e.key === 'End')       { e.preventDefault(); this.navigateList('End'); }
    if (e.key === 'Enter')     { e.preventDefault(); this.selectActive(); }
    if (e.key === 'Escape')    { this.closeDropdown(); this.triggerRef()?.nativeElement.focus(); }
  }

  /** Updates the search query and notifies listeners (for remote filtering). */
  setSearch(q: string): void {
    this.searchQuery.set(q);
    this.activeIndex.set(-1);
    this.debouncedSearch.set(q);
  }

  /** True when the user has typed, but not enough to search yet. */
  readonly belowMinChars = computed(() => {
    const min = this.resolvedMinChars();
    return min > 0 && this.searchQuery().trim().length < min;
  });

  /** Panel copy while the user is still short of `minChars`. */
  readonly minCharsHint = computed(() => {
    const min = this.resolvedMinChars();
    return svFormatLabel(this.labels.minCharsHint, { count: min, n: String(min) }, this.labelLocale);
  });

  /** Re-run the failed load — the source retries itself. */
  onRetry(): void {
    this.source()?.reload();
  }

  /** Fetch the next page of options from the source. */
  onLoadMore(): void {
    this.source()?.loadMore();
  }

  private navigateList(key: string) {
    const opts = this.navigableOptions().filter(o => !o.disabled);
    if (!opts.length) return;
    const cur = this.activeIndex();
    let next = cur;
    if (key === 'ArrowDown' || key === ' ') next = cur < opts.length - 1 ? cur + 1 : 0;
    if (key === 'ArrowUp')   next = cur > 0 ? cur - 1 : opts.length - 1;
    if (key === 'Home')      next = 0;
    if (key === 'End')       next = opts.length - 1;
    if (key === 'Enter')     { this.selectActive(); return; }
    this.activeIndex.set(next);
    this.scrollActiveIntoView();
  }

  private selectActive() {
    const opts = this.navigableOptions().filter(o => !o.disabled);
    const idx = this.activeIndex();
    if (idx >= 0 && idx < opts.length) this.selectOption(opts[idx]);
  }

  private scrollActiveIntoView() {
    setTimeout(() => {
      const list = this.listRef()?.nativeElement;
      if (!list) return;
      const active = list.querySelector('[data-active="true"]') as HTMLElement | null;
      active?.scrollIntoView({ block: 'nearest' });
    });
  }

  selectOption(opt: SelectOption) {
    if (opt.disabled) return;
    if (this.multiple()) {
      const current = [...this.selectedValues()];
      const idx = current.indexOf(opt.value);
      if (idx > -1) {
        current.splice(idx, 1);
      } else {
        if (this.maxReached()) return;
        current.push(opt.value);
      }
      this.rememberPicked([opt], current);
      this.value.set(current);
      this.onChange(current);
      this.selectionChange.emit(current);
    } else {
      this.rememberPicked([opt], [opt.value]);
      this.value.set(opt.value);
      this.onChange(opt.value);
      this.selectionChange.emit(opt.value);
      this.closeDropdown();
      this.triggerRef()?.nativeElement.focus();
    }
  }

  removeChip(value: string, e: MouseEvent) {
    e.stopPropagation();
    if (this.resolvedDisabled()) return;
    const current = this.selectedValues().filter(v => v !== value);
    this.value.set(current);
    this.onChange(current);
    this.selectionChange.emit(current);
  }

  /**
   * Drop every selected value that no longer resolves to an option — the
   * remove button on the multi-select's "Unavailable" chip.
   */
  removeStale(e: MouseEvent) {
    e.stopPropagation();
    if (this.resolvedDisabled()) return;
    const stale = new Set(this.staleValues());
    const current = this.selectedValues().filter(v => !stale.has(v));
    this.value.set(current);
    this.onChange(current);
    this.selectionChange.emit(current);
  }

  clearAll(e: MouseEvent) {
    e.stopPropagation();
    const empty = this.multiple() ? [] : '';
    this.value.set(empty);
    this.onChange(empty);
    this.selectionChange.emit(empty);
  }

  /**
   * The currently keyboard-active option, or `null` when nothing is active.
   * Computed once per change-detection cycle so the template can do a cheap
   * identity check (`opt === activeOption()`) instead of calling the O(n)
   * `isActive(opt)` method for every option row.
   */
  activeOption = computed<SelectOption | null>(() => {
    const opts = this.navigableOptions().filter(o => !o.disabled);
    const idx  = this.activeIndex();
    return (idx >= 0 && idx < opts.length) ? opts[idx] : null;
  });

  isSelected(value: string): boolean {
    return this.selectedValues().includes(value);
  }

  /**
   * Index of `opt` in the SAME enabled-only list that `navigateList`,
   * `selectActive` and `activeOption` all index into — which is what the option
   * rows must publish on hover.
   *
   * They used to publish `navigableOptions().indexOf(opt)`, over the raw list
   * including disabled entries. With a disabled option anywhere above, the two
   * lists drift apart: hovering a row highlighted a DIFFERENT row, and Enter
   * then committed that other option. A disabled row returns -1 here, so
   * hovering one activates nothing — which is the correct answer, not an
   * accident.
   */
  activeIndexForOption(opt: SelectOption): number {
    return this.navigableOptions().filter(o => !o.disabled).indexOf(opt);
  }

  // ── Floating label helpers ────────────────────────────────────────────

  /**
   * The floating label is a Pro variant, and this is how the free build
   * declines it (`FI-23-I3`).
   *
   * ⚠️ NOT DEAD CODE, AND THE REASON IS NOT OBVIOUS. `check:parity` compares
   *    the twins' MARKUP as well as their API, so the free template has to keep
   *    the `@if (isFloating() && label())` branch — which means this component
   *    has to keep the members that branch binds. Pinning the flag to `false`
   *    declines the feature without letting the two templates diverge, which is
   *    what makes the gate able to prove they are the same component.
   *
   *    So `floatingLabelClasses` below is reachable by the free build's tests
   *    and never by its users. Its spec pins the class strings; what the label
   *    DOES is pinned in the Pro twin's own label spec, where it renders.
   */
  isFloating     = computed(() => false);
  labelIsFloated = computed(() => this.isOpen() || this.hasValue());

  floatingLabelClasses = computed<string>(() => {
    const floated = this.labelIsFloated();
    const err = !!this.resolvedError();
    const active = this.isFocused() || this.isOpen();

    const notFloatedLeft = 'start-3.5';
    const floatedLeft    = 'start-3';
    const leftClass  = floated ? floatedLeft : notFloatedLeft;
    const topClass   = floated ? '-top-px' : 'top-1/2';
    const textSize   = floated ? 'text-[0.7rem] leading-none' : this.labelSizeClass();
    const bg         = floated ? 'px-1 bg-white dark:bg-gray-900' : '';

    let color: string;
    if (floated && active) {
      color = err ? 'text-danger-500' : 'text-primary-600 dark:text-primary-400';
    } else if (floated) {
      color = err ? 'text-danger-500 dark:text-danger-400' : 'text-gray-500 dark:text-gray-400';
    } else {
      color = 'text-gray-500 dark:text-gray-400';
    }

    return [
      'absolute z-10 pointer-events-none select-none -translate-y-1/2',
      'transition-[top,left,right,font-size,color,padding,background-color] duration-200 ease-in-out',
      `${leftClass} ${topClass}`,
      textSize, bg, color,
    ].filter(Boolean).join(' ');
  });

  onFocus() { this.isFocused.set(true); }
  onBlur()  { this.onTouched(); }

  // ── ControlValueAccessor ───────────────────────────────────────────────────
  writeValue(v: string | string[]): void {
    this.value.set(v ?? (this.multiple() ? [] : ''));
  }
  registerOnChange(fn: (v: string | string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this._formDisabled.set(isDisabled); }

}
