import type { SvDataQuery } from '@styloviz/core';
import type { SvQueryMapper } from './types';

/**
 * Encode sorts the way most APIs do: `sort=name,-createdAt`.
 *
 * The leading `-` for descending is the convention in JSON:API, Stripe and
 * most hand-rolled REST layers. Multi-sort is comma-joined in priority order.
 */
function encodeSorts(query: SvDataQuery): string {
  return query.sorts.map((s) => (s.direction === 'desc' ? `-${s.key}` : s.key)).join(',');
}

/** Filters and search, shared by every preset. Empty values are dropped. */
function common(query: SvDataQuery, searchParam: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(query.filters)) {
    if (value !== '') out[key] = value;
  }
  if (query.search) out[searchParam] = query.search;
  const sort = encodeSorts(query);
  if (sort) out['sort'] = sort;
  return out;
}

/**
 * `?offset=40&limit=20` — the most common shape, and what SQL `LIMIT/OFFSET`
 * maps to directly.
 */
export function offsetLimitQuery(searchParam = 'q'): SvQueryMapper {
  return (query) => ({
    ...common(query, searchParam),
    offset: String((query.page - 1) * query.pageSize),
    limit: String(query.pageSize),
  });
}

/**
 * `?page=3&perPage=20` — 1-based, as Rails, Laravel and JSON:API emit.
 *
 * Note the 1-based page: sending a 0-based page to a 1-based API silently
 * skips the first page rather than erroring, so the boundary is worth stating.
 */
export function pageNumberQuery(
  { pageParam = 'page', sizeParam = 'perPage', searchParam = 'q' } = {},
): SvQueryMapper {
  return (query) => ({
    ...common(query, searchParam),
    [pageParam]: String(query.page),
    [sizeParam]: String(query.pageSize),
  });
}

/**
 * `?cursor=abc&limit=20` — keyset pagination.
 *
 * The cursor is omitted on the first page (there is nothing to resume from),
 * and `patchQuery` already drops a stale cursor whenever the filters, search or
 * sort change — a cursor is only meaningful against the ordering that produced
 * it, and reusing one across a re-sort silently returns the wrong window.
 */
export function cursorQuery(
  { cursorParam = 'cursor', limitParam = 'limit', searchParam = 'q' } = {},
): SvQueryMapper {
  return (query) => {
    const out: Record<string, string> = {
      ...common(query, searchParam),
      [limitParam]: String(query.pageSize),
    };
    if (query.cursor) out[cursorParam] = query.cursor;
    return out;
  };
}

/** Append a mapped query to a URL, preserving any params already on it. */
export function applyQuery(url: string, params: Record<string, string>): string {
  const [base, existing] = url.split('?');
  const search = new URLSearchParams(existing ?? '');
  for (const [k, v] of Object.entries(params)) search.set(k, v);
  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}
