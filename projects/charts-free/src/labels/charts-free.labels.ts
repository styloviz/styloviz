// The module this file augments. It has to be in this entry point's program:
// no other file of the entry imports it.
import type {} from '@styloviz/core/i18n';

import { SV_CHART_DISCLOSURE_LABELS, type SvChartDisclosureLabels } from '@styloviz/core/data';

/**
 * The text and accessible names the free charts render, in English. Override any of
 * them with `provideSvLabels({ charts: { … } })` from `@styloviz/core`.
 *
 * Also carries core's chart-disclosure wording (value policy, long-tail fold,
 * gaps), so this package translates the notices under its own charts.
 */
export interface SvChartsLabels extends SvChartDisclosureLabels {
  readonly drilldownBreadcrumbs: string;
  readonly drillUp: string;
  readonly trendType: string;
  readonly resetStream: string;
  readonly pauseStream: string;
  readonly startStream: string;
  readonly axisLabelTemplateChart: string;
  readonly dateTimeCategoryChart: string;
  /** Every chart's empty state (`emptyMessage` defaults to it). */
  readonly noDataToPlot: string;
  /** Column drill-down: the root crumb (`rootTitle` defaults to it), the back button, and the hint under the plot. */
  readonly drilldownRoot: string;
  readonly back: string;
  /**
   * "Click a bar to drill deeper • Use <b>Back</b> to return" — `back` is bold
   * markup, so the sentence is the two pieces around it.
   */
  readonly drillHintBefore: string;
  readonly drillHintAfter: string;
  readonly drillHintRoot: string;
  /** Waterfall: the tooltip's running total and the legend. */
  readonly tooltipTotal: string;
  readonly legendIncrease: string;
  readonly legendDecrease: string;
  readonly legendTotal: string;
  readonly legendDoesNotAddUp: string;
  /** Trend line legend. `{name}` is the series. */
  readonly trendLegend: string;
  /** Live stream: the title (`title` defaults to it), the badge and the controls. */
  readonly liveStreamTitle: string;
  readonly liveBadge: string;
  readonly pause: string;
  readonly play: string;
  readonly reset: string;
  /** Live update chart's title (`title` defaults to it). */
  readonly liveUpdateTitle: string;
  /** `sv-line-chart` `renderer="large-data"`: the note under the plot and above the data table. */
  readonly largeDataNote: string;
  /** Scatter: the axis titles (`xLabel` / `yLabel` default to them) and the density key. */
  readonly xAxis: string;
  readonly yAxis: string;
  readonly pointsPerBin: string;
  /** Default accessible names and table captions, one per chart, when `title` is empty. */
  readonly chartBar: string;
  readonly chartColumnDrilldown: string;
  readonly chartCylindricalColumn: string;
  readonly chartGradientBar: string;
  readonly chartRangeColumn: string;
  readonly chartLine: string;
  readonly chartStripLine: string;
  readonly chartTrendLine: string;
  readonly chartPie: string;
  readonly chartRadar: string;
  readonly chartScatter: string;
  readonly chartWaterfall: string;
  /** A value the chart could not read, wherever it would be printed. */
  readonly noValue: string;
  /** Summary-table column headers. */
  readonly categoryColumn: string;
  readonly pointColumn: string;
  readonly seriesColumn: string;
  readonly segmentColumn: string;
  readonly valueColumn: string;
  readonly shareColumn: string;
  readonly axisColumn: string;
  readonly axisMaximumColumn: string;
  readonly binColumn: string;
  readonly pointsColumn: string;
  readonly itemColumn: string;
  readonly stepColumn: string;
  readonly typeColumn: string;
  readonly changeColumn: string;
  readonly runningTotalColumn: string;
  /** A table cell for a bar drawn at the baseline. `{value}` is the formatted number. */
  readonly valueNotToScale: string;
  /** A table cell for a value the chart left out. `{value}` is the formatted number. */
  readonly valueNotDrawn: string;
  /** Range column summary table: the low end of a range. */
  readonly lowColumn: string;
  /** Range column summary table: the high end of a range. */
  readonly highColumn: string;
  /** A summary table caption naming the view drawn — a drill level, a live source. */
  readonly captionWithLevel: string;
  /** A summary row header for a category with a sub-label. */
  readonly categoryWithDetail: string;
  /** Strip line summary overview; `{bands}` are the labelled bands joined with `; `. */
  readonly stripBandsOverview: string;
  /** One strip band with both edges — values, or categories for a vertical band. */
  readonly stripBandRange: string;
  /** One horizontal strip band open at the top. */
  readonly stripBandFrom: string;
  /** Trend line summary overview for a linear fit; `{slope}` is signed. */
  readonly trendOverviewLinear: string;
  /** Trend line summary overview for a curved fit. */
  readonly trendOverviewFit: string;
  /** Trend line summary overview for a trend with no R² (moving average). */
  readonly trendOverviewNoFit: string;
  /** A bar chart's generated name. `{series}` / `{categories}` are counts; `{names}` the series names joined with `, `. */
  readonly seriesSummary: string;
  readonly seriesSummaryNamed: string;
  readonly seriesSummaryOneNamed: string;
  /** A line chart's generated name — the same, counted in `{points}`. */
  readonly lineSummary: string;
  readonly lineSummaryNamed: string;
  readonly lineSummaryOneNamed: string;
  /** One bar's accessible name. */
  readonly barPoint: string;
  readonly barPointUnnamed: string;
  readonly barNotToScale: string;
  /** Column drill-down: a clamped bar, and a bar that drills deeper. */
  readonly drillBarNotToScale: string;
  readonly drillInto: string;
  /** Range column: why a range is left out (read into the omission notice). */
  readonly rangeOmitReason: string;
  /** What the line charts print for a gap. */
  readonly noReading: string;
  /** Trend line: the trend types. */
  readonly trendLinear: string;
  readonly trendExponential: string;
  readonly trendMovingAverage: string;
  readonly trendPolynomial: string;
  /** Live update chart's generated name. */
  readonly liveUpdatingName: string;
  /** Live stream chart's generated name; `{series}` are the series names joined with `, `. */
  readonly liveStreamingName: string;
  readonly liveStreamingNameSeries: string;
  /** Pie: one slice in the name (`{share}` is a formatted percentage) and the whole name; slices are joined with `, `. */
  readonly pieSlice: string;
  readonly pieSummary: string;
  /** Radar: the generated name, a vertex's name, and the off-scale and scale notes. */
  readonly radarSummary: string;
  readonly radarPoint: string;
  readonly radarAt: string;
  readonly radarOverItem: string;
  readonly radarUnderItem: string;
  readonly radarAbove: string;
  readonly radarBelow: string;
  readonly radarMissing: string;
  readonly radarMaxGroup: string;
  readonly radarMixedMaxima: string;
  readonly radarOrderNote: string;
  /** Scatter: the notice under the plot. Counts arrive twice — as the plural selector and, unformatted, as the visible figure. */
  readonly scatterBinned: string;
  readonly scatterPooled: string;
  readonly scatterBinnedNoCanvas: string;
  readonly scatterRaster: string;
  readonly scatterSampled: string;
  /** Ordinals for `{nth}`, chosen by the locale's ordinal plural rule (`one`, `two`, `few`, else `other`). */
  readonly ordinalOne: string;
  readonly ordinalTwo: string;
  readonly ordinalFew: string;
  readonly ordinalOther: string;
  readonly scatterDroppedCoord: string;
  readonly scatterDroppedSize: string;
  readonly scatterOverlap: string;
  readonly scatterCrowdingX: string;
  readonly scatterCrowdingY: string;
  /** Scatter: the generated name, a point's and a bin's names, and the summary table. */
  readonly scatterSeriesCount: string;
  readonly scatterSummary: string;
  readonly scatterSummaryBins: string;
  readonly scatterPoint: string;
  readonly scatterPointLabelled: string;
  readonly scatterBin: string;
  readonly scatterBinShares: string;
  readonly scatterShare: string;
  readonly scatterDensityCaption: string;
  readonly scatterBinHeader: string;
  readonly scatterBinsOverview: string;
  readonly scatterPointsCaption: string;
  readonly scatterPointsOverview: string;
  /** Waterfall: the per-bar notes, the notice, names and table cells. Amounts arrive formatted. */
  readonly waterfallClamped: string;
  readonly waterfallDiffers: string;
  readonly waterfallUnreadable: string;
  readonly waterfallBadKind: string;
  readonly waterfallRowNote: string;
  readonly waterfallSummary: string;
  readonly waterfallBarClamped: string;
  readonly waterfallBarTotal: string;
  readonly waterfallBarInterim: string;
  readonly waterfallBarStep: string;
  readonly waterfallBarNote: string;
  readonly waterfallOverview: string;
  readonly waterfallClampedChange: string;
  readonly noChange: string;
  readonly waterfallRunningDiffers: string;
  readonly waterfallRunningUnreadable: string;
  /** Waterfall: the interim-sum bar type (the other types read `legendIncrease` / `legendDecrease` / `legendTotal`). */
  readonly typeInterimSum: string;
  /** `svApplyValuePolicy` / `svResolveShares` — how a value-policy disclosure counts this chart's data (`nounCount`). */
  readonly valueCountBar: string;
  readonly valueCountSlice: string;
  readonly valueCountRange: string;
  readonly valueCountStep: string;
  /** `sv-scatter-chart` bin tooltip: the points in the hovered bin. */
  readonly scatterBinCount: string;
}

export const SV_CHARTS_LABELS: SvChartsLabels = {
  ...SV_CHART_DISCLOSURE_LABELS,
  drilldownBreadcrumbs: 'Chart breadcrumbs',
  drillUp: 'Go back one level',
  trendType: 'Trend type',
  resetStream: 'Reset stream',
  pauseStream: 'Pause stream',
  startStream: 'Start stream',
  axisLabelTemplateChart: 'Axis label template chart',
  dateTimeCategoryChart: 'Date-time category chart',
  noDataToPlot: 'No data to plot',
  drilldownRoot: 'Root',
  back: 'Back',
  drillHintBefore: 'Click a bar to drill deeper • Use',
  drillHintAfter: 'to return',
  drillHintRoot: 'Click a highlighted bar to drill down',
  tooltipTotal: 'Total:',
  legendIncrease: 'Increase',
  legendDecrease: 'Decrease',
  legendTotal: 'Total',
  legendDoesNotAddUp: 'Does not add up',
  trendLegend: '{name} Trend',
  liveStreamTitle: 'Live Data Stream',
  liveBadge: 'LIVE',
  pause: 'Pause',
  play: 'Play',
  reset: 'Reset',
  liveUpdateTitle: 'Revenue & Expenses',
  largeDataNote: 'Drawn from {shown} of {total} points: the lowest and highest reading in each column of the plot, so every peak and trough is shown. Hover for any reading.',
  xAxis: 'X Axis',
  yAxis: 'Y Axis',
  pointsPerBin: 'Points per bin',
  chartBar: 'Bar chart',
  chartColumnDrilldown: 'Column drilldown chart',
  chartCylindricalColumn: 'Cylindrical column chart',
  chartGradientBar: 'Gradient bar chart',
  chartRangeColumn: 'Range column chart',
  chartLine: 'Line chart',
  chartStripLine: 'Strip line chart',
  chartTrendLine: 'Trend line chart',
  chartPie: 'Pie chart',
  chartRadar: 'Radar chart',
  chartScatter: 'Scatter plot',
  chartWaterfall: 'Waterfall chart',
  noValue: 'no value',
  categoryColumn: 'Category',
  pointColumn: 'Point',
  seriesColumn: 'Series',
  segmentColumn: 'Segment',
  valueColumn: 'Value',
  shareColumn: 'Share',
  axisColumn: 'Axis',
  axisMaximumColumn: 'Axis maximum',
  binColumn: 'Bin',
  pointsColumn: 'Points',
  itemColumn: 'Item',
  stepColumn: 'Step',
  typeColumn: 'Type',
  changeColumn: 'Change',
  runningTotalColumn: 'Running total',
  valueNotToScale: '{value} (not drawn to scale)',
  valueNotDrawn: '{value} (not drawn)',
  lowColumn: 'Low',
  highColumn: 'High',
  captionWithLevel: '{title} — {level}',
  categoryWithDetail: '{label} ({detail})',
  stripBandsOverview: 'Bands: {bands}.',
  stripBandRange: '{label}: {start} to {end}',
  stripBandFrom: '{label}: {start} and above',
  trendOverviewLinear: '{type} trend for {series}: {slope} per category, R² {r2}.',
  trendOverviewFit: '{type} trend for {series}: from {start} to {end}, R² {r2}.',
  trendOverviewNoFit: '{type} trend for {series}: from {start} to {end}.',
  seriesSummary: '{title}: {series, plural, other {# series}} across {categories, plural, one {# category} other {# categories}}.',
  seriesSummaryNamed: '{title}: {series, plural, other {# series}} ({names}) across {categories, plural, one {# category} other {# categories}}.',
  seriesSummaryOneNamed: '{title}: series {names} across {categories, plural, one {# category} other {# categories}}.',
  lineSummary: '{title}: {series, plural, other {# series}} across {points, plural, one {# point} other {# points}}.',
  lineSummaryNamed: '{title}: {series, plural, other {# series}} ({names}) across {points, plural, one {# point} other {# points}}.',
  lineSummaryOneNamed: '{title}: series {names} across {points, plural, one {# point} other {# points}}.',
  barPoint: '{series}, {category}: {value}',
  barPointUnnamed: '{category}: {value}',
  barNotToScale: '{name}, not drawn to scale — this chart cannot plot it',
  drillBarNotToScale: '{name}, not drawn to scale',
  drillInto: '{name}. Drill down into {category}',
  rangeOmitReason: 'a range must be finite, start at or above zero and end at or above its start.',
  noReading: 'No reading',
  trendLinear: 'Linear',
  trendExponential: 'Exponential',
  trendMovingAverage: 'Moving Avg',
  trendPolynomial: 'Polynomial',
  liveUpdatingName: '{title} — live updating chart',
  liveStreamingName: '{title} — live streaming chart.',
  liveStreamingNameSeries: '{title} — live streaming chart, series: {series}.',
  pieSlice: '{label} {share}',
  pieSummary: '{title}: {slices}.',
  radarSummary: '{title}. Axes: {axes}. Series: {series}.',
  radarPoint: '{series}, {axis}: {value}',
  radarAt: '{series} on {axis}',
  radarOverItem: '{at} ({value} of {max})',
  radarUnderItem: '{at} ({value})',
  radarAbove: 'Above the spoke\'s maximum, drawn at the rim: {items}.',
  radarBelow: 'Below zero, drawn at the centre: {items}.',
  radarMissing: 'No value, drawn at the centre as 0: {items}.',
  radarMaxGroup: '{axes} out of {max}',
  radarMixedMaxima: 'Spokes are normalised against different maxima ({maxima}), so equal distance from the centre is not an equal value.',
  radarOrderNote: 'The shape and the area depend on the order of the axes: the same numbers in a different order draw a different figure, so the area is not a quantity. Compare vertices along a spoke, not outlines.',
  scatterBinned: '{points, plural, one {{drawn} point} other {{drawn} points}} aggregated into {bins, plural, one {{binCount} hexagonal bin} other {{binCount} hexagonal bins}}; the shading is how many landed in each, and the densest holds {peak}.',
  scatterPooled: 'Series are pooled — hover or focus a bin for its breakdown.',
  scatterBinnedNoCanvas: '{points, plural, one {{drawn} point} other {{drawn} points}} aggregated into {bins, plural, one {{binCount} hexagonal bin} other {{binCount} hexagonal bins}} because they could not be painted as one image here; the shading is how many landed in each, and the densest holds {peak}.',
  scatterRaster: '{points, plural, one {{drawn} point} other {{drawn} points}} painted as one image rather than {drawn} separate shapes; the hexagons over it are the hover and keyboard targets.',
  scatterSampled: 'Showing {drawn} of {usable} points — every {nth}, spread evenly so the shape of the cloud is preserved. Individual gaps are not.',
  ordinalOne: '{n}st',
  ordinalTwo: '{n}nd',
  ordinalFew: '{n}rd',
  ordinalOther: '{n}th',
  scatterDroppedCoord: '{count, plural, one {{n} point} other {{n} points}} of {total} had no usable x or y and {count, plural, one {is} other {are}} not plotted.',
  scatterDroppedSize: '{count, plural, one {{n} point} other {{n} points}} had a size that cannot be drawn and {count, plural, one {is} other {are}} shown at the default radius.',
  scatterOverlap: '{count, plural, one {{n} point} other {{n} points}} share {sites, plural, one {{s} exact coordinate} other {{s} exact coordinates}} with another, so they are drawn on top of each other.',
  scatterCrowdingX: '{count, plural, one {{n} extreme {axis} value holds} other {{n} extreme {axis} values hold}} the horizontal axis open: the rest of the data sits in {pct}% of it.',
  scatterCrowdingY: '{count, plural, one {{n} extreme {axis} value holds} other {{n} extreme {axis} values hold}} the vertical axis open: the rest of the data sits in {pct}% of it.',
  scatterSeriesCount: '{name}: {count, plural, one {{n} point} other {{n} points}}',
  scatterSummary: '{title}. {x} versus {y}. {series}.',
  scatterSummaryBins: '{title}. {x} versus {y}. {series}. Drawn as {bins, plural, one {{binCount} density bin} other {{binCount} density bins}}. Use the arrow keys to move between them.',
  scatterPoint: '{series}: {x} {xValue}, {y} {yValue}',
  scatterPointLabelled: '{label}, {series}: {x} {xValue}, {y} {yValue}',
  scatterBin: '{x} about {xValue}, {y} about {yValue}: {count, plural, one {{n} point} other {{n} points}}',
  scatterBinShares: '{x} about {xValue}, {y} about {yValue}: {count, plural, one {{n} point} other {{n} points}} — {shares}',
  scatterShare: '{series} {count}',
  scatterDensityCaption: '{title} — density bins',
  scatterBinHeader: '{x} {xValue}, {y} {yValue}',
  scatterBinsOverview: '{points, plural, one {{drawn} point} other {{drawn} points}} in {bins, plural, one {{binCount} bin} other {{binCount} bins}}. The densest holds {peak}.',
  scatterPointsCaption: '{title} — {x} versus {y}',
  scatterPointsOverview: '{points, plural, one {{n} point} other {{n} points}} across {series, plural, other {{s} series}}.',
  waterfallClamped: 'No value this chart can use, so this step moves the running total by nothing.',
  waterfallDiffers: 'States {stated} against the {computed} its steps add up to — a difference of {diff}. The bar is drawn from the steps.',
  waterfallUnreadable: 'The stated total could not be read, so the bar is drawn from the {computed} its steps add up to.',
  waterfallBadKind: '{label}: its kind ("{kind}") is not delta, subtotal or total, so it is read as a step.',
  waterfallRowNote: '{label}: {note}',
  waterfallSummary: '{title}: {steps, plural, one {# step} other {# steps}} in sequence, ending at {end}.',
  waterfallBarClamped: '{label}: no value, running total {total}',
  waterfallBarTotal: '{label}: total {amount}',
  waterfallBarInterim: '{label}: interim sum {amount}',
  waterfallBarStep: '{label}: {delta}, running total {total}',
  waterfallBarNote: '{head}. {note}',
  waterfallOverview: 'Read in order; each step continues from the one before it.',
  waterfallClampedChange: '{value} (drawn as no change)',
  noChange: 'no change',
  waterfallRunningDiffers: '{computed} (stated {stated}, a difference of {diff})',
  waterfallRunningUnreadable: '{computed} (stated total unreadable)',
  typeInterimSum: 'Interim Sum',
  valueCountBar: '{count, plural, one {# bar} other {# bars}}',
  valueCountSlice: '{count, plural, one {# slice} other {# slices}}',
  valueCountRange: '{count, plural, one {# range} other {# ranges}}',
  valueCountStep: '{count, plural, one {# step} other {# steps}}',
  scatterBinCount: '{count, plural, one {# point} other {# points}}',
};

declare module '@styloviz/core/i18n' {
  interface SvLabelRegistry {
    charts: SvChartsLabels;
  }
}
