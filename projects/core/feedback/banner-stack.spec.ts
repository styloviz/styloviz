import { TestBed } from '@angular/core/testing';
import { SvBannerStackService, type SvBannerSlot } from './banner-stack';

function svc(): SvBannerStackService {
  TestBed.resetTestingModule();
  return TestBed.inject(SvBannerStackService);
}

function reg(
  s: SvBannerStackService,
  slot: SvBannerSlot,
  priority = 0,
  dedupeKey: string | null = null,
) {
  return s.register({ slot, priority, dedupeKey });
}

/**
 * `X-12` / `OF-01-I1` / `OF-01-M1` / `OF-01-M2` — who gets the edge.
 *
 * ★★ jsdom has no layout, so nothing here measures anything: heights are
 * REPORTED to the stack by the banners themselves, which is also how the real
 * thing works. The numbers in these tests are the tests'.
 */
describe('SvBannerStackService — order', () => {
  it('gives the edge to the first registration when priorities are equal', () => {
    const s = svc();
    const first  = reg(s, 'top-fixed');
    const second = reg(s, 'top-fixed');
    expect(first.index()).toBe(0);
    expect(second.index()).toBe(1);
  });

  it('gives the edge to the higher priority, whenever it arrived', () => {
    const s = svc();
    const low  = reg(s, 'top-fixed', 0);
    const high = reg(s, 'top-fixed', 10);
    expect(high.index()).toBe(0);
    expect(low.index()).toBe(1);
  });

  it('★ keeps registration order among equal priorities when a third arrives', () => {
    // An unstable sort would swap two banners of equal weight whenever a third
    // registered, which reads as the page glitching.
    const s = svc();
    const a = reg(s, 'top-fixed', 5);
    const b = reg(s, 'top-fixed', 5);
    reg(s, 'top-fixed', 9);
    expect(a.index()).toBe(1);
    expect(b.index()).toBe(2);
  });

  it('counts each slot separately', () => {
    const s = svc();
    const top    = reg(s, 'top-fixed');
    const bottom = reg(s, 'bottom-fixed');
    const sticky = reg(s, 'top-sticky');
    expect([top.index(), bottom.index(), sticky.index()]).toEqual([0, 0, 0]);
    expect(s.visibleCount('top-fixed')).toBe(1);
  });

  it('★ keeps top-sticky out of the top-fixed stack', () => {
    // A sticky banner scrolls with its container and a fixed one does not, so
    // offsetting one by the other's height puts a gap on screen the moment the
    // user scrolls.
    const s = svc();
    const fixed = reg(s, 'top-fixed');
    fixed.measured(40);
    const sticky = reg(s, 'top-sticky');
    expect(sticky.offset()).toBe(0);
  });

  it('closes the gap when a banner above is released', () => {
    const s = svc();
    const first  = reg(s, 'top-fixed');
    const second = reg(s, 'top-fixed');
    expect(second.index()).toBe(1);
    first.release();
    expect(second.index()).toBe(0);
  });

  it('release is idempotent — a second call removes nothing', () => {
    const s = svc();
    const first  = reg(s, 'top-fixed');
    const second = reg(s, 'top-fixed');
    first.release();
    first.release();
    expect(second.index()).toBe(0);
    expect(s.visibleCount('top-fixed')).toBe(1);
  });
});

describe('SvBannerStackService — offsets', () => {
  it('puts the first banner against the edge', () => {
    const s = svc();
    const first = reg(s, 'top-fixed');
    first.measured(48);
    expect(first.offset()).toBe(0);
  });

  it('offsets each banner by the summed height of the ones before it', () => {
    const s = svc();
    const a = reg(s, 'top-fixed');
    const b = reg(s, 'top-fixed');
    const c = reg(s, 'top-fixed');
    a.measured(40);
    b.measured(56);
    c.measured(40);
    expect(a.offset()).toBe(0);
    expect(b.offset()).toBe(40);
    expect(c.offset()).toBe(96);
  });

  it('re-offsets when a banner above changes height', () => {
    const s = svc();
    const a = reg(s, 'top-fixed');
    const b = reg(s, 'top-fixed');
    a.measured(40);
    expect(b.offset()).toBe(40);
    a.measured(80); // the text wrapped onto a second line
    expect(b.offset()).toBe(80);
  });

  it('offsets by priority order, not registration order', () => {
    const s = svc();
    const low  = reg(s, 'top-fixed', 0);
    const high = reg(s, 'top-fixed', 10);
    high.measured(60);
    low.measured(40);
    expect(high.offset()).toBe(0);
    expect(low.offset()).toBe(60);
  });

  it('treats an unreported height as zero rather than inventing one', () => {
    const s = svc();
    reg(s, 'top-fixed');
    const second = reg(s, 'top-fixed');
    // Honest: overlapping again. The alternative is a guessed number and a gap
    // where no banner is.
    expect(second.offset()).toBe(0);
  });

  it('ignores a negative reported height', () => {
    const s = svc();
    const a = reg(s, 'top-fixed');
    const b = reg(s, 'top-fixed');
    a.measured(-40);
    expect(b.offset()).toBe(0);
  });
});

describe('SvBannerStackService — suppression', () => {
  it('suppresses the later of two identical banners', () => {
    const s = svc();
    const first  = reg(s, 'top-fixed', 0, 'trial-expiry');
    const second = reg(s, 'top-fixed', 0, 'trial-expiry');
    expect(first.suppressed()).toBe(false);
    expect(second.suppressed()).toBe(true);
    expect(second.index()).toBe(-1);
    expect(s.visibleCount('top-fixed')).toBe(1);
  });

  it('★ keeps the FIRST one, which the user may already be acting on', () => {
    const s = svc();
    const first  = reg(s, 'top-fixed', 0, 'k');
    reg(s, 'top-fixed', 0, 'k');
    expect(first.index()).toBe(0);
  });

  it('un-suppresses the duplicate when the original leaves', () => {
    const s = svc();
    const first  = reg(s, 'top-fixed', 0, 'k');
    const second = reg(s, 'top-fixed', 0, 'k');
    expect(second.suppressed()).toBe(true);
    first.release();
    expect(second.suppressed()).toBe(false);
    expect(second.index()).toBe(0);
  });

  it('does not suppress across slots', () => {
    const s = svc();
    const top    = reg(s, 'top-fixed', 0, 'k');
    const bottom = reg(s, 'bottom-fixed', 0, 'k');
    expect(top.suppressed()).toBe(false);
    expect(bottom.suppressed()).toBe(false);
  });

  it('a null key never suppresses, however many register', () => {
    const s = svc();
    const a = reg(s, 'top-fixed', 0, null);
    const b = reg(s, 'top-fixed', 0, null);
    const c = reg(s, 'top-fixed', 0, null);
    expect([a.suppressed(), b.suppressed(), c.suppressed()]).toEqual([false, false, false]);
    expect(s.visibleCount('top-fixed')).toBe(3);
  });

  it('a suppressed banner takes up no height for the ones after it', () => {
    const s = svc();
    const first = reg(s, 'top-fixed', 0, 'k');
    const dupe  = reg(s, 'top-fixed', 0, 'k');
    const other = reg(s, 'top-fixed', 0, 'other');
    first.measured(40);
    dupe.measured(40);
    expect(other.offset()).toBe(40);
  });
});
