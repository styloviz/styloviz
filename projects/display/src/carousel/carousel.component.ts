import {
  afterNextRender,
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
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { onReducedMotionChange, prefersReducedMotion, svIsRtl } from '@styloviz/core/a11y';
import {
  SvEmptyShellComponent,
  SvErrorShellComponent,
  SvSkeletonShellComponent,
  type SvDataError,
} from '@styloviz/core/data';
import { injectSvLabels, SvLabelPipe } from '@styloviz/core/i18n';
import { SV_DISPLAY_LABELS } from '../display.labels';
import { RouterLink } from '@angular/router';
import { SvIconComponent } from '@styloviz/icons';

import { registerCarouselIcons } from './carousel.component.icons';
export type CarouselVariant   = 'default' | 'card' | 'fade' | 'coverflow';
export type CarouselIndicator = 'dots' | 'lines' | 'numbers' | 'thumbnails' | 'none';
export type CarouselOrientation = 'horizontal' | 'vertical';

export interface CarouselSlide {
  readonly id: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly image?: string;
  readonly bgColor?: string;
  readonly badge?: string;
  /**
   * Call-to-action label. Rendered as a link when {@link ctaLink} is set, else a
   * `type="button"` button; either way activating it emits `ctaClick`.
   */
  readonly cta?: string;
  /** In-app route (a `routerLink` value) the CTA navigates to. Only the CTA is a link; the caption around it is not. */
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
 * ★ 700-step stops: the slide's copy is white, and the old 500/600 stops held
 *   it at 2.15:1 on amber and 3.60:1 on cyan. Worst now amber-700, 5.05:1.
 */
export const DEMO_SLIDES: CarouselSlide[] = [
  { id: '1', title: 'Build Faster', subtitle: 'Premium Angular components ready to use', bgColor: 'from-violet-700 to-indigo-700', badge: 'New' }, // sv-i18n-ignore: demo sample data the host replaces
  { id: '2', title: 'Dark Mode Ready', subtitle: 'Every component supports light and dark themes', bgColor: 'from-emerald-700 to-teal-700', badge: 'Feature' }, // sv-i18n-ignore: demo sample data the host replaces
  { id: '3', title: 'Fully Responsive', subtitle: 'Mobile-first design scales to any screen size', bgColor: 'from-amber-700 to-orange-700', badge: 'Design' }, // sv-i18n-ignore: demo sample data the host replaces
  { id: '4', title: 'TypeScript First', subtitle: 'Strict mode, typed APIs, and strong interfaces', bgColor: 'from-blue-700 to-cyan-700', badge: 'Dev' }, // sv-i18n-ignore: demo sample data the host replaces
];

@Component({
  selector: 'sv-carousel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvSkeletonShellComponent, SvErrorShellComponent, SvEmptyShellComponent, RouterLink, SvIconComponent, NgTemplateOutlet, SvLabelPipe],
  templateUrl: './carousel.component.html',
  // Block, so its width can be measured for `slidesPerView`.
  host: { class: 'block' },
})
export class SvCarouselComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerCarouselIcons();

  /** @internal Accessible names — English unless `provideSvLabels({ display })` says otherwise. */
  protected readonly labels = injectSvLabels('display', SV_DISPLAY_LABELS);

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
  readonly emptyMessage = input<string>(this.labels.noSlides);

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
  /**
   * Indicator style: dots, lines, numbers, `thumbnails` (a strip of slide
   * previews under the carousel) or none. @default 'dots'
   */
  indicator   = input<CarouselIndicator>('dots');
  /**
   * Which way the slides travel. `vertical` moves `default` and `card` slides up
   * and down, puts the arrows top and bottom, and takes ↑ / ↓ and vertical
   * swipes. `coverflow` and several slides per view stay horizontal.
   * @default 'horizontal'
   */
  orientation = input<CarouselOrientation>('horizontal');
  /**
   * How many slides show side by side — a row of cards that steps one slide at
   * a time. Fewer show when the carousel is too narrow for each to keep
   * `slideMinWidth`, so a phone sees one. Above 1, `variant` is ignored and
   * `aspectRatio` is each slide's. @default 1
   */
  slidesPerView = input<number>(1);
  /** The narrowest a slide may get when several share the view, in px. @default 220 */
  slideMinWidth = input<number>(220);
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
  ariaLabel   = input<string>(this.labels.carousel);
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
  /**
   * Emitted with the slide whose call-to-action was activated (click, Enter or
   * Space). A slide with `ctaLink` still navigates; this fires first, so it
   * suits analytics. A slide without one has no other effect — handle it here.
   */
  ctaClick = output<CarouselSlide>();

  readonly current   = signal(0);
  readonly direction = signal<'next' | 'prev'>('next');
  /** User-controlled pause state for the auto-play toggle. */
  readonly isPaused  = signal(false);

  private readonly _hovering    = signal(false);
  private readonly _focusWithin = signal(false);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** The carousel's width in px, measured in the browser; `0` until then (and on the server). */
  private readonly width = signal(0);

  /**
   * Slides in view at once: `slidesPerView`, cut to what fits at `slideMinWidth`
   * and to the number of slides. Before the first measurement — and on the
   * server — it is what was asked for, so the first paint has the right shape.
   */
  readonly perView = computed(() => {
    const asked = Math.max(1, Math.floor(this.slidesPerView()) || 1);
    const width = this.width();
    const fits = width > 0 ? Math.max(1, Math.floor(width / Math.max(1, this.slideMinWidth()))) : asked;
    return Math.max(1, Math.min(asked, fits, this.total()));
  });

  /** Several slides in a row — the track layout rather than one slide at a time. */
  readonly multi = computed(() => this.perView() > 1);

  /**
   * @internal One slide in view carrying a caption: the region keeps a minimum
   * height (`min-h-56`, 14rem) whatever `aspectRatio` says. A 21:9 hero is 140 px
   * tall on a phone, and its badge, title, subtitle and call to action ran out
   * of the bottom — the CTA button cut off (FL-L4-05). From ~525 px wide a 21:9
   * slide is taller than this anyway, so wide layouts are unchanged.
   */
  readonly captionFloor = computed(
    () => !this.multi() && this.slides().some((s) => !!(s.badge || s.title || s.subtitle || s.meta || s.cta)),
  );

  /** Slides travel up and down — see {@link orientation}. */
  readonly vertical = computed(() =>
    this.orientation() === 'vertical' && !this.multi() && this.variant() !== 'coverflow');

  /** Where the view can start: one per slide, less the ones that share the last view. */
  readonly positions = computed(() => Math.max(1, this.total() - this.perView() + 1));

  /** Each slide's share of the track, in %, when several share the view. */
  readonly slideWidth = computed(() => 100 / this.perView());

  /** Whether each slide is on screen, by index — see {@link isShown}. */
  readonly shown = computed(() => this.slides().map((_, i) => this.isShown(i)));

  /** The track's offset, as a CSS transform, when several slides share the view. */
  readonly trackTransform = computed(() => {
    const step = (this.current() * 100) / this.perView();
    // A right-to-left track runs the other way.
    return `translateX(${this.rtl() ? step : -step}%)`;
  });

  /** The region's aspect ratio: with several in view, `aspectRatio` is each slide's. */
  readonly regionAspect = computed(() => {
    const ratio = this.aspectRatio();
    const n = this.perView();
    if (n === 1) return ratio;
    const [w, h] = ratio.split('/').map((part) => Number(part.trim()));
    const r = h ? w / h : w;
    return Number.isFinite(r) && r > 0 ? String(r * n) : ratio;
  });

  /** Whether the carousel sits under `dir="rtl"`, read once it is first drawn. */
  private readonly rtl = signal(false);

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

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const el = this.host.nativeElement;
      el.addEventListener('click', this._onClickCapture, true);
      inject(DestroyRef).onDestroy(() => el.removeEventListener('click', this._onClickCapture, true));
    }
    if (isPlatformBrowser(this.platformId)) {
      const stop = onReducedMotionChange((reduced) => this._reducedMotion.set(reduced));
      inject(DestroyRef).onDestroy(stop);
    }

    // Auto-advance timer. Re-created whenever its dependencies change and
    // always cleared via onCleanup — so changing `interval` never leaks timers,
    // and hover/focus/manual-pause halt rotation.
    // Measured, not media-queried: a carousel in a sidebar is narrow on any screen.
    afterNextRender(() => {
      const el = this.host.nativeElement;
      this.rtl.set(el.closest('[dir="rtl"]') !== null);
      const measure = () => this.width.set(el.getBoundingClientRect().width);
      measure();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    effect((onCleanup) => {
      const active =
        this.autoPlayOn() && !this.isPaused() && !this.interacting() && this.positions() > 1;
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
      return next < 0 ? (this.loop() ? this.positions() - 1 : 0) : next;
    });
    this.slideChange.emit(this.current());
  }

  next(): void {
    this.direction.set('next');
    this.current.update(i => {
      const next = i + 1;
      return next >= this.positions() ? (this.loop() ? 0 : this.positions() - 1) : next;
    });
    this.slideChange.emit(this.current());
  }

  /** Show slide `i` — with several in view, the last views stop where the last slide is in view. */
  goTo(i: number): void {
    const to = Math.max(0, Math.min(i, this.positions() - 1));
    this.direction.set(to > this.current() ? 'next' : 'prev');
    this.current.set(to);
    this.slideChange.emit(to);
  }

  /** Whether slide `i` is on screen — the active one, or one of the row sharing the view. */
  isShown(i: number): boolean {
    const at = this.current();
    return i >= at && i < at + this.perView();
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

  // ── Swipe (DD-05-I5) ──────────────────────────────────────────────────────
  //
  // ★★ THE ARROWS AND DOTS WERE THE ONLY TOUCH PATH, and a phone user's first
  //    instinct on a carousel is to swipe it. Pointer events cover touch, pen
  //    and mouse in one path. Only a HORIZONTAL gesture counts — the region is
  //    `touch-pan-y`, so a vertical swipe stays the browser's and scrolls the
  //    page — and a swipe that changed slides swallows the click it would
  //    otherwise end in, so releasing over a slide's link does not follow it.

  /** Minimum horizontal travel, in CSS px, for a swipe. */
  private static readonly SWIPE_PX = 40;

  private _swipeStart: { x: number; y: number; id: number } | null = null;
  private _swallowClick = false;

  onPointerDown(event: PointerEvent): void {
    if (!event.isPrimary || event.button > 0 || this.total() <= 1) return;
    this._swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }

  onPointerUp(event: PointerEvent): void {
    const start = this._swipeStart;
    this._swipeStart = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (this.vertical()) {
      // An upward swipe pulls the next slide in from below.
      if (Math.abs(dy) < SvCarouselComponent.SWIPE_PX || Math.abs(dy) <= Math.abs(dx)) return;
      if (dy < 0) this.next();
      else this.prev();
      this._swallowClick = true;
      return;
    }
    if (Math.abs(dx) < SvCarouselComponent.SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return;
    // A leftward swipe pulls the NEXT slide in — mirrored right-to-left.
    const rtl = this.host.nativeElement.closest('[dir="rtl"]') !== null;
    if ((dx < 0) !== rtl) this.next();
    else this.prev();
    this._swallowClick = true;
  }

  onPointerCancel(): void {
    this._swipeStart = null;
  }

  /** Capture-phase: eat the click that ends a swipe, before a link sees it. */
  private readonly _onClickCapture = (event: Event): void => {
    if (!this._swallowClick) return;
    this._swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  /**
   * Keyboard navigation for the carousel region (← previous, → next; ↑ / ↓ when
   * vertical). Under dir="rtl" the slides advance leftward, so ← is next there:
   * the arrow follows the direction the user sees the next slide come from.
   */
  onKeydown(event: KeyboardEvent): void {
    if (this.positions() <= 1) return;
    const [back, forward] = this.vertical()
      ? ['ArrowUp', 'ArrowDown']
      : svIsRtl(this.host.nativeElement) ? ['ArrowRight', 'ArrowLeft'] : ['ArrowLeft', 'ArrowRight'];
    if (event.key === back) { event.preventDefault(); this.prev(); }
    else if (event.key === forward) { event.preventDefault(); this.next(); }
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
            ? 'translate-x-0 translate-y-0 scale-100 opacity-100'
            : `${this.offAxis(i)} scale-95 opacity-0`,
          motion ? 'transition-all duration-500 ease-in-out' : '',
        ].join(' ');
      case 'coverflow': {
        const d = this.offsetOf(i);
        const place =
          d === 0 ? 'z-[2] translate-x-0 scale-100 opacity-100'
          // The neighbours sit toward the inline start / end: mirrored under RTL.
          : d === -1 ? 'z-[1] -translate-x-[72%] rtl:translate-x-[72%] scale-75 opacity-60'
          : d === 1 ? 'z-[1] translate-x-[72%] rtl:-translate-x-[72%] scale-75 opacity-60'
          : 'z-0 scale-50 opacity-0';
        return [
          'inset-y-3 start-[18%] end-[18%] overflow-hidden rounded-xl shadow-xl',
          place,
          motion ? 'transition-all duration-500 ease-in-out' : '',
        ].join(' ');
      }
      default:
        return [
          'inset-0',
          active ? 'translate-x-0 translate-y-0 opacity-100' : `${this.offAxis(i)} opacity-0`,
          motion ? 'transition-all duration-500 ease-in-out' : '',
        ].join(' ');
    }
  }

  /** Where an inactive slide waits: before or after the active one, along the carousel's axis. */
  private offAxis(i: number): string {
    const before = this.current() > i;
    if (this.vertical()) return before ? '-translate-y-full' : 'translate-y-full';
    // A slide before the active one waits on the inline-start side: left in LTR, right in RTL.
    return before ? '-translate-x-full rtl:translate-x-full' : 'translate-x-full rtl:-translate-x-full'; // sv-i18n-ignore: Tailwind classes
  }

  /** One indicator per place the view can start. */
  readonly slideSlots = computed(() =>
    Array.from({ length: this.positions() }, (_, i) => i)
  );
}
