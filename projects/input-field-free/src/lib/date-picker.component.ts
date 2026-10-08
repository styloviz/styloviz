import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  EmbeddedViewRef,
  forwardRef,
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
  ViewEncapsulation,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  svStackedPopup, SvFieldErrorComponent, createFieldError, type SvServerError,
  svFirstDayOfWeek,
  svToday,
  svWeekdayLabels,
  svUniqueId,
} from '@styloviz/core';

/** A single cell in the calendar day grid. */
export interface CalendarDay {
  readonly date: Date;
  readonly label: number;
  readonly isCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly isSelected: boolean;
  readonly isDisabled: boolean;
  readonly key: string;
}

/**
 * 🔺 `const WEEKDAYS = ['Mo', …, 'Su']` WAS HERE, AND IT WAS HALF OF `FI-09-M2`.
 *    The other half was a `mondayOffset` in the grid builder. Both are now
 *    derived from `locale` / `weekStart` through `svWeekdayLabels` and
 *    `svFirstDayOfWeek` in `@styloviz/core` — which read CLDR rather than a
 *    list, because `en-US` starts on Sunday and `ar-EG` on Saturday.
 */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
] as const;

/** Panel width (px) — matches the 17.5 rem CSS width in the template. */
const PANEL_W = 280;
/** Conservative day-view panel height for flip calculation (px). */
const PANEL_H = 390;
/** Gap between trigger edge and panel (px). */
const GAP = 6;
/** Minimum distance the panel keeps from any viewport edge (px). */
const MARGIN = 8;
/** Floor for the clamped panel height — below this it scrolls internally. */
const MIN_PANEL_H = 160;

/**
 * Moves `d` by whole months, keeping the day inside the month it lands in.
 *
 * ★ `d.setMonth(d.getMonth() - 1)` on its own is wrong at a month end. On 31
 * March it asks the platform for "31 February", which normalises FORWARD to
 * 2 March — so PageUp moved the caret 29 days backwards, left the calendar on
 * the same month, and pressing it again did exactly the same thing. From the
 * 31st of a long month there was no way to page out of it. The year step (Shift
 * + PageUp on 29 February) had the identical hole.
 *
 * Setting the day to 1 first makes the month arithmetic exact; the day is then
 * put back, clamped to that month's length — 31 Mar → 29 Feb in a leap year,
 * 28 Feb otherwise, which is what every native date control does.
 */
function stepMonths(d: Date, delta: number): void {
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  // `new Date(y, m + 1, 0)` is the last day of month `m`.
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
}

/**
 * SvDatePickerComponent — premium custom calendar date picker.
 *
 * The popover panel is rendered directly into `document.body` via a lightweight
 * Angular embedded-view portal so it is completely outside any parent
 * `overflow:hidden`, `overflow:auto`, or CSS `transform` containment.
 * A capture-phase, RAF-throttled scroll listener keeps the panel anchored to
 * the trigger — including when a nested scrollable ancestor scrolls, not just
 * the window — and the horizontal position is clamped so it never renders
 * partially outside the viewport. Resize closes the panel instead of
 * repositioning it with stale coordinates.
 *
 * @example
 * ```html
 * <sv-date-picker label="Start Date" [(value)]="dateStr" minDate="2024-01-01" />
 * ```
 */

@Component({
  selector: 'sv-date-picker',
  standalone: true,
  imports: [NgClass, SvFieldErrorComponent, SvIconComponent],
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvDatePickerComponent),
      multi: true,
    },
  ],
})
export class SvDatePickerComponent implements OnInit, OnDestroy, ControlValueAccessor {
  /** Per-instance id prefix, so the visible label can name the trigger. */
  protected readonly uid = svUniqueId('sv-dp');


  // ─── Inputs ───────────────────────────────────────────────────────────────

  /**
   * Two-way bindable `YYYY-MM-DD` date string.
   *
   * ── ★★★ A CALENDAR DATE, NOT AN INSTANT (`FI-09-M1`, and now `FI-28-I2`) ──
   *
   * A birthday is not a moment; it is the same date everywhere on Earth. That
   * is why this is a string and not a `Date` — a `Date` is an instant, and
   * storing one for "15 June" means the value shifts across midnight for half
   * the world.
   *
   * ⚠️ COMPOSING THIS WITH `sv-time-picker` IS NOT `new Date(d + 'T' + t)`.
   *    That composes in the browser's zone, silently, and twice a year it
   *    composes something that does not exist: London, 2026-03-29, the clocks
   *    go 01:00 → 02:00 and `new Date('2026-03-29T01:30')` returns 02:30
   *    without a word. Use `svComposeDateTime` from `@styloviz/core`, which
   *    reports `'gap'` and `'ambiguous'` instead of guessing.
   */
  readonly value = model<string>('');

  /** Label rendered above the trigger. */
  readonly label = input<string>('');

  /** Placeholder shown when no date is selected. */
  readonly placeholder = input<string>('Select date');

  /** Minimum selectable date (YYYY-MM-DD). Cells before it are disabled. */
  readonly minDate = input<string>('');

  /** Maximum selectable date (YYYY-MM-DD). Cells after it are disabled. */
  readonly maxDate = input<string>('');

  /**
   * BCP-47 tag for the week's first day and the column headings.
   * @default '' — keep Monday and the kit's English headings.
   *
   * ── The defect this closes (`FI-09-M2`) ──────────────────────────────────
   *
   * ★★★ THE CALENDAR STARTED ON MONDAY, FOR EVERYONE. Both halves were
   *     constants — `WEEKDAYS = ['Mo', …, 'Su']` and a `mondayOffset` in the
   *     grid builder — so an American found the columns shifted by one from
   *     every other calendar on their machine, and an Arabic reader by two.
   *
   * ★★ THAT IS NOT COSMETIC. A calendar is read by COLUMN POSITION before it is
   *    read by number; that is what the grid is for. A Sunday-first reader
   *    looking at a Monday-first grid picks the wrong date, confidently, and
   *    this component then reports exactly what they clicked. Nothing is
   *    inconsistent — the user is simply wrong about which day they chose.
   *
   * Measured first days: `en-US` Sunday, `en-GB` Monday, `ar-EG` **Saturday**.
   * Three answers in six locales, so there is no majority to default to.
   *
   * ⚠️ `''` MEANS "KEEP MONDAY", NOT "ASK THE BROWSER". Defaulting to the
   *    runtime's locale would move every existing caller's columns on upgrade
   *    — a change a host should make on purpose, not discover from a ticket.
   */
  readonly locale = input<string>('');

  /**
   * Override the first day of the week. `0` is Sunday. @default null — derive
   * it from `locale`.
   *
   * ★ For the host that knows better than the tag does: an internal tool whose
   *   users are all in one office, a scheduling view pinned to a business week.
   */
  readonly weekStart = input<number | null>(null);

  /**
   * Which zone's **today** this calendar means (`FI-09-M1`).
   *
   * ★★★ THE ONE PLACE A CALENDAR DATE CANNOT AVOID A TIME ZONE. The value here
   *     is `YYYY-MM-DD` — no time, no zone, the same date everywhere. But
   *     "which date is today" has no zone-free answer: for several hours of
   *     every day, two places on Earth are on different dates.
   *
   *     Every "today" in this component — the highlighted cell, the Today
   *     button, the month the panel opens on, the keyboard's starting point —
   *     was computed with `new Date()` in the BROWSER'S zone. That is right for
   *     a personal calendar and wrong for an app pinned to a business zone: a
   *     Sydney user booking against a New York ledger sees tomorrow highlighted
   *     as today, and the Today button writes a date the server rejects.
   *
   * An IANA zone (`'America/New_York'`). Empty means the browser's own, which
   * is what this component was silently doing before the input existed — so
   * leaving it unset changes nothing.
   *
   * ⚠️ It does NOT convert the value. A calendar date has no zone to convert
   *    between; use `svComposeDateTime` when you need an instant.
   *
   * @default '' — the browser's zone
   */
  readonly timeZone = input<string>('');

  /**
   * Today, in `timeZone`. Every "today" in this component reads this.
   *
   * A computed rather than a call site each time, so the whole panel agrees
   * about the date even if it is rendered across a midnight.
   */
  readonly todayKey = computed(() => svToday(this.timeZone()));

  /**
   * A rule for which dates cannot be chosen — weekends, blackout ranges, lead
   * times. @default null
   *
   * ── Why a predicate and not a list (`FI-09-M3`) ──────────────────────────
   *
   * ★★★ THE THING A HOST ACTUALLY HAS IS A RULE, AND A LIST CANNOT HOLD ONE.
   *     "No weekends", "not within 48 hours", "not while the warehouse is shut"
   *     are infinite sets, so an array means the host enumerating a window and
   *     re-enumerating it every time the view scrolls — and getting it wrong at
   *     the edges, silently, because a date that is merely absent from a list
   *     looks exactly like a date that is allowed.
   *
   * ★★ IT IS OR-ED WITH `minDate`/`maxDate`, NOT INSTEAD OF THEM. The window is
   *    a different kind of statement — it bounds what the control is FOR — and
   *    a host that sets both means both.
   *
   * ⚠️ IT IS CALLED ONCE PER RENDERED CELL, 42 PER MONTH VIEW. Keep it pure and
   *    cheap: a `Set` lookup or a comparison, not a fetch. A predicate that
   *    allocates is a predicate that runs 42 times per keystroke in a filtered
   *    view.
   *
   * ★ It does NOT gate the month and year pickers. A month is not unavailable
   *   because some of its days are, and greying out June because the 14th is a
   *   holiday would make the control unusable to get to the 15th.
   */
  readonly dateDisabled = input<((date: Date) => boolean) | null>(null);

  /** Disables the trigger and prevents the popover from opening. */
  readonly disabled = input<boolean>(false);

  /** Shows a red asterisk in the label. */
  readonly required = input<boolean>(false);

  /** Explicit accessible name for the trigger (falls back to `label`). */
  readonly ariaLabel = input<string>('');

  // ─── Outputs ──────────────────────────────────────────────────────────────
  // Note: the `value` model already emits `valueChange` for `[(value)]`.

  /** Emitted when the calendar popover opens. */
  readonly opened = output<void>();
  /** Emitted when the calendar popover closes. */
  readonly closed = output<void>();

  // ─── ControlValueAccessor ───────────────────────────────────────────────────
  // Lets the picker bind to reactive forms (`formControlName` / `[formControl]`)
  // and template-driven forms (`[(ngModel)]`) in addition to `[(value)]`.

  private _onChange: (v: string) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);

  /** Merged disabled — the `[disabled]` input OR a disabled parent FormControl. */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    this._formDisabled.set(isDisabled);
    if (isDisabled && this.isOpen()) this.close();
  }

  /** Sets the value from a user gesture and notifies the form (change + touched). */
  private commitValue(v: string): void {
    this.value.set(v);
    this._onChange(v);
    this._onTouched();
  }

  // ─── View refs ────────────────────────────────────────────────────────────

  /** The ng-template that holds the calendar panel markup. */
  @ViewChild('panelTpl', { read: TemplateRef })
  private readonly panelTpl!: TemplateRef<object>;

  // ─── Internal state ───────────────────────────────────────────────────────

  readonly isOpen    = signal(false);
  readonly viewYear  = signal(new Date().getFullYear());
  readonly viewMonth = signal(new Date().getMonth());
  readonly viewMode  = signal<'days' | 'months' | 'years'>('days');
  readonly openAbove = signal(false);
  readonly alignRight = signal(false);

  /** YYYY-MM-DD of the keyboard-focused day cell (roving tabindex). */
  readonly activeKey = signal<string>('');

  /**
   * Inline style object applied to the panel.
   * Uses position:fixed with exact viewport coords so the panel
   * escapes all parent overflow and transform containment.
   */
  readonly panelStyle = signal<Record<string, string>>({});

  // ─── Portal state ─────────────────────────────────────────────────────────

  /** Container div appended to document.body while the panel is open. */
  private portalEl: HTMLElement | null = null;
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

  /**
   * Capture-phase scroll listener — fires for ANY scrollable ancestor
   * (not just the window), RAF-throttled so it never runs more than once
   * per frame. Repositions the panel to keep it anchored to the trigger
   * instead of drifting or closing (see dropdown-instruction.md §6).
   */
  private _rafId: number | null = null;
  private readonly _scrollHandler = (): void => {
    if (!this.isOpen()) return;
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (this.isOpen()) {
        this._calcPos();
        this.portalView?.detectChanges();
      }
    });
  };

  // ─── Static data ──────────────────────────────────────────────────────────

  /** First day of the week as a JS index — the `weekStart` override, else the locale. */
  readonly firstDay = computed<number>(() => {
    const override = this.weekStart();
    if (override !== null && Number.isInteger(override)) return ((override % 7) + 7) % 7;
    return svFirstDayOfWeek(this.locale());
  });

  readonly weekDays   = computed<readonly string[]>(() =>
    svWeekdayLabels(this.locale(), this.firstDay()),
  );
  readonly monthNames = MONTH_NAMES;

  readonly yearRange = computed(() => {
    const base = Math.floor(this.viewYear() / 10) * 10 - 5;
    return Array.from({ length: 20 }, (_, i) => base + i);
  });

  readonly displayValue = computed(() => {
    const v = this.value();
    if (!v) return '';
    return new Date(v + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  });

  readonly monthName = computed(() => MONTH_NAMES[this.viewMonth()]);

  /** Accessible name for the trigger — combines the field name with the selection. */
  readonly triggerAriaLabel = computed<string | null>(() => {
    const name = this.ariaLabel() || this.label();
    if (!name) return null;
    return this.displayValue() ? `${name}: ${this.displayValue()}` : `${name}: ${this.placeholder()}`;
  });

  /**
   * The 42 cells of the grid.
   *
   * Each cell is constructed from its own day-of-month rather than stepped from
   * a shared cursor, and every comparison is on the `YYYY-MM-DD` key rather than
   * a timestamp. Where a spring-forward lands on local midnight (Chile, Cuba,
   * Paraguay, Lebanon), that midnight does not exist: stepping a cursor into it
   * normalizes to 01:00, and *every* later cell in the grid carries that hour,
   * so timestamp equality stops matching the midnight the day is nominally at.
   * The rest of this component already compares on the key string.
   */
  readonly calendarDays = computed<CalendarDay[]>(() => {
    const year     = this.viewYear();
    const month    = this.viewMonth();
    const todayKey = this.todayKey();
    const sel      = this.value();

    // ★ How far the 1st sits from the column the week starts in. Was
    //   `(getDay() + 6) % 7` — Monday, hardcoded.
    const leadingBlanks = (new Date(year, month, 1).getDay() - this.firstDay() + 7) % 7;

    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(year, month, 1 - leadingBlanks + i);
      const key  = this.toDateStr(date);
      days.push({
        date,
        label: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: key === todayKey,
        isSelected: !!sel && key === sel,
        isDisabled: this.isDateDisabled(date),
        key,
      });
    }
    return days;
  });

  /** The 42 calendar days grouped into 6 weeks for `role="row"` grid semantics. */
  readonly calendarWeeks = computed<CalendarDay[][]>(() => {
    const days = this.calendarDays();
    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  });

  // ─── DI ───────────────────────────────────────────────────────────────────

  private readonly el     = inject(ElementRef);
  private readonly appRef = inject(ApplicationRef);

  // ─── Lifecycle ────────────────────────────────────────────────────────────

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

  // ─── Global listeners ─────────────────────────────────────────────────────

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // A surface opened FROM this popup is not outside it (`X-4`).
    if (this._stackedPopup.isInsideHigherSurface(event.target)) return;
    if (!this.isOpen()) return;
    const t = event.target as Node;
    // Keep open if click is inside the trigger OR inside the portal panel
    if (this.el.nativeElement.contains(t)) return;
    if (this.portalEl?.contains(t)) return;
    this.close();
  }

  /**
   * On the DOCUMENT, not the host.
   *
   * The panel lives in `<body>` and `toggle()` moves focus into the day grid, so
   * a key pressed while the calendar is open never passes through this
   * component's element. A host-bound `keydown.escape` could only ever have
   * fired while the panel was already shut — which is to say, never usefully.
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    // Only the topmost surface acts on Escape (`X-4`).
    if (!this._stackedPopup.ownsEscape()) return;
    if (this.isOpen()) this.close(true);
  }

  @HostListener('window:resize')
  onResize(): void {
    // Viewport resize invalidates the layout — close rather than reposition
    // with now-stale coordinates (dropdown-instruction.md §8).
    if (this.isOpen()) this.close();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  toggle(): void {
    if (this.resolvedDisabled()) return;
    if (this.isOpen()) { this.close(); return; }

    // 1. Sync view to selected date / today, pulled inside [minDate, maxDate].
    //    The active day is what receives focus below, and a disabled <button>
    //    cannot take focus — so an out-of-window starting point opens the panel
    //    with focus on <body> and every arrow key thereafter going nowhere.
    const sel = this.value();
    const clamped = this.clampToWindow(
      sel ? new Date(sel + 'T00:00:00') : new Date(this.todayKey() + 'T00:00:00'));
    // ★ The same reasoning covers `dateDisabled`: today on a Saturday under a
    //   no-weekends rule is a disabled <button>, and opening onto it stranded
    //   focus exactly as an out-of-window start did. Nearest enabled day,
    //   forward first; if the rule leaves nothing, the old starting point.
    const ref = this.isDateDisabled(clamped)
      ? (this.nearestEnabled(clamped, 1) ?? this.nearestEnabled(clamped, -1) ?? clamped)
      : clamped;
    this.viewYear.set(ref.getFullYear());
    this.viewMonth.set(ref.getMonth());
    this.viewMode.set('days');
    this.activeKey.set(this.toDateStr(ref));

    // 2. Calculate fixed-position coordinates from the trigger's viewport rect.
    this._calcPos();

    // 3. Mount the panel into document.body via a lightweight portal.
    //    This escapes ALL parent overflow:hidden and CSS transform contexts.
    if (!this.panelTpl) return;

    this.portalEl = document.createElement('div');
    this.portalEl.className = 'sv-dp-portal';

    this.portalView = this.panelTpl.createEmbeddedView({});
    this.appRef.attachView(this.portalView);
    // Render BEFORE the nodes reach the document: an unstyled panel inserted
    // into <body> grows the page for a tick, which queues a scroll event that
    // this component's own scroll handler then acts on. See
    // scripts/fix-portal-insertion-order.mjs.
    this.portalView.detectChanges();
    this.portalView.rootNodes.forEach((n: Node) => this.portalEl!.appendChild(n));
    document.body.appendChild(this.portalEl);

    this.isOpen.set(true);
    this.opened.emit();
    // Move focus into the calendar grid for keyboard users.
    this.focusActiveDayDeferred();
  }

  close(returnFocus = false): void {
    if (!this.isOpen()) return;
    this.destroyPortal();
    this.isOpen.set(false);
    this.viewMode.set('days');
    this._onTouched();
    this.closed.emit();
    if (returnFocus) this.focusTrigger();
  }

  /** Puts focus back on the trigger — the only element guaranteed to survive. */
  private focusTrigger(): void {
    (this.el.nativeElement as HTMLElement)
      .querySelector<HTMLElement>('.sv-dp-trigger')?.focus();
  }

  selectDay(day: CalendarDay): void {
    if (day.isDisabled) return;
    this.commitValue(day.key);
    this.close(true);
  }

  // ─── Keyboard navigation (day grid) ─────────────────────────────────────────

  /** Roving tabindex — only the active day cell is in the tab order. */
  dayTabIndex(day: CalendarDay): number {
    return day.key === this.activeKey() ? 0 : -1;
  }

  /** Arrow / Home / End / PageUp / PageDown navigation + Enter/Space to select. */
  onDayKeydown(event: KeyboardEvent): void {
    if (this.viewMode() !== 'days') return;
    const base = this.activeKey() || this.value() || this.todayKey();
    const d = new Date(base + 'T00:00:00');

    switch (event.key) {
      case 'ArrowLeft':  d.setDate(d.getDate() - 1); break;
      case 'ArrowRight': d.setDate(d.getDate() + 1); break;
      case 'ArrowUp':    d.setDate(d.getDate() - 7); break;
      case 'ArrowDown':  d.setDate(d.getDate() + 7); break;
      // ★ The start of the week AS DISPLAYED. Hardcoded to Monday before, which
      //   moved the caret to a different column than the one Home visually means.
      case 'Home':       d.setDate(d.getDate() - ((d.getDay() - this.firstDay() + 7) % 7)); break;
      // ★ AND SO IS End. It had the same Monday-week constant baked in from the
      //   other side — `(getDay() + 6) % 7` is the offset from Monday, so End
      //   landed on Sunday for everybody. On a Sunday-first grid that is the
      //   FIRST column, i.e. Home and End moved to the same cell in opposite
      //   directions. Fixed together because they are one arithmetic.
      case 'End':        d.setDate(d.getDate() + (6 - ((d.getDay() - this.firstDay() + 7) % 7))); break;
      case 'PageUp':     stepMonths(d, event.shiftKey ? -12 : -1); break;
      case 'PageDown':   stepMonths(d, event.shiftKey ? +12 : +1); break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const target = this.calendarDays().find(c => c.key === this.activeKey());
        if (target) this.selectDay(target);
        return;
      }
      default: return;
    }

    event.preventDefault();
    // Clamp rather than step off the end: a disabled <button> cannot take focus,
    // so moving the roving tabindex onto one leaves focus on <body> — and the
    // grid's keydown handler is on the CONTAINER, so every subsequent arrow key
    // is swallowed too. The user is stranded inside the panel with no keyboard
    // way out. Clamping keeps the caret on the nearest reachable day instead.
    const clamped = this.clampToWindow(d);
    // ★ `dateDisabled` makes holes INSIDE the window, which clamping cannot see:
    //   ArrowRight from Friday under a no-weekends rule landed the roving
    //   tabindex on Saturday's disabled <button> and stranded focus the same
    //   way. Keep travelling in the direction of the key to the next day the
    //   user can pick; if there is none that way, stay put.
    let target: Date | null = clamped;
    if (this.isDateDisabled(clamped)) {
      const from = new Date(base + 'T00:00:00').getTime();
      const dir = clamped.getTime() < from ? -1 : 1;
      target = this.nearestEnabled(clamped, dir);
      if (!target) return;
    }
    this.viewYear.set(target.getFullYear());
    this.viewMonth.set(target.getMonth());
    this.activeKey.set(this.toDateStr(target));
    this.portalView?.detectChanges();
    this.focusActiveDayDeferred();
  }

  private focusActiveDayDeferred(): void {
    setTimeout(() => {
      const btn = this.portalEl?.querySelector<HTMLElement>(`[data-day="${this.activeKey()}"]`);
      btn?.focus();
    });
  }

  selectMonth(monthIndex: number): void {
    this.viewMonth.set(monthIndex);
    this.viewMode.set('days');
  }

  selectYear(year: number): void {
    this.viewYear.set(year);
    this.viewMode.set('months');
  }

  prevPeriod(): void {
    if (this.viewMode() === 'years')       { this.viewYear.update(y => y - 20); return; }
    if (this.viewMode() === 'months')      { this.viewYear.update(y => y - 1);  return; }
    let m = this.viewMonth() - 1, y = this.viewYear();
    if (m < 0) { m = 11; y--; }
    this.viewMonth.set(m); this.viewYear.set(y);
  }

  nextPeriod(): void {
    if (this.viewMode() === 'years')       { this.viewYear.update(y => y + 20); return; }
    if (this.viewMode() === 'months')      { this.viewYear.update(y => y + 1);  return; }
    let m = this.viewMonth() + 1, y = this.viewYear();
    if (m > 11) { m = 0; y++; }
    this.viewMonth.set(m); this.viewYear.set(y);
  }

  /**
   * Jumps to today — unless today is outside `[minDate, maxDate]`.
   *
   * This was the one control in the panel that did not consult the window it
   * was standing in: it wrote a date the grid directly above it was rendering
   * as disabled, then closed, so nothing was left on screen to contradict it.
   */
  goToToday(): void {
    if (this.isTodayDisabled()) return;
    this.commitValue(this.todayKey());
    this.close(true);
  }

  /**
   * Whether the Today shortcut points at a date the window — or the host's
   * `dateDisabled` rule — forbids. The rule was missed when it landed, so on a
   * Saturday under a no-weekends rule "Today" wrote the very date the grid
   * above it rendered as disabled.
   */
  readonly isTodayDisabled = computed(() =>
    this.isDateDisabled(new Date(this.todayKey() + 'T00:00:00')),
  );

  clearDate(): void {
    this.commitValue('');
    // The clear button beside the trigger unrenders the instant the value goes,
    // so it owes focus somewhere. `close()` returns early when the panel is
    // already shut — which is exactly the case when that button was the one
    // clicked — and focus fell to <body>.
    if (this.isOpen()) this.close(true);
    else this.focusTrigger();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  toDateStr(d: Date): string {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Is this date unavailable — by the window, or by the host's rule?
   *
   * ★★ THE WINDOW IS CHECKED FIRST AND SHORT-CIRCUITS. `dateDisabled` runs once
   *    per rendered cell; there is no reason to ask a host's predicate about a
   *    date that is already outside `[minDate, maxDate]`.
   */
  private isDateDisabled(d: Date): boolean {
    const str = this.toDateStr(d);
    const min = this.minDate(), max = this.maxDate();
    if ((!!min && str < min) || (!!max && str > max)) return true;
    const rule = this.dateDisabled();
    return rule ? rule(d) : false;
  }

  /**
   * The closest selectable day from `from` (exclusive) walking in `dir`, never
   * leaving `[minDate, maxDate]` and never more than a year out — or `null`.
   * The cap bounds the cost of a predicate that disables nearly everything.
   */
  private nearestEnabled(from: Date, dir: 1 | -1): Date | null {
    const min = this.minDate(), max = this.maxDate();
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    for (let i = 0; i < 366; i++) {
      d.setDate(d.getDate() + dir);
      const key = this.toDateStr(d);
      if ((min && key < min) || (max && key > max)) return null;
      if (!this.isDateDisabled(d)) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    return null;
  }

  /**
   * Pulls a date inside `[minDate, maxDate]`. Comparison is on the YYYY-MM-DD
   * string, which sorts chronologically — the same test `isDateDisabled` uses,
   * so the two can never disagree about where the edge is.
   */
  private clampToWindow(d: Date): Date {
    const str = this.toDateStr(d);
    const min = this.minDate(), max = this.maxDate();
    if (min && str < min) return new Date(min + 'T00:00:00');
    if (max && str > max) return new Date(max + 'T00:00:00');
    return d;
  }

  isMonthDisabled(idx: number): boolean {
    const y = this.viewYear(), min = this.minDate(), max = this.maxDate();
    if (min && this.toDateStr(new Date(y, idx + 1, 0)) < min) return true;
    if (max && this.toDateStr(new Date(y, idx, 1))     > max) return true;
    return false;
  }

  isYearDisabled(year: number): boolean {
    const min = this.minDate(), max = this.maxDate();
    if (min && this.toDateStr(new Date(year, 11, 31)) < min) return true;
    if (max && this.toDateStr(new Date(year, 0, 1))  > max) return true;
    return false;
  }

  isViewMonthSelected(idx: number): boolean {
    const v = this.value(); if (!v) return false;
    const d = new Date(v + 'T00:00:00');
    return d.getFullYear() === this.viewYear() && d.getMonth() === idx;
  }

  isViewYearSelected(year: number): boolean {
    const v = this.value(); if (!v) return false;
    return new Date(v + 'T00:00:00').getFullYear() === year;
  }

  headerLabel(): string {
    if (this.viewMode() === 'months') return String(this.viewYear());
    if (this.viewMode() === 'years') {
      const r = this.yearRange(); return `${r[0]} – ${r[r.length - 1]}`;
    }
    return `${this.monthName()} ${this.viewYear()}`;
  }

  // ─── Position calculation ───────────────────────────────────────────────────

  /**
   * Computes fixed-position coordinates from the trigger's current viewport
   * rect. position:fixed is viewport-relative — getBoundingClientRect() gives
   * exactly that, regardless of scroll position. Called on open and again on
   * every scroll (see _scrollHandler) so the panel tracks the trigger instead
   * of drifting away from it as the page (or a nested container) scrolls.
   */
  private _calcPos(): void {
    const rect = (this.el.nativeElement as HTMLElement).getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const above = spaceBelow < PANEL_H && spaceAbove > spaceBelow;
    const right = rect.left + PANEL_W > vw;

    this.openAbove.set(above);
    this.alignRight.set(right);

    // Unify left/right alignment into a single clamped `left` value so the
    // panel can never render partially outside the viewport horizontally.
    const desiredLeft = right ? rect.right - PANEL_W : rect.left;
    const maxLeft = Math.max(GAP, vw - PANEL_W - GAP);
    const clampedLeft = Math.min(Math.max(desiredLeft, GAP), maxLeft);

    const style: Record<string, string> = {
      position: 'fixed',
      zIndex:   '9999',
      width:    `${PANEL_W}px`,
      left:     `${clampedLeft}px`,
    };
    style[above ? 'bottom' : 'top'] = above
      ? `${vh - rect.top + GAP}px`
      : `${rect.bottom + GAP}px`;
    // Cap the height to the room actually available on the chosen side. Without
    // this, flipping ABOVE a trigger that sits near the top of the viewport puts
    // the panel's top edge off-screen (Date Picker Pro: y=-35).
    style['maxHeight'] = `${Math.max(MIN_PANEL_H, (above ? rect.top : vh - rect.bottom) - GAP - MARGIN)}px`;

    this.panelStyle.set(style);
  }

  // ─── Portal lifecycle ──────────────────────────────────────────────────────

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
  // This control had no error slot: a form could reject it with no way to say
  // why. `serverError` outranks `errorMessage` while it still describes the
  // current value, and expires on the next change — see `createFieldError`.

  /** Client-side validation message. */
  errorMessage = input<string>('');
  /** A rejection reported by the server about this value. Self-expiring. */
  serverError = input<SvServerError>(null);

  protected readonly fieldError = createFieldError(this.value, this.serverError, this.errorMessage);
  protected readonly errorId = svUniqueId('sv-date-picker-error');

}
