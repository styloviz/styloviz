/**
 * The shared data-wiring contract.
 *
 * Every component in the kit that renders a collection the server owns speaks
 * these types: what was asked for (`SvDataQuery`), what came back (`SvPage`),
 * what went wrong (`SvDataError`), and how a row is identified across refreshes
 * (`SvItemKey`). One vocabulary means a host can wire a table, a kanban board
 * and a notification feed to the same endpoint shape without three adapters.
 *
 * These are types only — no runtime, no HTTP, no rxjs. Helpers live beside them
 * in `query.ts` / `errors.ts` / `item-key.ts`, and the optional transport layer
 * lives in `@styloviz/data`.
 */

// ─── Sorting ─────────────────────────────────────────────────────────────────

/**
 * Direction of a single sort. Deliberately excludes `null`: an unsorted column
 * is one that is absent from `SvDataQuery.sorts`, not one carrying a null
 * direction — otherwise every consumer has to filter the array before use.
 */
export type SvSortDirection = 'asc' | 'desc';

/** One sort instruction. `key` matches the field name the server sorts on. */
export interface SvSort {
  readonly key: string;
  readonly direction: SvSortDirection;
}

// ─── The request ─────────────────────────────────────────────────────────────

/**
 * Everything a component knows about what the user is asking to see.
 *
 * Emitted whenever any of it changes, so a host has exactly one handler to
 * write regardless of whether the user paged, sorted, filtered or searched.
 *
 * Pagination is expressed twice on purpose: `page`/`pageSize` for offset APIs
 * and `cursor` for keyset APIs. A component fills in whichever it was given;
 * a host reads whichever its backend speaks.
 */
export interface SvDataQuery {
  /** 1-based page number. Offset APIs: `offset = (page - 1) * pageSize`. */
  readonly page: number;
  /** Rows per page. */
  readonly pageSize: number;
  /** Active sorts, in priority order. Empty when unsorted. */
  readonly sorts: readonly SvSort[];
  /** Per-field filter values, keyed by field name. Empty values are omitted. */
  readonly filters: Readonly<Record<string, string>>;
  /** Free-text search across the whole record. `''` when not searching. */
  readonly search: string;
  /** Opaque keyset cursor for the next page, or `null` for offset paging. */
  readonly cursor: string | null;
}

// ─── The response ────────────────────────────────────────────────────────────

/**
 * One page of results.
 *
 * `total` is nullable because keyset/cursor APIs legitimately cannot report it.
 * A component that receives `null` shows "load more" affordances instead of a
 * page count — it must never render `0` or guess.
 */
export interface SvPage<T> {
  readonly items: readonly T[];
  /** Total matching records across all pages, or `null` when unknown. */
  readonly total: number | null;
  /** Cursor for the next page, or `null` when this is the last page. */
  readonly cursor: string | null;
}

// ─── Failure ─────────────────────────────────────────────────────────────────

/**
 * A load or mutation failure, normalized to something a component can render.
 *
 * Components accept this rather than a raw `HttpErrorResponse` so the kit never
 * depends on `@angular/common/http`, and so a host using fetch, tRPC or GraphQL
 * can surface errors through the same UI. Use `toSvDataError()` to normalize.
 */
export interface SvDataError {
  /** Human-readable, already safe to display. Never a raw stack trace. */
  readonly message: string;
  /** HTTP status when there was one. */
  readonly status?: number;
  /** Stable machine code for host-side branching (e.g. `'RATE_LIMITED'`). */
  readonly code?: string;
  /** Whether offering "Try again" makes sense. @default true */
  readonly retryable?: boolean;
  /**
   * The server's correlation / trace / request id (`OF-16-M2`).
   *
   * ★★★ THIS IS THE FIELD THAT TURNS AN UNSUPPORTABLE TICKET INTO A LOG QUERY.
   *     "It said something went wrong" is unanswerable — nobody can find the
   *     request. "It said something went wrong, reference 7f3a9c2" is one
   *     lookup. The id exists on nearly every server response already, in a
   *     header or the error body; it was simply being thrown away here.
   *
   * ★ It belongs on the ERROR, not on `sv-result`: every surface in the kit
   *   that renders an error can show it, and a host that builds its own error
   *   UI gets it for free. `toSvDataError` extracts it.
   */
  readonly reference?: string;
  /** The original thrown value, for logging. Never rendered. */
  readonly cause?: unknown;
}

// ─── Async state ─────────────────────────────────────────────────────────────

/**
 * The full lifecycle of a server-backed collection, as a discriminated union.
 *
 * Components take discrete `loading` / `error` / data inputs rather than this
 * union — binding three optional inputs is far less ceremony for a host with
 * plain signals. This type exists for the layer above: it is what a
 * `SvDataSource` produces and what `[svDataSource]` unpacks into those inputs.
 *
 * `loading` carries `previous` so a refresh can keep the old rows on screen
 * (dimmed) instead of collapsing the layout to a skeleton on every keystroke.
 */
export type SvAsyncState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly previous: readonly T[] }
  | { readonly status: 'error'; readonly error: SvDataError; readonly previous: readonly T[] }
  | { readonly status: 'ready'; readonly items: readonly T[]; readonly total: number | null; readonly cursor: string | null };

// ─── Emptiness ───────────────────────────────────────────────────────────────

/**
 * Why a surface has nothing to show (`OF-07-I1`, `OF-07-M1`). Four causes, and
 * conflating them is the most common empty-state mistake in the kit.
 *
 * - `no-data`    — the account genuinely has none of these yet. Offer "Create".
 * - `no-results` — records exist, the current filters exclude them all. Offer
 *   "Clear filters". Telling a user with 4,000 orders that they have no orders
 *   because they mistyped a search term reads as a bug.
 * - `no-access`  — records may well exist; this user may not see them. "Nothing
 *   here yet" is a lie that sends them looking for data that is not missing,
 *   and an empty chart where a permission error belongs is how a dashboard
 *   loses a day of someone's time.
 * - `error`      — the load failed and there is no `SvDataError` to render.
 *   Prefer the error shell when you HAVE one; this is for the surface that
 *   knows only that it has nothing and that nothing is not the answer.
 *
 * ★★ ONE UNION, DELIBERATELY. `sv-empty-state` (full page) and
 *    `sv-empty-shell` (inline, inside every data component) answer the same
 *    question, and two vocabularies for it meant a host could say `no-access`
 *    on one surface and have no way to say it on the other — which is exactly
 *    the semantic collapse `OF-07-I1` is about. `EmptyStateReason` is an alias
 *    of this type.
 */
export type SvEmptyReason = 'no-data' | 'no-results' | 'no-access' | 'error';

// ─── Identity ────────────────────────────────────────────────────────────────

/**
 * How to derive a stable identity for an item.
 *
 * Either a property name (`'id'`) or a function for composite keys. Required
 * for anything server-backed: `track $index` reuses DOM by position, so a
 * refresh that reorders or inserts rows moves focus to the wrong element,
 * animates the wrong row and shows the wrong row as selected.
 */
export type SvItemKey<T> = string | ((item: T, index: number) => string | number);

/**
 * Keys of items with a mutation in flight — used to render per-row spinners and
 * to disable their controls without freezing the whole list.
 */
export type SvPendingKeys = ReadonlySet<string | number>;

/** Lifecycle of a single write. */
export type SvMutationStatus = 'idle' | 'pending' | 'error';

// ─── Live connections ────────────────────────────────────────────────────────

/**
 * State of the host's live feed — an `EventSource`, a WebSocket, a long poll.
 *
 * A component fed by a stream cannot tell the difference between "nothing has
 * happened yet" and "the connection dropped ten minutes ago": both look like a
 * list that stopped growing. That ambiguity is the whole reason this exists —
 * the host owns the socket, so only the host can say which it is, and the user
 * needs to know before they conclude the agent has stalled.
 *
 * - `idle`         — no feed opened yet. Render nothing.
 * - `connecting`   — first handshake in flight.
 * - `open`         — receiving. Render a quiet "Live".
 * - `reconnecting` — dropped, retrying. Render it loudly; data is stale.
 * - `closed`       — finished or given up. Whatever is on screen is final.
 */
export type SvConnectionState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed';
