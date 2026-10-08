import { svResetWarnOnce } from '../dev/warn-once';
import {
  SV_UNVIRTUALIZED_ROW_CEILING,
  createTypeahead,
  svCollectionTarget,
  svIsTypeaheadKey,
  svWarnUnvirtualizedCeiling,
} from './collection-keys';

/**
 * `X-10` — keyboard at scale. The arithmetic every collection family shares.
 */
describe('svCollectionTarget', () => {
  it('clamps arrows at the ends by default — the APG collection patterns do not wrap', () => {
    expect(svCollectionTarget('ArrowDown', 5, 4)).toBe(4);
    expect(svCollectionTarget('ArrowUp', 5, 0)).toBe(0);
    expect(svCollectionTarget('ArrowDown', 5, 1)).toBe(2);
    // Nothing focused yet: Down enters at the top, Up at the bottom.
    expect(svCollectionTarget('ArrowDown', 5, -1)).toBe(0);
    expect(svCollectionTarget('ArrowUp', 5, -1)).toBe(4);
  });

  it('keeps svRovingTarget semantics for arrows with wrap: true, and for Home and End', () => {
    expect(svCollectionTarget('ArrowDown', 5, 4, { wrap: true })).toBe(0);
    expect(svCollectionTarget('ArrowUp', 5, 0, { wrap: true })).toBe(4);
    expect(svCollectionTarget('Home', 5, 3)).toBe(0);
    expect(svCollectionTarget('End', 5, 1)).toBe(4);
  });

  it('jumps a page and clamps at the ends — never wraps', () => {
    expect(svCollectionTarget('PageDown', 50_000, 0, { pageSize: 10 })).toBe(10);
    expect(svCollectionTarget('PageDown', 50_000, 49_995, { pageSize: 10 })).toBe(49_999);
    expect(svCollectionTarget('PageUp', 50_000, 4, { pageSize: 10 })).toBe(0);
    expect(svCollectionTarget('PageUp', 50_000, 30, { pageSize: 10 })).toBe(20);
  });

  it('defaults the page to 10 and floors a page below 1 to 1', () => {
    expect(svCollectionTarget('PageDown', 100, 0)).toBe(10);
    expect(svCollectionTarget('PageDown', 100, 0, { pageSize: 0 })).toBe(1);
  });

  it('returns null for an empty collection and for keys it does not own', () => {
    expect(svCollectionTarget('PageDown', 0, 0)).toBeNull();
    expect(svCollectionTarget('a', 10, 0)).toBeNull();
    expect(svCollectionTarget('Tab', 10, 0)).toBeNull();
  });
});

describe('createTypeahead', () => {
  const items = ['Alpha', 'Beta', 'Bravo', 'Charlie', 'bundle'];
  const make = () => {
    let t = 0;
    const clock = { advance: (ms: number) => (t += ms) };
    const ta = createTypeahead<string>({ labelOf: (s) => s, timeoutMs: 500, now: () => t });
    return { ta, clock };
  };

  it('moves to the next item starting with the typed letter, case-insensitively', () => {
    const { ta } = make();
    expect(ta.handle('b', items, 0)).toBe(1);
  });

  it('cycles through matches when the same letter is repeated', () => {
    const { ta, clock } = make();
    expect(ta.handle('b', items, 0)).toBe(1);
    clock.advance(100);
    expect(ta.handle('b', items, 1)).toBe(2);
    clock.advance(100);
    expect(ta.handle('b', items, 2)).toBe(4);
    clock.advance(100);
    expect(ta.handle('b', items, 4)).toBe(1);
  });

  it('refines a prefix typed within the timeout', () => {
    const { ta, clock } = make();
    expect(ta.handle('b', items, 0)).toBe(1);
    clock.advance(100);
    expect(ta.handle('u', items, 1)).toBe(4);
  });

  it('starts a new prefix after the timeout', () => {
    const { ta, clock } = make();
    ta.handle('b', items, 0);
    clock.advance(600);
    expect(ta.handle('c', items, 1)).toBe(3);
  });

  it('returns null when nothing matches or the key is not a character', () => {
    const { ta } = make();
    expect(ta.handle('z', items, 0)).toBeNull();
    expect(ta.handle('ArrowDown', items, 0)).toBeNull();
  });

  it('svIsTypeaheadKey accepts printable characters only', () => {
    const k = (key: string, mod: Partial<KeyboardEvent> = {}) =>
      svIsTypeaheadKey({ key, ctrlKey: false, metaKey: false, altKey: false, ...mod });
    expect(k('a')).toBe(true);
    expect(k(' ')).toBe(false);
    expect(k('Enter')).toBe(false);
    expect(k('a', { ctrlKey: true })).toBe(false);
    expect(k('a', { target: document.createElement('input') })).toBe(false);
    expect(k('a', { target: document.createElement('button') })).toBe(true);
    const box = document.createElement('input');
    box.type = 'checkbox';
    expect(k('a', { target: box })).toBe(true);
  });
});

describe('svWarnUnvirtualizedCeiling', () => {
  afterEach(() => svResetWarnOnce());

  it('is past the ceiling only when unvirtualized and above it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(svWarnUnvirtualizedCeiling('sv-x', SV_UNVIRTUALIZED_ROW_CEILING, false)).toBe(false);
    expect(svWarnUnvirtualizedCeiling('sv-x', SV_UNVIRTUALIZED_ROW_CEILING + 1, true)).toBe(false);
    expect(svWarnUnvirtualizedCeiling('sv-x', SV_UNVIRTUALIZED_ROW_CEILING + 1, false)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
