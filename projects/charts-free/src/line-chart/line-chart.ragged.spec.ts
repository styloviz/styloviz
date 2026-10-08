import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvLineChartComponent, type LineChartSeries } from './line-chart.component';

/**
 * The ragged payload and the out-of-range index.
 *
 * `line-chart.geometry.spec.ts` and `line-chart.interaction.spec.ts` cover the
 * chart with well-formed data. What is left are the defensive arms that only a
 * MISALIGNED payload reaches, and every one of them is a shape a real host
 * produces:
 *
 *  • a series shorter than its neighbours — one metric started reporting later
 *    than the others. In a stack that is fatal: an `undefined` contribution
 *    poisons the running total and every band above it;
 *  • more categories than data, so the tooltip indexes past the end of a row;
 *  • an accessor called with a series index that no longer exists, which is what
 *    a template holds for one change-detection pass after the series list
 *    shortens.
 *
 * Two guards in this file's subject are deliberately NOT exercised here because
 * no input reaches them — see the `★` notes in the component: `axisMax`'s
 * `mv <= 0` (rawMax is floored at 1, or fixed at 100), the `range === 0` arms of
 * `yForValue` / `xForValue_inv` (axisMax >= 1 and axisMin <= 0, so the range is
 * never zero), and `fillPath`'s `!topPath` (both builders return a non-empty
 * path for any non-empty data, and empty data returns earlier).
 */

async function chartWithFixture(inputs: Partial<ComponentInput<SvLineChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvLineChartComponent, {
    inputs: inputs as ComponentInput<SvLineChartComponent>,
  });
  return {
    fixture: r.fixture,
    c: r.fixture.componentInstance,
    host: r.fixture.nativeElement as HTMLElement,
  };
}

async function chart(inputs: Partial<ComponentInput<SvLineChartComponent>> = {}) {
  const { c, host } = await chartWithFixture(inputs);
  return { c, host };
}

const CATS = ['Jan', 'Feb', 'Mar', 'Apr'];
const RAGGED: LineChartSeries[] = [
  { label: 'Full', data: [10, 20, 30, 40] },
  { label: 'Late', data: [5, 5] },
];

describe('SvLineChartComponent — a series shorter than its neighbours', () => {
  it('treats the missing tail as zero when normalising a percentage stack', async () => {
    const { c, host } = await chart({
      categories: CATS,
      series: RAGGED,
      chartType: 'stacked-percent',
    });
    const pct = c.stackedPercentData();
    // Jan: 10 of 15. Feb: 20 of 25. Mar and Apr: 30 and 40 of themselves, the
    // late series contributing an explicit zero rather than `undefined`.
    expect(pct[0].map(Math.round)).toEqual([67, 80, 100, 100]);
    expect(pct[1].map(Math.round)).toEqual([100, 100]);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('treats the missing tail as zero when summing an absolute stack', async () => {
    const { c, host } = await chart({ categories: CATS, series: RAGGED, chartType: 'stacked' });
    expect(c.stackedData()[0]).toEqual([10, 20, 30, 40]);
    // The stacked row is only as long as its OWN data; what the `?? 0` protects
    // is the running sum inside it, which reads the neighbours by index.
    expect(c.stackedData()[1]).toEqual([15, 25]);
    expect(c.rawMax()).toBe(40);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('stacks each band on the one below it, and the first on the baseline', async () => {
    const { c } = await chart({ categories: CATS, series: RAGGED, chartType: 'stacked' });
    const base = c.stackedBaseData();
    expect(base[0]).toEqual([0, 0, 0, 0]); // nothing under the first band
    expect(base[1]).toEqual(c.stackedData()[0]); // the second sits on the first
    // The same shape for a percentage stack, which uses the other data source.
    expect(base.length).toBe(2);
  });

  it('keeps every band on the baseline when the chart is not stacked at all', async () => {
    const { c } = await chart({ categories: CATS, series: RAGGED, chartType: 'line' });
    expect(c.stackedBaseData()).toEqual([[0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(c.effectiveData()).toEqual([[10, 20, 30, 40], [5, 5]]);
  });

  it('reads the missing tail as a gap in the tooltip — never undefined, never 0', async () => {
    const { c, host } = await chart({ categories: CATS, series: RAGGED });
    const svg = host.querySelector('svg')!;
    // jsdom has no layout, so the box is stubbed to the viewBox — the arithmetic
    // under test is the index derivation, not a measurement.
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 640, height: 320, right: 640, bottom: 320, x: 0, y: 0 }) as DOMRect;

    // Aim at the far right — the last category, where 'Late' has no reading.
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 600, clientY: 120, bubbles: true }));
    expect(c.tooltip().visible).toBe(true);
    expect(c.tooltip().catIndex).toBe(3);
    expect(c.tooltip().label).toBe('Apr');
    expect(c.tooltip().items.map((i) => i.value)).toEqual([40, null]);
  });

  it('labels the crosshair with an empty string when the category is missing', async () => {
    // More data than categories: the tooltip index is valid for the series and
    // out of range for the label list.
    const { c, host } = await chart({
      categories: ['Only'],
      series: [{ label: 'S', data: [1, 2, 3, 4] }],
    });
    const svg = host.querySelector('svg')!;
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 640, height: 320, right: 640, bottom: 320, x: 0, y: 0 }) as DOMRect;
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 120, bubbles: true }));
    expect(c.tooltip().visible).toBe(true);
    expect(c.tooltip().label).toBe('Only'); // a single category always wins
    expect(c.tooltip().catIndex).toBe(0);
  });
});

describe('SvLineChartComponent — an index the series list no longer has', () => {
  /**
   * ★ REGRESSION — these accessors threw rather than returning nothing.
   *
   * Each guarded `effectiveData()[si]` with `?? []` and then dereferenced
   * `this.series()[si]` unguarded on the next line. Both arrays are built
   * one-to-one from `series()`, so the fallback fired for exactly the indices
   * where the series was `undefined`, and `isSmooth(s)` threw
   * "Cannot read properties of undefined (reading 'smooth')" before it could
   * help. Thrown from inside a `@for` body, that blanks the entire chart.
   */
  it('draws nothing rather than reading through undefined', async () => {
    // A template holds the old index for one change-detection pass after the
    // series list shortens; every accessor has to survive that pass.
    const { c } = await chart({ categories: CATS, series: RAGGED });
    expect(c.seriesPath(9)).toBe('');
    expect(c.fillPath(9)).toBe('');
    expect(c.dots(9)).toEqual([]);
    expect(c.multiColorSegments(9)).toEqual([]);
  });

  it('survives the series list actually shortening under a live template', async () => {
    const { c, host, fixture } = await chartWithFixture({
      categories: CATS,
      series: RAGGED,
      chartType: 'line',
      options: { showDots: true },
    });
    expect(host.querySelectorAll('path[d]').length).toBeGreaterThan(0);

    fixture.componentRef.setInput('series', [RAGGED[0]]);
    fixture.detectChanges();
    expect(c.seriesPath(1)).toBe('');
    expect(host.innerHTML).not.toContain('NaN');
    expect(host.querySelectorAll('path[d]').length).toBeGreaterThan(0);
  });

  it('draws nothing for a stale index in a stacked chart either', async () => {
    // The stacked branch reaches for a BASE row as well as a data row.
    const { c } = await chart({ categories: CATS, series: RAGGED, chartType: 'stacked' });
    expect(c.fillPath(9)).toBe('');
    expect(c.seriesPath(9)).toBe('');
  });

  it('draws nothing for a stale index in a step chart either', async () => {
    // `step` dispatches to a different builder before the shared code runs.
    const { c } = await chart({ categories: CATS, series: RAGGED, chartType: 'step' });
    expect(c.seriesPath(9)).toBe('');
    expect(c.fillPath(9)).toBe('');
  });
});

/**
 * A reading that was not taken, drawn as not taken.
 *
 * ★★★ THE FAILURE THIS REPLACES WAS TOTAL, NOT LOCAL. The y-axis maximum came
 *     from `Math.max(...data)`, and `Math.max` of anything containing `NaN` is
 *     `NaN` — so one unusable reading made every point's y `NaN` and the path
 *     rendered as `M 0 NaN L 173 NaN L 346 NaN`, which SVG draws as nothing at
 *     all. Measured on four points with one gap: the ENTIRE series vanished,
 *     with no error anywhere.
 *
 *     And the two things a host could do instead were both lies: `0` asserts a
 *     reading of zero, interpolating asserts a reading nobody took. So the line
 *     breaks, and the chart says how many are missing.
 */
describe('SvLineChartComponent — gaps in a series', () => {
  const notice = (host: HTMLElement): string | null =>
    host.querySelector('[data-sv-notice]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;

  const withGap = (data: (number | null)[]): Partial<ComponentInput<SvLineChartComponent>> => ({
    categories: ['a', 'b', 'c', 'd'],
    series: [{ label: 'Sensor', data }],
  }) as Partial<ComponentInput<SvLineChartComponent>>;

  it('keeps drawing the rest of the series around a gap', async () => {
    // ★ REGRESSION — this exact input used to produce an empty chart.
    const { c } = await chartWithFixture(withGap([10, null, 30, 40]));
    const d = c.seriesPath(0);
    expect(d).not.toContain('NaN');
    expect(d.length).toBeGreaterThan(0);
  });

  it('treats NaN and Infinity as gaps, not as coordinates', async () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const { c } = await chartWithFixture(withGap([10, bad as number, 30, 40]));
      expect(c.seriesPath(0)).not.toContain('NaN');
      expect(c.seriesPath(0)).not.toContain('Infinity');
    }
  });

  it('breaks the line rather than joining across the gap', async () => {
    // Two subpaths — a second `M` is what makes the break.
    const { c } = await chartWithFixture(withGap([10, null, 30, 40]));
    expect((c.seriesPath(0).match(/M /g) ?? []).length).toBe(2);
  });

  it('draws one unbroken path when nothing is missing', async () => {
    const { c } = await chartWithFixture(withGap([10, 20, 30, 40]));
    expect((c.seriesPath(0).match(/M /g) ?? []).length).toBe(1);
  });

  it('keeps every surviving point at its own category', async () => {
    // ★ Re-indexing the survivors would slide everything after the gap left and
    //   quietly redate the right-hand half of the chart.
    const gapped = await chartWithFixture(withGap([10, null, 30, 40]));
    const whole = await chartWithFixture(withGap([10, 20, 30, 40]));
    const xs = (d: string) => (d.match(/[ML] ([\d.]+)/g) ?? []).map((m) => m.split(' ')[1]);
    const gappedXs = xs(gapped.c.seriesPath(0));
    const wholeXs = xs(whole.c.seriesPath(0));
    expect(gappedXs).toEqual([wholeXs[0], wholeXs[2], wholeXs[3]]);
  });

  it('scales the axis to the readings that exist', async () => {
    const { c } = await chartWithFixture(withGap([10, null, 30, 40]));
    expect(Number.isFinite(c.axisMax())).toBe(true);
    expect(c.axisMax()).toBeGreaterThanOrEqual(40);
  });

  it('puts no marker where there is no reading', async () => {
    const { c } = await chartWithFixture(withGap([10, null, 30, 40]));
    const dots = c.dots(0);
    expect(dots).toHaveLength(3);
    expect(dots.every((d) => Number.isFinite(d.y))).toBe(true);
  });

  it('does not fill the area under a stretch that was never measured', async () => {
    // A single closed shape would paint straight across the break — the area
    // under missing readings, drawn as though they had been taken.
    const { c } = await chartWithFixture(withGap([10, null, 30, 40]));
    const fill = c.fillPath(0);
    expect(fill).not.toContain('NaN');
    expect((fill.match(/Z/g) ?? []).length).toBe(2);
  });

  it('says how many readings are missing', async () => {
    const { host } = await chartWithFixture(withGap([10, null, null, 40]));
    expect(notice(host)).toContain('2 readings missing');
    expect(notice(host)).toContain('invent a value nobody recorded');
  });

  it('says nothing when the series is complete', async () => {
    const { host } = await chartWithFixture(withGap([10, 20, 30, 40]));
    expect(notice(host)).toBeNull();
  });

  it('survives a series that is entirely missing', async () => {
    const { c, host } = await chartWithFixture(withGap([null, null, null, null]));
    expect(c.seriesPath(0)).toBe('');
    expect(host.innerHTML).not.toContain('NaN');
    expect(notice(host)).toContain('No readings in this series can be plotted');
  });

  it('handles a gap at each end', async () => {
    const { c } = await chartWithFixture(withGap([null, 20, 30, null]));
    const d = c.seriesPath(0);
    expect((d.match(/M /g) ?? []).length).toBe(1);
    expect(d).not.toContain('NaN');
  });

  it('draws an isolated reading as a lone point rather than dropping it', async () => {
    const { c } = await chartWithFixture(withGap([null, 20, null, 40]));
    expect((c.seriesPath(0).match(/M /g) ?? []).length).toBe(2);
    expect(c.dots(0)).toHaveLength(2);
  });

  it('breaks a smooth line at the gap too', async () => {
    const { c } = await chartWithFixture({
      categories: ['a', 'b', 'c', 'd'],
      series: [{ label: 'S', data: [10, null, 30, 40], smooth: true }],
    } as never);
    const d = c.seriesPath(0);
    expect(d).not.toContain('NaN');
    expect((d.match(/M /g) ?? []).length).toBe(2);
  });

  it('breaks a step line at the gap too', async () => {
    const { c } = await chartWithFixture({
      categories: ['a', 'b', 'c', 'd'],
      series: [{ label: 'S', data: [10, null, 30, 40] }],
      chartType: 'step',
    } as never);
    const d = c.seriesPath(0);
    expect(d).not.toContain('NaN');
    expect((d.match(/M /g) ?? []).length).toBe(2);
  });

  it('admits that a stack has to substitute a zero', async () => {
    // ★ A stacked band is positioned by the running total, so a gap CANNOT be
    //   honoured — the number has to come from somewhere. That is unavoidable
    //   and therefore said out loud rather than hidden.
    const { host, c } = await chartWithFixture({
      categories: ['a', 'b', 'c', 'd'],
      series: [
        { label: 'A', data: [10, null, 30, 40] },
        { label: 'B', data: [5, 5, 5, 5] },
      ],
      chartType: 'stacked',
    } as never);
    expect(notice(host)).toContain('has to count as zero');
    expect(c.seriesPath(1)).not.toContain('NaN');
  });
});
