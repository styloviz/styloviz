import {
  SV_DOCK_MAX_PEAK,
  SV_DOCK_MIN_ITEM,
  svDockClampPeak,
  svDockFit,
  svDockCurrentIndex,
  svDockLayout,
  svDockPointerIndex,
  svDockRouteMatches,
  svDockScale,
} from './dock.logic';

/**
 * FL-F15 — the Dock's arithmetic. The component only turns these numbers into
 * `transform` strings, so the magnification's whole behaviour is pinned here.
 */

describe('svDockScale — the swell', () => {
  it('is the peak at the centre and exactly 1 at and beyond the range', () => {
    expect(svDockScale(0, 1.6, 2.5)).toBeCloseTo(1.6, 10);
    expect(svDockScale(2.5, 1.6, 2.5)).toBe(1);
    expect(svDockScale(-3, 1.6, 2.5)).toBe(1);
    expect(svDockScale(40, 1.6, 2.5)).toBe(1);
  });

  it('falls off symmetrically and monotonically from the centre', () => {
    const right = [0, 0.5, 1, 1.5, 2, 2.4].map((d) => svDockScale(d, 1.8, 2.5));
    const left = [0, -0.5, -1, -1.5, -2, -2.4].map((d) => svDockScale(d, 1.8, 2.5));
    expect(left).toEqual(right);
    for (let i = 1; i < right.length; i++) expect(right[i]).toBeLessThan(right[i - 1]);
  });

  it('never goes below 1, so a target only ever grows (WCAG 2.5.8)', () => {
    for (let d = -5; d <= 5; d += 0.25) expect(svDockScale(d, 1.6, 2.5)).toBeGreaterThanOrEqual(1);
    expect(svDockScale(0, 0.5, 2.5)).toBe(1);
  });

  it('is 1 everywhere for a peak of 1, a non-positive range, or a non-finite distance', () => {
    expect(svDockScale(0, 1, 2.5)).toBe(1);
    expect(svDockScale(0, 1.6, 0)).toBe(1);
    expect(svDockScale(0, 1.6, -1)).toBe(1);
    expect(svDockScale(Number.NaN, 1.6, 2.5)).toBe(1);
  });
});

describe('svDockClampPeak', () => {
  it('clamps into [1, 2] and treats nonsense as no magnification', () => {
    expect(svDockClampPeak(1.6)).toBe(1.6);
    expect(svDockClampPeak(5)).toBe(SV_DOCK_MAX_PEAK);
    expect(svDockClampPeak(0.2)).toBe(1);
    expect(svDockClampPeak(Number.NaN)).toBe(1);
    expect(svDockClampPeak(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('svDockLayout — making room with transforms alone', () => {
  const opts = { peak: 1.6, range: 2.5, size: 48 };

  it('is at rest — every scale 1, every offset 0 — with no centre', () => {
    const l = svDockLayout(5, null, opts);
    expect(l.scales).toEqual([1, 1, 1, 1, 1]);
    expect(l.offsets.every((o) => Math.abs(o) < 1e-9)).toBe(true);
    expect(l.extent).toBe(0);
  });

  it('returns nothing for an empty dock', () => {
    expect(svDockLayout(0, 1, opts)).toEqual({ scales: [], offsets: [], extent: 0 });
  });

  it('spreads neighbours so no scaled item overlaps the next', () => {
    const { scales, offsets } = svDockLayout(7, 3, opts);
    const gap = 8;
    for (let i = 1; i < scales.length; i++) {
      // Resting centres are one pitch apart; each item's half-size grows with its scale.
      const prevEnd = (i - 1) * (48 + gap) + offsets[i - 1] + (48 * scales[i - 1]) / 2;
      const nextStart = i * (48 + gap) + offsets[i] - (48 * scales[i]) / 2;
      expect(nextStart - prevEnd).toBeGreaterThanOrEqual(gap - 1e-9);
    }
  });

  it('centres the growth: the first item moves back by as much as the last moves on', () => {
    const { offsets, extent } = svDockLayout(5, 2, opts);
    expect(offsets[2]).toBeCloseTo(0, 10);
    expect(offsets[0]).toBeCloseTo(-offsets[4], 10);
    expect(extent).toBeGreaterThan(0);
  });

  it('extent is the sum of every item’s extra size', () => {
    const { scales, extent } = svDockLayout(6, 1.5, opts);
    expect(extent).toBeCloseTo(scales.reduce((s, k) => s + (k - 1) * 48, 0), 10);
  });

  it('treats a non-finite centre as at rest', () => {
    expect(svDockLayout(3, Number.NaN, opts).scales).toEqual([1, 1, 1]);
  });
});

describe('svDockPointerIndex', () => {
  it('is 0 at the first item’s centre and 1 at the second’s', () => {
    expect(svDockPointerIndex(24, 48, 8)).toBe(0);
    expect(svDockPointerIndex(24 + 56, 48, 8)).toBe(1);
    expect(svDockPointerIndex(52, 48, 8)).toBe(0.5);
  });

  it('does not divide by zero', () => {
    expect(svDockPointerIndex(10, 0, 0)).toBe(0);
    expect(svDockPointerIndex(Number.NaN, 48, 8)).toBe(0);
  });
});

describe('svDockRouteMatches / svDockCurrentIndex', () => {
  it('matches on segment boundaries only', () => {
    expect(svDockRouteMatches('/app', '/app')).toBe(true);
    expect(svDockRouteMatches('/app', '/app/inbox')).toBe(true);
    expect(svDockRouteMatches('/app', '/apps')).toBe(false);
    expect(svDockRouteMatches('/app/', '/app?tab=1#top')).toBe(true);
  });

  it('lets / match only itself', () => {
    expect(svDockRouteMatches('/', '/')).toBe(true);
    expect(svDockRouteMatches('/', '/app')).toBe(false);
  });

  it('picks the longest matching route and skips items without one', () => {
    expect(svDockCurrentIndex(['/app', null, '/app/inbox'], '/app/inbox/42')).toBe(2);
    expect(svDockCurrentIndex(['/app', '/settings'], '/billing')).toBe(-1);
    expect(svDockCurrentIndex(['/app'], '')).toBe(-1);
  });
});

describe('svDockFit — a dock fits its container (WCAG 1.4.10)', () => {
  const opts = { size: 48, gap: 8, padding: 8 };

  it('keeps the resting size when the row fits, or before anything is measured', () => {
    // 5 × 48 + 4 × 8 + 2 × 8 = 288
    expect(svDockFit(5, 288, opts)).toEqual({ itemSize: 48, shrunk: false, scroll: false });
    expect(svDockFit(5, 1000, opts)).toEqual({ itemSize: 48, shrunk: false, scroll: false });
    expect(svDockFit(5, null, opts)).toEqual({ itemSize: 48, shrunk: false, scroll: false });
    expect(svDockFit(5, 0, opts)).toEqual({ itemSize: 48, shrunk: false, scroll: false });
    expect(svDockFit(0, 10, opts)).toEqual({ itemSize: 48, shrunk: false, scroll: false });
  });

  it('shrinks every item evenly so the row fits exactly', () => {
    const fit = svDockFit(5, 256, opts); // room 256 − 16 − 32 = 208 → 41 px
    expect(fit).toEqual({ itemSize: 41, shrunk: true, scroll: false });
    expect(5 * fit.itemSize + 4 * 8 + 16).toBeLessThanOrEqual(256);
  });

  it('never shrinks below the minimum — 32 px by default, and never under the 24 px target', () => {
    expect(svDockFit(5, 200, opts).itemSize).toBe(SV_DOCK_MIN_ITEM);
    expect(svDockFit(5, 100, { ...opts, min: 10 }).itemSize).toBe(24);
  });

  it('scrolls when even the minimum does not fit, so every control stays reachable', () => {
    // 5 × 32 + 4 × 8 + 16 = 208
    expect(svDockFit(5, 208, opts)).toEqual({ itemSize: 32, shrunk: true, scroll: false });
    expect(svDockFit(5, 207, opts)).toEqual({ itemSize: 32, shrunk: true, scroll: true });
  });
});
