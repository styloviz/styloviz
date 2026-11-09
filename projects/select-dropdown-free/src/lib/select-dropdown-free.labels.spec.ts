import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvSelectDropdownComponent } from './select-dropdown.component';
import { SV_SELECT_DROPDOWN_LABELS } from './select-dropdown-free.labels';
import { SvSelectSearchDirective } from './select-search.directive';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvSelectDropdownComponent, {
    inputs: { options: OPTIONS, value: 'a', clearable: true },
    providers: providers as never[],
  });
}

describe('SvSelectDropdownComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('button', { name: SV_SELECT_DROPDOWN_LABELS.clearSelection }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ selectDropdown: { clearSelection: 'Auswahl löschen' } })]);
    expect(screen.getAllByRole('button', { name: 'Auswahl löschen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Clear selection' })).toBeNull();
  });
});

describe('SvSelectDropdownComponent — composed accessible names (FL-B1c)', () => {
  it('fills a translated template whose slot sits in a different position', async () => {
    TestBed.resetTestingModule();
    await render(SvSelectDropdownComponent, {
      inputs: { options: OPTIONS, multiple: true, value: ['a', 'b'] },
      providers: [provideSvLabels({ selectDropdown: { removeChip: '{name} entfernen' } })],
    });
    expect(screen.getAllByRole('button', { name: 'Alpha entfernen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Remove Alpha' })).toBeNull();
  });
});

describe('SvSelectDropdownComponent — visible text (FL-B1d)', () => {
  it('shows the placeholder an app provides', async () => {
    TestBed.resetTestingModule();
    await render(SvSelectDropdownComponent, {
      inputs: { options: OPTIONS },
      providers: [provideSvLabels({ selectDropdown: { placeholder: 'Option wählen' } })],
    });
    expect(screen.getAllByText('Option wählen').length).toBeGreaterThan(0);
    expect(screen.queryByText('Select an option')).toBeNull();
  });
});

describe('SvSelectDropdownComponent — text built in TypeScript (FL-B1e)', () => {
  it('uses the search placeholder an app provides when svSelectSearch sets none', async () => {
    TestBed.resetTestingModule();
    const view = await render(
      `<sv-select-dropdown [options]="opts">
         <ng-container svSelectSearch />
       </sv-select-dropdown>`,
      {
        imports: [SvSelectDropdownComponent, SvSelectSearchDirective],
        componentProperties: { opts: OPTIONS },
        providers: [provideSvLabels({ selectDropdown: { searchPlaceholder: 'Suchen…' } })],
      },
    );
    const select = view.fixture.debugElement.query(
      (d) => d.componentInstance instanceof SvSelectDropdownComponent,
    ).componentInstance as SvSelectDropdownComponent;
    select.openDropdown();
    select.setSearch('a');
    view.fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    const box = document.querySelector<HTMLElement>('.sv-sd-portal')?.querySelector<HTMLInputElement>('input[type="text"]');
    expect(box?.placeholder).toBe('Suchen…');
  });
});

describe('SvSelectDropdownComponent — glued sentences become labels (FL-B1e wave 4)', () => {
  it('writes the minChars hint from the plural template an app provides', async () => {
    TestBed.resetTestingModule();
    const view = await render(
      `<sv-select-dropdown [options]="opts">
         <ng-container svSelectSearch [debounceMs]="0" [minChars]="2" />
       </sv-select-dropdown>`,
      {
        imports: [SvSelectDropdownComponent, SvSelectSearchDirective],
        componentProperties: { opts: OPTIONS },
        providers: [
          provideSvLabels({ selectDropdown: { minCharsHint: '{count, plural, one {Noch # Zeichen eingeben} other {Noch # Zeichen eingeben}}' } }),
        ],
      },
    );
    const select = view.fixture.debugElement.query(
      (d) => d.componentInstance instanceof SvSelectDropdownComponent,
    ).componentInstance as SvSelectDropdownComponent;
    expect(select.minCharsHint()).toBe('Noch 2 Zeichen eingeben');
  });
});
