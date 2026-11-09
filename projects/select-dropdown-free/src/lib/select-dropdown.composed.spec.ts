import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { until } from '@testing/async';
import { svSelectSource, type SvSelectSource } from '@styloviz/core/data';
import { svResetWarnOnce } from '@styloviz/core/dev';
import { SvSelectDropdownComponent, type SelectOption } from './select-dropdown.component';
import { SvSelectSearchDirective } from './select-search.directive';

/**
 * `FI-23-M1`, Major N — the composed shape, free twin.
 *
 * Free has search and async, so it gets `svSelectSearch` and `[source]`. It
 * has no windowing or bulk selection, and ships no directives for them.
 *
 * In 2.0 this is the only shape: feature children configure the select, a
 * `source` supplies a server list, and a setting no child binds keeps the
 * select's built-in default. The other specs in this folder reach the same
 * shape through `renderSelect` (`@testing/select-host`).
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

describe('svSelectSearch', () => {
  it('turns the search box on by its presence, and filters', async () => {
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts">
         <ng-container svSelectSearch [debounceMs]="0" />
       </sv-select-dropdown>`,
      { opts: FRUIT },
    );
    expect(select.resolvedSearchable()).toBe(true);
    select.openDropdown();
    select.setSearch('ap');
    sync(fixture);

    expect(searchBox()?.placeholder).toBe('Search…');
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

  it('emits searchChange on the directive', async () => {
    const onChild: string[] = [];
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts">
         <ng-container svSelectSearch [debounceMs]="0" (searchChange)="onChild.push($event)" />
       </sv-select-dropdown>`,
      { opts: FRUIT, onChild },
    );
    select.openDropdown();
    select.setSearch('ban');
    sync(fixture);
    await until(() => onChild.length === 1, { label: 'the directive heard the term' });

    expect(onChild).toEqual(['ban']);
  });

  it('holds the term back under its minChars, with the same hint', async () => {
    const seen: string[] = [];
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts">
         <ng-container svSelectSearch [minChars]="3" [debounceMs]="0" (searchChange)="seen.push($event)" />
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

describe('svSelectSearch — defaults and presence', () => {

  it('keeps the built-in default for a member it leaves unbound', async () => {
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts">
         <ng-container svSelectSearch />
       </sv-select-dropdown>`,
      { opts: FRUIT },
    );
    select.openDropdown();
    select.setSearch('a');
    sync(fixture);
    expect(searchBox()?.placeholder).toBe('Search…');
    expect(select.resolvedMinChars()).toBe(0);
    expect(select.resolvedDebounceMs()).toBe(300);
  });

  it('can switch search off explicitly', async () => {
    const { fixture, select } = await mount(
      `<sv-select-dropdown [options]="opts">
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

describe('[source]', () => {
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

  it('pages: "Load more" appends, then disappears at the end', async () => {
    const src: WritableSignal<SvSelectSource<SelectOption> | null> = signal(null);
    const { fixture, select } = await mount(`<sv-select-dropdown [source]="src()" />`, { src });
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

  it('renders a failure in the panel and retries it itself', async () => {
    let fail = true;
    const src: WritableSignal<SvSelectSource<SelectOption> | null> = signal(null);
    const { fixture, select } = await mount(`<sv-select-dropdown [source]="src()" />`, { src });
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
    expect(select.panelError()).toBeNull();
  });

  it('applies the source\'s minChars', async () => {
    const src: WritableSignal<SvSelectSource<SelectOption> | null> = signal(null);
    const { fixture, select } = await mount(
      `<sv-select-dropdown [source]="src()"><ng-container svSelectSearch [minChars]="2" /></sv-select-dropdown>`,
      { src },
    );
    // Adapter → feature child → built-in default.
    expect(select.resolvedMinChars()).toBe(2);
    src.set(makeSource(() => FRUIT, { minChars: 3 }));
    sync(fixture);
    expect(select.resolvedMinChars()).toBe(3);
  });
});
