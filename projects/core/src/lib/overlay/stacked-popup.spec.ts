import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvOverlayStackService, SV_OVERLAY_Z_FLOOR } from './overlay-stack';
import { svStackedPopup } from './stacked-popup';

/**
 * `svStackedPopup` — a popup is on the overlay stack for exactly as long as it
 * is open (`X-4`, `OF-09-I1`), including when it is destroyed while open.
 */

@Component({ standalone: true, template: '' })
class PopupHost {
  readonly open = signal(false);
  readonly panel = document.createElement('div');
  readonly popup = svStackedPopup({ open: () => this.open(), element: () => this.panel });
}

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(PopupHost);
  return { fixture, host: fixture.componentInstance, stack: TestBed.inject(SvOverlayStackService) };
}

describe('svStackedPopup', () => {
  it('registers on open and releases on close', async () => {
    const { fixture, host, stack } = await setup();
    const base = stack.size;
    expect(host.popup.zIndex()).toBeNull();

    host.open.set(true);
    fixture.detectChanges();
    expect(stack.size).toBe(base + 1);
    expect(host.popup.zIndex()).toBeGreaterThanOrEqual(SV_OVERLAY_Z_FLOOR);

    host.open.set(false);
    fixture.detectChanges();
    expect(stack.size).toBe(base);
    expect(host.popup.zIndex()).toBeNull();
  });

  it('★★ owns Escape only while topmost — and a closed popup never blocks its own handler', async () => {
    const { fixture, host, stack } = await setup();
    expect(host.popup.ownsEscape()).toBe(true);    // not registered: nothing to defer to

    const modal = stack.push('modal');
    host.open.set(true);
    fixture.detectChanges();
    expect(host.popup.ownsEscape()).toBe(true);    // opened inside the modal: it is on top
    expect(modal.isTopmost()).toBe(false);         // so the modal must not take Escape

    const confirm = stack.push('modal');
    expect(host.popup.ownsEscape()).toBe(false);   // a dialog opened from the popup outranks it

    confirm.release();
    modal.release();
    host.open.set(false);
    fixture.detectChanges();
  });

  it('routes a click inside a higher surface', async () => {
    const { fixture, host, stack } = await setup();
    host.open.set(true);
    fixture.detectChanges();
    const child = document.createElement('div');
    document.body.appendChild(child);
    const nested = stack.push('anchored', { element: () => child });

    expect(host.popup.isInsideHigherSurface(child)).toBe(true);
    expect(host.popup.isInsideHigherSurface(document.body)).toBe(false);
    expect(host.popup.isInsideHigherSurface(null)).toBe(false);

    nested.release();
    child.remove();
  });

  it('★ releases when destroyed while open', async () => {
    const { fixture, host, stack } = await setup();
    const base = stack.size;
    host.open.set(true);
    fixture.detectChanges();
    expect(stack.size).toBe(base + 1);

    fixture.destroy();
    expect(stack.size).toBe(base);
  });
});
