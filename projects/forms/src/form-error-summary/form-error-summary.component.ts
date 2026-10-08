import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SvLiveAnnouncer, svUniqueId } from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';

// ─── Types ────────────────────────────────────────────────────────────────────

/** One invalid field, as the summary needs to describe it. */
export interface SvFormError {
  /**
   * `id` of the control to focus — the same id the field's own `<label for>`
   * points at.
   *
   * If it names an element that is not focusable (a `<fieldset>`, a wrapper),
   * the first focusable descendant is used instead: a required radio group's
   * error belongs to the group, and the group is not a tab stop.
   *
   * ★★★ OMIT IT FOR A PROBLEM THAT IS NOT A FIELD'S (`N-3`). "Your session
   *     expired", "that card was declined", "this form has already been
   *     submitted" — a submission-level rejection has no control to focus, and
   *     while this property was required a host had exactly two options: leave
   *     the error out of the summary, so the form refuses to submit with
   *     nothing on screen explaining why, or invent an id, so the entry becomes
   *     a link that reports "(could not jump to this field)" and tells the user
   *     the page is broken on top of the error they already have. An entry with
   *     no `fieldId` renders as text rather than a link, counts toward the
   *     heading, and never attempts a jump.
   */
  readonly fieldId?: string;
  /**
   * The field's label, worded exactly as the user sees it above the field.
   *
   * ★ Not a key, not a path. `contact.email` tells a reader nothing about which
   * of the two email fields on the page is wrong, and a summary that cannot be
   * matched to a field by eye is a list of complaints rather than a way in.
   *
   * For an entry with no {@link fieldId} this is the subject rather than a
   * label — "Payment", "Session" — and the message carries the detail.
   */
  readonly label: string;
  /** What is wrong with it, in the same words the field itself shows. */
  readonly message: string;
  /**
   * Optional id of whatever contains the field and may be hiding it — an
   * accordion panel, a wizard step, a tab.
   *
   * The summary never opens it itself. It is passed straight back on
   * `(errorActivated)`, because only the host knows what "open" means for its
   * own container, and a component that guessed would be wrong for the first
   * host that used a different one.
   */
  readonly groupId?: string;
}

/** Why a summary link could not reach its field. */
export type SvFormErrorReachFailure = 'not-found' | 'not-focusable';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * FormErrorSummary — the list of what is wrong, at the top of the form, with a
 * way into each one.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * A long form fails validation and the user is told so beside each field. That
 * is fine right up until a field they cannot see is the one that is wrong: an
 * accordion group they collapsed, a wizard step they have moved past, a control
 * whose panel is portalled to `<body>`. The form refuses to submit, nothing
 * visible on screen looks wrong, and there is no way to find out why. That is
 * `FI-11-I1`, and it is not a styling problem — the information genuinely is
 * not reachable.
 *
 * It is also a documented WCAG technique (G139, and the error-identification
 * half of 3.3.1), so it turns an accessibility obligation into a feature.
 *
 * ── Three decisions worth knowing ───────────────────────────────────────────
 *
 * **1. It is a focusable region, not a `role="alert"`.** An alert interrupts
 * whatever the reader is doing, and this list changes on every submit — an
 * alert would re-announce the whole thing each time, over the top of the field
 * they had just reached. Instead the host moves focus here on submit
 * ({@link focusSummary}, or `autoFocus`), which announces the heading and the
 * count once, in a place the reader can then read at their own pace and Tab
 * through.
 *
 * **2. The links are buttons, not `href="#field-id"`.** An anchor can only
 * reach an element that is in the DOM, and the entire point of this component
 * is the fields that are not: a collapsed group renders nothing, a wizard step
 * that is not current renders nothing. So activating an entry emits
 * `(errorActivated)` first — the host's chance to open the group or change the
 * step — and the focus attempt happens on the next frame, after that has had a
 * chance to render.
 *
 * **3. It says when it could not get there.** A summary entry that silently
 * does nothing is worse than no summary at all: the user has now been told
 * where the problem is AND that they cannot go to it, and they have no way to
 * tell a broken link from a field that is simply off-screen. If the id resolves
 * to nothing after the reveal, `(reachFailed)` fires and the entry is marked —
 * which is also the loudest possible signal to the host that a `fieldId` is
 * wrong.
 *
 * @example
 * ```html
 * <sv-form-error-summary
 *   [errors]="errors()"
 *   (errorActivated)="openGroupFor($event)" />
 * ```
 * ```ts
 * readonly errors = computed<SvFormError[]>(() =>
 *   this.form.invalid && this.submitted()
 *     ? [{ fieldId: 'email', label: 'Email address', message: 'Enter a valid email', groupId: 'contact' }]
 *     : [],
 * );
 *
 * openGroupFor(e: SvFormError): void {
 *   if (e.groupId) this.expanded.update((s) => new Set(s).add(e.groupId!));
 * }
 * ```
 */
@Component({
  selector: 'sv-form-error-summary',
  standalone: true,
  imports: [SvIconComponent],
  templateUrl: './form-error-summary.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvFormErrorSummaryComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // ── Inputs ────────────────────────────────────────────────────────────────

  /**
   * Every invalid field, in the order they appear in the form.
   *
   * ★ Reading order, not validation order. The list is a map of the page, and a
   * map whose entries are in the order the validators happened to run is a map
   * the reader cannot follow.
   *
   * Pass an empty array while the form is untouched: a summary that appears
   * before the user has attempted anything tells them they have made mistakes
   * they have not yet had the chance to make.
   * @default []
   */
  readonly errors = input<readonly SvFormError[]>([]);

  /**
   * The heading above the list. `{n}` is replaced with the number of problems.
   * @default 'There is a problem' / 'There are {n} problems'
   */
  readonly heading = input<string>('');

  /**
   * Heading level, so the summary sits correctly in the page outline.
   *
   * ★ It renders a real `<h2>`–`<h4>`, not a styled `<div>`. A screen-reader
   * user navigating by heading is the reader most likely to be looking for
   * this, and a `<div>` with big text is invisible to that.
   * @default 2
   */
  readonly headingLevel = input<2 | 3 | 4>(2);

  /**
   * Move focus here when the summary appears — that is, when the error list
   * goes from empty to non-empty.
   *
   * ⚠️ **A second failed submit with the same errors is not a transition**, so
   * this will not fire for it, and the user is left where they were with no
   * indication anything happened. Call {@link focusSummary} from your submit
   * handler for that case; it is the reliable half of this pair, and `autoFocus`
   * is the one that means you usually do not have to remember.
   * @default true
   */
  readonly autoFocus = input(true, { transform: booleanAttribute });

  /**
   * The list is being rechecked — an async validator or a server round-trip is
   * in flight (`N-3`).
   *
   * ★★★ WHAT IS ON SCREEN DURING A SERVER SUBMIT IS THE LAST ATTEMPT'S VERDICT,
   *     and a summary that asserts it while the answer is being recomputed is
   *     stating something it does not currently know. This marks it as such:
   *     `aria-busy`, a visible note, and — the part that matters most — every
   *     announcement is HELD rather than skipped, so the reader hears the
   *     outcome of the recheck instead of a count that was already obsolete
   *     when it was spoken.
   *
   * @default false
   */
  readonly busy = input(false, { transform: booleanAttribute });

  /** The note shown while {@link busy}. @default 'Rechecking…' */
  readonly busyMessage = input<string>('Rechecking…');

  /** Extra classes on the root region. @default '' */
  readonly customClass = input<string>('');

  // ── Outputs ───────────────────────────────────────────────────────────────

  /**
   * An entry was activated. Emitted **before** the focus attempt, so a host can
   * open the accordion group, switch the wizard step or select the tab that
   * contains the field.
   */
  readonly errorActivated = output<SvFormError>();

  /**
   * The field could not be reached even after `(errorActivated)` had a frame to
   * reveal it — `'not-found'` when nothing has that id, `'not-focusable'` when
   * something does but neither it nor anything inside it can take focus.
   *
   * Almost always a wrong `fieldId`. Worth logging.
   */
  readonly reachFailed = output<{ error: SvFormError; reason: SvFormErrorReachFailure }>();

  // ── Internals ─────────────────────────────────────────────────────────────

  private readonly region = viewChild<ElementRef<HTMLElement>>('region');

  /**
   * ★★ ONE VOICE, AND IT IS THE SHARED ONE (`X-9`). This component is
   *    deliberately not a live region — see the class note — so a list that
   *    changes while the reader is elsewhere on the page would otherwise be a
   *    silent change. It speaks through the announcer instead, under a key, so
   *    a burst of updates supersedes itself rather than queueing a backlog of
   *    counts the user has already passed.
   */
  private readonly _live = inject(SvLiveAnnouncer).scoped();

  /** Every summary shares it: two on one page are one voice, not two. */
  private static readonly ANNOUNCE_KEY = 'sv-form-error-summary';

  /** Long enough that a burst of async validators lands as one sentence. */
  private static readonly ANNOUNCE_THROTTLE_MS = 500;

  protected readonly headingId = svUniqueId('sv-form-error-summary');

  /** Ids of entries whose field could not be reached, so the list can say so. */
  protected readonly unreachable = signal<ReadonlySet<string>>(new Set());

  protected readonly count = computed<number>(() => this.errors().length);

  protected readonly resolvedHeading = computed<string>(() => {
    const supplied = this.heading().trim();
    const n = this.count();
    if (supplied) return supplied.replace('{n}', String(n));
    return n === 1 ? 'There is a problem' : `There are ${n} problems`;
  });

  constructor() {
    // Appearance, and every change after it.
    //
    // ★ Focus moves on APPEARANCE only. Re-running it on every change would
    //   pull focus out of the field the user had just reached to fix.
    //
    // ★★ A CHANGE THE USER DID NOT CAUSE IS THE CASE THIS EXISTS FOR: a server
    //    response adds a problem to a list already on screen, and without an
    //    announcement the only person who knows is someone looking at it. The
    //    focus move is its own announcement (it reads the region's name, which
    //    is the heading and the count), so the two are exclusive — announcing
    //    as well would say the same sentence twice.
    let previousCount = 0;
    effect(() => {
      const count = this.count();
      const heading = this.resolvedHeading();

      // ★★★ HELD, NOT SKIPPED. Returning BEFORE `previousCount` is updated is
      //     the whole of the busy contract: the comparison that survives is
      //     against the list as it stood before the recheck started, so when
      //     `busy` clears the user hears the outcome — not silence, because
      //     the transition was consumed while nobody could act on it.
      if (this.busy()) return;

      const appeared = count > 0 && previousCount === 0;
      const changed = count > 0 && previousCount > 0 && count !== previousCount;
      previousCount = count;

      if (appeared && this.autoFocus()) {
        this.focusSummary();
        return;
      }
      if (appeared || changed) {
        this._live.announce(heading, {
          key: SvFormErrorSummaryComponent.ANNOUNCE_KEY,
          throttleMs: SvFormErrorSummaryComponent.ANNOUNCE_THROTTLE_MS,
        });
      }
    });

    // A field fixed in one submit and broken in the next deserves a fresh
    // verdict; keeping the old mark would show "could not reach" against an
    // entry nobody has tried.
    effect(() => {
      this.errors();
      this.unreachable.set(new Set());
    });
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  /**
   * Move focus to the summary. Call it from your submit handler — it is the
   * half of this component's focus story that works on a repeat submission.
   *
   * A no-op when there is nothing to show, so it is safe to call
   * unconditionally.
   */
  focusSummary(): void {
    if (!this.isBrowser || this.count() === 0) return;
    // The region renders in the same pass this is called from on the
    // empty → non-empty transition, so wait a frame for it to exist.
    setTimeout(() => this.region()?.nativeElement.focus());
  }

  protected activate(error: SvFormError): void {
    // The host's chance to reveal the field BEFORE anyone looks for it. An
    // anchor could not do this, which is the whole reason these are buttons.
    this.errorActivated.emit(error);
    // ★ NO `if (!error.fieldId) return;` HERE. I wrote one, and no mutation
    //   could kill it: the template renders a field-less problem as text, so
    //   nothing can activate one. Two rendering rules for one fact is how the
    //   two drift apart — the template is the rule, and `reach` below is
    //   null-safe for the type rather than for a path.
    if (!this.isBrowser) return;

    // One frame, so a group opened by the line above has rendered.
    setTimeout(() => this.reach(error));
  }

  private reach(error: SvFormError): void {
    const target = error.fieldId ? document.getElementById(error.fieldId) : null;
    if (!target) {
      this.markUnreachable(error, 'not-found');
      return;
    }

    const focusable = this.focusableWithin(target);
    if (!focusable) {
      this.markUnreachable(error, 'not-focusable');
      return;
    }

    // ★ `preventScroll`, then scroll deliberately. `focus()` scrolls the element
    // to the nearest edge on its own, so calling `scrollIntoView` after a plain
    // `focus()` is TWO scrolls — the field slides into view and then jumps
    // again, which reads as the page fighting the user. One scroll, centred, so
    // the field arrives with its label and its error message both visible.
    focusable.focus({ preventScroll: true });
    focusable.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  /**
   * The element itself if it can take focus, otherwise the first descendant
   * that can.
   *
   * A required radio group's error belongs to the `<fieldset>` — that is where
   * `aria-describedby` points, and a fieldset is not a tab stop. Sending the
   * user to the group and then leaving focus on `<body>` would be the same
   * silent nothing this component exists to prevent.
   */
  private focusableWithin(el: HTMLElement): HTMLElement | null {
    if (this.canFocus(el)) return el;
    const candidates = el.querySelectorAll<HTMLElement>(
      'input, select, textarea, button, a[href], [tabindex]:not([tabindex="-1"])',
    );
    for (const candidate of Array.from(candidates)) {
      if (this.canFocus(candidate)) return candidate;
    }
    return null;
  }

  private canFocus(el: HTMLElement): boolean {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') return false;
    if (el.tabIndex >= 0) return true;
    // `tabIndex` is -1 for a plain <div>, and also for anything explicitly
    // removed from the tab order — but an element with tabindex="-1" IS
    // programmatically focusable, which is exactly what this needs.
    return el.getAttribute('tabindex') === '-1';
  }

  private markUnreachable(error: SvFormError, reason: SvFormErrorReachFailure): void {
    if (error.fieldId) this.unreachable.update((s) => new Set(s).add(error.fieldId!));
    this.reachFailed.emit({ error, reason });
  }
}
