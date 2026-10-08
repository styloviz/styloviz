import {
  svActivationThresholds,
  svPickActiveSection,
  svSectionSnapshot,
  type AnchorActivation,
  type SvSectionSnapshot,
} from './activation-strategy';

/**
 * ============================================================================
 *  Four readings of "current" — `NV-02-I1`, `NV-02-M1`
 * ============================================================================
 *
 * ⚠️ **jsdom has no layout.** `getBoundingClientRect()` is zeros and
 * `IntersectionObserver` never fires, so a test that scrolled a page and looked
 * at the rail would assert nothing. That is the reason the strategies take
 * numbers instead of elements: every degenerate case in the file's table is a
 * synthetic rect here, and the assertions pin *causes* rather than pixels.
 *
 * The band is the reader's screen below the sticky header — `{ top: 0 }` is the
 * activation line and `height: 800` is what is visible below it. The `visible`
 * flag is what the observer would have said about its own (narrower, `-68%`)
 * band, which is a different rectangle on purpose: the flag is the trigger, the
 * geometry is the answer.
 */

const BAND = { top: 0, height: 800 } as const;
/** The observed band the real component configures: the top ~32% below the line. */
const OBSERVED_BOTTOM = 256;

interface Fixture {
  readonly order: readonly string[];
  readonly snapshots: ReadonlyMap<string, SvSectionSnapshot>;
}

/**
 * Build a scene from `{ id, top, height }` rows, deriving each section's
 * `visible` flag the way a real observer would — intersecting `-68%` band.
 */
function scene(rows: readonly { id: string; top: number; height: number }[]): Fixture {
  const snapshots = new Map<string, SvSectionSnapshot>();
  for (const row of rows) {
    const intersects = row.top < OBSERVED_BOTTOM && row.top + row.height > 0;
    snapshots.set(row.id, svSectionSnapshot({ top: row.top, height: row.height }, BAND, intersects));
  }
  return { order: rows.map((r) => r.id), snapshots };
}

const pick = (f: Fixture, strategy: AnchorActivation): string | null =>
  svPickActiveSection(f.order, f.snapshots, strategy);

const ALL: readonly AnchorActivation[] = [
  'first-visible',
  'most-visible',
  'nearest-offset',
  'last-passed',
];

describe('svSectionSnapshot', () => {
  it('reports the top edge relative to the activation line, not the container', () => {
    const snapshot = svSectionSnapshot({ top: 120, height: 400 }, { top: 64, height: 736 }, true);
    expect(snapshot.top).toBe(56);
  });

  it('counts only the pixels inside the band', () => {
    // A 2000px section starting 400px above the line: 800 of the band's 800 are its.
    expect(svSectionSnapshot({ top: -400, height: 2000 }, BAND, true).visiblePx).toBe(800);
    // The same section scrolled until only its last 100px remain below the line.
    expect(svSectionSnapshot({ top: -1900, height: 2000 }, BAND, true).visiblePx).toBe(100);
  });

  it('never reports negative overlap for a section that is nowhere near the band', () => {
    expect(svSectionSnapshot({ top: -5000, height: 100 }, BAND, false).visiblePx).toBe(0);
    expect(svSectionSnapshot({ top: 5000, height: 100 }, BAND, false).visiblePx).toBe(0);
  });

  /** ⚠️ The jsdom/SSR case, and the one every geometric strategy has to survive. */
  it('marks a zero-height box at the origin as unmeasured', () => {
    expect(svSectionSnapshot({ top: 0, height: 0 }, BAND, true).measured).toBe(false);
    expect(svSectionSnapshot({ top: 0, height: 40 }, BAND, true).measured).toBe(true);
    expect(svSectionSnapshot({ top: 500, height: 0 }, BAND, true).measured).toBe(true);
  });

  /**
   * A partial test double and a serialized rect both hand back `undefined`, and
   * `NaN` propagates silently — every comparison against it is `false`, so the
   * rail would simply stop updating rather than fail.
   */
  it('does not let a missing rect field poison the geometry', () => {
    const snapshot = svSectionSnapshot(
      { top: 100 } as unknown as { top: number; height: number },
      BAND,
      true,
    );
    expect(snapshot.top).toBe(100);
    expect(Number.isNaN(snapshot.visiblePx)).toBe(false);
  });
});

describe('svPickActiveSection — the scenario the default changes', () => {
  /**
   * ★ **Heading-sized targets: the common docs setup, and where the old default
   * is wrong.** The rail points at bare `<h2 id>` headings, so each target is
   * ~40px tall with hundreds of px of body text between them. The reader is in
   * the middle of Usage's body; Usage's own heading scrolled past the line 300px
   * ago, and API's heading is 200px below the line — visible, but not reached.
   */
  const headings = scene([
    { id: 'intro', top: -600, height: 40 },
    { id: 'usage', top: -300, height: 40 },
    { id: 'api', top: 200, height: 40 },
  ]);

  it('activates the heading the reader passed, not the one they can see coming', () => {
    expect(pick(headings, 'last-passed')).toBe('usage');
  });

  it('is the observable difference from the old `threshold: 0` rule', () => {
    // The old rule: the first section the observer calls intersecting. Only API's
    // heading is inside the observed band, so the rail said API while the reader
    // was reading Usage.
    expect(pick(headings, 'first-visible')).toBe('api');
    expect(pick(headings, 'last-passed')).not.toBe(pick(headings, 'first-visible'));
  });

  /** Neither area-based strategy can help: 40px of heading is noise. */
  it('leaves the area strategies guessing on heading-sized targets', () => {
    expect(pick(headings, 'most-visible')).toBe('api');
    expect(pick(headings, 'nearest-offset')).toBe('api');
  });
});

describe('svPickActiveSection — the degenerate cases', () => {
  /**
   * A section taller than the viewport, scrolled into its middle. Everything
   * agrees here, which is exactly why the old default looked correct: with
   * wrapper `<section>` elements the two rules pick the same id, and the bug only
   * shows up on heading targets.
   */
  it('agrees on a section taller than the viewport', () => {
    const tall = scene([
      { id: 'intro', top: -2400, height: 2000 },
      { id: 'usage', top: -400, height: 2000 },
      { id: 'api', top: 1600, height: 2000 },
    ]);
    for (const strategy of ALL) expect(pick(tall, strategy)).toBe('usage');
  });

  /**
   * ★ `'nearest-offset'`'s own failure, documented in the table: late in a very
   * long section the *next* heading is the nearer edge, so the rail runs ahead of
   * the reader. `'last-passed'` does not, which is the other half of why it is
   * the default.
   */
  it('shows nearest-offset running ahead near the end of a long section', () => {
    const late = scene([
      { id: 'usage', top: -1200, height: 2000 },
      { id: 'api', top: 800, height: 2000 },
    ]);
    expect(pick(late, 'nearest-offset')).toBe('api');
    expect(pick(late, 'last-passed')).toBe('usage');
  });

  /**
   * ★ Nested sections: `'most-visible'` cannot ever pick the inner one, because
   * the outer box contains it and so always has at least as much area. The
   * backlog's phrasing suggests area resolves overlap; it does not.
   */
  it('shows most-visible unable to pick a nested section', () => {
    const nested = scene([
      { id: 'guide', top: -600, height: 3000 },
      { id: 'guide-api', top: -100, height: 600 },
    ]);
    expect(pick(nested, 'most-visible')).toBe('guide');
    expect(pick(nested, 'first-visible')).toBe('guide');
    // Both edge rules move to the inner section once its heading is passed.
    expect(pick(nested, 'last-passed')).toBe('guide-api');
    expect(pick(nested, 'nearest-offset')).toBe('guide-api');
  });

  /**
   * ⚠️ The bottom of the page, and the honest answer: `'last-passed'` does **not**
   * fix it. A final section shorter than the remaining viewport never gets its top
   * edge above the line, so the rail stays on the section before it — the same
   * outcome the old rule gave. `'nearest-offset'` is the only one of the four that
   * can reach it. `NV-02-I7` stays open.
   */
  it('cannot reach a short final section at maximum scroll, except by nearest-offset', () => {
    const atBottom = scene([
      { id: 'intro', top: -2000, height: 800 },
      { id: 'usage', top: -1200, height: 1960 },
      { id: 'api', top: 760, height: 40 },
    ]);
    expect(pick(atBottom, 'last-passed')).toBe('usage');
    expect(pick(atBottom, 'first-visible')).toBe('usage');
    expect(pick(atBottom, 'most-visible')).toBe('usage');
    expect(pick(atBottom, 'nearest-offset')).toBe('api');
  });

  /**
   * ★ The top of a page with a tall hero: no heading has been crossed and, with
   * the observed band only reaching 32% down, nothing is flagged either. The rail
   * must still name a section — a blank rail on first paint is the state readers
   * report as "the highlight is broken".
   */
  it('never leaves the rail blank while the page has layout', () => {
    const hero = scene([
      { id: 'intro', top: 300, height: 900 },
      { id: 'usage', top: 1200, height: 900 },
    ]);
    expect(hero.snapshots.get('intro')?.visible).toBe(false);
    expect(pick(hero, 'last-passed')).toBe('intro');
  });

  it('resolves an area tie in document order', () => {
    const tie = scene([
      { id: 'a', top: 0, height: 400 },
      { id: 'b', top: 400, height: 400 },
    ]);
    expect(pick(tie, 'most-visible')).toBe('a');
  });

  it('has no opinion about an empty list', () => {
    expect(svPickActiveSection([], new Map(), 'last-passed')).toBeNull();
  });
});

describe('svPickActiveSection — failing open with no layout', () => {
  /**
   * ★ The central constraint of this package's tests, asserted rather than
   * assumed: with every rect at zero the geometric strategies have nothing to
   * work with, and they must not answer "no section" (a rail with nothing lit)
   * or "every section". They degrade to the observer's flags, which need no
   * layout at all.
   */
  const noLayout = (visibleId: string | null): Fixture => {
    const order = ['intro', 'usage', 'api'];
    const snapshots = new Map<string, SvSectionSnapshot>();
    for (const id of order) {
      snapshots.set(id, svSectionSnapshot({ top: 0, height: 0 }, { top: 0, height: 0 }, id === visibleId));
    }
    return { order, snapshots };
  };

  it('answers with the flagged section for every strategy', () => {
    const f = noLayout('usage');
    for (const strategy of ALL) expect(pick(f, strategy)).toBe('usage');
  });

  it('keeps document order as the tie-break when several are flagged', () => {
    const order = ['intro', 'usage'];
    const snapshots = new Map<string, SvSectionSnapshot>(
      order.map((id) => [id, svSectionSnapshot({ top: 0, height: 0 }, BAND, true)]),
    );
    for (const strategy of ALL) expect(svPickActiveSection(order, snapshots, strategy)).toBe('intro');
  });

  it('returns no opinion — never every section — when nothing is flagged either', () => {
    const f = noLayout(null);
    for (const strategy of ALL) expect(pick(f, strategy)).toBeNull();
  });

  /** A page mid-hydration: some sections laid out, some not. The laid-out ones decide. */
  it('uses the sections that do have layout when only some do', () => {
    const order = ['intro', 'usage'];
    const snapshots = new Map<string, SvSectionSnapshot>([
      ['intro', svSectionSnapshot({ top: 0, height: 0 }, BAND, true)],
      ['usage', svSectionSnapshot({ top: -50, height: 900 }, BAND, true)],
    ]);
    expect(svPickActiveSection(order, snapshots, 'last-passed')).toBe('usage');
  });
});

describe('svActivationThresholds', () => {
  /**
   * The edge rules are exact because an edge crossing IS an intersection event.
   * The continuous ones have no such moment, so they are sampled — which is a
   * quality difference, not a preference, and why the default is an edge rule.
   */
  it('gives the edge strategies a single threshold', () => {
    expect(svActivationThresholds('last-passed')).toBe(0);
    expect(svActivationThresholds('first-visible')).toBe(0);
  });

  it('samples the continuous strategies', () => {
    expect(svActivationThresholds('most-visible')).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(svActivationThresholds('nearest-offset')).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
