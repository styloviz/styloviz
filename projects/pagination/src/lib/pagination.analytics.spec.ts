import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SV_NAV_TELEMETRY, svResetWarnOnce, type SvNavEvent, type SvNavTelemetry } from '@styloviz/core';
import { SvPaginationComponent } from './pagination.component';

/**
 * ============================================================================
 *  `X-15` — pagination on the shared navigation stream
 * ============================================================================
 *
 * ★★ THE FAMILY WHERE THE MAPPING IS FREE, and the reason the vocabulary is
 *    the right one rather than a plausible one. `SvPageRequestDirection`
 *    already existed for `pageAction`'s request — `first | previous | next |
 *    last | jump | resize` — and it maps onto `SvNavIntent` one-to-one without
 *    an inference anywhere. Every other family reconstructs its intent from an
 *    index delta; this one looks it up.
 *
 * ★ `resize → refine` is the pair that justifies `refine` existing. The page
 *   number usually changes — `preserve-first-item` moves it — but nobody
 *   navigated: the same rows are being read through a different window, and
 *   counting it as a page view inflates every list in the app.
 */

function sink(retention = '30d', granted = true) {
  const seen: SvNavEvent[] = [];
  const provided: SvNavTelemetry = {
    kind: 'spec',
    retention,
    consent: () => granted,
    record: (e) => seen.push(e),
  };
  return { seen, provided };
}

async function setup(
  inputs: Record<string, unknown> = {},
  opts: { retention?: string; granted?: boolean } = {},
) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const { seen, provided } = sink(opts.retention ?? '30d', opts.granted ?? true);
  const { fixture } = await render(SvPaginationComponent, {
    inputs: { totalItems: 200, pageSize: 10, ...inputs },
    providers: [{ provide: SV_NAV_TELEMETRY, useValue: provided }],
  });
  return { fixture, c: fixture.componentInstance, seen };
}

describe('SvPaginationComponent — X-15 intents', () => {
  it('maps next and previous onto advance and retreat', async () => {
    const { c, seen } = await setup({ currentPage: 4 });
    c.next();
    c.previous();
    expect(seen.map((e) => e.intent)).toEqual(['advance', 'retreat']);
  });

  /**
   * ★ First and Last are `jump`, not `retreat`/`advance`, however far they go.
   *   "Skipped to the end" and "read the next page" are different behaviours,
   *   and the distance between them is not what tells them apart — pressing
   *   Next on page 1 of 2 reaches the last page too.
   */
  it('maps first and last onto jump, even when they move by one', async () => {
    const { c, seen } = await setup({ currentPage: 2, totalItems: 20, pageSize: 10 });
    c.first();
    c.last();
    expect(seen.map((e) => e.intent)).toEqual(['jump', 'jump']);
  });

  it('maps a numbered page button and a programmatic goTo onto jump', async () => {
    const { c, seen } = await setup({ currentPage: 1 });
    c.goTo(7);
    expect(seen).toEqual([
      expect.objectContaining({ surface: 'pagination', intent: 'jump', key: '7', index: 7 }),
    ]);
  });

  it('names the instance when the host gave it one', async () => {
    const { c, seen } = await setup({ currentPage: 1, surfaceId: 'orders-table' });
    c.goTo(3);
    expect(seen[0].surfaceId).toBe('orders-table');
  });

  it('records nothing for a goTo that lands on the page already shown', async () => {
    const { c, seen } = await setup({ currentPage: 3 });
    c.goTo(3);
    expect(seen).toEqual([]);
  });
});

describe('SvPaginationComponent — X-15 refine', () => {
  it('calls a page-size change refine, not a page view', async () => {
    const { c, seen } = await setup({ currentPage: 8 });
    c.onPageSizeChange(50);
    expect(seen.map((e) => e.intent)).toEqual(['refine']);
  });

  /**
   * ★ Recorded even when the page does not move — unlike `pageChange`. "How
   *   often does resizing move you?" is only answerable if the no-op case is in
   *   the data too, and on page 1 the resize is always a no-op.
   */
  it('records the resize that moves nobody, which is every resize on page 1', async () => {
    const { c, seen } = await setup({ currentPage: 1 });
    c.onPageSizeChange(25);
    expect(seen).toEqual([
      expect.objectContaining({ intent: 'refine', index: 1 }),
    ]);
  });

  it('carries the page the resize landed on', async () => {
    const { c, seen } = await setup({ currentPage: 8 });
    c.onPageSizeChange(50); // row 71 → page 2 at size 50
    expect(seen[0]).toMatchObject({ intent: 'refine', index: 2, key: '2' });
  });

  it('says nothing for a size the component refuses', async () => {
    const { c, seen } = await setup({ currentPage: 4 });
    c.onPageSizeChange(0);
    expect(seen).toEqual([]);
  });
});

describe('SvPaginationComponent — X-15 consent and retention', () => {
  it('records nothing while consent is withheld', async () => {
    const { c, seen } = await setup({ currentPage: 1 }, { granted: false });
    c.next();
    c.goTo(5);
    expect(seen).toEqual([]);
  });

  /**
   * ⚠️ A page number is the one key in this kit that is never a record
   *    identifier — no row is named "page 4". It is stripped anyway, because a
   *    rule with an exception is a rule somebody has to remember.
   */
  it('strips the page number for a sink that declares no retention', async () => {
    const { c, seen } = await setup({ currentPage: 1 }, { retention: 'none' });
    c.next();
    expect(seen[0]).toMatchObject({ surface: 'pagination', intent: 'advance', index: 2 });
    expect(seen[0].key).toBeNull();
  });
});
