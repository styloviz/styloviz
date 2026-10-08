# @styloviz/charts

> Composable chart components — line, bar, area and more — for analytics dashboards.

Part of the **Styloviz UI Kit** — a premium Angular 21 & 22 + Tailwind CSS 4 dashboard component library. Standalone, `OnPush`, strongly typed, dark-mode ready.

## Installation

```bash
npm install @styloviz/core @styloviz/charts
```

Requires `@angular/core` and `@angular/common` 21 or 22 (peer range `>=21.0.0 <23.0.0`). Also needs `@styloviz/core` — listed above so no extra step is required on npm (on pnpm/yarn, list it yourself). Prefer everything at once? `@styloviz/all` installs the whole free tier in one command.

## Styles (required)

Styloviz components are Tailwind CSS 4 utilities. If the project does not use
Tailwind yet, add it and its PostCSS plugin (the Angular CLI reads
`.postcssrc.json` from the project root):

```sh
npm i -D tailwindcss @tailwindcss/postcss postcss
echo '{ "plugins": { "@tailwindcss/postcss": {} } }' > .postcssrc.json
```

Then, in your global stylesheet (usually `src/styles.css`), import the kit's
tokens and let Tailwind scan the installed packages — it skips `node_modules`
otherwise:

```css
@import "tailwindcss";
@import "@styloviz/core/styles/styloviz.css";
@source "../node_modules/@styloviz";
@source "../node_modules/@styloviz-pro";   /* Pro only */
```

The stylesheet ships in `@styloviz/core` — add it to your install if it is not
there already. Dark mode is class-based (`class="dark"` on `<html>`). Rebrand by
redeclaring a token after the import: `@theme { --color-primary-600: #0f766e; }`.

## Usage

```ts
import { SvBarChartComponent } from '@styloviz/charts';

@Component({
  standalone: true,
  imports: [SvBarChartComponent],
  template: `
    <sv-bar-chart [categories]="categories" [datasets]="datasets" orientation="vertical" />
  `,
})
export class DemoComponent {}
```

## Components

17 components. Each links to its API reference below.

| Selector | Class | Inputs | Outputs | Docs page |
| --- | --- | --- | --- | --- |
| [`sv-axis-label-template-chart`](#sv-axis-label-template-chart) | `SvAxisLabelTemplateChartComponent` | 10 | 3 | [Other Types](https://styloviz.dev/docs/other-charts) |
| [`sv-bar-chart`](#sv-bar-chart) | `SvBarChartComponent` | 13 | 2 | [Bar Chart](https://styloviz.dev/docs/bar-chart) |
| [`sv-column-drilldown-chart`](#sv-column-drilldown-chart) | `SvColumnDrilldownChartComponent` | 13 | 1 | [Bar Chart](https://styloviz.dev/docs/bar-chart) |
| [`sv-cylindrical-column-chart`](#sv-cylindrical-column-chart) | `SvCylindricalColumnChartComponent` | 12 | 1 | [Bar Chart](https://styloviz.dev/docs/bar-chart) |
| [`sv-datetime-category-chart`](#sv-datetime-category-chart) | `SvDateTimeCategoryChartComponent` | 11 | 3 | [Date-Time Category](https://styloviz.dev/docs/datetime-chart) |
| [`sv-default-pie-chart`](#sv-default-pie-chart) | `SvDefaultPieChartComponent` | 11 | 2 | [Pie Chart](https://styloviz.dev/docs/pie-chart) |
| [`sv-gradient-bar-chart`](#sv-gradient-bar-chart) | `SvGradientBarChartComponent` | 12 | 1 | [Bar Chart](https://styloviz.dev/docs/bar-chart) |
| [`sv-line-chart`](#sv-line-chart) | `SvLineChartComponent` | 13 | 1 | [Line Chart](https://styloviz.dev/docs/line-chart) |
| [`sv-live-stream-chart`](#sv-live-stream-chart) | `SvLiveStreamChartComponent` | 12 | 2 | [Live Charts](https://styloviz.dev/docs/live-charts) |
| [`sv-live-update-chart`](#sv-live-update-chart) | `SvLiveUpdateChartComponent` | 9 | 1 | [Live Charts](https://styloviz.dev/docs/live-charts) |
| [`sv-performance-chart`](#sv-performance-chart) | `SvPerformanceChartComponent` | 9 | 1 | [Other Types](https://styloviz.dev/docs/other-charts) |
| [`sv-radar-chart`](#sv-radar-chart) | `SvRadarChartComponent` | 14 | 3 | [Radar / Spider Chart](https://styloviz.dev/docs/radar-chart) |
| [`sv-range-column-chart`](#sv-range-column-chart) | `SvRangeColumnChartComponent` | 12 | 1 | [Bar Chart](https://styloviz.dev/docs/bar-chart) |
| [`sv-scatter-chart`](#sv-scatter-chart) | `SvScatterChartComponent` | 19 | 5 | [Scatter Plot](https://styloviz.dev/docs/scatter-chart) |
| [`sv-strip-line-chart`](#sv-strip-line-chart) | `SvStripLineChartComponent` | 12 | 1 | [Line Chart](https://styloviz.dev/docs/line-chart) |
| [`sv-trend-line-chart`](#sv-trend-line-chart) | `SvTrendLineChartComponent` | 12 | 1 | [Line Chart](https://styloviz.dev/docs/line-chart) |
| [`sv-waterfall-chart`](#sv-waterfall-chart) | `SvWaterfallChartComponent` | 13 | 3 | [Waterfall Chart](https://styloviz.dev/docs/waterfall-chart) |

## Free ↔ Pro twin map

`@styloviz/charts` is the free tier; `@styloviz-pro/charts` is Pro. 17 charts ship in both, and 33 are Pro-only. The last column is what the Pro twin's API adds (`+`) or lacks (`−`) relative to the free one; `(name)` is an output.

| Free — `@styloviz/charts` | Pro — `@styloviz-pro/charts` | Pro vs Free |
| --- | --- | --- |
| `sv-axis-label-template-chart`<br>`SvAxisLabelTemplateChartComponent` | `sv-axis-label-template-chart-pro`<br>`SvAxisLabelTemplateChartProComponent` | same API |
| `sv-bar-chart`<br>`SvBarChartComponent` | `sv-bar-chart-pro`<br>`SvBarChartProComponent` | same API |
| — | `sv-box-plot-chart`<br>`SvBoxPlotChartComponent` | — |
| — | `sv-bubble-chart`<br>`SvBubbleChartComponent` | — |
| — | `sv-bullet-chart`<br>`SvBulletChartComponent` | — |
| — | `sv-candlestick-chart`<br>`SvCandlestickChartComponent` | — |
| — | `sv-choropleth-map`<br>`SvChoroplethMapComponent` | — |
| — | `sv-click-add-point-chart`<br>`SvClickAddPointChartComponent` | — |
| `sv-column-drilldown-chart`<br>`SvColumnDrilldownChartComponent` | `sv-column-drilldown-chart-pro`<br>`SvColumnDrilldownChartProComponent` | same API |
| — | `sv-column-placement-chart`<br>`SvColumnPlacementChartComponent` | — |
| `sv-cylindrical-column-chart`<br>`SvCylindricalColumnChartComponent` | `sv-cylindrical-column-chart-pro`<br>`SvCylindricalColumnChartProComponent` | same API |
| `sv-datetime-category-chart`<br>`SvDateTimeCategoryChartComponent` | `sv-datetime-category-chart-pro`<br>`SvDateTimeCategoryChartProComponent` | same API |
| `sv-default-pie-chart`<br>`SvDefaultPieChartComponent` | `sv-default-pie-chart-pro`<br>`SvDefaultPieChartProComponent` | same API |
| — | `sv-donut-chart`<br>`SvDonutChartComponent` | — |
| — | `sv-funnel-chart`<br>`SvFunnelChartComponent` | — |
| — | `sv-gauge-chart`<br>`SvGaugeChartComponent` | — |
| `sv-gradient-bar-chart`<br>`SvGradientBarChartComponent` | `sv-gradient-bar-chart-pro`<br>`SvGradientBarChartProComponent` | same API |
| — | `sv-gradient-donut-chart`<br>`SvGradientDonutChartComponent` | — |
| — | `sv-heatmap-chart`<br>`SvHeatmapChartComponent` | — |
| — | `sv-histogram-chart`<br>`SvHistogramChartComponent` | — |
| `sv-line-chart`<br>`SvLineChartComponent` | `sv-line-chart-pro`<br>`SvLineChartProComponent` | +`zoomable` +`minZoomPoints` +`(zoomRangeChange)` |
| — | `sv-live-sort-chart`<br>`SvLiveSortChartComponent` | — |
| — | `sv-live-spline-chart`<br>`SvLiveSplineChartComponent` | — |
| — | `sv-live-stock-chart`<br>`SvLiveStockChartComponent` | — |
| `sv-live-stream-chart`<br>`SvLiveStreamChartComponent` | `sv-live-stream-chart-pro`<br>`SvLiveStreamChartProComponent` | same API |
| `sv-live-update-chart`<br>`SvLiveUpdateChartComponent` | `sv-live-update-chart-pro`<br>`SvLiveUpdateChartProComponent` | same API |
| — | `sv-multi-axis-chart`<br>`SvMultiAxisChartComponent` | — |
| — | `sv-multi-level-label-chart`<br>`SvMultiLevelLabelChartComponent` | — |
| — | `sv-negative-stack-chart`<br>`SvNegativeStackChartComponent` | — |
| `sv-performance-chart`<br>`SvPerformanceChartComponent` | `sv-performance-chart-pro`<br>`SvPerformanceChartProComponent` | same API |
| — | `sv-pie-legend-template-chart`<br>`SvPieLegendTemplateChartComponent` | — |
| — | `sv-pie-radius-chart`<br>`SvPieRadiusChartComponent` | — |
| — | `sv-pin-map`<br>`SvPinMapComponent` | — |
| — | `sv-polar-chart`<br>`SvPolarChartComponent` | — |
| — | `sv-pyramid-chart`<br>`SvPyramidChartComponent` | — |
| `sv-radar-chart`<br>`SvRadarChartComponent` | `sv-radar-chart-pro`<br>`SvRadarChartProComponent` | same API |
| — | `sv-radial-bar-chart`<br>`SvRadialBarChartComponent` | — |
| — | `sv-range-bar-chart`<br>`SvRangeBarChartComponent` | — |
| `sv-range-column-chart`<br>`SvRangeColumnChartComponent` | `sv-range-column-chart-pro`<br>`SvRangeColumnChartProComponent` | same API |
| — | `sv-sankey-chart`<br>`SvSankeyChartComponent` | — |
| `sv-scatter-chart`<br>`SvScatterChartComponent` | `sv-scatter-chart-pro`<br>`SvScatterChartProComponent` | same API |
| — | `sv-smart-labels-pie-chart`<br>`SvSmartLabelsPieChartComponent` | — |
| — | `sv-stacked-bar-chart`<br>`SvStackedBarChartComponent` | — |
| — | `sv-stacked-bar-percent-chart`<br>`SvStackedBarPercentChartComponent` | — |
| — | `sv-stacked-column-chart`<br>`SvStackedColumnChartComponent` | — |
| — | `sv-stacked-column-percent-chart`<br>`SvStackedColumnPercentChartComponent` | — |
| `sv-strip-line-chart`<br>`SvStripLineChartComponent` | `sv-strip-line-chart-pro`<br>`SvStripLineChartProComponent` | same API |
| — | `sv-treemap-chart`<br>`SvTreemapChartComponent` | — |
| `sv-trend-line-chart`<br>`SvTrendLineChartComponent` | `sv-trend-line-chart-pro`<br>`SvTrendLineChartProComponent` | same API |
| `sv-waterfall-chart`<br>`SvWaterfallChartComponent` | `sv-waterfall-chart-pro`<br>`SvWaterfallChartProComponent` | same API |

## Exports

Everything `@styloviz/charts` exports from its entry point — 70 symbols.

**Components (17):** `SvAxisLabelTemplateChartComponent`, `SvBarChartComponent`, `SvColumnDrilldownChartComponent`, `SvCylindricalColumnChartComponent`, `SvDateTimeCategoryChartComponent`, `SvDefaultPieChartComponent`, `SvGradientBarChartComponent`, `SvLineChartComponent`, `SvLiveStreamChartComponent`, `SvLiveUpdateChartComponent`, `SvPerformanceChartComponent`, `SvRadarChartComponent`, `SvRangeColumnChartComponent`, `SvScatterChartComponent`, `SvStripLineChartComponent`, `SvTrendLineChartComponent`, `SvWaterfallChartComponent`

**Functions & constants (14):** `DEFAULT_COLORS`, `DEMO_LIVE_SOURCES`, `DEMO_RADAR_AXES`, `DEMO_RADAR_SERIES`, `DEMO_SCATTER_SERIES`, `formatChartValue`, `formatPercent`, `gridTicks`, `gridTicksSymmetric`, `niceMax`, `rectPath`, `resolveColor`, `roundedTopRectPath`, `STACK_COLORS`

**Types (39):** `BarChartDataset`, `BarChartOptions`, `BarChartOrientation`, `BarChartVariant`, `ComputedBar`, `ComputedRangeBar`, `ComputedStackSegment`, `DefaultPieChartOptions`, `DrilldownDataset`, `DrilldownLevel`, `DrilldownState`, `LineChartAnnotation`, `LineChartMarkerShape`, `LineChartOptions`, `LineChartSeries`, `LineChartType`, `LineChartZone`, `PieChartBaseOptions`, `PieSlice`, `RadarAxis`, `RadarPointEvent`, `RadarSeries`, `RangeChartDataset`, `ScatterBinEvent`, `ScatterBinShare`, `ScatterPoint`, `ScatterPointEvent`, `ScatterRenderMode`, `ScatterSeries`, `StripBand`, `StripLineChartOptions`, `StripOrientation`, `StripSeries`, `TooltipItem`, `TrendLineChartOptions`, `TrendLineDefinition`, `TrendLineSeries`, `TrendType`, `WaterfallPoint`

## API reference

### `sv-axis-label-template-chart`

`import { SvAxisLabelTemplateChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-axis-label-template-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="group"`
- **Data table:** none in this component
- **Keyboard:** has focusable controls or marks
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/other-charts

```html
<sv-axis-label-template-chart [categories]="categories" [datasets]="datasets" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `categories` | `AxisLabelCategory[]` | `[]` | X-axis categories; each renders its label plus an optional icon, colour swatch and sub-label. |
| `datasets` | `AxisLabelTemplateDataset[]` | `[]` | Bar series; each `data` array is indexed by category position and drawn as grouped bars. |
| `title` | `string` | `''` | Chart title rendered above the plot; also used as the plot's accessible name. |
| `height` | `number` | `340` | Chart height in pixels. |
| `options` | `AxisLabelTemplateOptions` | `{}` | Display options: grid, legend, value labels, bar gap ratio and animation duration. |
| `customClass` | `string` | `''` | Extra CSS classes applied to the root wrapper. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `barHover` | `AxisLabelBarEvent` | Emitted when a bar is hovered or keyboard-focused. |
| `barSelect` | `AxisLabelBarEvent` | Emitted when a bar is clicked or activated via keyboard (Enter/Space). |

### `sv-bar-chart`

`import { SvBarChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-bar-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="group"` — override its accessible name with `ariaLabel`
- **Data table:** yes — the plotted values as a screen-reader table
- **Keyboard:** has focusable controls or marks
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/bar-chart

```html
<sv-bar-chart [categories]="categories" [datasets]="datasets" orientation="vertical" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `categories` | `string[]` | `[]` | Category labels displayed on the axis. |
| `datasets` | `BarChartDataset[]` | `[]` | One or more data series. |
| `valuePolicy` | `SvValuePolicy` | `'clamp'` | What to do with a bar this chart cannot draw — a negative value, `NaN`, `Infinity`. This is a zero-based bar chart: height is `(value / axisMax) * plotSize`, and an SVG rect refuses a negative height outright, so such a bar does not look wrong, it is simply absent. - `clamp` (default) — draw it at the baseline, mark it there, and disclose its real value under the plot. - `reject` — refuse the dataset and show the error state. `omit` is not available: a bar's position is its index within its group, so dropping one value would shift every later bar of that series out from under its own category label. For data that genuinely goes below zero, use `<sv-negative-stack-chart>`. |
| `orientation` | `BarChartOrientation` | `'vertical'` | Chart orientation. |
| `title` | `string` | `''` | Chart title. |
| `height` | `number` | `320` | Chart height in px. |
| `options` | `BarChartOptions` | `{}` | Rendering and feature options. |
| `customClass` | `string` | `''` | Additional CSS classes on the root element. |
| `ariaLabel` | `string` | `''` | Accessible-name override for the chart image. When empty, a concise data summary is generated automatically; the full data is always exposed to assistive tech via a visually-hidden table. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `barSelect` | `{ category: string; series: string; value: number }` | Emitted when a bar is clicked — for drill-down or selection. |

### `sv-column-drilldown-chart`

`import { SvColumnDrilldownChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-column-drilldown-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="group"` — override its accessible name with `ariaLabel`
- **Data table:** none in this component
- **Keyboard:** has focusable controls or marks
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/bar-chart

```html
<sv-column-drilldown-chart [categories]="categories" [datasets]="datasets" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `categories` | `string[]` | `[]` | Top-level category labels on the X-axis; a drilled-into level shows its own `categories` instead. |
| `datasets` | `DrilldownDataset[]` | `[]` | Top-level series. A series whose `drilldown` map has an entry for a category makes that column clickable, switching the chart to the sub-level. |
| `valuePolicy` | `SvValuePolicy` | `'clamp'` | What to do with a column this chart cannot draw — a negative value, `NaN`, `Infinity` — at whichever level is showing. Such a column used to be hidden outright (and a drillable one became unreachable), and one `NaN` blanked the axis. - `clamp` (default) — draw a marked stub at the baseline and disclose the real value under the plot. - `reject` — refuse the level and show the error state. `omit` is not available: a column's position is its category index. For data that genuinely goes below zero, use `<sv-negative-stack-chart>`. |
| `title` | `string` | `''` | Heading shown above the chart (omitted when empty); also used in the generated accessible name. |
| `rootTitle` | `string` | `'Root'` | Label of the first breadcrumb, which stands for the top level and stays visible while drilled down. |
| `height` | `number` | `320` | Chart height in px. |
| `options` | `BarChartOptions` | `{}` | Rendering options: `showGrid`, `showLabels`, `showLegend`, `showValues`, `barGap` (default 0.35), `barRadius` (default 6) and `animationDuration`. |
| `customClass` | `string` | `''` | Additional CSS classes on the root element. |
| `ariaLabel` | `string` | `''` | Accessible-name override; otherwise a structure summary is generated. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |

### `sv-cylindrical-column-chart`

`import { SvCylindricalColumnChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-cylindrical-column-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="img"` — override its accessible name with `ariaLabel`
- **Data table:** none in this component
- **Keyboard:** nothing in it takes focus
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/bar-chart

```html
<sv-cylindrical-column-chart [categories]="categories" [datasets]="datasets" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `categories` | `string[]` | `[]` | Category labels on the X-axis, one per column group. |
| `datasets` | `BarChartDataset[]` | `[]` | One or more series, drawn side by side as cylindrical columns; each `data` array holds one value per category. |
| `valuePolicy` | `SvValuePolicy` | `'clamp'` | What to do with a column this chart cannot draw — a negative value, `NaN`, `Infinity`. The axis starts at zero, so such a column used to be drawn as a silent sliver (or, for `NaN`, blank the whole plot). - `clamp` (default) — draw a marked stub at the baseline and disclose the real value under the plot. - `reject` — refuse the dataset and show the error state. `omit` is not available: a column's position is its index within its group. For data that genuinely goes below zero, use `<sv-negative-stack-chart>`. |
| `title` | `string` | `''` | Heading shown above the chart (omitted when empty); also used in the generated accessible name. |
| `height` | `number` | `320` | Chart height in px. |
| `options` | `BarChartOptions` | `{}` | Rendering options: `showGrid`, `showLabels`, `showLegend`, `showValues`, `barGap` (default 0.3), `cylinderCapRatio` (default 0.18) and `animationDuration`. |
| `customClass` | `string` | `''` | Additional CSS classes on the root element. |
| `ariaLabel` | `string` | `''` | Accessible-name override; otherwise a structure summary is generated. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |

### `sv-datetime-category-chart`

`import { SvDateTimeCategoryChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-datetime-category-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="group"`
- **Data table:** none in this component
- **Keyboard:** has focusable controls or marks
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/datetime-chart

```html
<sv-datetime-category-chart [categories]="days" [series]="series" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `categories` | `string[]` | `[]` | ISO date strings for the X axis, one per data point. A bare `YYYY-MM-DD` is read as a local calendar day; labels are formatted per `options.zoom` and `locale`. |
| `series` | `DateTimeSeries[]` | `[]` | Line series; `data` holds one value per category. The area under a line is filled per the series' `fill`, else `options.showArea` (on by default). |
| `title` | `string` | `''` | Chart title rendered above the plot; also used as the plot's accessible name. |
| `height` | `number` | `320` | Chart height in pixels. |
| `options` | `DateTimeCategoryOptions` | `{}` | Display options: grid, legend, area fill (`showArea`, default true; a series' own `fill` wins), date-label `zoom` (`'day'` \| `'month'` \| `'year'`, default `'month'`) and animation duration. |
| `locale` | `string` | `inject(LOCALE_ID)` | BCP 47 locale for the date labels on the x-axis. Defaults to the application's `LOCALE_ID` — the same value `DatePipe` uses — so an app that has configured its locale gets matching axis labels without doing anything here. Override per chart for a report that must read in one fixed language whoever opens it. Only the LABELS are localised. The `categories` themselves stay ISO strings, because they are also the join key for the series and a localised key would differ between two readers looking at the same dashboard. |
| `customClass` | `string` | `''` | Extra CSS classes applied to the root wrapper. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `categoryHover` | `DateTimeCategoryEvent` | Emitted when a category is hovered or keyboard-focused. |
| `categorySelect` | `DateTimeCategoryEvent` | Emitted when a category is clicked or activated via keyboard (Enter/Space). |

### `sv-default-pie-chart`

`import { SvDefaultPieChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-default-pie-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="group"` — override its accessible name with `ariaLabel`
- **Data table:** yes — the plotted values as a screen-reader table
- **Keyboard:** has focusable controls or marks
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/pie-chart

```html
<sv-default-pie-chart [slices]="slices" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `slices` | `PieSlice[]` | `[]` | Pie slices. Each must have a label and a positive value. |
| `valuePolicy` | `SvValuePolicy` | `'omit'` | What to do with a slice this chart cannot plot — a negative value, `NaN`, `Infinity`. A pie divides by the sum of its values, so an unplottable one is not merely undrawable: left in the denominator it changes the angle of every OTHER slice, which is why there is no "leave it alone" option here. - `omit` (default) — drop it, and disclose the count and that the percentages are of the remainder. - `reject` — refuse the dataset and show the error state. `clamp` is not supported: a clamped slice is a 0° arc, which leaves nothing to mark, so it falls back to `omit` with a dev warning. `render` likewise. |
| `title` | `string` | `''` | Chart title displayed above the SVG. |
| `size` | `number` | `260` | Size of the SVG canvas (width = height). |
| `options` | `DefaultPieChartOptions` | `{}` | Chart options. |
| `customClass` | `string` | `''` | Extra CSS classes on the root wrapper. |
| `ariaLabel` | `string` | `''` | Accessible-name override for the chart image. When empty, a concise data summary is generated; the full data is exposed via a visually-hidden table. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `sliceSelect` | `PieSlice` | Emitted when a slice (arc or legend entry) is clicked. |

### `sv-gradient-bar-chart`

`import { SvGradientBarChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-gradient-bar-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="img"` — override its accessible name with `ariaLabel`
- **Data table:** yes — the plotted values as a screen-reader table
- **Keyboard:** nothing in it takes focus
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/bar-chart

```html
<sv-gradient-bar-chart [categories]="categories" [datasets]="datasets" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `categories` | `string[]` | `[]` | Category labels on the Y-axis, one per bar group. |
| `datasets` | `BarChartDataset[]` | `[]` | One or more series, drawn side by side as horizontal gradient bars; set `gradientColors: [start, end]` on a series to override the gradient derived from its `color`. |
| `valuePolicy` | `SvValuePolicy` | `'clamp'` | What to do with a bar this chart cannot draw — a negative value, `NaN`, `Infinity`. This is a zero-based bar chart: height is `(value / axisMax) * plotSize`, and an SVG rect refuses a negative height outright, so such a bar does not look wrong, it is simply absent. - `clamp` (default) — draw it at the baseline, mark it there, and disclose its real value under the plot. - `reject` — refuse the dataset and show the error state. `omit` is not available: a bar's position is its index within its group, so dropping one value would shift every later bar of that series out from under its own category label. For data that genuinely goes below zero, use `<sv-negative-stack-chart>`. |
| `title` | `string` | `''` | Heading shown above the chart (omitted when empty); also used in the generated accessible name. |
| `height` | `number` | `360` | Chart height in px. |
| `options` | `BarChartOptions` | `{}` | Rendering options: `showGrid` (default false), `showLabels`, `showLegend`, `showValues` (default true), `barGap` (default 0.3), `barRadius` (default 4), `gradientDirection` (default `'horizontal'`) and `animationDuration`. |
| `customClass` | `string` | `''` | Additional CSS classes on the root element. |
| `ariaLabel` | `string` | `''` | Accessible-name override; otherwise a structure summary is generated. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |

### `sv-line-chart`

`import { SvLineChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-line-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="img"` — override its accessible name with `ariaLabel`
- **Data table:** yes — the plotted values as a screen-reader table
- **Keyboard:** nothing in it takes focus
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/line-chart

```html
<sv-line-chart [categories]="categories" [series]="series" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `categories` | `string[]` | `[]` | Category labels shown on the axis. |
| `series` | `LineChartSeries[]` | `[]` | Data series. |
| `chartType` | `LineChartType` | `'line'` | Visual chart type. |
| `title` | `string` | `''` | Chart title. |
| `subtitle` | `string` | `''` | Chart subtitle / source attribution shown below the title. |
| `height` | `number` | `300` | Chart height in px. |
| `options` | `LineChartOptions` | `{}` | Chart-wide display options. |
| `customClass` | `string` | `''` | Additional CSS classes on the root element. |
| `ariaLabel` | `string` | `''` | Accessible-name override for the chart image. When empty, a concise data summary is generated; the full data is exposed via a visually-hidden table. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |

### `sv-live-stream-chart`

`import { SvLiveStreamChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-live-stream-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`, `offline`
- **Name:** the SVG is `role="img"` — override its accessible name with `ariaLabel`
- **Data table:** none in this component
- **Keyboard:** has focusable controls or marks
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/live-charts

```html
<sv-live-stream-chart [series]="series" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `demoFeed` | `boolean` | `false` | Generate the stream's points internally, with `Math.random()`. For demos and screenshots only. This used to be the only behaviour, so a chart wired to a real feed drew invented numbers alongside the real ones. |
| `connection` | `SvConnectionState` | `'idle'` | State of the socket / `EventSource` behind `push()`. A stream that stops moving looks the same whether the source went quiet or the connection dropped, so the chart cannot infer this — only the host knows. `idle` renders nothing; anything else replaces the LIVE badge with the state. |
| `reconnectable` | `boolean` | `false` | Offer a Reconnect button while `connection` is `reconnecting` or `closed`. Off by default: most hosts retry on their own, and a second manual trigger opens a second socket. |
| `title` | `string` | `'Live Data Stream'` | Chart title, rendered in the header and used in the default accessible name. |
| `subtitle` | `string` | `''` | Secondary line shown under the title; hidden when empty. |
| `series` | `LiveStreamSeries[]` | `[ { label: 'Sensor A', color: PALETTE[0…` | The streamed lines, one per entry — `label` for the legend and accessible name, optional `color` (falls back to the palette). `push()` values map to these by index; an empty array shows the empty state. |
| `options` | `LiveStreamChartOptions` | `{}` | Height, visible window size, point interval, smoothing, grid/legend/area toggles and fixed Y range — see `LiveStreamChartOptions`. |
| `ariaLabel` | `string` | `''` | Accessible-name override for the chart image. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `reconnect` | `void` | The user asked to re-open the feed. |

### `sv-live-update-chart`

`import { SvLiveUpdateChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-live-update-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="img"` — override its accessible name with `ariaLabel`
- **Data table:** none in this component
- **Keyboard:** has focusable controls or marks
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/live-charts

```html
<sv-live-update-chart [categories]="categories" [sources]="sources" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `title` | `string` | `'Revenue & Expenses'` | Chart title, rendered in the header and used in the default accessible name. |
| `ariaLabel` | `string` | `''` | Accessible-name override for the chart image. |
| `categories` | `string[]` | `CATEGORIES` | X-axis category labels; each dataset's `data[i]` is plotted against `categories[i]`. |
| `sources` | `LiveUpdateSource[]` | `[]` | Switchable data sets, one toggle button each; the bars animate between them and the Y-axis is fixed to the max across all sources. The first source is active on init; an empty array shows the empty state. |
| `options` | `LiveUpdateChartOptions` | `{}` | Height, bar transition duration, corner radius, and value-label/grid/legend toggles — see `LiveUpdateChartOptions`. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |

### `sv-performance-chart`

`import { SvPerformanceChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-performance-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="img"`
- **Data table:** none in this component
- **Keyboard:** nothing in it takes focus
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/other-charts

```html
<sv-performance-chart [data]="readings" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `readonly number[]` | `[]` | The series to plot — one number per point, in order. Leave it unbound and set `options.pointCount` to run the built-in benchmark against a synthetic series instead. Host data always wins over the benchmark. |
| `title` | `string` | `'High-Volume Chart Performance'` | Chart title, rendered above the plot and used as the SVG's accessible name. |
| `height` | `number` | `320` | SVG and frame height in pixels. |
| `options` | `PerformanceChartOptions` | `{}` | Benchmark point count (`pointCount`, opt-in; ignored when `data` is bound), area fill and grid toggles (both default `true`), and line draw-in `animationDuration` in ms. |
| `customClass` | `string` | `''` | Extra CSS classes applied to the root wrapper. |
| `loading` | `boolean` | `false` | True while the series is being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. A bare string is accepted; use `toSvDataError()` to normalize an `HttpErrorResponse` and get sensible retry behaviour. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Distinguishes "no data at all" from "nothing matched the current filters". |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |

### `sv-radar-chart`

`import { SvRadarChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-radar-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="group"` — override its accessible name with `ariaLabel`
- **Data table:** yes — the plotted values as a screen-reader table
- **Keyboard:** has focusable controls or marks
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/radar-chart

```html
<sv-radar-chart [series]="series" [axes]="axes" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series is being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the no-data state. |
| `filtered` | `boolean` | `false` | True when the emptiness is caused by a filter rather than an empty set. |
| `axes` | `readonly RadarAxis[]` | `[]` | The radial axes (one spoke per axis label). |
| `series` | `readonly RadarSeries[]` | `[]` | Series to plot; each value array aligns with `axes`. |
| `size` | `number` | `300` | Chart diameter in pixels. |
| `levels` | `number` | `5` | Number of concentric grid levels. |
| `maxValue` | `number` | `100` | Global maximum used to normalise values (per-axis `max` overrides). |
| `showDots` | `boolean` | `true` | Show point markers at each value. |
| `filled` | `boolean` | `true` | Fill the series area (vs stroke-only). |
| `title` | `string` | `''` | Chart title. |
| `ariaLabel` | `string` | `''` | Accessible name override for the chart. Falls back to a generated summary. |
| `customClass` | `string` | `''` | Extra CSS classes applied to the root wrapper. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `pointHover` | `RadarPointEvent` | Emitted when a vertex is hovered or keyboard-focused. |
| `pointSelect` | `RadarPointEvent` | Emitted when a vertex is clicked or activated via keyboard (Enter/Space). |

### `sv-range-column-chart`

`import { SvRangeColumnChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-range-column-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="img"` — override its accessible name with `ariaLabel`
- **Data table:** none in this component
- **Keyboard:** nothing in it takes focus
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/bar-chart

```html
<sv-range-column-chart [categories]="categories" [datasets]="datasets" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `categories` | `string[]` | `[]` | Category labels on the X-axis. |
| `datasets` | `RangeChartDataset[]` | `[]` | One or more range series — each data point has `{ low, high }`. |
| `valuePolicy` | `SvValuePolicy` | `'omit'` | What to do with a range this chart cannot draw — a `NaN` or unbounded end, a low below zero (the axis starts at zero, so it hung outside the plot), or a high below its low. Such ranges used to be drawn wrong without a word, and one `NaN` blanked the axis. - `omit` (default) — leave the range out and say how many under the plot. Safe here: every range keeps its own slot, so no other bar moves. - `reject` — refuse the dataset and show the error state. |
| `title` | `string` | `''` | Heading shown above the chart (omitted when empty); also used in the generated accessible name. |
| `height` | `number` | `320` | Chart height in px. |
| `options` | `BarChartOptions` | `{}` | Rendering options: `showGrid`, `showLabels`, `showLegend`, `showValues`, `barGap` (default 0.35), `barRadius` (default 4) and `animationDuration`. |
| `customClass` | `string` | `''` | Additional CSS classes on the root element. |
| `ariaLabel` | `string` | `''` | Accessible-name override; otherwise a structure summary is generated. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |

### `sv-scatter-chart`

`import { SvScatterChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-scatter-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="group"` — override its accessible name with `ariaLabel`
- **Data table:** yes — the plotted values as a screen-reader table
- **Keyboard:** has focusable controls or marks
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/scatter-chart

```html
<sv-scatter-chart [series]="series" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series is being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the no-data state. |
| `filtered` | `boolean` | `false` | True when the emptiness is caused by a filter rather than an empty set. |
| `series` | `readonly ScatterSeries[]` | `[]` | Point series: each with a name, color and (x, y) points. |
| `width` | `number` | `480` | Chart width in pixels. |
| `height` | `number` | `300` | Chart height in pixels. |
| `dotSize` | `number` | `6` | Point radius in pixels. |
| `showGrid` | `boolean` | `true` | Show background grid lines. |
| `xLabel` | `string` | `'X Axis'` | X-axis label. |
| `yLabel` | `string` | `'Y Axis'` | Y-axis label. |
| `title` | `string` | `''` | Chart title. |
| `ariaLabel` | `string` | `''` | Accessible name override for the chart. Falls back to a generated summary. |
| `customClass` | `string` | `''` | Extra CSS classes applied to the root wrapper. |
| `renderMode` | `ScatterRenderMode` | `'auto'` | What the plot draws. |
| `binThreshold` | `number` | `2000` | Point count at which `renderMode: 'auto'` switches to density bins. |
| `canvasThreshold` | `number` | `1200` | Point count above which the `points` path paints to a canvas instead of emitting one SVG node per datum. |
| `binRadius` | `number` | `9` | Circumradius of one density hexagon, in pixels. |
| `maxPoints` | `number` | `0` | Hard cap on how many points are drawn. `0` means no cap. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `pointHover` | `ScatterPointEvent` | Emitted when a point is hovered or keyboard-focused. |
| `pointSelect` | `ScatterPointEvent` | Emitted when a point is clicked or activated via keyboard (Enter/Space). |
| `binHover` | `ScatterBinEvent` | Emitted when a density bin is hovered or keyboard-focused. |
| `binSelect` | `ScatterBinEvent` | Emitted when a density bin is clicked or activated via keyboard. |

### `sv-strip-line-chart`

`import { SvStripLineChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-strip-line-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="img"` — override its accessible name with `ariaLabel`
- **Data table:** none in this component
- **Keyboard:** nothing in it takes focus
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/line-chart

```html
<sv-strip-line-chart [categories]="categories" [series]="series" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `title` | `string` | `''` | Chart title shown in the header; also the base of the generated accessible name. |
| `subtitle` | `string` | `''` | Secondary line shown below the title (rendered only when `title` is set). |
| `categories` | `string[]` | `[]` | X-axis category labels; each series' `data` is indexed by position against these. |
| `series` | `StripSeries[]` | `[]` | Line series; `data` holds one value per category, and `null` or non-finite values are gaps that break the line. |
| `strips` | `StripBand[]` | `[]` | Coloured bands drawn behind the data: horizontal bands span a Y-value range, vertical bands span a category-index range. |
| `options` | `StripLineChartOptions` | `{}` | Display options: height, grid, axis labels, legend, band labels, grid divisions, dots and draw-in animation. |
| `customClass` | `string` | `''` | Extra CSS classes applied to the root wrapper. |
| `ariaLabel` | `string` | `''` | Accessible-name override; otherwise a structure summary is generated. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |

### `sv-trend-line-chart`

`import { SvTrendLineChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-trend-line-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="img"` — override its accessible name with `ariaLabel`
- **Data table:** none in this component
- **Keyboard:** has focusable controls or marks
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/line-chart

```html
<sv-trend-line-chart [categories]="categories" [series]="series" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `title` | `string` | `''` | Chart title shown in the header; also the base of the generated accessible name. |
| `subtitle` | `string` | `''` | Secondary line shown below the title. |
| `categories` | `string[]` | `[]` | X-axis category labels; each series' `data` is indexed by position against these. |
| `series` | `TrendLineSeries[]` | `[]` | Scatter series drawn as dots (optionally connected); `data` holds one value per category, and `null` or non-finite values are gaps left out of the fit. |
| `trends` | `TrendLineDefinition[]` | `[{ type: 'linear' }]` | Trend lines to render. The switcher overrides `type` for the first trend. |
| `options` | `TrendLineChartOptions` | `{}` | Display options: height, grid, axis labels, legend, dot radius, trend-type switcher, grid divisions and draw-in animation. |
| `customClass` | `string` | `''` | Extra CSS classes applied to the root wrapper. |
| `ariaLabel` | `string` | `''` | Accessible-name override; otherwise a structure summary is generated. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |

### `sv-waterfall-chart`

`import { SvWaterfallChartComponent } from '@styloviz/charts';`

- **Tier:** Free · twin: `sv-waterfall-chart-pro` in `@styloviz-pro/charts`
- **Async states:** `loading`, `empty`, `error`, `retry`
- **Name:** the SVG is `role="group"` — override its accessible name with `ariaLabel`
- **Data table:** yes — the plotted values as a screen-reader table
- **Keyboard:** has focusable controls or marks
- **Caveats:** stated in text under the plot, not only drawn
- **Docs, demos & accessibility notes:** https://styloviz.dev/docs/waterfall-chart

```html
<sv-waterfall-chart [data]="data" />
```

#### Inputs

| Input | Type | Default | Description |
| --- | --- | --- | --- |
| `loading` | `boolean` | `false` | True while the series are being fetched. |
| `error` | `SvDataError \| string \| null` | `null` | Load failure. Use `toSvDataError()` from `@styloviz/core` to normalize an `HttpErrorResponse`. |
| `emptyMessage` | `string` | `'No data to plot'` | Copy for the empty state. |
| `filtered` | `boolean` | `false` | Whether a filter, not an absence of data, is why the chart is empty. |
| `data` | `WaterfallPoint[]` | `[]` | The waterfall series, **in the order it should be read**. Order is the meaning here, not a presentation choice (audit item CH-18-I3). Each bar starts where the previous one ended, so moving a step changes every running total after it: `[+100, −50, ×2]` and `[+100, ×2, −50]` end at 100 and 150 from the same three facts. This component therefore **never sorts** — not by label, not by magnitude, not to put totals last. What you pass is what is read, and a series assembled from an unordered source (a `Map`, an object's keys, a `Promise.all` result) has to be put in order by the caller before it gets here. |
| `valuePolicy` | `SvValuePolicy` | `'clamp'` | What to do with a step this chart cannot draw — one whose `value` is absent, `NaN` or `Infinity`. A negative is not one of these: a waterfall is built out of falls as much as rises. - `clamp` (default) — the step moves the running total by nothing, is marked in the plot, and is named under it. Every later bar keeps its position. - `reject` — refuse the series and show the error state. `omit` is not available: a bar's position is its place in a sequence, so dropping one silently rewrites the arithmetic of every bar after it. `render` is not available either — there is no honest way to draw a step of unknown size. |
| `totalTolerance` | `number` | `0` | How far a stated `subtotal` / `total` may sit from the figure its steps add up to before the chart reports a discrepancy, in data units. `0` (the default) means they must agree, subject to a floating-point band that scales with the numbers involved — see `FLOAT_NOISE`. Raise it when the source rounds: a ledger kept in cents but charted in millions reconciles to within 0.000005, and that is a rounding artefact rather than a hole. |
| `title` | `string` | `''` | Chart title displayed above the SVG. |
| `orientation` | `WaterfallOrientation` | `'vertical'` | Layout direction. |
| `height` | `number` | `380` | SVG height in pixels. |
| `options` | `WaterfallChartOptions` | `{}` | Rendering and feature options. |
| `customClass` | `string` | `''` | Extra CSS classes applied to the root wrapper. |
| `ariaLabel` | `string` | `''` | Accessible-name override for the chart. When empty, a concise summary is generated; the full series is always exposed through a visually-hidden table. |

#### Outputs

| Output | Type | Description |
| --- | --- | --- |
| `retry` | `void` | The host should re-run the failed load. |
| `barHover` | `WaterfallBarEvent` | Emitted when a bar is hovered or keyboard-focused. |
| `barSelect` | `WaterfallBarEvent` | Emitted when a bar is clicked or activated via keyboard (Enter/Space). |

## Documentation

Full API reference and live demos: https://styloviz.dev/docs

## License

MIT
