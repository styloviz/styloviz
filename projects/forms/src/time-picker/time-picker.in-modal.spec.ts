import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { until } from '@testing/async';
import { SvOverlayStackService, svResetBodyScrollLock, SV_OVERLAY_Z_FLOOR } from '@styloviz/core';
import { SvModalComponent } from '@styloviz/modal';
import { SvTimePickerComponent } from './time-picker.component';

/**
 * `X-4` / `OF-09-I1` re-check (2026-09-29) — a REAL time picker inside a REAL
 * `sv-modal`.
 *
 * ★★★ The picker closed on its own `document:keydown.escape` and was not on
 *     the overlay stack, so the modal stayed "topmost". The modal's own
 *     keydown (on its backdrop, which the keystroke bubbles through BEFORE it
 *     reaches `document`) therefore closed the modal too: one Escape took the
 *     picker AND the half-filled dialog.
 */

@Component({
  standalone: true,
  imports: [SvModalComponent, SvTimePickerComponent],
  template: `
    <sv-modal [(isOpen)]="open" title="Book a slot">
      <ng-container slot="body"><sv-time-picker /></ng-container>
    </sv-modal>
  `,
})
class ModalWithPickerHost {
  readonly open = signal(false);
}

const modalPortal = () => document.querySelector<HTMLElement>('[data-sv-modal-portal]');
const trigger = () => modalPortal()?.querySelector<HTMLButtonElement>('sv-time-picker button[data-trigger]') ?? null;
const pickerPanel = () => document.querySelector('.sv-tp-portal');
const escapeOn = (el: Element) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

afterEach(() => {
  document.querySelectorAll('[data-sv-modal-portal], .sv-tp-portal').forEach((n) => n.remove());
  document.querySelectorAll('[inert]').forEach((n) => n.removeAttribute('inert'));
  svResetBodyScrollLock(document);
});

describe('X-4 — sv-time-picker inside sv-modal', () => {
  it('★★★ Escape closes only the picker; a second Escape closes the modal', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ModalWithPickerHost);
    const host = fixture.componentInstance;
    host.open.set(true);
    fixture.detectChanges();
    await until(() => !!trigger(), { label: 'the modal mounted its portal' });
    fixture.detectChanges();

    const stack = TestBed.inject(SvOverlayStackService);
    const before = stack.size;

    trigger()!.click();
    fixture.detectChanges();
    expect(pickerPanel()).not.toBeNull();
    expect(stack.size).toBe(before + 1);      // the picker is on the stack now

    // ★ `X-4`: and it paints ABOVE the modal, by the stack's numbers — not by
    //   the hard-coded fallback that merely happens to be large.
    const modalZ = Number(modalPortal()!.querySelector<HTMLElement>('.modal-backdrop')!.style.zIndex);
    const pickerZ = Number(pickerPanel()!.querySelector<HTMLElement>('[style*="z-index"]')!.style.zIndex);
    expect(pickerZ).toBeGreaterThan(modalZ);
    // Above the modal, which itself sits at or above the stack's floor — so this
    // number is the stack's, not the `?? 9999` fallback (which IS the floor).
    expect(modalZ).toBeGreaterThanOrEqual(SV_OVERLAY_Z_FLOOR);
    expect(pickerZ).toBeGreaterThan(SV_OVERLAY_Z_FLOOR);

    // Focus is on the trigger inside the modal: the keystroke passes through
    // the modal's backdrop keydown on its way to `document`.
    escapeOn(trigger()!);
    fixture.detectChanges();
    expect(pickerPanel()).toBeNull();          // the picker closed…
    expect(host.open()).toBe(true);            // …and the modal did NOT
    expect(stack.size).toBe(before);

    escapeOn(trigger()!);
    fixture.detectChanges();
    expect(host.open()).toBe(false);           // the second Escape is the modal's
  });

  it('★ a click inside a surface opened FROM the picker does not close it', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(ModalWithPickerHost);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await until(() => !!trigger(), { label: 'the modal mounted its portal' });
    fixture.detectChanges();
    trigger()!.click();
    fixture.detectChanges();

    const stack = TestBed.inject(SvOverlayStackService);
    const child = document.createElement('div');
    child.innerHTML = '<button>nested</button>';
    document.body.appendChild(child);
    const nested = stack.push('anchored', { element: () => child });

    child.querySelector('button')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(pickerPanel()).not.toBeNull();

    nested.release();
    child.remove();
  });
});
