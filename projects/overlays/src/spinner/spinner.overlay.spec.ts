import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import {
  SvOverlayStackService,
  svBodyScrollLockDepth,
  svResetBodyScrollLock,
  svResetWarnOnce,
} from '@styloviz/core';
import { SvSpinnerComponent } from './spinner.component';

/**
 * ============================================================================
 *  `sv-spinner` — the fullscreen surface owns its overlay duties (`OF-18-I6`,
 *  `OF-18-M4`) and a spinner always has a name (`OF-18-I1`, `OF-18-M1`)
 * ============================================================================
 *
 * ★★★ A FULLSCREEN SPINNER THAT COVERS THE PAGE WITH PIXELS BUT NOT WITH
 *     INERTNESS IS A LIE. The earlier fix gave it a z-index and a scroll lock
 *     and stopped there: Tab still walked through the dimmed page to the form
 *     that had just been submitted. These specs render the component and
 *     check the DOM it actually produces.
 */

const overlayEl = () => document.querySelector<HTMLElement>('[data-sv-spinner-overlay]');

async function mountWithTrigger(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const trigger = document.createElement('button');
  trigger.textContent = 'Submit';
  const page = document.createElement('main');
  page.appendChild(trigger);
  document.body.appendChild(page);
  trigger.focus();

  const view = await render(SvSpinnerComponent, { inputs: { overlay: false, ...inputs } });
  view.fixture.componentRef.setInput('overlay', true);
  view.fixture.detectChanges();
  return { ...view, c: view.fixture.componentInstance, trigger, page };
}

afterEach(() => {
  svResetBodyScrollLock(document);
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.querySelectorAll('main').forEach((m) => m.remove());
});

describe('sv-spinner — the fullscreen surface is a real overlay', () => {
  it('★★ is portalled to <body>, outside the page it blocks', async () => {
    const { fixture } = await mountWithTrigger();
    const surface = overlayEl();
    expect(surface).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).contains(surface)).toBe(false);
    expect(surface!.closest('[data-sv-portal="spinner"]')?.parentElement).toBe(document.body);
  });

  it('★★★ makes the rest of the page inert while it blocks', async () => {
    const { page, fixture } = await mountWithTrigger();
    expect(page.hasAttribute('inert')).toBe(true);
    const portal = overlayEl()!.closest('[data-sv-portal]')!;
    expect(portal.hasAttribute('inert')).toBe(false);

    fixture.componentRef.setInput('overlay', false);
    fixture.detectChanges();
    expect(page.hasAttribute('inert')).toBe(false);
    expect(overlayEl()).toBeNull();
  });

  it('★★ moves focus into the surface, and gives it back on close', async () => {
    const { trigger, fixture } = await mountWithTrigger();
    expect(document.activeElement).toBe(overlayEl());

    fixture.componentRef.setInput('overlay', false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger);
  });

  it('is a named modal surface with the status region inside it', async () => {
    await mountWithTrigger({ label: 'Saving invoice' });
    const surface = overlayEl()!;
    expect(surface.getAttribute('role')).toBe('dialog');
    expect(surface.getAttribute('aria-modal')).toBe('true');
    expect(surface.getAttribute('aria-label')).toBe('Saving invoice');
    expect(surface.querySelector('[role="status"]')?.getAttribute('aria-label')).toBe('Saving invoice');
  });

  it('tears the portal, the lock and the inertness down when destroyed while blocking', async () => {
    const { fixture, page } = await mountWithTrigger();
    fixture.destroy();
    expect(overlayEl()).toBeNull();
    expect(document.querySelector('[data-sv-portal="spinner"]')).toBeNull();
    expect(page.hasAttribute('inert')).toBe(false);
    expect(svBodyScrollLockDepth()).toBe(0);
    expect(TestBed.inject(SvOverlayStackService).size).toBe(0);
  });
});

describe('sv-spinner — [portal]="false" is the opt-back to in-place rendering', () => {
  it('renders the backdrop and its hooks inside the host, stacked and locked but not blocking', async () => {
    const { fixture, page } = await mountWithTrigger({ portal: false });
    const host = fixture.nativeElement as HTMLElement;
    const surface = overlayEl();
    expect(surface).not.toBeNull();
    expect(host.contains(surface)).toBe(true);
    expect(host.querySelector('[role="status"]')).not.toBeNull();
    expect(document.querySelector('[data-sv-portal="spinner"]')).toBeNull();
    expect(page.hasAttribute('inert')).toBe(false);
    expect(svBodyScrollLockDepth()).toBe(1);
    expect(Number(surface!.style.zIndex)).toBeGreaterThan(0);

    fixture.componentRef.setInput('overlay', false);
    fixture.detectChanges();
    expect(overlayEl()).toBeNull();
    expect(svBodyScrollLockDepth()).toBe(0);
  });
});

describe('sv-spinner — flipping [portal] while overlaying rebuilds the one surface', () => {
  it('true → false → true never leaves two backdrops, or none', async () => {
    const { fixture, page } = await mountWithTrigger();
    const host = fixture.nativeElement as HTMLElement;
    const count = () => document.querySelectorAll('[data-sv-spinner-overlay]').length;
    expect(count()).toBe(1);
    expect(page.hasAttribute('inert')).toBe(true);

    fixture.componentRef.setInput('portal', false);
    fixture.detectChanges();
    expect(count()).toBe(1);
    expect(host.contains(overlayEl())).toBe(true);
    expect(document.querySelector('[data-sv-portal="spinner"]')).toBeNull();
    expect(page.hasAttribute('inert')).toBe(false);
    expect(svBodyScrollLockDepth()).toBe(1);

    fixture.componentRef.setInput('portal', true);
    fixture.detectChanges();
    expect(count()).toBe(1);
    expect(host.contains(overlayEl())).toBe(false);
    expect(page.hasAttribute('inert')).toBe(true);
    expect(svBodyScrollLockDepth()).toBe(1);
  });
});

describe('sv-spinner — Escape on the fullscreen surface', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const escape = () =>
    overlayEl()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  it('does nothing while the wait is not cancellable', async () => {
    const { c } = await mountWithTrigger({ stalledAfterMs: 1_000, cancelLabel: 'Stop' });
    const cancelled = vi.fn();
    c.cancelled.subscribe(cancelled);
    escape();
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('★ is the cancel once a stalled wait offers one', async () => {
    const { c } = await mountWithTrigger({ stalledAfterMs: 1_000, cancelLabel: 'Stop' });
    const cancelled = vi.fn();
    c.cancelled.subscribe(cancelled);
    vi.advanceTimersByTime(1_000);
    TestBed.inject(ApplicationRef).tick();

    expect(document.querySelector('[data-sv-cancel]')?.textContent?.trim()).toBe('Stop');
    escape();
    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});

describe('sv-spinner — a blank label never produces a nameless status', () => {
  beforeEach(() => svResetWarnOnce());

  it.each(['', '   '])('falls back to the default name for %j, and warns', async (label) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSpinnerComponent, { inputs: { label } });
    const status = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')!;

    expect(status.getAttribute('aria-label')).toBe('Loading…');
    expect(warn.mock.calls.some((c) => String(c[0]).includes('sv-spinner: [label] is blank'))).toBe(true);
    warn.mockRestore();
  });

  it('stays silent for a real label', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.resetTestingModule();
    await render(SvSpinnerComponent, { inputs: { label: 'Loading invoices' } });
    expect(warn.mock.calls.some((c) => String(c[0]).includes('[label] is blank'))).toBe(false);
    warn.mockRestore();
  });
});
