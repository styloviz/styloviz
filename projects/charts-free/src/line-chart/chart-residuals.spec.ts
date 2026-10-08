import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvStripLineChartComponent } from './strip-line-chart.component';
import {
  SvTrendLineChartComponent,
  type TrendLineSeries,
} from './trend-line-chart.component';

/**
 * The arms of the line-chart family that the main specs next door leave: the
 * third label placement of a strip band, and the two regression fits that have
 * to survive data they cannot actually fit.
 *
 * Several sibling guards in these two components are NOT here, because no input
 * reaches them — they carry `★ EQUIVALENT MUTANT` notes in the source:
 * `axisMax`'s `mv <= 0`, `yForValue`'s `range === 0`, `linearRegression`'s
 * `denom === 0`, the two `mat[i][i] === 0` skips in `polynomialFit` and the
 * `?? 0` on the moving-average lookup.
 */

async function strip(inputs: Partial<ComponentInput<SvStripLineChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvStripLineChartComponent, {
    inputs: inputs as ComponentInput<SvStripLineChartComponent>,
  });
  return { c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

async function trend(inputs: Partial<ComponentInput<SvTrendLineChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvTrendLineChartComponent, {
    inputs: inputs as ComponentInput<SvTrendLineChartComponent>,
  });
  return { c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const CATS = ['Jan', 'Feb', 'Mar', 'Apr'];

describe('SvStripLineChartComponent — band label placement', () => {
  it('anchors a band label at its start, its middle or its end', async () => {
    const at = async (labelPosition: 'start' | 'center' | 'end') => {
      const { c } = await strip({
        categories: CATS,
        series: [{ label: 'S', data: [1, 2, 3, 4] }],
        strips: [{
          start: 1, end: 3, color: '#eee', label: 'Peak',
          orientation: 'vertical', labelPosition,
        }],
      });
      return c.bandRects()[0];
    };

    const start = await at('start');
    const centre = await at('center');
    const end = await at('end');
    // A vertical band from category 1 to category 3 of four spans two thirds
    // of the plot; the three placements are start + 4, the midpoint, and end - 4.
    expect(start.labelX).toBeCloseTo(start.x + 4, 9);
    expect(centre.labelX).toBeCloseTo(centre.x + centre.width / 2, 9);
    expect(end.labelX).toBeCloseTo(end.x + end.width - 4, 9);
    expect(start.labelX).toBeLessThan(centre.labelX);
    expect(centre.labelX).toBeLessThan(end.labelX);
  });

  it('spreads a horizontal band label the same three ways', async () => {
    const at = async (labelPosition: 'start' | 'center' | 'end') => {
      const { c } = await strip({
        categories: CATS,
        series: [{ label: 'S', data: [1, 2, 3, 4] }],
        strips: [{
          start: 1, end: 3, color: '#eee', label: 'Zone',
          orientation: 'horizontal', labelPosition,
        }],
      });
      return c.bandRects()[0];
    };
    const start = await at('start');
    const centre = await at('center');
    const end = await at('end');
    expect(start.labelY).not.toBe(centre.labelY);
    expect(centre.labelY).not.toBe(end.labelY);
    expect(start.labelY).toBeLessThan(end.labelY);
  });
});

describe('SvTrendLineChartComponent — fits that cannot be fitted', () => {
  const SERIES: TrendLineSeries[] = [{ label: 'Users', data: [1, 4, 9, 16] }];

  it('falls back to the first reading when an exponential fit has no curve to take', async () => {
    // `log(y)` needs at least two POSITIVE readings. One positive value (or
    // none) is a real series — a metric that has only just started — and the
    // fit degenerates to a flat line at the first value rather than to NaN.
    // `trends[0]`'s type is always overridden by the `activeTrendType` signal
    // (the switcher), so the exponential fit has to be the SECOND definition.
    const { c, host } = await trend({
      categories: CATS,
      series: [{ label: 'Sparse', data: [7, 0, 0, 0] }],
      trends: [{ type: 'linear' }, { type: 'exponential' }],
      options: { showTypeSelector: false },
    });
    const path = c.trendPaths()[1].path;
    expect(c.trendPaths()[1].label).toBe('Exponential');
    expect(path).not.toContain('NaN');
    // Flat: every y in the path is the same.
    const ys = [...path.matchAll(/[ML] [\d.-]+ ([\d.-]+)/g)].map((m) => Number(m[1]));
    expect(new Set(ys).size).toBe(1);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('reports zero rather than NaN when there is no positive reading at all', async () => {
    const { c } = await trend({
      categories: CATS,
      series: [{ label: 'Flat', data: [0, 0, 0, 0] }],
      trends: [{ type: 'linear' }, { type: 'exponential' }],
      options: { showTypeSelector: false },
    });
    expect(c.trendPaths()[1].path).not.toContain('NaN');
  });

  it('says "category" for exactly one, and drops unlabelled series names', async () => {
    const { c } = await trend({
      categories: ['Only'],
      series: [{ label: '', data: [5] }],
    });
    expect(c.resolvedAriaLabel()).toBe('Trend line chart: 1 series across 1 category.');
  });

  it('draws no trend at all with fewer than two categories', async () => {
    // Every fit needs at least two x values to have a direction.
    const { c, host } = await trend({ categories: ['Only'], series: [{ label: 'S', data: [5] }] });
    expect(c.trendPaths()).toEqual([]);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('draws nothing for a trend that names a series the chart does not have', async () => {
    const { c } = await trend({
      categories: CATS,
      series: SERIES,
      trends: [{ type: 'linear', seriesIndex: 9 }],
    });
    expect(c.trendPaths()[0]).toEqual({ path: '', color: '', r2: null, label: '' });
  });
});
