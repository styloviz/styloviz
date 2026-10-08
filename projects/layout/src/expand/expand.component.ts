import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  OnChanges,
  OnDestroy,
  output,
  signal,
  SimpleChanges,
  untracked,
  viewChild,
} from '@angular/core';
import { prefersReducedMotion, svElementSize, svRecoverFocus } from '@styloviz/core';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvExpandComponent — Animated expand/collapse container.
 *
 * Features:
 * - Smooth height animation without @angular/animations
 * - Pure JS measurement: scrollHeight → height transition, re-targeted while the
 *   content is still growing (`LU-04-M2`)
 * - Lazy rendering: content not attached until first open, then RETAINED
 * - Accessible: `aria-hidden` + `inert` on hidden content, and a defined focus
 *   target when a collapse would otherwise strand focus (`LU-04-M1`)
 * - No external dependencies
 *
 * ── Lifecycle of the projected content (`LU-04-M3`) ─────────────────────────
 * ★★ `lazy` DEFERS INSERTION, NOT INSTANTIATION. Angular creates projected
 *    content in the HOST's view, whatever this component does with its
 *    `<ng-content>` — so a component placed inside `<sv-expand>` is constructed
 *    (and runs `ngOnInit`) on first render even while the panel is lazy and
 *    closed. What `lazy` saves is attaching that DOM to the panel and laying it
 *    out. To genuinely defer creation, wrap the content in your own `@if` or
 *    `@defer` inside the panel.
 *
 * ★ NOTHING IS DESTROYED ON COLLAPSE. Once opened, the content stays attached
 *   for the component's lifetime: collapsing ends in `display: none` after the
 *   transition, so form state, scroll offsets and child component state survive
 *   a close/re-open. It is destroyed only with `sv-expand` itself (or when the
 *   host removes it from its own template).
 *
 * ── Interrupted transitions (`LU-04-I3`) ────────────────────────────────────
 * ★★ LAST WRITE WINS. Every change of `expanded` cancels the in-flight
 *    transition's settle step, starts the new transition from the height the
 *    panel has actually reached (so a reversal never snaps to 0 or to full), and
 *    `expandedChange` fires EXACTLY ONCE — for the final state, when it has
 *    settled. A superseded transition reports nothing.
 */
@Component({
  selector: 'sv-expand',
  standalone: true,
  templateUrl: './expand.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvExpandComponent implements OnChanges, AfterViewInit, OnDestroy {
  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Controls open/closed state. @default false */
  expanded = input<boolean>(false);

  /**
   * Animation duration in ms. Ignored under `prefers-reduced-motion: reduce`,
   * where the panel opens and closes without a height transition (`X-7`).
   * @default 250
   */
  duration = input<number>(250);

  /** CSS easing function. @default 'ease-in-out' */
  easing = input<string>('ease-in-out');

  /**
   * Only attach content after first open. Content is RETAINED after that — a
   * collapse hides it, it never destroys it. ⚠️ Projected components are still
   * instantiated by the host up front; wrap them in your own `@if` / `@defer`
   * to defer creation.
   * @default true
   */
  lazy = input<boolean>(true);

  // ── Accessibility (disclosure wiring) ──────────────────────────────────────

  /**
   * Optional id for the collapsible panel. Point your trigger's
   * `aria-controls` at this id to complete the ARIA disclosure relationship.
   * @default ''
   */
  panelId = input<string>('');

  /** Id of the element that labels this panel (usually the trigger button). @default '' */
  ariaLabelledby = input<string>('');

  /** Explicit accessible name for the panel (used when `ariaLabelledby` is unset). @default '' */
  ariaLabel = input<string>('');

  /**
   * Where focus goes when the panel collapses while focus is inside it — an
   * element, or the id of one (normally the trigger).
   *
   * ★★ A COLLAPSE MUST NEVER STRAND FOCUS. The content is about to be hidden
   *    and made `inert`; a focused control inside it would drop focus to
   *    `<body>`, and the next Tab restarts at the top of the page. When this is
   *    unset (or cannot take focus) the fallbacks are, in order: the element
   *    named by `ariaLabelledby`, any element whose `aria-controls` names
   *    `panelId`, and finally the `sv-expand` host itself (made focusable with
   *    `tabindex="-1"` for that one move).
   * @default null
   */
  returnFocusTo = input<string | HTMLElement | null>(null);

  /**
   * `role="region"` is exposed only when the panel has an accessible name
   * (`ariaLabelledby` or `ariaLabel`) — a nameless region is discouraged.
   */
  readonly panelRole = computed<'region' | null>(() =>
    this.ariaLabelledby() || this.ariaLabel() ? 'region' : null,
  );

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted after the animation completes — once, for the final state of a burst of toggles. */
  expandedChange = output<boolean>();

  // ── View ──────────────────────────────────────────────────────────────────

  readonly wrapperRef = viewChild<ElementRef<HTMLDivElement>>('wrapper');
  private readonly contentRef = viewChild<ElementRef<HTMLDivElement>>('content');

  // ── State ─────────────────────────────────────────────────────────────────

  /** Has the panel ever been opened? (controls lazy rendering) */
  readonly hasBeenOpened = signal(false);

  readonly isVisible = computed(() =>
    !this.lazy() || this.hasBeenOpened()
  );

  /**
   * The content's border box, observed (`X-4`).
   *
   * ★★ AN IMAGE OR A WEB FONT THAT LANDS MID-OPEN INVALIDATES THE HEIGHT THE
   *    TRANSITION IS HEADING FOR. The wrapper's inline height is pinned during
   *    the animation, so its own box never changes — the growth only shows on
   *    the content inside it, which is why that is what is observed.
   */
  private readonly contentSize = svElementSize(() => this.contentRef()?.nativeElement);

  /** What the wrapper is doing right now. Drives re-targeting and reversals. */
  private phase: 'idle' | 'opening' | 'closing' = 'idle';

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);

  constructor() {
    effect(() => {
      if (this.expanded()) {
        this.hasBeenOpened.set(true);
      }
    });

    effect(() => {
      this.contentSize();
      untracked(() => this.followContent());
    });
  }

  /** Set initial display state once the view is ready — no animation. */
  ngAfterViewInit(): void {
    const el = this.wrapperRef()?.nativeElement;
    if (!el) return;
    el.style.display = this.expanded() ? '' : 'none';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('expanded' in changes) {
      const change = changes['expanded'];

      // Skip the first change: the view is not mounted yet;
      // ngAfterViewInit sets the initial display state without animation.
      if (change.firstChange) return;

      const el = this.wrapperRef()?.nativeElement;
      if (!el) return;

      if (change.currentValue as boolean) {
        this.animateOpen(el);
      } else {
        // ★ BEFORE the template applies `inert`: an inert subtree cannot hold
        //   focus, and the browser's own answer is `<body>`. ngOnChanges runs
        //   ahead of this view's bindings, so this is the last moment the
        //   focused control can still hand focus over.
        this.releaseFocus(el);
        this.animateClose(el);
      }
    }
  }

  ngOnDestroy(): void {
    this.pendingCleanup?.();
  }

  // ── Focus ─────────────────────────────────────────────────────────────────

  /**
   * Move focus out of the panel if the collapse is about to hide it (`X-10`).
   * Candidates in order: `returnFocusTo`, the labelling element, a trigger
   * whose `aria-controls` names this panel — then the host, never `<body>`.
   */
  private releaseFocus(panel: HTMLElement): void {
    const active = this.doc.activeElement;
    if (!active || !panel.contains(active)) return;

    const byId = (id: string): HTMLElement | null => (id ? this.doc.getElementById(id) : null);
    const target = this.returnFocusTo();
    const labelledBy = this.ariaLabelledby().trim().split(/\s+/)[0] ?? '';
    const panelId = this.panelId();
    // ★ Never a candidate INSIDE the panel: a "Show less" button in the content
    //   carries `aria-controls` too, and at this point the wrapper is not inert
    //   yet, so it still looks focusable — focus stayed on it and fell to
    //   <body> a moment later when `inert` applied.
    const outside = (el: Element | null | undefined): el is HTMLElement =>
      !!el && !panel.contains(el);
    const controller = panelId
      ? Array.from(this.doc.querySelectorAll('[aria-controls]')).find((c) =>
          outside(c) && (c.getAttribute('aria-controls') ?? '').split(/\s+/).includes(panelId),
        )
      : null;

    const candidates = [typeof target === 'string' ? byId(target) : target, byId(labelledBy), controller];
    svRecoverFocus({
      to: candidates.map((c) => (outside(c) ? c : null)),
      fallback: this.host.nativeElement,
    });
  }

  // ── Animation ─────────────────────────────────────────────────────────────

  /**
   * The duration actually used — `0` under reduced motion (`X-7`).
   *
   * ★ Read per toggle, not once: the OS preference can change while the page is
   *   open, and a cached answer would keep animating for a user who just turned
   *   motion off. The settle step still runs, so `expandedChange` and the final
   *   `display:none` behave exactly as they do with animation.
   */
  private motionMs(): number {
    return prefersReducedMotion() ? 0 : Math.max(0, this.duration());
  }

  /** The `transition` value for a height move of {@link motionMs}. */
  private heightTransition(): string {
    const ms = this.motionMs();
    return ms === 0 ? 'none' : `height ${ms}ms ${this.easing()}`;
  }

  private pendingCleanup: (() => void) | null = null;

  /**
   * Run `done` when the height transition finishes — or when it becomes clear
   * that it never will.
   *
   * `transitionend` is not a guarantee. A zero duration fires nothing, neither
   * does a transition on an element that is not being rendered, and a user with
   * reduced motion may have transitions off entirely. Waiting for it alone, the
   * panel never finishes: `display:none` is never applied on close, the inline
   * height is never cleared, and `expandedChange` never emits — so a host
   * driving anything off that event stalls for good.
   *
   * The target check matters as much. Every transition inside the projected
   * content bubbles up to this element, so a child fading its own opacity would
   * otherwise end the panel's animation early, at whatever height it had reached.
   */
  private settle(el: HTMLElement, done: () => void): void {
    this.pendingCleanup?.();

    // eslint-disable-next-line prefer-const -- assigned below, after the closures that read it exist
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onEnd = (e: Event) => { if (e.target === el) finish(); };
    const detach = () => {
      el.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
      this.pendingCleanup = null;
    };
    const finish = () => { detach(); done(); };

    el.addEventListener('transitionend', onEnd);
    timer = setTimeout(finish, this.motionMs() + 50);
    this.pendingCleanup = detach;
  }

  private readonly finishOpen = (el: HTMLElement): void => {
    this.phase = 'idle';
    el.style.height     = '';
    el.style.overflow   = '';
    el.style.transition = '';
    this.expandedChange.emit(true);
  };

  private readonly finishClose = (el: HTMLElement): void => {
    this.phase = 'idle';
    el.style.display    = 'none';
    el.style.height     = '';
    el.style.overflow   = '';
    el.style.transition = '';
    this.expandedChange.emit(false);
  };

  private animateOpen(el: HTMLDivElement): void {
    // ★ A reversal starts where the close had got to, not from zero.
    const from = this.phase === 'closing' ? el.getBoundingClientRect().height : 0;
    this.pendingCleanup?.();
    this.phase = 'opening';

    // Collapse visually first so there is no flash of content
    el.style.transition = '';
    el.style.display  = 'block';
    el.style.height   = `${from}px`;
    el.style.overflow = 'hidden';

    // Ensure lazy content is rendered before we measure scrollHeight.
    // hasBeenOpened drives the @if(isVisible()) guard in the template.
    this.hasBeenOpened.set(true);
    this.cdr.detectChanges();

    // Force reflow so the browser registers the start height
    void el.offsetHeight;

    const targetH = el.scrollHeight;
    el.style.transition = this.heightTransition();
    el.style.height     = `${targetH}px`;

    this.settle(el, () => this.finishOpen(el));
  }

  private animateClose(el: HTMLDivElement): void {
    this.pendingCleanup?.();
    this.phase = 'closing';

    // The height actually reached — mid-open that is short of the target.
    const currentH = el.getBoundingClientRect().height;
    el.style.transition = '';
    el.style.height   = `${currentH}px`;
    el.style.overflow = 'hidden';

    // Force reflow
    void el.offsetHeight;

    el.style.transition = this.heightTransition();
    el.style.height     = '0px';

    this.settle(el, () => this.finishClose(el));
  }

  /**
   * The content resized while the panel is opening: head for the new height.
   *
   * ★ The settle step is restarted with it, because a changed `height` starts a
   *   fresh transition of the full duration — the old fallback timer would cut
   *   it short and snap to `auto`. Closing ignores growth: it is heading for 0
   *   whatever the content does.
   */
  private followContent(): void {
    if (this.phase !== 'opening') return;
    const el = this.wrapperRef()?.nativeElement;
    if (!el) return;
    const next = `${el.scrollHeight}px`;
    if (el.style.height === next) return;
    el.style.height = next;
    this.settle(el, () => this.finishOpen(el));
  }
}
