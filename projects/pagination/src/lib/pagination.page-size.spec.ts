import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvPaginationComponent } from './pagination.component';

/**
 * ============================================================================
 *  The page-size policy — `NV-04-I3`
 * ============================================================================
 *
 * 📉 The audit recorded this as "undefined behaviour". It was not: the old
 * `onPageSizeChange` set `currentPage` to 1 and emitted. A behaviour existed; it
 * was simply the wrong one. Somebody eight pages into a list who switches from 10
 * rows to 50 is asking to see MORE OF WHAT THEY ARE LOOKING AT — and reset-to-1
 * discards a position they spent eight presses reaching, with no affordance that
 * gets it back. Page 2 of 50 is not a number they can compute.
 *
 * ⚠️ SO THE DEFAULT CHANGED. That is deliberate: reset-to-1 IS the defect the
 *    item names, so hiding the fix behind an opt-in would ship the bug to
 *    everyone who does not read a changelog.
 *    `pageSizeChangePolicy="reset-to-first"` restores it verbatim.
 *
 * ★★ And the change is invisible in the common case, which is what makes it
 *    safe: on page 1 the first visible row is row 1, and row 1 is on page 1 of
 *    every size. Only the resizes that used to throw away a position differ.
 */

/**
 * ⚠️ `pageSizeChange` CANNOT be subscribed through `render`'s `on` map, and the
 * failure is silent-looking rather than obvious. `pageSize` is a `model()`, so
 * Angular synthesises the `pageSizeChange` OUTPUT in the component definition
 * without creating a property of that name on the instance — and `on` reaches
 * for `componentInstance['pageSizeChange'].subscribe`, which is `undefined`.
 * The `ModelSignal` itself is the `OutputRef`, so it is subscribed directly.
 * `pageChange` is a real `output()` and goes through `on` as usual.
 */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const pages: number[] = [];
  const sizes: number[] = [];
  const { fixture } = await render(SvPaginationComponent, {
    inputs: { totalItems: 200, pageSize: 10, ...inputs },
    on: { pageChange: (p: number) => pages.push(p) },
  });
  const c = fixture.componentInstance;
  c.pageSize.subscribe((s: number) => sizes.push(s));
  return { fixture, c, pages, sizes };
}

describe('SvPaginationComponent — preserve-first-item (NV-04-I3, the new default)', () => {
  /**
   * ★★★ THE ARITHMETIC, SPELLED OUT, BECAUSE AN OFF-BY-ONE HERE IS INVISIBLE.
   * Page 8 at 10 rows shows rows 71–80, so the first visible row is row 71 —
   * 0-based index 70. At 50 rows a page holds indices 0–49, 50–99, …, so index 70
   * is on page 2. Row 71 is therefore still on screen, near the middle of the
   * page, which is the honest answer to "keep the first visible item".
   */
  it('lands on the page that now holds the row that was at the top', async () => {
    const { c, pages } = await setup({ currentPage: 8 });

    c.onPageSizeChange(50);

    expect(c.pageSize()).toBe(50);
    expect(c.currentPage()).toBe(2);
    expect(pages).toEqual([2]);
  });

  it('works downward too — a smaller page size moves the user forward', async () => {
    const { c } = await setup({ currentPage: 3, pageSize: 50 }); // rows 101–150
    c.onPageSizeChange(10);
    // Row 101 is index 100, which at 10 rows per page is page 11.
    expect(c.currentPage()).toBe(11);
  });

  it('is a no-op on page 1, which is every resize the old default got right', async () => {
    const { c, pages, sizes } = await setup({ currentPage: 1 });

    c.onPageSizeChange(25);

    expect(c.currentPage()).toBe(1);
    expect(pages).toEqual([]);
    // ★ The host is still told to refetch — `pageSize` is a `model()`.
    expect(sizes).toEqual([25]);
  });

  it('clamps to the last page when the new size makes the old position overshoot', async () => {
    const { c } = await setup({ totalItems: 30, pageSize: 5, currentPage: 6 }); // rows 26–30
    c.onPageSizeChange(25);
    // Index 25 would be page 2, and page 2 of 2 exists — but at size 25 with 30
    // items there are exactly 2 pages, so no clamp is needed here.
    expect(c.currentPage()).toBe(2);
    expect(c.totalPages()).toBe(2);
  });

  it('never proposes a page past the new total', async () => {
    const { c } = await setup({ totalItems: 12, pageSize: 2, currentPage: 6 }); // rows 11–12
    c.onPageSizeChange(10);
    expect(c.totalPages()).toBe(2);
    expect(c.currentPage()).toBe(2);
  });
});

describe('SvPaginationComponent — reset-to-first (the old behaviour, kept)', () => {
  it('jumps to page 1 exactly as it used to', async () => {
    const { c, pages } = await setup({ currentPage: 8, pageSizeChangePolicy: 'reset-to-first' });

    c.onPageSizeChange(50);

    expect(c.pageSize()).toBe(50);
    expect(c.currentPage()).toBe(1);
    expect(pages).toEqual([1]);
  });
});

describe('SvPaginationComponent — page size in cursor mode', () => {
  /**
   * ★ A cursor encodes a row's sort key, not an offset, so there is no
   * arithmetic from (page 8, size 10) to a cursor for size 50. Reusing cursors
   * taken at one page size is how a keyset UI starts skipping rows, so the trail
   * is cleared with the reset.
   */
  it('resets to the first page and forgets the trail', async () => {
    const cursors: (string | null)[] = [];
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPaginationComponent, {
      inputs: { mode: 'cursor', nextCursor: 'c1', pageSize: 10 },
      on: { cursorChange: (v: string | null) => cursors.push(v) },
    });
    const c = fixture.componentInstance;

    c.next();
    expect(c.pager.cursor()).toBe('c1');

    c.onPageSizeChange(50);

    expect(c.currentPage()).toBe(1);
    expect(c.pager.cursor()).toBeNull();
    expect(c.pager.hasPrevious()).toBe(false);
    expect(cursors).toEqual(['c1', null]);
  });
});

describe('SvPaginationComponent — a page size that is not one', () => {
  /**
   * A `<select>` cannot produce this, but a host calling the method can — and a
   * size of `0` makes `ceil(total / size)` `Infinity`, which renders a page window
   * that never terminates.
   */
  it('ignores zero, negative and non-numeric sizes', async () => {
    for (const bad of [0, -10, Number.NaN, 'abc']) {
      const { c } = await setup({ currentPage: 4 });
      c.onPageSizeChange(bad as number);
      expect(c.pageSize(), String(bad)).toBe(10);
      expect(c.currentPage(), String(bad)).toBe(4);
    }
  });
});
