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

  it('leaves out a section whose element is not rendered yet, and takes it when it arrives (FL-L2)', () => {
    const a = section('a');
    const late = { id: 'late', el: null as unknown as HTMLElement };
    const { spy, sectionsSignal, fixture } = setup([a, late]);

    // A host that looked the element up before it rendered hands in null;
    // observe(null) would throw "parameter 1 is not of type 'Element'".
    expect(FakeIntersectionObserver.instances[0].observed).toEqual([a.el]);

    const arrived = section('late');
    sectionsSignal.set([a, arrived]);
    fixture.detectChanges();
    const io = FakeIntersectionObserver.instances.at(-1)!;
    expect(io.observed).toEqual([a.el, arrived.el]);
    io.fire(arrived.el, true);
    expect(spy.activeId()).toBe('late');
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

/**
 * `SR-11` — at the end of a scroll container the observer usually fires no
 * callback (the last section is already inside its band), so the spy listens
 * to `scroll` itself and lets `atEnd` hand the rail to the last section.
 */
describe('createScrollSpy — the end of the scroll (SR-11)', () => {
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

  const stubRect = (el: Element, top: number, height: number): void => {
    Object.defineProperty(el, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }),
    });
  };

  const stubScroll = (el: HTMLElement, scrollTop: number, scrollHeight: number, clientHeight: number): void => {
    Object.defineProperty(el, 'scrollTop', { configurable: true, value: scrollTop });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
  };

  /** The spy's frame is queued first, so it has run once this one resolves. */
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  function setup(box: HTMLElement, sections: ScrollSpySection[]) {
    let spy!: ReturnType<typeof createScrollSpy>;
    const sectionsSignal = signal<readonly ScrollSpySection[]>(sections);
    const rootSignal = signal<HTMLElement | null>(box);

    @Component({ selector: 'sv-test-end-host', standalone: true, template: '' })
    class TestHost {
      constructor() {
        spy = createScrollSpy({ sections: sectionsSignal, root: rootSignal });
      }
    }

    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    return { spy, fixture };
  }

  /** The kit's side-rail demo, measured: a 222 px box over 528 px of content. */
  function scene(scrollTop: number) {
    const box = document.createElement('div');
    document.body.appendChild(box);
    const intro = section('intro');
    const usage = section('usage');
    const api = section('api');
    stubRect(box, 0, 222);
    stubRect(intro.el, -300, 200);
    stubRect(usage.el, -100, 250);
    // Short final section: its heading never reaches the activation line.
    stubRect(api.el, 150, 40);
    stubScroll(box, scrollTop, 528, 222);
    return { box, sections: [intro, usage, api] };
  }

  it('activates the last section once the box is scrolled to its end', async () => {
    const { box, sections } = scene(200);
    const { spy } = setup(box, sections);
    expect(spy.activeId()).toBe('usage');

    // Scrolled the last 106 px: no observer callback, only the scroll event.
    stubScroll(box, 306, 528, 222);
    box.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(spy.activeId()).toBe('api');
  });

  it('keeps the line rule short of the end', async () => {
    const { box, sections } = scene(200);
    const { spy } = setup(box, sections);

    box.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(spy.activeId()).toBe('usage');
  });

  it('stops listening to scroll on destroy()', async () => {
    const { box, sections } = scene(200);
    const { spy } = setup(box, sections);
    spy.destroy();

    stubScroll(box, 306, 528, 222);
    box.dispatchEvent(new Event('scroll'));
    await nextFrame();
    expect(spy.activeId()).toBe('usage');
  });
});
