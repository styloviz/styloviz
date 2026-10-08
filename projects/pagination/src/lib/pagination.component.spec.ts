import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvPaginationComponent } from './pagination.component';

/**
 * Render helper that returns the component instance for logic assertions.
 * Resets the TestBed first so a test may render more than once (TestBed is
 * only auto-reset between tests, not between renders within one test).
 */
async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvPaginationComponent, { inputs });
  return fixture.componentInstance;
}

describe('SvPaginationComponent — page math', () => {
  it('computes totalPages from totalItems / pageSize (min 1)', async () => {
    expect((await setup({ totalItems: 95, pageSize: 10 })).totalPages()).toBe(10);
    expect((await setup({ totalItems: 0, pageSize: 10 })).totalPages()).toBe(1);
  });

  it('computes the 1-based item range for the current page', async () => {
    const c = await setup({ totalItems: 234, pageSize: 10, currentPage: 3 });
    expect(c.rangeStart()).toBe(21);
    expect(c.rangeEnd()).toBe(30);
  });

  it('clamps the final range to totalItems', async () => {
    const c = await setup({ totalItems: 23, pageSize: 10, currentPage: 3 });
    expect(c.rangeStart()).toBe(21);
    expect(c.rangeEnd()).toBe(23);
  });

  it('lists every page without ellipsis when total <= 7', async () => {
    const c = await setup({ totalItems: 50, pageSize: 10 }); // 5 pages
    expect(c.pageWindow()).toEqual([1, 2, 3, 4, 5]);
  });

  it('inserts ellipsis markers (-1) around the current page for large ranges', async () => {
    const c = await setup({ totalItems: 200, pageSize: 10, currentPage: 6 }); // 20 pages
    const w = c.pageWindow();
    expect(w[0]).toBe(1);
    expect(w[w.length - 1]).toBe(20);
    expect(w).toContain(-1);
    expect(w).toContain(6);
  });
});

describe('SvPaginationComponent — navigation', () => {
  it('goTo clamps below 1 and above totalPages', async () => {
    const c = await setup({ totalItems: 50, pageSize: 10, currentPage: 3 });
    c.goTo(-5);
    expect(c.currentPage()).toBe(1);
    c.goTo(999);
    expect(c.currentPage()).toBe(5);
  });

  it('emits (pageChange) only when the page actually changes', async () => {
    const spy = vi.fn();
    const c = await setup({ totalItems: 50, pageSize: 10, currentPage: 2 });
    c.pageChange.subscribe(spy);

    c.goTo(2); // no-op
    expect(spy).not.toHaveBeenCalled();

    c.goTo(4);
    expect(spy).toHaveBeenCalledWith(4);
    expect(c.currentPage()).toBe(4);
  });

  /**
   * ⚠️ THE DEFAULT CHANGED IN `NV-04-I3`. This test used to assert page 1, which
   * was the defect the item names — a resize is not a request to start over. The
   * old behaviour is `pageSizeChangePolicy="reset-to-first"`; the whole policy is
   * pinned in `pagination.page-size.spec.ts`.
   */
  it('keeps the first visible item when the page size changes', async () => {
    const spy = vi.fn();
    const c = await setup({ totalItems: 200, pageSize: 10, currentPage: 8 });
    c.pageChange.subscribe(spy);

    c.onPageSizeChange(50);
    expect(c.pageSize()).toBe(50);
    expect(c.currentPage()).toBe(2); // rows 71–80 → row 71 is on page 2 of 50
    expect(spy).toHaveBeenCalledWith(2);
  });
});

describe('SvPaginationComponent — page-size selector ids', () => {
  /**
   * The id was the literal `page-size-select`, so two paginators on one page
   * produced a duplicate id and the second label pointed at the first control.
   */
  it('gives each instance its own select id, and labels it', async () => {
    TestBed.resetTestingModule();
    const a = (await render(SvPaginationComponent, { inputs: { totalItems: 50 } })).fixture;
    const b = TestBed.createComponent(SvPaginationComponent);
    b.componentRef.setInput('totalItems', 50);
    b.detectChanges();

    const ids = [a, b].map((f) => {
      const el = f.nativeElement as HTMLElement;
      const select = el.querySelector('select')!;
      expect(el.querySelector('label')?.getAttribute('for')).toBe(select.id);
      return select.id;
    });

    expect(ids[0]).not.toBe('');
    expect(ids[0]).not.toBe(ids[1]);
  });
});
