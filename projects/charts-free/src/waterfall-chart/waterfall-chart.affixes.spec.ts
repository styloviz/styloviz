import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import {
  SvWaterfallChartComponent,
  type WaterfallPoint,
} from './waterfall-chart.component';

/**
 * The currency affixes. They are two independent `?? ''` fallbacks applied on
 * three different formatting paths, and the main spec next door exercises only
 * the unconfigured path — so a prefix that reached the axis but not the tooltip
 * would look correct in every screenshot taken of the chart alone.
 */

async function setup(inputs: Partial<ComponentInput<SvWaterfallChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvWaterfallChartComponent, {
    inputs: inputs as ComponentInput<SvWaterfallChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const DATA: WaterfallPoint[] = [
  { label: 'Start', value: 400 },
  { label: 'Costs', value: -200 },
  { label: 'Net', isTotal: true },
];

describe('SvWaterfallChartComponent — value affixes', () => {
  it('wraps a running total in both affixes', async () => {
    const { c } = await setup({ data: DATA, options: { valuePrefix: '$', valueSuffix: ' m' } });
    expect(c.fmtTooltipTotal(1_500)).toBe('$1.5k m');
    // A total bar shows the running figure, not a signed delta.
    expect(c.fmtTooltipDelta({
      visible: true, x: 0, y: 0, label: 'Net', delta: 0, running: 200,
      type: 'total', color: '#000',
    })).toBe('$200 m');
  });

  it('puts the sign OUTSIDE the prefix on a delta', async () => {
    // "+$200", not "$+200" — and the magnitude is unsigned, so the minus is
    // supplied by the sign and never doubled.
    const { c } = await setup({ data: DATA, options: { valuePrefix: '$', valueSuffix: ' m' } });
    const base = { visible: true, x: 0, y: 0, label: 'Costs', running: 200, color: '#000' } as const;
    expect(c.fmtTooltipDelta({ ...base, delta: 200, type: 'increase' })).toBe('+$200 m');
    expect(c.fmtTooltipDelta({ ...base, delta: -200, type: 'decrease' })).toBe('-$200 m');
  });

  it('formats with neither affix when none is configured', async () => {
    const { c } = await setup({ data: DATA });
    expect(c.fmtTooltipTotal(1_500)).toBe('1.5k');
    expect(c.fmtTooltipDelta({
      visible: true, x: 0, y: 0, label: 'Net', delta: 0, running: 200,
      type: 'intermediate', color: '#000',
    })).toBe('200');
  });
});
