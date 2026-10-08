import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvColumnDrilldownChartComponent } from './column-drilldown-chart.component';
// ★ Re-exported from the types module, not the component file — the component
// imports it too. `typecheck:all` (ngc) catches this; Vitest transpiles without
// type checking, so the spec ran green while the build would not have.
import type { DrilldownDataset } from './bar-chart.types';

/**
 * A stack of navigation levels rendered as a bar chart. The chart's own data is
 * only the ROOT: everything below it comes off the stack, so every derived
 * signal has to read the top of the stack rather than the inputs. A single one
 * that forgets — the axis, the colours, the breadcrumbs — shows the wrong
 * level's data without any error.
 */

async function setup(inputs: Partial<ComponentInput<SvColumnDrilldownChartComponent>> = {}) {
  TestBed.resetTestingModule();
  const r = await render(SvColumnDrilldownChartComponent, {
    inputs: inputs as ComponentInput<SvColumnDrilldownChartComponent>,
  });
  return { ...r, c: r.fixture.componentInstance, host: r.fixture.nativeElement as HTMLElement };
}

const CATS = ['Chrome', 'Safari', 'Firefox'];
const DATA: DrilldownDataset[] = [
  {
    label: 'Share',
    data: [60, 25, 15],
    drilldown: {
      Chrome: {
        title: 'Chrome versions',
        categories: ['v120', 'v119'],
        datasets: [{ label: 'Share', data: [40, 20], color: '#ff0000' }],
      },
    },
  },
];

describe('SvColumnDrilldownChartComponent — navigation', () => {
  it('starts on the root level with no way back', async () => {
    const { c } = await setup({ categories: CATS, datasets: DATA });
    expect(c.canDrillBack()).toBe(false);
    expect(c.breadcrumbs()).toEqual(['Root']);
    expect(c.displayCategories()).toEqual(CATS);
    expect(c.displayDatasets()).toEqual(DATA);
  });

  it('swaps in the child level, its categories and its colours on drill down', async () => {
    const { c } = await setup({ categories: CATS, datasets: DATA, rootTitle: 'Browsers' });
    const chrome = c.bars().find((b) => b.cat === 'Chrome')!;
    expect(chrome.hasDrilldown).toBe(true);

    c.drillDown(chrome);
    expect(c.canDrillBack()).toBe(true);
    expect(c.breadcrumbs()).toEqual(['Browsers', 'Chrome versions']);
    expect(c.displayCategories()).toEqual(['v120', 'v119']);
    // Every derived signal must follow the level, not the inputs.
    expect(c.seriesColors()).toEqual(['#ff0000']);
    expect(c.axisMax()).toBe(40);
    expect(c.bars().map((b) => b.value)).toEqual([40, 20]);
  });

  it('does nothing when the bar has no child level', async () => {
    const { c } = await setup({ categories: CATS, datasets: DATA });
    const safari = c.bars().find((b) => b.cat === 'Safari')!;
    expect(safari.hasDrilldown).toBe(false);

    c.drillDown(safari);
    expect(c.canDrillBack()).toBe(false);
    expect(c.displayCategories()).toEqual(CATS);
  });

  it('hides the tooltip on the way down so it does not describe the old level', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: DATA });
    const svg = host.querySelector('svg')!;
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 600, height: 320, right: 600, bottom: 320, x: 0, y: 0 }) as DOMRect;
    host
      .querySelector('path[d]')!
      .dispatchEvent(new MouseEvent('mouseenter', { clientX: 50, clientY: 50, bubbles: true }));
    expect(c.tooltip().visible).toBe(true);

    const chrome = c.bars().find((b) => b.cat === 'Chrome')!;

    c.drillDown(chrome);
    expect(c.tooltip().visible).toBe(false);
  });

  it('returns to the level above, and stays put at the root', async () => {
    const { c } = await setup({ categories: CATS, datasets: DATA });
    c.drillDown(c.bars().find((b) => b.cat === 'Chrome')!);
    c.drillBack();
    expect(c.canDrillBack()).toBe(false);
    expect(c.displayCategories()).toEqual(CATS);

    // Already at the root — popping an empty stack must be a no-op.
    c.drillBack();
    expect(c.breadcrumbs()).toEqual(['Root']);
    expect(c.displayCategories()).toEqual(CATS);
  });

  it('shows a placeholder crumb for a level that did not name itself', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [
        {
          label: 'Share',
          data: [60, 25, 15],
          drilldown: {
            Chrome: { categories: ['v120'], datasets: [{ label: 'Share', data: [40] }] },
          },
        },
      ],
    });
    c.drillDown(c.bars()[0]);
    expect(c.breadcrumbs()).toEqual(['Root', '…']);
  });
});

describe('SvColumnDrilldownChartComponent — geometry', () => {
  it('draws nothing when there is no grid to draw on', async () => {
    const { c: noCats } = await setup({ categories: [], datasets: DATA });
    expect(noCats.bars()).toEqual([]);

    const { c: noSets } = await setup({ categories: CATS, datasets: [] });
    expect(noSets.bars()).toEqual([]);
    expect(noSets.chartIsEmpty()).toBe(true);
  });

  it('gives an all-zero level a real axis rather than a zero divisor', async () => {
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ label: 'Idle', data: [0, 0, 0] }],
    });
    expect(c.axisMax()).toBe(1);
    expect(c.bars().every((b) => Number.isFinite(b.y))).toBe(true);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('reads a category past the end of the data as zero', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Partial', data: [60] }],
    });
    expect(c.bars().map((b) => b.value)).toEqual([60, 0, 0]);
  });

  it('drops a zero-height bar rather than emitting a malformed path', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Mixed', data: [60, 0, 15] }],
    });
    const [, zero] = c.bars();
    expect(c.barPath(zero)).toBe('');
    expect(c.barPath(c.bars()[0])).toContain('M ');
  });

  it('clamps the corner radius to the bar', async () => {
    const { c } = await setup({
      categories: CATS,
      datasets: [{ label: 'Tiny', data: [60, 25, 1] }],
      options: { barRadius: 40 },
    });
    const tiny = c.bars()[2];
    expect(c.barPath(tiny)).not.toContain('NaN');
    expect(c.barPath(tiny).startsWith(`M ${tiny.x + Math.min(tiny.barW / 2, tiny.barH / 2)} `)).toBe(true);
  });

  it('maps grid values top to bottom and centres each category tick', async () => {
    const { c } = await setup({ categories: CATS, datasets: DATA });
    expect(c.gridY(c.axisMax())).toBe(0);
    expect(c.gridY(0)).toBe(c.plotH());
    expect(c.gridLineX(0)).toBeCloseTo(c.plotW() / 6, 9);
    expect(c.gridLineX(2)).toBeCloseTo((c.plotW() * 5) / 6, 9);
  });

  it('wraps the palette and honours an explicit dataset colour', async () => {
    const many: DrilldownDataset[] = Array.from({ length: 9 }, (_, i) => ({
      label: `S${i}`,
      data: [i],
    }));
    const { c } = await setup({ categories: ['A'], datasets: many });
    expect(c.seriesColors()[8]).toBe(c.seriesColors()[0]);
  });

  it('passes strings through the formatter and compacts numbers', async () => {
    const { c } = await setup({ categories: CATS, datasets: DATA });
    expect(c.formatValue('Chrome')).toBe('Chrome');
    expect(c.formatValue(24_000)).toBe('24k');
  });
});

describe('SvColumnDrilldownChartComponent — chrome', () => {
  it('positions the tooltip from the pointer and clamps it inside the chart', async () => {
    const { c, host } = await setup({ categories: CATS, datasets: DATA });
    const svg = host.querySelector('svg')!;
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 600, height: 320, right: 600, bottom: 320, x: 0, y: 0 }) as DOMRect;
    const bar = host.querySelector('path[d]')!;

    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 100, clientY: 200, bubbles: true }));
    expect(c.tooltip().label).toBe('Chrome');
    expect(c.tooltip().items).toEqual([
      { color: c.seriesColors()[0], series: 'Share', value: 60 },
    ]);
    expect(c.tooltip().x).toBe(100);
    expect(c.tooltip().y).toBe(130);

    bar.dispatchEvent(new MouseEvent('mouseenter', { clientX: 599, clientY: 0, bubbles: true }));
    expect(c.tooltip().x).toBe(600 - 145);
    expect(c.tooltip().y).toBe(8);

    c.hideTooltip();
    expect(c.tooltip().visible).toBe(false);
  });

  it('describes itself by title, series and category count', async () => {
    const { c } = await setup({ categories: CATS, datasets: DATA, title: 'Browsers' });
    expect(c.resolvedAriaLabel()).toBe('Browsers: 1 series (Share) across 3 categories.');

    const { c: one } = await setup({ categories: ['A'], datasets: [{ label: 'S', data: [1] }] });
    expect(one.resolvedAriaLabel()).toContain('across 1 category.');

    const { c: bare } = await setup({ categories: [], datasets: DATA });
    expect(bare.resolvedAriaLabel()).toBe('Column drilldown chart');

    const { c: unnamed } = await setup({
      categories: CATS,
      datasets: [{ label: '', data: [1, 2, 3] }],
    });
    expect(unnamed.resolvedAriaLabel()).toBe('Column drilldown chart: 1 series across 3 categories.');

    const { c: override } = await setup({
      categories: CATS,
      datasets: DATA,
      ariaLabel: 'Browser market share',
    });
    expect(override.resolvedAriaLabel()).toBe('Browser market share');
  });

  it('drops the grid, labels, legend and values independently', async () => {
    const { host: on } = await setup({
      categories: CATS,
      datasets: DATA,
      options: { showValues: true },
    });
    expect(on.querySelector('svg')!.textContent).toContain('60');

    const { host: off } = await setup({
      categories: CATS,
      datasets: DATA,
      options: { showGrid: false, showLabels: false, showLegend: false, showValues: false },
    });
    expect(off.querySelectorAll('line').length).toBeLessThan(on.querySelectorAll('line').length);
    expect(off.querySelector('svg')!.textContent).not.toContain('60');
  });

  it('publishes the animation duration only when configured', async () => {
    const { c: timed } = await setup({
      categories: CATS,
      datasets: DATA,
      options: { animationDuration: 800 },
    });
    expect(timed.animDuration()).toBe('800ms');

    const { c: dflt } = await setup({ categories: CATS, datasets: DATA });
    expect(dflt.animDuration()).toBeNull();
  });

  it('honours the height and the custom class', async () => {
    const { c, host } = await setup({
      categories: CATS,
      datasets: DATA,
      height: 500,
      customClass: 'my-drill',
    });
    expect(c.plotH()).toBe(500 - 16 - 40);
    expect(host.querySelector('.my-drill')).toBeTruthy();
  });

  /**
   * The chart shipped a keyboard-reachable *back* button and no way to drill IN,
   * so a keyboard user could leave a level they could never enter. These guard
   * the wiring; `e2e/chart-keyboard.spec.ts` proves the browser honours it.
   */
  describe('keyboard operability', () => {
    it('makes only drillable columns focusable', async () => {
      const { host } = await setup({ categories: CATS, datasets: DATA });
      const columns = Array.from(host.querySelectorAll('g[class*="cursor-"]'));
      expect(columns.length).toBe(3);

      const focusable = columns.filter((g) => g.getAttribute('tabindex') === '0');
      expect(focusable.length).toBe(1);
      expect(focusable[0].getAttribute('role')).toBe('button');
      expect(focusable[0].getAttribute('aria-label')).toMatch(/Drill down into Chrome/);

      // Safari and Firefox are leaves — a tab stop there would do nothing.
      for (const g of columns.filter((x) => !focusable.includes(x))) {
        expect(g.getAttribute('tabindex')).toBeNull();
        expect(g.getAttribute('role')).toBeNull();
      }
    });

    it('drills in on Enter and Space, and ignores keys on a leaf', async () => {
      const { c } = await setup({ categories: CATS, datasets: DATA });
      const chrome = c.bars().find((b) => b.cat === 'Chrome')!;
      const safari = c.bars().find((b) => b.cat === 'Safari')!;

      const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      c.onBarKey(enter, chrome);
      expect(c.canDrillBack()).toBe(true);
      // Space would otherwise page down the scroll container the chart sits in.
      expect(enter.defaultPrevented).toBe(true);

      c.drillBack();
      const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
      c.onBarKey(space, chrome);
      expect(c.canDrillBack()).toBe(true);

      c.drillBack();
      const onLeaf = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      c.onBarKey(onLeaf, safari);
      expect(c.canDrillBack()).toBe(false);
      expect(onLeaf.defaultPrevented).toBe(false);
    });

    it('names the datum on focus and positions the tooltip without a pointer', async () => {
      const { c } = await setup({ categories: CATS, datasets: DATA });
      const chrome = c.bars().find((b) => b.cat === 'Chrome')!;
      const safari = c.bars().find((b) => b.cat === 'Safari')!;

      expect(c.barAriaLabel(chrome)).toBe('Share, Chrome: 60. Drill down into Chrome');
      expect(c.barAriaLabel(safari)).toBe('Share, Safari: 25');

      c.focusTooltip(chrome);
      const t = c.tooltip();
      expect(t.visible).toBe(true);
      expect(t.label).toBe('Chrome');
      expect(t.items).toEqual([{ color: chrome.color, series: 'Share', value: 60 }]);
      // On the canvas, and clear of the top edge the bar's own y would breach.
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThanOrEqual(c.SVG_WIDTH - 145);
      expect(t.y).toBeGreaterThanOrEqual(8);
    });
  });
});

describe('SvColumnDrilldownChartComponent — values it cannot draw', () => {
  it('draws a negative drillable column as a marked stub, still reachable, and says so', async () => {
    // `@if (bar.barH > 0)` used to hide a negative column outright — and with
    // it the only way into its drilldown.
    const { c, host } = await setup({
      categories: CATS,
      datasets: [{ ...DATA[0], data: [-10, 25, Number.NaN] }],
    });
    const bars = c.bars();
    expect(bars.map((b) => b.clamped)).toEqual([true, false, true]);
    expect(c.axisMax()).toBe(30);
    const stub = host.querySelector('[data-sv-clamped][role="button"]');
    expect(stub?.getAttribute('aria-label')).toContain('not drawn to scale');
    expect(host.textContent).toContain('2 bars shown at 0');
    expect(host.innerHTML).not.toContain('NaN');
  });
});
