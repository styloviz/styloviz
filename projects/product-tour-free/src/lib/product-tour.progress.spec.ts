import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvProductTourComponent } from './product-tour.component';
import {
  SV_TOUR_PROGRESS_KIND,
  svSerializeTourProgress,
  svRestoreTourProgress,
  type SvTourProgress,
  type SvTourProgressRestored,
} from './product-tour.progress';
import type { TourStep } from './product-tour.types';
import { flush } from '../../../../src/testing/async';

/**
 * `X-12` / `OF-13-I6` / `OF-13-M4` — the free twin.
 *
 * Resume is not a premium feature: the free `modal` tour is the one most
 * likely to be interrupted by a reload. What the free tier has no use for is
 * the checklist ticks, and the interesting case there is that it must not
 * DELETE the ones a Pro build stored under the same key.
 */

const STEPS: TourStep[] = [
  { id: 'welcome', title: 'One', content: '.' },
  { id: 'filters', title: 'Two', content: '.' },
  { id: 'export', title: 'Three', content: '.' },
];

const KEY = 'sv-test-tour-progress-free';

function store(progress: Partial<SvTourProgress> = {}): void {
  localStorage.setItem(
    KEY,
    JSON.stringify(
      svSerializeTourProgress({
        tourId: 'onboarding',
        tourVersion: 1,
        stepId: 'filters',
        completedIds: [],
        status: 'active',
        ...progress,
      }),
    ),
  );
}

function stored(): SvTourProgress | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const result = svRestoreTourProgress(JSON.parse(raw));
  return result.ok ? result.state : null;
}

async function open(
  inputs: Partial<ComponentInput<SvProductTourComponent>> = {},
  on: { progressRestored?: (e: SvTourProgressRestored) => void } = {},
) {
  TestBed.resetTestingModule();
  const r = await render(SvProductTourComponent, {
    inputs: {
      steps: STEPS,
      active: true,
      tourId: 'onboarding',
      persistKey: KEY,
      ...inputs,
    } as ComponentInput<SvProductTourComponent>,
    on: on as Record<string, (e: never) => void>,
  });
  await flush();
  r.fixture.detectChanges();
  return r;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  localStorage.clear();
  document.querySelectorAll('body > div').forEach((n) => {
    if (n.querySelector('[role="dialog"]')) n.remove();
  });
});

describe('SvProductTourComponent (free) — progress', () => {
  it('writes a versioned envelope', async () => {
    await open();
    const raw = JSON.parse(localStorage.getItem(KEY)!);
    expect(raw.kind).toBe(SV_TOUR_PROGRESS_KIND);
    expect(raw.state.stepId).toBe('welcome');
  });

  it('resumes on the stored step', async () => {
    store({ stepId: 'export' });
    const { fixture } = await open();
    expect(fixture.componentInstance.stepIndex()).toBe(2);
  });

  it('restarts when the stored step is gone, and says why', async () => {
    store({ stepId: 'removed' });
    const seen: SvTourProgressRestored[] = [];
    const { fixture } = await open({}, { progressRestored: (e) => seen.push(e) });
    expect(fixture.componentInstance.stepIndex()).toBe(0);
    expect(seen[0].reason).toBe('step-missing');
  });

  it('records a skip as dismissed', async () => {
    const { fixture } = await open();
    fixture.componentInstance.skipTour();
    await flush();
    expect(stored()?.status).toBe('dismissed');
  });

  it('★ carries a Pro build’s checklist ticks instead of erasing them', async () => {
    // The free tier has no checklist, but writing an empty array would delete
    // what a Pro build stored under this key: "downgrade for one session, lose
    // your checklist" is not a thing a saved record should do.
    store({ completedIds: ['welcome', 'export'] });
    const { fixture } = await open();
    fixture.componentInstance.goNext();
    await flush();
    expect([...(stored()?.completedIds ?? [])].sort()).toEqual(['export', 'welcome']);
  });

  it('ignores another tour’s progress under a reused key', async () => {
    store({ tourId: 'other', stepId: 'export' });
    const { fixture } = await open();
    expect(fixture.componentInstance.stepIndex()).toBe(0);
  });
});
