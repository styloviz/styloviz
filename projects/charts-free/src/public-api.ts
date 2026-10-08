/**
 * @styloviz/charts (free) — standalone, no Pro dependency
 */

export type { BarChartVariant, BarChartOrientation, BarChartDataset, RangeChartDataset, DrilldownLevel, DrilldownDataset, BarChartOptions, ComputedBar, ComputedRangeBar, ComputedStackSegment, TooltipItem, DrilldownState } from './bar-chart/bar-chart.types';
export { DEFAULT_COLORS, STACK_COLORS, niceMax, gridTicks, gridTicksSymmetric, formatChartValue, formatPercent, resolveColor, rectPath, roundedTopRectPath } from './bar-chart/bar-chart.utils';
export { SvBarChartComponent } from './bar-chart/bar-chart.component';
export { SvRangeColumnChartComponent } from './bar-chart/range-column-chart.component';
export { SvCylindricalColumnChartComponent } from './bar-chart/cylindrical-column-chart.component';
export { SvGradientBarChartComponent } from './bar-chart/gradient-bar-chart.component';
export { SvColumnDrilldownChartComponent } from './bar-chart/column-drilldown-chart.component';
export { SvLineChartComponent } from './line-chart/line-chart.component';
export type { LineChartType, LineChartMarkerShape, LineChartZone, LineChartAnnotation, LineChartSeries, LineChartOptions } from './line-chart/line-chart.component';
export { SvStripLineChartComponent } from './line-chart/strip-line-chart.component';
export type { StripOrientation, StripBand, StripSeries, StripLineChartOptions } from './line-chart/strip-line-chart.component';
export { SvTrendLineChartComponent } from './line-chart/trend-line-chart.component';
export type { TrendType, TrendLineSeries, TrendLineDefinition, TrendLineChartOptions } from './line-chart/trend-line-chart.component';
export { SvDefaultPieChartComponent } from './pie-chart/default-pie-chart.component';
export type { PieSlice, PieChartBaseOptions, DefaultPieChartOptions } from './pie-chart/pie-chart.types';
export { SvLiveUpdateChartComponent } from './live-chart/live-update-chart.component';
export { SvLiveStreamChartComponent } from './live-chart/live-stream-chart.component';
export { SvWaterfallChartComponent } from './waterfall-chart/waterfall-chart.component';
export type { WaterfallPoint } from './waterfall-chart/waterfall-chart.component';
export { SvPerformanceChartComponent } from './other-chart/performance-chart.component';
export { SvDateTimeCategoryChartComponent } from './other-chart/datetime-category-chart.component';
export { SvAxisLabelTemplateChartComponent } from './other-chart/axis-label-template-chart.component';
export { DEMO_LIVE_SOURCES } from './live-chart/live-update-chart.component';

// ─── Radar Chart ──────────────────────────────────────────────────────────────
export { SvRadarChartComponent, DEMO_RADAR_AXES, DEMO_RADAR_SERIES } from './radar-chart/radar-chart.component';
export type { RadarSeries, RadarAxis, RadarPointEvent } from './radar-chart/radar-chart.component';

// ─── Scatter Chart ────────────────────────────────────────────────────────────
export { SvScatterChartComponent, DEMO_SCATTER_SERIES } from './scatter-chart/scatter-chart.component';
export type {
  ScatterPoint,
  ScatterSeries,
  ScatterPointEvent,
  ScatterBinEvent,
  ScatterBinShare,
  ScatterRenderMode,
} from './scatter-chart/scatter-chart.component';
