import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvIconSvgComponent } from './icon-svg.component';
import type { IconNode } from './icon.types';

/**
 * The renderer every icon in the free package delegates to, and the reason a
 * bug here is never one bug: it is 168 of them.
 *
 * What is worth asserting is not that an `<svg>` appears. It is that the
 * geometry survives the weight switch. `solid` swaps the root from
 * stroke-to-fill, and **a `<line>` cannot be filled** — so a primitive with no
 * stroke of its own simply stops existing, silently, with no error and nothing
 * on screen to say so.
 */

async function setup(inputs: Partial<ComponentInput<SvIconSvgComponent>> & { nodes: readonly IconNode[] }) {
  TestBed.resetTestingModule();
  return render(SvIconSvgComponent, {
    inputs: inputs as ComponentInput<SvIconSvgComponent>,
  });
}

const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;
const svg = (f: { nativeElement: unknown }) => el(f).querySelector('svg')!;
const one = (f: { nativeElement: unknown }, sel: string) => svg(f).querySelector(sel)!;

/** How an element will actually be painted, after inheritance from the root. */
function effective(node: Element, attr: 'fill' | 'stroke'): string | null {
  for (let e: Element | null = node; e; e = e.parentElement) {
    const v = e.getAttribute(attr);
    if (v !== null) return v;
    if (e.tagName.toLowerCase() === 'svg') break;
  }
  return null;
}

const LINE: IconNode = { tag: 'line', x1: 4, y1: 12, x2: 20, y2: 12 };
const PATH: IconNode = { tag: 'path', d: 'M4 4h16v16H4z' };
const OPEN_POLYLINE: IconNode = { tag: 'polyline', points: '5 12 10 17 19 8' };
const DOT: IconNode = { tag: 'circle', cx: 12, cy: 12, r: 2, fill: true };
/** A filled square with a square hole — the knockout only survives `evenodd`. */
const SILHOUETTE: IconNode[] = [{ tag: 'path', d: 'M2 2h20v20H2zM8 8v8h8V8z', fillRule: 'evenodd' }];

describe('SvIconSvgComponent — the primitives', () => {
  it('draws every tag it claims to support', async () => {
    const { fixture } = await setup({
      nodes: [
        PATH,
        { tag: 'circle', cx: 12, cy: 12, r: 8 },
        LINE,
        OPEN_POLYLINE,
        { tag: 'polygon', points: '12 2 22 22 2 22' },
        { tag: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 2 },
      ],
    });
    for (const tag of ['path', 'circle', 'line', 'polyline', 'polygon', 'rect']) {
      expect(svg(fixture).querySelector(tag), tag).not.toBeNull();
    }
  });

  it('passes each primitive its own geometry', async () => {
    const { fixture } = await setup({
      nodes: [{ tag: 'rect', x: 3, y: 4, width: 18, height: 16, rx: 2 }],
    });
    const rect = one(fixture, 'rect');
    expect(rect.getAttribute('x')).toBe('3');
    expect(rect.getAttribute('y')).toBe('4');
    expect(rect.getAttribute('width')).toBe('18');
    expect(rect.getAttribute('height')).toBe('16');
    expect(rect.getAttribute('rx')).toBe('2');
  });

  it('never emits an attribute the browser would discard', async () => {
    // A single NaN or "undefined" in a geometry attribute is not a wrong
    // picture — the browser drops the whole element.
    const { fixture } = await setup({ nodes: [PATH, LINE, DOT], size: 20, rotate: 45 });
    expect(svg(fixture).outerHTML).not.toMatch(/NaN|undefined/);
  });

  it('renders an empty node list without complaint', async () => {
    const { fixture } = await setup({ nodes: [] });
    expect(svg(fixture)).not.toBeNull();
    expect(svg(fixture).querySelector('path')).toBeNull();
  });
});

describe('SvIconSvgComponent — weight', () => {
  it('outlines in line weight', async () => {
    const { fixture } = await setup({ nodes: [PATH] });
    expect(svg(fixture).getAttribute('fill')).toBe('none');
    expect(svg(fixture).getAttribute('stroke')).toBe('currentColor');
  });

  it('fills in solid weight', async () => {
    const { fixture } = await setup({ nodes: [PATH], weight: 'solid' });
    expect(svg(fixture).getAttribute('fill')).toBe('currentColor');
    expect(svg(fixture).getAttribute('stroke')).toBe('none');
  });

  it('keeps a filled node solid inside an outlined icon', async () => {
    const { fixture } = await setup({ nodes: [PATH, DOT] });
    expect(one(fixture, 'circle').getAttribute('fill')).toBe('currentColor');
    expect(one(fixture, 'circle').getAttribute('stroke')).toBe('none');
  });

  it('carries the stroke width through', async () => {
    const { fixture } = await setup({ nodes: [PATH], strokeWidth: 3 });
    expect(svg(fixture).getAttribute('stroke-width')).toBe('3');
  });

  it('still draws a <line> in solid weight', async () => {
    // ★ `close`, `menu`, `plus`, `minus` and `loader` are made of nothing but
    // <line>s. A line has no interior, so filling it paints nothing — and with
    // the root stroke set to "none" for solid, those five icons rendered as an
    // empty box. 35 more lost a shaft, a stripe or a set of date rows.
    const { fixture } = await setup({ nodes: [LINE], weight: 'solid' });
    const line = one(fixture, 'line');
    expect(effective(line, 'stroke')).toBe('currentColor');
    expect(effective(line, 'fill')).not.toBe('currentColor');
  });

  it('does not fill an open polyline in solid weight', async () => {
    // Filling an open polyline closes it along the implied edge: `check`
    // becomes a wedge and `chevron-down` becomes a triangle. Stroke-only
    // geometry stays stroke-only whatever the weight.
    const { fixture } = await setup({ nodes: [OPEN_POLYLINE], weight: 'solid' });
    const poly = one(fixture, 'polyline');
    expect(effective(poly, 'stroke')).toBe('currentColor');
    expect(poly.getAttribute('fill')).toBe('none');
  });

  it('leaves a closed shape filled in solid weight', async () => {
    const { fixture } = await setup({ nodes: [PATH], weight: 'solid' });
    expect(effective(one(fixture, 'path'), 'fill')).toBe('currentColor');
  });
});

describe('SvIconSvgComponent — size', () => {
  it.each([
    ['sm', '16'],
    ['md', '20'],
    ['lg', '24'],
  ])('maps the %s token to %s px', async (token, px) => {
    const { fixture } = await setup({ nodes: [PATH], size: token as 'sm' });
    expect(svg(fixture).getAttribute('width')).toBe(px);
    expect(svg(fixture).getAttribute('height')).toBe(px);
  });

  it('takes an explicit pixel count', async () => {
    const { fixture } = await setup({ nodes: [PATH], size: 48 });
    expect(svg(fixture).getAttribute('width')).toBe('48');
  });

  it('keeps the viewBox fixed whatever the size', async () => {
    const { fixture } = await setup({ nodes: [PATH], size: 48 });
    expect(svg(fixture).getAttribute('viewBox')).toBe('0 0 24 24');
  });
});

describe('SvIconSvgComponent — how it is announced', () => {
  it('hides itself from assistive tech when it has no title', async () => {
    const { fixture } = await setup({ nodes: [PATH] });
    expect(svg(fixture).getAttribute('aria-hidden')).toBe('true');
    expect(svg(fixture).getAttribute('role')).toBeNull();
    expect(svg(fixture).querySelector('title')).toBeNull();
  });

  it('treats an empty title as decorative, not as a blank name', async () => {
    // An icon named "" is worse than an unnamed one: it is announced, and it
    // says nothing.
    const { fixture } = await setup({ nodes: [PATH], title: '' });
    expect(svg(fixture).getAttribute('aria-hidden')).toBe('true');
  });

  it('becomes an image with a name once it is given a title', async () => {
    const { fixture } = await setup({ nodes: [PATH], title: 'Delete' });
    expect(svg(fixture).getAttribute('role')).toBe('img');
    expect(svg(fixture).getAttribute('aria-label')).toBe('Delete');
    expect(svg(fixture).getAttribute('aria-hidden')).toBeNull();
    expect(svg(fixture).querySelector('title')?.textContent).toBe('Delete');
  });
});

describe('SvIconSvgComponent — orientation', () => {
  it('adds no transform when it is not asked to move', async () => {
    const { fixture } = await setup({ nodes: [PATH] });
    expect(svg(fixture).querySelector('g')?.getAttribute('transform')).toBeNull();
  });

  it('rotates about the centre of the grid, not the origin', async () => {
    const { fixture } = await setup({ nodes: [PATH], rotate: 90 });
    expect(svg(fixture).querySelector('g')?.getAttribute('transform')).toBe('rotate(90 12 12)');
  });

  it('mirrors on each axis', async () => {
    const h = await setup({ nodes: [PATH], flip: 'horizontal' });
    expect(svg(h.fixture).querySelector('g')?.getAttribute('transform')).toBe('translate(24 0) scale(-1 1)');

    const v = await setup({ nodes: [PATH], flip: 'vertical' });
    expect(svg(v.fixture).querySelector('g')?.getAttribute('transform')).toBe('translate(0 24) scale(1 -1)');
  });

  it('composes a rotation with a flip, flip first', async () => {
    const { fixture } = await setup({ nodes: [PATH], rotate: 90, flip: 'horizontal' });
    expect(svg(fixture).querySelector('g')?.getAttribute('transform'))
      .toBe('rotate(90 12 12) translate(24 0) scale(-1 1)');
  });

  it('treats a rotation of zero as no rotation', async () => {
    const { fixture } = await setup({ nodes: [PATH], rotate: 0 });
    expect(svg(fixture).querySelector('g')?.getAttribute('transform')).toBeNull();
  });
});

describe('SvIconSvgComponent — styling hook', () => {
  it('puts the host classes on the svg itself, where colour is inherited from', async () => {
    // Angular normalises and reorders a `[class]` string, so assert membership.
    const { fixture } = await setup({ nodes: [PATH], cssClass: 'h-4 w-4 text-rose-500' });
    expect([...svg(fixture).classList].sort()).toEqual(['h-4', 'text-rose-500', 'w-4']);
  });

  it('paints from currentColor so it inherits the surrounding text colour', async () => {
    const { fixture } = await setup({ nodes: [PATH] });
    expect(svg(fixture).getAttribute('stroke')).toBe('currentColor');
  });
});

describe('SvIconSvgComponent — solid draws the silhouette', () => {
  // ★ Before 2026-10-02 the free renderer had no silhouette input at all:
  // `solid` filled the LINE geometry, so an outline's interior detail vanished
  // under the fill — calendar, mail, globe and clock rendered as black blobs.
  it('draws the silhouette instead of the line art in solid weight', async () => {
    const { fixture } = await setup({ nodes: [LINE, PATH], solidNodes: SILHOUETTE, weight: 'solid' });
    const drawn = [...svg(fixture).querySelectorAll('path, line, circle, polyline, polygon, rect')];
    expect(drawn.map((n) => n.tagName.toLowerCase())).toEqual(['path']);
    expect(drawn[0].getAttribute('d')).toBe(SILHOUETTE[0].d);
    expect(effective(drawn[0], 'fill')).toBe('currentColor');
    expect(effective(drawn[0], 'stroke')).toBe('none');
  });

  it('carries the fill-rule through, so an interior knockout survives', async () => {
    const { fixture } = await setup({ nodes: [PATH], solidNodes: SILHOUETTE, weight: 'solid' });
    expect(one(fixture, 'path').getAttribute('fill-rule')).toBe('evenodd');
  });

  it('ignores the silhouette in line weight', async () => {
    const { fixture } = await setup({ nodes: [LINE, PATH], solidNodes: SILHOUETTE });
    expect(svg(fixture).querySelectorAll('line').length).toBe(1);
    expect(one(fixture, 'path').getAttribute('d')).toBe(PATH.d);
  });

  it('treats an empty silhouette as no silhouette', async () => {
    const { fixture } = await setup({ nodes: [LINE], solidNodes: [], weight: 'solid' });
    expect(effective(one(fixture, 'line'), 'stroke')).toBe('currentColor');
  });
});
