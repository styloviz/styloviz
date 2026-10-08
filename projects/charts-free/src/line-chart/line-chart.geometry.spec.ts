import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvLineChartComponent,
  type LineChartSeries,
  type LineChartType,
} from './line-chart.component';

/**
 * Everything this chart draws is `(v - axisMin) / (axisMax - axisMin)` piped
 * straight into SVG path data, so the interesting cases are the ones where that
 * expression is not a number: a series with no points, one point, every point
 * identical, every point zero. A browser silently DROPS a path containing NaN —
 * it does not warn — so the chart renders as a blank rectangle and looks like a
 * data problem rather than a bug. Hence the `NaN` assertions throughout.
 *
 * The rest is dispatch: six `chartType`s route through three data pipelines
 * (raw / stacked / stacked-percent) and two layouts (normal / inversed), and
 * every one of those forks has its own coordinate arithmetic.
 */

async function setup(inputs: Partial<ComponentInput<SvLineChartComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvLineChartComponent, {
    inputs: inputs as ComponentInput<SvLineChartComponent>,
  });
}

/** The component instance — every geometry assertion reads from here. */
async function chart(inputs: Partial<ComponentInput<SvLineChartComponent>> = {}) {
  const { fixture } = await setup(inputs);
  return fixture.componentInstance;
}

const CATS = ['Jan', 'Feb', 'Mar', 'Apr'];
const ONE: LineChartSeries[] = [{ label: 'Users', data: [10, 30, 20, 40] }];
const TWO: LineChartSeries[] = [
  { label: 'Users', data: [10, 30, 20, 40] },
  { label: 'Sessions', data: [5, 15, 25, 10] },
];

describe('SvLineChartComponent — axis bounds', () => {
  it('starts the axis at zero when no value is negative', async () => {
    const c = await chart({ categories: CATS, series: ONE });
    expect(c.axisMin()).toBe(0);
    expect(c.axisMax()).toBe(40);
  });

  it('extends the axis below zero for a negative value', async () => {
    // A single dip below zero has to move the floor, or the point is drawn
    // outside the plot area rather than inside it.
    const c = await chart({
      categories: CATS,
      series: [{ label: 'Net', data: [10, -34, 20, 40] }],
    });
    expect(c.rawMin()).toBe(-34);
    expect(c.axisMin()).toBe(-40); // floor(-34 / 10) * 10
    expect(c.yForValue(-34)).toBeLessThan(c.plotH());
    expect(c.yForValue(-34)).toBeGreaterThan(0);
  });

  it('gives an all-zero series a usable axis instead of a zero-height one', async () => {
    // max would be 0 and min 0 — the divisor of every y coordinate. The `?? 1`
    // floor in `rawMax` is what keeps `yForValue` finite here.
    const c = await chart({ categories: CATS, series: [{ label: 'Flat', data: [0, 0, 0, 0] }] });
    expect(c.axisMax()).toBe(1);
    expect(c.axisMin()).toBe(0);
    expect(Number.isFinite(c.yForValue(0))).toBe(true);
    expect(c.seriesPath(0)).not.toContain('NaN');
  });

  it('pins the axis to 0–100 for stacked-percent regardless of the data', async () => {
    const c = await chart({ categories: CATS, series: TWO, chartType: 'stacked-percent' });
    expect(c.rawMax()).toBe(100);
    expect(c.rawMin()).toBe(0);
  });

  it('sizes the stacked axis to the tallest column, not the tallest series', async () => {
    const c = await chart({ categories: CATS, series: TWO, chartType: 'stacked' });
    // Column 3 stacks 40 + 10 = 50; the tallest single value is only 40.
    expect(c.rawMax()).toBe(50);
    expect(c.axisMax()).toBe(50);
  });

  it('lays grid divisions evenly across the resolved axis', async () => {
    const c = await chart({
      categories: CATS,
      series: ONE,
      options: { gridDivisions: 4 },
    });
    expect(c.gridValues()).toEqual([0, 10, 20, 30, 40]);
  });

  it('spans a negative axis with grid values that reach both ends', async () => {
    const c = await chart({
      categories: CATS,
      series: [{ label: 'Net', data: [-50, 0, 50, 100] }],
      options: { gridDivisions: 5 },
    });
    const grid = c.gridValues();
    expect(grid[0]).toBe(c.axisMin());
    expect(grid[grid.length - 1]).toBe(c.axisMax());
    expect(grid.every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe('SvLineChartComponent — coordinates', () => {
  it('centres a lone category instead of dividing by zero', async () => {
    // `i / (n - 1)` with n = 1 is 0/0. Left alone every x becomes NaN and the
    // whole line disappears.
    const c = await chart({ categories: ['Only'], series: [{ label: 'S', data: [7] }] });
    expect(c.xForIndex(0)).toBe(c.plotW() / 2);
    expect(c.seriesPath(0)).not.toContain('NaN');
  });

  it('spreads categories from the left edge to the right edge', async () => {
    const c = await chart({ categories: CATS, series: ONE });
    expect(c.xForIndex(0)).toBe(0);
    expect(c.xForIndex(3)).toBe(c.plotW());
  });

  it('still spans a real range when every value is identical', async () => {
    // A flat series is where a naive `max - min` divisor goes to zero. It does
    // not here because `rawMin` folds in 0 and `rawMax` floors at 1, so the
    // axis is 0–5 rather than 5–5 — which is exactly what keeps y finite.
    const c = await chart({ categories: CATS, series: [{ label: 'Flat', data: [5, 5, 5, 5] }] });
    expect(c.axisMax() - c.axisMin()).toBeGreaterThan(0);
    expect(c.yForValue(5)).toBe(0);
    expect(c.seriesPath(0)).not.toContain('NaN');
  });

  it('maps the axis extremes to the top and bottom of the plot', async () => {
    const c = await chart({ categories: CATS, series: ONE });
    expect(c.yForValue(c.axisMax())).toBe(0);
    expect(c.yForValue(c.axisMin())).toBe(c.plotH());
    expect(c.gridLineY(c.axisMax())).toBe(0);
  });

  it('centres a lone category on the inversed value axis too', async () => {
    const c = await chart({
      categories: ['Only'],
      series: [{ label: 'S', data: [7] }],
      chartType: 'inversed',
    });
    expect(c.yForIndex_inv(0)).toBe(c.plotH_inv() / 2);
    expect(c.inversedPath(0)).not.toContain('NaN');
  });

  it('maps values left-to-right in the inversed layout', async () => {
    const c = await chart({ categories: CATS, series: ONE, chartType: 'inversed' });
    expect(c.isInversed()).toBe(true);
    expect(c.xForValue_inv(c.axisMin())).toBe(0);
    expect(c.xForValue_inv(c.axisMax())).toBe(c.plotW_inv());
    expect(c.gridLineX_inv(c.axisMax())).toBe(c.plotW_inv());
    // Inversed uses its own padding, so the plot box differs from the normal one.
    expect(c.plotW_inv()).not.toBe(c.plotW());
  });
});

describe('SvLineChartComponent — stacking', () => {
  it('accumulates each series on top of the ones before it', async () => {
    const c = await chart({ categories: CATS, series: TWO, chartType: 'stacked' });
    expect(c.stackedData()[0]).toEqual([10, 30, 20, 40]);
    expect(c.stackedData()[1]).toEqual([15, 45, 45, 50]);
    expect(c.effectiveData()).toEqual(c.stackedData());
  });

  it('normalises each category to 100 for stacked-percent', async () => {
    const c = await chart({ categories: CATS, series: TWO, chartType: 'stacked-percent' });
    const top = c.stackedPercentData()[1];
    expect(top.every((v) => Math.abs(v - 100) < 1e-9)).toBe(true);
    expect(c.effectiveData()).toEqual(c.stackedPercentData());
  });

  it('leaves an all-zero category flat instead of dividing by its zero total', async () => {
    // Feb totals zero. `v / totals[ci]` is 0/0 = NaN and BOTH stacked lines
    // vanish for every category, not just this one, because one NaN poisons the
    // whole `d` attribute.
    const c = await chart({
      categories: ['Jan', 'Feb'],
      series: [
        { label: 'A', data: [10, 0] },
        { label: 'B', data: [30, 0] },
      ],
      chartType: 'stacked-percent',
    });
    expect(c.stackedPercentData()).toEqual([
      [25, 0],
      [100, 0],
    ]);
    expect(c.seriesPath(0)).not.toContain('NaN');
    expect(c.seriesPath(1)).not.toContain('NaN');
  });

  it('floors the first stacked band at zero and each later band on its predecessor', async () => {
    const c = await chart({ categories: CATS, series: TWO, chartType: 'stacked' });
    expect(c.stackedBaseData()[0]).toEqual([0, 0, 0, 0]);
    expect(c.stackedBaseData()[1]).toEqual(c.stackedData()[0]);
  });

  it('floors every band at zero when the chart is not stacked at all', async () => {
    const c = await chart({ categories: CATS, series: TWO, chartType: 'line' });
    expect(c.stackedBaseData()).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    expect(c.effectiveData()).toEqual([TWO[0].data, TWO[1].data]);
  });

  it('treats a hole in a shorter series as zero rather than NaN', async () => {
    // Series B stops after two categories. `series[prev].data[ci]` is undefined
    // for the rest, and undefined propagates through the running sum.
    const c = await chart({
      categories: CATS,
      series: [
        { label: 'A', data: [1, 2] },
        { label: 'B', data: [1, 2, 3, 4] },
      ],
      chartType: 'stacked',
    });
    expect(c.stackedData()[1]).toEqual([2, 4, 3, 4]);
    expect(c.seriesPath(1)).not.toContain('NaN');
  });
});

describe('SvLineChartComponent — path building', () => {
  it('draws nothing for a series with no points', async () => {
    const c = await chart({ categories: [], series: [{ label: 'S', data: [] }] });
    expect(c.buildPath([], false)).toBe('');
    expect(c.buildStepPath([])).toBe('');
    expect(c.seriesPath(0)).toBe('');
    expect(c.fillPath(0)).toBe('');
  });

  it('draws a one-point run as a zero-length segment, so the round cap shows it', async () => {
    // ★ A bare `M` paints nothing: with dots off, a lone reading (or one with a
    //   gap on both sides) vanished while the table still listed it.
    const c = await chart({ categories: ['A'], series: [{ label: 'S', data: [3] }] });
    expect(c.buildPath([{ x: 1, y: 2 }], true)).toBe('M 1 2 h 0');
    expect(c.seriesPath(0)).toMatch(/^M [\d.]+ [\d.]+ h 0$/);
  });

  it('joins points with straight segments unless the series asks for a curve', async () => {
    const c = await chart({ categories: CATS, series: ONE });
    expect(c.seriesPath(0)).toContain(' L ');
    expect(c.seriesPath(0)).not.toContain(' C ');
  });

  it('curves a series that opts in, and every series when the type is spline', async () => {
    const smoothOne = await chart({
      categories: CATS,
      series: [{ label: 'S', data: [1, 2, 3, 4], smooth: true }],
    });
    expect(smoothOne.isSmooth(smoothOne.series()[0])).toBe(true);
    expect(smoothOne.seriesPath(0)).toContain(' C ');

    const spline = await chart({ categories: CATS, series: TWO, chartType: 'spline' });
    expect(spline.isSmooth(spline.series()[1])).toBe(true);
    expect(spline.seriesPath(1)).toContain(' C ');
  });

  it('builds a step path out of horizontal then vertical moves', async () => {
    const c = await chart({ categories: CATS, series: ONE, chartType: 'step' });
    const d = c.seriesPath(0);
    expect(d).toMatch(/^M /);
    expect(d).toContain(' H ');
    expect(d).toContain(' V ');
    expect(d).not.toContain(' L ');
    expect(d).not.toContain('NaN');
  });

  it('closes a plain fill down to the baseline', async () => {
    const c = await chart({
      categories: CATS,
      series: [{ label: 'S', data: [10, 30, 20, 40], fill: true }],
    });
    const d = c.fillPath(0);
    expect(d.endsWith(' Z')).toBe(true);
    expect(d).toContain(`L ${c.plotW()} ${c.plotH()}`);
  });

  it('closes a stacked fill onto the band below it, not onto the baseline', async () => {
    // The visual difference is the whole point of a stacked area chart: band 2
    // must sit ON band 1, not overlap it back down to zero.
    const c = await chart({
      categories: CATS,
      series: [
        { label: 'A', data: [10, 30, 20, 40], fill: true },
        { label: 'B', data: [5, 15, 25, 10], fill: true },
      ],
      chartType: 'stacked',
    });
    const upper = c.fillPath(1);
    expect(upper.endsWith(' Z')).toBe(true);
    // The reversed floor is the previous stacked line, whose last y is not plotH.
    expect(upper).toContain(`L ${c.xForIndex(3)} ${c.yForValue(c.stackedData()[0][3])}`);
    expect(upper).not.toContain('NaN');
  });

  it('builds a stepped fill from the step path, not the straight one', async () => {
    const c = await chart({
      categories: CATS,
      series: [{ label: 'S', data: [10, 30, 20, 40], fill: true }],
      chartType: 'step',
    });
    const d = c.fillPath(0);
    expect(d).toContain(' H ');
    expect(d).toContain(' V ');
    expect(d.endsWith(' Z')).toBe(true);
  });

  it('builds a curved fill for a smooth series', async () => {
    const c = await chart({
      categories: CATS,
      series: [{ label: 'S', data: [10, 30, 20, 40], fill: true, smooth: true }],
    });
    expect(c.fillPath(0)).toContain(' C ');
  });

  it.each(['line', 'spline', 'step', 'stacked', 'stacked-percent', 'inversed'] as LineChartType[])(
    'emits no NaN anywhere in the %s layout',
    async (chartType) => {
      const { fixture } = await setup({ categories: CATS, series: TWO, chartType });
      const host = fixture.nativeElement as HTMLElement;
      expect(host.innerHTML).not.toContain('NaN');
      expect(host.querySelector('svg')).toBeTruthy();
    },
  );
});

describe('SvLineChartComponent — markers and colours', () => {
  it('falls back to the palette and wraps past its end', async () => {
    const many: LineChartSeries[] = Array.from({ length: 11 }, (_, i) => ({
      label: `S${i}`,
      data: [i],
    }));
    const c = await chart({ categories: ['A'], series: many });
    expect(c.seriesColors()[0]).toBe('#3b82f6');
    // 10 palette entries — the 11th must reuse the first, not be undefined.
    expect(c.seriesColors()[10]).toBe(c.seriesColors()[0]);
  });

  it('prefers an explicit series colour over the palette', async () => {
    const c = await chart({
      categories: ['A'],
      series: [{ label: 'S', data: [1], color: '#123456' }],
    });
    expect(c.seriesColors()[0]).toBe('#123456');
  });

  it('colours a dot from pointColors where one is given and the series colour elsewhere', async () => {
    const c = await chart({
      categories: CATS,
      series: [{ label: 'S', data: [1, 2, 3, 4], color: '#111111', pointColors: ['#aaaaaa', '#bbbbbb'] }],
    });
    const dots = c.dots(0);
    expect(dots.map((d) => d.color)).toEqual(['#aaaaaa', '#bbbbbb', '#111111', '#111111']);
    expect(c.hasMultiColor()).toBe(true);
  });

  it('reports no multicolour when no series supplies point colours', async () => {
    const c = await chart({ categories: CATS, series: ONE });
    expect(c.hasMultiColor()).toBe(false);
    expect(c.dots(0).every((d) => d.color === '#3b82f6')).toBe(true);
  });

  it('emits one multicolour segment per adjacent pair, and none for a lone point', async () => {
    const c = await chart({
      categories: CATS,
      series: [{ label: 'S', data: [1, 2, 3, 4], pointColors: ['#a', '#b', '#c', '#d'] }],
    });
    const segs = c.multiColorSegments(0);
    expect(segs.length).toBe(3);
    // Segment i is coloured by its END point, so the first colour is unused.
    expect(segs.map((s) => s.color)).toEqual(['#b', '#c', '#d']);
    expect(segs.every((s) => !s.d.includes('NaN'))).toBe(true);

    const lone = await chart({
      categories: ['A'],
      series: [{ label: 'S', data: [1], pointColors: ['#a'] }],
    });
    expect(lone.multiColorSegments(0)).toEqual([]);
  });

  it.each([
    ['square', 'h '],
    ['diamond', 'L '],
    ['triangle', 'L '],
  ] as const)('draws a %s marker as a closed path', async (markerShape, fragment) => {
    const c = await chart({ categories: CATS, series: ONE });
    const d = c.markerPath(markerShape, 10, 20);
    expect(d).toContain(fragment);
    expect(d.endsWith('Z')).toBe(true);
    expect(d).not.toContain('NaN');
  });

  it('draws no path for a circle marker — the template uses <circle> for that', async () => {
    const c = await chart({ categories: CATS, series: ONE });
    expect(c.markerPath('circle', 10, 20)).toBe('');
    expect(c.markerPath(undefined, 10, 20)).toBe('');
  });

  it('positions inversed dots by value on x and index on y', async () => {
    const c = await chart({
      categories: CATS,
      series: [{ label: 'S', data: [10, 30, 20, 40], pointColors: ['#a'] }],
      chartType: 'inversed',
    });
    const dots = c.dotsInv(0);
    expect(dots[0].x).toBe(c.xForValue_inv(10));
    expect(dots[0].y).toBe(c.yForIndex_inv(0));
    expect(dots[0].color).toBe('#a');
    expect(dots[1].color).toBe(c.seriesColors()[0]);
  });

  it('curves the inversed path for a spline chart', async () => {
    const straight = await chart({ categories: CATS, series: ONE, chartType: 'inversed' });
    expect(straight.inversedPath(0)).toContain(' L ');

    const curved = await chart({
      categories: CATS,
      series: [{ label: 'S', data: [10, 30, 20, 40], smooth: true }],
      chartType: 'inversed',
    });
    expect(curved.inversedPath(0)).toContain(' C ');
  });
});

describe('SvLineChartComponent — zones', () => {
  const ZONED: LineChartSeries[] = [
    {
      label: 'Rain',
      data: [10, 60, 80, 40],
      zones: [
        { end: 50, color: '#ef4444', label: 'Low' },
        { start: 50, end: 70, color: '#f59e0b', label: 'Medium', dashArray: '4,2' },
        { start: 70, color: '#10b981', label: 'High' },
      ],
    },
  ];

  it('clips an open-topped zone from the top of the plot', async () => {
    const c = await chart({ categories: CATS, series: ZONED });
    // Zone 2 has no `end`: it must reach y = 0, not be dropped.
    const top = c.zoneClipRect(0, 2);
    expect(top.y).toBe(0);
    expect(top.height).toBeGreaterThan(0);
  });

  it('clips an open-bottomed zone down to the baseline', async () => {
    const c = await chart({ categories: CATS, series: ZONED });
    const bottom = c.zoneClipRect(0, 0);
    expect(bottom.y).toBe(c.yForValue(50));
    expect(bottom.y + bottom.height).toBe(c.plotH());
  });

  it('never emits a negative clip height for an inverted zone', async () => {
    // start above end is a caller mistake; a negative <rect height> is invalid
    // SVG and the browser drops the whole clipPath, hiding the line entirely.
    const c = await chart({
      categories: CATS,
      series: [{ label: 'S', data: [10, 20], zones: [{ start: 80, end: 20, color: '#f00' }] }],
    });
    expect(c.zoneClipRect(0, 0).height).toBe(0);
  });

  it('gives every zone clip an id unique to this component instance', async () => {
    const a = await chart({ categories: CATS, series: ZONED });
    // Both instances must share one application: ids are per application (svUniqueId).
    const second = TestBed.createComponent(SvLineChartComponent);
    second.componentRef.setInput('categories', CATS);
    second.componentRef.setInput('series', ZONED);
    second.detectChanges();
    await second.whenStable();
    const b = second.componentInstance;
    // Two of this chart on one page must not share a clipPath — `url(#…)` is
    // document-global and the first match wins.
    expect(a.zoneClipId(0, 0)).not.toBe(b.zoneClipId(0, 0));
    expect(a.zoneClipId(0, 0)).not.toBe(a.zoneClipId(0, 1));
  });

  it('lists each zone label once for the legend and skips unlabelled zones', async () => {
    const c = await chart({
      categories: CATS,
      series: [
        ZONED[0],
        // Repeats "Low" and adds one with no label at all.
        { label: 'Snow', data: [1, 2, 3, 4], zones: [{ end: 50, color: '#ef4444', label: 'Low' }, { start: 90, color: '#000' }] },
      ],
    });
    expect(c.hasZones()).toBe(true);
    expect(c.uniqueZoneLabels().map((z) => z.label)).toEqual(['Low', 'Medium', 'High']);
    expect(c.uniqueZoneLabels()[1].dashArray).toBe('4,2');
  });

  it('reports no zones and an empty legend for a plain series', async () => {
    const c = await chart({ categories: CATS, series: ONE });
    expect(c.hasZones()).toBe(false);
    expect(c.uniqueZoneLabels()).toEqual([]);
  });
});

describe('SvLineChartComponent — value formatting', () => {
  it('shows small numbers verbatim', async () => {
    const c = await chart({ categories: CATS, series: ONE });
    expect(c.formatValue(0)).toBe('0');
    expect(c.formatValue(999)).toBe('999');
    expect(c.formatValue(-42)).toBe('-42');
  });

  it('compacts thousands, keeping a decimal only below ten thousand', async () => {
    const c = await chart({ categories: CATS, series: ONE });
    expect(c.formatValue(2_500)).toBe('2.5k');
    expect(c.formatValue(24_000)).toBe('24k');
    expect(c.formatValue(3_400_000)).toBe('3.4M');
  });

  it('compacts a large negative magnitude as well as a positive one', async () => {
    const c = await chart({ categories: CATS, series: ONE });
    expect(c.formatValue(-2_500)).toBe('-2.5k');
    expect(c.formatValue(-3_400_000)).toBe('-3.4M');
  });

  it('renders every stacked-percent value as a whole percentage', async () => {
    const c = await chart({ categories: CATS, series: TWO, chartType: 'stacked-percent' });
    expect(c.formatValue(33.33)).toBe('33%');
    // The percent rule wins over the thousands rule on this chart type.
    expect(c.formatValue(2_500)).toBe('2500%');
  });
});
