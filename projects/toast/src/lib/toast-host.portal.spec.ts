import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvOverlayStackService, ToastService } from '@styloviz/core';
import { SvToastHostComponent } from './toast-host.component';

/**
 * `[portal]` keeps the toast region usable above a modal (`X-4`).
 *
 * ★★ `inert` is inherited, so a host rendered inside the page goes inert with
 *    it whenever a blocking surface opens. Portalled, the region is a `<body>`
 *    child the stack keeps live, and an action on a toast can still be pressed.
 */

async function setup(portal: boolean) {
  TestBed.resetTestingModule();
  const page = document.createElement('main');
  document.body.appendChild(page);
  const view = await render(SvToastHostComponent, { inputs: { portal } });
  // Render the host INSIDE the page, like an app shell would.
  page.appendChild(view.fixture.nativeElement as HTMLElement);
  view.fixture.detectChanges();
  const service = TestBed.inject(ToastService);
  service.dismissAll();
  return { ...view, page, service, stack: TestBed.inject(SvOverlayStackService) };
}

const regionEl = () => document.querySelector<HTMLElement>('[role="region"][aria-label="Notifications"]');

afterEach(() => {
  document.querySelectorAll('main, [data-test-modal]').forEach((n) => n.remove());
});

describe('sv-toast-host [portal]', () => {
  it('default: the region stays inside the host', async () => {
    const { fixture } = await setup(false);
    expect((fixture.nativeElement as HTMLElement).contains(regionEl())).toBe(true);
    expect(document.querySelector('[data-sv-portal="toast"]')).toBeNull();
  });

  it('★★ portalled: the region stays live and clickable while a modal makes the page inert', async () => {
    const { fixture, page, service, stack } = await setup(true);
    const region = regionEl()!;
    expect(region.closest('[data-sv-portal="toast"]')?.parentElement).toBe(document.body);

    const onUndo = vi.fn();
    service.info('Row deleted', { duration: 0, action: { label: 'Undo', callback: onUndo } });
    fixture.detectChanges();

    const modalEl = document.createElement('div');
    modalEl.setAttribute('data-test-modal', '');
    document.body.appendChild(modalEl);
    const modal = stack.push('modal', { blocking: true, element: () => modalEl });

    expect(page.hasAttribute('inert')).toBe(true);
    expect(region.closest('[inert]')).toBeNull();
    const undo = Array.from(region.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Undo'),
    );
    expect(undo).toBeDefined();
    undo!.click();
    expect(onUndo).toHaveBeenCalledTimes(1);

    modal.release();
    expect(page.hasAttribute('inert')).toBe(false);
  });

  it('★ focus inside a portalled toast keeps the stack paused when another toast arrives', async () => {
    const { fixture, service } = await setup(true);
    const pause = vi.spyOn(service, 'pause');
    const resume = vi.spyOn(service, 'resume');
    service.info('Row deleted', { duration: 5000, action: { label: 'Undo', callback: () => undefined } });
    fixture.detectChanges();
    const undo = Array.from(regionEl()!.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Undo'),
    )!;
    undo.focus();
    undo.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
    expect(pause).toHaveBeenCalled();
    resume.mockClear();

    service.info('Another thing happened', { duration: 5000 });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(undo);
    expect(resume).not.toHaveBeenCalled();
  });

  it('turning the portal off, or destroying the host, removes the portal', async () => {
    const { fixture } = await setup(true);
    expect(document.querySelector('[data-sv-portal="toast"]')).not.toBeNull();
    fixture.componentRef.setInput('portal', false);
    fixture.detectChanges();
    expect(document.querySelector('[data-sv-portal="toast"]')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).contains(regionEl())).toBe(true);

    fixture.componentRef.setInput('portal', true);
    fixture.detectChanges();
    expect(document.querySelector('[data-sv-portal="toast"]')).not.toBeNull();
    fixture.destroy();
    expect(document.querySelector('[data-sv-portal="toast"]')).toBeNull();
  });
});
