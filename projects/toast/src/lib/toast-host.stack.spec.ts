import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvOverlayStackService, ToastService } from '@styloviz/core';
import { SvToastHostComponent } from './toast-host.component';

/**
 * `X-4` re-check (2026-09-29) — the toast region takes its z-index from the
 * overlay stack.
 *
 * ★★★ It was a hard-coded `z-50` while every interactive surface starts at
 *     1000, so a toast raised by a dialog's own save painted BEHIND that
 *     dialog. These render the real host and read the real style.
 */

async function setup() {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvToastHostComponent);
  const stack = TestBed.inject(SvOverlayStackService);
  const service = TestBed.inject(ToastService);
  service.dismissAll();
  fixture.detectChanges();
  const region = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[role="region"]')!;
  return { fixture, stack, service, region };
}

describe('X-4 — sv-toast-host is on the overlay stack', () => {
  it('★★★ paints above a modal opened AFTER it, and computes no z-index of its own', async () => {
    const { stack, region, fixture } = await setup();
    const modal = stack.push('modal', { blocking: false });

    const z = Number(region.style.zIndex);
    expect(z).toBeGreaterThan(modal.zIndex);
    expect(region.classList.contains('z-50')).toBe(false);

    modal.release();
    fixture.destroy();
  });

  it('★ does not take Escape from the dialog underneath', async () => {
    const { stack, fixture, service } = await setup();
    const dialog = stack.push('modal');
    service.info('Saved', { duration: 0 });
    fixture.detectChanges();

    expect(dialog.isTopmost()).toBe(true);
    dialog.release();
    fixture.destroy();
  });

  it('releases its registration when the host is destroyed', async () => {
    const { stack, fixture } = await setup();
    const before = stack.size;
    fixture.destroy();
    expect(stack.size).toBe(before - 1);
  });
});
