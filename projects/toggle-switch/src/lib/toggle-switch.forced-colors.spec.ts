import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvToggleSwitchComponent } from './toggle-switch.component';

/**
 * `FL-J3-FI-02` / `FI-06-M3` — under forced colours the track and thumb were
 * both fills repainted as Canvas: the switch vanished. The class contract the
 * `forced-colors` media query hangs off, per state.
 */
describe('sv-toggle-switch — forced colours', () => {
  const setup = async (checked: boolean) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvToggleSwitchComponent, { inputs: { checked, label: 'Wi-Fi' } });
    const sw = fixture.nativeElement.querySelector('[role="switch"]') as HTMLElement;
    return { sw, thumb: sw.querySelector(':scope > span[aria-hidden="true"]:last-child') as HTMLElement };
  };

  it('edges the track and draws a ButtonText thumb when OFF', async () => {
    const { sw, thumb } = await setup(false);
    expect(sw.className).toContain('forced-colors:border-[ButtonText]');
    expect(sw.className).not.toContain('forced-colors:bg-[Highlight]');
    expect(thumb.className).toContain('forced-colors:bg-[ButtonText]');
  });

  it('fills the track with Highlight and draws a HighlightText thumb when ON', async () => {
    const { sw, thumb } = await setup(true);
    expect(sw.className).toContain('forced-colors:bg-[Highlight]');
    expect(thumb.className).toContain('forced-colors:bg-[HighlightText]');
  });

  it('turns the shadow focus ring into a real outline', async () => {
    const { sw } = await setup(false);
    expect(sw.className).toContain('forced-colors:focus-visible:outline-solid');
  });
});
