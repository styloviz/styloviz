import { TestBed } from '@angular/core/testing';
import { SvOverlayStackService } from './overlay-stack';
import { SvLiveAnnouncer } from '../a11y/live-announcer';

/**
 * `X-4` / `X-5` / `X-9` re-check (2026-09-29).
 *
 * ★★★ "WHO IS INERT?" HAD THE WRONG ANSWER FOR NESTED SURFACES. `X-4` states
 *     it outright — everything below the topmost modal surface, INCLUDING
 *     OTHER OVERLAYS — and the stack kept every open surface live. A drawer
 *     with a confirm dialog over it stayed tabbable and stayed in the
 *     accessibility tree while the dialog claimed `aria-modal`.
 *
 * ★★★ AND IT SILENCED THE ANNOUNCER. The shared live regions are body
 *     children, so the first blocking surface marked them `inert` with the
 *     rest of the page — every announcement made while a dialog was open went
 *     nowhere.
 */

const stack = () => {
  TestBed.resetTestingModule();
  return TestBed.inject(SvOverlayStackService);
};

function bodyChild(id: string, html = '<button>x</button>'): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe('X-4 — a modal over a drawer over a popover, end to end', () => {
  let page: HTMLElement;
  let popoverEl: HTMLElement;
  let drawerEl: HTMLElement;
  let modalEl: HTMLElement;

  beforeEach(() => {
    page = bodyChild('page');
    popoverEl = bodyChild('popover-portal');
    drawerEl = bodyChild('drawer-portal');
    modalEl = bodyChild('modal-portal');
  });

  afterEach(() => {
    for (const el of [page, popoverEl, drawerEl, modalEl]) el.remove();
    document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
  });

  it('★★★ dismisses top-down, paints bottom-up, and inerts everything under the top blocker', () => {
    const s = stack();
    const popover = s.push('anchored', { element: () => popoverEl });
    const drawer = s.push('sheet', { blocking: true, element: () => drawerEl });
    const modal = s.push('modal', { blocking: true, element: () => modalEl });

    // Who is on top — push order, one monotonic counter.
    expect(popover.zIndex).toBeLessThan(drawer.zIndex);
    expect(drawer.zIndex).toBeLessThan(modal.zIndex);

    // Who is inert — the page AND both overlays beneath the modal.
    expect(page.hasAttribute('inert')).toBe(true);
    expect(popoverEl.hasAttribute('inert')).toBe(true);
    expect(drawerEl.hasAttribute('inert')).toBe(true);
    expect(modalEl.hasAttribute('inert')).toBe(false);

    // Who owns Escape — one keystroke, one surface, in order.
    expect([modal, drawer, popover].map((h) => h.isTopmost())).toEqual([true, false, false]);
    modal.release();
    expect([drawer, popover].map((h) => h.isTopmost())).toEqual([true, false]);

    // The drawer is the top blocker again: it comes back, the popover under it stays off.
    expect(drawerEl.hasAttribute('inert')).toBe(false);
    expect(popoverEl.hasAttribute('inert')).toBe(true);
    expect(page.hasAttribute('inert')).toBe(true);

    drawer.release();
    expect(popover.isTopmost()).toBe(true);
    expect(popoverEl.hasAttribute('inert')).toBe(false);
    expect(page.hasAttribute('inert')).toBe(false);
    popover.release();
  });

  it('★ a surface opened FROM the top blocker stays live, even though it is pushed after it', () => {
    const s = stack();
    const drawer = s.push('sheet', { blocking: true, element: () => drawerEl });
    const select = s.push('anchored', { element: () => popoverEl });
    // A later pass (another push) must still see the select as ABOVE the drawer.
    const tooltip = s.push('tooltip', { dismissible: false });

    expect(popoverEl.hasAttribute('inert')).toBe(false);
    expect(drawerEl.hasAttribute('inert')).toBe(false);
    expect(page.hasAttribute('inert')).toBe(true);

    tooltip.release();
    select.release();
    drawer.release();
  });

  it('★ an ambient surface opened BEFORE the modal is not switched off by it', () => {
    // A toast reporting what the user just did must survive the dialog that
    // opens next — it is raised AT the user, not navigated into.
    const s = stack();
    const toastEl = bodyChild('toast-portal');
    const toast = s.push('toast', { dismissible: false, element: () => toastEl });
    const modal = s.push('modal', { blocking: true, element: () => modalEl });

    expect(toastEl.hasAttribute('inert')).toBe(false);
    expect(page.hasAttribute('inert')).toBe(true);

    modal.release();
    toast.release();
    toastEl.remove();
  });
});

describe('X-9 — the shared live regions are never made inert', () => {
  afterEach(() => {
    document.querySelectorAll('[inert]').forEach((el) => el.removeAttribute('inert'));
    document.querySelectorAll('[data-sv-live-region]').forEach((el) => el.remove());
  });

  it('★★★ an announcement made while a dialog is open reaches a live (non-inert) region', () => {
    TestBed.resetTestingModule();
    const live = TestBed.inject(SvLiveAnnouncer);
    const s = TestBed.inject(SvOverlayStackService);

    // The regions exist BEFORE the dialog opens — the ordinary case in an app
    // that has announced anything at all.
    live.announce('Filters applied');
    const polite = live.regionFor('polite')!;
    const page = bodyChild('page');
    const dialogEl = bodyChild('dialog-portal');

    const dialog = s.push('modal', { blocking: true, element: () => dialogEl });
    expect(page.hasAttribute('inert')).toBe(true);
    expect(polite.hasAttribute('inert')).toBe(false);
    expect(live.regionFor('assertive')!.hasAttribute('inert')).toBe(false);

    live.announce('Saved');
    expect(polite.closest('[inert]')).toBeNull();
    expect(polite.textContent).toContain('Saved');

    dialog.release();
    page.remove();
    dialogEl.remove();
    live.reset();
  });

  it('does not un-inert a consumer region that merely has aria-live', () => {
    // Only the announcer's own hook is exempt; a consumer's region is theirs.
    TestBed.resetTestingModule();
    const s = TestBed.inject(SvOverlayStackService);
    const theirs = bodyChild('theirs');
    theirs.setAttribute('aria-live', 'polite');
    const dialogEl = bodyChild('dialog-portal');

    const dialog = s.push('modal', { blocking: true, element: () => dialogEl });
    expect(theirs.hasAttribute('inert')).toBe(true);

    dialog.release();
    expect(theirs.hasAttribute('inert')).toBe(false);
    theirs.remove();
    dialogEl.remove();
  });
});
