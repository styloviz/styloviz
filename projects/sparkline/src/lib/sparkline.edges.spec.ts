import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvSparklineComponent } from './sparkline.component';

/**
 * The series shapes the main spec does not reach: the one-point bar chart (a
 * legal series that produces *no* line points), a series starting at zero (no
 * percentage change is definable), and fractional values (which must not be
 * read out at full float precision).
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSparklineComponent, { inputs });
  return fixture;
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const svg = (f: { nativeElement: unknown }) => el(f).querySelector('svg')!;

/**
 * The marker and label computeds are `protected` — the template is their only
 * caller. Reading them through a cast is how their *guard* behaviour gets
 * pinned; see the note on the empty-series test below.
 */
interface Internals {
  lastPoint(): unknown;
  minPoint(): unknown;
  maxPoint(): unknown;
  label(): string;
}
const inner = (f: { componentInstance: unknown }) =>
  f.componentInstance as unknown as Internals;

describe('SvSparklineComponent — a series with a single point', () => {
  /**
   * A bar chart draws one bar from one value, so this is not the empty state —
   * but `pointsOf` needs two values to project a line, so the point list is
   * empty while the chart is not. Every marker has to cope with that
   * combination rather than dereferencing `points()[0]`.
   */
  it('draws the bar but marks nothing', async () => {
    const f = await setup({ variant: 'bar', data: [7], showLast: true, showExtremes: true });

    expect(svg(f).querySelectorAll('rect')).toHaveLength(1);
    expect(svg(f).querySelectorAll('circle')).toHaveLength(0);

    expect(inner(f).lastPoint()).toBeNull();
    expect(inner(f).minPoint()).toBeNull();
    expect(inner(f).maxPoint()).toBeNull();
  });

  it('still describes the single-point series', async () => {
    const f = await setup({ variant: 'bar', data: [7] });
    // Singular. It used to read "1 points" — the count was interpolated with a
    // hardcoded plural.
    expect(svg(f).getAttribute('aria-label')).toContain('1 point,');
    expect(svg(f).getAttribute('aria-label')).toContain('trending flat');
  });

  /** A line variant with one point IS the empty state — no svg at all. */
  it('is empty, not single-pointed, in the line variant', async () => {
    const f = await setup({ variant: 'line', data: [7] });
    expect(el(f).querySelector('svg')).toBeNull();
  });
});

describe('SvSparklineComponent — the accessible label', () => {
  /**
   * `changePct` is undefined when the series starts at zero — a rise from
   * nothing is not a percentage. The label has to fall back to the bare
   * direction rather than printing "up Infinity%" or "up NaN%".
   */
  it('gives the direction without a percentage when the series starts at zero', async () => {
    const f = await setup({ data: [0, 5, 9] });
    const label = svg(f).getAttribute('aria-label') ?? '';
    expect(label).toContain('trending up,');
    expect(label).not.toMatch(/Infinity|NaN|%/);
  });

  it('gives direction and percentage when there is a base to divide by', async () => {
    const f = await setup({ data: [10, 15] });
    expect(svg(f).getAttribute('aria-label')).toContain('up 50.0%');
  });

  /** A fall is announced with its magnitude, not a negative percentage. */
  it('announces the size of a fall, not a signed percentage', async () => {
    const f = await setup({ data: [10, 5] });
    const label = svg(f).getAttribute('aria-label') ?? '';
    expect(label).toContain('down 50.0%');
    expect(label).not.toContain('-50');
  });

  /** Float noise, read aloud, is unusable: "0.30000000000000004". */
  it('trims float noise out of the figures it reads out', async () => {
    const f = await setup({ data: [0.1 + 0.2, 1.5, 2] });
    const label = svg(f).getAttribute('aria-label') ?? '';
    expect(label).toContain('from 0.3 ');
    expect(label).not.toContain('0.30000000000000004');
  });

  it('leaves whole numbers whole', async () => {
    const f = await setup({ data: [1, 2, 3] });
    expect(svg(f).getAttribute('aria-label')).toContain('from 1 to 3');
  });

  /**
   * ★ Reached through the component API rather than the template: the template
   * renders the empty placeholder before it can ask for a label, so this guard
   * is not reachable by rendering. It is pinned anyway because it is what keeps
   * the label total — a reordering of the template's `@if` chain would
   * otherwise turn it into a crash rather than a fallback.
   */
  it('falls back to "No data" rather than throwing on an empty series', async () => {
    const f = await setup({ data: [] });
    expect(inner(f).label()).toBe('No data');
    expect(inner(f).minPoint()).toBeNull();
    expect(inner(f).maxPoint()).toBeNull();
    expect(inner(f).lastPoint()).toBeNull();
  });
});

describe('SvSparklineComponent — the baseline rule', () => {
  it('places the rule inside the box for a baseline within the series range', async () => {
    const f = await setup({ data: [0, 10], baseline: 5, height: 40 });
    const line = svg(f).querySelector('line')!;
    const y = Number(line.getAttribute('y1'));
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(40);
    expect(line.getAttribute('y1')).toBe(line.getAttribute('y2'));
  });

  /**
   * A baseline outside the series still has to be drawn *somewhere* sensible:
   * the domain widens to include it rather than the rule vanishing or being
   * clipped, so "target: 100" on a series that never got near it still reads.
   */
  it('widens the domain to include a baseline above the whole series', async () => {
    const f = await setup({ data: [1, 2, 3], baseline: 100, height: 40 });
    const y = Number(svg(f).querySelector('line')!.getAttribute('y1'));
    expect(Number.isFinite(y)).toBe(true);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(40);
  });

  it('draws no rule when the series is empty, even with a baseline set', async () => {
    const f = await setup({ variant: 'bar', data: [], baseline: 5 });
    expect(el(f).querySelector('line')).toBeNull();
  });
});

describe('SvSparklineComponent — explicit domain', () => {
  it('pins the floor so a series is read against a fixed scale', async () => {
    const free = await setup({ variant: 'line', data: [5, 6], height: 40, strokeWidth: 0 });
    const pinned = await setup({ variant: 'line', data: [5, 6], height: 40, strokeWidth: 0, domainMin: 0 });
    // Against its own minimum the first point sits on the floor; against a
    // pinned floor of 0 it sits well above it.
    const yOf = (f: Awaited<ReturnType<typeof setup>>) =>
      Number(svg(f).querySelector('path')!.getAttribute('d')!.match(/M[\d.]+,([\d.]+)/)![1]);
    expect(yOf(free)).toBeGreaterThan(yOf(pinned));
  });

  it('pins the ceiling too', async () => {
    const free = await setup({ variant: 'line', data: [5, 6], height: 40, strokeWidth: 0 });
    const pinned = await setup({ variant: 'line', data: [5, 6], height: 40, strokeWidth: 0, domainMax: 100 });
    const lastYOf = (f: Awaited<ReturnType<typeof setup>>) =>
      Number(svg(f).querySelector('path')!.getAttribute('d')!.match(/,([\d.]+)$/)![1]);
    expect(lastYOf(pinned)).toBeGreaterThan(lastYOf(free));
  });
});

describe('SvSparklineComponent — retry', () => {
  it('emits (retry) when the error dash is activated', async () => {
    const spy = vi.fn();
    const f = await setup({ error: 'nope' });
    f.componentInstance.retry.subscribe(spy);

    (el(f).querySelector('[data-sv-state="error"]') as HTMLElement).click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not offer a retry when there is no error', async () => {
    const f = await setup({ data: [1, 2] });
    expect(el(f).querySelector('[data-sv-state="error"]')).toBeNull();
  });
});
