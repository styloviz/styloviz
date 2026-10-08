/**
 * ============================================================================
 *  Which section is "current" — `NV-02-I1`, `NV-02-M1`
 * ============================================================================
 *
 * There is no correct answer, only chosen ones. Four cases break the intuition
 * that exactly one section is current, and no single rule survives all four:
 *
 * | Degenerate case | `first-visible` | `most-visible` | `nearest-offset` | `last-passed` |
 * |---|---|---|---|---|
 * | **Heading-sized targets** (`<h2 id>`, no wrapper) | ✗ activates the next heading while it is still a third of a viewport below the line, and holds a stale id in between | ✗ same sampling problem, and "most of 40px" is noise | ~ flips at the midpoint between two headings, so it runs ahead near the end of a long section | ✓ flips exactly when a heading crosses the line |
 * | **Sections taller than the viewport** | ✓ | ✓ | ✗ the heading is far above the line for most of the section, so the *next* heading becomes nearest long before the reader reaches it | ✓ |
 * | **Overlapping / nested sections** | ~ the outer always wins, because it starts first | ✗ the outer always wins too — its box *contains* the inner's, so it can never have less area on screen | ~ the inner wins from its own heading onward, since its top edge is the nearer one | ~ the inner wins from its heading onward, and does not hand back when the reader returns to the outer section's own text |
 * | **Sections that change size after paint** | ✓ nothing is cached | ✓ re-measured per event | ✓ re-measured per event | ✓ re-measured per event |
 * | **Reaching the bottom of the page** | ✗ a final section shorter than the band never reaches it — the id goes stale | ✗ a short final section never wins on area | ✓ the only one that can reach it, since the last heading does become the nearest | ✗ a final section whose heading never crosses the line never activates (`NV-02-I7`) |
 *
 * ★ **Nothing here is cached between events.** Every snapshot is re-measured
 * from the element on each intersection callback rather than read out of the
 * `IntersectionObserverEntry`, and that is not an optimisation detail — it is
 * what makes `last-passed` possible at all. An entry's `boundingClientRect` is
 * frozen at the moment of the crossing that produced it, and a section's top
 * edge crosses the activation line *without crossing a threshold* whenever the
 * section is taller than the band. Read from entries, "last heading passed"
 * lags by the full height of the band; re-measured, it is exact.
 *
 * The logic below is deliberately pure and total: it takes numbers, not
 * elements, so every one of the cases above is a unit test with synthetic rects
 * rather than a browser. `scroll-spy.ts` owns the observer that feeds it.
 */

/** Which reading of "current" a scrollspy applies. See the table above. */
export type AnchorActivation =
  /** The first section (document order) the observer reports inside the band. */
  | 'first-visible'
  /** The section occupying the most pixels of the band. */
  | 'most-visible'
  /** The section whose top edge is closest to the activation line. */
  | 'nearest-offset'
  /** The last section (document order) whose top edge has crossed the line. */
  | 'last-passed';

/**
 * The part of a rect this file needs. `DOMRect` satisfies it, and so does an
 * object literal — which is the point, because jsdom has no layout and every
 * real rect it produces is zeros.
 */
export interface SvVerticalRect {
  readonly top: number;
  readonly height: number;
}

/** One section as the strategies see it. All values are px. */
export interface SvSectionSnapshot {
  /** The observer's own verdict — `entry.isIntersecting`. Needs no layout. */
  readonly visible: boolean;
  /**
   * The section's top edge relative to the activation line. Negative means the
   * reader has scrolled past this heading.
   */
  readonly top: number;
  /** How much of the section is inside the band. */
  readonly visiblePx: number;
  /**
   * Whether `top`/`visiblePx` mean anything. `false` under jsdom, during SSR,
   * and for a section that has not been laid out yet — see
   * {@link svPickActiveSection} for what happens then.
   */
  readonly measured: boolean;
}

/**
 * Turn one section rect into a snapshot, relative to `band`.
 *
 * `band.top` is the **activation line** — the top of the scroll container plus
 * whatever the host reserved for a sticky header — and `band.height` is how much
 * of the container is below it. Both come from the caller, so the offset that
 * positions the line is the same number the component already uses for its
 * jumps; there is no second one to keep in sync.
 */
export function svSectionSnapshot(
  rect: SvVerticalRect,
  band: SvVerticalRect,
  visible: boolean,
): SvSectionSnapshot {
  const top = finite(rect.top);
  const height = finite(rect.height);
  const bandTop = finite(band.top);
  const bandBottom = bandTop + finite(band.height);

  const overlap = Math.min(top + height, bandBottom) - Math.max(top, bandTop);

  return {
    visible,
    top: top - bandTop,
    visiblePx: Math.max(0, overlap),
    // A zero-height box at y=0 is what an unlaid-out element reports, and it is
    // indistinguishable from a real one — so it is treated as unmeasured. The
    // cost of being wrong here is one strategy degrading to `first-visible`;
    // the cost of trusting it is every section claiming to sit exactly on the
    // line at once.
    measured: height > 0 || top !== 0,
  };
}

/**
 * Pick the current section, or `null` for "no opinion" — which the caller
 * should read as *keep whatever was current*, not as *nothing is current*.
 *
 * ★ **Fails open to the observer's flags.** Every geometric strategy needs
 * layout, and there are two ordinary situations with none: a server render and a
 * jsdom test. Rather than answer "no section" (a rail with nothing highlighted)
 * or "every section" (a rail with everything highlighted), an unmeasured page
 * falls back to `first-visible`, which is derived from `isIntersecting` alone and
 * needs no numbers at all. The component is then less precise, never broken.
 *
 * @param order  Section ids in document order. Ties resolve to the earlier one.
 * @param snapshots Per-id geometry. Ids missing from it are simply not candidates.
 */
export function svPickActiveSection(
  order: readonly string[],
  snapshots: ReadonlyMap<string, SvSectionSnapshot>,
  strategy: AnchorActivation,
): string | null {
  if (order.length === 0) return null;

  // `first-visible` IS the flag rule, so it is also the fallback every other
  // strategy lands on — one code path, not a copy per branch.
  if (strategy === 'first-visible') return firstVisible(order, snapshots);

  const measured = order.filter((id) => snapshots.get(id)?.measured === true);
  if (measured.length === 0) return firstVisible(order, snapshots);

  switch (strategy) {
    case 'most-visible':
      return bestOf(measured, snapshots, (s) => s.visiblePx, 'max') ?? firstVisible(order, snapshots);
    case 'nearest-offset':
      return bestOf(measured, snapshots, (s) => Math.abs(s.top), 'min') ?? firstVisible(order, snapshots);
    case 'last-passed': {
      // Document order, so the last match is the most recently crossed heading.
      // A section is "passed" the moment its top edge reaches the line, which is
      // also the moment the previous section's bottom edge leaves it.
      let passed: string | null = null;
      for (const id of measured) {
        if ((snapshots.get(id) as SvSectionSnapshot).top <= 0) passed = id;
      }
      // Nothing crossed yet — the reader is above the first heading, in a hero or
      // a page title. Whatever is on screen is the honest answer; failing that,
      // the section they are heading towards. ★ Which means `'last-passed'` on a
      // page with layout always names a section: the rail is never blank while
      // there is something to be reading.
      return passed ?? firstVisible(order, snapshots) ?? measured[0];
    }
  }
}

/**
 * How many intersection thresholds a strategy needs.
 *
 * `first-visible` and `last-passed` only care about edges crossing the band, and
 * `0` reports exactly those. `most-visible` and `nearest-offset` are continuous
 * functions of the scroll position with no edge to hang a callback on, so they
 * are sampled — more thresholds, still an approximation between them. That is a
 * real difference in quality, and it is why the default is an edge rule.
 */
export function svActivationThresholds(strategy: AnchorActivation): number | readonly number[] {
  return strategy === 'most-visible' || strategy === 'nearest-offset'
    ? [0, 0.25, 0.5, 0.75, 1]
    : 0;
}

/** The pre-existing rule: topmost section the observer calls intersecting. */
function firstVisible(
  order: readonly string[],
  snapshots: ReadonlyMap<string, SvSectionSnapshot>,
): string | null {
  for (const id of order) {
    if (snapshots.get(id)?.visible === true) return id;
  }
  return null;
}

/** Extremum with document order as the tie-break, so the answer is stable. */
function bestOf(
  ids: readonly string[],
  snapshots: ReadonlyMap<string, SvSectionSnapshot>,
  score: (snapshot: SvSectionSnapshot) => number,
  pick: 'min' | 'max',
): string | null {
  let winner: string | null = null;
  let best = pick === 'max' ? 0 : Number.POSITIVE_INFINITY;

  for (const id of ids) {
    const value = score(snapshots.get(id) as SvSectionSnapshot);
    // Strict comparison keeps the earlier id on a tie.
    if (pick === 'max' ? value > best : value < best) {
      best = value;
      winner = id;
    }
  }
  return winner;
}

/**
 * `DOMRect`'s fields are numbers by contract, but a partial test double or a
 * serialized rect hands back `undefined`, and `undefined - 0` poisons every
 * comparison downstream with `NaN` — silently, since every `NaN` comparison is
 * `false` and the rail simply stops updating.
 */
function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
