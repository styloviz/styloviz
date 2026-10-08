import { TestBed } from '@angular/core/testing';
import { render, screen, type ComponentInput } from '@testing-library/angular';
import { SvProgressRingComponent } from './progress-ring.component';

/**
 * ============================================================================
 *  What the ring says out loud, and what it does when colour is taken away
 *  `OF-15-M4` · `OF-15-I6` · `OF-15-M6`
 * ============================================================================
 *
 * ★★★ `aria-valuenow` ALONE IS ANNOUNCED AS A BARE NUMBER: "62". Sixty-two
 *     what — per cent, files, minutes, of eight? The unit is drawn in the
 *     middle of the ring, so the sighted answer was never in doubt and the
 *     announced one was. `aria-valuetext` carries the unit.
 *
 * ★★ AND A GLOW IS THE HARDEST CASE FOR 1.4.11's 3:1. The requirement is
 *    against what is ADJACENT, and a `drop-shadow` has no single edge to
 *    measure — the arc fades into the page over six pixels, so the boundary
 *    carrying the meaning is the lowest-contrast part of the drawing. Under
 *    `prefers-contrast: more` or forced colors it falls back to the solid arc,
 *    and `gradient` goes with it: a `url(#…)` paint server is the one thing
 *    forced-colors cannot override, so it would be the only element on the
 *    page still insisting on the author's colours.
 *
 * ★ `matchMedia` is stubbed rather than inferred, and the QUERIES are asserted
 *   in `high-contrast.spec.ts` — a stubbed MQL answers whatever it was told for
 *   any query at all, so a value assertion here cannot see which was asked.
 */

interface FakeMql {
  matches: boolean;
  addEventListener(type: string, cb: () => void): void;
  removeEventListener(type: string, cb: () => void): void;
}

const listeners: (() => void)[] = [];
/**
 * Every MQL handed out, kept so a test can flip one.
 *
 * ★ The component's handler re-reads `matches` on the LISTS IT SUBSCRIBED TO,
 *   so a mid-session flip has to mutate those objects. Re-stubbing
 *   `matchMedia` instead leaves the component holding the old ones and the
 *   test passes or fails for the wrong reason — which it did, first time.
 */
const mqls: FakeMql[] = [];

/** Every media query answers `high`, which is what the component ORs together. */
function stubContrast(high: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => {
    const mql: FakeMql = {
      matches: q.includes('contrast') || q.includes('forced-colors') ? high : false,
      addEventListener: (_t, cb) => listeners.push(cb),
      removeEventListener: () => undefined,
    };
    mqls.push(mql);
    return mql as unknown as MediaQueryList;
  });
}

/** Flip the preference the way an OS setting does, mid-session. */
function flipTo(high: boolean) {
  for (const m of mqls) m.matches = high;
  for (const l of listeners) l();
}

async function setup(inputs: Partial<ComponentInput<SvProgressRingComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvProgressRingComponent, {
    inputs: inputs as ComponentInput<SvProgressRingComponent>,
  });
}

const ring = () => screen.getByRole('progressbar');
const arc = () =>
  (document.querySelectorAll('circle')[1] ?? null) as SVGCircleElement | null;

afterEach(() => {
  listeners.length = 0;
  mqls.length = 0;
  vi.unstubAllGlobals();
});

describe('SvProgressRingComponent — the announced value', () => {
  it('★ says the unit, not just the number', async () => {
    await setup({ value: 62 });
    expect(ring().getAttribute('aria-valuetext')).toBe('62%');
    // `aria-valuenow` is still there — valuetext supplements it, never replaces it.
    expect(ring().getAttribute('aria-valuenow')).toBe('62');
  });

  it('★ counts "3 of 8" when the host cleared the suffix and set a real max', async () => {
    await setup({ value: 3, max: 8, suffix: '' });
    expect(ring().getAttribute('aria-valuetext')).toBe('3 of 8');
  });

  it('falls back to the bare number only when there is nothing else to say', async () => {
    await setup({ value: 40, suffix: '' });
    expect(ring().getAttribute('aria-valuetext')).toBe('40');
  });

  it('lets the host say it properly', async () => {
    await setup({ value: 40, valueText: '4 minutes remaining' });
    expect(ring().getAttribute('aria-valuetext')).toBe('4 minutes remaining');
  });

  it('★ announces the value the arc actually draws', async () => {
    // The arc clamps, so a value past the maximum must not be announced
    // outside the range this same component declares.
    await setup({ value: 150, max: 100 });
    expect(ring().getAttribute('aria-valuetext')).toBe('100%');
    expect(ring().getAttribute('aria-valuenow')).toBe('100');
  });

  it('survives a zero max rather than announcing NaN', async () => {
    await setup({ value: 5, max: 0 });
    expect(ring().getAttribute('aria-valuetext')).toBe('0%');
  });
});

describe('SvProgressRingComponent — high contrast', () => {
  it('keeps every variant as asked at normal contrast', async () => {
    stubContrast(false);
    for (const variant of ['default', 'gradient', 'dashed', 'glow'] as const) {
      const { fixture } = await setup({ variant });
      expect(fixture.componentInstance.effectiveVariant()).toBe(variant);
    }
  });

  it('★ drops the glow, because a blurred edge has no contrast to measure', async () => {
    stubContrast(true);
    const { fixture } = await setup({ variant: 'glow' });
    expect(fixture.componentInstance.effectiveVariant()).toBe('default');
    expect(arc()!.style.filter).toBe('none');
  });

  it('★ drops the gradient, which forced-colors cannot override', async () => {
    stubContrast(true);
    const { fixture } = await setup({ variant: 'gradient' });
    expect(fixture.componentInstance.effectiveVariant()).toBe('default');
    expect(document.querySelector('linearGradient')).toBeNull();
    expect(arc()!.getAttribute('stroke')).not.toContain('url(#');
  });

  it('★ keeps the dashed variant, whose meaning is a pattern rather than a colour', async () => {
    stubContrast(true);
    const { fixture } = await setup({ variant: 'dashed', value: 50 });
    expect(fixture.componentInstance.effectiveVariant()).toBe('dashed');
    expect(arc()!.getAttribute('stroke-dasharray')).toContain(' ');
  });

  it('★ names a system colour for each circle, so the arc cannot vanish into its track', async () => {
    // In forced-colors mode the engine may replace an author's stroke; if it
    // replaces both with the same colour the ring reads 0% at every value.
    stubContrast(true);
    await setup({ value: 50 });
    const circles = [...document.querySelectorAll('circle')];
    expect(circles[0].getAttribute('class')).toContain('forced-colors:[stroke:GrayText]');
    expect(circles[1].getAttribute('class')).toContain('forced-colors:[stroke:Highlight]');
  });

  it('★ follows a preference switched mid-session', async () => {
    // macOS "Increase contrast" and the Windows high-contrast switch are both
    // toggled while the page is open.
    stubContrast(false);
    const { fixture } = await setup({ variant: 'glow' });
    expect(fixture.componentInstance.effectiveVariant()).toBe('glow');

    flipTo(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.effectiveVariant()).toBe('default');

    // And back again, because a fallback that cannot be undone is a one-way door.
    flipTo(false);
    fixture.detectChanges();
    expect(fixture.componentInstance.effectiveVariant()).toBe('glow');
  });

  it('renders normally with no matchMedia at all', async () => {
    vi.stubGlobal('matchMedia', undefined);
    const { fixture } = await setup({ variant: 'glow' });
    expect(fixture.componentInstance.effectiveVariant()).toBe('glow');
  });
});
