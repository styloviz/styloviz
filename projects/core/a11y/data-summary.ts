/**
 * The tabular equivalent of a visual surface.
 *
 * A Gantt chart, a Kanban board, a heatmap calendar and a treemap have one
 * problem in common: the information is in the geometry. Marking up every bar,
 * card and cell with a role describes the drawing, not the data — a listener
 * gets four hundred announcements and no answer to "which tasks slip past
 * Friday?". What works is one semantic table alongside the picture, saying the
 * same thing in rows.
 *
 * The surface owns the mapping, because only it knows what a row means and how
 * to format a value. This module owns the shape they all map into.
 */

/**
 * One row of the summary: a header cell that names the item, then a value per
 * data column.
 *
 * `cells` are strings, already formatted. Dates, durations, currencies and
 * percentages belong to the surface — it has the locale, the format inputs and
 * the domain — and a formatting layer here would end up a second, worse copy of
 * each family's own.
 */
export interface SvSummaryRow {
  /** Stable identity for `track`. The item's own id, not its index. */
  readonly key: string;
  /** What the row is: a task title, a card title, a date. Rendered as `<th scope="row">`. */
  readonly header: string;
  /** One formatted value per data column, in `columns` order after the first. */
  readonly cells: readonly string[];
}

/**
 * A whole summary: what the table is called, its column labels, and its rows.
 *
 * Grouped into one object rather than three inputs because a surface computes
 * all three together from the same state, and a caption that disagrees with the
 * rows it labels is worse than none.
 */
export interface SvDataSummary {
  /**
   * What this table is, as a sentence fragment — `'Tasks in Website relaunch'`.
   * Rendered as the `<caption>`, which is how a listener knows what they have
   * landed in before reading any of it.
   */
  readonly caption: string;
  /**
   * Column labels, including the first one, which labels the row headers —
   * `['Task', 'Start', 'End', 'Progress']`.
   */
  readonly columns: readonly string[];
  /** The rows, in the order a reader should meet them. */
  readonly rows: readonly SvSummaryRow[];
  /**
   * One line of prose read before the table: `'18 tasks, 3 finishing late.'`
   *
   * Optional, and worth writing when the picture makes a point that the rows
   * only imply. An overview that just counts the rows is noise.
   */
  readonly overview?: string;
}

/** An empty summary — nothing to describe, so nothing is rendered. */
export const SV_EMPTY_SUMMARY: SvDataSummary = { caption: '', columns: [], rows: [] };
