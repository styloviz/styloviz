import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvPerformanceChartComponent } from './performance-chart.component';

/**
 * The free twin of `SvPerformanceChartProComponent`, which carries the full
 * spec. What is repeated here is the part that must not drift between the two
 * copies: the downsampler, and the degenerate series sizes that used to put NaN
 * into the path — a defect fixed in both files and worth pinning in both.
 */

async function setup(inputs: Partial<ComponentInput<SvPerformanceChartComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvPerformanceChartComponent, {
    inputs: inputs as ComponentInput<SvPerformanceChartComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

describe('SvPerformanceChartComponent (free)', () => {
  it('generates the number of points it was asked for', async () => {
    const { fixture } = await setup({ options: { pointCount: 250 } });
    expect(fixture.componentInstance.rawData().length).toBe(250);
    expect(fixture.componentInstance.displayData().length).toBe(250);
  });

  it('downsamples a large series to a drawable size', async () => {
    const { fixture } = await setup({ options: { pointCount: 10_000 } });
    const c = fixture.componentInstance;
    expect(c.displayData().length).toBe(1_200);
    expect(c.displayData().every((v) => typeof v === 'number')).toBe(true);
  });

  it('draws a single point at the origin rather than at NaN', async () => {
    const { fixture } = await setup({ options: { pointCount: 1 } });
    expect(fixture.componentInstance.linePath()).not.toContain('NaN');
    expect(fixture.componentInstance.linePath().startsWith('M 0.0,')).toBe(true);
  });

  it('draws nothing for an empty series, and keeps a scale anyway', async () => {
    const { fixture } = await setup({ options: { pointCount: 0 } });
    expect(fixture.componentInstance.linePath()).toBe('');
    expect(fixture.componentInstance.areaPath()).toBe('');
    expect(fixture.componentInstance.yMax()).toBeGreaterThan(0);
  });

  it('puts no NaN into anything it renders', async () => {
    for (const pointCount of [0, 1, 2, 10_000]) {
      const { fixture } = await setup({ options: { pointCount } });
      expect(el(fixture).innerHTML).not.toContain('NaN');
    }
  });

  it('spans the plot from edge to edge', async () => {
    const { fixture } = await setup({ options: { pointCount: 500 } });
    const c = fixture.componentInstance;
    const xs = c.linePath().replace('M ', '').split(' L ').map((p) => Number(p.split(',')[0]));
    expect(xs[0]).toBe(0);
    expect(xs.at(-1)).toBeCloseTo(c.plotW(), 1);
  });

  it('names the plot for a screen reader', async () => {
    const { fixture } = await setup({ title: 'Render benchmark', options: { pointCount: 10 } });
    expect(el(fixture).querySelector('svg[role="img"]')?.getAttribute('aria-label'))
      .toBe('Render benchmark');
  });

  // Must not drift from the Pro twin: the benchmark is opt-in, so an unbound
  // chart has an empty state to show instead of ten thousand random points.
  it('generates nothing unless pointCount asks, and prefers host data', async () => {
    const { fixture: bare } = await setup();
    expect(bare.componentInstance.rawData().length).toBe(0);
    expect(el(bare).querySelector('[data-sv-state="empty"]')).toBeTruthy();

    const { fixture } = await setup({ data: [3, 5, 4], options: { pointCount: 10_000 } });
    expect(fixture.componentInstance.rawData()).toEqual([3, 5, 4]);
    expect(fixture.componentInstance.renderMs()).toBeNull();
  });
});
