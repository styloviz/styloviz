import { Directive, InjectionToken, input, type Provider } from '@angular/core';

/**
 * The chart accessibility module — how a chart's data table is offered.
 *
 * Every chart already publishes its data as a table for assistive technology
 * (`SvDataSummary`, rendered by `sv-chart-frame`). What this adds is the same
 * table for EVERYONE: a "Show data table" button under the plot, the way
 * Highcharts and Datawrapper offer one. A sighted reader who wants the exact
 * figure, a low-vision reader zoomed past the axis, a reader on a printout —
 * none of them can use a table that only a screen reader reaches.
 *
 *   - `'hidden'` — the table is there for assistive technology only (the
 *     default, and how every chart rendered before this existed).
 *   - `'toggle'` — a button under the plot shows and hides the table on screen.
 *
 * App-wide with `provideSvChartA11y({ dataTable: 'toggle' })`, or per chart with
 * the `svChartDataTable` attribute on the chart's own element.
 */
export type SvChartDataTableMode = 'hidden' | 'toggle';

export interface SvChartA11yConfig {
  /** How each chart's data table is offered. @default 'hidden' */
  readonly dataTable: SvChartDataTableMode;
}

const DEFAULTS: SvChartA11yConfig = { dataTable: 'hidden' };

export const SV_CHART_A11Y = new InjectionToken<SvChartA11yConfig>('SV_CHART_A11Y', {
  providedIn: 'root',
  factory: () => DEFAULTS,
});

/**
 * Set the chart accessibility module for an app, a route or one component's
 * subtree: `providers: [provideSvChartA11y({ dataTable: 'toggle' })]`.
 */
export function provideSvChartA11y(config: Partial<SvChartA11yConfig>): Provider {
  return { provide: SV_CHART_A11Y, useValue: { ...DEFAULTS, ...config } };
}

/**
 * One chart's data-table mode, on the chart's own element:
 *
 * ```html
 * <sv-bar-chart svChartDataTable [datasets]="…" />            <!-- toggle -->
 * <sv-bar-chart svChartDataTable="hidden" [datasets]="…" />   <!-- opt out -->
 * ```
 *
 * ★ It works on every chart without each one declaring an input, because the
 *   chart's `sv-chart-frame` sits inside the chart's view and injects this from
 *   the chart's host element. A chart a buyer writes on `sv-chart-frame` gets it
 *   the same way.
 */
@Directive({ selector: '[svChartDataTable]', standalone: true })
export class SvChartDataTableDirective {
  /** `'toggle'` (or the bare attribute) shows the button; `'hidden'` opts this chart out. @default 'toggle' */
  readonly svChartDataTable = input<SvChartDataTableMode | ''>('toggle');
}
