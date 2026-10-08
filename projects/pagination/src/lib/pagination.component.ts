import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  OnDestroy,
  output,
  untracked,
} from '@angular/core';
import { NgClass } from '@angular/common';
import {
  createAsyncAction,
  SvLiveAnnouncer,
  svNavParam,
  svNavRecorder,
  svRecoverFocus,
  svUniqueId,
  svWarnOnce,
  type SvDataError,
  type SvNavIntent,
  type SvRequest,
  type SvUnresolvedValue,
  svAttrSelector,
} from '@styloviz/core';
import { SvIconComponent } from '@styloviz/icons';
import { FormsModule } from '@angular/forms';
import { createSvCursorPager } from './cursor-pager';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaginationSize    = 'sm' | 'md' | 'lg';
export type PaginationVariant = 'default' | 'simple' | 'compact';

/**
 * How pages are addressed — `NV-04-M1`, `NV-04-I11`.
 *
 * - `'offset'` — `?page=4&pageSize=10`. Needs a total and a stable ordering, and
 *   gives numbered pages, a "Showing 21–30 of 234" summary and a Last button.
 * - `'cursor'` — keyset paging. Needs neither, and gives none of those: there is
 *   a Previous, a Next and an ordinal ("Page 4"), which is all a forward-only
 *   cursor API can honestly support. See `SvPaginationComponent`'s note on
 *   `NV-04-I11` for why the page numbers cannot simply be kept.
 */
export type SvPaginationMode = 'offset' | 'cursor';

/**
 * What happens to the user's position when the page size changes — `NV-04-I3`.
 *
 * - `'preserve-first-item'` — stay on whichever page now contains the row that
 *   was at the top of the screen. **The default.**
 * - `'reset-to-first'` — jump to page 1. The behaviour shipped before
 *   `NV-04-I3`; kept for hosts whose list is cheap to re-read from the top, or
 *   whose backend charges per offset.
 */
export type SvPageSizePolicy = 'preserve-first-item' | 'reset-to-first';

/** Which control produced a page request. Useful for analytics and for logging. */
export type SvPageRequestDirection =
  | 'first'
  | 'previous'
  | 'next'
  | 'last'
  /** A numbered page button, or a programmatic `goTo()`. */
  | 'jump'
  /** The page-size selector changed. */
  | 'resize';

/**
 * `SvPageRequestDirection` → the shared navigation vocabulary (`X-15`).
 *
 * ★★ THE ONE FAMILY WHERE THE MAPPING IS FREE. `X-15` asks every surface to
 *    say what kind of move a gesture was; Pagination already had to name the
 *    direction for `pageAction`'s request, so the intent is a lookup rather
 *    than an inference. Every other family reconstructs it from an index delta.
 *
 * ★ `resize` → `refine` is the pair that justifies having `refine` at all. The
 *   page number changes — `preserve-first-item` usually moves it — but nobody
 *   navigated: the same rows are being looked at through a different window,
 *   and counting it as a page view would inflate every list in the app.
 */
const DIRECTION_TO_INTENT: Readonly<Record<SvPageRequestDirection, SvNavIntent>> = {
  first: 'jump',
  previous: 'retreat',
  next: 'advance',
  last: 'jump',
  jump: 'jump',
  resize: 'refine',
};

/**
 * One page load, handed to `[pageAction]`.
 *
 * ★ `request` is the piece that makes `NV-04-I5` fixable rather than merely
 *   documented: pass `request.signal` to the transport and a superseded or
 *   cancelled load stops on the wire instead of arriving late and winning.
 */
export interface SvPageRequest {
  /** 1-based page ordinal being loaded. */
  readonly page: number;
  /** Rows to ask for. */
  readonly pageSize: number;
  /** Keyset cursor in `mode="cursor"`; always `null` in `mode="offset"`. */
  readonly cursor: string | null;
  /** Which control asked. */
  readonly direction: SvPageRequestDirection;
  /**
   * The guard's token and `AbortSignal` — `docs/async-contract-adr.md`. Hand
   * `signal` to `fetch`/`HttpClient`; do not call `settle()` yourself, the
   * component owns that.
   */
  readonly request: SvRequest;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Pagination — A fully-featured page navigator for tables, card grids, and lists.
 *
 * Features:
 * - Page-window with leading/trailing ellipsis (smart truncation)
 * - First / Previous / Next / Last buttons
 * - Optional page-size selector
 * - 3 variants: default (full controls) · simple (prev/next + label) · compact (minimal)
 * - 3 sizes: sm · md · lg
 * - Two-way `currentPage` binding via `model()`
 * - Optional URL synchronisation via `urlKey` (`NV-04-I7`)
 * - `pageChange` and `pageSizeChange` outputs
 * - Full dark-mode support
 * - Accessible: `aria-label`, `aria-current="page"`, disabled states
 */
@Component({
  selector: 'sv-pagination',
  standalone: true,
  imports: [NgClass, FormsModule, SvIconComponent],
  templateUrl: './pagination.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvPaginationComponent implements OnDestroy {
  private readonly host = inject(ElementRef);
  private readonly announcer = inject(SvLiveAnnouncer);

  /**
   * DOM id of the page-size `<select>`, unique per instance. ★ It was the literal
   * `page-size-select`, so two paginators on one page produced a duplicate id and
   * the second "Rows per page" label pointed at the first control.
   */
  private readonly uid = svUniqueId('sv-pagination');
  protected readonly pageSizeSelectId = `${this.uid}-page-size`;

  /**
   * One entry per page move, in the vocabulary every navigation family shares
   * (`X-15`). Consent and identifier-stripping belong to the recorder.
   *
   * ⚠️ `key` is the page NUMBER as a string, which is the one key in this kit
   *    that is never a record identifier — no row is named by "page 4". It is
   *    still stripped by a `retention: 'none'` sink, because a rule with an
   *    exception is a rule somebody has to remember.
   */
  private readonly nav = svNavRecorder('pagination', () => this.surfaceId());

  // ── Inputs ────────────────────────────────────────────────────────────────

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── `NV-04-I11`: the finding is about OFFSET PAGING, not about this code ────
   * Offset paging asks the server for "rows 71–80 of whatever matches now". It is
   * correct only while the result set holds still. On a feed, a queue or an
   * audit log it does not:
   *
   *   The user is on page 8 (rows 71–80). Two rows are inserted near the top.
   *   Everything shifts down by two. Page 9 now begins at what was row 79 — so
   *   rows 81 and 82 are never shown to anyone. Delete two rows instead and the
   *   same two rows appear on page 8 and again on page 9.
   *
   * ★ There is no version of this component that fixes that. The count and the
   *   offset are computed on the server, between two requests it does not make,
   *   against an ordering it cannot see. Anything the component "fixed" would be
   *   a guess dressed as a total. So `NV-04-I11`'s deliverable is: say so, in the
   *   README, in a dev warning the moment the drift is OBSERVABLE (see
   *   `watchTotalDrift`), and ship the mode that does not have the problem.
   *
   * ★★ `mode="cursor"` is that mode, and the reason it cannot keep the page
   *    numbers is the same reason it is correct: a keyset cursor names a ROW, not
   *    a position, so "next 10 after this row" is stable under inserts and
   *    deletes — and nobody, including the server, knows which numbered page that
   *    row is on. A paginator that rendered "4" in cursor mode would be inventing
   *    the very number the mode exists to stop relying on. It renders the ordinal
   *    "how many Nexts deep you are", which is always true. `NV-04-M1`.
   *
   * ★ `totalItems` is nullable rather than `0`-means-unknown. `0` is a real
   *   answer — "the filter matched nothing" — and the two were already conflated
   *   here: `totalPages()` returned `1` for both, and `X-10`'s reconciliation had
   *   to special-case `totalItems() > 0` to avoid rewriting every deep link. This
   *   is the widening `NV-04-M1` asked for, and it is source-compatible: every
   *   host passing a number keeps working.
   */

  /**
   * Total number of items across all pages, or `null` when the backend cannot
   * report one. `null` hides the numbered pages and the count summary — see
   * `mode`. @default 0
   */
  totalItems = input<number | null>(0);

  /**
   * `'offset'` for `?page=`-style APIs (numbered pages, needs a total),
   * `'cursor'` for keyset APIs (Previous/Next and an ordinal, needs neither).
   * @default 'offset'
   */
  mode = input<SvPaginationMode>('offset');

  /**
   * `mode="cursor"` only: the cursor the server returned for the page *after*
   * the one on screen. `null` means this is the last page, so Next disables.
   * @default null
   */
  nextCursor = input<string | null>(null);

  /**
   * Override "is there a page after this one?" — for an offset API that reports
   * no total but does know whether more rows exist (`LIMIT n + 1`). `null` lets
   * the component infer it from the total, or from `nextCursor` in cursor mode.
   * @default null
   */
  hasMore = input<boolean | null>(null);

  /**
   * True while the host is loading a page — `NV-04-M2`. Every control disables,
   * the nav is `aria-busy`, and a second press is refused rather than queued.
   * Bind this when the host owns the fetch; bind `pageAction` instead and the
   * component tracks it for you.
   * @default false
   */
  loading = input<boolean>(false);

  /**
   * A failed page load, normalized — `docs/async-contract-adr.md`. Rendered as a
   * `role="alert"` beside the controls. Unnecessary when `pageAction` is bound.
   * @default null
   */
  error = input<SvDataError | null>(null);

  /**
   * Label for the Try-again button. ★ Non-null is what RENDERS it: an output
   * cannot be asked whether anyone is listening, and a retry button that does
   * nothing is worse than none. @default null — no retry button
   */
  retryLabel = input<string | null>(null);

  /**
   * Hand the component the page load itself — `NV-04-I5`, `NV-04-M2`. It then
   * owns the sequencing: a second press while one is in flight is refused (not
   * queued, not superseded), and a response that arrives after a cancel is
   * discarded. Pass `request.signal` to your transport.
   * @default null — the host loads pages itself from `(pageChange)`
   */
  pageAction = input<((request: SvPageRequest) => unknown) | null>(null);

  /**
   * Where the user lands when the page size changes — `NV-04-I3`.
   * @default 'preserve-first-item'
   */
  pageSizeChangePolicy = input<SvPageSizePolicy>('preserve-first-item');

  /** Number of items per page. Use `[(pageSize)]` for two-way binding. */
  pageSize = model<number>(10);

  /** 1-based current page index. Use `[(currentPage)]` for two-way binding. */
  currentPage = model<number>(1);

  /**
   * Options shown in the page-size `<select>`.
   * Empty array hides the selector entirely. @default [10, 25, 50, 100]
   */
  pageSizeOptions = input<number[]>([10, 25, 50, 100]);

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   * `scripts/generate-component-docs.mjs` extracts an input's JSDoc verbatim into
   * the README's API table and into `/docs`, as ONE table cell. A multi-paragraph
   * doc comment therefore renders as a wall of prose with the box-drawing rules
   * inlined — measured: every other description in this README is 45–85
   * characters. So the consumer-facing sentence stays in the doc comment below
   * and the reasoning lives here, where a reader of the code finds it and a
   * generator does not. (And note this block is a plain `/*`, not a doc comment —
   * writing a closing-delimiter sequence inside one ends it early, which is how
   * the first draft of this very comment silently swallowed the doc below it.)
   *
   * Two opt-ins, both load-bearing. Nothing synchronises until the app provides a
   * location AND this instance names a key. The app-level opt-in exists so that
   * upgrading a package cannot start rewriting a consumer's address bar — their
   * analytics would see new URLs and their back button would gain entries they did
   * not ask for. The instance-level opt-in exists because **two paginators on one
   * page cannot both own `?page`**; a hard-coded key would make the second one a
   * collision the consumer has no way to fix.
   *
   * ★ Writes PUSH rather than replace. A reader who paged forward and pressed back
   * means "take me to the page I was on" — the one navigation in this component
   * the browser should be able to undo. Contrast `NV-02-I3`, where pushing per
   * change destroys the back button: same seam, opposite answer, which is why the
   * write mode belongs to the adoption rather than to the seam.
   *
   * The full contract, and the other six families' answers, are in
   * `docs/navigation-routing-adr.md`. `NV-04-I7`, `NV-04-M4`.
   */

  /**
   * Put the page number in the URL under this key, so a page can be shared,
   * refreshed and reached with the back button. Needs `provideSvNavLocation()` at
   * the app root; give a second paginator on the same page a different key.
   * @default null — no URL synchronisation
   */
  urlKey = input<string | null>(null);

  /**
   * Names this paginator in the shared navigation-analytics stream (`X-15`),
   * when a page has more than one. Ignored unless `provideSvNavTelemetry()` is
   * wired up.
   * @default null
   */
  surfaceId = input<string | null>(null);

  /** Visual variant. @default 'default' */
  variant = input<PaginationVariant>('default');

  /** Control size. @default 'md' */
  size = input<PaginationSize>('md');

  /** Show total-item count summary (e.g. "Showing 1–10 of 234"). @default true */
  showSummary = input<boolean>(true);

  /** Accessible label for the navigation landmark. @default 'Pagination' */
  ariaLabel = input<string>('Pagination');

  /** Additional CSS classes on the root wrapper. */
  customClass = input<string>('');

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── `NV-04-I6`: paging is the one navigation with no destination ────────────
   * A keyboard user presses Next. The rows underneath change, the page number
   * changes — and nothing tells them, because a screen reader narrates what it is
   * focused on and focus has not moved. If the host also re-renders the control,
   * focus lands on `<body>`: the top of the document, so the next Tab goes to the
   * site's first link. They paged forward and were returned to the start of the
   * page, silently.
   *
   * ── ★ Why focus stays on the button, and does not jump to the results ───────
   * The obvious policy — move focus to the first row of the new page — is wrong
   * for the common case. Paging is usually a sequence: next, next, next. Moving
   * focus into the results means Shift-Tabbing back to the control before every
   * subsequent press, so the fix makes the ordinary interaction worse. Focus is
   * therefore RESTORED to the button that was pressed, and the announcement does
   * the work the focus move would have done.
   *
   * If the pressed button is gone — Next disabled on the last page — the policy
   * falls back to the other direction, then the nav landmark, so focus never
   * reaches `<body>`. That is `X-14`'s rule, and the fallback is why the landmark
   * is the last entry rather than nothing.
   *
   * ── `scrollToTop` is off by default, and that is the honest default ─────────
   * Whether the list starts at the top of the viewport depends on the host's
   * layout, which this component cannot see. Scrolling a paginator embedded in a
   * card would yank the page for no reason. `NV-04-M5`.
   *
   * ★ And the paginator is not the results. It usually sits BELOW the list, so
   *   scrolling the paginator itself into view — the only element it can see —
   *   lands the user at the bottom of the new page, not the top. `scrollTarget`
   *   names the element that actually starts the results; the host is only the
   *   fallback for a paginator rendered above its list.
   */

  /**
   * Scroll back to the top of the results after a page change. Leave it off when
   * the paginator is inside a card or a scroll container of its own.
   * @default false
   */
  scrollToTop = input<boolean>(false);

  /**
   * With `scrollToTop`, the element to bring into view — usually the top of the
   * results list. `null` scrolls the paginator itself into view.
   * @default null
   */
  scrollTarget = input<HTMLElement | null>(null);

  // ── Outputs ───────────────────────────────────────────────────────────────

  /** Emitted when the user navigates to a different page. */
  pageChange = output<number>();

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── `X-10`: a page number is ORDINAL, so this component corrects it ─────────
   * Page 7 of 3 has a nearest valid value, and it is obviously 3. That is what
   * separates this family from `sv-tabs`, whose `activeId` is a NAME: `"xyz"` has
   * no nearest tab, and picking one is a guess about what the host meant. So
   * Pagination corrects and Tabs reports, and the two behaviours already in the
   * tree turn out not to have been inconsistent — nobody had written down which
   * question each was answering.
   *
   * ── ★ …but only once `totalItems` has ARRIVED ───────────────────────────────
   * `totalItems` is `0` until the first response lands, so `totalPages()` is `1`
   * and a correction made then turns every deep link into page 1 **before the
   * data that justified page 4 exists**. The link appears to work and lands on
   * the wrong page, which is the worst available outcome. While the total is
   * still unknown the page is held verbatim and this output says so, with
   * `reason: 'not-loaded'` and `corrected: false`.
   *
   * ★ "Arrived" is remembered, not re-derived from the current value. Once any
   *   non-zero total has been seen, a later `0` is an ANSWER — the filter matched
   *   nothing — and page 7 of an empty list clamps to 1 with `out-of-range`.
   *   Treating that `0` as "not loaded" held the user on a page that no longer
   *   exists, reported as a wait that would never end (`NV-04-I2`).
   *
   * This is the same rule `svNavParam`'s reader follows, and the same one
   * `sv-tabs` and `sv-accordion` follow: an empty collection is not evidence
   * that a value is wrong, it is an absence.
   *
   * ── `NV-04-M3` asked for "clamp to the last valid page AND TELL THE USER" ───
   * The clamp is here; the telling is this output rather than a built-in banner.
   * A component that rendered its own "page 7 does not exist" notice would be
   * guessing at the host's tone, its copy, its i18n and its layout — and the host
   * may well prefer to redirect, refetch with a corrected query, or show a 404.
   * What it cannot do is find out, which is the part that was missing.
   */

  /**
   * Emitted when `currentPage` names a page that does not exist — `X-10`,
   * `NV-04-I2`, `NV-04-M3`. Carries what was asked for, what is shown instead,
   * why, and whether `currentPage` was corrected.
   */
  unresolved = output<SvUnresolvedValue<number>>();

  /**
   * `mode="cursor"` only: the cursor of the page now on screen (`null` for the
   * first page). Fetch with this; hand the response's next cursor back through
   * `[nextCursor]`.
   */
  cursorChange = output<string | null>();

  /**
   * The Try-again button was pressed and no `pageAction` is bound, so the host
   * owns the retry. Only fires when `retryLabel` is set.
   */
  retryRequested = output<void>();

  /** A `pageAction` rejected. Already normalized; also readable as `activeError()`. */
  loadFailed = output<SvDataError>();

  // Note: `pageSize = model<number>(10)` already auto-emits `pageSizeChange`
  // when pageSize.set() is called — no separate output needed here.

  // ── The cursor trail and the load ─────────────────────────────────────────

  /**
   * Remembered cursors, so Previous works against a forward-only API. Public so
   * a host can project the trail into a URL or restore it — `NV-04-M1`.
   */
  readonly pager = createSvCursorPager();

  /**
   * The page load, when `pageAction` is bound. First-wins, normalized error,
   * `canRetry` gated on `SvDataError.retryable` — `docs/async-contract-adr.md`.
   *
   * ★ `NV-04-I5` AND `NV-04-M2` ARE ONE MECHANISM, WHICH IS WHY THERE IS ONE
   *   OBJECT HERE. The double request and the missing pending state are not two
   *   bugs: nothing knew a load was in flight, so nothing could disable the
   *   control (`M2`) and nothing could discard the loser (`I5`). Give the
   *   component the request and both fall out — `pending` drives `[disabled]`
   *   and `aria-busy`, and first-wins means the second press never starts a
   *   second load to race with.
   */
  private readonly load = createAsyncAction({ destroyRef: inject(DestroyRef) });

  // ── Computed ──────────────────────────────────────────────────────────────

  /** Cursor mode has no numbered pages and no Last button, by construction. */
  readonly isCursorMode = computed(() => this.mode() === 'cursor');

  /**
   * Whether a count exists that numbered pages can be built from. False in
   * cursor mode and whenever `totalItems` is `null` — `NV-04-M1`.
   */
  readonly hasStableTotal = computed(() => !this.isCursorMode() && this.totalItems() !== null);

  /** Items across all pages, or `0` when unknown — for templates that need a number. */
  readonly itemCount = computed(() => this.totalItems() ?? 0);

  /**
   * Last page number, or `null` when there is no total to derive one from.
   *
   * ⚠️ WIDENED BY `NV-04-M1` from `number`. It used to return `1` for an unknown
   * total, which is the defect: `goTo(4)` clamped to 1 before the data that
   * justified page 4 existed, so a paginator with no count could not leave the
   * first page at all.
   */
  totalPages = computed<number | null>(() => {
    if (!this.hasStableTotal()) return null;
    return Math.max(1, Math.ceil(this.itemCount() / this.pageSize()));
  });

  /** First item index (1-based) on the current page. */
  rangeStart = computed(() => {
    const first = (this.currentPage() - 1) * this.pageSize() + 1;
    return this.hasStableTotal() ? Math.min(first, this.itemCount()) : first;
  });

  /** Last item index (1-based) on the current page. */
  rangeEnd = computed(() => {
    const last = this.currentPage() * this.pageSize();
    return this.hasStableTotal() ? Math.min(last, this.itemCount()) : last;
  });

  hasPrev = computed(() =>
    this.isCursorMode() ? this.pager.hasPrevious() : this.currentPage() > 1,
  );

  /**
   * Whether a page exists after the one on screen. Three sources, in order:
   * the host's explicit `hasMore`, the cursor, then the total. ★ Without the
   * first, `mode="offset"` with an unknown total renders a Next that can never
   * enable — a dead control, which is worse than one more input.
   */
  hasNext = computed(() => {
    const explicit = this.hasMore();
    if (explicit !== null) return explicit;
    if (this.isCursorMode()) return this.nextCursor() !== null;
    const last = this.totalPages();
    return last === null ? false : this.currentPage() < last;
  });

  // ── Pending / error surface (`NV-04-M2`) ──────────────────────────────────

  /**
   * A load is in flight. ★ The OR is deliberate and is not two sources of truth:
   * a host binds `loading` (it owns the fetch) or `pageAction` (the component
   * does), never both — and if it does bind both, "busy if either says so" is
   * the only answer that cannot leave a control enabled during a request.
   */
  readonly busy = computed(() => this.loading() || this.load.pending());

  /** The error to render: the host's, or the one `pageAction` produced. */
  readonly activeError = computed<SvDataError | null>(() => this.error() ?? this.load.error());

  /** Show Try again only when it is named AND retrying could plausibly work. */
  readonly canRetry = computed(() => {
    if (this.retryLabel() === null) return false;
    const e = this.activeError();
    return e !== null && e.retryable !== false;
  });

  readonly prevDisabled = computed(() => !this.hasPrev() || this.busy());
  readonly nextDisabled = computed(() => !this.hasNext() || this.busy());

  /** "Page 4 of 12", or "Page 4" when there is no total to be of. */
  readonly positionLabel = computed(() => {
    const total = this.totalPages();
    const page = this.currentPage();
    return total === null ? `Page ${page}` : `Page ${page} of ${total}`;
  });

  /**
   * Visible page numbers in the page window, with -1 as an ellipsis marker.
   * Always shows: first, last, currentPage ±1, with ellipsis for gaps > 1.
   */
  pageWindow = computed<number[]>(() => {
    const total   = this.totalPages();
    const current = this.currentPage();

    // No total, no numbered pages — the template renders Previous/Next instead.
    if (total === null) return [];

    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: number[] = [];
    const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };

    add(1);
    if (current > 3)       pages.push(-1); // left ellipsis
    for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) add(p);
    if (current < total - 2) pages.push(-1); // right ellipsis
    add(total);

    return pages;
  });

  // ── Size maps ─────────────────────────────────────────────────────────────

  btnClass = computed<string>(() => {
    const s = this.size();
    return {
      sm: 'h-7 min-w-7 px-1.5 text-xs',
      md: 'h-8 min-w-8 px-2 text-sm',
      lg: 'h-10 min-w-10 px-3 text-sm',
    }[s];
  });

  textClass = computed<string>(() => ({
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-sm',
  })[this.size()]);

  // ── Page button class helper ───────────────────────────────────────────────

  pageButtonClass(page: number): string {
    const isActive = page === this.currentPage();
    const base = [
      'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-100',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
      this.btnClass(),
    ];
    if (isActive) {
      base.push('bg-primary-600 text-white');
    } else {
      base.push('text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700');
    }
    return base.join(' ');
  }

  navButtonClass(disabled: boolean): string {
    return [
      'inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-100',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1',
      this.btnClass(),
      disabled
        ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
    ].join(' ');
  }

  // ── Controlled-value reconciliation (`X-10`) ──────────────────────────────

  /** The last state reported through `unresolved`, so it is not re-emitted every pass. */
  private lastUnresolved: string | null = null;

  /**
   * A non-zero total has been reported at least once, so a load has happened and
   * a later `0` means "empty", not "not yet" — see the note on `unresolved`.
   */
  private totalArrived = false;

  /**
   * Reconcile `currentPage` against a total that may shrink under it.
   *
   * `goTo()` already clamps, so *interaction* cannot overshoot — the unhandled
   * case `NV-04-I2` names is reactive: `totalItems` drops (a filter is applied, a
   * row is deleted) while the host holds page 7.
   */
  protected readonly reconcilePage = effect(() => {
    const requested = this.currentPage();
    const last = this.totalPages();
    const count = this.itemCount();

    untracked(() => {
      if (count > 0) this.totalArrived = true;
      // `null` is "no total was reported" and holds the page verbatim. `0` holds
      // it too, but only BEFORE any total has arrived — until then it is the
      // placeholder, not an answer. After, it is "the filter matched nothing",
      // and the page clamps to 1. See the note on `unresolved`.
      const loaded = last !== null && (count > 0 || this.totalArrived);

      // ★ Nothing to reconcile in cursor mode: the ordinal is produced BY the
      //   trail, so it cannot name a page that does not exist — and reporting
      //   `not-loaded` on every Next (there is no total, so `loaded` is false
      //   forever) would turn `unresolved` into a page-change firehose.
      if (this.isCursorMode()) {
        this.lastUnresolved = null;
        return;
      }

      if (!Number.isFinite(requested) || requested < 1) {
        // Not a page number at all. Nothing to clamp TO that is more right than
        // page 1, and unlike the out-of-range case this is true whether or not
        // the data has arrived.
        this.report({ requested, rendered: 1, reason: 'out-of-range', corrected: true });
        this.currentPage.set(1);
        this.pageChange.emit(1);
        void this.dispatch('jump');
        return;
      }

      if (!loaded) {
        // ★ Held, not corrected — see the note on `unresolved`. Reported anyway,
        //   because a page being held is exactly as invisible as one being
        //   silently changed.
        if (requested > 1) {
          this.report({ requested, rendered: requested, reason: 'not-loaded', corrected: false });
        } else {
          this.lastUnresolved = null;
        }
        return;
      }

      if (requested <= last) {
        this.lastUnresolved = null;
        return;
      }

      this.report({ requested, rendered: last, reason: 'out-of-range', corrected: true });
      this.currentPage.set(last);
      this.pageChange.emit(last);
      // ★ A correction is a page move like any other, so a host that handed the
      //   load over through `pageAction` gets it loaded — `NV-04-I5` / `M2`.
      //   Emitting `pageChange` alone served only hosts that fetch themselves.
      void this.dispatch('jump');
    });
  });

  /** Emit at most once per distinct state, so a re-render is not a new event. */
  private report(event: SvUnresolvedValue<number>): void {
    const key = `${event.requested}|${event.rendered}|${event.reason}|${event.corrected}`;
    if (key === this.lastUnresolved) return;
    this.lastUnresolved = key;
    this.unresolved.emit(event);
  }

  // ── URL synchronisation ───────────────────────────────────────────────────

  /**
   * The page number's projection into the URL. Inert until `urlKey` is set *and*
   * the app provided a location — see {@link urlKey}.
   */
  private readonly pageParam = svNavParam(() => this.urlKey(), { mode: 'push' });

  /**
   * URL → component. The deep-link and back-button path.
   *
   * ★ **This deliberately does not clamp against `totalPages()`.** The obvious
   * version — clamp the incoming page into `[1, totalPages()]` — silently breaks
   * every deep link in an app that fetches: `totalItems` is `0` until the first
   * response arrives, so `totalPages()` is `1`, and `?page=4` becomes page 1
   * before the data that would have justified page 4 exists. The link appears to
   * work and lands on the wrong page.
   *
   * So the only validation here is what a page number *is*: a finite integer of
   * at least 1. Reconciling a held page against a total that arrives later — or
   * shrinks — is `NV-04-I2` / `X-10`, which is a decision about whether a
   * component may overwrite a value its host owns. It is not made here.
   *
   * `pageChange` is emitted as well as the model being set, because a consumer
   * listening to `(pageChange)` to fetch rows would otherwise render page 4 of a
   * deep link and never request it — and `pageAction` is dispatched for the same
   * reason, for the host that handed the load over (`NV-04-I5` / `M2`).
   *
   * ★ An absent key means page 1, because `syncToUrl` writes page 1 as absent.
   *   So Back from `?page=2` to the bare URL must land on page 1 — but only on
   *   a TRANSITION from a value to nothing. An absent key on first render is not
   *   evidence of anything: the host may be driving `currentPage` itself, and
   *   forcing page 1 there would overwrite it. `NV-04-I7`.
   */
  protected readonly syncFromUrl = effect(() => {
    const raw = this.pageParam.value();
    const previous = this.lastUrlValue;
    this.lastUrlValue = raw;

    if (raw === null) {
      if (previous === null) return;
      untracked(() => {
        if (!this.pageParam.addressable() || this.isCursorMode()) return;
        this.applyUrlPage(1);
      });
      return;
    }

    // ★ A page ordinal is not an address in cursor mode. `?page=4` would restore
    //   the number and not the rows — the cursor that produced page 4 is the only
    //   thing that could, and it is not derivable from "4". Writing it anyway
    //   would produce a shareable link that lands on the wrong data, which is the
    //   failure `NV-04-I7` was fixed to avoid. Project `pager.trail()` yourself
    //   if the URL must carry the position.
    if (this.isCursorMode()) return;

    // Digits only, deliberately stricter than `parseInt`. `parseInt('2.7')` is 2
    // and `parseInt('4x')` is 4 — silently reinterpreting a malformed value is
    // how a bug in the consumer's link-building survives unnoticed. `?page=0`
    // then fails the range check below.
    if (!/^\d+$/.test(raw)) return;
    const parsed = Number.parseInt(raw, 10);
    if (parsed < 1) return;

    untracked(() => this.applyUrlPage(parsed));
  });

  /** The raw value `syncFromUrl` last saw, so "the key went away" is detectable. */
  private lastUrlValue: string | null = null;

  /** Move to a page the URL named. Call inside `untracked`. */
  private applyUrlPage(page: number): void {
    if (page === this.currentPage()) return;
    this.currentPage.set(page);
    this.pageChange.emit(page);
    // ★ `resume`: a deep link or the back button, not a press (`X-15`).
    this.nav.record({ intent: 'resume', key: String(page), index: page });
    void this.dispatch('jump');
  }

  /**
   * Component → URL.
   *
   * Page 1 writes `null` rather than `?page=1`: it is the default, and a URL
   * carrying its own defaults is noise that also makes two equivalent pages look
   * like two different ones to analytics and to a cache.
   */
  protected readonly syncToUrl = effect(() => {
    const page = this.currentPage();

    untracked(() => {
      if (!this.pageParam.addressable()) return;
      if (this.isCursorMode()) {
        svWarnOnce(
          'pagination-cursor-urlkey',
          '<sv-pagination>: [urlKey] is ignored in [mode]="\'cursor\'". A page ' +
            'ordinal is not an address there — "4" cannot be turned back into the ' +
            'cursor that produced page 4, so the link would restore the number and ' +
            'not the rows. Project pager.trail() into the URL yourself if the ' +
            'position must be shareable.',
        );
        return;
      }
      const next = page === 1 ? null : String(page);
      if (this.pageParam.value() !== next) this.pageParam.set(next);
    });
  });

  // ── `NV-04-I11`: make the limit of offset paging VISIBLE ──────────────────

  /** `undefined` until the first pass, so the initial total is not "drift". */
  private lastTotal: number | null | undefined = undefined;

  /**
   * Warn once when the total moves under a user who is not on page 1.
   *
   * ★ WHY THIS CONDITION AND NOT A SIZE THRESHOLD. The first draft warned above
   *   some row count, which is a guess: a million immutable audit rows page
   *   perfectly by offset, and a forty-row queue that changes every second does
   *   not. The count is not the problem; MOVEMENT is. A total that changes while
   *   `currentPage > 1` is the drift `NV-04-I11` describes, actually observed in
   *   this host's data rather than predicted from its shape.
   *
   * It is dev-only and once per session (`svWarnOnce`), and phrased as guidance:
   * a host that applied a filter and deliberately stayed on page 3 will see it
   * too, and for that host the advice is still correct.
   */
  protected readonly watchTotalDrift = effect(() => {
    const total = this.totalItems();
    const page = this.currentPage();

    untracked(() => {
      const previous = this.lastTotal;
      this.lastTotal = total;
      if (previous === undefined || previous === null || total === null) return;
      // `0 → n` is the first response arriving, which is not drift.
      if (previous === 0 || total === previous) return;
      if (page <= 1 || this.isCursorMode()) return;

      svWarnOnce(
        'pagination-unstable-total',
        `<sv-pagination>: totalItems moved from ${previous} to ${total} while the ` +
          `user was on page ${page}. Offset paging asks for "rows 71–80 of whatever ` +
          'matches now", so a total that changes between requests shifts rows across ' +
          'the page boundary — the user can miss a row or see it twice, and no ' +
          'component-side fix exists (NV-04-I11). If the dataset changes under the ' +
          'user, switch to [mode]="\'cursor\'". Warns once.',
      );
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  /** Go to the first page. */
  first(): void {
    if (this.busy()) return;
    if (this.isCursorMode()) {
      if (!this.pager.hasPrevious()) return;
      this.pager.reset();
      this.commit(this.pager.pageIndex(), 'first');
      return;
    }
    this.goTo(1, 'first');
  }

  /** Go back one page. In cursor mode this rewinds the remembered trail. */
  previous(): void {
    if (this.busy()) return;
    if (this.isCursorMode()) {
      if (!this.pager.back()) return;
      this.commit(this.pager.pageIndex(), 'previous');
      return;
    }
    this.goTo(this.currentPage() - 1, 'previous');
  }

  /** Go forward one page. In cursor mode this consumes `nextCursor`. */
  next(): void {
    if (this.busy()) return;
    if (this.isCursorMode()) {
      const cursor = this.nextCursor();
      if (cursor === null || !this.pager.advance(cursor)) return;
      this.commit(this.pager.pageIndex(), 'next');
      return;
    }
    this.goTo(this.currentPage() + 1, 'next');
  }

  /** Go to the last page. A no-op without a total, which is the honest answer. */
  last(): void {
    const total = this.totalPages();
    if (total === null) return;
    this.goTo(total, 'last');
  }

  /**
   * Jump to a numbered page.
   *
   * ⚠️ Refused while `busy()` — `NV-04-I5` / `NV-04-M2`. The controls are also
   * `[disabled]`, but a disabled attribute is a courtesy: a programmatic call, a
   * synthetic click or a press landing in the same frame as the disable would
   * otherwise start a second load whose slower response could win.
   *
   * ⚠️ A no-op in `mode="cursor"`, where a page number names nothing that can be
   * fetched — use `next()` / `previous()`.
   */
  goTo(page: number, direction: SvPageRequestDirection = 'jump'): void {
    if (this.busy()) return;

    if (this.isCursorMode()) {
      svWarnOnce(
        'pagination-cursor-goto',
        '<sv-pagination>: goTo() was called in [mode]="\'cursor\'", where a page ' +
          'number is not a fetchable address — a keyset cursor names a row, and ' +
          'the cursor for an arbitrary page is not derivable (NV-04-M1). Use ' +
          'next() / previous() / first(). The call was ignored.',
      );
      return;
    }

    const clamped = this.clampPage(page);
    if (clamped === this.currentPage()) return;
    this.commit(clamped, direction);
  }

  /** Re-run the failed load, or ask the host to — `docs/async-contract-adr.md`. */
  retry(): void {
    if (this.pageAction()) {
      void this.load.retry();
      return;
    }
    this.retryRequested.emit();
  }

  private clampPage(page: number): number {
    const last = this.totalPages();
    const lower = Math.max(1, page);
    return last === null ? lower : Math.min(lower, last);
  }

  /**
   * Apply a page move: write the model, tell the host, keep focus, start the load.
   *
   * One funnel for every entry point so `NV-04-I5`'s sequencing cannot be
   * bypassed by the next control somebody adds.
   */
  private commit(page: number, direction: SvPageRequestDirection): void {
    // Which control the user pressed, so focus can be put back on it. Read
    // before the change, because the host may replace the whole control.
    const pressed = document.activeElement as HTMLElement | null;
    const pressedLabel = pressed?.getAttribute('aria-label') ?? null;
    const cameFromInside = (this.host.nativeElement as HTMLElement).contains(pressed);

    this.currentPage.set(page);
    this.pageChange.emit(page);
    this.nav.record({ intent: DIRECTION_TO_INTENT[direction], key: String(page), index: page });
    if (this.isCursorMode()) this.cursorChange.emit(this.pager.cursor());

    void this.dispatch(direction);

    if (cameFromInside) this.restoreFocus(pressedLabel, page);
    if (this.scrollToTop()) {
      const target = this.scrollTarget() ?? (this.host.nativeElement as HTMLElement);
      target.scrollIntoView?.({ block: 'start' });
    }
  }

  /**
   * Run `pageAction`, if the host handed the load over.
   *
   * ★ `run()` is FIRST-WINS, so a press that slips past `busy()` is answered
   *   `'busy'` and the work is never called — the second request that `NV-04-I5`
   *   describes does not exist to lose a race with.
   */
  private async dispatch(direction: SvPageRequestDirection): Promise<void> {
    const action = this.pageAction();
    if (!action) return;

    const page = this.currentPage();
    const pageSize = this.pageSize();
    const cursor = this.isCursorMode() ? this.pager.cursor() : null;

    const outcome = await this.load.run((request) =>
      action({ page, pageSize, cursor, direction, request }),
    );

    if (outcome !== 'failed') return;
    const failure = this.load.error();
    if (failure) this.loadFailed.emit(failure);
  }

  /**
   * Put focus back where the user left it, and say what changed — `NV-04-I6`,
   * `NV-04-M5`, `X-14`. See the note on `scrollToTop`.
   */
  private restoreFocus(label: string | null, page: number): void {
    const root = this.host.nativeElement as HTMLElement;

    this.schedule(() => {
      const byLabel = label
        ? root.querySelector<HTMLElement>(svAttrSelector('aria-label', label))
        : null;

      // ★ While a load is in flight the page number is a PROMISE, not a fact, so
      //   saying "Page 4 of 12" is premature — the rows are not there yet. The
      //   settled announcement is owed instead by `announceSettled`.
      const loading = this.busy();
      if (loading) this.owedAnnouncement = true;

      svRecoverFocus({
        // The same control, then the opposite direction — Next disables itself
        // on the last page, and a user who paged to the end must land on
        // something rather than on `<body>`.
        to: [
          byLabel,
          root.querySelector<HTMLElement>('[aria-label="Previous page"]'),
          root.querySelector<HTMLElement>('[aria-label="Next page"]'),
        ],
        fallback: root.querySelector('nav'),
        announce: loading ? `Loading page ${page}.` : `${this.positionLabel()}.`,
        announcer: this.announcer,
      });
    });
  }

  /** A "Loading page N" was announced and its resolution has not been. */
  private owedAnnouncement = false;

  /**
   * Say what arrived, once the load that was announced as pending finishes.
   *
   * ★ Announced from `SvLiveAnnouncer`, the region this component ALREADY uses.
   *   Two live regions for one wait is `OF-17-I1`'s defect.
   */
  protected readonly announceSettled = effect(() => {
    const busy = this.busy();

    untracked(() => {
      if (busy || !this.owedAnnouncement) return;
      this.owedAnnouncement = false;
      const failure = this.activeError();
      this.announcer.announce(
        failure ? `Could not load page ${this.currentPage()}. ${failure.message}` : `${this.positionLabel()}.`,
      );
    });
  });

  /** Pending focus tasks, cancelled on destroy so none outlives the component. */
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  private schedule(task: () => void): void {
    const id = setTimeout(() => {
      this.timers.delete(id);
      task();
    });
    this.timers.add(id);
  }

  ngOnDestroy(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
  }

  /*
   * ── Rationale, deliberately NOT a JSDoc ─────────────────────────────────────
   *
   * ── `NV-04-I3`: reset-to-1 was a POLICY, and the wrong one ──────────────────
   * The behaviour was never undefined — `onPageSizeChange` set page 1 and emitted.
   * It is simply not what the user asked for. Somebody eight pages into a list who
   * switches from 10 rows to 50 is asking to see MORE OF WHAT THEY ARE LOOKING AT.
   * Sending them to page 1 discards the position they spent eight presses reaching,
   * and there is no affordance that gets it back — page 2 of 50 is not a number
   * they can compute.
   *
   * ★ SO THE DEFAULT CHANGED, and today's behaviour is no longer the default.
   *   That is deliberate and sanctioned: reset-to-1 IS the defect the item names,
   *   so hiding the fix behind an opt-in would ship the bug to everyone who does
   *   not read a changelog. `pageSizeChangePolicy="reset-to-first"` restores it
   *   verbatim for hosts that want it.
   *
   * ★★ AND THE CHANGE IS INVISIBLE IN THE COMMON CASE, which is what makes it
   *    safe. `preserve-first-item` computes the page containing the row that was
   *    at the top of the screen; on page 1 that row is row 1, which is on page 1
   *    of every size. So every resize that used to be a no-op still is, and only
   *    the resizes that used to throw away a position behave differently.
   *
   * ★ Cursor mode cannot preserve anything: a cursor encodes a row's sort key,
   *   not an offset, so there is no arithmetic from (page 8, size 10) to a cursor
   *   for size 50. It resets, and the trail is cleared with it — keeping cursors
   *   taken at one page size and reusing them at another is how a keyset UI starts
   *   skipping rows.
   */

  onPageSizeChange(value: number): void {
    // A resize IS a page load, so it queues behind one exactly as Next does —
    // `NV-04-I5`. `[ngModel]="pageSize()"` puts the `<select>` back, so the user
    // sees the refusal rather than a size that changed without rows to match.
    if (this.busy()) return;

    const size = Number(value);
    // A `<select>` cannot produce this, but a host calling the method can, and a
    // zero or negative size makes `totalPages` infinite.
    if (!Number.isFinite(size) || size < 1) return;

    const before = this.pageSize();
    this.pageSize.set(size);          // model auto-emits pageSizeChange

    if (this.isCursorMode()) {
      this.pager.reset();
      this.cursorChange.emit(null);
      this.applyPage(1, 'resize');
      return;
    }

    this.applyPage(this.clampPage(this.pageForSize(before, size)), 'resize');
  }

  /** Which page now holds the row that was first on screen — `NV-04-I3`. */
  private pageForSize(before: number, after: number): number {
    if (this.pageSizeChangePolicy() === 'reset-to-first') return 1;
    const firstVisibleIndex = (this.currentPage() - 1) * before; // 0-based
    return Math.floor(firstVisibleIndex / after) + 1;
  }

  /**
   * Set the page after a resize, emitting only if it moved.
   *
   * ⚠️ `pageChange` used to fire unconditionally here, which under
   * `preserve-first-item` would report a page change that did not happen — and
   * `pageSize` is a `model()`, so `pageSizeChange` already tells the host to
   * refetch either way.
   */
  private applyPage(page: number, direction: SvPageRequestDirection): void {
    if (page !== this.currentPage()) {
      this.currentPage.set(page);
      this.pageChange.emit(page);
    }
    // ★ Recorded unconditionally, unlike `pageChange`. A resize that lands on
    //   the page you were already on is still a resize the user performed, and
    //   "how often does changing the page size move you?" is only answerable if
    //   the no-op case is in the data too (`X-15`).
    this.nav.record({ intent: DIRECTION_TO_INTENT[direction], key: String(page), index: page });
    void this.dispatch(direction);
  }
}
