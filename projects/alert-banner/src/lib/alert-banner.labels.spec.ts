import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvAlertBannerComponent } from './alert-banner.component';
import { SV_ALERT_BANNER_LABELS } from './alert-banner.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const view = await render(SvAlertBannerComponent, {
    inputs: { message: 'Heads up' },
    providers: providers as never[],
  });
  return view;
}

describe('SvAlertBannerComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('button', { name: SV_ALERT_BANNER_LABELS.dismissAlert }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ alertBanner: { dismissAlert: 'Hinweis schließen' } })]);
    expect(screen.getAllByRole('button', { name: 'Hinweis schließen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Dismiss alert' })).toBeNull();
  });
});
