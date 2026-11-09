import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvRatingComponent } from './rating.component';

/**
 * Rating under `dir="rtl"` (FL-B9).
 *
 * The stars fill from the INLINE start (`start-0`), so in RTL the first star is
 * on the right and a half star is the RIGHT half of its icon. The half-star
 * pointer maths and the arrow keys have to agree with that, or a click on the
 * filled half picks the empty one and ArrowRight walks away from the value it
 * claims to raise.
 */

async function setup(inputs: Partial<ComponentInput<SvRatingComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvRatingComponent, { inputs: inputs as ComponentInput<SvRatingComponent> });
}

/** An icon 20px wide starting at x=100, with a pointer at `fraction` from its PHYSICAL left. */
function pointerAt(fraction: number): MouseEvent {
  const target = document.createElement('span');
  const rect = { top: 0, left: 100, right: 120, bottom: 20, width: 20, height: 20, x: 100, y: 0 };
  target.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect }) as DOMRect;
  const e = new MouseEvent('click', { clientX: 100 + 20 * fraction });
  Object.defineProperty(e, 'currentTarget', { value: target });
  return e;
}

describe('SvRatingComponent — right-to-left', () => {
  beforeEach(() => { document.documentElement.dir = 'rtl'; });
  afterEach(() => { document.documentElement.dir = 'ltr'; });

  it('gives half a star for a click on the RIGHT of the icon', async () => {
    const { fixture } = await setup({ max: 5, half: true });
    fixture.componentInstance.rate(3, pointerAt(0.75));
    expect(fixture.componentInstance.value()).toBe(2.5);
  });

  it('gives a whole star for a click on the LEFT of the icon', async () => {
    const { fixture } = await setup({ max: 5, half: true });
    fixture.componentInstance.rate(3, pointerAt(0.25));
    expect(fixture.componentInstance.value()).toBe(3);
  });

  it('previews the same half on hover', async () => {
    const { fixture } = await setup({ max: 5, half: true });
    fixture.componentInstance.hover(4, pointerAt(0.9));
    expect(fixture.componentInstance.hovered()).toBe(3.5);
  });

  it('raises the value with ArrowLeft and lowers it with ArrowRight', async () => {
    const { fixture } = await setup({ max: 5, value: 2 });
    const c = fixture.componentInstance;
    c.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(c.value()).toBe(3);
    c.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    c.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(c.value()).toBe(1);
  });

  it('keeps ArrowUp / ArrowDown as raise / lower', async () => {
    const { fixture } = await setup({ max: 5, value: 2 });
    const c = fixture.componentInstance;
    c.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(c.value()).toBe(3);
    c.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(c.value()).toBe(2);
  });
});
