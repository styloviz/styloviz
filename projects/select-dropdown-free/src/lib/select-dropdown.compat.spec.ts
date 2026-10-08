import { ApplicationRef, type InputSignalWithTransform, type ModelSignal, type OutputEmitterRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { expectTypeOf } from 'vitest';
import { svResetWarnOnce, type SvDataError } from '@styloviz/core';
import {
  SvSelectDropdownComponent,
  type SelectGroup,
  type SelectOption,
  type SelectSize,
  type SelectVariant,
  type SvSelectOptionSource,
} from './select-dropdown.component';

/**
 * ============================================================================
 *  `FI-23-M1` Major N — the old free API still compiles and still works
 * ============================================================================
 *
 * Free twin — the Pro list minus its five windowing / bulk inputs.
 *
 * Major N adds the composed shape (feature children + `[source]`) and marks
 * the moved inputs `@deprecated`. It must break NOTHING: no input removed or
 * renamed, no type narrowed, no default changed, no output dropped. This file
 * pins all three levels:
 *
 *   1. **Types** — every legacy input accepts exactly what it accepted before,
 *      checked by `tsc` (`npm run verify` type-checks specs).
 *   2. **Defaults** — a bare select reads the same 33 defaults.
 *   3. **Behaviour** — a template binding all 33 inputs and all 6 outputs
 *      renders, and the settings resolve to the legacy values.
 */

type C = SvSelectDropdownComponent;

/** What a template may bind to a signal input / model. */
type Accepts<S> = S extends ModelSignal<infer M>
  ? M
  : S extends InputSignalWithTransform<infer _Read, infer W>
    ? W
    : never;
type Emits<S> = S extends OutputEmitterRef<infer T> ? T : never;

/** The 33 inputs as of 2026-09-14 (`docs/select-dropdown-split-adr.md`). */
interface LegacyInputs {
  value: string | string[];
  options: readonly SelectOption[];
  groups: SelectGroup[];
  placeholder: string;
  label: string;
  hint: string;
  errorMessage: string;
  serverError: string | { readonly message: string } | null;
  size: SelectSize;
  variant: SelectVariant;
  multiple: boolean;
  searchable: boolean;
  searchPlaceholder: string;
  loadingText: string;
  noResultsText: string;
  clearable: boolean;
  disabled: boolean;
  loading: boolean;
  stale: unknown;
  required: boolean;
  optionalTag: boolean;
  maxSelected: number;
  inputId: string;
  ariaLabel: string;
  customClass: string;
  serverSide: boolean;
  debounceMs: number;
  minChars: number;
  error: SvDataError | string | null;
  hasMore: boolean;
  loadingMore: boolean;
  selectedOption: SelectOption | null;
  loadOptions: SvSelectOptionSource | null;
}

interface LegacyOutputs {
  selectionChange: string | string[];
  dropdownOpen: void;
  dropdownClose: void;
  searchChange: string;
  retry: void;
  loadMore: void;
}

const DEFAULTS: { readonly [K in keyof LegacyInputs]: unknown } = {
  value: '',
  options: [],
  groups: [],
  placeholder: 'Select an option',
  label: '',
  hint: '',
  errorMessage: '',
  serverError: null,
  size: 'md',
  variant: 'default',
  multiple: false,
  searchable: false,
  searchPlaceholder: 'Search…',
  loadingText: 'Loading…',
  noResultsText: 'No results found',
  clearable: false,
  disabled: false,
  loading: false,
  stale: false,
  required: false,
  optionalTag: false,
  maxSelected: 0,
  inputId: '',
  ariaLabel: '',
  customClass: '',
  serverSide: false,
  debounceMs: 300,
  minChars: 0,
  error: null,
  hasMore: false,
  loadingMore: false,
  selectedOption: null,
  loadOptions: null,
};

afterEach(() => TestBed.resetTestingModule());

describe('SvSelectDropdownComponent — the legacy API (FI-23-M1 compat)', () => {
  it('accepts exactly the legacy input and output types', () => {
    expectTypeOf<{ [K in keyof LegacyInputs]: Accepts<C[K]> }>().toEqualTypeOf<LegacyInputs>();
    expectTypeOf<{ [K in keyof LegacyOutputs]: Emits<C[K]> }>().toEqualTypeOf<LegacyOutputs>();
    // The new input is optional and additive.
    expect(Object.keys(DEFAULTS)).toHaveLength(33);
  });

  it('keeps all 33 defaults', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSelectDropdownComponent);
    const c = fixture.componentInstance as unknown as Record<keyof LegacyInputs, () => unknown>;
    for (const [name, expected] of Object.entries(DEFAULTS)) {
      expect({ name, value: c[name as keyof LegacyInputs]() }).toEqual({ name, value: expected });
    }
    // …and the new shape is absent by default.
    expect(fixture.componentInstance.source()).toBeNull();
  });

  it('renders a template binding all 33 inputs and 6 outputs, driven by the legacy values', async () => {
    TestBed.resetTestingModule();
    svResetWarnOnce();
    const heard: string[] = [];
    const view = await render(
      `<sv-select-dropdown
         [(value)]="value"
         [options]="options"
         [groups]="groups"
         placeholder="Pick"
         label="People"
         hint="Hint"
         errorMessage=""
         [serverError]="null"
         size="lg"
         variant="filled"
         [multiple]="true"
         [searchable]="true"
         searchPlaceholder="Find someone"
         loadingText="Fetching"
         noResultsText="Nobody"
         [clearable]="true"
         [disabled]="false"
         [loading]="false"
         [stale]="false"
         [required]="true"
         [optionalTag]="false"
         [maxSelected]="5"
         inputId="compat-select"
         ariaLabel="Compat"
         customClass="compat"
         [serverSide]="false"
         [debounceMs]="0"
         [minChars]="2"
         [error]="null"
         [hasMore]="true"
         [loadingMore]="false"
         [selectedOption]="null"
         [loadOptions]="load"
         (selectionChange)="heard.push('selectionChange')"
         (dropdownOpen)="heard.push('dropdownOpen')"
         (dropdownClose)="heard.push('dropdownClose')"
         (searchChange)="heard.push('searchChange')"
         (retry)="heard.push('retry')"
         (loadMore)="heard.push('loadMore')"
       />`,
      {
        imports: [SvSelectDropdownComponent],
        componentProperties: {
          value: [] as string[],
          options: Array.from({ length: 60 }, (_, i) => ({ value: `p${i}`, label: `Person ${i}` })),
          groups: [],
          load: null,
          heard,
        },
      },
    );
    const select = view.fixture.debugElement.query(
      (d) => d.componentInstance instanceof SvSelectDropdownComponent,
    ).componentInstance as SvSelectDropdownComponent;

    // Every moved setting resolves to its legacy input.
    expect(select.resolvedSearchable()).toBe(true);
    expect(select.resolvedSearchPlaceholder()).toBe('Find someone');
    expect(select.resolvedLoadingText()).toBe('Fetching');
    expect(select.resolvedNoResultsText()).toBe('Nobody');
    expect(select.resolvedMinChars()).toBe(2);
    expect(select.resolvedDebounceMs()).toBe(0);
    expect(select.resolvedServerSide()).toBe(false);
    expect(select.resolvedHasMore()).toBe(true);
    expect(select.resolvedLoadingMore()).toBe(false);

    select.openDropdown();
    view.fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    const portal = document.querySelector<HTMLElement>('.sv-sd-portal')!;
    expect(portal.querySelector<HTMLInputElement>('input[type="text"]')?.placeholder).toBe('Find someone');

    const loadMore = Array.from(portal.querySelectorAll('button')).find((b) => b.textContent?.includes('Load more'));
    loadMore!.click();
    select.onRetry();
    select.closeDropdown();
    expect(heard).toEqual(['dropdownOpen', 'loadMore', 'retry', 'dropdownClose']);
  });
});
