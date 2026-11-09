import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { until, quietFor } from '@testing/async';
import { SvLiveStreamChartComponent, type LiveStreamSeries } from './live-stream-chart.component';

/**
 * FL-J3-CH-01 · X-10 / CH-07-M6 — the live chart under a reader's motion
 * preference and behind a hidden tab.
 *
 * - Reduced motion: the window glides by an INLINE `transform` transition,
 *   which no `motion-reduce:` class can beat. Under the preference it steps —
 *   the slide still happens (the data must move on), with no transition.
 * - Hidden tab: the visibility pause stops the demo generator outright (its
 *   interval is cleared, not skipped), so a background dashboard draws nothing.
 */
const SERIES: LiveStreamSeries[] = [{ label: 'CPU' }, { label: 'Memory' }];

function stubReducedMotion(reduce: boolean): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => { window.matchMedia = original; };
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function setup(inputs: Partial<ComponentInput<SvLiveStreamChartComponent>>) {
  TestBed.resetTestingModule();
  const r = await render(SvLiveStreamChartComponent, { inputs: inputs as ComponentInput<SvLiveStreamChartComponent> });
  const c = r.fixture.componentInstance;
  return { ...r, c };
}

function fill(c: SvLiveStreamChartComponent): void {
  const n = c.windowSize();
  c.bufferData.set(c.series().map((_, si) => Array.from({ length: n }, (_, i) => 40 + si + i)));
  c.pointCount.set(n);
}

describe('SvLiveStreamChartComponent — reduced motion (FL-J3-CH-01)', () => {
  let restore: () => void = () => undefined;
  afterEach(() => { restore(); restore = () => undefined; });

  it('glides the window by a transform transition by default', async () => {
    restore = stubReducedMotion(false);
    const { c } = await setup({ series: SERIES, options: { windowSize: 5, intervalMs: 400 } });
    fill(c);
    c.push([50, 60]);
    await until(() => c.isAnimating(), { label: 'the slide to start' });
    expect(c.slideTransition()).toMatch(/^transform \d+ms linear$/);
    c.stopStream();
  });

  it('steps the window with no transition under prefers-reduced-motion', async () => {
    restore = stubReducedMotion(true);
    const { c, fixture } = await setup({ series: SERIES, options: { windowSize: 5, intervalMs: 400 } });
    fill(c);
    c.push([50, 60]);
    await until(() => c.isAnimating(), { label: 'the slide to start' });
    expect(c.slideTransition()).toBe('none');
    fixture.detectChanges();
    const g = (fixture.nativeElement as HTMLElement).querySelector<SVGGElement>('g[transform^="translate"]');
    expect(g).not.toBeNull();
    expect(g?.style.transition ?? '').not.toContain('linear');
    // The data still moves on: the reading lands.
    await until(() => c.bufferData()[0].at(-1) === 50 && !c.isAnimating(), { label: 'the step to land' });
    c.stopStream();
  });

  it('stills the live badge pulse under reduced motion', async () => {
    const { c, fixture } = await setup({ series: SERIES, demoFeed: true, options: { intervalMs: 1000 } });
    c.startStream();
    fixture.detectChanges();
    const dot = (fixture.nativeElement as HTMLElement).querySelector('.animate-pulse');
    expect(dot?.classList.contains('motion-reduce:animate-none')).toBe(true);
    c.stopStream();
  });
});

describe('SvLiveStreamChartComponent — visibility pause stops the chart (FL-J3-CH-01)', () => {
  afterEach(() => setVisibility('visible'));

  it('stops the generator while hidden — no interval, no new points — and resumes on return', async () => {
    const { c } = await setup({ series: SERIES, demoFeed: true, options: { windowSize: 5, intervalMs: 20 } });
    c.startStream();
    expect(c.ticker.active()).toBe(true);

    setVisibility('hidden');
    expect(c.visibility.paused()).toBe(true);
    expect(c.ticker.active()).toBe(false);
    await quietFor(40);
    const frozen = c.pointCount();
    await quietFor(120);
    expect(c.pointCount()).toBe(frozen);
    expect(c.isAnimating()).toBe(false);

    setVisibility('visible');
    expect(c.ticker.active()).toBe(true);
    await until(() => c.pointCount() > frozen, { label: 'the generator to resume' });
    c.stopStream();
  });
});
