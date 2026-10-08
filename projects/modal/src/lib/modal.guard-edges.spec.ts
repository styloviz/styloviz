import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvOverlayRouteService, SvOverlayStackService, svResetBodyScrollLock } from '@styloviz/core';
import { SvModalComponent, type ModalCloseReason } from './modal.component';
import type { SvModalSizePx } from './modal-resize';
import { until } from '@testing/async';

/**
 * `sv-modal` — the close guards' remaining edges.
 *
 * The leave guard asked twice, a host veto on a navigation, the prompt
 * buttons pressed when there is no prompt, the cancel offer under `abort`,
 * a surface opened ABOVE the dialog owning the backdrop and Escape, the focus
 * trap's middle, and the resize paths that are not a drag.
 */

async function open(inputs: Partial<ComponentInput<SvModalComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvModalComponent, {
    inputs: { title: 'Edit profile', isOpen: true, ...inputs } as ComponentInput<SvModalComponent>,
  });
  await until(() => document.querySelector('[role="dialog"]') !== null, { label: 'the dialog to mount' });
  fixture.detectChanges();
  const c = fixture.componentInstance;
  const events: string[] = [];
  c.dismissedBy.subscribe((r) => events.push(`dismissed:${r}`));
  c.discarded.subscribe((r: ModalCloseReason) => events.push(`discarded:${r}`));
  c.closeCancelled.subscribe((r: ModalCloseReason) => events.push(`cancelled:${r}`));
  c.loadingCancelled.subscribe(() => events.push('loadingCancelled'));
  return {
    c,
    fixture,
    events,
    routes: TestBed.inject(SvOverlayRouteService),
    stack: TestBed.inject(SvOverlayStackService),
  };
}

const panel = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const backdrop = () => panel().parentElement!;
const prompt = () => document.querySelector('[data-sv-state="unsaved-prompt"]');
const key = (k: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });

afterEach(() => {
  document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
  svResetBodyScrollLock(document);
});

// ── The leave guard ──────────────────────────────────────────────────────────

describe('sv-modal — a navigation held while the prompt is already up', () => {
  it('holds it without asking twice, and Discard lets that navigation through', async () => {
    const h = await open({ dirty: true });
    h.c.close('backdrop');
    h.fixture.detectChanges();
    expect(prompt()).not.toBeNull();

    let proceeded = 0;
    expect(h.routes.requestLeave(() => proceeded++)).toBe(true);
    expect(h.events).toEqual([]); // no second prompt, nothing reported

    h.c.discardChanges();
    h.fixture.detectChanges();
    expect(proceeded).toBe(1);
    expect(h.c.isOpen()).toBe(false);
    expect(h.events).toEqual(['discarded:backdrop', 'dismissed:backdrop']);
  });

  it('a host veto holds the navigation silently — no prompt, nothing proceeds', async () => {
    const h = await open({ dirty: true, canClose: () => false });
    let proceeded = 0;
    expect(h.routes.requestLeave(() => proceeded++)).toBe(true);
    h.fixture.detectChanges();
    expect(prompt()).toBeNull();
    expect(proceeded).toBe(0);
    expect(h.c.isOpen()).toBe(true);
  });

  it('a host veto keeps a busy dialog up through a navigation, and says nothing', async () => {
    const h = await open({ loading: true, canClose: (r: ModalCloseReason) => r !== 'programmatic' });
    h.routes.navigated();
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(true);
    expect(prompt()).toBeNull();
    expect(h.events).toEqual([]);
  });
});

// ── The prompt's buttons with no prompt ──────────────────────────────────────

describe('sv-modal — Discard and Keep editing when nothing is pending', () => {
  it('do nothing and report nothing', async () => {
    const h = await open();
    h.c.discardChanges();
    h.c.keepEditing();
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(true);
    expect(h.events).toEqual([]);
  });
});

// ── The cancel offer ─────────────────────────────────────────────────────────

describe("sv-modal — cancelling a load under pendingDismissal='abort'", () => {
  it('stops the work AND closes, as a programmatic close', async () => {
    const h = await open({ loading: true, pendingDismissal: 'abort' });
    h.c.cancelLoading();
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(false);
    expect(h.events).toEqual(['loadingCancelled', 'dismissed:programmatic']);
  });

  it("only stops the work under 'block'", async () => {
    const h = await open({ loading: true });
    h.c.cancelLoading();
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(true);
    expect(h.events).toEqual(['loadingCancelled']);
  });
});

// ── A surface above the dialog ───────────────────────────────────────────────

describe('sv-modal — a surface opened above it owns the keys and the backdrop', () => {
  it('leaves Escape to the surface on top', async () => {
    const h = await open();
    const above = h.stack.push('anchored');
    const ev = key('Escape');
    backdrop().dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(h.c.isOpen()).toBe(true);
    above.release();
  });

  it('ignores a backdrop click no press was seen for while it is not topmost', async () => {
    const h = await open();
    const above = h.stack.push('anchored');
    backdrop().dispatchEvent(new MouseEvent('click', { bubbles: true })); // synthetic, no mousedown
    expect(h.c.isOpen()).toBe(true);
    above.release();

    backdrop().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    h.fixture.detectChanges();
    expect(h.c.isOpen()).toBe(false);
  });
});

// ── The focus trap ───────────────────────────────────────────────────────────

describe('sv-modal — Shift+Tab inside the ring', () => {
  it('does not intercept Shift+Tab from the last control — only the first control wraps backwards', async () => {
    await open({ maximizable: true });
    const buttons = [...panel().querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    // jsdom has no layout, so give the controls an offsetParent to count as visible.
    for (const b of buttons) Object.defineProperty(b, 'offsetParent', { value: panel(), configurable: true });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    const last = buttons[buttons.length - 1];
    last.focus();
    const ev = key('Tab', { shiftKey: true });
    last.dispatchEvent(ev);
    // Not prevented: the browser moves focus back one control on its own.
    expect(ev.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(last);
  });
});

// ── Resize paths that are not a drag ─────────────────────────────────────────

describe('sv-modal — resize without a drag', () => {
  async function sized(inputs: Partial<ComponentInput<SvModalComponent>> = {}) {
    const h = await open(inputs);
    const sizes: SvModalSizePx[] = [];
    h.c.resized.subscribe((s) => sizes.push(s));
    return { ...h, sizes };
  }

  it('a window resize leaves a never-sized panel to its CSS class', async () => {
    const h = await sized({ resizable: true });
    window.dispatchEvent(new Event('resize'));
    expect(h.sizes).toEqual([]);
    expect(h.c.panelSize()).toBeNull();
  });

  it('a window resize keeps a maximized panel filling the new viewport', async () => {
    const h = await sized({ maximizable: true });
    h.c.toggleMaximize();
    h.sizes.length = 0;

    const before = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
    try {
      window.dispatchEvent(new Event('resize'));
      expect(h.c.isMaximized()).toBe(true);
      expect(h.sizes).toHaveLength(1);
      expect(h.sizes[0].width).toBe(800 - 32);
    } finally {
      Object.defineProperty(window, 'innerWidth', { value: before, configurable: true });
    }
  });

  it('a window resize after the dialog closed does nothing', async () => {
    const h = await sized({ maximizable: true });
    h.c.toggleMaximize();
    h.c.close();
    h.fixture.detectChanges();
    h.sizes.length = 0;
    window.dispatchEvent(new Event('resize'));
    expect(h.sizes).toEqual([]);
  });
});
