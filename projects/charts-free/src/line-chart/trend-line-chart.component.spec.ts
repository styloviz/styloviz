import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvTrendLineChartComponent,
  type TrendLineSeries,
} from './trend-line-chart.component';

/**
 * Four fitting algorithms behind one switcher. Each has an input it cannot fit
 * — an exponential cannot take the log of a non-positive number, a quadratic
 * needs three points to be a quadratic, and R² divides by the variance, which
 * is zero for a flat series. None of those throw. They produce `NaN` in a
 * sampled path, and a path with `NaN` in it is dropped by the browser: the
 * trend line simply does not appear, and the R² caption reads "R² = NaN".
 *
 * So the assertions here are mostly "gave a finite answer for input it cannot
 * fit", plus the arithmetic that is actually checkable (a perfect line is R² 1,
 * a moving average of a flat series is that flat value).
 */

async function setup(inputs: Partial<ComponentInput<SvTrendLineChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvTrendLineChartComponent, {
    inputs: inputs as ComponentInput<SvTrendLineChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const CATS = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
/** Exactly y = 10x + 10 — any correct linear fit reproduces it with R² = 1. */
const PERFECT: TrendLineSeries[] = [{ label: 'Sales', data: [10, 20, 30, 40, 50] }];
const NOISY: TrendLineSeries[] = [{ label: 'Sales', data: [12, 19, 33, 38, 51] }];

/** Every numeric token in a `d` attribute, for NaN / Infinity screening. */
const numbersIn = (d: string) => d.match(/-?\d+(\.\d+)?|NaN|Infinity/g) ?? [];

describe('SvTrendLineChartComponent — linear fit', () => {
  it('reproduces a perfectly linear series with R² of exactly 1', async () => {
    const { c } = await setup({ categories: CATS, series: PERFECT });
    const [trend] = c.trendPaths();
    expect(trend.label).toBe('Linear');
    expect(trend.r2).toBeCloseTo(1, 12);
    // The fitted line must pass through the data, so its ends sit on the dots.
    expect(trend.path.startsWith(`M ${c.xForIndex(0).toFixed(1)} ${c.yForValue(10).toFixed(1)}`)).toBe(true);
  });

  it('scores a noisy series below a perfect one but still above zero', async () => {
    const { c } = await setup({ categories: CATS, series: NOISY });
    const r2 = c.trendPaths()[0].r2!;
    expect(r2).toBeLessThan(1);
    expect(r2).toBeGreaterThan(0.9);
  });

  it('gives a flat series R² of 1 rather than dividing by its zero variance', async () => {
    // ssTot is zero for a constant series. Unguarded, R² is 0/0 and the caption
    // renders "R² = NaN".
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'Flat', data: [7, 7, 7, 7, 7] }],
    });
    expect(c.trendPaths()[0].r2).toBe(1);
    expect(c.r2Label(c.trendPaths()[0].r2)).toBe('R² = 1.000');
    expect(c.trendPaths()[0].path).not.toContain('NaN');
  });

  it('formats R² to three places and prints nothing when there is none', async () => {
    const { c } = await setup({ categories: CATS, series: NOISY });
    expect(c.r2Label(0.87654)).toBe('R² = 0.877');
    expect(c.r2Label(null)).toBe('');
  });
});

describe('SvTrendLineChartComponent — the other three fits', () => {
  it('fits an exponential and reports its goodness', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'Growth', data: [1, 2, 4, 8, 16] }],
    });
    c.setTrendType('exponential');
    const trend = c.trendPaths()[0];
    expect(trend.label).toBe('Exponential');
    expect(trend.r2).toBeCloseTo(1, 6);
    expect(trend.path).not.toContain('NaN');
  });

  it('degrades to a flat line when too few values are positive to take a log', async () => {
    // log(0) is -Infinity and log(-1) is NaN. With only one usable point the
    // fit cannot be computed at all and must fall back rather than emit NaN.
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'Zeros', data: [5, 0, 0, 0, 0] }],
    });
    c.setTrendType('exponential');
    const trend = c.trendPaths()[0];
    expect(numbersIn(trend.path)).not.toContain('NaN');
    expect(trend.path).not.toContain('Infinity');
    // Every sample is the same y — a flat fallback at the first value.
    const ys = trend.path.split(/[ML] /).slice(1).map((p) => p.trim().split(' ')[1]);
    expect(new Set(ys).size).toBe(1);
  });

  it('survives a series with no positive value at all', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'Losses', data: [-1, -2, -3, -4, -5] }],
    });
    c.setTrendType('exponential');
    expect(numbersIn(c.trendPaths()[0].path)).not.toContain('NaN');
  });

  it('averages a moving window and leaves a flat series flat', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'Flat', data: [7, 7, 7, 7, 7] }],
    });
    c.setTrendType('moving-average');
    const trend = c.trendPaths()[0];
    expect(trend.label).toBe('Moving Avg');
    // A moving average carries no R² — there is no fitted model to score.
    expect(trend.r2).toBeNull();
    const flatY = c.yForValue(7).toFixed(1);
    expect(trend.path.split(' ').filter((t) => t === flatY).length).toBeGreaterThan(50);
  });

  it('honours a custom moving-average window', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'Spiky', data: [0, 100, 0, 100, 0] }],
      trends: [{ type: 'moving-average', maWindow: 5 }],
    });
    c.setTrendType('moving-average');
    const wide = c.trendPaths()[0].path;

    const { c: narrow } = await setup({
      categories: CATS,
      series: [{ label: 'Spiky', data: [0, 100, 0, 100, 0] }],
      trends: [{ type: 'moving-average', maWindow: 1 }],
    });
    narrow.setTrendType('moving-average');
    // A window of 1 is the raw data; a window of 5 smooths it almost flat.
    expect(narrow.trendPaths()[0].path).not.toBe(wide);
    expect(wide).not.toContain('NaN');
  });

  it('fits a quadratic through a curved series', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'Curve', data: [0, 1, 4, 9, 16] }],
    });
    c.setTrendType('polynomial');
    const trend = c.trendPaths()[0];
    expect(trend.label).toBe('Polynomial');
    expect(trend.r2).toBeCloseTo(1, 9);
    expect(trend.path).not.toContain('NaN');
  });

  it('drops the degree to what the data can support', async () => {
    // Two points cannot define a quadratic; the solver's pivot would be zero
    // and the coefficients NaN.
    const { c } = await setup({
      categories: ['Jan', 'Feb'],
      series: [{ label: 'Pair', data: [10, 20] }],
    });
    c.setTrendType('polynomial');
    expect(numbersIn(c.trendPaths()[0].path)).not.toContain('NaN');
  });

  it('survives a duplicated-row system that makes the pivot zero', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'Flat', data: [3, 3, 3, 3, 3] }],
      trends: [{ type: 'polynomial', polyDegree: 4 }],
    });
    c.setTrendType('polynomial');
    expect(numbersIn(c.trendPaths()[0].path)).not.toContain('NaN');
  });
});

describe('SvTrendLineChartComponent — trend definitions', () => {
  it('has nothing to fit through fewer than two categories', async () => {
    const { c } = await setup({ categories: ['Jan'], series: [{ label: 'S', data: [5] }] });
    expect(c.trendPaths()).toEqual([]);

    const { c: none } = await setup({ categories: CATS, series: PERFECT, trends: [] });
    expect(none.trendPaths()).toEqual([]);
  });

  it('lets the switcher override only the first trend', async () => {
    const { c } = await setup({
      categories: CATS,
      series: PERFECT,
      trends: [{ type: 'linear' }, { type: 'polynomial' }],
    });
    c.setTrendType('moving-average');
    expect(c.trendPaths().map((t) => t.label)).toEqual(['Moving Avg', 'Polynomial']);
  });

  it('defaults a trend with an unknown-looking type to linear', async () => {
    const { c } = await setup({
      categories: CATS,
      series: PERFECT,
      // The second trend has no explicit type, so it falls back.
      trends: [{ type: 'linear' }, {} as { type: 'linear' }],
    });
    expect(c.trendPaths()[1].label).toBe('Linear');
  });

  it('emits an empty trend for a series index that does not exist', async () => {
    // A host that removes a series but leaves its trend behind must not crash.
    const { c, host } = await setup({
      categories: CATS,
      series: PERFECT,
      trends: [{ type: 'linear', seriesIndex: 4 }],
    });
    expect(c.trendPaths()[0]).toEqual({ path: '', color: '', r2: null, label: '' });
    // An empty path is not rendered at all rather than as `d=""`.
    expect(host.querySelectorAll('path.tl-line-anim').length).toBe(0);
  });

  it('fits the series the trend names, not always the first one', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [PERFECT[0], { label: 'Other', data: [50, 40, 30, 20, 10] }],
      trends: [{ type: 'linear', seriesIndex: 1 }],
    });
    // Descending series → the fit descends too.
    const [first, last] = [c.yForValue(50), c.yForValue(10)];
    expect(c.trendPaths()[0].path.startsWith(`M 0.0 ${first.toFixed(1)}`)).toBe(true);
    expect(c.trendPaths()[0].path.endsWith(`${last.toFixed(1)}`)).toBe(true);
  });

  it('takes the trend colour from the definition, else from its series', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'S', data: [1, 2, 3, 4, 5], color: '#abcdef' }],
      trends: [{ type: 'linear' }],
    });
    expect(c.trendPaths()[0].color).toBe('#abcdef');

    const { c: explicit } = await setup({
      categories: CATS,
      series: PERFECT,
      trends: [{ type: 'linear', color: '#ff0000' }],
    });
    expect(explicit.trendPaths()[0].color).toBe('#ff0000');
  });

  it('falls back to the first palette colour when the series does not exist', async () => {
    const { c } = await setup({ categories: CATS, series: PERFECT });
    expect(c.trendColor({ type: 'linear' }, 9)).toBe('#3b82f6');
  });
});

describe('SvTrendLineChartComponent — axis and dots', () => {
  it('starts at zero for positive data and drops below for negative', async () => {
    const { c: pos } = await setup({ categories: CATS, series: PERFECT });
    expect(pos.axisMin()).toBe(0);
    expect(pos.axisMax()).toBe(50);

    const { c: neg } = await setup({
      categories: CATS,
      series: [{ label: 'Net', data: [-34, 10, 20, 30, 40] }],
    });
    expect(neg.axisMin()).toBe(-40);
  });

  it('keeps a usable axis for an all-zero series', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'Zero', data: [0, 0, 0, 0, 0] }],
    });
    expect(c.axisMax()).toBe(1);
    expect(c.trendPaths()[0].path).not.toContain('NaN');
  });

  it('centres a lone category rather than dividing by zero', async () => {
    const { c } = await setup({ categories: ['Only'], series: [{ label: 'S', data: [5] }] });
    expect(c.xForIndex(0)).toBe(c.plotW() / 2);
  });

  it('divides the grid evenly across the resolved bounds', async () => {
    const { c } = await setup({
      categories: CATS,
      series: PERFECT,
      options: { gridDivisions: 5 },
    });
    expect(c.gridValues()).toEqual([0, 10, 20, 30, 40, 50]);
  });

  it('places a dot on every value, staggered for the reveal', async () => {
    const { c } = await setup({ categories: CATS, series: PERFECT });
    const dots = c.dots()[0];
    expect(dots.length).toBe(5);
    expect(dots[2]).toEqual({
      x: c.xForIndex(2),
      y: c.yForValue(30),
      value: 30,
      color: '#3b82f6',
      delay: 60,
      ci: 2,
    });
  });

  it('wraps the palette past its end', async () => {
    const many: TrendLineSeries[] = Array.from({ length: 9 }, (_, i) => ({
      label: `S${i}`,
      data: [i, i, i, i, i],
    }));
    const { c } = await setup({ categories: CATS, series: many });
    expect(c.seriesColors()[8]).toBe(c.seriesColors()[0]);
  });

  it('rounds plain values and compacts large ones', async () => {
    const { c } = await setup({ categories: CATS, series: PERFECT });
    expect(c.formatValue(41.6)).toBe('42');
    expect(c.formatValue(2_500)).toBe('2.5k');
    expect(c.formatValue(3_400_000)).toBe('3.4M');
    expect(c.formatValue(-2_500)).toBe('-2.5k');
  });
});

describe('SvTrendLineChartComponent — chrome', () => {
  it('offers all four algorithms in the switcher and marks the active one', async () => {
    const { c, host, fixture } = await setup({ categories: CATS, series: PERFECT });
    const buttons = [...host.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      'Linear',
      'Exponential',
      'Moving Avg',
      'Polynomial',
    ]);

    buttons[3].click();
    fixture.detectChanges();
    expect(c.activeTrendType()).toBe('polynomial');
    expect(c.trendPaths()[0].label).toBe('Polynomial');
  });

  it('hides the switcher when asked, keeping the trend itself', async () => {
    const { c, host } = await setup({
      categories: CATS,
      series: PERFECT,
      options: { showTypeSelector: false },
    });
    expect(host.querySelectorAll('button').length).toBe(0);
    expect(c.trendPaths()[0].path).not.toBe('');
  });

  it('drops the header entirely when there is neither title nor switcher', async () => {
    const { host } = await setup({
      categories: CATS,
      series: PERFECT,
      options: { showTypeSelector: false },
    });
    expect(host.querySelector('h3')).toBeNull();
  });

  it('shows the subtitle whenever the header block is drawn', async () => {
    const { host: both } = await setup({
      categories: CATS,
      series: PERFECT,
      title: 'Sales',
      subtitle: 'FY26',
    });
    expect(both.textContent).toContain('FY26');

    // ★ Divergence from `sv-line-chart`, which nests the subtitle inside the
    // title check. Here the header exists for the switcher's sake, so a
    // subtitle with no title still shows.
    const { host: switcherOnly } = await setup({
      categories: CATS,
      series: PERFECT,
      subtitle: 'FY26',
    });
    expect(switcherOnly.textContent).toContain('FY26');

    // With neither title nor switcher there is no header at all to hold it.
    const { host: noHeader } = await setup({
      categories: CATS,
      series: PERFECT,
      subtitle: 'FY26',
      options: { showTypeSelector: false },
    });
    expect(noHeader.textContent).not.toContain('FY26');
  });

  it('connects the dots only for a series that asks for it and has more than one point', async () => {
    const { host: none } = await setup({ categories: CATS, series: PERFECT });
    const lines = (h: HTMLElement) => h.querySelectorAll('path[stroke-width="1.5"]').length;
    expect(lines(none)).toBe(0);

    const { host: joined } = await setup({
      categories: CATS,
      series: [{ label: 'S', data: [1, 2, 3, 4, 5], showLine: true }],
    });
    expect(lines(joined)).toBe(1);

    // One point is not a line — drawing it would emit a bare `M`.
    const { host: lone } = await setup({
      categories: ['Jan'],
      series: [{ label: 'S', data: [1], showLine: true }],
    });
    expect(lines(lone)).toBe(0);
  });

  it('drops grid lines and axis labels when both are off', async () => {
    const { host: on } = await setup({ categories: CATS, series: PERFECT });
    const { host: off } = await setup({
      categories: CATS,
      series: PERFECT,
      options: { showGrid: false, showLabels: false },
    });
    expect(off.querySelectorAll('line').length).toBeLessThan(on.querySelectorAll('line').length);
    // The axis <text> nodes go; the per-dot <title> tooltips stay, so this is
    // scoped to the tick labels rather than to all SVG text.
    const tickText = (h: HTMLElement) =>
      [...h.querySelectorAll('svg text')].map((t) => t.textContent?.trim());
    expect(tickText(on)).toContain('Jan');
    expect(tickText(off)).not.toContain('Jan');
  });

  it('lists the series and the trend in the legend, and hides both when asked', async () => {
    const { host: on } = await setup({ categories: CATS, series: PERFECT });
    expect(on.textContent).toContain('Sales');
    expect(on.textContent).toContain('Linear');

    const { host: off } = await setup({
      categories: CATS,
      series: PERFECT,
      options: { showLegend: false, showTypeSelector: false },
    });
    expect(off.textContent).not.toContain('Sales');
  });

  it('drops the draw-on animation classes when animation is off', async () => {
    const { host: on } = await setup({ categories: CATS, series: PERFECT });
    expect(on.querySelectorAll('.tl-line-anim').length).toBe(1);
    // Two circles per point: a glow ring and the solid dot.
    expect(on.querySelectorAll('.tl-dot-anim').length).toBe(10);

    const { host: off } = await setup({
      categories: CATS,
      series: PERFECT,
      options: { animated: false },
    });
    expect(off.querySelectorAll('.tl-line-anim').length).toBe(0);
    expect(off.querySelectorAll('.tl-dot-anim').length).toBe(0);
  });

  it('honours the dot radius and the height options', async () => {
    const { c, host } = await setup({
      categories: CATS,
      series: PERFECT,
      options: { dotRadius: 9, height: 480 },
    });
    expect(c.chartHeight()).toBe(480);
    expect(c.plotH()).toBe(480 - 24 - 48);
    const radii = [...host.querySelectorAll('circle')].map((el) => el.getAttribute('r'));
    // The glow ring sits 3px outside the solid dot.
    expect(new Set(radii)).toEqual(new Set(['9', '12']));
  });

  it('describes itself by title, series and category count', async () => {
    const { c } = await setup({ categories: CATS, series: PERFECT, title: 'Sales' });
    expect(c.resolvedAriaLabel()).toBe('Sales: 1 series (Sales) across 5 categories.');

    const { c: one } = await setup({ categories: ['Jan'], series: [{ label: 'S', data: [1] }] });
    expect(one.resolvedAriaLabel()).toContain('across 1 category.');

    const { c: bare } = await setup({ categories: [], series: PERFECT });
    expect(bare.resolvedAriaLabel()).toBe('Trend line chart');

    const { c: override } = await setup({
      categories: CATS,
      series: PERFECT,
      ariaLabel: 'Monthly sales with linear trend',
    });
    expect(override.resolvedAriaLabel()).toBe('Monthly sales with linear trend');
  });

  it('gives each instance its own derived element ids', async () => {
    const { c: a } = await setup({ categories: CATS, series: PERFECT });
    // Both instances must share one application: ids are per application (svUniqueId).
    const second = TestBed.createComponent(SvTrendLineChartComponent);
    second.componentRef.setInput('categories', CATS);
    second.componentRef.setInput('series', PERFECT);
    second.detectChanges();
    await second.whenStable();
    const b = second.componentInstance;
    expect(a._uid).not.toBe(b._uid);
  });

  it('emits no NaN anywhere, for any algorithm, on awkward data', async () => {
    for (const type of ['linear', 'exponential', 'moving-average', 'polynomial'] as const) {
      const { c, host, fixture } = await setup({
        categories: CATS,
        series: [{ label: 'Awkward', data: [0, -5, 0, 0, 3], showLine: true }],
      });
      c.setTrendType(type);
      fixture.detectChanges();
      expect(host.innerHTML, `chart type ${type}`).not.toContain('NaN');
    }
  });
});
