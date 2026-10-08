import { computed, signal, type Signal } from '@angular/core';
import { svWarnOnce } from '@styloviz/core';

/**
 * ============================================================================
 *  Keyset (cursor) paging — `NV-04-M1`
 * ============================================================================
 *
 * ★★★ THE PRIMITIVE EXISTS BECAUSE A CURSOR API IS FORWARD-ONLY AND A
 *     PAGINATOR IS NOT. Every keyset endpoint in the wild returns "here are
 *     your rows, and here is the cursor for the NEXT page". None of them returns
 *     the cursor for the previous one — it is not derivable from the page you
 *     are holding, because the cursor encodes the sort key of the row *after*
 *     the last one you were given. So "Previous" is impossible unless somebody
 *     remembers the cursors already used, and the somebody is this.
 *
 * ★★ IT LIVES IN `@styloviz/pagination`, NOT IN `@styloviz/core`. `OF-10-M3`
 *    wants cursor paging in the Notification Center and `NV-04-V1` wants it as a
 *    Pagination mode; two implementations of a cursor trail would be two
 *    different answers to "what does Back mean". A plain factory over signals
 *    has no DOM and no injection context, so the feed can import it from here
 *    exactly as the paginator does, and neither owns the other.
 *
 * ★ WHAT IT DELIBERATELY DOES NOT DO: know a total, offer page numbers, or
 *   fetch. `NV-04-I11` is the reason the first two are absent — see
 *   `SvPaginationComponent`'s note. A trail of length 4 means "the user has
 *   pressed Next three times", which is an ordinal that is always true; it is
 *   NOT "page 4 of 12", which on a churning dataset is a claim nobody can back.
 */

/** A cursor trail. Index 0 is always `null` — the first page needs no cursor. */
export type SvCursorTrail = readonly (string | null)[];

/**
 * A remembered path through a forward-only cursor API.
 *
 * Every signal is derived from one trail, so there is no state to keep in sync.
 */
export interface SvCursorPager {
  /** The cursor that produced the page currently on screen. `null` on page 1. */
  readonly cursor: Signal<string | null>;
  /** 1-based ordinal of the page on screen — how many Nexts deep the user is. */
  readonly pageIndex: Signal<number>;
  /** Whether a Previous page has been visited and can be returned to. */
  readonly hasPrevious: Signal<boolean>;
  /** The whole trail, for URL projection or session restore. */
  readonly trail: Signal<SvCursorTrail>;

  /**
   * Move forward using the cursor the server handed back.
   *
   * Returns `false` — and changes nothing — when `next` is empty or is the
   * cursor already on screen. ★ A server that echoes the same cursor back is a
   * real and nasty bug class: the naive version appends it, the UI advances its
   * ordinal, the same rows render, and the user presses Next forever on "page
   * 5, 6, 7" of one page of data. Refusing it keeps the ordinal honest.
   */
  advance(next: string): boolean;
  /** Step back one page. Returns `false` when already on the first page. */
  back(): boolean;
  /** Return to the first page and forget the trail. */
  reset(): void;
  /**
   * Adopt a trail from outside — a URL, `sessionStorage`, an SSR payload.
   *
   * A trail that does not begin with `null` is repaired rather than rejected:
   * the first page's cursor is structurally `null`, and a caller that
   * round-tripped the trail through `JSON.parse` may well have lost it.
   */
  restore(trail: SvCursorTrail): void;
}

/**
 * Create a cursor trail.
 *
 * ```ts
 * private readonly pager = createSvCursorPager();
 *
 * protected async loadNext(): Promise<void> {
 *   const page = await this.api.list({ cursor: this.pager.cursor() });
 *   if (page.cursor) this.pager.advance(page.cursor);
 * }
 * ```
 *
 * A plain factory, not a service: it holds one signal and needs no injection
 * context, so it can be called straight from a field initializer.
 */
export function createSvCursorPager(initial: SvCursorTrail = [null]): SvCursorPager {
  const trail = signal<SvCursorTrail>(normalize(initial));

  return {
    trail: trail.asReadonly(),
    cursor: computed(() => trail()[trail().length - 1] ?? null),
    pageIndex: computed(() => trail().length),
    hasPrevious: computed(() => trail().length > 1),

    advance: (next: string): boolean => {
      const current = trail();
      if (!next) return false;
      if (next === current[current.length - 1]) {
        svWarnOnce(
          'cursor-pager-repeat',
          'a cursor pager was advanced with the cursor it is already on — the ' +
            'server echoed its own cursor back, so the page ordinal would climb ' +
            'over one page of rows. The advance was refused.',
        );
        return false;
      }
      trail.set([...current, next]);
      return true;
    },

    back: (): boolean => {
      const current = trail();
      if (current.length <= 1) return false;
      trail.set(current.slice(0, -1));
      return true;
    },

    reset: (): void => trail.set([null]),

    restore: (next: SvCursorTrail): void => trail.set(normalize(next)),
  };
}

/** A trail always starts at the cursorless first page. */
function normalize(trail: SvCursorTrail): SvCursorTrail {
  if (trail.length === 0) return [null];
  return trail[0] === null ? [...trail] : [null, ...trail];
}
