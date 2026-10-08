import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvPageHeaderComponent } from './page-header.component';

/**
 * A title, an optional subtitle, and a slot for actions. The title is the
 * page's `<h1>`, which is the one thing here a screen-reader user navigates by.
 */

describe('SvPageHeaderComponent', () => {
  it('makes the title the page heading', async () => {
    TestBed.resetTestingModule();
    await render(SvPageHeaderComponent, { inputs: { title: 'Analytics' } });
    expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeTruthy();
  });

  it('shows a subtitle when there is one', async () => {
    TestBed.resetTestingModule();
    await render(SvPageHeaderComponent, {
      inputs: { title: 'Analytics', subtitle: 'Monitor your key metrics.' },
    });
    expect(screen.getByText('Monitor your key metrics.')).toBeTruthy();
  });

  it('renders no empty paragraph when there is not', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvPageHeaderComponent, { inputs: { title: 'Analytics' } });
    expect((fixture.nativeElement as HTMLElement).querySelector('p')).toBeNull();
  });

  it('projects the actions the host puts in it', async () => {
    TestBed.resetTestingModule();
    await render('<sv-page-header title="Analytics"><button type="button">Export</button></sv-page-header>', {
      imports: [SvPageHeaderComponent],
    });
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
  });
});
