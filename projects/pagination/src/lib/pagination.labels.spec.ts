import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvPaginationComponent } from './pagination.component';
import { SV_PAGINATION_LABELS } from './pagination.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvPaginationComponent, {
    inputs: { totalItems: 100, pageSize: 10, currentPage: 5 },
    providers: providers as never[],
  });
}

describe('SvPaginationComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('button', { name: SV_PAGINATION_LABELS.nextPage }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ pagination: { nextPage: 'Nächste Seite', previousPage: 'Vorherige Seite' } })]);
    expect(screen.getAllByRole('button', { name: 'Nächste Seite' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Vorherige Seite' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
  });

  it('fills a composed name from a template whose slot moves (FL-B1c)', async () => {
    await setup([provideSvLabels({ pagination: { goToPage: '{page}. Seite' } })]);
    expect(screen.getAllByRole('button', { name: '5. Seite' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Page 5' })).toBeNull();
  });
});

describe('SvPaginationComponent — visible text (FL-B1d)', () => {
  it('renders the page-size label an app provides', async () => {
    TestBed.resetTestingModule();
    await render(SvPaginationComponent, {
      inputs: { totalItems: 100, pageSize: 10, currentPage: 1, pageSizeOptions: [10, 20] },
      providers: [provideSvLabels({ pagination: { rowsPerPage: 'Zeilen pro Seite' } })],
    });
    expect(screen.getByText('Zeilen pro Seite')).toBeTruthy();
    expect(screen.queryByText('Rows per page')).toBeNull();
  });
});

describe('SvPaginationComponent — a sentence glued around data (FL-B1e)', () => {
  it('writes the position from a translated template', async () => {
    const { fixture } = await setup([provideSvLabels({ pagination: { positionPageOf: 'Seite {page} von {total}' } })]);
    expect(fixture.componentInstance.positionLabel()).toBe('Seite 5 von 10');
  });
});
