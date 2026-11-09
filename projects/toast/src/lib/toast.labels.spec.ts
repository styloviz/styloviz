import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { type Toast } from '@styloviz/core/services';
import { SvToastHostComponent } from './toast-host.component';
import { SV_TOAST_LABELS } from './toast.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const view = await render(SvToastHostComponent, {
    inputs: {},
    providers: providers as never[],
  });
  return view;
}

describe('SvToastHostComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('region', { name: SV_TOAST_LABELS.notifications }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ toast: { notifications: 'Benachrichtigungen' } })]);
    expect(screen.getAllByRole('region', { name: 'Benachrichtigungen' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: 'Notifications' })).toBeNull();
  });
});

describe('SvToastHostComponent — a sentence glued around data (FL-B1e)', () => {
  it('names the repeat badge from a translated plural template', async () => {
    const { fixture } = await setup([
      provideSvLabels({ toast: { repeated: '{count, plural, one {{n}-mal wiederholt} other {{n}-mal wiederholt}}' } }),
    ]);
    expect(fixture.componentInstance.repeatLabel({ count: 3 } as Toast)).toBe('3-mal wiederholt');
  });
});
