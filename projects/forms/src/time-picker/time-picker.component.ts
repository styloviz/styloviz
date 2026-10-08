import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
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
} from '@angular/core';
import { booleanAttribute } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { forwardRef } from '@angular/core';
import {
  svStackedPopup,
  SvFieldErrorComponent,
  createFieldError,
  svFormatTime,
  svParseTime,
  svResolveHour24,
  type SvServerError,
  svUniqueId,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

export type TimePickerFormat = '12h' | '24h';
export type TimePickerSize   = 'sm' | 'md' | 'lg';

/** Approximate picker panel height for flip calculation (px). */
const PANEL_H = 300;
/** Approximate picker panel width for right-align calculation (px). */
const PANEL_W = 220;
/** Gap between trigger edge and panel (px). */
const GAP = 6;
/** Floor for the clamped panel height — below this it scrolls internally. */
const MIN_PANEL_H = 160;
/** Minimum distance the panel keeps from any viewport edge (px). */
const MARGIN = 8;

/**
 * "HH:mm" -> minutes since midnight; null when unset or unparseable.
 *
 * null means "no bound", which is what an empty `min`/`max` input has to mean.
 * A malformed bound is treated the same way rather than throwing or being
 * coerced to 0 — a typo in `max` should not silently pin the control to
 * midnight.
 */
function toMinutes(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((v ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

@Component({
  selector: 'sv-time-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvIconComponent, FormsModule, SvFieldErrorComponent],
  templateUrl: './time-picker.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SvTimePickerComponent),
      multi: true,
    },
  ],
})
export class SvTimePickerComponent implements OnInit, OnDestroy, ControlValueAccessor {
  private readonly el     = inject(ElementRef<HTMLElement>);
  private readonly appRef = inject(ApplicationRef);

  /**
   * Selected time as `"HH:mm"`, or `"HH:mm:ss"` with `withSeconds`. Two-way.
   * @default '09:00'
   *
   * ── ★★★ THIS IS A WALL-CLOCK TIME. IT IS NOT AN INSTANT. (`FI-28-I2`) ─────
   *
   * `"09:00"` means "what a clock on the wall says", with no date and no zone
   * attached — the same string means a different moment in Dublin and in Delhi,
   * and the component neither knows nor cares which you meant. That is the
   * right type for a control that offers hours and minutes, and it is the same
   * decision `sv-date-picker` makes with its `'YYYY-MM-DD'`: a calendar date is
   * not an instant either.
   *
   * ⚠️ WHICH MEANS `new Date(\`${date}T${time}\`)` IS A BUG, and a quiet one.
   *    It composes in the BROWSER'S zone, so a booking entered by a London
   *    scheduler for a Dublin clinic is stored an hour out, with nothing
   *    anywhere reporting a problem.
   *
   * ⚠️ AND TWICE A YEAR THE COMPOSITION IS NOT A FUNCTION AT ALL. London,
   *    2026-03-29: the clocks go 01:00 → 02:00, so **01:30 does not exist that
   *    day** — `new Date('2026-03-29T01:30')` silently returns 02:30. London,
   *    2026-10-25: the clocks go 02:00 → 01:00, so **01:30 happens twice** and
   *    the constructor picks one without saying which.
   *
   * ★★ USE `svComposeDateTime(date, time, zone)` FROM `@styloviz/core`. It
   *    returns `status: 'ok' | 'gap' | 'ambiguous'` and, when ambiguous, both
   *    instants — so a booking flow can say "that hour does not exist on this
   *    date" instead of moving the appointment. The transition is not always an
   *    hour: Australia/Lord_Howe shifts by **thirty minutes**.
   */
  value       = model<string>('09:00');
  /** Clock format: 12h or 24h. @default '12h' */
  format      = input<TimePickerFormat>('12h');
  /** Control size: sm, md or lg. @default 'md' */
  size        = input<TimePickerSize>('md');
  /** Disable the picker. @default false */
  disabled    = input<boolean>(false);
  /** Accessible label for the control. */
  label       = input<string>('');
  /** Earliest selectable time ("HH:mm"). Earlier cells are disabled. */
  min         = input<string>('');
  /** Latest selectable time ("HH:mm"). Later cells are disabled. */
  max         = input<string>('');
  /** Include a seconds column. @default false */
  withSeconds = input<boolean>(false);
  /**
   * Offer a text field inside the panel so the time can be TYPED.
   * @default true
   *
   * ── The defect this closes (`FI-28-I1` / `FI-28-M1`) ─────────────────────
   *
   * ★★★ THIS CONTROL HAD NO TEXT INPUT AT ALL, and the columns had no arrow
   *     keys, so document order was the only navigation there was. Measured
   *     with `format="24h"` and `withSeconds`: **146 tab stops in the open
   *     panel**, minute `37` the **61st**. Setting 14:37 by keyboard meant
   *     sixty-one presses of Tab, and the same 146 stops are 146 swipes for a
   *     screen-reader user moving by form control.
   *
   * ★★ DEFAULTED **ON**, unlike the locale inputs added for `FI-09-M2`. Those
   *    change what an existing caller's users SEE and so have to be opted into;
   *    this adds a second way to reach the same value and takes nothing away.
   *    A control that a keyboard user cannot operate is a defect, not a style,
   *    and leaving the fix opt-in means nobody gets it.
   */
  typed = input(true, { transform: booleanAttribute });

  /** Emitted with the new time string when it changes. */
  changed = output<string>();

  readonly open    = signal(false);
  readonly hovered = signal<string>('');

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

  /** The ng-template that holds the time picker panel markup. */
  @ViewChild('panelTpl', { read: TemplateRef })
  private readonly panelTpl!: TemplateRef<object>;

  readonly hours12 = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  readonly hours24 = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  readonly minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  readonly seconds = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // `||`, not `??`: an empty value splits to [''], which is present but not a
  // number. `??` let that through, and the next selection built a time around it.
  //
  // ★★ PADDED, because the cells are. A host value of `9:30` — the one-digit
  //    hour `toMinutes` already accepts for `min`/`max` — split to `'9'`, which
  //    matched no cell in `'00'…'23'`. The hour column then had NO tab stop at
  //    all (`tabIndexFor` found no current cell), and ↓ in it started from the
  //    top and selected `01:30` instead of `10:30`.
  readonly currentHour   = computed(() => (this.value().split(':')[0] || '09').padStart(2, '0'));
  readonly currentMinute = computed(() => (this.value().split(':')[1] || '00').padStart(2, '0'));
  readonly currentSecond = computed(() => (this.value().split(':')[2] || '00').padStart(2, '0'));

  /**
   * Which half of the clock the value falls in.
   *
   * Derived, not stored. As an independent signal it drifted out of sync the
   * moment a value arrived from anywhere but the AM/PM buttons: a `[value]` of
   * "14:00" left the panel highlighting AM while the hour column highlighted 02,
   * and clicking that 02 then quietly moved the time to 02:00.
   */
  readonly period = computed<'AM' | 'PM'>(() =>
    parseInt(this.currentHour(), 10) >= 12 ? 'PM' : 'AM',
  );

  /**
   * The trigger's text — the same canonical spelling the panel's field shows.
   *
   * ★★ ONE FORMATTER, NOT TWO. This used to rebuild the text from the raw
   *    value, so a host value of `9:30` (a one-digit hour `toMinutes` accepts)
   *    showed `9:30` / `9:30 AM` on the trigger while the field showed
   *    `09:30` / `09:30 AM` — and `withSeconds` over a value with no seconds
   *    rendered `…:undefined`. `typedText` pads every part, so the two can no
   *    longer disagree.
   */
  readonly displayValue = computed(() => this.typedText());

  readonly visibleHours = computed(() =>
    this.format() === '12h' ? this.hours12 : this.hours24
  );

  readonly _uid = svUniqueId('sv-tp');

  // ── ControlValueAccessor ──
  private _onChange: (v: string) => void = () => { /* replaced by registerOnChange */ };
  private _onTouched: () => void = () => { /* replaced by registerOnTouched */ };
  private readonly _formDisabled = signal(false);
  /** Merged disabled — the `[disabled]` input OR a disabled parent FormControl. */
  readonly resolvedDisabled = computed(() => this.disabled() || this._formDisabled());

  writeValue(v: string): void { if (v) this.value.set(v); }
  registerOnChange(fn: (v: string) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this._formDisabled.set(isDisabled); }

  /** Accessible name for the trigger — combines the field name with the value. */
  readonly triggerAriaLabel = computed<string | null>(() => {
    const name = this.label();
    if (!name) return null;
    return this.value() ? `${name}: ${this.value()}` : name;
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

  // ── Global listeners ──

  @HostListener('document:mousedown', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (!this.open()) return;
    const t = e.target as Node;
    // A surface opened FROM this popup is not outside it (`X-4`).
    if (this._stackedPopup.isInsideHigherSurface(t)) return;
    if (this.el.nativeElement.contains(t)) return;
    if (this.portalEl?.contains(t)) return;
    this.close();
  }

  /**
   * On the document, not the host: the panel is portalled into <body>, so a key
   * pressed once focus has moved into it never bubbles through this element.
   */
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

  // ── Position calculation ──

  private _calcPos(): void {
    const trigger = this.el.nativeElement.querySelector('[data-trigger]') as HTMLElement
      ?? this.el.nativeElement;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const above = spaceBelow < PANEL_H && spaceAbove > spaceBelow;
    const right  = rect.left + PANEL_W > vw;

    this.openAbove.set(above);
    this.alignRight.set(right);

    const style: Record<string, string> = {
      position: 'fixed',
      zIndex:   '9999',
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

  // ── Public API ──

  toggle(): void {
    if (this.resolvedDisabled()) return;
    if (this.open()) { this.close(); return; }

    // Seed the text field from the value BEFORE the panel renders, so it opens
    // showing the current time rather than blank-then-filled.
    this.draft.set(this.typedText());
    this.draftInvalid.set(false);

    this._calcPos();

    // Mount the panel into document.body via a lightweight portal.
    if (!this.panelTpl) return;

    this.portalEl = document.createElement('div');
    this.portalEl.className = 'sv-tp-portal';

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
    if (this.typed()) this.focusTypedDeferred();
  }

  close(): void {
    this.destroyPortal();
    this.open.set(false);
    this._onTouched();
  }

  /**
   * Focus the text field once the panel is in the document.
   *
   * ⚠️ Deferred, because `toggle()` appends the portal and the element does not
   *    exist until then — and focusing a detached node silently does nothing.
   *    `requestAnimationFrame` rather than `setTimeout(0)`: the panel's position
   *    is calculated in the same frame, and focusing before that runs scrolls
   *    the page to wherever the panel briefly was.
   */
  private focusTypedDeferred(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => {
      this.portalEl?.querySelector<HTMLInputElement>('[data-typed]')?.focus();
    });
  }

  // ── The [min, max] window ─────────────────────────────────────────────────
  //
  // `min` and `max` were published inputs — they appear in the generated API
  // docs with descriptions — that nothing in this component ever read. Setting
  // them changed nothing at all: every hour and minute stayed selectable.

  private readonly minMinutes = computed(() => toMinutes(this.min()));
  private readonly maxMinutes = computed(() => toMinutes(this.max()));

  /** Pull a minutes-since-midnight value into the configured window. */
  private clampToWindow(t: number): number {
    const lo = this.minMinutes();
    const hi = this.maxMinutes();
    if (lo !== null && t < lo) return lo;
    if (hi !== null && t > hi) return hi;
    return t;
  }

  /** The 24-hour value an hour cell would select, given the current period. */
  private resolveHour(h: string): number {
    let hour = parseInt(h, 10);
    if (this.format() === '12h') {
      if (this.period() === 'PM' && hour !== 12) hour += 12;
      if (this.period() === 'AM' && hour === 12) hour = 0;
    }
    return hour;
  }

  /** True when no minute inside this hour satisfies the window. */
  isHourDisabled(h: string): boolean {
    const hour = this.resolveHour(h);
    const lo = this.minMinutes() ?? 0;
    const hi = this.maxMinutes() ?? 24 * 60 - 1;
    return hour * 60 + 59 < lo || hour * 60 > hi;
  }

  /** True when this minute, at the hour already selected, is outside the window. */
  isMinuteDisabled(m: string): boolean {
    const t = parseInt(this.currentHour(), 10) * 60 + parseInt(m, 10);
    return this.clampToWindow(t) !== t;
  }

  /** True when no time in this half of the clock satisfies the window. */
  isPeriodDisabled(p: 'AM' | 'PM'): boolean {
    const lo = this.minMinutes() ?? 0;
    const hi = this.maxMinutes() ?? 24 * 60 - 1;
    const start = p === 'AM' ? 0 : 12 * 60;
    const end   = p === 'AM' ? 12 * 60 - 1 : 24 * 60 - 1;
    return end < lo || start > hi;
  }

  // ── Roving focus in the columns ───────────────────────────────────────────
  //
  // ★★★ THE OTHER HALF OF THE 146 TAB STOPS. Every cell was a `<button>` in
  //     document order with no `tabindex` management and no key handler, so
  //     Tab was the only way through a column and there were up to 60 of them.
  //     One tab stop per column, arrow keys within it, is the `listbox`
  //     pattern these columns already look like.
  //
  // ⚠️ The cells stay `<button>`s rather than becoming `role="option"`. A
  //    listbox needs a single owning element with `aria-activedescendant` or
  //    real focus management across `option` children, and half-applying the
  //    role — options with no listbox parent — announces worse than plain
  //    buttons do. The roving tabindex is the part that pays for itself here;
  //    the full listbox rewrite belongs with `FI-28-M4`'s panel work.

  /** Which cell in each column carries `tabindex="0"`. */
  tabIndexFor(column: 'hours' | 'minutes' | 'seconds', item: string): number {
    const active =
      column === 'hours' ? this.activeHourCell()
      : column === 'minutes' ? this.currentMinute()
      : this.currentSecond();
    return item === active ? 0 : -1;
  }

  /** The hour cell that is "current", in whichever format the column shows. */
  private readonly activeHourCell = computed<string>(() => {
    const h = parseInt(this.currentHour(), 10);
    if (this.format() !== '12h') return this.currentHour();
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return h12.toString().padStart(2, '0');
  });

  /**
   * Arrow / Home / End / PageUp / PageDown inside one column.
   *
   * ★★ IT MOVES THE SELECTION, NOT JUST THE FOCUS. These columns have no
   *    separate cursor — the highlighted cell IS the value — so an arrow key
   *    that only moved focus would leave the user pressing Down six times and
   *    seeing nothing change until they pressed Enter. Selecting as you move is
   *    what the pointer already does on click, and what a native `<select>`
   *    does with arrows on every platform but macOS.
   *
   * ⚠️ DISABLED CELLS ARE SKIPPED RATHER THAN LANDED ON. A disabled `<button>`
   *    cannot take focus, so moving the roving tabindex onto one strands focus
   *    on `<body>` — and the handler is on the cell, so every subsequent arrow
   *    key is swallowed too. Same failure the date picker documents on
   *    `clampToWindow`; same answer.
   */
  onColumnKeydown(event: KeyboardEvent, column: 'hours' | 'minutes' | 'seconds'): void {
    const items =
      column === 'hours' ? this.visibleHours()
      : column === 'minutes' ? this.minutes
      : this.seconds;
    const current =
      column === 'hours' ? this.activeHourCell()
      : column === 'minutes' ? this.currentMinute()
      : this.currentSecond();

    const at = items.indexOf(current);
    const from = at < 0 ? 0 : at;
    let to = from;

    switch (event.key) {
      case 'ArrowUp':    to = from - 1; break;
      case 'ArrowDown':  to = from + 1; break;
      case 'PageUp':     to = from - 5; break;
      case 'PageDown':   to = from + 5; break;
      case 'Home':       to = 0; break;
      case 'End':        to = items.length - 1; break;
      default: return;
    }
    event.preventDefault();

    // Clamp rather than wrap. A column is a range of values, not a carousel:
    // arrowing up from 00 to 59 changes the hour by an hour in the user's head
    // and does not here, which is the kind of surprise that gets clicked past.
    to = Math.max(0, Math.min(items.length - 1, to));
    const step = to >= from ? 1 : -1;
    const reachable = (i: number): boolean => !this.isColumnCellDisabled(column, items[i]);

    // Step OVER a disabled target, further in the direction of travel…
    let land = to;
    while (land >= 0 && land < items.length && !reachable(land)) land += step;

    /**
     * …and when nothing is reachable that way, settle on the nearest reachable
     * cell SHORT of the target rather than not moving at all.
     *
     * ★★ THIS USED TO GIVE UP. With a window of 08:55–17:00, End in the hour
     *    column aimed at 23, found every hour past it disabled too, and
     *    returned — so End did nothing and Home did nothing, in exactly the
     *    columns where a window makes the ends worth jumping to. The nearest
     *    reachable cell on the way back (17, and 08) is what "the end" means
     *    once the ends themselves are out of reach.
     */
    if (land < 0 || land >= items.length) {
      land = to;
      while (land !== from && !reachable(land)) land -= step;
      if (land === from) return;   // nothing between here and there either
    }

    this.selectColumnCell(column, items[land]);
    this.focusColumnCellDeferred(column, items[land]);
  }

  private isColumnCellDisabled(column: 'hours' | 'minutes' | 'seconds', item: string): boolean {
    if (column === 'hours') return this.isHourDisabled(item);
    if (column === 'minutes') return this.isMinuteDisabled(item);
    return false; // seconds are not bounded by [min, max], which is minute-grained
  }

  private selectColumnCell(column: 'hours' | 'minutes' | 'seconds', item: string): void {
    if (column === 'hours') this.selectHour(item);
    else if (column === 'minutes') this.selectMinute(item);
    else this.selectSecond(item);
  }

  private focusColumnCellDeferred(column: string, item: string): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    requestAnimationFrame(() => {
      this.portalView?.detectChanges();
      this.portalEl
        ?.querySelector<HTMLElement>(`[data-col="${column}"] [data-cell="${item}"]`)
        ?.focus();
    });
  }

  // ── Typed entry ───────────────────────────────────────────────────────────
  //
  // ★★★ The panel's text field. It is the FIRST focusable thing in the panel
  //     and it takes focus on open, so the keyboard path to any time is
  //     Tab → Enter → type → Enter, whatever the time is. The columns stay for
  //     the pointer, and for the user who would rather pick than type.

  /** What is in the text field. Not the value: the value only changes on commit. */
  readonly draft = signal<string>('');
  /** True once a commit has been attempted and refused. Cleared on the next edit. */
  readonly draftInvalid = signal(false);

  /**
   * ⚠️ THE FIELD IS NOT PARSED ON EVERY KEYSTROKE, and that is deliberate.
   *    "1" is a valid time and so is "14", so a control that committed as you
   *    typed would set 01:00 on the way to 14:30 — and with `[(value)]` bound
   *    to a form, emit it. Commit happens on Enter and on blur; typing only
   *    clears the invalid mark so the field stops shouting while being fixed.
   */
  onTypedInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
    if (this.draftInvalid()) this.draftInvalid.set(false);
  }

  /**
   * Commit the text field, or mark it invalid and keep the text.
   *
   * ★★★ A REFUSED TIME IS NOT REWRITTEN. `25:00` stays `25:00` in the field
   *     with `aria-invalid`, rather than being clamped to `23:59` — clamping
   *     looks like acceptance, and the user walks away believing they set a
   *     time they did not set. The parser returns `null` for exactly this
   *     reason; see `svParseTime`.
   *
   * ⚠️ THE WINDOW IS A DIFFERENT KIND OF REFUSAL FROM A MALFORMED TIME. A time
   *    outside `[min, max]` is well-formed and merely unavailable, so it is
   *    CLAMPED like every other path in this component (`emit` does it) rather
   *    than refused — the host asked for that clamp when it set the bounds.
   */
  commitTyped(): boolean {
    const text = this.draft().trim();
    if (!text) {
      // An emptied field is a cancelled edit, not a request to clear the value.
      this.draft.set(this.typedText());
      this.draftInvalid.set(false);
      return true;
    }
    const parsed = svParseTime(text);
    if (!parsed) {
      this.draftInvalid.set(true);
      return false;
    }
    // Always 0–23: `svParseTime` refuses an hour above 23 without a period and
    // outside 1–12 with one, so there is no out-of-range hour left to refuse.
    const hour = svResolveHour24(parsed, this.format() === '12h' ? this.period() : null);
    this.draftInvalid.set(false);

    /**
     * ★★★ A COMMIT THAT CHANGES NOTHING MUST EMIT NOTHING, and this is not a
     *     micro-optimisation — it is the bug the blur handler created. The
     *     field commits on blur, and CLICKING ANY CELL IN THE PANEL BLURS IT,
     *     so every hour, minute, second and AM/PM click fired a no-op commit
     *     first. Caught by an existing spec that asserts a minute change is
     *     reported ONCE: it saw `['09:00', '09:45']`.
     *
     *     A spurious emission is not cosmetic here. `changed` is an `output`,
     *     `_onChange` is the CVA hook, and a reactive form marks the control
     *     DIRTY on every call — so opening the panel and clicking anything
     *     would dirty a form the user had not changed, and "unsaved changes"
     *     guards would fire on a value nobody touched.
     */
    const next = this.withSeconds()
      ? svFormatTime(hour, parsed.minute, parsed.second, true)
      : svFormatTime(hour, parsed.minute, 0);
    if (next === this.value()) {
      this.draft.set(this.typedText());
      return true;
    }

    this.emit(
      hour.toString().padStart(2, '0'),
      parsed.minute.toString().padStart(2, '0'),
      parsed.second.toString().padStart(2, '0'),
    );
    // Re-read from the value, so the field shows the canonical form of what was
    // accepted — and shows the CLAMPED time when the window moved it.
    this.draft.set(this.typedText());
    return true;
  }

  onTypedKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.commitTyped()) this.close();
      return;
    }
    if (event.key === 'Escape') {
      // Abandon the edit, keep the value. The document-level Escape handler
      // closes the panel; this just makes sure the field does not commit.
      this.draft.set(this.typedText());
      this.draftInvalid.set(false);
    }
  }

  /** The canonical text for the current value, in the configured format. */
  readonly typedText = computed<string>(() => {
    const v = this.value();
    if (!v) return '';
    const [h, m, sec] = v.split(':');
    const hour = parseInt(h, 10);   // `split` always yields a first element
    if (this.format() === '12h') {
      const h12 = hour % 12 === 0 ? 12 : hour % 12;
      const p = hour >= 12 ? 'PM' : 'AM';
      const core = this.withSeconds()
        ? `${h12.toString().padStart(2, '0')}:${m}:${sec ?? '00'}`
        : `${h12.toString().padStart(2, '0')}:${m}`;
      return `${core} ${p}`;
    }
    return svFormatTime(hour, parseInt(m ?? '0', 10), parseInt(sec ?? '0', 10), this.withSeconds());
  });

  /**
   * A worked example of the accepted forms, as the field's own hint.
   *
   * ★ Not a `placeholder` alone: a placeholder disappears the moment the field
   *   has content, which is exactly when somebody is getting the format wrong.
   *   This is rendered as persistent help text and referenced by
   *   `aria-describedby`.
   */
  readonly typedHint = computed<string>(() =>
    this.format() === '12h'
      ? (this.withSeconds() ? 'e.g. 2:30:15 PM' : 'e.g. 2:30 PM')
      : (this.withSeconds() ? 'e.g. 14:30:15' : 'e.g. 14:30'),
  );

  // ── Selection ─────────────────────────────────────────────────────────────

  selectHour(h: string): void {
    if (this.isHourDisabled(h)) return;
    this.emit(this.resolveHour(h).toString().padStart(2, '0'), this.currentMinute(), this.currentSecond());
  }

  selectMinute(m: string): void {
    if (this.isMinuteDisabled(m)) return;
    this.emit(this.currentHour(), m, this.currentSecond());
  }

  selectSecond(s: string): void { this.emit(this.currentHour(), this.currentMinute(), s); }

  togglePeriod(p: 'AM' | 'PM'): void {
    if (this.isPeriodDisabled(p)) return;
    const hour = parseInt(this.currentHour(), 10);
    let newHour = hour;
    if (p === 'PM' && hour < 12) newHour = hour + 12;
    if (p === 'AM' && hour >= 12) newHour = hour - 12;
    this.emit(newHour.toString().padStart(2, '0'), this.currentMinute(), this.currentSecond());
    // `period` follows the value, so it is already showing `p` by now.
  }

  /**
   * Every path that changes the time goes through here — hour, minute, period,
   * Now — which makes this the one place the window has to be enforced.
   */
  private emit(h: string, m: string, s: string): void {
    const t = this.clampToWindow(parseInt(h, 10) * 60 + parseInt(m, 10));
    const hh = Math.floor(t / 60).toString().padStart(2, '0');
    const mm = (t % 60).toString().padStart(2, '0');
    const v = this.withSeconds() ? `${hh}:${mm}:${s}` : `${hh}:${mm}`;
    this.value.set(v);
    this.changed.emit(v);
    this._onChange(v);
  }

  now(): void {
    const d = new Date();
    this.emit(
      d.getHours().toString().padStart(2, '0'),
      d.getMinutes().toString().padStart(2, '0'),
      d.getSeconds().toString().padStart(2, '0'),
    );
  }

  isActiveHour(h: string): boolean {
    if (this.format() === '12h') {
      const dispH = parseInt(this.currentHour(), 10);
      const h12 = dispH === 0 ? 12 : dispH > 12 ? dispH - 12 : dispH;
      return h12.toString().padStart(2, '0') === h;
    }
    return this.currentHour() === h;
  }

  readonly triggerClass = computed(() => ({
    sm: 'h-8 px-2.5 text-xs rounded-lg gap-1.5',
    md: 'h-10 px-3 text-sm rounded-xl gap-2',
    lg: 'h-12 px-4 text-base rounded-xl gap-2.5',
  }[this.size()]));

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
  // This control had no error slot at all: a form could reject it with no way
  // to say why. `serverError` outranks `errorMessage` while it is still about
  // the current value, and expires on the next change — see `createFieldError`.

  /** Client-side validation message. */
  errorMessage = input<string>('');
  /** A rejection reported by the server about this value. Self-expiring. */
  serverError = input<SvServerError>(null);

  protected readonly fieldError = createFieldError(this.value, this.serverError, this.errorMessage);
  protected readonly errorId = computed(() => `${this._errUid}-error`);
  private readonly _errUid = svUniqueId('sv-time-picker');

}
