import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvSelectDropdownComponent } from './select-dropdown.component';
import type { SelectOption } from './select-dropdown.component';

const options = (): SelectOption[] => [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSelectDropdownComponent, {
    inputs: { options: options(), searchable: true, ...inputs },
  });
  return fixture;
}

describe('SvSelectDropdownComponent — remote search', () => {
  it('debounces a burst of keystrokes into one query', async () => {
    vi.useFakeTimers();
    try {
      TestBed.resetTestingModule();
      const seen: string[] = [];
      const { fixture } = await render(SvSelectDropdownComponent, {
        inputs: { options: options(), searchable: true, debounceMs: 300 },
        on: { searchChange: (t: string) => seen.push(t) },
      });

      for (const term of ['a', 'al', 'alp']) {
        fixture.componentInstance.setSearch(term);
        fixture.detectChanges();
        vi.advanceTimersByTime(100);
      }
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      expect(seen.filter((t) => t === 'alp')).toHaveLength(1);
      expect(seen).not.toContain('al');
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds the query back until minChars is reached', async () => {
    vi.useFakeTimers();
    try {
      TestBed.resetTestingModule();
      const seen: string[] = [];
      const { fixture } = await render(SvSelectDropdownComponent, {
        inputs: { options: options(), searchable: true, debounceMs: 0, minChars: 3 },
        on: { searchChange: (t: string) => seen.push(t) },
      });

      fixture.componentInstance.setSearch('al');
      fixture.detectChanges();
      expect(seen).toEqual([]);

      fixture.componentInstance.setSearch('alp');
      fixture.detectChanges();
      expect(seen).toEqual(['alp']);
    } finally {
      vi.useRealTimers();
    }
  });

  /** Clearing the box must reset the list even below minChars. */
  it('lets an emptied search box through regardless of minChars', async () => {
    vi.useFakeTimers();
    try {
      TestBed.resetTestingModule();
      const seen: string[] = [];
      const { fixture } = await render(SvSelectDropdownComponent, {
        inputs: { options: options(), searchable: true, debounceMs: 0, minChars: 3 },
        on: { searchChange: (t: string) => seen.push(t) },
      });
      fixture.componentInstance.setSearch('alp');
      fixture.detectChanges();
      fixture.componentInstance.setSearch('');
      fixture.detectChanges();
      expect(seen).toEqual(['alp', '']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says what it is waiting for instead of "No results found"', async () => {
    const f = await setup({ minChars: 3 });
    f.componentInstance.setSearch('al');
    f.detectChanges();
    expect(f.componentInstance.belowMinChars()).toBe(true);
    expect(f.componentInstance.minCharsHint()).toBe('Type 3 characters to search');
  });

  /** Client-side filtering can only ever search the page already downloaded. */
  it('leaves the supplied options alone in serverSide mode', async () => {
    const f = await setup({ serverSide: true });
    f.componentInstance.setSearch('nothing-matches');
    f.detectChanges();
    expect(f.componentInstance.filteredOptions()).toHaveLength(2);
  });

  it('still filters locally when serverSide is off', async () => {
    const f = await setup();
    f.componentInstance.setSearch('alph');
    f.detectChanges();
    expect(f.componentInstance.filteredOptions().map((o) => o.value)).toEqual(['a']);
  });
});

describe('SvSelectDropdownComponent — panel states', () => {
  /** The panel mounts into a body portal, so let it settle before querying. */
  const open = async (inputs: Record<string, unknown> = {}) => {
    const f = await setup(inputs);
    f.componentInstance.openDropdown();
    f.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    f.detectChanges();
    return f;
  };

  it('shows a failure with a retry, not an empty list', async () => {
    const f = await open({ options: [] as SelectOption[], error: 'Lookup service down' });
    let retried = 0;
    f.componentInstance.retry.subscribe(() => retried++);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Lookup service down');
    (alert.querySelector('button') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });

  it('offers the next page when the server has more', async () => {
    const f = await open({ hasMore: true });
    let asked = 0;
    f.componentInstance.loadMore.subscribe(() => asked++);
    (await screen.findByRole('button', { name: 'Load more' })).click();
    expect(asked).toBe(1);
  });

  it('hides the load-more row when the list is complete', async () => {
    await open();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
});

describe('SvSelectDropdownComponent — value hydration', () => {
  /**
   * A value restored from the server has no matching option until the list is
   * fetched, so the trigger would otherwise show the raw id.
   */
  it('shows the supplied label for a value that is not in options yet', async () => {
    const f = await setup({
      options: [] as SelectOption[],
      value: 'u-42',
      selectedOption: { value: 'u-42', label: 'Ada Lovelace' } as SelectOption,
    });
    expect(f.componentInstance.displayLabel()).toBe('Ada Lovelace');
  });

  it('prefers the real option once it arrives', async () => {
    const f = await setup({
      options: [{ value: 'u-42', label: 'Ada Lovelace (Admin)' }] as SelectOption[],
      value: 'u-42',
      selectedOption: { value: 'u-42', label: 'Ada Lovelace' } as SelectOption,
    });
    expect(f.componentInstance.selectedOptions()).toHaveLength(1);
    expect(f.componentInstance.displayLabel()).toBe('Ada Lovelace (Admin)');
  });

  it('ignores a hydration option that does not match the value', async () => {
    const f = await setup({
      options: [] as SelectOption[],
      value: 'u-1',
      selectedOption: { value: 'u-42', label: 'Ada Lovelace' } as SelectOption,
    });
    expect(f.componentInstance.selectedOptions()).toHaveLength(0);
  });
});

/**
 * `X-5` — the third async state.
 *
 * `loading` cannot express "these results answer the term before last": it is
 * true for the first fetch too, where the right treatment is a skeleton and not
 * a dimmed list. `stale` is that distinction, and `SvStaleDirective` is the one
 * treatment shared by every picker in the kit.
 */
describe('SvSelectDropdownComponent — stale options', () => {
  const openStale = async (stale: boolean) => {
    const f = await setup({ stale });
    f.componentInstance.openDropdown();
    f.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    f.detectChanges();
    return f;
  };
  const results = (): HTMLElement | null => document.querySelector<HTMLElement>('[role="listbox"]');

  it('says nothing at all while the results are current', async () => {
    await openStale(false);

    expect(results()).not.toBeNull();
    expect(results()!.getAttribute('aria-busy')).toBeNull();
    expect(results()!.getAttribute('data-sv-state')).toBeNull();
    expect(results()!.classList.contains('opacity-60')).toBe(false);
  });

  it('marks the results busy and dim while a newer query is in flight', async () => {
    await openStale(true);

    expect(results()!.getAttribute('aria-busy')).toBe('true');
    expect(results()!.getAttribute('data-sv-state')).toBe('stale');
    expect(results()!.classList.contains('opacity-60')).toBe(true);
  });

  /**
   * The whole point of keeping the previous results is that they stay usable.
   * A dimmed list nobody can click is worse than a blanked one, because it
   * looks available.
   */
  it('leaves the results reachable', async () => {
    await openStale(true);

    expect(results()!.classList.contains('pointer-events-none')).toBe(false);
    expect(results()!.getAttribute('inert')).toBeNull();
  });
});
