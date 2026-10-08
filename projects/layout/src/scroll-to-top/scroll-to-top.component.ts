import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { SvIconComponent } from '@styloviz/icons';
import {
  SV_FLOATING_ORDER,
  prefersReducedMotion,
  svFloatingInset,
  svFloatingRegion,
  svIsFocusable,
  svWarnOnce,
} from '@styloviz/core';

export type ScrollToTopVariant    = 'circle' | 'rounded' | 'pill';
export type ScrollToTopAppearance = 'solid' | 'glass' | 'gradient' | 'outline';
export type ScrollToTopPosition   = 'bottom-right' | 'bottom-left' | 'bottom-center';
/** How the scroll travels. `'auto'` jumps instantly (whatever the page's CSS `scroll-behavior`), and `'smooth'` is downgraded to that jump under reduced motion. */
export type ScrollToTopBehavior   = 'smooth' | 'auto';

/**
 * What `focusTarget: true` looks for, most specific first: the page's main
 * heading, then any `h1`, then the first heading of any level.
 */
const HEADING_QUERIES = [
  'main h1, [role="main"] h1',
  'h1',
  'h1, h2, h3, h4, h5, h6, [role="heading"]',
] as const;

/**
 * Where focus goes when the button holding it hides and `focusTarget` did not
 * say (`LU-07-I2`): the landmark, made script-focusable. Tried after the
 * heading queries, before giving up and blurring.
 */
const FALLBACK_FOCUS_QUERY = 'main, [role="main"]';

/**
 * `X-7` — a focus indicator that survives forced colors.
 *
 * ★★ The ring is a `box-shadow`, which `forced-colors: active` removes; with
 *    `outline-none` beside it a keyboard user in Windows High Contrast saw NO
 *    focus. Only in that mode, a real (system-coloured) outline comes back.
 * ⚠️ `outline-solid` is required: Tailwind 4's `outline-none` sets
 *    `--tw-outline-style: none`, which `outline-2` alone would inherit.
 */
const FORCED_FOCUS =
  'forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-solid forced-colors:focus-visible:outline-offset-2';

@Component({
  selector: 'sv-scroll-to-top',
  imports: [SvIconComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scroll-to-top.component.html',
})
export class SvScrollToTopComponent implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);

  /** Scroll distance (px) before the button appears. @default 200 */
  threshold    = input<number>(200);
  /** Shape variant: circle, rounded or pill. @default 'circle' */
  variant      = input<ScrollToTopVariant>('circle');
  /** Premium surface style: solid, glass, gradient or outline. @default 'solid' */
  appearance   = input<ScrollToTopAppearance>('solid');
  /** Screen corner to anchor the button. @default 'bottom-right' */
  position     = input<ScrollToTopPosition>('bottom-right');
  /** Show the scroll-progress ring around the button. @default true */
  showProgress = input<boolean>(true);
  /** Optional text label next to the icon. */
  label        = input<string>('');
  /** Accessible label for the button. @default 'Scroll to top' */
  ariaLabel    = input<string>('Scroll to top');
  /** Demo / preview mode: button is always visible regardless of scroll. */
  demo         = input<boolean>(false);
  /** Pin the button inside its nearest positioned ancestor (`position: absolute`)
   *  instead of the viewport (`position: fixed`) — for scrollable panels, cards
   *  and drawers. @default false */
  contained    = input<boolean>(false);
  /** Explicit scroll container to watch. When unset, the nearest scrollable
   *  ancestor (or the window) is used. */
  scrollTarget = input<HTMLElement | null>(null);

  /**
   * Scroll animation. `'smooth'` is honoured only when the user has NOT asked
   * for reduced motion — under `prefers-reduced-motion: reduce` the jump is
   * instant (`LU-07-I3` / `LU-07-M3`, `X-7`). `'auto'` always jumps.
   * @default 'smooth'
   */
  scrollBehavior = input<ScrollToTopBehavior>('smooth');
  /**
   * Where keyboard focus goes after scrolling (`LU-07-I2` / `LU-07-M2`, `X-10`).
   * `false` leaves focus alone when it is somewhere else (a mouse click in
   * Safari never focuses the button) — but if the BUTTON holds focus as it is
   * activated or hides (outside `demo`, where it never hides), focus is never
   * stranded on it (it becomes
   * `aria-hidden` and leaves the tab order): it moves as for `true`, else to
   * `main` / `[role="main"]` (made `tabindex="-1"`), else it is released to the
   * document. `true` moves it to the page's first heading — `main h1`, else the first
   * `h1`, else the first heading of any level — inside the scroll root. A string
   * is a CSS selector for the target. A target that is not focusable gets
   * `tabindex="-1"`. Focus moves with `preventScroll`, so the scroll is not cut short.
   * @default false
   */
  focusTarget = input<boolean | string>(false);
  /**
   * Rank in the shared floating layer's corner stack (`X-5`); lower sits nearer
   * the edge. The default yields the corner to a Speed Dial (10) and a host's
   * launcher registered below 20. Only used in the fixed (viewport) mode.
   * @default SV_FLOATING_ORDER.scrollToTop (20)
   */
  floatingOrder = input<number>(SV_FLOATING_ORDER.scrollToTop);

  /** Emitted when the button is clicked (page scrolls to top). */
  clicked = output<void>();

  readonly visible  = signal(false);
  readonly progress = signal(0);

  /** The positioned wrapper — the region this control occupies. */
  private readonly _wrapper = viewChild<ElementRef<HTMLElement>>('wrapper');

  /** Fixed to the viewport (not demo, not contained) — the only mode that joins the floating layer. */
  private readonly _fixed = computed(() => !this.demo() && !this.contained());

  /**
   * `LU-07-I1` / `LU-07-M1` — join the shared floating layer (`X-5`) while
   * shown, so a Speed Dial, a host's chat launcher, cookie banner or bottom nav
   * in the same corner push this button clear instead of sitting under it. A
   * hidden button registers nothing, so it never reserves space it is not using.
   */
  private readonly _region = svFloatingRegion({
    anchor: () => (this._fixed() && this.visible() ? this.position() : null),
    element: () => this._wrapper()?.nativeElement,
    order: () => this.floatingOrder(),
    label: 'scroll-to-top',
  });

  /**
   * Bottom inset in the fixed mode: the `bottom-6` base, plus the floating
   * layer's offset, plus the device safe area. `null` (the class decides) when
   * demo or contained.
   */
  readonly bottomInset = computed(() =>
    this._fixed() ? svFloatingInset('bottom', 24, this._region.offset()) : null,
  );

  /** Side inset in the fixed mode, clear of a landscape notch. `null` when centred. */
  readonly sideInset = computed(() => {
    if (!this._fixed()) return { left: null, right: null };
    const pos = this.position();
    if (pos === 'bottom-right') return { left: null, right: svFloatingInset('right', 24) };
    if (pos === 'bottom-left') return { left: svFloatingInset('left', 24), right: null };
    return { left: null, right: null };
  });

  private _scrollEl: Element | null = null;
  private _listener = () => this._onScroll();

  ngAfterViewInit(): void {
    if (this.demo()) { this.visible.set(true); this.progress.set(65); return; }
    // ★★★ SSR / prerender: `ngAfterViewInit` DOES run on the server (unlike
    // `afterNextRender`), and there is no `document` or `window` there. Without
    // this guard the whole page fails to prerender — and because this component
    // sits on every marketing page, that is every page. A scroll-to-top button
    // is a browser-only affordance, so skipping it server-side loses nothing.
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    // Prefer an explicit scrollTarget, else the nearest scrollable ancestor.
    this._scrollEl = this.scrollTarget() ?? this._findScrollParent(this.el.nativeElement);
    if (this._scrollEl && this._scrollEl !== document.documentElement) {
      this._scrollEl.addEventListener('scroll', this._listener, { passive: true });
    }
    // Page-level scrolling arrives through the `window:scroll` host listener
    // below — adding a second window listener here ran `_onScroll` twice.
    // Reflect the initial scroll position immediately.
    this._onScroll();
  }

  ngOnDestroy(): void {
    // ★ Also runs on the server: prerender destroys the application after each
    // route, so an unguarded `window` here fails the render just as surely.
    if (typeof window === 'undefined') return;
    this._scrollEl?.removeEventListener('scroll', this._listener);
  }

  @HostListener('window:scroll')
  onWindowScroll(): void { if (!this.demo()) this._onScroll(); }

  private _onScroll(): void {
    // Reachable only from the two guarded hooks and a `window:scroll` host
    // listener that cannot fire on the server — guarded anyway, because "cannot
    // run" is an argument about call sites, and call sites change.
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const el = this._scrollEl && this._scrollEl !== document.documentElement
      ? this._scrollEl
      : document.documentElement;
    const scrollTop = el.scrollTop || window.scrollY || 0;
    const docHeight = el.scrollHeight - el.clientHeight;
    const show = scrollTop > this.threshold();
    // ★ Hiding makes the button `aria-hidden` + `tabindex="-1"` + disabled. A
    //   focused button hidden by a scroll the user did NOT start from it (Home,
    //   a host's own "back to top" link) would strand focus on a node assistive
    //   technology is told does not exist — axe's `aria-hidden-focus`.
    if (!show && this.visible() && this._holdsFocus()) this._rescueFocus();
    this.visible.set(show);
    this.progress.set(docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0);
  }

  private _findScrollParent(node: HTMLElement | null): Element {
    let el: HTMLElement | null = node?.parentElement ?? null;
    while (el && el !== document.body) {
      const { overflow, overflowY } = getComputedStyle(el);
      if (/(auto|scroll)/.test(overflow + overflowY)) return el;
      el = el.parentElement;
    }
    return document.documentElement;
  }

  scrollUp(): void {
    const target = this._scrollEl && this._scrollEl !== document.documentElement
      ? this._scrollEl
      : window;
    // ★ Reduced motion is read at click time, not cached: the OS setting can
    //   change while the page is open, and a stale answer animates anyway.
    // ★ `'instant'`, never `'auto'`: `'auto'` defers to the page's CSS
    //   `scroll-behavior`, so a host with `html { scroll-behavior: smooth }`
    //   (Tailwind `scroll-smooth`) still animated for a reduced-motion user.
    const behavior: ScrollBehavior =
      this.scrollBehavior() === 'smooth' && !prefersReducedMotion() ? 'smooth' : 'instant';
    (target as Element | Window).scrollTo({ top: 0, behavior });
    if (this.focusTarget() === false || this.focusTarget() === '') {
      // Default mode: only a button that HOLDS focus has anything to hand on,
      // and only when it is about to hide — a demo button never does.
      if (!this.demo() && this._holdsFocus()) this._rescueFocus();
    } else {
      this._moveFocus();
    }
    this.clicked.emit();
  }

  /** The rendered button — the one element this component can strand focus on. */
  private readonly _button = viewChild<ElementRef<HTMLButtonElement>>('button');

  /** Whether keyboard focus is on this component's button right now. */
  private _holdsFocus(): boolean {
    if (typeof document === 'undefined') return false;
    const btn = this._button()?.nativeElement;
    return !!btn && document.activeElement === btn;
  }

  /**
   * `LU-07-I2` with the default `focusTarget` — the button is about to hide
   * while it holds focus. Resolved like `focusTarget: true` (the page's main
   * heading), then the `main` landmark, both made `tabindex="-1"` if they are
   * not focusable; failing both, the button is blurred so focus returns to the
   * document instead of resting on a hidden control. Silent: nobody asked for
   * a target, so matching nothing is not worth a warning.
   */
  private _rescueFocus(): void {
    const root = this._focusRoot();
    const target = this._findHeading(root) ?? root.querySelector<HTMLElement>(FALLBACK_FOCUS_QUERY);
    if (target) {
      this._focusElement(target);
      return;
    }
    this._button()?.nativeElement.blur();
  }

  /** The scroll root to search for a focus target — the container, else the document. */
  private _focusRoot(): ParentNode {
    return this._scrollEl && this._scrollEl !== document.documentElement ? this._scrollEl : document;
  }

  /** The first heading by {@link HEADING_QUERIES}, most specific first. */
  private _findHeading(root: ParentNode): HTMLElement | null {
    for (const query of HEADING_QUERIES) {
      const found = root.querySelector<HTMLElement>(query);
      if (found) return found;
    }
    return null;
  }

  /**
   * Focus without scrolling. A heading is not focusable; `-1` makes it a
   * script-only target without adding a tab stop. An author's own tabindex is
   * left as it is.
   */
  private _focusElement(target: HTMLElement): void {
    // (A local, because `svIsFocusable` is a type guard: its false branch
    //  narrows `target` itself to `never`.)
    const el: HTMLElement = target;
    if (!svIsFocusable(el) && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  /**
   * `focusTarget` — scroll AND move focus, so a keyboard user's next Tab starts
   * at the top instead of from a button that just hid itself.
   */
  private _moveFocus(): void {
    const wanted = this.focusTarget();
    if (wanted === false || wanted === '') return;
    const root = this._focusRoot();

    let target: HTMLElement | null = null;
    if (typeof wanted === 'string') {
      try {
        target = root.querySelector<HTMLElement>(wanted);
      } catch {
        // ⚠️ `querySelector` THROWS on an invalid selector. Validate, warn, and
        //    leave focus alone rather than breaking the click.
        svWarnOnce('scroll-to-top:bad-focus-target', `sv-scroll-to-top: focusTarget "${wanted}" is not a valid CSS selector.`);
        return;
      }
    } else {
      target = this._findHeading(root);
    }

    if (!target) {
      svWarnOnce('scroll-to-top:no-focus-target', 'sv-scroll-to-top: focusTarget matched nothing, so focus was not moved.');
      return;
    }
    this._focusElement(target);
  }

  readonly positionClass = computed(() => {
    // Preview/demo mode: render in normal flow (static) so several instances can
    // sit side-by-side inside a showcase card instead of stacking fixed in a corner.
    if (this.demo()) return 'inline-flex';
    const corner = {
      'bottom-right':  'bottom-6 right-6',
      'bottom-left':   'bottom-6 left-6',
      'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
    }[this.position()];
    // Contained: pin to the nearest positioned ancestor; else fix to the viewport.
    return (this.contained() ? 'absolute z-10 ' : 'fixed z-50 ') + corner;
  });

  readonly btnClass = computed(() => {
    // ★ The show/hide transition used to be an inline `style="transition: …"`,
    //   which no `motion-reduce:` utility can override. It is a class now, and
    //   stills under reduced motion (`X-7`). `forced-colors:` gives every
    //   appearance a system-colour edge: glass and gradient surfaces are
    //   replaced wholesale in that mode and would otherwise leave a bare icon.
    const base = 'relative inline-flex items-center justify-center overflow-hidden transition-[opacity,transform] duration-300 motion-reduce:transition-none active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 forced-colors:border-2 forced-colors:border-[ButtonText] ' + FORCED_FOCUS;

    // Shape controls geometry only.
    const shape = {
      circle:  ' h-12 w-12 rounded-full',
      rounded: ' h-12 w-12 rounded-2xl',
      pill:    ' h-10 gap-2 rounded-full px-4',
    }[this.variant()];

    // Appearance controls the surface (colour / blur / border / shadow).
    const look = {
      solid:    ' bg-primary-600 text-white shadow-lg hover:bg-primary-700 hover:shadow-xl',
      glass:    ' bg-white/70 text-primary-600 border border-white/50 shadow-lg backdrop-blur-md hover:bg-white/90 hover:shadow-xl dark:bg-gray-900/60 dark:text-primary-300 dark:border-white/10 dark:hover:bg-gray-900/80',
      gradient: ' bg-gradient-to-br from-primary-600 to-brandaccent-700 text-white shadow-lg shadow-primary-500/30 hover:shadow-xl hover:brightness-110',
      outline:  ' border-2 border-primary-500/70 bg-white text-primary-600 shadow-sm hover:bg-primary-50 hover:shadow-md dark:bg-gray-900 dark:text-primary-300 dark:hover:bg-primary-950/40',
    }[this.appearance()];

    return base + shape + look;
  });

  readonly visibilityClass = computed(() =>
    this.visible()
      ? 'opacity-100 scale-100 translate-y-0'
      : 'opacity-0 scale-75 translate-y-4 pointer-events-none'
  );

  // SVG progress circle — radius sized to fit exactly in the button
  readonly radius = 22;
  readonly circumference = computed(() => 2 * Math.PI * this.radius);
  readonly dashOffset = computed(() =>
    this.circumference() - (this.progress() / 100) * this.circumference()
  );
}
