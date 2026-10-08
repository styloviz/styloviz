import { render } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';
import { SvSparklineComponent } from './sparkline.component';
import {
  areaPathOf,
  barsOf,
  domainOf,
  linePathOf,
  pointsOf,
  statsOf,
  toValues,
} from './sparkline-geometry';

describe('sparkline-geometry — toValues', () => {
  it('accepts bare numbers and labelled points alike', () => {
    expect(toValues([1, { value: 2 }, { value: 3, label: 'Mar' }])).toEqual([1, 2, 3]);
  });

  it('drops non-finite values rather than propagating NaN', () => {
    expect(toValues([1, Number.NaN, 2, Number.POSITIVE_INFINITY, 3])).toEqual([1, 2, 3]);
  });
});

describe('sparkline-geometry — domainOf', () => {
  it('widens a flat series so it cannot divide by zero', () => {
    expect(domainOf([5, 5, 5])).toEqual({ min: 5, max: 5, range: 1 });
  });

  it('honours an explicit domain', () => {
    expect(domainOf([2, 4], 0, 10)).toEqual({ min: 0, max: 10, range: 10 });
  });

  it('orders an inverted explicit domain instead of producing a negative range', () => {
    expect(domainOf([2, 4], 10, 0).range).toBe(10);
  });

  it('survives an empty series', () => {
    expect(domainOf([]).range).toBe(1);
  });
});

describe('sparkline-geometry — pointsOf', () => {
  it('maps a larger value to a smaller y, because SVG y grows downward', () => {
    const [lo, hi] = pointsOf([0, 10], 100, 40);
    expect(lo).toMatchObject({ x: 0, y: 40 });
    expect(hi).toMatchObject({ x: 100, y: 0 });
  });

  it('spaces points evenly across the width', () => {
    expect(pointsOf([1, 2, 3], 100, 40).map((p) => p.x)).toEqual([0, 50, 100]);
  });

  it('insets by the padding so a stroke is not clipped', () => {
    const pts = pointsOf([0, 10], 100, 40, 2);
    expect(pts[0].x).toBe(2);
    expect(pts[0].y).toBe(38);
    expect(pts[1].y).toBe(2);
  });

  it('needs two points to draw a line', () => {
    expect(pointsOf([1], 100, 40)).toEqual([]);
    expect(pointsOf([], 100, 40)).toEqual([]);
  });

  it('keeps a flat series on a single horizontal line', () => {
    const ys = pointsOf([7, 7, 7], 100, 40).map((p) => p.y);
    expect(new Set(ys).size).toBe(1);
  });

  it('carries the original value and index through', () => {
    expect(pointsOf([9, 8], 10, 10)[1]).toMatchObject({ i: 1, value: 8 });
  });
});

describe('sparkline-geometry — paths', () => {
  it('emits a straight polyline by default', () => {
    expect(linePathOf(pointsOf([0, 10], 100, 40))).toBe('M0,40 L100,0');
  });

  it('emits quadratic segments when smoothed, ending on the last point', () => {
    const d = linePathOf(pointsOf([0, 10, 0], 100, 40), true);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('Q');
    expect(d.endsWith('L100,40')).toBe(true);
  });

  it('keeps a smoothed curve inside the data envelope', () => {
    // Every control and end point must stay within the drawing box.
    const d = linePathOf(pointsOf([0, 10, 0, 10], 100, 40), true);
    const ys = [...d.matchAll(/-?\d+(?:\.\d+)?,(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(40);
  });

  it('closes the area along the baseline', () => {
    expect(areaPathOf(pointsOf([0, 10], 100, 40), 40)).toBe('M0,40 L100,0 L100,40 L0,40 Z');
  });

  it('returns empty paths for a series too short to draw', () => {
    expect(linePathOf(pointsOf([1], 100, 40))).toBe('');
    expect(areaPathOf(pointsOf([1], 100, 40), 40)).toBe('');
  });
});

describe('sparkline-geometry — barsOf', () => {
  it('divides the width into one slot per value', () => {
    const bars = barsOf([1, 2, 3], 30, 10, { gap: 0 });
    expect(bars.map((b) => b.x)).toEqual([0, 10, 20]);
    expect(bars.every((b) => b.width === 10)).toBe(true);
  });

  it('grows bars from the series minimum by default', () => {
    const bars = barsOf([1, 2, 3], 30, 10, { gap: 0 });
    expect(bars[2].height).toBe(10);
    expect(bars[2].y).toBe(0);
  });

  it('keeps every bar inside the box, including a zero-height one', () => {
    for (const b of barsOf([1, 2, 3], 30, 10, { gap: 0 })) {
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(10);
      expect(b.height).toBeGreaterThanOrEqual(1);
    }
  });

  it('flags values against an explicit baseline', () => {
    const bars = barsOf([-2, 5], 20, 10, { baseline: 0 });
    expect(bars.map((b) => b.positive)).toEqual([false, true]);
  });

  it('gives every win/loss bar the same size, so only direction reads', () => {
    const bars = barsOf([-3, 9, -1], 30, 10, { baseline: 0, uniform: true });
    expect(new Set(bars.map((b) => b.height)).size).toBe(1);
    expect(bars[0].y).toBeGreaterThan(bars[1].y);
  });

  it('renders a single value without collapsing', () => {
    const [only] = barsOf([42], 30, 10, { gap: 0 });
    expect(only.width).toBe(30);
    expect(only.height).toBeGreaterThanOrEqual(1);
  });

  it('returns nothing for an empty series', () => {
    expect(barsOf([], 30, 10)).toEqual([]);
  });
});

describe('sparkline-geometry — statsOf', () => {
  it('reports extremes with the index of their first occurrence', () => {
    expect(statsOf([2, 4, 1, 4, 3])).toMatchObject({
      count: 5, first: 2, last: 3, min: 1, max: 4, minIndex: 2, maxIndex: 1,
    });
  });

  it('derives direction and percentage change', () => {
    expect(statsOf([100, 110])).toMatchObject({ direction: 'up', changePct: 10 });
    expect(statsOf([100, 90])).toMatchObject({ direction: 'down', changePct: -10 });
    expect(statsOf([5, 5])).toMatchObject({ direction: 'flat', changePct: 0 });
  });

  it('declines to divide by a starting value of zero', () => {
    expect(statsOf([0, 5])).toMatchObject({ direction: 'up', changePct: null });
  });

  it('returns null for an empty series', () => {
    expect(statsOf([])).toBeNull();
  });
});

// ─── Component ───────────────────────────────────────────────────────────────

/** Resets TestBed so a single test can render more than once. */
async function setup(inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  const { fixture } = await render(SvSparklineComponent, {
    inputs: { data: [1, 5, 3, 8], ...inputs },
  });
  return fixture.nativeElement as HTMLElement;
}

describe('SvSparklineComponent — rendering', () => {
  it('draws an area fill plus a line by default', async () => {
    const el = await setup();
    expect(el.querySelectorAll('path')).toHaveLength(2);
  });

  it('draws only a line in the line variant', async () => {
    const el = await setup({ variant: 'line' });
    expect(el.querySelectorAll('path')).toHaveLength(1);
  });

  it('draws one rect per value in the bar variant', async () => {
    const el = await setup({ variant: 'bar' });
    expect(el.querySelectorAll('rect')).toHaveLength(4);
    expect(el.querySelector('path')).toBeNull();
  });

  it('draws one rect per outcome in the win/loss variant', async () => {
    const el = await setup({ data: [1, -1, 1], variant: 'winloss' });
    expect(el.querySelectorAll('rect')).toHaveLength(3);
  });

  it('paints with currentColor so it inherits the surrounding text colour', async () => {
    const el = await setup();
    const line = [...el.querySelectorAll('path')].at(-1);
    expect(line?.getAttribute('stroke')).toBe('currentColor');
  });

  it('reserves the box but draws nothing when there is no series', async () => {
    const el = await setup({ data: [] });
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelector('span')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('needs two points for a line but only one for bars', async () => {
    expect((await setup({ data: [4] })).querySelector('svg')).toBeNull();
    expect((await setup({ data: [4], variant: 'bar' })).querySelector('svg')).toBeTruthy();
  });

  it('sizes the viewBox to the requested box', async () => {
    const svg = (await setup({ width: 64, height: 20 })).querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 64 20');
  });
});

describe('SvSparklineComponent — markers and tone', () => {
  it('marks the last point on request', async () => {
    expect((await setup()).querySelectorAll('circle')).toHaveLength(0);
    expect((await setup({ showLast: true })).querySelectorAll('circle')).toHaveLength(1);
  });

  it('marks both extremes on request', async () => {
    const el = await setup({ showExtremes: true });
    expect(el.querySelectorAll('circle')).toHaveLength(2);
  });

  it('draws a reference rule at the baseline', async () => {
    const el = await setup({ baseline: 4 });
    expect(el.querySelector('line')).toBeTruthy();
  });

  it('omits the rule when no baseline is given', async () => {
    expect((await setup()).querySelector('line')).toBeNull();
  });

  it('colours a rising series positive and a falling one negative', async () => {
    const up = (await setup({ data: [1, 9] })).querySelector('svg')?.getAttribute('class') ?? '';
    const down = (await setup({ data: [9, 1] })).querySelector('svg')?.getAttribute('class') ?? '';
    expect(up).toContain('accent');
    expect(down).toContain('danger');
  });

  it('honours an explicit tone over the trend', async () => {
    const el = await setup({ data: [1, 9], tone: 'neutral' });
    expect(el.querySelector('svg')?.getAttribute('class')).toContain('gray');
  });
});

describe('SvSparklineComponent — accessibility', () => {
  it('describes the series to assistive tech', async () => {
    const svg = (await setup({ data: [100, 110] })).querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toContain('2 points');
    expect(svg?.getAttribute('aria-label')).toContain('up 10.0%');
    expect(svg?.getAttribute('aria-label')).toContain('low 100, high 110');
  });

  it('accepts an override label', async () => {
    const svg = (await setup({ ariaLabel: 'Revenue, last 7 days' })).querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe('Revenue, last 7 days');
  });

  it('drops the role along with the label when hidden, so no role-less aria-label remains', async () => {
    const svg = (await setup({ ariaHidden: true })).querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('role')).toBeNull();
    expect(svg?.getAttribute('aria-label')).toBeNull();
  });
});

describe('SvSparklineComponent — fluid width', () => {
  it('draws at the requested width by default', async () => {
    const svg = (await setup({ width: 90 })).querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('90');
  });

  it('drops the width attribute and fills the container when fluid', async () => {
    const svg = (await setup({ width: 90, fluid: true })).querySelector('svg');
    expect(svg?.getAttribute('width')).toBeNull();
    expect(svg?.getAttribute('class')).toContain('w-full');
  });

  it('keeps width as the viewBox coordinate space when fluid', async () => {
    const svg = (await setup({ width: 90, height: 30, fluid: true })).querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 90 30');
  });

  it('keeps the empty placeholder fluid too, so the row does not jump', async () => {
    const span = (await setup({ data: [], fluid: true })).querySelector('span');
    expect(span?.getAttribute('class')).toContain('w-full');
  });

  it('offers a warning tone for degraded states', async () => {
    const el = await setup({ tone: 'warning' });
    expect(el.querySelector('svg')?.getAttribute('class')).toContain('warning');
  });
});

describe('sparkline-geometry — per-axis padding', () => {
  it('pads both axes when given a number', () => {
    const [first] = pointsOf([0, 10], 100, 40, 4);
    expect(first.x).toBe(4);
    expect(first.y).toBe(36);
  });

  it('pads each axis independently when given x and y', () => {
    // Edge-to-edge horizontally, inset vertically — a chart that stretches
    // but must not have its peaks sliced.
    const pts = pointsOf([0, 10], 100, 40, { x: 0, y: 3 });
    expect(pts[0].x).toBe(0);
    expect(pts[1].x).toBe(100);
    expect(pts[0].y).toBe(37);
    expect(pts[1].y).toBe(3);
  });

  it('closes the area at the padded floor, honouring the y inset', () => {
    const pts = pointsOf([0, 10], 100, 40, { x: 0, y: 3 });
    expect(areaPathOf(pts, 40, { x: 0, y: 3 })).toContain('L0,37');
    expect(areaPathOf(pts, 40, 0)).toContain('L0,40');
  });
});

describe('SvSparklineComponent — async states', () => {
  const host = async (inputs: Record<string, unknown> = {}) => {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSparklineComponent, { inputs });
    return fixture.nativeElement as HTMLElement;
  };

  it('shimmers in the same box while loading', async () => {
    // A KPI tile with no skeleton is the most visible "this is a demo" tell on
    // a real dashboard — and a tile that resizes when data lands is worse.
    const el = await host({ loading: true, width: 120, height: 36 });
    const box = el.querySelector<HTMLElement>('[data-sv-state="loading"]')!;
    expect(box).toBeTruthy();
    expect(box.getAttribute('aria-busy')).toBe('true');
    expect(box.style.width).toBe('120px');
    expect(box.style.height).toBe('36px');
  });

  it('reports a failure rather than drawing a flat line', async () => {
    // A zeroed sparkline is indistinguishable from a real series that did not
    // move, so a failure has to say so instead of plotting one.
    const el = await host({ error: 'nope', data: [1, 2, 3] });
    expect(el.querySelector('[data-sv-state="error"]')).toBeTruthy();
    expect(el.querySelector('svg')).toBeNull();
  });

  it('holds the same footprint in every state', async () => {
    const size = { width: 90, height: 24 };
    const boxes = await Promise.all(
      [{ loading: true }, { error: 'x' }, { data: [] }].map(async (state) => {
        const el = await host({ ...size, ...state });
        // `span, button` — the error state is a button (it emits `retry`; at
        // 90×24 there is no room for a control beside the dash, so the dash is
        // the control). The invariant under test is the FOOTPRINT, not the tag.
        return el.querySelector<HTMLElement>('span, button')!.style.height;
      }),
    );
    expect(new Set(boxes).size).toBe(1);
  });

  it('draws normally once the data arrives', async () => {
    const el = await host({ data: [1, 5, 3] });
    expect(el.querySelector('svg')).toBeTruthy();
    expect(el.querySelector('[data-sv-state="loading"]')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('SvSparklineComponent — what the label admits about the scale', () => {
  const label = (f: { nativeElement: unknown }) =>
    (f.nativeElement as HTMLElement).querySelector('svg')!.getAttribute('aria-label') ?? '';

  async function make(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    const { fixture } = await render(SvSparklineComponent, { inputs });
    return fixture;
  }

  it('admits when it is scaled to itself alone', async () => {
    const f = await make({ data: [1, 2, 3] });
    // ★★★ THE MOST IMPORTANT SENTENCE THIS COMPONENT SAYS ABOUT ITSELF. A
    //     column of sparklines each scaled to itself invites exactly the
    //     comparison it cannot support, and nothing else on the page says so.
    expect(label(f)).toContain('scaled to this series alone');
    expect(label(f)).toContain('not comparable');
  });

  it('names the shared scale instead, once there is one', async () => {
    const f = await make({ data: [1, 2, 3], domain: [0, 100] });
    expect(label(f)).toContain('scale 0 to 100');
    expect(label(f)).not.toContain('not comparable');
  });

  it('lets a shared domain override the single-ended pins', async () => {
    const f = await make({ data: [1, 2, 3], domainMin: 50, domain: [0, 10] });
    expect(label(f)).toContain('scale 0 to 10');
  });

  it('says how many points fell outside the shared scale', async () => {
    const f = await make({ data: [5, 500, 900], domain: [0, 10] });
    // A shared domain makes clipping common rather than rare — two of these
    // three are drawn flat against the ceiling.
    expect(label(f)).toContain('2 beyond it');
  });

  it('counts the missing samples and names the policy', async () => {
    const f = await make({ data: [10, Number.NaN, 30, 40] });
    expect(label(f)).toContain('1 missing sample');
    expect(label(f)).toContain('drawn as breaks');
  });

  it('says which of the four policies it applied', async () => {
    for (const [policy, phrase] of [
      ['connect', 'drawn as straight lines across'],
      ['zero', 'drawn as zero'],
    ] as const) {
      const f = await make({ data: [10, Number.NaN, 30, 40], missing: policy });
      expect(label(f)).toContain(phrase);
    }
  });

  it('says nothing about gaps in a series that has none', async () => {
    const f = await make({ data: [1, 2, 3] });
    expect(label(f)).not.toContain('missing');
  });

  it('is empty when every slot is a hole', async () => {
    const f = await make({ data: [Number.NaN, Number.NaN] });
    // Slots without data are not data. Drawing the box as a chart would say
    // the opposite.
    expect((f.nativeElement as HTMLElement).querySelector('svg')).toBeNull();
  });

  it('breaks the drawn line where the sample is missing', async () => {
    const f = await make({ variant: 'line', data: [10, Number.NaN, 30, 40] });
    const d = (f.nativeElement as HTMLElement).querySelector('path')!.getAttribute('d')!;
    expect(d.match(/M/g)).toHaveLength(2);
  });

  it('closes the line back up when the host asks for the old behaviour', async () => {
    const f = await make({ variant: 'line', data: [10, Number.NaN, 30, 40], missing: 'skip' });
    const d = (f.nativeElement as HTMLElement).querySelector('path')!.getAttribute('d')!;
    expect(d.match(/M/g)).toHaveLength(1);
    expect(label(f)).toContain('left out');
  });
});
