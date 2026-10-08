import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import {
  SvSelectDropdownComponent,
  type SelectOption,
} from './select-dropdown.component';

const OPTIONS: SelectOption[] = [
  { value: 'us', label: 'United States' },
  { value: 'ca', label: 'Canada' },
  { value: 'mx', label: 'Mexico' },
  { value: 'br', label: 'Brazil', disabled: true },
];

async function setup(extra: Record<string, unknown> = {}) {
  const { fixture } = await render(SvSelectDropdownComponent, {
    inputs: { options: OPTIONS, ...extra },
  });
  return fixture.componentInstance;
}

describe('SvSelectDropdownComponent — open/close', () => {
  it('toggles the panel open and shut', async () => {
    const c = await setup();
    expect(c.isOpen()).toBe(false);
    c.toggleDropdown();
    expect(c.isOpen()).toBe(true);
    c.toggleDropdown();
    expect(c.isOpen()).toBe(false);
  });
});

describe('SvSelectDropdownComponent — single select', () => {
  it('sets the value, emits selectionChange, and closes', async () => {
    const spy = vi.fn();
    const c = await setup();
    c.selectionChange.subscribe(spy);
    c.openDropdown();

    c.selectOption(OPTIONS[1]);
    expect(c.value()).toBe('ca');
    expect(c.isSelected('ca')).toBe(true);
    expect(spy).toHaveBeenCalledWith('ca');
    expect(c.isOpen()).toBe(false);
  });

  it('ignores selection of a disabled option', async () => {
    const c = await setup();
    c.selectOption(OPTIONS[3]); // Brazil, disabled
    expect(c.hasValue()).toBe(false);
  });
});

describe('SvSelectDropdownComponent — multiple select', () => {
  it('accumulates and toggles values off', async () => {
    const c = await setup({ multiple: true });
    c.selectOption(OPTIONS[0]);
    c.selectOption(OPTIONS[1]);
    expect(c.value()).toEqual(['us', 'ca']);

    c.selectOption(OPTIONS[0]); // toggle off
    expect(c.value()).toEqual(['ca']);
  });

  it('respects maxSelected', async () => {
    const c = await setup({ multiple: true, maxSelected: 1 });
    c.selectOption(OPTIONS[0]);
    c.selectOption(OPTIONS[1]); // blocked
    expect(c.value()).toEqual(['us']);
  });
});

describe('SvSelectDropdownComponent — search & clear', () => {
  /**
   * `searchChange` is debounced and emitted from an effect now, so it needs a
   * change-detection pass. The local filter still updates synchronously.
   */
  it('filters options by query and emits searchChange', async () => {
    TestBed.resetTestingModule();
    const spy = vi.fn();
    const { fixture } = await render(SvSelectDropdownComponent, {
      inputs: { options: OPTIONS, searchable: true, debounceMs: 0 },
      on: { searchChange: spy },
    });

    fixture.componentInstance.setSearch('can');
    expect(fixture.componentInstance.filteredOptions().map((o) => o.value)).toEqual(['ca']);
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledWith('can');
  });

  it('reports no results for a non-matching query', async () => {
    const c = await setup({ searchable: true });
    c.setSearch('zzz');
    expect(c.noResults()).toBe(true);
  });

  it('clears the selection via clearAll', async () => {
    const c = await setup({ clearable: true });
    c.selectOption(OPTIONS[0]);
    c.clearAll(new MouseEvent('click'));
    expect(c.hasValue()).toBe(false);
  });
});

describe('SvSelectDropdownComponent — accessibility', () => {
  it('renders its associated label text', async () => {
    await render(SvSelectDropdownComponent, {
      inputs: { options: OPTIONS, label: 'Country' },
    });
    expect(screen.getByText('Country')).toBeTruthy();
  });
});
