import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvListViewComponent } from './list-view.component';
import type { ListViewItem } from './list-view.component';

const items = (): ListViewItem[] => [
  { id: 1, title: 'Alpha invoice' },
  { id: 2, title: 'Beta invoice' },
  { id: 3, title: 'Gamma receipt' },
];

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvListViewComponent, {
    inputs: { items: items(), ...inputs },
  });
  return fixture;
}

const stateEl = (f: { nativeElement: HTMLElement }, n: string) =>
  f.nativeElement.querySelector(`[data-sv-state="${n}"]`);

describe('SvListViewComponent — async states', () => {
  it('shows a placeholder instead of the list while the first page loads', async () => {
    const f = await setup({ loading: true });
    expect(stateEl(f, 'loading')).toBeTruthy();
    expect(screen.queryByText('Alpha invoice')).toBeNull();
  });

  it('announces a load failure and offers a retry', async () => {
    const f = await setup({ error: 'List service down' });
    let retried = 0;
    f.componentInstance.retry.subscribe(() => retried++);
    expect(screen.getByRole('alert').textContent).toContain('List service down');
    (stateEl(f, 'error')?.querySelector('button') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });

  /** `loadingMore` keeps the rows already on screen; `loading` replaces them. */
  it('keeps the loaded rows visible while the next page arrives', async () => {
    const f = await setup({ loadingMore: true, hasMore: true, infiniteScroll: true });
    expect(stateEl(f, 'loading')).toBeNull();
    expect(screen.getAllByText('Alpha invoice').length).toBeGreaterThan(0);
  });

  it('separates an empty list from a search that matched nothing', async () => {
    const empty = await setup({ items: [] as ListViewItem[] });
    expect(empty.componentInstance.isFiltered()).toBe(false);
    expect(stateEl(empty, 'empty')?.textContent).toContain('Nothing here yet');

    const filtered = await setup({ searchable: true, query: 'zzz' });
    expect(filtered.componentInstance.isFiltered()).toBe(true);
    expect(stateEl(filtered, 'empty')?.textContent).toContain('No matching items');
  });
});

describe('SvListViewComponent — server-driven search', () => {
  it('emits a debounced, de-duplicated term', async () => {
    vi.useFakeTimers();
    try {
      TestBed.resetTestingModule();
      const seen: string[] = [];
      const { fixture } = await render(SvListViewComponent, {
        inputs: { items: items(), searchable: true, debounceMs: 300 },
        // `searched`, not `queryChange`: `query` is a model() and already owns
        // `queryChange`, so the debounced notification needs its own name.
        on: { searched: (t: string) => seen.push(t) },
      });

      for (const term of ['i', 'in', 'inv']) {
        fixture.componentInstance.query.set(term);
        fixture.detectChanges();
        vi.advanceTimersByTime(100);
      }
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      expect(seen.filter((t) => t === 'inv')).toHaveLength(1);
      expect(seen.filter((t) => t === 'in')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  /** Client-side filtering can only ever search the page already downloaded. */
  it('leaves the supplied rows alone in serverSide mode', async () => {
    const f = await setup({ searchable: true, serverSide: true, query: 'nothing-matches' });
    expect(f.componentInstance.filteredItems()).toHaveLength(3);
  });

  it('still filters locally when serverSide is off', async () => {
    const f = await setup({ searchable: true, query: 'invoice' });
    expect(f.componentInstance.filteredItems().map((i) => i.id)).toEqual([1, 2]);
  });

  it('exposes query as a two-way model so it can be restored from a URL', async () => {
    const f = await setup({ searchable: true, query: 'beta' });
    expect(f.componentInstance.query()).toBe('beta');
    f.componentInstance.query.set('');
    expect(f.componentInstance.filteredItems()).toHaveLength(3);
  });
});
