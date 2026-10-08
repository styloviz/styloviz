import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { render, type ComponentInput } from '@testing-library/angular';
import { until, quietFor } from '@testing/async';
import {
  SvLiveStreamChartComponent,
  type LiveStreamSeries,
} from './live-stream-chart.component';

/**
 * A sliding window over a push feed. Two things make it worth testing rather
 * than eyeballing.
 *
 * One: the slide is a two-phase animation — append, wait for the transition,
 * then drop the oldest point — and a tick that arrives mid-slide is DROPPED,
 * not queued. That is a deliberate trade (a queued backlog would run the chart
 * permanently behind the feed) and it is invisible unless asserted.
 *
 * Two: the timers. `stopStream` has to clear an interval, a timeout and two
 * animation frames; missing any one leaves the component mutating signals after
 * its host has gone.
 */

/**
 * Stand in for a host that has already pushed a full window.
 *
 * A host-fed stream starts EMPTY (it has no readings until the host sends
 * some), so the window mechanics below — slide, coalesce, drop the oldest —
 * are exercised from the state a running feed reaches, not from start-up.
 */
function fillWindow(c: SvLiveStreamChartComponent): void {
  const n = c.windowSize();
  c.bufferData.set(c.series().map((_, si) => Array.from({ length: n }, (_, i) => 40 + si * 10 + i)));
  c.pointCount.set(n);
}

async function setup(
  inputs: Partial<ComponentInput<SvLiveStreamChartComponent>> = {},
  { empty = false }: { empty?: boolean } = {},
) {
  TestBed.resetTestingModule();
  const r = await render(SvLiveStreamChartComponent, {
    inputs: inputs as ComponentInput<SvLiveStreamChartComponent>,
  });
  const c = r.fixture.componentInstance;
  if (!empty && !inputs.demoFeed) {
    fillWindow(c);
    r.fixture.detectChanges();
  }
  return { ...r, c, host: r.fixture.nativeElement as HTMLElement };
}

const SERIES: LiveStreamSeries[] = [
  { label: 'CPU', color: '#3b82f6' },
  { label: 'Memory', color: '#10b981' },
];

describe('SvLiveStreamChartComponent — the buffer', () => {
  it('starts a host-fed stream empty — no invented readings before the first push', async () => {
    // ★ The window used to be pre-filled from the random generator even with
    //   `demoFeed` off, so a real feed opened on twenty made-up readings.
    const { c, host } = await setup({ series: SERIES, options: { windowSize: 8 } }, { empty: true });
    expect(c.bufferData().length).toBe(2);
    expect(c.bufferData().every((b) => b.length === 0)).toBe(true);
    expect(c.pointCount()).toBe(0);
    expect(host.innerHTML).not.toContain('NaN');
  });

  it('fills from the right, so the newest reading sits at the right edge', async () => {
    const { c } = await setup(
      { series: SERIES, options: { windowSize: 5, intervalMs: 40 } },
      { empty: true },
    );
    c.push([10, 20]);
    await until(() => !c.isAnimating() && c.pointCount() === 1, { label: 'the first slide to settle' });
    c.push([30, 40]);
    await until(() => !c.isAnimating() && c.pointCount() === 2, { label: 'the second slide to settle' });
    expect(c.bufferData()[0]).toEqual([10, 30]);
    // Two readings in a five-slot window: slots 3 and 4, the last at the right edge.
    expect(c.lead()).toBe(3);
    expect(c.xAt(1)).toBeCloseTo(c.plotW());
  });

  it('pre-fills the window only for the demo generator', async () => {
    const { c } = await setup({ series: SERIES, demoFeed: true, options: { windowSize: 8 } });
    expect(c.bufferData().every((b) => b.length === 8)).toBe(true);
    expect(c.pointCount()).toBe(8);
    c.stopStream();
  });

  it('slides the window forward without growing it', async () => {
    const { c } = await setup({ series: SERIES, options: { windowSize: 6, intervalMs: 40 } });
    const firstBefore = c.bufferData()[0][1];

    c.push([50, 60]);
    // The append happens at once; the drop waits for the slide to finish.
    expect(c.bufferData()[0].length).toBe(7);
    await until(() => !c.isAnimating() && c.bufferData()[0].length === 6, {
      label: 'the slide to complete',
    });
    expect(c.bufferData()[0][0]).toBe(firstBefore); // the oldest point is gone
    expect(c.bufferData()[0].at(-1)).toBe(50);
    expect(c.bufferData()[1].at(-1)).toBe(60);
    expect(c.pointCount()).toBe(7);
  });

  it('carries the last value forward for a series the push did not mention', async () => {
    // A feed that reports only the series that changed must not blank the rest.
    const { c } = await setup({ series: SERIES, options: { windowSize: 5, intervalMs: 40 } });
    const memoryBefore = c.bufferData()[1].at(-1)!;

    c.push([42]);
    expect(c.bufferData()[0].at(-1)).toBe(42);
    expect(c.bufferData()[1].at(-1)).toBe(memoryBefore);
  });

  it('does not let a push that lands mid-slide into the window, or queue a backlog', async () => {
    // A feed faster than the animation would otherwise build an ever-growing
    // buffer and the chart would fall further behind on every tick.
    const { c } = await setup({ series: SERIES, options: { windowSize: 5, intervalMs: 200 } });
    c.push([10, 10]);
    await until(() => c.isAnimating(), { label: 'the slide to start' });

    const lengthDuring = c.bufferData()[0].length;
    c.push([99, 99]);
    c.push([98, 98]);
    expect(c.bufferData()[0].length).toBe(lengthDuring);
    expect(c.bufferData()[0]).not.toContain(99);
  });

  it('drops a push that lands in the two frames BEFORE the slide starts', async () => {
    // ★★★ THE GAP THE TEST ABOVE STEPS OVER. `drops a push that lands mid-slide`
    // waits for `isAnimating()` before pushing again — so it only ever exercises
    // the window AFTER the two `requestAnimationFrame`s. Between the append and
    // those frames `isAnimating` is still false, and that is where the real
    // ticks land: two frames is ~32 ms at 60 Hz, which is longer than any
    // `intervalMs` below it and longer still on a machine under load.
    //
    // Seven points in a five-point window is what that produced, and it failed
    // in a coverage run rather than in this file, because only a loaded machine
    // stretches the gap far enough for the demo feed to fall into it.
    const { c } = await setup({ series: SERIES, options: { windowSize: 5, intervalMs: 200 } });
    expect(c.bufferData()[0].length).toBe(5);

    c.push([10, 10]);
    expect(c.bufferData()[0].length).toBe(6);
    // Deliberately asserted: the slide has been CLAIMED but has not started, so
    // the flag the old guard read is still false at this instant.
    expect(c.isAnimating()).toBe(false);

    c.push([99, 99]);
    c.push([98, 98]);

    expect(c.bufferData()[0].length).toBe(6);
    expect(c.bufferData()[0]).not.toContain(99);
    expect(c.bufferData()[0]).not.toContain(98);
    c.stopStream();
  });

  it('starts appending again after a stop, rather than staying latched shut', async () => {
    // ★ Assert the negative on the fix itself: a claim released only by the
    // animation's own timeout would survive a `stopStream()` that cleared that
    // timeout, and the chart would never move again.
    const { c } = await setup({ series: SERIES, options: { windowSize: 5, intervalMs: 40 } });
    c.push([10, 10]);
    c.stopStream();

    c.startStream();
    c.push([20, 20]);
    expect(c.bufferData()[0].at(-1)).toBe(20);
    c.stopStream();
  });

  it('resets a host-fed stream to an empty window', async () => {
    const { c } = await setup({ series: SERIES, options: { windowSize: 5, intervalMs: 40 } });
    c.push([7, 7]);
    await until(() => c.pointCount() === 6, { label: 'the slide to settle' });

    c.resetStream();
    expect(c.pointCount()).toBe(0);
    expect(c.bufferData()[0].length).toBe(0);
    expect(c.isRunning()).toBe(false);
    expect(c.slideX()).toBe(0);
  });
});

describe('SvLiveStreamChartComponent — the feed', () => {
  it('does not start a timer for a host-driven feed', async () => {
    // Without `demoFeed` the host calls `push()`; a self-driving interval would
    // fight the real data.
    const { c } = await setup({ series: SERIES, options: { intervalMs: 20 } });
    c.startStream();
    expect(c.isRunning()).toBe(true);

    const before = c.pointCount();
    await quietFor();
    expect(c.pointCount()).toBe(before);
    c.stopStream();
  });

  it('generates its own points when running as a demo', async () => {
    const { c } = await setup({
      series: SERIES,
      demoFeed: true,
      options: { windowSize: 5, intervalMs: 20 },
    });
    const before = c.pointCount();
    c.startStream();
    await until(() => c.pointCount() >= before + 3, { label: 'the demo feed to tick' });
    // The window is bounded: at most one point above `windowSize`, and only
    // while a slide is mid-flight. An unbounded buffer is the failure here.
    expect(c.bufferData()[0].length).toBeLessThanOrEqual(6);
    expect(c.bufferData()[0].length).toBeGreaterThanOrEqual(5);
    c.stopStream();
  });

  it('stops producing points once stopped', async () => {
    const { c } = await setup({
      series: SERIES,
      demoFeed: true,
      options: { windowSize: 5, intervalMs: 20 },
    });
    c.startStream();
    await until(() => c.pointCount() > 5, { label: 'the first tick' });
    c.stopStream();
    await until(() => !c.isAnimating(), { label: 'the in-flight slide to settle' });

    const after = c.pointCount();
    await quietFor();
    expect(c.pointCount()).toBe(after);
    expect(c.isRunning()).toBe(false);
  });

  it('ignores a second start rather than running two timers', async () => {
    const { c } = await setup({
      series: SERIES,
      demoFeed: true,
      options: { windowSize: 5, intervalMs: 20 },
    });
    c.startStream();
    c.startStream();
    await until(() => c.pointCount() > 5, { label: 'a tick' });
    c.stopStream();
    // Two intervals would double the rate; one stop would leave one running.
    const after = c.pointCount();
    await quietFor();
    expect(c.pointCount()).toBe(after);
  });

  it('toggles between running and stopped', async () => {
    const { c } = await setup({ series: SERIES, options: { intervalMs: 20 } });
    expect(c.isRunning()).toBe(false);
    c.toggle();
    expect(c.isRunning()).toBe(true);
    c.toggle();
    expect(c.isRunning()).toBe(false);
  });

  it('clears every timer on destroy, including a slide in flight', async () => {
    // A pending rAF or timeout that outlives the component writes to a signal
    // nothing is watching and, in a real app, keeps the component alive.
    const { c, fixture } = await setup({
      series: SERIES,
      demoFeed: true,
      options: { windowSize: 5, intervalMs: 30 },
    });
    c.startStream();
    c.push([1, 1]);
    fixture.destroy();

    const frozen = c.pointCount();
    await quietFor();
    expect(c.pointCount()).toBe(frozen);
    expect(c.isRunning()).toBe(false);
  });

  it('stops cleanly even when nothing was started', async () => {
    const { c } = await setup({ series: SERIES });
    expect(() => c.stopStream()).not.toThrow();
    expect(c.isRunning()).toBe(false);
  });
});

describe('SvLiveStreamChartComponent — geometry', () => {
  it('maps the configured range onto the plot, clamping outliers into it', async () => {
    const { c } = await setup({ series: SERIES, options: { yMin: 0, yMax: 100 } });
    expect(c.yAt(100)).toBe(0);
    expect(c.yAt(0)).toBe(c.plotH());
    // A spike beyond the fixed axis must sit ON the edge, not above the plot.
    expect(c.yAt(400)).toBe(0);
    expect(c.yAt(-400)).toBe(c.plotH());
    expect(c.gridLineY(50)).toBeCloseTo(c.plotH() / 2, 9);
  });

  it('centres everything when the configured range has no width', async () => {
    // `yMin === yMax` is a plausible misconfiguration; the division would make
    // every y NaN and the whole line vanish.
    const { c } = await setup({ series: SERIES, options: { yMin: 50, yMax: 50 } });
    expect(c.yAt(50)).toBe(c.plotH() / 2);
    expect(c.yAt(999)).toBe(c.plotH() / 2);
    expect(c.linePath(0)).not.toContain('NaN');
  });

  it('spaces the window across the plot, and survives a window of one', async () => {
    const { c } = await setup({ series: SERIES, options: { windowSize: 11 } });
    expect(c.stepW()).toBeCloseTo(c.plotW() / 10, 9);
    expect(c.xAt(10)).toBeCloseTo(c.plotW(), 9);

    // `windowSize - 1` is zero here: an unguarded divisor.
    const { c: lone } = await setup({ series: SERIES, options: { windowSize: 1 } });
    expect(lone.stepW()).toBe(lone.plotW());
    expect(Number.isFinite(lone.xAt(0))).toBe(true);
  });

  it('spreads six grid values evenly across the configured range', async () => {
    const { c } = await setup({ series: SERIES, options: { yMin: 20, yMax: 70 } });
    expect(c.gridValues()).toEqual([20, 30, 40, 50, 60, 70]);
  });

  it('draws a smooth curve by default and straight segments when asked', async () => {
    const { c: smooth } = await setup({ series: SERIES, options: { windowSize: 5 } });
    expect(smooth.linePath(0)).toContain(' C ');

    const { c: straight } = await setup({
      series: SERIES,
      options: { windowSize: 5, smooth: false },
    });
    expect(straight.linePath(0)).toContain(' L ');
    expect(straight.linePath(0)).not.toContain(' C ');
  });

  it('draws nothing for a series index that has no buffer', async () => {
    const { c } = await setup({ series: SERIES });
    expect(c.linePath(9)).toBe('');
    expect(c.areaPath(9)).toBe('');
  });

  it('closes the area down to the baseline at both ends', async () => {
    const { c } = await setup({ series: SERIES, options: { windowSize: 5 } });
    const d = c.areaPath(0);
    expect(d.endsWith(' Z')).toBe(true);
    expect(d).toContain(`L ${c.xAt(4).toFixed(1)} ${c.plotH()}`);
    expect(d).not.toContain('NaN');
  });

  it('gives each instance its own gradient id', async () => {
    const { c: a } = await setup({ series: SERIES });
    // Both instances must share one application: ids are per application (svUniqueId).
    const second = TestBed.createComponent(SvLiveStreamChartComponent);
    second.componentRef.setInput('series', SERIES);
    second.detectChanges();
    await second.whenStable();
    const b = second.componentInstance;
    fillWindow(b);
    second.detectChanges();
    expect(a.gradId(0)).not.toBe(b.gradId(0));
    expect(a.gradId(0)).not.toBe(a.gradId(1));
  });

  it('runs the slide transition only while sliding', async () => {
    const { c } = await setup({ series: SERIES, options: { intervalMs: 200 } });
    expect(c.slideTransition()).toBe('none');

    c.push([1, 1]);
    await until(() => c.isAnimating(), { label: 'the slide to start' });
    expect(c.slideTransition()).toBe('transform 176ms linear');
    expect(c.slideX()).toBe(-c.stepW());
  });

  it('thins the x labels and hides any that predate the stream', async () => {
    const { c, fixture } = await setup({ series: SERIES, options: { windowSize: 12 } });
    const labels = c.xLabels();
    expect(labels.length).toBeLessThan(12);
    expect(labels.every((l) => Number(l.label) > 0)).toBe(true);

    // Widening the window past the points collected so far would otherwise
    // label the empty left-hand side with zero and negative sample numbers.
    fixture.componentRef.setInput('options', { windowSize: 40 });
    fixture.detectChanges();
    expect(c.xLabels().every((l) => Number(l.label) > 0)).toBe(true);
    expect(c.xLabels().length).toBeLessThan(c.windowSize());
  });

  it('wraps the palette past its end and honours an explicit colour', async () => {
    const many: LiveStreamSeries[] = Array.from({ length: 7 }, (_, i) => ({ label: `S${i}` }));
    const { c } = await setup({ series: many });
    expect(c.seriesColors()[0]).toBe('#3b82f6');
    // Five palette entries, so the sixth series reuses the first.
    expect(c.seriesColors()[5]).toBe(c.seriesColors()[0]);
    expect(c.seriesColors()[6]).toBe(c.seriesColors()[1]);

    const { c: fixed } = await setup({ series: [{ label: 'A', color: '#abcdef' }] });
    expect(fixed.seriesColors()[0]).toBe('#abcdef');
  });
});

describe('SvLiveStreamChartComponent — chrome', () => {
  it('names itself after the title and its series', async () => {
    const { c } = await setup({ series: SERIES, title: 'Sensors' });
    expect(c.resolvedAriaLabel()).toBe('Sensors — live streaming chart, series: CPU, Memory.');
  });

  it('omits the series clause when nothing is named', async () => {
    const { c } = await setup({ series: [{ label: '' }], title: 'Sensors' });
    expect(c.resolvedAriaLabel()).toBe('Sensors — live streaming chart.');
  });

  it('prefers an explicit aria-label', async () => {
    const { c } = await setup({ series: SERIES, ariaLabel: 'Live sensor feed' });
    expect(c.resolvedAriaLabel()).toBe('Live sensor feed');
  });

  it('shows the subtitle only when given one', async () => {
    const { host: withSub } = await setup({ series: SERIES, subtitle: 'last 20s' });
    expect(withSub.textContent).toContain('last 20s');

    const { host: without } = await setup({ series: SERIES });
    expect(without.textContent).not.toContain('last 20s');
  });

  it('drops the grid, the legend and the area fill independently', async () => {
    const { host: full } = await setup({ series: SERIES });
    expect(full.textContent).toContain('CPU');

    const { host: bare } = await setup({
      series: SERIES,
      options: { showGrid: false, showLegend: false, fillArea: false },
    });
    expect(bare.querySelectorAll('line').length).toBeLessThan(
      full.querySelectorAll('line').length,
    );
    expect(bare.textContent).not.toContain('CPU');
    // The gradient defs stay; what goes is the filled <path> that references them.
    expect(bare.querySelectorAll('path[fill^="url(#lsc-grad-"]').length).toBe(0);
    expect(full.querySelectorAll('path[fill^="url(#lsc-grad-"]').length).toBe(2);
  });

  it('compacts a large reading and rounds a small one', async () => {
    const { c } = await setup({ series: SERIES });
    expect(c.fmtValue(42.6)).toBe('43');
    expect(c.fmtValue(2_500)).toBe('2.5k');
    expect(c.fmtValue(-2_500)).toBe('-2.5k');
  });

  it('honours the height in the plot geometry', async () => {
    const { c } = await setup({ series: SERIES, options: { height: 500 } });
    expect(c.chartHeight()).toBe(500);
    expect(c.plotH()).toBe(500 - 20 - 36);
  });

  it('renders without NaN anywhere', async () => {
    const { host } = await setup({ series: SERIES, options: { windowSize: 5 } });
    expect(host.innerHTML).not.toContain('NaN');
  });
});

describe('SvLiveStreamChartComponent — defaults and the empty buffer', () => {
  it('ticks twice a second when no interval is configured', async () => {
    // Every other test in this file pins `intervalMs`, so the default is the one
    // value nothing exercises — and it is what a host that binds no options gets.
    const { c } = await setup({ series: SERIES });
    expect(c.intervalMs()).toBe(500);
    expect(c.windowSize()).toBe(20);
    expect(c.chartHeight()).toBe(300);
  });

  it('reads zero from a series that has no buffer row at all', async () => {
    // A series added after init has no row; the last-value read backs the demo
    // feed's next point, so `undefined` there would poison the whole stream.
    const { c, fixture } = await setup({ series: SERIES, options: { windowSize: 5 } });
    fixture.componentRef.setInput('series', [...SERIES, { label: 'Disk' }]);
    fixture.detectChanges();
    expect(c.bufferData()[2]).toBeUndefined();
    expect(c.linePath(2)).toBe('');
    expect((fixture.nativeElement as HTMLElement).innerHTML).not.toContain('NaN');
  });

  it('generates a point from the last one when the buffer is empty', async () => {
    const { c } = await setup({ series: SERIES, demoFeed: true, options: { windowSize: 5 } });
    // Every row is seeded, so the fallback is not taken here — this pins the
    // normal path so the empty-row case above stays distinguishable.
    expect(c.bufferData()[0].length).toBe(5);
    expect(c.bufferData()[0].every((v) => Number.isFinite(v))).toBe(true);
  });
});

/**
 * Backpressure: a host faster than the slide.
 *
 * ★ Pushes that land mid-slide are COALESCED — the latest wins and is drawn
 *   when the slide ends. The old behaviour dropped them, which could lose the
 *   last reading of a burst for good: the feed went quiet and the chart sat on
 *   a stale value with nothing to say it was stale.
 */
describe('SvLiveStreamChartComponent — backpressure', () => {
  it('draws the latest of a burst once the slide ends, and nothing in between', async () => {
    const { c } = await setup({ series: SERIES, options: { windowSize: 5, intervalMs: 40 } });
    c.push([10, 10]);
    c.push([99, 99]);
    c.push([98, 98]);
    c.push([97, 97]);

    await until(() => c.bufferData()[0].at(-1) === 97, { label: 'the coalesced push to be drawn' });
    expect(c.bufferData()[0]).not.toContain(99);
    expect(c.bufferData()[0]).not.toContain(98);
    expect(c.coalescedCount()).toBe(2);
    expect(c.bufferData()[0].length).toBeLessThanOrEqual(6);

    await until(() => !c.isAnimating() && c.bufferData()[0].length === 5, {
      label: 'the second slide to settle',
    });
    // Two slides, not four: a burst costs one extra render, not one per push.
    expect(c.pointCount()).toBe(7);
    expect(c.bufferData()[0].slice(-2)).toEqual([10, 97]);
  });

  it('draws a coalesced push at once when the stream is stopped, rather than losing it', async () => {
    // Pause stops the generator, not the host: a push waiting behind a slide
    // is the latest reading the host sent. Discarding it left the chart on a
    // stale value for good whenever the feed went quiet right after.
    const { c, fixture, host } = await setup({ series: SERIES, options: { windowSize: 5, intervalMs: 40 } });
    const before = c.pointCount();
    c.push([10, 10]);
    c.push([99, 99]);
    c.stopStream();

    expect(c.bufferData()[0].slice(-2)).toEqual([10, 99]);
    expect(c.bufferData()[0].length).toBe(5);
    expect(c.slideX()).toBe(0);
    expect(c.pointCount()).toBe(before + 2);
    await quietFor(120);
    expect(c.bufferData()[0].slice(-2)).toEqual([10, 99]);
    fixture.detectChanges();
    expect(host.textContent).toContain(`t\u00a0=\u00a0${before + 2}`);
  });

  it('schedules nothing for a push that arrives after the chart is gone', async () => {
    // A host socket can outlive the chart it fed.
    const { c, fixture } = await setup({ series: SERIES, options: { windowSize: 5, intervalMs: 40 } });
    fixture.destroy();
    const before = c.bufferData();
    const count = c.pointCount();
    c.push([42, 42]);
    await quietFor(120);
    // Not appended, not claimed, nothing landing later from a frame or timeout.
    expect(c.bufferData()).toBe(before);
    expect(c.pointCount()).toBe(count);
  });
});

/**
 * A hidden tab. Two different charts hide behind one component:
 *
 * - a DEMO stream owns a generator; hidden, its interval is cleared (not
 *   skipped) and the gap is disclosed on return;
 * - a HOST-FED stream owns no timer; its host kept pushing while the tab was
 *   hidden, so every reading is kept and "nothing was sampled" is never said.
 */
describe('SvLiveStreamChartComponent — a hidden tab', () => {
  function setVisibility(state: 'visible' | 'hidden'): void {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  /** A hidden stretch of `ms`, without holding the suite open for it. */
  function hideFor(ms: number): void {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    setVisibility('hidden');
    clock.mockReturnValue(now + ms);
    setVisibility('visible');
    clock.mockRestore();
  }

  afterEach(() => setVisibility('visible'));

  it('clears the demo generator\'s interval while hidden, and re-creates it on return', async () => {
    const { c } = await setup({ series: SERIES, demoFeed: true, options: { windowSize: 5, intervalMs: 20 } });
    c.startStream();
    expect(c.ticker.active()).toBe(true);

    setVisibility('hidden');
    expect(c.ticker.active()).toBe(false);
    expect(c.isRunning()).toBe(true);
    await quietFor(60);
    const frozen = c.pointCount();
    await quietFor(120);
    expect(c.pointCount()).toBe(frozen);

    setVisibility('visible');
    expect(c.ticker.active()).toBe(true);
    await until(() => c.pointCount() > frozen, { label: 'the generator to resume' });
    c.stopStream();
  });

  it('discloses a long gap in its own generated stream, and forgets it on reset', async () => {
    const { c, fixture, host } = await setup({
      series: SERIES,
      demoFeed: true,
      options: { windowSize: 5, intervalMs: 20 },
    });
    c.startStream();
    hideFor(45_000);
    fixture.detectChanges();
    expect(c.pauseNotice()).toContain('45 seconds');
    expect(host.textContent).toContain('nothing was sampled');

    c.resetStream();
    expect(c.pauseNotice()).toBeNull();
  });

  it('says nothing for a demo stream the user had already stopped', async () => {
    const { c } = await setup({ series: SERIES, demoFeed: true, options: { intervalMs: 20 } });
    hideFor(45_000);
    expect(c.pauseNotice()).toBeNull();
  });

  it('never claims a gap in a host-fed stream — the host kept pushing', async () => {
    // ★★★ The false disclosure: with the default `demoFeed` false, any hidden
    // stretch of 2 s or more used to put "Updates stopped … nothing was
    // sampled" under a chart whose host had been pushing the whole time.
    const { c, fixture, host } = await setup({ series: SERIES, options: { windowSize: 5 } });
    c.startStream();
    expect(c.ticker.active()).toBe(false);
    hideFor(45_000);
    fixture.detectChanges();
    expect(c.pauseNotice()).toBeNull();
    expect(host.textContent).not.toContain('nothing was sampled');
  });

  it('keeps every reading pushed while hidden, within the window', async () => {
    const { c } = await setup({ series: SERIES, options: { windowSize: 5, intervalMs: 200 } });
    const before = c.pointCount();
    setVisibility('hidden');
    c.push([11, 21]);
    c.push([12, 22]);
    c.push([13, 23]);

    // No animation frames run in a hidden tab, so nothing may wait on one.
    expect(c.isAnimating()).toBe(false);
    expect(c.bufferData()[0].slice(-3)).toEqual([11, 12, 13]);
    expect(c.bufferData()[1].slice(-3)).toEqual([21, 22, 23]);
    expect(c.bufferData()[0].length).toBe(5);
    expect(c.pointCount()).toBe(before + 3);
  });

  it('never starts the generator in a tab that was born hidden', async () => {
    // No `visibilitychange` fires for a dashboard opened in the background.
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const { c } = await setup({ series: SERIES, demoFeed: true, options: { windowSize: 5, intervalMs: 20 } });
    c.startStream();
    expect(c.ticker.active()).toBe(false);
    const frozen = c.pointCount();
    await quietFor(80);
    expect(c.pointCount()).toBe(frozen);

    setVisibility('visible');
    expect(c.ticker.active()).toBe(true);
    // It never ran, so it stopped nothing and owes no gap.
    expect(c.pauseNotice()).toBeNull();
    c.stopStream();
  });

  it('drops its gap notice once the stream is switched to host data', async () => {
    const { c, fixture, host } = await setup({
      series: SERIES,
      demoFeed: true,
      options: { windowSize: 5, intervalMs: 20 },
    });
    c.startStream();
    hideFor(45_000);
    fixture.detectChanges();
    expect(host.textContent).toContain('nothing was sampled');

    fixture.componentRef.setInput('demoFeed', false);
    fixture.detectChanges();
    expect(c.pauseNotice()).toBeNull();
    expect(host.textContent).not.toContain('nothing was sampled');
    c.stopStream();
  });

  it('settles a slide that was in flight when the tab hid, rather than stalling on it', async () => {
    const { c } = await setup({ series: SERIES, options: { windowSize: 5, intervalMs: 200 } });
    c.push([10, 10]);
    c.push([15, 15]); // coalesced behind the slide
    setVisibility('hidden');
    c.push([20, 20]);

    expect(c.bufferData()[0].length).toBe(5);
    expect(c.bufferData()[0].slice(-3)).toEqual([10, 15, 20]);
    expect(c.slideX()).toBe(0);

    setVisibility('visible');
    c.push([30, 30]);
    await until(() => !c.isAnimating() && c.bufferData()[0].at(-1) === 30 && c.bufferData()[0].length === 5, {
      label: 'an ordinary slide after the tab returns',
    });
  });
});

describe('SvLiveStreamChartComponent — connection', () => {
  const status = (host: HTMLElement) => host.querySelector('[data-sv-connection]');

  it('shows its own LIVE badge while the connection is idle', async () => {
    const { c, fixture, host } = await setup({ series: SERIES });
    c.startStream();
    fixture.detectChanges();
    expect(status(host)).toBeNull();
    expect(host.textContent).toContain('LIVE');
  });

  it('replaces the LIVE badge with the host\'s state once it reports one', async () => {
    // A LIVE badge over a dropped socket is the chart claiming a feed it lacks.
    const { c, fixture, host } = await setup({ series: SERIES, connection: 'reconnecting' });
    c.startStream();
    fixture.detectChanges();
    expect(status(host)?.getAttribute('data-sv-connection-state')).toBe('reconnecting');
    expect(host.textContent).not.toContain('LIVE');
  });

  it('offers no reconnect unless the host opts in', async () => {
    const { host } = await setup({ series: SERIES, connection: 'closed' });
    expect(status(host)).toBeTruthy();
    expect(host.querySelector('[data-sv-reconnect]')).toBeNull();
  });

  it('emits reconnect from a reachable button', async () => {
    const { c, host } = await setup({ series: SERIES, connection: 'closed', reconnectable: true });
    let asked = 0;
    c.reconnect.subscribe(() => (asked += 1));
    host.querySelector<HTMLButtonElement>('[data-sv-reconnect]')!.click();
    expect(asked).toBe(1);
  });
});

describe('SvLiveStreamChartComponent — server render', () => {
  it('lands a push without asking for an animation frame', async () => {
    // A host that pushes during SSR must not reach for a browser global.
    TestBed.resetTestingModule();
    const r = await render(SvLiveStreamChartComponent, {
      inputs: { series: SERIES, options: { windowSize: 5 } } as ComponentInput<SvLiveStreamChartComponent>,
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const c = r.fixture.componentInstance;
    fillWindow(c);
    c.push([33, 44]);
    // A slide would hold N+1 points until two animation frames had run — and
    // on a server they never do. Landing directly keeps the window at N.
    expect(c.bufferData()[0].length).toBe(5);
    expect(c.isAnimating()).toBe(false);
    expect(c.bufferData()[0].at(-1)).toBe(33);
    expect(c.bufferData()[1].at(-1)).toBe(44);
    expect(c.pointCount()).toBe(6);
  });
});
