import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvStatCardComponent } from './stat-card.component';
import { ICON_REGISTRY } from '@styloviz/icons';

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvStatCardComponent, { inputs });
  return fixture.componentInstance;
}

describe('SvStatCardComponent — displayValue', () => {
  it('abbreviates thousands and millions for numeric values', async () => {
    expect((await setup({ value: 2500 })).displayValue()).toBe('2.5K');
    expect((await setup({ value: 3_200_000 })).displayValue()).toBe('3.2M');
  });

  it('localises mid-range numbers', async () => {
    expect((await setup({ value: 42 })).displayValue()).toBe('42');
  });

  it('passes string values through untouched', async () => {
    expect((await setup({ value: '99.9%' })).displayValue()).toBe('99.9%');
  });
});

describe('SvStatCardComponent — trend', () => {
  it('formats the trend percent as an absolute value', async () => {
    expect((await setup({ trendPercent: -12.4 })).displayTrendPercent()).toBe('12.4%');
  });

  it('is empty when no trend percent is set', async () => {
    expect((await setup({})).displayTrendPercent()).toBe('');
  });

  it('reports hasTrend when a trend direction or value is present', async () => {
    expect((await setup({ trend: 'up' })).hasTrend()).toBe(true);
    expect((await setup({ trend: 'neutral' })).hasTrend()).toBe(false);
    expect((await setup({ trend: 'neutral', trendValue: 5 })).hasTrend()).toBe(true);
  });
});

describe('SvStatCardComponent — presence flags & sparkline', () => {
  it('flags icon, link, and sparkline presence', async () => {
    const c = await setup({
      icon: 'star',
      linkLabel: 'View report',
      sparkline: [{ value: 1 }, { value: 5 }, { value: 3 }],
    });
    expect(c.hasIcon()).toBe(true);
    expect(c.hasLink()).toBe(true);
    expect(c.hasSparkline()).toBe(true);
  });

  it('requires at least two points to show a sparkline', async () => {
    expect((await setup({ sparkline: [{ value: 1 }] })).hasSparkline()).toBe(false);
    expect((await setup({ sparkline: [{ value: 1 }, { value: 9 }] })).hasSparkline()).toBe(true);
  });
});


describe('SvStatCardComponent — glyphs come from the library', () => {
  /**
   * `iconPath` took a raw `<path d="…">` **and** a companion `iconViewBox`,
   * because a pasted path might be 20-box or 24-box. That binding is what hid
   * four glyphs per card from `check:ui`: the rule tested for a literal
   * `viewBox="…"`, and a bound one never matched.
   *
   * This is a FREE package, so `<sv-icon>` resolves the free registry only — a
   * Pro-only name renders blank and nothing else says so.
   */
  it('renders the icon from the library, not from a path', async () => {
    const { fixture } = await render(SvStatCardComponent, {
      inputs: { title: 'Revenue', value: 100, icon: 'star' },
    });
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('sv-icon')).toBeTruthy();
    const expected = (ICON_REGISTRY.star[0] as { d?: string }).d;
    expect(host.querySelector(`path[d="${expected}"]`)).toBeTruthy();
  });

  it('draws no glyph by hand', async () => {
    const { fixture } = await render(SvStatCardComponent, {
      inputs: { title: 'Revenue', value: 100, icon: 'star', trend: 'up', trendPercent: 4 },
    });
    const host = fixture.nativeElement as HTMLElement;
    // The sparkline is a legitimate inline graphic; icons are not.
    const handDrawn = [...host.querySelectorAll('svg')].filter(
      (n) => !n.closest('sv-icon') && !n.closest('sv-sparkline'),
    );
    expect(handDrawn).toEqual([]);
  });
});

describe('SvStatCardComponent — load failure', () => {
  // The card had a loading skeleton and no way to say the load failed, so a
  // failed refresh left the previous figure on screen looking current: a
  // dashboard reporting yesterday's revenue as today's, with nothing on the card
  // to suggest otherwise.
  async function el(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvStatCardComponent, { inputs });
    return fixture.nativeElement as HTMLElement;
  }

  it('replaces the figure rather than sitting beside it', async () => {
    const host = await el({ value: 2500, error: 'Could not refresh' });
    expect(host.querySelector('[data-sv-state="error"]')).toBeTruthy();
    expect(host.textContent).not.toContain('2.5K');
  });

  it('outranks the skeleton, so a failed load never reads as still loading', async () => {
    const host = await el({ value: 2500, loading: true, error: 'Could not refresh' });
    expect(host.querySelector('[data-sv-state="error"]')).toBeTruthy();
    expect(host.querySelector('[data-sv-state="loading"]')).toBeNull();
  });

  it('announces the failure and offers a way out', async () => {
    const host = await el({ error: 'Could not refresh' });
    expect(host.querySelector('[role="alert"]')).toBeTruthy();
    expect(host.querySelector('button')?.textContent).toContain('Try again');
  });

  it('stays compact, so the card keeps the height of the grid cell it sits in', async () => {
    const host = await el({ error: 'Could not refresh' });
    expect(host.querySelector('[role="alert"]')?.className).not.toContain('py-12');
  });

  it('shows the figure again once the error clears', async () => {
    const host = await el({ value: 2500 });
    expect(host.textContent).toContain('2.5K');
    expect(host.querySelector('[data-sv-state="error"]')).toBeNull();
  });
});

// ─── DD-30-I1/M2/I2/M1: every layout states the period and the freshness ─────

describe('SvStatCardComponent — trend period and freshness in EVERY layout', () => {
  const LAYOUTS = ['default', 'compact', 'horizontal', 'minimal'] as const;
  const minutesAgo = (n: number): string => new Date(Date.now() - n * 60_000).toISOString();

  async function mount(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvStatCardComponent, { inputs: { title: 'Revenue', value: 4821, ...inputs } });
    return fixture.nativeElement as HTMLElement;
  }

  it.each(LAYOUTS)('%s: the trend chip is named with its comparison period', async (layout) => {
    const host = await mount({ layout, trend: 'up', trendPercent: 12, trendLabel: 'vs last month' });
    const chips = host.querySelectorAll('[data-sv-trend]');
    expect(chips).toHaveLength(1);
    expect(chips[0].getAttribute('role')).toBe('img');
    expect(chips[0].getAttribute('aria-label')).toBe('Trend up 12%, vs last month');
  });

  it.each(LAYOUTS)('%s: the comparison period is visible text too', async (layout) => {
    const host = await mount({ layout, trend: 'down', trendPercent: 3, trendLabel: 'vs Q3' });
    expect(host.querySelector('[data-sv-trend-period]')?.textContent?.trim()).toBe('vs Q3');
  });

  it.each(LAYOUTS)('%s: a missing period is said out loud, not skipped', async (layout) => {
    const host = await mount({ layout, trend: 'up', trendPercent: 12 });
    expect(host.querySelector('[data-sv-trend]')?.getAttribute('aria-label'))
      .toContain('comparison period not stated');
  });

  it.each(LAYOUTS)('%s: an absolute delta renders and is named', async (layout) => {
    const host = await mount({ layout, trend: 'down', trendValue: 14, trendLabel: 'vs yesterday' });
    const chip = host.querySelector('[data-sv-trend]')!;
    expect(chip.textContent).toContain('14');
    expect(chip.getAttribute('aria-label')).toBe('Trend down 14, vs yesterday');
  });

  it.each(LAYOUTS)('%s: shows the freshness line with its source', async (layout) => {
    const host = await mount({ layout, updatedAt: minutesAgo(5), source: 'warehouse' });
    const line = host.querySelectorAll('[data-sv-freshness]');
    expect(line).toHaveLength(1);
    expect(line[0].textContent?.trim()).toBe('Updated 5 min ago · warehouse');
    expect(line[0].className).toContain('text-gray-500');
  });

  it.each(LAYOUTS)('%s: calls out a stale figure in warning ink', async (layout) => {
    const host = await mount({ layout, updatedAt: minutesAgo(240), staleAfterMinutes: 60 });
    const line = host.querySelector('[data-sv-freshness]')!;
    expect(line.textContent).toContain('may be stale');
    expect(line.className).toContain('text-warning-800');
  });

  it.each(LAYOUTS)('%s: says nothing about freshness or trend when not given', async (layout) => {
    const host = await mount({ layout });
    expect(host.querySelector('[data-sv-freshness]')).toBeNull();
    expect(host.querySelector('[data-sv-trend]')).toBeNull();
  });
});
