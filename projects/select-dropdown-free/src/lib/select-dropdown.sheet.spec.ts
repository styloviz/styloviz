import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { resetSheetViewport, stubSheetViewport } from '@testing/sheet-viewport';
import { SvSelectDropdownComponent } from './select-dropdown.component';

/**
 * `FL-J3-FI-05` / `FI-23-M4` — `sheetOnNarrow`: below 640px the panel is a
 * bottom sheet (the kit's `createSheetMode` contract), off by default.
 */
const OPTIONS = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }];
const panel = () => document.querySelector<HTMLElement>('.sv-sd-portal > div');

afterEach(() => {
  resetSheetViewport();
  TestBed.resetTestingModule();
  document.querySelectorAll('.sv-sd-portal').forEach((n) => n.remove());
});

async function setup(sheetOnNarrow: boolean) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSelectDropdownComponent, { inputs: { options: OPTIONS, sheetOnNarrow, label: 'Letter' } });
  const c = fixture.componentInstance;
  c.openDropdown();
  fixture.detectChanges();
  return { fixture, c };
}

describe('sv-select-dropdown — sheetOnNarrow', () => {
  it('renders a bottom sheet on a narrow viewport: full width, top and left dropped, safe-area padded', async () => {
    stubSheetViewport(true);
    const { c } = await setup(true);
    expect(c.asSheet()).toBe(true);
    const p = panel()!;
    expect(p.hasAttribute('data-sv-sheet')).toBe(true);
    expect(p.style.top).toBe('');
    expect(p.style.left).toBe('0px');
    expect(p.style.right).toBe('0px');
    expect(p.style.bottom).toBe('0px');
    expect(p.style.maxHeight).toBe('70vh');
    // jsdom cannot parse `env()`, so the DOM cannot show the padding — the
    // bound value is asserted instead (as dropdown-menu.sheet.spec.ts does).
    expect(c.panelStyle()['paddingBottom']).toContain('safe-area-inset-bottom');
    expect(p.classList.contains('rounded-t-2xl')).toBe(true);
    expect(p.classList.contains('rounded-xl')).toBe(false);
  });

  it('rides up with the virtual keyboard', async () => {
    stubSheetViewport(true, 300);
    await setup(true);
    expect(panel()!.style.bottom).toBe('300px');
  });

  it('re-anchors instead of closing on a resize (the keyboard opening is one)', async () => {
    stubSheetViewport(true);
    const { c } = await setup(true);
    window.dispatchEvent(new Event('resize'));
    expect(c.isOpen()).toBe(true);
  });

  it('stays anchored when off — the default — even on a narrow viewport', async () => {
    stubSheetViewport(true);
    const { c } = await setup(false);
    expect(c.asSheet()).toBe(false);
    expect(panel()!.hasAttribute('data-sv-sheet')).toBe(false);
    expect(panel()!.classList.contains('rounded-xl')).toBe(true);
  });

  it('stays anchored on a wide viewport even when on', async () => {
    stubSheetViewport(false);
    const { c } = await setup(true);
    expect(c.asSheet()).toBe(false);
    window.dispatchEvent(new Event('resize'));
    expect(c.isOpen()).toBe(false);
  });
});
