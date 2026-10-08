import { SV_DEFAULT_QUERY, createQuery, patchQuery, queriesEqual, toggleSort } from './query';

describe('createQuery', () => {
  it('fills unspecified fields from the default', () => {
    expect(createQuery({ pageSize: 25 })).toEqual({ ...SV_DEFAULT_QUERY, pageSize: 25 });
  });

  it('leaves the shared default untouched', () => {
    createQuery({ page: 9 });
    expect(SV_DEFAULT_QUERY.page).toBe(1);
  });
});

describe('patchQuery — paging reset', () => {
  const onPage7 = createQuery({ page: 7, cursor: 'abc' });

  it('returns to page 1 when the filters change', () => {
    const next = patchQuery(onPage7, { filters: { status: 'open' } });
    expect(next.page).toBe(1);
  });

  it('returns to page 1 when the search term changes', () => {
    expect(patchQuery(onPage7, { search: 'ada' }).page).toBe(1);
  });

  it('returns to page 1 when the page size changes', () => {
    expect(patchQuery(onPage7, { pageSize: 50 }).page).toBe(1);
  });

  it('drops a stale cursor along with the page', () => {
    expect(patchQuery(onPage7, { search: 'ada' }).cursor).toBeNull();
  });

  it('stays on the current page when only the sort changes', () => {
    const next = patchQuery(onPage7, { sorts: [{ key: 'name', direction: 'asc' }] });
    expect(next.page).toBe(7);
  });

  it('honours an explicit page even alongside a filter change', () => {
    const next = patchQuery(onPage7, { filters: { status: 'open' }, page: 3 });
    expect(next.page).toBe(3);
  });
});

describe('queriesEqual', () => {
  it('ignores object identity for structurally identical queries', () => {
    expect(queriesEqual(createQuery({ search: 'a' }), createQuery({ search: 'a' }))).toBe(true);
  });

  it('ignores filter key order', () => {
    const a = createQuery({ filters: { x: '1', y: '2' } });
    const b = createQuery({ filters: { y: '2', x: '1' } });
    expect(queriesEqual(a, b)).toBe(true);
  });

  it('treats sort order as significant', () => {
    const a = createQuery({ sorts: [{ key: 'a', direction: 'asc' }, { key: 'b', direction: 'asc' }] });
    const b = createQuery({ sorts: [{ key: 'b', direction: 'asc' }, { key: 'a', direction: 'asc' }] });
    expect(queriesEqual(a, b)).toBe(false);
  });

  it('separates a dropped filter from a changed one', () => {
    expect(queriesEqual(createQuery({ filters: { x: '1' } }), createQuery({ filters: {} }))).toBe(false);
    expect(queriesEqual(createQuery({ filters: { x: '1' } }), createQuery({ filters: { x: '2' } }))).toBe(false);
  });
});

describe('toggleSort', () => {
  it('cycles unsorted → asc → desc → unsorted', () => {
    let sorts = toggleSort([], 'name');
    expect(sorts).toEqual([{ key: 'name', direction: 'asc' }]);
    sorts = toggleSort(sorts, 'name');
    expect(sorts).toEqual([{ key: 'name', direction: 'desc' }]);
    expect(toggleSort(sorts, 'name')).toEqual([]);
  });

  it('replaces the previous sort in single-sort mode', () => {
    const sorts = toggleSort([{ key: 'name', direction: 'asc' }], 'age');
    expect(sorts).toEqual([{ key: 'age', direction: 'asc' }]);
  });

  it('appends in multi-sort mode, last click lowest priority', () => {
    const sorts = toggleSort([{ key: 'name', direction: 'asc' }], 'age', true);
    expect(sorts).toEqual([
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'asc' },
    ]);
  });
});

/**
 * `queriesEqual` decides whether a data source re-fetches. A false "equal" is
 * the expensive one: the user changes the sort and the table does not move.
 * These cases are each one field apart, so a comparison that stopped short
 * would report them identical.
 */
describe('queriesEqual — sorts', () => {
  it('separates a query with one more sort than the other', () => {
    const a = createQuery({ sorts: [{ key: 'name', direction: 'asc' }] });
    const b = createQuery({
      sorts: [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'desc' },
      ],
    });
    expect(queriesEqual(a, b)).toBe(false);
    expect(queriesEqual(b, a)).toBe(false); // and in the other order
  });

  it('separates the same column sorted the other way', () => {
    const asc = createQuery({ sorts: [{ key: 'name', direction: 'asc' }] });
    const desc = createQuery({ sorts: [{ key: 'name', direction: 'desc' }] });
    expect(queriesEqual(asc, desc)).toBe(false);
  });

  it('separates two sorts of the same length on different columns', () => {
    const a = createQuery({ sorts: [{ key: 'name', direction: 'asc' }] });
    const b = createQuery({ sorts: [{ key: 'age', direction: 'asc' }] });
    expect(queriesEqual(a, b)).toBe(false);
  });

  it('treats sort order as significant', () => {
    const a = createQuery({
      sorts: [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'asc' },
      ],
    });
    const b = createQuery({
      sorts: [
        { key: 'age', direction: 'asc' },
        { key: 'name', direction: 'asc' },
      ],
    });
    expect(queriesEqual(a, b)).toBe(false);
  });

  it('reports equal for two structurally identical sort lists', () => {
    const a = createQuery({ sorts: [{ key: 'name', direction: 'asc' }] });
    const b = createQuery({ sorts: [{ key: 'name', direction: 'asc' }] });
    expect(queriesEqual(a, b)).toBe(true);
  });
});
