import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvSliderComponent } from './slider.component';

/**
 * WCAG 2.5.7 (Dragging Movements) — range mode must be operable with a single
 * pointer and no drag. A click on the bare track moves the NEAREST handle,
 * snapped to `step`, through the same clamping (and the same `rangeChange`)
 * as every other path.
 */

async function setup(inputs: ComponentInput<SvSliderComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvSliderComponent, { inputs: { range: true, ...inputs } });
}

/** The 24 px tap strip around the track (WCAG 2.5.8's equivalent for the stacked thumbs). */
const trackStrip = (host: HTMLElement) => host.querySelector<HTMLElement>('[data-sv-range-track]')!;

/** A 200px track at x=0; click (no movement) at `frac` of its width. */
function clickTrack(host: HTMLElement, frac: number): void {
  const strip = trackStrip(host);
  strip.getBoundingClientRect = () =>
    ({ left: 0, width: 200, top: 0, height: 28, right: 200, bottom: 28, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  // Target the visual track background — the inputs are pointer-events-none there.
  const target = strip.querySelector<HTMLElement>('[class*="relative w-full"] > div') ?? strip;
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: frac * 200 }));
}

describe('SvSliderComponent — range track click (WCAG 2.5.7)', () => {
  it('a click on the track moves the nearer END handle and emits rangeChange', async () => {
    const { fixture } = await setup({ min: 0, max: 100, rangeStart: 20, rangeEnd: 60 });
    const emitted: [number, number][] = [];
    fixture.componentInstance.rangeChange.subscribe((r) => emitted.push(r));
    clickTrack(fixture.nativeElement as HTMLElement, 0.9);
    fixture.detectChanges();
    expect(fixture.componentInstance.rangeEnd()).toBe(90);
    expect(fixture.componentInstance.rangeStart()).toBe(20);
    expect(emitted).toEqual([[20, 90]]);
  });

  it('a click nearer the start handle moves START, snapped to step', async () => {
    const { fixture } = await setup({ min: 0, max: 100, step: 5, rangeStart: 40, rangeEnd: 80 });
    clickTrack(fixture.nativeElement as HTMLElement, 0.115); // raw 11.5 → 10
    fixture.detectChanges();
    expect(fixture.componentInstance.rangeStart()).toBe(10);
    expect(fixture.componentInstance.rangeEnd()).toBe(80);
  });

  it('respects minGap: the moved handle stops short of the other one', async () => {
    const { fixture } = await setup({ min: 0, max: 100, minGap: 10, rangeStart: 20, rangeEnd: 40 });
    clickTrack(fixture.nativeElement as HTMLElement, 0.29); // nearer start, but gap caps it at 30
    fixture.detectChanges();
    expect(fixture.componentInstance.rangeStart()).toBe(29);
    clickTrack(fixture.nativeElement as HTMLElement, 0.32); // nearer start → clamped to end − gap
    fixture.detectChanges();
    expect(fixture.componentInstance.rangeStart()).toBe(30);
  });

  it('does nothing when disabled', async () => {
    const { fixture } = await setup({ min: 0, max: 100, disabled: true, rangeStart: 20, rangeEnd: 60 });
    const emitted: [number, number][] = [];
    fixture.componentInstance.rangeChange.subscribe((r) => emitted.push(r));
    clickTrack(fixture.nativeElement as HTMLElement, 0.9);
    expect(fixture.componentInstance.rangeEnd()).toBe(60);
    expect(emitted).toEqual([]);
  });

  it('leaves a click on a thumb (the native input) to the browser', async () => {
    const { fixture } = await setup({ min: 0, max: 100, rangeStart: 20, rangeEnd: 60 });
    const w = trackStrip(fixture.nativeElement as HTMLElement);
    w.getBoundingClientRect = () =>
      ({ left: 0, width: 200, top: 0, height: 16, right: 200, bottom: 16, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    w.querySelector('input')!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 190 }));
    expect(fixture.componentInstance.rangeEnd()).toBe(60);
  });
});
