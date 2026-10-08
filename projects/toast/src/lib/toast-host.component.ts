import {
  afterRenderEffect,
  effect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT, NgClass } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import {
  ToastService,
  SvLiveAnnouncer,
  SvOverlayStackService,
  createPortalHost,
  svAnnouncePriorityFor,
  type SvPortalHost,
  Toast,
  ToastPosition,
  ToastVariant,
} from '@styloviz/core';

// ─── Icon paths keyed to variant ──────────────────────────────────────────────

/** Toast variant → icon-library NAME (was five hand-copied `d` strings). */
const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: 'check-circle',
  error:   'x-circle',
  warning: 'alert-triangle',
  info:    'info',
};

const VARIANT_COLORS: Record<ToastVariant, { icon: string; progress: string }> = {
  success: { icon: 'text-accent-500 dark:text-accent-400', progress: 'bg-accent-500' },
  error:   { icon: 'text-danger-500 dark:text-danger-400',         progress: 'bg-danger-500'     },
  warning: { icon: 'text-warning-500 dark:text-warning-400',     progress: 'bg-warning-500'   },
  info:    { icon: 'text-info-500 dark:text-info-400',         progress: 'bg-info-500'     },
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ToastHostComponent — Renders the active toast stack from `ToastService`.
 *
 * Place **once** in your root shell template (e.g., `AppComponent` or
 * `DashboardShellComponent`):
 *
 * ```html
 * <sv-toast-host />
 * ```
 *
 * Then trigger toasts imperatively from any component or service:
 * ```typescript
 * this.toast.success('Record saved!');
 * this.toast.error('Failed to delete', { title: 'Error', duration: 0 });
 * ```
 */
@Component({
  selector: 'sv-toast-host',
  standalone: true,
  imports: [NgClass, SvIconComponent],
  templateUrl: './toast-host.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvToastHostComponent {
  private readonly toastService = inject(ToastService);
  private readonly _el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _doc = inject(DOCUMENT);
  /**
   * The one place that speaks. See `X-9` / `OF-19-M6`.
   *
   * ★ `scoped()` so a throttled or held message is dropped if this host is
   *   destroyed — the stack is usually mounted once in an app shell, but a
   *   lazily-loaded layout can take it away mid-announcement.
   */
  private readonly _live = inject(SvLiveAnnouncer).scoped();

  /**
   * The stack's registration for the toast region (`X-4`).
   *
   * ★★★ IT WAS A HARD-CODED `z-50`, AND EVERY OTHER SURFACE STARTS AT 1000. A
   *     toast confirming what a dialog just did therefore painted BEHIND that
   *     dialog — the one moment a toast matters most. The ambient `toast`
   *     band sits above every interactive surface whenever it was raised, and
   *     `dismissible: false` keeps Escape with the dialog.
   *
   * ★ Held for the host's lifetime, not per toast: the region is one fixed
   *   element whatever it holds. The `element` getter answers only while the
   *   region is portalled (`[portal]`): in place, the host lives inside the
   *   app shell, and handing the stack an element inside the page would make
   *   the stack treat the whole page as part of a live surface.
   */
  private readonly _layer = inject(SvOverlayStackService).push('toast', {
    dismissible: false,
    element: () => this._portal?.element ?? null,
  });

  /** The fixed region — the element moved into `<body>` under `[portal]`. */
  private readonly _regionRef = viewChild<ElementRef<HTMLElement>>('region');
  private _portal: SvPortalHost | null = null;

  /** z-index for the fixed region, from the stack's ambient toast band. */
  readonly stackZ = this._layer.zIndex;

  // ── Inputs ────────────────────────────────────────────────────────────────

  /** Where the stack is anchored on screen. @default 'top-right' */
  position = input<ToastPosition>('top-right');

  /** Maximum number of toasts visible simultaneously. @default 5 */
  maxVisible = input<number>(5);

  /**
   * Move the region to `<body>` so it stays usable above a modal (`X-4`).
   *
   * ★★ `inert` IS INHERITED AND CANNOT BE UNDONE BY A DESCENDANT. A modal
   *    makes the page behind it inert, and a host mounted inside the app shell
   *    is part of that page: its toasts are still announced (speech goes
   *    through the shared announcer) but an "Undo" button on one cannot be
   *    pressed until the dialog closes. Portalled, the region is a `<body>`
   *    child the stack keeps live at any depth. Off by default because it
   *    moves the region's DOM (and its `data-sv-toast-*` hooks) out of the host.
   * @default false
   */
  portal = input<boolean>(false);

  // ── Reactive state ────────────────────────────────────────────────────────

  /**
   * `maxVisible`, validated (`OF-19-I2`). ★ `slice(-0)` is the WHOLE array, so
   * `0` used to mean "no cap at all" and a negative number sliced from the
   * wrong end. Anything below 1 is 1, a non-number is the default 5, and
   * `Infinity` is the one explicit way to say "never cap".
   */
  readonly visibleLimit = computed<number>(() => {
    const raw = this.maxVisible();
    if (raw === Infinity) return Infinity;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return 5;
    return Math.max(1, Math.floor(raw));
  });

  /** Every toast anchored to this host, newest last. */
  private readonly _anchored = computed(() => {
    const pos = this.position();
    return this.toastService.toasts().filter(t => t.position === pos);
  });

  toasts = computed(() => {
    const all = this._anchored();
    const limit = this.visibleLimit();
    return limit === Infinity ? all : all.slice(-limit);
  });

  /**
   * How many older toasts the cap is holding back (`OF-19-M2`).
   *
   * ★★ THE OVERFLOW RULE IS "NEWEST n SHOWN, THE REST COUNTED". Hidden toasts
   *    stay alive — they keep their own countdowns and slide back into view as
   *    newer ones go — and the stack says how many there are with a "+N more"
   *    line, so a capped stack is never silently shorter than the truth.
   */
  readonly hiddenCount = computed(() => this._anchored().length - this.toasts().length);

  /**
   * What each toast id was last announced as. A MAP, not a set (`OF-19-M1`):
   * an identical repeat is silent, but an explicit-key REPLACEMENT keeps its
   * id while its text changes — `'Saving…'` → `'Saved'` — and was never read
   * out at all while this remembered only the id.
   */
  private readonly _announced = new Map<string, string>();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this._unportal();
      this._layer.release();
    });

    // [portal]: move the rendered region into a `<body>` portal, and back.
    afterRenderEffect(() => {
      const region = this._regionRef()?.nativeElement;
      const wanted = this.portal();
      untracked(() => {
        if (!region) return;
        if (wanted && !this._portal) {
          const portal = createPortalHost({
            origin: this._el.nativeElement,
            document: this._doc,
            label: 'toast',
          });
          if (!portal.element) return; // server: no document to portal into
          portal.element.appendChild(region);
          portal.attach();
          this._portal = portal;
        } else if (!wanted && this._portal) {
          this._unportal();
        }
      });
    });

    effect(() => {
      const visible = this.toasts();
      for (const toast of visible) {
        const text = this._announceText(toast);
        if (this._announced.get(toast.id) === text) continue;
        this._announced.set(toast.id, text);
        this._announce(toast);
      }

      // ★★ FORGOTTEN AGAINST THE SERVICE'S LIST, NOT THE VISIBLE SLICE, and
      //    the difference is a real repeat. `maxVisible` keeps the NEWEST n,
      //    so with six toasts up the oldest is out of view but still alive —
      //    and dismissing the newer ones brings it back into the slice. Clean
      //    up against the visible list and that reappearance is announced a
      //    second time, minutes after the event it describes.
      const alive = new Set(this.toastService.toasts().map((t) => t.id));
      for (const id of [...this._announced.keys()]) if (!alive.has(id)) this._announced.delete(id);
    });

    // ★★★ A TOAST THAT ARRIVES WHILE THE STACK IS PAUSED IS PAUSED TOO
    //     (`OF-19-I3` / `OF-19-M3`). `pauseAll()` only ever ran on the
    //     mouseenter/focusin edge, so a toast raised while the pointer was
    //     already resting on the stack — or a deduplicated repeat, whose
    //     countdown the service restarts — counted down and vanished under the
    //     pointer, and its progress bar lied by showing `paused`. This re-runs
    //     on every change to the visible list; `pause()` is idempotent.
    effect(() => {
      const visible = this.toasts();
      untracked(() => {
        if (this.paused()) for (const t of visible) this.toastService.pause(t.id);
      });
    });

    // ★ AFTER render, not in the effect above: view effects run before the
    //   template is updated, so the dismissed toast — and the focus inside it
    //   — is still in the DOM when they do.
    afterRenderEffect(() => {
      this.toasts();
      untracked(() => this._reconcileFocus());
    });
  }

  /**
   * ★ A focused toast that is REMOVED (its own Dismiss or action pressed)
   *   takes focus with it, and not every browser fires `focusout` for a node
   *   that is detached — so `_focusWithin` stayed true and every toast raised
   *   afterwards was held open for good. Re-derive it from where focus is.
   */
  private _reconcileFocus(): void {
    if (!this._focusWithin()) return;
    const active = this._doc.activeElement;
    // The region, not the host: under `[portal]` the region lives in `<body>`.
    const region = this._regionRef()?.nativeElement ?? this._el.nativeElement;
    if (active && region.contains(active)) return;
    this._focusWithin.set(false);
    this._sync();
  }

  // ── Position class ────────────────────────────────────────────────────────
  // flex direction is baked in: top positions stack DOWN (flex-col),
  // bottom positions stack UP (flex-col-reverse) so new toasts appear
  // closest to the screen edge.

  positionClass = computed<string>(() => {
    const map: Record<ToastPosition, string> = {
      'top-right':     'top-4 right-4    items-end    flex-col',
      'top-left':      'top-4 left-4     items-start  flex-col',
      'top-center':    'top-4 left-1/2   -translate-x-1/2 items-center flex-col',
      'bottom-right':  'bottom-4 right-4  items-end    flex-col-reverse',
      'bottom-left':   'bottom-4 left-4   items-start  flex-col-reverse',
      'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center flex-col-reverse',
    };
    return map[this.position()];
  });

  // ── Hover-pause (WCAG 2.2.1) ──────────────────────────────────────────────
  // Pausing the auto-dismiss countdown while the pointer is over the stack
  // gives users time to read and interact with toasts.

  // ★ TWO REASONS, NOT ONE FLAG. The stack pauses while the pointer is over it
  //   AND while focus is inside it, and those two overlap: hover a toast, tab
  //   into its action button, then move the mouse away. With a single boolean,
  //   `mouseleave` resumed the countdown while the user was still focused on
  //   the button they were about to press — a WCAG 2.2.1 failure that looks
  //   like the toast vanishing mid-keystroke. Resume only when NEITHER reason
  //   holds.
  private readonly _hovering    = signal(false);
  private readonly _focusWithin = signal(false);

  readonly paused = computed(() => this._hovering() || this._focusWithin());

  onPointerEnter(): void { this._hovering.set(true);     this._sync(); }
  onPointerLeave(): void { this._hovering.set(false);    this._sync(); }
  onFocusIn():      void { this._focusWithin.set(true);  this._sync(); }
  onFocusOut():     void { this._focusWithin.set(false); this._sync(); }

  /**
   * Pause every toast, whatever the reason. Public because a host may want to
   * hold the stack open itself (a confirmation step inside a toast, say).
   * Prefer the four handlers above for pointer and focus.
   */
  pauseAll(): void {
    for (const t of this.toasts()) this.toastService.pause(t.id);
  }

  /** Resume every toast. See `pauseAll()`. */
  resumeAll(): void {
    for (const t of this.toasts()) this.toastService.resume(t.id);
  }

  /** Apply whichever of pause/resume the two reasons currently add up to. */
  private _sync(): void {
    if (this.paused()) this.pauseAll();
    else this.resumeAll();
  }

  // ── Accessibility ─────────────────────────────────────────────────────────

  /**
   * ★★★ EACH TOAST USED TO BE ITS OWN LIVE REGION, and that is why this whole
   *     method pair is gone. The `@for` inserted a node that already carried
   *     `aria-live` AND its text, and assistive technology watches an EXISTING
   *     region for changes — a region that arrives complete is at the mercy
   *     of when the AT last scanned. `role="alert"` had the same problem for
   *     the same reason: it is an implicit assertive live region.
   *
   * ★★ A toast also outlives its own announcement in the wrong direction: it
   *    auto-dismisses after four seconds and takes its region with it,
   *    mid-sentence.
   *
   *     The visible node is now just a visible node. The stack container
   *     stays `role="region"` + `aria-label="Notifications"` so a screen
   *     reader user can still NAVIGATE to a toast and press its action — what
   *     it no longer does is try to shout from inside a node that has only
   *     just appeared. `OF-19-I8`.
   */
  private _announce(toast: Toast): void {
    this._live.announce(this._announceText(toast), { priority: svAnnouncePriorityFor(toast.variant) });
  }

  private _announceText(toast: Toast): string {
    return [toast.title, toast.message].filter(Boolean).join('. ');
  }

  /** Text for the overflow line. */
  overflowLabel(count: number): string {
    return `+${count} more`;
  }

  // ── Per-toast helpers ─────────────────────────────────────────────────────

  /** Icon-library NAME for the toast variant. Was `iconPath`. */
  iconName(toast: Toast): string {
    return VARIANT_ICONS[toast.variant];
  }

  iconClass(toast: Toast): string {
    return VARIANT_COLORS[toast.variant].icon;
  }

  progressClass(toast: Toast): string {
    return VARIANT_COLORS[toast.variant].progress;
  }

  /**
   * ★★ THE ANIMATION NAME ALTERNATES WITH `count`, AND THAT IS THE POINT. A
   *    deduplicated repeat refreshes the toast in place and restarts its
   *    timer, but the node is not recreated (it is tracked by id, so the
   *    user's focus inside it survives) — and a running CSS animation does not
   *    restart because a property it does not depend on changed. The bar went
   *    on emptying from wherever the first occurrence had left it, showing a
   *    toast about to vanish while its countdown had just begun again.
   *    Changing `animation-name` is what restarts it, so there are two
   *    identical keyframes in `styles.css` and repeats flip between them.
   */
  progressStyle(toast: Toast): string {
    if (!toast.duration) return 'width: 0%';
    const name = toast.count % 2 === 1 ? 'toast-progress' : 'toast-progress-alt';
    return `animation: ${name} ${toast.duration}ms linear forwards`;
  }

  /** Screen-reader text for the repeat badge. */
  repeatLabel(toast: Toast): string {
    return `Repeated ${toast.count} times`;
  }

  dismiss(toast: Toast): void {
    this.toastService.dismiss(toast.id);
  }

  onActionClick(toast: Toast): void {
    toast.action?.callback();
    this.toastService.dismiss(toast.id);
  }

  trackById(_: number, toast: Toast): string {
    return toast.id;
  }

  /** Put the region back inside the host and remove the portal. Idempotent. */
  private _unportal(): void {
    if (!this._portal) return;
    const region = this._regionRef()?.nativeElement;
    if (region) this._el.nativeElement.appendChild(region);
    this._portal.destroy();
    this._portal = null;
  }
}
