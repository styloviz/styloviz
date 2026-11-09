import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SvPauseOffscreenDirective } from './pause-offscreen.directive';

/**
 * svPauseOffscreen (SF-12) marks its host while it is out of view; the kit
 * stylesheet pauses every CSS animation under a marked element. These pin the
 * marking, the margin it observes with, and the clean-up — the stylesheet half
 * is pinned by the e2e scroll-compositing spec, which counts running animations.
 */

@Component({
  standalone: true,
  imports: [SvPauseOffscreenDirective],
  template: `<div svPauseOffscreen [pauseMargin]="margin"><span class="animate-spin"></span></div>`,
})
class HostComponent {
  margin = '200px';
}

interface FakeObserver {
  readonly callback: IntersectionObserverCallback;
  readonly options?: IntersectionObserverInit;
  readonly observe: ReturnType<typeof vi.fn>;
  readonly disconnect: ReturnType<typeof vi.fn>;
}

describe('SvPauseOffscreenDirective', () => {
  const observers: FakeObserver[] = [];
  const realIO = globalThis.IntersectionObserver;

  beforeEach(() => {
    observers.length = 0;
    class Fake {
      readonly observe = vi.fn();
      readonly disconnect = vi.fn();
      readonly unobserve = vi.fn();
      constructor(
        readonly callback: IntersectionObserverCallback,
        readonly options?: IntersectionObserverInit,
      ) {
        observers.push(this);
      }
    }
    globalThis.IntersectionObserver = Fake as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = realIO;
  });

  async function mount(margin?: string) {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(HostComponent);
    if (margin) fixture.componentInstance.margin = margin;
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector('[svPauseOffscreen]') as HTMLElement;
    const fire = (isIntersecting: boolean) =>
      observers[0].callback([{ isIntersecting, target: host } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    return { fixture, host, fire };
  }

  it('starts unmarked — nothing is paused before the observer has spoken', async () => {
    const { host } = await mount();
    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledWith(host);
    expect(host.hasAttribute('data-sv-offscreen')).toBe(false);
  });

  it('marks the host while it is out of view, and unmarks it when it returns', async () => {
    const { host, fire } = await mount();
    fire(false);
    expect(host.hasAttribute('data-sv-offscreen')).toBe(true);
    fire(true);
    expect(host.hasAttribute('data-sv-offscreen')).toBe(false);
  });

  it('observes with the margin it was given, so it resumes before the host arrives', async () => {
    await mount();
    expect(observers[0].options?.rootMargin).toBe('200px');
    await mount('400px');
    expect(observers[observers.length - 1].options?.rootMargin).toBe('400px');
  });

  it('disconnects on destroy and leaves nothing paused behind', async () => {
    const { fixture, host, fire } = await mount();
    fire(false);
    fixture.destroy();
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(host.hasAttribute('data-sv-offscreen')).toBe(false);
  });

  it('does nothing at all without an IntersectionObserver', async () => {
    globalThis.IntersectionObserver = undefined as unknown as typeof IntersectionObserver;
    const { host } = await mount();
    expect(observers).toHaveLength(0);
    expect(host.hasAttribute('data-sv-offscreen')).toBe(false);
  });
});
