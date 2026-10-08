/**
 * The bounded history and the pause disclosure, without a DOM.
 *
 * `createVisibilityPause` needs an injection context and a `document`, so it is
 * covered in `live-feed.spec.ts`. What is here is the pure arithmetic every
 * streaming chart was doing six different ways.
 */
import { describe, expect, it } from 'vitest';
import { svAppendSample, svPauseNotice } from './live-feed';

interface Sample {
  readonly t: number;
  readonly v: number;
}

const at = (t: number, v = t): Sample => ({ t, v });
const stamp = (s: unknown): number => (s as Sample).t;

describe('svAppendSample — bounded history', () => {
  it('appends to the end', () => {
    const out = svAppendSample([at(1), at(2)], at(3));
    expect(out.samples.map(stamp)).toEqual([1, 2, 3]);
    expect(out.evicted).toBe(0);
  });

  it('keeps exactly `retain` samples, counting the result', () => {
    // ★ Off by one here is a chart that slowly grows past the window its own
    //   axis is drawn for.
    const out = svAppendSample([at(1), at(2), at(3)], at(4), { retain: 3 });
    expect(out.samples.map(stamp)).toEqual([2, 3, 4]);
    expect(out.samples).toHaveLength(3);
    expect(out.evicted).toBe(1);
  });

  it('evicts more than one when the history is already over the window', () => {
    const out = svAppendSample([at(1), at(2), at(3), at(4)], at(5), { retain: 2 });
    expect(out.samples.map(stamp)).toEqual([4, 5]);
    expect(out.evicted).toBe(3);
  });

  it('is unbounded by default', () => {
    let history: readonly Sample[] = [];
    for (let i = 0; i < 200; i++) history = svAppendSample(history, at(i)).samples;
    expect(history).toHaveLength(200);
  });

  it('starts from an empty history', () => {
    expect(svAppendSample([], at(1)).samples.map(stamp)).toEqual([1]);
  });
});

describe('svAppendSample — a sample that is not newer', () => {
  const history = [at(10), at(20), at(30)];

  it('keeps arrival order by default, because position IS the order', () => {
    // Right for a feed whose timestamps mean nothing.
    const out = svAppendSample(history, at(15), { timestamp: stamp });
    expect(out.samples.map(stamp)).toEqual([10, 20, 30, 15]);
    expect(out.dropped).toBe(false);
    expect(out.reordered).toBe(false);
  });

  it('refuses a late sample under `drop`', () => {
    const out = svAppendSample(history, at(15), { late: 'drop', timestamp: stamp });
    expect(out.dropped).toBe(true);
    expect(out.samples).toBe(history);
  });

  it('refuses an exact repeat under `drop`', () => {
    // A retransmission is not a second reading.
    const out = svAppendSample(history, at(30), { late: 'drop', timestamp: stamp });
    expect(out.dropped).toBe(true);
  });

  it('still accepts a genuinely newer sample under `drop`', () => {
    const out = svAppendSample(history, at(40), { late: 'drop', timestamp: stamp });
    expect(out.dropped).toBe(false);
    expect(out.samples.map(stamp)).toEqual([10, 20, 30, 40]);
  });

  it('inserts by timestamp under `reorder`', () => {
    const out = svAppendSample(history, at(15), { late: 'reorder', timestamp: stamp });
    expect(out.samples.map(stamp)).toEqual([10, 15, 20, 30]);
    expect(out.reordered).toBe(true);
  });

  it('puts a sample older than everything at the front', () => {
    const out = svAppendSample(history, at(5), { late: 'reorder', timestamp: stamp });
    expect(out.samples.map(stamp)).toEqual([5, 10, 20, 30]);
  });

  it('appends at the end under `reorder` when the sample is newest', () => {
    const out = svAppendSample(history, at(40), { late: 'reorder', timestamp: stamp });
    expect(out.samples.map(stamp)).toEqual([10, 20, 30, 40]);
    expect(out.reordered).toBe(false);
  });

  it('applies the window after reordering', () => {
    const out = svAppendSample(history, at(15), {
      late: 'reorder',
      timestamp: stamp,
      retain: 3,
    });
    expect(out.samples.map(stamp)).toEqual([15, 20, 30]);
  });

  it('ignores the policy without a timestamp accessor to apply it with', () => {
    const out = svAppendSample(history, at(15), { late: 'drop' });
    expect(out.dropped).toBe(false);
    expect(out.samples).toHaveLength(4);
  });

  it('appends a sample with an unusable timestamp rather than losing it', () => {
    // A NaN timestamp says nothing about ordering; dropping the reading would
    // discard data over a metadata fault.
    const out = svAppendSample(history, at(Number.NaN), { late: 'drop', timestamp: stamp });
    expect(out.dropped).toBe(false);
    expect(out.samples).toHaveLength(4);
  });

  it('never touches a history it did not change', () => {
    const out = svAppendSample(history, at(1), { late: 'drop', timestamp: stamp });
    expect(out.samples).toBe(history);
  });
});

describe('svPauseNotice', () => {
  it('says nothing for a pause too short to be a gap in the data', () => {
    // A half-second tab switch is a person alt-tabbing, and a chart that
    // announced every one would train its reader to ignore the line.
    expect(svPauseNotice(400)).toBeNull();
    expect(svPauseNotice(1999)).toBeNull();
  });

  it('reports a gap in seconds', () => {
    const text = svPauseNotice(8000)!;
    expect(text).toContain('8 seconds');
    expect(text).toContain('nothing was sampled');
    expect(text).toContain('resumes rather than filling it in');
  });

  it('switches to minutes once it is long enough to read as one', () => {
    expect(svPauseNotice(180_000)).toContain('3 minutes');
    expect(svPauseNotice(60_000)).toContain('1 minute');
  });

  it('gets the singular right', () => {
    expect(svPauseNotice(2000)).toContain('2 seconds');
    expect(svPauseNotice(1000, 500)).toContain('1 second');
  });

  it('honours a custom floor', () => {
    expect(svPauseNotice(900, 500)).toContain('1 second');
    expect(svPauseNotice(900, 5000)).toBeNull();
  });

  it('refuses a non-finite duration rather than printing NaN', () => {
    // Neither is a duration, so neither produces a sentence about one.
    expect(svPauseNotice(Number.NaN)).toBeNull();
    expect(svPauseNotice(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
