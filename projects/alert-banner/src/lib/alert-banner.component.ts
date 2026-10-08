import {
  AfterViewInit,
  Component,
  ElementRef,
  effect,
  input,
  output,
  computed,
  signal,
  ChangeDetectionStrategy,
  OnDestroy,
  OnInit,
  inject,
  PLATFORM_ID,
  untracked,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser, NgClass } from '@angular/common';
import {
  createFocusScope,
  SvBannerStackService,
  SvLiveAnnouncer,
  svAnnouncePriorityFor,
  svWarnOnce,
  type SvBannerHandle,
  type SvBannerSlot,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertVariant  = 'info' | 'success' | 'warning' | 'danger' | 'neutral';
export type AlertStyle    = 'soft' | 'solid' | 'outline' | 'left-accent' | 'top-accent' | 'announcement';
export type AlertSize     = 'sm' | 'md' | 'lg';
export type AlertPosition = 'inline' | 'top-fixed' | 'bottom-fixed' | 'top-sticky';

/** A single action button rendered inside the alert. */
export interface AlertAction {
  label:    string;
  /** @default 'primary' */
  style?:   'primary' | 'ghost';
  /** Emits the action's id back to the consumer. */
  id:       string;
}

// ─── Icon paths (inline SVG d="" attributes keyed by variant) ────────────────

const VARIANT_ICON_NAMES: Record<AlertVariant, string> = {
  info: 'info', success: 'check-circle', warning: 'alert-triangle', danger: 'alert-triangle', neutral: 'info',
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * AlertBanner — A flexible notification strip for system messages,
 * form feedback, broadcast notices, and inline contextual alerts.
 *
 * Features:
 * - 5 semantic variants × 5 visual styles
 * - Inline, top-fixed, bottom-fixed, and sticky positioning modes
 * - Optional icon (auto per variant, or custom SVG path)
 * - Optional title + body text or projected <ng-content>
 * - Up to 2 action buttons with separate primary / ghost styles
 * - Dismissible with animated collapse
 * - Auto-dismiss after configurable timeout
 * - Full dark-mode support
 */

/** Duration in ms for the CSS dismiss transition — must match `duration-300` in the template. */
const DISMISS_TRANSITION_MS = 300;

/**
 * Reading-time floor for a timed banner, per character of title + message
 * (`OF-01-I7`). ~60 ms/char is roughly 180 words a minute — a slow, careful
 * reading pace, which is the one a timeout has to allow for.
 */
export const SV_ALERT_READING_MS_PER_CHAR = 60;

/** What counts as "something to do" inside projected content (`OF-01-I7`). */
const INTERACTIVE_SELECTOR =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

@Component({
  selector: 'sv-alert-banner',
  standalone: true,
  imports: [NgClass, SvIconComponent],
  templateUrl: './alert-banner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class SvAlertBannerComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly _banners = inject(SvBannerStackService);

  // ── Content ───────────────────────────────────────────────────────────────

  /** Bold heading line. Leave empty to render body-only. */
  title       = input<string>('');

  /** Main alert message text. */
  message     = input<string>('');

  // ── Appearance ────────────────────────────────────────────────────────────

  /** Semantic color. @default 'info' */
  variant  = input<AlertVariant>('info');

  /** Visual treatment. @default 'soft' */
  alertStyle = input<AlertStyle>('soft');

  /** Size controls padding and text scale. @default 'md' */
  size     = input<AlertSize>('md');

  /**
   * Positioning mode.
   * - `inline`        — block element in document flow (default)
   * - `top-fixed`     — fixed to viewport top, full width
   * - `bottom-fixed`  — fixed to viewport bottom, full width
   * - `top-sticky`    — sticky inside its scroll container
   * @default 'inline'
   */
  position = input<AlertPosition>('inline');

  // ── Icon ──────────────────────────────────────────────────────────────────

  /**
   * Show the leading icon. @default true
   * Set to false to suppress it entirely.
   */
  showIcon   = input<boolean>(true);

  /**
   * Icon-library NAME overriding the default variant icon — e.g. `'bell'`.
   * Leave empty to use the built-in icon for the current variant.
   *
   * ★ BREAKING (icon sweep): was `iconPath`, a raw `<path d="…">`. `iconViewBox`
   * is GONE — it only existed because a raw path might not be 24-box.
   */
  icon       = input<string>('');

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Up to 2 action buttons rendered inline.
   * Each button emits its `id` via `actionClick`.
   */
  actions    = input<AlertAction[]>([]);

  // ── Dismiss ───────────────────────────────────────────────────────────────

  /** Show the × close button. @default true */
  dismissible = input<boolean>(true);

  /**
   * Auto-dismiss after N milliseconds.
   * Set to 0 to disable auto-dismiss. @default 0
   *
   * ⚠️ IGNORED for a `danger` banner, for any banner with `actions`, and for
   * one whose projected content holds a link, button or field — see
   * `autoDismissRefused`. Never shorter than `readingTimeMs`. The rule
   * (`OF-01-I7`): only a short, informational message that asks nothing of
   * the user may time out.
   */
  autoDismissMs = input<number>(0);

  // ── Stacking (`X-12`, `OF-01-I1`, `OF-01-M1`, `OF-01-M2`) ─────────────────

  /**
   * Stack weight for a pinned banner: higher sits against the edge.
   * @default 0
   *
   * ★ Only consulted when `position` is one of the pinned modes. An `inline`
   *   banner is in the document flow and cannot collide with anything.
   */
  priority = input<number>(0);

  /**
   * Identity for suppressing a duplicate pinned banner (`OF-01-M2`).
   *
   * | Value     | Meaning                                                    |
   * |-----------|------------------------------------------------------------|
   * | omitted   | derive from variant + style + title + message              |
   * | a string  | suppress on that, whatever the text                        |
   * | `null`    | never suppress                                             |
   *
   * ★★ A SUPPRESSED BANNER RENDERS NOTHING — no count, unlike a deduplicated
   *    toast. A toast reports an EVENT, so "it happened eleven times" is
   *    information; a banner reports a STATE, and "your trial expires ×2" is
   *    not a thing that can be true.
   */
  dedupeKey = input<string | null | undefined>(undefined);

  // ── Extra ─────────────────────────────────────────────────────────────────

  /** Additional CSS classes merged on the root element. */
  customClass = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted after the alert finishes its close animation. */
  dismissed   = output<void>();

  /** Emitted when an action button is clicked, carrying the action `id`. */
  actionClick = output<string>();

  // ── Internal state ────────────────────────────────────────────────────────

  readonly isVisible  = signal(true);
  readonly isClosing  = signal(false);

  private autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
  /** Tracks the close-transition timer so it can be cancelled on destroy. */
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  /** This banner's own element — it dismisses itself, so it is its own scope. */
  private readonly el = inject(ElementRef<HTMLElement>);
  /**
   * Where focus goes when the banner removes itself from under it.
   *
   * ★ No `opener` and no `below`: an in-place removal has neither. The only
   *   honest answer is the nearest part of the page that outlived the banner,
   *   which is the scope's ancestor walk. See `X-6` / `OF-01-I3`.
   */
  /**
   * The one place that speaks. See `X-9` / `OF-01-M6`.
   *
   * ★ `scoped()` so nothing held is spoken after this banner is gone — an
   *   auto-dismissing banner is exactly the case.
   */
  private readonly _live = inject(SvLiveAnnouncer).scoped();

  private readonly _focusScope = createFocusScope({
    within: () => this.el.nativeElement,
    // ★ And `skip` is the same element: this host survives the dismiss — only
    //   the content inside it is removed — so without excluding it the walk
    //   would land on an empty, invisible wrapper and announce nothing.
    skip: () => this.el.nativeElement,
  });

  // ── Stack state ───────────────────────────────────────────────────────────

  /** This banner's place in the pinned stack, or `null` while inline. */
  private _stack: SvBannerHandle | null = null;
  private readonly _offset     = signal(0);
  private readonly _suppressed = signal(false);
  private _resizeObserver: ResizeObserver | null = null;

  /** Pixels from this banner's edge. 0 when it is the one against the edge. */
  readonly stackOffset = computed(() => this._offset());

  /**
   * True when an identical pinned banner got there first — it renders nothing.
   */
  readonly suppressed = computed(() => this._suppressed());

  /**
   * The pinned slot this banner occupies, or `null` for `inline`.
   *
   * ★ `top-sticky` is a slot of its own rather than being folded into
   *   `top-fixed`: a sticky banner scrolls with its container and a fixed one
   *   does not, so offsetting one by the other's height puts a gap on screen
   *   the moment the user scrolls.
   */
  private readonly _slot = computed<SvBannerSlot | null>(() => {
    const pos = this.position();
    return pos === 'inline' ? null : pos;
  });

  /**
   * Whether `autoDismissMs` is honoured (`OF-01-I7`).
   *
   * ★★★ IT IS REFUSED, NOT WARNED ABOUT. A 1500 ms auto-dismiss on a `danger`
   *     banner with two actions was accepted silently: the message that
   *     mattered most vanished fastest, and it took its own actions with it
   *     before the user could reach them. A warning in a console the consumer
   *     is not looking at does not stop that shipping.
   *
   * ★★ THE TWO CONDITIONS ARE DIFFERENT FAILURES. A `danger` banner is a state
   *    the user has to know about — it does not stop being true after four
   *    seconds. A banner with ACTIONS is a thing to do, and a control that
   *    removes itself while being aimed at is a control that cannot be used —
   *    the same defect as a disappearing toast action, with more at stake.
   *
   * ★ Everything else keeps its countdown, which the banner already pauses on
   *   hover and on focus (WCAG 2.2.1). A short-lived `success` strip is a
   *   legitimate thing to want.
   */
  readonly autoDismissRefused = computed<boolean>(() =>
    this.autoDismissMs() > 0 &&
    (this.variant() === 'danger' || this.actions().length > 0 || this._projectedInteractive()),
  );

  /**
   * ★★ PROJECTED CONTROLS ARE ACTIONS TOO. The refusal looked only at the
   *    `actions` input, so `<sv-alert-banner [autoDismissMs]="4000"><a
   *    href="/billing">Update card</a></sv-alert-banner>` — the same "thing to
   *    do" written as content — still removed its own link from under the
   *    pointer. Checked once the projected content has rendered.
   */
  private readonly _projectedInteractive = signal(false);

  /**
   * Minimum countdown the text needs to be read (`OF-01-I7`): the title and
   * message length × `SV_ALERT_READING_MS_PER_CHAR`. A timed banner never
   * dismisses faster than this, whatever `autoDismissMs` says — a 1500 ms
   * countdown on three sentences is a message nobody finishes.
   */
  readonly readingTimeMs = computed<number>(
    () => (this.title().length + this.message().length) * SV_ALERT_READING_MS_PER_CHAR,
  );

  /** The countdown actually used: 0 when refused, never below `readingTimeMs`. */
  readonly effectiveAutoDismissMs = computed<number>(() => {
    const ms = this.autoDismissMs();
    if (this.autoDismissRefused() || !(ms > 0)) return 0;
    return Math.max(ms, this.readingTimeMs());
  });

  constructor() {
    // Join or leave the pinned stack as `position`, `priority` or the dedupe
    // key change. Re-registering rather than mutating: the stack's ordering is
    // decided at registration, and a banner whose priority changes mid-life is
    // a new banner as far as the ordering is concerned.
    effect(() => {
      const slot = this._slot();
      const priority = this.priority();
      const key = this._resolvedDedupeKey();

      this._stack?.release();
      this._stack = null;

      if (slot === null) {
        this._offset.set(0);
        this._suppressed.set(false);
        return;
      }

      const handle = this._banners.register({ slot, priority, dedupeKey: key });
      this._stack = handle;
      // ★ The two signals are MIRRORED rather than read straight from the
      //   handle, because the handle is replaced on every re-registration and a
      //   template bound to `handle.offset` would be bound to a dead computed.
      this._offset.set(handle.offset());
      this._suppressed.set(handle.suppressed());
    });

    // The strip comes and goes (suppressed, closing) — keep watching whichever
    // one is on screen, so a promoted duplicate reports its real height.
    effect(() => {
      const strip = this._stripRef()?.nativeElement ?? null;
      untracked(() => this._observe(strip));
    });

    // Follow this banner's own place in the stack as others come and go.
    effect(() => {
      const handle = this._stack;
      if (!handle) return;
      this._offset.set(handle.offset());
      this._suppressed.set(handle.suppressed());
    });

    effect(() => {
      if (!this.autoDismissRefused()) return;
      svWarnOnce(
        'alert-banner-auto-dismiss-refused',
        `<sv-alert-banner> ignored autoDismissMs: a "danger" banner, or one with actions or projected links/buttons, ` +
          `must not remove itself. A state the user has to know about does not stop being ` +
          `true after a few seconds, and a control cannot be used if it disappears while ` +
          `being aimed at. Use [dismissible]="true" and let the user close it.`,
      );
    });
  }

  /** Suppression key: the host's, or one derived from what is rendered. */
  private readonly _resolvedDedupeKey = computed<string | null>(() => {
    const stated = this.dedupeKey();
    if (stated !== undefined) return stated;
    return [this.variant(), this.alertStyle(), this.title(), this.message()].join('\x00');
  });

  /** Wall-clock time the current auto-dismiss countdown was (re)started. */
  private autoDismissStartedAt = 0;
  /** Milliseconds left on the auto-dismiss countdown while paused. */
  private autoDismissRemaining = 0;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  // ★ Announcing and the countdown both moved from `ngOnInit` to
  //   `ngAfterViewInit`: the first needs to know whether this banner is a
  //   suppressed duplicate (`OF-01-I4`), the second whether its projected
  //   content holds a control (`OF-01-I7`), and neither is known in `ngOnInit`.

  /** Guards the once-only work in `ngAfterViewInit`, which a host may re-call. */
  private _started = false;

  /**
   * Arms the once-only start that `ngAfterViewInit` performs.
   *
   * @deprecated Kept so the public member list is unchanged. Announcing and
   * the countdown now start once, in `ngAfterViewInit` (`OF-01-I4`,
   * `OF-01-I7`), so calling this by hand no longer announces or restarts the
   * timer on its own: it only re-arms that start for the next
   * `ngAfterViewInit` call. To show a banner again, re-create it (`@if`).
   */
  ngOnInit(): void {
    this._started = false;
  }

  ngAfterViewInit(): void {
    // ★ SSR: no element to measure and no viewport to place it in.
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this._started) {
      this._started = true;
      this._projectedInteractive.set(this._hasProjectedControl());
      // ★★ A SUPPRESSED DUPLICATE SAYS NOTHING (`OF-01-I4`). It renders
      //    nothing either, and the announcer's own dedupe window is one
      //    second — a route mounting the same banner as the shell ten seconds
      //    later re-read a message that was not even on screen.
      if (!this.suppressed()) this._announce();
      const ms = this.effectiveAutoDismissMs();
      if (ms > 0) {
        this.autoDismissRemaining = ms;
        this.startAutoDismiss();
      }
    }
    this._viewReady = true;
    this._observe(this._stripRef()?.nativeElement ?? null);
  }

  /** The strip element — what is actually painted, and what has a height. */
  private readonly _stripRef = viewChild<ElementRef<HTMLElement>>('strip');
  private _viewReady = false;
  private _observed: HTMLElement | null = null;

  /**
   * Watch the strip's size (`OF-01-I1` / `OF-01-M1`).
   *
   * ★★★ IT MEASURED THE HOST, AND THE HOST IS 0 px TALL. For `top-fixed` and
   *     `bottom-fixed` the strip inside is `position: fixed` — out of flow —
   *     so `<sv-alert-banner>` itself collapses to nothing, every reported
   *     height was 0, and every pinned banner sat at offset 0: the original
   *     overlap, back in every real browser. The specs stubbed `offsetHeight`
   *     on the host, which is exactly the element that never has one.
   */
  private _observe(strip: HTMLElement | null): void {
    if (!this._viewReady) return;
    if (strip !== this._observed) {
      if (this._resizeObserver && this._observed) this._resizeObserver.unobserve(this._observed);
      this._observed = strip;
      if (strip) {
        if (!this._resizeObserver && typeof ResizeObserver !== 'undefined') {
          this._resizeObserver = new ResizeObserver(() => this._measure());
        }
        this._resizeObserver?.observe(strip);
      }
    }
    this._measure();
  }

  private _hasProjectedControl(): boolean {
    const own = this.el.nativeElement.querySelectorAll('[data-sv-alert-control]');
    const all = this.el.nativeElement.querySelectorAll(INTERACTIVE_SELECTOR);
    return all.length > own.length;
  }

  /** Tell the stack how tall this banner actually is. */
  private _measure(): void {
    const height = this._stripRef()?.nativeElement.offsetHeight ?? 0;
    this._stack?.measured(height);
    // Re-read: our own height changes where the banners BELOW us sit, and
    // theirs is what our own offset is made of when we are not first.
    if (this._stack) this._offset.set(this._stack.offset());
  }

  // ── Auto-dismiss timer control (WCAG 2.2.1 — pausable on hover/focus) ───────

  private startAutoDismiss(): void {
    if (this.autoDismissRemaining <= 0) return;
    this.autoDismissStartedAt = Date.now();
    this.autoDismissTimer = setTimeout(() => this.close(), this.autoDismissRemaining);
  }

  // ★ TWO REASONS, NOT ONE (the regression Toast already fixed as T0-1): hover
  //   the banner, tab into its dismiss button, move the mouse away — the old
  //   single pause resumed on `mouseleave` while focus was still inside, and a
  //   countdown ran out under the keyboard user.
  private _hovering = false;
  private _focusWithin = false;

  /** Pointer/focus handlers bound by the template. */
  protected onPauseReason(reason: 'hover' | 'focus', active: boolean): void {
    if (reason === 'hover') this._hovering = active;
    else this._focusWithin = active;
    if (this._hovering || this._focusWithin) this.pauseAutoDismiss();
    else this.resumeAutoDismiss();
  }

  /** Pause the auto-dismiss countdown (e.g. on hover/focus), preserving remaining time. */
  pauseAutoDismiss(): void {
    if (this.effectiveAutoDismissMs() <= 0 || this.autoDismissTimer === null) return;
    clearTimeout(this.autoDismissTimer);
    this.autoDismissTimer = null;
    this.autoDismissRemaining -= Date.now() - this.autoDismissStartedAt;
  }

  /** Resume the auto-dismiss countdown with the time that was left. */
  resumeAutoDismiss(): void {
    if (this.effectiveAutoDismissMs() <= 0 || this.autoDismissTimer !== null || this.isClosing()) return;
    this.startAutoDismiss();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  close(): void {
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }

    // ★★★ THE BANNER DISMISSES ITSELF WITH A BUTTON INSIDE ITSELF, so the
    //     element that has focus is the element about to be removed — and
    //     removing the focused node drops focus to `<body>`, where the next Tab
    //     starts again at the top of the page and a screen reader says nothing
    //     at all. `OF-01-I3`. It is the same defect the overlays had, arriving
    //     without a portal or an opener: there is nothing to restore TO except
    //     the region the banner was removed from, which is exactly what the
    //     shared focus scope walks to.
    //
    // ★ Captured HERE, while the DOM is still whole. The scope records the
    //   ancestor chain at capture time because removal SEVERS it: the close
    //   button keeps its parent, but that parent's own link is gone the moment
    //   the banner leaves the page, so a walk attempted afterwards dead-ends
    //   one step up.
    //
    // ★★ AND UNCONDITIONALLY, which is a correction. This first had a guard —
    //    "only if focus is inside me" — and no test could tell it apart from
    //    its absence, because the scope already answers that question better:
    //    focus outside the banner is its own opener, so the restore reports
    //    success and touches nothing. A guard that duplicates a decision made
    //    downstream is a second place for the two to disagree.
    if (isPlatformBrowser(this.platformId)) this._focusScope.capture();

    this.isClosing.set(true);
    // Allow the CSS transition to finish before hiding the element.
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.isVisible.set(false);
      // ★ Released on CLOSE too, not only on destroy: a dismissed banner often
      //   stays instantiated (the host keeps the element and the component just
      //   renders nothing), and a released-only-on-destroy banner would hold a
      //   slot — and a height — for a strip that is no longer visible.
      this._stack?.release();
      this._stack = null;
      this.dismissed.emit();

      // ★★ A MACROTASK, NOT A MICROTASK, and this is the whole subtlety.
      //    `isVisible.set(false)` does not remove anything: change detection
      //    does, and Angular SCHEDULES change detection as a microtask. A
      //    microtask queued here could therefore run BEFORE the removal, find
      //    the close button still attached and still focusable, focus it — and
      //    then the removal would drop focus to `<body>` anyway, one tick
      //    later, with the restore having accomplished nothing.
      if (isPlatformBrowser(this.platformId)) setTimeout(() => this._focusScope.restore());
    }, DISMISS_TRANSITION_MS);
  }

  ngOnDestroy(): void {
    if (this.autoDismissTimer) clearTimeout(this.autoDismissTimer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
    // ★ Leave the stack, or every banner after this one keeps a gap the height
    //   of a banner that is no longer on the page.
    this._stack?.release();
    this._stack = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._observed = null;
  }

  onActionClick(id: string): void {
    this.actionClick.emit(id);
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  /**
   * Icon-library name to draw: the host's override, else the variant default.
   *
   * ★ `VARIANT_ICON_NAMES` and this computed already existed — someone started
   * this migration and never switched the template, so the name map sat here as
   * DEAD CODE while the template drew `resolvedIconPath()` from a parallel map
   * of raw `d` strings. Two ways to name one glyph, and the wrong one was live.
   */
  resolvedIconName = computed<string>(() => this.icon() || VARIANT_ICON_NAMES[this.variant()]);

  // ── Root wrapper classes ──────────────────────────────────────────────────

  wrapperClasses = computed<string>(() => {
    const pos: Record<AlertPosition, string> = {
      'inline':        'w-full',
      'top-fixed':     'fixed top-0 left-0 right-0 z-50 w-full',
      'bottom-fixed':  'fixed bottom-0 left-0 right-0 z-50 w-full',
      'top-sticky':    'sticky top-0 z-40 w-full',
    };
    return [
      pos[this.position()],
      this.isClosing()
        ? 'opacity-0 -translate-y-1 transition-all duration-300 ease-in pointer-events-none'
        : 'opacity-100 translate-y-0 transition-all duration-300 ease-out',
      this.customClass(),
    ].join(' ');
  });

  /**
   * `top` in px for a top-pinned banner, or `null` to leave the class alone.
   *
   * ★ Two bindings rather than one "offset" style, because the edge decides
   *   which property moves: a `bottom-fixed` banner offset by `top` would jump
   *   to the other side of the viewport. `null` means "not this edge", and
   *   Angular removes the style rather than writing `top: 0` over the
   *   positioning class.
   */
  readonly stackTopPx = computed<number | null>(() => {
    const pos = this.position();
    if (pos === 'bottom-fixed' || pos === 'inline') return null;
    return this.stackOffset();
  });

  /** `bottom` in px for a bottom-pinned banner. See `stackTopPx`. */
  readonly stackBottomPx = computed<number | null>(() =>
    this.position() === 'bottom-fixed' ? this.stackOffset() : null,
  );

  // ── Inner shell classes ───────────────────────────────────────────────────

  shellClasses = computed<string>(() => {
    const sizeMap: Record<AlertSize, string> = {
      sm: 'px-3 py-2 text-xs',
      md: 'px-4 py-3 text-sm',
      lg: 'px-5 py-4 text-base',
    };

    const styleVariant = `${this.alertStyle()}:${this.variant()}`;

    const styleMap: Record<string, string> = {
      // ── soft ──
      'soft:info':    'bg-info-50 text-info-900 dark:bg-info-900/30 dark:text-info-200',
      'soft:success': 'bg-accent-50 text-accent-900 dark:bg-accent-900/30 dark:text-accent-200',
      'soft:warning': 'bg-warning-50 text-warning-900 dark:bg-warning-900/30 dark:text-warning-200',
      'soft:danger':  'bg-danger-50 text-danger-900 dark:bg-danger-900/30 dark:text-danger-200',
      'soft:neutral': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',

      // ── solid ──
      // ★ Every row here used to lighten its fill one step for dark mode while
      //   leaving `text-white` alone, so the dark rendering was the WORSE of the
      //   two — sky at 2.71:1, amber at 1.72:1 — and it was the half nobody
      //   measured. A saturated fill needs no dark variant: it reads on either
      //   canvas, which is why the overrides are simply gone. `warning` keeps its
      //   yellow and takes near-black text instead — white is unreadable on
      //   amber-500, and amber-700 is no longer yellow.
      //
      // ★★ Those ratios describe the DEFAULT `warning`, which is amber. The dark
      //    text is the right default because a yellow fill cannot carry white,
      //    but it inverts if a buyer picks a dark warning colour, and no gate
      //    catches that: `check:contrast` measures the token's default value.
      //    A buyer changing `warning` needs to re-check this one pair.
      'solid:info':    'bg-info-700 text-white',
      'solid:success': 'bg-accent-700 text-white',
      'solid:warning': 'bg-warning-500 text-gray-900',
      'solid:danger':  'bg-danger-700 text-white',
      'solid:neutral': 'bg-gray-700 text-white dark:bg-gray-600',

      // ── outline ──
      'outline:info':    'border border-info-400 bg-info-50 text-info-800 dark:border-info-500 dark:bg-info-950/40 dark:text-info-300',
      'outline:success': 'border border-accent-400 bg-accent-50 text-accent-800 dark:border-accent-500 dark:bg-accent-950/40 dark:text-accent-300',
      'outline:warning': 'border border-warning-400 bg-warning-50 text-warning-800 dark:border-warning-500 dark:bg-warning-950/40 dark:text-warning-300',
      'outline:danger':  'border border-danger-400 bg-danger-50 text-danger-800 dark:border-danger-500 dark:bg-danger-950/40 dark:text-danger-300',
      'outline:neutral': 'border border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-300',

      // ── left-accent ──
      'left-accent:info':    'border-l-4 border-info-500 bg-info-50 text-info-900 dark:bg-info-900/25 dark:text-info-200 rounded-r-lg',
      'left-accent:success': 'border-l-4 border-accent-500 bg-accent-50 text-accent-900 dark:bg-accent-900/25 dark:text-accent-200 rounded-r-lg',
      'left-accent:warning': 'border-l-4 border-warning-500 bg-warning-50 text-warning-900 dark:bg-warning-900/25 dark:text-warning-200 rounded-r-lg',
      'left-accent:danger':  'border-l-4 border-danger-500 bg-danger-50 text-danger-900 dark:bg-danger-900/25 dark:text-danger-200 rounded-r-lg',
      'left-accent:neutral': 'border-l-4 border-gray-400 bg-gray-100 text-gray-800 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-200 rounded-r-lg',

      // ── top-accent ──
      'top-accent:info':    'border-t-4 border-info-500 bg-info-50 text-info-900 dark:bg-info-900/25 dark:text-info-200 rounded-b-lg',
      'top-accent:success': 'border-t-4 border-accent-500 bg-accent-50 text-accent-900 dark:bg-accent-900/25 dark:text-accent-200 rounded-b-lg',
      'top-accent:warning': 'border-t-4 border-warning-500 bg-warning-50 text-warning-900 dark:bg-warning-900/25 dark:text-warning-200 rounded-b-lg',
      'top-accent:danger':  'border-t-4 border-danger-500 bg-danger-50 text-danger-900 dark:bg-danger-900/25 dark:text-danger-200 rounded-b-lg',
      'top-accent:neutral': 'border-t-4 border-gray-400 bg-gray-100 text-gray-800 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-200 rounded-b-lg',
    };

    const roundedMap: Partial<Record<AlertStyle, string>> = {
      soft:    'rounded-xl',
      solid:   'rounded-xl',
      outline: 'rounded-xl',
    };

    return [
      'flex items-start gap-3',
      sizeMap[this.size()],
      styleMap[styleVariant] ?? styleMap['soft:info'],
      roundedMap[this.alertStyle()] ?? '',
    ].filter(Boolean).join(' ');
  });

  // ── Icon classes ──────────────────────────────────────────────────────────

  iconColorClass = computed<string>(() => {
    const isSolid = this.alertStyle() === 'solid';
    // Fourth variant-blind solid branch — see `solidFillIsLight`. White at /90
    // is 1.98:1 on the amber fill, under the 3:1 bar for a glyph.
    if (isSolid) return this.solidFillIsLight() ? 'text-gray-900/90' : 'text-white/90';
    const map: Record<AlertVariant, string> = {
      info:    'text-info-500 dark:text-info-400',
      success: 'text-accent-500 dark:text-accent-400',
      warning: 'text-warning-500 dark:text-warning-400',
      danger:  'text-danger-500 dark:text-danger-400',
      neutral: 'text-gray-500 dark:text-gray-400',
    };
    return map[this.variant()];
  });

  iconSizeClass = computed<string>(() => {
    switch (this.size()) {
      case 'sm': return 'h-4 w-4 mt-px';
      case 'lg': return 'h-6 w-6 mt-0.5';
      default:   return 'h-5 w-5 mt-px';
    }
  });

  // ── Action button classes ─────────────────────────────────────────────────

  /**
   * This variant's `solid` fill is LIGHT, so its controls need dark ink.
   *
   * ★★ `solid:warning` is `bg-warning-500` — amber — while the other four solid
   *    rows are 700-step fills. The three control maps below each returned ONE
   *    string for `solid` regardless of variant, which put white ink on amber:
   *    the ghost action at 1.83:1, the primary action at 1.86:1 and the dismiss
   *    glyph at 1.69:1. `shellClasses()` already answers this for the banner's
   *    own text with `text-gray-900`; the controls never got the same treatment,
   *    because a variant-blind branch reads correct until you name the one
   *    variant it is wrong for.
   *
   * ★ Same caveat as the `solid:warning` row itself, and for the same reason:
   *   this follows the token's DEFAULT being a light amber. A buyer who remaps
   *   `warning` to something dark inverts it, and no gate catches that.
   */
  private readonly solidFillIsLight = computed<boolean>(
    () => this.alertStyle() === 'solid' && this.variant() === 'warning'
  );

  primaryActionClass = computed<string>(() => {
    const isSolid = this.alertStyle() === 'solid';
    if (isSolid) {
      // A translucent WHITE chip lightens the fill under it, so white-on-chip
      // measured 3.96:1 on info and 3.68:1 on success. Darkening the chip
      // instead keeps the same recessed-pill look and clears AA on all four
      // dark fills (worst 7.42:1 on success).
      return this.solidFillIsLight()
        ? 'inline-flex items-center rounded-lg bg-white/30 px-3 py-1 text-xs font-semibold text-gray-900 ring-1 ring-inset ring-gray-900/20 hover:bg-white/50 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
        : 'inline-flex items-center rounded-lg bg-black/20 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/30 hover:bg-black/30 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white';
    }
    const map: Record<AlertVariant, string> = {
      info:    'text-info-800 bg-info-100 hover:bg-info-200 dark:text-info-200 dark:bg-info-800/50 dark:hover:bg-info-700/60',
      success: 'text-accent-800 bg-accent-100 hover:bg-accent-200 dark:text-accent-200 dark:bg-accent-800/50 dark:hover:bg-accent-700/60',
      warning: 'text-warning-800 bg-warning-100 hover:bg-warning-200 dark:text-warning-200 dark:bg-warning-800/50 dark:hover:bg-warning-700/60',
      danger:  'text-danger-800 bg-danger-100 hover:bg-danger-200 dark:text-danger-200 dark:bg-danger-800/50 dark:hover:bg-danger-700/60',
      neutral: 'text-gray-800 bg-gray-200 hover:bg-gray-300 dark:text-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600',
    };
    return `inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-current ${map[this.variant()]}`;
  });

  ghostActionClass = computed<string>(() => {
    const isSolid = this.alertStyle() === 'solid';
    if (isSolid) {
      // `text-white/80` was 4.34:1 on info, 4.01:1 on success and 4.38:1 on
      // danger — three near-misses that read as a deliberate "quieter" ink. /90
      // keeps that intent and clears AA (worst 4.67:1 on success).
      return this.solidFillIsLight()
        ? 'inline-flex items-center rounded-lg px-3 py-1 text-xs font-medium text-gray-900/80 hover:text-gray-900 underline-offset-2 hover:underline transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
        : 'inline-flex items-center rounded-lg px-3 py-1 text-xs font-medium text-white/90 hover:text-white underline-offset-2 hover:underline transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white';
    }
    return 'inline-flex items-center rounded-lg px-3 py-1 text-xs font-medium opacity-70 hover:opacity-100 underline-offset-2 hover:underline transition-opacity duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-current';
  });

  // ── Dismiss button classes ────────────────────────────────────────────────

  dismissClass = computed<string>(() => {
    const isSolid = this.alertStyle() === 'solid';
    if (isSolid) {
      // The glyph is non-text content, so the bar is 3:1 rather than 4.5:1.
      // `text-white/70` clears it on all four dark fills (worst 3.44:1 on
      // success) and only amber needed the dark counterpart, at 1.69:1.
      return this.solidFillIsLight()
        ? 'ml-auto shrink-0 rounded-lg p-1 text-gray-900/70 hover:text-gray-900 hover:bg-black/10 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900'
        : 'ml-auto shrink-0 rounded-lg p-1 text-white/70 hover:text-white hover:bg-white/20 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white';
    }
    return 'ml-auto shrink-0 rounded-lg p-1 opacity-50 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-current';
  });

  // ── Announcement ──────────────────────────────────────────────────────────

  /**
   * ★★★ THE BANNER WAS ITS OWN LIVE REGION, CREATED WITH ITS TEXT INSIDE IT.
   *     The whole region sits behind `@if (isVisible())`, so it was inserted
   *     complete — and assistive technology watches an EXISTING region for
   *     changes. `role="alert"` had the same problem for the same reason: it
   *     is an implicit assertive live region. `OF-01-I4` / `OF-01-M6`.
   *
   * ★★ AND IT RE-ANNOUNCED ITSELF. The region's text is bound to inputs, so a
   *     host that re-renders the banner on every state change — the ordinary
   *     shape for a validation summary — repeated the same sentence each
   *     time. The announcer's deduplication is what that item was asking for,
   *     and it is not something the banner could have solved alone: two
   *     banners saying the same thing is the same defect one banner saying it
   *     twice is.
   *
   * ★ `role="status"` stays on the visible node. It is NOT a live region on
   *   its own (only `role="alert"` and an explicit `aria-live` are), and it is
   *   what lets a screen reader user find the banner and reach its actions.
   */
  private _announce(): void {
    const text = [this.title(), this.message()].filter(Boolean).join('. ');
    this._live.announce(text, { priority: svAnnouncePriorityFor(this.variant()) });
  }

  // ── Announcement full-bleed gradient (announcement style) ──────────────────

  /**
   * ★★ These are decorative three-hue sweeps, so only the stops belonging to the
   *    row's OWN family are tokenised. The foreign hues stay literal on purpose:
   *    tokenising `via-indigo-600` as `brandaccent` would make a buyer's brand
   *    accent appear inside an info banner, and tokenising warning's far `rose`
   *    as `danger` would ramp amber → orange → whatever colour they chose for
   *    errors. A decorative stop is not a role, and coupling two roles into one
   *    gradient means one colour choice can produce a clash the buyer never
   *    asked for.
   *
   * ★ `danger` is the exception, because BOTH its first stops (`rose-600`,
   *   `red-600`) belong to `danger` itself. Substituting each in place left
   *   `from-danger-600 via-danger-600` — a gradient with two identical stops. It
   *   spans 500 → 700 instead, so the sweep survives whatever red the buyer picks
   *   rather than depending on two Tailwind hues happening to differ.
   */
  announcementBgClass = computed<string>(() => {
    const map: Record<AlertVariant, string> = {
      info:    'bg-gradient-to-r from-info-600 via-indigo-600 to-violet-600',
      success: 'bg-gradient-to-r from-accent-600 via-teal-600 to-cyan-600',
      warning: 'bg-gradient-to-r from-warning-500 via-orange-500 to-rose-500',
      danger:  'bg-gradient-to-r from-danger-500 via-danger-700 to-orange-600',
      neutral: 'bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800',
    };
    return map[this.variant()];
  });
}
