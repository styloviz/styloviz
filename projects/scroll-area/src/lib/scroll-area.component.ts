import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons/core';
import {
  prefersReducedMotion,
  svIsRtl,
  svPointerFraction,
  svUniqueId,
  SvRevealFocusDirective,
} from '@styloviz/core/a11y';
import { injectSvLabels } from '@styloviz/core/i18n';
import { svElementSize } from '@styloviz/core/layout';
import { SV_SCROLL_AREA_LABELS } from './scroll-area.labels';
import {
  SV_MIN_THUMB_PX,
  svLogicalScrollStart,
  svPhysicalScrollLeft,
  svScrollEdges,
  svScrollLabel,
  svScrollTopForThumb,
  svScrollable,
  svThumbGeometry,
  type SvRtlScrollType,
} from './scroll-area.geometry';
import { svRtlScrollType } from './scroll-area.rtl';

import { registerScrollAreaIcons } from './scroll-area.component.icons';
export type ScrollAreaVariant =
  /** The thumb appears on hover, on focus and while scrolling. */
  | 'auto'
  /** The thumb is always drawn. */
  | 'always'
  /** The thumb appears on hover only, and lingers for `hideDelay` (`SR-28`). */
  | 'hover'
  /** No thumb at all; edge fades only. */
  | 'hidden';

/**
 * Where the thumb sits (`SR-28`). `'overlay'` draws it over the content —
 * nothing reflows; `'inset'` reserves a gutter so it never covers a row's
 * trailing text or a button.
 */
export type ScrollAreaScrollbars = 'overlay' | 'inset';

/** The thumb's shape: a pill, a square bar, or a pill on a visible track (`SR-28`). */
export type ScrollAreaThumbStyle = 'pill' | 'square' | 'track';

/** Thumb thickness: 6, 8 or 12 px (`SR-28`). */
export type ScrollAreaSize = 'sm' | 'md' | 'lg';

/**
 * How the edges that hide content are marked (`SR-28`). `'gradient'` fades
 * to `--sv-sa-fade` (the surface colour); `'shadow'` is an inner shadow,
 * which works over any background without knowing its colour.
 */
export type ScrollAreaFadeStyle = 'gradient' | 'shadow';

/** Options for `scrollTo()` / `scrollBy()`. */
export interface SvScrollAreaScrollOptions {
  /** `'smooth'` unless the user prefers reduced motion. @default 'smooth' */
  readonly behavior?: 'smooth' | 'instant';
}

/**
 * Which axis the drawn thumb follows. `'both'` (`SR-28b`) draws a thumb on
 * each axis with a corner where they meet — a wide table in a short card.
 */
export type ScrollAreaOrientation = 'vertical' | 'horizontal' | 'both';

/**
 * Scroll snapping (`SR-28b`). Mark the items with `snap-start` (or
 * `snap-center` / `snap-end`, or `data-sv-snap-item`); the area adds the
 * container half. `'proximity'` snaps only when the user stops close to an item.
 */
export type ScrollAreaSnap = 'none' | 'mandatory' | 'proximity';

/**
 * Whether the scrolling element is a tab stop.
 *
 * - `'auto'` — only while there is something to scroll (or while it already
 *   holds focus, so a shrink never yanks focus away).
 * - `'always'` — the previous behaviour: a tab stop even when everything fits.
 * - `'never'` — for content that is itself focusable, where the browser already
 *   scrolls the region as focus moves through it.
 */
export type ScrollAreaTabStop = 'auto' | 'always' | 'never';

/**
 * `<sv-scroll-area>` — a styled scrollbar drawn over a real scrolling element.
 *
 * ★★★ THE ELEMENT GENUINELY SCROLLS. Custom scrollbars built on a transform
 * inside an `overflow: hidden` box lose Page Up/Down, Home/End, arrow keys,
 * spacebar, trackpad momentum, `scrollIntoView`, find-in-page auto-scroll and
 * every screen reader's virtual cursor — all of which are free if the element
 * really scrolls, and none of which can be faithfully reimplemented.
 *
 * ── Measurement contract (`X-4`, `LU-06-I1`) ────────────────────────────────
 * ★★ AUTOMATIC BY DEFAULT. The viewport and a wrapper around the projected
 *    content are both observed with `svElementSize` (border box, one reading
 *    per animation frame), so content that grows or shrinks WITHOUT a scroll
 *    event — rows loaded, an image decoded, a panel expanded — re-measures on
 *    its own. The first measurement runs after the first render, not on the
 *    first scroll.
 *
 * ⚠️ `measure()` IS STILL NEEDED when `observeContent` is `false`, where there
 *    is no `ResizeObserver` (the SSR no-op), and when something changes that
 *    moves no box — a text direction flip, or content that overflows its own
 *    wrapper through absolute positioning or negative margins.
 */
@Component({
  selector: 'sv-scroll-area',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, SvIconComponent, SvRevealFocusDirective],
  templateUrl: './scroll-area.component.html',
  // ★★ BLOCK, AND ALLOWED TO SHRINK (`SR-08`). An inline host has no width of
  //    its own, and a grid or flex item defaults to `min-width: auto` — so the
  //    horizontal content box (`w-max`) became the item's minimum width, the
  //    port grew to fit it, and nothing scrolled.
  host: {
    class: 'block min-w-0 max-w-full',
    // `fill` (`SR-30b`): take the height a flex column gives it, not a max-height.
    '[class.flex]': 'fill()', // sv-i18n-ignore: host class binding
    '[class.flex-col]': 'fill()', // sv-i18n-ignore: host class binding
    '[class.min-h-0]': 'fill()', // sv-i18n-ignore: host class binding
  },
})
export class SvScrollAreaComponent {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerScrollAreaIcons();

  protected readonly labels = injectSvLabels('scrollArea', SV_SCROLL_AREA_LABELS);
  private readonly uid = svUniqueId('sv-sa');
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly port = viewChild<ElementRef<HTMLElement>>('port');
  private readonly headerBox = viewChild<ElementRef<HTMLElement>>('header');
  private readonly contentBox = viewChild<ElementRef<HTMLElement>>('content');

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** When the thumb is drawn. @default 'auto' */
  readonly variant = input<ScrollAreaVariant>('auto');

  /** Max height of the scrolling box, as a CSS length. Ignored with `fill`. @default '16rem' */
  readonly maxHeight = input<string>('16rem');

  /**
   * Fill the height the parent gives the host — `flex-1` in a flex column, a
   * sidebar's list under its header — instead of growing to `maxHeight`.
   * @default false
   */
  readonly fill = input<boolean>(false);

  /** Smallest grabbable thumb, in px. @default 24 */
  readonly minThumb = input<number>(SV_MIN_THUMB_PX);

  /**
   * Fade the edges that have content behind them.
   *
   * ★★ Once the native chrome is hidden, a list that scrolls looks exactly like
   * a list that does not. This is the only affordance left.
   * @default true
   */
  readonly edgeFade = input<boolean>(true);

  /** Accessible name for the scrolling region. @default '' */
  readonly ariaLabel = input<string>('');

  /**
   * Re-measure automatically when the viewport or the content resizes, with no
   * scroll event needed (`X-4`). Turn off only to drive `measure()` yourself —
   * e.g. a virtualised list that already knows its size.
   * @default true
   */
  readonly observeContent = input<boolean>(true);

  /**
   * Whether the region is a tab stop. `'auto'` makes it one only while it can
   * actually scroll — short content adds no empty tab stop.
   * @default 'auto'
   */
  readonly tabStop = input<ScrollAreaTabStop>('auto');

  /**
   * Which axis the drawn thumb, the edge fades and track paging follow.
   * `'horizontal'` normalises `scrollLeft` for RTL, so the thumb and the fades
   * start at the inline start in either direction.
   * @default 'vertical'
   */
  readonly orientation = input<ScrollAreaOrientation>('vertical');

  /** Overlay the thumb, or reserve an inset gutter for it. @default 'overlay' */
  readonly scrollbars = input<ScrollAreaScrollbars>('overlay');

  /** The thumb's shape. @default 'pill' */
  readonly thumbStyle = input<ScrollAreaThumbStyle>('pill');

  /** Thumb thickness. @default 'md' */
  readonly size = input<ScrollAreaSize>('md');

  /**
   * How hidden content is marked at the edges. `'gradient'` fades to the
   * surface colour — set `fadeColor` (or the `--sv-sa-fade` custom property)
   * when the area sits on anything but the default white / gray-900 card;
   * `'shadow'` needs no colour at all. @default 'gradient'
   */
  readonly fadeStyle = input<ScrollAreaFadeStyle>('gradient');

  /**
   * The colour a `'gradient'` fade ends in — the background behind the area.
   * Empty uses the `--sv-sa-fade` custom property, else white / gray-900.
   * @default ''
   */
  readonly fadeColor = input<string>('');

  /** With `variant="hover"`, how long the thumb stays after the pointer leaves, in ms. @default 600 */
  readonly hideDelay = input<number>(600);

  /**
   * Show a floating "back to the start" button once the area has scrolled
   * `showAfter` px. @default false
   */
  readonly backToTop = input<boolean>(false);
  /** How far the area must scroll before the back-to-top button appears, in px. @default 240 */
  readonly showAfter = input<number>(240);
  /** The back-to-top button's accessible name. @default 'Back to top' */
  readonly backToTopLabel = input<string>(this.labels.backToTop);

  /** A thin progress bar along the start edge, filling as the area scrolls. @default false */
  readonly progress = input<boolean>(false);

  /**
   * How close to an end counts as reaching it, in px — `reachedEnd` fires
   * this far before the last row, so the next page can load before the user
   * hits the bottom. @default 48
   */
  readonly threshold = input<number>(48);

  /** Snap the scroll to the items (`SR-28b`). @default 'none' */
  readonly snap = input<ScrollAreaSnap>('none');

  /**
   * The total content height in px, for a virtual list that renders only the
   * rows in view (`SR-28b`). The content box is given at least this height,
   * so the element still genuinely scrolls the whole list; position the
   * rendered window yourself from `scrolled`. Null measures the content.
   * @default null
   */
  readonly contentHeight = input<number | null>(null);

  /**
   * Emitted on every scroll, with the current position along the axis:
   * `scrollTop` when vertical, the px from the INLINE START when horizontal
   * (direction-normalised, so it is never negative in RTL).
   */
  readonly scrolled = output<number>();

  /**
   * The area came within `threshold` px of its end — the infinite-scroll
   * hook. Fires once per arrival: it re-arms only after the user scrolls back
   * out of the threshold, or when the content grows (a page was appended).
   */
  readonly reachedEnd = output<void>();
  /** The area came within `threshold` px of its start. Fires once per arrival. */
  readonly reachedStart = output<void>();

  /**
   * With `snap`, the index of the item the area settled on, once the scroll
   * comes to rest — not on every frame of the way there.
   */
  readonly snapChange = output<number>();

  // ── Measured state ────────────────────────────────────────────────────────

  readonly viewport = signal(0);
  readonly content = signal(0);
  readonly scrollTop = signal(0);
  /** Horizontal only: px from the inline start, whatever the text direction. */
  readonly scrollStart = signal(0);
  /** `'both'` only: the inline axis, measured like a horizontal area. */
  readonly xViewport = signal(0);
  readonly xContent = signal(0);
  /** Height of the projected sticky header, in px (0 without one). */
  readonly headerPx = signal(0);
  /** True while the pointer is dragging the thumb. */
  readonly dragging = signal(false);
  /** True while the scrolling element itself holds focus. */
  private readonly focused = signal(false);
  /**
   * True while the axis the thumb does NOT follow also overflows. A single
   * `overflow-*-auto` computes the other axis to `auto` too, so a wide table
   * in a short vertical area still scrolls natively on x.
   */
  private readonly crossOverflow = signal(false);

  /** Direction read at the last `measure()`; scrolling does not flip it. */
  private rtl = false;

  /**
   * ★★ THE THUMB SHOWS WHILE SCROLLING, NOT ONLY ON HOVER (`SR-28`). A touch
   *    screen has no hover, so an `'auto'` thumb that waited for one was never
   *    seen by a phone user at all. It now shows for ~800 ms after each scroll.
   */
  readonly recentlyScrolled = signal(false);
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;
  private snapTimer: ReturnType<typeof setTimeout> | null = null;
  private snapIndex = -1;

  /** Armed edges: an arrival fires once, then waits for the user to leave. */
  private endArmed = true;
  private startArmed = false;

  // ── Observation (`X-4`) ───────────────────────────────────────────────────

  private readonly portSize = svElementSize(() =>
    this.observeContent() ? this.port()?.nativeElement : null,
  );
  private readonly contentSize = svElementSize(() =>
    this.observeContent() ? this.contentBox()?.nativeElement : null,
  );
  private readonly headerSize = svElementSize(() =>
    this.observeContent() ? this.headerBox()?.nativeElement : null,
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.scrollTimer !== null) clearTimeout(this.scrollTimer);
      if (this.snapTimer !== null) clearTimeout(this.snapTimer);
    });
    // ★ After render, never during it: `scrollHeight` is only meaningful once
    //   the projected content is laid out, and reading it in a template pass
    //   would force a synchronous layout per change detection. Browser-only by
    //   construction — `afterRenderEffect` does not run on the server.
    afterRenderEffect(() => {
      this.portSize();
      this.contentSize();
      this.headerSize();
      this.contentHeight();
      this.orientation();
      untracked(() => this.measure());
    });
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly horizontal = computed(() => this.orientation() === 'horizontal');
  /** Both axes: the vertical thumb as usual, plus an inline one. */
  readonly both = computed(() => this.orientation() === 'both');

  /** The position along the scroll axis, logical in both directions. */
  private readonly position = computed(() =>
    this.horizontal() ? this.scrollStart() : this.scrollTop(),
  );

  /**
   * ★★ THE THUMB RUNS UNDER THE STICKY HEADER, NOT BEHIND IT (`SR-28b`). The
   *    header covers the top of the viewport, so the track starts below it
   *    and its geometry is that of the rows the header leaves visible.
   *    In `'both'` the corner is taken off whichever track would cross it.
   */
  readonly trackLength = computed(() =>
    Math.max(0, this.viewport() - this.trackInset() - this.cornerOverlap()),
  );

  readonly thumb = computed(() => {
    const inset = this.trackInset();
    const track = this.trackLength();
    const geo = svThumbGeometry(this.viewport() - inset, this.content() - inset, this.position(), this.minThumb());
    const span = this.viewport() - inset;
    if (!this.cornerOverlap() || span <= 0) return geo;
    // Rescale onto the shorter track so the thumb never runs into the corner.
    const k = track / span;
    return { ...geo, size: Math.max(Math.min(this.minThumb(), track), geo.size * k), offset: geo.offset * k };
  });

  /** The header's height along the vertical track; horizontal areas ignore it. */
  protected readonly trackInset = computed(() => (this.horizontal() ? 0 : this.headerPx()));

  /** `'both'`: the inline-axis thumb. */
  readonly xThumb = computed(() => {
    const geo = svThumbGeometry(this.xViewport(), this.xContent(), this.scrollStart(), this.minThumb());
    const track = this.xTrackLength();
    if (!this.cornerOverlap() || this.xViewport() <= 0) return geo;
    const k = track / this.xViewport();
    return { ...geo, size: Math.max(Math.min(this.minThumb(), track), geo.size * k), offset: geo.offset * k };
  });
  readonly xTrackLength = computed(() => Math.max(0, this.xViewport() - this.cornerOverlap()));
  readonly showXThumb = computed(() => this.both() && this.variant() !== 'hidden' && this.xThumb().visible);
  readonly xEdges = computed(() =>
    this.both() ? svScrollEdges(this.xViewport(), this.xContent(), this.scrollStart()) : 'none',
  );
  readonly xFadeStart = computed(() => this.edgeFade() && (this.xEdges() === 'start' || this.xEdges() === 'both'));
  readonly xFadeEnd = computed(() => this.edgeFade() && (this.xEdges() === 'end' || this.xEdges() === 'both'));

  /** The square where two thumbs meet; 0 unless both are drawn. */
  readonly cornerPx = computed(() =>
    this.both() &&
    this.variant() !== 'hidden' &&
    svScrollable(this.xViewport(), this.xContent()) > 0 &&
    svScrollable(this.viewport(), this.content()) > 0
      ? this.gutterPx() || this.thumbPx() + 4
      : 0,
  );

  /**
   * How much of each track the corner takes. Overlay thumbs share the
   * viewport, so they stop short of each other; inset thumbs live in the
   * gutters, outside the viewport, and the corner is where the gutters cross.
   */
  private readonly cornerOverlap = computed(() => (this.gutterPx() ? 0 : this.cornerPx()));

  /** Tailwind's snap container classes for the axis. */
  protected readonly snapClass = computed(() => {
    const snap = this.snap();
    if (snap === 'none') return '';
    const axis = this.horizontal() ? 'snap-x' : this.both() ? 'snap-both' : 'snap-y';
    return `${axis} ${snap === 'mandatory' ? 'snap-mandatory' : 'snap-proximity'}`;
  });

  readonly edges = computed(() => svScrollEdges(this.viewport(), this.content(), this.position()));

  readonly scrollable = computed(() => svScrollable(this.viewport(), this.content()));

  readonly label = computed(() => svScrollLabel(this.viewport(), this.content(), this.position(), this.labels));

  readonly showThumb = computed(
    () => this.variant() !== 'hidden' && this.thumb().visible,
  );

  /** The start fade sits under the sticky header, where the hidden rows are. */
  protected readonly fadeTopPx = computed(() => this.trackInset());

  /** The thumb's thickness in px. */
  readonly thumbPx = computed(() => ({ sm: 6, md: 8, lg: 12 })[this.size()]);

  /** The inset gutter, when the thumb gets one: its thickness plus breathing room. */
  readonly gutterPx = computed(() => (this.scrollbars() === 'inset' && this.variant() !== 'hidden' ? this.thumbPx() + 6 : 0));

  /** Whether the thumb is drawn right now (opacity, not presence). */
  readonly thumbShown = computed(() =>
    this.variant() === 'always' || this.dragging() || (this.variant() === 'auto' && this.recentlyScrolled()),
  );

  protected readonly thumbClass = computed(() => {
    const shape = this.thumbStyle() === 'square' ? 'rounded-none' : 'rounded-full';
    return shape;
  });

  protected readonly trackClass = computed(() => {
    const shape = this.thumbStyle() === 'square' ? 'rounded-none' : 'rounded-full';
    const fill = this.thumbStyle() === 'track' ? ' bg-gray-200/80 dark:bg-gray-700/60' : '';
    const show = this.thumbShown()
      ? 'opacity-100'
      : 'opacity-0 hover:opacity-100 focus-within:opacity-100' +
        (this.variant() === 'hover' ? ' transition-opacity [transition-delay:var(--sv-sa-hide-delay)] hover:[transition-delay:0ms]' : '');
    return `${shape}${fill} ${show}`;
  });

  /** `--sv-sa-fade` for a gradient fade; empty leaves the inherited property alone. */
  protected readonly fadeVar = computed(() => this.fadeColor() || null);

  /** The progress bar's fill, 0–1. */
  readonly progressValue = computed(() => this.thumb().progress);

  /** The back-to-top button, once the area has scrolled far enough. */
  readonly showBackToTop = computed(() => this.backToTop() && this.position() > Math.max(0, this.showAfter()));

  readonly fadeStart = computed(
    () => this.edgeFade() && (this.edges() === 'start' || this.edges() === 'both'),
  );
  readonly fadeEnd = computed(
    () => this.edgeFade() && (this.edges() === 'end' || this.edges() === 'both'),
  );

  /**
   * ★★ A TAB STOP ONLY WHEN THERE IS SOMETHING TO SCROLL (`LU-06-I2`). A
   *    region whose content fits gives a keyboard user a stop that does
   *    nothing. It stays a stop while it holds focus, so content shrinking
   *    under a focused region never drops focus to `<body>`.
   *
   * ★ BOTH AXES COUNT. The thumb follows one axis, but the element scrolls
   *   natively on either — a wide table in a short vertical area is reachable
   *   only through this stop, so cross-axis overflow keeps it too.
   */
  readonly tabIndex = computed<0 | null>(() => {
    switch (this.tabStop()) {
      case 'always':
        return 0;
      case 'never':
        return null;
      default:
        return this.scrollable() > 0 || this.crossOverflow() || this.focused() ? 0 : null;
    }
  });

  // ── Interactions ──────────────────────────────────────────────────────────

  /**
   * Re-read the element's dimensions and text direction.
   *
   * Automatic while `observeContent` is on (the default). Call it yourself when
   * observation is off, when the direction changes, or after a change that
   * moves no box — see the measurement contract on the class.
   */
  measure(): void {
    const el = this.port()?.nativeElement;
    if (!el) return;
    this.rtl = (this.horizontal() || this.both()) && svIsRtl(el);
    this.headerPx.set(this.headerBox()?.nativeElement.offsetHeight ?? 0);
    this.read(el);
  }

  onScroll(): void {
    const el = this.port()?.nativeElement;
    if (!el) return;
    this.read(el);
    this.scrolled.emit(this.position());
    this.recentlyScrolled.set(true);
    if (this.scrollTimer !== null) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      this.scrollTimer = null;
      this.recentlyScrolled.set(false);
    }, 800);
    this.checkEdges();
    if (this.snap() !== 'none') this.scheduleSnapRead();
  }

  /**
   * ★ ON REST, NOT ON EVERY FRAME. Snapping animates through every position
   *   between two items; reporting each would announce items the user never
   *   stopped on. 120 ms of quiet covers `scrollend` where it is missing.
   */
  private scheduleSnapRead(): void {
    if (this.snapTimer !== null) clearTimeout(this.snapTimer);
    this.snapTimer = setTimeout(() => {
      this.snapTimer = null;
      const index = this.currentSnapIndex();
      if (index >= 0 && index !== this.snapIndex) {
        this.snapIndex = index;
        this.snapChange.emit(index);
      }
    }, 120);
  }

  /** The snap item whose start is nearest the scroll position. */
  currentSnapIndex(): number {
    const el = this.port()?.nativeElement;
    if (!el) return -1;
    const items = this.snapItems(el);
    if (!items.length) return -1;
    const port = el.getBoundingClientRect();
    const horizontal = this.horizontal();
    let best = -1;
    let bestDistance = Infinity;
    items.forEach((item, i) => {
      const box = item.getBoundingClientRect();
      const distance = horizontal
        ? Math.abs(this.rtl ? port.right - box.right : box.left - port.left)
        : Math.abs(box.top - port.top - this.trackInset());
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  /** Scroll the `index`-th snap item to the start of the area. */
  scrollToSnap(index: number, options: SvScrollAreaScrollOptions = {}): void {
    const el = this.port()?.nativeElement;
    if (!el) return;
    const item = this.snapItems(el)[Math.max(0, Math.trunc(index))];
    if (item) this.scrollIntoView(item, { ...options, align: 'start' });
  }

  private snapItems(el: HTMLElement): HTMLElement[] {
    return Array.from(
      el.querySelectorAll<HTMLElement>('[data-sv-snap-item], .snap-start, .snap-center, .snap-end'),
    );
  }

  /**
   * ★★ ONCE PER ARRIVAL, NOT ONCE PER SCROLL EVENT. A wheel fires twenty
   *    scroll events through the last 48 px; an infinite list that loaded a
   *    page on each would fetch twenty pages. An edge re-arms when the user
   *    leaves it, or when the content grows under them.
   */
  private checkEdges(): void {
    const max = this.scrollable();
    if (max <= 0) return;
    const at = this.position();
    const near = Math.max(0, this.threshold());
    if (at >= max - near) {
      if (this.endArmed) {
        this.endArmed = false;
        this.reachedEnd.emit();
      }
    } else {
      this.endArmed = true;
    }
    if (at <= near) {
      if (this.startArmed) {
        this.startArmed = false;
        this.reachedStart.emit();
      }
    } else {
      this.startArmed = true;
    }
  }

  // ── Programmatic scrolling (`SR-28`) ─────────────────────────────────────

  /**
   * Scroll to a position along the axis (px from the start; logical in RTL).
   * Smooth unless the user prefers reduced motion, or `behavior: 'instant'`.
   */
  scrollTo(position: number, options: SvScrollAreaScrollOptions = {}): void {
    const el = this.port()?.nativeElement;
    if (!el) return;
    const next = Math.max(0, Math.min(this.scrollable(), Number.isFinite(position) ? position : 0));
    const behavior = options.behavior === 'instant' || prefersReducedMotion() ? 'instant' : 'smooth';
    if (typeof el.scrollTo === 'function') {
      el.scrollTo(this.horizontal()
        ? { left: svPhysicalScrollLeft(next, this.scrollable(), this.rtl, this.rtlType()), behavior }
        : { top: next, behavior });
    } else {
      this.write(el, next);
    }
    if (behavior === 'instant') this.onScroll();
  }

  /** Scroll by a delta along the axis. */
  scrollBy(delta: number, options: SvScrollAreaScrollOptions = {}): void {
    this.scrollTo(this.position() + (Number.isFinite(delta) ? delta : 0), options);
  }

  /** Back to the start — what the floating button does. */
  scrollToStart(options: SvScrollAreaScrollOptions = {}): void {
    this.scrollTo(0, options);
  }

  /** To the end. */
  scrollToEnd(options: SvScrollAreaScrollOptions = {}): void {
    this.scrollTo(this.scrollable(), options);
  }

  /**
   * Bring a descendant into view inside THIS area, without scrolling the page
   * around it — which `element.scrollIntoView()` would.
   */
  scrollIntoView(target: Element | string, options: SvScrollAreaScrollOptions & { align?: 'start' | 'center' | 'nearest' } = {}): void {
    const el = this.port()?.nativeElement;
    if (!el) return;
    const node = typeof target === 'string' ? el.querySelector(target) : target;
    if (!node || !el.contains(node)) return;
    // ★★ Re-read the port first. `position()` follows `scroll` events, so
    //    during a smooth scroll it lags the boxes measured below, and a call
    //    made mid-glide would aim short by the distance already travelled.
    this.read(el);
    const box = node.getBoundingClientRect();
    const port = el.getBoundingClientRect();
    const align = options.align ?? 'nearest';
    const horizontal = this.horizontal();
    const size = horizontal ? port.width : port.height - this.trackInset();
    const itemStart = (horizontal ? (this.rtl ? port.right - box.right : box.left - port.left) : box.top - port.top - this.trackInset()) + this.position();
    const itemSize = horizontal ? box.width : box.height;
    let next = this.position();
    if (align === 'start') next = itemStart;
    else if (align === 'center') next = itemStart - (size - itemSize) / 2;
    else if (itemStart < this.position()) next = itemStart;
    else if (itemStart + itemSize > this.position() + size) next = itemStart + itemSize - size;
    this.scrollTo(next, options);
  }

  onFocusChange(focused: boolean): void {
    this.focused.set(focused);
  }

  /**
   * ★★★ CLICKING THE TRACK PAGES, IT DOES NOT JUMP. Every native scrollbar on
   * every platform moves by one viewport when the track is clicked; jumping the
   * thumb to the pointer is a different gesture with the same target, and it
   * throws away the reader's place in a way they cannot undo.
   *
   * ★ Horizontally the pointer is read as a fraction from the INLINE start
   *   (`svPointerFraction`), so "before the thumb" pages back in RTL too.
   */
  onTrackClick(event: MouseEvent, track: HTMLElement): void {
    const el = this.port()?.nativeElement;
    if (!el || this.dragging()) return;
    const rect = track.getBoundingClientRect();
    const at = this.horizontal()
      ? svPointerFraction(event.clientX, track) * rect.width
      : event.clientY - rect.top;
    const geo = this.thumb();
    const direction = at < geo.offset ? -1 : at > geo.offset + geo.size ? 1 : 0;
    if (direction === 0) return;
    const next = Math.max(
      0,
      Math.min(this.scrollable(), this.position() + direction * this.viewport()),
    );
    this.write(el, next);
    this.onScroll();
  }

  /** `'both'`: pressing the inline track pages by one viewport width. */
  onXTrackClick(event: MouseEvent, track: HTMLElement): void {
    const el = this.port()?.nativeElement;
    if (!el || this.dragging()) return;
    const at = svPointerFraction(event.clientX, track) * track.getBoundingClientRect().width;
    const geo = this.xThumb();
    const direction = at < geo.offset ? -1 : at > geo.offset + geo.size ? 1 : 0;
    if (direction === 0) return;
    const max = svScrollable(this.xViewport(), this.xContent());
    const next = Math.max(0, Math.min(max, this.scrollStart() + direction * this.xViewport()));
    el.scrollLeft = svPhysicalScrollLeft(next, max, this.rtl, this.rtlType());
    this.onScroll();
  }

  /** Move the thumb to an absolute track offset, in px from the (inline) start. */
  dragTo(offset: number): void {
    const el = this.port()?.nativeElement;
    if (!el) return;
    this.write(el, svScrollTopForThumb(offset, this.viewport(), this.content(), this.minThumb()));
    this.onScroll();
  }

  saId(suffix: string): string {
    return `${this.uid}-${suffix}`;
  }

  // ── The one place that touches scroll coordinates ─────────────────────────

  private read(el: HTMLElement): void {
    // Content that grew (a page appended) re-arms the end, so the next
    // arrival loads the next page.
    const grew = (this.horizontal() ? el.scrollWidth : el.scrollHeight) > this.content();
    this.crossOverflow.set(
      this.horizontal()
        ? svScrollable(el.clientHeight, el.scrollHeight) > 0
        : svScrollable(el.clientWidth, el.scrollWidth) > 0,
    );
    if (this.horizontal()) {
      const scrollable = svScrollable(el.clientWidth, el.scrollWidth);
      this.viewport.set(el.clientWidth);
      this.content.set(el.scrollWidth);
      this.scrollStart.set(
        svLogicalScrollStart(el.scrollLeft, scrollable, this.rtl, this.rtlType()),
      );
      if (grew) this.endArmed = true;
      return;
    }
    this.viewport.set(el.clientHeight);
    this.content.set(el.scrollHeight);
    this.scrollTop.set(el.scrollTop);
    if (this.both()) {
      const scrollable = svScrollable(el.clientWidth, el.scrollWidth);
      this.xViewport.set(el.clientWidth);
      this.xContent.set(el.scrollWidth);
      this.scrollStart.set(svLogicalScrollStart(el.scrollLeft, scrollable, this.rtl, this.rtlType()));
    }
    if (grew) this.endArmed = true;
  }

  private write(el: HTMLElement, position: number): void {
    if (this.horizontal()) {
      el.scrollLeft = svPhysicalScrollLeft(position, this.scrollable(), this.rtl, this.rtlType());
    } else {
      el.scrollTop = position;
    }
  }

  private rtlType(): SvRtlScrollType {
    return this.rtl ? svRtlScrollType(this.doc) : 'negative';
  }
}
