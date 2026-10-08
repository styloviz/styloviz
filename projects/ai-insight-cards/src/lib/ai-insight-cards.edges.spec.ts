import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { SvAiInsightCardsComponent } from './ai-insight-cards.component';
import { until } from '../../../../src/testing/async';

/**
 * The confidence bands, the trend glyphs and the "just now" bucket — three
 * small maps whose middle and lower arms nothing was reaching, plus the second
 * refresh, which has to replace the pending timer rather than stack a second.
 */

async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvAiInsightCardsComponent, { inputs });
  return fixture;
}

describe('SvAiInsightCardsComponent — confidence bands', () => {
  it('gives each band its own colour, at the boundary and below it', async () => {
    const c = (await setup()).componentInstance;

    expect(c.confidenceRingStroke(80)).toBe('var(--color-accent-500)');
    expect(c.confidenceRingStroke(79)).toBe('var(--color-warning-500)');
    expect(c.confidenceRingStroke(65)).toBe('var(--color-warning-500)');
    expect(c.confidenceRingStroke(64)).toBe('var(--color-danger-500)');
    expect(c.confidenceRingStroke(0)).toBe('var(--color-danger-500)');
  });

  it('matches the text colour to the ring, band for band', async () => {
    const c = (await setup()).componentInstance;

    expect(c.confidenceTextClass(80)).toContain('accent');
    expect(c.confidenceTextClass(79)).toContain('warning');
    expect(c.confidenceTextClass(65)).toContain('warning');
    expect(c.confidenceTextClass(64)).toContain('danger');
  });

  /** The ring is a dasharray against a 100-unit circumference. */
  it('draws the ring proportionally', async () => {
    const c = (await setup()).componentInstance;
    expect(c.ringDash(0)).toBe('0.0 100');
    expect(c.ringDash(62.5)).toBe('62.5 100');
    expect(c.ringDash(100)).toBe('100.0 100');
  });
});

describe('SvAiInsightCardsComponent — trend', () => {
  it('gives up, down and neither their own colour', async () => {
    const c = (await setup()).componentInstance;
    expect(c.trendClass('up')).toContain('accent');
    expect(c.trendClass('down')).toContain('danger');
    expect(c.trendClass('flat')).toContain('gray');
    expect(c.trendClass(undefined)).toContain('gray');
  });

  it('gives up, down and neither their own glyph', async () => {
    const c = (await setup()).componentInstance;
    const up = c.trendIcon('up');
    const down = c.trendIcon('down');
    const flat = c.trendIcon(undefined);
    expect(new Set([up, down, flat]).size).toBe(3);
    expect(flat).toBe('M5 12h14');
  });

  it('names the matching library icon for each direction', async () => {
    const c = (await setup()).componentInstance;
    expect(c.trendIconName('up')).toBe('trending-up');
    expect(c.trendIconName('down')).toBe('trending-down');
    expect(c.trendIconName('flat')).toBe('minus');
    expect(c.trendIconName(undefined)).toBe('minus');
  });
});

describe('SvAiInsightCardsComponent — relative time', () => {
  /**
   * ★★★ THE CLOCK IS FROZEN, BECAUSE ONE OF THESE ASSERTIONS HAD 1 ms OF SLACK.
   *
   * `ago()` read `Date.now()`, `relativeTime()` read it again, and the bucket is
   * decided by the difference. `ago(59_999)` therefore asserts "just now" only
   * while fewer than **one millisecond** passes between those two reads — which
   * is not a property of the code, it is a property of how fast the machine
   * happened to be. It failed for the first time in a coverage run on
   * 2026-08-20 ("expected '1m ago' to be 'just now'"), where instrumentation
   * makes every expression 4–10× slower.
   *
   * Freezing `Date` is the fix rather than backing off to 59_000, because the
   * boundary is the whole point of the test: at 59_000 it would no longer
   * distinguish a correct `< 60_000` from a wrong `<= 60_000`.
   *
   * ★ `toFake: ['Date']` only — `setTimeout`/`requestAnimationFrame` stay real,
   * so Angular's rendering and `until()` are untouched. Same pattern as
   * `display-pro/comment.component.spec.ts`, which has had it since it shipped.
   */
  const NOW = new Date(2026, 7, 20, 12, 0, 0);

  /**
   * Offsets against `Date.now()`, not literal dates: the suite runs at
   * Pacific/Marquesas (−09:30), where a bare `new Date('2026-03-15')` is the
   * 14th.
   */
  const ago = (ms: number) => new Date(Date.now() - ms);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('names each bucket, and switches at each boundary', async () => {
    const c = (await setup()).componentInstance;
    // ★ Frozen AFTER the fixture is up. `@testing/async`'s `until()` computes its
    // deadline from `Date.now()`, so a clock stopped before an `await render()`
    // would turn any poll inside it into an unkillable spin rather than a
    // timeout. Nothing below this line awaits anything.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    expect(c.relativeTime(ago(0))).toBe('just now');
    expect(c.relativeTime(ago(59_999))).toBe('just now');
    expect(c.relativeTime(ago(60_000))).toBe('1m ago');
    expect(c.relativeTime(ago(59 * 60_000))).toBe('59m ago');
    expect(c.relativeTime(ago(60 * 60_000))).toBe('1h ago');
    expect(c.relativeTime(ago(23 * 3_600_000))).toBe('23h ago');
    expect(c.relativeTime(ago(24 * 3_600_000))).toBe('1d ago');
    expect(c.relativeTime(ago(50 * 3_600_000))).toBe('2d ago');
  });
});

describe('SvAiInsightCardsComponent — a second refresh', () => {
  /**
   * ★ A reader who taps refresh twice must get ONE simulated reload, not two
   * overlapping ones — the second would clear the busy flag while the first was
   * still pending and then clear the decisions a second time underneath it.
   */
  it('replaces the pending simulation rather than stacking a second', async () => {
    const cleared = vi.spyOn(globalThis, 'clearTimeout');
    const fixture = await setup({ simulate: true });
    const c = fixture.componentInstance;

    c.refreshInsights();
    const before = cleared.mock.calls.length;
    c.refreshInsights();

    expect(cleared.mock.calls.length).toBeGreaterThan(before);
    expect(c.isLoading()).toBe(true);

    await until(() => !c.isLoading(), {
      timeoutMs: 6_000,
      label: 'the simulated refresh to settle',
    });
    cleared.mockRestore();
    fixture.destroy();
  });
});
