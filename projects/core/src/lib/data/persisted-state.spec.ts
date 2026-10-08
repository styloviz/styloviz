import { svPersistState, svRestoreParams, svRestoreState } from './persisted-state';
import type { SvRestoreSpec } from './persisted-state';

/**
 * The rule under test is the refusal. Reading a blob back is trivial; what six
 * families of component had all skipped is knowing which blobs they must NOT
 * read — a newer one, someone else's, one that says nothing about itself.
 */

interface Layout {
  readonly order: readonly string[];
}

const KIND = 'sv-demo/layout';

/** What a component's own `read` looks like: parse, or say it is not mine. */
const readLayout = (state: unknown): Layout | null => {
  const order = (state as { order?: unknown } | null)?.order;
  return Array.isArray(order) && order.every((x) => typeof x === 'string')
    ? { order: order as string[] }
    : null;
};

const spec = (over: Partial<SvRestoreSpec<Layout>> = {}): SvRestoreSpec<Layout> => ({
  kind: KIND,
  version: 2,
  read: readLayout,
  ...over,
});

describe('svPersistState', () => {
  it('records who wrote the state and against which schema', () => {
    expect(svPersistState(KIND, 2, { order: ['a'] })).toEqual({
      kind: KIND,
      version: 2,
      state: { order: ['a'] },
    });
  });

  it('survives the round trip through storage', () => {
    const stored = JSON.stringify(svPersistState(KIND, 2, { order: ['a', 'b'] }));
    const restored = svRestoreState<Layout>(JSON.parse(stored), spec());
    expect(restored).toEqual({ ok: true, state: { order: ['a', 'b'] }, from: 2 });
  });
});

describe('svRestoreState — what it refuses', () => {
  it.each([
    ['null', null],
    ['a string', '{"order":[]}'],
    ['a number', 7],
    ['an array', [{ order: [] }]],
  ])('refuses %s as malformed', (_label, blob) => {
    const r = svRestoreState<Layout>(blob, spec());
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('malformed');
  });

  /** A query pasted into a table: the shape may even line up. */
  it('refuses another component’s envelope, and names it', () => {
    const r = svRestoreState<Layout>(svPersistState('sv-other/layout', 2, { order: [] }), spec());
    expect(!r.ok && r.reason).toBe('foreign');
    expect(!r.ok && r.detail).toContain('sv-other/layout');
  });

  /**
   * ★ THE BUG THIS EXISTS FOR. A best-effort read of a v3 blob does not fail —
   * it produces a layout the user never arranged, because v3 means something
   * else by the same field name.
   */
  it('refuses a blob from a newer version rather than reading what it can', () => {
    const r = svRestoreState<Layout>(svPersistState(KIND, 3, { order: ['a'] }), spec());
    expect(!r.ok && r.reason).toBe('too-new');
    expect(!r.ok && r.detail).toContain('v3');
  });

  it('refuses a version that is not a whole number above zero', () => {
    for (const version of [0, -1, 1.5, Number.NaN]) {
      const r = svRestoreState<Layout>({ kind: KIND, version, state: {} }, spec());
      expect(!r.ok && r.reason).toBe('malformed');
    }
  });

  /**
   * ★ A matching kind and version say which schema the payload CLAIMS. Anyone
   *   with devtools can edit `localStorage`, and this used to be a cast.
   */
  it('refuses a current-version payload that is not the expected shape', () => {
    for (const state of ['nonsense', 42, null, { order: [1, 2] }, {}]) {
      const r = svRestoreState<Layout>({ kind: KIND, version: 2, state }, spec());
      expect(!r.ok && r.reason).toBe('malformed');
    }
  });

  it('refuses an older blob when the component offers no migration', () => {
    const r = svRestoreState<Layout>(svPersistState(KIND, 1, { order: ['a'] }), spec());
    expect(!r.ok && r.reason).toBe('unmigratable');
  });

  it('refuses an older blob its own migration declines', () => {
    const r = svRestoreState<Layout>(svPersistState(KIND, 1, { order: ['a'] }), spec({
      migrate: () => null,
    }));
    expect(!r.ok && r.reason).toBe('unmigratable');
  });
});

describe('svRestoreState — bringing older state forward', () => {
  it('migrates, and reports the version it came from so the host can re-save', () => {
    const r = svRestoreState<Layout>({ kind: KIND, version: 1, state: { columns: ['a', 'b'] } }, spec({
      migrate: (state, from) => {
        expect(from).toBe(1);
        return { order: (state as { columns: string[] }).columns };
      },
    }));
    expect(r).toEqual({ ok: true, state: { order: ['a', 'b'] }, from: 1 });
  });

  it('does not call migrate for state already at the current version', () => {
    const migrate = vi.fn(() => ({ order: [] }));
    svRestoreState<Layout>(svPersistState(KIND, 2, { order: ['a'] }), spec({ migrate }));
    expect(migrate).not.toHaveBeenCalled();
  });
});

/**
 * Every one of these components shipped its state bare before the envelope
 * existed, so there are stored layouts in the wild with no `kind` at all. This
 * is the one migration that is real today rather than hypothetical.
 */
describe('svRestoreState — adopting pre-envelope blobs', () => {
  const legacy = spec({
    migrate: (state) => readLayout({ order: (state as { columns?: unknown }).columns }),
    adoptLegacy: (blob) => (Array.isArray(blob['columns']) ? 0 : null),
  });

  /** `from: 0` is the signal the host needs: this one must be written back. */
  it('reads a recognised bare blob as version 0, through migrate', () => {
    const r = svRestoreState<Layout>({ columns: ['a'] }, legacy);
    expect(r).toEqual({ ok: true, state: { order: ['a'] }, from: 0 });
  });

  it('still validates what a bare blob contained', () => {
    const r = svRestoreState<Layout>({ columns: [{ id: 'a' }] }, legacy);
    expect(!r.ok && r.reason).toBe('unmigratable');
  });

  it('still refuses a bare blob it does not recognise', () => {
    const r = svRestoreState<Layout>({ somethingElse: true }, legacy);
    expect(!r.ok && r.reason).toBe('malformed');
  });

  /** Without this, a component that never shipped bare would accept any object. */
  it('refuses every bare blob when the component declares no legacy form', () => {
    const r = svRestoreState<Layout>({ order: ['a'] }, spec());
    expect(!r.ok && r.reason).toBe('malformed');
  });
});

describe('svRestoreParams', () => {
  const read = (p: URLSearchParams): Layout => ({ order: p.getAll('c') });
  const paramSpec = { versionParam: 'fv', version: 2 };

  it('reads a link written by this version', () => {
    const r = svRestoreParams(new URLSearchParams('fv=2&c=a&c=b'), paramSpec, read);
    expect(r).toEqual({ ok: true, state: { order: ['a', 'b'] }, from: 2 });
  });

  /** A shared link outliving the release that made it must not silently mislead. */
  it('refuses a link from a newer version', () => {
    const r = svRestoreParams(new URLSearchParams('fv=5&c=a'), paramSpec, read);
    expect(!r.ok && r.reason).toBe('too-new');
  });

  it('refuses a link whose version is not a number', () => {
    const r = svRestoreParams(new URLSearchParams('fv=latest&c=a'), paramSpec, read);
    expect(!r.ok && r.reason).toBe('malformed');
  });

  it('ignores an unversioned link unless the component says how to read one', () => {
    const bare = new URLSearchParams('c=a');
    expect(svRestoreParams(bare, paramSpec, read).ok).toBe(false);
    expect(svRestoreParams(bare, { ...paramSpec, legacyVersion: 2 }, read)).toEqual({
      ok: true,
      state: { order: ['a'] },
      from: 2,
    });
  });

  it('does not call read for parameters it had to migrate', () => {
    const r = svRestoreParams(
      new URLSearchParams('fv=1&cols=a,b'),
      {
        ...paramSpec,
        migrate: (p, from) => (from === 1 ? { order: (p.get('cols') ?? '').split(',') } : null),
      },
      () => {
        throw new Error('read must not see v1 parameters');
      },
    );
    expect(r).toEqual({ ok: true, state: { order: ['a', 'b'] }, from: 1 });
  });
});
