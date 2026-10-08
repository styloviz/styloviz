import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvSpinnerComponent } from './spinner.component';

/**
 * ============================================================================
 *  `sv-spinner` — escalation (`OF-18-I5`, `OF-18-M3`)
 * ============================================================================
 *
 * ★★★ A SPINNER IS INDISTINGUISHABLE FROM A FAILED REQUEST, FOREVER. At ninety
 *     seconds it is no longer telling the truth — nothing is happening — and
 *     the user's only remaining move is to reload and lose what they typed.
 *
 * ★★ THE SPINNER'S EXISTENCE IS THE WAIT. There is no `loading` input: a host
 *    renders it while waiting and removes it when the content arrives. So the
 *    clock starts when the component does.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvSpinnerComponent, { inputs });
  return { ...view, c: view.fixture.componentInstance };
}

const message = () =>
  (document.querySelector('[data-sv-state="escalation"]') as HTMLElement | null)?.textContent?.trim() ?? null;
const stage = () =>
  document.querySelector('[data-sv-state="escalation"]')?.getAttribute('data-sv-stage') ?? null;
const cancelBtn = () => document.querySelector('[data-sv-cancel]') as HTMLButtonElement | null;

/** Advances the fake clock and lets the view catch up. */
function tick(view: Awaited<ReturnType<typeof setup>>, ms: number) {
  vi.advanceTimersByTime(ms);
  view.fixture.detectChanges();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('sv-spinner — escalation is off unless asked for', () => {
  it('says nothing extra, ever, by default', async () => {
    const view = await setup();
    tick(view, 10 * 60_000);

    expect(message()).toBeNull();
    expect(view.c.waitStage()).toBe('idle');
  });
});

describe('sv-spinner — a wait that has gone on too long', () => {
  it('says "longer than usual" at the slow threshold, and escalates at the second', async () => {
    const view = await setup({ slowAfterMs: 10_000, stalledAfterMs: 30_000 });

    tick(view, 9_999);
    expect(message()).toBeNull();

    tick(view, 1);
    expect(stage()).toBe('slow');
    expect(message()).toBe('This is taking longer than usual…');

    tick(view, 20_000);
    expect(stage()).toBe('stalled');
    expect(message()).toBe('This seems to be stuck.');
  });

  it('uses the host\'s wording when it has better words', async () => {
    const view = await setup({
      slowAfterMs: 1_000,
      slowMessage: 'Still importing 12,000 rows…',
    });
    tick(view, 1_000);
    expect(message()).toBe('Still importing 12,000 rows…');
  });

  it('reports each escalation once, and never reports the ordinary wait', async () => {
    // ★★ THE HANDLER IS BOUND AT RENDER, NOT AFTER. Subscribing afterwards
    //    misses the emission that happens during the first change-detection
    //    pass — which is exactly the `waiting` emission this test exists to
    //    prove does not happen. A `.subscribe()` here passed with the guard
    //    removed, which is how I found out.
    TestBed.resetTestingModule();
    const seen: string[] = [];
    const view = await render(SvSpinnerComponent, {
      inputs: { slowAfterMs: 1_000, stalledAfterMs: 2_000 },
      on: { escalated: (s: string) => seen.push(s) },
    });
    const h = { ...view, c: view.fixture.componentInstance };

    tick(h, 1_000);
    tick(h, 1_000);
    tick(h, 60_000);

    // ★ `waiting` is not news. A host that logged it would log every spinner.
    expect(seen).toEqual(['slow', 'stalled']);
  });

  it('★ announces from the region it already has, not a new one', async () => {
    // ★★ TWO LIVE REGIONS FOR ONE WAIT IS THE DEFECT, NOT THE FIX (`X-9`).
    //    The message lives inside the spinner's own `role="status"`, which
    //    existed before the text did — which is exactly what a live region
    //    needs to announce a change at all.
    const view = await setup({ slowAfterMs: 1_000 });
    tick(view, 1_000);

    const regions = screen.getAllByRole('status');
    expect(regions).toHaveLength(1);
    expect(regions[0].textContent).toContain('This is taking longer than usual…');
  });
});

describe('sv-spinner — the way out', () => {
  it('offers no cancel unless the host gave it a label', async () => {
    // ★★ AN OUTPUT CANNOT BE ASKED WHETHER ANYONE IS LISTENING, so the offer
    //    is an input. A button that does nothing when pressed is worse than
    //    no button — the user presses it and now distrusts the whole screen.
    const view = await setup({ stalledAfterMs: 1_000 });
    tick(view, 1_000);

    expect(stage()).toBe('stalled');
    expect(cancelBtn()).toBeNull();
  });

  it('offers a cancel only once the wait is stalled, and emits when pressed', async () => {
    const view = await setup({
      slowAfterMs: 1_000, stalledAfterMs: 5_000, cancelLabel: 'Stop importing',
    });
    let cancelled = 0;
    view.c.cancelled.subscribe(() => cancelled++);

    tick(view, 1_000);
    // Slow is not stuck: the request is probably fine, and offering a cancel
    // here invites the user to abandon work that was about to succeed.
    expect(cancelBtn()).toBeNull();

    tick(view, 4_000);
    expect(cancelBtn()?.textContent?.trim()).toBe('Stop importing');

    cancelBtn()!.click();
    expect(cancelled).toBe(1);
  });
});
