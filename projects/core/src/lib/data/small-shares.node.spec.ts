/**
 * The long tail of a part-to-whole chart, and the order of it.
 *
 * ★ Both behaviours are off by default and both change what the reader is told
 *   the data is, so every case here is about the chart NOT quietly inventing a
 *   category or moving a slice for no reason.
 */
import { describe, expect, it } from 'vitest';
import {
  SV_OTHER_SHARE_COLOR,
  svGroupSmallShares,
  svOrderShares,
  svPrepareShares,
  svShareSummaryRows,
  type SvShareSlice,
} from './small-shares';

const slices = (...pairs: [string, number][]): SvShareSlice[] =>
  pairs.map(([label, value]) => ({ label, value }));

const total = (items: readonly SvShareSlice[]): number =>
  items.reduce((sum, s) => sum + s.value, 0);

describe('svGroupSmallShares', () => {
  const LONG_TAIL = slices(
    ['A', 50], ['B', 30], ['C', 12], ['D', 3], ['E', 2], ['F', 2], ['G', 1],
  );

  it('does nothing at all by default', () => {
    // Folding a host's categories together is a decision about their data.
    const out = svGroupSmallShares(LONG_TAIL, total(LONG_TAIL));
    expect(out.items).toBe(LONG_TAIL);
    expect(out.grouped).toBe(0);
    expect(out.notice).toBeNull();
  });

  it('folds everything under the share threshold into one slice', () => {
    const out = svGroupSmallShares(LONG_TAIL, total(LONG_TAIL), { minShare: 0.05 });
    expect(out.items.map(s => s.label)).toEqual(['A', 'B', 'C', 'Other']);
    expect(out.grouped).toBe(4);
    expect(out.groupedValue).toBe(8);
  });

  it('keeps the total intact', () => {
    // ★ The aggregate is a sum, not a sample: the pie still adds to 100%.
    const before = total(LONG_TAIL);
    const out = svGroupSmallShares(LONG_TAIL, before, { minShare: 0.05 });
    expect(total(out.items)).toBe(before);
  });

  it('never folds a single slice', () => {
    // ★ One slice inside an "Other" of one is the same slice with its name
    //   taken away — strictly worse than leaving it alone.
    const one = slices(['A', 60], ['B', 39], ['C', 1]);
    const out = svGroupSmallShares(one, total(one), { minShare: 0.05 });
    expect(out.items).toBe(one);
    expect(out.grouped).toBe(0);
  });

  it('caps the slice count and folds the remainder', () => {
    const out = svGroupSmallShares(LONG_TAIL, total(LONG_TAIL), { maxSlices: 3 });
    expect(out.items.map(s => s.label)).toEqual(['A', 'B', 'C', 'Other']);
    expect(out.grouped).toBe(4);
  });

  it('applies both thresholds together', () => {
    const out = svGroupSmallShares(LONG_TAIL, total(LONG_TAIL), {
      minShare: 0.05,
      maxSlices: 2,
    });
    expect(out.items.map(s => s.label)).toEqual(['A', 'B', 'Other']);
    expect(out.groupedValue).toBe(20);
  });

  it('puts the aggregate last, whatever the order of the survivors', () => {
    // ★ "Other" is not a category with a rank. Sorting it into the middle of
    //   the ring invites a comparison with a real one.
    const out = svGroupSmallShares(
      slices(['tiny', 1], ['big', 60], ['tiny2', 1], ['mid', 38]),
      100,
      { minShare: 0.05 },
    );
    expect(out.items[out.items.length - 1].label).toBe('Other');
    expect(out.items.map(s => s.label)).toEqual(['big', 'mid', 'Other']);
  });

  it('keeps the survivors in their original relative order', () => {
    const out = svGroupSmallShares(LONG_TAIL, total(LONG_TAIL), { minShare: 0.05 });
    expect(out.items.slice(0, 3).map(s => s.label)).toEqual(['A', 'B', 'C']);
  });

  it('says how many were folded and what they came to', () => {
    const out = svGroupSmallShares(LONG_TAIL, total(LONG_TAIL), { minShare: 0.05 })!;
    expect(out.notice).toContain('4 slices');
    expect(out.notice).toContain('8%');
    expect(out.notice).toContain('summary table for screen readers lists each one\'s value separately');
  });

  /**
   * ★★ The notice is visible and the table it mentions is not — it is clipped
   *    1×1 for assistive technology. So the sentence carries the names itself;
   *    a sighted reader is never sent looking for a table that is not drawn.
   */
  it('names the folded slices in the visible sentence', () => {
    const out = svGroupSmallShares(LONG_TAIL, total(LONG_TAIL), { minShare: 0.05 });
    expect(out.notice).toBe(
      '4 slices too small to read were combined into “Other”, 8% of the total: D, E, F and G. ' +
        'The summary table for screen readers lists each one\'s value separately.',
    );
  });

  it('counts the rest once the names would run long', () => {
    const many = slices(['Big', 900], ...Array.from({ length: 9 }, (_, i): [string, number] => [`t${i}`, 1]));
    const out = svGroupSmallShares(many, total(many), { minShare: 0.05 });
    expect(out.notice).toContain(': t0, t1, t2, t3, t4, t5 and 3 more.');
  });

  /**
   * ★★ Hosts send an "Other" category of their own. Folding the tail into a
   *    second "Other" drew two legend entries nobody could tell apart, and two
   *    marks every template tracks by label — NG0955.
   */
  it('never names the aggregate after a slice that survived the fold', () => {
    const own = slices(['A', 80], ['Other', 10], ['B', 4], ['C', 6]);
    const out = svGroupSmallShares(own, 100, { minShare: 0.07 });
    const labels = out.items.map(s => s.label);
    expect(labels).toEqual(['A', 'Other', 'Other — small slices']);
    expect(new Set(labels).size).toBe(labels.length);
    expect(out.notice).toContain('combined into “Other — small slices”');
  });

  it('keeps the requested name when only a folded slice shares it', () => {
    const own = slices(['A', 90], ['Other', 5], ['B', 5]);
    const out = svGroupSmallShares(own, 100, { minShare: 0.06 });
    expect(out.items.map(s => s.label)).toEqual(['A', 'Other']);
  });

  it('draws the aggregate in a neutral that clears 3:1 in both themes', () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    // White and gray-50 cards in light; gray-800 and gray-900 in dark.
    for (const surface of ['#ffffff', '#f9fafb', '#1f2937', '#111827']) {
      expect(ratio(SV_OTHER_SHARE_COLOR, surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it('honours a custom label and colour', () => {
    const out = svGroupSmallShares(LONG_TAIL, total(LONG_TAIL), {
      minShare: 0.05,
      label: 'All other regions',
      color: '#94a3b8',
    });
    const last = out.items[out.items.length - 1];
    expect(last.label).toBe('All other regions');
    expect(last.color).toBe('#94a3b8');
    expect(out.notice).toContain('All other regions');
  });

  /**
   * ★★ The aggregate used to be spread from the first slice it folded, so it
   *    came out in THAT slice's colour and with its other fields — on the radius
   *    pie, its emphasis. The picture then showed one real category twice.
   */
  it('gives the aggregate a neutral colour and none of a folded slice\'s fields', () => {
    interface Rich extends SvShareSlice {
      readonly radius?: number;
      readonly description?: string;
    }
    const rich: Rich[] = [
      { label: 'A', value: 60, color: '#ff0000', radius: 1 },
      { label: 'B', value: 36, color: '#00ff00', radius: 0.9 },
      { label: 'C', value: 2, color: '#0000ff', radius: 0.5, description: 'tiny' },
      { label: 'D', value: 2, color: '#123456', radius: 0.6 },
    ];
    const out = svGroupSmallShares(rich, 100, { minShare: 0.05 });
    const other = out.items[out.items.length - 1];
    expect(other).toEqual({ label: 'Other', value: 4, color: SV_OTHER_SHARE_COLOR });
    expect(other.color).not.toBe('#0000ff');
    expect(other.radius).toBeUndefined();
    expect(other.description).toBeUndefined();
  });

  it('hands back the aggregate and exactly the slices it folded', () => {
    const out = svGroupSmallShares(LONG_TAIL, total(LONG_TAIL), { minShare: 0.05 });
    expect(out.other).toBe(out.items[out.items.length - 1]);
    expect(out.folded.map(s => s.label)).toEqual(['D', 'E', 'F', 'G']);
    // The very objects the host passed, so a row can be traced back to its datum.
    expect(out.folded[0]).toBe(LONG_TAIL[3]);
  });

  it('reports no aggregate and nothing folded when it folds nothing', () => {
    const out = svGroupSmallShares(LONG_TAIL, total(LONG_TAIL));
    expect(out.other).toBeNull();
    expect(out.folded).toEqual([]);
  });

  it('leaves an empty or zero-total set alone', () => {
    expect(svGroupSmallShares([], 0, { minShare: 0.1 }).items).toEqual([]);
    const zeros = slices(['A', 0], ['B', 0]);
    expect(svGroupSmallShares(zeros, 0, { minShare: 0.1 }).items).toBe(zeros);
  });

  it('ignores a threshold that means nothing', () => {
    for (const minShare of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(svGroupSmallShares(LONG_TAIL, total(LONG_TAIL), { minShare }).grouped).toBe(0);
    }
  });

  it('folds nothing when every slice clears the threshold', () => {
    const even = slices(['A', 25], ['B', 25], ['C', 25], ['D', 25]);
    expect(svGroupSmallShares(even, 100, { minShare: 0.1 }).items).toBe(even);
  });

  it('folds everything when nothing clears it, rather than drawing an empty chart', () => {
    const flat = slices(['A', 1], ['B', 1], ['C', 1], ['D', 1]);
    const out = svGroupSmallShares(flat, 4, { minShare: 0.9 });
    expect(out.items.map(s => s.label)).toEqual(['Other']);
    expect(out.groupedValue).toBe(4);
  });
});

describe('svOrderShares', () => {
  const UNSORTED = slices(['A', 10], ['B', 50], ['C', 30]);

  it('leaves input order alone', () => {
    expect(svOrderShares(UNSORTED, 'input')).toBe(UNSORTED);
  });

  it('sorts largest first', () => {
    // The convention a pie is easiest to read in: the eye compares neighbours
    // rather than arcs on opposite sides of the circle.
    expect(svOrderShares(UNSORTED, 'value').map(s => s.label)).toEqual(['B', 'C', 'A']);
  });

  it('breaks a tie by input position rather than by sort internals', () => {
    // ★ Two equal slices swapping places between renders is a picture that
    //   moves for no reason.
    const tied = slices(['first', 20], ['second', 20], ['third', 20]);
    expect(svOrderShares(tied, 'value').map(s => s.label)).toEqual([
      'first', 'second', 'third',
    ]);
  });

  it('returns the same array when there is nothing to reorder', () => {
    const one = slices(['only', 1]);
    expect(svOrderShares(one, 'value')).toBe(one);
    expect(svOrderShares([], 'value')).toEqual([]);
  });

  it('does not mutate the input', () => {
    const original = [...UNSORTED];
    svOrderShares(UNSORTED, 'value');
    expect(UNSORTED).toEqual(original);
  });

  it('is stable across repeated calls', () => {
    const first = svOrderShares(UNSORTED, 'value').map(s => s.label);
    for (let i = 0; i < 5; i++) {
      expect(svOrderShares(UNSORTED, 'value').map(s => s.label)).toEqual(first);
    }
  });
});

/**
 * ★★★ The fold notice says "The summary table lists them separately". Every
 *     table was built from the drawn slices, so it listed one `Other` row and
 *     nothing under it. These rows are what makes the sentence true.
 */
describe('svShareSummaryRows', () => {
  const LONG_TAIL = slices(
    ['A', 50], ['B', 30], ['C', 12], ['D', 3], ['E', 2], ['F', 2], ['G', 1],
  );
  const cells = (s: SvShareSlice) => [String(s.value), `${s.value}%`];

  it('is one row per drawn slice when nothing was folded', () => {
    const prepared = svPrepareShares(LONG_TAIL, 100, null);
    const rows = svShareSummaryRows(prepared, cells);
    expect(rows.map(r => r.header)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(rows[0]).toEqual({ key: 'A', header: 'A', cells: ['50', '50%'] });
  });

  it('lists every folded slice under the aggregate, marked as grouped', () => {
    const prepared = svPrepareShares(LONG_TAIL, 100, null, { minShare: 0.05 });
    // The notice this row list exists to make true.
    expect(prepared.notice).toContain('summary table for screen readers lists each one\'s value separately');

    const rows = svShareSummaryRows(prepared, cells);
    expect(rows.map(r => [r.header, ...r.cells])).toEqual([
      ['A', '50', '50%'],
      ['B', '30', '30%'],
      ['C', '12', '12%'],
      ['Other (4 combined)', '8', '8%'],
      ['D (in Other)', '3', '3%'],
      ['E (in Other)', '2', '2%'],
      ['F (in Other)', '2', '2%'],
      ['G (in Other)', '1', '1%'],
    ]);
  });

  it('names a custom aggregate in the grouped rows', () => {
    const prepared = svPrepareShares(LONG_TAIL, 100, null, {
      minShare: 0.05,
      label: 'Rest',
    });
    const headers = svShareSummaryRows(prepared, cells).map(r => r.header);
    expect(headers).toContain('Rest (4 combined)');
    expect(headers).toContain('G (in Rest)');
  });

  it('keys every row uniquely, even when a folded slice shares the aggregate\'s label', () => {
    const clash = slices(['A', 90], ['Other', 5], ['B', 5]);
    const prepared = svPrepareShares(clash, 100, null, { minShare: 0.06 });
    const keys = svShareSummaryRows(prepared, cells).map(r => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keys duplicate host labels apart, keeping the first key as the label', () => {
    const dupes = slices(['Direct', 60], ['Direct', 40]);
    const rows = svShareSummaryRows(svPrepareShares(dupes, 100, null), cells);
    expect(rows.map(r => r.header)).toEqual(['Direct', 'Direct']);
    expect(rows.map(r => r.key)).toEqual(['Direct', 'Direct#2']);
  });

  it('keeps the folded rows in the order the fold met them, under a value sort', () => {
    const unsorted = slices(['tiny', 1], ['big', 60], ['small', 2], ['mid', 37]);
    const prepared = svPrepareShares(unsorted, 100, null, { order: 'value', minShare: 0.05 });
    expect(svShareSummaryRows(prepared, cells).map(r => r.header)).toEqual([
      'big', 'mid', 'Other (2 combined)', 'small (in Other)', 'tiny (in Other)',
    ]);
  });
});
