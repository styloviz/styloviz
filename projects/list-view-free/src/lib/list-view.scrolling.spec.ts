import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvListViewComponent } from './list-view.component';
import type { ListViewItem, ListViewLoadMoreEvent } from './list-view.component';
import { flush } from '../../../../src/testing/async';

const many = (n: number): ListViewItem[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `Row ${i + 1}` }));

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvListViewComponent, {
    inputs: { items: many(3), ...inputs },
  });
  return fixture;
}

/**
 * A scroll event carrying the geometry the handler reads.
 *
 * ★ jsdom gives every element `scrollTop`/`clientHeight`/`scrollHeight` of 0,
 * and `0 + 0 >= 0 - 100` is true — so a real element is permanently "near the
 * bottom" and could never exercise the negative. The geometry has to be stated.
 */
const scrollTo = (scrollTop: number, clientHeight: number, scrollHeight: number) =>
  ({ target: { scrollTop, clientHeight, scrollHeight } }) as unknown as Event;

const NEAR_BOTTOM = scrollTo(900, 200, 1050);
const FAR_FROM_BOTTOM = scrollTo(0, 200, 5000);

describe('SvListViewComponent — infinite scroll', () => {
  async function armed(inputs: Record<string, unknown> = {}) {
    const f = await setup({ items: many(30), infiniteScroll: true, hasMore: true, ...inputs });
    const events: ListViewLoadMoreEvent[] = [];
    f.componentInstance.loadMore.subscribe((e) => events.push(e));
    return { f, events };
  }

  it('asks for the next page once the viewport nears the end', async () => {
    const { f, events } = await armed();
    f.componentInstance.onContainerScroll(NEAR_BOTTOM);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ visibleCount: 30, totalCount: 30 });
  });

  /** The middle of a long list is not a request for more rows. */
  it('stays quiet while the user is nowhere near the end', async () => {
    const { f, events } = await armed();
    f.componentInstance.onContainerScroll(FAR_FROM_BOTTOM);
    expect(events).toEqual([]);
  });

  it('stays quiet when infinite scroll is off', async () => {
    const { f, events } = await armed({ infiniteScroll: false });
    f.componentInstance.onContainerScroll(NEAR_BOTTOM);
    expect(events).toEqual([]);
  });

  /** The server has already said there is nothing left — asking again is a wasted trip. */
  it('stays quiet when the server has no more rows', async () => {
    const { f, events } = await armed({ hasMore: false });
    f.componentInstance.onContainerScroll(NEAR_BOTTOM);
    expect(events).toEqual([]);
  });

  it('stays quiet while the previous page is still in flight', async () => {
    const { f, events } = await armed({ loadingMore: true });
    f.componentInstance.onContainerScroll(NEAR_BOTTOM);
    expect(events).toEqual([]);
  });

  /**
   * A scroll gesture fires many events per frame. Without the in-tick guard one
   * flick at the bottom would request the same page a dozen times.
   */
  it('asks only once for a burst of scroll events in the same tick', async () => {
    const { f, events } = await armed();
    f.componentInstance.onContainerScroll(NEAR_BOTTOM);
    f.componentInstance.onContainerScroll(NEAR_BOTTOM);
    f.componentInstance.onContainerScroll(NEAR_BOTTOM);
    expect(events).toHaveLength(1);
  });

  /** …and it must release again, or the second page is the last page ever. */
  it('is ready to ask again on the next tick', async () => {
    const { f, events } = await armed();
    f.componentInstance.onContainerScroll(NEAR_BOTTOM);
    await flush();
    f.componentInstance.onContainerScroll(NEAR_BOTTOM);
    expect(events).toHaveLength(2);
  });

  /** The counts must describe the windowed view and the full list separately. */
  it('reports the rendered count against the full count when virtualized', async () => {
    const { f, events } = await armed({ virtualized: true, viewportHeight: 200, itemHeight: 50, overscan: 0 });
    f.componentInstance.onContainerScroll(NEAR_BOTTOM);
    expect(events[0].totalCount).toBe(30);
    expect(events[0].visibleCount).toBeLessThan(30);
  });

  it('shows a spinner while the next page loads and a prompt when it does not', async () => {
    const loadingMore = await setup({ infiniteScroll: true, hasMore: true, loadingMore: true });
    expect(loadingMore.nativeElement.textContent).toContain('Loading more items...');

    const idle = await setup({ infiniteScroll: true, hasMore: true });
    expect(idle.nativeElement.textContent).toContain('Scroll to load more');
    expect(idle.nativeElement.textContent).not.toContain('Loading more items...');
  });

  it('stops prompting for more once everything is loaded', async () => {
    const f = await setup({ infiniteScroll: true, hasMore: false });
    expect(f.nativeElement.textContent).not.toContain('Scroll to load more');
  });

  it('hides the footer when infinite scroll was never asked for', async () => {
    const f = await setup({ hasMore: true });
    expect(f.nativeElement.textContent).not.toContain('Scroll to load more');
  });
});

/**
 * ★★ A paged list used to render nothing at all on its last page and say nothing
 * either, so a user could not tell "the data ends here" from "the next page is
 * slow" — the worst version of that being a screen reader user, who had neither
 * the footer nor a spoken transition (DD-24-I5, DD-24-M5).
 */
describe('SvListViewComponent — how a paged list ends', () => {
  const paged = (inputs: Record<string, unknown> = {}) =>
    setup({ items: many(20), infiniteScroll: true, hasMore: true, ...inputs });

  const endMarker = (f: Awaited<ReturnType<typeof setup>>) =>
    f.nativeElement.querySelector('[data-sv-state="end-of-list"]') as HTMLElement | null;

  const spoken = (f: Awaited<ReturnType<typeof setup>>) =>
    (f.nativeElement.querySelector('p[aria-live="polite"]') as HTMLElement).textContent?.trim();

  it('marks the end of the list rather than dropping the footer', async () => {
    const f = await paged({ hasMore: false });
    expect(endMarker(f)?.textContent).toContain('all 20 items loaded');
    expect(f.nativeElement.textContent).not.toContain('Scroll to load more');
  });

  it('draws no end marker on a list that never pages', async () => {
    const f = await setup({ items: many(20) });
    expect(endMarker(f)).toBeNull();
  });

  /** Still fetching is not the end, whatever `hasMore` says. */
  it('draws no end marker while a page is in flight', async () => {
    const f = await paged({ hasMore: false, loadingMore: true });
    expect(endMarker(f)).toBeNull();
    expect(f.nativeElement.textContent).toContain('Loading more items...');
  });

  it('says how many rows a page brought', async () => {
    const f = await paged();
    f.componentRef.setInput('items', many(40));
    f.detectChanges();
    await flush();
    f.detectChanges();
    expect(spoken(f)).toBe('Loaded 20 more items.');
  });

  it('says the list has ended, and how long it turned out to be', async () => {
    const f = await paged();
    f.componentRef.setInput('items', many(25));
    f.componentRef.setInput('hasMore', false);
    f.detectChanges();
    await flush();
    f.detectChanges();
    expect(spoken(f)).toBe('Loaded 5 more items. End of list. All 25 items loaded.');
  });

  /** A list that arrived complete never ended — nothing happened to announce. */
  it('says nothing about a list that was complete on the first render', async () => {
    const f = await paged({ hasMore: false });
    await flush();
    expect(spoken(f)).toBe('');
  });

  it('says nothing while the page is still in flight', async () => {
    const f = await paged();
    f.componentRef.setInput('loadingMore', true);
    f.detectChanges();
    await flush();
    f.detectChanges();
    expect(spoken(f)).toBe('');
  });

  it('says nothing about paging on a list that does not page', async () => {
    const f = await setup({ items: many(20) });
    f.componentRef.setInput('items', many(40));
    f.detectChanges();
    await flush();
    f.detectChanges();
    expect(spoken(f)).toBe('');
  });
});

describe('SvListViewComponent — virtualization', () => {
  /** Windowing means the DOM holds a slice, not the list. */
  it('renders a window of rows, not all 500', async () => {
    const f = await setup({
      items: many(500),
      virtualized: true,
      viewportHeight: 300,
      itemHeight: 50,
      overscan: 2,
    });
    const c = f.componentInstance;
    expect(c.flatItems()).toHaveLength(500);
    expect(c.renderItems().length).toBeLessThan(20);
    expect(c.renderItems()[0].id).toBe(1);
    expect(f.nativeElement.querySelectorAll('button[data-lv-row-btn="1"]').length).toBe(
      c.renderItems().length,
    );
  });

  /** The spacers are what keep the scrollbar honest while rows are missing. */
  it('pads the missing rows above and below with spacers', async () => {
    const f = await setup({
      items: many(500),
      virtualized: true,
      viewportHeight: 300,
      itemHeight: 50,
      overscan: 0,
    });
    const c = f.componentInstance;
    expect(c.totalVirtualHeight()).toBe(25_000);
    expect(c.topSpacerHeight()).toBe(0);

    c.onContainerScroll(scrollTo(5000, 300, 25_000));
    f.detectChanges();
    expect(c.virtualRange().start).toBe(100);
    expect(c.topSpacerHeight()).toBe(5000);
    expect(c.bottomSpacerHeight()).toBe(25_000 - 5000 - c.renderItems().length * 50);
    expect(c.renderItems()[0].id).toBe(101);
  });

  /** Off by default: the whole list renders and the window is the list. */
  it('renders every row when virtualization is off', async () => {
    const f = await setup({ items: many(40) });
    expect(f.componentInstance.renderItems()).toHaveLength(40);
    expect(f.nativeElement.querySelectorAll('button[data-lv-row-btn="1"]').length).toBe(40);
  });

  /** Selection and checking must survive the row leaving the window. */
  it('keeps a check on a row that has scrolled out of the window', async () => {
    const f = await setup({
      items: many(500),
      virtualized: true,
      checkable: true,
      viewportHeight: 300,
      itemHeight: 50,
      overscan: 0,
    });
    const c = f.componentInstance;
    c.toggleCheck({ id: 1, title: 'Row 1' }, true);
    c.onContainerScroll(scrollTo(5000, 300, 25_000));
    f.detectChanges();
    expect(c.renderItems().some((i) => i.id === 1)).toBe(false);
    expect(c.isChecked({ id: 1, title: 'Row 1' })).toBe(true);
    expect(c.checkedCount()).toBe(1);
  });

  /** Select-all covers the whole list, not only what is on screen. */
  it('select-all reaches rows outside the window', async () => {
    const f = await setup({
      items: many(500),
      virtualized: true,
      checkable: true,
      viewportHeight: 300,
      itemHeight: 50,
    });
    f.componentInstance.toggleAllChecks(true);
    expect(f.componentInstance.checkedCount()).toBe(500);
  });

  /** Fixed height for the scroller when windowed; a cap otherwise. */
  it('fixes the viewport height when windowed and caps it when not', async () => {
    const windowed = await setup({ items: many(40), virtualized: true, viewportHeight: 320 });
    const wEl = windowed.nativeElement.querySelector('.overflow-auto') as HTMLElement;
    expect(wEl.style.height).toBe('320px');
    expect(wEl.style.maxHeight).toBe('');

    const plain = await setup({ items: many(40), viewportHeight: 320 });
    const pEl = plain.nativeElement.querySelector('.overflow-auto') as HTMLElement;
    expect(pEl.style.height).toBe('');
    expect(pEl.style.maxHeight).toBe('320px');
  });
});
