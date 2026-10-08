import { resolveItemKey, trackByItemKey, warnOnDuplicateItemKeys } from './item-key';

interface Row {
  readonly id: string;
  readonly rev?: number;
}

describe('resolveItemKey', () => {
  /**
   * The fallback path warns, deliberately — a list silently tracking by index
   * is how focus jumps and the wrong row looks selected. Two tests below
   * provoke it, so the warning is captured and asserted instead of printed:
   * a passing suite that shouts on every run teaches people to ignore it.
   */
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('reads a named property', () => {
    expect(resolveItemKey({ id: 'a' }, 'id', 3)).toBe('a');
  });

  it('accepts numeric keys', () => {
    expect(resolveItemKey({ id: 42 }, 'id', 0)).toBe(42);
  });

  it('calls a key function with the item and its index', () => {
    const key = resolveItemKey<Row>({ id: 'a', rev: 2 }, (r, i) => `${r.id}:${r.rev}:${i}`, 5);
    expect(key).toBe('a:2:5');
  });

  it('falls back to the index when the key is absent', () => {
    expect(resolveItemKey({ id: 'a' }, 'missing', 7)).toBe(7);
    expect(resolveItemKey({ id: 'a' }, null, 7)).toBe(7);
    expect(resolveItemKey({ id: 'a' }, '', 7)).toBe(7);
    // Only the named-but-missing key is worth warning about: `null`/`''` mean
    // "no key configured", which is a choice, not a mistake.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('falling back to the list index'));
  });

  it('falls back when the property is not a string or number', () => {
    expect(resolveItemKey({ id: { nested: true } }, 'id', 2)).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not a string/number'));
  });

  it('survives a null item rather than throwing mid-render', () => {
    expect(resolveItemKey(null, 'id', 4)).toBe(4);
  });
});

describe('trackByItemKey', () => {
  it('produces a track function in Angular argument order', () => {
    const track = trackByItemKey<Row>('id');
    expect(track(0, { id: 'x' })).toBe('x');
  });

  it('gives distinct keys to reordered rows, which $index cannot', () => {
    const track = trackByItemKey<Row>('id');
    const before = [{ id: 'a' }, { id: 'b' }];
    const after = [{ id: 'b' }, { id: 'a' }];
    expect(before.map((r, i) => track(i, r))).toEqual(['a', 'b']);
    expect(after.map((r, i) => track(i, r))).toEqual(['b', 'a']);
  });
});

describe('warnOnDuplicateItemKeys', () => {
  /**
   * Every test here uses its own `context` string, because the memo that stops a
   * 500-row list logging 500 times is module-level: a shared context would let
   * one test's warning suppress the next test's and pass for the wrong reason.
   */
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('names the colliding key and the component that was handed it', () => {
    // The whole point: NG0955 names neither, and arrives after the view is gone.
    warnOnDuplicateItemKeys([{ id: 'a' }, { id: 'b' }, { id: 'a' }], 'id', 'sv-x [rows]');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sv-x [rows]'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"a"'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NG0955'));
  });

  it('says nothing when every key is unique', () => {
    warnOnDuplicateItemKeys([{ id: 'a' }, { id: 'b' }], 'id', 'sv-unique [rows]');
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns once per context however often the collection is re-derived', () => {
    // It is called from a computed, so it re-runs on every change to the rows.
    const rows = [{ id: 'a' }, { id: 'a' }];
    for (let i = 0; i < 5; i++) warnOnDuplicateItemKeys(rows, 'id', 'sv-repeat [rows]');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('catches a collision a key function creates that the raw fields do not', () => {
    // Two distinct orders, one composite key: the function dropped a field.
    warnOnDuplicateItemKeys(
      [{ id: 'a', rev: 1 }, { id: 'a', rev: 2 }],
      (r: Row) => r.id,
      'sv-composite [rows]',
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not scan a collection too short to collide', () => {
    // Cheap guard, but it also keeps the diagnostic off the empty-and-single-row
    // paths that every table renders on its way to having data.
    warnOnDuplicateItemKeys([], 'id', 'sv-empty [rows]');
    warnOnDuplicateItemKeys([{ id: 'a' }], 'id', 'sv-one [rows]');
    warnOnDuplicateItemKeys(null, 'id', 'sv-null [rows]');
    expect(warn).not.toHaveBeenCalled();
  });

  it('is silent in production builds', () => {
    vi.stubGlobal('ngDevMode', false);
    try {
      warnOnDuplicateItemKeys([{ id: 'a' }, { id: 'a' }], 'id', 'sv-prod [rows]');
      expect(warn).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('resolveItemKey — production builds', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('still falls back to the index but says nothing', () => {
    // The warning is a development aid. In a production bundle `ngDevMode` is
    // false and the console must stay clean — a library that logs on every
    // render of a misconfigured list is worse than one that stays quiet, and
    // the fallback behaviour itself must not change with the build mode.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('ngDevMode', false);
    try {
      // A key name no other test in this file uses, so the module-level
      // "warn once per key" memo cannot be what makes this pass.
      expect(resolveItemKey({ other: 1 }, 'prodOnlyKey', 4)).toBe(4);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
