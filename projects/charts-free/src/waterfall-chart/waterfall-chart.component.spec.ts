import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvWaterfallChartComponent,
  type WaterfallBarEvent,
  type WaterfallPoint,
} from './waterfall-chart.component';

/**
 * A waterfall is a running accumulator rendered as geometry, and the two halves
 * disagree easily. `isTotal` / `isIntermediate` / a missing `value` all mean
 * "draw the running sum here, and do not advance it" — get one of those three
 * wrong and every bar AFTER it is drawn at the wrong height, silently, with no
 * error anywhere.
 *
 * The second theme is the sign. Every bar has a "visible end" that gets the
 * rounded corners, and that end flips with the sign AND with the orientation —
 * four combinations, each with its own path builder.
 */

async function setup(inputs: Partial<ComponentInput<SvWaterfallChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvWaterfallChartComponent, {
    inputs: inputs as ComponentInput<SvWaterfallChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

/** Pin the SVG box to its viewBox so mouse coordinates map 1:1. */
function pinLayout(host: HTMLElement, width: number, height: number) {
  const svg = host.querySelector('svg')!;
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }) as DOMRect;
}

const REVENUE: WaterfallPoint[] = [
  { label: 'Start', value: 400 },
  { label: 'Sales', value: 300 },
  { label: 'Costs', value: -200 },
  { label: 'Balance', isIntermediate: true },
  { label: 'Tax', value: -100 },
  { label: 'Net', isTotal: true },
];

describe('SvWaterfallChartComponent — the running total', () => {
  it('advances the accumulator only across real deltas', async () => {
    const { c } = await setup({ data: REVENUE });
    const bars = c.bars();
    expect(bars.map((b) => [b.from, b.to])).toEqual([
      [0, 400],
      [400, 700],
      [700, 500],
      [0, 500], // intermediate — drawn from zero, leaves the accumulator alone
      [500, 400],
      [0, 400], // total
    ]);
  });

  it('classifies each bar by how it was declared, not only by its sign', async () => {
    const { c } = await setup({ data: REVENUE });
    expect(c.bars().map((b) => b.type)).toEqual([
      'increase',
      'increase',
      'decrease',
      'intermediate',
      'decrease',
      'total',
    ]);
  });

  /**
   * ★★★ THE DEFECT THIS CLOSES (audit item CH-18-I2). `{ label: 'Net' }` used to
   *     render as a reconciled TOTAL: the bar drew the running sum and was typed
   *     `total`, on the strength of `value == null` alone. Nothing in the data
   *     said so. A row whose amount failed to come back from an API, or a
   *     mistyped key, therefore produced a figure the source never claimed, in
   *     the one position on a waterfall a reader trusts most.
   *
   *     A step with no value is now a step with no value: `valuePolicy` decides
   *     what happens to it, and the chart says so out loud.
   */
  it('never promotes a step with no value into a total', async () => {
    const { c } = await setup({
      data: [{ label: 'Start', value: 100 }, { label: 'Net' }],
    });
    expect(c.bars()[1].type).not.toBe('total');
    expect(c.bars()[1].clamped).toBe(true);
    expect(c.bars()[1].labelText).toBe('no value');
    // The running total is where it was; nothing was invented for it.
    expect(c.bars()[1].to).toBe(100);
  });

  it('reports a zero delta as an increase, not a decrease', async () => {
    const { c } = await setup({
      data: [{ label: 'Start', value: 100 }, { label: 'Flat', value: 0 }],
    });
    expect(c.bars()[1].type).toBe('increase');
  });

  it('draws nothing at all for an empty series', async () => {
    const { c, host } = await setup({ data: [] });
    expect(c.bars()).toEqual([]);
    expect(c.chartIsEmpty()).toBe(true);
    expect(host.querySelector('svg')).toBeNull();
  });

  it('draws a single point as one bar with no connector', async () => {
    const { c } = await setup({ data: [{ label: 'Only', value: 50 }] });
    expect(c.bars().length).toBe(1);
    expect(c.bars()[0].hasConnector).toBe(false);
    expect(c.bars()[0].rx).not.toBeNaN();
  });

  it('gives the last bar no connector and every earlier one exactly one', async () => {
    const { c } = await setup({ data: REVENUE });
    expect(c.bars().map((b) => b.hasConnector)).toEqual([true, true, true, true, true, false]);
  });
});

describe('SvWaterfallChartComponent — the axis', () => {
  it('spans zero to a rounded ceiling for all-positive data', async () => {
    const { c } = await setup({ data: [{ label: 'A', value: 87 }] });
    // The bar geometry is derived from the axis; assert through it.
    const bar = c.bars()[0];
    expect(bar.ry).toBeGreaterThanOrEqual(0);
    expect(bar.rh).toBeGreaterThan(0);
    expect(c.zeroLine().visible).toBe(false); // nothing goes below zero
  });

  it('drops the floor below zero when the running total does', async () => {
    // Costs take the total to -100; without a negative floor that bar is drawn
    // off the bottom of the plot.
    const { c } = await setup({
      data: [{ label: 'Start', value: 100 }, { label: 'Costs', value: -200 }],
    });
    expect(c.zeroLine().visible).toBe(true);
    const [, costs] = c.bars();
    expect(costs.to).toBe(-100);
    expect(costs.ry + costs.rh).toBeGreaterThan(c.zeroLine().y1);
  });

  it('keeps an all-zero series on a finite axis instead of dividing by a zero range', async () => {
    // min === max === 0 makes the scale 0/0. Every rect x, y, width and height
    // would be NaN and the browser would draw an empty box.
    const { c, host } = await setup({ data: [{ label: 'A', value: 0 }, { label: 'B', value: 0 }] });
    expect(c.bars().every((b) => Number.isFinite(b.rx + b.ry + b.rw + b.rh))).toBe(true);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('labels the grid with prefix and suffix at both extremes', async () => {
    const { c } = await setup({
      data: REVENUE,
      options: { valuePrefix: '$', valueSuffix: 'M' },
    });
    const lines = c.gridLines();
    expect(lines.length).toBe(6);
    expect(lines[0].label.startsWith('$')).toBe(true);
    expect(lines[0].label.endsWith('M')).toBe(true);
    expect(lines.every((l) => Number.isFinite(l.y1) && Number.isFinite(l.y2))).toBe(true);
  });

  it('runs grid lines across the plot vertically and down it horizontally', async () => {
    const { c: vert } = await setup({ data: REVENUE });
    expect(vert.gridLines()[0].y1).toBe(vert.gridLines()[0].y2);
    expect(vert.gridLines()[0].anchor).toBe('end');

    const { c: horiz } = await setup({ data: REVENUE, orientation: 'horizontal' });
    expect(horiz.gridLines()[0].x1).toBe(horiz.gridLines()[0].x2);
    expect(horiz.gridLines()[0].anchor).toBe('middle');
  });

  it('draws the zero line across the plot in whichever direction the bars run', async () => {
    const NEG: WaterfallPoint[] = [
      { label: 'Start', value: 100 },
      { label: 'Costs', value: -200 },
    ];
    const { c: vert } = await setup({ data: NEG });
    expect(vert.zeroLine().y1).toBe(vert.zeroLine().y2);

    const { c: horiz } = await setup({ data: NEG, orientation: 'horizontal' });
    expect(horiz.zeroLine().x1).toBe(horiz.zeroLine().x2);
    expect(horiz.zeroLine().visible).toBe(true);
  });
});

describe('SvWaterfallChartComponent — bar geometry', () => {
  it('gives a zero-height bar a visible minimum so it does not disappear', async () => {
    // `{ value: 0 }` between two real deltas is a legitimate row; a 0px rect
    // vanishes and the connector appears to skip a category.
    const { c } = await setup({
      data: [{ label: 'A', value: 500 }, { label: 'Flat', value: 0 }],
    });
    expect(c.bars()[1].rh).toBe(3);
  });

  it('places the data label above a rising bar and below a falling one', async () => {
    const { c } = await setup({ data: REVENUE });
    const [start, , costs] = c.bars();
    expect(start.ly).toBeCloseTo(start.ry - 6, 6);
    expect(costs.ly).toBeCloseTo(costs.ry + costs.rh + 14, 6);
    expect(start.lAnchor).toBe('middle');
  });

  it('places the horizontal data label past the far end of the bar', async () => {
    const { c } = await setup({ data: REVENUE, orientation: 'horizontal' });
    const [start, , costs] = c.bars();
    expect(start.lAnchor).toBe('start');
    expect(start.lx).toBeCloseTo(start.rx + start.rw + 6, 6);
    expect(costs.lAnchor).toBe('end');
    expect(costs.lx).toBeCloseTo(costs.rx - 6, 6);
  });

  it('signs a delta label and shows a total as an absolute figure', async () => {
    const { c } = await setup({ data: REVENUE, options: { valuePrefix: '$' } });
    const labels = c.bars().map((b) => b.labelText);
    expect(labels[0]).toBe('+$400');
    expect(labels[2]).toBe('-$200');
    expect(labels[3]).toBe('$500'); // intermediate — the running sum, unsigned
    expect(labels[5]).toBe('$400'); // total
  });

  it('animates each direction with its own class, staggered by index', async () => {
    const { c: vert } = await setup({ data: REVENUE });
    expect(vert.bars().map((b) => b.animClass)).toEqual([
      'bc-wf-up', 'bc-wf-up', 'bc-wf-down', 'bc-wf-up', 'bc-wf-down', 'bc-wf-up',
    ]);
    expect(vert.bars().map((b) => b.delay)).toEqual([0, 65, 130, 195, 260, 325]);

    const { c: horiz } = await setup({ data: REVENUE, orientation: 'horizontal' });
    expect(horiz.bars()[0].animClass).toBe('bc-wf-right');
    expect(horiz.bars()[2].animClass).toBe('bc-wf-left');
  });

  it('puts category labels under the bars vertically and beside them horizontally', async () => {
    const { c: vert } = await setup({ data: REVENUE });
    expect(vert.bars()[0].catAnchor).toBe('middle');
    expect(new Set(vert.bars().map((b) => b.catLabelY)).size).toBe(1);

    const { c: horiz } = await setup({ data: REVENUE, orientation: 'horizontal' });
    expect(horiz.bars()[0].catAnchor).toBe('end');
    expect(new Set(horiz.bars().map((b) => b.catLabelX)).size).toBe(1);
  });

  it('colours by classification, honouring every colour override', async () => {
    const { c } = await setup({
      data: REVENUE,
      options: { positiveColor: '#0f0', negativeColor: '#f00', totalColor: '#00f' },
    });
    expect(c.bars().map((b) => b.color)).toEqual(['#0f0', '#0f0', '#f00', '#00f', '#f00', '#00f']);
  });

  it('falls back to the built-in palette when no colours are given', async () => {
    const { c } = await setup({ data: REVENUE });
    expect(c.bars()[0].color).toBe('var(--color-accent-500)');
    expect(c.bars()[2].color).toBe('var(--color-danger-500)');
    expect(c.bars()[5].color).toBe('var(--color-primary-500)');
  });
});

describe('SvWaterfallChartComponent — bar paths', () => {
  it('draws nothing for a bar with no area', async () => {
    const { c } = await setup({ data: REVENUE });
    expect(c.barPath(0, 0, 0, 10, 4, true, true)).toBe('');
    expect(c.barPath(0, 0, 10, 0, 4, true, true)).toBe('');
    expect(c.barPath(0, 0, -5, 10, 4, true, true)).toBe('');
  });

  it('rounds the top of a rising column and the bottom of a falling one', async () => {
    const { c } = await setup({ data: REVENUE });
    const up = c.barPath(10, 20, 40, 60, 4, true, true);
    const down = c.barPath(10, 20, 40, 60, 4, false, true);
    expect(up).not.toBe(down);
    // The rising bar's first move is offset by the radius along the top edge.
    expect(up.startsWith('M 14 20')).toBe(true);
    expect(down.startsWith('M 10 20')).toBe(true);
    expect(up.endsWith('Z')).toBe(true);
    expect(down.endsWith('Z')).toBe(true);
  });

  it('rounds the right of a rightward bar and the left of a leftward one', async () => {
    const { c } = await setup({ data: REVENUE, orientation: 'horizontal' });
    const right = c.barPath(10, 20, 60, 40, 4, true, false);
    const left = c.barPath(10, 20, 60, 40, 4, false, false);
    expect(right).not.toBe(left);
    expect(right.startsWith('M 10 20')).toBe(true);
    expect(left.startsWith('M 14 20')).toBe(true);
  });

  it('clamps the corner radius to the bar so it cannot fold in on itself', async () => {
    // A radius larger than half the bar produces overlapping arcs and a shape
    // that renders as a blob or not at all.
    const { c } = await setup({ data: REVENUE });
    const tiny = c.barPath(0, 0, 4, 4, 40, true, true);
    expect(tiny).not.toContain('NaN');
    expect(tiny).toContain('M 2 0'); // radius clamped to 2, not 40
  });

  it('emits no NaN in any rendered path, in either orientation', async () => {
    for (const orientation of ['vertical', 'horizontal'] as const) {
      const { host } = await setup({ data: REVENUE, orientation });
      expect(host.innerHTML).not.toContain('NaN');
      expect(host.querySelectorAll('path[d]').length).toBeGreaterThan(0);
    }
  });
});

describe('SvWaterfallChartComponent — interaction', () => {
  it('reports the bar under the pointer and puts the tooltip near it', async () => {
    const { c, host } = await setup({ data: REVENUE });
    pinLayout(host, 560, 380);
    const hovered: WaterfallBarEvent[] = [];
    c.barHover.subscribe((e) => hovered.push(e));

    const bar = host.querySelectorAll('path[d]')[0];
    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 100, clientY: 200, bubbles: true }));

    expect(c.tooltip().visible).toBe(true);
    expect(c.tooltip().label).toBe('Start');
    expect(hovered).toEqual([
      { label: 'Start', delta: 400, running: 400, type: 'increase', color: 'var(--color-accent-500)' },
    ]);
  });

  it('keeps the hover tooltip inside the chart on both axes', async () => {
    const { c, host } = await setup({ data: REVENUE });
    pinLayout(host, 560, 380);
    const bars = host.querySelectorAll('path[d]');

    // Far right and near the top: x must clamp left, y must clamp down to 2.
    bars[0].dispatchEvent(new MouseEvent('mouseenter', { clientX: 559, clientY: 0, bubbles: true }));
    expect(c.tooltip().x).toBe(560 - 168 - 4);
    expect(c.tooltip().y).toBe(2);

    // The lower clamp is defensive: a pointer reported below the box (a stale
    // rect after a scroll, a touch event with an offset origin) would otherwise
    // place the tooltip past the bottom edge.
    bars[0].dispatchEvent(new MouseEvent('mouseenter', { clientX: 0, clientY: 500, bubbles: true }));
    expect(c.tooltip().y).toBe(380 - 72 - 4);
  });

  it('positions the tooltip from the bar itself on keyboard focus', async () => {
    // There is no pointer during keyboard navigation, so this path must derive
    // the position from the bar geometry rather than from an event.
    const { c } = await setup({ data: REVENUE });
    const seen: WaterfallBarEvent[] = [];
    c.barHover.subscribe((e) => seen.push(e));

    const bar = c.bars()[1];
    c.focusBar(bar);
    expect(c.tooltip().visible).toBe(true);
    expect(c.tooltip().label).toBe('Sales');
    expect(c.tooltip().x).toBeCloseTo(bar.rx + bar.rw / 2 - 84, 6);
    expect(seen.length).toBe(1);
  });

  it('clamps the focus tooltip at both ends of the row', async () => {
    const { c } = await setup({ data: REVENUE });
    c.focusBar(c.bars()[0]);
    expect(c.tooltip().x).toBeGreaterThanOrEqual(4);

    c.focusBar(c.bars()[5]);
    expect(c.tooltip().x).toBeLessThanOrEqual(560 - 168 - 4);

    // A bar near the top of the plot must not push the tooltip off it.
    c.focusBar({ ...c.bars()[0], ry: 0 });
    expect(c.tooltip().y).toBe(2);
  });

  it('emits the same payload on select as on hover', async () => {
    const { c } = await setup({ data: REVENUE });
    const selected: WaterfallBarEvent[] = [];
    c.barSelect.subscribe((e) => selected.push(e));

    c.selectBar(c.bars()[2]);
    expect(selected).toEqual([
      { label: 'Costs', delta: -200, running: 500, type: 'decrease', color: 'var(--color-danger-500)' },
    ]);
  });

  it('hides the tooltip on leave', async () => {
    const { c } = await setup({ data: REVENUE });
    c.focusBar(c.bars()[0]);
    expect(c.tooltip().visible).toBe(true);
    c.hideTooltip();
    expect(c.tooltip().visible).toBe(false);
  });
});

describe('SvWaterfallChartComponent — labels and chrome', () => {
  it('signs the tooltip delta and shows totals unsigned', async () => {
    const { c } = await setup({ data: REVENUE, options: { valuePrefix: '$', valueSuffix: 'M' } });
    c.focusBar(c.bars()[1]);
    expect(c.fmtTooltipDelta(c.tooltip())).toBe('+$300M');

    c.focusBar(c.bars()[2]);
    expect(c.fmtTooltipDelta(c.tooltip())).toBe('-$200M');

    c.focusBar(c.bars()[3]); // intermediate
    expect(c.fmtTooltipDelta(c.tooltip())).toBe('$500M');

    c.focusBar(c.bars()[5]); // total
    expect(c.fmtTooltipDelta(c.tooltip())).toBe('$400M');
    expect(c.fmtTooltipTotal(400)).toBe('$400M');
  });

  it('works with no prefix or suffix configured', async () => {
    const { c } = await setup({ data: REVENUE });
    c.focusBar(c.bars()[1]);
    expect(c.fmtTooltipDelta(c.tooltip())).toBe('+300');
    expect(c.fmtTooltipTotal(400)).toBe('400');
  });

  it('names each bar type in words', async () => {
    const { c } = await setup({ data: REVENUE });
    expect(c.typeLabel('increase')).toBe('Increase');
    expect(c.typeLabel('decrease')).toBe('Decrease');
    expect(c.typeLabel('intermediate')).toBe('Interim Sum');
    expect(c.typeLabel('total')).toBe('Total');
  });

  it('shows the title only when given one', async () => {
    const { host: titled } = await setup({ data: REVENUE, title: 'Cash flow' });
    expect(titled.textContent).toContain('Cash flow');

    const { host: bare } = await setup({ data: REVENUE });
    expect(bare.querySelector('h3')).toBeNull();
  });

  it('drops the grid, connectors, labels and legend independently', async () => {
    const { host: full } = await setup({ data: REVENUE });
    const { host: bare } = await setup({
      data: REVENUE,
      options: {
        showGrid: false,
        showConnectors: false,
        showLabels: false,
        showLegend: false,
      },
    });
    expect(bare.querySelectorAll('line').length).toBeLessThan(
      full.querySelectorAll('line').length,
    );
    // Scoped to the legend: `showLegend` hides a visual key, and the data table
    // — which names the same three types in words — is the non-visual
    // alternative to the plot and is not a display option.
    expect(bare.querySelector('[data-sv-legend]')).toBeNull();
    expect(full.querySelector('[data-sv-legend]')!.textContent).toContain('Increase');
    expect(bare.querySelector('sv-data-summary-table table')).not.toBeNull();
    expect(bare.querySelector('svg')!.textContent).not.toContain('+400');
  });

  it('publishes the animation duration only when configured', async () => {
    const { c: timed } = await setup({ data: REVENUE, options: { animationDuration: 900 } });
    expect(timed.animDuration()).toBe('900ms');

    const { c: dflt } = await setup({ data: REVENUE });
    expect(dflt.animDuration()).toBeNull();
  });

  it('honours the bar radius option, including a squared-off zero', async () => {
    const { c: sharp } = await setup({ data: REVENUE, options: { barRadius: 0 } });
    expect(sharp.barR()).toBe(0);
    // With r = 0 the rounded and square starts coincide.
    expect(sharp.barPath(10, 20, 40, 60, sharp.barR(), true, true).startsWith('M 10 20')).toBe(true);

    const { c: dflt } = await setup({ data: REVENUE });
    expect(dflt.barR()).toBe(4);
  });

  it('honours the height input in the SVG box', async () => {
    const { c, host } = await setup({ data: REVENUE, height: 500 });
    expect(c.svgH()).toBe(500);
    expect(host.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 560 500');
  });

  it('adds the custom class without dropping the layout classes', async () => {
    const { host } = await setup({ data: REVENUE, customClass: 'my-waterfall' });
    expect(host.querySelector('.my-waterfall')!.classList.contains('flex')).toBe(true);
  });
});

/**
 * ============================================================================
 *  What a point IS, declared rather than guessed (audit item CH-18-I2)
 * ============================================================================
 *
 * Three declarations used to collapse into one branch — `isTotal ||
 * isIntermediate || value == null` — so two booleans encoded four states for
 * three meanings and a missing number was indistinguishable from a claim about
 * the total. `kind` is the contract; the flags are shorthand mapped in one place.
 * ============================================================================
 */
describe('SvWaterfallChartComponent — declared classification', () => {
  it('reads kind: total and kind: subtotal exactly as the old flags did', async () => {
    const { c: declared } = await setup({
      data: [
        { label: 'Start', value: 400 },
        { label: 'Balance', kind: 'subtotal' },
        { label: 'Tax', value: -100 },
        { label: 'Net', kind: 'total' },
      ],
    });
    const { c: flagged } = await setup({
      data: [
        { label: 'Start', value: 400 },
        { label: 'Balance', isIntermediate: true },
        { label: 'Tax', value: -100 },
        { label: 'Net', isTotal: true },
      ],
    });
    expect(declared.bars().map((b) => [b.type, b.from, b.to])).toEqual(
      flagged.bars().map((b) => [b.type, b.from, b.to]),
    );
    expect(declared.bars().map((b) => b.type)).toEqual([
      'increase',
      'intermediate',
      'decrease',
      'total',
    ]);
  });

  it('lets kind win over a flag that contradicts it', async () => {
    const { c } = await setup({
      data: [{ label: 'Start', value: 100 }, { label: 'Net', kind: 'delta', value: 50, isTotal: true }],
    });
    expect(c.bars()[1].type).toBe('increase');
    expect(c.bars()[1].to).toBe(150);
  });

  it('keeps the reading both flags together always had', async () => {
    // Undefined before `kind` existed, and `isIntermediate` won by falling first
    // in the chain. Anyone relying on that keeps it.
    const { c } = await setup({
      data: [{ label: 'Start', value: 100 }, { label: 'Both', isTotal: true, isIntermediate: true }],
    });
    expect(c.bars()[1].type).toBe('intermediate');
  });

  it('advances the accumulator across a delta and never across a subtotal', async () => {
    const { c } = await setup({
      data: [
        { label: 'A', value: 10 },
        { label: 'Interim', kind: 'subtotal' },
        { label: 'B', value: 5 },
        { label: 'Interim 2', kind: 'subtotal' },
      ],
    });
    expect(c.bars().map((b) => b.to)).toEqual([10, 10, 15, 15]);
  });

  it('reads an unknown kind as a step, not as a running sum, and says so', async () => {
    // JSON is where the type is a hope: `'Total'` used to fall through to "not a
    // delta" and draw a reconciled figure the data never claimed.
    const { c, host } = await setup({
      data: [
        { label: 'A', value: 10 },
        { label: 'Oops', kind: 'Total' as unknown as 'total', value: 5 },
      ],
    });
    expect(c.bars()[1].type).toBe('increase');
    expect(c.bars()[1].to).toBe(15);
    expect(host.querySelector('[data-sv-notice]')?.textContent).toContain('Oops: its kind ("Total")');
  });
});

/**
 * ============================================================================
 *  Steps this chart cannot draw (audit item X-7)
 * ============================================================================
 *
 * A waterfall is an accumulator, which makes one bad number uniquely
 * destructive: `acc + NaN` is `NaN` and stays `NaN`, so a single blank cell took
 * out every later bar, both axis bounds, the scale derived from them and
 * therefore every path in the plot. The chart rendered an empty box and reported
 * nothing.
 * ============================================================================
 */
describe('SvWaterfallChartComponent — a step it cannot draw', () => {
  const notice = (host: HTMLElement) =>
    host.querySelector('[data-sv-notice]')?.textContent?.trim() ?? null;

  const GAP: WaterfallPoint[] = [
    { label: 'Start', value: 400 },
    { label: 'Missing', value: NaN },
    { label: 'Tax', value: -100 },
    { label: 'Net', kind: 'total' },
  ];

  it('keeps every later bar and the axis intact, and says what it did', async () => {
    const { c, host } = await setup({ data: GAP });
    expect(c.bars().map((b) => b.to)).toEqual([400, 400, 300, 300]);
    expect(c.bars().every((b) => Number.isFinite(b.rx + b.ry + b.rw + b.rh))).toBe(true);
    expect(host.innerHTML).not.toContain('NaN');
    // Not `console.warn`: the person reading the dashboard sees this.
    expect(notice(host)).toContain('1 step shown at 0');
  });

  it('marks the step in the plot rather than leaving it to the notice alone', async () => {
    const { c, host } = await setup({ data: GAP });
    expect(c.bars()[1].flagged).toBe(true);
    expect(c.bars()[1].labelText).toBe('no value');
    const marked = host.querySelectorAll('path[stroke-dasharray]');
    expect(marked.length).toBe(1);
    expect(host.textContent).toContain('Does not add up');
  });

  it('holds an unbounded value to the same rule', async () => {
    const { c, host } = await setup({
      data: [{ label: 'A', value: 10 }, { label: 'Runaway', value: Infinity }, { label: 'B', value: 5 }],
    });
    expect(c.bars().map((b) => b.to)).toEqual([10, 10, 15]);
    expect(notice(host)).toContain('unbounded');
  });

  it('keeps every step in its own position, because position is the sequence', async () => {
    // `omit` is not offered here for exactly this reason: dropping the second
    // step would slide 'Tax' and 'Net' one place left, under the wrong labels.
    const { c } = await setup({ data: GAP });
    expect(c.bars().map((b) => b.label)).toEqual(['Start', 'Missing', 'Tax', 'Net']);
  });

  it('refuses the series under reject', async () => {
    const { host } = await setup({ data: GAP, valuePolicy: 'reject' });
    expect(host.querySelector('[data-sv-state="error"]')).not.toBeNull();
    expect(host.querySelectorAll('path[role="button"]').length).toBe(0);
  });

  it('falls back to clamp when asked for something it cannot do', async () => {
    const { c } = await setup({ data: GAP, valuePolicy: 'omit' });
    expect(c.bars().length).toBe(4);
    expect(c.bars()[1].clamped).toBe(true);
  });

  it('does not tell the tooltip reader the step was +0', async () => {
    const { c } = await setup({ data: GAP });
    c.focusBar(c.bars()[1]);
    expect(c.fmtTooltipDelta(c.tooltip())).toBe('no value');
  });

  it('treats a non-finite tolerance as none rather than flagging every total', async () => {
    const { c } = await setup({
      data: [{ label: 'A', value: 10 }, { label: 'Net', kind: 'total', value: 10 }],
      totalTolerance: NaN,
    });
    expect(c.bars()[1].flagged).toBe(false);
  });

  it('says nothing when there is nothing to say', async () => {
    const { host, c } = await setup({ data: REVENUE });
    expect(notice(host)).toBeNull();
    expect(c.hasFlagged()).toBe(false);
    expect(host.textContent).not.toContain('Does not add up');
  });
});

/**
 * ============================================================================
 *  A total that does not reconcile (audit item CH-18-I1)
 * ============================================================================
 *
 * `value` on a total bar was read and discarded: the bar drew the accumulator
 * whatever the data claimed. A ledger stating 500 against steps summing to 480
 * produced a chart labelled 480, with the 20 nowhere — a reconciliation that
 * silently fails to reconcile. The bar still draws the computed figure, because
 * the connectors and every preceding bar have to agree with it, and the
 * difference is now disclosed four times over.
 * ============================================================================
 */
describe('SvWaterfallChartComponent — reconciling a stated total', () => {
  const notice = (host: HTMLElement) =>
    host.querySelector('[data-sv-notice]')?.textContent?.trim() ?? null;

  const STEPS: WaterfallPoint[] = [
    { label: 'Start', value: 400 },
    { label: 'Tax', value: -100 },
  ];

  it('says nothing when the stated total agrees with the steps', async () => {
    const { host, c } = await setup({
      data: [...STEPS, { label: 'Net', kind: 'total', value: 300 }],
    });
    expect(notice(host)).toBeNull();
    expect(c.bars()[2].labelText).toBe('300');
    expect(c.bars()[2].flagged).toBe(false);
  });

  it('names the stated figure, the computed one and the difference', async () => {
    const { host } = await setup({
      data: [...STEPS, { label: 'Net', kind: 'total', value: 500 }],
    });
    const text = notice(host)!;
    expect(text).toContain('Net: States 500');
    expect(text).toContain('the 300 its steps add up to');
    expect(text).toContain('a difference of 200');
  });

  it('still draws the figure the steps add up to, not the one stated', async () => {
    // ★ The bar cannot show 500: the bar before it ends at 300 and the connector
    //   runs between them, so a 500-high total would be a picture of arithmetic
    //   that did not happen.
    const stated = await setup({ data: [...STEPS, { label: 'Net', kind: 'total', value: 500 }] });
    const bare = await setup({ data: [...STEPS, { label: 'Net', kind: 'total' }] });
    expect(stated.c.bars()[2].to).toBe(300);
    expect(stated.c.bars()[2].ry).toBe(bare.c.bars()[2].ry);
    expect(stated.c.bars()[2].rh).toBe(bare.c.bars()[2].rh);
  });

  it('prints both figures on the bar and marks it', async () => {
    const { c, host } = await setup({
      data: [...STEPS, { label: 'Net', kind: 'total', value: 500 }],
      options: { valuePrefix: '$' },
    });
    expect(c.bars()[2].labelText).toBe('$300 ≠ $500');
    expect(c.bars()[2].flagged).toBe(true);
    expect(host.querySelectorAll('path[stroke-dasharray]').length).toBe(1);
    expect(c.hasFlagged()).toBe(true);
  });

  it('checks a subtotal mid-series without letting it move the total', async () => {
    const { host, c } = await setup({
      data: [
        { label: 'Start', value: 400 },
        { label: 'Balance', kind: 'subtotal', value: 450 },
        { label: 'Tax', value: -100 },
        { label: 'Net', kind: 'total', value: 300 },
      ],
    });
    expect(c.bars().map((b) => b.to)).toEqual([400, 400, 300, 300]);
    expect(notice(host)).toContain('Balance: States 450');
    expect(c.bars().map((b) => b.flagged)).toEqual([false, true, false, false]);
  });

  it('does not report floating-point noise as a discrepancy', async () => {
    // 0.1 + 0.2 is 0.30000000000000004. An exact comparison would flag a ledger
    // that reconciles perfectly, and a chart that cries wolf about the
    // seventeenth decimal place gets ignored when a real hole appears.
    const { host } = await setup({
      data: [
        { label: 'A', value: 0.1 },
        { label: 'B', value: 0.2 },
        { label: 'Net', kind: 'total', value: 0.3 },
      ],
    });
    expect(host.querySelector('[data-sv-notice]')).toBeNull();
  });

  it('absorbs a rounding gap up to the tolerance and reports anything past it', async () => {
    const rounded: WaterfallPoint[] = [
      { label: 'A', value: 1 },
      { label: 'B', value: 1 },
      { label: 'Net', kind: 'total', value: 2.4 },
    ];
    const { host: strict } = await setup({ data: rounded });
    expect(notice(strict)).toContain('a difference of 0.4');

    const { host: tolerant } = await setup({ data: rounded, totalTolerance: 0.5 });
    expect(notice(tolerant)).toBeNull();

    const { host: stillShort } = await setup({ data: rounded, totalTolerance: 0.2 });
    expect(notice(stillShort)).toContain('a difference of 0.4');
  });

  it('reports a stated total it cannot read, and keeps drawing the computed one', async () => {
    const { host, c } = await setup({
      data: [...STEPS, { label: 'Net', kind: 'total', value: NaN }],
    });
    expect(notice(host)).toContain('The stated total could not be read');
    expect(c.bars()[2].to).toBe(300);
    expect(c.bars()[2].labelText).toBe('300');
    expect(c.bars()[2].flagged).toBe(true);
  });

  it('ignores a value on a subtotal that states nothing', async () => {
    const { host } = await setup({ data: [...STEPS, { label: 'Net', kind: 'total' }] });
    expect(host.querySelector('[data-sv-notice]')).toBeNull();
  });

  it('carries the discrepancy into the bar’s accessible name', async () => {
    const { c, host } = await setup({
      data: [...STEPS, { label: 'Net', kind: 'total', value: 500 }],
    });
    const label = host.querySelectorAll('path[role="button"]')[2].getAttribute('aria-label')!;
    expect(label).toBe(c.barAriaLabel(c.bars()[2]));
    expect(label).toContain('Net: total 300');
    expect(label).toContain('a difference of 200');
  });
});

/**
 * ============================================================================
 *  The order is the data (audit item CH-18-I3)
 * ============================================================================
 *
 * Every bar starts where the last one ended, so a reorder is not a different
 * view of the same facts — it is a different set of facts. This component never
 * sorts, and these cases are what says so.
 * ============================================================================
 */
describe('SvWaterfallChartComponent — ordering', () => {
  it('plots the series in the order it was given, whatever that order is', async () => {
    const unsorted: WaterfallPoint[] = [
      { label: 'Zulu', value: 5 },
      { label: 'Net so far', kind: 'subtotal' },
      { label: 'Alpha', value: -80 },
      { label: 'Mike', value: 200 },
    ];
    const { c } = await setup({ data: unsorted });
    expect(c.bars().map((b) => b.label)).toEqual(['Zulu', 'Net so far', 'Alpha', 'Mike']);
    // Not sorted by magnitude, not by label, and the subtotal is left where it
    // was rather than moved to the end.
    expect(c.bars().map((b) => b.to)).toEqual([5, 5, -75, 125]);
  });

  it('reaches a different total from the same steps in a different order', async () => {
    // The reason the contract exists, stated as arithmetic: a subtotal reports
    // whatever has happened before it, so moving one changes what it claims.
    const early = await setup({
      data: [{ label: 'A', value: 100 }, { label: 'Interim', kind: 'subtotal' }, { label: 'B', value: 50 }],
    });
    const late = await setup({
      data: [{ label: 'A', value: 100 }, { label: 'B', value: 50 }, { label: 'Interim', kind: 'subtotal' }],
    });
    expect(early.c.bars()[1].to).toBe(100);
    expect(late.c.bars()[2].to).toBe(150);
  });

  it('keeps two steps that share a label as two separate steps', async () => {
    // Which is why bars track by index: a label is not an identity here.
    const { c } = await setup({
      data: [
        { label: 'Adjustment', value: 10 },
        { label: 'Adjustment', value: -4 },
      ],
    });
    expect(c.bars().length).toBe(2);
    expect(c.bars().map((b) => b.to)).toEqual([10, 6]);
  });
});

/**
 * ============================================================================
 *  The step table (audit item CH-18-M4)
 * ============================================================================
 *
 * The bars are focusable and name themselves, but two figures lived nowhere a
 * reader without the picture could reach: the running total after each step —
 * drawn as a bar's vertical position, and spoken only by a hover tooltip — and
 * the step number, which is the part of a waterfall that carries the meaning.
 * ============================================================================
 */
describe('SvWaterfallChartComponent — the step table', () => {
  const summary = (host: HTMLElement) => host.querySelector('sv-data-summary-table table');

  const grid = (host: HTMLElement) =>
    [...(summary(host)?.querySelectorAll('tr') ?? [])].map((tr) =>
      [...tr.children].map((cell) => cell.textContent?.trim() ?? ''),
    );

  it('gives every step its number, its type, its change and the total after it', async () => {
    const { host } = await setup({ data: REVENUE, title: 'Cash flow' });
    expect(grid(host)).toEqual([
      ['Item', 'Step', 'Type', 'Change', 'Running total'],
      ['Start', '1', 'Increase', '+400', '400'],
      ['Sales', '2', 'Increase', '+300', '700'],
      ['Costs', '3', 'Decrease', '-200', '500'],
      ['Balance', '4', 'Interim Sum', 'no change', '500'],
      ['Tax', '5', 'Decrease', '-100', '400'],
      ['Net', '6', 'Total', 'no change', '400'],
    ]);
    expect(summary(host)!.querySelector('caption')!.textContent!.trim()).toBe('Cash flow');
  });

  it('names the table by its family when the chart has no title', async () => {
    const { host } = await setup({ data: REVENUE });
    expect(summary(host)!.querySelector('caption')!.textContent!.trim()).toBe('Waterfall chart');
  });

  it('states the discrepancy in the running-total cell', async () => {
    const { host } = await setup({
      data: [
        { label: 'Start', value: 400 },
        { label: 'Net', kind: 'total', value: 500 },
      ],
    });
    expect(grid(host)[2]).toEqual([
      'Net', '2', 'Total', 'no change', '400 (stated 500, a difference of 100)',
    ]);
  });

  it('reports what the source held for a step the plot could not draw', async () => {
    // The table is the data: the plot shows a stub at no change, and the cell
    // shows the absence that produced it rather than the zero it was drawn as.
    const { host } = await setup({
      data: [{ label: 'Start', value: 400 }, { label: 'Missing', value: NaN }],
    });
    expect(grid(host)[2]).toEqual(['Missing', '2', 'Increase', 'no value (drawn as no change)', '400']);
  });

  it('publishes no table in place of the empty state', async () => {
    const { host } = await setup({ data: [] });
    expect(summary(host)).toBeNull();
  });

  it('follows the data when the series changes', async () => {
    const { host, fixture } = await setup({ data: REVENUE });
    fixture.componentRef.setInput('data', [{ label: 'Only', value: 7 }]);
    fixture.detectChanges();
    expect(grid(host)).toEqual([
      ['Item', 'Step', 'Type', 'Change', 'Running total'],
      ['Only', '1', 'Increase', '+7', '7'],
    ]);
  });

  it('labels the chart with a generated summary, and lets the host override it', async () => {
    const { host } = await setup({ data: REVENUE, title: 'Cash flow' });
    expect(host.querySelector('svg')!.getAttribute('aria-label')).toBe(
      'Cash flow: 6 steps in sequence, ending at 400.',
    );

    const custom = await setup({ data: REVENUE, ariaLabel: 'Custom' });
    expect(custom.host.querySelector('svg')!.getAttribute('aria-label')).toBe('Custom');
  });

  it('names the running total on every bar, not only in the tooltip', async () => {
    const { host } = await setup({ data: REVENUE });
    const labels = [...host.querySelectorAll('path[role="button"]')].map((p) =>
      p.getAttribute('aria-label'),
    );
    expect(labels[1]).toBe('Sales: +300, running total 700');
    expect(labels[3]).toBe('Balance: interim sum 500');
  });
});
