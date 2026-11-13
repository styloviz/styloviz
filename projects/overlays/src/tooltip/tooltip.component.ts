import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  afterRenderEffect,
  computed,
  contentChild,
  Directive,
  effect,
  inject,
  input,
  output,
  signal,
  TemplateRef,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons/core';
import { SvKbdComponent } from '@styloviz/kbd';
import { svHoverUnavailable, svOnHoverAvailabilityChange, svUniqueId } from '@styloviz/core/a11y';
import { svWarnOnce } from '@styloviz/core/dev';
import {
  SvOverlayStackService,
  createPortalHost,
  svAnchorLost,
  svFirstFocusableWithin,
  svFixedContainer,
  svPositionAnchored,
  type SvOverlayHandle,
  type SvPlacement,
  type SvPlacementSide,
  type SvPortalHost,
  SV_TOOLTIP_GROUP,
} from '@styloviz/core/overlay';

import { registerTooltipIcons } from './tooltip.component.icons';
// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Where the bubble sits: a side, optionally aligned to its start or end —
 * the 12 placements of `SvPlacement` (SR-35). Flips and clamps when portalled.
 */
export type TooltipPosition =
  | 'top' | 'top-start' | 'top-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'left' | 'left-start' | 'left-end'
  | 'right' | 'right-start' | 'right-end';

// Spelled out (not `= SvPlacement`) so the docs list the twelve values — and
// held to it: this line fails to compile if the two ever drift apart.
const _placementsMatch: [TooltipPosition] extends [SvPlacement] ? ([SvPlacement] extends [TooltipPosition] ? true : never) : never = true;
void _placementsMatch;

/** A system-colour edge for the bubble when forced colours strip its fill and ring. */
const FORCED_EDGE = 'forced-colors:border forced-colors:border-[CanvasText]';

/**
 * The bubble's look. `inverted` is the opposite of the page's theme; `glass`
 * is frosted (for a tooltip over media or a moving surface); `value` is the
 * compact numeric bubble a slider thumb carries.
 */
export type TooltipVariant  =
  | 'dark' | 'light' | 'primary' | 'danger' | 'success' | 'warning'
  | 'inverted' | 'glass' | 'value';

/** What a touch does on a device that cannot hover: tap to toggle, long-press, or nothing. @default 'tap' */
export type TooltipTouch = 'tap' | 'hold' | 'off';

/** How the bubble enters and leaves. Reduced motion makes all three instant. @default 'scale' */
export type TooltipAnimation = 'fade' | 'scale' | 'shift';

/** A status dot before the content. */
export type TooltipStatus = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** A point in viewport pixels — an `anchor` that is not an element. */
export interface TooltipPoint {
  readonly x: number;
  readonly y: number;
}

/** What a `[svTooltipContent]` template receives. */
export interface TooltipContentContext {
  /** Hide the tooltip — for a close control inside an interactive one. */
  readonly $implicit: () => void;
}

/**
 * Rich content for the bubble, in place of `text`:
 *
 * ```html
 * <sv-tooltip>
 *   <button>Share</button>
 *   <ng-template svTooltipContent><b>Share</b> — anyone with the link can view</ng-template>
 * </sv-tooltip>
 * ```
 */
@Directive({ selector: 'ng-template[svTooltipContent]', standalone: true })
export class SvTooltipContentDirective {
  readonly template = inject<TemplateRef<TooltipContentContext>>(TemplateRef);
  static ngTemplateContextGuard(_d: SvTooltipContentDirective, _c: unknown): _c is TooltipContentContext {
    return true;
  }
}

/** The side of a placement. */
function sideOf(p: SvPlacement): SvPlacementSide {
  return p.split('-')[0] as SvPlacementSide;
}

/**
 * Where the bubble sits without a portal, for each of the 12 placements —
 * logical start/end, so an RTL page mirrors the alignment.
 */
const INLINE_PLACEMENT: Record<SvPlacement, string> = {
  'top':          'bottom-full left-1/2 -translate-x-1/2 mb-2', // sv-physical: centring
  'top-start':    'bottom-full start-0 mb-2',
  'top-end':      'bottom-full end-0 mb-2',
  'bottom':       'top-full left-1/2 -translate-x-1/2 mt-2', // sv-physical: centring
  'bottom-start': 'top-full start-0 mt-2',
  'bottom-end':   'top-full end-0 mt-2',
  'left':         'right-full top-1/2 -translate-y-1/2 mr-2', // sv-physical: side named by the public 'left' | 'right' position
  'left-start':   'right-full top-0 mr-2', // sv-physical: side named by the public 'left' | 'right' position
  'left-end':     'right-full bottom-0 mr-2', // sv-physical: side named by the public 'left' | 'right' position
  'right':        'left-full top-1/2 -translate-y-1/2 ml-2', // sv-physical: side named by the public 'left' | 'right' position
  'right-start':  'left-full top-0 ml-2', // sv-physical: side named by the public 'left' | 'right' position
  'right-end':    'left-full bottom-0 ml-2', // sv-physical: side named by the public 'left' | 'right' position
};

/** The arrow without a portal: on the bubble's trigger-facing edge, at the alignment. */
const INLINE_ARROW: Record<SvPlacement, string> = {
  'top':          'absolute left-1/2 -translate-x-1/2 top-full -translate-y-1/2 w-2 h-2 rotate-45', // sv-physical: centring
  'top-start':    'absolute start-3 top-full -translate-y-1/2 w-2 h-2 rotate-45',
  'top-end':      'absolute end-3 top-full -translate-y-1/2 w-2 h-2 rotate-45',
  'bottom':       'absolute left-1/2 -translate-x-1/2 bottom-full translate-y-1/2 w-2 h-2 rotate-45', // sv-physical: centring
  'bottom-start': 'absolute start-3 bottom-full translate-y-1/2 w-2 h-2 rotate-45',
  'bottom-end':   'absolute end-3 bottom-full translate-y-1/2 w-2 h-2 rotate-45',
  'left':         'absolute top-1/2 -translate-y-1/2 left-full -translate-x-1/2 w-2 h-2 rotate-45', // sv-physical: side named by the public 'left' | 'right' position
  'left-start':   'absolute top-2 left-full -translate-x-1/2 w-2 h-2 rotate-45', // sv-physical: side named by the public 'left' | 'right' position
  'left-end':     'absolute bottom-2 left-full -translate-x-1/2 w-2 h-2 rotate-45', // sv-physical: side named by the public 'left' | 'right' position
  'right':        'absolute top-1/2 -translate-y-1/2 right-full translate-x-1/2 w-2 h-2 rotate-45', // sv-physical: side named by the public 'left' | 'right' position
  'right-start':  'absolute top-2 right-full translate-x-1/2 w-2 h-2 rotate-45', // sv-physical: side named by the public 'left' | 'right' position
  'right-end':    'absolute bottom-2 right-full translate-x-1/2 w-2 h-2 rotate-45', // sv-physical: side named by the public 'left' | 'right' position
};

/** The arrow in a portal: the engine places it along the edge (`_arrowX` / `_arrowY`). */
const PORTAL_ARROW: Record<SvPlacementSide, string> = {
  top:    'absolute top-full -translate-x-1/2 -translate-y-1/2 w-2 h-2 rotate-45',
  bottom: 'absolute bottom-full -translate-x-1/2 translate-y-1/2 w-2 h-2 rotate-45',
  left:   'absolute left-full -translate-x-1/2 -translate-y-1/2 w-2 h-2 rotate-45', // sv-physical: side named by the public 'left' | 'right' position
  right:  'absolute right-full translate-x-1/2 -translate-y-1/2 w-2 h-2 rotate-45', // sv-physical: side named by the public 'left' | 'right' position
};

/** How long a long-press takes to show a `touch="hold"` tooltip (ms). */
const HOLD_MS = 450;
export type TooltipSize     = 'sm' | 'md' | 'lg';
export type TooltipTrigger  = 'hover' | 'click' | 'focus';

/** The trigger in effect after the touch policy: a hover one becomes tap, hold or nothing. */
type EffectiveTrigger = TooltipTrigger | 'hold' | 'off';

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
  imports: [NgTemplateOutlet, SvIconComponent, SvKbdComponent],
  templateUrl: './tooltip.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvTooltipComponent implements OnDestroy {
  /** The glyphs this template draws by name (FL-B4). */
  protected readonly svIcons = registerTooltipIcons();

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
  readonly effectiveTrigger = computed<EffectiveTrigger>(() => {
    const declared = this.trigger();
    if (declared !== 'hover' || !this._noHover()) return declared;
    // SR-35: what a hover tooltip becomes under a finger is the host's choice.
    switch (this.touch()) {
      case 'hold': return 'hold';
      case 'off': return 'off';
      default: return 'click';
    }
  });

  /**
   * Max width of the tooltip bubble (px); the text wraps at it. `null` keeps
   * the bubble on one line however long the text is. @default 240
   *
   * ★★ THIS USED TO DO NOTHING (`SR-15`). The bubble was `whitespace-nowrap`
   *    on both paths, so the text never wrapped and a long tooltip ran out of
   *    its own background — `max-width` only clipped the box behind it. The
   *    bubble is now `w-max`: as wide as its text, up to this, and wrapping
   *    beyond it. `w-max` and not just "allow wrapping" because the in-place
   *    bubble is absolutely positioned inside a wrapper the width of the
   *    trigger, and without it a tooltip on an icon button wraps every word.
   */
  maxWidth = input<number | null>(240);

  /** Delay before showing (ms). @default 0 */
  delay = input<number>(0);

  /** Whether the tooltip is disabled. @default false */
  disabled = input<boolean>(false);

  /** Extra CSS classes merged onto the tooltip bubble. */
  customClass = input<string>('');

  /**
   * Render the bubble in a `<body>` portal, positioned by measurement — on by default.
   *
   * The in-place bubble clips: an absolutely positioned child is clipped by
   *     any ancestor with `overflow: hidden` — every table cell, card and
   *     scroll area in a dashboard — and it is placed by CSS classes alone, so
   *     it cannot see the viewport edge. The portal
   *     moves the bubble to the end of `<body>` and positions it with
   *     `svPositionAnchored` (the arithmetic Popover and Dropdown Menu
   *     use): it escapes the clip, flips when it does not fit, and is clamped
   *     to the viewport.
   *
   * ★ `[portal]="false"` keeps the bubble inside the trigger wrapper, for a
   *   host that styles it by its position in the DOM. It was the default in
   *   earlier versions.
   *
   * @default true
   */
  portal = input<boolean>(true);

  /**
   * Flip to the opposite side when the preferred one does not fit.
   *
   * Only meaningful when portalled (the default) — the in-place path has no
   * measurement to decide with. @default true
   */
  flip = input<boolean>(true);

  /**
   * Gap between trigger and bubble, in px, when portalled.
   *
   * Matches the `mb-2` / `mt-2` the in-place path uses, so `[portal]="false"`
   * does not move the bubble. @default 8
   */
  offset = input<number>(8);

  /**
   * Stretch the trigger wrapper to the width of its container.
   *
   * The wrapper is `inline-flex` by default, which is right for a word, an
   * icon or a button — it hugs whatever it wraps. It is wrong the moment the
   * trigger is a card in a grid or flex row: the wrapper becomes the track
   * item and shrinks to its content, so the card does not fill its cell.
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
   * Do NOT set it around an ENABLED control. `pointer-events: none` applies
   *    to whatever is projected, so the control's own clicks stop working.
   *    Dev mode warns when the projected content does not look disabled.
   *
   * @default false
   */
  forDisabledControl = input<boolean>(false);

  // ── SR-35: rich content, placement, look, control ────────────────────────

  /** A bold first line above `text`, which becomes the description. @default '' */
  title = input<string>('');

  /** Keys to show on the bubble's end — a shortcut, drawn with `sv-kbd`. @default [] */
  kbd = input<readonly string[]>([]);

  /** Draw the arrow pointing at the trigger. @default true */
  arrow = input<boolean>(true);

  /** An icon before the content — a `@styloviz/icons` name. @default '' */
  icon = input<string>('');

  /** A coloured status dot before the content. @default null */
  status = input<TooltipStatus | null>(null);

  /**
   * Controlled visibility (two-way). Unbound, the tooltip shows and hides on
   * its trigger. Bound, the trigger only REQUESTS — through
   * `openChange` — and the bubble follows `open`, so a host can drive it: a
   * slider showing its value while dragging, a guided tour.
   * @default undefined
   */
  open = input<boolean | undefined>(undefined);

  /**
   * Position against this element or viewport point instead of the trigger —
   * a slider's thumb, a chart's crosshair. Implies the portal.
   * @default null
   */
  anchor = input<Element | TooltipPoint | null>(null);

  /** What a touch does where nothing can hover: tap to toggle, long-press, or nothing. @default 'tap' */
  touch = input<TooltipTouch>('tap');

  /** How the bubble enters and leaves; instant under reduced motion. @default 'scale' */
  animation = input<TooltipAnimation>('scale');

  /** The bubble's look while it uses a portal or an anchor. */
  protected readonly usePortal = computed(() => this.portal() || this.anchor() !== null);

  /** A `[svTooltipContent]` template, in place of the text. */
  private readonly _contentDir = contentChild(SvTooltipContentDirective);
  readonly contentTemplate = computed(() => this._contentDir()?.template ?? null);

  /** Whether there is anything to show at all. */
  readonly hasContent = computed(() =>
    !!this.text() || !!this.title() || this.kbd().length > 0 || this.contentTemplate() !== null);

  /** Text alone renders exactly as it always did; anything more is the rich layout. */
  readonly rich = computed(() =>
    !!this.title() || this.kbd().length > 0 || !!this.icon() || this.status() !== null);

  /** Context for a content template. */
  readonly contentContext: TooltipContentContext = { $implicit: () => this.hide() };

  /** The status dot's colour. */
  readonly statusClass = computed(() => {
    const map: Record<TooltipStatus, string> = {
      success: 'bg-accent-500', warning: 'bg-warning-500', danger: 'bg-danger-500', info: 'bg-info-500', neutral: 'bg-gray-400',
    };
    const s = this.status();
    return s ? map[s] : '';
  });

  /** The group this tooltip belongs to, if any (`provideSvTooltipGroup` / `svTooltipGroup`). */
  private readonly _group = inject(SV_TOOLTIP_GROUP, { optional: true });

  /** A visibility change asked for by the trigger — the controlled `open` decides. */
  readonly openChange = output<boolean>();

  /** Layout classes for the trigger wrapper — see {@link fullWidth}. */
  protected readonly wrapperClasses = computed(() =>
    (this.fullWidth() ? 'relative flex w-full' : 'relative inline-flex') +
    // ★ `[&>*]` reaches the PROJECTED content, which this component cannot
    //   bind to directly — the same technique `sv-split-button` uses to round
    //   the corners of whatever it was handed.
    (this.forDisabledControl() ? ' [&>*]:pointer-events-none' : ''), // sv-i18n-ignore: Tailwind class
  );

  // ── Outputs ─────────────────────────────────────────────────────────────────

  /** Emitted whenever the tooltip's visibility changes (true = shown, false = hidden). */
  readonly visibleChange = output<boolean>();

  // ── State ─────────────────────────────────────────────────────────────────

  readonly visible = signal<boolean>(false);
  private _showTimer: ReturnType<typeof setTimeout> | null = null;
  /** Pending portal teardown, waiting for the fade-out — see `setVisible`. */
  private _exitTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * The projected control that carries `aria-describedby`, if one was found.
   *
   * ★★ THE DESCRIPTION BELONGS ON THE THING THAT TAKES FOCUS (`SR-15`). It was
   *    on the wrapper `<div>`, which is never focused, and only while the
   *    tooltip was up — so a screen reader landing on the button heard
   *    nothing: the attribute was on the wrong element, and it arrived after
   *    focus had. It is now written on the first focusable projected element
   *    from the start. The bubble is `aria-hidden` while down, which does not
   *    stop it being read: a node referenced by `aria-describedby` is part of
   *    the description whether it is hidden or not.
   *
   * ★ Linked after each render that changes `text`, so a trigger projected
   *   later behind its own `@if` is picked up on the next such change, not
   *   immediately.
   */
  private _describedEl: HTMLElement | null = null;
  /** True while {@link _describedEl} carries the description — the wrapper then does not. */
  protected readonly _describesTrigger = signal(false);

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
      // SR-35
      inverted: 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 dark:shadow-lg',
      // sv-glass: a tooltip floats over moving or media content — that is what it frosts.
      glass:    'bg-white/75 text-gray-900 shadow-lg ring-1 ring-white/60 backdrop-blur-md dark:bg-gray-900/75 dark:text-white dark:ring-white/10',
      value:    'bg-primary-600 font-semibold tabular-nums text-white shadow-md',
    };

    const sizeMap: Record<TooltipSize, string> = {
      sm: 'px-2 py-1 text-[10px] rounded',
      md: 'px-2.5 py-1.5 text-xs rounded-md',
      lg: 'px-3 py-2 text-sm rounded-lg',
    };

    const wrapping = this.maxWidth() === null
      ? 'whitespace-nowrap'
      : 'w-max whitespace-normal break-words text-balance';

    const side = this._side();
    const motion = this._motionClasses(side);

    if (this.usePortal()) {
      return [
        'fixed pointer-events-none font-medium leading-tight',
        // ★ Forced colours (FL-J3-OF-19, `X-20`): the fill becomes Canvas and
        //   the ring (a box-shadow) is removed, so every variant — `glass`
        //   above all — was text floating on the page with no edge.
        FORCED_EDGE,
        wrapping,
        'transition-[opacity,scale,translate] duration-150 motion-reduce:transition-none',
        motion,
        variantMap[this.variant()],
        sizeMap[this.size()],
      ].join(' ');
    }

    return [
      'absolute z-50 pointer-events-none font-medium leading-tight',
      FORCED_EDGE,
      wrapping,
      'transition-[opacity,scale,translate] duration-150 motion-reduce:transition-none',
      motion,
      variantMap[this.variant()],
      sizeMap[this.size()],
      INLINE_PLACEMENT[this.position()],
    ].join(' ');
  });

  /** The side the bubble is on now — after a flip, when portalled. */
  private readonly _side = computed<SvPlacementSide>(() =>
    sideOf(this.usePortal() ? this.effectivePosition() : this.position()));

  /** Enter / leave classes for `animation`, oriented to the side. */
  private _motionClasses(side: SvPlacementSide): string {
    const shown = this.visible();
    const kind = this.animation();
    const fade = shown ? 'opacity-100' : 'opacity-0';
    if (kind === 'fade') return fade;
    if (kind === 'scale') {
      const origin: Record<SvPlacementSide, string> = {
        top: 'origin-bottom', bottom: 'origin-top', left: 'origin-right', right: 'origin-left',
      };
      return `${fade} ${origin[side]} ${shown ? 'scale-100' : 'scale-95'}`;
    }
    // shift: slides in from the trigger's side.
    const from: Record<SvPlacementSide, string> = {
      top: 'translate-y-1', bottom: '-translate-y-1', left: 'translate-x-1', right: '-translate-x-1',
    };
    return `${fade} ${shown ? 'translate-y-0' : from[side]}`;
  }

  readonly arrowClasses = computed<string>(() => {
    const colorMap: Record<TooltipVariant, string> = {
      dark:    'bg-gray-900 dark:bg-gray-700',
      light:   'bg-white dark:bg-gray-800',
      primary: 'bg-primary-600',
      danger:  'bg-danger-600',
      success: 'bg-accent-700',
      warning: 'bg-warning-500',
      inverted: 'bg-gray-900 dark:bg-white',
      glass:    'bg-white/75 dark:bg-gray-900/75',
      value:    'bg-primary-600',
    };

    const outlineMap: Record<SvPlacementSide, string> = {
      top:    'border-r border-b', // sv-physical: the trigger-facing edges of a rotate-45 square; rotation is physical
      bottom: 'border-t border-l', // sv-physical: the trigger-facing edges of a rotate-45 square; rotation is physical
      left:   'border-t border-r', // sv-physical: the trigger-facing edges of a rotate-45 square; rotation is physical
      right:  'border-b border-l', // sv-physical: the trigger-facing edges of a rotate-45 square; rotation is physical
    };

    const side = this._side();
    const where = this.usePortal() ? PORTAL_ARROW[side] : INLINE_ARROW[this.position()];
    const outline = this.variant() === 'light'
      ? ` ${outlineMap[side]} border-gray-200 dark:border-gray-700`
      : '';
    return `${where} ${colorMap[this.variant()]}${outline}`;
  });

  protected readonly _horizontalSide = computed<boolean>(() => {
    const side = this._side();
    return side === 'top' || side === 'bottom';
  });

  // ── Interaction ───────────────────────────────────────────────────────────

  /** Sets visibility and emits `visibleChange` only on an actual transition. */
  private setVisible(next: boolean): void {
    if (this.visible() === next) return;
    if (next) {
      // Mount BEFORE the flag flips: the bubble is positioned while it is
      // still transparent, so it never paints for a frame at the previous
      // coordinates.
      this._cancelExit();
      this._mountPortal();
      this.visible.set(true);
      // SR-35: one tooltip of a group at a time.
      this._group?.opened(this.tooltipId, () => this.hide());
    } else {
      // ★★ AND UNMOUNT AFTER IT, ONCE THE FADE IS OVER (`SR-15`). Teardown
      //    used to come first, so the bubble went back into the wrapper still
      //    opaque and faded out THERE — under a transformed ancestor a `fixed`
      //    child is placed against that ancestor, so the last frames jumped
      //    across the screen.
      this.visible.set(false);
      this._scheduleExit();
      this._group?.closed(this.tooltipId);
    }
    this.visibleChange.emit(next);
  }

  /**
   * The trigger asks for a change. Uncontrolled, it happens; controlled
   * (`open` bound), it is only reported through `openChange` and the bubble
   * follows `open`.
   */
  private _request(next: boolean): void {
    const controlled = this.open();
    if (controlled !== undefined) {
      if (controlled !== next) this.openChange.emit(next);
      return;
    }
    if (this.visible() === next) return;
    this.setVisible(next);
    this.openChange.emit(next);
  }

  /** Drop the portal once the bubble's fade-out has run. */
  private _scheduleExit(): void {
    if (!this._host) return;
    this._cancelExit();
    const ms = svTransitionMs(this._bubbleRef?.nativeElement);
    if (ms === 0) { this._destroyPortal(); return; }
    this._exitTimer = setTimeout(() => {
      this._exitTimer = null;
      this._destroyPortal();
    }, ms);
  }

  private _cancelExit(): void {
    if (this._exitTimer) { clearTimeout(this._exitTimer); this._exitTimer = null; }
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
    if (!this.usePortal()) return;
    // Shown again mid-fade: the portal is still up, so just re-anchor it.
    if (this._host) { this._reposition(); return; }
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
    this._watchAnchor();
  }

  /**
   * ★★ SR-35: AN ELEMENT ANCHOR MOVES WITHOUT TELLING ANYONE. A slider's thumb
   *    marker slides as the value changes, and neither a scroll nor a resize
   *    happens — so the bubble stayed where the thumb USED to be. While a
   *    bubble is open on an element anchor, compare the anchor's box (and the
   *    bubble's size, which a changing value changes) once a frame and
   *    reposition only when either moved. Stops the moment the bubble goes.
   */
  private _anchorWatch: number | null = null;
  private _lastAnchorBox = '';

  private _watchAnchor(): void {
    this._stopAnchorWatch();
    if (!(this.anchor() instanceof Element) || typeof requestAnimationFrame === 'undefined') return;
    const tick = () => {
      this._anchorWatch = null;
      const anchor = this.anchor();
      const bubble = this._bubbleRef?.nativeElement;
      if (!this._host || !(anchor instanceof Element) || !bubble) return;
      const a = anchor.getBoundingClientRect();
      const box = `${a.left},${a.top},${a.width},${a.height},${bubble.offsetWidth},${bubble.offsetHeight}`;
      if (box !== this._lastAnchorBox) {
        this._lastAnchorBox = box;
        this._reposition();
        this._cdr.markForCheck();
      }
      this._anchorWatch = requestAnimationFrame(tick);
    };
    this._anchorWatch = requestAnimationFrame(tick);
  }

  private _stopAnchorWatch(): void {
    if (this._anchorWatch !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this._anchorWatch);
    this._anchorWatch = null;
    this._lastAnchorBox = '';
  }

  /** Put the bubble back where Angular created it and drop the portal. */
  private _destroyPortal(): void {
    this._cancelExit();
    this._stopAnchorWatch();
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

  /**
   * Escape hides the tooltip wherever focus is (`SR-15`).
   *
   * ★ On the document, not the wrapper: a hover tooltip is up while focus is
   *   somewhere else entirely, and WCAG 1.4.13 asks that it be dismissible
   *   without moving the pointer or focus. The keydown is not consumed — the
   *   tooltip is `dismissible: false` on the overlay stack, so a dialog it
   *   appears in still closes on the same key.
   */
  @HostListener('document:keydown.escape')
  protected onDocumentEscape(): void {
    if (this.visible() || this._showTimer) this.hide();
  }

  private _reposition(): void {
    const wrap = this._wrapRef?.nativeElement;
    const bubble = this._bubbleRef?.nativeElement;
    if (!wrap || !bubble || !this._host) return;

    // Anchor loss is a TRANSITION, not a state: "zero-sized" and "not laid out
    // yet" read identically, and the first pass runs before the bubble has
    // been measured. Only an anchor that HAD a rect and lost it hides the
    // tooltip — a row deleted from under it, a collapsed `<details>`.
    const anchor = this.anchor();
    const target = anchor instanceof Element ? anchor : anchor === null ? wrap : null;
    if (target !== null && svAnchorLost(target)) {
      if (this._anchorMeasured) { this.hide(); return; }
    } else {
      this._anchorMeasured = true;
    }

    // SR-35: an anchor — an element, or a viewport point — stands in for the trigger.
    const a = anchor === null
      ? wrap.getBoundingClientRect()
      : anchor instanceof Element
        ? anchor.getBoundingClientRect()
        : { top: anchor.y, left: anchor.x, width: 0, height: 0 };

    // ★ SR-35: `start` / `end` placements exist now, and RTL mirrors them —
    //   a `top-start` tooltip lines up with the trigger's RIGHT edge on an
    //   Arabic page. Read from the trigger, which is where the page's
    //   direction applies (the portal host copies it, but this is the source).
    const rtl = typeof getComputedStyle !== 'undefined' && getComputedStyle(wrap).direction === 'rtl';
    const r = svPositionAnchored({
      anchor: { top: a.top, left: a.left, width: a.width, height: a.height },
      panel: { width: bubble.offsetWidth, height: bubble.offsetHeight },
      placement: this.position(),
      rtl,
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
    // SR-35: in a group, the first waits and the next shows at once.
    const delay = this._group ? this._group.delayFor(this.delay()) : this.delay();
    if (this._showTimer) clearTimeout(this._showTimer);
    if (delay > 0 && !this._noHover()) {
      this._showTimer = setTimeout(() => {
        this._showTimer = null;
        this._request(true);
      }, delay);
    } else {
      this._request(true);
    }
  }

  hide(): void {
    if (this._showTimer) {
      clearTimeout(this._showTimer);
      this._showTimer = null;
    }
    this._request(false);
  }

  // ── SR-35: long-press on touch ────────────────────────────────────────────

  private _holdTimer: ReturnType<typeof setTimeout> | null = null;

  /** A finger goes down: under `touch="hold"`, show once it has stayed long enough. */
  onPointerDown(event: PointerEvent): void {
    if (this.effectiveTrigger() !== 'hold' || event.pointerType === 'mouse') return;
    this._cancelHold();
    this._holdTimer = setTimeout(() => {
      this._holdTimer = null;
      this.show();
    }, HOLD_MS);
  }

  /** The finger lifts or slides away: a short tap shows nothing; a held one hides. */
  onPointerEnd(): void {
    if (this.effectiveTrigger() !== 'hold') return;
    this._cancelHold();
    if (this.visible() || this._showTimer) this.hide();
  }

  /** A long-press would open the browser's context menu over the tooltip. */
  onContextMenu(event: Event): void {
    if (this.effectiveTrigger() === 'hold') event.preventDefault();
  }

  private _cancelHold(): void {
    if (this._holdTimer) clearTimeout(this._holdTimer);
    this._holdTimer = null;
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

  /** Write the description onto the projected trigger, or take it off. */
  private _linkDescription(on: boolean): void {
    const wrap = this._wrapRef?.nativeElement;
    const target = on && wrap ? svFirstFocusableWithin(wrap) : null;
    if (target !== this._describedEl) {
      if (this._describedEl) svSetToken(this._describedEl, this.tooltipId, false);
      if (target) svSetToken(target, this.tooltipId, true);
      this._describedEl = target;
    }
    this._describesTrigger.set(target !== null);
  }

  constructor() {
    // ★ Not under `[forDisabledControl]`: there the wrapper IS the tab stop,
    //   and the projected control is disabled and cannot take focus.
    afterRenderEffect(() => {
      this._linkDescription(this.hasContent() && !this.forDisabledControl());
    });
    // SR-35: a controlled tooltip follows `open` — after render, so the bubble
    // it portals exists.
    afterRenderEffect(() => {
      const controlled = this.open();
      if (controlled === undefined) return;
      const show = controlled && this.hasContent() && !this.disabled();
      untracked(() => this.setVisible(show));
    });
    // SR-35: an anchor that moves (a slider thumb, a cursor) moves the bubble.
    effect(() => {
      this.anchor();
      untracked(() => {
        if (!this._host) return;
        this._reposition();
        this._watchAnchor();
        this._cdr.markForCheck();
      });
    });
  }

  ngOnDestroy(): void {
    this._cancelHold();
    if (this.visible()) this._group?.closed(this.tooltipId);
    this._linkDescription(false);
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

/** The longest `transition-duration` on `el`, in ms — 0 with no DOM or no transition. */
function svTransitionMs(el: HTMLElement | undefined): number {
  if (!el || typeof getComputedStyle === 'undefined') return 0;
  const raw = getComputedStyle(el).transitionDuration;
  if (!raw) return 0;
  return Math.max(0, ...raw.split(',').map((d) => {
    const v = parseFloat(d);
    if (!Number.isFinite(v)) return 0;
    return d.trim().endsWith('ms') ? v : v * 1000;
  }));
}

/** Add or remove one id in an element's `aria-describedby`, keeping the others. */
function svSetToken(el: HTMLElement, id: string, present: boolean): void {
  const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((t) => t && t !== id);
  if (present) ids.push(id);
  if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
  else el.removeAttribute('aria-describedby');
}
