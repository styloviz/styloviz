import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import {
  provideSvNavLocation,
  svNoopNavLocation,
  svQueryParamNavLocation,
} from '@styloviz/core';
import { SvPaginationComponent } from './pagination.component';

/**
 * ============================================================================
 *  URL synchronisation — `NV-04-I7`, `NV-04-M4`
 * ============================================================================
 *
 * A page number is the most obviously shareable state in the kit, and the two
 * things that make it work are both opt-ins: the app provides a location, and the
 * instance names a key. Both halves are asserted here, including the case where
 * only one is present — which has to be inert rather than half-wired.
 */

function at(url: string): void {
  window.history.replaceState(null, '', url);
}

beforeEach(() => at('/list'));

async function setup(inputs: Record<string, unknown> = {}, addressable = true) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvPaginationComponent, {
    inputs: { totalItems: 200, pageSize: 10, ...inputs },
    providers: [
      provideSvNavLocation(addressable ? svQueryParamNavLocation() : svNoopNavLocation()),
    ],
  });
  return fixture;
}

const query = () => new URLSearchParams(window.location.search);

describe('SvPaginationComponent — opting in', () => {
  /** No key: this instance does not own a parameter, whatever the app provided. */
  it('touches no URL without a urlKey', async () => {
    const f = await setup();
    f.componentInstance.goTo(4);
    expect(window.location.search).toBe('');
  });

  /** No location: the key is set but the app never opted in. */
  it('touches no URL without a provided location', async () => {
    const f = await setup({ urlKey: 'page' }, false);
    f.componentInstance.goTo(4);
    expect(window.location.search).toBe('');
    expect(f.componentInstance.currentPage()).toBe(4);
  });

  it('writes the page once both halves are in place', async () => {
    const f = await setup({ urlKey: 'page' });
    f.componentInstance.goTo(4);
    f.detectChanges();
    expect(query().get('page')).toBe('4');
  });

  /**
   * Two paginators on one page is the reason the key is an input rather than a
   * constant — they must be able to own different parameters.
   */
  it('lets two instances own different keys', async () => {
    const first = await setup({ urlKey: 'page' });
    first.componentInstance.goTo(2);
    first.detectChanges();

    TestBed.resetTestingModule();
    const { fixture: second } = await render(SvPaginationComponent, {
      inputs: { totalItems: 200, urlKey: 'archivePage' },
      providers: [provideSvNavLocation(svQueryParamNavLocation())],
    });
    second.componentInstance.goTo(5);
    second.detectChanges();

    expect(query().get('page')).toBe('2');
    expect(query().get('archivePage')).toBe('5');
  });
});

describe('SvPaginationComponent — component to URL', () => {
  /**
   * Page 1 is the default, so it is absent rather than written. A URL carrying its
   * own defaults makes two equivalent pages look like two different ones to
   * analytics and to a cache.
   */
  it('omits page 1 rather than writing ?page=1', async () => {
    const f = await setup({ urlKey: 'page' });
    expect(query().has('page')).toBe(false);

    f.componentInstance.goTo(3);
    f.detectChanges();
    expect(query().get('page')).toBe('3');

    f.componentInstance.goTo(1);
    f.detectChanges();
    expect(query().has('page')).toBe(false);
  });

  /**
   * ★ Pushing is the point. A reader who paged forward and pressed back means
   * "the page I was on" — the one navigation here the browser should undo.
   */
  it('pushes a history entry per page change', async () => {
    const f = await setup({ urlKey: 'page' });
    const before = window.history.length;

    f.componentInstance.goTo(2);
    f.detectChanges();
    f.componentInstance.goTo(3);
    f.detectChanges();

    expect(window.history.length).toBe(before + 2);
  });

  it('leaves the path and other query keys alone', async () => {
    at('/list?q=invoices&sort=date');
    const f = await setup({ urlKey: 'page' });
    f.componentInstance.goTo(2);
    f.detectChanges();

    expect(window.location.pathname).toBe('/list');
    expect(query().get('q')).toBe('invoices');
    expect(query().get('sort')).toBe('date');
  });

  /**
   * ★ Page 1 here is `NV-04-I3`'s arithmetic, not a reset: page 5 at 10 rows
   * starts at row 41, and row 41 is on page 1 of 50. The URL key is cleared
   * because page 1 is absent from the URL, not because a resize starts over —
   * `pagination.page-size.spec.ts` owns the policy.
   */
  it('follows a page-size change back to page 1, clearing the key', async () => {
    at('/list?page=5');
    const f = await setup({ urlKey: 'page' });
    expect(f.componentInstance.currentPage()).toBe(5);

    f.componentInstance.onPageSizeChange(50);
    f.detectChanges();

    expect(f.componentInstance.currentPage()).toBe(1);
    expect(query().has('page')).toBe(false);
  });
});

describe('SvPaginationComponent — URL to component', () => {
  it('starts on the page the URL named, and emits so rows get fetched', async () => {
    at('/list?page=4');
    let emitted: number | null = null;

    TestBed.resetTestingModule();
    const { fixture } = await render(SvPaginationComponent, {
      inputs: { totalItems: 200, urlKey: 'page' },
      providers: [provideSvNavLocation(svQueryParamNavLocation())],
      on: { pageChange: (page: number) => (emitted = page) },
    });

    expect(fixture.componentInstance.currentPage()).toBe(4);
    expect(emitted).toBe(4);
  });

  it('follows the back button', async () => {
    at('/list?page=4');
    const f = await setup({ urlKey: 'page' });
    expect(f.componentInstance.currentPage()).toBe(4);

    at('/list?page=2');
    window.dispatchEvent(new PopStateEvent('popstate'));
    f.detectChanges();

    expect(f.componentInstance.currentPage()).toBe(2);
  });

  /**
   * ★ `NV-04-I7`. `syncToUrl` writes page 1 as NO KEY, so the bare URL is how
   * page 1 is addressed — and Back from `?page=4` to it must land there, not
   * leave the reader on page 4 under a URL that says otherwise.
   */
  it('returns to page 1 when the key disappears from the URL', async () => {
    at('/list?page=4');
    const pages: number[] = [];
    const f = await setup({ urlKey: 'page' });
    f.componentInstance.pageChange.subscribe((p: number) => pages.push(p));
    expect(f.componentInstance.currentPage()).toBe(4);

    at('/list');
    window.dispatchEvent(new PopStateEvent('popstate'));
    f.detectChanges();

    expect(f.componentInstance.currentPage()).toBe(1);
    expect(pages).toEqual([1]);
    expect(query().has('page')).toBe(false);
  });

  /**
   * …but an absent key on FIRST render is not a transition, and is not evidence
   * of anything: the host may be driving `currentPage` itself.
   */
  it('does not force page 1 over a host-controlled page when the URL starts bare', async () => {
    const f = await setup({ urlKey: 'page', currentPage: 3 });
    expect(f.componentInstance.currentPage()).toBe(3);
  });

  /**
   * ★ The decision this file exists to protect. The obvious implementation clamps
   * the incoming page into `[1, totalPages()]` — and silently breaks every deep
   * link in an app that fetches, because `totalItems` is 0 until the first
   * response lands, so `totalPages()` is 1 and `?page=4` becomes page 1 before the
   * data that justified page 4 exists. The link appears to work and lands wrong.
   */
  it('keeps a deep-linked page while the total is still unknown', async () => {
    at('/list?page=4');
    const f = await setup({ urlKey: 'page', totalItems: 0 });

    expect(f.componentInstance.totalPages()).toBe(1);
    expect(f.componentInstance.currentPage()).toBe(4);

    // …and it is still page 4 once the data arrives.
    f.componentRef.setInput('totalItems', 200);
    f.detectChanges();
    expect(f.componentInstance.currentPage()).toBe(4);
  });

  describe('a value that is not a page', () => {
    it.each([
      ['?page=banana', 'not a number'],
      ['?page=0', 'below the first page'],
      ['?page=-3', 'negative'],
      ['?page=', 'empty'],
      ['?page=2.7', 'fractional — rejected, not truncated to 2'],
      ['?page=4x', 'trailing junk — rejected, not truncated to 4'],
      ['?page=+4', 'signed'],
    ])('ignores %s (%s) and stays on the current page', async (search) => {
      at(`/list${search}`);
      const f = await setup({ urlKey: 'page' });
      expect(f.componentInstance.currentPage()).toBe(1);
    });
  });
});
