import { Component } from '@angular/core';
import { render } from '@testing-library/angular';
import { SvRevealFocusDirective, svUnobscuredDelta, type SvBox } from './reveal-focus';

const box = (top: number, left: number, bottom: number, right: number): SvBox => ({ top, left, bottom, right });

/**
 * WCAG 2.2 SC 2.4.11 (FL-B5): focus scrolled to a scroller's edge lands under
 * the sticky band that holds that edge. The arithmetic is asserted per side,
 * and on the cross axis — a band only hides what it actually overlaps.
 */
describe('svUnobscuredDelta', () => {
  const row = box(30, 0, 60, 400);

  it('scrolls up by the overlap with a sticky header', () => {
    expect(svUnobscuredDelta(row, [{ side: 'top', box: box(0, 0, 48, 400) }])).toEqual({ dx: 0, dy: -18 });
  });

  it('scrolls down by the overlap with a sticky footer', () => {
    expect(svUnobscuredDelta(box(380, 0, 410, 400), [{ side: 'bottom', box: box(390, 0, 430, 400) }])).toEqual({ dx: 0, dy: 20 });
  });

  it('leaves a target that is already clear of every band alone', () => {
    expect(svUnobscuredDelta(box(100, 0, 130, 400), [{ side: 'top', box: box(0, 0, 48, 400) }])).toEqual({ dx: 0, dy: 0 });
  });

  it('ignores a band that does not overlap the target on the other axis', () => {
    // A pinned first column (0–120) does not hide a cell at 300–400.
    expect(svUnobscuredDelta(box(0, 300, 30, 400), [{ side: 'start', box: box(0, 0, 500, 120) }])).toEqual({ dx: 0, dy: 0 });
  });

  it('clears a pinned start column, mirrored under rtl', () => {
    const cell = box(100, 100, 130, 220);
    expect(svUnobscuredDelta(cell, [{ side: 'start', box: box(0, 0, 500, 160) }])).toEqual({ dx: -60, dy: 0 });
    // rtl: start is the RIGHT edge; a band at 180–400 overlaps the cell by 40.
    expect(svUnobscuredDelta(cell, [{ side: 'start', box: box(0, 180, 500, 400) }], true)).toEqual({ dx: 40, dy: 0 });
  });

  it('takes the largest overlap when two bands hold the same edge', () => {
    const bands = [
      { side: 'top' as const, box: box(0, 0, 40, 400) },
      { side: 'top' as const, box: box(40, 0, 70, 400) },
    ];
    expect(svUnobscuredDelta(row, bands).dy).toBe(-40);
  });
});

@Component({
  standalone: true,
  imports: [SvRevealFocusDirective],
  template: `
    <div svRevealFocus id="scroller">
      <div data-sv-sticky="top" id="band"><button id="in-band">Sort</button></div>
      <button id="row">Row</button>
      <div svRevealFocus id="inner"><div data-sv-sticky="top" id="inner-band"></div></div>
    </div>
  `,
})
class Host {}

describe('SvRevealFocusDirective', () => {
  const rect = (el: Element, r: SvBox) =>
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ ...r, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top, toJSON: () => r });

  async function setup() {
    const { fixture } = await render(Host);
    const root = fixture.nativeElement as HTMLElement;
    const scroller = root.querySelector<HTMLElement>('#scroller')!;
    const dir = fixture.debugElement.children[0].injector.get(SvRevealFocusDirective);
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy as unknown as typeof scroller.scrollBy;
    rect(root.querySelector('#band')!, box(0, 0, 48, 400));
    rect(root.querySelector('#inner-band')!, box(0, 0, 200, 400));
    return { root, dir, scrollBy };
  }

  it('scrolls a focused row out from under its own sticky header', async () => {
    const { root, dir, scrollBy } = await setup();
    const row = root.querySelector<HTMLElement>('#row')!;
    rect(row, box(30, 0, 60, 400));
    dir.reveal(row);
    // Only its own band (48) counts — the nested scroller's 200 px band is that scroller's business.
    expect(scrollBy).toHaveBeenCalledWith({ left: 0, top: -18 });
  });

  it('does not move for focus inside the band itself', async () => {
    const { root, dir, scrollBy } = await setup();
    const inBand = root.querySelector<HTMLElement>('#in-band')!;
    rect(inBand, box(10, 0, 40, 80));
    dir.reveal(inBand);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('acts on the next frame after focus moves inside', async () => {
    const { root, scrollBy } = await setup();
    const row = root.querySelector<HTMLElement>('#row')!;
    rect(row, box(30, 0, 60, 400));
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => (frames.push(cb), frames.length));
    row.focus();
    expect(scrollBy).not.toHaveBeenCalled();
    frames.forEach((cb) => cb(0));
    expect(scrollBy).toHaveBeenCalledWith({ left: 0, top: -18 });
  });
});
