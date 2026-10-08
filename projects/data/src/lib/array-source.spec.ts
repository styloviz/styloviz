import { createQuery } from '@styloviz/core';
import { createArrayDataSource } from './array-source';

interface Order { id: string; customer: string; status: string; amount: number }

const ORDERS: Order[] = [
  { id: 'a', customer: 'Zoë', status: 'open',   amount: 30 },
  { id: 'b', customer: 'Ada', status: 'closed', amount: 10 },
  { id: 'c', customer: 'Alan', status: 'open',  amount: 20 },
  { id: 'd', customer: 'Grace', status: 'open', amount: 40 },
];

const signal_ = () => new AbortController().signal;

describe('createArrayDataSource', () => {
  it('pages the way a server would', async () => {
    const src = createArrayDataSource(ORDERS);
    const page = await src(createQuery({ page: 2, pageSize: 2 }), signal_());
    expect(page.items.map((o) => o.id)).toEqual(['c', 'd']);
    expect(page.total).toBe(4);
  });

  it('filters before counting, so the total reflects the filter', async () => {
    // A total computed before filtering is the classic pagination bug: the
    // control offers page 3 of a set that now has four rows.
    const src = createArrayDataSource(ORDERS);
    const page = await src(createQuery({ filters: { status: 'open' } }), signal_());
    expect(page.total).toBe(3);
  });

  it('searches across string fields', async () => {
    const src = createArrayDataSource(ORDERS);
    const page = await src(createQuery({ search: 'ada' }), signal_());
    expect(page.items.map((o) => o.id)).toEqual(['b']);
  });

  it('narrows search to the declared fields', async () => {
    // Without this, searching "3" matches an id, an amount and a timestamp.
    const src = createArrayDataSource(ORDERS, { searchFields: ['customer'] });
    const page = await src(createQuery({ search: 'a' }), signal_());
    expect(page.items.map((o) => o.id)).toEqual(['b', 'c', 'd']);
  });

  it('sorts numerically rather than lexically', async () => {
    const src = createArrayDataSource(ORDERS);
    const page = await src(createQuery({ sorts: [{ key: 'amount', direction: 'desc' }] }), signal_());
    expect(page.items.map((o) => o.amount)).toEqual([40, 30, 20, 10]);
  });

  it('honours sort priority — the first click wins ties', async () => {
    const rows = [
      { id: '1', a: 'x', b: 2 },
      { id: '2', a: 'x', b: 1 },
      { id: '3', a: 'w', b: 9 },
    ];
    const src = createArrayDataSource(rows);
    const page = await src(
      createQuery({ sorts: [{ key: 'a', direction: 'asc' }, { key: 'b', direction: 'asc' }] }),
      signal_(),
    );
    expect(page.items.map((r) => r.id)).toEqual(['3', '2', '1']);
  });

  it('walks a cursor and reports null on the last page', async () => {
    const src = createArrayDataSource(ORDERS);
    const first = await src(createQuery({ pageSize: 2 }), signal_());
    expect(first.cursor).toBe('b');
    const second = await src(createQuery({ pageSize: 2, cursor: first.cursor }), signal_());
    expect(second.items.map((o) => o.id)).toEqual(['c', 'd']);
    expect(second.cursor).toBeNull();
  });

  it('restarts rather than returning nothing when the cursor row is gone', async () => {
    // A deleted row must not read as "no results" — that looks like an empty
    // account rather than a stale link.
    const src = createArrayDataSource(ORDERS);
    const page = await src(createQuery({ pageSize: 2, cursor: 'deleted' }), signal_());
    expect(page.items.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('reads a live array through a getter, so a demo can mutate it', async () => {
    let rows = [...ORDERS];
    const src = createArrayDataSource(() => rows);
    rows = rows.slice(0, 1);
    const page = await src(createQuery(), signal_());
    expect(page.total).toBe(1);
  });

  it('rejects when aborted mid-delay instead of resolving stale data', async () => {
    const ac = new AbortController();
    const src = createArrayDataSource(ORDERS, { delayMs: 50 });
    const promise = src(createQuery(), ac.signal);
    ac.abort(new DOMException('superseded', 'AbortError'));
    await expect(promise).rejects.toBeDefined();
  });
});
