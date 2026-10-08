import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SvNotificationCenterComponent } from './notification-center.component';
import type { NotificationItem } from './notification-center.types';
import { flush, until } from '../../../../src/testing/async';

/**
 * The dropdown variant renders its panel through a portal appended to
 * `document.body`, so it escapes any `overflow: hidden` / `transform` ancestor.
 * That buys the clipping fix and costs three things a spec has to hold the
 * component to: the portal must be torn down on every exit path, the position
 * must be recomputed rather than frozen at open time, and a click inside the
 * portal must not read as a click outside the component.
 *
 * ★ Every rectangle here is STUBBED. jsdom reports 0 × 0 for everything, so the
 * flip logic would always see a trigger at the top-left corner and the "open
 * upwards" arm would be unreachable.
 *
 * ★ Twin divergences from the Pro spec of the same name, each with its own test
 * below: the free tier has no `compact` variant (so one panel width, not two)
 * and no Escape-to-close.
 */

const note = (id: string): NotificationItem => ({
  id,
  type: 'comment',
  title: `Notification ${id}`,
  timestamp: new Date(2026, 2, 15, 9, 0).toISOString(),
  read: false,
});

const VW = 1200;
const VH = 800;
const restores: (() => void)[] = [];

function setViewport() {
  for (const [prop, value] of [['innerWidth', VW], ['innerHeight', VH]] as const) {
    const previous = Object.getOwnPropertyDescriptor(window, prop);
    Object.defineProperty(window, prop, { value, configurable: true });
    restores.push(() => { if (previous) Object.defineProperty(window, prop, previous); });
  }
}

function stubRect(el: Element, r: { top: number; left: number; width: number; height: number }) {
  const rect = {
    ...r,
    bottom: r.top + r.height,
    right: r.left + r.width,
    x: r.left,
    y: r.top,
    toJSON() { return this; },
  } as DOMRect;
  Object.defineProperty(el, 'getBoundingClientRect', { value: () => rect, configurable: true });
}

afterEach(() => {
  while (restores.length) restores.pop()!();
  document.querySelectorAll('[data-nc-portal]').forEach((n) => n.remove());
});

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  setViewport();
  const rendered = await render(SvNotificationCenterComponent, {
    inputs: { notifications: [note('a')], ...inputs },
  });
  const host = rendered.fixture.nativeElement as HTMLElement;
  const bell = host.querySelector<HTMLButtonElement>('[aria-label="Open notifications"]') as HTMLButtonElement;
  return { ...rendered, host, bell, c: rendered.fixture.componentInstance };
}

const portal = () => document.querySelector('[data-nc-portal]');

async function openPanel(bell: HTMLButtonElement) {
  await userEvent.click(bell);
  await until(() => portal() !== null, { label: 'the portal to mount' });
}

describe('SvNotificationCenterComponent — the portal', () => {
  it('mounts the panel in the body, not inside the component', async () => {
    const { host, bell } = await setup();
    expect(portal()).toBeNull();

    await openPanel(bell);
    expect(portal()?.parentElement).toBe(document.body);
    expect(host.contains(portal())).toBe(false);
  });

  it('takes the panel down again when it is closed', async () => {
    const { bell, c } = await setup();
    await openPanel(bell);

    c.closePanel();
    expect(portal()).toBeNull();
    expect(c.open()).toBe(false);
  });

  it('takes the panel down when the component is destroyed', async () => {
    const { bell, fixture } = await setup();
    await openPanel(bell);

    fixture.destroy();
    expect(portal()).toBeNull();
  });

  /**
   * ★ THE REGRESSION this file was written for. The portal mount is deferred by
   * a `setTimeout(0)` so the template ref resolves first. The free twin did not
   * hold the timer handle, so a component destroyed inside that window — a
   * route change made while the bell was being pressed — still ran the
   * callback: it mounted a `[data-nc-portal]` panel into `document.body` that
   * nothing owned, and attached a document click listener and a window scroll
   * listener that `ngOnDestroy` had already finished removing. Both leaked for
   * the life of the tab. The Pro twin already cleared it.
   */
  it('mounts nothing if it is destroyed before the deferred mount runs', async () => {
    const { bell, fixture } = await setup();
    // A SYNCHRONOUS click, then an immediate teardown: `userEvent.click` awaits
    // several ticks, by which time the deferred mount has already run and the
    // window this test is about has closed.
    bell.click();
    fixture.destroy();

    await flush();
    await flush();
    expect(portal()).toBeNull();
  });

  /**
   * And the listeners that callback would have attached must not survive
   * either. The trigger's rectangle is MOVED after teardown, so a leaked scroll
   * listener would recompute the panel position to a visibly different value —
   * re-scrolling with an unchanged rect would recompute to the same answer and
   * prove nothing.
   */
  it('leaves no scroll listener behind when it is destroyed mid-open', async () => {
    const { bell, fixture, c } = await setup();
    stubRect(bell, { top: 400, left: 1000, width: 40, height: 40 });
    bell.click();
    const before = c._panelStyle();
    expect(before.top).toBe('448px');

    fixture.destroy();
    await flush();
    await flush();

    stubRect(bell, { top: 100, left: 1000, width: 40, height: 40 });
    window.dispatchEvent(new Event('scroll'));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    expect(c._panelStyle()).toEqual(before);
  });

  /** Same for the document click listener the callback would have attached. */
  it('leaves no click listener behind when it is destroyed mid-open', async () => {
    const { bell, fixture, c } = await setup();
    bell.click();
    expect(c.open()).toBe(true);
    fixture.destroy();
    await flush();
    await flush();

    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    try {
      await userEvent.click(elsewhere);
      // A live listener would have run closePanel() on a torn-down component.
      expect(c.open()).toBe(true);
      expect(portal()).toBeNull();
    } finally {
      elsewhere.remove();
    }
  });

  it('never mounts two panels for two opens', async () => {
    const { bell, c } = await setup();
    await openPanel(bell);
    c.closePanel();
    await openPanel(bell);
    expect(document.querySelectorAll('[data-nc-portal]')).toHaveLength(1);
  });

  /** The inline variant is always visible and must not portal anything. */
  it('renders inline without a portal at all', async () => {
    const { host } = await setup({ variant: 'inline' });
    expect(portal()).toBeNull();
    expect(host.querySelector('[aria-label="Open notifications"]')).toBeNull();
  });
});

describe('SvNotificationCenterComponent — where the panel lands', () => {
  it('hangs below the trigger when there is room', async () => {
    const { bell, c } = await setup();
    stubRect(bell, { top: 40, left: 1000, width: 40, height: 40 });
    await openPanel(bell);

    expect(c._panelStyle().top).toBe('88px'); // bottom 80 + 8 gap
    expect(c._panelStyle().bottom).toBeUndefined();
    expect(c._panelStyle().right).toBe('160px');
  });

  it('flips above the trigger when there is more room up there', async () => {
    const { bell, c } = await setup();
    stubRect(bell, { top: 700, left: 1000, width: 40, height: 40 });
    await openPanel(bell);

    expect(c._panelStyle().bottom).toBe('108px');
    expect(c._panelStyle().top).toBeUndefined();
    expect(c._panelStyle().maxH).toBe('684px');
  });

  /**
   * ★ Twin divergence, verified rather than assumed: the free tier's
   * `NotificationCenterVariant` type has no `'compact'` member at all — it's
   * `'dropdown' | 'inline'` only (`notification-center.types.ts`), and the
   * free template has no `@case ('compact')` either. This isn't a missing
   * width adjustment on a shared variant; the variant itself doesn't exist
   * on this tier, so there is exactly one panel width here, always 416px —
   * not a bug to close, an absent feature to leave alone (adding a whole new
   * variant, template branch included, is a tier-boundary decision, not a
   * geometry fix — see §4.2).
   */
  it('clamps every trigger position against the one panel width this tier has', async () => {
    const { bell, c } = await setup();
    stubRect(bell, { top: 40, left: 0, width: 40, height: 40 });
    await openPanel(bell);
    expect(c._panelStyle().right).toBe(`${VW - 416 - 8}px`);
  });

  it('keeps a margin from the right edge', async () => {
    const { bell, c } = await setup();
    stubRect(bell, { top: 40, left: VW - 20, width: 40, height: 40 });
    await openPanel(bell);
    expect(c._panelStyle().right).toBe('8px');
  });

  it('caps the height so the panel never clips the viewport', async () => {
    const { bell, c } = await setup();
    stubRect(bell, { top: 40, left: 1000, width: 40, height: 40 });
    await openPanel(bell);
    expect(c._panelStyle().maxH).toBe('704px');
  });

  it('recomputes the position when the page scrolls under the trigger', async () => {
    const { bell, c } = await setup();
    stubRect(bell, { top: 400, left: 1000, width: 40, height: 40 });
    await openPanel(bell);
    expect(c._panelStyle().top).toBe('448px');

    stubRect(bell, { top: 100, left: 1000, width: 40, height: 40 });
    window.dispatchEvent(new Event('scroll'));
    await until(() => c._panelStyle().top === '148px', { label: 'the panel to follow the trigger' });
  });

  /** The negative: a closed panel has nothing to reposition, and must not try. */
  it('stops tracking the trigger once it is closed', async () => {
    const { bell, c } = await setup();
    stubRect(bell, { top: 400, left: 1000, width: 40, height: 40 });
    await openPanel(bell);
    c.closePanel();
    const frozen = c._panelStyle();

    stubRect(bell, { top: 100, left: 1000, width: 40, height: 40 });
    window.dispatchEvent(new Event('scroll'));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    expect(c._panelStyle()).toEqual(frozen);
  });

  it('stops tracking once the component is gone', async () => {
    const { bell, c, fixture } = await setup();
    stubRect(bell, { top: 400, left: 1000, width: 40, height: 40 });
    await openPanel(bell);
    const frozen = c._panelStyle();
    fixture.destroy();

    stubRect(bell, { top: 100, left: 1000, width: 40, height: 40 });
    window.dispatchEvent(new Event('scroll'));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    expect(c._panelStyle()).toEqual(frozen);
  });
});

describe('SvNotificationCenterComponent — dismissing the panel', () => {
  it('closes on a click somewhere else on the page', async () => {
    const { bell, c } = await setup();
    await openPanel(bell);

    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    try {
      await userEvent.click(elsewhere);
      expect(c.open()).toBe(false);
      expect(portal()).toBeNull();
    } finally {
      elsewhere.remove();
    }
  });

  /** The negative: interacting with the panel itself must not dismiss it. */
  it('stays open for a click inside the panel', async () => {
    const { bell, c } = await setup();
    await openPanel(bell);

    await userEvent.click(portal() as HTMLElement);
    expect(c.open()).toBe(true);
    expect(portal()).not.toBeNull();
  });

  it('closes on Escape, and does nothing when it is already closed', async () => {
    const { bell, c } = await setup();
    c.onEscape();
    expect(c.open()).toBe(false);

    await openPanel(bell);
    c.onEscape();
    expect(c.open()).toBe(false);
    expect(portal()).toBeNull();
  });

  it('closes on a real Escape keypress dispatched at the document', async () => {
    const { bell, c } = await setup();
    await openPanel(bell);

    await userEvent.keyboard('{Escape}');
    expect(c.open()).toBe(false);
    expect(portal()).toBeNull();
  });
});

/**
 * ★ These have to go through a real `<sv-notification-center>` element.
 *
 * `render(Component)` mounts the component on a generic `<div id="root0">`, so
 * `target.closest('sv-notification-center')` finds nothing there no matter what
 * the component does — the click-outside guard cannot be tested at all from a
 * bare fixture. A host template puts the real tag in the document, which is
 * what an application has.
 */
@Component({
  standalone: true,
  imports: [SvNotificationCenterComponent],
  template: `<sv-notification-center [notifications]="[]" />`,
})
class RealTagHost {}

describe('SvNotificationCenterComponent — clicks inside its own element', () => {
  async function mount() {
    TestBed.resetTestingModule();
    setViewport();
    const { fixture } = await render(RealTagHost);
    const host = fixture.nativeElement as HTMLElement;
    const bell = host.querySelector<HTMLButtonElement>('[aria-label="Open notifications"]') as HTMLButtonElement;
    const c = fixture.debugElement.children[0].componentInstance as SvNotificationCenterComponent;
    return { fixture, host, bell, c };
  }

  /**
   * The click-outside guard runs in the CAPTURE phase. If it does not recognise
   * this component's own element it closes the panel a moment before the
   * trigger's own handler reopens it in the bubble phase, and the bell stops
   * working as a toggle — you can open the panel but never shut it again. (The
   * Pro twin was failing exactly this; its selector list named the free tag
   * twice and its own not at all.)
   */
  it('closes when the trigger is pressed a second time', async () => {
    const { bell, c } = await mount();
    await openPanel(bell);
    expect(c.open()).toBe(true);

    await userEvent.click(bell);
    expect(c.open()).toBe(false);
    expect(portal()).toBeNull();
  });

  it('still closes for a click that really is outside', async () => {
    const { bell, c } = await mount();
    await openPanel(bell);

    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    try {
      await userEvent.click(elsewhere);
      expect(c.open()).toBe(false);
    } finally {
      elsewhere.remove();
    }
  });
});
