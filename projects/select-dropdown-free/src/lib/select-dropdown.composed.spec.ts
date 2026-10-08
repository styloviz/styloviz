import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { until } from '@testing/async';
import { svResetWarnOnce, svSelectSource, type SvSelectSource } from '@styloviz/core';
import { SvSelectDropdownComponent, type SelectOption } from './select-dropdown.component';
import { SvSelectSearchDirective } from './select-search.directive';

/**
 * `FI-23-M1`, Major N — the composed shape, free twin.
 *
 * Free has search and async, so it gets `svSelectSearch` and `[source]`. It
 * has no windowing or bulk selection, and ships no directives for them.
 *
 * Every test here is one of two kinds:
 *
 *  - **Equivalence.** The new shape renders what the old shape renders. The
 *    legacy specs in this folder are untouched and still pass, so each
 *    feature's behaviour is pinned twice — once per spelling.
 *  - **Precedence.** When both spellings are set, the feature child (or the
 *    adapter) wins; when a feature child leaves a member unbound, the legacy
 *    input still applies. That fallback is what makes Major N non-breaking.
 */

const IMPORTS = [SvSelectDropdownComponent, SvSelectSearchDirective];

const many = (n: number): SelectOption[] =>
  Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` }));

const FRUIT: SelectOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'apricot', label: 'Apricot' },
  { value: 'banana', label: 'Banana' },
];

const PEOPLE: SelectOption[] = [
  { value: 'ada', label: 'Ada' },
  { value: 'alan', label: 'Alan' },
  { value: 'grace', label: 'Grace' },
  { value: 'katherine', label: 'Katherine', disabled: true },
];

afterEach(() => TestBed.resetTestingModule());

async function mount(template: string, props: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  svResetWarnOnce();
  const view = await render(template, { imports: IMPORTS, componentProperties: props });
  const select = view.fixture.debugElement.query(
    (d) => d.componentInstance instanceof SvSelectDropdownComponent,
  ).componentInstance as SvSelectDropdownComponent;
  return { fixture: view.fixture, select };
}

function sync(fixture: { detectChanges(): void }): void {
  fixture.detectChanges();
  TestBed.inject(ApplicationRef).tick();
}

const portal = () => document.querySelector<HTMLElement>('.sv-sd-portal');
const optionRows = (): HTMLElement[] =>
  Array.from(portal()?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
const labels = (): string[] => optionRows().map((r) => r.textContent?.trim() ?? '');
const searchBox = () => portal()?.querySelector<HTMLInputElement>('input[type="text"]') ?? null;

/** Built after render: `svSelectSource` needs the test injector. */
function makeSource(
  search: (term: string, page: { offset: number; limit: number }) => readonly SelectOption[],
  extra: { pageSize?: number; minChars?: number; debounceMs?: number } = {},
): SvSelectSource<SelectOption> {
  return TestBed.runInInjectionContext(() =>
    svSelectSource<SelectOption>({
      search: async (term, _signal, page) => search(term, page),
      debounceMs: 0,
      ...extra,
    }),
  );
}

// ── svSelectSearch ───────────────────────────────────────────────────────────

describe('svSelectSearch — equivalent to the legacy search inputs', () => {
  it('turns the search box on by its presence, with the same filtering', async () => {
    const legacy = await mount(
      `<sv-select-dropdown [options]="opts" [searchable]="true" [debounceMs]="0" />`,
      { opts: FRUIT },
    );
    legacy.select.openDropdown();
    legacy.select.setSearch('ap');
    sync(legacy.fixture);
    const oldLabels = labels();
    const oldPlaceholder = searchBox()?.placeholder;
    legacy.select.closeDropdown();

    const composed = await mount(
      `<sv-select-dropdown [options]="opts">
         <ng-container svSelectSearch [debounceMs]="0" />
       </sv-select-dropdown>`,
      { opts: FRUIT },
    );
    expect(composed.select.resolvedSearchable()).toBe(true);
    composed.select.openDropdown();
    composed.select.setSearch('ap');
    sync(composed.fixture);

    expect(searchBox()).not.toBeNull();
    expect(searchBox()?.placeholder).toBe(oldPlaceholder);
    expect(labels()).toEqual(oldLabels);
    expect(labels()).toEqual(['Apple', 'Apricot']);
  });

  it('renders its own copy', async () => {
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts">
         <ng-container svSelectSearch searchPlaceholder="Find fruit" noResultsText="Nothing ripe" [debounceMs]="0" />
       </sv-select-dropdown>`,
      { opts: FRUIT },
    );
    select.openDropdown();
    select.setSearch('zzz');
    sync(fixture);

    expect(searchBox()?.placeholder).toBe('Find fruit');
    expect(portal()?.querySelector('[data-sv-state="empty"]')?.textContent).toContain('Nothing ripe');
  });

  it('emits searchChange on the directive AND on the select', async () => {
    const onChild: string[] = [];
    const onSelect: string[] = [];
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts" (searchChange)="onSelect.push($event)">
         <ng-container svSelectSearch [debounceMs]="0" (searchChange)="onChild.push($event)" />
       </sv-select-dropdown>`,
      { opts: FRUIT, onChild, onSelect },
    );
    select.openDropdown();
    select.setSearch('ban');
    sync(fixture);
    await until(() => onChild.length === 1, { label: 'the directive heard the term' });

    expect(onChild).toEqual(['ban']);
    expect(onSelect).toEqual(['ban']);
  });

  it('holds the term back under its minChars, with the same hint', async () => {
    const seen: string[] = [];
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts" (searchChange)="seen.push($event)">
         <ng-container svSelectSearch [minChars]="3" [debounceMs]="0" />
       </sv-select-dropdown>`,
      { opts: FRUIT, seen },
    );
    select.openDropdown();
    select.setSearch('ap');
    sync(fixture);

    expect(seen).toEqual([]);
    expect(portal()?.querySelector('[data-sv-state="min-chars"]')?.textContent).toContain('Type 3 characters');
  });

  it('shows options as given with serverSide', async () => {
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts">
         <ng-container svSelectSearch [serverSide]="true" [debounceMs]="0" />
       </sv-select-dropdown>`,
      { opts: FRUIT },
    );
    select.openDropdown();
    select.setSearch('zzz');
    sync(fixture);
    expect(labels()).toEqual(['Apple', 'Apricot', 'Banana']);
  });
});

describe('svSelectSearch — precedence', () => {
  it('wins over the legacy input when both are set', async () => {
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts" [searchable]="true" searchPlaceholder="Old">
         <ng-container svSelectSearch searchPlaceholder="New" />
       </sv-select-dropdown>`,
      { opts: FRUIT },
    );
    select.openDropdown();
    sync(fixture);
    expect(searchBox()?.placeholder).toBe('New');
  });

  it('falls through to the legacy input for a member it leaves unbound', async () => {
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts" searchPlaceholder="From the select" [minChars]="4">
         <ng-container svSelectSearch />
       </sv-select-dropdown>`,
      { opts: FRUIT },
    );
    select.openDropdown();
    select.setSearch('a');
    sync(fixture);
    expect(searchBox()?.placeholder).toBe('From the select');
    expect(select.resolvedMinChars()).toBe(4);
  });

  it('can switch search off explicitly, over a legacy true', async () => {
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts" [searchable]="true">
         <ng-container svSelectSearch [searchable]="false" />
       </sv-select-dropdown>`,
      { opts: FRUIT },
    );
    select.openDropdown();
    sync(fixture);
    expect(searchBox()).toBeNull();
  });

  it('follows a feature child added and removed at runtime', async () => {
    const on = signal(false);
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts">
         @if (on()) { <ng-container svSelectSearch /> }
       </sv-select-dropdown>`,
      { opts: FRUIT, on },
    );
    expect(select.resolvedSearchable()).toBe(false);
    on.set(true);
    sync(fixture);
    expect(select.resolvedSearchable()).toBe(true);
    on.set(false);
    sync(fixture);
    expect(select.resolvedSearchable()).toBe(false);
  });
});

// ── source (svSelectSource) ──────────────────────────────────────────────────

describe('[source] — equivalent to loadOptions, plus paging', () => {
  it('fetches on open, searches on type, and does not filter again', async () => {
    const src: WritableSignal<SvSelectSource<SelectOption> | null> = signal(null);
    const { fixture, select } = await mount(
      `<sv-select-dropdown [source]="src()">
         <ng-container svSelectSearch />
       </sv-select-dropdown>`,
      { src },
    );
    const terms: string[] = [];
    // The server matches "ada" on a field the component cannot see — the
    // label "Grace" does not contain it. Re-filtering would hide it.
    src.set(makeSource((term) => { terms.push(term); return term ? [PEOPLE[2]] : PEOPLE; }));
    sync(fixture);

    select.openDropdown();
    await until(() => select.effectiveOptions().length === 4, { label: 'the open fetch landed' });
    expect(terms).toEqual(['']);
    expect(select.resolvedServerSide()).toBe(true);

    select.setSearch('ada');
    sync(fixture);
    await until(() => terms.length === 2, { label: 'the typed search went out' });
    await until(() => select.effectiveOptions().length === 1, { label: 'the typed search landed' });
    sync(fixture);
    expect(terms).toEqual(['', 'ada']);
    expect(labels()).toEqual(['Grace']);
  });

  it('matches the loadOptions shape row for row', async () => {
    const search = (term: string) => FRUIT.filter((f) => f.value.startsWith(term));

    const legacy = await mount(
      `<sv-select-dropdown [loadOptions]="load" [searchable]="true" [debounceMs]="0" />`,
      { load: async (term: string) => search(term) },
    );
    legacy.select.openDropdown();
    legacy.select.setSearch('ap');
    sync(legacy.fixture);
    await until(() => legacy.select.effectiveOptions().length === 2, { label: 'legacy landed' });
    sync(legacy.fixture);
    const oldLabels = labels();
    legacy.select.closeDropdown();

    const src: WritableSignal<SvSelectSource<SelectOption> | null> = signal(null);
    const composed = await mount(
      `<sv-select-dropdown [source]="src()"><ng-container svSelectSearch /></sv-select-dropdown>`,
      { src },
    );
    src.set(makeSource((term) => search(term)));
    sync(composed.fixture);
    composed.select.openDropdown();
    composed.select.setSearch('ap');
    sync(composed.fixture);
    await until(() => composed.select.effectiveOptions().length === 2, { label: 'source landed' });
    sync(composed.fixture);

    expect(labels()).toEqual(oldLabels);
  });

  it('pages: "Load more" appends, then disappears at the end', async () => {
    const src: WritableSignal<SvSelectSource<SelectOption> | null> = signal(null);
    const loadMore: number[] = [];
    const { fixture, select } = await mount(
      `<sv-select-dropdown [source]="src()" (loadMore)="loadMore.push(1)" />`,
      { src, loadMore },
    );
    const all = many(5);
    src.set(makeSource((_t, page) => all.slice(page.offset, page.offset + page.limit), { pageSize: 2 }));
    sync(fixture);

    select.openDropdown();
    await until(() => select.effectiveOptions().length === 2, { label: 'page one' });
    sync(fixture);
    const moreButton = () =>
      Array.from(portal()?.querySelectorAll('button') ?? []).find((b) => b.textContent?.includes('Load more'));
    expect(moreButton()).toBeDefined();

    moreButton()!.click();
    await until(() => select.effectiveOptions().length === 4, { label: 'page two' });
    sync(fixture);
    // The legacy output still fires: a host counting pages keeps working.
    expect(loadMore).toEqual([1]);

    moreButton()!.click();
    await until(() => select.effectiveOptions().length === 5, { label: 'page three' });
    sync(fixture);
    expect(labels()).toEqual(['Option 0', 'Option 1', 'Option 2', 'Option 3', 'Option 4']);
    expect(moreButton()).toBeUndefined();
  });

  it('shows the loading-more row while a page is in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const src: WritableSignal<SvSelectSource<SelectOption> | null> = signal(null);
    const { fixture, select } = await mount(`<sv-select-dropdown [source]="src()" />`, { src });
    src.set(TestBed.runInInjectionContext(() => svSelectSource<SelectOption>({
      pageSize: 2,
      search: async (_t, _s, page) => {
        if (page.offset > 0) await gate;
        return many(6).slice(page.offset, page.offset + 2);
      },
    })));
    sync(fixture);

    select.openDropdown();
    await until(() => select.effectiveOptions().length === 2, { label: 'page one' });
    select.onLoadMore();
    sync(fixture);
    expect(portal()?.querySelector('[data-sv-state="loading-more"]')).not.toBeNull();
    release();
    await until(() => select.effectiveOptions().length === 4, { label: 'page two' });
    sync(fixture);
    expect(portal()?.querySelector('[data-sv-state="loading-more"]')).toBeNull();
  });

  it('renders a failure in the panel and retries it itself, still emitting retry', async () => {
    let fail = true;
    const retries: number[] = [];
    const src: WritableSignal<SvSelectSource<SelectOption> | null> = signal(null);
    const { fixture, select } = await mount(
      `<sv-select-dropdown [source]="src()" (retry)="retries.push(1)" />`,
      { src, retries },
    );
    src.set(TestBed.runInInjectionContext(() => svSelectSource<SelectOption>({
      search: async () => { if (fail) { fail = false; throw new Error('503'); } return FRUIT; },
    })));
    sync(fixture);

    select.openDropdown();
    await until(() => select.panelError() !== null, { label: 'the load failed' });
    sync(fixture);
    expect(portal()?.querySelector('[data-sv-state="error"]')).not.toBeNull();

    select.onRetry();
    await until(() => select.effectiveOptions().length === 3, { label: 'the retry landed' });
    expect(retries).toEqual([1]);
    expect(select.panelError()).toBeNull();
  });

  it('applies the source\'s minChars', async () => {
    const src: WritableSignal<SvSelectSource<SelectOption> | null> = signal(null);
    const { fixture, select } = await mount(
      `<sv-select-dropdown [source]="src()" [minChars]="1"><ng-container svSelectSearch [minChars]="2" /></sv-select-dropdown>`,
      { src },
    );
    // Adapter → feature child → legacy input.
    expect(select.resolvedMinChars()).toBe(2);
    src.set(makeSource(() => FRUIT, { minChars: 3 }));
    sync(fixture);
    expect(select.resolvedMinChars()).toBe(3);
  });

  it('outranks loadOptions when both are set', async () => {
    let legacyCalls = 0;
    const src: WritableSignal<SvSelectSource<SelectOption> | null> = signal(null);
    const { fixture, select } = await mount(
      `<sv-select-dropdown [source]="src()" [loadOptions]="load" />`,
      { src, load: async () => { legacyCalls++; return PEOPLE; } },
    );
    src.set(makeSource(() => FRUIT));
    sync(fixture);
    select.openDropdown();
    await until(() => select.effectiveOptions().length === 3, { label: 'the source answered' });
    expect(legacyCalls).toBe(0);
    expect(select.effectiveOptions()).toEqual(FRUIT);
  });
});
