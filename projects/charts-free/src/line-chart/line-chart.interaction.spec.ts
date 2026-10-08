import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvLineChartComponent, type LineChartSeries } from './line-chart.component';

/**
 * Hover, crosshair and the rendered SVG.
 *
 * ★ jsdom gives every element a 0×0 `getBoundingClientRect()`, and this
 * component divides the viewBox width by it — so an unmodified hover produces
 * `Infinity` and every assertion about position would be measuring jsdom, not
 * the chart. Every mouse test here therefore installs a rect of the chart's own
 * logical size, which makes the mouse→viewBox transform the identity and the
 * arithmetic the component's own.
 */

async function setup(inputs: Partial<ComponentInput<SvLineChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvLineChartComponent, {
    inputs: inputs as ComponentInput<SvLineChartComponent>,
  });
  const host = r.fixture.nativeElement as HTMLElement;
  return { ...r, c: r.fixture.componentInstance, host };
}

/**
 * Pin the SVG's on-screen box to its logical viewBox so `clientX` maps 1:1 to
 * viewBox units. Returns a `hover(x, y)` in those units.
 */
function pinLayout(host: HTMLElement, width: number, height: number) {
  const svg = host.querySelector('svg')!;
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }) as DOMRect;
  return (clientX: number, clientY: number) => {
    svg.dispatchEvent(
      new MouseEvent('mousemove', { clientX, clientY, bubbles: true }),
    );
  };
}

const CATS = ['Jan', 'Feb', 'Mar', 'Apr'];
const TWO: LineChartSeries[] = [
  { label: 'Users', data: [10, 30, 20, 40] },
  { label: 'Sessions', data: [5, 15, 25, 10] },
];

describe('SvLineChartComponent — hover', () => {
  it('reports the nearest category, its label and every series value', async () => {
    const { c, host, fixture } = await setup({ categories: CATS, series: TWO });
    const hover = pinLayout(host, 600, 300);

    // PAD.left = 56, PAD.top = 28; plotW = 520, so category 1 sits at x = 520/3.
    hover(56 + 520 / 3, 28 + 100);
    fixture.detectChanges();

    const t = c.tooltip();
    expect(t.visible).toBe(true);
    expect(t.catIndex).toBe(1);
    expect(t.label).toBe('Feb');
    expect(t.items).toEqual([
      { color: c.seriesColors()[0], series: 'Users', value: 30 },
      { color: c.seriesColors()[1], series: 'Sessions', value: 15 },
    ]);
  });

  it('snaps the crosshair onto the category, not onto the pointer', async () => {
    const { c, host } = await setup({ categories: CATS, series: TWO });
    const hover = pinLayout(host, 600, 300);

    // Two thirds of the way to category 1 — still rounds to category 1.
    hover(56 + 520 / 3 - 20, 28 + 50);
    expect(c.tooltip().catIndex).toBe(1);
    expect(c.tooltip().crossX).toBe(c.xForIndex(1));
    // The vertical crosshair position tracks the pointer in the normal layout.
    expect(c.tooltip().crossY).toBe(50);
  });

  it('keeps the tooltip inside the chart at the last point', async () => {
    // The last category sits at the right edge; an unclamped tooltip would be
    // drawn from x = 584 and hang 134px off the side of a 600-wide viewBox.
    const { c, host } = await setup({ categories: CATS, series: TWO });
    const hover = pinLayout(host, 600, 300);

    hover(56 + 520, 28 + 100);
    expect(c.tooltip().catIndex).toBe(3);
    expect(c.tooltip().x).toBe(600 - 150 - 4);
  });

  it('does not clamp a tooltip that already fits', async () => {
    const { c, host } = await setup({ categories: CATS, series: TWO });
    const hover = pinLayout(host, 600, 300);

    hover(56, 28 + 100);
    expect(c.tooltip().catIndex).toBe(0);
    expect(c.tooltip().x).toBe(c.xForIndex(0) + 56 + 8);
  });

  it('never lets the tooltip run off the top of the chart', async () => {
    const { c, host } = await setup({ categories: CATS, series: TWO });
    const hover = pinLayout(host, 600, 300);

    hover(56 + 100, 28); // pointer at the very top of the plot
    expect(c.tooltip().y).toBe(4);
  });

  it('hides the tooltip when the pointer leaves the plot area on any side', async () => {
    const { c, host } = await setup({ categories: CATS, series: TWO });
    const hover = pinLayout(host, 600, 300);

    hover(56 + 100, 28 + 100);
    expect(c.tooltip().visible).toBe(true);

    hover(10, 28 + 100); // left of the plot
    expect(c.tooltip().visible).toBe(false);

    hover(56 + 100, 28 + 100);
    hover(595, 28 + 100); // right of the plot
    expect(c.tooltip().visible).toBe(false);

    hover(56 + 100, 28 + 100);
    hover(56 + 100, 10); // above the plot
    expect(c.tooltip().visible).toBe(false);

    hover(56 + 100, 295); // below the plot
    expect(c.tooltip().visible).toBe(false);
  });

  it('hides the tooltip on mouse leave', async () => {
    const { c, host } = await setup({ categories: CATS, series: TWO });
    const hover = pinLayout(host, 600, 300);
    hover(56 + 100, 28 + 100);
    expect(c.tooltip().visible).toBe(true);

    host.querySelector('svg')!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(c.tooltip().visible).toBe(false);
  });

  it('ignores a hover when there are no categories to snap to', async () => {
    // Series without categories still renders an SVG, so the handler is
    // reachable; `n - 1` would be -1 and the index would come out NaN.
    const { c, host } = await setup({ categories: [], series: TWO });
    const hover = pinLayout(host, 600, 300);
    hover(56 + 100, 28 + 100);
    expect(c.tooltip().visible).toBe(false);
  });

  it('indexes by the vertical position in the inversed layout', async () => {
    const { c, host } = await setup({ categories: CATS, series: TWO, chartType: 'inversed' });
    // PAD_INV = { top: 24, left: 130 }; plotH_inv = 300 - 24 - 44 = 232.
    const hover = pinLayout(host, 600, 300);

    hover(130 + 100, 24 + 232);
    const t = c.tooltip();
    expect(t.visible).toBe(true);
    expect(t.catIndex).toBe(3);
    expect(t.label).toBe('Apr');
    // Inversed swaps which coordinate is snapped: y locks to the category.
    expect(t.crossY).toBe(c.yForIndex_inv(3));
    expect(t.crossX).toBe(100);
  });

  it('respects the inversed plot bounds, which differ from the normal ones', async () => {
    const { c, host } = await setup({ categories: CATS, series: TWO, chartType: 'inversed' });
    const hover = pinLayout(host, 600, 300);

    // x = 500 is inside the normal plot (width 520) but outside the inversed
    // one (width 430) — reading the wrong padding would show a tooltip here.
    hover(130 + 500, 24 + 100);
    expect(c.tooltip().visible).toBe(false);
  });

  it('grows the marker for the hovered category only', async () => {
    const { host, fixture } = await setup({
      categories: CATS,
      series: [TWO[0]],
      options: { showDots: true },
    });
    const hover = pinLayout(host, 600, 300);
    hover(56 + 520 / 3, 28 + 100);
    fixture.detectChanges();

    const radii = [...host.querySelectorAll('circle')].map((el) => el.getAttribute('r'));
    // One enlarged marker; the tooltip swatches are r=4 and excluded by value.
    expect(radii.filter((r) => r === '5.5').length).toBe(1);
    expect(radii.filter((r) => r === '3.5').length).toBe(3);
  });
});

describe('SvLineChartComponent — crosshair', () => {
  it('draws the crosshair only once the tooltip is up', async () => {
    const { host, fixture } = await setup({ categories: CATS, series: TWO });
    const dashed = () => host.querySelectorAll('line[stroke-dasharray="4 3"]').length;
    expect(dashed()).toBe(0);

    const hover = pinLayout(host, 600, 300);
    hover(56 + 100, 28 + 100);
    fixture.detectChanges();
    expect(dashed()).toBe(1);
  });

  it('draws no crosshair when the option is off, but still shows the tooltip', async () => {
    const { c, host, fixture } = await setup({
      categories: CATS,
      series: TWO,
      options: { showCrosshair: false },
    });
    const hover = pinLayout(host, 600, 300);
    hover(56 + 100, 28 + 100);
    fixture.detectChanges();

    expect(c.tooltip().visible).toBe(true);
    expect(host.querySelectorAll('line[stroke-dasharray="4 3"]').length).toBe(0);
    expect(host.textContent).toContain('Users');
  });

  it('draws a horizontal crosshair in the inversed layout', async () => {
    const { host, fixture } = await setup({
      categories: CATS,
      series: TWO,
      chartType: 'inversed',
    });
    const hover = pinLayout(host, 600, 300);
    hover(130 + 100, 24 + 100);
    fixture.detectChanges();

    const line = host.querySelector('line[stroke-dasharray="4 3"]')!;
    expect(line.getAttribute('x1')).toBe('0');
    expect(line.getAttribute('y1')).toBe(line.getAttribute('y2'));
  });
});

describe('SvLineChartComponent — accessibility', () => {
  it('names the chart after its title and shape when no label is given', async () => {
    const { c } = await setup({ categories: CATS, series: TWO, title: 'Traffic' });
    expect(c.chartDescription()).toBe('Traffic: 2 series (Users, Sessions) across 4 points.');
    expect(c.resolvedAriaLabel()).toBe(c.chartDescription());
  });

  it('names a single series in the singular', async () => {
    const { c } = await setup({ categories: CATS, series: [TWO[0]] });
    expect(c.chartDescription()).toBe('Line chart: series Users across 4 points.');
  });

  it('says "point" not "points" for a lone category', async () => {
    const { c } = await setup({ categories: ['Jan'], series: [{ label: 'S', data: [1] }] });
    expect(c.chartDescription()).toContain('across 1 point.');
  });

  it('counts unnamed series rather than listing empty names', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: '', data: [1, 2, 3, 4] }],
    });
    expect(c.chartDescription()).toBe('Line chart: 1 series across 4 points.');

    const { c: many } = await setup({
      categories: CATS,
      series: [
        { label: '', data: [1, 2, 3, 4] },
        { label: '', data: [1, 2, 3, 4] },
      ],
    });
    expect(many.chartDescription()).toBe('Line chart: 2 series across 4 points.');
  });

  it('falls back to the bare title when there is nothing plotted', async () => {
    const { c: noCats } = await setup({ categories: [], series: TWO, title: 'Traffic' });
    expect(noCats.chartDescription()).toBe('Traffic');

    const { c: noSeries } = await setup({ categories: CATS, series: [], title: '' });
    expect(noSeries.chartDescription()).toBe('Line chart');
  });

  it('prefers an explicit aria-label over the generated one', async () => {
    const { c, host } = await setup({
      categories: CATS,
      series: TWO,
      title: 'Traffic',
      ariaLabel: 'Weekly active users by channel',
    });
    expect(c.resolvedAriaLabel()).toBe('Weekly active users by channel');
    expect(host.querySelector('svg')!.getAttribute('aria-label')).toBe(
      'Weekly active users by channel',
    );
  });

  it('exposes the full data as a table, formatted the same way the axis is', async () => {
    const { c, host } = await setup({
      categories: ['Jan', 'Feb'],
      series: [{ label: 'Revenue', data: [2_500, 24_000] }],
    });
    const cells = [...host.querySelectorAll('table td')].map((td) => td.textContent?.trim());
    expect(cells).toEqual(['2.5k', '24k']);
    // A category past the end of a short series has no reading — and says so.
    // "0" here would assert a measurement nobody took (CH-07-I3).
    expect(c.cellValue(0, 9)).toBe('No reading');
    expect(c.cellValue(9, 0)).toBe('No reading');
  });

  it('omits the data table when there is nothing to put in it', async () => {
    const { host } = await setup({ categories: [], series: TWO });
    expect(host.querySelector('table')).toBeNull();
  });
});

describe('SvLineChartComponent — rendered chrome', () => {
  it('shows the subtitle only alongside a title', async () => {
    const { host: both } = await setup({
      categories: CATS,
      series: TWO,
      title: 'Traffic',
      subtitle: 'Source: analytics',
    });
    expect(both.textContent).toContain('Source: analytics');

    // The subtitle lives inside the title block, so it cannot appear alone.
    const { host: orphan } = await setup({
      categories: CATS,
      series: TWO,
      subtitle: 'Source: analytics',
    });
    expect(orphan.textContent).not.toContain('Source: analytics');
  });

  it('drops grid lines and axis labels when both are switched off', async () => {
    const { host: on } = await setup({ categories: CATS, series: TWO });
    const { host: off } = await setup({
      categories: CATS,
      series: TWO,
      options: { showGrid: false, showLabels: false },
    });
    expect(off.querySelectorAll('line').length).toBeLessThan(on.querySelectorAll('line').length);
    expect(off.querySelector('svg')!.textContent).not.toContain('Jan');
    expect(on.querySelector('svg')!.textContent).toContain('Jan');
  });

  it('renders both axis titles when supplied and neither when not', async () => {
    const { host: titled } = await setup({
      categories: CATS,
      series: TWO,
      options: { yAxisTitle: 'Visits', xAxisTitle: 'Month' },
    });
    expect(titled.textContent).toContain('Visits');
    expect(titled.textContent).toContain('Month');

    const { host: plain } = await setup({ categories: CATS, series: TWO });
    expect(plain.textContent).not.toContain('Visits');
  });

  it('draws a horizontal annotation across the plot and a vertical one down it', async () => {
    const { host } = await setup({
      categories: CATS,
      series: TWO,
      options: {
        annotations: [
          { type: 'horizontal', value: 25, label: 'Target' },
          { type: 'vertical', value: 2, label: 'Launch', color: '#ff0000' },
        ],
      },
    });
    const marks = [...host.querySelectorAll('line[stroke-dasharray="6 3"]')];
    expect(marks.length).toBe(2);
    // Horizontal: same y at both ends. Vertical: same x at both ends.
    expect(marks[0].getAttribute('y1')).toBe(marks[0].getAttribute('y2'));
    expect(marks[1].getAttribute('x1')).toBe(marks[1].getAttribute('x2'));
    // The default colour applies only where none was given.
    expect(marks[0].getAttribute('stroke')).toBe('var(--color-gray-500)');
    expect(marks[1].getAttribute('stroke')).toBe('#ff0000');
    expect(host.textContent).toContain('Target');
    expect(host.textContent).toContain('Launch');
  });

  it('emits one fill gradient per filled series and none for unfilled ones', async () => {
    const { host } = await setup({
      categories: CATS,
      series: [
        { label: 'A', data: [1, 2, 3, 4], fill: true },
        { label: 'B', data: [1, 2, 3, 4] },
      ],
    });
    expect(host.querySelectorAll('linearGradient').length).toBe(1);
    expect(host.querySelectorAll('path[fill^="url(#lc-fill-"]').length).toBe(1);
  });

  it('renders one clipped path per zone instead of a single series line', async () => {
    const { host } = await setup({
      categories: CATS,
      series: [
        {
          label: 'Rain',
          data: [10, 60, 80, 40],
          zones: [
            { end: 50, color: '#ef4444', label: 'Low' },
            { start: 50, color: '#10b981', label: 'High', dashArray: '4,2' },
          ],
        },
      ],
    });
    expect(host.querySelectorAll('clipPath').length).toBe(2);
    expect(host.querySelectorAll('path[clip-path^="url(#lc-zone-"]').length).toBe(2);
    // The zone legend REPLACES the series legend: the bands are named and the
    // series is not. (It survives in the screen-reader table, which is why this
    // is scoped to the legend rather than to the whole host.)
    const legend = host.querySelector('div.flex-wrap')!;
    expect(legend.textContent).toContain('Low');
    expect(legend.textContent).toContain('High');
    expect(legend.textContent).not.toContain('Rain');
  });

  it('shows the series legend, with a dashed swatch only where the series is dashed', async () => {
    const { host } = await setup({
      categories: CATS,
      series: [
        { label: 'Actual', data: [1, 2, 3, 4] },
        { label: 'Forecast', data: [1, 2, 3, 4], dashArray: '6,3' },
      ],
    });
    expect(host.textContent).toContain('Actual');
    expect(host.textContent).toContain('Forecast');
    // Only the dashed series gets an inline swatch <svg>; the solid one a <span>.
    expect(host.querySelectorAll('line[stroke-dasharray="6,3"]').length).toBe(1);
  });

  it('hides the legend when asked', async () => {
    const { host } = await setup({
      categories: CATS,
      series: TWO,
      options: { showLegend: false },
    });
    // The series names survive only in the screen-reader table.
    expect(host.querySelector('svg')!.textContent).not.toContain('Users');
    expect(host.querySelector('table')!.textContent).toContain('Users');
  });

  it('draws marker shapes as paths and circles as circles', async () => {
    const { host: diamond } = await setup({
      categories: CATS,
      series: [{ label: 'S', data: [1, 2, 3, 4], markerShape: 'diamond' }],
    });
    // 4 markers, no <circle> at all in the plot.
    expect(diamond.querySelectorAll('circle').length).toBe(0);

    const { host: circles } = await setup({
      categories: CATS,
      series: [{ label: 'S', data: [1, 2, 3, 4], markerShape: 'circle' }],
    });
    expect(circles.querySelectorAll('circle').length).toBe(4);
  });

  it('drops all markers when dots are off', async () => {
    const { host } = await setup({
      categories: CATS,
      series: TWO,
      options: { showDots: false },
    });
    expect(host.querySelectorAll('circle').length).toBe(0);
  });

  it('prints a value label at every point when data labels are on', async () => {
    const { host } = await setup({
      categories: CATS,
      series: [{ label: 'S', data: [1, 2, 3, 4] }],
      options: { showDataLabels: true, showLabels: false, showLegend: false },
    });
    const text = host.querySelector('svg')!.textContent ?? '';
    expect(text).toContain('1');
    expect(text).toContain('4');
  });

  it('publishes the animation duration as a CSS variable only when configured', async () => {
    const { c: withDur } = await setup({
      categories: CATS,
      series: TWO,
      options: { animationDuration: 900 },
    });
    expect(withDur.animDuration()).toBe('900ms');

    const { c: withoutDur } = await setup({ categories: CATS, series: TWO });
    expect(withoutDur.animDuration()).toBeNull();
  });

  it('drops the draw-on class when animation is disabled', async () => {
    const { host: animated } = await setup({ categories: CATS, series: TWO });
    expect(animated.querySelectorAll('path.lc-line').length).toBe(2);

    const { host: still } = await setup({
      categories: CATS,
      series: TWO,
      options: { animated: false },
    });
    expect(still.querySelectorAll('path.lc-line').length).toBe(0);
    expect(still.querySelectorAll('path.lc-fade').length).toBe(0);
  });

  it('fades a dashed series in rather than drawing it on', async () => {
    // A stroke-dasharray line cannot use the dashoffset draw-on animation —
    // the two dasharrays fight and the line flickers.
    const { host } = await setup({
      categories: CATS,
      series: [{ label: 'Forecast', data: [1, 2, 3, 4], dashArray: '6,3' }],
    });
    expect(host.querySelectorAll('path.lc-fade').length).toBe(1);
    expect(host.querySelectorAll('path.lc-line').length).toBe(0);
  });

  it('honours the height input in the viewBox and the plot geometry', async () => {
    const { c, host } = await setup({ categories: CATS, series: TWO, height: 500 });
    expect(host.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 600 500');
    expect(c.plotH()).toBe(500 - 28 - 52);
  });

  it('adds the custom class to the root without dropping its own', async () => {
    const { host } = await setup({ categories: CATS, series: TWO, customClass: 'my-chart' });
    const root = host.querySelector('.my-chart')!;
    expect(root.classList.contains('flex')).toBe(true);
  });
});
