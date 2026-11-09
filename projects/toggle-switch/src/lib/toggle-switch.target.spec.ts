import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvToggleSwitchComponent } from './toggle-switch.component';

/**
 * `FL-J3-FI-20` — the xs and sm tracks are 16 and 20 px tall, under 2.5.8's 24;
 * `check:ui`'s `target-size-minimum`, taught to read a computed class map,
 * found them. The switch carries `sv-target` at every size.
 */
describe('sv-toggle-switch — 24 px target', () => {
  for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
    it(`${size}: the switch carries sv-target`, async () => {
      TestBed.resetTestingModule();
      const { fixture } = await render(SvToggleSwitchComponent, { inputs: { label: 'Wi-Fi', size } });
      const sw = (fixture.nativeElement as HTMLElement).querySelector('[role="switch"]')!;
      expect(sw.classList.contains('sv-target')).toBe(true);
      expect(sw.className).not.toMatch(/overflow-hidden|after:/);
    });
  }
});
