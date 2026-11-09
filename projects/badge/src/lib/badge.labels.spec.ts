import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvBadgeComponent } from './badge.component';
import { SV_BADGE_LABELS } from './badge.labels';

/** FL-B1c: a composed name is one template, so a translation can move the slot. */
async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvBadgeComponent, {
    inputs: { label: 'Ada', dismissible: true },
    providers: providers as never[],
  });
}

describe('SvBadgeComponent — accessible names', () => {
  it('names the dismiss button in English by default', async () => {
    await setup();
    expect(SV_BADGE_LABELS.removeBadge).toBe('Remove {name}');
    expect(screen.getByRole('button', { name: 'Remove Ada' })).toBeTruthy();
  });

  it('fills a translated template whose slot sits in a different position', async () => {
    await setup([provideSvLabels({ badge: { removeBadge: '{name} entfernen' } })]);
    expect(screen.getByRole('button', { name: 'Ada entfernen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove Ada' })).toBeNull();
  });
});
