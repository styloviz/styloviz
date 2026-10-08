import {
  ElementRef,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  EmbeddedViewRef,
  HostListener,
  inject,
  input,
  model,
  OnDestroy,
  output,
  PLATFORM_ID,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser, NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import { SvSpinnerArcComponent, svUniqueId } from '@styloviz/core';
import {
  svLockBodyScroll,
  svUnlockBodyScroll,
  svWarnOnce,
  SvOverlayRouteService,
  SvOverlayStackService,
  createCloseGuard,
  svDismissReason,
  createFocusScope,
  createPortalHost,
  createWaitEscalation,
  type SvCloseReason,
  type SvOverlayHandle,
  type SvPendingDismissal,
  type SvPortalHost,
  type SvRouteAwareHandle,
  type SvWaitStage,
} from '@styloviz/core';
import {
  svClampModalSize,
  svMaximizedSize,
  svResizeModal,
  svRestoredSize,
  type SvModalResizeBounds,
  type SvModalSizePx,
} from './modal-resize';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
export type ModalPosition = 'center' | 'top' | 'bottom';

/**
 * Visual/semantic style of the dialog.
 * - `default` — neutral dialog with no accent icon.
 * - `primary` `success` `warning` `danger` `info` — premium accent variants
 *   that render a tinted icon badge in the header and a matching accent bar.
 */
export type ModalVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

/** Why the modal closed — emitted through the `dismissed` output. */
export type ModalCloseReason =
  | 'backdrop'
  | 'escape'
  | 'close-button'
  | 'programmatic';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ModalComponent — A premium, fully-featured dialog overlay.
 *
 * The backdrop + panel are rendered into `document.body` through a lightweight
 * Angular embedded-view portal, so the modal always covers the full viewport
 * and escapes any parent `overflow:hidden`/`auto` or CSS `transform`/`filter`
 * containment — it is never clipped to or trapped inside a card/wrapper.
 *
 * Features:
 * - Signal-based open/close via two-way `isOpen` model
 * - Portaled to `<body>` so `position:fixed` is always viewport-relative
 * - 6 semantic variants: default · primary · success · warning · danger · info
 *   (each renders a tinted icon badge + accent bar in the header)
 * - 7 sizes: xs · sm · md · lg · xl · 2xl · full
 * - 3 positions: center (default) · top · bottom (mobile-friendly sheet)
 * - Header (title + optional subtitle) / body / footer content projection
 * - Optional loading state that blocks close and shows a spinner overlay
 * - Backdrop click to close (configurable) + optional backdrop blur
 * - ESC key to close (configurable)
 * - Scroll lock on `<body>` with scrollbar-width compensation (no layout shift)
 * - Focus trap within the dialog + configurable initial focus target
 * - `aria-labelledby` / `aria-describedby` wiring for screen readers
 * - Slide-in + fade animation (direction follows `position`)
 * - Full dark-mode support
 *
 * Usage:
 * ```html
 * <sv-modal
 *   [(isOpen)]="showDialog"
 *   variant="danger"
 *   title="Delete project"
 *   subtitle="This action is permanent">
 *   <ng-container slot="body">Are you sure?</ng-container>
 *   <ng-container slot="footer">
 *     <button (click)="showDialog = false">Cancel</button>
 *     <button (click)="onConfirm()">Delete</button>
 *   </ng-container>
 * </sv-modal>
 * ```
 */
@Component({
  selector: 'sv-modal',
  standalone: true,
  imports: [NgClass, SvIconComponent, SvSpinnerArcComponent],
  templateUrl: './modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvModalComponent implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly appRef = inject(ApplicationRef);
  private readonly document = inject(DOCUMENT);
  /** This component's own element — the origin the body portal copies context from. */
  private readonly _el = inject(ElementRef<HTMLElement>);
  private readonly _overlayStack = inject(SvOverlayStackService);
  /** Registration while open — see `onKeydown`. */
  private _stack: SvOverlayHandle | null = null;
  /** z-index from the overlay stack; the band's resting value before it opens. */
  private readonly _z = signal(3000);
  readonly stackZ = computed(() => this._z());

  // ── Query refs ────────────────────────────────────────────────────────────

  /** The ng-template holding the overlay markup — instantiated into <body> on open. */
  private readonly modalTpl = viewChild<TemplateRef<unknown>>('modalTpl');

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Controls open/closed state. Use `[(isOpen)]` for two-way binding. */
  readonly isOpen = model<boolean>(false);

  /** Dialog title shown in the built-in header. */
  readonly title = input<string>('');

  /** Optional secondary line rendered beneath the title (also used for aria-describedby). */
  readonly subtitle = input<string>('');

  /** Semantic/visual variant. Drives the header icon badge + accent bar. @default 'default' */
  readonly variant = input<ModalVariant>('default');

  /** Render the built-in header bar. @default true */
  readonly showHeader = input<boolean>(true);

  /** Bottom dividing line under the header. @default true */
  readonly showHeaderDivider = input<boolean>(true);

  /** Top dividing line above the footer. @default true */
  readonly showFooterDivider = input<boolean>(true);

  /** Render the footer slot wrapper. @default true */
  readonly showFooter = input<boolean>(true);

  /** Size of the dialog panel. @default 'md' */
  readonly size = input<ModalSize>('md');

  /** Placement of the dialog panel. @default 'center' */
  readonly position = input<ModalPosition>('center');

  /** Show the built-in variant icon badge in the header. @default true */
  readonly showIcon = input<boolean>(true);

  /** Close dialog when backdrop is clicked. @default true */
  readonly closeOnBackdrop = input<boolean>(true);

  /** Close dialog on ESC key. @default true */
  readonly closeOnEsc = input<boolean>(true);

  /** Apply a frosted-glass blur to the backdrop. @default false */
  readonly backdropBlur = input<boolean>(false);

  /** Show the built-in × close button in the header. @default true */
  readonly showCloseButton = input<boolean>(true);

  /**
   * Busy state. While `true` the panel shows a spinner overlay and all close
   * paths (button, backdrop, ESC) are blocked so a running task can finish.
   * @default false
   */
  readonly loading = input<boolean>(false);

  /** Accessible label announced while `loading` is true. @default 'Loading…' */
  readonly loadingText = input<string>('Loading…');

  // ── Route and history integration (OF-09-I7, OF-09-I8, OF-09-M2, X-13) ────

  /**
   * Does a navigation close this dialog?
   *
   * ★★★ `OF-09-I7`: A MODAL THAT OUTLIVES ITS ROUTE FLOATS OVER AN UNRELATED
   *     PAGE. The audit calls it the most common overlay bug in shipped
   *     dashboards, and the mechanism is simple — a link inside the dialog, a
   *     redirect from a guard, a host that navigates on success — after which
   *     the panel is still up, still modal, still describing a page that is
   *     no longer underneath it.
   *
   * ★★ IT ONLY HAPPENS IF THE APP ASKED. `provideSvOverlayRouteClose()` from
   *    `@styloviz/layout` is what tells the overlay layer a navigation
   *    happened; an app that wires nothing keeps today's behaviour exactly.
   *    Set this false for a dialog that belongs to the shell rather than to
   *    the page.
   *
   * @default true
   */
  readonly closeOnNavigation = input<boolean>(true);

  /**
   * Does the browser Back button close this dialog?
   *
   * ★★★ `OF-09-I8` / `OF-09-M2`. Back is the gesture users reach for to undo
   *     "I opened this", and on a phone it is the system gesture — a dialog
   *     that ignores it sends the user off the page instead, losing whatever
   *     they were doing.
   *
   * ★★ OFF BY DEFAULT, AND THAT IS THE OPPOSITE DECISION FROM THE ONE ABOVE.
   *    Back closing a dialog is right when the dialog is a destination the
   *    user navigated TO — a details panel, a wizard step — and wrong when it
   *    is a transient question, where it eats a Back press meant for the page.
   *    Only the host knows which this is.
   *
   * ★ The mechanism is a marked `history` entry, not a route: the URL is
   *   untouched and the host's own state is preserved. Giving a dialog its own
   *   URL is a routing decision, and `X-13` leaves that to the host.
   *
   * @default false
   */
  readonly backCloses = input<boolean>(false);

  private readonly _overlayRoute = inject(SvOverlayRouteService);
  private _routeHandle: SvRouteAwareHandle | null = null;

  /** Register (or re-register) with the route/history service while open. */
  private _registerRoute(): void {
    this._routeHandle?.release();
    this._routeHandle = this._overlayRoute.register({
      label: 'modal',
      close: (reason) => this._closeFromRoute(reason),
      closeOnNavigation: () => this.closeOnNavigation(),
      backCloses: () => this.backCloses(),
      dirty: () => this.dirty(),
      requestLeave: (proceed) => this._requestLeave(proceed),
    });
  }

  /** The held navigation, re-issued if the user discards. See `_requestLeave`. */
  private _leaveProceed: (() => void) | null = null;

  /**
   * `svOverlayCanDeactivate` (`@styloviz/layout`) is holding a navigation
   * because this modal is dirty: raise the unsaved-changes prompt BEFORE the
   * page changes. Discard closes and lets the navigation through; Keep editing
   * leaves the user where they are. Returns whether the navigation is held.
   *
   * ★ A host `[canClose]` veto for `'route'` also holds it, silently — the
   *   host refused the close for its own reasons.
   */
  private _requestLeave(proceed: () => void): boolean {
    if (this._closeGuard.prompting()) {
      this._leaveProceed = proceed;
      return true;
    }
    if (this._closeGuard.request('route')) return false;
    if (this._closeGuard.prompting()) {
      this._leaveProceed = proceed;
      this._focusPromptSoon();
    }
    return true;
  }

  /**
   * A close requested by the route service — a navigation or a Back press.
   *
   * ★★ A NAVIGATION HAS ALREADY HAPPENED, so `loading` cannot hold the dialog
   *    open: `close()` refused silently while busy, and the dialog stayed up
   *    over a page it has nothing to do with — `OF-09-I7` exactly, arrived at
   *    through the busy state. The host is told first through
   *    `loadingCancelled`, as with `pendingDismissal="abort"`. The unsaved-
   *    changes prompt still applies: that is a question, not a silent refusal.
   *
   * ★★ A REFUSED BACK PRESS RE-ARMS ITS HISTORY ENTRY. The browser consumed
   *    the marked entry before the dialog could answer, so a prompt the user
   *    answered with Keep editing (or a busy dialog) used to leave the dialog
   *    open with nothing claiming Back — the next press left the page.
   *    `OF-09-I8` / `OF-09-M2`.
   */
  private _closeFromRoute(reason: SvCloseReason): void {
    if (reason === 'route' && this._dismissBlocked()) {
      if (!this._closeGuard.request(reason)) {
        if (this._closeGuard.prompting()) this._focusPromptSoon();
        return;
      }
      this.loadingCancelled.emit();
      this.pendingReason = reason;
      this.isOpen.set(false);
      return;
    }
    this._close(reason);
    if (reason === 'history' && this.isOpen() && this.backCloses()) this._registerRoute();
  }

  // ── The controlled-close policy (OF-09-I5, OF-09-M3, X-11) ────────────────

  /**
   * Is there unsaved work in this dialog?
   *
   * ★★★ `OF-09-I5`: A FORM IN A MODAL CAN BE THROWN AWAY BY A MISSED CLICK.
   *     The backdrop is the whole screen around the panel, Escape is one key,
   *     and both discard everything the user typed with no warning and no
   *     undo. It is the single most-reported overlay complaint in any
   *     dashboard, and the reason "are you sure?" exists.
   *
   * ★★ SET THIS AND THE DIALOG ASKS instead of closing — once, in one place,
   *    from `createCloseGuard` (`X-11`), so Modal, Drawer and Confirm Dialog
   *    answer it identically. A prompt written four times behaves four ways.
   *
   * ★ A PROGRAMMATIC `close()` STILL CLOSES. The prompt is for accidental
   *   dismissal; your own code calling `close()` has already decided, and a
   *   component that second-guesses its own API is unusable. See
   *   `createCloseGuard`'s `alwaysAllow`.
   *
   * @default false
   */
  readonly dirty = input<boolean>(false);

  /**
   * The host's own veto, consulted before anything else.
   *
   * Return `false` to refuse a close; return nothing to have no opinion, so a
   * guard that only cares about the backdrop needs one `if`. A veto is silent:
   * it does NOT raise the unsaved-changes prompt, because the host refused for
   * its own reasons and owns its own messaging.
   *
   * ```html
   * <sv-modal [canClose]="notWhileUploading" />
   * ```
   * ```ts
   * protected readonly notWhileUploading = (reason: ModalCloseReason) =>
   *   reason === 'backdrop' ? !this.uploading() : undefined;
   * ```
   *
   * @default null
   */
  readonly canClose = input<((reason: ModalCloseReason) => boolean | void) | null>(null);

  /** Heading of the unsaved-changes prompt. */
  readonly unsavedTitle = input<string>('Discard your changes?');

  /** Body of the unsaved-changes prompt. */
  readonly unsavedMessage = input<string>('This dialog has changes that have not been saved.');

  /** Label of the button that closes and loses the changes. */
  readonly discardLabel = input<string>('Discard');

  /** Label of the button that returns to the dialog. */
  readonly keepEditingLabel = input<string>('Keep editing');

  /** The user discarded unsaved changes; the close follows. */
  readonly discarded = output<ModalCloseReason>();

  /** The user backed out of a close and returned to the dialog. */
  readonly closeCancelled = output<ModalCloseReason>();

  private readonly _closeGuard = createCloseGuard({
    dirty: () => this.dirty(),
    // The host's guard is typed over the published union, so it is asked in
    // those terms: a navigation or Back close is `'programmatic'` to it.
    guard: () => {
      const guard = this.canClose();
      return guard ? (reason: SvCloseReason) => guard(svDismissReason(reason)) : null;
    },
  });

  /** True while the unsaved-changes prompt is up. */
  readonly promptingDiscard = this._closeGuard.prompting;

  /** What the user tried to do, while the prompt is up. */
  readonly promptedReason = this._closeGuard.pendingReason;

  /**
   * Move focus to the prompt's safe choice when it appears.
   *
   * ★★ A DOM QUERY, NOT A `viewChild`. The panel lives in an embedded view
   *    attached through the portal, so a view query over this component never
   *    sees it — the focus trap below reaches the panel the same way, for the
   *    same reason.
   *
   * ★ Keep editing, not Discard: "prompt appeared, press Enter" must not throw
   *   the user's work away. Same rule as the confirm dialog's `initialFocus`
   *   default for destructive variants.
   */
  private _focusPromptSoon(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => {
      this.portalEl
        ?.querySelector<HTMLElement>('[data-sv-keep-editing]')
        ?.focus();
    });
  }

  /** Prompt button: throw the changes away and complete the close. */
  discardChanges(): void {
    const reason = this._closeGuard.discard();
    if (!reason) return;
    this.discarded.emit(svDismissReason(reason));
    // ★★ STILL BUSY? TELL THE HOST FIRST (`X-10` / `OF-09-I10`). A busy close
    //    that went through the prompt — a navigation, or `pendingDismissal=
    //    "abort"` on a dirty surface — skipped the emit on its way in, because
    //    the prompt refused it before the close was allowed. Discard is where
    //    that close actually happens, so this is the one place left to say it.
    if (this.loading()) this.loadingCancelled.emit();
    // ★ THE ORIGINAL REASON, not `programmatic`: the user dismissed this with
    //   Escape and the prompt was an interruption in the middle of that.
    this.pendingReason = reason;
    this.isOpen.set(false);
    // A navigation held by `svOverlayCanDeactivate` goes ahead now.
    const proceed = this._leaveProceed;
    this._leaveProceed = null;
    proceed?.();
  }

  /** Prompt button: go back to the dialog. */
  keepEditing(): void {
    const reason = this._closeGuard.pendingReason();
    this._closeGuard.keep();
    this._leaveProceed = null;   // the held navigation is abandoned
    if (reason) this.closeCancelled.emit(svDismissReason(reason));
  }

  // ── The way out of a loading modal (OF-09-I10) ────────────────────────────

  /**
   * May the user dismiss the modal while `loading` is true?
   *
   * ★★★ `OF-09-I10` IS TWO COMPLAINTS AND THIS IS THE FIRST: "no way out".
   *     Every close path — the × button, the backdrop, Escape — is blocked
   *     while `loading`, silently and with no stated policy. That is a
   *     defensible answer for a two-second save and the wrong one for a
   *     request that has hung: the modal simply stops responding, and the
   *     user's remaining move is to reload the page.
   *
   *     `'block'` keeps exactly today's behaviour and is the default.
   *     `'abort'` lets the close through and emits `loadingCancelled` first,
   *     so the host can abort the work it started. The modal does not own the
   *     request — `loading` is an input — so the host has to do the aborting;
   *     what changes is that it is now told to.
   *
   * @default 'block'
   */
  readonly pendingDismissal = input<SvPendingDismissal>('block');

  /**
   * Say "this is taking longer than usual" after this many ms of `loading`.
   * `0` = never. @default 0
   */
  readonly slowAfterMs = input<number>(0);

  /**
   * Escalate to a stuck message after this many ms of `loading`, measured from
   * the same start. `0` = never. @default 0
   */
  readonly stalledAfterMs = input<number>(0);

  /** Message shown over the panel at the `slow` stage. */
  readonly slowMessage = input<string>('This is taking longer than usual…');

  /** Message shown over the panel at the `stalled` stage. */
  readonly stalledMessage = input<string>('This seems to be stuck.');

  /**
   * Label for a cancel button in the loading overlay, shown once `stalled`.
   * `null` = none — and an offer with nothing behind it is worse than none,
   * so set this only when `loadingCancelled` is wired to something that stops
   * the work.
   * @default null
   */
  readonly cancelLoadingLabel = input<string | null>(null);

  /**
   * The user asked to stop the work: they pressed the cancel offer, or they
   * dismissed the modal with `pendingDismissal="abort"`.
   *
   * ★ Emitted BEFORE the close, so a host that aborts synchronously is not
   *   racing the teardown.
   */
  readonly loadingCancelled = output<void>();

  /** Fires on each escalation of a `loading` wait: `'slow'`, then `'stalled'`. */
  readonly loadingEscalated = output<SvWaitStage>();

  private readonly _wait = createWaitEscalation({
    slowAfterMs: this.slowAfterMs,
    stalledAfterMs: this.stalledAfterMs,
    destroyRef: inject(DestroyRef),
  });

  /** `idle` · `waiting` · `slow` · `stalled` for the current `loading` run. */
  readonly loadingStage = this._wait.stage;

  /**
   * The escalation message, or `null` while the wait is still normal.
   *
   * ★★ THE SECOND HALF OF `OF-09-I10` — "no reason to wait". A spinner and the
   *    word "Loading…" say nothing about whether waiting is still sensible.
   */
  readonly loadingMessage = computed<string | null>(() => {
    switch (this._wait.stage()) {
      case 'stalled': return this.stalledMessage();
      case 'slow': return this.slowMessage();
      default: return null;
    }
  });

  /** True when the loading overlay should offer a cancel. */
  readonly cancelLoadingOffered = computed<boolean>(
    () => this._wait.stalled() && this.cancelLoadingLabel() !== null,
  );

  /**
   * Is dismissal refused right now? PURE — it emits nothing and sets nothing.
   *
   * ★★ ONE PLACE ANSWERS THE POLICY, and it has to be a predicate rather than
   *    an "allowed, and by the way I told the host" helper: `onKeydown` has to
   *    ask before deciding whether to consume the keystroke, and a version
   *    with a side effect emitted `loadingCancelled` twice for one Escape.
   *
   * ★ Escape is deliberately NOT consumed while dismissal is refused — the
   *   existing contract, pinned by its own test. The modal has nothing to do
   *   with the keystroke, so it does not take it.
   */
  private _dismissBlocked(): boolean {
    return this.loading() && this.pendingDismissal() !== 'abort';
  }

  /** Bound to the cancel offer in the loading overlay. */
  cancelLoading(): void {
    this.loadingCancelled.emit();
    // ★ The offer stops the WORK; whether the modal then closes is
    //   `pendingDismissal`'s business, and a host that wants it gone sets
    //   `loading` false (or `abort`). Closing here regardless would take the
    //   decision away from the surface that documents it.
    if (this.pendingDismissal() === 'abort') {
      this.pendingReason = 'programmatic';
      this.isOpen.set(false);
    }
  }

  /**
   * CSS selector for the element to focus first when the modal opens
   * (e.g. `'#name-input'`). Falls back to the first focusable element.
   */
  readonly initialFocus = input<string>('');

  /** Extra CSS classes merged onto the dialog panel. */
  readonly customClass = input<string>('');

  // ── Resize / maximize ─────────────────────────────────────────────────────

  /**
   * Let the user drag the panel's bottom-right corner to resize it.
   *
   * ★★ THE DRAG IS AN ENHANCEMENT, NOT THE ONLY WAY IN. A pointer-only affordance
   * is unusable by keyboard, so turning this on also turns on the
   * maximize/restore button unless `maximizable` is explicitly false — the
   * button is the keyboard-reachable half of the same capability, and the panel
   * can always be sized declaratively through `size`.
   *
   * @default false
   */
  readonly resizable = input<boolean>(false);

  /** Show the maximize / restore button in the header. @default false */
  readonly maximizable = input<boolean>(false);

  /** Floor for a dragged resize, in pixels. @default 280 */
  readonly minWidth = input<number>(280);

  /** Floor for a dragged resize, in pixels. @default 160 */
  readonly minHeight = input<number>(160);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted after the modal is opened (by any means). */
  readonly opened = output<void>();

  /** Emitted after the modal is closed (by any means). */
  readonly closed = output<void>();

  /**
   * Emitted alongside `closed`, describing what triggered the close. A close
   * caused by a navigation or a Back press reports `'programmatic'` here —
   * the published union cannot grow — and its exact reason on `dismissedBy`.
   */
  readonly dismissed = output<ModalCloseReason>();

  /**
   * Emitted alongside `dismissed` with the exact reason, including `'route'`
   * (the app navigated) and `'history'` (the Back button) from `X-13`.
   */
  readonly dismissedBy = output<SvCloseReason>();

  /** Emitted whenever the panel's pixel size changes — a drag or a maximize. */
  readonly resized = output<SvModalSizePx>();

  // ── Stable element ids (a11y wiring) ───────────────────────────────────────

  private readonly uid = svUniqueId('sv-modal');
  /** Stable id for the built-in title, used by `aria-labelledby`. */
  readonly titleId = `sv-modal-title-${this.uid}`;
  /** Stable id for the subtitle, used by `aria-describedby`. */
  readonly subtitleId = `sv-modal-desc-${this.uid}`;

  /** Ids for the unsaved-changes prompt's own labelling. */
  readonly unsavedTitleId = `sv-modal-unsaved-title-${this.uid}`;
  readonly unsavedMessageId = `sv-modal-unsaved-desc-${this.uid}`;

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly panelClass = computed<string>(() => {
    const sizeMap: Record<ModalSize, string> = {
      xs: 'w-full max-w-xs',
      sm: 'w-full max-w-sm',
      md: 'w-full max-w-md',
      lg: 'w-full max-w-lg',
      xl: 'w-full max-w-2xl',
      '2xl': 'w-full max-w-4xl',
      full: 'w-screen h-screen max-w-none rounded-none',
    };
    return sizeMap[this.size()];
  });

  /** Alignment of the panel inside the flex overlay. */
  readonly alignClass = computed<string>(() => {
    switch (this.position()) {
      case 'top':
        return 'items-start pt-16';
      case 'bottom':
        return 'items-end pb-0 sm:pb-6';
      default:
        return 'items-center';
    }
  });

  /** Bottom position becomes a full-width sheet on small screens. */
  readonly positionPanelClass = computed<string>(() =>
    this.position() === 'bottom' && this.size() !== 'full'
      ? 'rounded-b-none sm:rounded-2xl'
      : ''
  );

  /** Animation class — bottom slides up, others slide down + fade. */
  readonly animationClass = computed<string>(() =>
    this.position() === 'bottom' ? 'modal-panel modal-panel--up' : 'modal-panel'
  );

  /** Accent classes for the header icon badge, keyed by variant. */
  readonly iconAccentClass = computed<string>(() => {
    const map: Record<ModalVariant, string> = {
      // 700 across the semantic rows: on a `-50` fill `-600` runs 3.08:1 (amber) to
      // 4.36:1 (red), and the badge is the panel's only variant cue.
      default: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
      primary: 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-400',
      success: 'bg-accent-50 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400',
      warning: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
      danger: 'bg-danger-50 text-danger-700 dark:bg-danger-500/15 dark:text-danger-400',
      info: 'bg-info-50 text-info-700 dark:bg-info-500/15 dark:text-info-400',
    };
    return map[this.variant()];
  });

  /** Thin accent bar across the top of the panel for semantic variants. */
  readonly accentBarClass = computed<string>(() => {
    const map: Record<ModalVariant, string> = {
      default: '',
      primary: 'bg-primary-500',
      success: 'bg-accent-500',
      warning: 'bg-warning-500',
      danger: 'bg-danger-500',
      info: 'bg-info-500',
    };
    return map[this.variant()];
  });

  /** Whether the header icon badge should render. */
  readonly hasIcon = computed<boolean>(
    () => this.showIcon() && this.variant() !== 'default'
  );

  /** True when a description should be linked via aria-describedby. */
  readonly hasDescription = computed<boolean>(() => this.subtitle().length > 0);

  // ── Portal + focus state ──────────────────────────────────────────────────

  /** Container appended to <body> that hosts the overlay while open. */
  private portalEl: HTMLElement | null = null;
  /**
   * The portal host's handle — the element it owns is `portalEl` above.
   *
   * ★ A bare `<div>` on `<body>` inherits nothing the surface used to inherit
   *   where it was authored: a locally dark section, a scoped `dir="rtl"`, a
   *   density token. `createPortalHost` carries what has exactly one correct
   *   value and states plainly what does not travel. See `X-8`.
   */
  private _portalContext: SvPortalHost | null = null;
  /** Embedded view holding the overlay template nodes. */
  private portalView: EmbeddedViewRef<unknown> | null = null;
  /**
   * Where focus came from, and where it goes back to.
   *
   * ★ Not a saved element any more. `focus()` on the element that opened this
   *   is a silent no-op once that element is gone — and the modal that deletes
   *   the row its own trigger sits in is the commonest modal there is. The
   *   scope walks outward until it finds something that survived. See X-6.
   */
  private readonly focusScope = createFocusScope({
    within: () => this.portalEl,
    below: () => this.belowAtClose,
  });
  /**
   * The surface underneath, snapshotted as this one starts closing.
   *
   * ★ The stack handle is released before focus is restored — restoring first
   *   would run while this modal still counts as the top surface — so the
   *   answer has to be taken while the handle is still live.
   */
  private belowAtClose: Element | null = null;
  /** Tracks the prior open state so the effect can emit opened/closed on transitions. */
  private wasOpen = false;
  /** Pending open-transition timer — cleared on destroy so it never fires post-teardown. */
  private openTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // ★★ THE CLOCK FOLLOWS `loading`, NOT THE MODAL. A modal can be open for
    //    ten minutes while the user reads it; only the busy state is a wait.
    //    `stop()` on the way down is what makes a second save start from zero
    //    instead of inheriting the first one's age.
    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      if (this.loading()) this._wait.start();
      else this._wait.stop();
    });

    effect(() => {
      const stage = this._wait.stage();
      if (stage === 'slow' || stage === 'stalled') this.loadingEscalated.emit(stage);
    });

    // React to isOpen changes regardless of how it is set:
    // either via open()/close() methods OR parent [(isOpen)] binding.
    effect(() => {
      const open = this.isOpen();
      if (!isPlatformBrowser(this.platformId)) {
        this.wasOpen = open;
        return;
      }

      if (open && !this.wasOpen) {
        // Opening transition
        // `blocking`: this panel asserts `aria-modal="true"`, and the stack
        // is what makes that true by marking the page behind it inert.
        this._stack = this._overlayStack.push('modal', {
          blocking: true,
          element: () => this.portalEl,
        });
        this._z.set(this._stack.zIndex);
        // ★★ REGISTERED HERE, NOT IN A CONSTRUCTOR EFFECT: the history entry
        //    a `backCloses` dialog pushes has to go on the stack at the
        //    moment it OPENS, so one Back press lands exactly where the user
        //    was before it. Registering while closed would push nothing and
        //    leave Back unclaimed.
        this._registerRoute();
        this.focusScope.capture();
        this.lockScroll();
        this.opened.emit();
        // Mount + focus after the current change-detection pass settles.
        //
        // ★ Cancel any timer still pending from an earlier open. `openTimer`
        // holds ONE handle, so open → close → open used to leave two timers
        // scheduled and only the second one cancellable. `ngOnDestroy` cleared
        // that one; the first fired after teardown, found `isOpen()` still true
        // — destroying a component does not reset its signals — and appended a
        // full-screen backdrop to <body> that no component owned and nothing
        // would ever remove, with the scroll lock left on behind it.
        clearTimeout(this.openTimer);
        this.openTimer = setTimeout(() => {
          if (!this.isOpen()) return;
          this.mountPortal();
          this.applyInitialFocus();
        });
      } else if (!open && this.wasOpen) {
        // Closing transition (covers close() AND parent [(isOpen)] = false)
        // ★ Forget any pending prompt. The dialog can close WITHOUT going
        //   through `close()` — the two-way binding, a host that saved and
        //   set `isOpen` false — and a prompt left standing reappears over
        //   the next open, asking about changes from a previous session of a
        //   form that no longer exists. Found by its own test.
        this._closeGuard.reset();
        this._leaveProceed = null;
        // ★ Release before anything else that can throw or defer: it is what
        //   pops the history entry, and a dialog that closed without popping
        //   leaves the user one Back press from reopening it.
        this._routeHandle?.release();
        this._routeHandle = null;
        this.belowAtClose = this._stack?.surfaceBelow() ?? null;
        this._stack?.release();
        this._stack = null;
        this.destroyPortal();
        this.unlockScroll();
        this.resetSize();
        this.closed.emit();
        this.dismissed.emit(svDismissReason(this.pendingReason));
        this.dismissedBy.emit(this.pendingReason);
        this.pendingReason = 'programmatic';
        // Return focus to whatever triggered the modal — or, if that is gone,
        // to the nearest thing that outlived it.
        this.focusScope.restore();
        this.belowAtClose = null;
      }
      this.wasOpen = open;
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    clearTimeout(this.openTimer);
    // ★★ DESTROYED WHILE OPEN IS X-6's ROUTE-CHANGE CASE. The close branch
    //    never runs, so focus is inside a panel about to be detached and ends
    //    up on `<body>` — where the next Tab restarts at the top of a page the
    //    user never asked to be at the top of. Deferred to a microtask for the
    //    same reason the anchored surfaces defer theirs: "what survived?" has
    //    no answer until the teardown below has actually happened.
    if (this.isOpen() && isPlatformBrowser(this.platformId)) {
      this.belowAtClose = this._stack?.surfaceBelow() ?? null;
      queueMicrotask(() => { this.focusScope.restore(); this.belowAtClose = null; });
    }
    this._stack?.release();
    this._stack = null;
    // ★ Destroyed while open is exactly the route-change case, so the history
    //   entry has to go back too — otherwise a dialog the router destroyed
    //   leaves a Back press that reopens nothing.
    this._routeHandle?.release();
    this._routeHandle = null;
    if (isPlatformBrowser(this.platformId)) {
      this.destroyPortal();
      this.unlockScroll();
    }
  }

  // ── Public open / close ───────────────────────────────────────────────────

  /** Reason attached to the next close transition; reset after each emit. */
  private pendingReason: SvCloseReason = 'programmatic';

  /** Open the modal programmatically. Scroll lock + focus trap handled by effect. */
  open(): void {
    this.isOpen.set(true);
  }

  /**
   * Close the modal programmatically. Blocked while `loading` is true.
   * The `closed` + `dismissed` outputs fire from the effect.
   */
  close(reason: ModalCloseReason = 'programmatic'): void {
    this._close(reason);
  }

  /** Every close path, including the route service's `'route'` / `'history'`. */
  private _close(reason: SvCloseReason): void {
    if (this._dismissBlocked()) return;
    // ★ One gate for the policy, and it is asked by every close path because
    //   they all come through here — see `_dismissBlocked` for the same note
    //   about the loading half.
    if (!this._closeGuard.request(reason)) {
      if (this._closeGuard.prompting()) this._focusPromptSoon();
      return;
    }
    // Dismissed mid-flight with `pendingDismissal="abort"`: the host started
    // the work and is the only one who can stop it, so it is told BEFORE the
    // teardown rather than left to notice.
    if (this.loading()) this.loadingCancelled.emit();
    this.pendingReason = reason;
    this.isOpen.set(false);
  }

  // ── Backdrop click ────────────────────────────────────────────────────────

  /**
   * Did the press that started this click belong to this dialog's backdrop?
   * `null` when no press was seen (a synthetic click).
   */
  private _backdropPressOwned: boolean | null = null;

  /**
   * Record, at press time, whether an outside click is this dialog's to act on.
   *
   * ★★ OUTSIDE-CLICK OWNERSHIP, `OF-09-I1`. With a popover or menu open from
   *    inside the dialog, one click on the backdrop used to close BOTH — the
   *    child through its own outside-click listener, the dialog through this
   *    one. The stack answers "who owns this click?" the same way it answers
   *    Escape: only the topmost surface acts. It is asked at PRESS time
   *    because some children close on `mousedown`, and by the time the click
   *    arrives they have already left the stack.
   *
   * ★ A press that started inside the panel and was released on the backdrop
   *   (a text selection dragged too far) is not a backdrop click either.
   */
  onBackdropPointerDown(event: MouseEvent): void {
    this._backdropPressOwned =
      event.target === event.currentTarget && (!this._stack || this._stack.isTopmost());
  }

  onBackdropClick(event: MouseEvent): void {
    const pressOwned = this._backdropPressOwned;
    this._backdropPressOwned = null;
    // ★ No `loading` test here: `close()` owns it — see `_dismissBlocked`.
    if (!this.closeOnBackdrop()) return;
    if ((event.target as HTMLElement) !== event.currentTarget) return;
    if (pressOwned === false) return;
    if (this._stack && !this._stack.isTopmost()) return;
    this.close('backdrop');
  }

  /**
   * Is the × usable right now? While `loading` it is disabled — unless
   * `pendingDismissal="abort"` says the user may leave, in which case the one
   * visible way out has to work too (`OF-09-I10`).
   */
  readonly closeButtonDisabled = computed<boolean>(
    () => this.loading() && this.pendingDismissal() !== 'abort',
  );

  // ── Keyboard ─────────────────────────────────────────────────────────────

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.closeOnEsc() && !this._dismissBlocked()) {
    // ★ The stack decides who owns this keystroke — see `overlay-stack.ts`.
    //   Push order, not layer: a popover opened from inside this surface
    //   outranks it, which is what a user pressing Escape expects.
      if (this._stack && !this._stack.isTopmost()) return;
      event.preventDefault();
      this.close('escape');
      return;
    }
    if (event.key === 'Tab') {
      this.handleTabKey(event);
    }
  }

  // ── Portal lifecycle ──────────────────────────────────────────────────────

  private mountPortal(): void {
    // ★ Both guards below are unreachable and stay as defence in depth; they
    // are the branches this file does not cover.
    //   • `portalView` is nulled by `destroyPortal` on every close, and the
    //     opening effect cancels any pending timer before scheduling a new one,
    //     so exactly one `mountPortal` call reaches here per open transition.
    //   • `modalTpl` is a `viewChild` over a template that is unconditionally
    //     present in this component's own view, and the mount is deferred to a
    //     timer that runs after the view has been created, so it is always
    //     resolved by the time this runs. The guard remains because the
    //     `TemplateRef | undefined` type demands it.
    // No input distinguishes either arm from its absence — equivalent mutants.
    if (this.portalView) return;
    const tpl = this.modalTpl();
    if (!tpl) return;

    this._portalContext = createPortalHost({
      origin: this._el.nativeElement,
      document: this.document,
      label: 'modal',
    });
    this.portalEl = this._portalContext.element;
    this.portalEl.setAttribute('data-sv-modal-portal', '');

    // Escapes ALL parent overflow / transform / filter containment.
    this.portalView = tpl.createEmbeddedView({});
    this.appRef.attachView(this.portalView);
    // Render BEFORE the nodes reach the document: an unstyled panel inserted
    // into <body> grows the page for a tick, which queues a scroll event that
    // this component's own scroll handler then acts on. See
    // scripts/fix-portal-insertion-order.mjs.
    this.portalView.detectChanges();
    this.portalView.rootNodes.forEach((n: Node) => this.portalEl!.appendChild(n));
    this._portalContext.attach();
  }

  private destroyPortal(): void {
    if (this.portalView) {
      this.appRef.detachView(this.portalView);
      this.portalView.destroy();
      this.portalView = null;
    }
    this._portalContext?.destroy();
    this._portalContext = null;
    this.portalEl = null;
  }

  // ── Scroll lock (with scrollbar-width compensation) ────────────────────────

  /**
   * ★★★ THE LOCK IS SHARED AND REFERENCE-COUNTED — see `@styloviz/core`'s `body-scroll-lock.ts`.
   *
   * It used to be per-instance: lock on open, clear the body styles on close.
   * Correct until two modals are open at once, which `SvModalService` makes
   * ordinary (a dialog opening a confirm on top of itself). Closing the top one
   * then cleared `body.overflow` while the one underneath was still up, and the
   * page began scrolling behind an open dialog — no error, just a background
   * that moves, which nobody attributes to the modal that closed.
   *
   * `lockedHere` keeps this instance's own bookkeeping straight: `ngOnDestroy`
   * unlocks too, and without it a component destroyed while open would release
   * a lock it had already released on close and let the page scroll under a
   * DIFFERENT dialog.
   */
  private lockedHere = false;

  private lockScroll(): void {
    // No "already locked?" test: this runs only on the closed → open
    // transition, and every open → closed transition unlocks first.
    this.lockedHere = true;
    svLockBodyScroll(this.document);
  }

  private unlockScroll(): void {
    if (!this.lockedHere) return;
    this.lockedHere = false;
    svUnlockBodyScroll(this.document);
  }

  // ── Focus management ──────────────────────────────────────────────────────

  /** The dialog panel element inside the body-mounted portal. */
  private getPanelEl(): HTMLElement | null {
    return this.portalEl?.querySelector<HTMLElement>('[role="dialog"]') ?? null;
  }

  private applyInitialFocus(): void {
    // ★ Unreachable for the same reason: this runs immediately after a
    // `mountPortal` that cannot have early-returned, so the panel is always
    // there. Equivalent mutant; see `mountPortal`.
    const el = this.getPanelEl();
    if (!el) return;

    const selector = this.initialFocus();
    if (selector) {
      const target = el.querySelector<HTMLElement>(selector);
      if (target) {
        target.focus();
        return;
      }
      // ★★ A SELECTOR THAT MATCHES NOTHING FAILS INTO THE FALLBACK SILENTLY,
      //    and the fallback is "the first focusable thing" — which is usually
      //    the close button. So `[initialFocus]="'#name'"` on a field that was
      //    renamed, or that is inside an `@if` that has not rendered yet,
      //    LOOKS like it works: focus goes somewhere plausible every time.
      //    Nothing in the DOM afterwards says the selector was never used.
      //    `OF-09-I4`.
      svWarnOnce(
        `sv-modal:initialFocus:${selector}`,
        `sv-modal: [initialFocus]="${selector}" matched nothing inside the panel, so ` +
          'focus fell back to the first focusable element. Check the selector, or ' +
          'whether the element it names has rendered by the time the modal opens.',
      );
    }

    const focusable = this.getFocusableElements(el);
    if (focusable.length > 0) {
      (focusable[0] as HTMLElement).focus();
    } else {
      el.focus();
    }
  }

  private handleTabKey(event: KeyboardEvent): void {
    const el = this.getPanelEl();
    if (!el) return;
    const focusable = this.getFocusableElements(el);
    if (focusable.length === 0) {
      event.preventDefault();
      el.focus();
      return;
    }

    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    const active = this.document.activeElement;

    if (event.shiftKey) {
      if (active === first || active === el) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  // ── Resize / maximize ─────────────────────────────────────────────────────

  /** Explicit pixel size, or `null` while the panel is sized by its CSS class. */
  readonly panelSize = signal<SvModalSizePx | null>(null);

  /** True while the panel fills the viewport. */
  readonly isMaximized = signal(false);

  /** The size to come back to. See `svRestoredSize`. */
  private sizeBeforeMaximize: SvModalSizePx | null = null;

  /** Where the pointer went down, and how big the panel was then. */
  private dragFrom: { x: number; y: number; size: SvModalSizePx } | null = null;

  /** The maximize button is the keyboard half of `resizable` — see that input. */
  readonly showsMaximize = computed(() => this.maximizable() || this.resizable());

  /** Inline style for the panel, or `null` to let the size class decide. */
  readonly panelSizeStyle = computed<Record<string, string> | null>(() => {
    const size = this.panelSize();
    if (!size) return null;
    return { width: `${size.width}px`, height: `${size.height}px`, maxWidth: 'none' };
  });

  private bounds(): SvModalResizeBounds {
    const view = this.document.defaultView;
    return {
      minWidth: this.minWidth(),
      minHeight: this.minHeight(),
      // jsdom reports 1024×768; a real browser reports the real thing. Either
      // way the clamp needs a number, not `undefined`.
      viewportWidth: view?.innerWidth ?? 1024,
      viewportHeight: view?.innerHeight ?? 768,
    };
  }

  /** The panel's current size, measured if it has never been set explicitly. */
  private currentSize(): SvModalSizePx {
    const explicit = this.panelSize();
    if (explicit) return explicit;
    const el = this.getPanelEl();
    const rect = el?.getBoundingClientRect();
    return {
      width: rect?.width || this.minWidth(),
      height: rect?.height || this.minHeight(),
    };
  }

  private applySize(size: SvModalSizePx | null): void {
    this.panelSize.set(size);
    if (size) this.resized.emit(size);
  }

  /** Toggle between filling the viewport and the size the user left it at. */
  toggleMaximize(): void {
    if (this.isMaximized()) {
      this.isMaximized.set(false);
      this.applySize(svRestoredSize(this.sizeBeforeMaximize, this.bounds()));
      this.sizeBeforeMaximize = null;
      return;
    }
    // ★ Remember the CURRENT size, which may be one the user dragged to — a
    // restore that snapped back to the `size` class would silently discard the
    // adjustment they just made.
    this.sizeBeforeMaximize = this.panelSize();
    this.isMaximized.set(true);
    this.applySize(svMaximizedSize(this.bounds()));
  }

  /** Start a corner drag. */
  onResizeStart(event: PointerEvent): void {
    // ★ Defence in depth, unreachable from the template: the grip that calls
    //   this only renders under `@if (resizable() && !loading())`, and this is
    //   a template handler, not host API. The DOM-level guarantee is asserted in
    //   modal.resize.spec.ts (no grip when not resizable, none while busy).
    if (!this.resizable() || this.loading()) return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.dragFrom = { x: event.clientX, y: event.clientY, size: this.currentSize() };
  }

  onResizeMove(event: PointerEvent): void {
    const from = this.dragFrom;
    if (!from) return;
    event.preventDefault();
    this.applySize(
      svResizeModal(from.size, event.clientX - from.x, event.clientY - from.y, this.bounds()),
    );
    // A drag is a deliberate size, so it takes the panel out of maximized —
    // otherwise the restore button would put back a size the user has since
    // replaced.
    if (this.isMaximized()) this.isMaximized.set(false);
  }

  onResizeEnd(event: PointerEvent): void {
    if (!this.dragFrom) return;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.dragFrom = null;
  }

  /**
   * Re-clamp after the window changed size.
   *
   * Without this a panel sized on a wide monitor keeps its width when the
   * window is narrowed, and the × goes off the right edge — the exact trap the
   * clamp exists to prevent, arrived at without anybody dragging anything.
   */
  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.isOpen()) return;
    if (this.isMaximized()) {
      this.applySize(svMaximizedSize(this.bounds()));
      return;
    }
    const size = this.panelSize();
    if (size) this.applySize(svClampModalSize(size, this.bounds()));
  }

  /** Drop any dragged size, so the next open starts from the `size` class. */
  private resetSize(): void {
    this.panelSize.set(null);
    this.isMaximized.set(false);
    this.sizeBeforeMaximize = null;
    this.dragFrom = null;
  }

  private getFocusableElements(container: HTMLElement): Element[] {
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
      )
    ).filter(
      el =>
        !el.hasAttribute('disabled') &&
        el.getAttribute('aria-hidden') !== 'true' &&
        (el as HTMLElement).offsetParent !== null
    );
  }
}
