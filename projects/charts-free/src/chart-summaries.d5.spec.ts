import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvColumnDrilldownChartComponent } from './bar-chart/column-drilldown-chart.component';
import { SvCylindricalColumnChartComponent } from './bar-chart/cylindrical-column-chart.component';
import { SvRangeColumnChartComponent } from './bar-chart/range-column-chart.component';
import { SvStripLineChartComponent } from './line-chart/strip-line-chart.component';
import { SvTrendLineChartComponent } from './line-chart/trend-line-chart.component';
import { SvLiveStreamChartComponent } from './live-chart/live-stream-chart.component';
import { SvLiveUpdateChartComponent } from './live-chart/live-update-chart.component';
import { SvAxisLabelTemplateChartComponent } from './other-chart/axis-label-template-chart.component';
import { SvDateTimeCategoryChartComponent } from './other-chart/datetime-category-chart.component';

/**
 * ============================================================================
 *  FL-D5 — the nine free charts that drew a frame but published no summary
 * ============================================================================
 *
 * Each of these rendered `<sv-chart-frame>` without `[summary]`, so a listener
 * got the picture's name and nothing else. The assertions read the hidden
 * `sv-data-summary-table` the frame renders and check that it says what the
 * chart DRAWS: the current drill level, the active live source, the readings in
 * the live window, dates as the axis prints them — and that a clamped or
 * omitted value says so instead of passing for a drawn one.
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
  const p = host.querySelector('sv-data-summary-table p');
  return {
    caption: text(table.querySelector('caption')),
    columns: [...table.querySelectorAll('thead th[scope="col"]')].map(text),
    rows: [...table.querySelectorAll('tbody tr')].map((tr) => ({
      header: text(tr.querySelector('th[scope="row"]')),
      cells: [...tr.querySelectorAll('td')].map(text),
    })),
    overview: p ? text(p) : null,
  };
}

describe('FL-D5 summaries — bar family', () => {
  it('column drill-down lists only the level that is showing', async () => {
    const { c, host, fixture } = await mount(SvColumnDrilldownChartComponent, {
      title: 'Sales',
      categories: ['Q1', 'Q2'],
      datasets: [{
        label: 'Revenue',
        data: [10, 20],
        drilldown: {
          Q1: { title: 'Q1 months', categories: ['Jan', 'Feb', 'Mar'], datasets: [{ label: 'Revenue', data: [3, 4, 3] }] },
        },
      }],
    });
    expect(summary(host)).toEqual({
      caption: 'Sales',
      columns: ['Category', 'Revenue'],
      rows: [
        { header: 'Q1', cells: ['10'] },
        { header: 'Q2', cells: ['20'] },
      ],
      overview: null,
    });

    const drillable = c.bars().find((b) => b.hasDrilldown);
    expect(drillable).toBeDefined();
    c.drillDown(drillable!);
    fixture.detectChanges();

    const drilled = summary(host);
    expect(drilled?.caption).toBe('Sales — Q1 months');
    expect(drilled?.rows).toEqual([
      { header: 'Jan', cells: ['3'] },
      { header: 'Feb', cells: ['4'] },
      { header: 'Mar', cells: ['3'] },
    ]);
    // The plot's name follows the level too.
    expect(host.querySelector('svg[role="group"]')?.getAttribute('aria-label')).toContain('3 categories');
  });

  it('cylindrical column marks a value it stubbed at the baseline', async () => {
    const { host } = await mount(SvCylindricalColumnChartComponent, {
      title: 'Energy',
      categories: ['2025', '2026'],
      datasets: [
        { label: 'Solar', data: [5, -5] },
        { label: 'Wind', data: [1, 2] },
      ],
    });
    expect(summary(host)).toEqual({
      caption: 'Energy',
      columns: ['Category', 'Solar', 'Wind'],
      rows: [
        { header: '2025', cells: ['5', '1'] },
        { header: '2026', cells: ['-5 (not drawn to scale)', '2'] },
      ],
      overview: null,
    });
  });

  it('range column gives the low and high per category, and names a range it left out', async () => {
    const { host } = await mount(SvRangeColumnChartComponent, {
      title: 'Temperature',
      categories: ['Mon', 'Tue'],
      datasets: [{ label: 'Temp', data: [{ low: 1, high: 5 }, { low: -2, high: 3 }] }],
    });
    expect(summary(host)).toEqual({
      caption: 'Temperature',
      columns: ['Category', 'Low', 'High'],
      rows: [
        { header: 'Mon', cells: ['1', '5'] },
        { header: 'Tue', cells: ['-2 (not drawn)', '3 (not drawn)'] },
      ],
      overview: null,
    });
  });

  it('range column adds a series column when there is more than one series', async () => {
    const { host } = await mount(SvRangeColumnChartComponent, {
      categories: ['Mon'],
      datasets: [
        { label: 'Berlin', data: [{ low: 2, high: 8 }] },
        { label: 'Oslo', data: [{ low: 1, high: 4 }] },
      ],
    });
    const s = summary(host);
    expect(s?.caption).toBe('Range column chart');
    expect(s?.columns).toEqual(['Category', 'Series', 'Low', 'High']);
    expect(s?.rows).toEqual([
      { header: 'Mon', cells: ['Berlin', '2', '8'] },
      { header: 'Mon', cells: ['Oslo', '1', '4'] },
    ]);
  });

  it('axis-label template puts the sub-label in the row header and names its series', async () => {
    const { host } = await mount(SvAxisLabelTemplateChartComponent, {
      title: 'Channels',
      categories: [{ label: 'Web', subLabel: '+12%', icon: '●' }, { label: 'Store' }],
      datasets: [{ label: 'Sales', data: [1200, 300] }],
    });
    expect(summary(host)).toEqual({
      caption: 'Channels',
      columns: ['Category', 'Sales'],
      rows: [
        { header: 'Web (+12%)', cells: ['1.2k'] },
        { header: 'Store', cells: ['300'] },
      ],
      overview: null,
    });
    expect(host.querySelector('svg[role="group"]')?.getAttribute('aria-label'))
      .toBe('Channels: series Sales across 2 categories.');
  });
});

describe('FL-D5 summaries — line family', () => {
  it('strip line lists the readings, a gap as "No reading", and the labelled bands in the overview', async () => {
    const { host } = await mount(SvStripLineChartComponent, {
      title: 'Latency',
      categories: ['A', 'B', 'C'],
      series: [{ label: 'p99', data: [100, null, 300] }],
      strips: [
        { start: 0, end: 200, color: '#10b981', label: 'Good' },
        { start: 200, color: '#ef4444', label: 'Bad' },
        { orientation: 'vertical', start: 0, end: 1, color: '#3b82f6', label: 'Deploy' },
        { start: 0, end: 50, color: '#000000' },
      ],
    });
    expect(summary(host)).toEqual({
      caption: 'Latency',
      columns: ['Category', 'p99'],
      rows: [
        { header: 'A', cells: ['100'] },
        { header: 'B', cells: ['No reading'] },
        { header: 'C', cells: ['300'] },
      ],
      overview: 'Bands: Good: 0 to 200; Bad: 200 and above; Deploy: A to B.',
    });
  });

  it('strip line writes no overview when no band is labelled', async () => {
    const { host } = await mount(SvStripLineChartComponent, {
      categories: ['A', 'B'],
      series: [{ label: 'p99', data: [1, 2] }],
      strips: [{ start: 0, end: 1, color: '#000000' }],
    });
    expect(summary(host)?.overview).toBeNull();
    expect(summary(host)?.caption).toBe('Strip line chart');
  });

  it('trend line states the linear slope and R² in the overview', async () => {
    const { host } = await mount(SvTrendLineChartComponent, {
      title: 'Revenue',
      categories: ['W1', 'W2', 'W3', 'W4'],
      series: [{ label: 'Rev', data: [10, 20, null, 40] }],
    });
    expect(summary(host)).toEqual({
      caption: 'Revenue',
      columns: ['Category', 'Rev'],
      rows: [
        { header: 'W1', cells: ['10'] },
        { header: 'W2', cells: ['20'] },
        { header: 'W3', cells: ['No reading'] },
        { header: 'W4', cells: ['40'] },
      ],
      overview: 'Linear trend for Rev: +10 per category, R² 1.000.',
    });
  });

  it('trend line follows the switcher, and a moving average gives its start and end', async () => {
    const { c, host, fixture } = await mount(SvTrendLineChartComponent, {
      categories: ['W1', 'W2', 'W3', 'W4'],
      series: [{ label: 'Rev', data: [10, 20, 30, 40] }],
    });
    c.setTrendType('moving-average');
    fixture.detectChanges();
    expect(summary(host)?.overview).toBe('Moving Avg trend for Rev: from 15 to 35.');
  });

  it('date-time category prints each date as the axis does, in the chart locale', async () => {
    const locale = 'de-DE';
    const { host } = await mount(SvDateTimeCategoryChartComponent, {
      title: 'Revenue',
      categories: ['2026-03-15', '2026-04-15'],
      series: [{ label: 'Rev', data: [10, 2500] }],
      options: { zoom: 'day' },
      locale,
    });
    const day = (m: number) => new Date(2026, m, 15).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    expect(summary(host)).toEqual({
      caption: 'Revenue',
      columns: ['Category', 'Rev'],
      rows: [
        { header: day(2), cells: ['10'] },
        { header: day(3), cells: ['2.5k'] },
      ],
      overview: null,
    });
    expect(summary(host)?.rows[0].header).not.toBe('2026-03-15');
    expect(host.querySelector('svg[role="group"]')?.getAttribute('aria-label'))
      .toBe('Revenue: series Rev across 2 points.');
  });
});

describe('FL-D5 summaries — live family', () => {
  it('live stream lists the readings in the window, numbered as the axis numbers them', async () => {
    const { c, host, fixture } = await mount(SvLiveStreamChartComponent, {
      title: 'Sensors',
      series: [{ label: 'CPU' }, { label: 'Memory' }],
      options: { windowSize: 3, yMin: 0, yMax: 100 },
    });
    // A host-fed stream starts empty, so there is nothing to describe yet.
    expect(summary(host)).toBeNull();

    c.bufferData.set([[40, 50, 120], [10, 20, 30]]);
    c.pointCount.set(7);
    fixture.detectChanges();

    expect(summary(host)).toEqual({
      caption: 'Sensors',
      columns: ['Point', 'CPU', 'Memory'],
      rows: [
        { header: '5', cells: ['40', '10'] },
        { header: '6', cells: ['50', '20'] },
        { header: '7', cells: ['120 (not drawn to scale)', '30'] },
      ],
      overview: null,
    });
    // The table is never a live region: a tick must not be announced.
    expect(host.querySelector('sv-data-summary-table [aria-live]')).toBeNull();
  });

  it('live update describes the active source only, and follows a switch', async () => {
    const sources = [
      { id: 'a', label: '2023', datasets: [{ label: 'Revenue', data: [100, 1500] }] },
      { id: 'b', label: '2024', datasets: [{ label: 'Revenue', data: [120, 90] }] },
    ];
    const { c, host, fixture } = await mount(SvLiveUpdateChartComponent, {
      title: 'Finance',
      categories: ['Jan', 'Feb'],
      sources,
    });
    expect(summary(host)).toEqual({
      caption: 'Finance — 2023',
      columns: ['Category', 'Revenue'],
      rows: [
        { header: 'Jan', cells: ['100'] },
        { header: 'Feb', cells: ['1.5k'] },
      ],
      overview: null,
    });

    c.switchSource('b');
    fixture.detectChanges();
    const switched = summary(host);
    expect(switched?.caption).toBe('Finance — 2024');
    expect(switched?.rows).toEqual([
      { header: 'Jan', cells: ['120'] },
      { header: 'Feb', cells: ['90'] },
    ]);
  });
});
