import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  untracked,
  linkedSignal,
  ElementRef,
  EmbeddedViewRef,
  HostListener,
  inject,
  input,
  model,
  OnDestroy,
  OnInit,
  output,
  signal,
  TemplateRef,
  ViewChild,
  forwardRef,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  svStackedPopup,
  svApplyPastedList,
  svDescribedBy,
  svPasteListSummary,
  svSplitPastedList,
  type SvPasteListResult,
  svUniqueId,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

export type TagInputSize = 'sm' | 'md' | 'lg';

export interface TagOption {
  readonly value: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly disabled?: boolean;
  /**
   * Set by the component when a selected `value` matches no supplied option.
   *
   * ★★ NOT SOMETHING A HOST PROVIDES. It is how the component says "I am
   *    showing you an id because I was given no name for it" — previously the
   *    id was shown as if it WERE the name, with nothing to distinguish them.
   */
  readonly unresolved?: boolean;
}

export interface TagInputChangeEvent {
  readonly values: string[];
  readonly tags: TagOption[];
}

/**
 * SvTagInputComponent (Free) — Default variant only.
 * Upgrade to @styloviz-pro/tag-input for 8 variants including with-avatar,
 * grouped, creatable, with-colors, token-limit, async-search, and inline.
 *
 * The options panel is rendered through a true body portal (appended to
 * `document.body`) so it escapes every `overflow`/`transform` ancestor and can
 * never be clipped or mispositioned. Positioning tracks the trigger through
 * scroll on any ancestor and stays inside the viewport.
 */
@Component({
  selector: 'sv-tag-input',
  standalone: true,
  imports: [SvIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tag-input.component.html',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SvTagInputComponent), multi: true },
  ],
})
export class SvTagInputComponent implements OnInit, OnDestroy, ControlValueAccessor {

  /** Current tags (two-way). */
  values      = model<string[]>([]);
  /** Suggestion options offered as the user types. */
  options     = input<TagOption[]>([]);
  /**
   * What "the same tag" means. Defaults to strict equality on `value`.
   *
   * ⚠️ FREE, NOT PRO (`FI-26-M1`). `check:parity` flagged it as an undeclared
   *    Pro-only member and was right to: knowing whether two values are the
   *    same tag is correctness, not a premium feature, and a free control that
   *    silently duplicates a selection is broken rather than merely basic.
   */
  compareWith = input<((a: string, b: string) => boolean) | null>(null);
  /** Field size: sm, md or lg. @default 'md' */
  size        = input<TagInputSize>('md');
  /** Field label. */
  label       = input('');
  /** Placeholder shown in the input. @default 'Add tags…' */
  placeholder = input('Add tags…');
  /** Helper text shown below the field. */
  hint        = input('');
  /** Error message; sets the field to an error state when present. */
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
    computation: () => untracked(() => this.values()),
  });

  /** `serverError`, but only while it still describes the current value. */
  protected readonly liveServerError = computed(() => {
    const e = this.serverError();
    if (!e) return '';
    if (this.values() !== this.serverErrorAnchor()) return '';
    return typeof e === 'string' ? e : e.message;
  });

  /** What the error slot actually renders. Server first, then client. */
  readonly resolvedError = computed(() => this.liveServerError() || this.errorMessage());

  /** Disable the field. @default false */
  disabled    = input(false);

  // ── ControlValueAccessor ─────────────────────────────────────────────────
  // ★ The docs and the gallery have always shown `formControlName` and
  //   `[(ngModel)]` on the FREE tag input, and only the Pro one implemented the
  //   interface — so the documented binding threw NG01203 ("No value accessor")
  //   and aborted the page's render (1.0 release, WebKit e2e). Same contract as
  //   `sv-tag-input-pro`: the control value is a `string[]`, a disabled control
  //   disables the field, and the control is touched when focus leaves it.

  private _onChange: (value: string[]) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);

  /** `[disabled]` OR a disabled form control. */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  writeValue(value: string[] | null): void {
    this.values.set(Array.isArray(value) ? [...value] : []);
  }
  registerOnChange(fn: (value: string[]) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    this._formDisabled.set(isDisabled);
    if (isDisabled) this.close();
  }
  /** Mark the field as required. @default false */
  required    = input(false);

  /** Emitted with the change (added/removed tag + full list). */
  readonly tagsChange = output<TagInputChangeEvent>();

  @ViewChild('fieldEl') private fieldRef!: ElementRef<HTMLElement>;
  @ViewChild('inputEl') private inputRef!: ElementRef<HTMLInputElement>;
  /** Panel markup — never rendered inline; instantiated into <body> on open. */
  @ViewChild('panelTpl', { read: TemplateRef })
  private readonly panelTpl!: TemplateRef<object>;

  readonly isOpen      = signal(false);
  readonly query       = signal('');
  readonly activeIndex = signal(-1);
  readonly focused     = signal(false);

  // ── ARIA ids (unique per instance so multiple fields don't collide) ──────────
  private readonly _baseId = svUniqueId('sv-tag');
  /** id of the options listbox (referenced by aria-controls). */
  readonly listboxId = `${this._baseId}-listbox`;
  /** Id of the visible label text, referenced by the combobox. */
  readonly labelId = `${this._baseId}-label`;
  /** DOM id for an option row at index `i`. */
  optionId(i: number): string { return `${this._baseId}-opt-${i}`; }
  /** id of the hint line under the field. */
  protected readonly hintId = `${this._baseId}-hint`;
  /** id of the validation message under the field. */
  protected readonly errorId = `${this._baseId}-error`;

  /**
   * Everything under the field that describes it, in reading order.
   *
   * ★ This control used to describe itself with **nothing at all** — the hint
   * and the validation message rendered as bare `<p>` elements with no ids and
   * no `aria-describedby` anywhere, so a screen-reader user was told neither
   * the instruction nor the rejection. Invisible to every gate, because there
   * was no wrong id to catch: there was no id.
   */
  protected readonly describedBy = computed<string | null>(() =>
    svDescribedBy({
      hint: !this.resolvedError() && !!this.hint() && this.hintId,
      error: !!this.resolvedError() && this.errorId,
      extra: this.pasteMessage() ? [this.pasteId] : [],
    }),
  );

  /** id of the partial-paste report. */
  protected readonly pasteId = `${this._baseId}-paste`;
  /** id of the active option, or null when nothing is highlighted. */
  readonly activeDescendantId = computed<string | null>(() =>
    this.isOpen() && this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : null
  );
  /** Accessible name for the input — label, falling back to the placeholder. */
  readonly accessibleName = computed<string>(() => this.label() || this.placeholder());

  readonly panelTop       = signal<number | null>(null);
  readonly panelBottom    = signal<number | null>(null);
  readonly panelLeft      = signal(0);
  readonly panelWidth     = signal(0);
  readonly panelMaxHeight = signal(320);

  private readonly host   = inject(ElementRef<HTMLElement>);
  private readonly appRef = inject(ApplicationRef);

  // ── Portal state ─────────────────────────────────────────────────────────────
  private portalEl:   HTMLDivElement | null           = null;
  /**
   * On the overlay stack while open (`X-4`, `OF-09-I1`): without it a modal
   * this popup sits in stays "topmost", and one Escape closes both.
   */
  protected readonly _stackedPopup = svStackedPopup({
    open: () => this.isOpen(),
    element: () => this.portalEl,
  });
  private portalView: EmbeddedViewRef<object> | null  = null;

  /** `compareWith`, or strict equality. One place, so every path agrees. */
  private readonly sameValue = computed<(a: string, b: string) => boolean>(
    () => this.compareWith() ?? ((a, b) => a === b),
  );

  /**
   * Selected options resolved from `values()`.
   *
   * ★★★ A VALUE WITH NO OPTION USED TO BECOME `{ value: 'u1', label: 'u1' }`,
   *     so a chip the user picked as "Alex Chen" silently relabelled itself to
   *     the raw id the moment the option left the list. The value is still
   *     KEPT — dropping it would remove the user's selection because a list
   *     refreshed — but it is now MARKED, so the chip can render as unknown
   *     rather than as a name.
   */
  readonly selectedTags = computed<TagOption[]>(() => {
    const same = this.sameValue();
    return this.values().map(v => {
      const found = this.options().find(o => same(o.value, v));
      return found ?? { value: v, label: v, unresolved: true };
    });
  });

  /** Values currently holding no matching option. */
  readonly unresolvedTags = computed<TagOption[]>(
    () => this.selectedTags().filter(t => t.unresolved === true),
  );

  /**
   * Labels that appear on more than one selected tag.
   *
   * ★★★ TWO OPTIONS WITH THE SAME LABEL AND DIFFERENT IDS BOTH SELECT, AND
   *     RENDER AS TWO IDENTICAL CHIPS — measured on the Pro twin as
   *     `Alex ChenAlex Chen`. The user cannot tell which is which and removing
   *     one is a coin flip: the control is correct about its data and useless
   *     to the person using it.
   */
  readonly ambiguousLabels = computed<ReadonlySet<string>>(() => {
    const seen = new Map<string, number>();
    for (const t of this.selectedTags()) {
      const key = t.label.toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  });

  /**
   * What a chip shows: the label, plus whatever tells it apart when it needs to.
   *
   * ⚠️ ONLY WHEN IT IS NEEDED. Showing every sublabel all the time makes the
   *    common case noisier to fix a case that is not happening.
   */
  tagDisplay(tag: TagOption): string {
    if (!this.ambiguousLabels().has(tag.label.toLowerCase())) return tag.label;
    return tag.sublabel ? `${tag.label} (${tag.sublabel})` : `${tag.label} (${tag.value})`;
  }

  /** Whether `value` is already a tag, by `compareWith`. */
  private _isSelected(value: string): boolean {
    const same = this.sameValue();
    return this.values().some(v => same(v, value));
  }

  /**
   * Options still on offer.
   *
   * ⚠️ BY `compareWith`, NOT A `Set` OF RAW VALUES (re-verified 2026-09-26).
   *    `FI-26-M1` claimed one `sameValue` fed every path; this one used
   *    `new Set(values())`, so with a case-insensitive comparator a held
   *    `'REACT'` left the `'react'` option on offer and a click added it again
   *    — a duplicate by the host's own definition of "the same tag".
   */
  readonly filteredOptions = computed<TagOption[]>(() => {
    const q = this.query().toLowerCase().trim();
    return this.options().filter(o =>
      !this._isSelected(o.value) &&
      (!q || o.label.toLowerCase().includes(q))
    );
  });

  readonly navigableList = computed<TagOption[]>(() => this.filteredOptions());

  readonly noResults = computed(() => this.filteredOptions().length === 0);

  readonly chipSizeClass = computed<string>(() => ({
    sm: 'h-5 gap-1 px-1.5 text-[10px]',
    md: 'h-6 gap-1 px-2 text-[11px]',
    lg: 'h-7 gap-1.5 px-2.5 text-xs',
  })[this.size()]);

  readonly fieldMinHeight = computed<string>(() => ({
    sm: 'min-h-[32px] px-2 py-1 gap-1',
    md: 'min-h-[42px] px-3 py-1.5 gap-1.5',
    lg: 'min-h-[50px] px-3.5 py-2 gap-2',
  })[this.size()]);

  readonly inputTextClass = computed<string>(() => ({
    sm: 'text-xs placeholder:text-xs',
    md: 'text-sm placeholder:text-sm',
    lg: 'text-sm placeholder:text-sm',
  })[this.size()]);

  // ── Capture-phase scroll listener with RAF throttling ────────────────────────
  // Fires for scroll on ANY ancestor (nested scroll containers included), unlike
  // a plain window/document scroll listener. Repositions the portaled panel so it
  // tracks the trigger, and manually change-detects the detached view.
  private _rafId: number | null = null;
  private readonly _scrollHandler = (): void => {
    if (!this.isOpen()) return;
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (this.isOpen()) {
        this._updatePanelPosition();
        this.portalView?.detectChanges();
      }
    });
  };

  ngOnInit(): void {
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
    this._detachPortal();
  }

  selectOption(opt: TagOption): void {
    if (opt.disabled || this.resolvedDisabled()) return;
    // Also reachable directly from a host — refuse a second copy of a held tag.
    if (this._isSelected(opt.value)) { this.query.set(''); return; }
    this.values.set([...this.values(), opt.value]);
    this.query.set('');
    this.activeIndex.set(-1);
    this._emitChange();
    setTimeout(() => this.inputRef?.nativeElement.focus());
  }

  removeTag(value: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.values.set(this.values().filter(v => !this.sameValue()(v, value)));
    this._emitChange();
  }

  clearAll(event?: MouseEvent): void {
    event?.stopPropagation();
    this.values.set([]);
    this._emitChange();
  }

  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(-1);
    if (!this.isOpen()) this.open();
  }

  onKeydown(event: KeyboardEvent): void {
    const nav = this.navigableList();
    const ai  = this.activeIndex();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.isOpen()) { this.open(); return; }
        this.activeIndex.set(Math.min(ai + 1, nav.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(Math.max(ai - 1, -1));
        break;
      case 'Enter':
        event.preventDefault();
        if (ai >= 0 && ai < nav.length) this.selectOption(nav[ai]);
        break;
      case 'Backspace':
        if (!this.query()) {
          const vals = this.values();
          if (vals.length) { this.values.set(vals.slice(0, -1)); this._emitChange(); }
        }
        break;
      case 'Escape': this.close(); break;
      case 'Tab':    this.close(); break;
    }
  }

  /**
   * A paste of several entries, handled as several entries (`FI-26-M3`).
   *
   * ★★★ PORTED FROM THE PRO TWIN ON RE-VERIFICATION (2026-09-26). The free
   *     control had no paste handler, so a pasted list landed in the query box
   *     as ONE string, matched nothing, and the panel said "No results found"
   *     about a list of perfectly valid names.
   *
   * Each entry is resolved against the option LABELS first (then values).
   * This control selects from `options` only, so an entry matching none is
   * refused as `invalid`, and a label shared by two options as `ambiguous` —
   * never resolved to whichever the array happened to end with (`FI-26-I1`).
   * A paste with no delimiter is left to the browser.
   */
  onPaste(event: ClipboardEvent): void {
    if (this.resolvedDisabled()) return;
    const text = event.clipboardData?.getData('text') ?? '';
    const entries = svSplitPastedList(text);
    if (entries.length < 2) return;   // an ordinary paste; let the browser have it
    event.preventDefault();

    const labelCounts = new Map<string, number>();
    const known = new Map<string, string>();
    for (const o of this.options()) {
      const key = o.label.toLowerCase();
      labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
      if (!known.has(key)) known.set(key, o.value);
    }
    const same = this.sameValue();
    const asValues = entries.map(e => known.get(e.toLowerCase()) ?? e);
    const ambiguousAt = new Set(
      entries.flatMap((e, i) => ((labelCounts.get(e.toLowerCase()) ?? 0) > 1 ? [asValues[i]] : [])),
    );

    const result = svApplyPastedList(asValues, {
      existing: this.values(),
      compare: same,
      ambiguous: (v) => ambiguousAt.has(v),
      validate: (v) => this.options().some(o => !o.disabled && same(o.value, v)),
    });

    if (result.accepted.length) {
      this.values.set([...this.values(), ...result.accepted]);
      this._emitChange();
    }
    this.query.set('');
    this.pasteReport.set(result.rejected.length ? result : null);
  }

  /** The last paste that did not go in whole, or `null`. */
  readonly pasteReport = signal<SvPasteListResult | null>(null);

  /** The sentence shown and announced after a partial paste. */
  readonly pasteMessage = computed<string>(() => {
    const r = this.pasteReport();
    return r ? svPasteListSummary(r, 'tag') : '';
  });

  /** Clear the partial-paste report. It describes a past event, not a state. */
  dismissPasteReport(): void { this.pasteReport.set(null); }

  focusInput(): void {
    if (this.resolvedDisabled()) return;
    this.inputRef?.nativeElement.focus();
    if (!this.isOpen()) this.open();
  }

  onInputFocus(): void { this.focused.set(true); if (!this.isOpen()) this.open(); }

  onInputBlur(): void {
    this.focused.set(false);
    setTimeout(() => {
      const active = document.activeElement;
      if (
        !this.host.nativeElement.contains(active) &&
        !this.portalEl?.contains(active)
      ) {
        this.close();
        // Focus has left the field and its panel — that is "touched".
        this._onTouched();
      }
    }, 150);
  }

  open(): void {
    if (this.resolvedDisabled()) return;
    this._updatePanelPosition();
    this.isOpen.set(true);
    this._attachPortal();
  }

  close(): void {
    this.isOpen.set(false);
    this.activeIndex.set(-1);
    this._detachPortal();
  }

  @HostListener('document:mousedown', ['$event'])
  onDocMousedown(event: MouseEvent): void {
    // A surface opened FROM this popup is not outside it (`X-4`).
    if (this._stackedPopup.isInsideHigherSurface(event.target)) return;
    if (!this.isOpen()) return;
    const t = event.target as Node;
    if (this.host.nativeElement.contains(t)) return;   // click on trigger / host
    if (this.portalEl?.contains(t))          return;   // click inside portaled panel
    this.close();
  }

  @HostListener('window:resize')
  onWindowResize(): void { if (this.isOpen()) this.close(); }

  private _updatePanelPosition(): void {
    const field = this.fieldRef?.nativeElement;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;
    const GAP    = 6;
    const MARGIN = 8;

    const spaceBelow = vh - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp     = spaceBelow < 240 && spaceAbove > spaceBelow;

    // Horizontal: match the field width, but clamp so the panel never leaves the
    // viewport — cap the width first (the field itself can be wider than a narrow
    // mobile viewport), then keep the left edge inside the margins.
    const width = Math.min(rect.width, vw - MARGIN * 2);
    let left    = rect.left;
    if (left + width > vw - MARGIN) left = vw - MARGIN - width;
    if (left < MARGIN)              left = MARGIN;

    this.panelLeft.set(left);
    this.panelWidth.set(width);

    if (openUp) {
      this.panelTop.set(null);
      this.panelBottom.set(vh - rect.top + GAP);
      this.panelMaxHeight.set(Math.max(120, spaceAbove));
    } else {
      this.panelTop.set(rect.bottom + GAP);
      this.panelBottom.set(null);
      this.panelMaxHeight.set(Math.max(120, spaceBelow));
    }
  }

  // ── Portal lifecycle ─────────────────────────────────────────────────────────
  private _attachPortal(): void {
    if (this.portalEl || !this.panelTpl) return;
    const el = document.createElement('div');
    el.className = 'sv-tag-input-portal';
    this.portalEl = el;

    const view = this.panelTpl.createEmbeddedView({});
    this.appRef.attachView(view);
    this.portalView = view;
    // Render BEFORE the nodes reach the document: an unstyled panel inserted
    // into <body> grows the page for a tick, which queues a scroll event that
    // this component's own scroll handler then acts on. See
    // scripts/fix-portal-insertion-order.mjs.
    view.detectChanges();
    (view.rootNodes as Node[]).forEach(n => el.appendChild(n));
    document.body.appendChild(el);
  }

  private _detachPortal(): void {
    if (this.portalView) {
      this.appRef.detachView(this.portalView);
      this.portalView.destroy();
      this.portalView = null;
    }
    this.portalEl?.remove();
    this.portalEl = null;
  }

  private _emitChange(): void {
    this.tagsChange.emit({ values: this.values(), tags: this.selectedTags() });
    this._onChange(this.values());
    this._onTouched();
  }
}
