/**
 * point-bins.ts — aggregate 2-D points into hexagonal bins.
 *
 * ## Why this exists
 *
 * A scatter plot draws one mark per datum, and a mark cannot be drawn twice: the
 * second point at the same coordinate replaces the first, pixel for pixel. Ten
 * thousand points inside one cluster and a hundred therefore produce the SAME
 * picture, and the picture is confident either way. There is no visual cue that
 * an order of magnitude is hidden — which makes overplotting worse than a missing
 * chart, because a missing chart does not persuade anyone of anything.
 *
 * Binning replaces "one mark per datum" with "one mark per neighbourhood, shaded
 * by how many landed in it". The count is then a number the chart can print,
 * announce and put in a table, instead of a density the reader has to guess at.
 *
 * ## Why hexagons rather than squares
 *
 * A square grid has two axis-aligned neighbours at distance `s` and two diagonal
 * ones at `s√2`, so the same cluster bins differently depending on how it sits
 * relative to the grid, and rows and columns of cells line up into stripes the
 * eye reads as structure in the data. Every hexagon's six neighbours are
 * equidistant, so the tiling has no preferred direction and no stripes. It is the
 * standard choice for density plots for exactly this reason.
 *
 * ## What this module is not
 *
 * It does not know about SVG, pixels or colour ramps. `x`/`y` are accessors and
 * `radius` is in whatever unit they return — call it with screen coordinates and
 * the bins are screen-sized, which is what a density plot wants (a bin should be
 * a constant size on the page, not a constant size in the data). Deciding how a
 * count becomes a shade belongs to the caller, because that decision needs the
 * caller's palette and its legend.
 */

/** One hexagonal bin and the items that fell inside it. */
export interface SvPointBin<T> {
  /**
   * Column index within the hex lattice. Odd rows are offset half a column, so
   * `q` is an identity rather than a subscript — two bins in adjacent rows with
   * the same `q` are not vertically aligned.
   */
  readonly q: number;
  /** Row index within the hex lattice. */
  readonly r: number;
  /** Centre of the hexagon, in the same units as the accessors returned. */
  readonly cx: number;
  /** @see cx */
  readonly cy: number;
  /** How many items fell in this bin. Always `items.length`, never zero. */
  readonly count: number;
  /**
   * The items themselves, in the order they were supplied. Kept rather than
   * discarded so a caller can answer "which points are these?" on hover, on
   * selection and in a table — a bin whose contents cannot be listed is a dead
   * end for a keyboard user.
   */
  readonly items: readonly T[];
}

/** Accessors and bin size for {@link svHexBin}. */
export interface SvHexBinOptions<T> {
  /** Horizontal coordinate of an item. */
  readonly x: (item: T) => number;
  /** Vertical coordinate of an item. */
  readonly y: (item: T) => number;
  /**
   * Circumradius of one hexagon, in the units the accessors return. Must be
   * finite and above zero; anything else throws, because a zero radius silently
   * collapses every point into one bin.
   */
  readonly radius: number;
}

/**
 * Group `items` into hexagonal bins of the given radius.
 *
 * Items whose coordinates are not finite are **skipped** — they have no position,
 * so no bin can honestly claim them. Compare `items.length` against the summed
 * `count` to find out how many were dropped; this function does not report it,
 * because what to say about it depends on the caller.
 *
 * Bins come back in first-seen order, so the same input always produces the same
 * paint order and the same table.
 */
export function svHexBin<T>(
  items: readonly T[],
  options: SvHexBinOptions<T>,
): readonly SvPointBin<T>[] {
  const { x, y, radius } = options;
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error(`svHexBin: radius must be a finite number above zero, got ${radius}.`);
  }

  // Lattice pitch for a pointy-top hexagon of circumradius `radius`: columns are
  // one short diagonal apart, rows three half-radii apart.
  const dx = radius * 2 * Math.sin(Math.PI / 3);
  const dy = radius * 1.5;

  const byKey = new Map<string, { q: number; r: number; items: T[] }>();
  const order: { q: number; r: number; items: T[] }[] = [];

  for (const item of items) {
    const px = x(item);
    const py = y(item);
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;

    // Nearest lattice row, then nearest column on that row.
    const ry = py / dy;
    let r = Math.round(ry);
    const rx = px / dx - (r & 1) / 2;
    let q = Math.round(rx);

    // Rounding each axis independently picks the nearest cell of a RECTANGULAR
    // grid, which is not the nearest hexagon near the slanted edges. Only the
    // outer third of a row can be wrong, so the two candidates are compared by
    // true distance just there.
    //
    // ★ The distances are weighted back into the caller's units before being
    //   compared. A column is `dx` wide and a row `dy` tall and those differ by
    //   √3 : 1.5, so comparing the offsets raw — as the textbook form of this
    //   rounding does — measures against a stretched circle and hands a sliver of
    //   points along every slanted edge to the wrong neighbour. The tiling then
    //   has seams: a lattice of gaps and doubled cells across a dense cloud.
    const dry = ry - r;
    if (Math.abs(dry) * 3 > 1) {
      const drq = rx - q;
      const qNear = q + (rx < q ? -1 : 1) / 2;
      const rNear = r + (ry < r ? -1 : 1);
      const drq2 = rx - qNear;
      const dry2 = ry - rNear;
      const here = (drq * dx) ** 2 + (dry * dy) ** 2;
      const there = (drq2 * dx) ** 2 + (dry2 * dy) ** 2;
      if (here > there) {
        // `r & 1` is deliberately the OLD row: the half-column offset being undone
        // here is the one that was applied when `rx` was computed.
        q = qNear + ((r & 1) ? 1 : -1) / 2;
        r = rNear;
      }
    }

    const key = `${q},${r}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      const bin = { q, r, items: [item] };
      byKey.set(key, bin);
      order.push(bin);
    }
  }

  return order.map(bin => ({
    q: bin.q,
    r: bin.r,
    cx: (bin.q + (bin.r & 1) / 2) * dx,
    cy: bin.r * dy,
    count: bin.items.length,
    items: bin.items,
  }));
}

/**
 * The outline of one hexagon of circumradius `radius`, centred on the origin, as
 * an SVG path `d`. Pointy-top, matching the lattice {@link svHexBin} bins onto.
 *
 * Returned centred so a caller positions it with a `translate`, which keeps one
 * path string for every bin instead of one per bin.
 */
export function svHexPath(radius: number): string {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error(`svHexPath: radius must be a finite number above zero, got ${radius}.`);
  }
  const step = Math.PI / 3;
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = i * step;
    points.push(`${round(Math.sin(angle) * radius)},${round(-Math.cos(angle) * radius)}`);
  }
  return `M${points.join('L')}Z`;
}

/**
 * Map a bin count onto one of `steps` density levels, `1` to `steps`.
 *
 * Linear in the count would be useless on the distribution these plots actually
 * have: one bin of 900 and a hundred bins of 1–5 is the normal shape of a cluster,
 * and linear shading paints all hundred of them the palest step and the whole plot
 * reads as empty. The scale is therefore logarithmic, which is what makes the
 * difference between 1 and 5 visible at the same time as the difference between
 * 100 and 900.
 *
 * A `max` of 1 (every bin holding one item) returns `1` for every bin rather than
 * dividing by a zero log range.
 */
export function svBinDensityStep(count: number, max: number, steps: number): number {
  if (!Number.isFinite(count) || count <= 0) return 1;
  if (!Number.isFinite(steps) || steps < 1) return 1;
  const top = Math.max(1, max);
  if (top <= 1) return 1;
  const fraction = Math.log(Math.min(count, top)) / Math.log(top);
  return Math.min(steps, Math.max(1, Math.ceil(fraction * steps)));
}

/** Trim float noise off a coordinate so the path strings stay short and stable. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
