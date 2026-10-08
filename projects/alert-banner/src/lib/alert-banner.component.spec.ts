import { Component, ViewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { ICON_REGISTRY } from '@styloviz/icons';
import { SvAlertBannerComponent, type AlertAction } from './alert-banner.component';

async function setup(inputs: Record<string, unknown> = {}) {
  // ★ Without this, the SECOND render in a single test throws "Cannot configure
  // the test module when the test module has already been instantiated" — and
  // the "every variant resolves" guard below renders five times. Written in the
  // icon sweep's batch 17 and never once executed until batch 18 ran it.
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAlertBannerComponent, { inputs });
  return fixture.componentInstance;
}

describe('SvAlertBannerComponent — actions', () => {
  it('emits actionClick with the action id', async () => {
    const spy = vi.fn();
    const actions: AlertAction[] = [{ id: 'undo', label: 'Undo' }];
    const c = await setup({ actions });
    c.actionClick.subscribe(spy);

    c.onActionClick('undo');
    expect(spy).toHaveBeenCalledWith('undo');
  });
});

describe('SvAlertBannerComponent — icon resolution', () => {
  /**
   * Claims unchanged; the values are icon-library NAMES now, so each is also
   * checked to actually resolve — which a `d` string could not be.
   */
  it('falls back to a variant icon when no icon is provided', async () => {
    const c = await setup({ variant: 'success' });
    expect(c.resolvedIconName()).toBe('check-circle');
    expect(ICON_REGISTRY[c.resolvedIconName() as keyof typeof ICON_REGISTRY]).toBeTruthy();
  });

  it('uses the supplied icon when set', async () => {
    const c = await setup({ icon: 'bell' });
    expect(c.resolvedIconName()).toBe('bell');
  });

  it('gives every variant a resolvable name', async () => {
    for (const v of ['info', 'success', 'warning', 'danger', 'neutral'] as const) {
      const c = await setup({ variant: v });
      const n = c.resolvedIconName();
      expect(n, v).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(ICON_REGISTRY[n as keyof typeof ICON_REGISTRY], v).toBeTruthy();
    }
  });
});

describe('SvAlertBannerComponent — dismissal', () => {
  it('starts visible and enters the closing state on close()', async () => {
    const c = await setup();
    expect(c.isVisible()).toBe(true);
    c.close();
    expect(c.isClosing()).toBe(true);
  });

  it('emits dismissed and hides after the transition', async () => {
    vi.useFakeTimers();
    try {
      const c = await setup();
      const spy = vi.fn();
      c.dismissed.subscribe(spy);

      c.close();
      vi.runAllTimers(); // fast-forward the exit transition

      expect(spy).toHaveBeenCalledTimes(1);
      expect(c.isVisible()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── OF-01-I3 · focus is lost during removal ──────────────────────────────────

/**
 * ★★★ THE BANNER IS ITS OWN X-6 CASE, WITHOUT A PORTAL OR AN OPENER. The
 *     dismiss button lives inside the element the dismiss removes, so the
 *     focused node IS the node that disappears, and removing a focused node
 *     drops focus to `<body>` — the next Tab restarts at the top of the page
 *     and nothing is announced. There is no trigger to go back to; the only
 *     honest answer is the region the banner was removed from.
 */
@Component({
  standalone: true,
  imports: [SvAlertBannerComponent],
  template: `
    <div id="stack">
      <button type="button" id="above">Above</button>
      <sv-alert-banner #b title="Heads up" message="Something happened" />
    </div>
  `,
})
class BannerInStackHost {
  @ViewChild('b') readonly banner!: SvAlertBannerComponent;
}

describe('SvAlertBannerComponent — OF-01-I3 focus during removal', () => {
  /** The dismiss transition is 300 ms; 360 clears it with room to spare. */
  const settle = (ms = 360) => new Promise<void>((r) => setTimeout(r, ms));

  it('★ leaves focus in the region it was removed from, not on <body>', async () => {
    TestBed.resetTestingModule();
    const { fixture } = await render(BannerInStackHost);
    fixture.detectChanges();

    const closeBtn = document.querySelector<HTMLElement>('#stack sv-alert-banner button');
    expect(closeBtn).not.toBeNull();
    closeBtn!.focus();
    expect(document.activeElement).toBe(closeBtn);

    fixture.componentInstance.banner.close();
    fixture.detectChanges();
    await settle();                 // the dismiss transition
    fixture.detectChanges();
    await settle(20);               // the deferred restore

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(document.getElementById('above'));
  });

  it('does not move focus when the dismiss came from somewhere else', async () => {
    // A programmatic or auto-dismiss close, with the user reading elsewhere on
    // the page. Taking their focus for a banner they were not touching is a
    // bug of its own.
    TestBed.resetTestingModule();
    const { fixture } = await render(BannerInStackHost);
    fixture.detectChanges();

    const elsewhere = document.getElementById('above')!;
    elsewhere.focus();

    fixture.componentInstance.banner.close();
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();
    await settle(20);

    expect(document.activeElement).toBe(elsewhere);
  });
});
