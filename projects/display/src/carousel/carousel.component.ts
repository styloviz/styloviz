import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  onReducedMotionChange,
  prefersReducedMotion,
  type SvDataError,
} from '@styloviz/core';
import { RouterLink } from '@angular/router';
import { SvIconComponent } from '@styloviz/icons';

export type CarouselVariant   = 'default' | 'card' | 'fade' | 'coverflow';
export type CarouselIndicator = 'dots' | 'lines' | 'numbers' | 'none';

export interface CarouselSlide {
  readonly id: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly image?: string;
  readonly bgColor?: string;
  readonly badge?: string;
  /** Call-to-action label. Rendered as a link when {@link ctaLink} is set, else a button. */
  readonly cta?: string;
  /** In-app route the CTA navigates to (also makes the whole image caption clickable). */
  readonly ctaLink?: string;
  /** Short supporting line shown above the CTA, e.g. a price or offer detail. */
  readonly meta?: string;
}

/**
 * The sample set this component used to default to.
 *
 * Exported and bound by the showcase rather than baked in: an unbound
 * component that renders convincing content is indistinguishable from a wired
 * one that is silently receiving nothing — and the fixture shipped in every
 * buyer's bundle.
 */
/**
 * ★ The gradients stay literal because they are CONTENT, not chrome: a slide's
 *   `bgColor` is a caller-supplied string, and these four are demo artwork whose
 *   only job is to look like four different slides. A buyer replaces them with
 *   their own imagery rather than inheriting them from a token.
 */
export const DEMO_SLIDES: CarouselSlide[] = [
  { id: '1', title: 'Build Faster', subtitle: 'Premium Angular components ready to use', bgColor: 'from-violet-600 to-indigo-600', badge: 'New' },
  { id: '2', title: 'Dark Mode Ready', subtitle: 'Every component supports light and dark themes', bgColor: 'from-emerald-600 to-teal-600', badge: 'Feature' },
  { id: '3', title: 'Fully Responsive', subtitle: 'Mobile-first design scales to any screen size', bgColor: 'from-amber-500 to-orange-600', badge: 'Design' },
  { id: '4', title: 'TypeScript First', subtitle: 'Strict mode, typed APIs, and strong interfaces', bgColor: 'from-blue-600 to-cyan-600', badge: 'Dev' },
];

@Component({
  selector: 'sv-carousel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvSkeletonShellComponent, SvErrorShellComponent, SvEmptyShellComponent, RouterLink, SvIconComponent],
  templateUrl: './carousel.component.html',
})
export class SvCarouselComponent {
  // ── Async state ───────────────────────────────────────────────────────────

  /** True while the slides are being fetched. @default false */
  readonly loading = input<boolean>(false);

  /**
   * Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an
   * `HttpErrorResponse`.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /** Copy for the no-data state. @default 'No slides to show' */
  readonly emptyMessage = input<string>('No slides to show');

  /** True when the emptiness is caused by a filter rather than an empty set. */
  readonly filtered = input<boolean>(false);

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  /** Nothing to show. Distinct from `loading`, which is not yet knowing. */
  protected readonly isEmpty = computed(() => this.slides().length === 0);

  /** Slides to display (image, caption, optional link). */
  slides      = input<readonly CarouselSlide[]>([]);
  /**
   * Visual variant. `default` slides full-bleed; `fade` cross-fades in place;
   * `card` insets each slide as a rounded, shadowed card; `coverflow` shows the
   * neighbouring slides scaled down either side of the active one. Under
   * `prefers-reduced-motion` every variant keeps its layout but drops the
   * transition.
   * @default 'default'
   */
  variant     = input<CarouselVariant>('default');
  /** Indicator style: dots, lines, numbers or none. @default 'dots' */
  indicator   = input<CarouselIndicator>('dots');
  /** Auto-advance slides. @default false */
  autoPlay    = input<boolean>(false);
  /** Auto-advance interval in ms. @default 4000 */
  interval    = input<number>(4000);
  /** Wrap from last slide back to first. @default true */
  loop        = input<boolean>(true);
  /** Show prev/next arrows. @default true */
  arrows      = input<boolean>(true);
  /** CSS aspect-ratio for the viewport. @default '16/9' */
  aspectRatio = input<string>('16/9');
  /** Pause auto-advance while the carousel is hovered or focused. @default true */
  pauseOnHover = input<boolean>(true);
  /** Accessible name for the carousel region. @default 'Carousel' */
  ariaLabel   = input<string>('Carousel');
  /**
   * Load the first slide's image eagerly at high fetch priority. Set it when the
   * carousel is above the fold — a hero image is usually the page's Largest
   * Contentful Paint, and a lazy one is fetched only after layout. Later slides
   * stay lazy either way. @default false
   */
  priority    = input<boolean>(false);

  /** Emitted with the active slide index when it changes. */
  slideChange = output<number>();
  /** Emitted when the user toggles auto-play; payload is the paused state. */
  pausedChange = output<boolean>();

  readonly current   = signal(0);
  readonly direction = signal<'next' | 'prev'>('next');
  /** User-controlled pause state for the auto-play toggle. */
  readonly isPaused  = signal(false);

  private readonly _hovering    = signal(false);
  private readonly _focusWithin = signal(false);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /**
   * True when the viewer has asked their system for less motion.
   *
   * ★★★ A CAROUSEL IS THE WORST CASE FOR THIS PREFERENCE and the one most often
   *     missed. WCAG 2.2.2 requires moving content to be pausable, but a
   *     reduced-motion setting is a request not to have to pause it in the
   *     first place — for a viewer with a vestibular disorder, a slide sliding
   *     across the viewport every five seconds is not a style choice, it is
   *     nausea. So this does not merely shorten the transition: it stops the
   *     auto-advance entirely and leaves the controls to do the moving.
   */
  //
  // ★ Read through `@styloviz/core` and kept LIVE: a viewer who switches the
  //   OS setting mid-session gets the auto-advance stopped (or restored) at
  //   once, rather than on the next page load.
  private readonly _reducedMotion = signal(
    isPlatformBrowser(this.platformId) && prefersReducedMotion(),
  );

  /** Effective auto-play: never on when the viewer asked for less motion. */
  readonly autoPlayOn = computed(() => this.autoPlay() && !this._reducedMotion());

  /** Slides cross-fade and translate only when motion is welcome. */
  readonly animate = computed(() => !this._reducedMotion());

  /** True while hover/focus should hold auto-play (WCAG 2.2.2). */
  readonly interacting = computed(() =>
    this.pauseOnHover() && (this._hovering() || this._focusWithin())
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const stop = onReducedMotionChange((reduced) => this._reducedMotion.set(reduced));
      inject(DestroyRef).onDestroy(stop);
    }

    // Auto-advance timer. Re-created whenever its dependencies change and
    // always cleared via onCleanup — so changing `interval` never leaks timers,
    // and hover/focus/manual-pause halt rotation.
    effect((onCleanup) => {
      const active =
        this.autoPlayOn() && !this.isPaused() && !this.interacting() && this.total() > 1;
      // ★★ NOT ON THE SERVER (1.0 audit, H2). A zone-based SSR app waits for
      //    `ApplicationRef` to become stable before it sends HTML, and a live
      //    interval means it never does — the request hangs. Zoneless apps are
      //    spared, which is why the showcase never saw it.
      if (!active || !isPlatformBrowser(this.platformId)) return;
      const id = setInterval(() => this.next(), this.interval());
      onCleanup(() => clearInterval(id));
    });
  }

  /**
   * Keep focus somewhere real when the slide it was on leaves.
   *
   * ★★★ `inert` ON THE OUTGOING SLIDE IS WHAT CREATES THIS PROBLEM, AND IT IS
   *     STILL THE RIGHT ANSWER. Off-screen slides stay in the DOM to transition,
   *     so without `inert` their links sit in the tab order while invisible.
   *     With it, a link that HAD focus becomes inert underneath the user — and
   *     the browser drops focus to `<body>`, which sends the next Tab back to
   *     the top of the page. A keyboard user who pressed Next to read the
   *     following slide is thrown out of the carousel entirely.
   *
   * ★ Focus moves to the carousel's own region rather than to the new slide's
   *   link. Landing on a link the user did not choose invites them to activate
   *   it by reflex; the region is where they were, and Tab from there reaches
   *   the new slide's controls in order.
   *
   * ★ It only ever acts when focus was ALREADY inside this carousel. A slide
   *   advancing on a timer must never steal focus from elsewhere on the page.
   */
  protected readonly rescueFocus = effect(() => {
    this.current();
    if (!isPlatformBrowser(this.platformId) || typeof document === 'undefined') return;

    const root = this.host.nativeElement;
    const active = document.activeElement;
    const strandedInside =
      active instanceof HTMLElement && root.contains(active) && active.closest('[inert]') !== null;
    const droppedToBody = active === document.body && this._focusWithin();

    if (strandedInside || droppedToBody) {
      const region = root.querySelector<HTMLElement>('[data-sv-carousel-region]') ?? root;
      region.focus({ preventScroll: true });
    }
  });

  readonly total = computed(() => this.slides().length);

  /** Title of the active slide, used for the live-region announcement. */
  readonly currentTitle = computed(() => this.slides()[this.current()]?.title ?? '');

  prev(): void {
    this.direction.set('prev');
    this.current.update(i => {
      const next = i - 1;
      return next < 0 ? (this.loop() ? this.total() - 1 : 0) : next;
    });
    this.slideChange.emit(this.current());
  }

  next(): void {
    this.direction.set('next');
    this.current.update(i => {
      const next = i + 1;
      return next >= this.total() ? (this.loop() ? 0 : this.total() - 1) : next;
    });
    this.slideChange.emit(this.current());
  }

  goTo(i: number): void {
    this.direction.set(i > this.current() ? 'next' : 'prev');
    this.current.set(i);
    this.slideChange.emit(i);
  }

  /** Toggle the user pause state for auto-play. */
  togglePause(): void {
    this.isPaused.update(p => !p);
    this.pausedChange.emit(this.isPaused());
  }

  // ── Hover / focus pause ──────────────────────────────────────────────────────

  onMouseEnter(): void { this._hovering.set(true); }
  onMouseLeave(): void { this._hovering.set(false); }
  onFocusIn():  void { this._focusWithin.set(true); }
  onFocusOut(): void { this._focusWithin.set(false); }

  /** Keyboard navigation for the carousel region (← previous, → next). */
  onKeydown(event: KeyboardEvent): void {
    if (this.total() <= 1) return;
    if (event.key === 'ArrowLeft')  { event.preventDefault(); this.prev(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); this.next(); }
  }

  /**
   * Where slide `i` sits relative to the active one: 0 active, ±1 the
   * neighbours. With `loop` the distance wraps, so the last slide is the
   * active first slide's left-hand neighbour in coverflow.
   */
  private offsetOf(i: number): number {
    const total = this.total();
    let d = i - this.current();
    if (this.loop() && total > 2) {
      if (d > total / 2) d -= total;
      else if (d < -total / 2) d += total;
    }
    return d;
  }

  /**
   * Position + (motion-gated) transition classes for slide `i`, per variant.
   * Layout differs by variant; only the transition utilities depend on motion,
   * so a reduced-motion viewer still sees the card inset or the coverflow
   * neighbours — they just do not animate between states.
   */
  slideClass(i: number): string {
    const active = this.current() === i;
    const motion = this.animate();
    switch (this.variant()) {
      case 'fade':
        return [
          'inset-0',
          active ? 'z-[1] opacity-100' : 'z-0 opacity-0',
          motion ? 'transition-opacity duration-700 ease-in-out' : '',
        ].join(' ');
      case 'card':
        return [
          'inset-3 overflow-hidden rounded-xl shadow-lg ring-1 ring-black/10 sm:inset-5 dark:ring-white/10',
          active
            ? 'translate-x-0 scale-100 opacity-100'
            : `${this.current() > i ? '-translate-x-full' : 'translate-x-full'} scale-95 opacity-0`,
          motion ? 'transition-all duration-500 ease-in-out' : '',
        ].join(' ');
      case 'coverflow': {
        const d = this.offsetOf(i);
        const place =
          d === 0 ? 'z-[2] translate-x-0 scale-100 opacity-100'
          : d === -1 ? 'z-[1] -translate-x-[72%] scale-75 opacity-60'
          : d === 1 ? 'z-[1] translate-x-[72%] scale-75 opacity-60'
          : 'z-0 scale-50 opacity-0';
        return [
          'inset-y-3 left-[18%] right-[18%] overflow-hidden rounded-xl shadow-xl',
          place,
          motion ? 'transition-all duration-500 ease-in-out' : '',
        ].join(' ');
      }
      default:
        return [
          'inset-0',
          active ? 'translate-x-0 opacity-100' : `${this.current() > i ? '-translate-x-full' : 'translate-x-full'} opacity-0`,
          motion ? 'transition-all duration-500 ease-in-out' : '',
        ].join(' ');
    }
  }

  readonly slideSlots = computed(() =>
    Array.from({ length: this.total() }, (_, i) => i)
  );
}
