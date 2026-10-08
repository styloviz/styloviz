import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { quietFor, until } from '@testing/async';
import { svResetWarnOnce } from '@styloviz/core';
import { SvSelectDropdownComponent } from './select-dropdown.component';
import type { SelectOption, SvSelectOptionSource } from './select-dropdown.component';

/**
 * `FI-23-M3` — the component owning its own fetch (free twin).
 *
 * The Pro copy carries the reasoning; this one exists because `check:parity`
 * is about behaviour, not just about an input existing on both sides.
 *
 * ★★★ WHAT THIS IS TESTING FOR, AND WHY IT IS NOT THE CONTROLLER'S SPEC
 *
 *     `svSuggestController` is tested exhaustively in
 *     `core/src/lib/data/suggest-controller.spec.ts` — the debounce, the
 *     guard, the abort, the stale/loading split. Repeating any of that here
 *     would be a test of a dependency.
 *
 *     What is *only* testable here is the wiring, and the wiring is where the
 *     bugs are: whether the fetched list actually reaches the panel, whether a
 *     component that already debounced now debounces twice, whether closing
 *     the panel abandons the request without also abandoning the label the
 *     trigger is showing, and whether `serverSide` is really implied — because
 *     a list this component just fetched being filtered *again* against the
 *     same term is the silent one. Every test below is one of those seams.
 */

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const PEOPLE: SelectOption[] = [
  { value: 'ada', label: 'Ada Lovelace' },
  { value: 'grace', label: 'Grace Hopper' },
];

async function setup(inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const { fixture } = await render(SvSelectDropdownComponent, {
    inputs: { searchable: true, debounceMs: 0, ...inputs },
  });
  return fixture;
}

describe('SvSelectDropdownComponent — loadOptions', () => {
  it('fetches on open and renders what came back', async () => {
    const calls: string[] = [];
    const load: SvSelectOptionSource = async (term) => {
      calls.push(term);
      return PEOPLE;
    };
    const fixture = await setup({ loadOptions: load });
    const c = fixture.componentInstance;

    // Nothing is asked for until the panel is opened: a picker that fetches on
    // construction pays for every one of them on a page that renders twenty.
    expect(calls).toEqual([]);

    c.openDropdown();
    await until(() => c.effectiveOptions().length === 2, { label: 'the open fetch landed' });
    expect(calls).toEqual(['']);
    expect(c.filteredOptions().map((o) => o.value)).toEqual(['ada', 'grace']);
  });

  it('does not re-fetch on a second open that the panel already answers', async () => {
    let calls = 0;
    const fixture = await setup({ loadOptions: async () => { calls++; return PEOPLE; } });
    const c = fixture.componentInstance;

    c.openDropdown();
    await until(() => calls === 1, { label: 'the first open fetched' });
    c.closeDropdown();
    c.openDropdown();
    await quietFor();

    expect(calls).toBe(1);
  });

  it('re-fetches on open when the box was cleared behind a search', async () => {
    const calls: string[] = [];
    const fixture = await setup({
      loadOptions: async (term: string) => { calls.push(term); return PEOPLE; },
    });
    const c = fixture.componentInstance;

    c.openDropdown();
    await until(() => calls.length === 1, { label: 'the open fetch landed' });
    c.setSearch('gr');
    fixture.detectChanges();
    await until(() => calls.length === 2, { label: 'the typed search landed' });

    // closeDropdown() empties the search box. Reopening it against results
    // that answer "gr" would show a filtered list under an empty box.
    c.closeDropdown();
    c.openDropdown();
    await until(() => calls.length === 3, { label: 'the reopen fetched the empty term' });
    expect(calls).toEqual(['', 'gr', '']);
  });

  it('debounces once, not twice', async () => {
    // ★ The regression this exists for: the component has debounced
    //   `searchQuery` since long before `loadOptions`, and `svSuggestController`
    //   debounces too. Left at its 300ms default the controller would add a
    //   second delay on top of the component's, and a picker configured for
    //   300ms would answer in 600 — slow, correct-looking, and nobody's fault.
    vi.useFakeTimers();
    try {
      const calls: string[] = [];
      TestBed.resetTestingModule();
      svResetWarnOnce();
      const { fixture } = await render(SvSelectDropdownComponent, {
        inputs: {
          searchable: true,
          debounceMs: 300,
          loadOptions: async (term: string) => { calls.push(term); return PEOPLE; },
        },
      });
      const c = fixture.componentInstance;
      c.openDropdown();
      await vi.advanceTimersByTimeAsync(0);
      calls.length = 0;

      c.setSearch('ada');
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(299);
      fixture.detectChanges();
      expect(calls).toEqual([]);           // the component's own debounce
      await vi.advanceTimersByTimeAsync(1);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      expect(calls).toEqual(['ada']);      // and NOT 300ms more
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not filter a fetched list again', async () => {
    // ★★★ THE SILENT ONE. A server matching on an email column returns
    //     "Ada Lovelace" for the term "ada@" — and a client-side filter that
    //     can only see `label` then removes the row the server just matched,
    //     leaving "No results found" over a correct answer.
    const fixture = await setup({ loadOptions: async () => PEOPLE });
    const c = fixture.componentInstance;
    c.openDropdown();
    await until(() => c.effectiveOptions().length === 2, { label: 'options landed' });

    c.setSearch('zzz-matches-no-label');
    fixture.detectChanges();
    await until(() => c.filteredOptions().length === 2, { label: 'the list survived the term' });
    expect(c.resolvedServerSide()).toBe(true);
  });

  it('separates the first load from a refinement', async () => {
    const first = deferred<readonly SelectOption[]>();
    const second = deferred<readonly SelectOption[]>();
    let n = 0;
    const fixture = await setup({
      loadOptions: () => (n++ === 0 ? first.promise : second.promise),
    });
    const c = fixture.componentInstance;

    c.openDropdown();
    await until(() => c.panelLoading(), { label: 'the first load started' });
    // Nothing on screen yet, so there is nothing to call stale.
    expect(c.panelStale()).toBe(false);

    first.resolve(PEOPLE);
    await until(() => c.effectiveOptions().length === 2, { label: 'the first load landed' });
    expect(c.panelLoading()).toBe(false);

    c.setSearch('gr');
    fixture.detectChanges();
    await until(() => c.panelStale(), { label: 'the refinement went stale' });
    // The list stays put and dims rather than collapsing under the cursor.
    expect(c.filteredOptions()).toHaveLength(2);

    second.resolve([PEOPLE[1]]);
    await until(() => c.filteredOptions().length === 1, { label: 'the refinement landed' });
    expect(c.panelStale()).toBe(false);
  });

  it('surfaces a failure as the panel error, and retries it', async () => {
    let attempt = 0;
    const fixture = await setup({
      loadOptions: async () => {
        if (attempt++ === 0) throw new Error('gateway down');
        return PEOPLE;
      },
    });
    const c = fixture.componentInstance;

    c.openDropdown();
    await until(() => !!c.panelError(), { label: 'the failure surfaced' });

    c.onRetry();
    await until(() => c.effectiveOptions().length === 2, { label: 'the retry succeeded' });
    expect(c.panelError()).toBeNull();
  });

  it('aborts the in-flight request when the panel closes, and keeps the label', async () => {
    let aborted = false;
    const pending = deferred<readonly SelectOption[]>();
    const fixture = await setup({
      value: 'ada',
      selectedOption: PEOPLE[0],
      loadOptions: (_t: string, signal: AbortSignal) => {
        signal.addEventListener('abort', () => { aborted = true; });
        return pending.promise;
      },
    });
    const c = fixture.componentInstance;

    c.openDropdown();
    await until(() => c.panelLoading(), { label: 'the request went out' });
    c.closeDropdown();

    await until(() => aborted, { label: 'closing aborted the request' });
    expect(c.panelLoading()).toBe(false);
    expect(c.displayLabel()).toBe('Ada Lovelace');
    expect(c.hasStaleValue()).toBe(false);
  });

  it('closing keeps the options, so a selection resolved from them keeps its label', async () => {
    // ★★★ `cancel`, not `clear` — and this is the test that tells them apart.
    //     The first draft asserted the label with `selectedOption` also set,
    //     which the hydration path answers on its own: swapping `cancel` for
    //     `clear` left it green. No `selectedOption` here, so the label can
    //     only come from the fetched list, and wiping that list on close makes
    //     a perfectly live value read as "Unavailable" the moment the panel
    //     shuts — while the user is looking at it.
    const fixture = await setup({ loadOptions: async () => PEOPLE });
    const c = fixture.componentInstance;

    c.openDropdown();
    await until(() => c.effectiveOptions().length === 2, { label: 'options landed' });
    c.selectOption(PEOPLE[0]);
    fixture.detectChanges();
    expect(c.displayLabel()).toBe('Ada Lovelace');

    c.closeDropdown();
    fixture.detectChanges();
    expect(c.effectiveOptions()).toHaveLength(2);
    expect(c.displayLabel()).toBe('Ada Lovelace');
    expect(c.hasStaleValue()).toBe(false);
  });

  it('leaves every remote signal alone when no source is given', async () => {
    // The controller is constructed unconditionally, so this is the test that
    // it stays genuinely inert — including that `serverSide` is NOT implied.
    const fixture = await setup({ options: PEOPLE, loading: false });
    const c = fixture.componentInstance;
    c.openDropdown();
    await quietFor();

    expect(c.remote()).toBe(false);
    expect(c.resolvedServerSide()).toBe(false);
    expect(c.effectiveOptions()).toEqual(PEOPLE);
    expect(c.panelLoading()).toBe(false);
    expect(c.panelError()).toBeNull();

    c.setSearch('grace');
    fixture.detectChanges();
    expect(c.filteredOptions().map((o) => o.value)).toEqual(['grace']);
  });

  it("ORs the host's own loading and error in rather than replacing them", async () => {
    // A host with a source set can still be loading the *selected* entity.
    const fixture = await setup({ loadOptions: async () => PEOPLE, error: 'profile unavailable' });
    const c = fixture.componentInstance;
    c.openDropdown();
    await until(() => c.effectiveOptions().length === 2, { label: 'options landed' });
    expect(c.panelError()).toBe('profile unavailable');
  });

  it('still emits searchChange so a host can mirror the term', async () => {
    const seen: string[] = [];
    TestBed.resetTestingModule();
    svResetWarnOnce();
    const { fixture } = await render(SvSelectDropdownComponent, {
      inputs: { searchable: true, debounceMs: 0, loadOptions: async () => PEOPLE },
      on: { searchChange: (t: string) => seen.push(t) },
    });
    fixture.componentInstance.setSearch('ada');
    fixture.detectChanges();
    await until(() => seen.includes('ada'), { label: 'searchChange fired' });
  });
});

describe('SvSelectDropdownComponent — loadOptions dev guards', () => {
  it('warns when a held value resolves to nothing and no selectedOption is given', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { /* quiet */ });
    try {
      const fixture = await setup({ loadOptions: async () => PEOPLE, value: 'someone-else' });
      fixture.detectChanges();
      await until(
        () => warn.mock.calls.some((c) => String(c[0]).includes('selectedOption')),
        { label: 'the hydration warning fired' },
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('warns when a source and host paging are both used', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { /* quiet */ });
    try {
      const fixture = await setup({ loadOptions: async () => PEOPLE, hasMore: true });
      fixture.detectChanges();
      await until(
        () => warn.mock.calls.some((c) => String(c[0]).includes('hasMore')),
        { label: 'the paging warning fired' },
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('stays quiet on the ordinary case', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => { /* quiet */ });
    try {
      const fixture = await setup({
        loadOptions: async () => PEOPLE,
        value: 'ada',
        selectedOption: PEOPLE[0],
      });
      fixture.componentInstance.openDropdown();
      await quietFor();
      expect(warn.mock.calls.filter((c) => String(c[0]).includes('sv-select-dropdown'))).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});
