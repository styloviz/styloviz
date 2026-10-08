import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SV_OTHER_SHARE_COLOR } from '@styloviz/core';
import { SvDefaultPieChartComponent } from './default-pie-chart.component';
import type { PieSlice } from './pie-chart.types';

/**
 * Every slice is `value / total`, so the whole component turns on what `total`
 * is. Zero — an all-zero dataset, or a dataset filtered down to nothing — makes
 * every angle NaN, and an arc path with NaN in it is dropped by the browser:
 * an empty circle where a chart should be, with no error anywhere.
 *
 * The other theme is the inter-slice gap. It is subtracted from BOTH ends of
 * every arc, so a slice narrower than the gap ends up with a negative span.
 */

async function setup(inputs: Partial<ComponentInput<SvDefaultPieChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvDefaultPieChartComponent, {
    inputs: inputs as ComponentInput<SvDefaultPieChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const SLICES: PieSlice[] = [
  { label: 'Direct', value: 50 },
  { label: 'Search', value: 30 },
  { label: 'Social', value: 20 },
];

describe('SvDefaultPieChartComponent — arcs', () => {
  it('divides the circle in proportion to the values', async () => {
    const { c } = await setup({ slices: SLICES });
    expect(c.total()).toBe(100);
    const arcs = c.arcs();
    expect(arcs.map((a) => a.pct)).toEqual(['50.0%', '30.0%', '20.0%']);
    // Mid-angles land at the centre of each 180° / 108° / 72° wedge.
    expect(arcs.map((a) => a.midAngle)).toEqual([90, 234, 324]);
  });

  it('draws nothing rather than a NaN arc for an all-zero dataset', async () => {
    const { c, host } = await setup({
      slices: [
        { label: 'A', value: 0 },
        { label: 'B', value: 0 },
      ],
    });
    expect(c.total()).toBe(0);
    expect(c.arcs()).toEqual([]);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('reports an empty dataset as empty rather than drawing a blank circle', async () => {
    const { c, host } = await setup({ slices: [] });
    expect(c.chartIsEmpty()).toBe(true);
    expect(c.arcs()).toEqual([]);
    expect(host.querySelector('svg')).toBeNull();
  });

  it('draws a single slice as a visible near-full circle', async () => {
    // 360° start = end is a no-op arc in SVG; the utility nudges it to 359.99.
    const { c, host } = await setup({ slices: [{ label: 'Only', value: 7 }] });
    expect(c.arcs().length).toBe(1);
    expect(c.arcs()[0].pct).toBe('100.0%');
    expect(host.querySelector('path[d]')!.getAttribute('d')).not.toContain('NaN');
  });

  it('collapses a slice narrower than the gap to zero-width, not an inverted span', async () => {
    // A 0.1% slice is thinner than the 1.5° gap taken off each end.
    // `sliceAngles` clamps the gap to the slice's own width, so it collapses
    // to a zero-width arc (start === end) instead of inverting into a span
    // that sweeps the long way around the pie — see `sliceAngles`' doc
    // comment in pie-chart.utils.ts for the mechanism this pins.
    const { c } = await setup({
      slices: [
        { label: 'Big', value: 999 },
        { label: 'Sliver', value: 1 },
      ],
    });
    const sliver = c.arcs()[1];
    expect(sliver.endAngle).toBe(sliver.startAngle);
    expect(sliver.path).not.toContain('NaN');
  });

  it('honours a zero gap, leaving the arcs flush', async () => {
    const { c } = await setup({ slices: SLICES, options: { sliceGap: 0 } });
    const arcs = c.arcs();
    expect(arcs[0].startAngle).toBe(0);
    expect(arcs[0].endAngle).toBe(180);
    expect(arcs[1].startAngle).toBe(180);
  });

  it('staggers the reveal by slice index', async () => {
    const { c } = await setup({ slices: SLICES });
    expect(c.arcs().map((a) => a.delay)).toEqual([0, 60, 120]);
  });

  it('sizes the pie from the size input, leaving a margin for labels', async () => {
    const { c, host } = await setup({ slices: SLICES, size: 400 });
    expect(c.cx()).toBe(200);
    expect(c.cy()).toBe(200);
    expect(c.radius()).toBe(190);
    expect(host.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 400 400');
  });

  it('wraps the palette and honours an explicit slice colour', async () => {
    const many: PieSlice[] = Array.from({ length: 11 }, (_, i) => ({
      label: `S${i}`,
      value: 1,
    }));
    const { c } = await setup({ slices: many });
    expect(c.colors()[10]).toBe(c.colors()[0]);

    const { c: fixed } = await setup({ slices: [{ label: 'A', value: 1, color: '#abcdef' }] });
    expect(fixed.colors()[0]).toBe('#abcdef');
  });
});

describe('SvDefaultPieChartComponent — hover', () => {
  it('explodes only the hovered slice, and only when the option is on', async () => {
    const { c } = await setup({ slices: SLICES });
    expect(c.sliceTransform(0, 90)).toBe('');

    c.hoveredIndex.set(0);
    expect(c.sliceTransform(0, 90)).toBe('translate(10.00, 0.00)');
    expect(c.sliceTransform(1, 234)).toBe(''); // a different slice stays put

    const { c: still } = await setup({ slices: SLICES, options: { explodeOnHover: false } });
    still.hoveredIndex.set(0);
    expect(still.sliceTransform(0, 90)).toBe('');
  });

  it('honours a custom explode distance', async () => {
    const { c } = await setup({ slices: SLICES, options: { explodeOffset: 25 } });
    c.hoveredIndex.set(0);
    expect(c.sliceTransform(0, 90)).toBe('translate(25.00, 0.00)');
  });

  it('fills the tooltip from the hovered arc and clamps it inside the box', async () => {
    const { c, host } = await setup({ slices: SLICES, size: 260 });
    const svg = host.querySelector('svg')!;
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 260, height: 260, right: 260, bottom: 260, x: 0, y: 0 }) as DOMRect;
    const arcs = host.querySelectorAll('path[d]');

    arcs[1].dispatchEvent(new MouseEvent('mouseenter', { clientX: 60, clientY: 100, bubbles: true }));
    expect(c.hoveredIndex()).toBe(1);
    expect(c.tooltip().visible).toBe(true);
    expect(c.tooltip().label).toBe('Search');
    expect(c.tooltip().value).toBe(30);
    expect(c.tooltip().pct).toBe('30.0%');
    expect(c.tooltip().x).toBe(72);
    expect(c.tooltip().y).toBe(44);

    // Bottom-right corner: both coordinates must clamp back inside.
    arcs[1].dispatchEvent(new MouseEvent('mouseenter', { clientX: 259, clientY: 0, bubbles: true }));
    expect(c.tooltip().x).toBe(260 - 130);
    expect(c.tooltip().y).toBe(4);
  });

  it('still tracks the hovered slice when the tooltip is switched off', async () => {
    // The explode effect is driven by `hoveredIndex`, so it must be set before
    // the early return, not after it.
    const { c, host } = await setup({ slices: SLICES, options: { showTooltip: false } });
    host
      .querySelectorAll('path[d]')[2]
      .dispatchEvent(new MouseEvent('mouseenter', { clientX: 10, clientY: 10, bubbles: true }));

    expect(c.hoveredIndex()).toBe(2);
    expect(c.tooltip().visible).toBe(false);
  });

  it('clears the hover on leave', async () => {
    const { c } = await setup({ slices: SLICES });
    c.hoveredIndex.set(1);
    c.onSliceLeave();
    expect(c.hoveredIndex()).toBe(-1);
    expect(c.tooltip().visible).toBe(false);
  });

  it('emits the clicked slice, and nothing for an index that is not there', async () => {
    const { c } = await setup({ slices: SLICES });
    const picked: PieSlice[] = [];
    c.sliceSelect.subscribe((s) => picked.push(s));

    c.onSliceClick(1);
    expect(picked).toEqual([{ label: 'Search', value: 30 }]);

    // A stale index after the data shrank must not emit `undefined`.
    c.onSliceClick(9);
    expect(picked.length).toBe(1);
  });
});

describe('SvDefaultPieChartComponent — chrome', () => {
  it('describes itself by title and slice shares', async () => {
    const { c } = await setup({ slices: SLICES, title: 'Traffic' });
    expect(c.chartDescription()).toBe(
      'Traffic: Direct 50.0%, Search 30.0%, Social 20.0%.',
    );
    expect(c.resolvedAriaLabel()).toBe(c.chartDescription());
  });

  it('falls back to the bare title when there is nothing to describe', async () => {
    const { c: empty } = await setup({ slices: [], title: 'Traffic' });
    expect(empty.chartDescription()).toBe('Traffic');

    // A dataset that sums to zero has slices but no shares to quote.
    const { c: zeros } = await setup({ slices: [{ label: 'A', value: 0 }] });
    expect(zeros.chartDescription()).toBe('Pie chart');
  });

  it('prefers an explicit aria-label', async () => {
    const { c } = await setup({ slices: SLICES, ariaLabel: 'Traffic sources' });
    expect(c.resolvedAriaLabel()).toBe('Traffic sources');
  });

  it('reads a share as zero rather than NaN when nothing was measured', async () => {
    const { c } = await setup({ slices: [{ label: 'A', value: 0 }] });
    expect(c.pct(0)).toBe('0%');
  });

  it('shows the legend by default and hides it on request', async () => {
    const { host: on } = await setup({ slices: SLICES });
    expect(on.textContent).toContain('Direct');

    const { host: off } = await setup({ slices: SLICES, options: { showLegend: false } });
    // The name survives in the screen-reader table, so this is scoped to the
    // visible legend list.
    expect(off.querySelector('ul, [role="list"]')).toBeNull();
    expect(on.querySelectorAll('button').length).toBe(3);
    expect(off.querySelectorAll('button').length).toBe(0);
  });

  it('publishes the animation duration only when configured', async () => {
    const { c: timed } = await setup({ slices: SLICES, options: { animationDuration: 750 } });
    expect(timed.animDuration()).toBe('750ms');

    const { c: dflt } = await setup({ slices: SLICES });
    expect(dflt.animDuration()).toBeNull();
  });

  it('compacts large slice values in the legend', async () => {
    const { c } = await setup({ slices: SLICES });
    expect(c.fmt(950)).toBe('950');
    expect(c.fmt(2_500)).toBe('2.5k');
    expect(c.fmt(3_400_000)).toBe('3.4M');
  });

  it('tracks legend rows by label so a value change patches rather than rebuilds', async () => {
    const { c } = await setup({ slices: SLICES });
    expect(c.trackByLabel(0, SLICES[0])).toBe('Direct');
  });

  it('adds the custom class to the root', async () => {
    const { host } = await setup({ slices: SLICES, customClass: 'my-pie' });
    expect(host.querySelector('.my-pie')).toBeTruthy();
  });
});

/**
 * ★★ The long tail, folded (CH-10-M1). The fold notice tells the reader "the
 *    summary table lists them separately"; the table used to be built from the
 *    drawn slices and showed one `Other` row, so the sentence pointed at detail
 *    that was not there. And `Other` came out in the first folded slice's
 *    colour, which drew one real category twice.
 */
describe('SvDefaultPieChartComponent — the folded long tail', () => {
  const TAIL: PieSlice[] = [
    { label: 'A', value: 50, color: '#6366f1' },
    { label: 'B', value: 30 },
    { label: 'C', value: 12 },
    { label: 'D', value: 3, color: '#ff0000' },
    { label: 'E', value: 2 },
    { label: 'F', value: 2 },
    { label: 'G', value: 1 },
  ];

  const grid = (host: HTMLElement) =>
    [...(host.querySelector('sv-data-summary-table table')?.querySelectorAll('tbody tr') ?? [])].map(
      (tr) => [...tr.children].map((cell) => cell.textContent?.trim() ?? ''),
    );
  const notice = (host: HTMLElement) =>
    host.querySelector('[data-sv-notice]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('folds the tail into one drawn slice and says the table lists them', async () => {
    const { c, host } = await setup({ slices: TAIL, options: { groupBelow: 0.05 } });
    expect(c.arcs().map((a) => a.label)).toEqual(['A', 'B', 'C', 'Other']);
    // ★ The notice is visible and the table is not (it is clipped for assistive
    //   technology), so the sentence names the folded slices itself and says who
    //   the table is for, rather than sending a sighted reader to look for it.
    expect(notice(host)).toContain('combined into “Other”, 8% of the total: D, E, F and G.');
    expect(notice(host)).toContain('The summary table for screen readers lists each one\'s value separately');
  });

  it('makes that true: every folded slice has its own row under Other', async () => {
    const { host } = await setup({ slices: TAIL, options: { groupBelow: 0.05 } });
    expect(grid(host)).toEqual([
      ['A', '50', '50.0%'],
      ['B', '30', '30.0%'],
      ['C', '12', '12.0%'],
      ['Other (4 combined)', '8', '8.0%'],
      ['D (in Other)', '3', '3.0%'],
      ['E (in Other)', '2', '2.0%'],
      ['F (in Other)', '2', '2.0%'],
      ['G (in Other)', '1', '1.0%'],
    ]);
  });

  it('draws Other in a neutral colour, not the first folded slice\'s', async () => {
    const { c } = await setup({ slices: TAIL, options: { groupBelow: 0.05 } });
    const other = c.arcs()[c.arcs().length - 1];
    expect(other.color).toBe(SV_OTHER_SHARE_COLOR);
    expect(other.color).not.toBe('#ff0000');
  });

  it('paints that neutral on the drawn Other arc, in the DOM', async () => {
    const { host } = await setup({ slices: TAIL, options: { groupBelow: 0.05 } });
    const fills = [...host.querySelectorAll('svg path[fill]')].map((p) => p.getAttribute('fill'));
    expect(fills).toContain(SV_OTHER_SHARE_COLOR);
    expect(fills.filter((f) => f === '#ff0000')).toEqual([]);
  });

  it('never draws a host "Other" and the fold under one label (NG0955)', async () => {
    const spies = [vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')].map((s) =>
      s.mockImplementation(() => undefined),
    );
    try {
      const { c } = await setup({
        slices: [
          { label: 'A', value: 80 },
          { label: 'Other', value: 10 },
          { label: 'B', value: 4 },
          { label: 'C', value: 6 },
        ],
        options: { groupBelow: 0.07 },
      });
      expect(c.arcs().map((a) => a.label)).toEqual(['A', 'Other', 'Other — small slices']);
      const logged = spies.flatMap((s) => s.mock.calls.map((call) => String(call[0])));
      expect(logged.filter((line) => line.includes('NG0955'))).toEqual([]);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it('renders duplicate host labels without a repeated table key', async () => {
    const { host } = await setup({
      slices: [{ label: 'Direct', value: 60 }, { label: 'Direct', value: 40 }],
    });
    expect(grid(host).map((row) => row[0])).toEqual(['Direct', 'Direct']);
  });

  it('lists only the drawn slices when nothing is folded', async () => {
    const { host } = await setup({ slices: TAIL });
    expect(grid(host).map((row) => row[0])).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });
});

/**
 * ★ `clamp` is not offered on a share chart (X-7): a clamped slice is a 0° arc
 *   with nothing to mark, and the notice used to say "Marked in the plot."
 */
describe('SvDefaultPieChartComponent — clamp', () => {
  it('falls back to omit and never claims a marker', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { c, host } = await setup({
        slices: [{ label: 'A', value: 10 }, { label: 'B', value: -5 }],
        valuePolicy: 'clamp',
      });
      expect(c.arcs().map((a) => a.label)).toEqual(['A']);
      const text = host.querySelector('[data-sv-notice]')?.textContent ?? '';
      expect(text).toContain('1 slice not shown');
      expect(text).not.toContain('Marked in the plot');
    } finally {
      warn.mockRestore();
    }
  });
});
