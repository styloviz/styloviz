import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { SvEmptyShellComponent } from './empty-shell.component';
import { SvErrorShellComponent } from './error-shell.component';
import { SvSkeletonShellComponent } from './skeleton-shell.component';
import type { SvDataError } from '../types';
import { injectSvLabels } from '@styloviz/core/i18n';
import { SV_CORE_LABELS } from '@styloviz/core/i18n';
import { SvDataSummaryTableComponent } from '@styloviz/core/a11y';
import type { SvDataSummary } from '@styloviz/core/a11y';
import { SV_CHART_A11Y, SvChartDataTableDirective, type SvChartDataTableMode } from '@styloviz/core/a11y';
import { svUniqueId } from '@styloviz/core/a11y';

/**
 * ChartFrame — the async states for a chart, by composition.
 *
 * Every chart in the kit renders its plot inside this. It exists because the
 * alternative was adding the same skeleton / error / empty markup to sixty
 * chart components by hand, and because a dashboard whose charts cannot show a
 * spinner or a failed request is the most visible way a kit reads as demo-ware.
 *
 * It reserves `height` in every state, so the page does not jump as a chart
 * moves from skeleton to plot to error — the single most common complaint about
 * async dashboards.
 *
 * ```html
 * <sv-chart-frame
 *   [loading]="loading()"
 *   [error]="error()"
 *   [isEmpty]="!datasets().length"
 *   [height]="height()"
 *   (retry)="retry.emit()"
 * >
 *   <svg>…</svg>
 * </sv-chart-frame>
 * ```
 */
@Component({
  selector: 'sv-chart-frame',
  standalone: true,
  imports: [SvSkeletonShellComponent, SvErrorShellComponent, SvEmptyShellComponent, SvDataSummaryTableComponent],
  templateUrl: './chart-frame.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvChartFrameComponent {
  protected readonly labels = injectSvLabels('core', SV_CORE_LABELS);

  /** True while the series are being fetched. @default false */
  readonly loading = input<boolean>(false);

  /**
   * Load failure. A bare string is accepted; use `toSvDataError()` to normalize
   * an `HttpErrorResponse` and get sensible retry behaviour.
   * @default null
   */
  readonly error = input<SvDataError | string | null>(null);

  /**
   * Whether there is nothing to plot. Charts decide this themselves — an empty
   * `datasets`, all-zero series, a filtered-out range — so it is an input
   * rather than something guessed here.
   * @default false
   */
  readonly isEmpty = input<boolean>(false);

  /**
   * Plot height in pixels, reserved in every state so the page does not jump
   * between skeleton, plot and error.
   * @default 240
   */
  readonly height = input<number>(240);

  /** Copy for the empty state. @default 'No data to plot' */
  readonly emptyMessage = input<string>(this.labels.chartEmpty);

  /** Heading for the error state. @default 'Could not load this chart' */
  readonly errorTitle = input<string>(this.labels.chartErrorTitle);

  /**
   * Distinguishes "no data at all" from "nothing matched the current filters",
   * which need different copy and different recovery.
   * @default false
   */
  readonly filtered = input<boolean>(false);

  /**
   * A disclosure to render beside the plot — what the chart altered or left out
   * of the data it was given, in words the person reading the dashboard sees.
   *
   * This exists because a console warning was the kit's answer to an unplottable
   * datum, and a warning in devtools is not a disclosure: the chart still showed
   * a clean plot of a dataset it had quietly changed. `svApplyValuePolicy()`
   * produces the text; every chart that plots a share of a total binds it here.
   *
   * @default null
   */
  readonly notice = input<string | null>(null);

  /**
   * The plot as a table — what the chart says, in rows (`SvDataSummary`). The
   * frame renders it for assistive technology under the plot, and on screen
   * behind a "Show data table" button when the chart a11y module asks for one
   * (`provideSvChartA11y`, or `svChartDataTable` on the chart's element).
   * Only in the plot state: loading, error and empty have their own words.
   * @default null
   */
  readonly summary = input<SvDataSummary | null>(null);

  /**
   * The plot is already a semantic structure — a grid of named cells — so the
   * table is offered on screen only, never as a second hidden copy that would
   * read every value twice. @default false
   */
  readonly nativeAlternative = input<boolean>(false);

  /** The host should re-run the failed load. */
  readonly retry = output<void>();

  private readonly a11y = inject(SV_CHART_A11Y);
  /** The chart's own `svChartDataTable`, from its host element. */
  private readonly perChart = inject(SvChartDataTableDirective, { optional: true });

  protected readonly tableMode = computed<SvChartDataTableMode>(() => {
    const own = this.perChart?.svChartDataTable();
    return own === '' ? 'toggle' : own ?? this.a11y.dataTable;
  });

  /** Whether the "Show data table" table is on screen. */
  protected readonly tableOpen = signal(false);
  protected readonly tableId = svUniqueId('sv-chart-table');

  protected readonly hasRows = computed(() => (this.summary()?.rows.length ?? 0) > 0);

  /** Height as a CSS length, clamped so a bad input cannot collapse the frame. */
  protected readonly heightPx = computed(() => {
    const h = this.height();
    return `${Number.isFinite(h) && h > 0 ? h : 240}px`;
  });
}
