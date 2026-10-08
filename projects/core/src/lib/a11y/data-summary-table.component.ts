import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SvDataSummary } from './data-summary';

declare const ngDevMode: boolean | undefined;

/**
 * DataSummaryTable — the semantic equivalent of a visual surface, in one place.
 *
 * Gantt, Kanban, Widget Grid, Heatmap Calendar, Pivot, Tree, Timeline, Image
 * Gallery and nine chart families all need the same thing: a table saying what
 * the picture says. Written per family it was written four times and skipped
 * eight, and each copy re-learned the same CSS lesson the hard way (see the
 * stylesheet). Written once it is one component, one set of rules, one place to
 * fix.
 *
 * The surface computes the rows, because only it knows what a row means:
 *
 * ```html
 * <sv-data-summary-table [summary]="a11ySummary()" />
 * ```
 *
 * ```ts
 * protected readonly a11ySummary = computed<SvDataSummary>(() => ({
 *   caption: `Tasks in ${this.projectName()}`,
 *   columns: ['Task', 'Start', 'End', 'Progress'],
 *   rows: this.visibleTasks().map((t) => ({
 *     key: t.id,
 *     header: t.title,
 *     cells: [this.fmtDate(t.start), this.fmtDate(t.end), `${t.progress ?? 0}%`],
 *   })),
 * }));
 * ```
 *
 * It renders nothing when there are no rows: an empty table announces a table
 * and then nothing, which is worse than the surface's own empty state.
 */
@Component({
  selector: 'sv-data-summary-table',
  standalone: true,
  templateUrl: './data-summary-table.component.html',
  styleUrl: './data-summary-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SvDataSummaryTableComponent {
  /** Caption, column labels and rows — see `SvDataSummary`. */
  readonly summary = input.required<SvDataSummary>();

  protected readonly rows = computed(() => this.summary().rows);

  /**
   * A caption is not decoration: it is how a listener knows which of a
   * dashboard's tables they have landed in. Missing, this component quietly
   * publishes an anonymous one — so say so where it can be fixed, in dev only.
   */
  protected readonly caption = computed(() => {
    const { caption, rows } = this.summary();
    const trimmed = caption.trim();
    if (typeof ngDevMode !== 'undefined' && ngDevMode && rows.length && !trimmed) {
      console.warn('[sv-data-summary-table] rows with no caption — a listener cannot tell this table from any other on the page.');
    }
    // Trimmed, so a whitespace caption is no caption. An empty `<caption>`
    // element announces the table as having a name and then reads nothing.
    return trimmed;
  });
}
