import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgClass, isPlatformBrowser } from '@angular/common';
import { SvIconComponent } from '@styloviz/icons';
import {
  SvSpinnerArcComponent,
  SvLiveAnnouncer,
  createAsyncAction,
  type SvDataError,
  type SvRequest,
} from '@styloviz/core';

/** The work a result page's retry performs, owned by the component. */
export type ResultRetryAction = (request: SvRequest) => unknown;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Semantic status of the outcome being reported.
 *
 * ★★ `'empty'` IS DEPRECATED (2026-09-15) — use `<sv-empty-state>` instead.
 *    It renders the same gray inbox glyph `sv-empty-state` renders by default,
 *    so the two components drew the same box two ways. The dividing line kept
 *    in `docs/anchored-surfaces-adr.md`'s sibling decision is:
 *
 *      • `sv-result`      — the OUTCOME of an action or a navigation.
 *                           `error`/`warning` take `role="alert"`, because
 *                           interrupting is correct: something the user asked
 *                           for did not happen.
 *      • `sv-empty-state` — a CONTAINER'S CONTENTS. Inline, describes a region,
 *                           and interrupting would be wrong: nothing failed.
 *
 *    `'empty'` sat on the wrong side of that line. It still works and will
 *    until the next major; it is not passed to anything new.
 *
 *    ⚠️ Note what the migration is NOT. The four templates that used
 *    `status="empty"` were all **404 pages** ("No such article"), which are
 *    outcomes, not empty containers — they moved to `status="warning"`, NOT to
 *    `sv-empty-state`. A bad URL is a failed navigation and deserves the alert
 *    role. Reach for `sv-empty-state` when a list legitimately has no rows.
 */
export type ResultStatus = 'success' | 'error' | 'warning' | 'info' | 'empty';
export type ResultSize   = 'sm' | 'md' | 'lg';

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * SvResultComponent — A structured feedback page for success, error, warning,
 * info, and empty states.
 *
 * Features:
 * - 5 semantic statuses with distinct icons and color palettes
 * - 3 sizes (sm / md / lg)
 * - ng-content slot for action buttons and extra content
 * - Dark mode ready
 * - Accessible: role="status" or role="alert" based on status
 */
@Component({
  selector: 'sv-result',
  standalone: true,
  imports: [NgClass, SvIconComponent, SvSpinnerArcComponent],
  templateUrl: './result.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvResultComponent implements AfterViewInit {
  // ── Inputs ────────────────────────────────────────────────────────────────

  /**
   * Semantic status that drives icon, colour palette and `role`. @default 'info'
   *
   * `'empty'` is **deprecated** — see `ResultStatus`. Use `<sv-empty-state>` for
   * a container with no contents, or `'warning'` for a not-found outcome.
   */
  status = input<ResultStatus>('info');

  /** Primary headline. */
  title = input<string>('');

  /** Supporting description. */
  description = input<string>('');

  /** Icon-library NAME overriding the status default. Was `iconPath`. */
  icon = input<string>('');

  /** Component size. @default 'md' */
  size = input<ResultSize>('md');

  // ── Retry (OF-16-I2 / OF-16-M1) ───────────────────────────────────────────

  /**
   * Label for a built-in retry button. `null` renders none.
   *
   * ★★★ THE RETRY WAS ALWAYS SOMEONE ELSE'S BUTTON, WHICH IS WHY IT HAD NO
   *     STATE. Actions here are slotted content, so the retry on every error
   *     result in the kit was a host `<button>` with a `(click)` — and
   *     `OF-16-I2` is the consequence: it can be pressed repeatedly, with no
   *     feedback, firing the failed request again and again. The page reports
   *     an outcome and then has nothing to say about the attempt to fix it.
   *
   * ★ Slotted actions still work and are still right for "go home" or
   *   "contact support". This is for the one action whose whole point is that
   *   it might fail again.
   *
   * @default null
   */
  retryLabel = input<string | null>(null);

  /**
   * The work the retry performs, run by the component.
   *
   * With it: repeated presses are refused (`createAsyncAction` is first-wins),
   * the button shows a spinner while the work is in flight, and a rejection is
   * rendered under it rather than disappearing. Without it, `(retry)` is
   * emitted and the pending state is the host's problem.
   *
   * @default null
   */
  retryAction = input<ResultRetryAction | null>(null);

  /** Label while the retry is in flight. @default 'Retrying…' */
  retryPendingLabel = input<string>('Retrying…');

  /**
   * The host's own retry is in flight — for a host that listens to `(retry)`
   * instead of passing `[retryAction]` (`OF-16-I2`). @default false
   *
   * ★★ WITHOUT IT, THE EMIT-ONLY RETRY HAD NO PENDING STATE AT ALL: the host
   *    owned the request, the component owned the button, and nothing joined
   *    them — so the one button this component exists to protect could still
   *    be pressed again and again while the host's request was running. Bound
   *    here, it gets the same spinner, label, `aria-busy`, disabled state and
   *    refusal of a second press that `[retryAction]` gets.
   */
  retryPending = input<boolean>(false);

  // ── Diagnostics (`OF-16-I1`, `OF-16-M2`, `OF-16-M3`) ──────────────────────

  /**
   * The error being reported, for its diagnostics.
   *
   * ★★★ AN ERROR PAGE WITH NO DIAGNOSTICS IS AN UNSUPPORTABLE TICKET. "It said
   *     something went wrong" is unanswerable: nobody can find the request.
   *     The status, the code and above all the server's correlation id are
   *     already on `SvDataError` — this input is what puts them on screen,
   *     where the user can read them out or copy them.
   *
   * ★★ THE `cause` IS NEVER RENDERED, and that is not an oversight. It is a
   *    raw thrown value — a stack trace, a response body, sometimes a token in
   *    a URL — and an error page is a screen users photograph and paste into
   *    chat. `message`, `status`, `code` and `reference` are the four fields
   *    that are safe to show and sufficient to find the request in a log.
   */
  error = input<SvDataError | null>(null);

  /**
   * Label for the copy button beside the reference. `null` renders none.
   * @default 'Copy'
   *
   * ★ A reference nobody can copy is a reference typed out by hand, wrongly,
   *   into a support form.
   */
  copyLabel = input<string | null>('Copy');

  /** Confirmation shown in place of `copyLabel` after a copy. @default 'Copied' */
  copiedLabel = input<string>('Copied');

  /** Heading for the collapsed technical block. @default 'Technical details' */
  detailsLabel = input<string>('Technical details');

  /**
   * Show the status/code block. @default false
   *
   * ★★ COLLAPSED AND OPT-IN, because the reference is the part that matters to
   *    the user and an HTTP status on a customer-facing page is noise at best.
   *    The reference renders whenever there is one; this is for the surfaces
   *    where an engineer is the reader — an internal tool, a staging build.
   */
  showDetails = input<boolean>(false);

  /**
   * Move focus to the heading when this page appears. @default false
   *
   * ★★★ A ROUTED ERROR PAGE IS A NAVIGATION THAT LEAVES FOCUS BEHIND. The SPA
   *     swapped the view; focus is still on whatever the user clicked — often
   *     an element that no longer exists, in which case it fell to `<body>` —
   *     so a screen-reader user hears nothing and a keyboard user's next Tab
   *     starts at the top of the page. This is the standard route-announcement
   *     fix: a focusable heading, focused once, as the page arrives.
   *
   * ★ Opt-in because `sv-result` is also used INLINE — in a panel, beside a
   *   table — and stealing focus there interrupts something the user is doing
   *   for a region they have not looked at yet.
   */
  focusHeading = input<boolean>(false);

  /** The retry button was pressed. Always emitted, action or not. */
  readonly retry = output<void>();

  /** The `[retryAction]` rejected. The message is rendered under the button. */
  readonly retryFailed = output<void>();

  private readonly _task = createAsyncAction({ destroyRef: inject(DestroyRef) });

  constructor() {
    // ★ The "Copied" timer outliving the page would set a signal on a
    //   destroyed component — harmless today, and the shape that becomes a
    //   leak the moment anything else hangs off it.
    inject(DestroyRef).onDestroy(() => {
      if (this._copiedTimer) clearTimeout(this._copiedTimer);
      this._copiedTimer = null;
    });

    // ★★★ AN EFFECT, NOT `ngAfterViewInit`. A routed result page very often
    //     learns its title AFTER the first render — from a resolver's error,
    //     from a fetch that failed — and a one-shot hook ran while there was
    //     no heading yet, so focus stayed wherever it was. The effect focuses
    //     the first time a target exists, once per page.
    //
    // ★★ `tabindex="-1"` IS SET IN THE TEMPLATE, NOT HERE. A heading is not
    //    focusable by default, and focusing an unfocusable element is a silent
    //    no-op. `-1` rather than `0` so it is not a permanent tab stop.
    effect(() => this._moveFocus());
  }

  /**
   * One step of the arrival focus. Idempotent: it does nothing once the
   * heading has been focused, so the effect and the deprecated
   * `ngAfterViewInit` can both call it.
   *
   * ★★★ THE ROOT HOLDS FOCUS UNTIL THE HEADING TAKES IT. A page that arrives
   *     before its title focuses its root; when the title lands, the root's
   *     `tabindex` used to be removed in the same render — while the root held
   *     focus — so focus fell to `<body>` and the heading was never focused.
   *     The root now stays focusable (`rootFocusable`) until the hand-over, and
   *     the hand-over only happens if focus is still on the root: a user who
   *     has already moved on is not pulled back.
   */
  private _moveFocus(): void {
    if (!this.focusHeading() || this._focusPhase === 'done') return;
    // ★ SSR: nothing to focus during a prerender.
    if (!isPlatformBrowser(this._platformId)) return;
    const heading = this._heading()?.nativeElement ?? null;
    const root = this._root()?.nativeElement ?? null;

    if (heading) {
      const fromRoot = this._focusPhase === 'root';
      this._focusPhase = 'done';
      afterNextRender(() => {
        if (!fromRoot || document.activeElement === root) heading.focus();
        this._rootFocusable.set(false);
      }, { injector: this._injector });
      return;
    }

    if (this._focusPhase === 'waiting' && this.focusRootInstead() && root) {
      this._focusPhase = 'root';
      this._rootFocusable.set(true);
      afterNextRender(() => root.focus(), { injector: this._injector });
    }
  }

  /**
   * Runs the arrival focus now, if it is still owed.
   *
   * @deprecated Kept so the public member list is unchanged; the focus now
   * runs from an effect, because a title that arrives after the first render
   * was missed by a one-shot lifecycle hook. Calling it by hand still does what
   * it always did — focus the heading when `focusHeading` is on — and is a
   * no-op once that has happened.
   */
  ngAfterViewInit(): void {
    this._moveFocus();
  }

  /** True while a retry is in flight — the component's own or the host's. */
  readonly retrying = computed<boolean>(() => this._task.pending() || this.retryPending());

  /** The last retry failure, or `null`. */
  readonly retryError = this._task.error;

  /** True when the built-in retry button should render. */
  readonly retryOffered = computed<boolean>(() => this.retryLabel() !== null);

  /** The button's current label. */
  readonly retryButtonLabel = computed<string>(() =>
    this.retrying() ? this.retryPendingLabel() : (this.retryLabel() ?? ''),
  );

  /** Bound to the retry button. */
  async requestRetry(): Promise<void> {
    const action = this.retryAction();
    // ★ Refused while the HOST'S retry is running, too (`retryPending`).
    if (this.retryPending()) return;
    if (!action) { this.retry.emit(); return; }

    // ★ The event first, then the work: a host listening to `(retry)` for
    //   analytics should hear about the press that was accepted, and only
    //   that one — `run()` refuses a second while the first is in flight, and
    //   an event for a press that did nothing would be a lie.
    if (this._task.pending()) return;
    this.retry.emit();
    const outcome = await this._task.run(action);
    if (outcome === 'failed') this.retryFailed.emit();
  }

  // ── Diagnostics state ─────────────────────────────────────────────────────

  private readonly _platformId = inject(PLATFORM_ID);
  private readonly _injector = inject(Injector);
  private readonly _heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly _root = viewChild<ElementRef<HTMLElement>>('root');

  /** True for a short while after the reference is copied. */
  readonly copied = signal(false);
  private _copiedTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * The kit's one voice (`X-9`). The copy confirmation used to be a private
   * `aria-live` span — one more uncoordinated region, and one that spoke the
   * empty string back into itself when the label reverted.
   */
  private readonly _live = inject(SvLiveAnnouncer).scoped();

  /**
   * The failure the diagnostics describe: the latest retry's, else `[error]`.
   *
   * ★★★ A FAILED RETRY IS A NEW REQUEST WITH ITS OWN CORRELATION ID. Showing
   *     the original `[error]`'s reference under a retry that failed again
   *     hands support the id of the wrong request — the user copies it, and
   *     the log query finds a failure from before the one they are reporting.
   *     A retry failure with no reference of its own falls back to `[error]`'s,
   *     which is still the best id there is.
   */
  private readonly _diagnosed = computed<SvDataError | null>(() => this._task.error() ?? this.error());

  /** The server's correlation id, when the error carries one. */
  readonly reference = computed<string | null>(() =>
    this._task.error()?.reference ?? this.error()?.reference ?? null,
  );

  /**
   * The status/code pairs worth showing, as label + value.
   *
   * ★ Built here rather than in the template so "which fields are safe to
   *   render" is one list in one place — the next surface that wants
   *   diagnostics copies this, not a set of `@if`s.
   */
  readonly detailRows = computed<readonly { label: string; value: string }[]>(() => {
    const err = this._diagnosed();
    if (!err) return [];
    const rows: { label: string; value: string }[] = [];
    if (err.status !== undefined) rows.push({ label: 'Status', value: String(err.status) });
    if (err.code) rows.push({ label: 'Code', value: err.code });
    return rows;
  });

  /** Whether the collapsed technical block has anything in it. */
  readonly detailsOffered = computed<boolean>(
    () => this.showDetails() && this.detailRows().length > 0,
  );

  readonly copyButtonLabel = computed<string>(() =>
    this.copied() ? this.copiedLabel() : (this.copyLabel() ?? ''),
  );

  /**
   * The element `focusHeading` focuses: the heading, or — with no title — the
   * page's own root, which then carries `tabindex="-1"` instead.
   *
   * ★★ A RESULT WITH NO TITLE USED TO SWALLOW THE OPTION SILENTLY: there was no
   *    `<h2>` to focus, so `[focusHeading]="true"` did nothing and the arrival
   *    was not announced — the exact failure the input exists to prevent.
   */
  readonly focusRootInstead = computed<boolean>(() => this.focusHeading() && !this.title());

  /** Where the arrival focus has got to: nothing yet, parked on the root, or done. */
  private _focusPhase: 'waiting' | 'root' | 'done' = 'waiting';

  private readonly _rootFocusable = signal(false);

  /** True while the root carries `tabindex="-1"` for the arrival focus. */
  readonly rootFocusable = this._rootFocusable.asReadonly();


  /**
   * Copy the reference.
   *
   * ★★ THE CONFIRMATION IS THE POINT, not the clipboard call. A copy button
   *    that looks identical before and after is a button people press three
   *    times and then type the id by hand anyway.
   *
   * ★ `navigator.clipboard` is absent in non-secure contexts and in older
   *   browsers, and it rejects when the document is not focused. All three end
   *   the same way: no confirmation, and the reference is still on screen to
   *   read out — which is why there is no error state here.
   */
  async copyReference(): Promise<void> {
    const value = this.reference();
    if (!value) return;
    // ★★★ NOTE WHAT IS MISSING: `?.` ON `clipboard`. The first version of this
    //     was `await navigator.clipboard?.writeText(value)`, and with no
    //     clipboard API that optional chain returns `undefined` rather than
    //     throwing — so it fell straight through to the confirmation and said
    //     "Copied" on a browser that had copied nothing. Reaching for the
    //     property unguarded makes the missing-API case a TypeError, which is
    //     the same path as a rejection and is the honest one: no confirmation.
    //
    // ★ An explicit `typeof writeText === 'function'` guard was written here
    //   as well, and deleted: no mutation could tell it from its absence,
    //   because the `catch` below already answers that case identically.
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    this.copied.set(true);
    // `force`: a second copy is a second confirmation the user asked for.
    this._live.announce(this.copiedLabel(), { force: true });
    if (this._copiedTimer) clearTimeout(this._copiedTimer);
    this._copiedTimer = setTimeout(() => {
      this._copiedTimer = null;
      this.copied.set(false);
    }, 2000);
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  readonly role = computed(() =>
    this.status() === 'error' || this.status() === 'warning' ? 'alert' : 'status'
  );

  readonly iconContainerClass = computed<string>(() => {
    const map: Record<ResultStatus, string> = {
      success: 'bg-accent-50 dark:bg-accent-950/40 ring-1 ring-accent-100 dark:ring-accent-900/50',
      error:   'bg-danger-50 dark:bg-danger-950/40 ring-1 ring-danger-100 dark:ring-danger-900/50',
      warning: 'bg-warning-50 dark:bg-warning-950/40 ring-1 ring-warning-100 dark:ring-warning-900/50',
      info:    'bg-info-50 dark:bg-info-950/40 ring-1 ring-info-100 dark:ring-info-900/50',
      empty:   'bg-gray-50 dark:bg-gray-800/60 ring-1 ring-gray-100 dark:ring-gray-700/50',
    };
    const sz: Record<ResultSize, string> = { sm: 'h-14 w-14', md: 'h-20 w-20', lg: 'h-28 w-28' };
    return `${map[this.status()]} ${sz[this.size()]} rounded-full flex items-center justify-center`;
  });

  readonly iconClass = computed<string>(() => {
    const map: Record<ResultStatus, string> = {
      success: 'text-accent-500',
      error:   'text-danger-500',
      warning: 'text-warning-500',
      info:    'text-info-500',
      empty:   'text-gray-500 dark:text-gray-400',
    };
    const sz: Record<ResultSize, string> = { sm: 'h-7 w-7', md: 'h-10 w-10', lg: 'h-14 w-14' };
    return `${map[this.status()]} ${sz[this.size()]}`;
  });

  /** Status → icon-library NAME (was five hand-copied `d` strings). */
  readonly defaultIconName = computed<string>(() => {
    const map: Record<ResultStatus, string> = {
      success: 'check-circle',
      error:   'x-circle',
      warning: 'alert-triangle',
      info:    'info',
      empty:   'inbox',
    };
    return map[this.status()];
  });

  readonly resolvedIconName = computed<string>(() =>
    this.icon() || this.defaultIconName()
  );

  readonly titleClass = computed<string>(() => {
    const sz: Record<ResultSize, string> = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };
    return `font-bold tracking-tight text-gray-900 dark:text-white ${sz[this.size()]}`;
  });

  readonly descriptionClass = computed<string>(() => {
    const sz: Record<ResultSize, string> = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };
    return `text-gray-500 dark:text-gray-400 leading-relaxed max-w-md ${sz[this.size()]}`;
  });

  readonly containerPadding = computed<string>(() => {
    const sz: Record<ResultSize, string> = { sm: 'py-8 px-6', md: 'py-12 px-8', lg: 'py-16 px-10' };
    return sz[this.size()];
  });
}
