import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvProductTourComponent } from './product-tour.component';
import type { TourRouteRequest } from './product-tour.types';
import { flush } from '../../../../src/testing/async';

/**
 * `X-13` / `OF-13-I2` — the free twin's half of route-aware orchestration.
 *
 * The free tier is `modal`-only, so it has no target to re-anchor and no wait
 * to run. What it DOES share is the reason the feature exists: a step whose
 * subject is on another page. So the request half is here, identically, and
 * the wait-and-re-anchor half stays in Pro where the anchored variants live.
 */

async function open(
  inputs: Partial<ComponentInput<SvProductTourComponent>>,
  onRouteRequest: (e: TourRouteRequest) => void,
) {
  TestBed.resetTestingModule();
  const r = await render(SvProductTourComponent, {
    inputs: { active: true, ...inputs } as ComponentInput<SvProductTourComponent>,
    on: { routeRequest: onRouteRequest } as Record<string, (e: never) => void>,
  });
  await flush();
  await flush();
  r.fixture.detectChanges();
  return r;
}

afterEach(() => {
  document.querySelectorAll('body > div').forEach((n) => {
    if (n.querySelector('[role="dialog"]')) n.remove();
  });
});

describe('SvProductTourComponent (free) — (routeRequest)', () => {
  it('asks for the route of the step the tour opens on', async () => {
    const seen: TourRouteRequest[] = [];
    await open({ steps: [{ id: 'a', title: 'A', content: '.', route: '/billing' }] }, (e) =>
      seen.push(e),
    );
    expect(seen).toHaveLength(1);
    expect(seen[0].route).toBe('/billing');
    expect(seen[0].step.id).toBe('a');
  });

  it('stays quiet for a step with no route', async () => {
    const seen: TourRouteRequest[] = [];
    await open({ steps: [{ id: 'a', title: 'A', content: '.' }] }, (e) => seen.push(e));
    expect(seen).toEqual([]);
  });

  it('asks once per arrival, and again on the next routed step', async () => {
    const seen: string[] = [];
    const { fixture } = await open(
      {
        steps: [
          { id: 'a', title: 'A', content: '.', route: '/home' },
          { id: 'b', title: 'B', content: '.' },
          { id: 'c', title: 'C', content: '.', route: '/reports' },
        ],
      },
      (e) => seen.push(e.route),
    );
    const c = fixture.componentInstance;
    fixture.detectChanges();
    expect(seen).toEqual(['/home']);

    c.goNext();
    await flush();
    c.goNext();
    await flush();
    fixture.detectChanges();
    expect(seen).toEqual(['/home', '/reports']);
  });

  it('★ a host that rebuilds its steps array does not re-navigate', async () => {
    // An effect only re-runs when a signal it read has changed, so rendering
    // twice cannot see this. A host whose `[steps]` comes from a getter or a
    // `computed` hands over a fresh array of equal steps on every pass; without
    // the once-per-arrival guard each one re-emits, the host navigates again,
    // and that navigation triggers the next pass.
    const seen: string[] = [];
    const step = { id: 'a', title: 'A', content: '.', route: '/billing' };
    const { fixture } = await open({ steps: [step] }, (e) => seen.push(e.route));
    expect(seen).toEqual(['/billing']);

    fixture.componentRef.setInput('steps', [{ ...step }]);
    await flush();
    fixture.detectChanges();
    expect(seen).toEqual(['/billing']);
  });

  it('treats an empty route as no route', async () => {
    const seen: string[] = [];
    await open({ steps: [{ id: 'a', title: 'A', content: '.', route: '' }] }, (e) =>
      seen.push(e.route),
    );
    expect(seen).toEqual([]);
  });
});
