import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvModalComponent } from './modal.component';
import { until } from '../../../../src/testing/async';

/**
 * ============================================================================
 *  `sv-modal` — the way out of a loading modal (`OF-09-I10`)
 * ============================================================================
 *
 * ★★★ THE ITEM IS TWO COMPLAINTS. "No way out": every close path — the ×
 *     button, the backdrop, Escape — was blocked while `loading`, silently
 *     and with no stated policy, so a request that hung left the modal simply
 *     not responding. "No reason to wait": a spinner and the word "Loading…"
 *     say nothing about whether continuing to wait is sensible.
 *
 * ★★ THE MODAL DOES NOT OWN THE REQUEST — `loading` is an input — so `abort`
 *    cannot abort anything itself. What it does is TELL the host, before the
 *    teardown, that the user has given up.
 */

async function open(inputs: Partial<ComponentInput<SvModalComponent>> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvModalComponent, {
    inputs: { title: 'Saving', isOpen: true, ...inputs } as ComponentInput<SvModalComponent>,
  });
  await until(() => document.querySelector('[role="dialog"]') !== null, {
    label: 'the dialog to mount',
  });
  fixture.detectChanges();
  return { c: fixture.componentInstance, fixture };
}

const panel = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const backdrop = () => panel().parentElement!;
const escalation = () =>
  (document.querySelector('[data-sv-state="escalation"]') as HTMLElement | null)?.textContent?.trim() ?? null;
const stage = () =>
  document.querySelector('[data-sv-state="escalation"]')?.getAttribute('data-sv-stage') ?? null;
const cancelBtn = () => document.querySelector('[data-sv-cancel-loading]') as HTMLButtonElement | null;

// ★★ `shouldAdvanceTime` IS LOAD-BEARING HERE. The harness's `until()` polls
//    on a real timer to wait for the body portal to mount, and plain fake
//    timers stop that clock — the first version of this file hung forever on
//    "the dialog to mount". The escalation clock has to be fake BEFORE the
//    modal starts waiting, so the answer is a fake clock that still ticks on
//    its own, plus explicit `advanceTimersByTime` for the thresholds.
beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  document.querySelectorAll('[data-sv-modal-portal]').forEach((n) => n.remove());
  document.body.style.overflow = '';
});

describe('sv-modal — pendingDismissal (OF-09-I10, first half)', () => {
  it("'block' is the default, and every close path still refuses", async () => {
    const { c, fixture } = await open({ loading: true });

    c.close('programmatic');
    backdrop().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    c.onKeydown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    fixture.detectChanges();

    expect(c.isOpen()).toBe(true);
  });

  it("★ 'abort' lets the user out, and tells the host BEFORE the teardown", async () => {
    const { c, fixture } = await open({ loading: true, pendingDismissal: 'abort' });
    // ★★ THE ASSERTION IS WHAT THE MODAL LOOKED LIKE FROM INSIDE THE HANDLER,
    //    not the order two outputs arrived in — `closed` fires from an effect
    //    a tick later, so an ordering test over the two names passes whichever
    //    way round the emit and the close are written. Recording `isOpen()`
    //    from inside the subscriber is synchronous and cannot be fooled.
    const openWhenTold: boolean[] = [];
    c.loadingCancelled.subscribe(() => openWhenTold.push(c.isOpen()));

    c.onKeydown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    fixture.detectChanges();

    expect(c.isOpen()).toBe(false);
    // The host started the work and is the only one who can stop it, so it is
    // told while the modal is still up rather than after it has gone.
    expect(openWhenTold).toEqual([true]);
  });

  it('does not consume Escape while dismissal is refused', async () => {
    // ★ The existing contract, and it stays: the modal has nothing to do with
    //   the keystroke, so it does not take it. (A separate question from
    //   whether Escape should close — see the overlay stack for that one.)
    const { c } = await open({ loading: true });
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    c.onKeydown(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('says nothing about cancellation when it is not loading', async () => {
    const { c, fixture } = await open({ pendingDismissal: 'abort' });
    let cancelled = 0;
    c.loadingCancelled.subscribe(() => cancelled++);

    c.close('programmatic');
    fixture.detectChanges();

    expect(c.isOpen()).toBe(false);
    expect(cancelled).toBe(0);
  });
});

describe('sv-modal — a reason to wait (OF-09-I10, second half)', () => {
  it('escalates the loading overlay through both thresholds', async () => {
    const { fixture } = await open({ loading: true, slowAfterMs: 10_000, stalledAfterMs: 30_000 });

    vi.advanceTimersByTime(10_000);
    fixture.detectChanges();
    expect(stage()).toBe('slow');
    expect(escalation()).toBe('This is taking longer than usual…');

    vi.advanceTimersByTime(20_000);
    fixture.detectChanges();
    expect(stage()).toBe('stalled');
    expect(escalation()).toBe('This seems to be stuck.');
  });

  it('★ times the WAIT, not the modal', async () => {
    // ★★ A modal can be open for ten minutes while the user reads it. Only
    //    the busy state is a wait, and a second save must start from zero
    //    rather than inherit the first one's age.
    const { c, fixture } = await open({ slowAfterMs: 5_000, stalledAfterMs: 20_000 });
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(escalation()).toBeNull();

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(4_000);
    fixture.detectChanges();
    expect(escalation()).toBeNull();

    vi.advanceTimersByTime(1_000);
    fixture.detectChanges();
    expect(stage()).toBe('slow');

    // The save finished; a later one starts a fresh clock.
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();
    expect(c.loadingStage()).toBe('idle');

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    vi.advanceTimersByTime(4_000);
    fixture.detectChanges();
    expect(escalation()).toBeNull();
  });

  it('offers a cancel only when stalled AND labelled, and reports the press', async () => {
    const { c, fixture } = await open({
      loading: true, slowAfterMs: 1_000, stalledAfterMs: 5_000, cancelLoadingLabel: 'Stop saving',
    });
    let cancelled = 0;
    c.loadingCancelled.subscribe(() => cancelled++);

    vi.advanceTimersByTime(1_000);
    fixture.detectChanges();
    expect(cancelBtn()).toBeNull();   // slow is not stuck

    vi.advanceTimersByTime(4_000);
    fixture.detectChanges();
    expect(cancelBtn()?.textContent?.trim()).toBe('Stop saving');

    cancelBtn()!.click();
    fixture.detectChanges();
    expect(cancelled).toBe(1);
    // ★ `block` is still in force: the offer stops the WORK, and whether the
    //   modal closes is `pendingDismissal`'s business, not the button's.
    expect(c.isOpen()).toBe(true);
  });

  it('offers no cancel without a label, however stuck it is', async () => {
    const { fixture } = await open({ loading: true, stalledAfterMs: 1_000 });
    vi.advanceTimersByTime(1_000);
    fixture.detectChanges();
    expect(stage()).toBe('stalled');
    expect(cancelBtn()).toBeNull();
  });

  it('announces from the overlay region it already had, not a new one', async () => {
    const { fixture } = await open({ loading: true, slowAfterMs: 1_000 });
    vi.advanceTimersByTime(1_000);
    fixture.detectChanges();

    const regions = screen.getAllByRole('status');
    expect(regions).toHaveLength(1);
    expect(regions[0].textContent).toContain('This is taking longer than usual…');
  });

  it('stays silent unless a threshold was set', async () => {
    const { fixture } = await open({ loading: true });
    vi.advanceTimersByTime(10 * 60_000);
    fixture.detectChanges();
    expect(escalation()).toBeNull();
  });
});
