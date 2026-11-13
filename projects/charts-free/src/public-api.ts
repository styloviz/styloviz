/**
 * @styloviz/charts (free) — standalone, no Pro dependency
 */

export type { BarChartVariant, BarChartOrientation, BarChartDataset, RangeChartDataset, DrilldownLevel, DrilldownDataset, BarChartOptions, ComputedBar, ComputedRangeBar, ComputedStackSegment, TooltipItem, DrilldownState } from '@styloviz/charts/bar-chart';
export { DEFAULT_COLORS, STACK_COLORS, niceMax, gridTicks, gridTicksSymmetric, formatChartValue, formatPercent, resolveColor, rectPath, roundedTopRectPath } from '@styloviz/charts/bar-chart';
export { SvBarChartComponent } from '@styloviz/charts/bar-chart';
export { SvRangeColumnChartComponent } from '@styloviz/charts/bar-chart';
export { SvCylindricalColumnChartComponent } from '@styloviz/charts/bar-chart';
export { SvGradientBarChartComponent } from '@styloviz/charts/bar-chart';
export { SvColumnDrilldownChartComponent } from '@styloviz/charts/bar-chart';
export { SvLineChartComponent } from '@styloviz/charts/line-chart';
export type { LineChartType, LineChartRenderer, LineChartMarkerShape, LineChartZone, LineChartAnnotation, LineChartSeries, LineChartOptions } from '@styloviz/charts/line-chart';
export { SvStripLineChartComponent } from '@styloviz/charts/line-chart';
export type { StripOrientation, StripBand, StripSeries, StripLineChartOptions } from '@styloviz/charts/line-chart';
export { SvTrendLineChartComponent } from '@styloviz/charts/line-chart';
export type { TrendType, TrendLineSeries, TrendLineDefinition, TrendLineChartOptions } from '@styloviz/charts/line-chart';
export { SvPieChartComponent } from '@styloviz/charts/pie-chart';
export type { PieSlice, PieChartBaseOptions, PieChartOptions } from '@styloviz/charts/pie-chart';
export { SvLiveUpdateChartComponent } from '@styloviz/charts/live-chart';
export { SvLiveStreamChartComponent } from '@styloviz/charts/live-chart';
export { SvWaterfallChartComponent } from '@styloviz/charts/waterfall-chart';
export type { WaterfallPoint } from '@styloviz/charts/waterfall-chart';
export { SvDateTimeCategoryChartComponent } from '@styloviz/charts/other-chart';
export { SvAxisLabelTemplateChartComponent } from '@styloviz/charts/other-chart';
export { DEMO_LIVE_SOURCES } from '@styloviz/charts/live-chart';

// ─── Radar Chart ──────────────────────────────────────────────────────────────
export { SvRadarChartComponent, DEMO_RADAR_AXES, DEMO_RADAR_SERIES } from '@styloviz/charts/radar-chart';
export type { RadarSeries, RadarAxis, RadarPointEvent } from '@styloviz/charts/radar-chart';

// ─── Scatter Chart ────────────────────────────────────────────────────────────
export { SvScatterChartComponent, DEMO_SCATTER_SERIES } from '@styloviz/charts/scatter-chart';
export type {
  ScatterPoint,
  ScatterSeries,
  ScatterPointEvent,
  ScatterBinEvent,
  ScatterBinShare,
  ScatterRenderMode,
} from '@styloviz/charts/scatter-chart';

export { SV_CHARTS_LABELS } from '@styloviz/charts/labels';
export type { SvChartsLabels } from '@styloviz/charts/labels';

/** Language packs for this package's labels (FL-B2) — `provideSvLabels(SV_…_LABELS_DE)`. */
export * from '@styloviz/charts/labels';

// Types a public input or output names, so a host can name them too (FL-G8, check:public-types).
export type { AxisLabelBarEvent, AxisLabelCategory, AxisLabelTemplateDataset, AxisLabelTemplateOptions } from '@styloviz/charts/other-chart';
export type { DateTimeCategoryEvent, DateTimeCategoryOptions, DateTimeSeries } from '@styloviz/charts/other-chart';
export type { LiveStreamChartOptions, LiveStreamSeries } from '@styloviz/charts/live-chart';
export type { LiveUpdateChartOptions, LiveUpdateSource } from '@styloviz/charts/live-chart';
export type { WaterfallBarEvent, WaterfallChartOptions } from '@styloviz/charts/waterfall-chart';
