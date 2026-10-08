import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvDateTimeCategoryChartComponent,
  type DateTimeSeries,
} from './datetime-category-chart.component';

/**
 * The path builders and the row reader, which is where a MISALIGNED payload
 * lands. `datetime-category-chart.dates.spec.ts` next door covers the label
 * formatting and the timezone trap it was written for; this covers the geometry
 * around it:
 *
 *  • a series that arrived with no points at all — the axis and grid still
 *    render, so the line and area builders have to emit nothing rather than
 *    `M NaN NaN` or an area closed against an empty line;
 *  • a series shorter than the category list, so the hover row indexes past its
 *    end.
 */

async function setup(inputs: Partial<ComponentInput<SvDateTimeCategoryChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvDateTimeCategoryChartComponent, {
    inputs: inputs as ComponentInput<SvDateTimeCategoryChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const CATS = ['2026-03-15', '2026-03-16', '2026-03-17'];
const SERIES: DateTimeSeries[] = [{ label: 'Visits', data: [10, 20, 30] }];

describe('SvDateTimeCategoryChartComponent — path builders', () => {
  it('draws a polyline across the categories, top-left to bottom-right', async () => {
    const { c } = await setup({ categories: CATS, series: SERIES });
    const d = c.linePath([10, 20, 30]);
    expect(d.startsWith('M 0.0 ')).toBe(true);
    expect((d.match(/L /g) ?? []).length).toBe(2);
    expect(d).not.toContain('NaN');
    // The area closes down to the baseline at both ends.
    const a = c.areaPath([10, 20, 30]);
    expect(a).toBe(`${d} L ${c.plotW()},${c.plotH()} L 0,${c.plotH()} Z`);
  });

  it('draws nothing for a series with no points, and closes nothing either', async () => {
    // The frame still renders — `chartIsEmpty` counts SERIES, not points — so
    // an unguarded builder would emit a path with no `M` and an area anchored
    // to a baseline it never reached.
    const { c, host } = await setup({
      categories: CATS,
      series: [{ label: 'Pending', data: [] }],
    });
    expect(c.chartIsEmpty()).toBe(false);
    expect(c.linePath([])).toBe('');
    expect(c.areaPath([])).toBe('');
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('reads a zero for a category the series does not reach', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'Full', data: [1, 2, 3] }, { label: 'Late', data: [9] }],
    });
    // The accessible row for the last category must not read "undefined".
    const summary = c.categoryAriaLabel(2);
    expect(summary).toContain('Full 3');
    expect(summary).toContain('Late 0');
    expect(summary).not.toContain('undefined');
  });

  it('emits an animation duration only when one is configured', async () => {
    const { c: none } = await setup({ categories: CATS, series: SERIES });
    expect(none.animDuration()).toBeNull();
    const { c: set } = await setup({
      categories: CATS, series: SERIES, options: { animationDuration: 0 },
    });
    expect(set.animDuration()).toBe('0ms'); // zero is a value, not an absence
  });
});

describe('showArea', () => {
  // Declared on DateTimeCategoryOptions and read by nothing until 2026-10-02 —
  // `showArea: false` left every area filled.
  const areas = (host: HTMLElement) =>
    [...host.querySelectorAll('path')].filter((p) => (p.getAttribute('fill') ?? '').startsWith('url(#dtc-area-')).length;
  const TWO: DateTimeSeries[] = [{ label: 'Visits', data: [10, 20, 30] }, { label: 'Signups', data: [1, 2, 3] }];

  it('fills every series by default', async () => {
    const { host } = await setup({ categories: CATS, series: TWO });
    expect(areas(host)).toBe(2);
  });

  it('fills none when showArea is false', async () => {
    const { host } = await setup({ categories: CATS, series: TWO, options: { showArea: false } });
    expect(areas(host)).toBe(0);
  });

  it("lets a series' own fill override the chart-wide setting, either way", async () => {
    const mixed: DateTimeSeries[] = [{ ...TWO[0], fill: true }, { ...TWO[1], fill: false }];
    const off = await setup({ categories: CATS, series: mixed, options: { showArea: false } });
    expect(areas(off.host)).toBe(1);
    const on = await setup({ categories: CATS, series: mixed });
    expect(areas(on.host)).toBe(1);
  });
});
