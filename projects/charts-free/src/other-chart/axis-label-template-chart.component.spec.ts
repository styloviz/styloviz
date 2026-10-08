import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvAxisLabelTemplateChartComponent,
  type AxisLabelBarEvent,
  type AxisLabelCategory,
  type AxisLabelTemplateDataset,
} from './axis-label-template-chart.component';

/**
 * A grouped column chart whose X-axis categories are objects, not strings: each
 * carries an optional icon, colour swatch and sub-label. That is the whole point
 * of the component, and it means every accessor that reaches for a category has
 * to survive an index that no longer exists — a `catIdx` captured before the
 * category list shortened is exactly what a filtered dashboard produces.
 *
 * The other sharp edge is `xStep`, which guards `categories().length` against
 * zero. `bars` returns early for an empty category list, but `catX` does not.
 */

async function setup(inputs: Partial<ComponentInput<SvAxisLabelTemplateChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvAxisLabelTemplateChartComponent, {
    inputs: inputs as ComponentInput<SvAxisLabelTemplateChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

/** Pin the SVG box to its viewBox so mouse coordinates map 1:1. */
function pinLayout(host: HTMLElement, width: number, height: number) {
  const svg = host.querySelector('svg')!;
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }) as DOMRect;
}

const CATS: AxisLabelCategory[] = [
  { label: 'Direct', subLabel: 'walk-in', iconColor: '#6366f1', icon: '🏬' },
  { label: 'Search', subLabel: 'organic' },
  { label: 'Social' },
];

const SETS: AxisLabelTemplateDataset[] = [
  { label: 'Q1', data: [100, 50, 0] },
  { label: 'Q2', data: [40, 80, 20] },
];

describe('SvAxisLabelTemplateChartComponent — layout', () => {
  it('groups the series inside each category slot', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    const step = c.plotW() / 3;
    expect(c.xStep()).toBeCloseTo(step, 9);

    const bars = c.bars();
    expect(bars.length).toBe(6);
    // Q1 and Q2 sit side by side inside the first slot, centred by the gap.
    const q1 = bars.find((b) => b.series === 'Q1' && b.catIdx === 0)!;
    const q2 = bars.find((b) => b.series === 'Q2' && b.catIdx === 0)!;
    const groupW = step * (1 - 0.3);
    expect(q2.path).not.toBe(q1.path);
    expect(c.catX(0)).toBeCloseTo(step / 2, 9);
    expect(c.catX(2)).toBeCloseTo(step * 2.5, 9);
    // The leading offset is half the gap.
    expect(q1.path.startsWith(`M ${(step - groupW) / 2 + 3}`)).toBe(true);
  });

  it('keeps a single category spanning the whole plot', async () => {
    // `n > 1 ? plotW / n : plotW` — with one category the two arms agree, so
    // the guard exists for the ZERO case; this pins the single-category value.
    const { c } = await setup({ categories: [CATS[0]], datasets: SETS });
    expect(c.xStep()).toBe(c.plotW());
    expect(c.catX(0)).toBeCloseTo(c.plotW() / 2, 9);
  });

  it('does not divide the plot by zero categories', async () => {
    const { c, host } = await setup({ categories: [], datasets: SETS });
    expect(c.xStep()).toBe(c.plotW()); // not Infinity
    expect(c.bars()).toEqual([]);
    expect(host.innerHTML).not.toContain('NaN');
    expect(host.innerHTML).not.toContain('Infinity');
  });

  it('sizes the axis from the biggest value across all series', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    expect(c.yMax()).toBe(100);
    expect(c.yTicks()).toEqual([0, 20, 40, 60, 80, 100]);
    expect(c.yTickY(100)).toBe(0);
    expect(c.yTickY(0)).toBeCloseTo(c.plotH(), 9);
    // The tallest bar reaches the top of the plot.
    const tallest = c.bars().find((b) => b.value === 100)!;
    expect(tallest.path).toContain(' 0');
  });

  it('keeps a finite axis when every value is zero', async () => {
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Idle', data: [0, 0, 0] }],
    });
    expect(c.yMax()).toBe(1);
    // A zero-height bar produces no path at all rather than a zero-height rect.
    expect(c.bars().every((b) => b.path === '')).toBe(true);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('treats a category the series does not reach as zero', async () => {
    const { c } = await setup({ categories: CATS, datasets: [{ label: 'Short', data: [10] }] });
    expect(c.bars().map((b) => b.value)).toEqual([10, 0, 0]);
  });

  it('staggers the entrance delay across the grid, row-major by category', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    expect(c.bars().map((b) => b.delay)).toEqual([0, 80, 160, 40, 120, 200]);
  });

  it('draws nothing when there are no series', async () => {
    const { c } = await setup({ categories: CATS, datasets: [] });
    expect(c.bars()).toEqual([]);
    expect(c.chartIsEmpty()).toBe(true);
  });

  it('honours a custom gap and height', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: SETS,
      height: 500,
      options: { barGap: 0.6 },
    });
    expect(c.barGapRatio()).toBe(0.6);
    expect(c.svgH()).toBe(500);
    expect(c.plotH()).toBe(500 - 20 - 72);
  });
});

describe('SvAxisLabelTemplateChartComponent — colours and toggles', () => {
  it('cycles its own six-colour palette and honours an override', async () => {
    const seven: AxisLabelTemplateDataset[] = Array.from({ length: 7 }, (_, i) => ({
      label: `S${i}`,
      data: [1],
    }));
    const { c } = await setup({ categories: [CATS[0]], datasets: seven });
    expect(c.seriesColors()[0]).toBe('#6366f1');
    expect(c.seriesColors()[6]).toBe(c.seriesColors()[0]);

    const { c: fixed } = await setup({
      categories: [CATS[0]],
      datasets: [{ label: 'S', data: [1], color: '#abcdef' }],
    });
    expect(fixed.seriesColors()[0]).toBe('#abcdef');
  });

  it('carries the default toggles and lets each be flipped', async () => {
    const { c: def } = await setup({ categories: CATS, datasets: SETS });
    expect([def.showGrid(), def.showLegend(), def.showValues()]).toEqual([true, true, false]);
    const { c: off } = await setup({
      categories: CATS,
      datasets: SETS,
      options: { showGrid: false, showLegend: false, showValues: true },
    });
    expect([off.showGrid(), off.showLegend(), off.showValues()]).toEqual([false, false, true]);
  });

  it('emits an animation duration only when one is configured', async () => {
    const { c: none } = await setup({ categories: CATS, datasets: SETS });
    expect(none.animDuration()).toBeNull();
    const { c: set } = await setup({
      categories: CATS, datasets: SETS, options: { animationDuration: 300 },
    });
    expect(set.animDuration()).toBe('300ms');
  });

  it('compacts a large value on the axis', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    expect(c.fmt(2_500)).toBe('2.5k');
    expect(c.fmt(2_500_000)).toBe('2.5M');
  });
});

describe('SvAxisLabelTemplateChartComponent — rich labels', () => {
  it('renders the sub-label and the swatch only for the categories that have them', async () => {
    const { host } = await setup({ categories: CATS, datasets: SETS });
    expect(host.textContent).toContain('Direct');
    expect(host.textContent).toContain('walk-in');
    expect(host.textContent).toContain('organic');
    // The third category has neither icon nor swatch nor sub-label.
    expect(host.textContent).toContain('Social');
    const swatches = [...host.querySelectorAll('circle')].filter(
      (n) => n.getAttribute('fill') === '#6366f1',
    );
    expect(swatches.length).toBe(1);
  });
});

describe('SvAxisLabelTemplateChartComponent — interaction', () => {
  it('names the hovered bar by its category object, not its index', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    // jsdom has no layout: the box is stubbed so the viewBox scaling — the part
    // that is actually the component's arithmetic — can be asserted.
    pinLayout(host, 600, 340);
    const seen: AxisLabelBarEvent[] = [];
    c.barHover.subscribe((e) => seen.push(e));

    host.querySelectorAll('path[d]:not([d=""])')[1]
      .dispatchEvent(new MouseEvent('mouseenter', { clientX: 200, clientY: 150, bubbles: true }));

    expect(c.tooltip().visible).toBe(true);
    expect(c.tooltip().label).toBe('Search');
    expect(seen).toEqual([
      { category: 'Search', series: 'Q1', value: 50, color: '#6366f1' },
    ]);
    expect(c.tooltip().x).toBe(200);
    expect(c.tooltip().y).toBe(80);
  });

  it('keeps the tooltip inside the chart on both axes', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    pinLayout(host, 600, 340);
    const bar = host.querySelectorAll('path[d]:not([d=""])')[0];
    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 599, clientY: 10, bubbles: true }));
    expect(c.tooltip().x).toBe(600 - 150);
    expect(c.tooltip().y).toBe(8);
  });

  it('reports an empty category name rather than throwing on a stale index', async () => {
    // A `catIdx` outlives the list it indexed whenever a filter shrinks it.
    const { c } = await setup({ categories: CATS, datasets: SETS });
    const seen: AxisLabelBarEvent[] = [];
    c.barHover.subscribe((e) => seen.push(e));
    c.hoverBar(99, 'Q1', 7, '#000');
    expect(seen).toEqual([{ category: '', series: 'Q1', value: 7, color: '#000' }]);
    expect(c.barAriaLabel(99, 'Q1', 7)).toBe('Q1, : 7');
  });

  it('emits hover on keyboard focus without moving the tooltip', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    const seen: AxisLabelBarEvent[] = [];
    c.barHover.subscribe((e) => seen.push(e));
    c.hoverBar(0, 'Q2', 40, '#f59e0b');
    expect(seen.length).toBe(1);
    expect(c.tooltip().visible).toBe(false); // no pointer, so no visual tooltip
  });

  it('emits a selection on click and on Enter', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    const picked: AxisLabelBarEvent[] = [];
    c.barSelect.subscribe((e) => picked.push(e));

    const bar = host.querySelectorAll('path[d]:not([d=""])')[0];
    bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(picked.length).toBe(2);
    expect(picked[0]).toEqual({ category: 'Direct', series: 'Q1', value: 100, color: '#6366f1' });
  });

  it('names each bar for a screen reader', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    expect(c.barAriaLabel(1, 'Q2', 80)).toBe('Q2, Search: 80');
  });

  it('hides the tooltip on leave', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    pinLayout(host, 600, 340);
    const bar = host.querySelectorAll('path[d]:not([d=""])')[0];
    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 100, clientY: 100, bubbles: true }));
    bar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(c.tooltip().visible).toBe(false);
  });
});
