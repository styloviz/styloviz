import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvRatingComponent } from './rating.component';

/**
 * Half stars, the summary panel's two ways of getting an average, and the
 * guards that must keep a read-only or disabled control from moving.
 *
 * ★ Half-star selection divides the pointer's offset by the icon's width, and
 * jsdom gives every element a zero-width rect — `(x - 0) / 0` is NaN and
 * `NaN < 0.5` is false, so an unstubbed environment can only ever produce the
 * WHOLE-star answer. Every half-star test therefore installs an explicit rect
 * on the icon it clicks and says which half of it the pointer is in. Nothing
 * here is concluded from a measurement jsdom made.
 */

async function setup(inputs: Partial<ComponentInput<SvRatingComponent>> = {}) {
  TestBed.resetTestingModule();
  return render(SvRatingComponent, { inputs: inputs as ComponentInput<SvRatingComponent> });
}

/** An icon 20px wide starting at x=100, with a pointer event inside it. */
function pointerAt(fraction: number): MouseEvent {
  const target = document.createElement('span');
  const rect = { top: 0, left: 100, right: 120, bottom: 20, width: 20, height: 20, x: 100, y: 0 };
  target.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect }) as DOMRect;
  const e = new MouseEvent('click', { clientX: 100 + 20 * fraction });
  Object.defineProperty(e, 'currentTarget', { value: target });
  return e;
}

describe('SvRatingComponent — half stars', () => {
  it('gives half a star for a click on the left of the icon', async () => {
    const { fixture } = await setup({ max: 5, half: true });
    fixture.componentInstance.rate(3, pointerAt(0.25));
    expect(fixture.componentInstance.value()).toBe(2.5);
  });

  it('gives a whole star for a click on the right of the icon', async () => {
    const { fixture } = await setup({ max: 5, half: true });
    fixture.componentInstance.rate(3, pointerAt(0.75));
    expect(fixture.componentInstance.value()).toBe(3);
  });

  it('puts the boundary exactly at the midpoint', async () => {
    // Dead centre belongs to the whole star: `< 0.5`, not `<= 0.5`.
    const centre = await setup({ max: 5, half: true });
    centre.fixture.componentInstance.rate(3, pointerAt(0.5));
    expect(centre.fixture.componentInstance.value()).toBe(3);

    const justBefore = await setup({ max: 5, half: true });
    justBefore.fixture.componentInstance.rate(3, pointerAt(0.49));
    expect(justBefore.fixture.componentInstance.value()).toBe(2.5);
  });

  it('ignores the pointer position when half stars are off', async () => {
    const { fixture } = await setup({ max: 5, half: false });
    fixture.componentInstance.rate(3, pointerAt(0.1));
    expect(fixture.componentInstance.value()).toBe(3);
  });

  it('gives a whole star when there is no pointer event at all', async () => {
    // Keyboard and programmatic callers pass no event; the half-star maths must
    // not run against `undefined`.
    const { fixture } = await setup({ max: 5, half: true });
    fixture.componentInstance.rate(4);
    expect(fixture.componentInstance.value()).toBe(4);
  });

  it('renders exactly half a star at 2.5', async () => {
    const { fixture } = await setup({ max: 5, half: true, value: 2.5, readonly: true });
    const c = fixture.componentInstance;
    expect(c.fillLevel(1)).toBe('full');
    expect(c.fillLevel(2)).toBe('full');
    expect(c.fillLevel(3)).toBe('half');
    expect(c.fillLevel(4)).toBe('empty');
  });

  it('never renders a half when half stars are off', async () => {
    const { fixture } = await setup({ max: 5, half: false, value: 2.5, readonly: true });
    expect(fixture.componentInstance.fillLevel(3)).toBe('empty');
  });

  it('clears the rating when the same value is chosen again', async () => {
    const { fixture } = await setup({ max: 5, half: true, value: 2.5 });
    fixture.componentInstance.rate(3, pointerAt(0.25));
    expect(fixture.componentInstance.value()).toBe(0);
  });
});

describe('SvRatingComponent — hovering', () => {
  it('previews half a star on the left of an icon', async () => {
    const { fixture } = await setup({ max: 5, half: true });
    fixture.componentInstance.hover(3, pointerAt(0.25));
    expect(fixture.componentInstance.fillLevel(3)).toBe('half');
  });

  it('previews a whole star on the right of an icon', async () => {
    const { fixture } = await setup({ max: 5, half: true });
    fixture.componentInstance.hover(3, pointerAt(0.75));
    expect(fixture.componentInstance.fillLevel(3)).toBe('full');
  });

  it('previews a whole star with no pointer event', async () => {
    const { fixture } = await setup({ max: 5, half: true });
    fixture.componentInstance.hover(3);
    expect(fixture.componentInstance.fillLevel(3)).toBe('full');
  });

  it('shows the stored value again once the pointer leaves', async () => {
    const { fixture } = await setup({ max: 5, value: 2 });
    fixture.componentInstance.hover(5);
    expect(fixture.componentInstance.fillLevel(4)).toBe('full');
    fixture.componentInstance.clearHover();
    expect(fixture.componentInstance.fillLevel(4)).toBe('empty');
  });

  it('does not preview on a read-only control', async () => {
    const { fixture } = await setup({ max: 5, value: 2, readonly: true });
    fixture.componentInstance.hover(5);
    // Assert the negative: a display-only rating that lights up under the
    // pointer reads as clickable and is not.
    expect(fixture.componentInstance.fillLevel(4)).toBe('empty');
  });

  it('does not preview on a disabled control', async () => {
    const { fixture } = await setup({ max: 5, value: 2, disabled: true });
    fixture.componentInstance.hover(5);
    expect(fixture.componentInstance.fillLevel(4)).toBe('empty');
  });
});

describe('SvRatingComponent — guards', () => {
  it('refuses to rate while read-only', async () => {
    const { fixture } = await setup({ max: 5, value: 2, readonly: true });
    const seen: number[] = [];
    fixture.componentInstance.changed.subscribe((v) => seen.push(v));
    fixture.componentInstance.rate(5);
    expect(fixture.componentInstance.value()).toBe(2);
    expect(seen).toEqual([]);
  });

  it('refuses to rate while disabled by the form', async () => {
    const { fixture } = await setup({ max: 5, value: 2 });
    fixture.componentInstance.setDisabledState(true);
    fixture.componentInstance.rate(5);
    expect(fixture.componentInstance.value()).toBe(2);
  });

  it('ignores keys it does not handle', async () => {
    const { fixture } = await setup({ max: 5, value: 2 });
    const e = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    fixture.componentInstance.onKeydown(e);
    expect(fixture.componentInstance.value()).toBe(2);
    expect(e.defaultPrevented).toBe(false);
  });

  it('steps by a half when half stars are on, and by a whole otherwise', async () => {
    const halves = await setup({ max: 5, value: 2, half: true });
    halves.fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(halves.fixture.componentInstance.value()).toBe(2.5);
    halves.fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(halves.fixture.componentInstance.value()).toBe(2);

    const wholes = await setup({ max: 5, value: 2 });
    wholes.fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(wholes.fixture.componentInstance.value()).toBe(3);
    wholes.fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(wholes.fixture.componentInstance.value()).toBe(2);
  });

  it('clamps at both ends rather than running past the scale', async () => {
    const { fixture } = await setup({ max: 5, value: 5 });
    fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(fixture.componentInstance.value()).toBe(5);

    fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(fixture.componentInstance.value()).toBe(0);
    fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(fixture.componentInstance.value()).toBe(0);

    fixture.componentInstance.onKeydown(new KeyboardEvent('keydown', { key: 'End' }));
    expect(fixture.componentInstance.value()).toBe(5);
  });
});

describe('SvRatingComponent — the summary panel', () => {
  it('prefers an explicit count over the sum of the distribution', async () => {
    const { fixture } = await setup({
      summary: true,
      count: 1200,
      distribution: [1, 2, 3, 4, 5],
    });
    expect(fixture.componentInstance.summaryTotal()).toBe(1200);
  });

  it('adds up the distribution when there is no count', async () => {
    const { fixture } = await setup({ summary: true, distribution: [1, 2, 3, 4, 5] });
    expect(fixture.componentInstance.summaryTotal()).toBe(15);
  });

  it('survives holes in the distribution array', async () => {
    // A distribution built by index assignment can have undefined slots; those
    // must count as zero rather than turning the whole sum into NaN.
    const sparse = [1, undefined, 3] as unknown as number[];
    const { fixture } = await setup({ summary: true, distribution: sparse });
    expect(fixture.componentInstance.summaryTotal()).toBe(4);
  });

  it('prefers a bound value over the weighted average', async () => {
    const { fixture } = await setup({ summary: true, value: 4.7, distribution: [10, 0, 0, 0, 0] });
    expect(fixture.componentInstance.summaryAverage()).toBe(4.7);
    expect(fixture.componentInstance.avgDisplay()).toBe('4.7');
  });

  it('weights the distribution when there is no bound value', async () => {
    // 2 ones and 2 fives → 3.0, not 2.0 (the count) and not 6.0 (the sum).
    const { fixture } = await setup({ summary: true, value: 0, distribution: [2, 0, 0, 0, 2] });
    expect(fixture.componentInstance.summaryAverage()).toBe(3);
  });

  it('reports zero rather than NaN for an empty distribution', async () => {
    const { fixture } = await setup({ summary: true, value: 0, distribution: [0, 0, 0, 0, 0] });
    expect(fixture.componentInstance.summaryAverage()).toBe(0);
    expect(fixture.componentInstance.avgDisplay()).toBe('0.0');
  });

  it('treats undefined counts as zero when weighting', async () => {
    const sparse = [2, undefined, undefined, undefined, 2] as unknown as number[];
    const { fixture } = await setup({ summary: true, value: 0, distribution: sparse });
    expect(fixture.componentInstance.summaryAverage()).toBe(3);
  });

  it('is not interactive in summary mode', async () => {
    const { fixture } = await setup({ summary: true, distribution: [1, 1, 1, 1, 1] });
    expect(fixture.componentInstance.interactive()).toBe(false);
  });
});

describe('SvRatingComponent — form integration', () => {
  it('treats a non-number write as zero', async () => {
    const { fixture } = await setup({ max: 5, value: 3 });
    fixture.componentInstance.writeValue(null as unknown as number);
    expect(fixture.componentInstance.value()).toBe(0);
    fixture.componentInstance.writeValue('4' as unknown as number);
    expect(fixture.componentInstance.value()).toBe(0);
  });

  it('accepts a real number, including a half', async () => {
    const { fixture } = await setup({ max: 5, value: 3 });
    fixture.componentInstance.writeValue(2.5);
    expect(fixture.componentInstance.value()).toBe(2.5);
  });

  it('names the scale in the singular only when the scale itself is one', async () => {
    const one = await setup({ max: 1, value: 1 });
    expect(one.fixture.componentInstance.valueText()).toBe('1 of 1 star');

    const five = await setup({ max: 5, value: 1 });
    expect(five.fixture.componentInstance.valueText()).toBe('1 of 5 stars');
  });
});
