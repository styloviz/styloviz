import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createScrollSpy, type ScrollSpySection } from './scroll-spy';

/**
 * jsdom does not implement `IntersectionObserver`. This fake captures the
 * callback and options passed to the constructor and lets a test fire
 * entries by hand — real enough to exercise `createScrollSpy`'s own logic
 * without needing a browser.
 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  readonly observed: HTMLElement[] = [];
  disconnected = false;

  constructor(
    public readonly callback: IntersectionObserverCallback,
    public readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(el: HTMLElement): void {
    this.observed.push(el);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  unobserve(): void { /* intentionally empty — the double records observe() calls; nothing is torn down */ }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Test helper: fire an intersection change for one observed element. */
  fire(el: HTMLElement, isIntersecting: boolean): void {
    this.callback(
      [{ target: el, isIntersecting } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function section(id: string): ScrollSpySection {
  const el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
  return { id, el };
}

describe('createScrollSpy', () => {
  let originalIO: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    FakeIntersectionObserver.instances = [];
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO as typeof IntersectionObserver;
    document.body.innerHTML = '';
  });

  function setup(sections: ScrollSpySection[]) {
    let spy!: ReturnType<typeof createScrollSpy>;
    const sectionsSignal = signal<readonly ScrollSpySection[]>(sections);

    @Component({ selector: 'sv-test-host', standalone: true, template: '' })
    class TestHost {
      constructor() {
        spy = createScrollSpy({ sections: sectionsSignal });
      }
    }

    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    return { spy, fixture, sectionsSignal };
  }

  it('starts with no active id before anything intersects', () => {
    const a = section('a');
    const { spy } = setup([a]);
    expect(spy.activeId()).toBeNull();
  });

  it('sets activeId to the first section reported as intersecting', () => {
    const a = section('a');
    const b = section('b');
    const { spy } = setup([a, b]);

    const io = FakeIntersectionObserver.instances[0];
    io.fire(b.el, true);
    expect(spy.activeId()).toBe('b');
  });

  it('prefers the topmost (document-order-first) section among several visible at once', () => {
    const a = section('a');
    const b = section('b');
    const { spy } = setup([a, b]);

    const io = FakeIntersectionObserver.instances[0];
    io.fire(a.el, true);
    io.fire(b.el, true);
    // Both visible — `a` comes first in the sections array, so it wins.
    expect(spy.activeId()).toBe('a');
  });

  it('re-observes when the section list changes', () => {
    const a = section('a');
    const b = section('b');
    const { spy, sectionsSignal, fixture } = setup([a]);

    const first = FakeIntersectionObserver.instances[0];
    first.fire(a.el, true);
    expect(spy.activeId()).toBe('a');

    sectionsSignal.set([a, b]);
    fixture.detectChanges();

    expect(first.disconnected).toBe(true);
    const second = FakeIntersectionObserver.instances[1];
    expect(second.observed).toEqual([a.el, b.el]);
  });

  it('passes rootMargin through to the observer options, defaulting to the top-biased band', () => {
    section('a');
    setup([section('x')]);
    const io = FakeIntersectionObserver.instances[0];
    expect(io.options?.rootMargin).toBe('0px 0px -68% 0px');
  });

  it('resets to null when the section list becomes empty', () => {
    const a = section('a');
    const { spy, sectionsSignal, fixture } = setup([a]);
    FakeIntersectionObserver.instances[0].fire(a.el, true);
    expect(spy.activeId()).toBe('a');

    sectionsSignal.set([]);
    fixture.detectChanges();
    expect(spy.activeId()).toBeNull();
  });

  it('disconnects the observer on destroy()', () => {
    const a = section('a');
    const { spy } = setup([a]);
    const io = FakeIntersectionObserver.instances[0];
    expect(io.disconnected).toBe(false);
    spy.destroy();
    expect(io.disconnected).toBe(true);
  });
});
