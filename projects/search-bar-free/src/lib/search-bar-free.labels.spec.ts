import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvSearchBarComponent } from './search-bar.component';
import { SV_SEARCH_BAR_LABELS } from './search-bar-free.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvSearchBarComponent, {
    inputs: { value: 'invoices' },
    providers: providers as never[],
  });
}

describe('SvSearchBarComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('button', { name: SV_SEARCH_BAR_LABELS.clearSearch }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ searchBar: { clearSearch: 'Suche löschen' } })]);
    expect(screen.getAllByRole('button', { name: 'Suche löschen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });
});

describe('SvSearchBarComponent — composed accessible names (FL-B1c)', () => {
  it('fills a translated template whose slot sits in a different position', async () => {
    TestBed.resetTestingModule();
    await render(SvSearchBarComponent, {
      inputs: { filters: [{ id: 'status', label: 'Offen' }] },
      providers: [provideSvLabels({ searchBar: { removeFilter: 'Filter {name} entfernen' } })],
    });
    expect(screen.getByRole('button', { name: 'Filter Offen entfernen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove filter Offen' })).toBeNull();
  });
});

describe('SvSearchBarComponent — visible text (FL-B1d)', () => {
  it('renders the placeholder an app provides', async () => {
    await setup([provideSvLabels({ searchBar: { searchPlaceholder: 'Suchen…' } })]);
    expect(screen.getByPlaceholderText('Suchen…')).toBeTruthy();
    expect(screen.queryByPlaceholderText(SV_SEARCH_BAR_LABELS.searchPlaceholder)).toBeNull();
  });
});

describe('SvSearchBarComponent — sentences built in TypeScript (FL-B1e wave 4)', () => {
  afterEach(() => document.querySelectorAll('[data-sv-state]').forEach((el) => el.remove()));

  it('quotes the unmatched term with the template an app provides', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSearchBarComponent, {
      inputs: { suggestions: [], emptyReason: 'no-results' },
      providers: [provideSvLabels({ searchBar: { nothingMatched: 'Keine Treffer für „{term}“' } })],
    });
    fixture.componentInstance.value.set('qqzz ');
    (fixture.componentInstance as unknown as { isFocused: { set(v: boolean): void } }).isFocused.set(true);
    fixture.detectChanges();
    expect(document.body.textContent).toContain('Keine Treffer für „qqzz“');
    expect(document.body.textContent).not.toContain('Nothing matched');
  });
});
