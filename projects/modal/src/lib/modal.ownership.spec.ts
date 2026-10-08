import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvOverlayRouteService, SvOverlayStackService, svResetBodyScrollLock } from '@styloviz/core';
import { SvModalComponent, type ModalCloseReason } from './modal.component';
import { SvModalRef, SvModalService } from './modal.service';
import { until } from '../../../../src/testing/async';

/**
 * ============================================================================
 *  `sv-modal` — ownership re-check (`OF-09-I1`, `OF-09-I5`, `OF-09-I7`,
 *  `OF-09-I8`, `OF-09-I10`, `OF-09-M1`, `OF-09-M2`, `OF-09-M3`)
 * ============================================================================
 *
 * Each block pins a gap the earlier "done" pass left behind:
 *  • a backdrop click closed the dialog AND a child popover opened from it;
 *  • `pendingDismissal="abort"` still disabled the × (and the loading overlay
 *    covered it), so the only pointer exit was the backdrop;
 *  • a navigation while `loading` was silently refused;
 *  • a refused Back press left the dialog open with nothing claiming Back;
 *  • `SvModalService` dialogs had no way to say they were dirty.
 */

async function open(inputs: Partial<ComponentInput<SvModalComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvModalComponent, {
    inputs: { title: 'Edit profile', isOpen: true, ...inputs } as ComponentInput<SvModalComponent>,
  });
  await until(() => document.querySelector('[role="dialog"]') !== null, {
    label: 'the dialog to mount',
  });
  fixture.detectChanges();
  return {
    c: fixture.componentInstance,
    fixture,
    routes: TestBed.inject(SvOverlayRouteService),
    stack: TestBed.inject(SvOverlayStackService),
  };
}

const panel = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const backdrop = () => panel().parentElement!;
const closeBtn = () => panel().querySelector<HTMLButtonElement>('[aria-label="Close dialog"]')!;
const marker = () => (history.state as Record<string, unknown> | null)?.['__svOverlay'];

const press = (el: HTMLElement) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
const click = (el: HTMLElement) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const back = async () => {
  const delivered = new Promise<void>((resolve) => {
    const onPop = () => { clearTimeout(grace); resolve(); };
    window.addEventListener('popstate', onPop, { once: true });
    const grace = setTimeout(() => {
      window.removeEventListener('popstate', onPop);
      resolve();
    }, 250);
  });
  history.back();
  await delivered;
  await new Promise((resolve) => setTimeout(resolve, 0));
};

afterEach(() => {
  document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
  document.querySelectorAll('[data-sv-modal-service]').forEach((n) => n.remove());
  svResetBodyScrollLock(document);
  history.replaceState(null, '', '/');
});

describe('sv-modal — outside-click ownership (OF-09-I1, OF-09-M1)', () => {
  it('★ a backdrop click while a child surface is open is the child\'s, not the dialog\'s', async () => {
    const h = await open();
    const child = h.stack.push('anchored');

    press(backdrop());
    click(backdrop());
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(true);

    child.release();
    press(backdrop());
    click(backdrop());
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(false);
  });

  it('★ decides at PRESS time, so a child that closes on mousedown does not take the dialog with it', async () => {
    const h = await open();
    const child = h.stack.push('anchored');

    press(backdrop());
    child.release();          // the child dismissed itself on mousedown
    click(backdrop());
    h.fixture.detectChanges();

    expect(h.c.isOpen()).toBe(true);
  });

  it('a press that began inside the panel is not a backdrop click', async () => {
    const h = await open();
    press(panel());
    click(backdrop());
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(true);
  });

  it('a plain backdrop click still closes, with the reason "backdrop"', async () => {
    const h = await open();
    const reasons: ModalCloseReason[] = [];
    h.c.dismissed.subscribe((r) => reasons.push(r));
    press(backdrop());
    click(backdrop());
    h.fixture.detectChanges();
    expect(reasons).toEqual(['backdrop']);
  });
});

describe('sv-modal — the × is a way out under pendingDismissal="abort" (OF-09-I10)', () => {
  it("stays disabled under the default 'block'", async () => {
    await open({ loading: true });
    expect(closeBtn().disabled).toBe(true);
  });

  it("★ is enabled, raised above the loading overlay, and closes with loadingCancelled first", async () => {
    const h = await open({ loading: true, pendingDismissal: 'abort' });
    const events: string[] = [];
    h.c.loadingCancelled.subscribe(() => events.push('cancelled'));
    h.c.dismissed.subscribe((r) => events.push(`dismissed:${r}`));

    const btn = closeBtn();
    expect(btn.disabled).toBe(false);
    // The overlay is `absolute inset-0 z-10` over the whole panel — the ×
    // has to sit above it to be reachable by pointer at all.
    expect(btn.classList.contains('relative')).toBe(true);
    expect(btn.classList.contains('z-30')).toBe(true);

    btn.click();
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(false);
    expect(events).toEqual(['cancelled', 'dismissed:close-button']);
  });
});

describe('sv-modal — a navigation is not refused by the busy state (OF-09-I7)', () => {
  it('★ closes on navigation while loading, telling the host first', async () => {
    const h = await open({ loading: true });
    const events: string[] = [];
    h.c.loadingCancelled.subscribe(() => events.push('cancelled'));
    h.c.dismissedBy.subscribe((r) => events.push(`dismissed:${r}`));

    h.routes.navigated();
    h.fixture.detectChanges();

    expect(h.c.isOpen()).toBe(false);
    expect(events).toEqual(['cancelled', 'dismissed:route']);
  });

  it('still asks first when the busy dialog is also dirty', async () => {
    const h = await open({ loading: true, dirty: true });
    h.routes.navigated();
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(true);
    expect(h.c.promptedReason()).toBe('route');
  });
});

describe('sv-modal — a refused Back press keeps Back claimed (OF-09-I8, OF-09-M2)', () => {
  it('★ Keep editing after Back re-arms the entry, so the next Back asks again', async () => {
    const h = await open({ backCloses: true, dirty: true });
    expect(marker()).toBeDefined();

    await back();
    h.fixture.detectChanges();
    expect(h.c.promptedReason()).toBe('history');
    expect(marker()).toBeDefined();      // re-armed while the prompt is up

    h.c.keepEditing();
    h.fixture.detectChanges();
    expect(h.routes.openCount).toBe(1);

    await back();
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(true);
    expect(h.c.promptedReason()).toBe('history');
  });

  it('Discard after Back closes and pops the re-armed entry', async () => {
    const h = await open({ backCloses: true, dirty: true });
    await back();
    h.fixture.detectChanges();

    const spy = vi.spyOn(history, 'back');
    h.c.discardChanges();
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('a busy dialog refusing Back still owns the next one', async () => {
    const h = await open({ backCloses: true, loading: true });
    await back();
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(true);
    expect(marker()).toBeDefined();
  });
});

@Component({
  selector: 'sv-test-dirty-form',
  standalone: true,
  template: `<input aria-label="Name" />`,
})
class DirtyFormComponent {
  readonly ref = inject(SvModalRef);
}

describe('SvModalService — the close policy reaches service dialogs (OF-09-I5, OF-09-M3)', () => {
  it('★ setDirty makes a backdrop click ask instead of discarding', async () => {
    TestBed.resetTestingModule();
    const service = TestBed.inject(SvModalService);
    const ref = service.open(DirtyFormComponent, { title: 'Edit' });
    await until(() => document.querySelector('[role="dialog"]') !== null, { label: 'mount' });

    ref.setDirty(true);
    press(backdrop());
    click(backdrop());
    TestBed.tick();

    expect(ref.closed()).toBe(false);
    await until(() => document.querySelector('[data-sv-state="unsaved-prompt"]') !== null, {
      label: 'the prompt',
    });

    ref.setDirty(false);
    ref.dismiss();
    expect(ref.closed()).toBe(true);
  });

  it('forwards canClose, backCloses and pendingDismissal from the config', async () => {
    TestBed.resetTestingModule();
    const service = TestBed.inject(SvModalService);
    const seen: ModalCloseReason[] = [];
    const ref = service.open(DirtyFormComponent, {
      title: 'Edit',
      backCloses: true,
      canClose: (reason) => { seen.push(reason); return false; },
    });
    await until(() => document.querySelector('[role="dialog"]') !== null, { label: 'mount' });

    expect(marker()).toBeDefined();
    press(backdrop());
    click(backdrop());
    TestBed.tick();
    expect(seen).toEqual(['backdrop']);
    expect(ref.closed()).toBe(false);
    ref.dismiss();
  });
});

describe('sv-modal — Discard on a busy dialog tells the host (X-10, OF-09-I10)', () => {
  const keepBtn = () => document.querySelector<HTMLButtonElement>('[data-sv-keep-editing]')!;
  const discardBtn = () => document.querySelector<HTMLButtonElement>('[data-sv-discard]')!;

  async function busyDirty(inputs: Partial<ComponentInput<SvModalComponent>> = {}) {
    const h = await open({ loading: true, dirty: true, ...inputs });
    const events: string[] = [];
    h.c.loadingCancelled.subscribe(() => events.push('cancelled'));
    h.c.discarded.subscribe((r) => events.push(`discarded:${r}`));
    h.c.dismissedBy.subscribe((r) => events.push(`dismissed:${r}`));
    return { ...h, events };
  }

  it('★ route path: Keep editing says nothing; Discard emits loadingCancelled once, before the close', async () => {
    const h = await busyDirty();

    h.routes.navigated();
    h.fixture.detectChanges();
    expect(h.c.promptedReason()).toBe('route');
    keepBtn().click();
    h.fixture.detectChanges();
    expect(h.events).toEqual([]);
    expect(h.c.isOpen()).toBe(true);

    h.routes.navigated();
    h.fixture.detectChanges();
    discardBtn().click();
    h.fixture.detectChanges();

    expect(h.c.isOpen()).toBe(false);
    // `discarded` speaks the published union ('route' folds to 'programmatic');
    // `dismissedBy` carries the exact reason.
    expect(h.events).toEqual(['discarded:programmatic', 'cancelled', 'dismissed:route']);
  });

  it("★ abort path: a dirty busy dialog under pendingDismissal='abort' emits once, on Discard only", async () => {
    const h = await busyDirty({ pendingDismissal: 'abort' });

    h.c.close('escape');
    h.fixture.detectChanges();
    expect(h.c.promptedReason()).toBe('escape');
    keepBtn().click();
    h.fixture.detectChanges();
    expect(h.events).toEqual([]);

    h.c.close('backdrop');
    h.fixture.detectChanges();
    expect(h.events).toEqual([]);
    discardBtn().click();
    h.fixture.detectChanges();

    expect(h.c.isOpen()).toBe(false);
    expect(h.events).toEqual(['discarded:backdrop', 'cancelled', 'dismissed:backdrop']);
  });

  it('a Discard when nothing is loading does not claim a cancellation', async () => {
    const h = await busyDirty({ loading: false });
    h.c.close('escape');
    h.fixture.detectChanges();
    discardBtn().click();
    h.fixture.detectChanges();
    expect(h.events).toEqual(['discarded:escape', 'dismissed:escape']);
  });
});
