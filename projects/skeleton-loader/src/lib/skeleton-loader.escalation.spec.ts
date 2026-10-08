import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { SvSkeletonLoaderComponent } from './skeleton-loader.component';

/**
 * ============================================================================
 *  `sv-skeleton-loader` — escalation (`OF-17-I7`, `OF-17-M6`)
 * ============================================================================
 *
 * ★★★ A STUCK SKELETON LIES IN THE EXACT PLACE THE DATA WAS GOING. It says
 *     "the shape of your content is arriving" — permanently, if the host's
 *     request failed silently. No timeout, no error, no retry: the
 *     placeholder simply outlives the thing it stands in for, and the page
 *     looks like it is still working.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const view = await render(SvSkeletonLoaderComponent, { inputs });
  return { ...view, c: view.fixture.componentInstance };
}

const message = () =>
  (document.querySelector('[data-sv-state="escalation"]') as HTMLElement | null)?.textContent?.trim() ?? null;
const stage = () =>
  document.querySelector('[data-sv-state="escalation"]')?.getAttribute('data-sv-stage') ?? null;
const retryBtn = () => document.querySelector('[data-sv-retry]') as HTMLButtonElement | null;

function tick(view: Awaited<ReturnType<typeof setup>>, ms: number) {
  vi.advanceTimersByTime(ms);
  view.fixture.detectChanges();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('sv-skeleton-loader — escalation is off unless asked for', () => {
  it('stays a plain placeholder forever by default', async () => {
    const view = await setup();
    tick(view, 10 * 60_000);
    expect(message()).toBeNull();
    expect(view.c.waitStage()).toBe('idle');
  });
});

describe('sv-skeleton-loader — a placeholder that outlived its request', () => {
  it('escalates through both thresholds, measured from the same start', async () => {
    const view = await setup({ slowAfterMs: 10_000, stalledAfterMs: 30_000 });

    tick(view, 10_000);
    expect(stage()).toBe('slow');
    expect(message()).toBe('This is taking longer than usual…');

    tick(view, 20_000);
    expect(stage()).toBe('stalled');
    expect(message()).toBe('This content could not be loaded.');
  });

  it('offers a retry once stuck, and only when the host gave it a label', async () => {
    const bare = await setup({ stalledAfterMs: 1_000 });
    tick(bare, 1_000);
    expect(stage()).toBe('stalled');
    expect(retryBtn()).toBeNull();     // no label, no offer — see the input's note

    const view = await setup({ slowAfterMs: 1_000, stalledAfterMs: 5_000, retryLabel: 'Try again' });
    let retried = 0;
    view.c.retry.subscribe(() => retried++);

    tick(view, 1_000);
    expect(retryBtn()).toBeNull();     // slow is not stuck

    tick(view, 4_000);
    retryBtn()!.click();
    expect(retried).toBe(1);
  });

  it('★ keeps one loading region, not two', async () => {
    // ★★ The wrapper is already `role="status"` and already existed when this
    //    text appeared, which is what a live region needs. A second region
    //    inside it would be two voices for one wait — the defect `OF-17-I1`
    //    was about, and the first version of this block was caught by that
    //    rule's own tests.
    const view = await setup({ slowAfterMs: 1_000 });
    tick(view, 1_000);

    const regions = screen.getAllByRole('status');
    expect(regions).toHaveLength(1);
    expect(regions[0].textContent).toContain('This is taking longer than usual…');
  });

  it('reports each escalation once, and never the ordinary wait', async () => {
    // Bound at render: subscribing afterwards misses anything emitted during
    // the first change-detection pass, which is the emission that matters.
    TestBed.resetTestingModule();
    const seen: string[] = [];
    const view = await render(SvSkeletonLoaderComponent, {
      inputs: { slowAfterMs: 1_000, stalledAfterMs: 2_000 },
      on: { escalated: (s: string) => seen.push(s) },
    });
    const h = { ...view, c: view.fixture.componentInstance };

    tick(h, 1_000);
    tick(h, 1_000);
    tick(h, 60_000);

    expect(seen).toEqual(['slow', 'stalled']);
  });

  it('escalates a preset skeleton too, not just a bare bone', async () => {
    // The presets are the ones a host actually reaches for, and they render
    // through a different template branch.
    const view = await setup({ preset: 'table', slowAfterMs: 1_000 });
    tick(view, 1_000);
    expect(message()).toBe('This is taking longer than usual…');
  });
});

describe('sv-skeleton-loader — a host-owned skeleton that offers a retry', () => {
  it('★★ never puts a focusable retry inside an aria-hidden subtree', async () => {
    // ★★ With `[announce]="false"` the wrapper is `aria-hidden` decoration —
    //    right for empty bones, wrong for a button: Tab reaches it and a
    //    screen reader cannot (axe `aria-hidden-focus`).
    const view = await setup({ announce: false, stalledAfterMs: 1_000, retryLabel: 'Try again' });
    const root = (view.fixture.nativeElement as HTMLElement).firstElementChild!;
    expect(root.getAttribute('aria-hidden')).toBe('true');

    tick(view, 1_000);
    const btn = retryBtn()!;
    expect(btn.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBe(btn);
    // Still the host's announcement: no live region appears.
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  it('stays hidden when stalled with no retry on offer', async () => {
    const view = await setup({ announce: false, stalledAfterMs: 1_000 });
    tick(view, 1_000);
    const root = (view.fixture.nativeElement as HTMLElement).firstElementChild!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
  });
});
