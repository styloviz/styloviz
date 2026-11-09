import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { readListboxGroups } from '@testing/listbox-groups';
import { SvAutocompleteComponent } from './autocomplete.component';

/** `FL-J3-FI-07` / `FI-01-I5` — grouped results are announced as groups. */
afterEach(() => document.querySelectorAll('.sv-ac-portal').forEach((n) => n.remove()));

describe('sv-autocomplete — grouped listbox', () => {
  it('wraps each labelled section in a role="group" named by its heading', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvAutocompleteComponent, {
      inputs: {
        grouped: true,
        options: [
          { value: 'ada', label: 'Ada', group: 'People' },
          { value: 'alan', label: 'Alan', group: 'People' },
          { value: 'billing', label: 'Billing', group: 'Pages' },
          { value: 'misc', label: 'Misc' },
        ],
      },
    });
    fixture.componentInstance.onFocus();
    fixture.detectChanges();
    const listbox = document.querySelector('.sv-ac-portal [role="listbox"]')!;
    expect(readListboxGroups(listbox)).toEqual([
      { name: 'People', options: ['Ada', 'Alan'] },
      { name: 'Pages', options: ['Billing'] },
    ]);
    // The ungrouped option stays a direct option; no header text sits outside a group's name.
    expect([...listbox.querySelectorAll('[role="option"]')].length).toBe(4);
    // aria-activedescendant still addresses rows by their flat index.
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)!.textContent).toContain('Alan');
  });
});
