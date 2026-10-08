import { svBinDensityStep, svHexBin, svHexPath, type SvPointBin } from './point-bins';

/**
 * Pure arithmetic — no DOM, no TestBed, hence `.node.spec.ts`.
 *
 * The property that matters here is not "the bins look right", it is that binning
 * is a LOSSLESS regrouping: every point that has a position is in exactly one bin,
 * every point that has none is accounted for as missing, and the same input always
 * produces the same bins in the same order. A density plot that quietly loses a
 * tenth of the cloud is worse than the overplotted scatter it replaced, because
 * the count printed next to it makes it look authoritative.
 */

type P = { readonly x: number; readonly y: number; readonly id?: string };

const bin = (points: readonly P[], radius = 10) =>
  svHexBin(points, { x: p => p.x, y: p => p.y, radius });

const total = <T>(bins: readonly SvPointBin<T>[]) => bins.reduce((n, b) => n + b.count, 0);

describe('svHexBin — what it keeps', () => {
  it('puts every point in exactly one bin', () => {
    const points: P[] = Array.from({ length: 200 }, (_, i) => ({
      x: (i * 37) % 200,
      y: (i * 53) % 140,
    }));
    const bins = bin(points);
    expect(total(bins)).toBe(200);
    // No point appears twice: the flattened items are the input as a set.
    const seen = new Set(bins.flatMap(b => b.items));
    expect(seen.size).toBe(200);
  });

  it('keeps the items, in the order they were supplied', () => {
    const bins = bin([
      { x: 0, y: 0, id: 'a' },
      { x: 1, y: 1, id: 'b' },
      { x: 0.5, y: 0.5, id: 'c' },
    ]);
    expect(bins.length).toBe(1);
    expect(bins[0].items.map(p => p.id)).toEqual(['a', 'b', 'c']);
    expect(bins[0].count).toBe(3);
  });

  /**
   * ★★ The whole point of the module: a hundred coincident points and ten thousand
   *    of them draw the same mark, and only `count` can tell them apart.
   */
  it('collapses coincident points into one bin that knows how many', () => {
    const bins = bin(Array.from({ length: 500 }, () => ({ x: 42, y: 42 })));
    expect(bins.length).toBe(1);
    expect(bins[0].count).toBe(500);
  });

  it('returns the same bins in the same order for the same input', () => {
    const points: P[] = Array.from({ length: 120 }, (_, i) => ({ x: i % 17, y: (i * 7) % 23 }));
    const a = bin(points);
    const b = bin(points);
    expect(a.map(x => `${x.q},${x.r},${x.count}`)).toEqual(b.map(x => `${x.q},${x.r},${x.count}`));
  });

  it('has no bins at all for no points', () => {
    expect(bin([])).toEqual([]);
  });
});

describe('svHexBin — what it refuses', () => {
  /**
   * ★★ A point with no position cannot be assigned to a neighbourhood, and putting
   *    it in the nearest one would invent a reading. It is skipped — and because
   *    the summed count is then short of the input length, the caller can find out
   *    and say so, which is what the scatter chart does.
   */
  it('skips a point whose coordinates are not finite', () => {
    const bins = bin([
      { x: 0, y: 0 },
      { x: NaN, y: 0 },
      { x: 0, y: NaN },
      { x: Infinity, y: -Infinity },
      { x: 1, y: 1 },
    ]);
    expect(total(bins)).toBe(2);
  });

  it('refuses a radius that would collapse the plot into one bin', () => {
    for (const radius of [0, -5, NaN, Infinity]) {
      expect(() => bin([{ x: 0, y: 0 }], radius)).toThrow(/radius/);
    }
  });
});

describe('svHexBin — the lattice', () => {
  it('centres a bin on the lattice, not on its points', () => {
    // A single point at the origin lands on the row-0, column-0 hexagon, whose
    // centre IS the origin.
    const [only] = bin([{ x: 0, y: 0 }]);
    expect(only.cx).toBeCloseTo(0, 9);
    expect(only.cy).toBeCloseTo(0, 9);
  });

  it('separates points more than a bin apart', () => {
    const bins = bin([{ x: 0, y: 0 }, { x: 60, y: 60 }, { x: 120, y: 0 }]);
    expect(bins.length).toBe(3);
    expect(bins.every(b => b.count === 1)).toBe(true);
  });

  /**
   * ★★★ THE REASON THE ROUNDING IS NOT TWO `Math.round`s. Rounding each axis on
   *     its own picks the nearest cell of a rectangular grid, and near the slanted
   *     edge of a hex row that is not the nearest hexagon. Every point must end up
   *     in the bin whose centre is genuinely closest, or the tiling has seams —
   *     visible as a grid of gaps and doubled-up cells across a dense cloud.
   */
  it('assigns every point to its nearest bin centre', () => {
    const radius = 10;
    const points: P[] = [];
    for (let x = -30; x <= 30; x += 1.7) {
      for (let y = -30; y <= 30; y += 1.3) points.push({ x, y });
    }
    const bins = bin(points, radius);
    const centres = bins.map(b => ({ cx: b.cx, cy: b.cy }));

    for (const b of bins) {
      for (const p of b.items) {
        const own = (p.x - b.cx) ** 2 + (p.y - b.cy) ** 2;
        const nearest = Math.min(...centres.map(c => (p.x - c.cx) ** 2 + (p.y - c.cy) ** 2));
        // Ties are allowed — a point exactly on an edge may go either way.
        expect(own - nearest).toBeLessThan(1e-9);
      }
    }
  });

  /**
   * The same property over scattered coordinates rather than a grid, because a
   * grid can share a period with the lattice and miss the edge zone entirely.
   * Seeded, so a failure is reproducible.
   */
  it('assigns every point to its nearest bin centre, off the grid too', () => {
    let seed = 20260908;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const points: P[] = Array.from({ length: 4000 }, () => ({
      x: random() * 240 - 120,
      y: random() * 180 - 90,
    }));
    const bins = bin(points, 13);
    const centres = bins.map(b => ({ cx: b.cx, cy: b.cy }));
    let worst = 0;
    for (const b of bins) {
      for (const p of b.items) {
        const own = Math.hypot(p.x - b.cx, p.y - b.cy);
        const nearest = Math.min(...centres.map(c => Math.hypot(p.x - c.cx, p.y - c.cy)));
        worst = Math.max(worst, own - nearest);
      }
    }
    expect(worst).toBeLessThan(1e-9);
  });

  it('scales the lattice with the radius', () => {
    const points: P[] = Array.from({ length: 300 }, (_, i) => ({ x: i % 30, y: (i * 3) % 30 }));
    const coarse = bin(points, 20).length;
    const fine = bin(points, 4).length;
    expect(fine).toBeGreaterThan(coarse);
    expect(total(bin(points, 20))).toBe(300);
    expect(total(bin(points, 4))).toBe(300);
  });
});

describe('svHexPath', () => {
  it('draws a closed six-sided outline around the origin', () => {
    const d = svHexPath(10);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.split('L').length).toBe(6);
    for (const pair of d.replace(/^M/, '').replace(/Z$/, '').split('L')) {
      const [x, y] = pair.split(',').map(Number);
      expect(Math.hypot(x, y)).toBeCloseTo(10, 3);
    }
  });

  it('is pointy-topped, so it tiles the lattice the bins use', () => {
    // First vertex at angle 0 is straight up: sin(0) = 0, -cos(0) = -1.
    expect(svHexPath(10).startsWith('M0,-10')).toBe(true);
  });

  it('refuses a radius that cannot be drawn', () => {
    for (const radius of [0, -1, NaN]) expect(() => svHexPath(radius)).toThrow(/radius/);
  });
});

describe('svBinDensityStep', () => {
  /**
   * ★★ Linear shading is the trap. One bin of 900 among a hundred bins of 1–5 is
   *    the ordinary shape of a cluster, and on a linear ramp all hundred of them
   *    round to the palest step — the plot reads as empty with one dot in it. A log
   *    ramp separates 1 from 5 and 100 from 900 at the same time.
   */
  it('separates the small counts a linear ramp would flatten', () => {
    const steps = 5;
    const one = svBinDensityStep(1, 900, steps);
    const five = svBinDensityStep(5, 900, steps);
    expect(five).toBeGreaterThan(one);
    expect(svBinDensityStep(900, 900, steps)).toBe(5);
  });

  it('stays inside 1..steps for anything it is handed', () => {
    for (const count of [-3, 0, 1, 7, 1e6, NaN, Infinity]) {
      const step = svBinDensityStep(count, 100, 4);
      expect(step).toBeGreaterThanOrEqual(1);
      expect(step).toBeLessThanOrEqual(4);
    }
  });

  it('gives every bin the same step when no bin holds more than one', () => {
    // Otherwise a plot of entirely distinct points is shaded as if it had density.
    expect(svBinDensityStep(1, 1, 5)).toBe(1);
  });

  it('does not let a count above the max exceed the top step', () => {
    expect(svBinDensityStep(5000, 100, 5)).toBe(5);
  });
});
