import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvStripLineChartComponent,
  type StripBand,
  type StripSeries,
} from './strip-line-chart.component';

/**
 * The bands are the reason this chart exists, and they are where the arithmetic
 * gets interesting: `start` and `end` are optional at BOTH ends, and each
 * missing bound falls back to a different edge of the plot depending on the
 * orientation. A band that resolves the wrong way does not throw — it draws a
 * coloured rectangle over the wrong half of the chart, or a rectangle of
 * negative height, which the browser silently drops.
 *
 * The band bounds also feed the axis ceiling, so a band above the data has to
 * push the axis up or the band is clipped off the top of its own chart.
 */

async function setup(inputs: Partial<ComponentInput<SvStripLineChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvStripLineChartComponent, {
    inputs: inputs as ComponentInput<SvStripLineChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

/** Pin the SVG box to its viewBox so mouse coordinates map 1:1 (see line-chart). */
function pinLayout(host: HTMLElement, width: number, height: number) {
  const svg = host.querySelector('svg')!;
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }) as DOMRect;
  return (clientX: number, clientY = 100) =>
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true }));
}

const CATS = ['00h', '06h', '12h', '18h'];
const ONE: StripSeries[] = [{ label: 'p99', data: [120, 340, 620, 200] }];
const BANDS: StripBand[] = [
  { start: 0, end: 200, color: '#10b981', label: 'Good' },
  { start: 200, end: 500, color: '#f59e0b', label: 'Warning', labelPosition: 'center' },
  { start: 500, color: '#ef4444', label: 'Critical', labelPosition: 'start', opacity: 0.3 },
];

describe('SvStripLineChartComponent — axis', () => {
  it('raises the ceiling to cover a band that sits above the data', async () => {
    // A "Critical: 900+" band on a chart whose data peaks at 620 must still be
    // visible; ignoring band bounds would clip it off the top.
    const c = await setup({
      categories: CATS,
      series: ONE,
      strips: [{ start: 900, end: 1200, color: '#ef4444' }],
    }).then((r) => r.c);
    expect(c.rawMax()).toBe(1200);
    expect(c.axisMax()).toBeGreaterThanOrEqual(1200);
  });

  it('treats an open-ended band as reaching only as high as its start', async () => {
    const { c } = await setup({ categories: CATS, series: ONE, strips: [{ start: 800, color: '#f00' }] });
    expect(c.rawMax()).toBe(800);
  });

  it('ignores vertical bands when sizing the value axis', async () => {
    // A vertical band's `start`/`end` are CATEGORY INDICES, not values. On a
    // chart of small numbers, folding index 3 into the value axis triples the
    // ceiling and squashes the real line into the bottom third of the plot.
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'Error rate', data: [0.5, 0.8, 0.3, 0.6] }],
      strips: [{ orientation: 'vertical', start: 1, end: 3, color: '#f00' }],
    });
    expect(c.rawMax()).toBe(1);

    // The same bounds declared horizontally DO move the axis.
    const { c: horiz } = await setup({
      categories: CATS,
      series: [{ label: 'Error rate', data: [0.5, 0.8, 0.3, 0.6] }],
      strips: [{ start: 1, end: 3, color: '#f00' }],
    });
    expect(horiz.rawMax()).toBe(3);
  });

  it('floors the axis at zero for all-positive data and drops below for negatives', async () => {
    const { c: pos } = await setup({ categories: CATS, series: ONE });
    expect(pos.axisMin()).toBe(0);

    const { c: neg } = await setup({
      categories: CATS,
      series: [{ label: 'Delta', data: [-45, 10, 20, 30] }],
    });
    expect(neg.rawMin()).toBe(-45);
    expect(neg.axisMin()).toBe(-50);
  });

  it('keeps a usable axis for an all-zero series', async () => {
    const { c } = await setup({ categories: CATS, series: [{ label: 'Idle', data: [0, 0, 0, 0] }] });
    expect(c.axisMax()).toBe(1);
    expect(c.seriesPath(0)).not.toContain('NaN');
  });

  it('divides the grid evenly between the resolved bounds', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'p99', data: [0, 50, 100, 25] }],
      options: { gridDivisions: 4 },
    });
    expect(c.gridValues()).toEqual([0, 25, 50, 75, 100]);
  });
});

describe('SvStripLineChartComponent — horizontal bands', () => {
  it('spans the full plot width and lands between its two value bounds', async () => {
    const { c } = await setup({ categories: CATS, series: ONE, strips: BANDS });
    const [good] = c.bandRects();
    expect(good.x).toBe(0);
    expect(good.width).toBe(c.plotW());
    expect(good.y).toBe(c.yForValue(200));
    expect(good.height).toBeCloseTo(c.yForValue(0) - c.yForValue(200), 6);
  });

  it('extends an open-topped band to the axis ceiling', async () => {
    // `Critical` has no `end`, so its top edge is the top of the plot (y = 0).
    const { c } = await setup({ categories: CATS, series: ONE, strips: BANDS });
    const critical = c.bandRects()[2];
    expect(critical.y).toBe(c.yForValue(c.axisMax()));
    expect(critical.y).toBe(0);
  });

  it('never gives a band zero or negative height', async () => {
    // start === end is a degenerate band; <rect height="0"> is invisible and
    // a negative height is invalid SVG that drops the element entirely.
    const { c } = await setup({
      categories: CATS,
      series: ONE,
      strips: [{ start: 300, end: 300, color: '#f00' }],
    });
    expect(c.bandRects()[0].height).toBe(1);
  });

  it('places the label at the top, middle or bottom as asked', async () => {
    const { c } = await setup({ categories: CATS, series: ONE, strips: BANDS });
    const [good, warning, critical] = c.bandRects();
    // Default 'end' → just above the band's bottom edge.
    expect(good.labelY).toBeCloseTo(good.y + good.height - 4, 6);
    expect(warning.labelY).toBeCloseTo(warning.y + warning.height / 2 + 4, 6);
    expect(critical.labelY).toBeCloseTo(critical.y + 12, 6);
    // Horizontal band labels are right-aligned at the plot edge.
    expect(good.labelX).toBe(c.plotW() - 4);
  });

  it('uses the given opacity and falls back to a subtle default', async () => {
    const { c } = await setup({ categories: CATS, series: ONE, strips: BANDS });
    expect(c.bandRects()[0].opacity).toBe(0.15);
    expect(c.bandRects()[2].opacity).toBe(0.3);
  });
});

describe('SvStripLineChartComponent — vertical bands', () => {
  const VERT: StripBand[] = [
    { orientation: 'vertical', start: 1, end: 2, color: '#6366f1', label: 'Peak' },
    { orientation: 'vertical', start: 2, color: '#f59e0b', label: 'After', labelPosition: 'center' },
  ];

  it('maps category indices onto the x axis and fills the plot height', async () => {
    const { c } = await setup({ categories: CATS, series: ONE, strips: VERT });
    const [peak] = c.bandRects();
    expect(peak.x).toBe(c.xForIndex(1));
    expect(peak.width).toBeCloseTo(c.xForIndex(2) - c.xForIndex(1), 6);
    expect(peak.y).toBe(0);
    expect(peak.height).toBe(c.plotH());
  });

  it('runs an open-ended vertical band out to the last category', async () => {
    const { c } = await setup({ categories: CATS, series: ONE, strips: VERT });
    const after = c.bandRects()[1];
    expect(after.x + after.width).toBeCloseTo(c.plotW(), 6);
  });

  it('fills the whole width when there is only one category to index', async () => {
    // `start / (n - 1)` is a division by zero with a single category, and the
    // band's x and width both come out NaN.
    const { c } = await setup({
      categories: ['Only'],
      series: [{ label: 'p99', data: [120] }],
      strips: [{ orientation: 'vertical', start: 0, end: 0, color: '#f00' }],
    });
    const band = c.bandRects()[0];
    expect(band.x).toBe(0);
    expect(band.width).toBe(c.plotW());
    expect(Number.isNaN(band.x + band.width)).toBe(false);
  });

  it('positions the vertical band label by the requested edge', async () => {
    const { c } = await setup({ categories: CATS, series: ONE, strips: VERT });
    const [peak, after] = c.bandRects();
    expect(peak.labelX).toBeCloseTo(peak.x + peak.width - 4, 6); // default 'end'
    expect(after.labelX).toBeCloseTo(after.x + after.width / 2, 6);
    expect(peak.labelY).toBe(14);
  });

  it('anchors vertical band text in the middle and horizontal band text at the end', async () => {
    const { host } = await setup({
      categories: CATS,
      series: ONE,
      strips: [BANDS[0], VERT[0]],
    });
    const anchors = [...host.querySelectorAll('svg text')]
      .filter((t) => ['Good', 'Peak'].includes(t.textContent?.trim() ?? ''))
      .map((t) => t.getAttribute('text-anchor'));
    expect(anchors).toEqual(['end', 'middle']);
  });

  it('hides band labels when asked, keeping the bands themselves', async () => {
    const { host } = await setup({
      categories: CATS,
      series: ONE,
      strips: BANDS,
      options: { showBandLabels: false },
    });
    expect(host.querySelectorAll('rect').length).toBeGreaterThanOrEqual(3);
    expect(host.querySelector('svg')!.textContent).not.toContain('Warning');
  });
});

describe('SvStripLineChartComponent — series paths', () => {
  it('joins points with straight segments by default', async () => {
    const { c } = await setup({ categories: CATS, series: ONE });
    const d = c.seriesPath(0);
    expect(d).toContain(' L ');
    expect(d).not.toContain(' C ');
    expect(d).not.toContain('NaN');
  });

  it('curves a smooth series through cubic segments', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'p99', data: [120, 340, 620, 200], smooth: true }],
    });
    expect(c.seriesPath(0)).toContain(' C ');
  });

  it('draws nothing for a single point, which has no segment to draw', async () => {
    const { c } = await setup({ categories: ['00h'], series: [{ label: 'p99', data: [120] }] });
    expect(c.seriesPath(0)).toBe('');
    expect(c.fillPath(0)).toBe('');
  });

  it('closes a fill down to the baseline at both ends', async () => {
    const { c } = await setup({
      categories: CATS,
      series: [{ label: 'p99', data: [120, 340, 620, 200], fill: true }],
    });
    const d = c.fillPath(0);
    expect(d.endsWith(' Z')).toBe(true);
    expect(d).toContain(`L ${c.xForIndex(3).toFixed(1)} ${c.plotH()}`);
    expect(d).toContain(`L ${c.xForIndex(0).toFixed(1)} ${c.plotH()}`);
  });

  it('gives each instance its own fill gradient id', async () => {
    // `url(#…)` is document-global — two of this chart on one page would
    // otherwise share the first one's colours.
    const { c: a } = await setup({ categories: CATS, series: ONE });
    // Both instances must share one application: ids are per application (svUniqueId).
    const second = TestBed.createComponent(SvStripLineChartComponent);
    second.componentRef.setInput('categories', CATS);
    second.componentRef.setInput('series', ONE);
    second.detectChanges();
    await second.whenStable();
    const b = second.componentInstance;
    expect(a.fillGradId(0)).not.toBe(b.fillGradId(0));
  });

  it('places dots on the same coordinates the line passes through', async () => {
    const { c } = await setup({ categories: CATS, series: ONE });
    const dots = c.dots()[0];
    expect(dots.length).toBe(4);
    expect(dots[2]).toEqual({ x: c.xForIndex(2), y: c.yForValue(620), value: 620 });
  });

  it('wraps the palette past its end and honours an explicit colour', async () => {
    const many: StripSeries[] = Array.from({ length: 9 }, (_, i) => ({
      label: `S${i}`,
      data: [i, i, i, i],
    }));
    const { c } = await setup({ categories: CATS, series: many });
    expect(c.seriesColors()[8]).toBe(c.seriesColors()[0]);

    const { c: fixed } = await setup({
      categories: CATS,
      series: [{ label: 'p99', data: [1, 2, 3, 4], color: '#abcdef' }],
    });
    expect(fixed.seriesColors()[0]).toBe('#abcdef');
  });
});

describe('SvStripLineChartComponent — hover', () => {
  it('snaps to the nearest category and lists every series value', async () => {
    const { c, host } = await setup({
      categories: CATS,
      series: [ONE[0], { label: 'p50', data: [40, 60, 80, 50] }],
    });
    // PAD.left = 54; plotW = 600 - 54 - 24 = 522.
    const hover = pinLayout(host, 600, 300);
    hover(54 + 522 / 3);

    const t = c.tooltip();
    expect(t.visible).toBe(true);
    expect(t.label).toBe('06h');
    expect(t.items.map((i) => i.value)).toEqual([340, 60]);
    expect(t.crossX).toBe(c.xForIndex(1));
  });

  it('clamps the tooltip at the last category rather than overhanging the chart', async () => {
    const { c, host } = await setup({ categories: CATS, series: ONE });
    const hover = pinLayout(host, 600, 300);
    hover(54 + 522);
    expect(c.tooltip().label).toBe('18h');
    expect(c.tooltip().x).toBe(600 - 155 - 4);
  });

  it('leaves the tooltip unclamped when it fits', async () => {
    const { c, host } = await setup({ categories: CATS, series: ONE });
    const hover = pinLayout(host, 600, 300);
    hover(54);
    expect(c.tooltip().x).toBe(c.xForIndex(0) + 54 + 8);
  });

  it('hides the tooltip outside the plot on either side, and on leave', async () => {
    const { c, host } = await setup({ categories: CATS, series: ONE });
    const hover = pinLayout(host, 600, 300);

    hover(54 + 100);
    expect(c.tooltip().visible).toBe(true);
    hover(10);
    expect(c.tooltip().visible).toBe(false);

    hover(54 + 100);
    hover(595);
    expect(c.tooltip().visible).toBe(false);

    hover(54 + 100);
    host.querySelector('svg')!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(c.tooltip().visible).toBe(false);
  });

  it('reads a category past the end of a shorter series as a gap, not as zero', async () => {
    const { c, host } = await setup({
      categories: CATS,
      series: [{ label: 'partial', data: [10, 20] }],
    });
    const hover = pinLayout(host, 600, 300);
    hover(54 + 522);
    expect(c.tooltip().items[0].value).toBeNull();
    expect(c.formatReading(c.tooltip().items[0].value)).toBe('No reading');
  });
});

describe('SvStripLineChartComponent — chrome', () => {
  it('describes itself by title, series and category count', async () => {
    const { c } = await setup({ categories: CATS, series: ONE, title: 'Latency' });
    expect(c.resolvedAriaLabel()).toBe('Latency: 1 series (p99) across 4 categories.');
  });

  it('says "category" in the singular', async () => {
    const { c } = await setup({ categories: ['00'], series: [{ label: 'p99', data: [1] }] });
    expect(c.resolvedAriaLabel()).toContain('across 1 category.');
  });

  it('falls back to the plain title with nothing plotted, and prefers an override', async () => {
    const { c: bare } = await setup({ categories: [], series: ONE });
    expect(bare.resolvedAriaLabel()).toBe('Strip line chart');

    const { c: noSeries } = await setup({ categories: CATS, series: [], title: 'Latency' });
    expect(noSeries.resolvedAriaLabel()).toBe('Latency');

    const { c: override } = await setup({
      categories: CATS,
      series: ONE,
      title: 'Latency',
      ariaLabel: 'p99 latency by hour',
    });
    expect(override.resolvedAriaLabel()).toBe('p99 latency by hour');
  });

  it('names unnamed series by count only', async () => {
    const { c } = await setup({ categories: CATS, series: [{ label: '', data: [1, 2, 3, 4] }] });
    expect(c.resolvedAriaLabel()).toBe('Strip line chart: 1 series across 4 categories.');
  });

  it('renders the subtitle only under a title', async () => {
    const { host: both } = await setup({
      categories: CATS,
      series: ONE,
      title: 'Latency',
      subtitle: 'ms',
    });
    expect(both.textContent).toContain('ms');

    const { host: orphan } = await setup({ categories: CATS, series: ONE, subtitle: 'ms' });
    expect(orphan.textContent).not.toContain('ms');
  });

  it('drops grid lines and labels when both are off', async () => {
    const { host: on } = await setup({ categories: CATS, series: ONE });
    const { host: off } = await setup({
      categories: CATS,
      series: ONE,
      options: { showGrid: false, showLabels: false },
    });
    expect(off.querySelectorAll('line').length).toBeLessThan(on.querySelectorAll('line').length);
    expect(off.querySelector('svg')!.textContent).not.toContain('00h');
  });

  it('hides the dots when asked', async () => {
    const { host: on } = await setup({ categories: CATS, series: ONE });
    expect(on.querySelectorAll('circle').length).toBeGreaterThan(0);

    const { host: off } = await setup({
      categories: CATS,
      series: ONE,
      options: { showDots: false },
    });
    expect(off.querySelectorAll('circle').length).toBe(0);
  });

  it('lists the series and the labelled bands in the legend, skipping unlabelled bands', async () => {
    const { host } = await setup({
      categories: CATS,
      series: ONE,
      strips: [...BANDS, { start: 700, color: '#000' }],
    });
    const legend = host.querySelectorAll('div.flex-wrap');
    const text = [...legend].map((d) => d.textContent).join(' ');
    expect(text).toContain('p99');
    expect(text).toContain('Critical');
    // Four bands were supplied but only three carry a label.
    expect([...host.querySelectorAll('span[style*="opacity"]')].length).toBe(3);
  });

  it('hides the legend when asked', async () => {
    const { host } = await setup({
      categories: CATS,
      series: ONE,
      strips: BANDS,
      options: { showLegend: false },
    });
    expect(host.querySelectorAll('div.flex-wrap').length).toBe(0);
  });

  it('drops the draw-on animation classes when animation is off', async () => {
    const { host: on } = await setup({ categories: CATS, series: ONE, strips: BANDS });
    expect(on.querySelectorAll('.sl-line-anim').length).toBe(1);
    expect(on.querySelectorAll('.sl-band-anim').length).toBe(3);

    const { host: off } = await setup({
      categories: CATS,
      series: ONE,
      strips: BANDS,
      options: { animated: false },
    });
    expect(off.querySelectorAll('.sl-line-anim').length).toBe(0);
    expect(off.querySelectorAll('.sl-band-anim').length).toBe(0);
  });

  it('honours a custom height in the plot geometry', async () => {
    const { c } = await setup({ categories: CATS, series: ONE, options: { height: 500 } });
    expect(c.chartHeight()).toBe(500);
    expect(c.plotH()).toBe(500 - 24 - 48);
  });

  it('formats values compactly, rounding plain numbers', async () => {
    const { c } = await setup({ categories: CATS, series: ONE });
    expect(c.formatValue(342.7)).toBe('343');
    expect(c.formatValue(2_500)).toBe('2.5k');
    expect(c.formatValue(3_400_000)).toBe('3.4M');
    expect(c.formatValue(-2_500)).toBe('-2.5k');
  });

  it('emits no NaN with bands, fills and a single category all at once', async () => {
    const { host } = await setup({
      categories: ['Only'],
      series: [{ label: 'p99', data: [120], fill: true }],
      strips: [...BANDS, { orientation: 'vertical', start: 0, color: '#000', label: 'Now' }],
    });
    expect(host.innerHTML).not.toContain('NaN');
  });
});
