import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { resetSheetViewport, stubSheetViewport } from '@testing/sheet-viewport';
import { SvModalComponent } from './modal.component';
import { until } from '../../../../src/testing/async';

/**
 * FL-J3-OF-02 · OF-09-I6 / OF-09-M4 — Modal adopts the `X-16` sheet contract.
 * The contract itself (breakpoint, keyboard inset, safe area, listener
 * cleanup) is tested in `core/overlay/sheet-mode.spec.ts`; what is here is the
 * modal's side, and that none of it happens unless asked for.
 */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvModalComponent, { inputs: { isOpen: true, title: 'Edit', ...inputs } });
  fixture.detectChanges();
  // The portal is mounted on a deferred tick.
  await until(() => document.querySelector('[data-sv-modal-portal]') !== null, { label: 'the portal to be mounted' });
  fixture.detectChanges();
  const panel = document.body.querySelector('[role="dialog"]') as HTMLElement;
  const backdrop = panel.parentElement as HTMLElement;
  return { c: fixture.componentInstance, fixture, panel, backdrop };
}

afterEach(() => {
  resetSheetViewport();
  document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
  document.body.style.overflow = '';
  document.body.style.paddingInlineEnd = '';
});

describe('SvModalComponent — sheet mode (FL-J3-OF-02)', () => {
  it('★ stays a centred dialog by default, however narrow the viewport', async () => {
    stubSheetViewport(true);
    const { c, panel } = await setup();
    expect(c.asSheet()).toBe(false);
    expect(panel.hasAttribute('data-sv-sheet')).toBe(false);
  });

  it('stays centred on a wide viewport with the opt-in on', async () => {
    stubSheetViewport(false);
    const { c } = await setup({ sheetOnNarrow: true });
    expect(c.asSheet()).toBe(false);
  });

  it('becomes a full-width bottom sheet on a narrow viewport', async () => {
    stubSheetViewport(true);
    const { c, panel, backdrop } = await setup({ sheetOnNarrow: true, size: 'sm' });
    expect(c.asSheet()).toBe(true);
    expect(panel.hasAttribute('data-sv-sheet')).toBe(true);
    // Full-width whatever `size` says, rounded only at the top.
    expect(panel.className).toContain('max-w-none');
    expect(panel.className).not.toContain('max-w-sm');
    expect(panel.className).toContain('rounded-b-none');
    // Attached to the bottom edge, with no side padding on the backdrop.
    expect(backdrop.className).toContain('items-end');
    expect(backdrop.className).not.toContain('px-4');
    // Slides up from the edge it is attached to.
    expect(c.animationClass()).toContain('modal-panel--up');
  });

  it('★ rides above the virtual keyboard', async () => {
    stubSheetViewport(true, 300);
    const { c, backdrop } = await setup({ sheetOnNarrow: true });
    expect(c.sheetBottomPx()).toBe(300);
    expect(backdrop.style.paddingBottom).toBe('300px');
  });

  it('pads its last row clear of the home indicator', async () => {
    stubSheetViewport(true);
    const { c } = await setup({ sheetOnNarrow: true });
    // jsdom's CSSOM does not parse `env()`, so the bound value is asserted.
    expect(c.sheetSafeArea).toBe('env(safe-area-inset-bottom, 0px)');
  });

  it('ignores a dragged size while it is a sheet', async () => {
    stubSheetViewport(true);
    const { c } = await setup({ sheetOnNarrow: true, resizable: true });
    expect(c.panelSizeStyle()).toBeNull();
  });

  it('follows the viewport changing under it', async () => {
    const { width } = stubSheetViewport(false);
    const { c, fixture } = await setup({ sheetOnNarrow: true });
    expect(c.asSheet()).toBe(false);
    width.matches = true;
    width.listeners.forEach((cb) => cb({ matches: true } as MediaQueryListEvent));
    expect(c.asSheet()).toBe(true);
    fixture.detectChanges();
    expect(document.body.querySelector('[role="dialog"]')?.hasAttribute('data-sv-sheet')).toBe(true);
  });
});
