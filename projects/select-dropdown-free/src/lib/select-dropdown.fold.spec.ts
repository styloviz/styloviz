import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvSelectDropdownComponent } from './select-dropdown.component';

/** `FL-J3-FI-08` — the local search folds accents and case, as the autocomplete does. */
describe('sv-select-dropdown — folded local search', () => {
  it('finds José from “jose”, in flat options and in groups', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSelectDropdownComponent, {
      inputs: {
        options: [{ value: 'j', label: 'José' }, { value: 'k', label: 'Kim' }],
        groups: [{ label: 'Team', options: [{ value: 'm', label: 'Müller' }] }],
      },
    });
    const c = fixture.componentInstance;
    c.setSearch('jose');
    expect(c.filteredOptions().map((o) => o.value)).toEqual(['j']);
    c.setSearch('MULLER');
    expect(c.filteredGroups().flatMap((g) => g.options.map((o) => o.value))).toEqual(['m']);
  });
});
