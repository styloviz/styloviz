import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvBreadcrumbComponent } from './breadcrumb.component';
import { SV_BREADCRUMB_LABELS } from './breadcrumb.labels';

const ITEMS = [{ label: 'Home', routerLink: '/' }, { label: 'Catalogue', routerLink: '/c' }, { label: 'Widgets', routerLink: '/c/w' }, { label: 'Blue', routerLink: '/c/w/b' }, { label: 'Widget 42' }];

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const view = await render(SvBreadcrumbComponent, {
    inputs: { items: ITEMS, maxVisible: 3, expandable: false },
    providers: [provideRouter([]), ...providers] as never[],
  });
  return view;
}

describe('SvBreadcrumbComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('img', { name: SV_BREADCRUMB_LABELS.morePages }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ breadcrumb: { morePages: 'Weitere Seiten' } })]);
    expect(screen.getAllByRole('img', { name: 'Weitere Seiten' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('img', { name: 'More pages' })).toBeNull();
  });
});

describe('SvBreadcrumbComponent — composed accessible names (FL-B1c)', () => {
  it('fills a translated plural template whose count sits in a different position', async () => {
    TestBed.resetTestingModule();
    await render(SvBreadcrumbComponent, {
      inputs: { items: ITEMS, maxVisible: 3, expandable: true },
      providers: [
        provideRouter([]),
        provideSvLabels({
          breadcrumb: {
            showHiddenPages: '{count, plural, one {Eine ausgeblendete Seite anzeigen} other {Ausgeblendete Seiten anzeigen: #}}',
          },
        }),
      ],
    });
    expect(screen.getByRole('button', { name: 'Ausgeblendete Seiten anzeigen: 2' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show 2 hidden pages' })).toBeNull();
  });
});

describe('SvBreadcrumbComponent — visible text (FL-B1d)', () => {
  it('renders the loading text an app provides', async () => {
    TestBed.resetTestingModule();
    const { container } = await render(SvBreadcrumbComponent, {
      inputs: { items: ITEMS, loading: true },
      providers: [provideRouter([]), provideSvLabels({ breadcrumb: { loadingBreadcrumb: 'Brotkrumen werden geladen…' } })],
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Brotkrumen werden geladen…');
    expect(container.textContent).not.toContain('Loading breadcrumb…');
  });
});
