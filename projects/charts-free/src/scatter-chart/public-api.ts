// The @styloviz/charts/scatter-chart entry point. The package barrel (src/public-api.ts) re-exports it.
export { SvScatterChartComponent, DEMO_SCATTER_SERIES } from './scatter-chart.component';
export type {
  ScatterPoint,
  ScatterSeries,
  ScatterPointEvent,
  ScatterBinEvent,
  ScatterBinShare,
  ScatterRenderMode,
} from './scatter-chart.component';
