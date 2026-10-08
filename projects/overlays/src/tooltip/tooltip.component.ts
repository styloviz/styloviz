import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  SvOverlayStackService,
  createPortalHost,
  svAnchorLost,
  svHoverUnavailable,
  svOnHoverAvailabilityChange,
  svFixedContainer,
  svPositionAnchored,
  svWarnOnce,
  type SvOverlayHandle,
  type SvPlacement,
  type SvPortalHost,
  svUniqueId,
} from '@styloviz/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
export type TooltipVariant  = 'dark' | 'light' | 'primary' | 'danger' | 'success' | 'warning';
export type TooltipSize     = 'sm' | 'md' | 'lg';
export type TooltipTrigger  = 'hover' | 'click' | 'focus';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Tooltip — A floating label anchored to a trigger element.
 *
 * Wrap any element with `<sv-tooltip>` to attach a tooltip.
 * The trigger content goes in the default slot; the tooltip text
 * is set via the `text` input.
 *
 * Supports:
 * - 4 positions (top, bottom, left, right) with arrow indicator
 * - 6 color variants
 * - 3 sizes
 * - hover, click, or focus triggers
 * - Optional max-width and show delay
 * - Accessible aria-describedby pattern
 */
@Component({
  selector: 'sv-tooltip',
  standalone: true,
  imports: [],
  templateUrl: './tooltip.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvTooltipComponent implements OnDestroy {
  // ── Content ───────────────────────────────────────────────────────────────

  /** Tooltip text content. */
  text = input<string>('');

  /** Position relative to the trigger. @default 'top' */
  position = input<TooltipPosition>('top');

  /** Color variant. @default 'dark' */
  variant = input<TooltipVariant>('dark');

  /** Size — controls font and padding. @default 'md' */
  size = input<TooltipSize>('md');

  /** What triggers the tooltip. @default 'hover' */
  trigger = input<TooltipTrigger>('hover');

  // ── Touch (`X-16`, `OF-20-I5`) ────────────────────────────────────────────

  /**
   * True when the primary pointer cannot hover — a finger, in practice.
   *
   * ★ A signal, not a one-shot read: a hybrid device can change which pointer
   *   is primary mid-session, and a convertible laptop does it by folding.
   */
  private readonly _noHover = signal(svHoverUnavailable());
  private readonly _stopHoverWatch: () => void = svOnHoverAvailabilityChange((v) =>
    this._noHover.set(v),
  );

  /**
   * The trigger actually used.
   *
   * ★★★ A HOVER TOOLTIP ON A TOUCHSCREEN IS NOT MERELY UNREACHABLE — IT
   *     HALF-WORKS, WHICH IS WORSE. Mobile browsers synthesise `mouseenter` on
   *     tap, so the tap meant to ACTIVATE the trigger shows the tooltip too,
   *     over the thing the user just pressed; and there is no `mouseleave`
   *     until they tap somewhere else, so it sits there. "Unreachable" would at
   *     least be obvious.
   *
   * ★★ SO THE ANSWER IS A TAP THAT TOGGLES, and a tap outside that dismisses —
   *    not a longer delay or a wider hit area. `focus` is left alone: it is
   *    already a real path on touch (a tapped button takes focus), and
   *    downgrading it would take the tooltip away from a keyboard user on a
   *    touchscreen laptop.
   */
  readonly effectiveTrigger = computed<TooltipTrigger>(() => {
    const declared = this.trigger();
    return declared === 'hover' && this._noHover() ? 'click' : declared;
  });

  /** Max width of the tooltip bubble (px). @default 240 */
  maxWidth = input<number>(240);

  /** Delay before showing (ms). @default 0 */
  delay = input<number>(0);

  /** Whether the tooltip is disabled. @default false */
  disabled = input<boolean>(false);

  /** Extra CSS classes merged onto the tooltip bubble. */
  customClass = input<string>('');

  /**
   * Render the bubble in a `<body>` portal, positioned by measurement.
   *
   * ★★★ THE DEFAULT IS AN `absolute` BUBBLE INSIDE THE TRIGGER WRAPPER, AND
   *     THAT IS WHY IT CLIPS. `OF-20-I1`: an absolutely positioned child is
   *     clipped by any ancestor with `overflow: hidden` — which is every table
   *     cell, card and scroll area in a dashboard — and the bubble is cut in
   *     half or disappears entirely. It is also placed by CSS classes alone,
   *     so it has no idea where the viewport edge is (`OF-20-I2`): a tooltip
   *     on the last column of a table renders off-screen.
   *
   * ★★ OPT-IN, DELIBERATELY. The in-place path is byte-for-byte what it was,
   *    because this is a published package and consumers style the bubble
   *    through its position in the DOM. Turning this on moves the bubble out
   *    of the wrapper and positions it with `svPositionAnchored` — the same
   *    arithmetic Popover, Popout and Dropdown Menu use — so it escapes the
   *    clip, flips when it does not fit, and is clamped to the viewport.
   *
   * ★ Reach for it whenever the trigger is inside a table cell, a card, or
   *   anything that scrolls. `OF-20-M1`.
   *
   * @default false
   */
  portal = input<boolean>(false);

  /**
   * Flip to the opposite side when the preferred one does not fit.
   *
   * Only meaningful with `[portal]="true"` — the in-place path has no
   * measurement to decide with. @default true
   */
  flip = input<boolean>(true);

  /**
   * Gap between trigger and bubble, in px, when portalled.
   *
   * Matches the `mb-2` / `mt-2` the in-place path uses, so turning `portal` on
   * does not move the bubble. @default 8
   */
  offset = input<number>(8);

  /**
   * Stretch the trigger wrapper to the width of its container.
   *
   * The wrapper is `inline-flex` by default, which is right for a word, an
   * icon or a button — it hugs whatever it wraps. It is wrong the moment the
   * trigger is a card in a grid or flex row: the wrapper becomes the track
   * item and shrinks to its content, so the card no longer fills its cell.
   * Set this to lay the wrapper out as a full-width block instead.
   *
   * @default false
   */
  fullWidth = input<boolean>(false);

  /**
   * Make the tooltip work over a control the browser has `disabled`
   * (`OF-20-I4`, `OF-20-M4`).
   *
   * ★★★ A DISABLED CONTROL FIRES NO POINTER EVENTS AND TAKES NO FOCUS, so the
   *     tooltip explaining WHY it is disabled is the one tooltip in the kit
   *     that could never appear — and it is also the one users most need. The
   *     browser does not dispatch mouse events whose target is a disabled
   *     form control, so nothing reaches this wrapper either; and the control
   *     is out of the tab order, so the keyboard path is gone as well.
   *
   * ★★ WHAT THIS DOES IS TWO LINES AND BOTH ARE NECESSARY: the projected
   *    content gets `pointer-events: none`, which takes the disabled control
   *    out of hit-testing so hover and tap land on the WRAPPER; and the
   *    wrapper takes `tabindex="0"`, so the explanation is reachable by
   *    keyboard at all. `aria-describedby` already lives on the wrapper, so a
   *    screen-reader user who lands there hears the reason.
   *
   * ★★ PREFER `aria-disabled="true"` OVER `disabled` AND YOU NEED NONE OF
   *    THIS. A control marked `aria-disabled` stays focusable and keeps firing
   *    pointer events — it is announced as unavailable, your handler ignores
   *    the click, and every tooltip path works untouched. This preset is for
   *    the control you cannot change: a third-party component, or markup that
   *    is not yours.
   *
   * ⚠️ Do NOT set it around an ENABLED control. `pointer-events: none` applies
   *    to whatever is projected, so the control's own clicks stop working.
   *    Dev mode warns when the projected content does not look disabled.
   *
   * @default false
   */
  forDisabledControl = input<boolean>(false);

  /** Layout classes for the trigger wrapper — see {@link fullWidth}. */
  protected readonly wrapperClasses = computed(() =>
    (this.fullWidth() ? 'relative flex w-full' : 'relative inline-flex') +
    // ★ `[&>*]` reaches the PROJECTED content, which this component cannot
    //   bind to directly — the same technique `sv-split-button` uses to round
    //   the corners of whatever it was handed.
    (this.forDisabledControl() ? ' [&>*]:pointer-events-none' : ''),
  );

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Emitted whenever the tooltip's visibility changes (true = shown, false = hidden). */
  readonly visibleChange = output<boolean>();

  // ── State ─────────────────────────────────────────────────────────────────

  readonly visible = signal<boolean>(false);
  private _showTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Portal plumbing (only used when `portal` is on) ────────────────────────

  @ViewChild('wrap', { static: true }) private readonly _wrapRef?: ElementRef<HTMLDivElement>;
  @ViewChild('bubble') private readonly _bubbleRef?: ElementRef<HTMLDivElement>;

  private readonly _el = inject(ElementRef<HTMLElement>);
  private readonly _cdr = inject(ChangeDetectorRef);
  private readonly _overlayStack = inject(SvOverlayStackService);

  private _host: SvPortalHost | null = null;
  private _stack: SvOverlayHandle | null = null;
  private _rafId: number | null = null;
  /** Has the trigger ever reported a non-zero rect? See `_reposition`. */
  private _anchorMeasured = false;

  /** Measured placement, after flipping. Equals `position()` in-place. */
  readonly effectivePosition = signal<TooltipPosition>('top');
  readonly _bubbleTop = signal(0);
  readonly _bubbleLeft = signal(0);
  readonly _arrowX = signal(0);
  readonly _arrowY = signal(0);
  readonly _z = signal(0);

  // ── Computed ──────────────────────────────────────────────────────────────

  /** A counter, not `Math.random()` — the id is what `aria-describedby` points
   *  at, and a server/client mismatch under SSR breaks that association. */
  readonly tooltipId = svUniqueId('sv-tooltip');

  readonly tooltipClasses = computed<string>(() => {
    const variantMap: Record<TooltipVariant, string> = {
      dark:    'bg-gray-900 text-white dark:bg-gray-700',
      light:   'bg-white text-gray-800 shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700',
      primary: 'bg-primary-600 text-white',
      danger:  'bg-danger-600 text-white',
      success: 'bg-accent-700 text-white',
      warning: 'bg-warning-500 text-gray-900',
    };

    const sizeMap: Record<TooltipSize, string> = {
      sm: 'px-2 py-1 text-[10px] rounded',
      md: 'px-2.5 py-1.5 text-xs rounded-md',
      lg: 'px-3 py-2 text-sm rounded-lg',
    };

    const posClasses: Record<TooltipPosition, string> = {
      top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
      bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
      left:   'right-full top-1/2 -translate-y-1/2 mr-2',
      right:  'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    // ★ PORTALLED, THE CSS PLACEMENT CLASSES HAVE TO GO. They position the
    //   bubble against the wrapper, which is no longer its parent; `top` and
    //   `left` come from the engine instead, and `z-50` from the ambient
    //   tooltip band rather than a hard-coded utility that loses to any
    //   surface with a higher one.
    if (this.portal()) {
      return [
        'fixed pointer-events-none whitespace-nowrap font-medium leading-tight',
        'transition-opacity duration-150',
        this.visible() ? 'opacity-100' : 'opacity-0',
        variantMap[this.variant()],
        sizeMap[this.size()],
      ].join(' ');
    }

    return [
      'absolute z-50 pointer-events-none whitespace-nowrap font-medium leading-tight',
      'transition-all duration-150',
      this.visible() ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
      variantMap[this.variant()],
      sizeMap[this.size()],
      posClasses[this.position()],
    ].join(' ');
  });

  /**
   * Arrow indicator: a small square rotated 45° placed at the tooltip edge.
   * Using explicit complete class strings so Tailwind's scanner detects them.
   *
   * The square's inner half overlaps the tooltip body (same bg color = invisible),
   * and the outer half protrudes as a pointed triangle.
   */
  readonly arrowClasses = computed<string>(() => {
    // Position of the arrow relative to the tooltip bubble.
    // Each string places the arrow at the correct edge and centers it.
    const positionMap: Record<TooltipPosition, string> = {
      top:    'absolute left-1/2 -translate-x-1/2 top-full -translate-y-1/2 w-2 h-2 rotate-45',
      bottom: 'absolute left-1/2 -translate-x-1/2 bottom-full translate-y-1/2 w-2 h-2 rotate-45',
      left:   'absolute top-1/2 -translate-y-1/2 left-full -translate-x-1/2 w-2 h-2 rotate-45',
      right:  'absolute top-1/2 -translate-y-1/2 right-full translate-x-1/2 w-2 h-2 rotate-45',
    };

    // Background color must match the tooltip bubble exactly.
    const colorMap: Record<TooltipVariant, string> = {
      dark:    'bg-gray-900 dark:bg-gray-700',
      light:   'bg-white dark:bg-gray-800',
      primary: 'bg-primary-600',
      danger:  'bg-danger-600',
      success: 'bg-accent-600',
      warning: 'bg-warning-500',
    };

    // Portalled, the side may have been flipped by measurement, so the arrow
    // follows `effectivePosition()` rather than what was asked for.
    const side = this.portal() ? this.effectivePosition() : this.position();
    return `${positionMap[side]} ${colorMap[this.variant()]}`;
  });

  /**
   * Is the bubble above or below the trigger (rather than beside it)?
   *
   * Decides which axis the measured arrow offset applies to: a bubble above or
   * below is clamped horizontally, one to the side vertically.
   */
  protected readonly _horizontalSide = computed<boolean>(() => {
    const side = this.portal() ? this.effectivePosition() : this.position();
    return side === 'top' || side === 'bottom';
  });

  // ── Interaction ───────────────────────────────────────────────────────────

  /** Sets visibility and emits `visibleChange` only on an actual transition. */
  private setVisible(next: boolean): void {
    if (this.visible() === next) return;
    // Mount BEFORE the flag flips: the bubble is positioned while it is still
    // transparent, so it never paints for a frame at the previous coordinates.
    if (next) { this._mountPortal(); } else { this._destroyPortal(); }
    this.visible.set(next);
    this.visibleChange.emit(next);
  }

  // ── The body portal (`OF-20-I1`, `OF-20-I2`, `OF-20-M1`) ──────────────────

  /**
   * Move the bubble into a `<body>` portal and position it by measurement.
   *
   * ★★ THE STACK ENTRY IS `dismissible: false`, AND THAT IS NOT A DETAIL. A
   *    tooltip must paint above whatever is on screen — it describes a button
   *    inside a dialog — but it must not become the thing Escape closes. The
   *    ambient `tooltip` band gives it the first without the second; a
   *    hard-coded `z-50` gave it neither.
   */
  private _mountPortal(): void {
    if (!this.portal() || this._host) return;
    // SSR: `show()` is reachable from a prerender through a projected trigger's
    // own bindings, and there is no body to portal into.
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const bubble = this._bubbleRef?.nativeElement;
    if (!bubble) return;

    this._stack = this._overlayStack.push('tooltip', {
      dismissible: false,
      element: () => this._bubbleRef?.nativeElement,
    });
    this._z.set(this._stack.zIndex);

    this._host = createPortalHost({
      origin: this._el.nativeElement,
      className: 'sv-tooltip-portal',
      label: 'tooltip',
    });
    // Fill, then insert — see `SvPortalHost.attach`.
    this._host.element.appendChild(bubble);
    this._host.attach();

    // Re-anchor on scroll of ANY ancestor (capture phase): a tooltip whose
    // whole reason for being portalled is that its trigger sits in a scroll
    // container cannot listen on `window` alone.
    window.addEventListener('scroll', this._reflow, { passive: true, capture: true });
    this._reposition();
  }

  /** Put the bubble back where Angular created it and drop the portal. */
  private _destroyPortal(): void {
    if (this._rafId !== null) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this._reflow, true);
    }
    const bubble = this._bubbleRef?.nativeElement;
    const wrap = this._wrapRef?.nativeElement;
    // ★ BACK INTO THE WRAPPER, NOT JUST DETACHED. The bubble belongs to this
    //   component's own view — it was relocated, not re-created — and Angular
    //   removes it from wherever it is when `text()` empties or the view is
    //   destroyed. Leaving it in a portal that is about to be removed would
    //   take the node with it.
    if (bubble && wrap) wrap.appendChild(bubble);
    this._host?.destroy();
    this._host = null;
    this._stack?.release();
    this._stack = null;
    this._anchorMeasured = false; // re-arm anchor-loss detection
  }

  /** RAF-throttled reposition, for scroll and resize. */
  private readonly _reflow = (): void => {
    if (!this._host || this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (!this._host) return;
      this._reposition();
      // The bubble lives outside the wrapper now, but it is still this view's
      // node — a scroll is not a template event, so nothing else would run
      // change detection for the coordinates just written.
      this._cdr.detectChanges();
    });
  };

  @HostListener('window:resize')
  protected onWindowResize(): void {
    if (this._host) { this._reposition(); this._cdr.detectChanges(); }
  }

  /**
   * A tap anywhere else dismisses a tap-opened tooltip (`OF-20-I5`).
   *
   * ★★★ WITHOUT THIS A TOUCH TOOLTIP HAS NO WAY OUT. There is no `mouseleave`
   *     on a finger and no Escape key on a phone, so a tooltip opened by tap
   *     stayed until the user found the trigger again — while covering the
   *     content next to it.
   *
   * ★ `pointerdown`, not `click`: the dismissal should happen as the finger
   *   lands, and a `click` listener would also be reached by the synthesised
   *   click from the tap that opened it, closing the tooltip in the same
   *   gesture that asked for it.
   *
   * ★ Only for the click trigger — a hover tooltip has `mouseleave`, and a
   *   focus tooltip has `focusout`; taking it away on an outside press would
   *   hide a tooltip whose trigger still has focus.
   */
  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: Event): void {
    if (!this.visible()) return;
    if (this.effectiveTrigger() !== 'click') return;
    const wrap = this._wrapRef?.nativeElement;
    const target = event.target as Node | null;
    if (wrap && target && wrap.contains(target)) return;
    this.hide();
  }

  private _reposition(): void {
    const wrap = this._wrapRef?.nativeElement;
    const bubble = this._bubbleRef?.nativeElement;
    if (!wrap || !bubble || !this._host) return;

    // Anchor loss is a TRANSITION, not a state: "zero-sized" and "not laid out
    // yet" read identically, and the first pass runs before the bubble has
    // been measured. Only an anchor that HAD a rect and lost it hides the
    // tooltip — a row deleted from under it, a collapsed `<details>`.
    if (svAnchorLost(wrap)) {
      if (this._anchorMeasured) { this.hide(); return; }
    } else {
      this._anchorMeasured = true;
    }

    const a = wrap.getBoundingClientRect();

    // ★ No `rtl` option: a tooltip is always centre-aligned on its side, and
    //   there is no `start`/`end` for RTL to mirror. Passing it would be a
    //   line no test could tell apart from its absence.
    const r = svPositionAnchored({
      anchor: { top: a.top, left: a.left, width: a.width, height: a.height },
      panel: { width: bubble.offsetWidth, height: bubble.offsetHeight },
      placement: this.position() as SvPlacement,
      offset: this.offset(),
      flip: this.flip(),
      // ★★ MEASURED, NOT INFERRED. This used to ask whether the portal host's
      //    rect was at the origin — but a host is a plain <div> at the end of
      //    <body>, so it never is on a page with content, and the correction
      //    fired everywhere with the length of the document as its offset.
      //    `svFixedContainer` puts a zero-size fixed probe inside the host and
      //    reports what a fixed child is ACTUALLY re-based by: null when the
      //    viewport still owns it. See `core/lib/overlay/fixed-origin.ts`.
      container: svFixedContainer(this._host.element),
    });

    this.effectivePosition.set(r.placement as TooltipPosition);
    this._bubbleTop.set(r.top);
    this._bubbleLeft.set(r.left);
    this._arrowX.set(r.arrowX);
    this._arrowY.set(r.arrowY);
  }

  /**
   * Dev-only: the preset is for a control that cannot receive events, and
   * around one that can it takes the control's clicks away.
   *
   * ★ Checked here rather than in a lifecycle hook, for two reasons: the
   *   projected content is rendered and settled by the time anything can hover
   *   it, and `show()` is already the method with the SSR guard — a DOM query
   *   in `ngAfterViewInit` would need its own.
   *
   * ★ `:disabled` covers the native controls and `[aria-disabled="true"]` the
   *   component that only looks disabled; anything else projected here — a
   *   span, an icon, a div — is not a control at all, cannot be disabled, and
   *   never needed the preset.
   */
  private _auditDisabledWrapper(): void {
    const wrap = this._wrapRef?.nativeElement;
    if (!wrap) return;
    const content = [...wrap.children].filter(el => el !== this._bubbleRef?.nativeElement);
    if (content.length === 0) return;
    const looksDisabled = content.some(
      el =>
        el.matches(':disabled, [aria-disabled="true"]') ||
        el.querySelector(':disabled, [aria-disabled="true"]') !== null,
    );
    if (looksDisabled) return;
    svWarnOnce(
      'sv-tooltip/for-disabled-control-on-enabled',
      '<sv-tooltip [forDisabledControl]="true"> is wrapping content that is not ' +
        'disabled. The preset sets `pointer-events: none` on whatever it wraps so ' +
        'that hover reaches the tooltip instead of a dead control — around a LIVE ' +
        'control that means its own clicks stop working. Drop the input, or mark ' +
        'the control `disabled` / `aria-disabled="true"`.',
    );
  }

  show(): void {
    if (this.disabled()) return;
    if (this.forDisabledControl()) this._auditDisabledWrapper();
    // ★★ THE DELAY IS A HOVER AFFORDANCE, so a tap skips it. `delay` exists so
    //    a pointer crossing the screen does not trail a line of tooltips
    //    behind it; a tap is deliberate, and making the user hold still for
    //    300ms after pressing something reads as the tap not having landed.
    if (this.delay() > 0 && !this._noHover()) {
      this._showTimer = setTimeout(() => this.setVisible(true), this.delay());
    } else {
      this.setVisible(true);
    }
  }

  hide(): void {
    if (this._showTimer) {
      clearTimeout(this._showTimer);
      this._showTimer = null;
    }
    this.setVisible(false);
  }

  toggle(): void {
    if (this.visible()) { this.hide(); } else { this.show(); }
  }

  /**
   * Enter / Space on the `[forDisabledControl]` wrapper itself, for a `click`
   * tooltip (`OF-20-I4`). The wrapper is the tab stop the disabled control
   * lost, and a `<div>` synthesises no click from a key — so without this a
   * keyboard user reached the explanation and could not open it. Keys that
   * start on projected content are left alone: a live button there already
   * turns Enter into a click that reaches `toggle()`.
   */
  onWrapperActivate(event: Event): void {
    if (!this.forDisabledControl() || this.effectiveTrigger() !== 'click') return;
    if (event.target !== this._wrapRef?.nativeElement) return;
    event.preventDefault();
    this.toggle();
  }

  ngOnDestroy(): void {
    // Teardown first: `check:ui`'s portal rule reads a window from the top of
    // this method, and a tooltip destroyed while visible would otherwise leave
    // its host in `<body>` for the life of the page.
    this._destroyPortal();
    // ★ A no-op without `window`, so no SSR fork is needed here — but it must
    //   still be called, or a tooltip on a route the user left keeps a live
    //   media-query listener for the life of the page.
    this._stopHoverWatch();
    if (this._showTimer) {
      clearTimeout(this._showTimer);
      this._showTimer = null;
    }
  }
}
