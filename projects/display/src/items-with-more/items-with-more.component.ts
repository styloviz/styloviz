import {
  AfterViewInit,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  EmbeddedViewRef,
  HostListener,
  inject,
  input,
  NgZone,
  OnDestroy,
  OnInit,
  output,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { svStackedPopup, svUniqueId } from '@styloviz/core';


// ─── Types ────────────────────────────────────────────────────────────────────

export interface ItemsWithMoreItem {
  readonly label: string;
  readonly color?: string;
  /**
   * This item never collapses into the overflow.
   *
   * ★ Overflow collapses by POSITION, which silently assumes the list is
   * ordered by importance. It usually is not: an "Overdue" or "Blocked" chip
   * appended to a row of eight labels is the one the reader needed, and it is
   * the first thing a narrow container hides. Pinning takes that item out of
   * the positional race.
   */
  readonly pinned?: boolean;
  readonly [key: string]: unknown;
}

export type MoreVariant = 'badge' | 'chip' | 'text' | 'inline';

/** Whether this item asked never to be collapsed. */
function isPinned(item: string | ItemsWithMoreItem): boolean {
  return typeof item !== 'string' && item.pinned === true;
}

/**
 * Split a list into what is shown and what collapses, keeping pinned items on
 * the visible side and preserving the host's original order in both halves.
 *
 * ★ When more items are pinned than `max` allows, EVERY pinned item is still
 * shown and the row wraps. The alternative — dropping one — would make `pinned`
 * a suggestion, and a flag that means "unless it is inconvenient" is worse than
 * no flag at all, because the host stops checking.
 */
export function svSplitOverflow<T extends string | ItemsWithMoreItem>(
  items: readonly T[],
  max: number,
): { readonly visible: T[]; readonly overflow: T[] } {
  const keep = new Set<number>();
  items.forEach((item, i) => { if (isPinned(item)) keep.add(i); });

  let room = Math.max(0, max - keep.size);
  for (let i = 0; i < items.length && room > 0; i++) {
    if (keep.has(i)) continue;
    keep.add(i);
    room--;
  }

  const visible: T[] = [];
  const overflow: T[] = [];
  items.forEach((item, i) => (keep.has(i) ? visible : overflow).push(item));
  return { visible, overflow };
}

/**
 * How many hidden items the accessible label names before it gives up counting.
 *
 * Naming forty is worse than naming none — the label becomes a wall nobody
 * listens to the end of.
 */
const MAX_NAMED_IN_LABEL = 5;

/** `_autoMax` before anything has been measured. */
const NOT_MEASURED = -1;

// ─── Panel dimension constants ────────────────────────────────────────────────

/** Fixed panel width in px — matches CSS width on the panel. */
const PANEL_W = 200;

/** Approximate max panel height — used for vertical flip decision. */
const PANEL_H = 280;

/** Gap between trigger edge and panel (px). */
const GAP = 6;
/** Floor for the clamped panel height — below this it scrolls internally. */
const MIN_PANEL_H = 160;
/** Minimum distance the panel keeps from any viewport edge (px). */
const MARGIN = 8;

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'sv-items-with-more',
  standalone: true,
  imports: [],
  templateUrl: './items-with-more.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // position:relative contains the absolute measurement span used by the
  // inline variant. display:block fills the parent for ResizeObserver.
  // min-width:0 prevents overflow when inside a flex container.
  styles: [':host { display: block; min-width: 0; position: relative; }'],
  /**
   * ★ Focusable by script only. When the container widens and every item fits,
   * the "+N more" control is destroyed — and if it was the focused element, the
   * browser's only fallback is `<body>`. This is where focus lands instead, next
   * to the items that are now all on screen.
   */
  host: { tabindex: '-1', class: 'outline-none' },
})
export class SvItemsWithMoreComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly el     = inject(ElementRef<HTMLElement>);
  private readonly appRef = inject(ApplicationRef);
  private readonly ngZone = inject(NgZone);

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Items to display. Strings or objects with a `label` field. */
  items = input<readonly (string | ItemsWithMoreItem)[]>([]);

  /** How many items to show before collapsing (inline variant). @default 3 */
  maxVisible = input<number>(3);

  /** Template for the overflow indicator. Use `{n}` as placeholder. @default '+{n} more' */
  moreLabel = input<string>('+{n} more');

  /** Style variant for the overflow indicator. @default 'badge' */
  moreVariant = input<MoreVariant>('badge');

  /** Show overflow items in a dropdown when clicking the indicator. @default false */
  moreDropdown = input<boolean>(false);

  /**
   * Auto-detect overflow: measure how many items fit on a single line and
   * collapse the rest. Responds to container width changes via ResizeObserver.
   *
   * ★ `maxVisible` is **no longer ignored** when this is on — it is the split
   * used until measurement is possible. See `_effectiveMax`.
   * @default false
   */
  autoOverflow = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted when the "+N more" button is clicked. Payload = overflow items. */
  moreClick = output<(string | ItemsWithMoreItem)[]>();

  // ── Portal state ──────────────────────────────────────────────────────────

  readonly open       = signal(false);
  readonly openAbove  = signal(false);
  readonly alignRight = signal(false);
  readonly panelStyle = signal<Record<string, string>>({});

  private portalEl: HTMLElement | null               = null;
  /**
   * On the overlay stack while open (`X-4`, `OF-09-I1`): without it a modal
   * this popup sits in stays "topmost", and one Escape closes both.
   */
  protected readonly _stackedPopup = svStackedPopup({
    open: () => this.open(),
    element: () => this.portalEl,
  });
  private portalView: EmbeddedViewRef<object> | null = null;
  readonly _uid = svUniqueId('sv-items-with-more');

  @ViewChild('panelTpl', { read: TemplateRef })
  private readonly panelTpl!: TemplateRef<object>;

  // ── Auto-overflow state (badge / chip / text variants) ────────────────────

  /**
   * Internal max when autoOverflow=true. `MAX_SAFE_INTEGER` = "show all", which
   * is the measuring pass; `NOT_MEASURED` = nothing has been measured yet.
   */
  private readonly _autoMax = signal<number>(NOT_MEASURED);
  private _ro: ResizeObserver | null = null;
  private _calcRaf: number | null    = null;
  /** Last measured container width — guards against infinite ResizeObserver loops. */
  private _lastContainerW = -1;

  /**
   * Resolves to `_autoMax` (measured) or `maxVisible`.
   *
   * ★★ THE PRE-MEASUREMENT VALUE USED TO BE "SHOW ALL", AND THAT IS THE WHOLE
   *    SSR DEFECT. A server cannot measure — there is no layout — so a
   *    prerendered page shipped every one of forty chips, and the first frame
   *    after hydration collapsed them to three. That is a layout jump on the
   *    first paint of every auto-overflow row, and the reader's eye was already
   *    somewhere the content no longer is.
   *
   *    `maxVisible` is the answer because it is a number the SERVER also has.
   *    Both renders agree, hydration changes nothing, and the measured value
   *    replaces it once there is something to measure. The input that used to be
   *    documented as "ignored" is now the one thing making the first paint
   *    deterministic.
   */
  private readonly _effectiveMax = computed(() => {
    if (!this.autoOverflow()) return this.maxVisible();
    const auto = this._autoMax();
    return auto === NOT_MEASURED ? this.maxVisible() : auto;
  });

  /** Whether a measured split is in force (client only, after first measure). */
  readonly hasMeasured = computed(() => !this.autoOverflow() || this._autoMax() !== NOT_MEASURED);

  // ── Computed (badge / chip / text variants) ───────────────────────────────

  private readonly _split = computed(() => svSplitOverflow(this.items(), this._effectiveMax()));

  readonly visibleItems  = computed(() => this._split().visible);
  readonly overflowItems = computed(() => this._split().overflow);
  readonly overflowCount = computed(() => this.overflowItems().length);
  readonly hasOverflow   = computed(() => this.overflowCount() > 0);
  readonly formattedMoreLabel = computed(() =>
    this.moreLabel().replace('{n}', String(this.overflowCount()))
  );

  /**
   * The accessible name of the overflow control.
   *
   * ★★ "+3 more" IS A COUNT, NOT AN ANSWER. It tells a screen-reader user that
   *    three things are hidden and nothing about whether the one they came for
   *    is among them — and with `moreDropdown` off, which is the default, there
   *    is no panel to open to find out. The names were simply unavailable.
   *
   * Capped at {@link MAX_NAMED_IN_LABEL}: a label that reads out forty tags is
   * one nobody listens to the end of, so past the cap it goes back to counting.
   */
  readonly moreAriaLabel = computed(() => {
    const names = this.overflowItems().map((item) => this.label(item));
    const count = names.length;
    const plural = count === 1 ? '' : 's';
    if (!count) return '';
    if (count > MAX_NAMED_IN_LABEL) {
      const named = names.slice(0, MAX_NAMED_IN_LABEL).join(', ');
      return `Show ${count} more items: ${named}, and ${count - MAX_NAMED_IN_LABEL} others`;
    }
    return `Show ${count} more item${plural}: ${names.join(', ')}`;
  });

  // ── Inline text variant ───────────────────────────────────────────────────

  /**
   * Whether all items fit on a single line in the container.
   * Measured by comparing a hidden nowrap span's offsetWidth to the host's
   * clientWidth via ResizeObserver. Starts true to avoid showing a button
   * before the first measurement completes.
   */
  readonly _inlineFits = signal(true);

  /** Expanded (show-all) state for the inline toggle. */
  readonly inlineExpanded = signal(false);

  private _inlineRo:  ResizeObserver | null = null;
  private _inlineRaf: number | null         = null;

  /** Full comma-separated text of all items — rendered in the hidden measurement span. */
  readonly inlineFullText = computed(() =>
    this.items().map(i => this.label(i)).join(', ')
  );

  /**
   * Text rendered inside the visible inline <p>.
   * - _inlineFits: always full text, no trailing separator.
   * - !fits + expanded: full text + trailing ' ' before "Less" button.
   * - !fits + collapsed: visible slice + trailing ', ' before "+N more" button.
   */
  readonly inlineText = computed(() => {
    const allLabels = this.items().map(i => this.label(i));
    if (this._inlineFits()) {
      return allLabels.join(', ');
    }
    if (this.inlineExpanded()) {
      return allLabels.join(', ') + ' ';
    }
    // Pinned items stay in the sentence, so the flag means the same thing in
    // prose as it does in a row of chips.
    const visible = this._inlineSplit().visible.map(i => this.label(i));
    return visible.join(', ') + ', ';
  });

  /** Inline uses its own cap: it has a measurement path of its own. */
  private readonly _inlineSplit = computed(() =>
    svSplitOverflow(this.items(), this.maxVisible()),
  );

  /** Whether there are items beyond maxVisible (inline variant). */
  readonly inlineHasOverflow = computed(() => this._inlineSplit().overflow.length > 0);

  /** Count of hidden items (inline variant). */
  readonly inlineOverflowCount = computed(() => this._inlineSplit().overflow.length);

  /** Formatted "+N more" label for the inline variant. */
  readonly inlineFormattedMoreLabel = computed(() =>
    this.moreLabel().replace('{n}', String(this.inlineOverflowCount()))
  );

  /** Names the hidden items, for the same reason {@link moreAriaLabel} does. */
  readonly inlineMoreAriaLabel = computed(() => {
    const names = this._inlineSplit().overflow.map(i => this.label(i));
    if (!names.length) return '';
    if (names.length > MAX_NAMED_IN_LABEL) {
      return `Show ${names.length} more items: ${names.slice(0, MAX_NAMED_IN_LABEL).join(', ')}, ` +
        `and ${names.length - MAX_NAMED_IN_LABEL} others`;
    }
    return `Show ${names.length} more item${names.length === 1 ? '' : 's'}: ${names.join(', ')}`;
  });

  // ── Constructor ───────────────────────────────────────────────────────────

  constructor() {
    // When items change the hidden measurement span gets new text content,
    // but the host size doesn't change so ResizeObserver won't fire.
    // Re-measure explicitly via two rAFs (Angular render + browser paint).
    effect(() => {
      void this.inlineFullText(); // subscribe to items changes
      // ★ SSR: effects DO flush during a prerender, and `requestAnimationFrame`
      // does not exist there. Nothing to measure before hydration anyway.
      if (typeof requestAnimationFrame === 'undefined') return;
      if (this.moreVariant() !== 'inline') return;
      this.ngZone.runOutsideAngular(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.ngZone.run(() => this._measureInlineFits());
          });
        });
      });
    });

    // ★★ THE CONTROL CAN VANISH UNDER THE USER'S FINGER. Widen the container —
    //    open a sidebar, rotate a tablet, drag a split pane — and the overflow
    //    trigger stops existing because everything fits. If it was focused, or
    //    its dropdown was open, focus fell to `<body>` and a keyboard user was
    //    returned to the top of the page by an event they did not cause.
    effect(() => {
      // ★ Per variant. `hasOverflow` is the CHIP split and is computed from
      //   `maxVisible` whatever the variant, so in `inline` mode it stayed true
      //   when the sentence widened to fit — and the rescue never fired for the
      //   one variant whose control disappears on widening (DD-18-I1).
      const control = this.moreVariant() === 'inline'
        ? !this._inlineFits() && this.inlineHasOverflow()
        : this.hasOverflow();
      if (control) {
        this._hadControl = true;
        return;
      }
      if (!this._hadControl) return;
      this._hadControl = false;
      this._rescueFocus();
    });
  }

  // ── Focus, when the control disappears ────────────────────────────────────

  /** Whether an overflow control existed on the previous run of the effect. */
  private _hadControl = false;

  /** Whether focus was last seen inside this component or its portal. */
  private _focusWithin = false;

  /** Polite announcements — a split that changed without the user asking. */
  readonly liveMessage = signal('');

  /** The element inside here that focus was last on. */
  private _lastFocused: HTMLElement | null = null;

  @HostListener('focusin', ['$event'])
  onFocusIn(event: FocusEvent): void {
    this._focusWithin = true;
    this._lastFocused = event.target as HTMLElement | null;
  }

  @HostListener('focusout', ['$event'])
  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    // ★ A null `relatedTarget` is ALSO what a removed element reports, which is
    // precisely the case this flag exists to catch — so only an explicit move
    // to something outside counts as the user leaving.
    if (next && !this._containsNode(next)) this._focusWithin = false;
  }

  private _containsNode(node: Node): boolean {
    return this.el.nativeElement.contains(node) || !!this.portalEl?.contains(node);
  }

  /**
   * Put focus somewhere real after the overflow control was destroyed.
   *
   * Guarded three ways, because moving focus the user did not ask for is worse
   * than the bug when it fires wrongly:
   *
   * 1. focus was inside this component at all;
   * 2. ★ the element it was on is no longer **connected** — that is the whole
   *    signal, and it is what separates "your control was deleted" from "you
   *    tabbed out to the browser's own UI". In the second case the element is
   *    still in the document and focus is not ours to take back;
   * 3. focus has since fallen to `<body>`, so anything that legitimately claimed
   *    it in the meantime keeps it.
   */
  private _rescueFocus(): void {
    if (!this._focusWithin) return;
    if (typeof document === 'undefined') return;
    if (this.open()) this.close();
    // ★ Deferred one microtask, and this is not a stylistic choice: the effect
    // runs DURING change detection, before the view is refreshed, so at this
    // moment the trigger is still in the document and still holds focus. Every
    // guard below would read "nothing was lost" and the rescue would never
    // fire. Verified — it is what made the first version of this silently
    // do nothing.
    queueMicrotask(() => this._landFocus());
  }

  private _landFocus(): void {
    const host = this.el.nativeElement;
    if (!host?.isConnected) return;

    const lost = this._lastFocused;
    if (!lost || lost.isConnected) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;

    this._lastFocused = null;
    host.focus?.();
    const total = this.items().length;
    this._announce(`All ${total} item${total === 1 ? '' : 's'} now fit. The more button has gone.`);
  }

  private _announce(message: string): void {
    this.liveMessage.set('');
    queueMicrotask(() => this.liveMessage.set(message));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  label(item: string | ItemsWithMoreItem): string {
    return typeof item === 'string' ? item : item.label;
  }

  trackByIndex(index: number): number {
    return index;
  }

  // ── Scroll handler ────────────────────────────────────────────────────────

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

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // ★ SSR: prerendered — no `window`. Nothing scrolls on a server.
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this._scrollHandler, { passive: true, capture: true });
    }
  }

  ngAfterViewInit(): void {
    if (this.autoOverflow()) {
      this.ngZone.runOutsideAngular(() => this._startAutoOverflow());
    }
    if (this.moreVariant() === 'inline') {
      this.ngZone.runOutsideAngular(() => this._startInlineObserver());
    }
  }

  ngOnDestroy(): void {
    // ★ SSR: guard the STATEMENT, not the method — the rest of this teardown
    // still runs when the prerender destroys the component.
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
    if (this._rafId    !== null) cancelAnimationFrame(this._rafId);
    if (this._calcRaf  !== null) cancelAnimationFrame(this._calcRaf);
    if (this._inlineRaf !== null) cancelAnimationFrame(this._inlineRaf);
    this._ro?.disconnect();
    this._ro = null;
    this._inlineRo?.disconnect();
    this._inlineRo = null;
    this.destroyPortal();
  }

  // ── Inline fit measurement ────────────────────────────────────────────────

  /**
   * Starts a ResizeObserver on the host. On each width change the hidden
   * measurement span's offsetWidth is compared to the host's clientWidth to
   * decide whether all items fit on one line.
   */
  private _startInlineObserver(): void {
    // `ResizeObserver` does not exist on the server, and this runs during a
    // lifecycle hook that does. Everything it drives here is an enhancement on
    // top of a layout that is already correct, so it is guarded rather than
    // required — the same way number-ticker, rich-editor and tag-input do it.
    if (typeof ResizeObserver === 'undefined') return;
    this._inlineRo = new ResizeObserver(() => {
      if (this._inlineRaf !== null) return;
      this._inlineRaf = requestAnimationFrame(() => {
        this._inlineRaf = null;
        this.ngZone.run(() => this._measureInlineFits());
      });
    });
    this._inlineRo.observe(this.el.nativeElement);
    // Run an initial measurement synchronously (DOM is ready in AfterViewInit).
    this.ngZone.run(() => this._measureInlineFits());
  }

  /**
   * Queries the hidden [data-inline-measure] span, compares its natural
   * single-line width to the container, and updates _inlineFits accordingly.
   * Resets inlineExpanded when all items fit again (container widened).
   */
  private _measureInlineFits(): void {
    const measureEl = this.el.nativeElement.querySelector(
      '[data-inline-measure]'
    ) as HTMLElement | null;
    if (!measureEl) return;

    const containerW = this.el.nativeElement.clientWidth;
    const textW      = measureEl.offsetWidth;

    // ★★ Both zero means this subtree is **not being laid out** — a
    // `display:none` tab panel, a collapsed accordion, a frame before first
    // paint. `0 <= 0` reads as "it all fits", and because "it all fits" also
    // means "the container grew, so drop the expansion", the reader's opened
    // sentence was thrown away every time the component was hidden.
    //
    // ★ This is NOT a theoretical path. Verified in Chromium: hiding an
    // ancestor fires ResizeObserver with contentRect 0×0, and the hidden
    // subtree reports `clientWidth` 0 AND `offsetWidth` 0 — so `_measureInlineFits`
    // runs, at exactly the moment it can measure nothing. Switch to another tab
    // and back, and "Show less" had silently become "+3 more" again.
    //
    // Only the BOTH-zero case is unlaid-out. A zero-width container holding
    // real text (`textW > 0`) is a genuinely too-narrow container, and
    // `0 >= textW` correctly says it does not fit.
    if (containerW === 0 && textW === 0) return;

    const fits = textW <= containerW;

    this._inlineFits.set(fits);
    if (fits) this.inlineExpanded.set(false);
  }

  // ── Auto-overflow (badge / chip / text variants) ──────────────────────────

  private _startAutoOverflow(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this._ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? this.el.nativeElement.offsetWidth;
      if (Math.abs(w - this._lastContainerW) < 1) return;
      this._lastContainerW = w;

      if (this._calcRaf !== null) return;
      this._calcRaf = requestAnimationFrame(() => {
        this._calcRaf = null;
        this._triggerRecalc();
      });
    });
    this._ro.observe(this.el.nativeElement);
    this._triggerRecalc();
  }

  private _triggerRecalc(): void {
    this._lastContainerW = this.el.nativeElement.getBoundingClientRect().width;
    this.ngZone.run(() => this._autoMax.set(Number.MAX_SAFE_INTEGER));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!this._ro) return;
        this.ngZone.run(() => this._measure());
      });
    });
  }

  private _measure(): void {
    const itemEls = Array.from<HTMLElement>(
      this.el.nativeElement.querySelectorAll('[data-iwm-item]')
    );
    if (!itemEls.length) return;

    const firstTop = itemEls[0].getBoundingClientRect().top;
    let fitsOnFirstLine = 0;
    for (const el of itemEls) {
      if (el.getBoundingClientRect().top <= firstTop + 4) {
        fitsOnFirstLine++;
      } else {
        break;
      }
    }

    if (fitsOnFirstLine >= this.items().length) {
      this._autoMax.set(Number.MAX_SAFE_INTEGER);
    } else {
      this._autoMax.set(Math.max(1, fitsOnFirstLine - 1));
    }
  }

  // ── Host listeners ────────────────────────────────────────────────────────

  @HostListener('document:mousedown', ['$event'])
  onDocumentMousedown(e: MouseEvent): void {
    // A surface opened FROM this popup is not outside it (`X-4`).
    if (this._stackedPopup.isInsideHigherSurface(e.target)) return;
    if (!this.open()) return;
    const t = e.target as Node;
    if (this.el.nativeElement.contains(t)) return;
    if (this.portalEl?.contains(t)) return;
    this.close();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.open()) this.close();
    if (this.autoOverflow()) {
      this.ngZone.runOutsideAngular(() => {
        if (this._calcRaf !== null) return;
        this._calcRaf = requestAnimationFrame(() => {
          this._calcRaf = null;
          this._triggerRecalc();
        });
      });
    }
  }

  /**
   * On the document, not the host. The panel is portalled into <body> and focus
   * is moved into it on open, so a key pressed there never bubbles through this
   * element — bound to the host, this could only ever have fired while the
   * dropdown was already shut.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    // Only the topmost surface acts on Escape (`X-4`).
    if (!this._stackedPopup.ownsEscape()) return;
    if (this.open()) this.close(true);
  }

  // ── Position ──────────────────────────────────────────────────────────────

  private _calcPos(): void {
    const trigger =
      this.el.nativeElement.querySelector('[data-trigger]') as HTMLElement
      ?? this.el.nativeElement;

    const rect = trigger.getBoundingClientRect();
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;

    const above = vh - rect.bottom < PANEL_H && rect.top > vh - rect.bottom;
    const right = rect.left + PANEL_W > vw;

    this.openAbove.set(above);
    this.alignRight.set(right);

    const style: Record<string, string> = {
      position: 'fixed',
      zIndex:   '9999',
      width:    `${PANEL_W}px`,
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

  // ── Open / Close ──────────────────────────────────────────────────────────

  /** Toggle show-more / less for the inline text variant. */
  toggleInline(): void {
    this.inlineExpanded.update(v => !v);
  }

  onMoreClick(): void {
    this.moreClick.emit(this.overflowItems());
    if (this.moreDropdown()) {
      if (this.open()) {
        this.close();
      } else {
        this._openDropdown();
      }
    }
  }

  /** The trigger element, captured so focus can return to it on close. */
  private _triggerEl: HTMLElement | null = null;

  private _openDropdown(): void {
    this._calcPos();
    this._triggerEl =
      (this.el.nativeElement.querySelector('[data-trigger]') as HTMLElement | null);

    this.portalEl = document.createElement('div');
    this.portalEl.className = 'sv-dropdown-portal';

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

    // Move focus into the panel so keyboard/SR users land on the overflow list.
    const panel = this.portalEl.firstElementChild as HTMLElement | null;
    panel?.focus();
  }

  /** Close the dropdown. Pass `restoreFocus` to return focus to the trigger (Esc). */
  close(restoreFocus = false): void {
    this.destroyPortal();
    this.open.set(false);
    if (restoreFocus) {
      // The trigger can have been removed while the panel was open — a resize
      // that made everything fit. Focusing a detached node silently does
      // nothing, which is the same dropped focus by another route.
      const trigger = this._triggerEl;
      if (trigger?.isConnected) trigger.focus();
      else this.el.nativeElement.focus?.();
    }
    this._triggerEl = null;
  }

  private destroyPortal(): void {
    if (this.portalView) {
      this.appRef.detachView(this.portalView);
      this.portalView.destroy();
      this.portalView = null;
    }
    this.portalEl?.remove();
    this.portalEl = null;
  }
}
