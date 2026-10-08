import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvScatterChartComponent, type ScatterSeries } from './scatter-chart.component';

/**
 * ★ The dense scatter plot rendered on the server.
 *
 * The `points` path above `canvasThreshold` paints to an offscreen canvas, which
 * means `document.createElement`, `getContext('2d')` and `toDataURL` — none of
 * which exist during SSR. The component is `standalone` and nothing stops a host
 * putting it in a server-rendered route, so a plot that only works in a browser is
 * a crash waiting for the first SSR build.
 *
 * What must hold instead: the server emits a real plot. The hexagonal bins stay
 * shaded, so the serialized HTML is a correct density picture rather than an empty
 * box, and the element tree is the one the browser will render too — only the fill
 * changes once the raster paints, so hydration has no structural mismatch to
 * reconcile.
 */

/** Enough points to cross both thresholds, seeded so a failure is reproducible. */
function cloud(n: number): ScatterSeries[] {
  let seed = 20260908;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return [{
    name: 'Cloud',
    color: '#6366f1',
    points: Array.from({ length: n }, () => ({ x: random() * 100, y: random() * 100 })),
  }];
}

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvScatterChartComponent, {
    inputs: { series: cloud(400), ...inputs },
    providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
  });
  return { fixture, c: fixture.componentInstance, host: fixture.nativeElement as HTMLElement };
}

describe('SvScatterChartComponent — on the server', () => {
  it('never reaches for a canvas', async () => {
    const { c } = await setup({ renderMode: 'points', canvasThreshold: 100 });
    // The plan is still computed — it is pure — but nothing was painted.
    expect(c.useRaster()).toBe(true);
    expect(c.rasterPlan().length).toBe(400);
    expect(c.rasterHref()).toBeNull();
  });

  it('serializes a density picture rather than an empty box', async () => {
    const { c, host } = await setup({ renderMode: 'points', canvasThreshold: 100 });
    expect(c.binsAreVisible()).toBe(true);
    const hexes = host.querySelectorAll('svg path[role="button"]');
    expect(hexes.length).toBeGreaterThan(0);
    // Shaded, not transparent — the fallback is the picture, not just a hit area.
    expect(hexes[0].getAttribute('class')).toContain('fill-primary-');
    expect(host.querySelector('image')).toBeNull();
  });

  it('draws a small plot as ordinary points', async () => {
    const { c, host } = await setup({ series: cloud(20), renderMode: 'points' });
    expect(c.useRaster()).toBe(false);
    expect(host.querySelectorAll('circle[role="button"]').length).toBe(20);
    expect(host.querySelector('svg path[role="button"]')).toBeNull();
  });

  it('serializes axes drawn from the data', async () => {
    const { host } = await setup({
      series: [{ name: 'Pay', color: '#f00', points: [{ x: 2015, y: 45_000 }, { x: 2024, y: 120_000 }] }],
    });
    expect(host.innerHTML).not.toContain('NaN');
    const labels = [...host.querySelectorAll('svg text')].map(t => t.textContent?.trim());
    expect(labels).toContain('2024');
    expect(labels).toContain('120k');
  });

  it('serializes the summary table, which needs no browser at all', async () => {
    const { host } = await setup({ renderMode: 'bins' });
    expect(host.querySelector('table')).not.toBeNull();
    expect(host.querySelector('caption')?.textContent).toContain('density bins');
  });
});
