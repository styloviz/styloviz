import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvBarChartComponent } from './bar-chart/bar-chart.component';
import { SvLineChartComponent } from './line-chart/line-chart.component';
import { SvDefaultPieChartComponent } from './pie-chart/default-pie-chart.component';
import { SvRadarChartComponent } from './radar-chart/radar-chart.component';

/**
 * ============================================================================
 *  The free charts' accessible alternative, from the shared component (X-9)
 * ============================================================================
 *
 * The pro spec (`charts/src/chart-data-summary.spec.ts`) explains what was wrong
 * with the hand-rolled `<div class="sr-only"><table>` these three carried. This
 * is the same contract asserted against the free twins, so the two packages
 * cannot drift apart silently.
 *
 * ★ ONE DELIBERATE DIFFERENCE. The pro line chart is `zoomable`, so its table
 *   follows the brush window and adds a "showing 2–6 of 6" overview. There is no
 *   brush here, every point is on screen, and both would describe a window that
 *   does not exist — asserted below so the absence stays a decision.
 * ============================================================================
 */

async function mount<T>(component: Type<T>, inputs: Record<string, unknown>) {
  TestBed.resetTestingModule();
  const r = await render(component, { inputs: inputs as ComponentInput<T> });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

interface ReadSummary {
  readonly caption: string;
  readonly columns: readonly string[];
  readonly rows: readonly { readonly header: string; readonly cells: readonly string[] }[];
  readonly overview: string | null;
}

const text = (n: Element | null | undefined) => n?.textContent?.trim() ?? '';

function summary(host: HTMLElement): ReadSummary | null {
  const table = host.querySelector('sv-data-summary-table table');
  if (!table) return null;
  return {
    caption: text(table.querySelector('caption')),
    columns: [...table.querySelectorAll('thead th')].map(text),
    rows: [...table.querySelectorAll('tbody tr')].map((tr) => ({
      header: text(tr.querySelector('th')),
      cells: [...tr.querySelectorAll('td')].map(text),
    })),
    overview: host.querySelector('sv-data-summary-table p')
      ? text(host.querySelector('sv-data-summary-table p'))
      : null,
  };
}

/**
 * ★ `Type<unknown>`, not an inferred `as const` tuple. With `as const` TypeScript
 *   resolves `mount`'s type parameter from the FIRST row and then rejects the rest,
 *   because these three free charts share no base class — unlike their pro twins,
 *   where the union happens to be structurally compatible and the same code compiles.
 *   These rows only read the rendered host, so the instance type is not needed.
 */
type ChartCase = readonly [name: string, cmp: Type<unknown>, inputs: Record<string, unknown>];

const CATEGORIES = ['Jan', 'Feb', 'Mar'];
const TWO_SERIES = [
  { label: 'Direct', data: [10, 20, 30] },
  { label: 'Social', data: [4, 5, 6] },
];
const SLICES = [
  { label: 'Direct', value: 300 },
  { label: 'Social', value: 100 },
];

// The radar chart is the free package's fourth family. Its alternative is not a
// paid feature, so it is held to exactly the same three assertions as the others.
const AXES = [{ label: 'Speed' }, { label: 'Safety' }];
const RADAR_SERIES = [{ name: 'Model A', color: '#3b82f6', values: [100, 50] }];

const DRAWS: readonly (readonly [...ChartCase, fallback: string])[] = [
  ['bar',   SvBarChartComponent,        { categories: CATEGORIES, datasets: TWO_SERIES }, 'Bar chart'],
  ['line',  SvLineChartComponent,       { categories: CATEGORIES, series: TWO_SERIES },   'Line chart'],
  ['pie',   SvDefaultPieChartComponent, { slices: SLICES },                               'Pie chart'],
  ['radar', SvRadarChartComponent,      { axes: AXES, series: RADAR_SERIES },             'Radar chart'],
];

const EMPTY: readonly ChartCase[] = [
  ['bar',   SvBarChartComponent,        { categories: [], datasets: [] }],
  ['line',  SvLineChartComponent,       { categories: [], series: [] }],
  ['pie',   SvDefaultPieChartComponent, { slices: [] }],
  ['radar', SvRadarChartComponent,      { axes: [], series: [] }],
];

describe('charts-free — the visual alternative comes from the shared component', () => {
  /** ★★ No family may still be carrying its own invisible copy of this table. */
  it.each(DRAWS)('renders the %s chart\'s table once, and no hand-rolled copy', async (_name, cmp, inputs) => {
    const { host } = await mount(cmp, inputs);
    expect(host.querySelectorAll('sv-data-summary-table table')).toHaveLength(1);
    expect(host.querySelector('.sr-only table')).toBeNull();
  });

  /** ★ An empty table announces a table and then reads nothing — worse than none. */
  it.each(EMPTY)('publishes no table for an empty %s chart', async (_name, cmp, inputs) => {
    const { host } = await mount(cmp, inputs);
    expect(summary(host)).toBeNull();
  });

  it.each(DRAWS)('captions the %s chart with its title, or its family when untitled', async (_n, cmp, inputs, fallback) => {
    expect(summary((await mount(cmp, inputs)).host)?.caption).toBe(fallback);
    const titled = await mount(cmp, { ...inputs, title: 'Traffic' });
    expect(summary(titled.host)?.caption).toBe('Traffic');
  });
});

describe('charts-free bar and line — one row per category, one column per series', () => {
  it.each<readonly [...ChartCase, firstColumn: string]>([
    ['bar',  SvBarChartComponent,  { categories: CATEGORIES, datasets: TWO_SERIES }, 'Category'],
    ['line', SvLineChartComponent, { categories: CATEGORIES, series: TWO_SERIES },   'Point'],
  ])('names the %s chart\'s row-header column and every series', async (_n, cmp, inputs, first) => {
    const { host } = await mount(cmp, inputs);
    expect(summary(host)?.columns).toEqual([first, 'Direct', 'Social']);
  });

  it.each<ChartCase>([
    ['bar',  SvBarChartComponent,  { categories: CATEGORIES, datasets: TWO_SERIES }],
    ['line', SvLineChartComponent, { categories: CATEGORIES, series: TWO_SERIES }],
  ])('pairs each %s category with its value in every series', async (_n, cmp, inputs) => {
    const { host } = await mount(cmp, inputs);
    expect(summary(host)?.rows).toEqual([
      { header: 'Jan', cells: ['10', '4'] },
      { header: 'Feb', cells: ['20', '5'] },
      { header: 'Mar', cells: ['30', '6'] },
    ]);
  });

  /** ★ See the header note: there is no brush here, so there is no window to report. */
  it('describes no zoom window, because the free line chart has none', async () => {
    const { host } = await mount(SvLineChartComponent, {
      categories: CATEGORIES,
      series: TWO_SERIES,
    });
    expect(summary(host)?.overview).toBeNull();
    expect(summary(host)?.rows).toHaveLength(CATEGORIES.length);
  });
});

describe('charts-free pie — value and share per segment', () => {
  it('gives the pie chart a segment, value and share column', async () => {
    const { host } = await mount(SvDefaultPieChartComponent, { slices: SLICES });
    expect(summary(host)?.columns).toEqual(['Segment', 'Value', 'Share']);
    expect(summary(host)?.rows).toEqual([
      { header: 'Direct', cells: ['300', '75.0%'] },
      { header: 'Social', cells: ['100', '25.0%'] },
    ]);
  });
});
