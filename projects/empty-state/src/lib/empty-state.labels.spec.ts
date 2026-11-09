import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvEmptyStateComponent } from './empty-state.component';
import { SV_EMPTY_STATE_LABELS } from './empty-state.labels';

/** FL-B1d: the text the component renders itself is the package's English until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvEmptyStateComponent, {
    inputs: { activeFilters: ['Status: Overdue'] },
    providers: providers as never[],
  });
}

describe('SvEmptyStateComponent — visible text (FL-B1d)', () => {
  it('labels the clear-filters button in English by default', async () => {
    await setup();
    expect(screen.getByRole('button', { name: SV_EMPTY_STATE_LABELS.clearFilters })).toBeTruthy();
  });

  it('renders the clear-filters label an app provides', async () => {
    await setup([provideSvLabels({ emptyState: { clearFilters: 'Filter zurücksetzen' } })]);
    expect(screen.getByRole('button', { name: 'Filter zurücksetzen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('builds the reason-chosen title and message from the labels an app provides (FL-B1e)', async () => {
    TestBed.resetTestingModule();
    await render(SvEmptyStateComponent, {
      inputs: { reason: 'error' },
      providers: [
        provideSvLabels({
          emptyState: {
            errorTitle: 'Konnte nicht geladen werden',
            errorMessage: 'Beim Laden ist etwas schiefgegangen. Versuchen Sie es erneut.',
          },
        }),
      ],
    });
    expect(screen.getByText('Konnte nicht geladen werden')).toBeTruthy();
    expect(screen.getByText('Beim Laden ist etwas schiefgegangen. Versuchen Sie es erneut.')).toBeTruthy();
    expect(screen.queryByText('Could not load this')).toBeNull();
  });
});
