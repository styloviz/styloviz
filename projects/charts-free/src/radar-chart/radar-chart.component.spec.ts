import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvRadarChartComponent,
  type RadarAxis,
  type RadarPointEvent,
  type RadarSeries,
} from './radar-chart.component';

/**
 * A radar chart is polar arithmetic on top of two arrays that are only ever
 * aligned by convention: `series[n].values[i]` is assumed to belong to
 * `axes[i]`. Nothing enforces that, so the interesting cases are all the ways
 * the two can disagree — a shorter values array, an axis with its own maximum,
 * a value above that maximum, no axes at all — plus the divisor in `angle()`,
 * which is `axes().length` and therefore zero for an axis-less chart.
 *
 * Geometry here is derived entirely from `size()`, never from a measured box,
 * so every coordinate below is exactly reproducible under jsdom.
 */

async function setup(inputs: Partial<ComponentInput<SvRadarChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvRadarChartComponent, {
    inputs: inputs as ComponentInput<SvRadarChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const AXES: RadarAxis[] = [
  { label: 'Speed' },
  { label: 'Reliability' },
  { label: 'Comfort' },
  { label: 'Safety' },
];

const SERIES: RadarSeries[] = [
  { name: 'Model A', color: '#3b82f6', values: [100, 50, 0, 75] },
  { name: 'Model B', color: '#f59e0b', values: [25, 25, 25, 25] },
];

describe('SvRadarChartComponent — the web', () => {
  it('starts the first spoke straight up and spaces the rest evenly', async () => {
    const { c } = await setup({ axes: AXES, series: SERIES, size: 200 });
    // Four axes: −90°, 0°, 90°, 180°.
    expect(c.angle(0)).toBeCloseTo(-Math.PI / 2, 9);
    expect(c.angle(1)).toBeCloseTo(0, 9);
    expect(c.angle(2)).toBeCloseTo(Math.PI / 2, 9);
    expect(c.angle(3)).toBeCloseTo(Math.PI, 9);

    const top = c.axisPoint(0);
    expect(top.x).toBeCloseTo(100, 9);
    expect(top.y).toBeCloseTo(100 - 200 * 0.38, 9);
  });

  it('nests one polygon per level, the outermost on the spoke ends', async () => {
    const { c, host } = await setup({ axes: AXES, series: SERIES, size: 200, levels: 3 });
    const polys = c.webPolygons();
    expect(polys.length).toBe(3);
    // Level 3 of 3 is the full radius; level 1 is a third of it.
    expect(polys[2]).toBe(
      c.axisLines().map((l) => `${l.x},${l.y}`).join(' '),
    );
    const inner = polys[0].split(' ')[0].split(',').map(Number);
    expect(inner[1]).toBeCloseTo(100 - (200 * 0.38) / 3, 9);
    // Web polygons + the series polygons are all that <polygon> is used for.
    expect(host.querySelectorAll('polygon').length).toBe(3 + SERIES.length);
  });

  it('draws no web and no NaN when there is no axis to draw one on', async () => {
    // `angle()` divides by `axes().length`. With a series present the chart is
    // NOT the empty state, so this really renders.
    const { c, host } = await setup({ axes: [], series: SERIES });
    expect(c.chartIsEmpty()).toBe(false);
    expect(c.total()).toBe(0);
    expect(c.webPolygons()).toEqual(['', '', '', '', '']);
    expect(c.axisLines()).toEqual([]);
    expect(c.seriesPolygon(SERIES[0])).toBe('');
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('renders the empty state, not a bare web, when there is no series', async () => {
    const { c, host } = await setup({ axes: AXES, series: [], emptyMessage: 'No models' });
    expect(c.chartIsEmpty()).toBe(true);
    expect(host.querySelectorAll('polygon').length).toBe(0);
    expect(host.textContent).toContain('No models');
  });
});

describe('SvRadarChartComponent — value normalisation', () => {
  it('scales each value against the global maximum', async () => {
    const { c } = await setup({ axes: AXES, series: SERIES, size: 200, maxValue: 100 });
    const dots = c.seriesDots(SERIES[0]);
    // 100/100 lands on the rim; 0/100 lands on the centre.
    expect(dots[0].y).toBeCloseTo(100 - 76, 9);
    expect(dots[2].x).toBeCloseTo(100, 9);
    expect(dots[2].y).toBeCloseTo(100, 9);
  });

  it('lets an axis override the global maximum, but only with a positive one', async () => {
    const { c } = await setup({
      axes: [{ label: 'A', max: 50 }, { label: 'B', max: 0 }, { label: 'C' }],
      series: [{ name: 'S', color: '#f00', values: [50, 100, 100] }],
      maxValue: 100,
    });
    expect(c.axisMax(0)).toBe(50); // per-axis override
    expect(c.axisMax(1)).toBe(100); // max: 0 would be a division by zero
    expect(c.axisMax(2)).toBe(100); // no override at all
    // 50 against an axis maximum of 50 is a full-radius vertex.
    expect(c.seriesDots({ name: 'S', color: '#f00', values: [50, 100, 100] })[0].y)
      .toBeCloseTo(c.cy() - c.r(), 9);
  });

  it('clamps a value outside the axis range instead of drawing past the rim', async () => {
    const { c } = await setup({
      axes: AXES,
      series: [{ name: 'S', color: '#f00', values: [400, -400, 50, 50] }],
      size: 200,
      maxValue: 100,
    });
    const dots = c.seriesDots({ name: 'S', color: '#f00', values: [400, -400, 50, 50] });
    // Over-max pins to the rim (spoke 0 points straight up), negative pins to
    // the centre (spoke 1 points right, so an unclamped −4× would be at x = −204).
    expect(dots[0].y).toBeCloseTo(100 - 76, 9);
    expect(dots[1].x).toBeCloseTo(100, 9);
    expect(dots[1].y).toBeCloseTo(100, 9);
    // And spoke 2 at half the maximum is exactly half the radius down.
    expect(dots[2].y).toBeCloseTo(100 + 38, 9);
  });

  it('treats a missing value as zero rather than NaN', async () => {
    // A series shorter than the axis list is the normal shape of a partial feed.
    const short: RadarSeries = { name: 'Short', color: '#f00', values: [80] };
    const { c, host } = await setup({ axes: AXES, series: [short], size: 200 });
    const dots = c.seriesDots(short);
    expect(dots.length).toBe(4);
    expect(dots.slice(1).every((d) => d.value === 0)).toBe(true);
    expect(dots[1].x).toBeCloseTo(100, 9);
    expect(c.seriesPolygon(short)).not.toContain('NaN');
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('names the axis on each vertex, and empty when there is none', async () => {
    const short: RadarSeries = { name: 'S', color: '#f00', values: [1, 2] };
    const { c } = await setup({ axes: [{ label: 'Only' }], series: [short] });
    expect(c.seriesDots(short).map((d) => d.axis)).toEqual(['Only']);
  });
});

describe('SvRadarChartComponent — labels', () => {
  it('pushes the axis labels outside the rim', async () => {
    const { c } = await setup({ axes: AXES, series: SERIES, size: 200 });
    const pts = c.labelPoints();
    expect(pts.map((p) => p.label)).toEqual(['Speed', 'Reliability', 'Comfort', 'Safety']);
    expect(pts[0].y).toBeCloseTo(100 - 76 * 1.18, 9);
  });

  it('anchors a label by which side of the centre it lands on', async () => {
    const { c } = await setup({ axes: AXES, series: SERIES, size: 200 });
    // The dead zone is ±5 on BOTH sides: a label a few pixels off centre must
    // stay centred, or the top and bottom spokes' labels jump sideways.
    expect(c.textAnchor(100)).toBe('middle'); // dead centre
    expect(c.textAnchor(104)).toBe('middle'); // 4px right — still centred
    expect(c.textAnchor(96)).toBe('middle'); // 4px left — still centred
    expect(c.textAnchor(106)).toBe('start'); // 6px right — anchored
    expect(c.textAnchor(94)).toBe('end'); // 6px left — anchored
    expect(c.textAnchor(160)).toBe('start'); // well right of centre
    expect(c.textAnchor(40)).toBe('end'); // well left of centre
  });

  it('summarises the axes and the series it is showing', async () => {
    const { c } = await setup({ axes: AXES, series: SERIES, title: 'Fleet' });
    expect(c.resolvedAriaLabel()).toBe(
      'Fleet. Axes: Speed, Reliability, Comfort, Safety. Series: Model A, Model B.',
    );
    const { c: untitled } = await setup({ axes: [], series: [] });
    expect(untitled.resolvedAriaLabel()).toBe('Radar chart. Axes: . Series: .');
  });

  it('prefers an explicit aria-label', async () => {
    const { c } = await setup({ axes: AXES, series: SERIES, ariaLabel: 'Comparison' });
    expect(c.resolvedAriaLabel()).toBe('Comparison');
  });

  it('names each vertex by series, axis and value', async () => {
    const { c } = await setup({ axes: AXES, series: SERIES });
    expect(c.pointAriaLabel(SERIES[0], 'Speed', 100)).toBe('Model A, Speed: 100');
  });
});

describe('SvRadarChartComponent — presentation and interaction', () => {
  it('fills the area by default and strokes a closed outline when told not to', async () => {
    const { host: filled } = await setup({ axes: AXES, series: SERIES });
    expect(filled.querySelectorAll('polyline').length).toBe(0);

    const { host: outline } = await setup({ axes: AXES, series: SERIES, filled: false });
    const lines = outline.querySelectorAll('polyline');
    expect(lines.length).toBe(2);
    // The outline has to be closed by hand: the first vertex repeated at the end.
    const pts = lines[0].getAttribute('points')!.split(' ');
    expect(pts.at(-1)).toBe(pts[0]);
  });

  it('drops the vertex markers without dropping the shape', async () => {
    const { host: withDots } = await setup({ axes: AXES, series: SERIES });
    expect(withDots.querySelectorAll('circle').length).toBe(8);

    const { host: bare } = await setup({ axes: AXES, series: SERIES, showDots: false });
    expect(bare.querySelectorAll('circle').length).toBe(0);
    expect(bare.querySelectorAll('polygon').length).toBe(5 + 2);
  });

  it('reports the hovered vertex and highlights only that one', async () => {
    const { c, host, fixture } = await setup({ axes: AXES, series: SERIES });
    const seen: RadarPointEvent[] = [];
    c.pointHover.subscribe((e) => seen.push(e));

    const dots = host.querySelectorAll('circle');
    dots[1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    fixture.detectChanges();

    expect(seen).toEqual([
      { series: 'Model A', axis: 'Reliability', value: 50, color: '#3b82f6' },
    ]);
    expect(c.isActive(SERIES[0], 'Reliability')).toBe(true);
    // Same axis on the other series must NOT light up.
    expect(c.isActive(SERIES[1], 'Reliability')).toBe(false);
    expect(c.isActive(SERIES[0], 'Speed')).toBe(false);
    expect(dots[1].getAttribute('r')).toBe('6');
    expect(dots[0].getAttribute('r')).toBe('4');
  });

  it('has no active vertex before anything is hovered', async () => {
    const { c } = await setup({ axes: AXES, series: SERIES });
    expect(c.hoveredPoint()).toBeNull();
    expect(c.isActive(SERIES[0], 'Speed')).toBe(false);
  });

  it('clears the highlight on leave', async () => {
    const { c, host } = await setup({ axes: AXES, series: SERIES });
    const dot = host.querySelector('circle')!;
    dot.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(c.hoveredPoint()).not.toBeNull();
    dot.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(c.hoveredPoint()).toBeNull();
  });

  it('emits a selection on click and on Space, without scrolling the page', async () => {    const { c, host } = await setup({ axes: AXES, series: SERIES });
    const picked: RadarPointEvent[] = [];
    c.pointSelect.subscribe((e) => picked.push(e));

    const dot = host.querySelectorAll('circle')[0];
    dot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    dot.dispatchEvent(space);

    expect(picked.length).toBe(2);
    expect(picked[0]).toEqual({
      series: 'Model A', axis: 'Speed', value: 100, color: '#3b82f6',
    });
    expect(space.defaultPrevented).toBe(true);
  });
});

/**
 * ============================================================================
 *  The comparison table (audit item CH-13-M5)
 * ============================================================================
 *
 * A vertex's value is its distance from the centre. The dots carry a label
 * each, but they are optional — `showDots(false)` is a supported look — and
 * even present, comparing two shapes across six spokes costs twelve tab stops
 * to pair up six numbers, which is the comparison the shape exists to make
 * instant. `resolvedAriaLabel` names the axes and the series and no value.
 */
describe('SvRadarChartComponent — the comparison table', () => {
  const summary = (host: HTMLElement) => host.querySelector('.sv-summary');

  /** The table as a grid of trimmed cell text, header row first. */
  const grid = (host: HTMLElement) =>
    [...(summary(host)?.querySelectorAll('tr') ?? [])].map((tr) =>
      [...tr.children].map((cell) => cell.textContent?.trim() ?? ''),
    );

  const caption = (host: HTMLElement) =>
    summary(host)?.querySelector('caption')?.textContent?.trim() ?? null;

  it('gives one row per axis and one column per series', async () => {
    const { host } = await setup({ axes: AXES, series: SERIES, title: 'Fleet' });
    expect(grid(host)).toEqual([
      ['Axis', 'Model A', 'Model B'],
      ['Speed', '100', '25'],
      ['Reliability', '50', '25'],
      ['Comfort', '0', '25'],
      ['Safety', '75', '25'],
    ]);
    expect(caption(host)).toBe('Fleet');
  });

  it('names the table even when the chart has no visible title', async () => {
    const { host } = await setup({ axes: AXES, series: SERIES });
    expect(caption(host)).toBe('Radar chart');
  });

  /**
   * ★ Row headers, not plain cells: the axis label is what identifies the row,
   *   and without `scope="row"` a reader moving across "100, 25" is not told
   *   which spoke they are on.
   */
  it('marks the axis as the row header', async () => {
    const { host } = await setup({ axes: AXES, series: SERIES });
    const first = summary(host)!.querySelectorAll('tbody tr')[0];
    expect(first.children[0].tagName).toBe('TH');
    expect(first.children[0].getAttribute('scope')).toBe('row');
  });

  /**
   * ★★★ EQUAL DISTANCE FROM THE CENTRE IS NOT AN EQUAL VALUE.
   *
   *     `RadarAxis.max` normalises per spoke, so 40 out of 50 is drawn on the
   *     rim while 40 out of 100 sits at mid-radius. Told the bare numbers a
   *     reader would conclude the two vertices coincide — the opposite of what
   *     is on screen. So the divisor becomes a column whenever it varies.
   */
  it('reports each axis maximum when the spokes disagree about it', async () => {
    const { host } = await setup({
      axes: [{ label: 'A', max: 50 }, { label: 'B' }],
      series: [{ name: 'S', color: '#f00', values: [40, 40] }],
      maxValue: 100,
    });
    expect(grid(host)).toEqual([
      ['Axis', 'S', 'Axis maximum'],
      ['A', '40', '50'],
      ['B', '40', '100'],
    ]);
  });

  /**
   * ★ Compared on the RESOLVED maximum, not on whether `max` was written down.
   *   `{ max: 100 }` alongside a global 100 normalises identically, and a column
   *   repeating "100" on every row is noise. `max: 0` falls back too.
   */
  it('leaves the column out when every spoke resolves to the same maximum', async () => {
    const { host } = await setup({
      axes: [{ label: 'A', max: 100 }, { label: 'B' }, { label: 'C', max: 0 }],
      series: [{ name: 'S', color: '#f00', values: [10, 20, 30] }],
      maxValue: 100,
    });
    expect(grid(host)).toEqual([
      ['Axis', 'S'],
      ['A', '10'],
      ['B', '20'],
      ['C', '30'],
    ]);
  });

  /**
   * ★ A short values array puts the vertex at the centre — the sibling spec
   *   above measures exactly that — so the table says 0. An em dash would claim
   *   the chart is showing nothing where it is showing zero.
   */
  it('reports a missing value as the zero it is drawn as', async () => {
    const { host } = await setup({
      axes: AXES,
      series: [{ name: 'Short', color: '#f00', values: [80] }],
    });
    expect(grid(host)).toEqual([
      ['Axis', 'Short'],
      ['Speed', '80'],
      ['Reliability', '0'],
      ['Comfort', '0'],
      ['Safety', '0'],
    ]);
  });

  /**
   * ★★ The number must agree with the vertex's own `aria-label`, which is raw
   *    and unabbreviated. A table that said "1.2k" where the dot says "1200"
   *    reads as two different figures for one point.
   */
  it('states values exactly as the vertices announce them', async () => {
    const big: RadarSeries = { name: 'S', color: '#f00', values: [1200, 400] };
    const { host, c } = await setup({
      axes: [{ label: 'A' }, { label: 'B' }],
      series: [big],
      maxValue: 2000,
    });
    expect(grid(host)[1]).toEqual(['A', '1200']);
    expect(c.pointAriaLabel(big, 'A', 1200)).toBe('S, A: 1200');
  });

  /**
   * ★ A value past the maximum is CLAMPED to the rim in the drawing, and the
   *   table still says 400 — as does the vertex. Rounding the data down to the
   *   axis would hide the overflow from the only reader who cannot see that the
   *   shape has flattened against the outer ring.
   */
  it('states an out-of-range value rather than the rim it was clamped to', async () => {
    const { host } = await setup({
      axes: [{ label: 'A' }],
      series: [{ name: 'S', color: '#f00', values: [400] }],
      maxValue: 100,
    });
    expect(grid(host)[1]).toEqual(['A', '400']);
  });

  it('publishes no table when there is no axis to put in one', async () => {
    // A series with no axes draws a legend and nothing else — see the web spec.
    const { host } = await setup({ axes: [], series: SERIES });
    expect(summary(host)).toBeNull();
  });

  it('publishes no table in place of the empty state', async () => {
    const { host } = await setup({ axes: AXES, series: [] });
    expect(summary(host)).toBeNull();
  });

  it('follows the data when a series is swapped in', async () => {
    const { host, fixture } = await setup({ axes: AXES, series: SERIES });
    fixture.componentRef.setInput('series', [
      { name: 'Model C', color: '#0f0', values: [1, 2, 3, 4] },
    ]);
    fixture.detectChanges();
    expect(grid(host)).toEqual([
      ['Axis', 'Model C'],
      ['Speed', '1'],
      ['Reliability', '2'],
      ['Comfort', '3'],
      ['Safety', '4'],
    ]);
  });
});

/**
 * Two ways a radar misleads, neither visible in the drawing.
 *
 * ★★★ MIXED MAXIMA: `RadarAxis.max` normalises per spoke, so equal distance
 *     from the centre is NOT an equal value — 80 out of 200 is drawn INSIDE 60
 *     out of 100, the opposite of what the bare numbers say. The summary table
 *     has carried the per-axis maximum for a while, but a table is the
 *     alternative for someone who cannot see the web; the person being misled
 *     is looking straight at it.
 *
 * ★★★ AXIS ORDER: the polygon's shape and its area are artefacts of the order
 *     the axes were written in. Swap two spokes and the same numbers draw a
 *     different figure. Area reads as a magnitude and is not one.
 */
describe('SvRadarChartComponent — what the polygon cannot be read for', () => {
  const notice = (host: HTMLElement): string | null =>
    host.querySelector('[data-sv-notice]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;

  const FOUR: RadarAxis[] = [
    { label: 'Speed' }, { label: 'Power' }, { label: 'Range' }, { label: 'Cost' },
  ];
  const ONE_SERIES: RadarSeries[] = [
    { name: 'A', values: [80, 60, 40, 20], color: '#3b82f6' },
  ];

  it('says the shape and the area depend on the axis order', async () => {
    const { host } = await setup({ axes: FOUR, series: ONE_SERIES });
    const text = notice(host)!;
    expect(text).toContain('depend on the order of the axes');
    expect(text).toContain('the area is not a quantity');
    expect(text).toContain('Compare vertices along a spoke');
  });

  it('demonstrates what it warns about — the same numbers, a different figure', async () => {
    // ★ Reordering the spokes changes which values sit next to each other, and
    //   therefore the outline and the enclosed area, with nothing changed in
    //   the data.
    const a = await setup({ axes: FOUR, series: ONE_SERIES, size: 200 });
    const b = await setup({
      axes: [FOUR[0], FOUR[2], FOUR[1], FOUR[3]],
      series: [{ name: 'A', values: [80, 40, 60, 20], color: '#3b82f6' }],
      size: 200,
    });
    expect(b.c.seriesPolygon(b.c.series()[0])).not.toBe(a.c.seriesPolygon(a.c.series()[0]));
  });

  it('stays quiet about ordering on two spokes, which have none to change', async () => {
    const { host } = await setup({
      axes: [{ label: 'Speed' }, { label: 'Power' }],
      series: [{ name: 'A', values: [80, 60], color: '#3b82f6' }],
    });
    // With two spokes on one scale neither clause applies, so there is no note
    // at all rather than an empty one.
    expect(notice(host)).toBeNull();
  });

  it('names the maxima when the spokes disagree about them', async () => {
    const { host } = await setup({
      axes: [{ label: 'Speed', max: 200 }, { label: 'Power' }, { label: 'Range' }],
      series: [{ name: 'A', values: [80, 60, 40], color: '#3b82f6' }],
      maxValue: 100,
    });
    const text = notice(host)!;
    expect(text).toContain('different maxima');
    expect(text).toContain('100');
    expect(text).toContain('200');
    expect(text).toContain('not an equal value');
  });

  it('says which spoke is on which maximum, not only the set of them', async () => {
    const { host } = await setup({
      axes: [{ label: 'Speed', max: 200 }, { label: 'Power' }, { label: 'Range' }],
      series: [{ name: 'A', values: [80, 60, 40], color: '#3b82f6' }],
      maxValue: 100,
    });
    const text = notice(host)!;
    expect(text).toContain('Speed out of 200');
    expect(text).toContain('Power, Range out of 100');
  });

  it('discloses every vertex the scale had to move', async () => {
    const { c, host } = await setup({
      axes: FOUR,
      series: [{ name: 'A', values: [400, -40, NaN], color: '#3b82f6' }],
      size: 200,
    });
    const text = notice(host)!;
    expect(text).toContain('drawn at the rim: A on Speed (400 of 100)');
    expect(text).toContain('Below zero, drawn at the centre: A on Power (-40)');
    expect(text).toContain('No value, drawn at the centre as 0: A on Range, A on Cost');
    // A NaN no longer blanks the polygon.
    expect(c.seriesPolygon(c.series()[0])).not.toContain('NaN');
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('does not collide on two spokes with the same label', async () => {
    const { host } = await setup({
      axes: [{ label: 'X' }, { label: 'X' }, { label: 'Y' }],
      series: [{ name: 'A', values: [1, 2, 3], color: '#3b82f6' }],
    });
    expect(host.querySelectorAll('table tbody tr').length).toBe(3);
  });

  it('demonstrates the inversion: 80 of 200 is drawn inside 60 of 100', async () => {
    const size = 200;
    const { c } = await setup({
      axes: [{ label: 'Wide', max: 200 }, { label: 'Narrow' }],
      series: [{ name: 'A', values: [80, 60], color: '#3b82f6' }],
      maxValue: 100,
      size,
    });
    const dots = c.seriesDots(c.series()[0]);
    const fromCentre = (d: { x: number; y: number }) =>
      Math.hypot(d.x - size / 2, d.y - size / 2);
    // ★ The LARGER number sits closer to the centre — the opposite of what a
    //   reader given the bare numbers would conclude.
    expect(dots[0].value).toBeGreaterThan(dots[1].value);
    expect(fromCentre(dots[0])).toBeLessThan(fromCentre(dots[1]));
  });

  it('says nothing about maxima when every spoke shares one', async () => {
    const { host } = await setup({ axes: FOUR, series: ONE_SERIES });
    expect(notice(host)).not.toContain('different maxima');
  });

  it('says nothing at all when there is nothing to plot', async () => {
    expect(notice((await setup({ axes: [], series: [] })).host)).toBeNull();
    expect(notice((await setup({ axes: FOUR, series: [] })).host)).toBeNull();
  });

  it('cannot be turned off', async () => {
    // Same rule as the bullet chart's scale note: a condition of the picture
    // being readable, not a decoration on it.
    const { host } = await setup({ axes: FOUR, series: ONE_SERIES, showDots: false });
    expect(notice(host)).not.toBeNull();
  });
});
