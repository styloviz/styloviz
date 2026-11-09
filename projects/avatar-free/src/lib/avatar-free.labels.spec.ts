import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvAvatarComponent } from './avatar.component';
import { SV_AVATAR_LABELS } from './avatar-free.labels';

/** FL-B1b: the accessible names are the package's English defaults until an app says otherwise. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  const view = await render(SvAvatarComponent, {
    inputs: { name: 'Ada Lovelace', verified: true },
    providers: providers as never[],
  });
  return view;
}

describe('SvAvatarComponent — accessible names', () => {
  it('names the controls in English by default', async () => {
    await setup();
    expect(screen.getAllByRole('img', { name: SV_AVATAR_LABELS.verified }).length).toBeGreaterThan(0);
  });

  it('renders the names an app provides', async () => {
    await setup([provideSvLabels({ avatar: { verified: 'Verifiziert' } })]);
    expect(screen.getAllByRole('img', { name: 'Verifiziert' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('img', { name: 'Verified' })).toBeNull();
  });
});

describe('SvAvatarComponent — composed accessible names (FL-B1c)', () => {
  it('fills a translated template whose slot sits in a different position', async () => {
    TestBed.resetTestingModule();
    await render(SvAvatarComponent, {
      inputs: { name: 'Ada Lovelace', status: 'online' },
      providers: [provideSvLabels({ avatar: { statusOf: '{status} (Status)' } })] as never[],
    });
    expect(screen.getByRole('img', { name: 'Online (Status)' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Status: Online' })).toBeNull();
  });
});
