import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvRangeColumnChartComponent,
  type RangeChartDataset,
} from './range-column-chart.component';

/**
 * A floating column: the bar does not start at the axis, it spans `low` → `high`.
 * That makes three things interesting that a normal column chart never meets.
 *
 *  • The axis is sized from the HIGHS only, so a `low` above the nice-max would
 *    place a bar above the plot — and a `low` greater than its own `high` would
 *    invert the bar.
 *  • `low === high` is a zero-height bar. It is a real reading (a day with no
 *    spread), and it must stay visible rather than collapsing to nothing.
 *  • The corner radius is rounded on ALL FOUR corners, so it has to be clamped
 *    against the bar's own height as well as its width.
 */

async function setup(inputs: Partial<ComponentInput<SvRangeColumnChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvRangeColumnChartComponent, {
    inputs: inputs as ComponentInput<SvRangeColumnChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

/** Pin the SVG box to its viewBox so mouse coordinates map 1:1. */
function pinLayout(host: HTMLElement, width: number, height: number) {
  const svg = host.querySelector('svg')!;
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }) as DOMRect;
}

const CATS = ['Mon', 'Tue', 'Wed'];
const SETS: RangeChartDataset[] = [
  {
    label: 'Temperature',
    data: [
      { low: 10, high: 20 },
      { low: 5, high: 25 },
      { low: 40, high: 40 },
    ],
  },
];

describe('SvRangeColumnChartComponent — the floating bar', () => {
  it('spans low to high instead of rising from the axis', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    const bars = c.rangeBars();
    expect(c.axisMax()).toBe(40);
    // A bar's top is its high, its bottom is its low.
    expect(bars[0].y).toBeCloseTo(c.gridLineY(20), 9);
    expect(bars[0].y + bars[0].barH).toBeCloseTo(c.gridLineY(10), 9);
    expect(bars[1].barH).toBeCloseTo(bars[0].barH * 2, 9); // a 20-wide range vs a 10
  });

  it('keeps a zero-width range visible as a 2px sliver', async () => {
    // low === high is a real reading. Collapsing it to zero height would make
    // that category simply disappear from the chart.
    const { c } = await setup({ categories: CATS, datasets: SETS });
    const flat = c.rangeBars()[2];
    expect(flat.low).toBe(40);
    expect(flat.high).toBe(40);
    expect(flat.barH).toBe(2);
    expect(c.floatBarPath(flat.x, flat.y, flat.barW, flat.barH, 4)).not.toBe('');
  });

  it('leaves out a bar whose low exceeds its high instead of inverting it', async () => {
    // ★ This used to pin a 2px sliver at the high — a reading the data does not
    //   support, drawn with no word. The value policy (CH-01-M1) omits it and
    //   counts it under the plot instead.
    const { c, host } = await setup({
      categories: ['Bad'],
      datasets: [{ label: 'X', data: [{ low: 90, high: 10 }] }],
    });
    expect(c.rangeBars()).toEqual([]);
    expect(host.textContent).toContain('1 range not shown');
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('sizes the axis from the highs and rounds it up', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'X', data: [{ low: 1, high: 87 }, { low: 2, high: 3 }, { low: 0, high: 0 }] }],
    });
    expect(c.axisMax()).toBe(90);
    expect(c.gridValues()).toEqual([0, 18, 36, 54, 72, 90]);
    expect(c.gridLineY(0)).toBeCloseTo(c.plotH(), 9);
    expect(c.gridLineY(90)).toBe(0);
  });

  it('keeps a finite axis when every high is zero', async () => {
    const { c, host } = await setup({
      categories: ['A'],
      datasets: [{ label: 'X', data: [{ low: 0, high: 0 }] }],
    });
    expect(c.axisMax()).toBe(1);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('treats a category the series does not reach as a zero range', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Short', data: [{ low: 1, high: 5 }] }],
    });
    const bars = c.rangeBars();
    expect(bars.map((b) => [b.low, b.high])).toEqual([[1, 5], [0, 0], [0, 0]]);
    expect(bars.every((b) => Number.isFinite(b.y))).toBe(true);
  });

  it('splits the group between series and centres it', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [
        { label: 'A', data: [{ low: 1, high: 2 }] },
        { label: 'B', data: [{ low: 1, high: 2 }] },
      ],
      options: { barGap: 0.5 },
    });
    const groupW = c.plotW() / 3;
    const bars = c.rangeBars();
    expect(bars[0].barW).toBeCloseTo(groupW / 4, 9);
    const a = bars.find((b) => b.cat === 'Mon' && b.series === 'A')!;
    const b = bars.find((b) => b.cat === 'Mon' && b.series === 'B')!;
    expect(b.x - a.x).toBeCloseTo(a.barW, 9);
    expect(a.x).toBeCloseTo((groupW * 0.5) / 2, 9);
  });

  it('draws nothing when either axis has no entries', async () => {
    const { c: noCats } = await setup({ categories: [], datasets: SETS });
    expect(noCats.rangeBars()).toEqual([]);
    const { c: noSets } = await setup({ categories: CATS, datasets: [] });
    expect(noSets.rangeBars()).toEqual([]);
    expect(noSets.chartIsEmpty()).toBe(true);
  });
});

describe('SvRangeColumnChartComponent — the path', () => {
  it('rounds all four corners and clamps the radius to the bar', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    const d = c.floatBarPath(0, 0, 10, 6, 40);
    expect((d.match(/Q /g) ?? []).length).toBe(4);
    // 40 clamps to min(w/2, h/2) = 3.
    expect(d.startsWith('M 3 0')).toBe(true);
    expect(d).not.toContain('NaN');
  });

  it('draws no path for a degenerate box', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    expect(c.floatBarPath(0, 0, 0, 10, 4)).toBe('');
    expect(c.floatBarPath(0, 0, 10, 0, 4)).toBe('');
    expect(c.floatBarPath(0, 0, -1, -1, 4)).toBe('');
  });
});

describe('SvRangeColumnChartComponent — chrome', () => {
  it('describes its own shape', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS, title: 'Weather' });
    expect(c.resolvedAriaLabel()).toBe(
      'Weather: 1 series (Temperature) across 3 categories.',
    );
  });

  it('says "category" for one, and names nothing when the series is unlabelled', async () => {
    const { c } = await setup({
      categories: ['Only'],
      datasets: [{ label: '', data: [{ low: 1, high: 2 }] }],
    });
    expect(c.resolvedAriaLabel()).toBe('Range column chart: 1 series across 1 category.');
  });

  it('falls back to the bare title when there is nothing plotted', async () => {
    const { c } = await setup({ categories: [], datasets: [], title: 'Weather' });
    expect(c.resolvedAriaLabel()).toBe('Weather');
  });

  it('prefers an explicit aria-label', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS, ariaLabel: 'Daily spread' });
    expect(c.resolvedAriaLabel()).toBe('Daily spread');
  });

  it('emits an animation duration only when one is configured', async () => {
    const { c: none } = await setup({ categories: CATS, datasets: SETS });
    expect(none.animDuration()).toBeNull();
    const { c: set } = await setup({ categories: CATS, datasets: SETS, options: { animationDuration: 250 } });
    expect(set.animDuration()).toBe('250ms');
  });

  it('carries the default toggles and lets each be flipped', async () => {
    const { c: def } = await setup({ categories: CATS, datasets: SETS });
    expect([def.showGrid(), def.showLabels(), def.showLegend(), def.showValues()])
      .toEqual([true, true, true, false]);
    const { c: off } = await setup({
      categories: CATS,
      datasets: SETS,
      options: { showGrid: false, showLabels: false, showLegend: false, showValues: true },
    });
    expect([off.showGrid(), off.showLabels(), off.showLegend(), off.showValues()])
      .toEqual([false, false, false, true]);
  });

  it('grows the tooltip box with the number of rows in it', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    expect(c.tooltipH()).toBe(36); // nothing hovered yet
    pinLayout(host, 600, 320);
    host.querySelectorAll('path[d]')[0]
      .dispatchEvent(new MouseEvent('mouseenter', { clientX: 100, clientY: 100, bubbles: true }));
    expect(c.tooltipH()).toBe(36 + 2 * 18); // a high row and a low row
  });

  it('formats a compact value and passes a string through', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    expect(c.formatValue(12_500)).toBe('13k');
    expect(c.formatValue('—')).toBe('—');
  });
});

describe('SvRangeColumnChartComponent — tooltip', () => {
  it('lists the high and the low of the hovered bar', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    // jsdom has no layout, so the box is stubbed: what is under test is the
    // viewBox scaling, not a measurement.
    pinLayout(host, 600, 320);
    host.querySelectorAll('path[d]')[1]
      .dispatchEvent(new MouseEvent('mouseenter', { clientX: 200, clientY: 150, bubbles: true }));

    expect(c.tooltip().visible).toBe(true);
    expect(c.tooltip().label).toBe('Tue');
    expect(c.tooltip().items).toEqual([
      { color: '#3b82f6', series: 'Temperature — High', value: 25 },
      { color: '#3b82f6', series: 'Temperature — Low', value: 5 },
    ]);
    expect(c.tooltip().x).toBe(200);
    expect(c.tooltip().y).toBe(74);
  });

  it('keeps the tooltip inside the chart on both axes', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    pinLayout(host, 600, 320);
    const bar = host.querySelectorAll('path[d]')[0];
    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 599, clientY: 10, bubbles: true }));
    expect(c.tooltip().x).toBe(600 - 160);
    expect(c.tooltip().y).toBe(8);
  });

  it('hides on leave', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    pinLayout(host, 600, 320);
    const bar = host.querySelectorAll('path[d]')[0];
    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 100, clientY: 100, bubbles: true }));
    bar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(c.tooltip().visible).toBe(false);
  });
});
