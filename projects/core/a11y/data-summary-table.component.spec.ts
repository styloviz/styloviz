import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/angular';
import { SvDataSummaryTableComponent } from './data-summary-table.component';
import type { SvDataSummary } from './data-summary';

/**
 * ============================================================================
 *  The tabular equivalent of a visual surface (audit item X-9)
 * ============================================================================
 *
 * This exists so that a Gantt chart, a Kanban board and a heatmap calendar can
 * be read by someone who cannot see the geometry. What it must therefore hold is
 * not "renders a table" but the four things a listener depends on: the caption
 * that says which table this is, `scope` on the headers so a cell announces with
 * its row and column, the rows in the order the surface meant, and no table at
 * all when there is nothing to say.
 *
 * The CSS is tested too, because every failure mode of this component is
 * invisible: it either lengthens the page with a table nobody can see, or it
 * disappears from the accessibility tree and there is nothing to hear.
 * ============================================================================
 */

const summary = (over: Partial<SvDataSummary> = {}): SvDataSummary => ({
  caption: 'Tasks in Website relaunch',
  columns: ['Task', 'Start', 'Progress'],
  rows: [
    { key: 'a', header: 'Design', cells: ['2 Mar', '40%'] },
    { key: 'b', header: 'Build', cells: ['9 Mar', '0%'] },
  ],
  ...over,
});

const setup = (over: Partial<SvDataSummary> = {}) =>
  render(SvDataSummaryTableComponent, { inputs: { summary: summary(over) } });

describe('SvDataSummaryTableComponent', () => {
  it('names itself, so a listener knows which table they are in', async () => {
    await setup();
    const table = screen.getByRole('table');
    expect(table.querySelector('caption')?.textContent?.trim()).toBe('Tasks in Website relaunch');
  });

  it('scopes its headers, so a value announces with its row and column', async () => {
    await setup();
    const cols = [...screen.getByRole('table').querySelectorAll('thead th')];
    expect(cols.map((th) => th.getAttribute('scope'))).toEqual(['col', 'col', 'col']);
    expect(cols.map((th) => th.textContent?.trim())).toEqual(['Task', 'Start', 'Progress']);

    const rowHeaders = screen.getAllByRole('rowheader');
    expect(rowHeaders.map((th) => th.getAttribute('scope'))).toEqual(['row', 'row']);
    expect(rowHeaders.map((th) => th.textContent?.trim())).toEqual(['Design', 'Build']);
  });

  it('keeps the surface\'s row order and every cell', async () => {
    await setup();
    const rows = [...screen.getByRole('table').querySelectorAll('tbody tr')];
    expect(rows.map((tr) => [...tr.children].map((c) => c.textContent?.trim()))).toEqual([
      ['Design', '2 Mar', '40%'],
      ['Build', '9 Mar', '0%'],
    ]);
  });

  it('reads an overview before the table when the surface writes one', async () => {
    await setup({ overview: '18 tasks, 3 finishing late.' });
    expect(screen.getByText('18 tasks, 3 finishing late.')).toBeTruthy();
  });

  /**
   * ★ An empty table announces "table" and then nothing, over the top of the
   *   surface's own empty state, which is the thing that actually explains why
   *   there is nothing there.
   */
  it('renders nothing at all when there are no rows', async () => {
    await setup({ rows: [] });
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('warns in dev when rows arrive with no caption', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await setup({ caption: '   ' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no caption'));
    expect(screen.getByRole('table').querySelector('caption')).toBeNull();
    warn.mockRestore();
  });

  it('puts the wrapper the stylesheet targets around the table', async () => {
    const { container } = await setup();
    expect(container.querySelector('.sv-summary > table')).toBeTruthy();
  });
});

/**
 * ============================================================================
 *  The stylesheet, asserted at the source
 * ============================================================================
 *
 * A SOURCE assertion, for the reason `rich-text-editor.styles.spec.ts` sets out:
 * jsdom has no layout, so `getComputedStyle` there does not resolve a stylesheet
 * against a rule at all, and a DOM assertion cannot see a containment rule that
 * has stopped applying. What is checkable here, cheaply and exactly, is that the
 * rules which fix a shipped bug are still written.
 * ============================================================================
 */
describe('the containment rules — every failure here is invisible', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(resolve(here, 'data-summary-table.component.css'), 'utf8');
  const wrapperRule = css.slice(css.indexOf('.sv-summary'));

  /**
   * ★★★ The regression this component exists downstream of: a 1×1 `absolute`
   *     wrapper resolves against the nearest POSITIONED ancestor, and the charts
   *     that first hand-rolled this had none — so a twenty-row table resolved
   *     against the initial containing block, hung past the fold, and the window
   *     grew a scrollbar for a table nobody can see. `fixed` needs no positioned
   *     ancestor, which is what makes this safe to drop into a dozen surfaces
   *     that know nothing about it.
   */
  it('positions the wrapper so no host has to be positioned for it', () => {
    expect(wrapperRule).toMatch(/position:\s*fixed/);
    expect(wrapperRule).not.toMatch(/position:\s*(absolute|relative|static)/);
  });

  it('clips it to 1×1 and hides the overflow, so there is nothing to see', () => {
    expect(wrapperRule).toMatch(/width:\s*1px/);
    expect(wrapperRule).toMatch(/height:\s*1px/);
    expect(wrapperRule).toMatch(/overflow:\s*hidden/);
  });

  /** ★ It resolves over the viewport corner, so it must not eat a click there. */
  it('does not take pointer events', () => {
    expect(wrapperRule).toMatch(/pointer-events:\s*none/);
  });

  /**
   * ★★ `display: contents` on the host, because the surfaces render this inside
   *    flex containers with `gap` — an in-flow host box would add a gap to a
   *    dozen layouts for a table nobody can see.
   */
  it('gives the host no box of its own', () => {
    expect(css.slice(css.indexOf(':host'), css.indexOf('.sv-summary'))).toMatch(
      /display:\s*contents/,
    );
  });

  /**
   * ★★ THE TABLE MUST STAY A TABLE. Making it a block — the obvious way to stop a
   *    clipped table from keeping its own content height — strips the row and
   *    header semantics from the accessibility tree, leaving a component whose
   *    entire purpose is silently gone while every DOM assertion above still
   *    passes.
   */
  it('never restyles the table itself', () => {
    expect(css).not.toMatch(/table\s*\{/);
  });
});
