import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAlertBannerComponent } from './alert-banner.component';

/**
 * FL-J3-OF-01 · OF-01-I6 / OF-01-M4 — the banner's entrance and exit ride
 * opacity + translate only (never `transition-all`), and reduced motion drops
 * both: the strip simply appears, and leaves without holding a 300 ms gap.
 */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAlertBannerComponent, { inputs: { message: 'Maintenance tonight', dismissible: true, ...inputs } });
  return fixture;
}

function stubReducedMotion(reduce: boolean): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => { window.matchMedia = original; };
}

describe('SvAlertBannerComponent — motion (FL-J3-OF-01)', () => {
  let restore: () => void = () => undefined;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); restore(); restore = () => undefined; });

  it('animates opacity and translate only, with an entrance from the first frame', async () => {
    const f = await setup();
    const classes = f.componentInstance.wrapperClasses();
    expect(classes).not.toContain('transition-all');
    expect(classes).toContain('transition-[opacity,translate]');
    expect(classes).toContain('starting:opacity-0');
    expect(classes).toContain('motion-reduce:transition-none');
  });

  it('keeps the exit on opacity and translate, with a reduced-motion path', async () => {
    restore = stubReducedMotion(false);
    const f = await setup();
    f.componentInstance.close();
    const classes = f.componentInstance.wrapperClasses();
    expect(classes).toContain('opacity-0');
    expect(classes).not.toContain('transition-all');
    expect(classes).toContain('motion-reduce:transition-none');
  });

  it('waits for the 300 ms exit transition by default', async () => {
    restore = stubReducedMotion(false);
    const f = await setup();
    f.componentInstance.close();
    vi.advanceTimersByTime(299);
    expect(f.componentInstance.isVisible()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(f.componentInstance.isVisible()).toBe(false);
  });

  it('leaves at once under reduced motion — no invisible 300 ms gap', async () => {
    restore = stubReducedMotion(true);
    const f = await setup();
    const seen: number[] = [];
    f.componentInstance.dismissed.subscribe(() => seen.push(1));
    f.componentInstance.close();
    vi.advanceTimersByTime(0);
    expect(f.componentInstance.isVisible()).toBe(false);
    expect(seen).toEqual([1]);
  });

  it('keeps the subtle dismiss button off transition-all', async () => {
    const f = await setup({ alertStyle: 'subtle' });
    expect(f.componentInstance.dismissClass()).not.toContain('transition-all');
    expect(f.componentInstance.dismissClass()).toContain('motion-reduce:transition-none');
  });
});
