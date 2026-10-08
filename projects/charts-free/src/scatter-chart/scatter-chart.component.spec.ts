import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvScatterChartComponent,
  type ScatterBinEvent,
  type ScatterPointEvent,
  type ScatterSeries,
} from './scatter-chart.component';

/**
 * A scatter plot is the one chart whose axes come entirely from the data: there
 * is no category list to fall back on, so every scale is `(v - min) / (max - min)`
 * over whatever the host happened to send. That makes three inputs dangerous and
 * all three are plausible:
 *
 *  • a series whose `points` array is empty — `Math.min(...[])` is `Infinity`,
 *    `Math.max(...[])` is `-Infinity`, and `Infinity / -Infinity` is `NaN`;
 *  • every point sharing one x (or one y) — a zero-width span is a divide by zero;
 *  • a single point — the same zero span, reached by a different route.
 *
 * `chartIsEmpty` only looks at `series().length`, so the first case renders a
 * real SVG rather than the empty state, and the grid lines and tick labels are
 * drawn from `scaleX`/`scaleY` regardless of whether any point exists.
 *
 * On top of those, the three defects this chart's P1 work is about: an axis that
 * printed numbers belonging to no data, a plot that drew the same picture for a
 * hundred points and ten thousand, and one tab stop per datum.
 */

async function setup(inputs: Partial<ComponentInput<SvScatterChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvScatterChartComponent, {
    inputs: inputs as ComponentInput<SvScatterChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const SERIES: ScatterSeries[] = [
  {
    name: 'Group A',
    color: '#6366f1',
    points: [
      { x: 0, y: 0 },
      { x: 50, y: 25, label: 'mid' },
      { x: 100, y: 100 },
    ],
  },
  {
    name: 'Group B',
    color: '#10b981',
    points: [{ x: 20, y: 80 }],
  },
];

/** A cloud of `n` points, seeded so a failure is reproducible. */
function cloud(n: number, spread = 100): ScatterSeries[] {
  let seed = 20260908;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return [{
    name: 'Cloud',
    color: '#6366f1',
    points: Array.from({ length: n }, () => ({ x: random() * spread, y: random() * spread })),
  }];
}

const texts = (host: HTMLElement) =>
  [...host.querySelectorAll('svg text')].map(t => t.textContent?.trim() ?? '');

const noticeText = (host: HTMLElement) =>
  host.querySelector('[data-sv-notice]')?.textContent?.trim() ?? '';

describe('SvScatterChartComponent — scales', () => {
  it('maps the data range onto the plot box, edge to edge', async () => {
    const { c } = await setup({ series: SERIES });
    // x spans 0..100 across both series; y spans 0..100, and a nice axis over
    // 0..100 is exactly 0..100.
    expect(c.scaleX(0)).toBe(c.pad.l);
    expect(c.scaleX(100)).toBe(c.pad.l + c.innerW());
    expect(c.scaleX(50)).toBeCloseTo(c.pad.l + c.innerW() / 2, 9);
    // y is inverted: the maximum sits at the TOP of the plot.
    expect(c.scaleY(100)).toBe(c.pad.t);
    expect(c.scaleY(0)).toBe(c.pad.t + c.innerH());
  });

  it('honours the width and height in the inner box', async () => {
    const { c } = await setup({ series: SERIES, width: 600, height: 400 });
    expect(c.innerW()).toBe(600 - c.pad.l - c.pad.r);
    expect(c.innerH()).toBe(400 - c.pad.t - c.pad.b);
  });

  /**
   * ★★★ THE AXIS REGRESSION. The grid and its labels were the literal
   *     `[0, 25, 50, 75, 100]` on both axes while the scales mapped the DATA
   *     range across the plot. Salaries against years therefore drew points at
   *     118,400 beside an axis labelled `0 25 50 75 100`, with four of the five
   *     grid lines outside the plot box. The chart was not unhelpful, it was false.
   */
  it('labels the axes with the data, not with 0–100', async () => {
    const { host } = await setup({
      series: [{
        name: 'Pay', color: '#6366f1',
        points: [{ x: 2015, y: 45_000 }, { x: 2020, y: 88_000 }, { x: 2024, y: 120_000 }],
      }],
    });
    const labels = texts(host);
    expect(labels).not.toContain('25');
    expect(labels).not.toContain('75');
    expect(labels).toContain('120k');   // the y axis, compacted
    expect(labels).toContain('2024');   // the x axis, NOT compacted to 2.0k
  });

  it('keeps every grid line inside the plot box', async () => {
    const { c, host } = await setup({
      series: [{
        name: 'Pay', color: '#6366f1',
        points: [{ x: 2015, y: 45_000 }, { x: 2024, y: 120_000 }],
      }],
    });
    const left = c.pad.l;
    const right = c.pad.l + c.innerW();
    for (const line of host.querySelectorAll('line')) {
      const x1 = Number(line.getAttribute('x1'));
      expect(x1).toBeGreaterThanOrEqual(left - 0.01);
      expect(x1).toBeLessThanOrEqual(right + 0.01);
    }
  });

  it('centres a series whose points all share one coordinate', async () => {
    // max - min is zero here on both axes, which is a divide by zero on every
    // scale that uses it. The axis is padded around the value instead.
    const { c } = await setup({
      series: [{ name: 'Flat', color: '#f00', points: [{ x: 7, y: 7 }, { x: 7, y: 7 }] }],
    });
    expect(c.scaleX(7)).toBeCloseTo(c.pad.l + c.innerW() / 2, 6);
    expect(c.scaleY(7)).toBeCloseTo(c.pad.t + c.innerH() / 2, 6);
  });

  it('plots a lone point without dividing by a zero span', async () => {
    const { c, host } = await setup({
      series: [{ name: 'One', color: '#f00', points: [{ x: 42, y: 42 }] }],
    });
    expect(host.innerHTML).not.toContain('NaN');
    const dot = host.querySelector('circle')!;
    const cx = Number(dot.getAttribute('cx'));
    expect(cx).toBeGreaterThan(c.pad.l);
    expect(cx).toBeLessThan(c.pad.l + c.innerW());
  });

  /**
   * ★ REGRESSION — a series with no points used to render `NaN` coordinates.
   *
   * `chartIsEmpty` is `series().length === 0`, so a host that has received the
   * series list but not yet their points (a two-request load, or a filter that
   * matched nothing inside every group) is NOT the empty state: the SVG renders,
   * and every grid line and tick label is positioned by `scaleX`/`scaleY`. With
   * no values at all `Math.min(...[])` is `Infinity` and `Math.max(...[])` is
   * `-Infinity`, so `span` was `-Infinity` — truthy, so the `|| 1` guard did not
   * fire — and `(x - Infinity) / -Infinity` is `NaN`. Every line and label came
   * out at `x1="NaN"`, which browsers drop silently: an axis-less blank box with
   * no error anywhere.
   */
  it('falls back to a drawable axis when no series has a single point', async () => {
    const { c, host } = await setup({
      series: [
        { name: 'Empty A', color: '#f00', points: [] },
        { name: 'Empty B', color: '#0f0', points: [] },
      ],
    });
    expect(c.chartIsEmpty()).toBe(false); // the SVG really is rendered
    expect(host.innerHTML).not.toContain('NaN');
    expect(c.xScale()).toMatchObject({ min: 0, max: 100 });
    expect(c.yScale()).toMatchObject({ min: 0, max: 100 });
    expect(c.scaleX(0)).toBe(c.pad.l);
    expect(c.scaleX(100)).toBe(c.pad.l + c.innerW());

    const gridXs = [...host.querySelectorAll('line')].map(l => l.getAttribute('x1'));
    expect(gridXs.every(x => x !== null && Number.isFinite(Number(x)))).toBe(true);
  });

  it('draws the grid only when asked', async () => {
    const { c, host: withGrid } = await setup({ series: SERIES });
    const { host: without } = await setup({ series: SERIES, showGrid: false });
    const ticks = c.gridLines().xTicks.length + c.gridLines().yTicks.length;
    // Two axis lines survive in both; the dashed grid lines do not.
    expect(without.querySelectorAll('line').length).toBe(2);
    expect(withGrid.querySelectorAll('line').length).toBe(2 + ticks);
  });
});

describe('SvScatterChartComponent — data hygiene', () => {
  /**
   * ★★★ One row with a missing x used to blank the WHOLE chart: `Math.min` over a
   *     list containing `NaN` is `NaN`, so both axis ends were `NaN` and every
   *     coordinate in the SVG was `NaN`. Browsers drop those silently.
   */
  it('drops a point with no position and keeps the plot drawable', async () => {
    const { c, host } = await setup({
      series: [{
        name: 'S', color: '#f00',
        points: [
          { x: 1, y: 1 },
          { x: Number.NaN, y: 5 },
          { x: 4, y: Number.POSITIVE_INFINITY },
          { x: 3, y: 3 },
        ],
      }],
    });
    expect(host.innerHTML).not.toContain('NaN');
    expect(c.pointMarks().length).toBe(2);
    expect(noticeText(host)).toContain('2 points of 4 had no usable x or y');
  });

  it('says so in the singular for exactly one bad point', async () => {
    const { host } = await setup({
      series: [{ name: 'S', color: '#f00', points: [{ x: 1, y: 1 }, { x: Number.NaN, y: 2 }] }],
    });
    expect(noticeText(host)).toContain('1 point of 2 had no usable x or y and is not plotted');
  });

  /**
   * ★★ A circle with `r="NaN"` is not painted, and the rest of the plot looks
   *    perfectly healthy — one point missing with nothing to say which or why.
   */
  it('falls back to the default radius for an undrawable size', async () => {
    const { host } = await setup({
      dotSize: 5,
      series: [{
        name: 'S', color: '#f00',
        points: [{ x: 1, y: 1, size: Number.NaN }, { x: 2, y: 2, size: -4 }, { x: 3, y: 3, size: 9 }],
      }],
    });
    const radii = [...host.querySelectorAll('circle')].map(d => d.getAttribute('r'));
    expect(radii).toEqual(['5', '5', '9']);
    expect(noticeText(host)).toContain('2 points had a size that cannot be drawn');
  });

  it('lets a point override the global dot size', async () => {
    const { host } = await setup({
      series: [{ name: 'S', color: '#f00', points: [{ x: 1, y: 1, size: 12 }, { x: 2, y: 2 }] }],
      dotSize: 4,
    });
    const dots = host.querySelectorAll('circle');
    expect(dots[0].getAttribute('r')).toBe('12');
    expect(dots[1].getAttribute('r')).toBe('4');
  });

  /** ★★ Coincident points are invisible: the fourth mark is the first one's pixels. */
  it('says how many points are hidden underneath each other', async () => {
    const { host } = await setup({
      series: [{
        name: 'S', color: '#f00',
        points: [{ x: 3, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 3 }, { x: 8, y: 8 }, { x: 8, y: 8 }],
      }],
    });
    expect(noticeText(host)).toContain('5 points share 2 exact coordinates');
  });

  /**
   * ★★ An outlier stretches the axis to reach it and squashes the rest into a
   *    corner. The plot is accurate and unreadable, and only a notice can say that
   *    a filter would fix it.
   */
  it('says when an outlier is holding an axis open', async () => {
    const points = [
      ...Array.from({ length: 200 }, (_, i) => ({ x: i % 10, y: i % 5 })),
      { x: 5000, y: 3 },
      { x: 6000, y: 4 },
    ];
    const { host } = await setup({ series: [{ name: 'S', color: '#f00', points }], xLabel: 'Age' });
    expect(noticeText(host)).toContain('2 extreme Age values hold the horizontal axis open');
    // The vertical axis is fine, so it is not mentioned.
    expect(noticeText(host)).not.toContain('vertical axis open');
  });

  it('says nothing at all when the data is clean', async () => {
    const { host } = await setup({ series: SERIES });
    expect(host.querySelector('[data-sv-notice]')).toBeNull();
  });
});

describe('SvScatterChartComponent — sampling disclosure', () => {
  /**
   * ★★★ `slice(0, limit)` is the obvious cap and it is a different chart: feeds
   *     arrive sorted, so the first tenth of the rows is the first tenth of the
   *     RANGE. A stride keeps the shape — and either way the reader is told.
   */
  it('never plots a subset without saying so', async () => {
    const { c, host } = await setup({ series: cloud(500), maxPoints: 100 });
    expect(c.pointMarks().length).toBeLessThanOrEqual(100);
    const notice = noticeText(host);
    expect(notice).toContain('of 500 points');
    expect(notice).toContain('every 5th');
    expect(notice).toContain('shape of the cloud is preserved');
  });

  it('says nothing about sampling when nothing was cut', async () => {
    const { host } = await setup({ series: cloud(50), maxPoints: 100 });
    expect(noticeText(host)).not.toContain('Showing');
  });

  it('treats no cap as no cap', async () => {
    const { c } = await setup({ series: cloud(300), maxPoints: 0, binThreshold: 5000 });
    expect(c.pointMarks().length).toBe(300);
  });

  /** The axis must describe the DATA, not the sample that happened to be kept. */
  it('keeps the axis over every point, not just the drawn ones', async () => {
    const points = [...Array.from({ length: 99 }, (_, i) => ({ x: i, y: i })), { x: 5000, y: 5000 }];
    const { c } = await setup({ series: [{ name: 'S', color: '#f00', points }], maxPoints: 10 });
    expect(c.xScale().max).toBeGreaterThanOrEqual(5000);
  });
});

describe('SvScatterChartComponent — density bins', () => {
  it('draws points below the threshold and bins above it', async () => {
    const { c: small } = await setup({ series: cloud(50), binThreshold: 100 });
    expect(small.drawMode()).toBe('points');
    const { c: big } = await setup({ series: cloud(300), binThreshold: 100 });
    expect(big.drawMode()).toBe('bins');
  });

  it('honours an explicit mode either way', async () => {
    const { c: forced } = await setup({ series: cloud(20), renderMode: 'bins' });
    expect(forced.drawMode()).toBe('bins');
    const { c: kept } = await setup({ series: cloud(500), renderMode: 'points', binThreshold: 10 });
    expect(kept.drawMode()).toBe('points');
  });

  /**
   * ★★★ THE DEFECT BINNING EXISTS FOR, as a property: a bin plot must account for
   *     every point it replaced. A density picture that quietly loses a tenth of
   *     the cloud is worse than the overplotted scatter, because the count beside
   *     it makes it look authoritative.
   */
  it('accounts for every drawn point exactly once', async () => {
    const { c, host } = await setup({ series: cloud(800), renderMode: 'bins' });
    const marks = c.binMarks();
    expect(marks.reduce((n, m) => n + m.count, 0)).toBe(800);
    expect(marks.length).toBeLessThan(800);
    expect(host.querySelectorAll('svg path[role="button"]').length).toBe(marks.length);
  });

  it('shades by count, on a ramp that separates the small bins', async () => {
    const { c } = await setup({ series: cloud(800), renderMode: 'bins' });
    const steps = new Set(c.binMarks().map(m => m.step));
    expect(steps.size).toBeGreaterThan(1);
    for (const step of steps) {
      expect(step).toBeGreaterThanOrEqual(1);
      expect(step).toBeLessThanOrEqual(5);
    }
    const peak = c.binMarks().find(m => m.count === c.peakBinCount())!;
    expect(peak.step).toBe(5);
  });

  it('keys the shading with the counts it actually covers', async () => {
    const { c, host } = await setup({ series: cloud(800), renderMode: 'bins' });
    const keys = c.densityLegend();
    expect(keys.length).toBeGreaterThan(1);
    expect(host.textContent).toContain('Points per bin');
    // No key may claim a range no bin is in.
    for (const key of keys) {
      const bounds = key.label.split('–').map(Number);
      expect(c.binMarks().some(m => m.step === key.step && m.count === bounds[0])).toBe(true);
    }
  });

  it('reports the series breakdown inside a bin', async () => {
    const { c } = await setup({
      renderMode: 'bins',
      series: [
        { name: 'A', color: '#f00', points: [{ x: 5, y: 5 }, { x: 5, y: 5 }] },
        { name: 'B', color: '#0f0', points: [{ x: 5, y: 5 }] },
      ],
    });
    const [only] = c.binMarks();
    expect(only.count).toBe(3);
    expect(only.event.shares).toEqual([
      { series: 'A', color: '#f00', count: 2 },
      { series: 'B', color: '#0f0', count: 1 },
    ]);
  });

  it('places a bin at the data coordinate it covers', async () => {
    const { c } = await setup({
      renderMode: 'bins',
      series: [{ name: 'S', color: '#f00', points: [{ x: 40, y: 60 }] }],
    });
    // Within a hexagon of the point: a bin reports its CENTRE, and the point can
    // sit anywhere inside it.
    const [only] = c.binMarks();
    expect(only.event.x).toBeCloseTo(40, -1);
    expect(only.event.y).toBeCloseTo(60, -1);
  });

  it('explains what the shading means', async () => {
    const { host } = await setup({ series: cloud(400), renderMode: 'bins' });
    const notice = noticeText(host);
    expect(notice).toContain('400 points aggregated into');
    expect(notice).toContain('hexagonal bin');
    expect(notice).toContain('the densest holds');
  });

  it('does not repeat the overlap sentence when the count already answers it', async () => {
    const stacked = Array.from({ length: 40 }, () => ({ x: 5, y: 5 }));
    const { host } = await setup({
      renderMode: 'bins',
      series: [{ name: 'S', color: '#f00', points: stacked }],
    });
    expect(noticeText(host)).not.toContain('on top of each other');
  });
});

describe('SvScatterChartComponent — the canvas path', () => {
  it('paints to a canvas above the documented switch-over point', async () => {
    const { c } = await setup({ series: cloud(400), renderMode: 'points', canvasThreshold: 100 });
    expect(c.useRaster()).toBe(true);
    // One image instead of 400 nodes.
    expect(c.pointMarks().length).toBe(0);
    expect(c.rasterPlan().length).toBe(400);
  });

  it('stays in SVG below it', async () => {
    const { c } = await setup({ series: cloud(50), renderMode: 'points', canvasThreshold: 100 });
    expect(c.useRaster()).toBe(false);
    expect(c.rasterPlan()).toEqual([]);
  });

  it('plans the same marks the SVG path would have drawn', async () => {
    const series = cloud(200);
    const { c: svg } = await setup({ series, renderMode: 'points', canvasThreshold: 500, dotSize: 4 });
    const { c: raster } = await setup({ series, renderMode: 'points', canvasThreshold: 100, dotSize: 4 });
    expect(raster.rasterPlan().length).toBe(svg.pointMarks().length);
    expect(raster.rasterPlan()[7]).toEqual({
      x: svg.pointMarks()[7].cx,
      y: svg.pointMarks()[7].cy,
      r: svg.pointMarks()[7].radius,
      color: svg.pointMarks()[7].color,
    });
  });

  /**
   * ★★ Without a 2-D context — a server render, a locked-down browser, this test
   *    DOM — the plot must still be a plot. The hexagons stay shaded, so the
   *    fallback is a correct hexbin rather than an empty box, and the element tree
   *    is the same either way so nothing structural changes at hydration.
   */
  it('degrades to a visible hexbin when there is no canvas to paint on', async () => {
    const { c, host } = await setup({ series: cloud(400), renderMode: 'points', canvasThreshold: 100 });
    expect(c.binsAreVisible()).toBe(true);
    expect(host.querySelectorAll('svg path[role="button"]').length).toBeGreaterThan(0);
    expect(host.querySelector('image')).toBeNull();
  });

  it('makes the bins the hover and keyboard targets once rasterised', async () => {
    const { c, host } = await setup({ series: cloud(400), renderMode: 'points', canvasThreshold: 100 });
    expect(c.focusTargets()).toBe('bins');
    expect(host.querySelectorAll('circle[role="button"]').length).toBe(0);
    // This DOM has no 2-D context, so the hexagons are the picture as well as the
    // targets — and the notice must say so rather than describe a raster that
    // was never painted.
    expect(noticeText(host)).toContain('could not be painted as one image here');
    expect(noticeText(host)).not.toContain('the hexagons over it');
  });

  /** ★ Coincident points in one series used to share a `@for` track key (NG0955). */
  it('tracks coincident points in one series without a duplicate key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { host } = await setup({
      series: [{ name: 'S', color: '#f00', points: [{ x: 3, y: 3 }, { x: 3, y: 3 }, { x: 8, y: 8 }] }],
    });
    expect(host.querySelectorAll('circle[role="button"]').length).toBe(3);
    expect(warn.mock.calls.some(c => String(c[0]).includes('NG0955'))).toBe(false);
    warn.mockRestore();
  });
});

describe('SvScatterChartComponent — labelling', () => {
  it('summarises the axes and the point counts', async () => {
    const { c } = await setup({ series: SERIES, title: 'Cohorts', xLabel: 'Age', yLabel: 'Score' });
    expect(c.resolvedAriaLabel()).toBe(
      'Cohorts. Age versus Score. Group A: 3 points, Group B: 1 point.',
    );
  });

  it('tells a keyboard user how to move once bins are the targets', async () => {
    const { c } = await setup({ series: cloud(400), renderMode: 'bins', title: 'Cloud' });
    expect(c.resolvedAriaLabel()).toContain('density bins');
    expect(c.resolvedAriaLabel()).toContain('Use the arrow keys');
  });

  it('falls back to the bare title when there is no series to describe', async () => {
    const { c } = await setup({ series: [], title: 'Cohorts' });
    expect(c.resolvedAriaLabel()).toBe('Cohorts');
    const { c: untitled } = await setup({ series: [] });
    expect(untitled.resolvedAriaLabel()).toBe('Scatter plot');
  });

  it('prefers an explicit aria-label over the generated one', async () => {
    const { c } = await setup({ series: SERIES, ariaLabel: 'Custom name' });
    expect(c.resolvedAriaLabel()).toBe('Custom name');
  });

  it('puts the point label first when one is given', async () => {
    const { c } = await setup({ series: SERIES, xLabel: 'Age', yLabel: 'Score' });
    expect(c.pointAriaLabel(SERIES[0], SERIES[0].points[1])).toBe(
      'mid, Group A: Age 50, Score 25',
    );
    expect(c.pointAriaLabel(SERIES[0], SERIES[0].points[0])).toBe('Group A: Age 0, Score 0');
  });

  it('names a bin by where it is and how much is in it', async () => {
    const { host } = await setup({
      renderMode: 'bins', xLabel: 'Age', yLabel: 'Score',
      series: [{ name: 'S', color: '#f00', points: [{ x: 40, y: 60 }, { x: 40, y: 60 }] }],
    });
    const label = host.querySelector('svg path[role="button"]')!.getAttribute('aria-label')!;
    expect(label).toMatch(/^Age about -?[\d.]+, Score about -?[\d.]+: 2 points$/);
  });
});

describe('SvScatterChartComponent — the summary table', () => {
  it('lists the points when points are what a reader can reach', async () => {
    const { host } = await setup({ series: SERIES, xLabel: 'Age', yLabel: 'Score' });
    const table = host.querySelector('table')!;
    expect(table).not.toBeNull();
    const headers = [...table.querySelectorAll('thead th')].map(h => h.textContent?.trim());
    expect(headers).toEqual(['Point', 'Series', 'Age', 'Score']);
    expect(table.querySelectorAll('tbody tr').length).toBe(4);
    expect(table.textContent).toContain('mid');
  });

  it('lists the bins when bins are what a reader can reach', async () => {
    const { c, host } = await setup({ series: cloud(400), renderMode: 'bins' });
    const table = host.querySelector('table')!;
    const headers = [...table.querySelectorAll('thead th')].map(h => h.textContent?.trim());
    expect(headers).toEqual(['Bin', 'Points', 'Series']);
    expect(table.querySelectorAll('tbody tr').length).toBe(c.binMarks().length);
    expect(table.querySelector('caption')?.textContent).toContain('density bins');
  });

  it('walks the table in the order the arrow keys walk the plot', async () => {
    const { c } = await setup({ series: cloud(400), renderMode: 'bins' });
    const rows = c.a11ySummary().rows.map(r => r.key);
    const marks = c.binMarks().map(m => `${m.cx},${m.cy}`);
    expect(rows).toEqual(marks);
  });
});

describe('SvScatterChartComponent — interaction', () => {
  it('reports the point under the pointer and marks only that one active', async () => {
    const { c, host } = await setup({ series: SERIES });
    const seen: ScatterPointEvent[] = [];
    c.pointHover.subscribe(e => seen.push(e));

    const dots = host.querySelectorAll('circle');
    dots[1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

    expect(seen).toEqual([
      { series: 'Group A', point: SERIES[0].points[1], color: '#6366f1' },
    ]);
    expect(c.isActive(SERIES[0], SERIES[0].points[1])).toBe(true);
    // Same point object, different series, and same series, different point.
    expect(c.isActive(SERIES[1], SERIES[0].points[1])).toBe(false);
    expect(c.isActive(SERIES[0], SERIES[0].points[0])).toBe(false);
  });

  it('grows the active dot and leaves the rest alone', async () => {
    const { host, fixture } = await setup({ series: SERIES, dotSize: 5 });
    const dots = host.querySelectorAll('circle');
    expect(dots[0].getAttribute('r')).toBe('5');
    dots[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    fixture.detectChanges();
    expect(dots[0].getAttribute('r')).toBe('8');
    expect(dots[1].getAttribute('r')).toBe('5');
  });

  it('clears the hover on leave, so nothing stays highlighted', async () => {
    const { c, host } = await setup({ series: SERIES });
    const dots = host.querySelectorAll('circle');
    dots[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(c.hoveredPoint()).not.toBeNull();
    dots[0].dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(c.hoveredPoint()).toBeNull();
    expect(c.isActive(SERIES[0], SERIES[0].points[0])).toBe(false);
  });

  it('emits a selection on click and on Enter', async () => {
    const { c, host } = await setup({ series: SERIES });
    const picked: ScatterPointEvent[] = [];
    c.pointSelect.subscribe(e => picked.push(e));

    const dot = host.querySelectorAll('circle')[3];
    dot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    dot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(picked.length).toBe(2);
    expect(picked[0]).toEqual({ series: 'Group B', point: SERIES[1].points[0], color: '#10b981' });
  });

  it('hands the host the real rows behind a bin', async () => {
    const { c, host } = await setup({
      renderMode: 'bins',
      series: [{ name: 'S', color: '#f00', points: [{ x: 5, y: 5, label: 'a' }, { x: 5, y: 5, label: 'b' }] }],
    });
    const picked: ScatterBinEvent[] = [];
    c.binSelect.subscribe(e => picked.push(e));
    host.querySelector('svg path[role="button"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(picked.length).toBe(1);
    expect(picked[0].points.map(p => p.label)).toEqual(['a', 'b']);
  });

  it('renders the empty state instead of a plot when there is no series', async () => {
    const { c, host } = await setup({ series: [], emptyMessage: 'Nothing matched' });
    expect(c.chartIsEmpty()).toBe(true);
    expect(host.querySelector('svg circle')).toBeNull();
    expect(host.textContent).toContain('Nothing matched');
  });
});

describe('SvScatterChartComponent — keyboard navigation', () => {
  /**
   * ★★★ THE `CH-16-I2` DEFECT. Every mark carried `tabindex="0"`, so a plot of
   *     four hundred points put four hundred tab stops between the reader and the
   *     rest of the page. Nobody presses Tab four hundred times, which makes it
   *     the same as unreachable. One tab stop, walked by the arrow keys.
   */
  it('puts exactly one tab stop in the plot', async () => {
    const { host } = await setup({ series: cloud(200), renderMode: 'points', canvasThreshold: 500 });
    const stops = [...host.querySelectorAll('[data-mark-index]')]
      .filter(el => el.getAttribute('tabindex') === '0');
    expect(host.querySelectorAll('[data-mark-index]').length).toBe(200);
    expect(stops.length).toBe(1);
  });

  it('moves the tab stop with the arrow keys', async () => {
    const { host, fixture } = await setup({ series: SERIES });
    const svg = host.querySelector('svg')!;
    const press = (key: string) => {
      svg.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };
    const stopIndex = () => [...host.querySelectorAll('[data-mark-index]')]
      .findIndex(el => el.getAttribute('tabindex') === '0');

    expect(stopIndex()).toBe(0);
    press('ArrowRight');
    expect(stopIndex()).toBe(1);
    press('ArrowDown');
    expect(stopIndex()).toBe(2);
    press('ArrowLeft');
    expect(stopIndex()).toBe(1);
    press('ArrowUp');
    expect(stopIndex()).toBe(0);
  });

  it('does not run off either end', async () => {
    const { host, fixture } = await setup({ series: SERIES });
    const svg = host.querySelector('svg')!;
    const press = (key: string) => {
      svg.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };
    const stopIndex = () => [...host.querySelectorAll('[data-mark-index]')]
      .findIndex(el => el.getAttribute('tabindex') === '0');

    press('ArrowLeft');
    expect(stopIndex()).toBe(0);
    press('End');
    expect(stopIndex()).toBe(3);
    press('ArrowRight');
    expect(stopIndex()).toBe(3);
    press('Home');
    expect(stopIndex()).toBe(0);
  });

  it('announces whatever the tab stop landed on', async () => {
    const { c, host } = await setup({ series: SERIES });
    const svg = host.querySelector('svg')!;
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(c.hoveredPoint()?.series).toBe('Group B');
  });

  it('walks bins when bins are the targets', async () => {
    const { c, host } = await setup({ series: cloud(400), renderMode: 'bins' });
    const svg = host.querySelector('svg')!;
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(c.hoveredBin()).toBe(c.binMarks()[1].event);
  });

  it('ignores keys it does not own', async () => {
    const { host, fixture } = await setup({ series: SERIES });
    const svg = host.querySelector('svg')!;
    const before = host.querySelector('[tabindex="0"]')!.getAttribute('data-mark-index');
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    fixture.detectChanges();
    expect(host.querySelector('[tabindex="0"]')!.getAttribute('data-mark-index')).toBe(before);
  });
});
