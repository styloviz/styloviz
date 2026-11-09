import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAutocompleteComponent, SvAutocompleteOptionDirective, type AutocompleteOption } from './autocomplete.component';

/**
 * FL-G3 — an `svAutocompleteOption` template replaces what a row shows, and
 * nothing else: the `role="option"` row, its id for `aria-activedescendant`,
 * the highlight and the click stay the component's.
 */
afterEach(() => document.querySelectorAll('.sv-ac-portal').forEach((n) => n.remove()));

const PEOPLE: readonly AutocompleteOption[] = [
  { value: 'u1', label: 'Maya Chen' },
  { value: 'u2', label: 'Diego Álvarez' },
];
const EMAILS: Record<string, string> = { u1: 'maya@example.com', u2: 'diego@example.com' };

@Component({
  imports: [SvAutocompleteComponent, SvAutocompleteOptionDirective],
  template: `
    <!-- serverSide: the options are drawn as given, so the selected one's label does not filter the rest out. -->
    <sv-autocomplete [options]="people" [serverSide]="true" [(value)]="value">
      <ng-template svAutocompleteOption let-opt let-active="active" let-selected="selected" let-query="query">
        <span data-row [attr.data-active]="active" [attr.data-selected]="selected" [attr.data-query]="query">
          {{ opt.label }} · {{ emails[opt.value] }}
        </span>
      </ng-template>
    </sv-autocomplete>`,
})
class HostComponent {
  readonly people = PEOPLE;
  readonly emails = EMAILS;
  readonly value = signal('u2');
}

async function open() {
  TestBed.resetTestingModule();
  const { fixture } = await render(HostComponent);
  const ac = fixture.debugElement.children[0].componentInstance as SvAutocompleteComponent;
  ac.onFocus();
  fixture.detectChanges();
  const listbox = document.querySelector('.sv-ac-portal [role="listbox"]')!;
  return { fixture, ac, listbox, input: (fixture.nativeElement as HTMLElement).querySelector('input')! };
}

describe('sv-autocomplete — svAutocompleteOption rows', () => {
  it('draws the host template inside each option row, with the option it is for', async () => {
    const { listbox } = await open();
    const rows = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(rows.map((r) => r.querySelector('[data-row]')?.textContent?.trim())).toEqual([
      'Maya Chen · maya@example.com',
      'Diego Álvarez · diego@example.com',
    ]);
    // The default content is gone: no highlight marks, no check icon.
    expect(listbox.querySelector('mark')).toBeNull();
    expect(listbox.querySelector('sv-icon')).toBeNull();
  });

  it('keeps the row: role, id for aria-activedescendant, aria-selected', async () => {
    const { listbox, input, fixture } = await open();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    const active = document.getElementById(input.getAttribute('aria-activedescendant')!)!;
    expect(active.getAttribute('role')).toBe('option');
    expect(active.querySelector('[data-row]')).not.toBeNull();
    const rows = [...listbox.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(rows.map((r) => r.getAttribute('aria-selected'))).toEqual(['false', 'true']);
  });

  it('tells the template which row is active and which is selected', async () => {
    const { listbox, input, fixture } = await open();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    const marks = [...listbox.querySelectorAll<HTMLElement>('[data-row]')];
    const activeRow = document.getElementById(input.getAttribute('aria-activedescendant')!)!.querySelector('[data-row]');
    expect(activeRow?.getAttribute('data-active')).toBe('true');
    expect(marks.map((m) => m.getAttribute('data-selected'))).toEqual(['false', 'true']);
  });

  it('gives the template what the user typed', async () => {
    const { ac, fixture } = await open();
    ac.onInputChange('Di');
    fixture.detectChanges();
    const row = document.querySelector('.sv-ac-portal [data-row]')!;
    expect(row.getAttribute('data-query')).toBe('Di');
  });

  it('a click on the custom content still picks the option', async () => {
    const { listbox, fixture } = await open();
    listbox.querySelector<HTMLElement>('[role="option"] [data-row]')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('u1');
  });
});
