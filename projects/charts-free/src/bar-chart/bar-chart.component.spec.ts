import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvBarChartComponent } from './bar-chart.component';
import type { BarChartDataset } from './bar-chart.types';

/**
 * Grouped bars in two orientations. The geometry is a band per category
 * subdivided by series, so the cases that bite are the ones where a divisor is
 * zero (no categories, no series) and the ones where a value does not fit the
 * model the chart assumes — a negative value on an axis that starts at zero,
 * a short dataset, an all-zero column.
 */

async function setup(inputs: Partial<ComponentInput<SvBarChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvBarChartComponent, {
    inputs: inputs as ComponentInput<SvBarChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const CATS = ['Jan', 'Feb', 'Mar'];
const ONE: BarChartDataset[] = [{ label: 'Revenue', data: [120, 180, 90] }];
const TWO: BarChartDataset[] = [
  { label: 'Revenue', data: [120, 180, 90] },
  { label: 'Costs', data: [60, 90, 45] },
];

describe('SvBarChartComponent — layout', () => {
  it('lays one bar per series per category, filling the band', async () => {
    const { c } = await setup({ categories: CATS, datasets: TWO, options: { barGap: 0 } });
    const bars = c.verticalBars();
    expect(bars.length).toBe(6);
    // With no gap the two series exactly halve the category band.
    const bandW = c.plotW() / 3;
    expect(bars[0].barW).toBeCloseTo(bandW / 2, 9);
    expect(bars[3].x - bars[0].x).toBeCloseTo(bandW / 2, 9);
  });

  it('reserves the gap fraction of each band as empty space', async () => {
    const { c } = await setup({ categories: CATS, datasets: ONE, options: { barGap: 0.5 } });
    const bandW = c.plotW() / 3;
    expect(c.verticalBars()[0].barW).toBeCloseTo(bandW / 2, 9);
    expect(c.verticalBars()[0].x).toBeCloseTo(bandW / 4, 9);
  });

  it('draws nothing when either axis of the grid is empty', async () => {
    // `plotW / 0` is Infinity and every x and width becomes NaN.
    const { c: noCats } = await setup({ categories: [], datasets: ONE });
    expect(noCats.verticalBars()).toEqual([]);
    expect(noCats.horizontalBars()).toEqual([]);

    const { c: noSets } = await setup({ categories: CATS, datasets: [] });
    expect(noSets.verticalBars()).toEqual([]);
    expect(noSets.chartIsEmpty()).toBe(true);
  });

  it('grows columns up from the baseline and bars right from the axis', async () => {
    const { c: vert } = await setup({ categories: CATS, datasets: ONE });
    const tallest = vert.verticalBars()[1]; // 180, the maximum
    expect(tallest.y + tallest.barH).toBeCloseTo(vert.plotH(), 9);

    const { c: horiz } = await setup({
      categories: CATS,
      datasets: ONE,
      orientation: 'horizontal',
    });
    expect(horiz.horizontalBars().every((b) => b.x === 0)).toBe(true);
    expect(horiz.horizontalBars()[1].barW).toBeGreaterThan(horiz.horizontalBars()[2].barW);
  });

  it('reads a missing value as zero rather than as an undefined height', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Partial', data: [120] }],
    });
    const bars = c.verticalBars();
    expect(bars[1].value).toBe(0);
    expect(bars[1].barH).toBe(0);
    expect(Number.isNaN(bars[1].y)).toBe(false);
  });

  it('gives an all-zero dataset a real axis rather than a zero divisor', async () => {
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Idle', data: [0, 0, 0] }],
    });
    // `maxValue` floors at 1, so `niceMax` never sees the 0 that would make it
    // return its own 10 fallback — the ceiling here is 1, not 10.
    expect(c.maxValue()).toBe(1);
    expect(c.axisMax()).toBe(1);
    expect(c.verticalBars().every((b) => b.barH === 0)).toBe(true);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('marks a negative value at the baseline instead of leaving a gap', async () => {
    // This chart's axis starts at zero, so a negative bar has nowhere to go. It
    // used to be clamped to a height of 0 — which draws no path at all, so the
    // category simply had no bar, and the only report of that was a dev-mode
    // `console.warn` nobody reading a dashboard sees.
    //
    // A stub is what replaces it: visible, focusable (the path is the tab stop
    // and carries the accessible name), amber rather than the series colour, and
    // the same 3px whatever the value was, so it cannot be read as a small
    // measurement. `value` stays the real number — see the next test.
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Net', data: [120, -50, 90] }],
    });
    const negative = c.verticalBars()[1];
    expect(negative.clamped).toBe(true);
    expect(negative.barH).toBe(3);
    expect(negative.color).toBe('var(--color-warning-600)');
    expect(c.vertBarPath(negative.x, negative.y, negative.barW, negative.barH, negative.r)).not.toBe('');
    expect(host.querySelectorAll('[data-sv-clamped]').length).toBe(1);
    expect(host.innerHTML).not.toContain('NaN');

    // The mark is not colour-only: the name says it in words, and the frame
    // states the count under the plot.
    expect(c.barAriaLabel(negative.cat, negative.series, negative.value, negative.clamped))
      .toContain('not drawn to scale');
    expect(host.querySelector('[data-sv-notice]')?.textContent).toContain('1 bar');
  });

  it('keeps the real (unclamped) value on the bar datum for tooltips and labels', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Net', data: [120, -50, 90] }],
    });
    // The plotted geometry is clamped to 0; the datum's own `value` is not —
    // a tooltip or `showValues` label must still show -50, not 0.
    expect(c.verticalBars()[1].value).toBe(-50);
  });

  it('clamps the corner radius so a short bar is not over-rounded', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Tiny', data: [1, 180, 90] }],
      options: { barRadius: 20 },
    });
    const [tiny] = c.verticalBars();
    expect(tiny.r).toBeCloseTo(tiny.barH / 2, 9);
    expect(tiny.r).toBeLessThan(20);
  });
});

describe('SvBarChartComponent — axis', () => {
  it('rounds the ceiling up and spaces the grid evenly beneath it', async () => {
    const { c } = await setup({ categories: CATS, datasets: ONE });
    expect(c.maxValue()).toBe(180);
    expect(c.axisMax()).toBe(200);
    expect(c.gridValues()).toEqual([0, 40, 80, 120, 160, 200]);
  });

  it('maps a grid value to the top in a column chart and to the right in a bar chart', async () => {
    const { c } = await setup({ categories: CATS, datasets: ONE });
    expect(c.gridLineY(c.axisMax())).toBe(0);
    expect(c.gridLineY(0)).toBe(c.plotH());
    expect(c.gridLineX(c.axisMax())).toBe(c.plotW());
    expect(c.gridLineX(0)).toBe(0);
  });

  it('wraps the palette and honours an explicit dataset colour', async () => {
    const many: BarChartDataset[] = Array.from({ length: 9 }, (_, i) => ({
      label: `S${i}`,
      data: [i],
    }));
    const { c } = await setup({ categories: ['A'], datasets: many });
    expect(c.seriesColors()[8]).toBe(c.seriesColors()[0]);

    const { c: fixed } = await setup({
      categories: CATS,
      datasets: [{ label: 'R', data: [1, 2, 3], color: '#abcdef' }],
    });
    expect(fixed.seriesColors()[0]).toBe('#abcdef');
  });

  it('passes a string value through the formatter untouched', async () => {
    // Category labels reuse `formatValue`; compacting "Jan" would be nonsense.
    const { c } = await setup({ categories: CATS, datasets: ONE });
    expect(c.formatValue('Jan')).toBe('Jan');
    expect(c.formatValue(2_500)).toBe('2.5k');
  });
});

describe('SvBarChartComponent — interaction', () => {
  it('reports the bar that was clicked', async () => {
    const { c } = await setup({ categories: CATS, datasets: TWO });
    const picked: { category: string; series: string; value: number }[] = [];
    c.barSelect.subscribe((e) => picked.push(e));

    c.onBarClick('Feb', 'Costs', 90);
    expect(picked).toEqual([{ category: 'Feb', series: 'Costs', value: 90 }]);
  });

  it('shows a one-row tooltip for the hovered bar and hides it on leave', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: TWO });
    const svg = host.querySelector('svg')!;
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 600, height: 320, right: 600, bottom: 320, x: 0, y: 0 }) as DOMRect;

    const bar = host.querySelector('path[d]')!;
    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 100, clientY: 200, bubbles: true }));

    expect(c.tooltip().visible).toBe(true);
    expect(c.tooltip().label).toBe('Jan');
    expect(c.tooltip().items).toEqual([
      { color: c.seriesColors()[0], series: 'Revenue', value: 120 },
    ]);

    c.hideTooltip();
    expect(c.tooltip().visible).toBe(false);
  });

  it('keeps the tooltip inside the chart at the right edge and the top', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: ONE });
    const svg = host.querySelector('svg')!;
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 600, height: 320, right: 600, bottom: 320, x: 0, y: 0 }) as DOMRect;
    const bar = host.querySelector('path[d]')!;

    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 599, clientY: 0, bubbles: true }));
    expect(c.tooltip().x).toBe(600 - 130);
    expect(c.tooltip().y).toBe(8);

    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 10, clientY: 200, bubbles: true }));
    expect(c.tooltip().x).toBe(10);
    expect(c.tooltip().y).toBe(140);
  });
});

describe('SvBarChartComponent — accessibility and chrome', () => {
  it('describes itself by title, series and category count', async () => {
    const { c } = await setup({ categories: CATS, datasets: TWO, title: 'Q1' });
    expect(c.chartDescription()).toBe('Q1: 2 series (Revenue, Costs) across 3 categories.');

    const { c: one } = await setup({ categories: CATS, datasets: ONE });
    expect(one.chartDescription()).toBe('Bar chart: series Revenue across 3 categories.');

    const { c: single } = await setup({ categories: ['Jan'], datasets: ONE });
    expect(single.chartDescription()).toContain('across 1 category.');
  });

  it('counts unnamed series instead of listing blanks', async () => {
    const { c } = await setup({ categories: CATS, datasets: [{ label: '', data: [1, 2, 3] }] });
    expect(c.chartDescription()).toBe('Bar chart: 1 series across 3 categories.');
  });

  it('falls back to the bare title with nothing to plot, and prefers an override', async () => {
    const { c: noCats } = await setup({ categories: [], datasets: ONE, title: 'Q1' });
    expect(noCats.chartDescription()).toBe('Q1');

    const { c: noSets } = await setup({ categories: CATS, datasets: [] });
    expect(noSets.chartDescription()).toBe('Bar chart');

    const { c: override } = await setup({
      categories: CATS,
      datasets: ONE,
      ariaLabel: 'Quarterly revenue',
    });
    expect(override.resolvedAriaLabel()).toBe('Quarterly revenue');
  });

  it('exposes every cell in the screen-reader table, and zero past the end', async () => {
    const { c, host } = await setup({
      categories: ['Jan', 'Feb'],
      datasets: [{ label: 'Revenue', data: [2_500, 24_000] }],
    });
    expect([...host.querySelectorAll('table td')].map((t) => t.textContent?.trim())).toEqual([
      '2.5k',
      '24k',
    ]);
    expect(c.cellValue(0, 5)).toBe('0');
    expect(c.cellValue(5, 0)).toBe('0');
  });

  it('drops the grid, labels, legend and value annotations independently', async () => {
    const { host: on } = await setup({
      categories: CATS,
      datasets: ONE,
      options: { showValues: true },
    });
    expect(on.querySelector('svg')!.textContent).toContain('120');

    const { host: off } = await setup({
      categories: CATS,
      datasets: ONE,
      options: { showGrid: false, showLabels: false, showLegend: false, showValues: false },
    });
    expect(off.querySelectorAll('line').length).toBeLessThan(on.querySelectorAll('line').length);
    expect(off.querySelector('svg')!.textContent).not.toContain('120');
    // The series name survives only in the screen-reader table.
    expect(off.querySelector('table')!.textContent).toContain('Revenue');
  });

  it('publishes the animation duration only when configured', async () => {
    const { c: timed } = await setup({
      categories: CATS,
      datasets: ONE,
      options: { animationDuration: 700 },
    });
    expect(timed.animDuration()).toBe('700ms');

    const { c: dflt } = await setup({ categories: CATS, datasets: ONE });
    expect(dflt.animDuration()).toBeNull();
  });

  it('honours the height in the viewBox and the plot box', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: ONE, height: 500 });
    expect(c.plotH()).toBe(500 - 24 - 56);
    expect(host.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 600 500');
  });

  it('adds the custom class without dropping the layout classes', async () => {
    const { host } = await setup({ categories: CATS, datasets: ONE, customClass: 'my-bars' });
    expect(host.querySelector('.my-bars')!.className).toContain('flex');
  });

  it('renders both orientations without NaN', async () => {
    for (const orientation of ['vertical', 'horizontal'] as const) {
      const { host } = await setup({
        categories: CATS,
        datasets: TWO,
        orientation,
        options: { showValues: true },
      });
      expect(host.innerHTML, orientation).not.toContain('NaN');
      expect(host.querySelectorAll('path[d]').length).toBe(6);
    }
  });

  /**
   * `barSelect` was mouse-only: the bars carried `(click)` and `cursor-pointer`
   * with no `tabindex`, no role and no key handler, so the chart's one output
   * was unreachable without a pointer. These guard the wiring;
   * `e2e/chart-keyboard.spec.ts` proves the browser's focus order honours it.
   */
  describe('keyboard operability', () => {
    it('exposes every bar as a named, focusable control in both orientations', async () => {
      for (const orientation of ['vertical', 'horizontal'] as const) {
        const { host } = await setup({ categories: CATS, datasets: TWO, orientation });
        const bars = Array.from(host.querySelectorAll('path[d]'));
        expect(bars.length, orientation).toBe(6);
        for (const bar of bars) {
          expect(bar.getAttribute('tabindex'), orientation).toBe('0');
          expect(bar.getAttribute('role'), orientation).toBe('button');
          expect(bar.getAttribute('aria-label'), orientation).toMatch(/^\w+, \w+: /);
        }
      }
    });

    it('emits the same payload from Enter, Space and a click', async () => {
      const { c } = await setup({ categories: CATS, datasets: ONE });
      const seen: { category: string; series: string; value: number }[] = [];
      c.barSelect.subscribe((e) => seen.push(e));

      const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      c.onBarKey(enter, 'Feb', 'Revenue', 180);
      // Space would otherwise page down the scroll container the chart sits in.
      expect(enter.defaultPrevented).toBe(true);

      const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
      c.onBarKey(space, 'Feb', 'Revenue', 180);
      c.onBarClick('Feb', 'Revenue', 180);

      const payload = { category: 'Feb', series: 'Revenue', value: 180 };
      expect(seen).toEqual([payload, payload, payload]);
    });

    it('names a bar by series, category and formatted value', async () => {
      const { c } = await setup({ categories: CATS, datasets: ONE });
      expect(c.barAriaLabel('Feb', 'Revenue', 180)).toBe('Revenue, Feb: 180');
      // A single unlabelled series must not produce a leading comma.
      expect(c.barAriaLabel('Feb', '', 180)).toBe('Feb: 180');
    });

    it('positions the focus tooltip from the bar, keeping it on the canvas', async () => {
      const { c } = await setup({ categories: CATS, datasets: ONE });
      const bar = c.verticalBars()[1];

      c.focusTooltip(bar.x, bar.y, bar.cat, bar.series, bar.value, bar.color);
      const t = c.tooltip();
      expect(t.visible).toBe(true);
      expect(t.label).toBe('Feb');
      expect(t.items).toEqual([{ color: bar.color, series: 'Revenue', value: 180 }]);
      expect(t.x).toBeLessThanOrEqual(c.SVG_WIDTH - 130);
      expect(t.y).toBeGreaterThanOrEqual(8);

      // A bar at the far right must not push the tooltip off the canvas, and a
      // negative coordinate must not pull it off the left.
      c.focusTooltip(c.SVG_WIDTH + 40, -200, 'Mar', 'Revenue', 90, '#000');
      expect(c.tooltip().x).toBe(c.SVG_WIDTH - 130);
      expect(c.tooltip().y).toBe(8);

      c.hideTooltip();
      expect(c.tooltip().visible).toBe(false);
    });
  });
});

/**
 * `X-7` — what this chart does with a number it cannot draw, and how it says so.
 *
 * The axis starts at zero, so a negative bar has nowhere to go and `NaN` has no
 * position at all. Both used to reach the geometry: the negative was clamped with
 * a dev-only `console.warn`, and the `NaN` was not caught anywhere.
 */
describe('SvBarChartComponent — a bar it cannot draw', () => {
  const notice = (host: HTMLElement) =>
    host.querySelector('[data-sv-notice]')?.textContent?.trim() ?? '';

  it('keeps the whole plot from going blank over one NaN', async () => {
    // ★★★ THE DEFECT. `Math.max(120, NaN)` is NaN, `niceMax(NaN)` is NaN, so the
    //     axis ceiling was NaN — and every bar height, every grid line and every
    //     tick label divided by it. SVG drops a NaN dimension in silence, so one
    //     blank cell in the source emptied the entire chart with no error, no
    //     warning and no empty state.
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Revenue', data: [120, NaN, 90] }],
    });
    expect(c.axisMax()).toBe(200);
    expect(c.gridValues().every(Number.isFinite)).toBe(true);
    expect(c.verticalBars()[0].barH).toBeGreaterThan(0);
    expect(host.innerHTML).not.toContain('NaN');
    expect(c.verticalBars()[1].clamped).toBe(true);
  });

  it('says "no value" rather than printing NaN as a measurement', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Revenue', data: [120, NaN, 90] }],
    });
    expect(c.formatValue(NaN)).toBe('no value');
    expect(c.cellValue(0, 1)).toBe('no value (not drawn to scale)');
    expect(c.cellValue(0, 0)).toBe('120');
  });

  it('marks only the bar it could not draw', async () => {
    // A category that really is 0 must not be marked. The old candidate for the
    // marker was a set of clamped VALUES, and clamping puts 0 in it.
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Revenue', data: [-50, 0, 90] }],
    });
    expect(c.verticalBars().map((b) => b.clamped)).toEqual([true, false, false]);
    expect(c.cellValue(0, 1)).toBe('0');
  });

  it('discloses the alteration under the plot, not only to the console', async () => {
    const { host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Revenue', data: [120, -50, 90] }],
    });
    expect(notice(host)).toContain('1 bar');
    expect(notice(host)).toContain('-50');
  });

  it('refuses the dataset under reject instead of drawing a stub', async () => {
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Revenue', data: [120, -50, 90] }],
      valuePolicy: 'reject',
    });
    expect(host.querySelector('[data-sv-state="error"]')).toBeTruthy();
    expect(c.resolvedError()).toBeTruthy();
    // The error replaces the plot, so there is no mark left to disclose.
    expect(notice(host)).toBe('');
  });

  it('falls back to clamp for omit, because dropping a bar shifts its neighbours', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { c } = await setup({
        categories: CATS,
        datasets: [{ label: 'Revenue', data: [120, -50, 90] }],
        valuePolicy: 'omit',
      });
      // Three categories in, three bars out — Mar is still under the Mar label.
      expect(c.verticalBars().length).toBe(3);
      expect(c.verticalBars()[2].value).toBe(90);
      expect(c.verticalBars()[1].clamped).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });

  it('stays silent on data it can draw', async () => {
    const { host } = await setup({ categories: CATS, datasets: TWO });
    expect(host.querySelector('[data-sv-notice]')).toBeNull();
    expect(host.querySelector('[data-sv-clamped]')).toBeNull();
  });
});
