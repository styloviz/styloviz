import { TestBed } from '@angular/core/testing';
import { render, type ComponentInput } from '@testing-library/angular';
import { SvSliderComponent } from './slider.component';

async function setup(inputs: ComponentInput<SvSliderComponent> = {}) {
  TestBed.resetTestingModule();
  return render(SvSliderComponent, { inputs });
}

describe('SvSliderComponent — size', () => {
  it('keeps the wrapper as tall as the thumb for every size', async () => {
    // The wrapper height IS the thumb diameter — that is how the thumb ends up
    // centred on the track without a magic offset. A size whose wrapper and
    // track disagree puts the thumb off the rail.
    const expected = {
      sm: { wrap: 'h-3.5', track: 'h-1' },
      md: { wrap: 'h-4', track: 'h-1.5' },
      lg: { wrap: 'h-5', track: 'h-2.5' },
    } as const;

    for (const size of ['sm', 'md', 'lg'] as const) {
      const { fixture } = await setup({ size });
      const c = fixture.componentInstance;
      expect(c.wrapHeight()).toBe(expected[size].wrap);
      expect(c.trackHeight()).toBe(expected[size].track);
    }
  });

  it('gives no two sizes the same track', async () => {
    const seen = new Set<string>();
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { fixture } = await setup({ size });
      seen.add(fixture.componentInstance.trackHeight());
    }
    expect(seen.size).toBe(3);
  });
});

describe('SvSliderComponent — range handle stacking', () => {
  /**
   * The two handles are stacked native inputs filling the same box, so
   * whichever is painted on top is the one a click reaches — the component
   * cannot intercept the hit test, only arrange it in advance.
   *
   * These cover the FALLBACK rule, used when there is no pointer position yet
   * (a touch's first tap, a fresh render). The nearest-handle rule that runs
   * once the pointer is over the track lives in `slider.handles.spec.ts`.
   */
  it('keeps the end handle on top while the handles are apart', async () => {
    const { fixture } = await setup({ range: true, min: 0, max: 100, rangeStart: 20, rangeEnd: 80 });
    const c = fixture.componentInstance;
    expect(c.startZIndex()).toBe('z-10');
    expect(c.endZIndex()).toBe('z-20');
  });

  it('lifts the start handle above the end one once it reaches the far right', async () => {
    const { fixture } = await setup({ range: true, min: 0, max: 100, rangeStart: 98, rangeEnd: 100 });
    const c = fixture.componentInstance;
    expect(c.startZIndex()).toBe('z-20');
    expect(c.endZIndex()).toBe('z-10');
  });

  it('flips on the condition, not on a percentage', async () => {
    // ★★★ THIS TEST USED TO PIN 97 % — "96 keeps the normal order, 97 flips" —
    //     and that number was the bug, not the contract. The thing that matters
    //     is whether the END handle has anywhere to go: at `max` it does not, so
    //     the start handle must be the reachable one however far left it is.
    //     Pinning the threshold made an arbitrary constant look like a decision.
    const far = await setup({ range: true, min: 0, max: 100, rangeStart: 96, rangeEnd: 100 });
    expect(far.fixture.componentInstance.startZIndex()).toBe('z-20');

    // End is NOT at the maximum: nothing is stuck, so the conventional order
    // stands even with the start handle far right.
    const room = await setup({ range: true, min: 0, max: 100, rangeStart: 96, rangeEnd: 98 });
    expect(room.fixture.componentInstance.startZIndex()).toBe('z-10');
  });
});
