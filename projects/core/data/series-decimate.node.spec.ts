import { describe, expect, it } from 'vitest';
import { svDecimateIndices } from './series-decimate';

describe('svDecimateIndices', () => {
  it('returns null when every point fits', () => {
    expect(svDecimateIndices([[1, 2, 3, 4]], 0, 3, 2)).toBeNull();
    expect(svDecimateIndices([Array.from({ length: 20 }, (_, i) => i)], 0, 19, 10)).toBeNull();
  });

  it('keeps the ends, and at most a low and a high per bucket', () => {
    const data = Array.from({ length: 10_000 }, (_, i) => Math.sin(i / 50));
    const kept = svDecimateIndices([data], 0, 9_999, 500)!;
    expect(kept[0]).toBe(0);
    expect(kept[kept.length - 1]).toBe(9_999);
    expect(kept.length).toBeLessThanOrEqual(500 * 2 + 2);
    expect([...kept].sort((a, b) => a - b)).toEqual(kept);
  });

  it('never drops a spike', () => {
    const data = Array.from({ length: 5_000 }, () => 10);
    data[1_234] = 999;
    data[3_210] = -999;
    const kept = svDecimateIndices([data], 0, 4_999, 100)!;
    expect(kept).toContain(1_234);
    expect(kept).toContain(3_210);
  });

  it('keeps the readings either side of a gap, so the break stays put', () => {
    const data: (number | null)[] = Array.from({ length: 4_000 }, (_, i) => i % 7);
    data[2_000] = null;
    const kept = svDecimateIndices([data], 0, 3_999, 50)!;
    expect(kept).toContain(1_999);
    expect(kept).toContain(2_001);
    expect(kept).not.toContain(2_000);
  });

  it('is the union across series, so they stay aligned', () => {
    const a = Array.from({ length: 3_000 }, () => 1);
    const b = Array.from({ length: 3_000 }, () => 1);
    a[100] = 50;
    b[2_900] = 50;
    const kept = svDecimateIndices([a, b], 0, 2_999, 30)!;
    expect(kept).toContain(100);
    expect(kept).toContain(2_900);
  });

  it('works on a window, and keeps its edges', () => {
    const data = Array.from({ length: 10_000 }, (_, i) => i);
    const kept = svDecimateIndices([data], 2_000, 7_999, 100)!;
    expect(kept[0]).toBe(2_000);
    expect(kept[kept.length - 1]).toBe(7_999);
    expect(kept.every((i) => i >= 2_000 && i <= 7_999)).toBe(true);
  });

  it('ignores non-finite readings when choosing the low and the high', () => {
    const data: (number | null)[] = Array.from({ length: 2_000 }, () => 5);
    data[500] = Number.NaN;
    data[501] = Number.POSITIVE_INFINITY;
    const kept = svDecimateIndices([data], 0, 1_999, 10)!;
    expect(kept).not.toContain(500);
    expect(kept).not.toContain(501);
  });
});
