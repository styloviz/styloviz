import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import type { SvUnresolvedValue } from '@styloviz/core';
import { SvPaginationComponent } from './pagination.component';

/**
 * ============================================================================
 *  Controlled-value reconciliation — `X-10`, `NV-04-I2`, `NV-04-M3`
 * ============================================================================
 *
 * `X-10` asked one question of four families: may a component write back to a
 * `model()` to correct a host value it cannot honour? The answer turns on what
 * KIND of value it is.
 *
 * ★ A page number is **ordinal**: page 7 of 3 has a nearest valid value, and it
 * is obviously 3. So this family corrects. `sv-tabs`' `activeId` is a **name**,
 * `"xyz"` has no nearest tab, and picking one would be a guess — so that family
 * reports instead. The two behaviours already in the tree were not inconsistent;
 * nobody had written down which question each was answering.
 *
 * ★★ And correcting is gated on the data having ARRIVED, which is the rule T1
 * learned three separate times. `totalItems` is 0 until the first response lands.
 * Once a non-zero total HAS arrived, a later 0 is "the filter matched nothing"
 * and clamps like any other shrink — `NV-04-I2`.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const seen: SvUnresolvedValue<number>[] = [];
  const { fixture } = await render(SvPaginationComponent, {
    inputs: { totalItems: 200, pageSize: 10, ...inputs },
    on: { unresolved: (e: SvUnresolvedValue<number>) => seen.push(e) },
  });
  return { fixture, seen, page: () => fixture.componentInstance.currentPage() };
}

describe('SvPaginationComponent — a page that exists', () => {
  it('says nothing at all', async () => {
    const { seen } = await setup({ currentPage: 3 });
    expect(seen).toEqual([]);
  });

  it('says nothing when the user pages normally', async () => {
    const { fixture, seen } = await setup();
    fixture.componentInstance.goTo(4);
    fixture.detectChanges();
    expect(seen).toEqual([]);
  });
});

describe('SvPaginationComponent — a total that shrinks underneath', () => {
  /**
   * ★ The case `NV-04-I2` names. `goTo()` already clamps, so *interaction* cannot
   * overshoot — the unhandled one is reactive: a filter is applied or a row is
   * deleted while the host holds page 7.
   */
  it('clamps to the last page and tells the host', async () => {
    const { fixture, seen, page } = await setup({ currentPage: 7 });
    expect(page()).toBe(7);
    expect(seen).toEqual([]);

    fixture.componentRef.setInput('totalItems', 20);
    fixture.detectChanges();

    expect(page()).toBe(2);
    expect(seen).toEqual([
      { requested: 7, rendered: 2, reason: 'out-of-range', corrected: true },
    ]);
  });

  /** A host listening to `(pageChange)` to fetch rows must hear about it too. */
  it('emits pageChange for the correction, so rows get refetched', async () => {
    TestBed.resetTestingModule();
    const pages: number[] = [];
    const { fixture } = await render(SvPaginationComponent, {
      inputs: { totalItems: 200, pageSize: 10, currentPage: 7 },
      on: { pageChange: (p: number) => pages.push(p) },
    });

    fixture.componentRef.setInput('totalItems', 20);
    fixture.detectChanges();

    expect(pages).toEqual([2]);
  });

  /** One event per distinct state — a re-render is not a new thing happening. */
  it('does not re-report on every change detection pass', async () => {
    const { fixture, seen } = await setup({ currentPage: 7 });
    fixture.componentRef.setInput('totalItems', 20);
    fixture.detectChanges();
    fixture.detectChanges();
    fixture.detectChanges();

    expect(seen).toHaveLength(1);
  });
});

describe('SvPaginationComponent — a total that drops to zero after loading', () => {
  /**
   * ★ `NV-04-I2`. Once a total has arrived, a later `0` is an ANSWER — the filter
   * matched nothing — not the "not loaded yet" placeholder. Holding page 7 of an
   * empty list, reported as a wait, would be a wait that never ends.
   */
  it('clamps to page 1 as out-of-range, not held as not-loaded', async () => {
    const { fixture, seen, page } = await setup({ currentPage: 7 });

    fixture.componentRef.setInput('totalItems', 0);
    fixture.detectChanges();

    expect(page()).toBe(1);
    expect(seen).toEqual([
      { requested: 7, rendered: 1, reason: 'out-of-range', corrected: true },
    ]);
  });

  it('also clamps when the first total was itself the 0 placeholder', async () => {
    const { fixture, seen, page } = await setup({ totalItems: 0, currentPage: 4 });
    fixture.componentRef.setInput('totalItems', 200);
    fixture.detectChanges();
    expect(page()).toBe(4);

    fixture.componentRef.setInput('totalItems', 0);
    fixture.detectChanges();

    expect(page()).toBe(1);
    expect(seen.at(-1)).toEqual({
      requested: 4,
      rendered: 1,
      reason: 'out-of-range',
      corrected: true,
    });
  });
});

describe('SvPaginationComponent — before the total has arrived', () => {
  /**
   * ★★ The decision this file exists to protect, and the one T1 mutation-verified
   * from the other side. `totalItems` is 0 until the first response lands, so
   * `totalPages()` is 1 — and "correcting" then turns every deep link into page 1
   * BEFORE the data that justified page 4 exists. The link appears to work and
   * lands on the wrong page.
   */
  it('holds the page rather than correcting it', async () => {
    const { seen, page } = await setup({ totalItems: 0, currentPage: 4 });

    expect(page()).toBe(4);
    expect(seen).toEqual([
      { requested: 4, rendered: 4, reason: 'not-loaded', corrected: false },
    ]);
  });

  /**
   * ★ And it is REPORTED while held. A page being held is exactly as invisible as
   * one being silently changed, which is the complaint `X-10` opens with — the
   * word that matters in "silently render nothing" is *silently*.
   */
  it('stops reporting once the total arrives and the page turns out to be fine', async () => {
    const { fixture, seen, page } = await setup({ totalItems: 0, currentPage: 4 });
    expect(seen).toHaveLength(1);

    fixture.componentRef.setInput('totalItems', 200);
    fixture.detectChanges();

    expect(page()).toBe(4);
    expect(seen).toHaveLength(1);
  });

  it('corrects only once the total proves the page wrong', async () => {
    const { fixture, seen, page } = await setup({ totalItems: 0, currentPage: 4 });

    fixture.componentRef.setInput('totalItems', 20);
    fixture.detectChanges();

    expect(page()).toBe(2);
    expect(seen.at(-1)).toEqual({
      requested: 4,
      rendered: 2,
      reason: 'out-of-range',
      corrected: true,
    });
  });

  it('says nothing about page 1, which is the default and always valid', async () => {
    const { seen } = await setup({ totalItems: 0 });
    expect(seen).toEqual([]);
  });
});

describe('SvPaginationComponent — a value that is not a page at all', () => {
  /**
   * Unlike out-of-range, this is true whether or not the data has arrived: there
   * is no total under which page 0 or page −3 becomes meaningful.
   */
  it.each([
    [0, 'below the first page'],
    [-3, 'negative'],
    [Number.NaN, 'not a number'],
  ])('corrects %s (%s) to page 1 immediately', async (requested) => {
    const { seen, page } = await setup({ totalItems: 0, currentPage: requested });

    expect(page()).toBe(1);
    expect(seen.at(-1)).toMatchObject({
      rendered: 1,
      reason: 'out-of-range',
      corrected: true,
    });
  });
});
