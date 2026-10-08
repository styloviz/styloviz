/**
 * The async contract for every free chart that renders through `sv-chart-frame`.
 *
 * Before this file, chart coverage was one representative component and the
 * assumption that the other 58 behaved the same way because they all wrap
 * `sv-chart-frame`. That assumption is exactly what fails silently: a chart
 * that forgets the frame, or binds `[isEmpty]` to the wrong computed, keeps
 * drawing a convincing plot with nothing bound — which is the defect the
 * 2026-07-26 audit found in four of them.
 *
 * Adding a chart = adding a row. See `src/testing/async-contract.ts`.
 */
import { describeAsyncContracts } from '@testing/async-contract';
import { SvBarChartComponent } from './bar-chart/bar-chart.component';
import { SvColumnDrilldownChartComponent } from './bar-chart/column-drilldown-chart.component';
import { SvCylindricalColumnChartComponent } from './bar-chart/cylindrical-column-chart.component';
import { SvGradientBarChartComponent } from './bar-chart/gradient-bar-chart.component';
import { SvRangeColumnChartComponent } from './bar-chart/range-column-chart.component';
import { SvLineChartComponent } from './line-chart/line-chart.component';
import { SvStripLineChartComponent } from './line-chart/strip-line-chart.component';
import { SvTrendLineChartComponent } from './line-chart/trend-line-chart.component';
import { SvLiveStreamChartComponent } from './live-chart/live-stream-chart.component';
import { SvLiveUpdateChartComponent } from './live-chart/live-update-chart.component';
import { SvAxisLabelTemplateChartComponent } from './other-chart/axis-label-template-chart.component';
import { SvDateTimeCategoryChartComponent } from './other-chart/datetime-category-chart.component';
import { SvDefaultPieChartComponent } from './pie-chart/default-pie-chart.component';
import { SvRadarChartComponent } from './radar-chart/radar-chart.component';
import { SvPerformanceChartComponent } from './other-chart/performance-chart.component';
import { SvScatterChartComponent } from './scatter-chart/scatter-chart.component';
import { SvWaterfallChartComponent } from './waterfall-chart/waterfall-chart.component';

const CATEGORIES = ['Q1', 'Q2', 'Q3'];
const BARS = [{ label: 'Revenue', data: [3, 5, 4] }];
const LINES = [{ label: 'Users', data: [3, 5, 4] }];

describeAsyncContracts([
  { component: SvBarChartComponent, collection: 'datasets', rows: BARS,
    inputs: { categories: CATEGORIES }, loadedSelector: 'svg' },
  { component: SvColumnDrilldownChartComponent, collection: 'datasets', rows: BARS,
    inputs: { categories: CATEGORIES }, loadedSelector: 'svg' },
  { component: SvCylindricalColumnChartComponent, collection: 'datasets', rows: BARS,
    inputs: { categories: CATEGORIES }, loadedSelector: 'svg' },
  { component: SvGradientBarChartComponent, collection: 'datasets', rows: BARS,
    inputs: { categories: CATEGORIES }, loadedSelector: 'svg' },
  { component: SvRangeColumnChartComponent, collection: 'datasets',
    rows: [{ label: 'Temp', data: [{ low: 1, high: 5 }, { low: 2, high: 6 }, { low: 3, high: 7 }] }],
    inputs: { categories: CATEGORIES }, loadedSelector: 'svg' },
  { component: SvLineChartComponent, collection: 'series', rows: LINES,
    inputs: { categories: CATEGORIES }, loadedSelector: 'svg' },
  { component: SvStripLineChartComponent, collection: 'series', rows: LINES,
    inputs: { categories: CATEGORIES }, loadedSelector: 'svg' },
  { component: SvTrendLineChartComponent, collection: 'series', rows: LINES,
    inputs: { categories: CATEGORIES }, loadedSelector: 'svg' },
  { component: SvLiveStreamChartComponent, collection: 'series',
    rows: [{ label: 'CPU', color: '#3b82f6' }], loadedSelector: 'svg' },
  // `sources`, not `categories`: the bars come from the source's datasets, so a
  // host with axis labels and no source has nothing to plot.
  { component: SvLiveUpdateChartComponent, collection: 'sources',
    rows: [{ id: 'live', label: 'Live', datasets: BARS }],
    inputs: { categories: CATEGORIES }, loadedSelector: 'svg' },
  { component: SvAxisLabelTemplateChartComponent, collection: 'datasets', rows: BARS,
    inputs: { categories: [{ label: 'Q1' }, { label: 'Q2' }, { label: 'Q3' }] },
    loadedSelector: 'svg' },
  { component: SvDateTimeCategoryChartComponent, collection: 'series', rows: LINES,
    inputs: { categories: CATEGORIES }, loadedSelector: 'svg' },
  { component: SvDefaultPieChartComponent, collection: 'slices',
    rows: [{ label: 'A', value: 5 }, { label: 'B', value: 3 }], loadedSelector: 'svg' },
  { component: SvRadarChartComponent, collection: 'series',
    rows: [{ name: 'A', color: '#3b82f6', values: [1, 2, 3] }],
    inputs: { axes: CATEGORIES }, loadedSelector: 'svg' },
  { component: SvScatterChartComponent, collection: 'series',
    rows: [{ name: 'A', color: '#3b82f6', points: [{ x: 1, y: 2 }] }], loadedSelector: 'svg' },
  { component: SvWaterfallChartComponent, collection: 'data',
    rows: [{ label: 'Start', value: 100 }, { label: 'Q1', value: -20 }], loadedSelector: 'svg' },
  // Joined the table once it gained `data`, the same way `sv-live-stock-chart`
  // did. Before that it synthesised 10 000 random points in `ngOnInit` on every
  // instance, so it had no host series to have states about — and no reachable
  // empty state either. `options.pointCount` is now the opt-in for that
  // benchmark, and leaving it unset is what makes this row assertable.
  { component: SvPerformanceChartComponent, collection: 'data',
    rows: [3, 5, 4], loadedSelector: 'svg' },
]);
