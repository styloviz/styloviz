import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Where a pull is.
 * - `idle` — nothing happening.
 * - `pulling` — a finger is dragging down from the top, not yet far enough.
 * - `armed` — far enough: letting go refreshes.
 * - `refreshing` — a refresh is running (the host's `refreshing`, or the beat after a release).
 */
export type SvPullState = 'idle' | 'pulling' | 'armed' | 'refreshing';

/** Pixels of movement before a touch commits to being a pull or a scroll. */
const DECIDE_PX = 6;
/** How long a released pull waits for the host to set `refreshing` before settling. */
const HANDOFF_MS = 600;

// ─── Directive ───────────────────────────────────────────────────────────────

/**
 * Pull-to-refresh — the gesture, on the element that scrolls.
 *
 * ★★★ IT NEVER TAKES A SCROLL. Every listener is PASSIVE, so the browser never
 *     waits on this code before it scrolls, and nothing here ever calls
 *     `preventDefault()`. A touch only becomes a pull when the element is
 *     already at the top AND the first movement is downward AND more vertical
 *     than horizontal; anything else is left to the browser, untouched, for the
 *     rest of that touch. `overscroll-behavior-y: contain` on the host stops the
 *     pull from chaining to the page (and the browser's own page refresh), which
 *     is what makes a passive pull possible at all.
 *
 * ★★ TOUCH EVENTS, NOT POINTER EVENTS. A pointer stream is cancelled the
 *    moment the browser decides a touch is a pan (`pointercancel`), which is
 *    exactly the moment a pull starts. Touch events keep arriving. A mouse has
 *    no pull — use `trigger()` from a button, which is the keyboard and
 *    assistive-technology path too (`sv-pull-to-refresh` renders one).
 *
 * ★ The resistance is a ratio: the indicator moves `resistance` × the finger's
 *   travel, so the finger has to travel `threshold ÷ resistance` px to arm it.
 *
 * Read the state through the exported signals (`distance`, `progress`,
 * `state`) to draw your own indicator:
 *
 * ```html
 * <div svPullToRefresh #ptr="svPullToRefresh" [refreshing]="loading()" (refresh)="reload()"
 *      class="h-96 overflow-y-auto">
 *   <div [style.transform]="'translateY(' + ptr.distance() + 'px)'">…</div>
 * </div>
 * ```
 */
@Directive({
  selector: '[svPullToRefresh]',
  standalone: true,
  exportAs: 'svPullToRefresh',
  host: {
    class: 'overscroll-y-contain',
    '[attr.data-sv-pull-state]': 'state()', // sv-i18n-ignore: host binding key
    '[attr.aria-busy]': "state() === 'refreshing' ? 'true' : null", // sv-i18n-ignore: host binding key
  },
})
export class SvPullToRefreshDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** True while the host's refresh is running — the indicator holds and spins until it goes false. @default false */
  readonly refreshing = input<boolean>(false);

  /** How far (px, after resistance) the indicator must travel before a release refreshes. @default 72 */
  readonly pullThreshold = input<number>(72);

  /** Indicator travel per pixel of finger travel, 0.1–1. Lower feels heavier. @default 0.5 */
  readonly pullResistance = input<number>(0.5);

  /** Turn the gesture off (a list that is mid-edit, a host with nothing to refresh). @default false */
  readonly pullDisabled = input<boolean>(false);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Fetch again. Fires on an armed release and on `trigger()`, never while a refresh is running. */
  readonly refresh = output<void>();

  // ── State ─────────────────────────────────────────────────────────────────

  /** Indicator travel in px — 0 at rest, the threshold while refreshing. */
  readonly distance = signal(0);

  private readonly phase = signal<'idle' | 'pulling' | 'armed'>('idle');
  /** A release fired `refresh` and the host has not said `refreshing` yet. */
  private readonly handoff = signal(false);

  /** Where the pull is. */
  readonly state = computed<SvPullState>(() =>
    this.refreshing() || this.handoff() ? 'refreshing' : this.phase(),
  );

  /** 0 → 1 as the pull approaches the threshold. 1 while refreshing. */
  readonly progress = computed(() => {
    if (this.state() === 'refreshing') return 1;
    const threshold = this.threshold();
    return threshold > 0 ? Math.min(1, this.distance() / threshold) : 0;
  });

  /** True while a finger is moving the indicator — draw it without a transition then. */
  readonly tracking = signal(false);

  private readonly threshold = computed(() => {
    const t = this.pullThreshold();
    return Number.isFinite(t) && t > 0 ? t : 72;
  });

  private readonly resistance = computed(() => {
    const r = this.pullResistance();
    return Number.isFinite(r) ? Math.min(1, Math.max(0.1, r)) : 0.5;
  });

  private touchId: number | null = null;
  private startX = 0;
  private startY = 0;
  private decided = false;
  private handoffTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // The host took over (or finished): drop the hand-off and park the indicator.
    effect(() => {
      const busy = this.refreshing();
      untracked(() => {
        if (busy) {
          this.clearHandoff();
          this.distance.set(this.threshold());
        } else if (!this.handoff() && !this.tracking()) {
          this.distance.set(0);
          this.phase.set('idle');
        }
      });
    });

    afterNextRender(() => {
      const host = this.el.nativeElement;
      const opts: AddEventListenerOptions = { passive: true };
      const start = (e: TouchEvent): void => this.onStart(e);
      const move = (e: TouchEvent): void => this.onMove(e);
      const end = (e: TouchEvent): void => this.onEnd(e);
      host.addEventListener('touchstart', start, opts);
      host.addEventListener('touchmove', move, opts);
      host.addEventListener('touchend', end, opts);
      host.addEventListener('touchcancel', end, opts);
      destroyRef.onDestroy(() => {
        host.removeEventListener('touchstart', start);
        host.removeEventListener('touchmove', move);
        host.removeEventListener('touchend', end);
        host.removeEventListener('touchcancel', end);
      });
    });
    destroyRef.onDestroy(() => clearTimeout(this.handoffTimer));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Refresh without a pull — the button, the keyboard and assistive technology
   * all come here. Ignored while a refresh is running or the gesture is disabled.
   */
  trigger(): void {
    if (this.pullDisabled() || this.state() === 'refreshing') return;
    this.startHandoff();
    this.refresh.emit();
  }

  // ── Gesture ───────────────────────────────────────────────────────────────

  private atTop(): boolean {
    return this.el.nativeElement.scrollTop <= 0;
  }

  private onStart(e: TouchEvent): void {
    if (this.pullDisabled() || this.state() === 'refreshing' || e.touches.length !== 1 || !this.atTop()) {
      this.touchId = null;
      return;
    }
    const t = e.touches[0];
    this.touchId = t.identifier;
    this.startX = t.clientX;
    this.startY = t.clientY;
    this.decided = false;
  }

  private onMove(e: TouchEvent): void {
    if (this.touchId === null) return;
    const t = Array.from(e.touches).find((touch) => touch.identifier === this.touchId);
    if (!t) return;
    const dx = t.clientX - this.startX;
    const dy = t.clientY - this.startY;

    if (!this.decided) {
      if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return;
      this.decided = true;
      // Up, sideways, or no longer at the top: a scroll. Let go for this whole touch.
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || !this.atTop()) {
        this.touchId = null;
        return;
      }
      this.tracking.set(true);
    }

    const threshold = this.threshold();
    // Past the threshold the pull keeps giving, but more slowly — it never runs away.
    const raw = Math.max(0, dy) * this.resistance();
    const travel = raw <= threshold ? raw : threshold + (raw - threshold) * 0.35;
    this.distance.set(Math.min(travel, threshold * 1.6));
    this.phase.set(travel >= threshold ? 'armed' : travel > 0 ? 'pulling' : 'idle');
  }

  private onEnd(e: TouchEvent): void {
    if (this.touchId === null) return;
    if (Array.from(e.touches).some((touch) => touch.identifier === this.touchId)) return;
    this.touchId = null;
    const wasTracking = this.tracking();
    this.tracking.set(false);
    if (!wasTracking) return;

    if (this.phase() === 'armed' && e.type === 'touchend') {
      this.phase.set('idle');
      this.distance.set(this.threshold());
      this.startHandoff();
      this.refresh.emit();
      return;
    }
    this.phase.set('idle');
    this.distance.set(this.refreshing() ? this.threshold() : 0);
  }

  // ── Hand-off ──────────────────────────────────────────────────────────────

  /**
   * ★ A host that refreshes synchronously never sets `refreshing`, and one that
   *   does sets it a tick later. Either way the indicator must not snap back
   *   and then jump down again, nor hang forever — so it holds briefly, and the
   *   host's own `refreshing` takes over if it arrives.
   */
  private startHandoff(): void {
    this.clearHandoff();
    this.handoff.set(true);
    this.distance.set(this.threshold());
    this.handoffTimer = setTimeout(() => {
      this.handoff.set(false);
      if (!this.refreshing()) this.distance.set(0);
    }, HANDOFF_MS);
  }

  private clearHandoff(): void {
    clearTimeout(this.handoffTimer);
    this.handoff.set(false);
  }
}
