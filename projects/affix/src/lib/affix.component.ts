import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  SV_FLOATING_ORDER,
  SvFloatingLayerService,
  svElementSize,
  svFixedOrigin,
  svFloatingRegion,
  svWarnOnce,
  type SvFloatingAnchor,
  svUniqueId,
} from '@styloviz/core';
import { svAffixLabel, svAffixState, svIsAffixed, type AffixMode, type SvAffixState } from './affix.position';
import {
  svFixedContainingBlock,
  svSameContainingBlock,
  type SvAffixContainingBlock,
} from './affix.containing-block';

const STATIC: SvAffixState = { mode: 'static', top: 0, placeholder: 0, atBoundary: false };

/**
 * `<sv-affix>` — pin an element while it scrolls, without the jump.
 *
 * ★★★ EVERY HAND-ROLLED AFFIX SHIPS THE JUMP. Going `position: fixed` removes
 * the element from flow, everything below jumps up by its height, the page
 * height changes, `scrollY` changes, and the element can unpin — which puts the
 * height back and re-pins it. The fix is a placeholder of the measured height,
 * not a smaller threshold or a debounce.
 *
 * ── Measurement contract (`X-4`) ─────────────────────────────────────────────
 * The CONTENT's height is observed automatically (`svElementSize`, one update
 * per frame at most), so content that grows, shrinks, or is revealed after
 * starting hidden keeps the placeholder in step with no host code. The SCROLL
 * position is the host's: call `measure(scrollTop)` from the scroll root's
 * `scroll` event (or bind `onWindowScroll` to `window:scroll`). Until the first
 * `measure()`, and while the content has no box, the element stays in flow.
 *
 * ⚠️ DRIVING THE SIGNALS YOURSELF? CALL `measure()` ONCE. A host that writes the
 *    public `scrollY` / `anchorTop` / `height` signals directly (a virtual
 *    scroller, a test harness) must still call `measure()` at least once:
 *    Affix stays `static` until its first measurement, so signals written
 *    before it never pin anything. After that one call, writes to the signals
 *    take effect as before.
 *
 * ── Stacking ─────────────────────────────────────────────────────────────────
 * A pinned block paints at `z-30` (`SV_FLOATING_Z.affix`) — above page
 * content, below Scroll to Top / Speed Dial (`SV_FLOATING_Z.control`, 50) and
 * every overlay (1000+).
 */
@Component({
  selector: 'sv-affix',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  templateUrl: './affix.component.html',
})
export class SvAffixComponent {
  private readonly uid = svUniqueId('sv-af');
  private readonly floatingLayer = inject(SvFloatingLayerService);

  private readonly slot = viewChild<ElementRef<HTMLElement>>('slot');
  private readonly holder = viewChild<ElementRef<HTMLElement>>('holder');

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Gap between the viewport top and the pinned element, in px. @default 0 */
  readonly offsetTop = input<number>(0);

  /**
   * Stop the element at the bottom of this container.
   *
   * ★★★ WITHOUT A BOUNDARY, A PINNED SIDEBAR FLOATS OVER THE FOOTER — and,
   * being fixed, over whatever the reader scrolled down to look at.
   * @default null
   */
  readonly container = input<HTMLElement | null>(null);

  /** Disable pinning entirely, e.g. below a breakpoint. @default false */
  readonly disabled = input<boolean>(false);

  /**
   * Keep the placeholder at the height the content had IN FLOW while it is
   * pinned, instead of following the content's live height.
   *
   * ★★ FOR SHRINK-ON-SCROLL HEADERS. A header that compacts from 80px to 48px
   * once pinned would otherwise pull everything below it up by 32px mid-scroll.
   * With this on, the page below never moves while the header animates; the pin
   * threshold is measured from the placeholder either way, so a changing header
   * height never moves the threshold and cannot re-pin it.
   * @default false
   */
  readonly holdRestingHeight = input<boolean>(false);

  /**
   * Join the shared floating layer (`X-5`, `LU-01-M3`) while PINNED, as an
   * occupied region at this anchor — usually `'top'` for a full-width bar, or a
   * corner for a pinned card. Floating controls at that edge then stack clear of
   * it, and regions ranked before it (a host's top banner) push it down through
   * `collisionOffset`, which is added to `offsetTop`. `null` registers nothing
   * and leaves the offset at 0 — the behaviour before this input existed.
   * @default null
   */
  readonly floatingAnchor = input<SvFloatingAnchor | null>(null);

  /** Rank in the floating layer; lower sits nearer the edge. @default SV_FLOATING_ORDER.affix (30) */
  readonly floatingOrder = input<number>(SV_FLOATING_ORDER.affix);

  /** Emitted whenever the mode changes. */
  readonly affixChange = output<AffixMode>();

  /**
   * Emitted when an ancestor turns out to be the containing block for
   * `position: fixed` — a `transform`, `filter`, `perspective`,
   * `backdrop-filter`, `will-change`, `contain`, `content-visibility`,
   * `transform-style: preserve-3d` or `container-type` on any ancestor — so
   * the pinned element is positioned against that ancestor and scrolls away
   * with it. Checked each time the element pins; `null` once the viewport is
   * the containing block again.
   */
  readonly containingBlockChange = output<SvAffixContainingBlock | null>();

  // ── Measured state ────────────────────────────────────────────────────────

  /** Page scroll position. */
  readonly scrollY = signal(0);
  /** Distance from the document top to the element's resting position. */
  readonly anchorTop = signal(0);
  /** Measured height of the pinned content. */
  readonly height = signal(0);
  /** Distance from the document top to the container's bottom, when there is one. */
  readonly containerBottom = signal<number | null>(null);

  /**
   * ★★ False until the first `measure()`. Before it the anchor is an unknown
   * `0`, and `scrollY + offsetTop > 0` would pin the element on first paint —
   * at the top of a page nobody has scrolled.
   */
  private readonly measured = signal(false);

  /** The content height last seen while in flow — see `holdRestingHeight`. */
  private readonly restingHeight = signal(0);

  private readonly _containingBlock = signal<SvAffixContainingBlock | null>(null);
  /** The ancestor stealing `position: fixed` from the viewport, or `null` when none does. */
  readonly containingBlock = this._containingBlock.asReadonly();

  /** True once a `ResizeObserver` is watching the content, so scroll does not re-read it. */
  private observing = false;

  /**
   * ★★ THE CONTENT IS OBSERVED, NOT RE-MEASURED ON EVERY SCROLL. A per-scroll
   * `getBoundingClientRect` of an animating header reads a different height on
   * every frame and rewrites the placeholder each time. The observer reports a
   * size only when it changes, coalesced to one per frame, and a hidden-at-init
   * element reports its real height the moment it is revealed.
   */
  private readonly contentSize = svElementSize(() => this.slot()?.nativeElement ?? null, {
    observe: (callback) => {
      if (typeof ResizeObserver === 'undefined') return null;
      this.observing = true;
      return new ResizeObserver(callback);
    },
  });

  /**
   * `LU-01-M3` — the pinned block as an occupied floating region. Registered
   * only in the `fixed` mode: in flow or docked it scrolls with the page and
   * occupies no screen edge.
   *
   * ★ OBSERVED ONLY WHILE REGISTERED. `contentSize` already watches the slot;
   *   handing the region the slot unconditionally would put a second
   *   `ResizeObserver` on it for every affix, including the default
   *   `floatingAnchor: null` one that never registers. `svElementSize` measures
   *   synchronously as it starts observing, so the region still registers with
   *   its real height on the pin.
   */
  private readonly floatingRegion = svFloatingRegion({
    anchor: () => this.registeredAnchor(),
    element: () => (this.registeredAnchor() ? (this.slot()?.nativeElement ?? null) : null),
    order: () => this.floatingOrder(),
    label: 'affix',
  });

  /**
   * Distance (px) the floating layer pushes this block from its edge — the
   * height of every region ranked before it (+ gaps). `0` when `floatingAnchor`
   * is `null` or nothing is ranked before it. Already added to `offsetTop`;
   * exposed for hosts that position companions against the pinned block.
   */
  readonly collisionOffset = computed(() => {
    const anchor = this.floatingAnchor();
    if (!anchor) return 0;
    // ★ Before it registers (in flow), read where it WOULD sit, so the pin
    //   lands at its final offset instead of jumping a frame later.
    return this.floatingRegion.registered()
      ? this.floatingRegion.offset()
      : this.floatingLayer.offsetFor(anchor, this.floatingOrder());
  });

  private lastMode: AffixMode = 'static';

  /** The anchor the block occupies right now: set only while pinned AND opted in. */
  private registeredAnchor(): SvFloatingAnchor | null {
    return this.state().mode === 'fixed' ? this.floatingAnchor() : null;
  }

  constructor() {
    effect(() => {
      const { height } = this.contentSize();
      untracked(() => this.onContentResize(height));
    });
    // `disabled` flipped while pinned unpins at once; report it at once too,
    // not on the next scroll.
    effect(() => {
      this.disabled();
      untracked(() => this.settle());
    });
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly state = computed<SvAffixState>(() => {
    // ★★ NOTHING TO PIN UNTIL THERE IS A BOX. A hidden-at-init element measures
    //    zero — and pinning a zero-height element records a threshold taken
    //    from a placeholder with no layout, which is wrong the moment it shows.
    if (this.disabled() || !this.measured() || this.height() <= 0) return STATIC;
    const state = svAffixState({
      scrollY: this.scrollY(),
      anchorTop: this.anchorTop(),
      height: this.height(),
      // `LU-01-M3`: 0 unless `floatingAnchor` is set.
      offsetTop: this.offsetTop() + this.collisionOffset(),
      containerBottom: this.containerBottom(),
    });
    const resting = this.restingHeight();
    return state.mode !== 'static' && this.holdRestingHeight() && resting > 0
      ? { ...state, placeholder: resting }
      : state;
  });

  readonly affixed = computed(() => svIsAffixed(this.state()));
  readonly label = computed(() => svAffixLabel(this.state()));

  // ── Interactions ──────────────────────────────────────────────────────────

  /**
   * Re-read the measurements.
   *
   * ★★★ THE ANCHOR IS MEASURED FROM THE PLACEHOLDER, NOT FROM THE ELEMENT. Once
   * pinned, the element's own rect reports the viewport position it was moved
   * to, so re-measuring from it yields the threshold that keeps it pinned — a
   * one-way latch that never unpins on the way back up.
   */
  measure(scrollY: number): void {
    this.scrollY.set(scrollY);

    const el = this.slot()?.nativeElement;
    if (el) {
      // With an observer the height is already current; reading it here as well
      // would be the per-scroll measurement the observer exists to replace.
      if (!this.observing) this.height.set(el.getBoundingClientRect().height);
      // The placeholder stays in flow, so its top is the resting position.
      const holder = el.parentElement;
      if (holder) this.anchorTop.set(holder.getBoundingClientRect().top + scrollY);
    }

    const container = this.container();
    this.containerBottom.set(
      container ? container.getBoundingClientRect().bottom + scrollY : null,
    );

    this.measured.set(true);
    this.settle();
  }

  onWindowScroll(event: Event): void {
    const target = event.target as Document | null;
    const y = target?.defaultView?.scrollY ?? 0;
    this.measure(y);
  }

  afId(suffix: string): string {
    return `${this.uid}-${suffix}`;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /**
   * The content changed size — grew, shrank, or was revealed.
   *
   * ★★ A REVEAL RE-READS THE ANCHOR TOO. While hidden, the placeholder had no
   * box either, so the anchor recorded then is meaningless; re-measuring at the
   * last known scroll position is what stops the element pinning at the wrong
   * threshold on reveal.
   */
  private onContentResize(height: number): void {
    if (!this.observing) return;
    this.height.set(height);
    if (this.measured()) this.measure(this.scrollY());
  }

  /** Record the resting height, emit a mode change, and check containment on pin. */
  private settle(): void {
    const mode = this.state().mode;
    if (mode === 'static' && this.height() > 0) this.restingHeight.set(this.height());
    if (mode === this.lastMode) return;
    this.lastMode = mode;
    if (mode === 'fixed') this.checkContainingBlock();
    this.affixChange.emit(mode);
  }

  /**
   * Is the viewport still the containing block for the pinned element?
   *
   * ★★★ ONLY ON THE TRANSITION INTO `fixed`, NEVER PER SCROLL. The check walks
   * the ancestors' computed styles and inserts a zero-size probe, which is cheap
   * once and a layout thrash on every scroll event.
   */
  private checkContainingBlock(): void {
    const holder = this.holder()?.nativeElement;
    if (!holder) return;
    const element = svFixedContainingBlock(holder);
    const origin = svFixedOrigin(holder);
    const next: SvAffixContainingBlock | null =
      element || origin.top !== 0 || origin.left !== 0
        ? { element, top: origin.top, left: origin.left }
        : null;

    if (svSameContainingBlock(this._containingBlock(), next)) return;
    this._containingBlock.set(next);
    this.containingBlockChange.emit(next);

    if (next) {
      const who = element ? `<${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}>` : 'an ancestor';
      svWarnOnce(
        'sv-affix:containing-block',
        `sv-affix: ${who} is the containing block for position: fixed (a transform, filter, perspective, ` +
          'backdrop-filter, will-change, contain, content-visibility, preserve-3d or container-type on it), so the pinned element is placed ' +
          'against that box and scrolls away with it instead of staying in the viewport. Remove the property ' +
          'from the ancestor, or move <sv-affix> outside it.',
      );
    }
  }
}
