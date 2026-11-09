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
export type { LineChartType, LineChartRenderer, LineChartMarkerShape, LineChartZone, LineChartAnnotation, LineChartSeries, LineChartOptions } from './line-chart/line-chart.component';
export { SvStripLineChartComponent } from './line-chart/strip-line-chart.component';
export type { StripOrientation, StripBand, StripSeries, StripLineChartOptions } from './line-chart/strip-line-chart.component';
export { SvTrendLineChartComponent } from './line-chart/trend-line-chart.component';
export type { TrendType, TrendLineSeries, TrendLineDefinition, TrendLineChartOptions } from './line-chart/trend-line-chart.component';
export { SvPieChartComponent } from './pie-chart/pie-chart.component';
export type { PieSlice, PieChartBaseOptions, PieChartOptions } from './pie-chart/pie-chart.types';
export { SvLiveUpdateChartComponent } from './live-chart/live-update-chart.component';
export { SvLiveStreamChartComponent } from './live-chart/live-stream-chart.component';
export { SvWaterfallChartComponent } from './waterfall-chart/waterfall-chart.component';
export type { WaterfallPoint } from './waterfall-chart/waterfall-chart.component';
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

export { SV_CHARTS_LABELS } from './charts-free.labels';
export type { SvChartsLabels } from './charts-free.labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from './charts-free.labels.packs';

// Types a public input or output names, so a host can name them too (FL-G8, check:public-types).
export type { AxisLabelBarEvent, AxisLabelCategory, AxisLabelTemplateDataset, AxisLabelTemplateOptions } from './other-chart/axis-label-template-chart.component';
export type { DateTimeCategoryEvent, DateTimeCategoryOptions, DateTimeSeries } from './other-chart/datetime-category-chart.component';
export type { LiveStreamChartOptions, LiveStreamSeries } from './live-chart/live-stream-chart.component';
export type { LiveUpdateChartOptions, LiveUpdateSource } from './live-chart/live-update-chart.component';
export type { WaterfallBarEvent, WaterfallChartOptions } from './waterfall-chart/waterfall-chart.component';
