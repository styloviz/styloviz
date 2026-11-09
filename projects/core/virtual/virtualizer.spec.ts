import { signal } from '@angular/core';
import { createVariableVirtualizer, createVirtualizer } from './virtualizer';

interface Row {
  readonly id: number;
}

const rows = (n: number): Row[] => Array.from({ length: n }, (_, id) => ({ id }));

/** 1000 rows, 20px tall, 200px viewport → 10 rows visible. */
function setup(over: Partial<Record<'count' | 'itemHeight' | 'viewportHeight' | 'overscan', number>> = {}) {
  const items = signal<readonly Row[]>(rows(over.count ?? 1000));
  const itemHeight = signal(over.itemHeight ?? 20);
  const viewportHeight = signal(over.viewportHeight ?? 200);
  const overscan = signal(over.overscan ?? 0);
  const enabled = signal(true);
  const v = createVirtualizer<Row>({ items, itemHeight, viewportHeight, overscan, enabled });
  return { v, items, itemHeight, viewportHeight, overscan, enabled };
}

describe('createVirtualizer — windowing', () => {
  it('starts at the top of the list', () => {
    const { v } = setup();
    expect(v.range()).toEqual({ start: 0, end: 10 });
    expect(v.items()).toHaveLength(10);
    expect(v.items()[0].id).toBe(0);
  });

  it('moves the window as the viewport scrolls', () => {
    const { v } = setup();
    v.setScrollTop(400); // row 20
    expect(v.range()).toEqual({ start: 20, end: 30 });
    expect(v.items()[0].id).toBe(20);
  });

  it('renders the partial rows at both edges when the scroll is unaligned', () => {
    const { v } = setup();
    v.setScrollTop(410); // straddles rows 20 and 30
    const { start, end } = v.range();
    expect(start).toBe(20);
    // 410..610 touches row 20 (partial) through row 30 (partial) — 11 rows.
    expect(end).toBe(31);
  });

  it('pads the window by the overscan on both sides', () => {
    const { v } = setup({ overscan: 3 });
    v.setScrollTop(400);
    expect(v.range()).toEqual({ start: 17, end: 33 });
  });

  it('clamps the window to the start of the list', () => {
    const { v } = setup({ overscan: 5 });
    expect(v.range().start).toBe(0);
  });

  it('clamps the window to the end of the list', () => {
    const { v } = setup({ count: 25, overscan: 5 });
    v.setScrollTop(10_000);
    const { start, end } = v.range();
    expect(end).toBe(25);
    expect(start).toBeLessThanOrEqual(end);
    expect(v.items().at(-1)?.id).toBe(24);
  });

  it('handles an empty list without producing a negative range', () => {
    const { v } = setup({ count: 0 });
    expect(v.range()).toEqual({ start: 0, end: 0 });
    expect(v.items()).toEqual([]);
    expect(v.totalHeight()).toBe(0);
  });

  it('returns the whole list when disabled', () => {
    const { v, enabled } = setup();
    enabled.set(false);
    expect(v.range()).toEqual({ start: 0, end: 1000 });
    expect(v.items()).toHaveLength(1000);
    expect(v.topSpacer()).toBe(0);
    expect(v.bottomSpacer()).toBe(0);
  });

  it('defaults to enabled with a small overscan when the options are omitted', () => {
    const v = createVirtualizer<Row>({
      items: signal<readonly Row[]>(rows(100)),
      itemHeight: signal(20),
      viewportHeight: signal(200),
    });
    expect(v.range()).toEqual({ start: 0, end: 12 });
  });
});

describe('createVirtualizer — geometry', () => {
  it('spacers plus rendered rows always equal the full height', () => {
    const { v } = setup();
    for (const top of [0, 137, 400, 9_999, 19_800]) {
      v.setScrollTop(top);
      const { start, end } = v.range();
      const rendered = (end - start) * 20;
      expect(v.topSpacer() + rendered + v.bottomSpacer()).toBe(v.totalHeight());
    }
  });

  it('reports the scrollable extent of the full list', () => {
    const { v } = setup({ count: 500, itemHeight: 32 });
    expect(v.totalHeight()).toBe(16_000);
  });

  it('locates a row for scroll-to-index', () => {
    const { v } = setup({ itemHeight: 32 });
    expect(v.offsetOf(10)).toBe(320);
    expect(v.offsetOf(-5)).toBe(0);
  });
});

describe('createVirtualizer — hostile inputs', () => {
  it('survives a zero or negative row height instead of dividing by zero', () => {
    const { v, itemHeight } = setup();
    for (const h of [0, -20, Number.NaN]) {
      itemHeight.set(h);
      expect(Number.isFinite(v.range().start)).toBe(true);
      expect(Number.isFinite(v.range().end)).toBe(true);
      expect(v.range().end).toBeLessThanOrEqual(1000);
    }
  });

  it('clamps a negative scroll offset from overscroll bounce', () => {
    const { v } = setup();
    v.setScrollTop(-120);
    expect(v.scrollTop()).toBe(0);
    expect(v.range().start).toBe(0);
  });

  it('ignores a non-finite scroll offset', () => {
    const { v } = setup();
    v.setScrollTop(200);
    v.setScrollTop(Number.NaN);
    expect(v.scrollTop()).toBe(0);
  });

  it('treats a zero-height viewport as showing nothing but stays valid', () => {
    const { v, viewportHeight } = setup({ overscan: 0 });
    viewportHeight.set(0);
    v.setScrollTop(400);
    const { start, end } = v.range();
    expect(end).toBeGreaterThanOrEqual(start);
  });

  it('reads the offset off the scrolled element', () => {
    const { v } = setup();
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollTop', { value: 600, writable: true });
    v.onScroll({ target: el } as unknown as Event);
    expect(v.scrollTop()).toBe(600);
    expect(v.range().start).toBe(30);
  });
});

describe('createVirtualizer — reactivity', () => {
  it('re-windows when the list shrinks under the current scroll position', () => {
    const { v, items } = setup();
    v.setScrollTop(19_000);
    expect(v.range().start).toBe(950);

    items.set(rows(10));
    const { start, end } = v.range();
    expect(end).toBe(10);
    expect(start).toBeLessThanOrEqual(end);
    expect(v.bottomSpacer()).toBeGreaterThanOrEqual(0);
  });

  it('re-windows when the row height changes', () => {
    const { v, itemHeight } = setup();
    v.setScrollTop(400);
    expect(v.range().start).toBe(20);
    itemHeight.set(40);
    expect(v.range().start).toBe(10);
  });

  it('returns the original array reference when the window covers everything', () => {
    const { v, items } = setup({ count: 5 });
    expect(v.items()).toBe(items());
  });
});

describe('createVirtualizer — onScroll', () => {
  it('reads the offset off the event target', () => {
    const { v } = setup();
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollTop', { value: 400, configurable: true });
    v.onScroll({ target: el } as unknown as Event);
    expect(v.scrollTop()).toBe(400);
  });

  it('clamps the negative offset iOS overscroll reports', () => {
    const { v } = setup();
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollTop', { value: -60, configurable: true });
    v.onScroll({ target: el } as unknown as Event);
    expect(v.scrollTop()).toBe(0);
  });

  it('falls back to the top for an event with no target', () => {
    // A scroll can arrive with a detached or null target — a listener bound on
    // `document` sees them. Reading `.scrollTop` off null would throw inside a
    // DOM listener, where no component can catch it.
    const { v } = setup();
    v.setScrollTop(400);
    expect(() => v.onScroll({ target: null } as unknown as Event)).not.toThrow();
    expect(v.scrollTop()).toBe(0);
  });
});

/**
 * ============================================================================
 *  `onNearEnd` — the infinite-scroll delta A0 pulled out of `list-view`
 * ============================================================================
 *
 * ★ Extracted so `list-view`'s "am I near the bottom" arithmetic is written
 * once and shared by every future virtualized, infinite-scrolling consumer
 * (A2's data-table, E3's `select-dropdown`) instead of re-derived per
 * component. `list-view.scrolling.spec.ts` covers the pagination policy
 * layered on top (`hasMore` / `loadingMore` / the in-tick guard); these tests
 * cover only the geometry this primitive owns.
 */
describe('createVirtualizer — onNearEnd', () => {
  const scrollEl = (scrollTop: number, clientHeight: number, scrollHeight: number) =>
    ({ target: { scrollTop, clientHeight, scrollHeight } }) as unknown as Event;

  function armed(nearEndThreshold?: number) {
    const items = signal<readonly Row[]>(rows(1000));
    const itemHeight = signal(20);
    const viewportHeight = signal(200);
    const calls: void[] = [];
    const v = createVirtualizer<Row>({
      items,
      itemHeight,
      viewportHeight,
      onNearEnd: () => calls.push(undefined),
      ...(nearEndThreshold === undefined ? {} : { nearEndThreshold: signal(nearEndThreshold) }),
    });
    return { v, calls };
  }

  it('fires when the scroll lands within the threshold of the bottom', () => {
    const { v, calls } = armed();
    v.onScroll(scrollEl(900, 200, 1050)); // 900 + 200 = 1100 >= 1050 - 100
    expect(calls).toHaveLength(1);
  });

  it('stays quiet nowhere near the bottom', () => {
    const { v, calls } = armed();
    v.onScroll(scrollEl(0, 200, 5000));
    expect(calls).toEqual([]);
  });

  it('respects a custom threshold', () => {
    const { v, calls } = armed(500);
    // 500 + 200 = 700, which is within 500px of 1050 (>= 550) but was NOT
    // within the default 100px (>= 950) — proves the threshold is read, not
    // hard-coded.
    v.onScroll(scrollEl(500, 200, 1050));
    expect(calls).toHaveLength(1);
  });

  it('never fires when no callback was supplied', () => {
    // The default: every existing `createVirtualizer` call site that has not
    // opted in must see zero behavioural change.
    const items = signal<readonly Row[]>(rows(1000));
    const v = createVirtualizer<Row>({
      items,
      itemHeight: signal(20),
      viewportHeight: signal(200),
    });
    expect(() => v.onScroll(scrollEl(900, 200, 1050))).not.toThrow();
  });

  it('does not throw for an event with no target', () => {
    const { v, calls } = armed();
    expect(() => v.onScroll({ target: null } as unknown as Event)).not.toThrow();
    expect(calls).toEqual([]);
  });

  it('fires on every qualifying event — de-duping within a tick is the caller\'s job', () => {
    // `list-view.scrolling.spec.ts` pins the in-tick guard at the consumer
    // level (`loadingGuard` + `queueMicrotask`); this primitive is not where
    // that policy belongs, so it must not silently apply one of its own.
    const { v, calls } = armed();
    v.onScroll(scrollEl(900, 200, 1050));
    v.onScroll(scrollEl(900, 200, 1050));
    v.onScroll(scrollEl(900, 200, 1050));
    expect(calls).toHaveLength(3);
  });
});

/**
 * ============================================================================
 *  `createVariableVirtualizer` — `createVirtualizer`'s variable-height sibling
 * ============================================================================
 */
describe('createVariableVirtualizer', () => {
  /** Row `i` is `10 + (i % 3) * 10` px tall: 10, 20, 30, 10, 20, 30, … */
  const cyclicSize = (i: number): number => 10 + (i % 3) * 10;

  function setupVariable(over: Partial<{
    count: number;
    viewportHeight: number;
    overscan: number;
    size: (i: number, item: Row) => number;
  }> = {}) {
    const items = signal<readonly Row[]>(rows(over.count ?? 300));
    const itemSize = signal(over.size ?? ((i: number) => cyclicSize(i)));
    const viewportHeight = signal(over.viewportHeight ?? 100);
    const overscan = signal(over.overscan ?? 0);
    const enabled = signal(true);
    const v = createVariableVirtualizer<Row>({ items, itemSize, viewportHeight, overscan, enabled });
    return { v, items, itemSize, viewportHeight, overscan, enabled };
  }

  /** Sum of `cyclicSize(0..n)`, computed the same honest way the code must. */
  const cyclicOffset = (n: number): number => {
    let total = 0;
    for (let i = 0; i < n; i++) total += cyclicSize(i);
    return total;
  };

  describe('uniform sizes degenerate to the fixed-height answer', () => {
    it('matches createVirtualizer row-for-row when every row is the same height', () => {
      const items = signal<readonly Row[]>(rows(1000));
      const fixed = createVirtualizer<Row>({
        items,
        itemHeight: signal(20),
        viewportHeight: signal(200),
        overscan: signal(3),
      });
      const variable = createVariableVirtualizer<Row>({
        items,
        itemSize: signal(() => 20),
        viewportHeight: signal(200),
        overscan: signal(3),
      });

      for (const top of [0, 137, 400, 9_999, 19_800]) {
        fixed.setScrollTop(top);
        variable.setScrollTop(top);
        expect(variable.range()).toEqual(fixed.range());
        expect(variable.totalHeight()).toBe(fixed.totalHeight());
        expect(variable.topSpacer()).toBe(fixed.topSpacer());
        expect(variable.bottomSpacer()).toBe(fixed.bottomSpacer());
      }
    });
  });

  describe('windowing', () => {
    it('starts at the top of the list', () => {
      const { v } = setupVariable();
      // Viewport 100px: rows 0(10)+1(20)+2(30)+3(10)=70, +4(20)=90, +5(30)=120 — row 5 is
      // the first entirely past 100, so end = 6.
      expect(v.range()).toEqual({ start: 0, end: 6 });
    });

    it('moves the window as the viewport scrolls, honouring the real row sizes', () => {
      const { v } = setupVariable();
      const offsetOfRow10 = cyclicOffset(10);
      v.setScrollTop(offsetOfRow10);
      expect(v.range().start).toBe(10);
    });

    it('reports the exact same total height as summing every row by hand', () => {
      const { v } = setupVariable({ count: 300 });
      expect(v.totalHeight()).toBe(cyclicOffset(300));
    });

    it('pads the window by the overscan on both sides', () => {
      const { v } = setupVariable({ overscan: 2 });
      v.setScrollTop(cyclicOffset(10));
      const unpadded = setupVariable();
      unpadded.v.setScrollTop(cyclicOffset(10));
      const { start, end } = v.range();
      const base = unpadded.v.range();
      expect(start).toBe(Math.max(0, base.start - 2));
      expect(end).toBe(Math.min(300, base.end + 2));
    });

    it('clamps the window to the end of the list', () => {
      const { v } = setupVariable({ count: 25 });
      v.setScrollTop(1_000_000);
      const { start, end } = v.range();
      expect(end).toBe(25);
      expect(start).toBeLessThanOrEqual(end);
      expect(v.items().at(-1)?.id).toBe(24);
    });

    it('handles an empty list without producing a negative range', () => {
      const { v } = setupVariable({ count: 0 });
      expect(v.range()).toEqual({ start: 0, end: 0 });
      expect(v.items()).toEqual([]);
      expect(v.totalHeight()).toBe(0);
    });

    it('returns the whole list when disabled', () => {
      const { v, enabled } = setupVariable({ count: 300 });
      enabled.set(false);
      expect(v.range()).toEqual({ start: 0, end: 300 });
      expect(v.items()).toHaveLength(300);
      expect(v.topSpacer()).toBe(0);
      expect(v.bottomSpacer()).toBe(0);
    });

    it('returns the original array reference when the window covers everything', () => {
      const { v, items } = setupVariable({ count: 5, viewportHeight: 100_000 });
      expect(v.items()).toBe(items());
    });
  });

  describe('geometry', () => {
    it('spacers plus rendered rows always equal the full height', () => {
      const { v } = setupVariable({ count: 300 });
      for (const top of [0, 137, 400, 2_000, 5_900]) {
        v.setScrollTop(top);
        const { start, end } = v.range();
        let rendered = 0;
        for (let i = start; i < end; i++) rendered += cyclicSize(i);
        expect(v.topSpacer() + rendered + v.bottomSpacer()).toBe(v.totalHeight());
      }
    });

    it('locates a row for scroll-to-index using the real cumulative offset', () => {
      const { v } = setupVariable();
      expect(v.offsetOf(10)).toBe(cyclicOffset(10));
      expect(v.offsetOf(-5)).toBe(0);
    });

    it('clamps an out-of-range index to the end of the list rather than extrapolating', () => {
      const { v } = setupVariable({ count: 25 });
      expect(v.offsetOf(1000)).toBe(v.totalHeight());
    });
  });

  describe('hostile inputs', () => {
    it('survives a zero, negative or non-finite row size instead of collapsing the offsets', () => {
      const { v, itemSize } = setupVariable();
      for (const bad of [0, -20, Number.NaN]) {
        itemSize.set(() => bad);
        expect(Number.isFinite(v.range().start)).toBe(true);
        expect(Number.isFinite(v.range().end)).toBe(true);
        expect(v.totalHeight()).toBe(300); // every row clamped to 1px
      }
    });

    it('clamps a negative scroll offset from overscroll bounce', () => {
      const { v } = setupVariable();
      v.setScrollTop(-120);
      expect(v.scrollTop()).toBe(0);
      expect(v.range().start).toBe(0);
    });

    it('treats a zero-height viewport as showing nothing much but stays valid', () => {
      const { v, viewportHeight } = setupVariable();
      viewportHeight.set(0);
      v.setScrollTop(cyclicOffset(10));
      const { start, end } = v.range();
      expect(end).toBeGreaterThanOrEqual(start);
    });
  });

  describe('reactivity', () => {
    it('re-windows when the list shrinks under the current scroll position', () => {
      const { v, items } = setupVariable({ count: 300 });
      v.setScrollTop(cyclicOffset(290));
      expect(v.range().start).toBeGreaterThan(0);

      items.set(rows(10));
      const { start, end } = v.range();
      expect(end).toBe(10);
      expect(start).toBeLessThanOrEqual(end);
      expect(v.bottomSpacer()).toBeGreaterThanOrEqual(0);
    });

    it('re-windows when the size function changes', () => {
      const { v, itemSize } = setupVariable();
      v.setScrollTop(cyclicOffset(10));
      const before = v.range().start;
      itemSize.set(() => 5); // every row now much shorter — same offset means a later row
      expect(v.range().start).toBeGreaterThan(before);
    });

    it('reads a per-item size, not just a per-index one', () => {
      // ★ The signature is `(index, item) => number`, not `(index) => number`
      // — proves the item itself, not just its position, is available to size
      // a row (e.g. "this call-history entry has a note, this one doesn't").
      const items = signal<readonly { id: number; tall: boolean }[]>([
        { id: 0, tall: false },
        { id: 1, tall: true },
        { id: 2, tall: false },
      ]);
      const v = createVariableVirtualizer({
        items,
        itemSize: signal((_i: number, item: { tall: boolean }) => (item.tall ? 100 : 10)),
        viewportHeight: signal(500),
      });
      expect(v.totalHeight()).toBe(10 + 100 + 10);
      expect(v.offsetOf(2)).toBe(110);
    });
  });

  describe('onNearEnd', () => {
    it('fires when the scroll lands within the threshold of the bottom', () => {
      const items = signal<readonly Row[]>(rows(300));
      const calls: void[] = [];
      const v = createVariableVirtualizer<Row>({
        items,
        itemSize: signal(() => 20),
        viewportHeight: signal(200),
        onNearEnd: () => calls.push(undefined),
      });
      v.onScroll({ target: { scrollTop: 900, clientHeight: 200, scrollHeight: 1050 } } as unknown as Event);
      expect(calls).toHaveLength(1);
    });
  });
});
