import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { ToastService, type ToastPosition } from '@styloviz/core/services';
import { resetSheetViewport, stubSheetViewport } from '@testing/sheet-viewport';
import { SvToastHostComponent } from './toast-host.component';

/**
 * FL-J3-OF-09 · OF-19-I9 / OF-19-M7 — the stack clears the safe area (notch,
 * corners, home indicator) and a bottom stack rides above the virtual keyboard.
 */
async function setup(position: ToastPosition) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvToastHostComponent, { inputs: { position } });
  TestBed.inject(ToastService).dismissAll();
  const region = (fixture.nativeElement as HTMLElement).querySelector('[role="region"]') as HTMLElement;
  return { fixture, host: fixture.componentInstance, region };
}

afterEach(() => resetSheetViewport());

describe('SvToastHostComponent — safe area and keyboard (FL-J3-OF-09)', () => {
  it.each([
    ['top-right', ['top-[max(1rem,env(safe-area-inset-top))]', 'right-[max(1rem,env(safe-area-inset-right))]']],
    ['top-left', ['top-[max(1rem,env(safe-area-inset-top))]', 'left-[max(1rem,env(safe-area-inset-left))]']],
    ['top-center', ['top-[max(1rem,env(safe-area-inset-top))]']],
    ['bottom-right', ['bottom-[max(1rem,env(safe-area-inset-bottom))]', 'right-[max(1rem,env(safe-area-inset-right))]']],
    ['bottom-left', ['bottom-[max(1rem,env(safe-area-inset-bottom))]', 'left-[max(1rem,env(safe-area-inset-left))]']],
    ['bottom-center', ['bottom-[max(1rem,env(safe-area-inset-bottom))]']],
  ] as const)('%s keeps a 1rem gap and clears the safe area', async (position, expected) => {
    stubSheetViewport(false);
    const { region } = await setup(position);
    for (const cls of expected) expect(region.className).toContain(cls);
    expect(region.className).not.toMatch(/\b(top|bottom|left|right)-4\b/);
  });

  it('★ lifts a bottom stack above the virtual keyboard', async () => {
    stubSheetViewport(true, 300);
    const { host } = await setup('bottom-center');
    expect(host.bottomOffset()).toBe('calc(max(1rem, env(safe-area-inset-bottom)) + 300px)');
  });

  it('leaves a top stack alone when the keyboard is up', async () => {
    stubSheetViewport(true, 300);
    const { host } = await setup('top-right');
    expect(host.bottomOffset()).toBeNull();
  });

  it('adds nothing while no keyboard is up', async () => {
    stubSheetViewport(false, 0);
    const { host, region } = await setup('bottom-right');
    expect(host.bottomOffset()).toBeNull();
    expect(region.style.bottom).toBe('');
  });
});
