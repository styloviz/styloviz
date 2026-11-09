import { svMergeRecords, svOrderRecords, type SvMergeableRecord } from './record-merge';

/**
 * `X-12` / `OF-10-M1` / `OF-10-M5` — the four questions a realtime list asks.
 *
 * No Angular and no DOM here: this is arithmetic on arrays, which is what
 * makes it worth testing exhaustively. Every timestamp below is written out so
 * the expected order is readable from the test rather than inferred.
 */

interface Row extends SvMergeableRecord {
  readonly title: string;
}

const row = (id: string, extra: Partial<Row> = {}): Row => ({
  id,
  title: id,
  ...extra,
});

describe('svOrderRecords', () => {
  it('puts newest first by timestamp', () => {
    const list = svOrderRecords([
      row('a', { timestamp: '2026-09-01T10:00:00Z' }),
      row('b', { timestamp: '2026-09-03T10:00:00Z' }),
      row('c', { timestamp: '2026-09-02T10:00:00Z' }),
    ]);
    expect(list.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('puts pinned records first whatever their date', () => {
    const list = svOrderRecords([
      row('new', { timestamp: '2026-09-09T10:00:00Z' }),
      row('old-pinned', { timestamp: '2020-01-01T10:00:00Z', pinned: true }),
    ]);
    expect(list.map((r) => r.id)).toEqual(['old-pinned', 'new']);
  });

  it('orders pinned records among themselves by date', () => {
    const list = svOrderRecords([
      row('p1', { timestamp: '2026-01-01T00:00:00Z', pinned: true }),
      row('p2', { timestamp: '2026-05-01T00:00:00Z', pinned: true }),
      row('plain', { timestamp: '2026-09-01T00:00:00Z' }),
    ]);
    expect(list.map((r) => r.id)).toEqual(['p2', 'p1', 'plain']);
  });

  it('uses seq when every record has one', () => {
    const list = svOrderRecords([
      // The timestamps disagree with the sequence on purpose: a server clock
      // and a stream position are not the same thing.
      row('a', { seq: 1, timestamp: '2026-09-09T10:00:00Z' }),
      row('b', { seq: 3, timestamp: '2026-09-01T10:00:00Z' }),
      row('c', { seq: 2, timestamp: '2026-09-05T10:00:00Z' }),
    ]);
    expect(list.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('★ ignores seq unless EVERY record has one', () => {
    // Deciding per pair — "use seq if both have it" — makes the comparator
    // intransitive, and a sort with an intransitive comparator returns a
    // different answer depending on the array's starting arrangement.
    const list = svOrderRecords([
      row('a', { seq: 99, timestamp: '2020-01-01T00:00:00Z' }),
      row('b', { timestamp: '2026-09-09T00:00:00Z' }),
    ]);
    expect(list.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('★ sorts an unparseable timestamp last instead of returning NaN', () => {
    // `new Date('n/a').getTime()` is NaN, and a comparator that returns NaN
    // makes the sort's result implementation-defined: the same data renders in
    // a different order from one pass to the next.
    const list = svOrderRecords([
      row('bad', { timestamp: 'n/a' }),
      row('good', { timestamp: '2026-09-01T10:00:00Z' }),
      row('older', { timestamp: '2020-09-01T10:00:00Z' }),
    ]);
    expect(list.map((r) => r.id)).toEqual(['good', 'older', 'bad']);
  });

  it('★ gives records that tie exactly ONE order, by id', () => {
    // Without a final tiebreak, equal rows swap places whenever anything else
    // about the list changes, and a user watching a live list sees rows twitch.
    const t = '2026-09-01T10:00:00Z';
    const forwards  = svOrderRecords([row('b', { timestamp: t }), row('a', { timestamp: t })]);
    const backwards = svOrderRecords([row('a', { timestamp: t }), row('b', { timestamp: t })]);
    expect(forwards.map((r) => r.id)).toEqual(['a', 'b']);
    expect(backwards.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('does not mutate the input', () => {
    const input = [row('a', { timestamp: '2020-01-01T00:00:00Z' }), row('b', { timestamp: '2026-01-01T00:00:00Z' })];
    svOrderRecords(input);
    expect(input.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('handles an empty list', () => {
    expect(svOrderRecords([])).toEqual([]);
  });
});

describe('svMergeRecords — identity', () => {
  it('adds records it has not seen', () => {
    const out = svMergeRecords([row('a')], [row('b')]);
    expect(out.items.map((r) => r.id)).toEqual(['a', 'b']);
    expect(out.added.map((r) => r.id)).toEqual(['b']);
  });

  it('replaces a record with the same id rather than appending it', () => {
    const out = svMergeRecords([row('a', { title: 'old' })], [row('a', { title: 'new' })]);
    expect(out.items).toHaveLength(1);
    expect(out.items[0].title).toBe('new');
    expect(out.updated.map((r) => r.id)).toEqual(['a']);
  });

  it('★ collapses a duplicate id already in the current list', () => {
    // A naive append produces this, and Angular's @for THROWS on a duplicate
    // track key — the panel is already broken by the time it reaches here.
    const out = svMergeRecords([row('a', { title: 'first' }), row('a', { title: 'second' })], []);
    expect(out.items).toHaveLength(1);
    expect(out.items[0].title).toBe('second');
  });

  it('★ resolves a duplicate id inside the current list by version, not position', () => {
    // A replay that appended an older revision after a newer one is the exact
    // case this exists for, and position is not evidence.
    const out = svMergeRecords(
      [row('a', { version: 5, title: 'v5' }), row('a', { version: 2, title: 'v2' })],
      [],
    );
    expect(out.items).toHaveLength(1);
    expect(out.items[0].title).toBe('v5');
  });

  it('keeps the object identity of records nothing changed', () => {
    const untouched = row('a');
    const out = svMergeRecords([untouched], [row('b')]);
    expect(out.items.find((r) => r.id === 'a')).toBe(untouched);
  });

  it('does not mutate the current list', () => {
    const current = [row('a')];
    svMergeRecords(current, [row('b')]);
    expect(current).toHaveLength(1);
  });
});

describe('svMergeRecords — version', () => {
  it('accepts a higher version', () => {
    const out = svMergeRecords(
      [row('a', { version: 1, title: 'v1' })],
      [row('a', { version: 2, title: 'v2' })],
    );
    expect(out.items[0].title).toBe('v2');
    expect(out.rejected).toEqual([]);
  });

  it('★ rejects a lower version instead of letting the row go backwards', () => {
    const out = svMergeRecords(
      [row('a', { version: 5, title: 'v5' })],
      [row('a', { version: 2, title: 'v2' })],
    );
    expect(out.items[0].title).toBe('v5');
    expect(out.rejected.map((r) => r.version)).toEqual([2]);
    expect(out.updated).toEqual([]);
  });

  it('rejects an EQUAL version — a redelivery is not news', () => {
    const held = row('a', { version: 3, title: 'held' });
    const out = svMergeRecords([held], [row('a', { version: 3, title: 'again' })]);
    // Same object back: replacing it would re-render a row the user may be
    // interacting with, for no change.
    expect(out.items[0]).toBe(held);
    expect(out.rejected).toHaveLength(1);
  });

  it('accepts an incoming record with no version at all', () => {
    // "No version" means the source does not version, not that the record is
    // old. Refusing it would freeze that row for the life of the session.
    const out = svMergeRecords(
      [row('a', { version: 9, title: 'held' })],
      [row('a', { title: 'unversioned' })],
    );
    expect(out.items[0].title).toBe('unversioned');
  });

  it('accepts a versioned record over an unversioned one it holds', () => {
    const out = svMergeRecords([row('a', { title: 'held' })], [row('a', { version: 1, title: 'fresh' })]);
    expect(out.items[0].title).toBe('fresh');
  });

  it('reports a stale delivery rather than swallowing it', () => {
    const out = svMergeRecords(
      [row('a', { version: 5 })],
      [row('a', { version: 1 }), row('a', { version: 2 }), row('b', { version: 1 })],
    );
    expect(out.rejected.map((r) => r.version)).toEqual([1, 2]);
    expect(out.added.map((r) => r.id)).toEqual(['b']);
  });
});

describe('svMergeRecords — deduplication', () => {
  it('collapses records that share a dedupeKey', () => {
    const out = svMergeRecords(
      [],
      [
        row('c1', { dedupeKey: 'ticket-14', timestamp: '2026-09-01T10:00:00Z' }),
        row('c2', { dedupeKey: 'ticket-14', timestamp: '2026-09-02T10:00:00Z' }),
        row('c3', { dedupeKey: 'ticket-14', timestamp: '2026-09-03T10:00:00Z' }),
      ],
    );
    expect(out.items.map((r) => r.id)).toEqual(['c3']);
    expect(out.collapsed.map((r) => r.id)).toEqual(['c2', 'c1']);
  });

  it('★ keeps the survivor the user would see first, not the first to arrive', () => {
    const out = svMergeRecords(
      [row('old', { dedupeKey: 'k', timestamp: '2020-01-01T00:00:00Z' })],
      [row('new', { dedupeKey: 'k', timestamp: '2026-09-09T00:00:00Z' })],
    );
    expect(out.items.map((r) => r.id)).toEqual(['new']);
  });

  it('keeps a pinned record as the survivor of its group', () => {
    const out = svMergeRecords(
      [],
      [
        row('plain', { dedupeKey: 'k', timestamp: '2026-09-09T00:00:00Z' }),
        row('pinned', { dedupeKey: 'k', timestamp: '2020-01-01T00:00:00Z', pinned: true }),
      ],
    );
    expect(out.items.map((r) => r.id)).toEqual(['pinned']);
  });

  it('leaves records without a dedupeKey alone', () => {
    const out = svMergeRecords([], [row('a'), row('b'), row('c')]);
    expect(out.items).toHaveLength(3);
    expect(out.collapsed).toEqual([]);
  });

  it('does not collapse different keys', () => {
    const out = svMergeRecords([], [row('a', { dedupeKey: 'x' }), row('b', { dedupeKey: 'y' })]);
    expect(out.items).toHaveLength(2);
  });

  it('collapse: false keeps every record', () => {
    const out = svMergeRecords(
      [],
      [row('a', { dedupeKey: 'k' }), row('b', { dedupeKey: 'k' })],
      { collapse: false },
    );
    expect(out.items).toHaveLength(2);
    expect(out.collapsed).toEqual([]);
  });

  it('writes no count onto the survivor — the headline is the host’s copy', () => {
    const out = svMergeRecords([], [row('a', { dedupeKey: 'k' }), row('b', { dedupeKey: 'k' })]);
    expect(out.items[0]).not.toHaveProperty('count');
    // The dropped records come back instead, so the host can write "and 1 more".
    expect(out.collapsed).toHaveLength(1);
  });
});

describe('svMergeRecords — order of the result', () => {
  it('returns the merged list already ordered', () => {
    const out = svMergeRecords(
      [row('a', { timestamp: '2026-09-01T10:00:00Z' })],
      [row('b', { timestamp: '2026-09-05T10:00:00Z' })],
    );
    expect(out.items.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('re-orders a record whose update moved it', () => {
    const out = svMergeRecords(
      [
        row('a', { version: 1, timestamp: '2026-09-01T10:00:00Z' }),
        row('b', { version: 1, timestamp: '2026-09-05T10:00:00Z' }),
      ],
      [row('a', { version: 2, timestamp: '2026-09-09T10:00:00Z' })],
    );
    expect(out.items.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('merging nothing into nothing is empty, not a throw', () => {
    const out = svMergeRecords<Row>([], []);
    expect(out.items).toEqual([]);
    expect(out.added).toEqual([]);
  });
});
