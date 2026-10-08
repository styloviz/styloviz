import {
  svApplyValuePolicy,
  svIsPlottableShare,
  svResolveShares,
  type SvValuePolicy,
} from './value-policy';

/**
 * `.node.spec.ts`, not `.spec.ts`: this is arithmetic over plain objects with no
 * TestBed, no DOM and no timers, so `vitest.config.ts` routes it to the
 * setup-free `node` project. See `X-4` — files that need nothing jsdom provides
 * were each holding a whole jsdom worker to themselves.
 */

interface Slice {
  readonly label: string;
  readonly value: number;
}

const SLICES: readonly Slice[] = [
  { label: 'a', value: 10 },
  { label: 'b', value: -5 },
  { label: 'c', value: 20 },
];

const ALL: readonly SvValuePolicy[] = ['render', 'clamp', 'omit', 'reject'];

function apply(items: readonly Slice[], policy: SvValuePolicy, over = ALL) {
  return svApplyValuePolicy(items, {
    value: (s) => s.value,
    clamp: (s, to) => ({ ...s, value: to }),
    policy,
    supported: over,
    fallback: 'omit',
    selector: 'sv-test-chart',
    noun: 'slice',
  });
}

describe('svApplyValuePolicy — the untouched case', () => {
  it('returns the very same array when every value is plottable', () => {
    const clean: readonly Slice[] = [{ label: 'a', value: 1 }];
    const result = apply(clean, 'omit');
    // Identity, not equality. A host's `[slices]` reference has to survive, or
    // every render allocates a new array and OnPush sees a change that isn't one.
    expect(result.items).toBe(clean);
    expect(result.notice).toBeNull();
    expect(result.error).toBeNull();
    expect(result.omitted).toBe(0);
    expect(result.clamped.size).toBe(0);
  });

  it('says nothing when there is nothing to say', () => {
    // The disclosure is only honest if its absence is also meaningful.
    expect(apply([], 'clamp').notice).toBeNull();
    expect(apply([{ label: 'a', value: 0 }], 'clamp').notice).toBeNull();
  });
});

describe('svApplyValuePolicy — omit', () => {
  it('drops the unplottable ones and counts them', () => {
    const result = apply(SLICES, 'omit');
    expect(result.items.map((s) => s.label)).toEqual(['a', 'c']);
    expect(result.omitted).toBe(1);
  });

  it('discloses the count AND that the percentages moved', () => {
    // The second half is the part that matters. Dropping -5 changes the
    // denominator from 25 to 30, so every remaining slice's percentage is
    // different from what it would have been — a reader comparing this chart to
    // a table needs to know which total the percentages are of.
    const notice = apply(SLICES, 'omit').notice!;
    expect(notice).toContain('1 slice not shown');
    expect(notice).toContain('-5');
    expect(notice).toContain('remaining 2 slices');
  });

  it('pluralises both counts', () => {
    const many = [...SLICES, { label: 'd', value: -1 }];
    const notice = apply(many, 'omit').notice!;
    expect(notice).toContain('2 slices not shown');
    expect(notice).toContain('remaining 2 slices');
  });
});

describe('svApplyValuePolicy — clamp', () => {
  it('replaces the value and reports which item to mark', () => {
    const result = apply(SLICES, 'clamp');
    expect(result.items.map((s) => s.value)).toEqual([10, 0, 20]);
    expect(result.omitted).toBe(0);

    // The marker is looked up per datum while rendering, so what the set holds
    // has to be the object the template iterates — the REPLACEMENT, not the
    // original the host passed.
    expect(result.clamped.size).toBe(1);
    expect(result.clamped.has(result.items[1])).toBe(true);
    expect(result.clamped.has(SLICES[1])).toBe(false);
  });

  it('leaves the host array alone', () => {
    apply(SLICES, 'clamp');
    expect(SLICES[1].value).toBe(-5);
  });

  it('discloses the real value, not just that something was clamped', () => {
    const notice = apply(SLICES, 'clamp').notice!;
    expect(notice).toContain('1 slice');
    expect(notice).toContain('-5');
    expect(notice).toContain('0');
  });
});

describe('svApplyValuePolicy — render', () => {
  it('alters nothing, and still discloses', () => {
    const result = apply(SLICES, 'render');
    expect(result.items).toBe(SLICES);
    expect(result.clamped.size).toBe(0);
    expect(result.omitted).toBe(0);
    // A chart that can draw an unplottable datum draws it as something the
    // reader has not seen before — a hatch, a gap. That needs a legend, or it
    // is honest and cryptic at the same time.
    expect(result.notice).toContain('1 slice');
    expect(result.notice).toContain('missing');
  });
});

describe('svApplyValuePolicy — reject', () => {
  it('plots nothing and hands back an error the chart can show', () => {
    const result = apply(SLICES, 'reject');
    expect(result.items).toEqual([]);
    expect(result.notice).toBeNull();
    expect(result.error?.code).toBe('SV_UNPLOTTABLE_VALUE');
    expect(result.error?.message).toContain('-5');
    // Nothing about the dataset changes on a retry, so offering one is a loop.
    expect(result.error?.retryable).toBe(false);
  });
});

describe('svApplyValuePolicy — a policy the chart cannot carry out', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back rather than pretending, and says so once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // There is no Angular in this project, so `ngDevMode` is undefined rather
    // than true — the same state as a production bundle. The dev-only branch has
    // to be opted into explicitly here.
    vi.stubGlobal('ngDevMode', true);
    try {
      // A zero-based bar has no room below its baseline, so `render` is not a
      // behaviour it has. Silently substituting one would be the exact failure
      // X-7 is about, so the substitution is announced.
      const result = apply(SLICES, 'render', ['clamp', 'omit', 'reject']);
      expect(result.items.map((s) => s.label)).toEqual(['a', 'c']);
      expect(result.omitted).toBe(1);

      expect(warn).toHaveBeenCalledTimes(1);
      const message = warn.mock.calls[0][0] as string;
      expect(message).toContain("does not support the 'render' value policy");
      expect(message).toContain("Using 'omit'");
      expect(message).toContain("'clamp', 'omit', 'reject'");

      // Once per selector per reason: a 300-cell heatmap must not log 300 times.
      apply(SLICES, 'render', ['clamp', 'omit', 'reject']);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('falls back identically, and silently, in a production build', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('ngDevMode', false);
    try {
      // The behaviour must not depend on the build mode — only the logging does.
      // A chart that silently substituted a policy in dev and a DIFFERENT one in
      // production would be the worst of both.
      const result = svApplyValuePolicy(SLICES, {
        value: (s) => s.value,
        clamp: (s, to) => ({ ...s, value: to }),
        policy: 'reject',
        supported: ['clamp'],
        fallback: 'clamp',
        selector: 'sv-prod-chart',
        noun: 'slice',
      });
      expect(result.items.map((s) => s.value)).toEqual([10, 0, 20]);
      expect(result.notice).toContain('1 slice');
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('svApplyValuePolicy — how the disclosure names the value', () => {
  it('calls an absence an absence rather than quoting "NaN"', () => {
    // `${NaN}` is the string "NaN", so the sentence read "for example NaN" and
    // told the reader the chart had received a measurement it disliked. It had
    // received nothing: NaN is what `Number(cell)` gives for a blank source cell.
    const missing = apply([{ label: 'a', value: 10 }, { label: 'b', value: NaN }], 'clamp');
    expect(missing.notice).toContain('a missing value');
    expect(missing.notice).not.toContain('NaN');

    const unbounded = apply([{ label: 'a', value: Infinity }], 'omit');
    expect(unbounded.notice).toContain('an unbounded value');
    expect(unbounded.notice).not.toContain('Infinity');
  });

  it('quotes a real number as itself, since that is what the source says', () => {
    expect(apply(SLICES, 'clamp').notice).toContain('-5');
  });

  it('agrees with itself about how many there are', () => {
    // "1 bar shown at 0 rather than their real value (for example -5)" was three
    // grammatical errors in one sentence, and it is the sentence a reader is most
    // likely to be reading closely.
    const one = apply([{ label: 'a', value: -5 }], 'clamp').notice!;
    expect(one).toContain('1 slice shown at 0 rather than its real value (-5)');
    expect(one).not.toContain('for example');

    const two = apply([{ label: 'a', value: -5 }, { label: 'b', value: -9 }], 'clamp').notice!;
    expect(two).toContain('2 slices');
    expect(two).toContain('their real value (for example -5)');
  });
});

describe('svApplyValuePolicy — what counts as plottable', () => {
  it('rejects the values that break a share-of-total chart, and only those', () => {
    expect(svIsPlottableShare(0)).toBe(true);
    expect(svIsPlottableShare(0.001)).toBe(true);
    expect(svIsPlottableShare(-0.001)).toBe(false);
    // NaN is what a host's `Number(row.amount)` produces from a blank cell, and
    // Infinity is what a division by a zero denominator produces. Both reach the
    // arithmetic and turn a path's `d` into "MNaN,NaN", which renders nothing.
    expect(svIsPlottableShare(NaN)).toBe(false);
    expect(svIsPlottableShare(Infinity)).toBe(false);
    expect(svIsPlottableShare(-Infinity)).toBe(false);
  });

  it('takes the chart’s own predicate when the default does not fit', () => {
    // A heatmap plots a colour ramp, not a share, so -12 °C is perfectly
    // plottable there and only a missing reading is not.
    const cells = [{ label: 'a', value: -12 }, { label: 'b', value: NaN }];
    const result = svApplyValuePolicy(cells, {
      value: (c) => c.value,
      clamp: (c, to) => ({ ...c, value: to }),
      policy: 'render',
      supported: ['render', 'omit'],
      fallback: 'omit',
      selector: 'sv-heatmap-chart',
      noun: 'cell',
      plottable: (v) => Number.isFinite(v),
    });
    expect(result.items).toBe(cells);
    expect(result.notice).toContain('1 cell');
  });

  it('clamps to the value the chart names, not always to zero', () => {
    const result = svApplyValuePolicy([{ label: 'a', value: -5 }], {
      value: (s) => s.value,
      clamp: (s, to) => ({ ...s, value: to }),
      policy: 'clamp',
      supported: ['clamp'],
      fallback: 'clamp',
      selector: 'sv-gauge',
      noun: 'reading',
      clampTo: 1,
    });
    expect(result.items[0].value).toBe(1);
    expect(result.notice).toContain('at 1 rather than');
  });
});

/**
 * The seven share-of-total components used to each divide by their own raw sum.
 * These are the two datasets that made that wrong, written as the arithmetic the
 * charts actually do — degrees per slice — because "the total is 5" reads as
 * harmless and "the first slice sweeps 720°" does not.
 */
describe('svResolveShares — the denominator', () => {
  const degrees = <T extends { value: number }>(items: readonly T[], total: number) =>
    items.map((i) => (total ? (i.value / total) * 360 : 0));

  it('never divides by a sum that includes a value it did not plot', () => {
    const raw = [
      { label: 'a', value: 10 },
      { label: 'b', value: -5 },
    ];
    const rawTotal = raw.reduce((s, x) => s + x.value, 0);
    expect(rawTotal).toBe(5);
    // What the charts drew: one slice twice around the circle, over the other.
    expect(degrees(raw, rawTotal)[0]).toBe(720);

    const resolved = svResolveShares(raw, 'omit', 'sv-pie');
    expect(resolved.total).toBe(10);
    expect(degrees(resolved.items, resolved.total)).toEqual([360]);
    expect(resolved.notice).toContain('1 slice not shown');
  });

  it('tells all-zero apart from no-data, since only one of them is a fetch problem', () => {
    // `[5, -5]` summed to 0, which every pie read as "nothing to plot" and drew
    // as the empty state — over two non-zero values it had been handed.
    const cancelling = svResolveShares(
      [
        { label: 'a', value: 5 },
        { label: 'b', value: -5 },
      ],
      'omit',
      'sv-pie',
    );
    expect(cancelling.total).toBe(5);
    expect(cancelling.allZero).toBe(false);

    const zeros = svResolveShares(
      [
        { label: 'a', value: 0 },
        { label: 'b', value: 0 },
      ],
      'omit',
      'sv-pie',
    );
    expect(zeros.total).toBe(0);
    expect(zeros.allZero).toBe(true);
    expect(zeros.notice).toContain('Every one of the 2 slices is zero');

    const nothing = svResolveShares([], 'omit', 'sv-pie');
    expect(nothing.allZero).toBe(false);
    expect(nothing.notice).toBeNull();
  });

  it('reports both facts when a dataset manages both', () => {
    const both = svResolveShares(
      [
        { label: 'a', value: 0 },
        { label: 'b', value: -3 },
      ],
      'omit',
      'sv-pie',
    );
    expect(both.items.map((s) => s.label)).toEqual(['a']);
    expect(both.allZero).toBe(true);
    expect(both.notice).toContain('1 slice not shown');
    expect(both.notice).toContain('is zero');
  });

  it('refuses `render`, because a circle cannot draw a negative arc', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('ngDevMode', true);
    try {
      const result = svResolveShares(
        [
          { label: 'a', value: 4 },
          { label: 'b', value: -1 },
        ],
        'render',
        'sv-donut',
      );
      expect(result.items.map((s) => s.label)).toEqual(['a']);
      expect(warn.mock.calls[0][0]).toContain("does not support the 'render' value policy");
    } finally {
      warn.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  /**
   * ★★ `clamp` promises a marker ("Marked in the plot."), and a share chart has
   *    nothing to put one on: the clamped slice is a 0° arc. Every pie, donut and
   *    polar chart used to accept it and then assert a marker it never drew.
   */
  it('refuses `clamp`, because a 0° arc cannot carry the marker clamp promises', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('ngDevMode', true);
    try {
      const result = svResolveShares(
        [
          { label: 'a', value: 4 },
          { label: 'b', value: -1 },
        ],
        'clamp',
        'sv-donut-clamp',
      );
      // Falls back to the documented default, `omit`.
      expect(result.items.map((s) => s.label)).toEqual(['a']);
      expect(result.clamped.size).toBe(0);
      expect(result.total).toBe(4);
      expect(result.notice).toContain('1 slice not shown');
      expect(result.notice).not.toContain('Marked in the plot');
      expect(warn.mock.calls[0][0]).toContain("does not support the 'clamp' value policy");
      expect(warn.mock.calls[0][0]).toContain("Supported here: 'omit', 'reject'.");
    } finally {
      warn.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('still honours `reject` and `omit`', () => {
    const bad = [
      { label: 'a', value: 4 },
      { label: 'b', value: Number.NaN },
    ];
    expect(svResolveShares(bad, 'reject', 'sv-pie').error?.code).toBe('SV_UNPLOTTABLE_VALUE');
    expect(svResolveShares(bad, 'omit', 'sv-pie').items.map((s) => s.label)).toEqual(['a']);
  });

  it('names the datum the way the chart does', () => {
    const result = svResolveShares([{ label: 'a', value: -1 }], 'omit', 'sv-treemap', 'tile');
    expect(result.notice).toContain('1 tile not shown');
  });
});
