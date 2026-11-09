import { buildServerQuery, ServerRequestLedger } from './server-query';

/** Server-side mode: the emitted query, and the ordering guarantee behind `acceptsResponse`. */

describe('ServerRequestLedger', () => {
  it('accepts only the most recent request', () => {
    const ledger = new ServerRequestLedger();
    expect(ledger.id()).toBe(0);
    ledger.next();
    const first = ledger.id();
    expect(ledger.accepts(first)).toBe(true);
    ledger.next();
    expect(ledger.accepts(first)).toBe(false);
    expect(ledger.accepts(ledger.id())).toBe(true);
  });
});

describe('buildServerQuery', () => {
  it("carries the table's state in the shared query shape, dropping unsorted columns", () => {
    const query = buildServerQuery({
      page: 3,
      pageSize: 25,
      sorts: [{ key: 'name', direction: 'asc' }, { key: 'age', direction: null }],
      filters: { status: 'active' },
      search: 'bo',
    });
    expect(query).toMatchObject({
      page: 3,
      pageSize: 25,
      sorts: [{ key: 'name', direction: 'asc' }],
      filters: { status: 'active' },
      search: 'bo',
    });
  });
});
