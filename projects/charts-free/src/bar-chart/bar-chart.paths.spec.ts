import {
  STACK_COLORS,
  darkenColor,
  formatChartValue,
  gridTicks,
  gridTicksSymmetric,
  lightenColor,
  niceMax,
  rectPath,
  resolveColor,
  roundedLeftRectPath,
  roundedRightRectPath,
  roundedTopRectPath,
  stackedBarSegmentPath,
  stackedColumnSegmentPath,
} from './bar-chart.utils';

/**
 * The corner-rounding builders, the stacked-segment dispatch and the colour
 * mixers — the parts of `bar-chart.utils` the existing spec does not reach.
 *
 * Two failure modes drive these. A radius wider than the bar produces
 * overlapping arcs, which browsers render as a pinched blob rather than
 * rejecting; and a hex parser fed anything other than six hex digits (a named
 * colour, an `rgb()` string, a 3-digit shorthand) produces `rgb(NaN,NaN,NaN)`,
 * which is an invalid paint and makes the bar render BLACK, not unchanged.
 */

describe('charts/bar-chart.utils — rounded rectangles', () => {
  it('rounds the two top corners of a column and leaves the bottom square', () => {
    const d = roundedTopRectPath(10, 20, 40, 60, 4);
    expect(d.startsWith('M 14 20')).toBe(true); // inset by the radius
    expect(d).toContain('Q 50 20 50 24');
    expect(d).toContain('V 80'); // straight down to the square bottom
    expect(d.endsWith('Z')).toBe(true);
  });

  it('rounds the right end of a horizontal bar', () => {
    const d = roundedRightRectPath(10, 20, 60, 40, 4);
    expect(d.startsWith('M 10 20')).toBe(true);
    expect(d).toContain('Q 70 20 70 24');
    expect(d).toContain('Q 70 60 66 60');
    expect(d.endsWith('Z')).toBe(true);
  });

  it('rounds the left end of a bar that grows leftward from the axis', () => {
    const d = roundedLeftRectPath(10, 20, 60, 40, 4);
    expect(d.startsWith('M 14 20')).toBe(true);
    expect(d).toContain('Q 10 60 10 56');
    expect(d).toContain('Q 10 20 14 20');
  });

  it('clamps the radius to the bar rather than folding the corners into each other', () => {
    // A 4px radius on a 3px-tall bar would put both arcs past the midpoint.
    const d = roundedTopRectPath(0, 0, 4, 3, 40);
    expect(d).not.toContain('NaN');
    expect(d.startsWith('M 1.5 0')).toBe(true); // radius clamped to 1.5
  });

  it('draws nothing when the bar has no extent along its growth axis', () => {
    // A category with value 0 gives a zero-length bar. An empty `d` is dropped
    // by the browser; a malformed one is a console error on every render.
    expect(roundedTopRectPath(0, 0, 10, 0, 4)).toBe('');
    expect(roundedTopRectPath(0, 0, 10, -5, 4)).toBe('');
    expect(roundedRightRectPath(0, 0, 0, 10, 4)).toBe('');
    expect(roundedLeftRectPath(0, 0, -3, 10, 4)).toBe('');
    expect(rectPath(0, 0, 10, 0)).toBe('');
  });
});

describe('charts/bar-chart.utils — stacked segments', () => {
  it('rounds only the topmost segment of a stacked column', () => {
    const top = stackedColumnSegmentPath(0, 0, 20, 30, 4, true);
    const mid = stackedColumnSegmentPath(0, 30, 20, 30, 4, false);
    expect(top).toBe(roundedTopRectPath(0, 0, 20, 30, 4));
    expect(mid).toBe(rectPath(0, 30, 20, 30));
    // A rounded middle segment would leave a visible notch in the stack.
    expect(mid).not.toContain('Q');
  });

  it('rounds only the end segment of a stacked bar, on the side it grows to', () => {
    const inner = stackedBarSegmentPath(0, 0, 30, 20, 4, false);
    const right = stackedBarSegmentPath(30, 0, 30, 20, 4, true);
    const left = stackedBarSegmentPath(30, 0, 30, 20, 4, true, true);

    expect(inner).toBe(rectPath(0, 0, 30, 20));
    expect(right).toBe(roundedRightRectPath(30, 0, 30, 20, 4));
    expect(left).toBe(roundedLeftRectPath(30, 0, 30, 20, 4));
    expect(right).not.toBe(left);
  });

  it('drops a zero-sized segment from either stacking direction', () => {
    expect(stackedColumnSegmentPath(0, 0, 20, 0, 4, true)).toBe('');
    expect(stackedBarSegmentPath(0, 0, 0, 20, 4, true)).toBe('');
  });
});

describe('charts/bar-chart.utils — colour mixing', () => {
  it('moves a colour toward white and toward black', () => {
    expect(lightenColor('#000000', 0.5)).toBe('rgb(128,128,128)');
    expect(darkenColor('#ffffff', 0.5)).toBe('rgb(128,128,128)');
  });

  it('leaves a colour alone at zero mix and saturates at one', () => {
    expect(lightenColor('#3b82f6', 0)).toBe('rgb(59,130,246)');
    expect(lightenColor('#3b82f6', 1)).toBe('rgb(255,255,255)');
    expect(darkenColor('#3b82f6', 0)).toBe('rgb(59,130,246)');
    expect(darkenColor('#3b82f6', 1)).toBe('rgb(0,0,0)');
  });

  it('accepts a hex string with or without the hash', () => {
    expect(lightenColor('3b82f6', 0)).toBe(lightenColor('#3b82f6', 0));
  });

  it('returns a colour it cannot parse unchanged rather than turning it black', () => {
    // `parseInt('tomato', 16)` is NaN, and `rgb(NaN,NaN,NaN)` is an invalid
    // paint — the element renders black, which looks deliberate.
    for (const bad of ['tomato', '#abc', 'rgb(1,2,3)', 'var(--brand)', '#12345g', '']) {
      expect(lightenColor(bad)).toBe(bad);
      expect(darkenColor(bad)).toBe(bad);
    }
  });

  it('mixes by a sensible default when no amount is given', () => {
    expect(lightenColor('#000000')).toBe('rgb(77,77,77)'); // 0.3 toward white
    expect(darkenColor('#ffffff')).toBe('rgb(204,204,204)'); // 0.2 toward black
  });
});

describe('charts/bar-chart.utils — axis and palette edges', () => {
  it('rounds a fractional maximum up to a clean ceiling', () => {
    expect(niceMax(0.42)).toBeCloseTo(0.5, 9); // exp = 0.1
    expect(niceMax(7)).toBe(7);
    expect(niceMax(10)).toBe(10);
  });

  it('gives an all-zero or negative dataset a usable ceiling instead of zero', () => {
    // A zero ceiling is the divisor of every bar height.
    expect(niceMax(0)).toBe(10);
    expect(niceMax(-100)).toBe(10);
  });

  it('makes a symmetric axis that is centred on zero', () => {
    const ticks = gridTicksSymmetric(100, 5);
    expect(ticks.length).toBe(11);
    expect(ticks[0]).toBe(-100);
    expect(ticks[5]).toBe(0);
    expect(ticks[10]).toBe(100);
  });

  it('rounds symmetric ticks so they do not read as floating-point noise', () => {
    // 10/3 is 3.3333333333333335; an axis label must not print that.
    expect(gridTicksSymmetric(10, 3)).toEqual([-10, -6.67, -3.33, 0, 3.33, 6.67, 10]);
  });

  it('collapses to a single zero tick when the axis has no extent', () => {
    // ★ This assertion used to read [0, 0, 0] — the title said "a single tick"
    //   and the expectation pinned three of them. Ticks are rendered with
    //   `track val`, so the repeat was an NG0955 duplicate key, not a cosmetic
    //   one.
    expect(gridTicks(0, 2)).toEqual([0]);
    expect(gridTicksSymmetric(0, 1).map((t) => t + 0)).toEqual([0, 0, 0]);
  });

  it('never repeats a tick on a small integer axis', () => {
    // ★★ A headcount, a defect count and an error count are all small integers,
    //    and gridTicks(1, 5) used to come back [0,0,0,1,1,1] — six ticks with
    //    four duplicate track keys, on any chart plotting a handful of people.
    for (const axisMax of [0.5, 1, 1.2, 2, 3, 4, 5, 7, 10, 100]) {
      const ticks = gridTicks(axisMax, 5);
      expect(new Set(ticks).size).toBe(ticks.length);
      expect(ticks[0]).toBe(0);
    }
    expect(gridTicks(1, 5)).toEqual([0, 1]);
    expect(gridTicks(3, 5)).toEqual([0, 1, 2, 3]);
    // A roomy axis is untouched.
    expect(gridTicks(100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('cycles a chosen palette, not only the default one', () => {
    expect(resolveColor(0, undefined, STACK_COLORS)).toBe(STACK_COLORS[0]);
    expect(resolveColor(STACK_COLORS.length + 1, undefined, STACK_COLORS)).toBe(STACK_COLORS[1]);
    // An override still wins over any palette.
    expect(resolveColor(3, '#ff0000', STACK_COLORS)).toBe('#ff0000');
  });

  it('formats a negative value with the same compaction as a positive one', () => {
    // `abs` drives the threshold but the SIGNED value is divided, so a missing
    // `abs` would print "-950" as "-1.0k".
    expect(formatChartValue(-950)).toBe('-950');
    expect(formatChartValue(-2_500)).toBe('-2.5k');
    expect(formatChartValue(-24_000)).toBe('-24k');
    expect(formatChartValue(-2_400_000)).toBe('-2.4M');
    expect(formatChartValue(-3.14159)).toBe('-3.1');
  });

  it('shows an exact integer without a decimal point', () => {
    expect(formatChartValue(0)).toBe('0');
    expect(formatChartValue(42)).toBe('42');
  });
});
