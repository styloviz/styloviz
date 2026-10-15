import {
  signal,
  ElementRef,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  EmbeddedViewRef,
  HostListener,
  inject,
  input,
  model,
  OnDestroy,
  output,
  TemplateRef,
  untracked,
  ViewChild,
} from '@angular/core';
import { SvIconComponent } from '@styloviz/icons';
import {
  svSerializeTourProgress,
  svRestoreTourProgress,
  type SvTourProgress,
  type SvTourProgressRestored,
  type SvTourResumeReason,
  type SvTourSchemaStale,
  type SvTourStatus,
} from './product-tour.progress';
import {
  SvOverlayStackService,
  createFocusScope,
  createPortalHost,
  type SvOverlayHandle,
  type SvPortalHost,
  svWarnRestoreRefused,
  svLocalStorage,
} from '@styloviz/core';

import type { TourRouteRequest, TourVariant } from './product-tour.types';
import { type TourStep } from './product-tour.types';

// Re-export types so consumers can import from the component file if desired.
export type { TourVariant, TourPlacement, TourStep } from './product-tour.types';

/**
 * SvProductTourComponent — Onboarding & product-tour overlay (Free tier).
 *
 * Ships the **modal** variant: a centered lightbox dialog with an optional
 * image, icon, tag badge, dot pagination, skip control and CTA link. The
 * card is rendered into `document.body` via an `ApplicationRef` portal so it
 * escapes every `overflow` / `transform` / `z-index` stacking context, and it
 * behaves like a dialog: focus moves inside on open, Tab is trapped, and focus
 * is restored on close.
 *
 * The Pro package (`@styloviz-pro/product-tour`) adds seven further variants:
 * slideshow, tooltip, spotlight, beacon, checklist, progress-steps and
 * announcement.
 *
 * @example
 * <sv-product-tour
 *   [(active)]="tourOpen"
 *   [(stepIndex)]="tourStep"
 *   [steps]="tourSteps"
 *   (complete)="onTourDone()"
 * />
 */
@Component({
  selector: 'sv-product-tour',
  standalone: true,
  imports: [SvIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-tour.component.html',
})
export class SvProductTourComponent implements OnDestroy {

  // ── Inputs ─────────────────────────────────────────────────────────────────

  /** Step definitions. */
  steps = input<TourStep[]>([]);
  /**
   * Deprecated, and has no effect: the free tour renders the `modal` variant only, so this
   * input has a single value.
   *
   * @deprecated Kept so 1.x templates compile; removed in 2.0. The seven other
   * variants are Pro: `sv-product-tour-pro [variant]`.
   * @default 'modal'
   */
  variant = input<TourVariant>('modal');
  /** Two-way: controls tour visibility. Set to `true` to launch the tour. */
  active = model<boolean>(false);
  /** Two-way: current step index. */
  stepIndex = model<number>(0);

  // ── Labels (override for i18n) ─────────────────────────────────────────────

  /** Text of the button that advances to the next step; the last step shows `doneLabel` instead. @default 'Next' */
  nextLabel = input('Next');
  /** Text of the button that returns to the previous step. @default 'Back' */
  prevLabel = input('Back');
  /** Text of the button that dismisses the tour before it is finished. @default 'Skip tour' */
  skipLabel = input('Skip tour');
  /** Text of the advance button on the last step, which finishes the tour. @default 'Done' */
  doneLabel = input('Done');

  // ── Behaviour ──────────────────────────────────────────────────────────────

  /** Show the skip / close controls. */
  allowSkip     = input(true);
  /** Show the "step X of N" counter. */
  showStepCount = input(true);
  /** Show the dot progress indicator. */
  showProgress  = input(true);

  // ── Progress & schema (`X-12`, `OF-13-I6`, `OF-13-I7`) ───────────────────

  /**
   * Identity of this tour DEFINITION — not of the component instance.
   *
   * ★ Required for persistence, and stored inside the blob as well as being
   *   part of the key, because the key is the host's and keys get reused. A
   *   progress blob from last quarter's onboarding tour, read by this
   *   quarter's, restores a `stepId` that means nothing.
   */
  tourId = input<string>('');

  /**
   * Version of this tour's STEPS. Bump it when the steps change.
   *
   * ★★ STORED PROGRESS FROM ANOTHER VERSION IS NOT ADOPTABLE. The stored step
   *    id may still exist and mean something different, or the order may have
   *    changed — either way the position is a guess, so a version change
   *    restarts the tour and says so.
   */
  tourVersion = input<number>(1);

  /**
   * The version the HOST says its UI is at. `null` (default) = do not check.
   *
   * ★★★ ONLY THE HOST KNOWS THIS, which is why it is an input and not an
   *     inference. A tour authored against v1 of a screen, running against v3,
   *     points at controls that have moved or gone — and nothing inside a
   *     component library can detect that from the outside.
   *
   * ★ A mismatch is REPORTED through `(schemaStale)` and does not stop the
   *   tour: deciding whether a returning user sees it depends on things the
   *   component cannot see. The runtime half — `(targetMissing)` for a step
   *   whose target is not there — is Pro-only, because the free tier's one
   *   variant (`modal`) anchors to nothing.
   */
  expectedVersion = input<number | null>(null);

  /**
   * Where `localStorage` keeps this tour's progress. Empty = no persistence.
   */
  persistKey = input<string>('');

  /**
   * What a stored, unfinished tour does on the next visit (`OF-13-I6`).
   *
   * | Value       | Meaning                                                  |
   * |-------------|----------------------------------------------------------|
   * | `'step'`    | resume on the stored step (first step if it is gone)     |
   * | `'restart'` | always from the first step                               |
   * | `'never'`   | restore the ticks, not the position                      |
   *
   * ★ "resume, restart or exit" was undefined, which is the finding. It is a
   *   per-tour decision — a five-step onboarding wants resuming, a two-step
   *   feature announcement does not — so it is an input rather than a rule.
   */
  resume = input<'step' | 'restart' | 'never'>('step');

  // ── Outputs ────────────────────────────────────────────────────────────────

  /** Fires with the new step index whenever navigation occurs. */
  readonly stepChange = output<number>();
  /** Fires when the last step is confirmed (Next on final step). */
  readonly complete   = output<void>();
  /** Fires when the user explicitly skips the tour. */
  readonly skip       = output<void>();
  /**
   * Stored progress was found and applied (`OF-13-I6`).
   *
   * ★★ THE TOUR DOES NOT DECIDE WHETHER TO SHOW ITSELF, for the same reason it
   *    does not navigate: whether a returning user sees it depends on a feature
   *    flag, a cohort, or the host's own "seen" table. What it owes is the
   *    RECORD — status, step, ticks — and this event, so the host's `[active]`
   *    can be an informed one. A `status` of `'completed'` or `'dismissed'`
   *    here is the "don't show this again" the audit said nothing recorded.
   */
  readonly progressRestored = output<SvTourProgressRestored>();
  /**
   * `tourVersion` and `expectedVersion` disagree (`OF-13-I7`): these steps were
   * authored against a different version of the UI they point at.
   */
  readonly schemaStale      = output<SvTourSchemaStale>();
  /**
   * A step with a `route` became current — the host should navigate there
   * (`X-13`, `OF-13-I2`, `OF-13-M3`).
   *
   * Fires on arrival, including the step the tour opens on, and once per
   * arrival. The tour never navigates itself: it cannot know whether the app
   * uses `@angular/router`, whether the jump needs params or passes a guard,
   * or whether the host would rather refuse.
   */
  readonly routeRequest = output<TourRouteRequest>();

  // ── Template refs ──────────────────────────────────────────────────────────

  @ViewChild('tourTpl') private tourTpl!: TemplateRef<unknown>;

  // ── Services ───────────────────────────────────────────────────────────────

  private readonly appRef = inject(ApplicationRef);

  // ── Portal state ───────────────────────────────────────────────────────────

  private portalEl:     HTMLDivElement | null           = null;
  /**
   * The portal host's handle — the element it owns is `portalEl` above.
   *
   * ★ A bare `<div>` on `<body>` inherits nothing the surface used to inherit
   *   where it was authored: a locally dark section, a scoped `dir="rtl"`, a
   *   density token. `createPortalHost` carries what has exactly one correct
   *   value and states plainly what does not travel. See `X-8`.
   */
  private _portalContext: SvPortalHost | null = null;
  /** This component's own element — the origin the body portal copies context from. */
  private readonly _el = inject(ElementRef<HTMLElement>);
  protected portalView: EmbeddedViewRef<unknown> | null = null;

  /**
   * Where focus came from, and where it goes back to.
   *
   * ★ A tour is the one overlay here that is EXPECTED to outlive what it was
   *   opened from: it walks the user across a page, and a step can navigate.
   *   `focus()` on the element that was focused when it started is therefore a
   *   silent no-op more often here than anywhere else. See X-6.
   */
  private readonly _focusScope = createFocusScope({ within: () => this.portalEl });

  // ── Overlay stack (X-4, X-5, OF-13-I5) ────────────────────────────────────

  /**
   * The free tier ships only the `modal` variant, which dims the page and
   * asserts `aria-modal="true"` — so it is always a blocking surface. The Pro
   * twin has to decide per variant; here there is nothing to decide.
   */
  private readonly _overlayStack = inject(SvOverlayStackService);
  private _stack: SvOverlayHandle | null = null;
  private readonly _z = signal(9990);

  /** Backdrop layer. The surface owns `z` … `z + 9`; see `SvOverlayHandle`. */
  readonly backdropZ = computed(() => this._z());
  /** The card itself, above its own backdrop. */
  readonly panelZ = computed(() => this._z() + 1);

  private _releaseStack(): void {
    this._stack?.release();
    this._stack = null;
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  /** Whether there is anything to show at all. */
  readonly hasSteps = computed(() => this.steps().length > 0);

  /**
   * The index actually rendered.
   *
   * ★ `stepIndex` is a two-way model, so a host can put anything in it — an
   * index left over from a longer list, or the 0 it starts at while the steps
   * are still in flight. Reading `steps()[stepIndex()]` straight through gave
   * `undefined`, and the card rendered its shell around nothing.
   */
  readonly resolvedStepIndex = computed(() => {
    const n = this.steps().length;
    if (!n) return 0;
    return Math.min(Math.max(this.stepIndex(), 0), n - 1);
  });

  readonly currentStep = computed((): TourStep | null =>
    this.hasSteps() ? this.steps()[this.resolvedStepIndex()] ?? null : null,
  );
  readonly isFirstStep = computed(() => this.resolvedStepIndex() === 0);
  /**
   * ★ This used to be `stepIndex >= steps.length - 1`, which for an empty tour
   * is `0 >= -1` — permanently true. A tour whose steps had not arrived yet
   * therefore said it was on its final step, showed "Done", and fired
   * `complete` for something nobody had seen.
   */
  readonly isLastStep  = computed(() =>
    this.hasSteps() && this.resolvedStepIndex() >= this.steps().length - 1,
  );

  /**
   * ★ KEYED BY THE HUE ITSELF — `TourStep.tagColor` is public API, so a caller
   *   writes `tagColor: 'blue'` and a `blue` key that painted `primary` would be
   *   a lie the moment a buyer rebranded. It is a caller's own tag palette, not
   *   a role: `green` labels a step, it does not report success. `purple` needs
   *   no exemption (no family owns it), and every other colour in this component
   *   — the spotlight, the progress bar, the checklist ticks, the beacon — is on
   *   the token families. The Pro and free twins carry this map identically.
   */
  readonly tagColorClass = computed(() => {
    const map: Record<NonNullable<TourStep['tagColor']>, string> = {
      blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      rose:   'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    };
    return (color: TourStep['tagColor']) => map[color ?? 'blue'];
  });

  // ── Constructor ────────────────────────────────────────────────────────────

  constructor() {
    // Attach / detach portal as `active` changes (+ focus management).
    effect(() => {
      // A tour with no steps does not open. A host that sets `active` from one
      // request and `steps` from another — the ordinary shape — used to get an
      // empty card in the gap between them; now it opens when the steps land.
      if (this.active() && this.hasSteps()) {
        // ★ The host opened it again, so it is active again. Without this a
        //   tour reopened after completion would persist as `completed` while
        //   the user was walking through it, and a reload mid-tour would lose
        //   the position.
        if (untracked(this._status) !== 'active') this._status.set('active');
        if (typeof document !== 'undefined') {
          this._focusScope.capture();
        }
        if (!this._stack) {
          this._stack = this._overlayStack.push('modal', {
            blocking: true,
            // ★★ Always dismissible, whatever `allowSkip` says. The flag is
            //    also the keyboard gate: a non-dismissible surface is never
            //    `isTopmost()`, and `onKeydown` refuses every key while it is
            //    not — so a non-skippable tour lost its arrows and its Tab trap
            //    as well as Escape. The card is a blocking modal, so nothing
            //    beneath it can want Escape, and `onKeydown` still does nothing
            //    with it unless `allowSkip`.
            dismissible: true,
            element: () => this.portalEl,
          });
          this._z.set(this._stack.zIndex);
        }
        // ★ Re-check inside the microtask. The attach is deferred, so a tour
        // switched on and off again before it runs — the ordinary shape when a
        // host flips `active` from two different responses — used to attach the
        // card ANYWAY, after the effect had already detached. `active` was then
        // false and did not change again, so the effect never re-ran and the
        // full-screen tour card stayed on the page with nothing able to remove
        // it.
        Promise.resolve().then(() => {
          if (this.active() && this.hasSteps()) this._attachPortal();
        });
      } else {
        this._releaseStack();
        this._detachPortal();
        this._focusScope.restore();
      }
    });

    // Read stored progress once per key (`OF-13-I6`).
    effect(() => {
      const key = this.persistKey();
      const id  = this.tourId();
      // ★ Both required. A blob with no tour id cannot be told from another
      //   tour's, and the whole point of the id is that keys get reused.
      if (!key || !id || this._restoredFor === key) return;
      // ★ And only once the steps have landed: resuming resolves a stored step
      //   ID against `steps`, so restoring before they arrive would report
      //   every resume as `step-missing`.
      if (!this.hasSteps()) return;
      this._restoredFor = key;
      untracked(() => this._restoreProgress(key));
    });

    // Write it back on any change to the position, the ticks or the status.
    effect(() => {
      const key = this.persistKey();
      const idx = this.resolvedStepIndex();
      const st  = this._status();
      void idx; void st;
      if (!key || !this.tourId() || this._restoredFor !== key) return;
      // ★ No "not while restoring" test: effects never run synchronously
      //   inside a signal write, so this cannot fire in the middle of
      //   `_restoreProgress` — it runs after it, and persists the settled,
      //   restored state, which is the record wanted.
      untracked(() => this._saveProgress(key));
    });

    // Report a tour whose steps were authored against another UI version.
    effect(() => {
      const expected = this.expectedVersion();
      const declared = this.tourVersion();
      if (expected === null || expected === declared) return;
      untracked(() =>
        this.schemaStale.emit({ tourVersion: declared, expectedVersion: expected }),
      );
    });

    // A step that lives on another route asks the host to go there (`X-13`).
    effect(() => {
      // ★ Keyed on the RESOLVED index, and reset on close, so the request
      //   fires once per arrival: a host that navigates in response triggers a
      //   change-detection pass, and re-emitting from it would navigate again,
      //   forever.
      if (!this.active() || !this.hasSteps()) {
        this._routedForIdx = -1;
        return;
      }
      const idx = this.resolvedStepIndex();
      if (this._routedForIdx === idx) return;
      this._routedForIdx = idx;
      const step  = this.steps()[idx];
      const route = step?.route;
      // An empty string is not a route — navigating to '' is how an app ends
      // up at its own root by accident.
      if (route) this.routeRequest.emit({ index: idx, step, route });
    });
  }

  /** Resolved index `(routeRequest)` was last emitted for; -1 = none. */
  private _routedForIdx = -1;


  // ── Progress persistence (`X-12`, `OF-13-I6`, `OF-13-M4`) ────────────────

  /** How this tour ended, or that it has not. Written into stored progress. */
  private readonly _status = signal<SvTourStatus>('active');
  /** Progress is read once per key, not on every change detection. */
  private _restoredFor = '';
  /** Checklist ticks read from storage, held only to be written back. */
  private _carriedCompletedIds: readonly string[] = [];

  /**
   * Read stored progress and settle on a step.
   *
   * ★★ ORDER MATTERS: the version check comes before the step lookup. A stored
   *    step id can still EXIST in a tour whose steps were rewritten, and mean
   *    something else entirely — so a version change is not a missing step, it
   *    is a restart, and the two are reported differently.
   */
  private _restoreProgress(key: string): void {
    const blob = this._readStoredJson(key);
    if (blob === null) return;

    const restored = svRestoreTourProgress(blob);
    if (!restored.ok) {
      svWarnRestoreRefused('sv-product-tour', restored);
      return;
    }
    const progress = restored.state;
    // ★ Another tour's progress under a reused key. Not an error worth
    //   warning about — hosts key by user, and a key holding last quarter's
    //   tour is ordinary — but it is not ours to apply.
    if (progress.tourId !== this.tourId()) return;

    // No ticks to apply — the checklist variant is Pro-only — but they are
    // kept so the next save writes them back rather than erasing them.
    this._carriedCompletedIds = progress.completedIds;
    this._status.set(progress.status);

    const { index, reason } = this._resolveResume(progress);
    if (index !== this.stepIndex()) this.stepIndex.set(index);
    this.progressRestored.emit({ progress, index, reason });

    // ★★ THE RECORD FOLLOWS WHAT IS HAPPENING NOW. The host is showing the
    //    tour — it set `[active]` knowing the status, which is what the event
    //    above is for — so the stored `completed` or `dismissed` is history.
    //    Leaving it would persist "completed" while the user walks through
    //    the tour, and a reload mid-way would then offer it from the top.
    if (this.active()) this._status.set('active');
  }

  /** Which step a stored progress resumes on, and why. */
  private _resolveResume(progress: SvTourProgress): {
    index: number;
    reason: SvTourResumeReason;
  } {
    if (progress.tourVersion !== this.tourVersion()) {
      return { index: 0, reason: 'version-changed' };
    }
    const policy = this.resume();
    if (policy === 'never')   return { index: this.stepIndex(), reason: 'declined' };
    if (policy === 'restart') return { index: 0, reason: 'policy' };
    if (progress.stepId === null) return { index: 0, reason: 'policy' };

    const at = this.steps().findIndex((step) => step?.id === progress.stepId);
    // ★ THIS is what an id buys over an index: a step that no longer exists is
    //   detectable, so the tour restarts and REPORTS why instead of landing on
    //   whatever now happens to sit at position 4.
    return at === -1 ? { index: 0, reason: 'step-missing' } : { index: at, reason: 'resumed' };
  }

  /** Write the current position, ticks and status. */
  private _saveProgress(key: string): void {
    const store = svLocalStorage();
    if (!store) return;
    const steps = this.steps();
    const idx   = this.resolvedStepIndex();
    const progress: SvTourProgress = {
      tourId:       this.tourId(),
      tourVersion:  this.tourVersion(),
      stepId:       steps[idx]?.id ?? null,
      // ★ CARRIED, NOT CLEARED. The checklist variant that fills this is
      //   Pro-only, so the free tier has no ticks of its own — but writing an
      //   empty array would DELETE the ticks a Pro build had stored under the
      //   same key, and "downgrade for one session, lose your checklist" is
      //   not a thing a saved record should do.
      completedIds: this._carriedCompletedIds,
      status:       this._status(),
    };
    try {
      store.setItem(key, JSON.stringify(svSerializeTourProgress(progress)));
    } catch { /* ignore quota / privacy-mode errors */ }
  }

  /**
   * `null` for absent, unparseable, or unavailable storage — a reader cannot
   * tell those apart, and none of them is a refused restore worth warning
   * about.
   */
  private _readStoredJson(key: string): unknown {
    const store = svLocalStorage();
    if (!store) return null;
    try {
      const raw = store.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  goNext(): void {
    if (!this.hasSteps()) return;
    if (this.isLastStep()) {
      this._finish();
    } else {
      this._setStep(this.resolvedStepIndex() + 1);
    }
  }

  goPrev(): void {
    if (!this.hasSteps() || this.isFirstStep()) return;
    this._setStep(this.resolvedStepIndex() - 1);
  }

  goToStep(idx: number): void {
    if (!this.hasSteps()) return;
    this._setStep(Math.max(0, Math.min(idx, this.steps().length - 1)));
  }

  skipTour(): void {
    // ★ Dismissed, not completed — and they are different facts, which is why
    //   the record has three states rather than a boolean. A user who skipped
    //   a tour may well want it offered again; one who finished it will not.
    this._status.set('dismissed');
    this.active.set(false);
    this.skip.emit();
  }

  dismiss(): void {
    this._status.set('dismissed');
    this.active.set(false);
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (!this.active()) return;

    // ★★★ NOT OURS IF SOMETHING WAS OPENED OVER US. The listener is on
    //     `document`, so it fires for a keystroke aimed at a select or a
    //     dialog opened from inside the tour card — and the tour would then
    //     skip itself on the Escape meant to close that select. See `X-4`.
    if (this._stack && !this._stack.isTopmost()) return;

    // Trap Tab focus within the portalled dialog card.
    if (e.key === 'Tab') {
      const focusable = this._focusablesIn(this.portalEl);
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      // ★ The root node is read so the trap keeps working inside a shadow root.
      // The `?? document.activeElement` fallback is unreachable in practice —
      // the card is appended to `<body>`, so its root node is the document,
      // which always has an `activeElement` (`<body>` at worst) — and it is the
      // one branch this file does not cover. It stays because the cast above is
      // a claim about the root node's type, not a guarantee.
      const activeEl = (this.portalEl?.getRootNode() as Document | ShadowRoot)?.activeElement
                       ?? document.activeElement;
      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowUp':
        // ★★ ARROWS BELONG TO THE FIELD FIRST. A tour card can contain an
        //    input, and this handler is on `document`: Left/Right used to move
        //    the TOUR instead of the caret while the user was typing in it.
        if (this._targetOwnsArrows(e.target)) return;
        e.preventDefault();
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.goNext();
        else this.goPrev();
        break;
      case 'Escape':
        if (this.allowSkip()) this.skipTour();
        break;
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Does the event's target have its own use for the arrow keys?
   *
   * ★ Escape is deliberately NOT included: a user in a text field still
   *   expects Escape to dismiss the overlay around it.
   */
  private _targetOwnsArrows(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    const role = target.getAttribute('role');
    return role === 'listbox' || role === 'combobox' || role === 'menu' || role === 'slider';
  }

  ngOnDestroy(): void {
    // Destroyed while active: the effect's else-branch never runs, so a dead
    // entry would sit on the stack and hold the page inert.
    this._releaseStack();
    this._detachPortal();
  }

  // ── Private — navigation ───────────────────────────────────────────────────

  private _setStep(idx: number): void {
    this.stepIndex.set(idx);
    this.stepChange.emit(idx);
    this.portalView?.detectChanges();
  }

  private _finish(): void {
    // ★ Recorded, which is the half that was missing: without it a finished
    //   tour persisted as "active, on the last step" and the next visit
    //   offered it again. The three writes below can be in any order — the
    //   save effect runs after them and sees the settled state — so this is
    //   not a sequencing trick, and a mutation that reorders them stays green
    //   for that reason.
    this._status.set('completed');
    this.active.set(false);
    this.stepIndex.set(0);
    this.complete.emit();
  }

  // ── Private — portal ──────────────────────────────────────────────────────

  private _attachPortal(): void {
    // ★ Unreachable, kept as defence in depth: the effect that schedules this
    // only re-runs when `active` or `hasSteps` changes, and every path that
    // turns either off runs `_detachPortal` first, which nulls `portalEl`. No
    // input distinguishes this arm from its absence — an equivalent mutant, and
    // the branch this file does not cover.
    if (this.portalEl) {
      this.portalView?.detectChanges();
      return;
    }
    this._portalContext = createPortalHost({ origin: this._el.nativeElement, label: 'product-tour' });
    const el = this._portalContext.element as HTMLDivElement;
    this.portalEl = el;
    const view = this.tourTpl.createEmbeddedView({});
    this.appRef.attachView(view);
    this.portalView = view;

    // Render BEFORE the nodes reach the document: an unstyled panel inserted
    // into <body> grows the page for a tick, which queues a scroll event that
    // this component's own scroll handler then acts on. See
    // scripts/fix-portal-insertion-order.mjs.
    view.detectChanges();
    (view.rootNodes as Node[]).forEach(n => el.appendChild(n));
    this._portalContext.attach();

    // Move focus into the dialog card so keyboard / SR users land inside.
    setTimeout(() => {
      const first = this._focusableIn(this.portalEl);
      first?.focus();
    }, 30);
  }

  /** First focusable element inside the given container, if any. */
  private _focusableIn(container: HTMLElement | null): HTMLElement | null {
    if (!container) return null;
    return container.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
  }

  private _focusablesIn(container: HTMLElement | null): HTMLElement[] {
    if (!container) return [];
    return Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  private _detachPortal(): void {
    if (this.portalView) {
      this.appRef.detachView(this.portalView);
      this.portalView.destroy();
      this.portalView = null;
    }
    if (this.portalEl) {
      this._portalContext?.destroy();
      this._portalContext = null;
      this.portalEl = null;
    }
  }
}
