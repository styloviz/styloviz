import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  EmbeddedViewRef,
  HostListener,
  inject,
  input,
  booleanAttribute,
  model,
  OnDestroy,
  OnInit,
  output,
  signal,
  TemplateRef,
  ViewChild,
  viewChild,
} from '@angular/core';
import {
  svStackedPopup,
  createDebouncer,
  SvErrorShellComponent,
  SvStaleDirective,
  type SvDataError, SvSpinnerArcComponent,
  svUniqueId,
} from '@styloviz/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { forwardRef } from '@angular/core';
import { SvFieldErrorComponent, createFieldError, type SvServerError } from '@styloviz/core';
import { svHighlightSegments, type SvHighlightSegment } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

export type AutocompleteSize    = 'sm' | 'md' | 'lg';
export type AutocompleteVariant = 'default' | 'filled' | 'ghost';

export interface AutocompleteOption {
  readonly value: string;
  readonly label: string;
  readonly sublabel?: string;
  /** Name of an icon in `@styloviz/icons` (was a raw SVG path). */
  readonly icon?: string;
  readonly group?: string;
  readonly disabled?: boolean;
}

/** Gap between trigger edge and panel (px). */
const GAP = 4;
/** Floor for the clamped panel height — below this it scrolls internally. */
const MIN_PANEL_H = 160;
/** Minimum distance the panel keeps from any viewport edge (px). */
const MARGIN = 8;
/** Approximate panel height for flip calculation (px). */
const PANEL_H = 300;

@Component({
  selector: 'sv-autocomplete',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvIconComponent, FormsModule,
    NgTemplateOutlet,
    SvErrorShellComponent, SvFieldErrorComponent, SvSpinnerArcComponent,
    SvStaleDirective],
  templateUrl: './autocomplete.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvAutocompleteComponent),
      multi: true,
    },
  ],
})
export class SvAutocompleteComponent implements OnInit, OnDestroy, ControlValueAccessor {
  private readonly host   = inject(ElementRef<HTMLElement>);
  private readonly appRef = inject(ApplicationRef);

  /** Options to filter and choose from (supports groups, sublabels, icons). */
  options       = input.required<readonly AutocompleteOption[]>();
  /** Selected value (two-way). */
  value         = model<string>('');
  /** Placeholder shown when empty. @default 'Search…' */
  placeholder   = input<string>('Search…');
  /** Field size: sm, md or lg. @default 'md' */
  size          = input<AutocompleteSize>('md');
  /** Visual variant. @default 'default' */
  variant       = input<AutocompleteVariant>('default');
  /** Disable the field. @default false */
  disabled      = input<boolean>(false);
  /** Accessible label for the field. */
  label         = input<string>('');
  /** Show a clear (×) button when a value is selected. @default true */
  clearable     = input<boolean>(true);
  /**
   * Maximum suggestions rendered at once.
   *
   * ⚠️ **IT IS A HARD BOUNDARY AND IT USED TO BE A SILENT ONE** (`FI-01-I2`).
   *    A query matching 500 options showed eight, offered eight to the
   *    keyboard, and said nothing at all about the other 492 — so a user whose
   *    entry was 300th in the list concluded it was not there. The panel now
   *    discloses the truncation; see `truncationNote`.
   *
   * @default 8
   */
  maxItems      = input<number>(8);

  /**
   * How many results exist in total, when the component cannot know.
   *
   * With `serverSide` the supplied `options` are already one page of a larger
   * answer, so counting the array understates it. A host that knows the real
   * total passes it here and the disclosure reads "8 of 4,312" instead of
   * "8 of 20". Ignored without `serverSide`, where the array IS everything.
   *
   * @default null
   */
  totalCount    = input<number | null>(null);
  /** Render results in labelled sections using each option's `group`. @default false */
  grouped       = input<boolean>(false);
  /** Show a loading state (e.g. while fetching async results). @default false */
  loading       = input<boolean>(false);
  /**
   * The options on screen answer an **older** query — a newer request is still
   * in flight.
   *
   * Distinct from `loading`, which cannot separate the two cases it covers: the
   * first fetch (nothing on screen — show a skeleton) and a refinement of
   * results already visible (keep them, and say they are provisional). Blanking
   * the panel on the second is the most jarring thing a combobox can do;
   * showing the old list with no indication is a quiet lie.
   *
   * Bind `svSuggestController(...).stale` from `@styloviz/data`, or
   * `createRequestGuard().stale` from `@styloviz/core`. The results dim and
   * report `aria-busy` while staying fully interactive.
   * @default false
   */
  stale         = input(false, { transform: booleanAttribute });
  /** Text shown when no options match. @default 'No results found' */
  noResultsLabel = input<string>('No results found');

  // ── Remote options ──────────────────────────────────────────────────────────

  /**
   * Let the server do the matching. The supplied `options` are shown exactly as
   * given — filtering them again hides entries the server matched on fields the
   * component cannot see.
   * @default false
   */
  serverSide    = input<boolean>(false);

  /** Delay before `inputChange` fires, in ms. `0` emits immediately. @default 300 */
  debounceMs    = input<number>(300);

  /**
   * Characters required before a lookup is sent. Below this the panel says so
   * instead of showing a misleading "No results found".
   * @default 0
   */
  minChars      = input<number>(0);

  /** Failure loading the options, rendered inside the panel. @default null */
  error         = input<SvDataError | string | null>(null);
  /**
   * Name of an icon in `@styloviz/icons`, e.g. `'search'`.
   *
   * This used to be a raw `<path d="…">` string. That put SVG geometry in
   * every consumer's config and skipped the library's sizing, stroke and
   * dark-mode handling — pass a name instead.
   */
  icon          = input<string>('search');

  /** Emitted with the chosen option. */
  selected    = output<AutocompleteOption>();
  /** Emitted when the selection is cleared. */
  cleared     = output<void>();
  /** Emitted on every query change (debounce upstream for async sources). */
  inputChange = output<string>();
  /** The host should re-run the failed lookup. */
  retry       = output<void>();

  readonly open         = signal(false);
  readonly query        = signal('');
  readonly highlightIdx = signal(-1);

  /** Flip/align state — same pattern as SvDatePickerComponent. */
  readonly openAbove  = signal(false);
  readonly alignRight = signal(false);

  /**
   * Inline style object applied to the portal panel.
   * Uses position:fixed with exact viewport coords so the panel
   * escapes all parent overflow and transform containment.
   */
  readonly panelStyle = signal<Record<string, string>>({});

  // ── Portal state ──
  private portalEl: HTMLElement | null = null;
  /**
   * On the overlay stack while open (`X-4`, `OF-09-I1`): without it a modal
   * this popup sits in stays "topmost", and one Escape closes both.
   */
  protected readonly _stackedPopup = svStackedPopup({
    open: () => this.open(),
    element: () => this.portalEl,
  });
  private portalView: EmbeddedViewRef<object> | null = null;

  /**
   * Capture-phase scroll listener — fires for ANY scrollable ancestor,
   * not just the window. Recalculates the panel position each frame so
   * the panel tracks the trigger during page or container scroll.
   */
  private _rafId: number | null = null;
  private readonly _scrollHandler = (): void => {
    if (!this.open()) return;
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (this.open()) {
        this._calcPos();
        this.portalView?.detectChanges();
      }
    });
  };

  /** The ng-template that holds the dropdown panel markup. */
  @ViewChild('panelTpl', { read: TemplateRef })
  private readonly panelTpl!: TemplateRef<object>;

  readonly _uid = svUniqueId('sv-ac');

  // ── ControlValueAccessor ──
  private _onChange: (v: string) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);
  /** Merged disabled — the `[disabled]` input OR a disabled parent FormControl. */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  writeValue(v: string): void {
    this.value.set(v ?? '');
    // Reflect the matching option's label in the text field when possible.
    const match = this.options()?.find(o => o.value === v);
    this.query.set(match ? match.label : (v ?? ''));
  }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this._formDisabled.set(isDisabled); }

  /** DOM id for an option row (aria-activedescendant). */
  optionId(i: number): string { return `${this._uid}-opt-${i}`; }
  /** id of the highlighted option, or null. */
  readonly activeDescendantId = computed<string | null>(() =>
    this.open() && this.highlightIdx() >= 0 ? this.optionId(this.highlightIdx()) : null
  );
  /** Accessible name for the input — label, falling back to placeholder. */
  readonly accessibleName = computed(() => this.label() || this.placeholder());

  private inputRef = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  /** Debounced query — what `inputChange` is built from. */
  private readonly debouncedQuery = createDebouncer('', {
    delayMs: this.debounceMs,
    destroyRef: inject(DestroyRef),
  });

  /**
   * Last term handed to the host. Seeded with `''` so the effect's first run,
   * before the user has typed, does not fire a lookup for an empty box.
   */
  private lastQuery = '';

  /** True when the user has typed, but not enough to look anything up yet. */
  readonly belowMinChars = computed(() => {
    const min = this.minChars();
    return min > 0 && this.query().trim().length < min;
  });

  /** Panel copy while the user is still short of `minChars`. */
  readonly minCharsHint = computed(() =>
    `Type ${this.minChars()} character${this.minChars() === 1 ? '' : 's'} to search`);

  /**
   * Everything that matched, before `maxItems` cuts it down.
   *
   * Split out from `filtered` so the panel can say how much it is not showing
   * — which is `FI-01-I2`, and which is impossible once the slice has happened.
   */
  readonly matched = computed(() => {
    // With `serverSide`, the supplied options ARE the answer to the query.
    const q = this.serverSide() ? '' : this.query().toLowerCase().trim();
    if (!q) return this.options();
    return this.options()
      .filter(o => !o.disabled && (
        o.label.toLowerCase().includes(q) ||
        o.sublabel?.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
      ));
  });

  readonly filtered = computed(() => this.matched().slice(0, this.maxItems()));

  /**
   * How many matches exist, counting what the server says it has.
   *
   * `totalCount` wins under `serverSide` because the array is one page there;
   * a host that does not supply one gets the page length, which is the honest
   * answer to "how many do I have".
   */
  readonly matchCount = computed(() => {
    const total = this.totalCount();
    if (this.serverSide() && total !== null && total >= 0) return total;
    return this.matched().length;
  });

  /** How many matches the panel is not showing. */
  readonly hiddenCount = computed(() => Math.max(0, this.matchCount() - this.filtered().length));

  /** Whether the list on screen is a truncation of a longer one. */
  readonly isTruncated = computed(() => this.hiddenCount() > 0);

  /**
   * What the panel says about the results it is not showing.
   *
   * ★★★ NOT AN `aria-setsize` PROBLEM, WHICH IS WHAT IT LOOKS LIKE FIRST. The
   *     unrendered options are genuinely unreachable — no key gets to them — so
   *     declaring a set size of 500 would promise items that do not exist in
   *     the document. That is worse than saying nothing: a screen-reader user
   *     would be told there are 500 and find 8.
   *
   *     What is missing is the *disclosure*, in words, for everyone.
   */
  readonly truncationNote = computed(() => {
    if (!this.isTruncated()) return '';
    const shown = this.filtered().length.toLocaleString();
    const total = this.matchCount().toLocaleString();
    // "Keep typing" is the actionable half, and it is only true when the
    // component is doing the filtering — with `serverSide` the host decides
    // what a narrower query returns.
    const advice = this.serverSide() ? '' : ' — keep typing to narrow';
    return `Showing ${shown} of ${total}${advice}`;
  });

  /**
   * `filtered()` bucketed into sections by `group`, preserving each option's
   * flat index so keyboard navigation and `aria-activedescendant` stay correct.
   * Only consumed by the template when `grouped()` is true.
   */
  readonly groupedFiltered = computed<
    { label: string | null; rows: { opt: AutocompleteOption; index: number }[] }[]
  >(() => {
    const buckets = new Map<string, { opt: AutocompleteOption; index: number }[]>();
    const order: string[] = [];
    this.filtered().forEach((opt, index) => {
      const key = opt.group ?? '';
      let bucket = buckets.get(key);
      if (!bucket) { bucket = []; buckets.set(key, bucket); order.push(key); }
      bucket.push({ opt, index });
    });
    return order.map(key => ({ label: key || null, rows: buckets.get(key)! }));
  });

  // ── Lifecycle ──

  ngOnInit(): void {
    // Capture phase catches scroll from any scrollable ancestor, not just window.
    // ★ SSR: this hook runs during a prerender, where there is no `window`
    // or `document`. A scroll listener is a browser-only affordance, so
    // skipping it server-side loses nothing.
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this._scrollHandler, { passive: true, capture: true });
    }
  }

  ngOnDestroy(): void {
    // ★ `ngOnDestroy` runs on the server too — a prerender destroys the
    // application after every route.
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this.destroyPortal();
  }

  // ── Position calculation ──

  private _calcPos(): void {
    const inputEl = this.inputRef()?.nativeElement ?? this.host.nativeElement;
    const rect = inputEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const above = spaceBelow < PANEL_H && spaceAbove > spaceBelow;
    // Panel matches input width — right-overflow check uses rect.right
    const right  = rect.right > vw;

    this.openAbove.set(above);
    this.alignRight.set(right);

    const style: Record<string, string> = {
      position: 'fixed',
      zIndex:   '9999',
      width:    `${rect.width}px`,
    };
    style[above ? 'bottom' : 'top'] = above
      ? `${vh - rect.top + GAP}px`
      : `${rect.bottom + GAP}px`;
    // Cap the height to the room actually available on the chosen side. Without
    // this, flipping ABOVE a trigger that sits near the top of the viewport puts
    // the panel's top edge off-screen (Date Picker Pro: y=-35).
    style['maxHeight'] = `${Math.max(MIN_PANEL_H, (above ? rect.top : vh - rect.bottom) - GAP - MARGIN)}px`;
    // Anchor to one viewport edge and cap the width to the distance from that
    // anchor to the opposite edge. A CSS `max-w` bounds SIZE, not POSITION — so
    // without this cap a far-edge-anchored panel still renders off-screen on a
    // narrow viewport (the bug that put Mega Menu's left edge at x=-220).
    const anchor = right ? Math.max(MARGIN, vw - rect.right) : Math.max(MARGIN, rect.left);
    style[right ? 'right' : 'left'] = `${anchor}px`;
    style['maxWidth'] = `${vw - anchor - MARGIN}px`;

    this.panelStyle.set(style);
  }

  // ── Global listeners ──

  @HostListener('document:mousedown', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this.open()) return;
    const t = e.target as Node;
    // A surface opened FROM this popup is not outside it (`X-4`).
    if (this._stackedPopup.isInsideHigherSurface(t)) return;
    if (this.host.nativeElement.contains(t)) return;
    if (this.portalEl?.contains(t)) return;
    this.close();
  }

  // On the DOCUMENT, not the host: this component renders its panel into
  // <body> and moves focus into it, so a key pressed while the panel is open
  // never passes through this element. Gated by `portal-host-escape`.
  @HostListener('document:keydown.escape')
  onEscape(): void {
    // Only the topmost surface acts on Escape (`X-4`).
    if (!this._stackedPopup.ownsEscape()) return;
    if (this.open()) this.close();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.open()) this.close();
  }

  // ── Public API ──

  private openPortal(): void {
    this._calcPos();

    if (this.portalEl) return; // already mounted

    if (!this.panelTpl) return;

    this.portalEl = document.createElement('div');
    this.portalEl.className = 'sv-ac-portal';

    this.portalView = this.panelTpl.createEmbeddedView({});
    this.appRef.attachView(this.portalView);
    // Render BEFORE the nodes reach the document: an unstyled panel inserted
    // into <body> grows the page for a tick, which queues a scroll event that
    // this component's own scroll handler then acts on. See
    // scripts/fix-portal-insertion-order.mjs.
    this.portalView.detectChanges();
    this.portalView.rootNodes.forEach((n: Node) => this.portalEl!.appendChild(n));
    document.body.appendChild(this.portalEl);

    this.open.set(true);
  }

  close(): void {
    this.destroyPortal();
    this.open.set(false);
  }

  constructor() {
    effect(() => {
      const term = this.debouncedQuery.value().trim();
      if (term === this.lastQuery) return;
      if (term.length > 0 && this.minChars() > 0 && term.length < this.minChars()) return;
      this.lastQuery = term;
      this.inputChange.emit(term);
    });
  }

  onInputChange(val: string): void {
    this.query.set(val);
    this.value.set(val);
    this.highlightIdx.set(-1);
    this.debouncedQuery.set(val);
    this._onChange(val);

    if (!this.open()) {
      this.openPortal();
    } else {
      // Recalc position in case input reflowed
      this._calcPos();
      // Force change detection on the already-mounted portal view
      this.portalView?.detectChanges();
    }
  }

  onFocus(): void {
    if (!this.open()) {
      this.openPortal();
    }
  }

  onKeydown(e: KeyboardEvent): void {
    const list = this.filtered();
    if (e.key === 'ArrowDown')  { e.preventDefault(); if (!this.open()) this.openPortal(); this.highlightIdx.update(i => Math.min(i + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); this.highlightIdx.update(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Home')  { if (this.open()) { e.preventDefault(); this.highlightIdx.set(0); } }
    else if (e.key === 'End')   { if (this.open()) { e.preventDefault(); this.highlightIdx.set(list.length - 1); } }
    else if (e.key === 'Enter') { e.preventDefault(); const h = this.highlightIdx(); if (h >= 0 && list[h]) this.pick(list[h]!); }
    else if (e.key === 'Escape') { this.close(); }
  }

  onBlur(): void { this._onTouched(); }

  pick(opt: AutocompleteOption): void {
    if (opt.disabled) return;
    this.query.set(opt.label);
    this.value.set(opt.value);
    this.close();
    this.highlightIdx.set(-1);
    this.selected.emit(opt);
    this._onChange(opt.value);
  }

  clear(): void {
    if (this.resolvedDisabled()) return;
    this.query.set('');
    this.value.set('');
    this.inputRef()?.nativeElement.focus();
    this.cleared.emit();
    this.debouncedQuery.set('');
    this._onChange('');
  }

  /**
   * The label split into runs that match the query and runs that do not, for
   * the template to wrap in `<mark>` itself.
   *
   * ── What this replaced, and why it mattered (`FI-01-I3`) ──────────────────
   *
   * ★★★ IT WAS `text.replace(re, '<mark …>$1</mark>')` BOUND TO `[innerHTML]`.
   *     The query was escaped for regex, so there was no injection through the
   *     query — but the LABEL was not escaped for HTML, and labels come from
   *     whatever supplies the options, which for a remote autocomplete is a
   *     server.
   *
   * ★★ ANGULAR'S SANITISER MADE THIS LOOK FINE, AND THAT IS WHY IT SURVIVED.
   *    `[innerHTML]` strips scripts and event handlers, so nothing executes and
   *    nothing in testing ever looked wrong. It does not strip markup: `<b>`,
   *    `<i>`, `<a href>` and `<img src>` all render. A suggestion API could
   *    restyle a row, slip a link into a list the user believes is data, or
   *    point an `<img>` at a host of its choosing — which collects every
   *    viewer's IP address and User-Agent as the list scrolls past, with no
   *    click and no visible artefact.
   *
   * ★★★ SO THE FIX IS NOT TO ESCAPE THE LABEL — IT IS TO STOP BUILDING HTML.
   *     With segments there is no HTML string for anything to be injected into:
   *     the template writes the `<mark>`, and the label arrives as an
   *     interpolated string that Angular escapes for free. Escaping before the
   *     `replace` would also have worked and is worse — it leaves a hand-built
   *     HTML string one careless edit from being wrong again, and it breaks the
   *     highlight for anyone searching `&`, which by then sits inside `&amp;`.
   *
   * 🔺 `sv-tree-view` AND `sv-command-palette` HAD ALREADY DONE THIS CORRECTLY,
   *    each with its own copy and a comment saying "Safe: no innerHTML". The
   *    reason this component could get it wrong is that the right answer lived
   *    in two packages nothing could import from. It is `@styloviz/core`'s now.
   */
  highlightSegments(text: string): readonly SvHighlightSegment[] {
    return svHighlightSegments(text, this.query());
  }

  readonly inputClass = computed(() => {
    const s: Record<AutocompleteSize, string> = {
      sm: 'h-8 px-3 text-xs rounded-lg',
      md: 'h-10 px-3 text-sm rounded-xl',
      lg: 'h-12 px-4 text-base rounded-xl',
    };
    const v: Record<AutocompleteVariant, string> = {
      default: 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
      filled:  'border border-transparent bg-gray-100 dark:bg-gray-800',
      ghost:   'border border-transparent bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50',
    };
    const focus = this.open()
      ? 'border-primary-500 ring-2 ring-primary-400/25 dark:border-primary-400'
      : '';
    return `w-full pr-8 outline-none transition-all duration-150 pl-9
      text-gray-900 placeholder-gray-500 dark:text-gray-100 dark:placeholder-gray-400
      disabled:cursor-not-allowed disabled:opacity-50
      ${s[this.size()]} ${v[this.variant()]} ${focus}`;
  });

  // ── Portal lifecycle ──

  private destroyPortal(): void {
    if (this.portalView) {
      this.appRef.detachView(this.portalView);
      this.portalView.destroy();
      this.portalView = null;
    }
    this.portalEl?.remove();
    this.portalEl = null;
  }

  // ── Validation error ─────────────────────────────────────────────────────
  //
  // Distinct from this component's `error` input, which reports a failed
  // SUGGESTION LOOKUP and belongs inside the panel. This is the form's verdict
  // on the value, and belongs under the control where a form error is read.

  /** Client-side validation message. */
  errorMessage = input<string>('');
  /** A rejection reported by the server about this value. Self-expiring. */
  serverError = input<SvServerError>(null);

  protected readonly fieldError = createFieldError(this.value, this.serverError, this.errorMessage);
  protected readonly validationErrorId = svUniqueId('sv-autocomplete-error');

}
