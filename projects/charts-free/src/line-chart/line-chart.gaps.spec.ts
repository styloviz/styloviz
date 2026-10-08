import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvLineChartComponent } from './line-chart.component';
import { SvStripLineChartComponent } from './strip-line-chart.component';
import { SvTrendLineChartComponent } from './trend-line-chart.component';

/**
 * CH-07-I3 — a gap reads as a gap everywhere a reader can meet it.
 *
 * The core line chart already broke its line at a `null`. What it still did
 * was print that gap as a READING: the data table and the tooltip took
 * `data[i] ?? 0`, so `null` said "0" (a measurement nobody took) and `NaN`
 * said "NaN". Strip-line and trend-line had no gap handling at all — their
 * axis came from `Math.max(...data)`, so one `NaN` made every y `NaN` and the
 * whole chart vanished without an error.
 */

type AnyInputs<C> = Partial<ComponentInput<C>>;

async function mount<C>(cmp: Type<C>, inputs: AnyInputs<C>) {
  TestBed.resetTestingModule();
  const r = await render(cmp, { inputs: inputs as ComponentInput<C> });
  return { fixture: r.fixture, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

/** Pin the SVG box to its viewBox so mouse coordinates map 1:1. */
function hoverAt(host: HTMLElement, clientX: number, clientY: number, width = 600, height = 300) {
  const svg = host.querySelector('svg')!;
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }) as DOMRect;
  svg.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true }));
}

/** Every numeric token in a `d` attribute, for NaN / Infinity screening. */
const numbersIn = (d: string) => d.match(/-?\d+(\.\d+)?|NaN|Infinity/g) ?? [];

const CATS = ['Jan', 'Feb', 'Mar', 'Apr'];

describe('SvLineChartComponent — a gap in the table and tooltip', () => {
  const SERIES = [{ label: 'Users', data: [10, null, Number.NaN, 40] }];

  it('prints "No reading" in the data table for null and NaN, never "0" or "NaN"', async () => {
    const { host } = await mount(SvLineChartComponent, { categories: CATS, series: SERIES });
    const cells = [...host.querySelectorAll('table td')].map((td) => td.textContent?.trim());
    expect(cells).toEqual(['10', 'No reading', 'No reading', '40']);
  });

  it('carries the gap into the tooltip as null and prints it as "No reading"', async () => {
    const { c, host, fixture } = await mount(SvLineChartComponent, { categories: CATS, series: SERIES });
    // PAD.left = 56, plotW = 520 → category 2 (the NaN) sits at 56 + 2·520/3.
    hoverAt(host, 56 + (2 * 520) / 3, 100);
    fixture.detectChanges();
    expect(c.tooltip().catIndex).toBe(2);
    expect(c.tooltip().items.map((i) => i.value)).toEqual([null]);
    const tip = [...host.querySelectorAll('svg text')].map((t) => t.textContent ?? '').join(' ');
    expect(tip).toContain('Users: No reading');
    expect(tip).not.toContain('NaN');
  });

  it('still prints a real zero as 0', async () => {
    const { c } = await mount(SvLineChartComponent, { categories: CATS, series: [{ label: 'Users', data: [0, 1, 2, 3] }] });
    expect(c.cellValue(0, 0)).toBe('0');
  });
});

describe('SvStripLineChartComponent — gaps', () => {
  const GAPPY = [{ label: 'p99', data: [120, Number.NaN, null, 200, 300], fill: true }];
  const CATS5 = ['a', 'b', 'c', 'd', 'e'];

  it('keeps the axis finite when a reading is NaN — one NaN used to blank the chart', async () => {
    const { c } = await mount(SvStripLineChartComponent, { categories: CATS5, series: GAPPY });
    expect(c.rawMax()).toBe(300);
    expect(c.rawMin()).toBe(0);
    expect(Number.isFinite(c.yForValue(120))).toBe(true);
  });

  it('breaks the line and the fill at the gap instead of joining across it', async () => {
    const { c, host } = await mount(SvStripLineChartComponent, { categories: CATS5, series: GAPPY });
    const d = c.seriesPath(0);
    expect(numbersIn(d)).not.toContain('NaN');
    // Two runs: [0] alone and [3, 4] — two subpaths, the second starting at x(3).
    expect(d.match(/M /g)?.length).toBe(2);
    expect(d).toContain(`M ${c.xForIndex(3).toFixed(1)} `);
    expect(c.fillPath(0).match(/Z/g)?.length).toBe(2);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('draws no dot at a gap', async () => {
    const { c } = await mount(SvStripLineChartComponent, { categories: CATS5, series: GAPPY });
    expect(c.dots()[0].map((d) => d.value)).toEqual([120, 200, 300]);
  });

  it('says the gap is a gap in the tooltip and names it in the notice', async () => {
    const { c, host, fixture } = await mount(SvStripLineChartComponent, { categories: CATS5, series: GAPPY });
    // PAD.left = 54, plotW = 522 → category 1 at 54 + 522/4.
    hoverAt(host, 54 + 522 / 4, 100);
    fixture.detectChanges();
    expect(c.tooltip().items.map((i) => i.value)).toEqual([null]);
    expect(host.textContent).toContain('p99: No reading');
    expect(c.gapNote()).toContain('2 readings missing');
    expect(host.textContent).toContain('2 readings missing');
  });

  it('has no notice when nothing is missing', async () => {
    const { c } = await mount(SvStripLineChartComponent, { categories: CATS, series: [{ label: 's', data: [1, 2, 3, 4] }] });
    expect(c.gapNote()).toBeNull();
  });
});

describe('SvTrendLineChartComponent — gaps', () => {
  const CATS5 = ['a', 'b', 'c', 'd', 'e'];
  /** y = 10x + 10 with the reading at x = 2 missing. */
  const GAPPY = [{ label: 'Sales', data: [10, 20, Number.NaN, 40, 50], showLine: true }];

  it('keeps the axis finite and fits only the readings that exist', async () => {
    const { c } = await mount(SvTrendLineChartComponent, { categories: CATS5, series: GAPPY });
    expect(c.rawMax()).toBe(50);
    const [tp] = c.trendPaths();
    // The remaining four points are still exactly linear.
    expect(tp.r2).toBeCloseTo(1, 10);
    expect(numbersIn(tp.path)).not.toContain('NaN');
  });

  it('treats null the same as NaN', async () => {
    const { c } = await mount(SvTrendLineChartComponent, {
      categories: CATS5,
      series: [{ label: 'Sales', data: [10, 20, null, 40, 50] }],
    });
    expect(c.trendPaths()[0].r2).toBeCloseTo(1, 10);
  });

  it('draws no dot at the gap and keeps each dot on its own category', async () => {
    const { c, host } = await mount(SvTrendLineChartComponent, { categories: CATS5, series: GAPPY });
    const dots = c.dots()[0];
    expect(dots.map((d) => d.ci)).toEqual([0, 1, 3, 4]);
    expect(dots[2].x).toBe(c.xForIndex(3));
    const titles = [...host.querySelectorAll('circle title')].map((t) => t.textContent?.trim());
    expect(titles).toContain('d: 40');
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('breaks the connecting line at the gap', async () => {
    const { c } = await mount(SvTrendLineChartComponent, { categories: CATS5, series: GAPPY });
    const d = c.linePath(0);
    expect(d.match(/M /g)?.length).toBe(2);
    expect(numbersIn(d)).not.toContain('NaN');
  });

  it('averages a moving window over the readings that exist, not over a zero', async () => {
    const { c } = await mount(SvTrendLineChartComponent, {
      categories: CATS5,
      series: [{ label: 'Flat', data: [30, 30, null, 30, 30] }],
      trends: [{ type: 'moving-average' }],
    });
    c.setTrendType('moving-average');
    const ys = new Set(numbersIn(c.trendPaths()[0].path).filter((_, i) => i % 2 === 1));
    expect([...ys]).toEqual([c.yForValue(30).toFixed(1)]);
  });

  it('draws nothing to fit when fewer than two readings exist', async () => {
    const { c } = await mount(SvTrendLineChartComponent, {
      categories: CATS5,
      series: [{ label: 'S', data: [null, 5, null, null, Number.NaN] }],
    });
    expect(c.trendPaths()[0].path).toBe('');
    expect(c.gapNote()).toContain('4 readings missing');
  });
});

describe('SvLineChartComponent — markers past a gap belong to their own category', () => {
  /**
   * ★ Skipping a gap made a marker's position in the dots array differ from its
   *   category. The template compared the hovered category with that position,
   *   so hovering Apr (after a gap at Feb) enlarged the marker on May instead,
   *   and the markers were tracked by x — which in the inversed layout is the
   *   VALUE, so two equal readings collided (NG0955).
   */
  const CATS5 = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];

  it('enlarges the marker at the hovered category, not the next one', async () => {
    const { c, host, fixture } = await mount(SvLineChartComponent, {
      categories: CATS5,
      series: [{ label: 'Users', data: [10, null, 30, 40, 50] }],
    });
    // PAD.left = 56, plotW = 520 → Apr (index 3) sits at 56 + 3·520/4.
    hoverAt(host, 56 + (3 * 520) / 4, 100);
    fixture.detectChanges();
    expect(c.tooltip().catIndex).toBe(3);
    const big = [...host.querySelectorAll('circle')].filter((el) => el.getAttribute('r') === '5.5');
    expect(big.map((el) => Number(el.getAttribute('cx')))).toEqual([c.xForIndex(3)]);
  });

  it('keeps each marker on its own category', async () => {
    const { c } = await mount(SvLineChartComponent, {
      categories: CATS5,
      series: [{ label: 'Users', data: [10, null, 30, 40, 50] }],
    });
    expect(c.dots(0).map((d) => d.ci)).toEqual([0, 2, 3, 4]);
  });

  it('draws equal readings in the inversed layout without a duplicate-track error', async () => {
    const spies = [vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')].map((s) =>
      s.mockImplementation(() => undefined),
    );
    try {
      const { c, host } = await mount(SvLineChartComponent, {
        categories: CATS5,
        chartType: 'inversed',
        series: [{ label: 'Flat', data: [20, 20, null, 20, 20] }],
        options: { showDataLabels: true },
      });
      expect(c.dotsInv(0).map((d) => d.ci)).toEqual([0, 1, 3, 4]);
      expect(host.querySelectorAll('circle').length).toBeGreaterThanOrEqual(4);
      const logged = spies.flatMap((s) => s.mock.calls.flat().map(String)).join(' ');
      expect(logged).not.toContain('NG0955');
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});

describe('SvLineChartComponent — stacked-percent prints the reading, not a share', () => {
  it('prints a raw reading in the table without a percent sign', async () => {
    const { host } = await mount(SvLineChartComponent, {
      categories: ['Q1', 'Q2'],
      chartType: 'stacked-percent',
      series: [
        { label: 'A', data: [1200, 300] },
        { label: 'B', data: [800, null] },
      ],
    });
    const cells = [...host.querySelectorAll('table td')].map((td) => td.textContent?.trim());
    expect(cells).toEqual(['1.2k', '800', '300', 'No reading']);
    expect(cells.join(' ')).not.toContain('%');
  });
});

describe('SvLineChartComponent — a reading with a gap on both sides', () => {
  /**
   * ★ A run of one reading was drawn as a bare `M x y`, which paints nothing.
   *   With dots off, a real reading between two gaps disappeared from the chart
   *   while the table still listed it. A zero-length segment takes the round
   *   line cap and shows it as a dot the width of the line.
   */
  const CATS5 = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
  const LONELY = [{ label: 'Users', data: [10, null, 30, null, 50] }];

  for (const chartType of ['line', 'spline'] as const) {
    it(`draws an isolated reading as a visible cap (${chartType})`, async () => {
      const { host } = await mount(SvLineChartComponent, {
        categories: CATS5,
        series: LONELY,
        chartType,
        options: { showDots: false },
      });
      const d = [...host.querySelectorAll('path[stroke-linecap="round"]')]
        .map((p) => p.getAttribute('d') ?? '')
        .find((v) => (v.match(/M /g) ?? []).length === 3);
      expect(d, 'one line path with three runs').toBeTruthy();
      expect(d!.match(/h 0/g)).toHaveLength(3);
      expect(host.querySelectorAll('circle').length).toBe(0);
    });
  }

  it('draws an isolated reading in the step layout too', async () => {
    const { c } = await mount(SvLineChartComponent, { categories: CATS5, series: LONELY });
    expect(c.buildStepPath([10, null, 30, 40, null]).startsWith(`M ${c.xForIndex(0)} ${c.yForValue(10)} h 0`)).toBe(true);
  });
});

describe('SvStripLineChartComponent — a reading with a gap on both sides', () => {
  it('draws it as a zero-length segment rather than a bare move', async () => {
    const { c } = await mount(SvStripLineChartComponent, {
      categories: ['a', 'b', 'c', 'd', 'e'],
      series: [{ label: 'p99', data: [120, null, 200, null, 300] }],
      options: { showDots: false },
    });
    expect(c.seriesPath(0).match(/h 0/g)).toHaveLength(3);
  });
});
