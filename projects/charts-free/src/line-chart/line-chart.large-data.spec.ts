import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvLineChartComponent } from './line-chart.component';

/**
 * FL-C10 — `renderer="large-data"`, the line chart mode that replaced
 * `sv-performance-chart`. It must draw the OUTLINE of a long series (every peak
 * and trough survives), not every Nth point, and it must say what it left out.
 */

type AnyInputs<C> = Partial<ComponentInput<C>>;

async function mount<C>(cmp: Type<C>, inputs: AnyInputs<C>) {
  TestBed.resetTestingModule();
  const r = await render(cmp, { inputs: inputs as ComponentInput<C> });
  return { c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const N = 10_000;
const CATS = Array.from({ length: N }, (_, i) => `#${i + 1}`);
const DATA: (number | null)[] = Array.from({ length: N }, (_, i) => 500 + Math.round(100 * Math.sin(i / 40)));
DATA[4_321] = 2_000; // a spike an every-Nth-point sample would lose
DATA[6_000] = null;  // a gap the line must still break at
const SERIES = [{ label: 'Sensor', data: DATA }];

const vertices = (d: string) => (d.match(/[ML]/g) ?? []).length;
const linePath = (host: HTMLElement) =>
  [...host.querySelectorAll('svg path[fill="none"]')].map((p) => p.getAttribute('d') ?? '').sort((a, b) => b.length - a.length)[0];

describe('SvLineChartComponent — renderer="large-data"', () => {
  it('draws far fewer vertices than readings, and keeps the spike', async () => {
    const { c, host } = await mount(SvLineChartComponent, { categories: CATS, series: SERIES, renderer: 'large-data', options: { animated: false } });
    const d = linePath(host);
    expect(vertices(d)).toBeLessThan(1_200);
    expect(c.keptIndices()?.has(4_321)).toBe(true);
    // The spike's y is the top of the plot area (the axis max is its value, rounded up).
    const ys = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeLessThan(c.yForValue(1_000));
  });

  it('still breaks the line at the gap', async () => {
    const { host } = await mount(SvLineChartComponent, { categories: CATS, series: SERIES, renderer: 'large-data', options: { animated: false } });
    expect((linePath(host).match(/M/g) ?? []).length).toBe(2);
  });

  it('turns markers off, thins the x labels, and says what it drew', async () => {
    const { c, host } = await mount(SvLineChartComponent, { categories: CATS, series: SERIES, renderer: 'large-data' });
    expect(host.querySelectorAll('svg circle').length).toBe(0);
    expect(c.xLabelIndices().length).toBeLessThanOrEqual(9);
    const note = c.decimationNote()!;
    expect(note).toContain('10,000');
    expect(host.textContent).toContain(note);
    // The screen-reader table lists the drawn readings, not all ten thousand.
    expect(host.querySelectorAll('table tbody tr').length).toBe(c.keptIndices()!.size);
  });

  it('draws every reading when the series is short enough', async () => {
    const { c, host } = await mount(SvLineChartComponent, {
      categories: ['A', 'B', 'C'], series: [{ label: 'S', data: [1, 2, 3] }], renderer: 'large-data',
    });
    expect(c.keptIndices()).toBeNull();
    expect(c.decimationNote()).toBeNull();
    expect(host.querySelectorAll('table tbody tr').length).toBe(3);
  });

  it('changes nothing in the standard renderer', async () => {
    const { c, host } = await mount(SvLineChartComponent, { categories: CATS.slice(0, 50), series: [{ label: 'S', data: DATA.slice(0, 50) }] });
    expect(c.keptIndices()).toBeNull();
    expect(c.xLabelIndices().length).toBe(50);
    expect(host.querySelectorAll('svg circle').length).toBe(50);
  });
});
