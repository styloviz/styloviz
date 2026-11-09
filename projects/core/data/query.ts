import type { SvDataQuery, SvSort } from './types';

/**
 * A query asking for the first page with nothing sorted, filtered or searched.
 * Frozen — it is shared, and a component mutating it would poison every other.
 */
export const SV_DEFAULT_QUERY: SvDataQuery = Object.freeze({
  page: 1,
  pageSize: 10,
  sorts: Object.freeze([]) as readonly SvSort[],
  filters: Object.freeze({}) as Readonly<Record<string, string>>,
  search: '',
  cursor: null,
});

/**
 * Build a query from a partial, filling the rest from `SV_DEFAULT_QUERY`.
 *
 * ```ts
 * createQuery({ pageSize: 25, sorts: [{ key: 'created', direction: 'desc' }] })
 * ```
 */
export function createQuery(patch: Partial<SvDataQuery> = {}): SvDataQuery {
  return { ...SV_DEFAULT_QUERY, ...patch };
}

/**
 * Apply a change to a query, resetting to page 1 whenever the result set itself
 * changes shape.
 *
 * This is the rule every component gets wrong on its own: changing a filter
 * while on page 7 asks the server for page 7 of a result set that may only have
 * two pages, and the user sees an empty table. Sorting is the exception —
 * re-sorting keeps you on the same page by convention in every data grid.
 * An explicit `page` in the patch always wins.
 */
export function patchQuery(base: SvDataQuery, patch: Partial<SvDataQuery>): SvDataQuery {
  const resetsPaging =
    ('filters' in patch || 'search' in patch || 'pageSize' in patch) && !('page' in patch);

  const next: SvDataQuery = { ...base, ...patch };
  // A cursor from the previous result set is meaningless once the query changes.
  return resetsPaging ? { ...next, page: 1, cursor: null } : next;
}

/** Structural equality for sort lists — order is significant. */
function sortsEqual(a: readonly SvSort[], b: readonly SvSort[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((s, i) => s.key === b[i].key && s.direction === b[i].direction);
}

/** Structural equality for filter maps, ignoring key order. */
function filtersEqual(
  a: Readonly<Record<string, string>>,
  b: Readonly<Record<string, string>>,
): boolean {
  if (a === b) return true;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  return ak.length === bk.length && ak.every((k) => a[k] === b[k]);
}

/**
 * Whether two queries ask for the same thing.
 *
 * Guard every `queryChange` emission with this. Without it, a host that stores
 * the query and binds it back in — the normal, correct way to make the query
 * controllable — gets an emit → bind → emit loop that hammers the API. Object
 * identity is not enough: a component rebuilding its filters map produces a new
 * object with identical contents on every keystroke.
 */
export function queriesEqual(a: SvDataQuery, b: SvDataQuery): boolean {
  return (
    a === b ||
    (a.page === b.page &&
      a.pageSize === b.pageSize &&
      a.search === b.search &&
      a.cursor === b.cursor &&
      sortsEqual(a.sorts, b.sorts) &&
      filtersEqual(a.filters, b.filters))
  );
}

/**
 * Toggle a column's sort the way a data grid header does: unsorted → asc →
 * desc → unsorted.
 *
 * With `multi`, the column joins the existing sorts (last-clicked lowest
 * priority, matching every grid the buyer's users have already used); without
 * it, it replaces them.
 */
export function toggleSort(
  sorts: readonly SvSort[],
  key: string,
  multi = false,
): readonly SvSort[] {
  const existing = sorts.find((s) => s.key === key);
  const others = multi ? sorts.filter((s) => s.key !== key) : [];

  if (!existing) return [...others, { key, direction: 'asc' }];
  if (existing.direction === 'asc') return [...others, { key, direction: 'desc' }];
  return others;
}
