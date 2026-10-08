import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { svElementSize, svIsRtl, svPointerFraction, svUniqueId } from '@styloviz/core';
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

export type ScrollAreaVariant =
  /** The thumb appears on hover and on scroll. */
  | 'auto'
  /** The thumb is always drawn. */
  | 'always'
  /** No thumb at all; edge fades only. */
  | 'hidden';

/** Which axis the drawn thumb follows. */
export type ScrollAreaOrientation = 'vertical' | 'horizontal';

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
  imports: [NgClass],
  templateUrl: './scroll-area.component.html',
})
export class SvScrollAreaComponent {
  private readonly uid = svUniqueId('sv-sa');
  private readonly doc = inject(DOCUMENT);

  private readonly port = viewChild<ElementRef<HTMLElement>>('port');
  private readonly contentBox = viewChild<ElementRef<HTMLElement>>('content');

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** When the thumb is drawn. @default 'auto' */
  readonly variant = input<ScrollAreaVariant>('auto');

  /** Max height of the scrolling box, as a CSS length. @default '16rem' */
  readonly maxHeight = input<string>('16rem');

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

  /**
   * Emitted on every scroll, with the current position along the axis:
   * `scrollTop` when vertical, the px from the INLINE START when horizontal
   * (direction-normalised, so it is never negative in RTL).
   */
  readonly scrolled = output<number>();

  // ── Measured state ────────────────────────────────────────────────────────

  readonly viewport = signal(0);
  readonly content = signal(0);
  readonly scrollTop = signal(0);
  /** Horizontal only: px from the inline start, whatever the text direction. */
  readonly scrollStart = signal(0);
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

  // ── Observation (`X-4`) ───────────────────────────────────────────────────

  private readonly portSize = svElementSize(() =>
    this.observeContent() ? this.port()?.nativeElement : null,
  );
  private readonly contentSize = svElementSize(() =>
    this.observeContent() ? this.contentBox()?.nativeElement : null,
  );

  constructor() {
    // ★ After render, never during it: `scrollHeight` is only meaningful once
    //   the projected content is laid out, and reading it in a template pass
    //   would force a synchronous layout per change detection. Browser-only by
    //   construction — `afterRenderEffect` does not run on the server.
    afterRenderEffect(() => {
      this.portSize();
      this.contentSize();
      this.orientation();
      untracked(() => this.measure());
    });
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly horizontal = computed(() => this.orientation() === 'horizontal');

  /** The position along the scroll axis, logical in both directions. */
  private readonly position = computed(() =>
    this.horizontal() ? this.scrollStart() : this.scrollTop(),
  );

  readonly thumb = computed(() =>
    svThumbGeometry(this.viewport(), this.content(), this.position(), this.minThumb()),
  );

  readonly edges = computed(() => svScrollEdges(this.viewport(), this.content(), this.position()));

  readonly scrollable = computed(() => svScrollable(this.viewport(), this.content()));

  readonly label = computed(() => svScrollLabel(this.viewport(), this.content(), this.position()));

  readonly showThumb = computed(
    () => this.variant() !== 'hidden' && this.thumb().visible,
  );

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
    this.rtl = this.horizontal() && svIsRtl(el);
    this.read(el);
  }

  onScroll(): void {
    const el = this.port()?.nativeElement;
    if (!el) return;
    this.read(el);
    this.scrolled.emit(this.position());
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
      return;
    }
    this.viewport.set(el.clientHeight);
    this.content.set(el.scrollHeight);
    this.scrollTop.set(el.scrollTop);
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
