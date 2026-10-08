import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvModalComponent } from './modal.component';
import { svResetBodyScrollLock } from '@styloviz/core';

/**
 * Resizing and maximizing, through the component.
 *
 * The clamping arithmetic has its own spec in `modal-resize.spec.ts`. This file
 * covers what only the component can get wrong: which controls exist, what the
 * panel's inline style ends up as, and what survives a close.
 */

async function modal(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvModalComponent, {
    inputs: { isOpen: true, title: 'Report', ...inputs },
  });
  fixture.detectChanges();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
  return fixture;
}

afterEach(() => {
  svResetBodyScrollLock(document);
  document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
});

const panel = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-sv-modal-portal] [role="dialog"]');

const maximizeButton = (): HTMLButtonElement | null =>
  document.querySelector<HTMLButtonElement>('[data-sv-modal-portal] button[aria-pressed]');

const handle = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-sv-modal-resize]');

/** jsdom has no PointerEvent; synthesise one from MouseEvent. */
function pointer(type: string, clientX: number, clientY: number): Event {
  const event = new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'mouse' },
  });
  return event;
}

describe('SvModalComponent — the controls', () => {
  it('shows neither control by default', async () => {
    await modal();
    expect(maximizeButton()).toBeNull();
    expect(handle()).toBeNull();
  });

  it('shows the maximize button when asked', async () => {
    await modal({ maximizable: true });
    expect(maximizeButton()).toBeTruthy();
    expect(handle()).toBeNull();
  });

  /**
   * ★★★ A DRAG HANDLE ALONE WOULD BE A CAPABILITY KEYBOARD USERS DO NOT HAVE.
   *
   * The corner handle is pointer-only. Turning on `resizable` therefore also
   * offers the maximize button, which is the keyboard-reachable half of the
   * same capability — otherwise resizing is mouse-only and nothing says so.
   */
  it('offers the keyboard-reachable button whenever the drag handle exists', async () => {
    await modal({ resizable: true });
    expect(handle()).toBeTruthy();
    expect(maximizeButton()).toBeTruthy();
  });

  /**
   * ★★ AND THE HANDLE ITSELF IS HIDDEN FROM ASSISTIVE TECH.
   *
   * A focusable control that announces itself and then does nothing on every
   * key is worse than no control: it is a tab stop that lies. The handle is an
   * enhancement whose whole function is available from the button beside it.
   */
  it('keeps the drag handle out of the accessibility tree and the tab order', async () => {
    await modal({ resizable: true });
    const grip = handle()!;
    expect(grip.getAttribute('aria-hidden')).toBe('true');
    expect(grip.getAttribute('tabindex')).toBeNull();
  });

  it('hides the handle while the dialog is busy', async () => {
    await modal({ resizable: true, loading: true });
    expect(handle()).toBeNull();
  });
});

describe('SvModalComponent — maximize', () => {
  it('fills the viewport and says so', async () => {
    const f = await modal({ maximizable: true });

    maximizeButton()!.click();
    f.detectChanges();

    expect(f.componentInstance.isMaximized()).toBe(true);
    expect(maximizeButton()!.getAttribute('aria-pressed')).toBe('true');
    expect(maximizeButton()!.getAttribute('aria-label')).toBe('Restore dialog size');
    expect(panel()!.style.width).toBe(`${window.innerWidth - 32}px`);
  });

  /**
   * ★★ RESTORE GOES BACK TO THE CSS SIZE WHEN THE PANEL WAS NEVER DRAGGED.
   *
   * Guessing a pixel width for `size="md"` would hard-code a number the size
   * class owns, and the two would drift the first time the class changed. No
   * inline width means the class decides — which is what "restore" means here.
   */
  it('drops the inline size again on restore', async () => {
    const f = await modal({ maximizable: true });

    maximizeButton()!.click();
    f.detectChanges();
    expect(panel()!.style.width).not.toBe('');

    maximizeButton()!.click();
    f.detectChanges();

    expect(f.componentInstance.isMaximized()).toBe(false);
    expect(panel()!.style.width).toBe('');
  });

  /**
   * ★★★ RESTORE RETURNS TO THE SIZE THE USER DRAGGED TO.
   *
   * Drag the dialog to the shape you want, maximize to read something, restore
   * — and a restore that snapped back to the default has thrown away the
   * adjustment you just made, on a round trip nobody thinks of as destructive.
   */
  it('returns to a dragged size rather than the default', async () => {
    const f = await modal({ resizable: true });
    const grip = handle()!;

    grip.dispatchEvent(pointer('pointerdown', 100, 100));
    grip.dispatchEvent(pointer('pointermove', 200, 180));
    grip.dispatchEvent(pointer('pointerup', 200, 180));
    f.detectChanges();
    const dragged = panel()!.style.width;
    expect(dragged).not.toBe('');

    maximizeButton()!.click();
    f.detectChanges();
    maximizeButton()!.click();
    f.detectChanges();

    expect(panel()!.style.width).toBe(dragged);
  });

  it('emits the new size', async () => {
    const f = await modal({ maximizable: true });
    const seen: { width: number; height: number }[] = [];
    f.componentInstance.resized.subscribe((s) => seen.push(s));

    maximizeButton()!.click();

    expect(seen).toHaveLength(1);
    expect(seen[0].width).toBe(window.innerWidth - 32);
  });
});

describe('SvModalComponent — dragging', () => {
  it('grows the panel with the pointer', async () => {
    const f = await modal({ resizable: true, minWidth: 300, minHeight: 200 });
    const grip = handle()!;

    grip.dispatchEvent(pointer('pointerdown', 0, 0));
    grip.dispatchEvent(pointer('pointermove', 120, 90));
    f.detectChanges();

    const size = f.componentInstance.panelSize()!;
    expect(size.width).toBeGreaterThanOrEqual(300);
    expect(size.height).toBeGreaterThanOrEqual(200);
  });

  /**
   * ★★★ THE CLAMP IS WHAT STOPS THE DIALOG BECOMING UNREACHABLE.
   *
   * Drag it wider than the viewport and the header goes off screen — and with
   * it the ×, the footer buttons and the handle you would need to drag it back.
   */
  it('will not let a drag push the panel past the viewport', async () => {
    const f = await modal({ resizable: true });
    const grip = handle()!;

    grip.dispatchEvent(pointer('pointerdown', 0, 0));
    grip.dispatchEvent(pointer('pointermove', 99999, 99999));
    f.detectChanges();

    const size = f.componentInstance.panelSize()!;
    expect(size.width).toBeLessThanOrEqual(window.innerWidth);
    expect(size.height).toBeLessThanOrEqual(window.innerHeight);
  });

  it('ignores pointer movement that never started with a press', async () => {
    const f = await modal({ resizable: true });
    handle()!.dispatchEvent(pointer('pointermove', 400, 400));
    f.detectChanges();
    expect(f.componentInstance.panelSize()).toBeNull();
  });

  /**
   * ★★ A DRAG IS A DELIBERATE SIZE, SO IT LEAVES MAXIMIZED.
   *
   * Otherwise the restore button would put back a size the user has since
   * replaced by hand.
   */
  it('comes out of maximized when the user drags', async () => {
    const f = await modal({ resizable: true });
    maximizeButton()!.click();
    f.detectChanges();
    expect(f.componentInstance.isMaximized()).toBe(true);

    const grip = handle()!;
    grip.dispatchEvent(pointer('pointerdown', 0, 0));
    grip.dispatchEvent(pointer('pointermove', -200, -200));
    f.detectChanges();

    expect(f.componentInstance.isMaximized()).toBe(false);
  });

  /**
   * ★★ A WINDOW NARROWED AFTER THE FACT IS THE SAME TRAP, ARRIVED AT WITHOUT
   * ANYBODY DRAGGING ANYTHING. A panel sized on a wide monitor keeps its width
   * when the window shrinks, and the × goes off the right edge.
   */
  it('re-clamps when the window is resized', async () => {
    const f = await modal({ resizable: true });
    f.componentInstance.panelSize.set({ width: 99999, height: 99999 });

    window.dispatchEvent(new Event('resize'));
    f.detectChanges();

    const size = f.componentInstance.panelSize()!;
    expect(size.width).toBeLessThanOrEqual(window.innerWidth);
  });

  /** A dialog reopened later starts from its declared size, not the last drag. */
  it('forgets the dragged size when the dialog closes', async () => {
    const f = await modal({ resizable: true });
    const grip = handle()!;
    grip.dispatchEvent(pointer('pointerdown', 0, 0));
    grip.dispatchEvent(pointer('pointermove', 150, 150));
    f.detectChanges();
    expect(f.componentInstance.panelSize()).not.toBeNull();

    f.componentInstance.close();
    f.detectChanges();

    expect(f.componentInstance.panelSize()).toBeNull();
    expect(f.componentInstance.isMaximized()).toBe(false);
  });
});
