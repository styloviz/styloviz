import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvCylindricalColumnChartComponent } from './cylindrical-column-chart.component';
import type { BarChartDataset } from './bar-chart.types';

/**
 * A column drawn as a cylinder: a body rect, a lighter ellipse cap on top and a
 * darker ellipse foot. The cap's Y-radius is derived from the bar WIDTH, not its
 * height, so it survives a short bar — but a bar narrowed by many series in one
 * group takes the cap with it, and the three shades have to stay tied to one
 * source colour or the cylinder reads as three unrelated shapes.
 */

async function setup(inputs: Partial<ComponentInput<SvCylindricalColumnChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvCylindricalColumnChartComponent, {
    inputs: inputs as ComponentInput<SvCylindricalColumnChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

/** Pin the SVG box to its viewBox so mouse coordinates map 1:1. */
function pinLayout(host: HTMLElement, width: number, height: number) {
  const svg = host.querySelector('svg')!;
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }) as DOMRect;
}

const CATS = ['Q1', 'Q2', 'Q3'];
const SETS: BarChartDataset[] = [{ label: 'Units', data: [100, 50, 0] }];

describe('SvCylindricalColumnChartComponent — geometry', () => {
  it('grows the body from the baseline and centres the caps on it', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    const bars = c.cylindricalBars();
    expect(c.axisMax()).toBe(100);
    expect(bars[0].barH).toBeCloseTo(c.plotH(), 9);
    expect(bars[0].y).toBeCloseTo(0, 9);
    expect(bars[1].barH).toBeCloseTo(c.plotH() / 2, 9);
    // The ellipse sits on the bar's midline and is half its width across.
    expect(bars[0].cx).toBeCloseTo(bars[0].x + bars[0].barW / 2, 9);
    expect(bars[0].rx).toBeCloseTo(bars[0].barW / 2, 9);
  });

  it('keeps a zero-value column visible as a 2px disc', async () => {
    // A cylinder of height zero would leave a category with nothing at all in it.
    const { c } = await setup({ categories: CATS, datasets: SETS });
    const zero = c.cylindricalBars()[2];
    expect(zero.value).toBe(0);
    expect(zero.barH).toBe(2);
    expect(zero.y).toBeCloseTo(c.plotH() - 2, 9);
  });

  it('derives the cap depth from the bar width, and lets it be tuned', async () => {
    const { c: def } = await setup({ categories: CATS, datasets: SETS });
    expect(def.capRatio()).toBe(0.18);
    expect(def.cylindricalBars()[0].capRy).toBeCloseTo(def.cylindricalBars()[0].barW * 0.18, 9);

    const { c: flat } = await setup({
      categories: CATS,
      datasets: SETS,
      options: { cylinderCapRatio: 0 },
    });
    expect(flat.cylindricalBars()[0].capRy).toBe(0);
  });

  it('narrows every bar — and so every cap — as series are added to a group', async () => {
    const { c: one } = await setup({ categories: CATS, datasets: SETS });
    const { c: three } = await setup({
      categories: CATS,
      datasets: [
        { label: 'A', data: [1, 2, 3] },
        { label: 'B', data: [1, 2, 3] },
        { label: 'C', data: [1, 2, 3] },
      ],
    });
    expect(three.cylindricalBars()[0].barW).toBeCloseTo(one.cylindricalBars()[0].barW / 3, 9);
    expect(three.cylindricalBars()[0].capRy).toBeCloseTo(one.cylindricalBars()[0].capRy / 3, 9);
    // The three series sit side by side inside one category.
    const q1 = three.cylindricalBars().filter((b) => b.cat === 'Q1').sort((a, b) => a.x - b.x);
    expect(q1.map((b) => b.series)).toEqual(['A', 'B', 'C']);
    expect(q1[1].x - q1[0].x).toBeCloseTo(q1[0].barW, 9);
  });

  it('honours the gap and keeps the group centred', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS, options: { barGap: 0.5 } });
    const groupW = c.plotW() / 3;
    const bar = c.cylindricalBars()[0];
    expect(bar.barW).toBeCloseTo(groupW / 2, 9);
    expect(bar.x).toBeCloseTo((groupW * 0.5) / 2, 9);
  });

  it('keeps a finite axis when every value is zero', async () => {
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Idle', data: [0, 0, 0] }],
    });
    expect(c.maxValue()).toBe(1);
    expect(c.axisMax()).toBe(1);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('rounds the axis up and ticks it evenly', async () => {
    const { c } = await setup({ categories: CATS, datasets: [{ label: 'U', data: [87, 1, 1] }] });
    expect(c.axisMax()).toBe(90);
    expect(c.gridValues()).toEqual([0, 18, 36, 54, 72, 90]);
    expect(c.gridLineY(90)).toBe(0);
    expect(c.gridLineY(0)).toBeCloseTo(c.plotH(), 9);
  });

  it('treats a category the series does not reach as zero', async () => {
    const { c } = await setup({ categories: CATS, datasets: [{ label: 'Short', data: [10] }] });
    expect(c.cylindricalBars().map((b) => b.value)).toEqual([10, 0, 0]);
  });

  it('draws nothing when either axis has no entries', async () => {
    const { c: noCats } = await setup({ categories: [], datasets: SETS });
    expect(noCats.cylindricalBars()).toEqual([]);
    const { c: noSets } = await setup({ categories: CATS, datasets: [] });
    expect(noSets.cylindricalBars()).toEqual([]);
    expect(noSets.chartIsEmpty()).toBe(true);
  });
});

describe('SvCylindricalColumnChartComponent — shading', () => {
  it('lightens the cap and darkens the foot from the one series colour', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'U', data: [1, 2, 3], color: '#3b82f6' }],
    });
    const bar = c.cylindricalBars()[0];
    expect(bar.color).toBe('#3b82f6');
    // 0x3b=59, 0x82=130, 0xf6=246 mixed 28% toward white / 18% toward black.
    expect(bar.capColor).toBe('rgb(114,165,249)');
    expect(bar.baseColor).toBe('rgb(48,107,202)');
  });

  it('cycles the palette past its end', async () => {
    const nine: BarChartDataset[] = Array.from({ length: 9 }, (_, i) => ({
      label: `S${i}`,
      data: [1],
    }));
    const { c } = await setup({ categories: ['One'], datasets: nine });
    expect(c.seriesColors()[0]).toBe('#3b82f6');
    expect(c.seriesColors()[8]).toBe(c.seriesColors()[0]);
  });
});

describe('SvCylindricalColumnChartComponent — chrome', () => {
  it('describes its own shape', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS, title: 'Shipments' });
    expect(c.resolvedAriaLabel()).toBe('Shipments: 1 series (Units) across 3 categories.');
  });

  it('says "category" for one and omits unlabelled series names', async () => {
    const { c } = await setup({ categories: ['Only'], datasets: [{ label: '', data: [1] }] });
    expect(c.resolvedAriaLabel()).toBe(
      'Cylindrical column chart: 1 series across 1 category.',
    );
  });

  it('falls back to the bare title when there is nothing plotted', async () => {
    const { c } = await setup({ categories: [], datasets: [], title: 'Shipments' });
    expect(c.resolvedAriaLabel()).toBe('Shipments');
  });

  it('prefers an explicit aria-label', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS, ariaLabel: 'Quarterly units' });
    expect(c.resolvedAriaLabel()).toBe('Quarterly units');
  });

  it('emits an animation duration only when one is configured', async () => {
    const { c: none } = await setup({ categories: CATS, datasets: SETS });
    expect(none.animDuration()).toBeNull();
    const { c: set } = await setup({
      categories: CATS, datasets: SETS, options: { animationDuration: 400 },
    });
    expect(set.animDuration()).toBe('400ms');
  });

  it('carries the default toggles and lets each be flipped', async () => {
    const { c: def } = await setup({ categories: CATS, datasets: SETS });
    expect([def.showGrid(), def.showLabels(), def.showLegend(), def.showValues()])
      .toEqual([true, true, true, false]);
    const { c: off } = await setup({
      categories: CATS,
      datasets: SETS,
      options: { showGrid: false, showLabels: false, showLegend: false, showValues: true },
    });
    expect([off.showGrid(), off.showLabels(), off.showLegend(), off.showValues()])
      .toEqual([false, false, false, true]);
  });

  it('formats a compact value and passes a string through', async () => {
    const { c } = await setup({ categories: CATS, datasets: SETS });
    expect(c.formatValue(1_500)).toBe('1.5k');
    expect(c.formatValue('n/a')).toBe('n/a');
  });
});

describe('SvCylindricalColumnChartComponent — tooltip', () => {
  it('names the hovered column and maps the pointer into viewBox space', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    // jsdom reports a zero-size box for everything, so the rect is stubbed; the
    // arithmetic under test is the viewBox scaling, not the measurement.
    pinLayout(host, 600, 320);
    host.querySelector('rect[fill]')!
      .dispatchEvent(new MouseEvent('mouseenter', { clientX: 150, clientY: 120, bubbles: true }));

    expect(c.tooltip().visible).toBe(true);
    expect(c.tooltip().label).toBe('Q1');
    expect(c.tooltip().items).toEqual([{ color: '#3b82f6', series: 'Units', value: 100 }]);
    expect(c.tooltip().x).toBe(150);
    expect(c.tooltip().y).toBe(60);
  });

  it('keeps the tooltip inside the chart on both axes', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    pinLayout(host, 600, 320);
    const rect = host.querySelector('rect[fill]')!;
    rect.dispatchEvent(new MouseEvent('mouseenter', { clientX: 599, clientY: 5, bubbles: true }));
    expect(c.tooltip().x).toBe(600 - 130);
    expect(c.tooltip().y).toBe(8);
  });

  it('hides on leave without discarding its contents', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: SETS });
    pinLayout(host, 600, 320);
    const rect = host.querySelector('rect[fill]')!;
    rect.dispatchEvent(new MouseEvent('mouseenter', { clientX: 150, clientY: 120, bubbles: true }));
    rect.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(c.tooltip().visible).toBe(false);
    expect(c.tooltip().label).toBe('Q1');
  });
});

describe('SvCylindricalColumnChartComponent — values it cannot draw', () => {
  it('marks a negative or missing column as a stub at the baseline, and says so', async () => {
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Units', data: [100, -40, Number.NaN] }],
    });
    const bars = c.cylindricalBars();
    expect(bars.map((b) => b.clamped)).toEqual([false, true, true]);
    expect(bars[1].barH).toBe(3);
    expect(c.axisMax()).toBe(100);
    expect(host.querySelectorAll('[data-sv-clamped]').length).toBe(2);
    expect(host.textContent).toContain('2 bars shown at 0');
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('refuses the dataset under the reject policy', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Units', data: [100, -40, 0] }],
      valuePolicy: 'reject',
    });
    expect(c.resolvedError()).not.toBeNull();
  });
});
