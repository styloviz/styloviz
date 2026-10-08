import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvGradientBarChartComponent } from './gradient-bar-chart.component';
import type { BarChartDataset } from './bar-chart.types';

/**
 * The horizontal sibling of the column chart, plus a per-series gradient.
 *
 * Two things carry real risk. First the layout is transposed — the value axis
 * runs along X and the category axis down Y — so every off-by-one that the
 * vertical chart would show as a wrong height shows here as a wrong width, and
 * the `barRadius` has to be clamped against BOTH the bar's width and its height
 * or a short bar is drawn with corners larger than itself.
 *
 * Second, the gradient is referenced by `url(#id)`, which is DOCUMENT-global:
 * two of these on one page share the first match unless the id is per-instance.
 */

async function setup(inputs: Partial<ComponentInput<SvGradientBarChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvGradientBarChartComponent, {
    inputs: inputs as ComponentInput<SvGradientBarChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

/** Pin the SVG box to its viewBox so mouse coordinates map 1:1. */
function pinLayout(host: HTMLElement, width: number, height: number) {
  const svg = host.querySelector('svg')!;
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }) as DOMRect;
}

const CATS = ['Apple', 'Microsoft', 'Alphabet'];
const SETS: BarChartDataset[] = [{ label: 'Revenue', data: [100, 50, 0] }];

describe('SvGradientBarChartComponent — layout', () => {
  it('runs the value axis along X and stacks the categories down Y', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS, height: 360 });
    const bars = c.horizontalBars();
    expect(bars.length).toBe(3);
    // Every bar starts on the axis; the widest is the full plot.
    expect(bars.every((b) => b.x === 0)).toBe(true);
    expect(bars[0].barW).toBeCloseTo(c.plotW(), 9); // 100 of a nice-max 100
    expect(bars[1].barW).toBeCloseTo(c.plotW() / 2, 9);
    // Categories descend in order, one group height apart.
    const groupH = c.plotH() / 3;
    expect(bars[1].y - bars[0].y).toBeCloseTo(groupH, 9);
  });

  it('splits a group evenly between series and honours the gap', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [
        { label: 'A', data: [10, 20, 30] },
        { label: 'B', data: [40, 50, 60] },
      ],
      options: { barGap: 0.5 },
    });
    const bars = c.horizontalBars();
    const groupH = c.plotH() / 3;
    // Half the group is gap, so each of the two bars gets a quarter of it.
    expect(bars[0].barH).toBeCloseTo(groupH / 4, 9);
    // Series B sits directly below series A inside the same category.
    const a0 = bars.find((b) => b.cat === 'Apple' && b.series === 'A')!;
    const b0 = bars.find((b) => b.cat === 'Apple' && b.series === 'B')!;
    expect(b0.y - a0.y).toBeCloseTo(a0.barH, 9);
    // ...and the whole group is centred: the leading pad is half the gap.
    expect(a0.y).toBeCloseTo((groupH * 0.5) / 2, 9);
  });

  it('rounds the axis up to a nice ceiling and ticks it evenly', async () => {
    const { c } = await setup({ categories: CATS, datasets: [{ label: 'R', data: [87, 12, 3] }] });
    expect(c.maxValue()).toBe(87);
    expect(c.axisMax()).toBe(90);
    expect(c.gridValues()).toEqual([0, 18, 36, 54, 72, 90]);
    expect(c.gridLineX(90)).toBeCloseTo(c.plotW(), 9);
    expect(c.gridLineX(0)).toBe(0);
  });

  it('keeps a finite axis when every value is zero', async () => {
    // `Math.max(...[0,0,0], 1)` is the only thing between this and dividing by 0.
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Idle', data: [0, 0, 0] }],
    });
    // `Math.max(..., 1)` floors the data max at 1, and `niceMax(1)` is 1 — a
    // finite divisor, which is all the layout needs.
    expect(c.maxValue()).toBe(1);
    expect(c.axisMax()).toBe(1);
    expect(c.horizontalBars().every((b) => b.barW === 0)).toBe(true);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('treats a category the series does not reach as zero', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Short', data: [40] }],
    });
    expect(c.horizontalBars().map((b) => b.value)).toEqual([40, 0, 0]);
  });

  it('marks a negative value at the baseline instead of leaving a gap', async () => {
    // Same case as the vertical sibling, against `barW` instead of `barH`: a
    // zero-width bar draws no path, so the category had no bar and nothing on the
    // page said why. A 3px amber stub replaces the series gradient outright, so it
    // cannot be read as a very small real value of that series.
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Net', data: [40, -20, 10] }],
    });
    const negative = c.horizontalBars()[1];
    expect(negative.clamped).toBe(true);
    expect(negative.barW).toBe(3);
    expect(negative.fill).toBe('var(--color-warning-600)');
    expect(negative.value).toBe(-20);
    expect(c.horizBarPath(negative.x, negative.y, negative.barW, negative.barH, negative.r)).not.toBe('');
    expect(host.querySelectorAll('[data-sv-clamped]').length).toBe(1);
    expect(host.innerHTML).not.toContain('NaN');

    // These bars are not focusable, so the words have to be in the data table.
    expect(c.cellValue(0, 1)).toContain('not drawn to scale');
    expect(host.querySelector('[data-sv-notice]')?.textContent).toContain('1 bar');
  });

  it('draws nothing when either axis has no entries', async () => {
    const { c: noCats } = await setup({ categories: [], datasets: SETS });
    expect(noCats.horizontalBars()).toEqual([]);
    expect(noCats.chartIsEmpty()).toBe(false); // datasets exist, so it still renders

    const { c: noSets } = await setup({ categories: CATS, datasets: [] });
    expect(noSets.horizontalBars()).toEqual([]);
    expect(noSets.chartIsEmpty()).toBe(true);
  });
});

describe('SvGradientBarChartComponent — the bar path', () => {
  it('rounds only the far end, and never by more than the bar allows', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS, options: { barRadius: 40 } });
    const bar = c.horizontalBars()[0];
    // The descriptor carries the CLAMPED radius, not the requested one: 40 is
    // wider than half the bar, and a bar drawn with corners bigger than itself
    // inverts its own outline.
    expect(bar.r).toBe(Math.min(40, bar.barH / 2, bar.barW / 2));
    expect(bar.r).toBeLessThan(40);
    const d = c.horizBarPath(bar.x, bar.y, bar.barW, bar.barH, 40);
    // Two quadratic corners at the right edge, a square left edge.
    expect((d.match(/Q /g) ?? []).length).toBe(2);
    expect(d.startsWith(`M ${bar.x} ${bar.y}`)).toBe(true);
    expect(d).not.toContain('NaN');
    // 40 is larger than half the bar height, so the radius is clamped down.
    expect(d).toContain(`Q ${bar.x + bar.barW} ${bar.y} ${bar.x + bar.barW} ${bar.y + bar.barH / 2}`);
  });

  it('draws no path at all for a zero-width bar', async () => {
    // A rounded rect of width 0 would still emit a visible sliver of stroke.
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'R', data: [100, 0, 0] }],
    });
    expect(c.horizBarPath(0, 0, 0, 20, 4)).toBe('');
    expect(c.horizBarPath(0, 0, -5, 20, 4)).toBe('');
    // Only the one non-zero bar reaches the DOM.
    expect(host.querySelectorAll('path[d]:not([d=""])').length).toBe(1);
  });
});

describe('SvGradientBarChartComponent — colour and gradients', () => {
  it('derives a light→rich pair from the series colour', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'R', data: [1, 2, 3], color: '#3b82f6' }],
    });
    const [from, to] = c.gradientStops()[0];
    expect(to).toBe('#3b82f6'); // the rich end IS the series colour
    // 0x3b/0x82/0xf6 each mixed 55% toward 255.
    expect(from).toBe('rgb(167,199,251)');
  });

  it('prefers an explicit gradient pair over the derived one', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'R', data: [1, 2, 3], gradientColors: ['#000000', '#ffffff'] }],
    });
    expect(c.gradientStops()[0]).toEqual(['#000000', '#ffffff']);
  });

  it('cycles the palette past its end', async () => {
    const nine: BarChartDataset[] = Array.from({ length: 9 }, (_, i) => ({
      label: `S${i}`,
      data: [i + 1],
    }));
    const { c } = await setup({ categories: ['One'], datasets: nine });
    expect(c.seriesColors()[0]).toBe('#3b82f6');
    expect(c.seriesColors()[8]).toBe(c.seriesColors()[0]); // eight colours, ninth wraps
  });

  it('gives each instance its own gradient id', async () => {
    // `url(#id)` is document-global: a shared id repaints the second chart with
    // the first chart's colours, and nothing anywhere reports it.
    const { c: a } = await setup({ categories: CATS, datasets: SETS });
    // Both instances must share one application: ids are per application (svUniqueId).
    const second = TestBed.createComponent(SvGradientBarChartComponent);
    second.componentRef.setInput('categories', CATS);
    second.componentRef.setInput('datasets', SETS);
    second.detectChanges();
    await second.whenStable();
    const b = second.componentInstance;
    const fillA = a.horizontalBars()[0].fill;
    expect(fillA).toMatch(/^url\(#grad-sv-gradient-bar-chart-[\w-]+-0\)$/);
    expect(fillA).not.toBe(b.horizontalBars()[0].fill);
  });
});

describe('SvGradientBarChartComponent — chrome', () => {
  it('describes its own shape when no aria-label is given', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS, title: 'Revenue' });
    expect(c.resolvedAriaLabel()).toBe(
      'Revenue: 1 series (Revenue) across 3 categories.',
    );
  });

  it('says "category" for exactly one, and drops the names when unlabelled', async () => {
    const { c } = await setup({
      categories: ['Only'],
      datasets: [{ label: '', data: [1] }],
    });
    expect(c.resolvedAriaLabel()).toBe('Gradient bar chart: 1 series across 1 category.');
  });

  it('falls back to the bare title when there is nothing plotted', async () => {
    const { c } = await setup({ categories: [], datasets: [], title: 'Revenue' });
    expect(c.resolvedAriaLabel()).toBe('Revenue');
  });

  it('prefers an explicit aria-label', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS, ariaLabel: 'Top three' });
    expect(c.resolvedAriaLabel()).toBe('Top three');
  });

  it('emits an animation duration only when one is configured', async () => {
    const { c: none } = await setup({ categories: CATS, datasets: SETS });
    expect(none.animDuration()).toBeNull();
    const { c: some } = await setup({ categories: CATS, datasets: SETS, options: { animationDuration: 0 } });
    expect(some.animDuration()).toBe('0ms'); // zero is a value, not an absence
  });

  it('defaults the grid off and the values on, and lets both be flipped', async () => {
    const { c: def } = await setup({ categories: CATS, datasets: SETS });
    expect(def.showGrid()).toBe(false);
    expect(def.showValues()).toBe(true);
    expect(def.showLabels()).toBe(true);
    expect(def.showLegend()).toBe(true);

    const { c: flipped } = await setup({
      categories: CATS,
      datasets: SETS,
      options: { showGrid: true, showValues: false, showLabels: false, showLegend: false },
    });
    expect(flipped.showGrid()).toBe(true);
    expect(flipped.showValues()).toBe(false);
    expect(flipped.showLabels()).toBe(false);
    expect(flipped.showLegend()).toBe(false);
  });

  it('compacts a large value and passes a pre-formatted string through', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    expect(c.formatValue(2_500)).toBe('2.5k');
    expect(c.formatValue(2_500_000)).toBe('2.5M');
    expect(c.formatValue('n/a')).toBe('n/a');
  });
});

describe('SvGradientBarChartComponent — tooltip', () => {
  it('maps the pointer into viewBox space and names the bar', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    // jsdom gives every element a zero-size rect, so the box is stubbed rather
    // than measured — the arithmetic under test is the viewBox scaling, not layout.
    pinLayout(host, 600, 360);
    const bar = host.querySelectorAll('path[d]:not([d=""])')[0];
    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 120, clientY: 200, bubbles: true }));

    expect(c.tooltip().visible).toBe(true);
    expect(c.tooltip().label).toBe('Apple');
    expect(c.tooltip().items).toEqual([{ color: '#3b82f6', series: 'Revenue', value: 100 }]);
    expect(c.tooltip().x).toBe(120);
    expect(c.tooltip().y).toBe(140);
  });

  it('keeps the tooltip inside the chart on both axes', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    pinLayout(host, 600, 360);
    const bar = host.querySelectorAll('path[d]:not([d=""])')[0];

    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 599, clientY: 10, bubbles: true }));
    expect(c.tooltip().x).toBe(600 - 130);
    expect(c.tooltip().y).toBe(8); // clamped down from -50

    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 10, clientY: 300, bubbles: true }));
    expect(c.tooltip().x).toBe(10);
    expect(c.tooltip().y).toBe(240);
  });

  it('hides the tooltip on leave without discarding its contents', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    pinLayout(host, 600, 360);
    const bar = host.querySelectorAll('path[d]:not([d=""])')[0];
    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 120, clientY: 200, bubbles: true }));
    bar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(c.tooltip().visible).toBe(false);
    expect(c.tooltip().label).toBe('Apple');
  });
});

/**
 * `X-7` — what this chart does with a number it cannot draw, and how it says so.
 *
 * The bars here are not focusable, so unlike the vertical sibling there is no
 * per-bar accessible name to carry the mark. The data table added alongside is
 * what makes it perceivable without seeing the amber.
 */
describe('SvGradientBarChartComponent — a bar it cannot draw', () => {
  const notice = (host: HTMLElement) =>
    host.querySelector('[data-sv-notice]')?.textContent?.trim() ?? '';

  it('keeps the whole plot from going blank over one NaN', async () => {
    // ★★★ `Math.max(40, NaN)` is NaN and `niceMax(NaN)` is NaN, so the axis, every
    //     bar width and every grid tick were NaN — and SVG drops a NaN dimension
    //     silently, emptying the chart with nothing anywhere reporting it.
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Net', data: [40, NaN, 10] }],
    });
    expect(c.axisMax()).toBe(40);
    expect(c.gridValues().every(Number.isFinite)).toBe(true);
    expect(c.horizontalBars()[0].barW).toBeGreaterThan(0);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('reports an absent value as an absence in the data table', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Net', data: [40, NaN, 10] }],
    });
    expect(c.cellValue(0, 1)).toBe('no value (not drawn to scale)');
    expect(c.cellValue(0, 0)).toBe('40');
  });

  it('marks only the bar it could not draw', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Net', data: [-20, 0, 10] }],
    });
    expect(c.horizontalBars().map((b) => b.clamped)).toEqual([true, false, false]);
    expect(c.cellValue(0, 1)).toBe('0');
  });

  it('discloses the alteration under the plot, not only to the console', async () => {
    const { host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Net', data: [40, -20, 10] }],
    });
    expect(notice(host)).toContain('1 bar');
    expect(notice(host)).toContain('-20');
  });

  it('refuses the dataset under reject instead of drawing a stub', async () => {
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Net', data: [40, -20, 10] }],
      valuePolicy: 'reject',
    });
    expect(host.querySelector('[data-sv-state="error"]')).toBeTruthy();
    expect(c.resolvedError()).toBeTruthy();
    expect(notice(host)).toBe('');
  });

  it('stays silent on data it can draw', async () => {
    const { host } = await setup({ categories: CATS, datasets: SETS });
    expect(host.querySelector('[data-sv-notice]')).toBeNull();
    expect(host.querySelector('[data-sv-clamped]')).toBeNull();
  });
});

describe('gradientDirection', () => {
  // Declared on BarChartOptions and read by nothing until 2026-10-02 — every
  // bar's gradient ran along its length whatever the option said.
  const vector = (host: HTMLElement) => {
    const g = host.querySelector('linearGradient')!;
    return [g.getAttribute('x2'), g.getAttribute('y2')];
  };

  it('runs along the bar by default', async () => {
    const { host } = await setup({ categories: CATS, datasets: SETS });
    expect(vector(host)).toEqual(['100%', '0%']);
  });

  it("runs across the bar for 'vertical'", async () => {
    const { host } = await setup({ categories: CATS, datasets: SETS, options: { gradientDirection: 'vertical' } });
    expect(vector(host)).toEqual(['0%', '100%']);
  });
});
