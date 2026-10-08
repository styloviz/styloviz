// ★ `.node.spec.ts` because every function under test is arithmetic — angles,
//   arc paths, label collision resolution — and none of it touches a DOM. In the
//   jsdom `unit` project this file paid a full Angular TestBed init (measured:
//   16s of setup for 266ms of tests) and, because `initTestEnvironment` is
//   once-per-process, it held a worker to itself. Two suites in that shape were
//   the ones timing out on worker shutdown.
import {
  PIE_COLORS,
  buildArcData,
  buildArcPath,
  explodeTransform,
  formatPieValue,
  labelPoint,
  polarToCartesian,
  resolveSmartLabels,
  sliceAngles,
  toPercent,
  type RawLabel,
} from './pie-chart.utils';

/**
 * Pure arc arithmetic, so it is testable exactly.
 *
 * Two things here are not obvious and are the reason most of these exist.
 * First, 0° is the TOP of the circle, not the right — every angle is offset by
 * −90°, and an off-by-90 rotates the whole pie without erroring.
 * Second, a single-slice pie asks for a 360° arc, which in SVG is the same
 * start and end point: the browser draws nothing at all. The nudge to 359.99°
 * is what makes a one-slice pie visible.
 */

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('charts/pie-chart.utils — polar geometry', () => {
  it('puts zero degrees at the top of the circle, not the right', async () => {
    const p = polarToCartesian(100, 100, 50, 0);
    near(p.x, 100);
    near(p.y, 50);
  });

  it('walks clockwise through right, bottom and left', () => {
    const right = polarToCartesian(100, 100, 50, 90);
    near(right.x, 150);
    near(right.y, 100);

    const bottom = polarToCartesian(100, 100, 50, 180);
    near(bottom.x, 100);
    near(bottom.y, 150);

    const left = polarToCartesian(100, 100, 50, 270);
    near(left.x, 50);
    near(left.y, 100);
  });

  it('collapses onto the centre at radius zero', () => {
    const p = polarToCartesian(10, 20, 0, 137);
    near(p.x, 10);
    near(p.y, 20);
  });
});

describe('charts/pie-chart.utils — arc paths', () => {
  it('draws a wedge from the centre, out, round and back', () => {
    const d = buildArcPath(100, 100, 50, 0, 90);
    expect(d.startsWith('M 100 100')).toBe(true);
    expect(d).toContain(' A 50 50 0 ');
    expect(d.endsWith('Z')).toBe(true);
    expect(d).not.toContain('NaN');
  });

  it('flags the large-arc sweep only past a half turn', () => {
    // Below 180° the browser must take the SHORT way round; above it, the long
    // way. Getting this wrong draws the complement of the slice.
    expect(buildArcPath(0, 0, 10, 0, 90)).toContain(' 0 1 ');
    expect(buildArcPath(0, 0, 10, 0, 180)).toContain(' 0 1 ');
    expect(buildArcPath(0, 0, 10, 0, 181)).toContain(' 1 1 ');
  });

  it('leaves a whisker in a full-circle slice so it is drawn at all', () => {
    // A 360° arc starts and ends on the same point; SVG treats that as a no-op
    // and a single-slice pie renders as an empty box.
    const full = buildArcPath(100, 100, 50, 0, 360);
    const nudged = buildArcPath(100, 100, 50, 0, 359.99);
    expect(full).toBe(nudged);
    expect(full).toContain(' 1 1 '); // still the long way round
  });

  it('produces a degenerate but finite path for a zero-width slice', () => {
    // A slice of value 0 in a real dataset: it must not poison the SVG.
    const d = buildArcPath(100, 100, 50, 45, 45);
    expect(d).not.toContain('NaN');
    expect(d).toContain(' 0 1 '); // zero span is not a large arc
  });

  it('bundles the arc with the angles the labels need', () => {
    const arc = buildArcData(100, 100, 50, 30, 90);
    expect(arc.midAngle).toBe(60);
    expect(arc.startAngle).toBe(30);
    expect(arc.endAngle).toBe(90);
    expect(arc.outerR).toBe(50);
    expect(arc.cx).toBe(100);
    expect(arc.cy).toBe(100);
    expect(arc.path).toBe(buildArcPath(100, 100, 50, 30, 90));
  });
});

describe('charts/pie-chart.utils — sliceAngles (gap-aware span)', () => {
  it('subtracts half the gap from each end of a slice wider than the gap', () => {
    const { start, end } = sliceAngles(100, 60, 4);
    expect(start).toBe(102); // 100 + 4/2
    expect(end).toBe(158);   // 100 + 60 - 4/2
  });

  it('never lets the gap invert a slice narrower than it', () => {
    // deg=1, gap=4: the naive formula gives start=102, end=99 — end < start,
    // a negative span. Every deg/gap combination narrower than the gap must
    // clamp to end >= start instead (within float epsilon — deg=3.99 lands
    // start and end a couple ULPs apart from pure floating-point rounding,
    // not from the clamp itself).
    for (const deg of [0.1, 0.5, 1, 2, 3.99]) {
      const { start, end } = sliceAngles(100, deg, 4);
      expect(end).toBeGreaterThanOrEqual(start - 1e-9);
    }
  });

  it('collapses to a zero-width span exactly at the point the gap fully consumes the slice', () => {
    const { start, end } = sliceAngles(100, 1, 4); // gap (4) > deg (1)
    expect(start).toBe(end);
    expect(start).toBe(100.5); // effectiveGap clamps to deg=1, so 100 + 1/2
  });

  it('is a no-op at zero gap, leaving slices flush', () => {
    const { start, end } = sliceAngles(0, 90, 0);
    expect(start).toBe(0);
    expect(end).toBe(90);
  });
});

describe('charts/pie-chart.utils — label anchoring', () => {
  it('pushes the label point outside the pie by the offset', () => {
    const p = labelPoint(100, 100, 50, 90, 12);
    near(p.x, 162); // 50 + 12 to the right
    near(p.y, 100);
  });

  it('centres text on a slice at the very top', () => {
    expect(labelPoint(0, 0, 10, 0, 4).anchor).toBe('middle');
    expect(labelPoint(0, 0, 10, 14, 4).anchor).toBe('middle');
    expect(labelPoint(0, 0, 10, 350, 4).anchor).toBe('middle');
  });

  it('reads a right-hand label left-to-right and a left-hand one right-to-left', () => {
    expect(labelPoint(0, 0, 10, 90, 4).anchor).toBe('start');
    expect(labelPoint(0, 0, 10, 270, 4).anchor).toBe('end');
  });

  it('normalises an angle that has wrapped past a full turn or gone negative', () => {
    // A cumulative angle can exceed 360 on a pie built by accumulation.
    expect(labelPoint(0, 0, 10, 450, 4).anchor).toBe('start'); // 450 → 90
    expect(labelPoint(0, 0, 10, -90, 4).anchor).toBe('end'); // -90 → 270
  });
});

describe('charts/pie-chart.utils — formatting', () => {
  it('shows small values verbatim and compacts large ones', () => {
    expect(formatPieValue(0)).toBe('0');
    expect(formatPieValue(999)).toBe('999');
    expect(formatPieValue(2_500)).toBe('2.5k');
    expect(formatPieValue(24_000)).toBe('24k');
    expect(formatPieValue(3_400_000)).toBe('3.4M');
  });

  it('reads a percentage share to one place by default', () => {
    expect(toPercent(25, 100)).toBe('25.0%');
    expect(toPercent(1, 3)).toBe('33.3%');
    expect(toPercent(1, 3, 0)).toBe('33%');
  });

  it('reports zero rather than NaN for an empty pie', () => {
    // Every slice is 0 → total 0 → `value / total` is 0/0. The legend would
    // read "NaN%" for every entry.
    expect(toPercent(0, 0)).toBe('0%');
    expect(toPercent(5, 0)).toBe('0%');
  });

  it('offers a palette long enough to index by slice', () => {
    expect(PIE_COLORS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(PIE_COLORS).size).toBe(PIE_COLORS.length);
  });
});

describe('charts/pie-chart.utils — explode transform', () => {
  it('pushes a slice outward along its own mid-angle', () => {
    // Straight up: no horizontal movement, and NEGATIVE y (SVG y grows down).
    expect(explodeTransform(0, 10)).toBe('translate(0.00, -10.00)');
    expect(explodeTransform(90, 10)).toBe('translate(10.00, 0.00)');
    expect(explodeTransform(180, 10)).toBe('translate(0.00, 10.00)');
  });

  it('produces no movement at zero offset', () => {
    expect(explodeTransform(137, 0)).toBe('translate(0.00, 0.00)');
  });
});

describe('charts/pie-chart.utils — smart label collision', () => {
  const label = (over: Partial<RawLabel>): RawLabel => ({
    x: 0,
    y: 0,
    anchor: 'start',
    midAngle: 45,
    lineStart: { x: 0, y: 0 },
    lineEnd: { x: 0, y: 0 },
    label: 'L',
    pct: '10%',
    value: '10',
    color: '#000',
    index: 0,
    ...over,
  });

  it('leaves labels alone when they already clear each other', () => {
    const ls = [label({ y: 0, index: 0 }), label({ y: 40, index: 1 })];
    const out = resolveSmartLabels(ls, 16);
    expect(out.map((l) => l.y)).toEqual([0, 40]);
  });

  it('pushes two crowded labels apart symmetrically', () => {
    // Two slices of 2% each land on almost the same y and the text overlaps
    // into an unreadable smudge.
    const ls = [label({ y: 100, index: 0 }), label({ y: 104, index: 1 })];
    const out = resolveSmartLabels(ls, 16);
    expect(out[1].y - out[0].y).toBeCloseTo(16, 6);
    // The pair's midpoint is preserved — the group does not drift.
    expect((out[0].y + out[1].y) / 2).toBeCloseTo(102, 6);
  });

  it('separates the left and right sides independently', () => {
    // A label on the left of the pie can never collide with one on the right,
    // so spreading them together would move labels that did not need moving.
    const ls = [
      label({ y: 100, anchor: 'start', index: 0 }),
      label({ y: 101, anchor: 'end', index: 1 }),
    ];
    const out = resolveSmartLabels(ls, 16);
    expect(out.map((l) => l.y)).toEqual([101, 100]);
  });

  it('never moves a top-or-bottom label, and keeps it in the output', () => {
    const ls = [
      label({ y: 100, anchor: 'middle', index: 0 }),
      label({ y: 101, anchor: 'middle', index: 1 }),
    ];
    const out = resolveSmartLabels(ls, 16);
    expect(out.length).toBe(2);
    expect(out.map((l) => l.y)).toEqual([100, 101]);
  });

  it('returns every label it was given, whichever side each is on', () => {
    const ls = [
      label({ y: 10, anchor: 'end', index: 0 }),
      label({ y: 11, anchor: 'start', index: 1 }),
      label({ y: 12, anchor: 'middle', index: 2 }),
    ];
    expect(resolveSmartLabels(ls).map((l) => l.index).sort()).toEqual([0, 1, 2]);
  });

  it('spreads a whole run of coincident labels, not just the first pair', () => {
    const ls = [0, 0, 0, 0].map((y, i) => label({ y, index: i }));
    const out = resolveSmartLabels(ls, 16);
    // The spread halves the shortfall each pass, so it converges on the gap
    // rather than reaching it exactly — hence the tolerance.
    for (let i = 1; i < out.length; i++) {
      expect(out[i].y - out[i - 1].y).toBeGreaterThan(16 - 1e-6);
    }
  });

  it('gives up after its iteration budget instead of looping forever', () => {
    // Ten labels at the same y need more passes than a low budget allows; the
    // function must return something finite rather than spin.
    const ls = Array.from({ length: 10 }, (_, i) => label({ y: 0, index: i }));
    const out = resolveSmartLabels(ls, 16, undefined, 1);
    expect(out.length).toBe(10);
    expect(out.every((l) => Number.isFinite(l.y))).toBe(true);
    // One pass cannot fully separate ten labels — proving the budget is real.
    expect(out[9].y - out[0].y).toBeLessThan(16 * 9);
  });

  it('handles a single label and an empty list', () => {
    expect(resolveSmartLabels([])).toEqual([]);
    expect(resolveSmartLabels([label({ y: 5 })]).map((l) => l.y)).toEqual([5]);
  });
});

describe('charts/pie-chart.utils — keeping spread labels on the canvas', () => {
  const label = (over: Partial<RawLabel>): RawLabel => ({
    x: 0,
    y: 0,
    anchor: 'start',
    midAngle: 45,
    lineStart: { x: 0, y: 0 },
    lineEnd: { x: 0, y: 0 },
    label: 'L',
    pct: '10%',
    value: '10',
    color: '#000',
    index: 0,
    ...over,
  });

  const BOUNDS = { top: 8, bottom: 280 };

  it('slides a group that was pushed past the bottom edge back inside', () => {
    // Three crowded slices near the bottom of the pie: the spread pushes the
    // last one off the canvas, where it is clipped away rather than drawn.
    const ls = [270, 274, 278].map((y, i) => label({ y, index: i }));
    const unbounded = resolveSmartLabels(ls.map((l) => ({ ...l })), 16);
    expect(unbounded[2].y).toBeGreaterThan(BOUNDS.bottom);

    const out = resolveSmartLabels(ls, 16, BOUNDS);
    expect(out[2].y).toBeLessThanOrEqual(BOUNDS.bottom);
    expect(out[0].y).toBeGreaterThanOrEqual(BOUNDS.top);
  });

  it('keeps the separation it achieved while sliding the group', () => {
    // Shifting the whole group is what preserves the spread; clamping each
    // label on its own would pile them back up against the edge.
    const ls = [270, 274, 278].map((y, i) => label({ y, index: i }));
    const out = resolveSmartLabels(ls, 16, BOUNDS);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].y - out[i - 1].y).toBeGreaterThan(16 - 1e-6);
    }
  });

  it('pulls a group back down when the spread pushed it off the top', () => {
    const ls = [2, 4, 6].map((y, i) => label({ y, index: i }));
    const out = resolveSmartLabels(ls, 16, BOUNDS);
    expect(out[0].y).toBeGreaterThanOrEqual(BOUNDS.top);
  });

  it('spaces labels evenly when there are more of them than the band can hold', () => {
    // 30 labels needing 16px each want 464px of a 272px band. Something has to
    // give, and packing them tighter keeps every one of them readable — whereas
    // overflowing the band means the outermost ones are not drawn at all.
    const ls = Array.from({ length: 30 }, (_, i) => label({ y: 150, index: i }));
    const out = resolveSmartLabels(ls, 16, BOUNDS);
    expect(Math.min(...out.map((l) => l.y))).toBeGreaterThanOrEqual(BOUNDS.top);
    expect(Math.max(...out.map((l) => l.y))).toBeLessThanOrEqual(BOUNDS.bottom);
    expect(out.length).toBe(30);
  });

  it('bounds each side independently', () => {
    // A crowded right side must not drag the single left-side label anywhere.
    const ls = [
      ...[270, 274, 278].map((y, i) => label({ y, anchor: 'start', index: i })),
      label({ y: 120, anchor: 'end', index: 9 }),
    ];
    const out = resolveSmartLabels(ls, 16, BOUNDS);
    expect(out.find((l) => l.index === 9)!.y).toBe(120);
  });

  it('leaves a group that already fits exactly where it is', () => {
    const ls = [100, 140, 180].map((y, i) => label({ y, index: i }));
    const out = resolveSmartLabels(ls, 16, BOUNDS);
    expect(out.map((l) => l.y)).toEqual([100, 140, 180]);
  });
});
