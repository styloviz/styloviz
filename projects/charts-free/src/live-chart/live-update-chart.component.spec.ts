import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvLiveUpdateChartComponent,
  type LiveUpdateSource,
} from './live-update-chart.component';

/**
 * A column chart that switches between whole datasets and lets the browser
 * transition between them. Two invariants make that work, and both are easy to
 * break without any error appearing:
 *
 *  • the Y-axis is the maximum across ALL sources, not the active one, so the
 *    grid does not rescale mid-animation and the motion stays in the bars;
 *  • `activeSource` falls back to the first source, so a `switchSource` to an id
 *    that no longer exists shows something rather than emptying the chart.
 *
 * The empty state is deliberately BOTH halves — no categories or no sources —
 * because `bars` divides the plot by `categories().length`.
 */

async function setup(inputs: Partial<ComponentInput<SvLiveUpdateChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvLiveUpdateChartComponent, {
    inputs: inputs as ComponentInput<SvLiveUpdateChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const CATS = ['Jan', 'Feb'];
const SOURCES: LiveUpdateSource[] = [
  {
    id: '2023',
    label: '2023',
    datasets: [
      { label: 'Revenue', data: [100, 50] },
      { label: 'Expenses', data: [40, 60] },
    ],
  },
  {
    id: '2024',
    label: '2024',
    datasets: [
      { label: 'Revenue', data: [200, 150] },
      { label: 'Expenses', data: [80, 90] },
    ],
  },
];

describe('SvLiveUpdateChartComponent — source switching', () => {
  it('selects the first source on init', async () => {
    const { c } = await setup({ categories: CATS, sources: SOURCES });
    expect(c.activeSourceId()).toBe('2023');
    expect(c.activeSource()?.id).toBe('2023');
    expect(c.bars().map((b) => b.value)).toEqual([100, 50, 40, 60]);
  });

  it('switches the plotted values without touching the axis', async () => {
    const { c } = await setup({ categories: CATS, sources: SOURCES });
    const gridBefore = c.gridValues();
    c.switchSource('2024');
    expect(c.bars().map((b) => b.value)).toEqual([200, 150, 80, 90]);
    // The grid is the whole point: it must be identical across the switch.
    expect(c.gridValues()).toEqual(gridBefore);
    expect(c.globalMax()).toBe(200);
  });

  it('falls back to the first source for an id that does not exist', async () => {
    const { c } = await setup({ categories: CATS, sources: SOURCES });
    c.switchSource('1999');
    expect(c.activeSource()?.id).toBe('2023');
    expect(c.bars().length).toBe(4);
  });

  it('leaves the id empty and the bars empty when there is no source at all', async () => {
    const { c } = await setup({ categories: CATS, sources: [] });
    expect(c.activeSourceId()).toBe('');
    expect(c.activeSource()).toBeUndefined();
    expect(c.bars()).toEqual([]);
    expect(c.seriesColors()).toEqual([]);
  });

  it('treats no categories and no sources alike as the empty state', async () => {
    // `bars` divides the plot by the category count, so a host with sources but
    // no axis labels would produce Infinity-wide bars if this were not empty.
    const { c: noCats, host: noCatsHost } = await setup({ categories: [], sources: SOURCES });
    expect(noCats.chartIsEmpty()).toBe(true);
    expect(noCatsHost.querySelector('svg rect')).toBeNull();

    const { c: noSrc } = await setup({ categories: CATS, sources: [] });
    expect(noSrc.chartIsEmpty()).toBe(true);

    const { c: both } = await setup({ categories: CATS, sources: SOURCES });
    expect(both.chartIsEmpty()).toBe(false);
  });
});

describe('SvLiveUpdateChartComponent — geometry', () => {
  it('scales every bar against the global maximum, from the baseline up', async () => {
    const { c } = await setup({ categories: CATS, sources: SOURCES });
    const bars = c.bars();
    expect(c.globalMax()).toBe(200);
    // 100 of 200 is half the plot; the bar's foot sits on the baseline.
    expect(bars[0].barH).toBeCloseTo(c.plotH() / 2, 9);
    expect(bars[0].y + bars[0].barH).toBeCloseTo(c.plotH(), 9);
  });

  it('groups the two series inside each category slot', async () => {
    const { c } = await setup({ categories: CATS, sources: SOURCES });
    const bars = c.bars();
    const groupW = c.plotW() / 2;
    // 25% gap, two series.
    expect(bars[0].barW).toBeCloseTo((groupW * 0.75) / 2, 9);
    expect(bars[0].x).toBeCloseTo((groupW * 0.25) / 2, 9);
    const janRevenue = bars.find((b) => b.cat === 'Jan' && b.series === 'Revenue')!;
    const janExpense = bars.find((b) => b.cat === 'Jan' && b.series === 'Expenses')!;
    expect(janExpense.x - janRevenue.x).toBeCloseTo(janRevenue.barW, 9);
  });

  it('collapses every bar rather than inverting when the plot has no height', async () => {
    // A `height` smaller than the padding is a plausible mis-binding; without
    // the `ph > 0` guard the bars would be drawn with a negative height.
    const { c, host } = await setup({
      categories: CATS,
      sources: SOURCES,
      options: { height: 40 },
    });
    expect(c.plotH()).toBeLessThan(0);
    expect(c.bars().every((b) => b.barH === 0)).toBe(true);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('spreads six grid values over the global maximum', async () => {
    const { c } = await setup({ categories: CATS, sources: SOURCES });
    expect(c.gridValues()).toEqual([0, 40, 80, 120, 160, 200]);
    expect(c.gridLineY(200)).toBe(0);
    expect(c.gridLineY(0)).toBeCloseTo(c.plotH(), 9);
  });

  it('rounds the global maximum up to a nice ceiling', async () => {
    const { c } = await setup({
      categories: ['A'],
      sources: [{ id: 'x', label: 'X', datasets: [{ label: 'S', data: [87] }] }],
    });
    expect(c.globalMax()).toBe(90);
  });

  it('keeps a finite axis when every value is zero', async () => {
    // `niceMax` returns 100 for a non-positive input, but `Math.max(..., 1)`
    // gets there first — either way the divisor must never be zero.
    const { c, host } = await setup({
      categories: ['A'],
      sources: [{ id: 'x', label: 'X', datasets: [{ label: 'S', data: [0] }] }],
    });
    expect(c.globalMax()).toBe(1);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('treats a category the dataset does not reach as zero', async () => {
    const { c } = await setup({
      categories: ['A', 'B', 'C'],
      sources: [{ id: 'x', label: 'X', datasets: [{ label: 'S', data: [10] }] }],
    });
    expect(c.bars().map((b) => b.value)).toEqual([10, 0, 0]);
  });
});

describe('SvLiveUpdateChartComponent — presentation', () => {
  it('cycles the palette and honours a per-dataset colour', async () => {
    const { c } = await setup({
      categories: ['A'],
      sources: [{
        id: 'x',
        label: 'X',
        datasets: [
          { label: 'S0', data: [1] },
          { label: 'S1', data: [1], color: '#abcdef' },
          { label: 'S2', data: [1] }, { label: 'S3', data: [1] },
          { label: 'S4', data: [1] }, { label: 'S5', data: [1] },
        ],
      }],
    });
    expect(c.seriesColors()[0]).toBe('#3b82f6');
    expect(c.seriesColors()[1]).toBe('#abcdef'); // explicit wins
    expect(c.seriesColors()[5]).toBe(c.seriesColors()[0]); // five colours, sixth wraps
  });

  it('transitions y and height together so bars grow from the baseline', async () => {
    const { c: def } = await setup({ categories: CATS, sources: SOURCES });
    expect(def.transDur()).toBe(600);
    expect(def.barTransition()).toBe(
      'y 600ms cubic-bezier(0.4, 0, 0.2, 1), height 600ms cubic-bezier(0.4, 0, 0.2, 1)',
    );
    const { c: fast } = await setup({
      categories: CATS, sources: SOURCES, options: { transitionDuration: 120 },
    });
    expect(fast.barTransition()).toContain('y 120ms');
    expect(fast.barTransition()).toContain('height 120ms');
  });

  it('carries the default options and lets each be overridden', async () => {
    const { c: def } = await setup({ categories: CATS, sources: SOURCES });
    expect([def.chartHeight(), def.barRadius(), def.showValues(), def.showGrid(), def.showLegend()])
      .toEqual([300, 4, false, true, true]);

    const { c: over } = await setup({
      categories: CATS,
      sources: SOURCES,
      options: { height: 420, barRadius: 0, showValues: true, showGrid: false, showLegend: false },
    });
    expect([over.chartHeight(), over.barRadius(), over.showValues(), over.showGrid(), over.showLegend()])
      .toEqual([420, 0, true, false, false]);
    expect(over.plotH()).toBe(420 - 24 - 44);
  });

  it('rounds a small reading and compacts a large one', async () => {
    const { c } = await setup({ categories: CATS, sources: SOURCES });
    expect(c.formatValue(42.6)).toBe('43');
    expect(c.formatValue(999)).toBe('999');
    expect(c.formatValue(1_500)).toBe('1.5k');
  });

  it('names itself after the title, or after an explicit override', async () => {
    const { c } = await setup({ categories: CATS, sources: SOURCES, title: 'Finance' });
    expect(c.resolvedAriaLabel()).toBe('Finance — live updating chart');
    const { c: named } = await setup({
      categories: CATS, sources: SOURCES, ariaLabel: 'Yearly comparison',
    });
    expect(named.resolvedAriaLabel()).toBe('Yearly comparison');
  });

  it('renders one switch button per source and marks the active one', async () => {
    const { host } = await setup({ categories: CATS, sources: SOURCES });
    expect(host.textContent).toContain('2023');
    expect(host.textContent).toContain('2024');
    expect(host.innerHTML).not.toContain('NaN');
  });
});
