import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvAiInsightCardsComponent, DEMO_INSIGHTS } from './ai-insight-cards.component';
import type { AiInsight, InsightCategory } from './ai-insight-cards.types';
import { ICON_REGISTRY } from '@styloviz/icons';

const insight = (over: Partial<AiInsight> = {}): AiInsight => ({
  id: 'i1',
  title: 'Checkout drop-off spiked on step six',
  description: 'Completion fell 18% after the address form changed.',
  category: 'anomaly',
  priority: 'high',
  confidence: 88,
  detectedAt: new Date('2026-07-01T09:00:00'),
  source: 'funnel-analyzer',
  dataPoints: [],
  status: 'new',
  ...over,
});

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAiInsightCardsComponent, {
    inputs: { variant: 'feed', ...inputs },
  });
  return fixture;
}

const host = async (i: Record<string, unknown> = {}) =>
  (await setup(i)).nativeElement as HTMLElement;

describe('SvAiInsightCardsComponent — no bundled defaults', () => {
  it('ships no sample insights — an unwired host renders nothing', async () => {
    const c = (await setup()).componentInstance;
    expect(c.insights()).toEqual([]);
    expect(c.visibleInsights()).toEqual([]);
  });

  it('exports the demo insights so a showcase can opt into them explicitly', async () => {
    const c = (await setup({ insights: DEMO_INSIGHTS })).componentInstance;
    expect(c.insights().length).toBeGreaterThan(0);
    expect(c.visibleInsights().length).toBeGreaterThan(0);
  });

  it('renders each variant', async () => {
    for (const variant of ['feed', 'grid', 'inline', 'panel'] as const) {
      const el = await host({ variant });
      expect(el.children.length).toBeGreaterThan(0);
    }
  });
});

describe('SvAiInsightCardsComponent — host-supplied insights', () => {
  it('renders the caller’s insights rather than the samples', async () => {
    const el = await host({ insights: [insight()] });
    expect(el.textContent).toContain('Checkout drop-off spiked on step six');
  });

  it('filters by priority across the supplied set', async () => {
    const c = (await setup({
      insights: [insight({ id: 'a', priority: 'high' }), insight({ id: 'b', priority: 'low' })],
    })).componentInstance;

    expect(c.visibleInsights()).toHaveLength(2);
    c.setFilter('high');
    expect(c.visibleInsights().map((i) => i.id)).toEqual(['a']);
  });
});

describe('SvAiInsightCardsComponent — decisions', () => {
  const two = [insight({ id: 'a' }), insight({ id: 'b' })];

  it('layers a decision over an input it cannot write to', async () => {
    const c = (await setup({ insights: two })).componentInstance;

    c.accept('a');
    expect(c.resolvedInsights().find((i) => i.id === 'a')?.status).toBe('accepted');
    // The caller's array is untouched — the host owns that list.
    expect(two[0].status).toBe('new');
  });

  it('removes a decided insight from the visible set', async () => {
    const c = (await setup({ insights: two })).componentInstance;
    expect(c.visibleInsights()).toHaveLength(2);

    c.dismiss('b');
    expect(c.visibleInsights().map((i) => i.id)).toEqual(['a']);
  });

  it('reports both decisions for the host to persist', async () => {
    const fixture = await setup({ insights: two });
    const accepted: string[] = [];
    const dismissed: string[] = [];
    fixture.componentInstance.insightAccept.subscribe((id) => accepted.push(id));
    fixture.componentInstance.insightDismiss.subscribe((id) => dismissed.push(id));

    fixture.componentInstance.accept('a');
    fixture.componentInstance.dismiss('b');

    expect(accepted).toEqual(['a']);
    expect(dismissed).toEqual(['b']);
  });
});

describe('SvAiInsightCardsComponent — refresh', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('always reports the request', async () => {
    const fixture = await setup();
    let asked = 0;
    fixture.componentInstance.refreshRequested.subscribe(() => (asked += 1));
    fixture.componentInstance.refreshInsights();
    expect(asked).toBe(1);
  });

  /**
   * ★ `simulate` defaults to OFF, so this needs an explicit opt-in.
   *
   * A card that fabricates a refresh in a real host is the P0 this default
   * exists to prevent — see the sibling test below for the default path.
   */
  it('restores dismissed cards when simulating', async () => {
    const c = (await setup({ insights: [insight({ id: 'a' })], simulate: true })).componentInstance;
    c.dismiss('a');
    expect(c.visibleInsights()).toHaveLength(0);

    c.refreshInsights();
    vi.advanceTimersByTime(3_000);

    expect(c.visibleInsights()).toHaveLength(1);
  });

  /**
   * ★★★ `AI-03-I1` — the default itself is the guarantee, so it is asserted.
   *
   * Read together with the test below: that one proves the off path behaves,
   * this one proves a host gets the off path without asking for it. Deleting
   * either leaves the P0 half-covered — a correct behaviour nobody reaches, or
   * a default nothing exercises.
   */
  it('does not simulate unless the host opts in', async () => {
    const c = (await setup({ insights: [insight({ id: 'a' })] })).componentInstance;
    expect(c.simulate()).toBe(false);

    c.dismiss('a');
    c.refreshInsights();
    vi.advanceTimersByTime(3_000);

    // No fabricated reload: the dismissal stands and nothing pretended to load.
    expect(c.isLoading()).toBe(false);
    expect(c.visibleInsights()).toHaveLength(0);
  });

  it('does nothing but ask when the host owns the data', async () => {
    const fixture = await setup({ insights: [insight({ id: 'a' })], simulate: false });
    const c = fixture.componentInstance;
    c.dismiss('a');

    c.refreshInsights();
    vi.advanceTimersByTime(3_000);

    expect(c.isLoading()).toBe(false);
    // The decision stands until the host supplies a new list.
    expect(c.visibleInsights()).toHaveLength(0);
  });

  it('reports busy from the host as well as its own', async () => {
    const idle = await setup();
    expect(idle.componentInstance.isBusy()).toBe(false);

    const working = await setup({ busy: true });
    expect(working.componentInstance.isBusy()).toBe(true);
  });
});


describe('SvAiInsightCardsComponent — glyphs come from the library', () => {
  const CATEGORIES: readonly InsightCategory[] = [
    'revenue', 'churn', 'performance', 'security', 'engagement', 'budget', 'anomaly',
  ];

  /**
   * Every category icon was a hand-copied Heroicons path in a component-side
   * map, drawn through `[attr.d]` at four sites. Two of the seven needed glyphs
   * the FREE registry did not have, so `banknote` and `bolt` were moved into it
   * — this package is free, and `<sv-icon>` resolves the free set only. If a
   * name here ever stops resolving, the icon renders blank and nothing else
   * would say so.
   */
  it('maps every category to a name that resolves in the FREE registry', async () => {
    const fixture = await setup({ insights: [insight()] });
    const c = fixture.componentInstance;
    for (const category of CATEGORIES) {
      const name = c.categoryIconName(category);
      expect(name, `category ${category}`).toMatch(/^[a-z0-9-]+$/);
      expect(ICON_REGISTRY[name as keyof typeof ICON_REGISTRY], `category ${category}`).toBeTruthy();
    }
  });

  it('draws no glyph by hand', async () => {
    const fixture = await setup({ insights: [insight()] });
    const svgs = [...fixture.nativeElement.querySelectorAll('svg')];
    // The progress rings are legitimate inline graphics; icons are not.
    const handDrawn = svgs.filter(
      (n: SVGElement) => n.getAttribute('viewBox') === '0 0 24 24' && !n.closest('sv-icon'),
    );
    expect(handDrawn).toEqual([]);
  });

  it('renders the category badge icon for the insight it is showing', async () => {
    const fixture = await setup({ insights: [insight({ category: 'security' })] });
    const drawn = new Set(
      [...fixture.nativeElement.querySelectorAll('sv-icon path, sv-icon polyline')].map(
        (n: Element) => n.getAttribute('d') ?? n.getAttribute('points'),
      ),
    );
    const node = ICON_REGISTRY['shield-check'][0] as { d?: string; points?: string };
    expect(drawn.has(node.d ?? node.points ?? '')).toBe(true);
  });
});
