// `.node.spec.ts`: scale and tick arithmetic, no DOM — so it runs without paying
// a jsdom Angular TestBed init, and without holding a worker to itself.
import {
  niceMax,
  gridTicks,
  gridTicksSymmetric,
  formatChartValue,
  formatPercent,
  resolveColor,
  rectPath,
  roundedTopRectPath,
  resolveBarValues,
  DEFAULT_COLORS,
} from './bar-chart.utils';
import type { BarChartDataset } from './bar-chart.types';

describe('charts/bar-chart.utils — axis helpers', () => {
  it('niceMax rounds up to a clean ceiling', () => {
    expect(niceMax(87)).toBe(90); // ceil(87/10)*10
    expect(niceMax(1234)).toBe(2000); // ceil(1234/1000)*1000
    expect(niceMax(0)).toBe(10);
    expect(niceMax(-5)).toBe(10);
  });

  it('gridTicks returns count+1 evenly spaced ticks from 0', () => {
    expect(gridTicks(100)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(gridTicks(50, 2)).toEqual([0, 25, 50]);
  });

  it('gridTicksSymmetric spans -max..+max through zero', () => {
    const ticks = gridTicksSymmetric(100, 2);
    expect(ticks[0]).toBe(-100);
    expect(ticks[ticks.length - 1]).toBe(100);
    expect(ticks).toContain(0);
  });
});

describe('charts/bar-chart.utils — formatting', () => {
  it('formatChartValue compacts thousands and millions', () => {
    expect(formatChartValue(950)).toBe('950');
    expect(formatChartValue(2_500)).toBe('2.5k'); // <10k → one decimal
    expect(formatChartValue(24_000)).toBe('24k'); // >=10k → no decimal
    expect(formatChartValue(2_400_000)).toBe('2.4M');
  });

  it('formatChartValue keeps one decimal for fractional values', () => {
    expect(formatChartValue(3.14159)).toBe('3.1');
  });

  it('formatPercent rounds to a whole percent', () => {
    expect(formatPercent(42.4)).toBe('42%');
    expect(formatPercent(42.6)).toBe('43%');
  });
});

describe('charts/bar-chart.utils — colors & paths', () => {
  it('resolveColor prefers an override, else cycles the palette', () => {
    expect(resolveColor(0, '#000')).toBe('#000');
    expect(resolveColor(0)).toBe(DEFAULT_COLORS[0]);
    expect(resolveColor(DEFAULT_COLORS.length)).toBe(DEFAULT_COLORS[0]); // wraps
  });

  it('rectPath returns empty for non-positive dimensions', () => {
    expect(rectPath(0, 0, 0, 10)).toBe('');
    expect(rectPath(0, 0, 10, 10)).toMatch(/^M 0 0 H 10 V 10 H 0 Z$/);
  });

  it('roundedTopRectPath clamps the radius and returns empty for zero height', () => {
    expect(roundedTopRectPath(0, 0, 10, 0, 4)).toBe('');
    const path = roundedTopRectPath(0, 0, 10, 20, 4);
    expect(path.startsWith('M')).toBe(true);
    expect(path.trim().endsWith('Z')).toBe(true);
  });
});

describe('charts/bar-chart.utils — resolveBarValues (values a bar cannot draw)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const series = (...data: number[][]): BarChartDataset[] =>
    data.map((d, i) => ({ label: `S${i}`, data: d }));

  it('hands back the same numbers, and no notice, when every bar is drawable', () => {
    const result = resolveBarValues(series([10, 20, 0]), 'clamp', 'sv-bar-chart');
    expect(result.max).toBe(20);
    expect(result.notice).toBeNull();
    expect(result.error).toBeNull();
    expect(result.isClamped(0, 0)).toBe(false);
  });

  it('keeps the axis a number when a value is NaN', () => {
    // ★★★ The defect this exists for. `Math.max(10, NaN)` is NaN and
    //     `niceMax(NaN)` is NaN, so one blank source cell made every bar height
    //     and every grid tick NaN — and SVG drops a NaN dimension silently, so
    //     the entire plot went blank with no error anywhere.
    const result = resolveBarValues(series([10, NaN, 20]), 'clamp', 'sv-bar-chart-nan');
    expect(result.max).toBe(20);
    expect(Number.isFinite(result.max)).toBe(true);
    expect(result.isClamped(0, 1)).toBe(true);
  });

  it('marks a clamped bar by position, not by value', () => {
    // ★ `clamp` replaces the offending number with 0, so a set of VALUES would
    //   hold just 0 — and category 2, which really is 0, would test as clamped
    //   and be drawn as a stub with "not drawn to scale" in its name.
    const result = resolveBarValues(series([-50, 30, 0]), 'clamp', 'sv-bar-chart-pos');
    expect(result.isClamped(0, 0)).toBe(true);
    expect(result.isClamped(0, 1)).toBe(false);
    expect(result.isClamped(0, 2)).toBe(false);
    expect(result.max).toBe(30);
  });

  it('keys the mark to its own series, not to a flattened index', () => {
    const result = resolveBarValues(series([10, 20], [-5, 40]), 'clamp', 'sv-bar-chart-multi');
    expect(result.isClamped(1, 0)).toBe(true);
    expect(result.isClamped(0, 0)).toBe(false);
    expect(result.max).toBe(40);
  });

  it('discloses what it clamped in the rendered output, not only to the console', () => {
    const notice = resolveBarValues(series([-50, 30]), 'clamp', 'sv-bar-chart-notice').notice!;
    expect(notice).toContain('1 bar');
    expect(notice).toContain('-50');
  });

  it('leaves the host datasets alone', () => {
    const datasets = series([-50, 30]);
    resolveBarValues(datasets, 'clamp', 'sv-bar-chart-pure');
    expect(datasets[0].data).toEqual([-50, 30]);
  });

  it('refuses the dataset under reject, with an error the frame can show', () => {
    const result = resolveBarValues(series([-50, 30]), 'reject', 'sv-bar-chart-reject');
    expect(result.error?.code).toBe('SV_UNPLOTTABLE_VALUE');
    // Re-fetching cannot change the numbers, so offering a retry is a loop.
    expect(result.error?.retryable).toBe(false);
    // An axis ceiling is still needed — the frame renders the error, but the
    // component's geometry computeds run regardless, and NaN there is a crash.
    expect(Number.isFinite(result.max)).toBe(true);
  });

  it('falls back to clamp for a policy a zero-based bar has no way to carry out', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('ngDevMode', true);
    try {
      // `omit` would shift every later bar out from under its own label, since a
      // bar's position is its index within its series. `render` has no room
      // below the baseline to draw in. Both fall back rather than pretend.
      const omitted = resolveBarValues(series([-50, 30]), 'omit', 'sv-bar-chart-omit');
      expect(omitted.isClamped(0, 0)).toBe(true);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("does not support the 'omit' value policy");
      expect(warn.mock.calls[0][0]).toContain('sv-bar-chart-omit');
    } finally {
      warn.mockRestore();
    }
  });

  it('behaves identically, and silently, in a production build', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('ngDevMode', false);
    try {
      // The old `clampBarValue` warned in dev only, which is why production drew
      // a missing bar and said nothing. The build mode may change the logging; it
      // must not change what the reader sees.
      const result = resolveBarValues(series([-50, 30]), 'clamp', 'sv-bar-chart-prod');
      expect(result.isClamped(0, 0)).toBe(true);
      expect(result.notice).toContain('1 bar');
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
