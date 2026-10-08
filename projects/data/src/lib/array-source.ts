import type { SvDataQuery, SvItemKey, SvPage } from '@styloviz/core';
import type { SvDataSource } from './types';

/** How a value is matched against a filter or search term. */
export type SvMatcher<T> = (item: T, term: string, field: string | null) => boolean;

export interface SvArraySourceOptions<T> {
  /**
   * Fields free-text search looks at. Defaults to every own string property —
   * fine for a demo, worth narrowing for real data so searching "3" does not
   * match an id.
   */
  readonly searchFields?: readonly (keyof T & string)[];
  /** Override how one value is compared. Defaults to case-insensitive substring. */
  readonly matcher?: SvMatcher<T>;
  /** Artificial delay in ms, to make skeletons and races visible in a demo. */
  readonly delayMs?: number;
  /** Identity, used only by cursor paging. @default 'id' */
  readonly itemKey?: SvItemKey<T>;
}

const defaultMatch = (value: unknown, term: string): boolean =>
  value != null && String(value).toLowerCase().includes(term.toLowerCase());

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * A data source over an in-memory array, with the same semantics as a remote
 * one: filters, then search, then sort, then page.
 *
 * The point is that a demo and production run the *same* component code path.
 * A showcase wired to a local array and a dashboard wired to an API differ in
 * one argument, so bugs that only appear under real paging — a stale cursor, a
 * page that no longer exists after a filter narrows the set — are reachable
 * without a server.
 */
export function createArrayDataSource<T>(
  items: readonly T[] | (() => readonly T[]),
  options: SvArraySourceOptions<T> = {},
): SvDataSource<T> {
  const read = typeof items === 'function' ? items : () => items;
  const { searchFields, matcher, delayMs = 0, itemKey = 'id' as SvItemKey<T> } = options;

  const keyOf = (item: T, index: number): string =>
    String(typeof itemKey === 'function' ? itemKey(item, index) : (item as Record<string, unknown>)?.[itemKey]);

  return async (query: SvDataQuery, signal: AbortSignal): Promise<SvPage<T>> => {
    if (delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delayMs);
        signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
      });
    }
    signal.throwIfAborted();

    let rows = [...read()];

    for (const [field, value] of Object.entries(query.filters)) {
      if (value === '') continue;
      rows = rows.filter((item) =>
        matcher
          ? matcher(item, value, field)
          : defaultMatch((item as Record<string, unknown>)?.[field], value),
      );
    }

    if (query.search) {
      const term = query.search;
      rows = rows.filter((item) => {
        if (matcher) return matcher(item, term, null);
        const fields = searchFields ?? (Object.keys(item as object) as (keyof T & string)[]);
        return fields.some((f) => defaultMatch((item as Record<string, unknown>)[f], term));
      });
    }

    // Applied in reverse so the first sort in the array wins ties — the order
    // the user clicked columns in is the order they expect to be honoured.
    for (const sort of [...query.sorts].reverse()) {
      rows.sort((a, b) => {
        const r = compare((a as Record<string, unknown>)[sort.key], (b as Record<string, unknown>)[sort.key]);
        return sort.direction === 'desc' ? -r : r;
      });
    }

    const total = rows.length;

    let start: number;
    if (query.cursor) {
      const from = rows.findIndex((item, i) => keyOf(item, i) === query.cursor);
      // An unknown cursor means the row it pointed at is gone — start over
      // rather than silently returning nothing, which reads as "no results".
      start = from < 0 ? 0 : from + 1;
    } else {
      start = (query.page - 1) * query.pageSize;
    }

    const slice = rows.slice(start, start + query.pageSize);
    const last = slice.at(-1);
    // The cursor is emitted on every page, including the first — a source that
    // only produced one once you were already using cursors could never start.
    const nextCursor =
      last !== undefined && start + slice.length < total
        ? keyOf(last, start + slice.length - 1)
        : null;

    return { items: slice, total, cursor: nextCursor };
  };
}
