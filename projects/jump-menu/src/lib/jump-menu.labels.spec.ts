import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideSvLabels } from '@styloviz/core/i18n';
import { SvJumpMenuComponent, type JumpMenuItem } from './jump-menu.component';
import { SV_JUMP_MENU_LABELS } from './jump-menu.labels';

/** FL-B1d: the visible text is the package's English default until an app says otherwise. */
const ITEMS: JumpMenuItem[] = [
  { id: 'intro', label: 'Introduction' },
  { id: 'usage', label: 'Usage' },
];

async function setup(providers: unknown[] = []) {
  TestBed.resetTestingModule();
  return render(SvJumpMenuComponent, {
    inputs: { items: ITEMS },
    providers: providers as never[],
  });
}

describe('SvJumpMenuComponent — labels', () => {
  it('labels the control in English by default', async () => {
    await setup();
    expect(screen.getByText(SV_JUMP_MENU_LABELS.label)).toBeTruthy();
  });

  it('renders the visible text an app provides', async () => {
    await setup([provideSvLabels({ jumpMenu: { label: 'Springe zu' } })]);
    expect(screen.getByText('Springe zu')).toBeTruthy();
    expect(screen.queryByText('Jump to')).toBeNull();
  });
});
