import { createQuery } from '@styloviz/core';
import { applyQuery, cursorQuery, offsetLimitQuery, pageNumberQuery } from './query-presets';

describe('query presets', () => {
  it('maps page/pageSize to offset/limit', () => {
    const params = offsetLimitQuery()(createQuery({ page: 3, pageSize: 20 }));
    expect(params).toMatchObject({ offset: '40', limit: '20' });
  });

  it('keeps the page 1-based for page/perPage APIs', () => {
    // Sending a 0-based page to a 1-based API silently skips the first page
    // rather than erroring, so this boundary is worth pinning.
    const params = pageNumberQuery()(createQuery({ page: 1, pageSize: 25 }));
    expect(params).toMatchObject({ page: '1', perPage: '25' });
  });

  it('renames the page params on request', () => {
    const params = pageNumberQuery({ pageParam: 'p', sizeParam: 'n' })(
      createQuery({ page: 2, pageSize: 50 }),
    );
    expect(params).toMatchObject({ p: '2', n: '50' });
  });

  it('omits the cursor on the first page — there is nothing to resume from', () => {
    expect(cursorQuery()(createQuery())).not.toHaveProperty('cursor');
    expect(cursorQuery()(createQuery({ cursor: 'abc' }))).toMatchObject({ cursor: 'abc' });
  });

  it('encodes descending sorts with a leading minus', () => {
    const params = offsetLimitQuery()(
      createQuery({ sorts: [{ key: 'name', direction: 'asc' }, { key: 'createdAt', direction: 'desc' }] }),
    );
    expect(params['sort']).toBe('name,-createdAt');
  });

  it('drops empty filters rather than sending blank params', () => {
    const params = offsetLimitQuery()(createQuery({ filters: { status: 'open', owner: '' } }));
    expect(params['status']).toBe('open');
    expect(params).not.toHaveProperty('owner');
  });

  it('renames the search param', () => {
    expect(offsetLimitQuery('search')(createQuery({ search: 'x' }))['search']).toBe('x');
  });

  it('preserves params already on the URL', () => {
    expect(applyQuery('/api/orders?tenant=42', { limit: '20' }))
      .toBe('/api/orders?tenant=42&limit=20');
  });

  it('overrides a param the URL already set', () => {
    expect(applyQuery('/api/orders?limit=5', { limit: '20' })).toBe('/api/orders?limit=20');
  });
});
