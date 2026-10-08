import {
  ApplicationRef,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  computed,
  signal,
  untracked,
  viewChild,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  afterNextRender,
  type EmbeddedViewRef,
  type TemplateRef,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  SvLiveAnnouncer,
  SvOverlayStackService,
  createFocusScope,
  createPortalHost,
  createWaitEscalation,
  svFormatExpectedWait,
  svLockBodyScroll,
  svUnlockBodyScroll,
  svWarnOnce,
  type SvOverlayHandle,
  type SvPortalHost,
  type SvWaitStage,
} from '@styloviz/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpinnerSize    = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'white';
export type SpinnerStyle   = 'border' | 'dots' | 'pulse' | 'bars';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Spinner — A circular loading indicator.
 *
 * Supports:
 * - 4 visual styles: border (CSS ring), dots, pulse, bars
 * - 5 sizes × 7 color variants
 * - Optional label (screen-reader + visible)
 * - Overlay mode (fullscreen dimmed backdrop)
 * - Accessible aria-label / role
 */
@Component({
  selector: 'sv-spinner',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './spinner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvSpinnerComponent {
  // ── Appearance ────────────────────────────────────────────────────────────

  /** Size of the spinner. @default 'md' */
  size = input<SpinnerSize>('md');

  /** Color variant. @default 'primary' */
  variant = input<SpinnerVariant>('primary');

  /** Visual style of the spinner. @default 'border' */
  spinnerStyle = input<SpinnerStyle>('border');

  // ── Content ───────────────────────────────────────────────────────────────

  /** Accessible label (also shown visually when labelVisible is true). @default 'Loading…' */
  label = input<string>('Loading…');

  /** Show the label text visually beneath the spinner. @default false */
  labelVisible = input<boolean>(false);

  // ── State ─────────────────────────────────────────────────────────────────

  /** Fullscreen overlay mode — dims the page behind the spinner. @default false */
  overlay = input<boolean>(false);

  /**
   * Portal the fullscreen surface to `<body>` and make the page behind it
   * `inert` (OF-18-I6). `false` is the opt-back to the pre-0.4 placement: the
   * backdrop renders inside the host, still takes its z-index from the stack
   * and still locks scroll, but the page behind it stays focusable.
   * @default true
   */
  portal = input<boolean>(true);

  // ── Expectation (OF-18-I8) ────────────────────────────────────────────────

  /**
   * How long this wait usually takes, in ms. `0` = unknown.
   *
   * ★★★ AN ESCALATION IS AN APOLOGY, NOT AN EXPECTATION. `slowAfterMs` below
   *     only ever speaks once the wait has already gone wrong: it says "longer
   *     than usual" without this component ever having said what usual IS.
   *     The user's decision — wait, or reload and lose the form — is made in
   *     the first second or two, on information the host almost always has and
   *     had no way to pass on. Passing it turns a silent animation into a
   *     statement: "about 25 seconds".
   *
   * ★★ IT IS ALSO THE ONLY NUMBER THE HOST SHOULD HAVE TO PICK. Set this and
   *    both escalation thresholds derive from it, so the figure the user is
   *    SHOWN and the moment the component admits lateness cannot drift apart —
   *    which they did by construction when the two were separate inputs, and
   *    nothing could catch it.
   *
   * ★ Off by default, like the thresholds: an expectation nobody stated is not
   *   one this component may invent.
   *
   * @default 0
   */
  expectedMs = input<number>(0);

  /**
   * Override the generated expectation sentence — for wording, or for a
   * language the generator does not speak. `null` = generate from
   * {@link expectedMs}; `''` = state no expectation at all.
   *
   * ★ This does NOT derive the thresholds. Text has no number in it, so a
   *   surface that wants both still sets `expectedMs` and overrides the words.
   *
   * @default null
   */
  expectationMessage = input<string | null>(null);

  /** `expectedMs`, ignoring the values that are not a duration. */
  private readonly _expected = computed<number>(() => {
    const ms = this.expectedMs();
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
  });

  /**
   * How much longer than the stated expectation counts as "longer than usual".
   *
   * ★ 1.5, not 1. At exactly the stated figure the wait is not yet late —
   *   "about 25 seconds" is a claim about the middle of a distribution, and a
   *   component that apologised the instant it elapsed would be apologising
   *   for half of all successful requests.
   */
  private static readonly SLOW_FACTOR = 1.5;

  /** Four times the expectation is no longer a wait. @see SLOW_FACTOR */
  private static readonly STALLED_FACTOR = 4;

  /** The stated expectation, in words, or `null` when there is none. */
  readonly expectationText = computed<string | null>(() => {
    const custom = this.expectationMessage();
    if (custom !== null) return custom.trim() === '' ? null : custom;
    return svFormatExpectedWait(this._expected());
  });

  // ── Escalation (OF-18-I5 / OF-18-M3) ──────────────────────────────────────

  /**
   * Say "this is taking longer than usual" after this many ms. `0` = never.
   *
   * ★★★ A SPINNER IS INDISTINGUISHABLE FROM A FAILED REQUEST, FOREVER, and at
   *     ninety seconds it is not telling the truth: nothing is happening. The
   *     user's only remaining move is to reload the page and lose whatever
   *     they had typed — which is what they do.
   *
   * ★ Off by default. Escalating without being asked would put new text under
   *   every spinner in every existing layout, and the honest threshold depends
   *   entirely on what is being waited for.
   *
   * @default 0
   */
  slowAfterMs = input<number>(0);

  /**
   * Escalate to "this seems to be stuck" after this many ms. `0` = never.
   *
   * ★★ MEASURED FROM THE SAME START, not from `slowAfterMs`. Thirty seconds
   *    means thirty seconds into the wait.
   *
   * @default 0
   */
  stalledAfterMs = input<number>(0);

  /** Message shown at the `slow` stage. */
  slowMessage = input<string>('This is taking longer than usual…');

  /** Message shown at the `stalled` stage. */
  stalledMessage = input<string>('This seems to be stuck.');

  /**
   * Label for a cancel button shown once the wait is `stalled`. `null` = none.
   *
   * ★★ AN OUTPUT CANNOT BE ASKED WHETHER ANYONE IS LISTENING, so the offer is
   *    an input: a surface that renders "Cancel" and does nothing when it is
   *    pressed is worse than one that never offered. Set this only when
   *    `(cancelled)` is wired to something that can actually stop the work.
   *
   * @default null
   */
  cancelLabel = input<string | null>(null);

  /** The user pressed the cancel offer on a stalled wait. */
  readonly cancelled = output<void>();

  /** Fires on each escalation: `'slow'`, then `'stalled'`. */
  readonly escalated = output<SvWaitStage>();

  /**
   * When this spinner says "longer than usual": the host's `slowAfterMs` if it
   * set one, otherwise 1.5× the stated {@link expectedMs}.
   *
   * ★ Derived `slow` is dropped entirely when it would land at or after the
   *   resolved `stalled` — an expectation of 30s next to an explicit
   *   `stalledAfterMs` of 20s has no room for a slow stage, and a timer that
   *   fires into a wait already past it would say nothing (the escalation
   *   never demotes) while still looking like a configured feature.
   */
  readonly resolvedSlowAfterMs = computed<number>(() => {
    const explicit = this.slowAfterMs();
    if (explicit > 0) return explicit;
    const expected = this._expected();
    if (expected <= 0) return 0;
    const derived = Math.round(expected * SvSpinnerComponent.SLOW_FACTOR);
    const stalled = this.resolvedStalledAfterMs();
    return stalled > 0 && derived >= stalled ? 0 : derived;
  });

  /** As {@link resolvedSlowAfterMs}, at 4× the expectation. */
  readonly resolvedStalledAfterMs = computed<number>(() => {
    const explicit = this.stalledAfterMs();
    if (explicit > 0) return explicit;
    const expected = this._expected();
    return expected > 0 ? Math.round(expected * SvSpinnerComponent.STALLED_FACTOR) : 0;
  });

  private readonly _wait = createWaitEscalation({
    slowAfterMs: this.resolvedSlowAfterMs,
    stalledAfterMs: this.resolvedStalledAfterMs,
    destroyRef: inject(DestroyRef),
  });

  /** `idle` · `waiting` · `slow` · `stalled`. */
  readonly waitStage = this._wait.stage;

  /** The message for the current stage, or `null` while the wait is normal. */
  readonly waitMessage = computed<string | null>(() => {
    switch (this._wait.stage()) {
      case 'stalled': return this.stalledMessage();
      case 'slow': return this.slowMessage();
      default: return null;
    }
  });

  /** True when a cancel offer should be shown. */
  readonly cancelOffered = computed<boolean>(
    () => this._wait.stalled() && this.cancelLabel() !== null,
  );

  /**
   * True while the stated expectation is still the truth.
   *
   * ★★ THE EXPECTATION HAS TO STOP BEING SHOWN WHEN IT STOPS BEING TRUE. A
   *    line reading "about 25 seconds" under a message reading "this is taking
   *    longer than usual" is the component contradicting itself in one glance,
   *    and the figure is the half the user will believe. So the escalation
   *    REPLACES it rather than stacking with it.
   */
  readonly expectationShown = computed<boolean>(
    () => this.expectationText() !== null && !this._wait.slow(),
  );

  /**
   * The accessible name: the label, plus the expectation when there is one.
   *
   * ★★★ THE VISIBLE LINE ALONE WOULD NOT BE HEARD. A live region announces
   *     what CHANGES in it after it is registered, not the content it was born
   *     with — which is precisely why the escalation message works — so an
   *     expectation rendered at mount is silent to a screen reader unless it is
   *     part of the name. It is therefore in the name, and the visible copy is
   *     `aria-hidden` so the region does not say it twice.
   *
   * ★ Deliberately NOT a function of the stage. The name of a `role="status"`
   *   changing under a reader is a second voice for one wait (`X-9`), and the
   *   escalation already speaks from inside the region.
   */
  readonly resolvedLabel = computed<string>(() => {
    const tail = this.expectationText();
    const label = this.label().trim();
    // ★★ A BLANK LABEL IS A NAMELESS STATUS REGION (OF-18-I1 / OF-18-M1).
    //    `role="status"` with `aria-label=""` is announced as nothing at all,
    //    which is the exact defect the audit names. Making `label` a required
    //    input would break every existing `<sv-spinner />`, so the guarantee is
    //    enforced here instead: a blank label falls back to the default and
    //    dev mode says so (see the constructor).
    if (!tail) return label === '' ? SvSpinnerComponent.FALLBACK_LABEL : this.label();
    if (label === '') return tail;
    // A comma buys the reader a pause; a label that already ends in
    // punctuation ("Loading…") does not need a second mark after it.
    return /[.!?…:,;]$/.test(label) ? `${label} ${tail}` : `${label}, ${tail}`;
  });

  /** The name a spinner falls back to when the host gives it a blank one. */
  private static readonly FALLBACK_LABEL = 'Loading…';

  /** Bound to the cancel button. */
  requestCancel(): void {
    this.cancelled.emit();
  }

  /**
   * Escape on the fullscreen surface.
   *
   * ★ The stack already makes Escape do NOTHING underneath a blocking wait
   *   (see the registration below). Once the wait is stalled and the host has
   *   offered a cancel, Escape is that cancel — the keyboard equivalent of the
   *   only button on the surface. Before that it stays a deliberate no-op.
   */
  onOverlayEscape(event: Event): void {
    if (!this._stack?.isTopmost()) return;
    event.stopPropagation();
    if (this.cancelOffered()) this.requestCancel();
  }

  // ── Overlay duties (OF-18-I6 / OF-18-M4) ──────────────────────────────────

  private readonly _platformId = inject(PLATFORM_ID);
  private readonly _overlayStack = inject(SvOverlayStackService);
  private readonly _appRef = inject(ApplicationRef);
  private readonly _doc = inject(DOCUMENT);
  private readonly _hostEl = inject<ElementRef<HTMLElement>>(ElementRef);
  private _stack: SvOverlayHandle | null = null;
  /** Which mode `_stack` was registered in, so a `[portal]` flip can rebuild it. */
  private _stackPortalled = true;
  private _locked = false;
  private readonly _z = signal(50);

  /** True in a browser; the server renders the backdrop in place instead. */
  readonly isBrowser = isPlatformBrowser(this._platformId);

  /** The fullscreen surface, instantiated into `<body>` while overlaying. */
  private readonly _overlayTpl = viewChild<TemplateRef<unknown>>('overlayTpl');
  private _portal: SvPortalHost | null = null;
  private _portalView: EmbeddedViewRef<unknown> | null = null;
  private _portalEl: HTMLElement | null = null;
  /** The surface underneath, snapshotted before the stack entry is released. */
  private _belowAtClose: Element | null = null;

  /**
   * Where focus was when the wait began, and where it goes back to.
   *
   * ★★★ INERTNESS WITHOUT A FOCUS MOVE STRANDS THE USER. The stack marks the
   *     page `inert` the moment a blocking surface opens — including the
   *     button that was just pressed to start the request. Focus left sitting
   *     inside an inert subtree is focus nowhere: the next Tab restarts at the
   *     top of a document the user cannot reach. So focus moves INTO the
   *     surface on open and is restored (with X-6's survivor walk) on close.
   */
  private readonly _focusScope = createFocusScope({
    within: () => this._portalEl,
    below: () => this._belowAtClose,
  });

  /**
   * The z-index the backdrop paints at.
   *
   * ★★★ IT WAS A HARDCODED `z-50`, AND THAT IS NOT A STYLE CHOICE — IT IS A
   *     BUG WITH A NUMBER IN IT. Every other surface in this kit now takes its
   *     z-index from the stack, starting at 1000. A fullscreen "please wait"
   *     raised over an open dialog therefore painted BEHIND the dialog: the
   *     page was blocked, the backdrop was invisible under the panel, and the
   *     user could keep clicking the form they had just submitted. The whole
   *     point of the surface is to be in front.
   */
  readonly backdropZ = computed(() => this._z());

  /**
   * The shared polite announcer, scoped to this spinner.
   *
   * ★★★ A STATUS REGION BORN WITH ITS NAME IS OFTEN NEVER READ. Live regions
   *     announce what CHANGES in them after they exist; a `role="status"`
   *     inserted with its `aria-label` already set is, on most screen readers,
   *     silent — so "announce by default" was a claim the markup could not
   *     keep. The label is now said once through the kit's shared announcer
   *     when the spinner first renders, and the region keeps `role="status"`
   *     for its semantics and for the escalation messages that change inside
   *     it later. The region no longer repeats the label as text content, so
   *     there is exactly one voice for the wait.
   */
  private readonly _announcer = inject(SvLiveAnnouncer).scoped();

  constructor() {
    // Say the label once, on the first browser render. `afterNextRender` never
    // runs on the server, and it is torn down with this component — a spinner
    // destroyed before it paints says nothing.
    //
    // ★ Not for the portalled fullscreen surface: it moves focus onto a
    //   `role="dialog"` named by the same label, and focus is what a screen
    //   reader speaks. Announcing as well would say it twice.
    afterNextRender({
      read: () => {
        // ★ An explicit platform check: `afterNextRender` itself keys off the
        //   build-time `ngServerMode` flag, not the injected PLATFORM_ID.
        if (!isPlatformBrowser(this._platformId)) return;
        if (this.overlay() && this.portal()) return;
        this._announcer.announce(this.resolvedLabel(), { priority: 'polite' });
      },
    });

    // Register only while actually overlaying. An inline spinner is not a
    // surface and must not take a z-index, a scroll lock, or a place in the
    // stack.
    effect(() => {
      const on = this.overlay();
      const tpl = this._overlayTpl();
      const portalled = this.portal();
      if (!isPlatformBrowser(this._platformId)) return;
      // `[portal]` flipped while overlaying: tear the current surface down so
      // the branch below builds the other one — never both, never neither.
      if (on && this._stack && this._stackPortalled !== portalled) untracked(() => this._release());
      if (on && !this._stack && !portalled) {
        // Opt-back: in place, stacked and scroll-locked, but not blocking.
        this._stackPortalled = false;
        this._stack = this._overlayStack.push('modal');
        this._z.set(this._stack.zIndex);
        svLockBodyScroll(document);
        this._locked = true;
      } else if (on && !this._stack && tpl) {
        // ★★ DISMISSIBLE, DELIBERATELY, FOR A SURFACE THAT CANNOT BE
        //    DISMISSED. This is the one place where owning Escape and doing
        //    NOTHING with it is the correct behaviour: a blocking wait has no
        //    cancel, so the right answer to Escape is that nothing happens.
        //    Registering as non-dismissible would let the keystroke fall
        //    through to the dialog underneath and close a form mid-request —
        //    which is exactly the failure mode `X-4` exists to prevent, and
        //    why ownership is a QUERY rather than an event: the stack does not
        //    call anyone, it only answers "not you".
        //
        //    Escape doing nothing is correct only while the wait is
        //    genuinely uncancellable: once a stalled wait offers a cancel
        //    (`cancelLabel`), Escape triggers it — see `onOverlayEscape`.
        //
        //    ★★ BLOCKING, and portalled so that can be true (OF-18-I6). The
        //       stack makes every other `<body>` child `inert` — focus and the
        //       accessibility tree both — which it can only do for a surface
        //       that is a sibling of the page rather than inside it. The old
        //       backdrop rendered in place, so "fullscreen" covered the page
        //       with pixels while Tab walked straight through it to the form
        //       that had just been submitted.
        this._stackPortalled = true;
        this._stack = this._overlayStack.push('modal', {
          blocking: true,
          element: () => this._portalEl,
        });
        this._z.set(this._stack.zIndex);
        svLockBodyScroll(document);
        this._locked = true;
        untracked(() => {
          this._focusScope.capture();
          this._mountPortal(tpl);
          this._portalEl
            ?.querySelector<HTMLElement>('[data-sv-spinner-overlay]')
            ?.focus({ preventScroll: true });
        });
      } else if (!on && this._stack) {
        this._release();
      }
    });

    // ★★ THE SPINNER IS ITSELF THE "IS IT WAITING?" SIGNAL. It has no
    //    `loading` input — a host renders it while waiting and removes it when
    //    done — so the wait starts when the component exists and ends when it
    //    is destroyed. Which is also why `start()` has to be idempotent: this
    //    effect re-runs whenever either threshold input changes.
    effect(() => {
      if (!isPlatformBrowser(this._platformId)) return;
      if (this.resolvedSlowAfterMs() > 0 || this.resolvedStalledAfterMs() > 0) {
        this._wait.start();
      }
    });

    // Report each escalation once. Not `effect` over `stage()` alone — that
    // would also fire for `waiting`, which is not news.
    effect(() => {
      const stage = this._wait.stage();
      if (stage === 'slow' || stage === 'stalled') this.escalated.emit(stage);
    });

    // A stated expectation that the component's own timers contradict.
    //
    // ★ No `expected > 0` clause: I wrote one, and `slow > 0` already makes it
    //   unreachable — with no expectation the comparison is `slow <= 0`, which
    //   the first half has excluded. Every mutation of it stayed green, so it
    //   is gone.
    effect(() => {
      const expected = this._expected();
      const slow = this.slowAfterMs();
      if (slow > 0 && slow <= expected) {
        svWarnOnce(
          'sv-spinner/slow-before-expectation',
          `[styloviz] sv-spinner: [slowAfterMs] (${slow}ms) is not after ` +
            `[expectedMs] (${expected}ms), so this spinner will say the wait is ` +
            'taking longer than usual while it is still within the time it told ' +
            'the user to expect. Raise slowAfterMs, or drop it and let expectedMs ' +
            'derive both thresholds.',
        );
      }
    });

    // A blank name is announced as nothing — say so in dev (OF-18-M1).
    effect(() => {
      if (this.label().trim() === '' && this.expectationText() === null) {
        svWarnOnce(
          'sv-spinner/blank-label',
          '[styloviz] sv-spinner: [label] is blank, so this status region would be ' +
            `announced as nothing at all. It falls back to "${SvSpinnerComponent.FALLBACK_LABEL}"; ` +
            'pass a label that says what is loading ("Loading invoices…").',
        );
      }
    });

    inject(DestroyRef).onDestroy(() => this._release());
  }

  /** Give back the stack entry, the portal, the scroll lock and focus. Idempotent. */
  private _release(): void {
    const wasOpen = this._stack !== null;
    this._belowAtClose = this._stack?.surfaceBelow() ?? null;
    this._stack?.release();
    this._stack = null;
    this._destroyPortal();
    if (this._locked) {
      svUnlockBodyScroll(document);
      this._locked = false;
    }
    if (wasOpen) this._focusScope.restore();
    this._belowAtClose = null;
  }

  /**
   * Render the fullscreen surface, THEN insert it into `<body>` — the order
   * `createPortalHost` exists to make explicit.
   */
  private _mountPortal(tpl: TemplateRef<unknown>): void {
    if (this._portalView) return;
    this._portal = createPortalHost({
      origin: this._hostEl.nativeElement,
      document: this._doc,
      label: 'spinner',
    });
    this._portalEl = this._portal.element;
    this._portalView = tpl.createEmbeddedView({});
    this._appRef.attachView(this._portalView);
    this._portalView.detectChanges();
    for (const node of this._portalView.rootNodes as Node[]) this._portalEl.appendChild(node);
    this._portal.attach();
  }

  private _destroyPortal(): void {
    if (this._portalView) {
      this._appRef.detachView(this._portalView);
      this._portalView.destroy();
      this._portalView = null;
    }
    this._portal?.destroy();
    this._portal = null;
    this._portalEl = null;
  }

  // ── Extra ─────────────────────────────────────────────────────────────────

  /** Extra CSS classes merged onto the root wrapper. */
  customClass = input<string>('');

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly spinnerSize = computed<string>(() => {
    switch (this.size()) {
      case 'xs': return 'h-3 w-3';
      case 'sm': return 'h-4 w-4';
      case 'lg': return 'h-8 w-8';
      case 'xl': return 'h-12 w-12';
      default:   return 'h-6 w-6';
    }
  });

  readonly borderWidth = computed<string>(() => {
    switch (this.size()) {
      case 'xs': return 'border-[1.5px]';
      case 'sm': return 'border-2';
      case 'lg': return 'border-[3px]';
      case 'xl': return 'border-4';
      default:   return 'border-2';
    }
  });

  readonly trackColor = computed<string>(() => {
    const map: Record<SpinnerVariant, string> = {
      primary: 'border-primary-200 dark:border-primary-900',
      success: 'border-accent-200 dark:border-accent-900',
      warning: 'border-warning-200 dark:border-warning-900',
      danger:  'border-danger-200 dark:border-danger-900',
      info:    'border-info-200 dark:border-info-900',
      neutral: 'border-gray-200 dark:border-gray-700',
      white:   'border-white/20',
    };
    return map[this.variant()];
  });

  readonly fillColor = computed<string>(() => {
    const map: Record<SpinnerVariant, string> = {
      primary: 'border-t-primary-600 dark:border-t-primary-400',
      success: 'border-t-accent-600 dark:border-t-accent-400',
      warning: 'border-t-warning-500 dark:border-t-warning-400',
      danger:  'border-t-danger-600 dark:border-t-danger-400',
      info:    'border-t-info-600 dark:border-t-info-400',
      neutral: 'border-t-gray-600 dark:border-t-gray-400',
      white:   'border-t-white',
    };
    return map[this.variant()];
  });

  readonly dotColor = computed<string>(() => {
    const map: Record<SpinnerVariant, string> = {
      primary: 'bg-primary-600 dark:bg-primary-400',
      success: 'bg-accent-600 dark:bg-accent-400',
      warning: 'bg-warning-500 dark:bg-warning-400',
      danger:  'bg-danger-600 dark:bg-danger-400',
      info:    'bg-info-600 dark:bg-info-400',
      neutral: 'bg-gray-600 dark:bg-gray-400',
      white:   'bg-white',
    };
    return map[this.variant()];
  });

  readonly dotSize = computed<string>(() => {
    switch (this.size()) {
      case 'xs': return 'h-1 w-1';
      case 'sm': return 'h-1.5 w-1.5';
      case 'lg': return 'h-2.5 w-2.5';
      case 'xl': return 'h-3.5 w-3.5';
      default:   return 'h-2 w-2';
    }
  });

  readonly labelSize = computed<string>(() => {
    switch (this.size()) {
      case 'xs': return 'text-[10px]';
      case 'sm': return 'text-xs';
      case 'lg': return 'text-base';
      case 'xl': return 'text-lg';
      default:   return 'text-sm';
    }
  });

  readonly barHeight = computed<string>(() => {
    switch (this.size()) {
      case 'xs': return 'h-3';
      case 'sm': return 'h-4';
      case 'lg': return 'h-8';
      case 'xl': return 'h-10';
      default:   return 'h-6';
    }
  });
}
