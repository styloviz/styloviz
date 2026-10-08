import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SvRevealDirective } from './reveal.directive';

/**
 * The observer is released when the element goes away (1.0 release audit, M8).
 * It only ever disconnected on the first reveal, so a section that was routed
 * away from before it scrolled into view stayed observed for the life of the tab.
 */

@Component({
  standalone: true,
  imports: [SvRevealDirective],
  template: `<section svReveal>below the fold</section>`,
})
class HostComponent {}

describe('SvRevealDirective', () => {
  const observers: { observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const realIO = globalThis.IntersectionObserver;
  const realMatchMedia = window.matchMedia;

  beforeEach(() => {
    observers.length = 0;
    class FakeObserver {
      readonly observe = vi.fn();
      readonly disconnect = vi.fn();
      readonly unobserve = vi.fn();
      constructor() {
        observers.push(this);
      }
    }
    globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
    window.matchMedia = ((q: string) => ({ matches: false, media: q })) as unknown as typeof window.matchMedia;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 10_000, bottom: 10_100, left: 0, right: 100, width: 100, height: 100, x: 0, y: 10_000,
      toJSON: () => ({}),
    } as DOMRect);
  });

  afterEach(() => {
    globalThis.IntersectionObserver = realIO;
    window.matchMedia = realMatchMedia;
    vi.restoreAllMocks();
  });

  it('observes an element below the fold, and disconnects when it is destroyed unseen', async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledTimes(1);
    expect(observers[0].disconnect).not.toHaveBeenCalled();

    fixture.destroy();
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });
});
