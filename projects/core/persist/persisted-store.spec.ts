import { afterEach, describe, expect, it, vi } from 'vitest';
import { svPersistedStore } from './persisted-store';
import type { SvRestoreSpec } from './persisted-state';

/**
 * `svPersistedStore` — the storage glue around the persisted-state envelope
 * (`X-6`). Each describe is one of the five concerns in the file header.
 */

interface Pos {
  readonly at: number;
}

const KIND = 'sv-test/pos';
const SPEC: SvRestoreSpec<Pos> = {
  kind: KIND,
  version: 1,
  read: (s) =>
    s && typeof s === 'object' && typeof (s as Record<string, unknown>)['at'] === 'number'
      ? { at: (s as Record<string, number>)['at'] }
      : null,
  migrate: (s, from) => (from === 0 ? SPEC.read(s) : null),
  adoptLegacy: (blob) => (typeof blob['at'] === 'number' ? 0 : null),
};

const env = (at: number, version = 1, kind = KIND) => JSON.stringify({ kind, version, state: { at } });

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('svPersistedStore — SSR / unavailable storage', () => {
  it('loads nothing and saves nothing when there is no storage', () => {
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC, storage: () => null });
    expect(store.load()).toEqual({ state: null, from: null, refusals: [] });
    expect(store.save({ at: 1 })).toBe(false);
    expect(() => store.clear()).not.toThrow();
  });

  it('treats a storage that throws on every call as absent', () => {
    const throwing = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('blocked'); },
    } as unknown as Storage;
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC, storage: () => throwing });
    expect(store.load().state).toBeNull();
    expect(store.save({ at: 1 })).toBe(false);
    expect(() => store.clear()).not.toThrow();
  });

  it('does nothing with an empty key', () => {
    const store = svPersistedStore<Pos>({ key: '', spec: SPEC });
    expect(store.save({ at: 3 })).toBe(false);
    expect(localStorage.length).toBe(0);
  });
});

describe('svPersistedStore — load, legacy keys and refusals', () => {
  it('restores the primary key and reports where it came from', () => {
    localStorage.setItem('k', env(30));
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC });
    expect(store.load()).toEqual({ state: { at: 30 }, from: 'k', refusals: [] });
  });

  it('reports a refused primary blob and does not fall through to legacy keys', () => {
    localStorage.setItem('k', env(30, 2));
    localStorage.setItem('old', env(40));
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC, legacyKeys: ['old'] });
    const loaded = store.load();
    expect(loaded.state).toBeNull();
    expect(loaded.refusals).toEqual([expect.objectContaining({ key: 'k', reason: 'too-new' })]);
    expect(localStorage.getItem('old')).not.toBeNull();
  });

  it('★ tries EACH legacy key in order, skipping refused ones, and moves the winner once', () => {
    localStorage.setItem('bad', env(10, 1, 'sv-other/thing'));
    localStorage.setItem('good', JSON.stringify({ at: 55 }));
    localStorage.setItem('later', env(99));
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC, legacyKeys: () => ['missing', 'bad', 'good', 'later'] });
    const loaded = store.load();
    expect(loaded.state).toEqual({ at: 55 });
    expect(loaded.from).toBe('good');
    expect(loaded.refusals).toEqual([expect.objectContaining({ key: 'bad', reason: 'foreign' })]);
    expect(localStorage.getItem('bad')).not.toBeNull();
    expect(localStorage.getItem('good')).toBeNull();
    expect(localStorage.getItem('later')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('k')!)).toEqual({ kind: KIND, version: 1, state: { at: 55 } });
  });

  it('reports every refused legacy key when none restores', () => {
    localStorage.setItem('a', '"just a string"');
    localStorage.setItem('b', env(1, 5));
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC, legacyKeys: ['a', 'b'] });
    const loaded = store.load();
    expect(loaded.state).toBeNull();
    expect(loaded.refusals.map((r) => [r.key, r.reason])).toEqual([['a', 'malformed'], ['b', 'too-new']]);
  });
});

describe('svPersistedStore — the baseline (never a skip-next-write flag)', () => {
  it('does not write back what it just loaded', () => {
    localStorage.setItem('k', env(30));
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC });
    store.load();
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    store.save({ at: 30 });
    expect(writes).not.toHaveBeenCalled();
  });

  it('markSynced keeps defaults off a refused blob until a real change', () => {
    const future = env(30, 9);
    localStorage.setItem('k', future);
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC });
    store.load();
    store.markSynced({ at: 50 });
    store.save({ at: 50 });
    expect(localStorage.getItem('k')).toBe(future);
    store.save({ at: 60 });
    expect(JSON.parse(localStorage.getItem('k')!).state.at).toBe(60);
  });

  it('★ a clear() that changed nothing never swallows a later change back to the default', () => {
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC });
    store.load();
    store.markSynced({ at: 50 });
    store.clear({ at: 50 }); // reset while already at the default
    expect(localStorage.getItem('k')).toBeNull();

    store.save({ at: 55 });
    expect(JSON.parse(localStorage.getItem('k')!).state.at).toBe(55);
    store.save({ at: 50 });
    expect(JSON.parse(localStorage.getItem('k')!).state.at).toBe(50);
  });

  it('a cleared key is not re-filled with the default it now represents', () => {
    localStorage.setItem('k', env(80));
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC });
    store.load();
    store.clear({ at: 40 });
    store.save({ at: 40 });
    expect(localStorage.getItem('k')).toBeNull();
  });
});

describe('svPersistedStore — cross-tab adoption', () => {
  const event = (newValue: string | null, key = 'k', storageArea: Storage | null = localStorage) =>
    new StorageEvent('storage', { key, newValue, storageArea });

  it('adopts a valid write and does not echo it back', () => {
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC });
    expect(store.adopt(event(env(70)))).toEqual({ at: 70 });
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    store.save({ at: 70 });
    expect(writes).not.toHaveBeenCalled();
  });

  it('★ adopting the current value never swallows a later change back to it', () => {
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC });
    store.adopt(event(env(50)));
    store.save({ at: 55 });
    store.save({ at: 50 });
    expect(JSON.parse(localStorage.getItem('k')!).state.at).toBe(50);
  });

  it.each([
    ['another key', event(env(70), 'other')],
    ['a removal', event(null)],
    ['corrupt JSON', event('{nope')],
    ['a foreign kind', event(env(70, 1, 'sv-other/thing'))],
    ['a too-new version', event(env(70, 4))],
    ['sessionStorage', event(env(70), 'k', sessionStorage)],
  ])('ignores %s', (_label, ev) => {
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC });
    expect(store.adopt(ev)).toBeNull();
  });
});

describe('svPersistedStore — the baseline belongs to one key (X-6)', () => {
  it('writes an unchanged value under a NEW key instead of treating it as already saved', () => {
    let key = 'u1';
    const store = svPersistedStore<Pos>({ key: () => key, spec: SPEC });
    expect(store.save({ at: 40 })).toBe(true);
    expect(localStorage.getItem('u1')).toBe(env(40));

    key = 'u2';
    expect(store.save({ at: 40 })).toBe(true);
    expect(localStorage.getItem('u2')).toBe(env(40));
  });

  it("forgets the baseline when another tab removes the key, so the same value is written again", () => {
    const store = svPersistedStore<Pos>({ key: 'k', spec: SPEC });
    store.save({ at: 40 });
    localStorage.removeItem('k');
    expect(store.adopt(new StorageEvent('storage', { key: 'k', newValue: null, storageArea: localStorage }))).toBeNull();

    store.save({ at: 40 });
    expect(localStorage.getItem('k')).toBe(env(40));
  });
});
